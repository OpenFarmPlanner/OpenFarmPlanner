import { memo, useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Stack,
  Typography,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import { useTranslation } from '../../i18n';
import type { Bed, Field, Location } from '../../api/types';
import EmptyStateCard from '../project/EmptyStateCard';
import {
  collectHierarchyAvailability,
  filterFieldOptionsByLocation,
} from './areaHierarchySelection';
import { formatAreaM2, toNumericValue } from '../../pages/plantingPlansUtils';
import { TypeaheadSelect as Select } from '../inputs/TypeaheadSelect';
import { fullWidthFieldSx } from '../forms/formLayout';

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
}

interface AssignmentState {
  locationId: number | null;
  fieldId: number | null;
  bedId: number | null;
}

type BedWithHierarchy = Bed & { id: number; fieldId: number; locationId: number };
interface DialogKeyboardControl {
  root: HTMLElement | null;
  focusTarget: HTMLElement | null;
  disabled: boolean;
}

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
  PaperProps: {
    sx: {
      maxWidth: { xs: 'calc(100vw - 32px)', sm: 420 },
      '& .MuiMenuItem-root': {
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
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
}: AreaAssignmentDialogProps) {
  const { t } = useTranslation('plantingPlans');
  const [isOpen, setIsOpen] = useState(false);
  const [openSelect, setOpenSelect] = useState<'location' | 'field' | 'bed' | null>(null);
  const [draft, setDraft] = useState<AssignmentState>({ locationId: null, fieldId: null, bedId: bedId ?? null });
  const locationSelectRef = useRef<HTMLDivElement | null>(null);
  const fieldSelectRef = useRef<HTMLDivElement | null>(null);
  const bedSelectRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLDivElement | null>(null);
  const cancelButtonRef = useRef<HTMLButtonElement | null>(null);
  const applyButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!hasFocus || isOpen) {
      return;
    }

    requestAnimationFrame(() => {
      triggerRef.current?.focus();
    });
  }, [hasFocus, isOpen]);

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
    setIsOpen(false);
  };

  const handleFormSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    void handleApply();
  };

  const getSelectFocusTarget = (root: HTMLDivElement | null): HTMLElement | null =>
    root?.querySelector<HTMLElement>('[role="combobox"]') ?? root;

  const getKeyboardControls = useCallback((): DialogKeyboardControl[] => [
    {
      root: locationSelectRef.current,
      focusTarget: getSelectFocusTarget(locationSelectRef.current),
      disabled: selectableLocations.length === 0,
    },
    {
      root: fieldSelectRef.current,
      focusTarget: getSelectFocusTarget(fieldSelectRef.current),
      disabled: isFieldSelectDisabled,
    },
    {
      root: bedSelectRef.current,
      focusTarget: getSelectFocusTarget(bedSelectRef.current),
      disabled: isBedSelectDisabled,
    },
    {
      root: cancelButtonRef.current,
      focusTarget: cancelButtonRef.current,
      disabled: false,
    },
    {
      root: applyButtonRef.current,
      focusTarget: applyButtonRef.current,
      disabled: isApplyDisabled,
    },
  ].filter((control) => control.root && control.focusTarget && !control.disabled), [
    isApplyDisabled,
    isBedSelectDisabled,
    isFieldSelectDisabled,
    selectableLocations.length,
  ]);

  const focusDialogControl = useCallback((control: DialogKeyboardControl | undefined): void => {
    if (!control?.focusTarget) {
      return;
    }

    requestAnimationFrame(() => {
      control.focusTarget?.focus();
    });
  }, []);

  const handleNativeTabKeyDown = useCallback((event: globalThis.KeyboardEvent): void => {
    if (!isOpen || openSelect !== null || event.key !== 'Tab') {
      return;
    }

    const controls = getKeyboardControls();
    if (controls.length === 0) {
      return;
    }

    const activeElement = document.activeElement as HTMLElement | null;
    const currentIndex = controls.findIndex((control) => (
      Boolean(activeElement)
      && (control.root === activeElement || control.focusTarget === activeElement || control.root?.contains(activeElement))
    ));
    const fallbackIndex = event.shiftKey ? controls.length : -1;
    const normalizedIndex = currentIndex >= 0 ? currentIndex : fallbackIndex;
    const nextIndex = event.shiftKey
      ? (normalizedIndex - 1 + controls.length) % controls.length
      : (normalizedIndex + 1) % controls.length;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    focusDialogControl(controls[nextIndex]);
  }, [focusDialogControl, getKeyboardControls, isOpen, openSelect]);

  const handleCancel = (): void => {
    setOpenSelect(null);
    setIsOpen(false);
  };

  const handleOpen = (): void => {
    setDraft(getOpeningDraft());
    setIsOpen(true);
  };

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    document.addEventListener('keydown', handleNativeTabKeyDown, true);
    return () => {
      document.removeEventListener('keydown', handleNativeTabKeyDown, true);
    };
  }, [handleNativeTabKeyDown, isOpen]);

  return (
    <>
      <Box
        ref={triggerRef}
        role="button"
        tabIndex={hasFocus ? 0 : -1}
        aria-label={t('areaAssignment.editButton')}
        onClick={handleOpen}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            event.stopPropagation();
            handleOpen();
          }
        }}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.5,
          width: '100%',
          overflow: 'hidden',
          cursor: 'pointer',
          borderRadius: 0.5,
          '&:focus-visible': {
            outline: '2px solid',
            outlineColor: 'primary.main',
            outlineOffset: '1px',
          },
        }}
      >
        <Typography
          variant="body2"
          noWrap
          sx={{ flexGrow: 1, color: compactLabel ? 'text.primary' : 'text.disabled' }}
        >
          {compactLabel || placeholder}
        </Typography>
        <IconButton
          size="small"
          tabIndex={-1}
          aria-hidden
          onClick={handleOpen}
        >
          <EditIcon fontSize="small" />
        </IconButton>
      </Box>
      <Dialog
        open={isOpen}
        onClose={handleCancel}
        fullWidth
        maxWidth="xs"
      >
        <Box component="form" onSubmit={handleFormSubmit} sx={{ minWidth: 0 }}>
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
                    ref={locationSelectRef}
                    id="assignment-location"
                    labelId="assignment-location-label"
                    value={activeDraft.locationId ?? ''}
                    label={t('columns.location')}
                    disabled={selectableLocations.length === 0}
                    MenuProps={selectMenuProps}
                    onOpen={() => setOpenSelect('location')}
                    onClose={() => setOpenSelect(null)}
                    onChange={(event) => {
                      handleLocationChange(Number(event.target.value));
                      requestAnimationFrame(() => locationSelectRef.current?.focus());
                    }}
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
                    ref={fieldSelectRef}
                    id="assignment-field"
                    labelId="assignment-field-label"
                    value={activeDraft.fieldId ?? ''}
                    label={t('columns.field')}
                    disabled={isFieldSelectDisabled}
                    MenuProps={selectMenuProps}
                    onOpen={() => setOpenSelect('field')}
                    onClose={() => setOpenSelect(null)}
                    onChange={(event) => {
                      handleFieldChange(Number(event.target.value));
                      requestAnimationFrame(() => fieldSelectRef.current?.focus());
                    }}
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
                    ref={bedSelectRef}
                    id="assignment-bed"
                    labelId="assignment-bed-label"
                    value={activeDraft.bedId ?? ''}
                    label={t('columns.bed')}
                    disabled={isBedSelectDisabled}
                    MenuProps={selectMenuProps}
                    onOpen={() => setOpenSelect('bed')}
                    onClose={() => setOpenSelect(null)}
                    onChange={(event) => {
                      handleBedChange(Number(event.target.value));
                      requestAnimationFrame(() => {
                        applyButtonRef.current?.focus();
                      });
                    }}
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
            <Button ref={cancelButtonRef} type="button" data-dialog-action="cancel" onClick={handleCancel}>{t('areaAssignment.cancel')}</Button>
            <Button ref={applyButtonRef} type="submit" data-dialog-action="apply" variant="contained" disabled={isApplyDisabled}>{t('areaAssignment.apply')}</Button>
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
));
