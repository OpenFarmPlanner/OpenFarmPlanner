/**
 * Culture Form component for creating and editing cultures.
 * 
 * Provides a comprehensive form with validation for all culture fields.
 * All fields are visible without collapsible sections.
 * UI text is in German, code comments remain in English.
 * 
 * @param props - Component properties
 * @param props.culture - Existing culture for editing (optional)
 * @param props.onSave - Callback when culture is saved
 * @param props.onCancel - Callback when form is cancelled
 * @returns JSX element rendering the culture form
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from '../i18n';
import type { Culture, PublicCulture, Supplier } from '../api/types';
import { extractApiErrorMessage } from '../api/errors';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Box,
  Button,
  Typography,
  TextField,
  FormControl,
  InputLabel,
  MenuItem,
  IconButton,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import { cultureAPI, publicCultureAPI, supplierAPI } from '../api/api';
import { useActiveSaveShortcut } from '../hooks/useActiveSaveShortcut';
import { useDialogKeyboardScroll } from '../hooks/useDialogKeyboardScroll';
import { ConfirmationDialog } from '../components/feedback/ConfirmationDialog';
import { hasEffectiveCultureFormChanges } from './cultureFormChangeDetection';
import { validateCulture } from './validation';
import { normalizeSeedRateUnit } from './enumNormalization';
import { buildCultureIdentityKey } from './cultureIdentity';
import { TypeaheadSelect as Select } from '../components/inputs/TypeaheadSelect';
import { BasicInfoSection } from './sections/BasicInfoSection';
import { TimingSection } from './sections/TimingSection';
import { HarvestSection } from './sections/HarvestSection';
import { SpacingSection } from './sections/SpacingSection';
import { SeedingSection } from './sections/SeedingSection';
import { ColorSection } from './sections/ColorSection';
import { NotesSection } from './sections/NotesSection';
import { hasSupplierDataRowMissingSupplier, hasSupplierInformation } from './supplierDataRows';
import { stripCitationMarkers } from '../components/data-grid/markdown';
import { SupplierFormDialog } from '../components/suppliers/SupplierFormDialog';
import { findSpeciesCulture } from './cropHierarchy';
import { getVarietyOwnValueSource } from './varietyValueSource';
import { varietySpecificFieldHighlightSx } from './varietyValueAccent';
import { buildVarietyFieldTooltipTitle, type GetVarietyFieldTooltipProps } from './varietyFieldTooltipHelpers';
import { VarietyValueLegend } from './VarietyValueLegend';
import {
  compactFieldSx,
  formRowSx,
  mediumStackedFieldSx,
  smallFieldSx,
  wideSingleColumnFieldSx,
} from '../components/forms/formLayout';

interface CultureFormProps {
  culture?: Culture;
  /**
   * Full culture list, used to find the parent species culture for variety inheritance
   * highlighting. Accepts partial/converted culture data (e.g. public library entries
   * mapped to the project `Culture` shape) as long as field names/units line up.
   */
  cultures?: Partial<Culture>[];
  onSave: (culture: Culture) => Promise<void>;
  onCancel: () => void;
  title?: string;
  variant?: 'project' | 'publicLibrary';
  extraSections?: ReactNode;
  hasExternalChanges?: boolean;
}

// Default color for display color picker
const DEFAULT_DISPLAY_COLOR = '#3498db';

// Vertical rhythm of the supplier data section (MUI spacing unit = 8px -> 14px).
const SUPPLIER_SECTION_GAP = 1.75;

// Empty culture template
const EMPTY_CULTURE: Partial<Culture> = {
  name: '',
  variety: '',
  crop_family: '',
  nutrient_demand: '',
  cultivation_type: 'pre_cultivation',
  cultivation_types: ['pre_cultivation'],
  notes: '',
  growth_duration_days: undefined,
  harvest_duration_days: undefined,
  propagation_duration_days: undefined,
  expected_yield: undefined,
  allow_deviation_delivery_weeks: false,
  distance_within_row_cm: undefined,
  row_spacing_cm: undefined,
  sowing_depth_cm: undefined,
  display_color: '',
  sowing_calculation_safety_percent: 0,
  sowing_calculation_safety_percent_direct: undefined,
  sowing_calculation_safety_percent_pre_cultivation: undefined,
  thousand_kernel_weight_g: undefined,
  seeding_requirement: undefined,
  seeding_requirement_type: '',
  seed_rate_value: null,
  seed_rate_unit: null,
  seed_rate_by_cultivation: null,
  seed_rate_direct_value: null,
  seed_rate_direct_unit: null,
  seed_rate_pre_cultivation_value: null,
  seed_rate_pre_cultivation_unit: null,
  seed_packages: [],
};

const DUPLICATE_CHECK_DEBOUNCE_MS = 400;
const PUBLIC_CULTURE_SEARCH_DEBOUNCE_MS = 250;

const metersToCentimeters = (value: number | null | undefined): number | undefined => (
  typeof value === 'number' ? Math.round(value * 100) : undefined
);

const getPublicCultureDraftName = (publicCulture: PublicCulture): string => (
  publicCulture.display_name || publicCulture.crop_species_name || publicCulture.name
);

const buildDraftFromPublicCulture = (publicCulture: PublicCulture): Partial<Culture> => ({
  name: getPublicCultureDraftName(publicCulture),
  variety: publicCulture.variety ?? '',
  notes: publicCulture.notes ?? '',
  crop_species: publicCulture.crop_species ?? null,
  source_public_culture: publicCulture.id,
  source_public_version: publicCulture.version,
  origin_type: 'imported',
  is_modified_from_source: false,
  crop_family: publicCulture.crop_family ?? '',
  nutrient_demand: publicCulture.nutrient_demand ?? '',
  cultivation_type: publicCulture.cultivation_type || 'pre_cultivation',
  cultivation_types: publicCulture.cultivation_types?.length ? publicCulture.cultivation_types : ['pre_cultivation'],
  growth_duration_days: publicCulture.growth_duration_days ?? undefined,
  harvest_duration_days: publicCulture.harvest_duration_days ?? undefined,
  propagation_duration_days: publicCulture.propagation_duration_days ?? undefined,
  harvest_method: publicCulture.harvest_method ?? '',
  expected_yield: publicCulture.expected_yield ?? undefined,
  allow_deviation_delivery_weeks: publicCulture.allow_deviation_delivery_weeks ?? false,
  distance_within_row_cm: metersToCentimeters(publicCulture.distance_within_row_m),
  row_spacing_cm: metersToCentimeters(publicCulture.row_spacing_m),
  sowing_depth_cm: metersToCentimeters(publicCulture.sowing_depth_m),
  seed_rate_value: publicCulture.seed_rate_value ?? null,
  seed_rate_unit: publicCulture.seed_rate_unit ?? null,
  seed_rate_by_cultivation: publicCulture.seed_rate_by_cultivation ?? null,
  seed_rate_direct_value: publicCulture.seed_rate_direct_value ?? null,
  seed_rate_direct_unit: publicCulture.seed_rate_direct_unit ?? null,
  sowing_calculation_safety_percent_direct: publicCulture.sowing_calculation_safety_percent_direct ?? null,
  seed_rate_pre_cultivation_value: publicCulture.seed_rate_pre_cultivation_value ?? null,
  seed_rate_pre_cultivation_unit: publicCulture.seed_rate_pre_cultivation_unit ?? null,
  sowing_calculation_safety_percent_pre_cultivation: publicCulture.sowing_calculation_safety_percent_pre_cultivation ?? null,
  sowing_calculation_safety_percent: publicCulture.sowing_calculation_safety_percent ?? 0,
  thousand_kernel_weight_g: publicCulture.thousand_kernel_weight_g ?? undefined,
  seeding_requirement: publicCulture.seeding_requirement ?? undefined,
  seeding_requirement_type: publicCulture.seeding_requirement_type ?? '',
  display_color: publicCulture.display_color ?? '',
  seed_packages: publicCulture.seed_packages ?? [],
});

const buildInitialFormData = (culture?: Culture): Partial<Culture> => {
  if (!culture) {
    return EMPTY_CULTURE;
  }

  const normalizedSpacingValues: Partial<Culture> = {
    distance_within_row_cm:
      typeof culture.distance_within_row_cm === 'number'
        ? Math.round(culture.distance_within_row_cm)
        : culture.distance_within_row_cm,
    row_spacing_cm:
      typeof culture.row_spacing_cm === 'number'
        ? Math.round(culture.row_spacing_cm)
        : culture.row_spacing_cm,
  };

  const normalizedSeedRateUnits: Partial<Culture> = {
    seed_rate_unit: normalizeSeedRateUnit(culture.seed_rate_unit),
    seed_rate_direct_unit: normalizeSeedRateUnit(culture.seed_rate_direct_unit),
    seed_rate_pre_cultivation_unit: normalizeSeedRateUnit(culture.seed_rate_pre_cultivation_unit),
  };

  const normalizedNotes = culture.notes ? stripCitationMarkers(culture.notes) : culture.notes;

  if (culture.supplier || !culture.seed_supplier) {
    return {
      ...culture,
      ...normalizedSpacingValues,
      ...normalizedSeedRateUnits,
      notes: normalizedNotes,
    };
  }

  return {
    ...culture,
    ...normalizedSpacingValues,
    ...normalizedSeedRateUnits,
    notes: normalizedNotes,
    supplier: {
      name: culture.seed_supplier,
      allowed_domains: [],
    },
  };
};

/**
 * Renders the CultureForm as a modal dialog. The dialog can only be closed via Save or Cancel.
 *
 * @remarks
 * Prevents closing by clicking outside.
 */
export function CultureForm({
  culture,
  cultures,
  onSave,
  onCancel,
  title,
  variant = 'project',
  extraSections,
  hasExternalChanges = false,
}: CultureFormProps) {
  const { t } = useTranslation('cultures');
  const isEdit = Boolean(culture);
  const isProjectForm = variant === 'project';
  const showSupplierDataSection = isProjectForm;
  const [saveError, setSaveError] = useState<string>('');

  // --- Validation now imported from ../cultures/validation ---

  // Save function for the autosave hook
  const saveCulture = async (draft: Partial<Culture>): Promise<Partial<Culture>> => {
    const dataToSave: Culture = {
      ...(draft as Culture),
    };
    await onSave(dataToSave);
    return dataToSave;
  };

  // Local form state (no autosave)
  const [formData, setFormData] = useState<Partial<Culture>>(buildInitialFormData(culture));
  const identityLabel = [formData.name, formData.variety].filter(Boolean).join(' · ');

  const selectedSpeciesCulture = useMemo(
    () => (cultures ? findSpeciesCulture(formData as Culture, cultures as Culture[]) : null),
    // findSpeciesCulture only reads these fields off formData (via
    // getCropSpeciesKey's crop_species -> culture_display_name -> name
    // fallback); keying on the whole object means it re-scans `cultures` on
    // every keystroke in any unrelated field (yield, notes, ...), not just
    // when the species identity actually changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cultures, formData.variety, formData.crop_species, formData.culture_display_name, formData.name],
  );
  const showVarietyValueLegend = Boolean(formData.variety && selectedSpeciesCulture);
  const getFieldTooltipProps: GetVarietyFieldTooltipProps = useCallback((fields, helpText) => {
    if (!selectedSpeciesCulture) {
      return null;
    }
    const fieldList = Array.isArray(fields) ? fields : [fields];
    const active = fieldList.some((field) => getVarietyOwnValueSource(formData, selectedSpeciesCulture, field) === 'ownValue');
    return {
      sx: active ? varietySpecificFieldHighlightSx : undefined,
      tooltipTitle: buildVarietyFieldTooltipTitle(t, active, helpText),
    };
  }, [selectedSpeciesCulture, formData, t]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [duplicateErrorKey, setDuplicateErrorKey] = useState<string>('');
  const [isDuplicateChecking, setIsDuplicateChecking] = useState(false);
  const [publicCultureOptions, setPublicCultureOptions] = useState<PublicCulture[]>([]);
  const [publicCultureOptionsLoading, setPublicCultureOptionsLoading] = useState(false);
  const [publicCultureSearchTerm, setPublicCultureSearchTerm] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [supplierOptions, setSupplierOptions] = useState<Supplier[]>([]);
  const [isDirty, setIsDirty] = useState(false);
  const [isValid, setIsValid] = useState(true);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [supplierCreateTargetIndex, setSupplierCreateTargetIndex] = useState<number | null>(null);
  const isSavingRef = useRef(false);
  const [userInteracted, setUserInteracted] = useState(false);
  const createSupplierButtonRefs = useRef<Record<number, HTMLButtonElement | null>>({});
  const dialogContentRef = useDialogKeyboardScroll(true);
  const formRef = useRef<HTMLFormElement | null>(null);
  const supplierOptionsRef = useRef<Supplier[]>([]);
  const duplicateCheckSequenceRef = useRef(0);
  const publicCultureSearchSequenceRef = useRef(0);
  // isDirty alone would also fire for purely programmatic state changes (e.g.
  // auto-selecting a public culture template); userInteracted is set at every
  // real edit site, so pairing it here keeps "unsaved changes" tied to an
  // actual user edit instead of any isDirty(true) call.
  const hasUnsavedChanges = (isDirty && userInteracted) || hasExternalChanges;

  // Move focus to the first input after MUI's FocusTrap has settled
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      const firstInput = formRef.current?.querySelector<HTMLInputElement>('input:not([type="hidden"])');
      firstInput?.focus();
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  const loadSuppliers = useCallback(async (): Promise<Supplier[]> => {
    try {
      const response = await supplierAPI.list();
      const nextSuppliers = response.data.results || [];
      const previousIds = new Set(supplierOptionsRef.current.map((supplier) => supplier.id).filter((id): id is number => typeof id === 'number'));
      const newestSupplier = [...nextSuppliers].reverse().find((supplier) => typeof supplier.id === 'number' && !previousIds.has(supplier.id));

      supplierOptionsRef.current = nextSuppliers;
      setSupplierOptions(nextSuppliers);

      if (newestSupplier?.id) {
        setFormData((prev) => {
          const rows = prev.supplier_data ?? [];
          let hasChanges = false;
          const nextRows = rows.map((row) => {
            const hasSupplier = typeof row.supplier_id === 'number' || typeof row.supplier?.id === 'number';
            if (hasSupplier || !hasSupplierInformation(row)) {
              return row;
            }
            hasChanges = true;
            return {
              ...row,
              supplier_id: newestSupplier.id,
              supplier_name: newestSupplier.name,
              supplier_name_input: undefined,
            };
          });

          if (!hasChanges) {
            return prev;
          }

          return {
            ...prev,
            supplier_data: nextRows,
          };
        });
      }
      return nextSuppliers;
    } catch {
      supplierOptionsRef.current = [];
      setSupplierOptions([]);
      return [];
    }
  }, []);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setFormData(buildInitialFormData(culture));
    setErrors({});
    setDuplicateErrorKey('');
    setIsDuplicateChecking(false);
    setPublicCultureOptions([]);
    setPublicCultureOptionsLoading(false);
    setPublicCultureSearchTerm('');
    setIsDirty(false);
    setIsValid(true);
    setHasSubmitted(false);
    setSaveError('');
    setSupplierCreateTargetIndex(null);
    isSavingRef.current = false;
    setUserInteracted(false);
  }, [culture]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (!showSupplierDataSection) {
      supplierOptionsRef.current = [];
      queueMicrotask(() => setSupplierOptions([]));
      return undefined;
    }

    queueMicrotask(() => {
      void loadSuppliers();
    });

    const onWindowFocus = () => {
      void loadSuppliers();
    };

    window.addEventListener('focus', onWindowFocus);
    return () => window.removeEventListener('focus', onWindowFocus);
  }, [loadSuppliers, showSupplierDataSection]);

  // Validate on every change
  const validateAndSet = useCallback((draft: Partial<Culture>, mode: 'live' | 'submit' = hasSubmitted ? 'submit' : 'live') => {
    const result = validateCulture(draft, t, mode);
    setErrors(result.errors);
    setIsValid(result.isValid);
    return result.isValid;
  }, [hasSubmitted, t]);

  useEffect(() => {
    if (!isProjectForm) {
      queueMicrotask(() => {
        setDuplicateErrorKey('');
        setIsDuplicateChecking(false);
      });
      return undefined;
    }

    const name = formData.name ?? '';
    const variety = formData.variety ?? '';
    const identityKey = buildCultureIdentityKey(name, variety);
    const originalIdentityKey = buildCultureIdentityKey(culture?.name, culture?.variety);
    const currentSequence = duplicateCheckSequenceRef.current + 1;
    duplicateCheckSequenceRef.current = currentSequence;
    queueMicrotask(() => setDuplicateErrorKey(''));

    if (!identityKey) {
      queueMicrotask(() => setIsDuplicateChecking(false));
      return;
    }

    if (culture?.id && identityKey === originalIdentityKey) {
      queueMicrotask(() => setIsDuplicateChecking(false));
      return;
    }

    queueMicrotask(() => setIsDuplicateChecking(true));
    const abortController = new AbortController();
    const timeoutId = window.setTimeout(() => {
      cultureAPI.duplicateCheck(
        {
          name,
          variety,
          exclude_id: culture?.id,
        },
        abortController.signal,
      )
        .then((response) => {
          if (duplicateCheckSequenceRef.current !== currentSequence) {
            return;
          }
          setDuplicateErrorKey(response.data.exists ? 'form.duplicateNameVariety' : '');
        })
        .catch(() => {
          if (
            duplicateCheckSequenceRef.current !== currentSequence
            || abortController.signal.aborted
          ) {
            return;
          }
          setDuplicateErrorKey('');
        })
        .finally(() => {
          if (duplicateCheckSequenceRef.current === currentSequence) {
            setIsDuplicateChecking(false);
          }
        });
    }, DUPLICATE_CHECK_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timeoutId);
      abortController.abort();
    };
  }, [culture?.id, culture?.name, culture?.variety, formData.name, formData.variety, isProjectForm]);

  useEffect(() => {
    if (!isProjectForm) {
      queueMicrotask(() => {
        setPublicCultureOptions([]);
        setPublicCultureOptionsLoading(false);
      });
      return undefined;
    }

    const searchTerm = publicCultureSearchTerm.trim();
    const currentSequence = publicCultureSearchSequenceRef.current + 1;
    publicCultureSearchSequenceRef.current = currentSequence;

    if (!searchTerm) {
      queueMicrotask(() => {
        setPublicCultureOptions([]);
        setPublicCultureOptionsLoading(false);
      });
      return undefined;
    }

    queueMicrotask(() => setPublicCultureOptionsLoading(true));
    const abortController = new AbortController();
    const timeoutId = window.setTimeout(() => {
      publicCultureAPI.list({ q: searchTerm }, abortController.signal)
        .then((response) => {
          if (publicCultureSearchSequenceRef.current !== currentSequence) {
            return;
          }
          setPublicCultureOptions(response.data.results);
        })
        .catch(() => {
          if (publicCultureSearchSequenceRef.current === currentSequence && !abortController.signal.aborted) {
            setPublicCultureOptions([]);
          }
        })
        .finally(() => {
          if (publicCultureSearchSequenceRef.current === currentSequence) {
            setPublicCultureOptionsLoading(false);
          }
        });
    }, PUBLIC_CULTURE_SEARCH_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timeoutId);
      abortController.abort();
    };
  }, [isProjectForm, publicCultureSearchTerm]);

  // Handle field changes
  // Strongly typed change handler
  const handleChange = <K extends keyof Culture>(name: K, value: Culture[K]) => {
    setFormData((prev) => {
      const updated = { ...prev, [name]: value };
      setIsDirty(true);
      setUserInteracted(true);
      setSaveError('');
      if (name === 'name' || name === 'variety') {
        setDuplicateErrorKey('');
      }
      validateAndSet(updated);
      return updated;
    });
  };

  const handleManualPublicCultureSearchChange = useCallback((value: string) => {
    setPublicCultureSearchTerm(value);
  }, []);

  const handlePublicCultureSelect = useCallback((publicCulture: PublicCulture | null) => {
    if (!publicCulture) {
      setFormData((prev) => {
        const updated = {
          ...prev,
          crop_species: null,
          source_public_culture: null,
          source_public_version: null,
          origin_type: 'manual' as const,
          is_modified_from_source: false,
        };
        setIsDirty(true);
        setUserInteracted(true);
        setSaveError('');
        validateAndSet(updated);
        return updated;
      });
      return;
    }

    setPublicCultureSearchTerm(getPublicCultureDraftName(publicCulture));
    setFormData((prev) => {
      const updated = {
        ...prev,
        ...buildDraftFromPublicCulture(publicCulture),
      };
      setIsDirty(true);
      setUserInteracted(true);
      setSaveError('');
      setDuplicateErrorKey('');
      validateAndSet(updated);
      return updated;
    });
  }, [validateAndSet]);

  // Tab/Shift+Tab inside this dialog is MUI's `Dialog` focus trap's job; Tab
  // out of an open Select dropdown belongs to `TypeaheadSelect`. Do not add a
  // second trap here — see docs/keyboard-architecture.md.

  // Handle manual save (for Save button)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSavingRef.current) return;
    if (isEdit && !hasExternalChanges && !hasEffectiveCultureFormChanges(buildInitialFormData(culture), formData)) {
      onCancel();
      return;
    }
    setHasSubmitted(true);
    if (!validateAndSet(formData, 'submit')) return;
    if (showSupplierDataSection && hasSupplierDataRowMissingSupplier(formData.supplier_data)) {
      setSaveError(t('form.supplierDataMissingSupplier'));
      return;
    }
    if (duplicateErrorKey || isDuplicateChecking) return;
    isSavingRef.current = true;
    setIsSaving(true);
    try {
      await saveCulture(formData);
      setSaveError('');
      setIsDirty(false);
      setHasSubmitted(false);
    } catch (error) {
      setSaveError(extractApiErrorMessage(error, t, t('messages.updateError')));
    } finally {
      isSavingRef.current = false;
      setIsSaving(false);
    }
  };

  const supplierRows = formData.supplier_data ?? [];
  const displayErrors = duplicateErrorKey
    ? { ...errors, variety: errors.variety || t(duplicateErrorKey) }
    : errors;
  const isSaveDisabled = isSaving || !isValid || Boolean(duplicateErrorKey) || isDuplicateChecking;
  const isSupplierCreateDialogOpen = supplierCreateTargetIndex !== null;

  const handleCreateSupplierClick = useCallback((supplierIndex: number): void => {
    setSupplierCreateTargetIndex(supplierIndex);
  }, []);

  const handleCloseSupplierCreateDialog = useCallback((): void => {
    const targetIndex = supplierCreateTargetIndex;
    setSupplierCreateTargetIndex(null);
    window.setTimeout(() => {
      const createButton = targetIndex === null ? null : createSupplierButtonRefs.current[targetIndex];
      if (createButton?.isConnected) {
        createButton.focus();
        return;
      }

      const supplierFields = Array.from(document.querySelectorAll<HTMLElement>('[role="combobox"]'));
      supplierFields[targetIndex ?? 0]?.focus();
    }, 0);
  }, [supplierCreateTargetIndex]);

  const mergeSupplierOption = useCallback((createdSupplier: Supplier): void => {
    supplierOptionsRef.current = [
      ...supplierOptionsRef.current.filter((supplier) => supplier.id !== createdSupplier.id),
      createdSupplier,
    ];
    setSupplierOptions(supplierOptionsRef.current);
  }, []);

  const handleSupplierCreated = useCallback(async (createdSupplier: Supplier): Promise<void> => {
    const createdSupplierId = createdSupplier.id;
    if (typeof createdSupplierId !== 'number') {
      setSaveError(t('form.supplierCreateSelectionError'));
      return;
    }

    mergeSupplierOption(createdSupplier);

    setFormData((prev) => {
      const rows = prev.supplier_data ?? [];
      if (supplierCreateTargetIndex === null || !rows[supplierCreateTargetIndex]) {
        setSaveError(t('form.supplierCreateSelectionError'));
        return prev;
      }

      const nextRows = rows.map((row, rowIndex) => (
        rowIndex === supplierCreateTargetIndex
          ? {
            ...row,
            supplier_id: createdSupplierId,
            supplier: createdSupplier,
            supplier_name: createdSupplier.name,
            supplier_name_input: undefined,
          }
          : row
      ));

      setIsDirty(true);
      setUserInteracted(true);
      setSaveError('');
      validateAndSet({ ...prev, supplier_data: nextRows });
      return {
        ...prev,
        supplier_data: nextRows,
      };
    });

    const refreshedSuppliers = await loadSuppliers();
    if (!refreshedSuppliers.some((supplier) => supplier.id === createdSupplierId)) {
      mergeSupplierOption(createdSupplier);
    }
  }, [loadSuppliers, mergeSupplierOption, supplierCreateTargetIndex, t, validateAndSet]);

  const getActiveSaveShortcutElement = useCallback((): HTMLElement | null => {
    const formElement = formRef.current;
    const dialogElement = formElement?.closest('[role="dialog"]') as HTMLElement | null;
    if (!formElement || !dialogElement || showDiscardConfirm || isSupplierCreateDialogOpen) {
      return null;
    }

    const openDialogs = Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"]'))
      .filter((element) => element.getAttribute('aria-hidden') !== 'true');
    const topDialog = openDialogs.at(-1);
    if (topDialog && topDialog !== dialogElement) {
      return null;
    }

    return formElement;
  }, [isSupplierCreateDialogOpen, showDiscardConfirm]);

  const submitActiveForm = useCallback((): void => {
    formRef.current?.requestSubmit();
  }, []);

  useActiveSaveShortcut({
    enabled: true,
    disabled: isSaveDisabled,
    getActiveElement: getActiveSaveShortcutElement,
    onSave: submitActiveForm,
  });

  const updateSupplierRow = (index: number, patch: Record<string, unknown>) => {
    const nextRows = supplierRows.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row));
    handleChange('supplier_data', nextRows);
  };
  const addSupplierRow = () => {
    handleChange('supplier_data', [...supplierRows, { supplier_name_input: '', packaging_sizes: [] }]);
  };
  const removeSupplierRow = (index: number) => {
    handleChange('supplier_data', supplierRows.filter((_row, rowIndex) => rowIndex !== index));
  };
  const addPackageRow = (supplierIndex: number) => {
    const currentPackages = supplierRows[supplierIndex]?.packaging_sizes ?? [];
    updateSupplierRow(supplierIndex, { packaging_sizes: [...currentPackages, { size_value: 0, size_unit: 'g' }] });
  };
  const updatePackageRow = (supplierIndex: number, packageIndex: number, patch: Record<string, unknown>) => {
    const currentPackages = supplierRows[supplierIndex]?.packaging_sizes ?? [];
    const nextPackages = currentPackages.map((pkg, index) => (index === packageIndex ? { ...pkg, ...patch } : pkg));
    updateSupplierRow(supplierIndex, { packaging_sizes: nextPackages });
  };
  const removePackageRow = (supplierIndex: number, packageIndex: number) => {
    const currentPackages = supplierRows[supplierIndex]?.packaging_sizes ?? [];
    updateSupplierRow(supplierIndex, { packaging_sizes: currentPackages.filter((_pkg, index) => index !== packageIndex) });
  };
  return (
    <Dialog
      open
      onClose={(_event, reason) => {
        if (reason === 'backdropClick') return;
        if (isSupplierCreateDialogOpen && reason === 'escapeKeyDown') return;
        if (hasUnsavedChanges) {
          setShowDiscardConfirm(true);
        } else {
          onCancel();
        }
      }}
      aria-labelledby="culture-form-dialog-title"
      maxWidth="md"
      fullWidth
    >
      <form ref={formRef} onSubmit={handleSubmit}>
        <DialogTitle id="culture-form-dialog-title">
          {title ?? (isEdit ? t('form.editTitle') : t('form.createTitle'))}
        </DialogTitle>
        <DialogContent
          ref={dialogContentRef}
          dividers
          sx={{
            maxHeight: '70vh',
            overscrollBehavior: 'contain',
            '&:focus': {
              outline: 'none',
            },
          }}
          tabIndex={-1}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 8 }}>
            <Typography variant="h6">{t('form.generalInfoSectionTitle')}</Typography>
            {!isProjectForm ? (
              <Box
                sx={{
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 1,
                  px: 1.5,
                  py: 1.25,
                  bgcolor: 'action.hover',
                }}
              >
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.25 }}>
                  {t('form.publicIdentityLabel')}
                </Typography>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, overflowWrap: 'anywhere' }}>
                  {identityLabel || t('noData')}
                </Typography>
              </Box>
            ) : null}
            {showVarietyValueLegend ? (
              <VarietyValueLegend
                sampleLabel={t('hierarchy.ownValueLegendSample')}
                description={t('hierarchy.ownValueLegendDescription')}
              />
            ) : null}
            <BasicInfoSection
              formData={formData}
              errors={displayErrors}
              onChange={handleChange}
              t={t}
              getFieldTooltipProps={getFieldTooltipProps}
              showIdentityFields={isProjectForm}
              publicCultureOptions={isProjectForm ? publicCultureOptions : undefined}
              publicCultureOptionsLoading={publicCultureOptionsLoading}
              onPublicCultureSearchChange={isProjectForm ? handleManualPublicCultureSearchChange : undefined}
              onPublicCultureSelect={isProjectForm ? handlePublicCultureSelect : undefined}
              identityHint={isProjectForm && formData.source_public_culture ? (
                <Box
                  sx={(theme) => ({
                    px: 1.5,
                    py: 1,
                    borderLeft: `4px solid ${theme.palette.primary.main}`,
                    borderRadius: 1,
                    bgcolor: 'rgba(76, 135, 86, 0.10)',
                    color: 'text.primary',
                  })}
                >
                  <Typography variant="body2" sx={{ lineHeight: 1.35 }}>
                    {t('form.publicCultureSourceHint')}
                  </Typography>
                </Box>
              ) : null}
            />
            <TimingSection formData={formData} errors={errors} onChange={handleChange} t={t} getFieldTooltipProps={getFieldTooltipProps} />
            <HarvestSection formData={formData} errors={errors} onChange={handleChange} t={t} getFieldTooltipProps={getFieldTooltipProps} />
            <SpacingSection formData={formData} errors={errors} onChange={handleChange} t={t} getFieldTooltipProps={getFieldTooltipProps} />
            <SeedingSection formData={formData} errors={errors} onChange={handleChange} t={t} getFieldTooltipProps={getFieldTooltipProps} />
            <ColorSection formData={formData} errors={errors} onChange={handleChange} t={t} defaultColor={DEFAULT_DISPLAY_COLOR} />
            {isProjectForm ? (
              <NotesSection formData={formData} onChange={handleChange} t={t} errors={errors} />
            ) : null}
            {extraSections}
            {showSupplierDataSection ? (
              <Box
                data-testid="culture-supplier-data-section"
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: SUPPLIER_SECTION_GAP,
                  mt: 1,
                }}
              >
                <Typography variant="h6">{t('form.supplierDataSectionTitle')}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {t('form.supplierDataSectionDescription')}
                </Typography>
                {supplierRows.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    {t('form.noSupplierDataRows')}
                  </Typography>
                ) : null}
                {supplierRows.map((row, supplierIndex) => {
                  const selectedSupplierId = row.supplier_id ?? row.supplier?.id ?? null;
                  const availableSupplierIds = new Set(supplierOptions.map((supplier) => supplier.id));
                  const hasSelectedSupplier = typeof selectedSupplierId === 'number';
                  const isSelectedSupplierAvailable = hasSelectedSupplier && availableSupplierIds.has(selectedSupplierId);
                  const selectValue = isSelectedSupplierAvailable ? String(selectedSupplierId) : '';
                  const hasSupplierOptions = supplierOptions.length > 0;
                  // Supplier-specific inputs stay unmounted until a supplier is picked so the
                  // section never reserves height for fields that cannot be filled in yet.
                  const showSupplierFields = hasSupplierOptions && isSelectedSupplierAvailable;

                  return (
                    <Box
                      key={`supplier-row-${supplierIndex}`}
                      data-testid="culture-supplier-data-row"
                      sx={{
                        border: '1px solid',
                        borderColor: 'divider',
                        borderRadius: 1,
                        p: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'flex-start',
                        gap: SUPPLIER_SECTION_GAP,
                        minHeight: 0,
                        flexGrow: 0,
                      }}
                    >
                      {hasSupplierOptions ? (
                        <FormControl size="small" sx={mediumStackedFieldSx}>
                          <InputLabel shrink>{t('form.supplier')}</InputLabel>
                          <Select
                            fullWidth
                            value={selectValue}
                            label={t('form.supplier')}
                            renderValue={(selected) => {
                              if (!selected) {
                                return (
                                  <Typography component="span" color="text.secondary">
                                    {t('form.supplierPlaceholder')}
                                  </Typography>
                                );
                              }
                              const selectedSupplier = supplierOptions.find((supplier) => String(supplier.id) === String(selected));
                              return selectedSupplier?.name ?? '';
                            }}
                            onChange={(event) => {
                              const selectedValue = String(event.target.value ?? '');

                              const parsedSupplierId = Number(selectedValue);
                              const selectedSupplier = supplierOptions.find((supplier) => supplier.id === parsedSupplierId);
                              updateSupplierRow(supplierIndex, {
                                supplier_id: parsedSupplierId,
                                supplier: selectedSupplier,
                                supplier_name_input: selectedSupplier ? undefined : row.supplier_name_input,
                                supplier_name: selectedSupplier?.name ?? row.supplier_name,
                              });
                            }}
                            displayEmpty
                          >
                            {supplierOptions.map((supplier) => (
                              <MenuItem key={supplier.id} value={String(supplier.id)}>{supplier.name}</MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      ) : (
                        <Box
                          sx={{
                            display: 'flex',
                            alignItems: { xs: 'stretch', sm: 'center' },
                            justifyContent: 'space-between',
                            gap: 1,
                            flexDirection: { xs: 'column', sm: 'row' },
                            border: '1px solid',
                            borderColor: 'surface.surfaceSoftBorder',
                            borderRadius: 1,
                            bgcolor: 'surface.surfaceSubtleBackground',
                            px: 1.5,
                            py: 1.25,
                          }}
                        >
                          <Typography variant="body2" color="text.secondary">
                            {t('form.noSuppliers')}
                          </Typography>
                          <Button
                            ref={(element) => {
                              createSupplierButtonRefs.current[supplierIndex] = element;
                            }}
                            variant="outlined"
                            size="small"
                            onClick={() => handleCreateSupplierClick(supplierIndex)}
                          >
                            {t('form.createSuppliers')}
                          </Button>
                        </Box>
                      )}
                      {hasSupplierOptions && !showSupplierFields ? (
                        <Box
                          data-testid="culture-supplier-data-hint"
                          sx={{
                            border: '1px solid',
                            borderColor: 'surface.surfaceSoftBorder',
                            borderRadius: 1,
                            bgcolor: 'surface.surfaceSubtleBackground',
                            px: 1.5,
                            py: 1,
                          }}
                        >
                          <Typography variant="body2" color="text.secondary">
                            {t('form.supplierDataSelectSupplierHint')}
                          </Typography>
                        </Box>
                      ) : null}
                      {showSupplierFields ? (
                        <>
                          <TextField
                            label={t('form.supplierProductNameLabel')}
                            value={row.supplier_product_name ?? ''}
                            onChange={(event) => updateSupplierRow(supplierIndex, { supplier_product_name: event.target.value })}
                            sx={wideSingleColumnFieldSx}
                          />
                          <Typography variant="subtitle2">{t('form.seedPackagesLabel')}</Typography>
                          {(row.packaging_sizes ?? []).map((pkg, packageIndex) => (
                            <Box
                              key={`pkg-${supplierIndex}-${packageIndex}`}
                              sx={{ ...formRowSx, gap: 1, alignItems: 'center' }}
                            >
                              <TextField
                                label={t('form.seedAmountLabel')}
                                type="number"
                                value={pkg.size_value}
                                onChange={(event) => updatePackageRow(supplierIndex, packageIndex, { size_value: Number(event.target.value) || 0 })}
                                sx={compactFieldSx}
                              />
                              <Select
                                value={pkg.size_unit}
                                onChange={(event) => updatePackageRow(supplierIndex, packageIndex, { size_unit: event.target.value })}
                                size="small"
                                sx={smallFieldSx}
                              >
                                <MenuItem value="g">{t('form.packageUnitGram')}</MenuItem>
                                <MenuItem value="seeds">{t('form.packageUnitSeeds')}</MenuItem>
                              </Select>
                              <IconButton
                                color="error"
                                onClick={() => removePackageRow(supplierIndex, packageIndex)}
                                aria-label={t('form.removeSeedPackageAriaLabel')}
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </Box>
                          ))}
                        </>
                      ) : null}
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                        {showSupplierFields ? (
                          <Button variant="outlined" onClick={() => addPackageRow(supplierIndex)}>{t('form.addSeedPackage')}</Button>
                        ) : null}
                        <Button variant="outlined" color="error" onClick={() => removeSupplierRow(supplierIndex)}>{t('form.removeSupplierData')}</Button>
                      </Box>
                    </Box>
                  );
                })}
                <Button variant="outlined" onClick={addSupplierRow}>{t('form.addSupplierData')}</Button>
              </Box>
            ) : null}
          </div>
        </DialogContent>
        <DialogActions sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end', alignItems: 'center', mt: 1, flexWrap: 'wrap' }}>
          {saveError ? (
            <Alert severity="error" sx={{ width: '100%' }}>
              {saveError}
            </Alert>
          ) : null}
          {hasUnsavedChanges && (
            <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
              {isValid && !duplicateErrorKey
                ? t('messages.unsavedChanges')
                : t('messages.fixErrors')}
            </Typography>
          )}
          <Button variant="outlined" onClick={() => {
            if (hasUnsavedChanges) {
              setShowDiscardConfirm(true);
            } else {
              onCancel();
            }
          }} disabled={isSaving}>
            {t('form.cancel')}
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={isSaveDisabled}
          >
            {isSaving
              ? t('messages.saving')
              : isEdit ? t('form.save') : t('form.create')}
          </Button>
        </DialogActions>
      </form>
      <ConfirmationDialog
        open={showDiscardConfirm}
        title={t('form.discardChangesTitle')}
        message={t('form.discardChangesMessage')}
        cancelLabel={t('form.discardCancel')}
        confirmLabel={t('form.discardConfirm')}
        onCancel={() => setShowDiscardConfirm(false)}
        onConfirm={() => {
          setShowDiscardConfirm(false);
          onCancel();
        }}
        cancelButtonProps={{ autoFocus: true }}
        confirmButtonProps={{ variant: 'contained', color: 'error' }}
      />
      {showSupplierDataSection ? (
        <SupplierFormDialog
          open={isSupplierCreateDialogOpen}
          title={t('form.createSuppliers')}
          submitLabel={t('form.createSuppliers')}
          onClose={handleCloseSupplierCreateDialog}
          onSaved={handleSupplierCreated}
        />
      ) : null}
    </Dialog>
  );
}
