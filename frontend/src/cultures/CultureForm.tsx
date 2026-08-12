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
import type { AutocompleteChangeReason } from '@mui/material/Autocomplete';
import { alpha } from '@mui/material/styles';
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
import {
  dedupePublicCulturesBySpecies,
  dedupePublicCultureVarieties,
  isLikelyTestPublicCultureEntry,
  normalizeIdentityValue,
} from './publicCultureNameSuggestions';
import { getVarietyOwnValueSource, stripValuesMatchingBaseline } from './varietyValueSource';
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

/**
 * The optional first variety created alongside a brand-new crop. `draft`
 * carries public-library values plus their `source_public_culture` linking
 * when the user picked a concrete variety suggestion; without it the variety
 * inherits the crop's own values (the pre-existing behavior).
 */
export interface FirstVarietyDraft {
  name: string;
  draft?: Partial<Culture>;
}

interface CultureFormProps {
  culture?: Culture;
  /**
   * Full culture list, used to find the parent species culture for variety inheritance
   * highlighting. Accepts partial/converted culture data (e.g. public library entries
   * mapped to the project `Culture` shape) as long as field names/units line up.
   */
  cultures?: Partial<Culture>[];
  onSave: (culture: Culture, firstVariety?: FirstVarietyDraft) => Promise<void>;
  onCancel: () => void;
  /**
   * Offered when the typed crop name already exists as a private culture in
   * this project: closes the form and hands over to the existing "+ Add
   * variety" flow for that crop instead of creating a second crop with the
   * same name. Omitted by callers that have no such flow.
   */
  onSwitchToAddVariety?: (speciesCulture: Culture) => void;
  title?: string;
  variant?: 'project' | 'publicLibrary';
  extraSections?: ReactNode;
  hasExternalChanges?: boolean;
  /**
   * Whether this form edits a crop-level entry (no variety, the species'
   * general record) or a variety-level entry (variety required). Only
   * relevant for `variant="project"` — the public-library form always shows
   * both identity fields via `showIdentityFields`. Defaults to 'variety' so
   * existing callers that don't pass it keep today's behavior.
   */
  formKind?: 'crop' | 'variety';
  /**
   * Initial field values merged onto the blank template when creating (i.e.
   * `culture` is undefined) — used by "+ Add variety" to pre-fill the parent
   * crop's `crop_species`/`name` so the new row groups correctly.
   */
  initialDraft?: Partial<Culture>;
  /**
   * Number of project cultures currently linked to this public-library entry
   * (`variant="publicLibrary"` only). Shown so an admin can see the blast
   * radius of an edit — especially a variety rename — before saving.
   */
  importedCopiesCount?: number;
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

// Same visual treatment as the Name field's green "applied from library"
// hint, reused wherever a public-library entry got linked in.
const PublicCultureSourceHint = ({ text }: { text: string }) => (
  <Box
    sx={(theme) => ({
      px: 1.5,
      py: 1,
      borderLeft: `4px solid ${theme.palette.primary.main}`,
      borderRadius: 1,
      bgcolor: alpha(theme.palette.primary.light, 0.1),
      color: 'text.primary',
    })}
  >
    <Typography variant="body2" sx={{ lineHeight: 1.35 }}>{text}</Typography>
  </Box>
);

// Dezent hint offered when typed free text matches a library entry exactly
// but wasn't picked from the dropdown — applying stays an explicit action
// rather than a silent background fill.
const PublicCultureApplyHint = ({ hintText, actionLabel, onApply }: { hintText: string; actionLabel: string; onApply: () => void }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
    <Typography variant="body2" color="text.secondary">{hintText}</Typography>
    <Button size="small" onClick={onApply}>{actionLabel}</Button>
  </Box>
);

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

const buildInitialFormData = (culture?: Culture, initialDraft?: Partial<Culture>): Partial<Culture> => {
  if (!culture) {
    return initialDraft ? { ...EMPTY_CULTURE, ...initialDraft } : EMPTY_CULTURE;
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
  onSwitchToAddVariety,
  title,
  variant = 'project',
  extraSections,
  hasExternalChanges = false,
  formKind = 'variety',
  initialDraft,
  importedCopiesCount,
}: CultureFormProps) {
  const { t } = useTranslation('cultures');
  const isEdit = Boolean(culture);
  const isProjectForm = variant === 'project';
  const showSupplierDataSection = isProjectForm;
  const showVarietyField = !isProjectForm || formKind === 'variety';
  const requireVariety = isProjectForm && formKind === 'variety';
  const showFirstVarietyField = isProjectForm && formKind === 'crop' && !isEdit;
  const [saveError, setSaveError] = useState<string>('');
  const [firstVarietyName, setFirstVarietyName] = useState<string>('');
  // Set only when the first-variety name was picked from a public-library
  // suggestion, so that variety gets the same source linking as an import.
  const [firstVarietyPublicCulture, setFirstVarietyPublicCulture] = useState<PublicCulture | null>(null);

  // --- Validation now imported from ../cultures/validation ---

  // Save function for the autosave hook
  const saveCulture = async (draft: Partial<Culture>): Promise<Partial<Culture>> => {
    const dataToSave: Culture = {
      ...(draft as Culture),
    };
    const trimmedFirstVarietyName = firstVarietyName.trim();
    const firstVariety: FirstVarietyDraft | undefined = showFirstVarietyField && trimmedFirstVarietyName
      ? {
        name: trimmedFirstVarietyName,
        draft: firstVarietyPublicCulture && normalizeIdentityValue(firstVarietyPublicCulture.variety) === normalizeIdentityValue(trimmedFirstVarietyName)
          ? buildDraftFromPublicCulture(firstVarietyPublicCulture)
          : undefined,
      }
      : undefined;
    await onSave(dataToSave, firstVariety);
    return dataToSave;
  };

  // Local form state (no autosave)
  const [formData, setFormData] = useState<Partial<Culture>>(buildInitialFormData(culture, initialDraft));
  const cropIdentityLabel = formData.name ?? '';

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
  const [matchedCropSpeciesId, setMatchedCropSpeciesId] = useState<number | null>(null);
  const [varietyPublicCultures, setVarietyPublicCultures] = useState<PublicCulture[]>([]);
  // Which crop species `varietyPublicCultures` actually belongs to. Needed
  // because an empty list is ambiguous between "not loaded yet" and "species
  // has no entries", and the pending species prefill must only act on rows
  // that really belong to the species the user just picked.
  const [loadedVarietySpeciesId, setLoadedVarietySpeciesId] = useState<number | null>(null);
  const [varietyOptionsLoading, setVarietyOptionsLoading] = useState(false);
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
  // Crop species whose general ("no variety") library entry should be applied
  // as soon as that species' entries finish loading. Set when the user picks a
  // Name suggestion; the species entries are fetched by the variety-options
  // effect anyway, so this avoids a second request for the same rows.
  const pendingSpeciesPrefillRef = useRef<number | null>(null);
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
    setFormData(buildInitialFormData(culture, initialDraft));
    setFirstVarietyName('');
    setFirstVarietyPublicCulture(null);
    pendingSpeciesPrefillRef.current = null;
    setErrors({});
    setDuplicateErrorKey('');
    setIsDuplicateChecking(false);
    setPublicCultureOptions([]);
    setPublicCultureOptionsLoading(false);
    setPublicCultureSearchTerm('');
    setMatchedCropSpeciesId(null);
    setVarietyPublicCultures([]);
    setLoadedVarietySpeciesId(null);
    setVarietyOptionsLoading(false);
    setIsDirty(false);
    setIsValid(true);
    setHasSubmitted(false);
    setSaveError('');
    setSupplierCreateTargetIndex(null);
    isSavingRef.current = false;
    setUserInteracted(false);
  }, [culture, initialDraft]);
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
    const result = validateCulture(draft, t, mode, requireVariety);
    setErrors(result.errors);
    setIsValid(result.isValid);
    return result.isValid;
  }, [hasSubmitted, requireVariety, t]);

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

  // "Name" suggestions must be unique crop species, never "Species · Variety"
  // combinations — the Variety field below covers the sorte-specific part.
  const nameOptions = useMemo(() => dedupePublicCulturesBySpecies(publicCultureOptions), [publicCultureOptions]);

  // The library entry the typed Name text matches exactly, regardless of how
  // it got there (dropdown pick or free text). Used both to fetch Variety
  // suggestions below and to offer an explicit "apply values" hint when the
  // match wasn't picked from the dropdown (see nameApplyHintOption).
  const matchedNameOption = useMemo(() => {
    const normalizedName = normalizeIdentityValue(formData.name);
    return normalizedName
      ? nameOptions.find((option) => normalizeIdentityValue(option.name) === normalizedName)
      : undefined;
  }, [formData.name, nameOptions]);

  // The Variety field only gets suggestions once the Name field's text
  // exactly matches an existing public crop species; free text otherwise.
  useEffect(() => {
    if (!isProjectForm) {
      queueMicrotask(() => setMatchedCropSpeciesId(null));
      return;
    }
    queueMicrotask(() => setMatchedCropSpeciesId(matchedNameOption?.cropSpeciesId ?? null));
  }, [isProjectForm, matchedNameOption]);

  useEffect(() => {
    if (!isProjectForm || matchedCropSpeciesId === null) {
      queueMicrotask(() => {
        setVarietyPublicCultures([]);
        setLoadedVarietySpeciesId(null);
        setVarietyOptionsLoading(false);
      });
      return undefined;
    }

    let cancelled = false;
    const abortController = new AbortController();
    queueMicrotask(() => setVarietyOptionsLoading(true));
    publicCultureAPI.list({ crop_species: matchedCropSpeciesId }, abortController.signal)
      .then((response) => {
        if (cancelled) return;
        setVarietyPublicCultures(response.data.results);
        setLoadedVarietySpeciesId(matchedCropSpeciesId);
      })
      .catch(() => {
        if (cancelled || abortController.signal.aborted) return;
        setVarietyPublicCultures([]);
        // Still mark the species as resolved so a pending prefill falls back
        // to "crop_species linked only" instead of waiting forever.
        setLoadedVarietySpeciesId(matchedCropSpeciesId);
      })
      .finally(() => {
        if (!cancelled) setVarietyOptionsLoading(false);
      });

    return () => {
      cancelled = true;
      abortController.abort();
    };
  }, [isProjectForm, matchedCropSpeciesId]);

  const varietyOptions = useMemo(() => dedupePublicCultureVarieties(varietyPublicCultures), [varietyPublicCultures]);

  // Creating a second crop under a name the project already uses is almost
  // always meant as "add another variety of that crop". The hint offers that
  // route without blocking a deliberate free-text duplicate.
  const existingPrivateCrop = useMemo<Culture | null>(() => {
    if (!showFirstVarietyField || !onSwitchToAddVariety || !cultures?.length) {
      return null;
    }
    const normalizedName = normalizeIdentityValue(formData.name);
    if (!normalizedName) {
      return null;
    }
    const matches = cultures.filter((candidate) => (
      typeof candidate.id === 'number' && normalizeIdentityValue(candidate.name) === normalizedName
    )) as Culture[];
    if (!matches.length) {
      return null;
    }
    // The species-level row ("no variety") is the correct parent for the
    // "+ Add variety" flow; fall back to any match for crops that only ever
    // got variety rows.
    return matches.find((candidate) => !(candidate.variety || '').trim()) ?? matches[0];
  }, [cultures, formData.name, onSwitchToAddVariety, showFirstVarietyField]);

  const handleSwitchToAddVariety = useCallback(() => {
    if (existingPrivateCrop) {
      onSwitchToAddVariety?.(existingPrivateCrop);
    }
  }, [existingPrivateCrop, onSwitchToAddVariety]);

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

  const handleFirstVarietyNameChange = useCallback((value: string) => {
    setFirstVarietyName(value);
    // Typing past a picked suggestion drops the library link; the name is
    // re-matched against the suggestion list only on an explicit selection.
    setFirstVarietyPublicCulture(null);
    setIsDirty(true);
    setUserInteracted(true);
  }, []);

  const handleManualPublicCultureSearchChange = useCallback((value: string) => {
    setPublicCultureSearchTerm(value);
  }, []);

  /**
   * Copies a public-library entry into the private draft using the very same
   * shape the "Import from library" button produces (`source_public_culture` /
   * `source_public_version` / `origin_type: 'imported'`), so the backend's
   * existing re-import/update model applies to these cultures unchanged.
   *
   * `preserveVariety` keeps the variety the user already typed — species-level
   * ("general crop") entries carry an empty variety and must never clear it.
   */
  const applyPublicCultureDraft = useCallback((
    publicCulture: PublicCulture,
    { preserveVariety = false }: { preserveVariety?: boolean } = {},
  ) => {
    setPublicCultureSearchTerm(getPublicCultureDraftName(publicCulture));
    setFormData((prev) => {
      const draft = buildDraftFromPublicCulture(publicCulture);
      const updated = {
        ...prev,
        ...draft,
        ...(preserveVariety ? { variety: prev.variety } : {}),
      };
      setIsDirty(true);
      setUserInteracted(true);
      setSaveError('');
      setDuplicateErrorKey('');
      validateAndSet(updated);
      return updated;
    });
  }, [validateAndSet]);

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

    applyPublicCultureDraft(publicCulture);
  }, [applyPublicCultureDraft, validateAndSet]);

  // The one place that links a crop draft to a library species and carries
  // over its general ("no variety") fields (crop_family, spacing, seed
  // rate, ...). Every entry point that can identify a species - picking or
  // applying a Name suggestion, picking or applying a Sorte suggestion -
  // must route through this, or the crop draft silently misses the
  // species' general data (see git history: two separate Sorte entry
  // points each needed their own fix before this got unified).
  //
  // `varietyPublicCultures` only holds rows for the *currently* matched
  // species (see the fetch effect above), so if it's not that species yet,
  // the actual application is deferred: link `crop_species` immediately,
  // queue `pendingSpeciesPrefillRef`, and let the effect below finish the
  // job once the fetch for this species lands. A species without a general
  // entry stays linked by `crop_species` alone rather than copying an
  // arbitrary variety's values.
  const applySpeciesGeneralPrefill = useCallback((cropSpeciesId: number) => {
    if (formData.crop_species === cropSpeciesId) {
      return;
    }
    if (loadedVarietySpeciesId === cropSpeciesId) {
      const generalEntry = varietyPublicCultures.find((item) => (
        !(item.variety || '').trim() && !isLikelyTestPublicCultureEntry(item)
      ));
      if (generalEntry) {
        applyPublicCultureDraft(generalEntry, { preserveVariety: true });
        return;
      }
    }
    pendingSpeciesPrefillRef.current = cropSpeciesId;
    setFormData((prev) => {
      const updated = { ...prev, crop_species: cropSpeciesId };
      setIsDirty(true);
      setUserInteracted(true);
      setSaveError('');
      validateAndSet(updated);
      return updated;
    });
  }, [applyPublicCultureDraft, formData.crop_species, loadedVarietySpeciesId, validateAndSet, varietyPublicCultures]);

  const handleNameOptionSelect = useCallback((option: { cropSpeciesId: number | null } | null) => {
    if (option?.cropSpeciesId == null) {
      pendingSpeciesPrefillRef.current = null;
      setFormData((prev) => {
        const updated = { ...prev, crop_species: null };
        setIsDirty(true);
        setUserInteracted(true);
        setSaveError('');
        validateAndSet(updated);
        return updated;
      });
      return;
    }
    applySpeciesGeneralPrefill(option.cropSpeciesId);
  }, [applySpeciesGeneralPrefill, validateAndSet]);

  // Explicit apply action for free text that matches a Name suggestion
  // exactly without having been picked from the dropdown — reuses the exact
  // same linking logic a dropdown pick triggers.
  const handleApplyNameSuggestion = useCallback(() => {
    if (matchedNameOption) {
      handleNameOptionSelect(matchedNameOption);
    }
  }, [handleNameOptionSelect, matchedNameOption]);

  useEffect(() => {
    const pendingSpeciesId = pendingSpeciesPrefillRef.current;
    if (pendingSpeciesId === null || pendingSpeciesId !== loadedVarietySpeciesId) {
      return;
    }
    pendingSpeciesPrefillRef.current = null;
    const generalEntry = varietyPublicCultures.find((item) => (
      !(item.variety || '').trim() && !isLikelyTestPublicCultureEntry(item)
    ));
    if (generalEntry) {
      queueMicrotask(() => applyPublicCultureDraft(generalEntry, { preserveVariety: true }));
    }
  }, [applyPublicCultureDraft, loadedVarietySpeciesId, varietyPublicCultures]);

  // The library entry the typed first-variety text matches exactly. Exposed
  // separately from `firstVarietyPublicCulture` so free text that happens to
  // match a suggestion can offer an explicit "apply" action instead of
  // linking silently (see handleApplyFirstVarietySuggestion).
  const matchedFirstVarietyOption = useMemo(() => {
    const normalizedVariety = normalizeIdentityValue(firstVarietyName);
    return normalizedVariety
      ? varietyPublicCultures.find((item) => normalizeIdentityValue(item.variety) === normalizedVariety)
      : undefined;
  }, [firstVarietyName, varietyPublicCultures]);

  // The crop dialog's optional first variety is a separate culture created
  // after the crop, so picking a suggestion only records which library entry
  // it came from — the draft is built at save time. Only an explicit dropdown
  // pick (reason === 'selectOption') links the library entry; free text that
  // happens to match exactly is offered via handleApplyFirstVarietySuggestion
  // instead, so nothing is taken over silently. Either way, route the match
  // through applySpeciesGeneralPrefill so the parent crop draft also gets the
  // species' general fields, not just the variety row built at save time.
  const handleFirstVarietyCommit = useCallback((variety: string, reason?: AutocompleteChangeReason) => {
    setFirstVarietyName(variety);
    const matched = reason === 'selectOption' && variety.trim()
      ? varietyPublicCultures.find((item) => (
        normalizeIdentityValue(item.variety) === normalizeIdentityValue(variety)
      )) ?? null
      : null;
    setFirstVarietyPublicCulture(matched);
    if (matched?.crop_species != null) {
      applySpeciesGeneralPrefill(matched.crop_species);
    }
    setIsDirty(true);
    setUserInteracted(true);
  }, [applySpeciesGeneralPrefill, varietyPublicCultures]);

  const handleApplyFirstVarietySuggestion = useCallback(() => {
    if (!matchedFirstVarietyOption) return;
    setFirstVarietyPublicCulture(matchedFirstVarietyOption);
    if (matchedFirstVarietyOption.crop_species != null) {
      applySpeciesGeneralPrefill(matchedFirstVarietyOption.crop_species);
    }
    setIsDirty(true);
    setUserInteracted(true);
  }, [applySpeciesGeneralPrefill, matchedFirstVarietyOption]);

  // The library entry the typed variety text matches exactly. Same purpose as
  // matchedFirstVarietyOption above, for the "add variety to existing crop" form.
  const matchedVarietyOption = useMemo(() => {
    const normalizedVariety = normalizeIdentityValue(formData.variety);
    return normalizedVariety
      ? varietyPublicCultures.find((item) => normalizeIdentityValue(item.variety || '') === normalizedVariety)
      : undefined;
  }, [formData.variety, varietyPublicCultures]);

  // Only an explicit dropdown pick applies library values automatically; free
  // text that happens to match exactly is offered via
  // handleApplyVarietySuggestion instead (see matchedVarietyOption above).
  const handleVarietyCommit = useCallback((variety: string, reason?: AutocompleteChangeReason) => {
    const matchedCulture = reason === 'selectOption' && variety.trim()
      ? varietyPublicCultures.find((item) => normalizeIdentityValue(item.variety || '') === normalizeIdentityValue(variety))
      : undefined;
    if (matchedCulture) {
      handlePublicCultureSelect(matchedCulture);
      return;
    }
    setFormData((prev) => {
      const updated = { ...prev, variety };
      setIsDirty(true);
      setUserInteracted(true);
      setSaveError('');
      setDuplicateErrorKey('');
      validateAndSet(updated);
      return updated;
    });
  }, [handlePublicCultureSelect, validateAndSet, varietyPublicCultures]);

  const handleApplyVarietySuggestion = useCallback(() => {
    if (matchedVarietyOption) {
      handlePublicCultureSelect(matchedVarietyOption);
    }
  }, [handlePublicCultureSelect, matchedVarietyOption]);

  // "Matched, but not linked yet" flags for the explicit apply hints below —
  // formData.crop_species/source_public_culture and firstVarietyPublicCulture
  // only get set via an actual dropdown pick, so a match without a link means
  // the current text was typed rather than chosen from the suggestion list.
  const showNameApplyHint = isProjectForm && Boolean(matchedNameOption) && !formData.crop_species;
  const showVarietyApplyHint = isProjectForm && showVarietyField && Boolean(matchedVarietyOption)
    && formData.source_public_culture !== matchedVarietyOption?.id;
  const showFirstVarietyApplyHint = isProjectForm && showFirstVarietyField && Boolean(matchedFirstVarietyOption)
    && firstVarietyPublicCulture?.id !== matchedFirstVarietyOption?.id;

  // Tab/Shift+Tab inside this dialog is MUI's `Dialog` focus trap's job; Tab
  // out of an open Select dropdown belongs to `TypeaheadSelect`. Do not add a
  // second trap here — see docs/keyboard-architecture.md.

  // Handle manual save (for Save button)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSavingRef.current) return;
    if (isEdit && !hasExternalChanges && !hasEffectiveCultureFormChanges(buildInitialFormData(culture, initialDraft), formData)) {
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
      // A new variety's form starts prefilled with its crop's own values
      // (see Cultures.tsx `handleAddVariety`) purely so the user can see
      // what they're starting from. Any field left matching that baseline
      // is stripped back to empty here so the variety keeps inheriting from
      // the crop (including future crop edits) instead of freezing a
      // duplicate copy of today's crop values.
      const dataToSave = !isEdit && initialDraft
        ? stripValuesMatchingBaseline(
          formData,
          initialDraft,
          (field) => (field in EMPTY_CULTURE ? EMPTY_CULTURE[field as keyof typeof EMPTY_CULTURE] : ''),
        )
        : formData;
      await saveCulture(dataToSave);
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
          {title ?? (
            isProjectForm && formKind === 'variety'
              ? (isEdit ? t('form.editVarietyTitle') : t('form.createVarietyTitle'))
              : (isEdit ? t('form.editTitle') : t('form.createTitle'))
          )}
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
                  {t('form.publicCropIdentityLabel')}
                </Typography>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, overflowWrap: 'anywhere' }}>
                  {cropIdentityLabel || t('noData')}
                </Typography>
                {typeof importedCopiesCount === 'number' ? (
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                    {t('form.publicCultureImportedCopiesCount', { count: importedCopiesCount })}
                  </Typography>
                ) : null}
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
              showVarietyField={showVarietyField}
              varietyRequired={isProjectForm}
              showFirstVarietyField={showFirstVarietyField}
              firstVarietyName={firstVarietyName}
              onFirstVarietyNameChange={handleFirstVarietyNameChange}
              firstVarietyOptions={isProjectForm ? varietyOptions : undefined}
              firstVarietyOptionsLoading={varietyOptionsLoading}
              onFirstVarietyCommit={isProjectForm ? handleFirstVarietyCommit : undefined}
              firstVarietyApplyHint={showFirstVarietyApplyHint && matchedFirstVarietyOption ? (
                <PublicCultureApplyHint
                  hintText={t('form.publicCultureApplyHint', { name: matchedFirstVarietyOption.variety || firstVarietyName })}
                  actionLabel={t('form.publicCultureApplyAction')}
                  onApply={handleApplyFirstVarietySuggestion}
                />
              ) : null}
              firstVarietySourceHint={firstVarietyPublicCulture ? (
                <PublicCultureSourceHint text={t('form.firstVarietySourceHint')} />
              ) : null}
              existingCropHint={existingPrivateCrop ? (
                <Alert
                  severity="info"
                  data-testid="culture-existing-crop-hint"
                  action={(
                    <Button color="inherit" size="small" onClick={handleSwitchToAddVariety}>
                      {t('form.existingCropAddVarietyAction')}
                    </Button>
                  )}
                >
                  {t('form.existingCropHint', { name: existingPrivateCrop.name })}
                </Alert>
              ) : null}
              nameOptions={isProjectForm ? nameOptions : undefined}
              nameOptionsLoading={publicCultureOptionsLoading}
              onNameSearchChange={isProjectForm ? handleManualPublicCultureSearchChange : undefined}
              onNameOptionSelect={isProjectForm ? handleNameOptionSelect : undefined}
              nameApplyHint={showNameApplyHint && matchedNameOption ? (
                <PublicCultureApplyHint
                  hintText={t('form.publicCultureApplyHint', { name: matchedNameOption.name })}
                  actionLabel={t('form.publicCultureApplyAction')}
                  onApply={handleApplyNameSuggestion}
                />
              ) : null}
              varietyOptions={isProjectForm ? varietyOptions : undefined}
              varietyOptionsLoading={varietyOptionsLoading}
              onVarietyCommit={isProjectForm ? handleVarietyCommit : undefined}
              varietyApplyHint={showVarietyApplyHint && matchedVarietyOption ? (
                <PublicCultureApplyHint
                  hintText={t('form.publicCultureApplyHint', { name: matchedVarietyOption.variety || formData.variety || '' })}
                  actionLabel={t('form.publicCultureApplyAction')}
                  onApply={handleApplyVarietySuggestion}
                />
              ) : null}
              identityHint={isProjectForm && formData.source_public_culture ? (
                <PublicCultureSourceHint text={t('form.publicCultureSourceHint')} />
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
