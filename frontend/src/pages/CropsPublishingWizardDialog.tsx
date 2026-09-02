import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  createFilterOptions,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  InputLabel,
  Link,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { Link as RouterLink } from 'react-router';
import { cropSpeciesAPI, cropAPI, publicCropAPI, type Crop } from '../api/api';
import type { CropSpecies, PublicCrop, PublishPublicCropPreview } from '../api/types';
import { extractApiErrorMessage } from '../api/errors';
import { useTranslation } from '../i18n';
import i18n from '../i18n/config';
import { getLanguageDisplayName } from '../i18n/languages';
import { buildPublicCropComparison } from './publicCropComparison';
import {
  findMatchedCropSpeciesAlias,
  formatCropSpeciesMatchLabel,
  getCropSpeciesCanonicalName,
  getCropSpeciesSearchNames,
  hasStrongCropSpeciesIdentityMatch,
  isCropSpeciesSearchMatch,
  normalizeCropSpeciesSearchValue,
} from '../crops/cropSpeciesMatching';

interface CropsPublishingWizardDialogProps {
  open: boolean;
  crop: Crop | undefined;
  termsAlreadyAccepted: boolean;
  publishing: boolean;
  onClose: () => void;
  onPublish: (data: { acceptedPublicLibraryTerms: boolean; cropSpeciesId?: number; originalLanguageCode: string; publicCropId?: number | null; publishAsGeneral?: boolean }) => void;
}

const LANGUAGE_CODES = ['de', 'en'] as const;
const EMPTY_REQUIRED_FIELDS: PublishPublicCropPreview['missing_required_fields'] = [];
const EMPTY_DUPLICATES: PublishPublicCropPreview['duplicates'] = [];

const getDefaultLanguageCode = (): string => {
  const language = (i18n.language || 'de').split('-')[0];
  return LANGUAGE_CODES.includes(language as (typeof LANGUAGE_CODES)[number]) ? language : 'de';
};

const getCropSpeciesOptionLabel = (option: CropSpecies, searchValue = ''): string => {
  const canonicalName = getCropSpeciesCanonicalName(option);
  return formatCropSpeciesMatchLabel(
    canonicalName,
    findMatchedCropSpeciesAlias(searchValue, canonicalName, getCropSpeciesSearchNames(option)),
  );
};

/**
 * Sentinel option that lets the user propose their own typed name as a new
 * crop species. It is appended to the species dropdown as the last entry
 * only when the typed value does not match any official species name,
 * synonym, or regional name. Matches must be explicit instead of silent:
 * if an alias made the canonical species appear, the option label includes it.
 *
 * Picking it does not talk to the server. It puts the dialog into
 * "propose a new species" mode and the proposal is submitted together with the
 * publication when the user presses the dialog's main button — so a browsed-
 * away wizard never leaves a stray proposal behind.
 */
interface ProposeSpeciesOption {
  proposeName: string;
  /** Separates the action from the regular hits above it; false when it stands alone. */
  dividerAbove: boolean;
}

type SpeciesPickerOption = CropSpecies | ProposeSpeciesOption;

const isProposeSpeciesOption = (option: SpeciesPickerOption): option is ProposeSpeciesOption => (
  'proposeName' in option
);

const getCropSpeciesSearchText = (option: SpeciesPickerOption): string => {
  if (isProposeSpeciesOption(option)) {
    return option.proposeName;
  }
  return getCropSpeciesSearchNames(option).join(' ');
};

const getSpeciesPickerOptionLabel = (option: SpeciesPickerOption): string => (
  isProposeSpeciesOption(option) ? option.proposeName : getCropSpeciesOptionLabel(option)
);

const filterSpeciesOptions = createFilterOptions<SpeciesPickerOption>({
  stringify: getCropSpeciesSearchText,
});

const findInitialSpecies = (items: CropSpecies[], crop: Crop | undefined): CropSpecies | null => {
  const cropSpeciesId = crop?.crop_species ?? null;
  if (cropSpeciesId) {
    return items.find((item) => item.id === cropSpeciesId) ?? null;
  }

  const normalizedCropName = normalizeCropSpeciesSearchValue(crop?.name);
  if (!normalizedCropName) {
    return null;
  }
  return items.find((item) => (
    getCropSpeciesSearchNames(item).some((name) => normalizeCropSpeciesSearchValue(name) === normalizedCropName)
  )) ?? null;
};

const getPublicCropOptionLabel = (option: PublicCrop): string => {
  const name = option.display_name || option.crop_species_name || option.name;
  return option.variety ? `${name} · ${option.variety}` : name;
};

// The "Existing variety" field is already scoped to the chosen species (it's
// right below that field), so repeating the species name in every option
// would just be noise — only the variety name itself is shown/typed there.
const getExistingVarietyOptionLabel = (option: PublicCrop): string => option.variety || getPublicCropOptionLabel(option);

export function CropsPublishingWizardDialog({
  open,
  crop,
  termsAlreadyAccepted,
  publishing,
  onClose,
  onPublish,
}: CropsPublishingWizardDialogProps) {
  const { t } = useTranslation(['crops', 'common']);
  const [species, setSpecies] = useState<CropSpecies[]>([]);
  const [speciesLoading, setSpeciesLoading] = useState(false);
  const [selectedSpecies, setSelectedSpecies] = useState<CropSpecies | null>(null);
  const [publicCropOptions, setPublicCropOptions] = useState<PublicCrop[]>([]);
  const [publicCropLoading, setPublicCropLoading] = useState(false);
  const [selectedPublicCrop, setSelectedPublicCrop] = useState<PublicCrop | null>(null);
  const [publicCropInput, setPublicCropInput] = useState('');
  const [originalLanguageCode, setOriginalLanguageCode] = useState(getDefaultLanguageCode());
  const [acceptedLicense, setAcceptedLicense] = useState(false);
  const [validationResult, setValidationResult] = useState<PublishPublicCropPreview | null>(null);
  const [validationLoading, setValidationLoading] = useState(false);
  const [showLicenseConfirmation, setShowLicenseConfirmation] = useState(false);
  const [speciesInputValue, setSpeciesInputValue] = useState('');
  const [existingVarietyInputValue, setExistingVarietyInputValue] = useState('');
  const [proposedSpeciesName, setProposedSpeciesName] = useState<string | null>(null);
  // Set while the user picked "propose this as a new species" but nothing has
  // been sent yet — the dialog's main button submits it (see handlePublish).
  const [pendingSpeciesProposalName, setPendingSpeciesProposalName] = useState<string | null>(null);
  const [proposingSpecies, setProposingSpecies] = useState(false);
  const [proposeSpeciesError, setProposeSpeciesError] = useState('');
  const [generalNoticeDismissed, setGeneralNoticeDismissed] = useState(false);
  const [showLanguageOverride, setShowLanguageOverride] = useState(false);
  const speciesInputRef = useRef<HTMLInputElement | null>(null);
  const languageInputRef = useRef<HTMLInputElement | null>(null);
  const highlightedSpeciesOptionRef = useRef<SpeciesPickerOption | null>(null);
  const pendingSpeciesProposalNameRef = useRef<string | null>(null);
  const setPendingSpeciesProposal = useCallback((name: string | null) => {
    pendingSpeciesProposalNameRef.current = name;
    setPendingSpeciesProposalName(name);
  }, []);
  const ownedPublicCropId = crop?.owned_public_crop_id ?? null;
  const isOwnedPublicCropUpdate = Boolean(ownedPublicCropId);
  // When updating an already-linked public entry, whether the update targets
  // a general (varietyless) entry depends on the linked entry itself, not on
  // the local crop — the local crop may have no variety yet the public
  // entry it's linked to could be variety-specific, or vice versa.
  const isCropLevelPublish = isOwnedPublicCropUpdate
    ? Boolean(selectedPublicCrop) && !selectedPublicCrop?.variety?.trim()
    : !crop?.variety?.trim();

  useEffect(() => {
    if (!open) return;
    queueMicrotask(() => {
      setAcceptedLicense(false);
      setShowLicenseConfirmation(false);
      // Prefilled with the local crop's own name so the field never starts
      // empty — the user can still overwrite it if no official species
      // matches, or if they want to propose a different one.
      setSpeciesInputValue(crop?.name ?? '');
      // Same idea for the variety field: pre-fill with the local variety's
      // own name. If a matching public entry is found once the search
      // results load (see the publicCropOptions effect), it's also
      // auto-selected there.
      setExistingVarietyInputValue(crop?.variety ?? '');
      setProposedSpeciesName(null);
      setPendingSpeciesProposal(null);
      setProposeSpeciesError('');
      setGeneralNoticeDismissed(false);
      setShowLanguageOverride(false);
      setValidationResult(null);
      setOriginalLanguageCode(getDefaultLanguageCode());
      setPublicCropInput(crop?.name ?? '');
      setSelectedPublicCrop(null);
    });
  }, [crop?.name, crop?.variety, open]);

  useEffect(() => {
    const publicCropId = ownedPublicCropId ?? crop?.source_public_crop;
    if (!open || !publicCropId) return;
    let cancelled = false;
    publicCropAPI.get(publicCropId)
      .then((response) => {
        if (cancelled) return;
        setSelectedPublicCrop(response.data);
        setPublicCropInput(getPublicCropOptionLabel(response.data));
        if (ownedPublicCropId) {
          setOriginalLanguageCode(response.data.original_language_code || getDefaultLanguageCode());
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [crop?.source_public_crop, open, ownedPublicCropId]);

  useEffect(() => {
    if (isOwnedPublicCropUpdate || isCropLevelPublish) return undefined;
    if (!open) return undefined;
    const searchTerm = selectedSpecies?.name.trim() || '';
    if (!searchTerm) {
      queueMicrotask(() => setPublicCropOptions([]));
      return undefined;
    }

    let cancelled = false;
    const abortController = new AbortController();
    const timeoutId = window.setTimeout(() => {
      setPublicCropLoading(true);
      publicCropAPI.list({ q: searchTerm }, abortController.signal)
        .then((response) => {
          if (cancelled) return;
          const filtered = response.data.results.filter((entry) => (
            !selectedSpecies || entry.crop_species === selectedSpecies.id
          ));
          setPublicCropOptions(filtered);
          // If the local variety already has a matching public entry,
          // recognize it immediately instead of leaving the field empty —
          // mirrors the species field's own-name prefill above.
          const normalizedLocalVariety = normalizeCropSpeciesSearchValue(crop?.variety);
          const match = normalizedLocalVariety
            ? filtered.find((entry) => normalizeCropSpeciesSearchValue(entry.variety) === normalizedLocalVariety)
            : undefined;
          if (match) {
            setSelectedPublicCrop((prevSelected) => prevSelected ?? match);
            setExistingVarietyInputValue((prevInput) => (
              prevInput === (crop?.variety ?? '') ? getExistingVarietyOptionLabel(match) : prevInput
            ));
          }
        })
        .catch(() => {
          if (!cancelled && !abortController.signal.aborted) setPublicCropOptions([]);
        })
        .finally(() => {
          if (!cancelled) setPublicCropLoading(false);
        });
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
      abortController.abort();
    };
  }, [crop?.variety, isOwnedPublicCropUpdate, isCropLevelPublish, open, selectedSpecies]);

  useEffect(() => {
    if (isOwnedPublicCropUpdate) return;
    if (!open) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) setSpeciesLoading(true);
    });
    // The species picker is a client-side-filtered Autocomplete over the full
    // reference list, not a server-searched one — it needs every published
    // species in one page, not just the API's default page_size (100), or
    // species sorted past that cutoff silently become unselectable.
    cropSpeciesAPI.list({ page_size: 1000 })
      .then((response) => {
        if (cancelled) return;
        setSpecies(response.data.results);
        setSelectedSpecies(findInitialSpecies(response.data.results, crop));
      })
      .catch((error) => {
        console.error('Error loading crop species:', error);
      })
      .finally(() => {
        if (!cancelled) setSpeciesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [crop, isOwnedPublicCropUpdate, open]);

  const missingRequiredFields = validationResult?.missing_required_fields ?? EMPTY_REQUIRED_FIELDS;
  const duplicates = validationResult?.duplicates ?? EMPTY_DUPLICATES;
  const licenseAccepted = termsAlreadyAccepted || acceptedLicense;
  const hasVisibleValidationIssues = missingRequiredFields.length > 0 || duplicates.length > 0;
  const isUpdatingOwnedPublicCrop = Boolean(
    selectedPublicCrop && selectedPublicCrop.id === ownedPublicCropId,
  );
  const comparison = useMemo(
    () => (isUpdatingOwnedPublicCrop && crop && selectedPublicCrop
      ? buildPublicCropComparison(crop, selectedPublicCrop, t, { publishAsGeneral: isCropLevelPublish })
      : null),
    [isUpdatingOwnedPublicCrop, crop, isCropLevelPublish, selectedPublicCrop, t],
  );
  const isBlockedByValidation = !isUpdatingOwnedPublicCrop
    && !selectedPublicCrop
    && validationResult !== null
    && !validationResult.can_publish;
  const existingVarietyOptions = publicCropOptions.filter((option) => (option.variety || '').trim());
  const isProposingNewSpecies = Boolean(pendingSpeciesProposalName) && !isUpdatingOwnedPublicCrop;
  const shouldShowProposedSpeciesNotice = Boolean(proposedSpeciesName) && !validationLoading && !isBlockedByValidation;

  const resetValidationResult = useCallback(() => {
    setValidationResult(null);
  }, []);

  const canUseSpeciesProposalName = useCallback((name: string): boolean => {
    const trimmedName = name.trim();
    if (!trimmedName || speciesLoading) return false;
    return !hasStrongCropSpeciesIdentityMatch(
      trimmedName,
      species.map((option) => ({ searchNames: getCropSpeciesSearchNames(option) })),
    );
  }, [species, speciesLoading]);

  const handleProposeSpecies = useCallback(async (name: string): Promise<CropSpecies | null> => {
    const trimmedName = name.trim();
    if (!trimmedName) return null;
    setProposingSpecies(true);
    setProposeSpeciesError('');
    try {
      const response = await cropSpeciesAPI.propose(trimmedName, originalLanguageCode);
      const created = response.data;
      // Make the pending species immediately usable for this publish attempt
      // instead of leaving the user stuck until a moderator reviews it — the
      // backend accepts `proposed` species as a publish target (see
      // resolve_publishing_crop_species), and the variety becomes fully
      // official automatically once the species is approved.
      setSpecies((prev) => [...prev, created]);
      setSelectedSpecies(created);
      setSpeciesInputValue(getCropSpeciesOptionLabel(created));
      setSelectedPublicCrop(null);
      setPendingSpeciesProposal(null);
      resetValidationResult();
      setProposedSpeciesName(getCropSpeciesOptionLabel(created));
      return created;
    } catch (error) {
      setProposeSpeciesError(extractApiErrorMessage(error, t, t('library.publishWizard.proposeSpeciesError')));
      return null;
    } finally {
      setProposingSpecies(false);
    }
  }, [originalLanguageCode, resetValidationResult, t]);

  const handlePublish = useCallback(async () => {
    if (!crop?.id) return;
    if (selectedPublicCrop && !isUpdatingOwnedPublicCrop) {
      onPublish({
        acceptedPublicLibraryTerms: false,
        originalLanguageCode,
        publicCropId: selectedPublicCrop.id,
      });
      return;
    }
    // The species proposal is submitted here rather than when the dropdown
    // entry was picked, so "Kulturart vorschlagen" is one deliberate action
    // that both files the proposal and publishes the variety under it.
    let proposedSpecies: CropSpecies | null = null;
    if (pendingSpeciesProposalName && !isUpdatingOwnedPublicCrop) {
      proposedSpecies = await handleProposeSpecies(pendingSpeciesProposalName);
      if (!proposedSpecies) {
        speciesInputRef.current?.focus();
        return;
      }
    }
    const cropSpeciesId = isUpdatingOwnedPublicCrop
      ? selectedPublicCrop?.crop_species
      : proposedSpecies?.id ?? selectedSpecies?.id;
    if (!cropSpeciesId) {
      speciesInputRef.current?.focus();
      return;
    }
    if (!originalLanguageCode) {
      languageInputRef.current?.focus();
      return;
    }
    setValidationLoading(true);
    try {
      const response = await cropAPI.publishPreview(crop.id, {
        crop_species_id: cropSpeciesId,
        original_language_code: originalLanguageCode,
        ...(isCropLevelPublish ? { publish_as_general: true } : {}),
      });
      setValidationResult(response.data);
      if (!response.data.can_publish) return;
    } catch (error) {
      console.error('Error checking publishing readiness:', error);
      return;
    } finally {
      setValidationLoading(false);
    }

    if (!termsAlreadyAccepted && !showLicenseConfirmation) {
      setShowLicenseConfirmation(true);
      return;
    }
    if (!licenseAccepted) {
      setShowLicenseConfirmation(true);
      return;
    }

    onPublish({
      acceptedPublicLibraryTerms: !termsAlreadyAccepted && acceptedLicense,
      cropSpeciesId,
      originalLanguageCode,
      ...(isCropLevelPublish ? { publishAsGeneral: true } : {}),
    });
  }, [
    acceptedLicense,
    crop,
    handleProposeSpecies,
    isCropLevelPublish,
    licenseAccepted,
    onPublish,
    originalLanguageCode,
    pendingSpeciesProposalName,
    selectedPublicCrop,
    selectedSpecies,
    showLicenseConfirmation,
    termsAlreadyAccepted,
    isUpdatingOwnedPublicCrop,
  ]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{t('library.publishWizard.title')}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={isOwnedPublicCropUpdate ? 1.5 : 2.25} sx={{ pt: 0.5 }}>
          {isOwnedPublicCropUpdate ? (
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              {t('library.publishWizard.updateHeading', {
                name: selectedPublicCrop ? getPublicCropOptionLabel(selectedPublicCrop) : publicCropInput,
              })}
            </Typography>
          ) : (
            <Typography variant="body2" color="text.secondary">
              {t(
                isCropLevelPublish ? 'library.publishWizard.introGeneral' : 'library.publishWizard.intro',
                { name: crop?.name ?? '' },
              )}
            </Typography>
          )}

          <Stack spacing={2}>
            {isOwnedPublicCropUpdate ? null : (
              <>
                <Autocomplete<SpeciesPickerOption>
                  options={species}
                  value={selectedSpecies}
                  inputValue={speciesInputValue}
                  loading={speciesLoading}
                  getOptionLabel={getSpeciesPickerOptionLabel}
                  isOptionEqualToValue={(option, value) => (
                    !isProposeSpeciesOption(option) && !isProposeSpeciesOption(value) && option.id === value.id
                  )}
                  getOptionDisabled={(option) => isProposeSpeciesOption(option) && proposingSpecies}
                  filterOptions={(options, params) => {
                    const baseFiltered = filterSpeciesOptions(options, params);
                    const proposeName = params.inputValue.trim();
                    const filteredIds = new Set(
                      baseFiltered
                        .filter((option): option is CropSpecies => !isProposeSpeciesOption(option))
                        .map((option) => option.id),
                    );
                    const fuzzyMatches = proposeName
                      ? options.filter((option): option is CropSpecies => (
                        !isProposeSpeciesOption(option)
                        && !filteredIds.has(option.id)
                        && isCropSpeciesSearchMatch(proposeName, getCropSpeciesSearchNames(option))
                      ))
                      : [];
                    const filtered = [...baseFiltered, ...fuzzyMatches];
                    const hasStrongExistingSpeciesMatch = hasStrongCropSpeciesIdentityMatch(
                      proposeName,
                      options
                        .filter((option): option is CropSpecies => !isProposeSpeciesOption(option))
                        .map((option) => ({ searchNames: getCropSpeciesSearchNames(option) })),
                    );
                    if (!proposeName || speciesLoading || hasStrongExistingSpeciesMatch) {
                      return filtered;
                    }
                    return [...filtered, { proposeName, dividerAbove: filtered.length > 0 }];
                  }}
                  renderOption={(props, option) => {
                    const { key, ...optionProps } = props;
                    if (isProposeSpeciesOption(option)) {
                      return (
                        <Box
                          component="li"
                          {...optionProps}
                          key="propose-species"
                          sx={{
                            gap: 1,
                            ...(option.dividerAbove
                              ? { borderTop: '1px solid', borderColor: 'divider' }
                              : {}),
                          }}
                        >
                          <Typography variant="body2" color="primary.main" sx={{ fontWeight: 500 }}>
                            {t('library.publishWizard.proposeSpeciesInline', { name: option.proposeName })}
                          </Typography>
                          {proposingSpecies ? <CircularProgress color="inherit" size={16} /> : null}
                        </Box>
                      );
                    }
                    return (
                      <li {...optionProps} key={key}>
                        {getCropSpeciesOptionLabel(option, speciesInputValue)}
                      </li>
                    );
                  }}
                  onHighlightChange={(_, option) => {
                    highlightedSpeciesOptionRef.current = option;
                  }}
                  onKeyDown={(event) => {
                    if (event.key !== 'Tab') return;
                    const highlightedOption = highlightedSpeciesOptionRef.current;
                    const proposalName = highlightedOption && isProposeSpeciesOption(highlightedOption)
                      ? highlightedOption.proposeName
                      : speciesInputValue.trim();
                    if (!canUseSpeciesProposalName(proposalName)) return;

                    setPendingSpeciesProposal(proposalName);
                    setSpeciesInputValue(proposalName);
                    setSelectedSpecies(null);
                    setSelectedPublicCrop(null);
                    setProposedSpeciesName(null);
                    resetValidationResult();
                  }}
                  onChange={(_, value) => {
                    if (value && isProposeSpeciesOption(value)) {
                      // Deliberately no request here — see ProposeSpeciesOption.
                      setPendingSpeciesProposal(value.proposeName);
                      setSelectedSpecies(null);
                      setSelectedPublicCrop(null);
                      setProposedSpeciesName(null);
                      resetValidationResult();
                      return;
                    }
                    setSelectedSpecies(value);
                    setSelectedPublicCrop(null);
                    setProposedSpeciesName(null);
                    setPendingSpeciesProposal(null);
                    resetValidationResult();
                  }}
                  onInputChange={(_, value, reason) => {
                    setProposeSpeciesError('');
                    // 'reset'/'blur' is MUI writing the picked option's label back into
                    // the field right after onChange — not the user retyping,
                    // so it must not undo the propose mode just entered. Picking
                    // "propose as new species" clears `selectedSpecies` (it isn't
                    // a real CropSpecies), which makes this same update write an
                    // empty label into the field; keep showing the proposed name
                    // instead of letting that overwrite it.
                    const pendingProposalName = pendingSpeciesProposalNameRef.current;
                    if ((reason === 'reset' || reason === 'blur') && pendingProposalName) {
                      setSpeciesInputValue(pendingProposalName);
                      return;
                    }
                    setSpeciesInputValue(value);
                    if (reason !== 'reset') {
                      setPendingSpeciesProposal(null);
                    }
                  }}
                  noOptionsText={speciesLoading
                    ? <Typography variant="body2" color="text.secondary">{t('common:loading')}</Typography>
                    : t('library.publishWizard.speciesNoOptions')}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      inputRef={speciesInputRef}
                      label={t('library.publishWizard.speciesLabel')}
                      required
                      error={Boolean(proposeSpeciesError)}
                      helperText={proposeSpeciesError || undefined}
                      slotProps={{
                        ...params.slotProps,

                        input: {
                          ...params.slotProps.input,
                          endAdornment: (
                            <>
                              {speciesLoading ? <CircularProgress color="inherit" size={20} /> : null}
                              {params.slotProps.input.endAdornment}
                            </>
                          ),
                        }
                      }}
                    />
                  )}
                />

                {isCropLevelPublish ? null : (
                  <Autocomplete
                    options={existingVarietyOptions}
                    value={selectedPublicCrop}
                    inputValue={existingVarietyInputValue}
                    loading={publicCropLoading}
                    getOptionLabel={getExistingVarietyOptionLabel}
                    isOptionEqualToValue={(option, value) => option.id === value.id}
                    filterOptions={(options) => options}
                    onChange={(_, value) => {
                      setSelectedPublicCrop(value);
                      setExistingVarietyInputValue(value ? getExistingVarietyOptionLabel(value) : '');
                      resetValidationResult();
                    }}
                    onInputChange={(_, value, reason) => {
                      if (reason === 'reset') return;
                      setExistingVarietyInputValue(value);
                    }}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label={t('library.publishWizard.existingVarietyLabel')}
                        helperText={crop?.variety?.trim()
                          ? t('library.publishWizard.existingVarietyHelp')
                          : t('library.publishWizard.publicCropHelp')}
                        slotProps={{
                          ...params.slotProps,

                          input: {
                            ...params.slotProps.input,
                            endAdornment: (
                              <>
                                {publicCropLoading ? <CircularProgress color="inherit" size={20} /> : null}
                                {params.slotProps.input.endAdornment}
                              </>
                            ),
                          }
                        }}
                      />
                    )}
                  />
                )}
              </>
            )}

            {comparison ? (
              <Box
                aria-label={t('library.publishWizard.comparison.ariaLabel')}
                sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}
              >
                <Box sx={{ px: 2, py: 1.5, bgcolor: 'action.hover' }}>
                  <Typography variant="subtitle2">{t('library.publishWizard.comparison.title')}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {t('library.publishWizard.comparison.description')}
                  </Typography>
                </Box>
                {comparison.length ? (
                  <Box component="dl" sx={{ m: 0 }}>
                    <Box
                      sx={{
                        display: 'grid',
                        gridTemplateColumns: { xs: '1fr', sm: 'minmax(8rem, 0.8fr) 1fr 1fr' },
                        gap: { xs: 0.5, sm: 1.5 },
                        px: 2,
                        py: 1,
                        borderTop: '1px solid',
                        borderColor: 'divider',
                      }}
                    >
                      <Typography variant="caption" color="text.secondary" sx={{ display: { xs: 'none', sm: 'block' } }} />
                      <Typography variant="caption" color="text.secondary">{t('library.publishWizard.comparison.publicValue')}</Typography>
                      <Typography variant="caption" color="text.secondary">{t('library.publishWizard.comparison.privateValue')}</Typography>
                    </Box>
                    {comparison.map((change) => (
                      <Box
                        key={change.field}
                        sx={{
                          display: 'grid',
                          gridTemplateColumns: { xs: '1fr', sm: 'minmax(8rem, 0.8fr) 1fr 1fr' },
                          gap: { xs: 0.5, sm: 1.5 },
                          px: 2,
                          py: 1,
                          borderTop: '1px solid',
                          borderColor: 'divider',
                        }}
                      >
                        <Typography component="dt" variant="body2" sx={{ fontWeight: 600, }} >{change.label}</Typography>
                        <Typography component="dd" variant="body2" sx={{ m: 0, color: 'text.secondary' }}>{change.publicValue}</Typography>
                        <Typography component="dd" variant="body2" sx={{ m: 0 }}>{change.privateValue}</Typography>
                      </Box>
                    ))}
                  </Box>
                ) : (
                  <Alert severity="info" sx={{ borderRadius: 0 }}>
                    {t('library.publishWizard.comparison.noChanges')}
                  </Alert>
                )}
              </Box>
            ) : null}

            {!isOwnedPublicCropUpdate ? (
              showLanguageOverride ? (
                <FormControl fullWidth>
                  <InputLabel id="publishing-original-language-label">{t('library.publishWizard.originalLanguageLabel')}</InputLabel>
                  <Select
                    labelId="publishing-original-language-label"
                    label={t('library.publishWizard.originalLanguageLabel')}
                    value={originalLanguageCode}
                    inputRef={languageInputRef}
                    onChange={(event) => {
                      setOriginalLanguageCode(event.target.value);
                      resetValidationResult();
                    }}
                  >
                    {LANGUAGE_CODES.map((code) => (
                      <MenuItem key={code} value={code}>{getLanguageDisplayName(code, i18n.resolvedLanguage ?? i18n.language)}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              ) : (
                <Stack direction="row" spacing={1} sx={{ alignItems: "center", }} >
                  <Typography variant="body2" color="text.secondary">
                    {t('library.publishWizard.originalLanguageSummary', {
                      language: getLanguageDisplayName(originalLanguageCode, i18n.resolvedLanguage ?? i18n.language),
                    })}
                  </Typography>
                  <Button size="small" onClick={() => setShowLanguageOverride(true)}>
                    {t('library.publishWizard.changeLanguageLink')}
                  </Button>
                </Stack>
              )
            ) : null}
          </Stack>

          {shouldShowProposedSpeciesNotice ? (
            <Alert severity="success" onClose={() => setProposedSpeciesName(null)}>
              {t('library.publishWizard.proposedSpeciesNotice', { name: proposedSpeciesName })}
            </Alert>
          ) : null}

          {validationResult?.general_crop_notice && !generalNoticeDismissed ? (
            <Alert severity="info" onClose={() => setGeneralNoticeDismissed(true)}>
              {t(
                validationResult.general_crop_notice.is_stale
                  ? 'library.publishWizard.generalCropNoticeStale'
                  : 'library.publishWizard.generalCropNoticeIncomplete',
                { name: selectedSpecies?.name ?? '' },
              )}
              {' '}
              <Link
                component={RouterLink}
                to={`/app/crop-library?cropId=${validationResult.general_crop_notice.public_crop_id}`}
                target="_blank"
                rel="noopener"
              >
                {t('library.publishWizard.generalCropNoticeLink')}
              </Link>
            </Alert>
          ) : null}

          {hasVisibleValidationIssues ? (
            <Stack spacing={1}>
              {missingRequiredFields.length ? (
                <Alert severity="warning">
                  {t('library.publishWizard.requiredFieldsBlocking', {
                    fields: missingRequiredFields.map((item) => t(item.label_key)).join(', '),
                  })}
                </Alert>
              ) : null}
              {duplicates.length ? (
                <Alert severity="warning">
                  <Typography variant="body2" sx={{ mb: 0.5 }}>
                    {t('library.publishWizard.duplicateBlockingIntro')}
                  </Typography>
                  <Stack component="ul" sx={{ m: 0, pl: 2.5 }} spacing={0.25}>
                    {duplicates.map((item) => (
                      <Typography component="li" variant="body2" key={item.id}>
                        {item.variety ? `${item.name} (${item.variety})` : item.name}
                        {!item.is_mine ? (
                          <>
                            {' — '}
                            <Link component={RouterLink} to={`/app/crop-library?cropId=${item.id}`} target="_blank" rel="noopener">
                              {t('library.publishWizard.duplicateViewLink')}
                            </Link>
                          </>
                        ) : null}
                      </Typography>
                    ))}
                  </Stack>
                </Alert>
              ) : null}
            </Stack>
          ) : null}

          {showLicenseConfirmation && !termsAlreadyAccepted ? (
            <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 1.5 }}>
              <FormControlLabel
                control={<Checkbox checked={acceptedLicense} onChange={(event) => setAcceptedLicense(event.target.checked)} />}
                label={t('library.publishConfirm.acceptLicense')}
              />
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                {t('library.publishConfirm.linkPrefix')}
                <Link component={RouterLink} to="/datenschutz" target="_blank" rel="noopener">{t('library.publishConfirm.privacyLinkLabel')}</Link>
                {t('library.publishConfirm.linkMiddle')}
                <Link component={RouterLink} to="/nutzungsbedingungen" target="_blank" rel="noopener">{t('library.publishConfirm.termsLinkLabel')}</Link>
                {t('library.publishConfirm.linkSuffix')}
              </Typography>
            </Box>
          ) : null}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2, flexWrap: 'wrap', gap: 1 }}>
        {/* Explains, right where the decision is made, that pressing the button
            files a proposal *and* publishes the variety provisionally. */}
        {isProposingNewSpecies ? (
          <Typography variant="body2" color="text.secondary" sx={{ flexBasis: '100%', mb: 0.5 }}>
            {t('library.publishWizard.proposeSpeciesPublishHint', { name: pendingSpeciesProposalName })}
          </Typography>
        ) : null}
        <Button onClick={onClose} variant="outlined">{t('common:actions.cancel')}</Button>
        <Button
          onClick={() => void handlePublish()}
          variant="contained"
          disabled={
            (isUpdatingOwnedPublicCrop
              ? !selectedPublicCrop?.crop_species
              : !selectedSpecies && !isProposingNewSpecies)
            || !originalLanguageCode
            || publishing
            || validationLoading
            || proposingSpecies
            || isBlockedByValidation
            || (isUpdatingOwnedPublicCrop && comparison?.length === 0)
            || (showLicenseConfirmation && !termsAlreadyAccepted && !acceptedLicense)
          }
        >
          {publishing || validationLoading || proposingSpecies
            ? t('library.publishing')
            : isBlockedByValidation
              ? t('library.publishWizard.resolveBlockingIssues')
              : isUpdatingOwnedPublicCrop
                ? t('library.publishWizard.updateExisting')
                : isProposingNewSpecies
                  ? t('library.publishWizard.proposeSpeciesSubmit')
                  : selectedPublicCrop
                    ? t('library.publishWizard.linkExisting')
                    : t('library.publishWizard.publishNow')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
