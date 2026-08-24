import { memo, useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Stack,
  Typography,
} from '@mui/material';
import type { GridRowId } from '@mui/x-data-grid';
import { useTranslation } from '../../i18n';
import type { Bed, Field, Location } from '../../api/types';
import { useDialogEditCellOpenRequest } from '../data-grid/DialogEditCellContext';
import { isAnyContextMenuOpen } from '../contextMenu/contextMenuOpenState';
import EmptyStateCard from '../project/EmptyStateCard';
import { CompactAreaCell } from './CompactAreaCell';
import {
  collectHierarchyAvailability,
  filterFieldOptionsByLocation,
} from './areaHierarchySelection';
import { formatAreaM2, toNumericValue } from '../../pages/plantingPlansUtils';
import { TypeaheadSelect as Select } from '../inputs/TypeaheadSelect';
import { fullWidthFieldSx } from '../forms/formLayout';
import { isContextMenuDismissGestureInProgress } from '../../utils/contextMenu';

interface AreaAssignmentDialogProps {
  bedId: number | null;
  beds: Bed[];
  fields: Field[];
  locations: Location[];
  locale: string;
  onApply: (bedId: number) => Promise<void> | void;
  compactLabel: string;
  placeholder?: string;
  hasFocus?: boolean;
  memoKey?: string;
  /**
   * Grid cell identity. Passing both lets the cell pick up the grid's
   * "keyboard navigation entered this cell" requests and open the dialog —
   * see `DialogEditCellContext`.
   */
  rowId?: GridRowId;
  field?: string;
}

interface AssignmentState {
  locationId: number | null;
  fieldId: number | null;
  bedId: number | null;
}

type BedWithHierarchy = Bed & { id: number; fieldId: number; locationId: number };

const selectFieldSx = {
  ...fullWidthFieldSx,
  '& .MuiSelect-select': {
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
} as const;

const selectMenuProps = {
  slotProps: {
    paper: {
      sx: {
        maxWidth: { xs: 'calc(100vw - 32px)', sm: 420 },
        '& .MuiMenuItem-root': {
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        },
      },
    },
  },
} as const;

const normalizeState = (
  bedId: number | null,
  bedsWithLocation: BedWithHierarchy[],
): AssignmentState => {
  const selectedBed = bedsWithLocation.find((item) => item.id === bedId);
  if (!selectedBed) {
    return { locationId: null, fieldId: null, bedId: bedId ?? null };
  }

  return {
    locationId: selectedBed.locationId,
    fieldId: selectedBed.fieldId,
    bedId: selectedBed.id ?? null,
  };
};

const withDefaultSingleLocation = (
  state: AssignmentState,
  hasSingleLocation: boolean,
  selectableLocations: Location[],
): AssignmentState => {
  if (!hasSingleLocation || selectableLocations[0]?.id === undefined) {
    return state;
  }

  return {
    ...state,
    locationId: selectableLocations[0].id,
  };
};

const clampStateToAvailableHierarchy = (
  state: AssignmentState,
  selectableLocations: Location[],
  fieldsByLocationId: Map<number, Field[]>,
  bedsByFieldId: Map<number, BedWithHierarchy[]>,
): AssignmentState => {
  const locationStillValid = state.locationId !== null
    && selectableLocations.some((item) => item.id === state.locationId);
  const nextLocationId = locationStillValid ? state.locationId : null;
  const nextFields = nextLocationId ? fieldsByLocationId.get(nextLocationId) ?? [] : [];
  const fieldStillValid = state.fieldId !== null
    && nextFields.some((item) => item.id === state.fieldId);
  const nextFieldId = fieldStillValid ? state.fieldId : null;
  const nextBeds = nextFieldId ? bedsByFieldId.get(nextFieldId) ?? [] : [];
  const bedStillValid = state.bedId !== null
    && nextBeds.some((item) => item.id === state.bedId);

  return {
    locationId: nextLocationId,
    fieldId: nextFieldId,
    bedId: bedStillValid ? state.bedId : null,
  };
};

function AreaAssignmentDialogComponent({
  bedId,
  beds,
  fields,
  locations,
  locale,
  onApply,
  compactLabel,
  placeholder,
  hasFocus = false,
  rowId,
  field,
}: AreaAssignmentDialogProps) {
  const { t } = useTranslation('plantingPlans');
  const [isOpen, setIsOpen] = useState(false);
  const isOpenRef = useRef(false);
  const formRef = useRef<HTMLFormElement | null>(null);
  const [draft, setDraft] = useState<AssignmentState>({ locationId: null, fieldId: null, bedId: bedId ?? null });

  const fieldsById = useMemo(() => new Map(fields.filter((item) => item.id !== undefined).map((item) => [item.id as number, item])), [fields]);

  const bedsWithLocation = useMemo(
    () => beds
      .filter((item): item is Bed & { id: number } => item.id !== undefined)
      .map((item) => {
        const relatedField = fieldsById.get(item.field);
        if (!relatedField || relatedField.id === undefined) {
          return null;
        }

        return {
          ...item,
          fieldId: relatedField.id,
          locationId: relatedField.location,
        };
      })
      .filter((item): item is Bed & { id: number; fieldId: number; locationId: number } => item !== null),
    [beds, fieldsById],
  );

  const hierarchyAvailability = useMemo(
    () => collectHierarchyAvailability(fields, bedsWithLocation),
    [bedsWithLocation, fields],
  );

  const fieldsByLocationId = useMemo(() => {
    const grouped = new Map<number, Field[]>();
    locations
      .filter((location): location is Location & { id: number } => location.id !== undefined)
      .forEach((location) => {
        grouped.set(
          location.id,
          filterFieldOptionsByLocation(location.id, fields, hierarchyAvailability.fieldIdsWithBeds),
        );
      });
    return grouped;
  }, [fields, hierarchyAvailability.fieldIdsWithBeds, locations]);

  const bedsByFieldId = useMemo(() => {
    const grouped = new Map<number, BedWithHierarchy[]>();
    bedsWithLocation.forEach((item) => {
      const list = grouped.get(item.fieldId) ?? [];
      list.push(item);
      grouped.set(item.fieldId, list);
    });
    return grouped;
  }, [bedsWithLocation]);

  const selectableLocations = useMemo(
    () => locations.filter((item) => item.id !== undefined && hierarchyAvailability.locationIdsWithBeds.has(item.id)),
    [hierarchyAvailability.locationIdsWithBeds, locations],
  );

  const hasSingleLocation = selectableLocations.length <= 1;

  const getOpeningDraft = useCallback((): AssignmentState => (
    withDefaultSingleLocation(
      normalizeState(bedId, bedsWithLocation),
      hasSingleLocation,
      selectableLocations,
    )
  ), [bedId, bedsWithLocation, hasSingleLocation, selectableLocations]);

  const activeDraft = useMemo(() => (
    isOpen
      ? clampStateToAvailableHierarchy(draft, selectableLocations, fieldsByLocationId, bedsByFieldId)
      : draft
  ), [bedsByFieldId, draft, fieldsByLocationId, isOpen, selectableLocations]);

  const selectableFields = useMemo(() => {
    if (!activeDraft.locationId) {
      return [];
    }
    return fieldsByLocationId.get(activeDraft.locationId) ?? [];
  }, [activeDraft.locationId, fieldsByLocationId]);

  const selectableBeds = useMemo(() => {
    if (!activeDraft.fieldId) {
      return [];
    }
    return bedsByFieldId.get(activeDraft.fieldId) ?? [];
  }, [activeDraft.fieldId, bedsByFieldId]);

  const handleLocationChange = useCallback((value: number): void => {
    const nextFields = fieldsByLocationId.get(value) ?? [];
    const selectedFieldId = activeDraft.fieldId && nextFields.some((item) => item.id === activeDraft.fieldId)
      ? activeDraft.fieldId
      : null;

    setDraft({
      locationId: value,
      fieldId: selectedFieldId,
      bedId: null,
    });
  }, [activeDraft.fieldId, fieldsByLocationId]);

  const handleFieldChange = useCallback((value: number): void => {
    if (!activeDraft.locationId) {
      return;
    }

    const selectedField = fieldsByLocationId
      .get(activeDraft.locationId)
      ?.find((item) => item.id === value);
    if (!selectedField) {
      return;
    }

    const nextBeds = bedsByFieldId.get(value) ?? [];
    const selectedBedId = activeDraft.bedId && nextBeds.some((item) => item.id === activeDraft.bedId)
      ? activeDraft.bedId
      : null;

    setDraft({
      locationId: activeDraft.locationId,
      fieldId: value,
      bedId: selectedBedId,
    });
  }, [activeDraft.bedId, activeDraft.locationId, bedsByFieldId, fieldsByLocationId]);

  const handleBedChange = useCallback((value: number): void => {
    if (!activeDraft.fieldId) {
      return;
    }

    const selectedBed = (bedsByFieldId.get(activeDraft.fieldId) ?? []).find((item) => item.id === value);
    if (!selectedBed) {
      return;
    }

    setDraft((previous) => ({
      ...previous,
      bedId: value,
    }));
  }, [activeDraft.fieldId, bedsByFieldId]);

  const renderBedLabel = (item: BedWithHierarchy): string => {
    const areaSqm = toNumericValue(item.area_sqm);
    const label = areaSqm === null
      ? item.name
      : `${item.name} (${formatAreaM2(areaSqm, locale)})`;
    return label;
  };

  const isFieldSelectDisabled = !activeDraft.locationId || selectableFields.length === 0;
  const isBedSelectDisabled = !activeDraft.fieldId || selectableBeds.length === 0;
  const isApplyDisabled = !activeDraft.bedId || bedsWithLocation.length === 0;

  const handleApply = async (): Promise<void> => {
    if (isApplyDisabled || !activeDraft.bedId) {
      return;
    }
    await onApply(activeDraft.bedId);
    isOpenRef.current = false;
    setIsOpen(false);
  };

  const handleFormSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    void handleApply();
  };

  const getDialogTabStops = useCallback((): HTMLElement[] => {
    const form = formRef.current;
    if (!form) {
      return [];
    }

    return Array.from(form.querySelectorAll<HTMLElement>('[role="combobox"], button'))
      .filter((element) => (
        !element.hasAttribute('disabled')
        && element.getAttribute('aria-disabled') !== 'true'
        && element.tabIndex >= 0
      ));
  }, []);

  const focusFirstDialogControl = useCallback((): void => {
    getDialogTabStops()[0]?.focus();
  }, [getDialogTabStops]);

  useEffect(() => {
    if (!isOpen || bedsWithLocation.length === 0) {
      return;
    }

    const timeoutId = window.setTimeout(focusFirstDialogControl, 0);
    return () => window.clearTimeout(timeoutId);
  }, [bedsWithLocation.length, focusFirstDialogControl, isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleDocumentKeyDownCapture = (event: globalThis.KeyboardEvent): void => {
      if (
        event.key !== 'Tab'
        || event.altKey
        || event.ctrlKey
        || event.metaKey
      ) {
        return;
      }

      const form = formRef.current;
      const activeCombobox = form?.querySelector<HTMLElement>('[role="combobox"][aria-expanded="true"]');
      if (!form || !activeCombobox) {
        return;
      }

      event.preventDefault();
      event.stopImmediatePropagation();

      const listboxId = activeCombobox.getAttribute('aria-controls');
      const listbox = listboxId ? document.getElementById(listboxId) : null;
      const highlightedOption = listbox?.querySelector<HTMLElement>(
        '[role="option"][tabindex="0"], [role="option"].Mui-focusVisible',
      );
      highlightedOption?.click();

      window.setTimeout(() => {
        const nextTabStops = getDialogTabStops();
        if (nextTabStops.length === 0) {
          return;
        }
        const currentIndex = nextTabStops.findIndex((element) => (
          element.id === activeCombobox.id
          || element === activeCombobox
          || element.contains(activeCombobox)
        ));
        const nextIndex = event.shiftKey
          ? ((currentIndex === -1 ? 0 : currentIndex) - 1 + nextTabStops.length) % nextTabStops.length
          : ((currentIndex === -1 ? -1 : currentIndex) + 1) % nextTabStops.length;
        nextTabStops[nextIndex]?.focus();
      }, 0);
    };

    document.addEventListener('keydown', handleDocumentKeyDownCapture, true);
    return () => document.removeEventListener('keydown', handleDocumentKeyDownCapture, true);
  }, [getDialogTabStops, isOpen]);

  const handleDialogKeyDownCapture = (event: KeyboardEvent<HTMLFormElement>): void => {
    if (
      event.key !== 'Tab'
      || event.altKey
      || event.ctrlKey
      || event.metaKey
    ) {
      return;
    }

    const tabStops = getDialogTabStops();
    if (tabStops.length === 0) {
      return;
    }

    const activeElement = document.activeElement;
    const activeIndex = activeElement instanceof HTMLElement
      ? tabStops.findIndex((element) => element === activeElement || element.contains(activeElement))
      : -1;
    const activeCombobox = activeElement instanceof HTMLElement
      ? activeElement.closest<HTMLElement>('[role="combobox"][aria-expanded="true"]')
      : null;
    const currentIndex = activeIndex === -1
      ? (event.shiftKey ? 0 : -1)
      : activeIndex;

    event.preventDefault();
    event.stopPropagation();

    const focusNeighbour = (): void => {
      const nextTabStops = getDialogTabStops();
      if (nextTabStops.length === 0) {
        return;
      }
      const nextCurrentIndex = activeCombobox
        ? nextTabStops.findIndex((element) => (
          element.id === activeCombobox.id
          || element === activeCombobox
          || element.contains(activeCombobox)
        ))
        : currentIndex;
      const nextIndex = event.shiftKey
        ? ((nextCurrentIndex === -1 ? 0 : nextCurrentIndex) - 1 + nextTabStops.length) % nextTabStops.length
        : ((nextCurrentIndex === -1 ? -1 : nextCurrentIndex) + 1) % nextTabStops.length;
      nextTabStops[nextIndex]?.focus();
    };

    if (activeCombobox) {
      const listboxId = activeCombobox.getAttribute('aria-controls');
      const listbox = listboxId ? document.getElementById(listboxId) : null;
      const highlightedOption = listbox?.querySelector<HTMLElement>(
        '[role="option"][tabindex="0"], [role="option"].Mui-focusVisible',
      );
      highlightedOption?.click();
      window.setTimeout(focusNeighbour, 0);
      return;
    }

    focusNeighbour();
  };

  const handleCancel = (): void => {
    isOpenRef.current = false;
    setIsOpen(false);
  };

  /**
   * Idempotent per edit cycle: the click, the Enter/Space keydown and the
   * grid's keyboard-entry request can all fire for one and the same entry into
   * the cell, and re-running the body would reset an already edited draft.
   */
  const handleOpen = useCallback((): void => {
    if (isOpenRef.current || isAnyContextMenuOpen() || isContextMenuDismissGestureInProgress()) {
      return;
    }

    isOpenRef.current = true;
    setDraft(getOpeningDraft());
    setIsOpen(true);
  }, [getOpeningDraft]);

  useDialogEditCellOpenRequest(rowId, field, handleOpen);

  return (
    <>
      <CompactAreaCell
        label={compactLabel}
        placeholder={placeholder}
        hasFocus={hasFocus}
        suppressFocus={isOpen}
        onOpen={handleOpen}
        triggerLabel={t('areaAssignment.editButton')}
      />
      <Dialog
        open={isOpen}
        onClose={handleCancel}
        fullWidth
        maxWidth="xs"
      >
        <Box
          component="form"
          ref={formRef}
          onSubmit={handleFormSubmit}
          onKeyDownCapture={handleDialogKeyDownCapture}
          sx={{ minWidth: 0 }}
        >
          <DialogTitle>{t('areaAssignment.title')}</DialogTitle>
          <DialogContent>
            <Box sx={{ pt: 1, minWidth: 0 }}>
              {bedsWithLocation.length === 0 ? (
                <EmptyStateCard
                  title={t('areaAssignment.emptyStateTitle')}
                  description={t('areaAssignment.emptyStateDescription')}
                  actions={[{ label: t('areaAssignment.emptyStateAction'), to: '/app/fields-beds' }]}
                />
              ) : null}
              <Stack spacing={1.5} sx={{ mt: bedsWithLocation.length === 0 ? 0 : 0.5, minWidth: 0 }}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: -0.25 }}>
                  {t('areaAssignment.hierarchyHint')}
                </Typography>
                <FormControl size="small" sx={selectFieldSx}>
                  <InputLabel id="assignment-location-label">{t('columns.location')}</InputLabel>
                  <Select
                    fullWidth
                    id="assignment-location"
                    labelId="assignment-location-label"
                    value={activeDraft.locationId ?? ''}
                    label={t('columns.location')}
                    disabled={selectableLocations.length === 0}
                    MenuProps={selectMenuProps}
                    onChange={(event) => handleLocationChange(Number(event.target.value))}
                  >
                    {selectableLocations.map((item) => (
                      <MenuItem key={item.id} value={item.id} title={item.name}>{item.name}</MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <FormControl size="small" sx={selectFieldSx}>
                  <InputLabel id="assignment-field-label">{t('columns.field')}</InputLabel>
                  <Select
                    fullWidth
                    id="assignment-field"
                    labelId="assignment-field-label"
                    value={activeDraft.fieldId ?? ''}
                    label={t('columns.field')}
                    disabled={isFieldSelectDisabled}
                    MenuProps={selectMenuProps}
                    onChange={(event) => handleFieldChange(Number(event.target.value))}
                  >
                    {selectableFields.map((item) => (
                      <MenuItem key={item.id} value={item.id} title={item.name}>{item.name}</MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <FormControl size="small" sx={selectFieldSx}>
                  <InputLabel id="assignment-bed-label">{t('columns.bed')}</InputLabel>
                  <Select
                    fullWidth
                    id="assignment-bed"
                    labelId="assignment-bed-label"
                    value={activeDraft.bedId ?? ''}
                    label={t('columns.bed')}
                    disabled={isBedSelectDisabled}
                    MenuProps={selectMenuProps}
                    onChange={(event) => handleBedChange(Number(event.target.value))}
                  >
                    {selectableBeds.map((item) => {
                      const label = renderBedLabel(item);
                      return (
                        <MenuItem key={item.id} value={item.id} title={label}>{label}</MenuItem>
                      );
                    })}
                  </Select>
                </FormControl>
              </Stack>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button type="button" data-dialog-action="cancel" onClick={handleCancel}>{t('areaAssignment.cancel')}</Button>
            <Button type="submit" data-dialog-action="apply" variant="contained" disabled={isApplyDisabled}>{t('areaAssignment.apply')}</Button>
          </DialogActions>
        </Box>
      </Dialog>
    </>
  );
}

export const AreaAssignmentDialog = memo(AreaAssignmentDialogComponent, (previous, next) => (
  previous.bedId === next.bedId
  && previous.beds === next.beds
  && previous.fields === next.fields
  && previous.locations === next.locations
  && previous.locale === next.locale
  && previous.compactLabel === next.compactLabel
  && previous.placeholder === next.placeholder
  && previous.hasFocus === next.hasFocus
  && previous.memoKey === next.memoKey
  && previous.rowId === next.rowId
  && previous.field === next.field
));
