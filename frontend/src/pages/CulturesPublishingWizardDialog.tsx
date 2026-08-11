import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Checkbox,
  CircularProgress,
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
import { cropSpeciesAPI, cultureAPI, publicCultureAPI, type Culture } from '../api/api';
import type { CropSpecies, PublicCulture, PublishPublicCulturePreview } from '../api/types';
import { extractApiErrorMessage } from '../api/errors';
import { useTranslation } from '../i18n';
import i18n from '../i18n/config';
import { getLanguageDisplayName } from '../i18n/languages';
import { buildPublicCultureComparison } from './publicCultureComparison';

interface CulturesPublishingWizardDialogProps {
  open: boolean;
  culture: Culture | undefined;
  termsAlreadyAccepted: boolean;
  publishing: boolean;
  onClose: () => void;
  onPublish: (data: { acceptedPublicLibraryTerms: boolean; cropSpeciesId?: number; originalLanguageCode: string; publicCultureId?: number | null; publishAsGeneral?: boolean }) => void;
}

const LANGUAGE_CODES = ['de', 'en'] as const;
const EMPTY_REQUIRED_FIELDS: PublishPublicCulturePreview['missing_required_fields'] = [];
const EMPTY_DUPLICATES: PublishPublicCulturePreview['duplicates'] = [];

const getDefaultLanguageCode = (): string => {
  const language = (i18n.language || 'de').split('-')[0];
  return LANGUAGE_CODES.includes(language as (typeof LANGUAGE_CODES)[number]) ? language : 'de';
};

const normalizeSpeciesName = (value: string | undefined | null): string => (
  (value || '').split(/\s+/).filter(Boolean).join(' ').toLocaleLowerCase('de')
);

// The picker must match on the name the user actually sees and types, not
// the (possibly differently-languaged) canonical `name` — otherwise a
// species that already exists only under a translation (e.g. "Kürbis" for
// canonical "Pumpkin") looks missing, and proposing it as new fails
// server-side because that translation already exists.
const getCropSpeciesOptionLabel = (option: CropSpecies): string => option.display_name || option.name;

const findInitialSpecies = (items: CropSpecies[], culture: Culture | undefined): CropSpecies | null => {
  const cultureSpeciesId = culture?.crop_species ?? null;
  if (cultureSpeciesId) {
    return items.find((item) => item.id === cultureSpeciesId) ?? null;
  }

  const normalizedCultureName = normalizeSpeciesName(culture?.name);
  if (!normalizedCultureName) {
    return null;
  }
  return items.find((item) => (
    normalizeSpeciesName(item.name) === normalizedCultureName
    || normalizeSpeciesName(getCropSpeciesOptionLabel(item)) === normalizedCultureName
  )) ?? null;
};

const getPublicCultureOptionLabel = (option: PublicCulture): string => {
  const name = option.display_name || option.crop_species_name || option.name;
  return option.variety ? `${name} · ${option.variety}` : name;
};

// The "Existing variety" field is already scoped to the chosen species (it's
// right below that field), so repeating the species name in every option
// would just be noise — only the variety name itself is shown/typed there.
const getExistingVarietyOptionLabel = (option: PublicCulture): string => option.variety || getPublicCultureOptionLabel(option);

export function CulturesPublishingWizardDialog({
  open,
  culture,
  termsAlreadyAccepted,
  publishing,
  onClose,
  onPublish,
}: CulturesPublishingWizardDialogProps) {
  const { t } = useTranslation(['cultures', 'common']);
  const [species, setSpecies] = useState<CropSpecies[]>([]);
  const [speciesLoading, setSpeciesLoading] = useState(false);
  const [selectedSpecies, setSelectedSpecies] = useState<CropSpecies | null>(null);
  const [publicCultureOptions, setPublicCultureOptions] = useState<PublicCulture[]>([]);
  const [publicCultureLoading, setPublicCultureLoading] = useState(false);
  const [selectedPublicCulture, setSelectedPublicCulture] = useState<PublicCulture | null>(null);
  const [publicCultureInput, setPublicCultureInput] = useState('');
  const [originalLanguageCode, setOriginalLanguageCode] = useState(getDefaultLanguageCode());
  const [acceptedLicense, setAcceptedLicense] = useState(false);
  const [validationResult, setValidationResult] = useState<PublishPublicCulturePreview | null>(null);
  const [validationLoading, setValidationLoading] = useState(false);
  const [showLicenseConfirmation, setShowLicenseConfirmation] = useState(false);
  const [speciesInputValue, setSpeciesInputValue] = useState('');
  const [existingVarietyInputValue, setExistingVarietyInputValue] = useState('');
  const [proposedSpeciesName, setProposedSpeciesName] = useState<string | null>(null);
  const [proposingSpecies, setProposingSpecies] = useState(false);
  const [proposeSpeciesError, setProposeSpeciesError] = useState('');
  const [generalNoticeDismissed, setGeneralNoticeDismissed] = useState(false);
  const [showLanguageOverride, setShowLanguageOverride] = useState(false);
  const speciesInputRef = useRef<HTMLInputElement | null>(null);
  const languageInputRef = useRef<HTMLInputElement | null>(null);
  const ownedPublicCultureId = culture?.owned_public_culture_id ?? null;
  const isOwnedPublicCultureUpdate = Boolean(ownedPublicCultureId);
  // When updating an already-linked public entry, whether the update targets
  // a general (varietyless) entry depends on the linked entry itself, not on
  // the local culture — the local culture may have no variety yet the public
  // entry it's linked to could be variety-specific, or vice versa.
  const isCropLevelPublish = isOwnedPublicCultureUpdate
    ? Boolean(selectedPublicCulture) && !selectedPublicCulture?.variety?.trim()
    : !culture?.variety?.trim();

  useEffect(() => {
    if (!open) return;
    queueMicrotask(() => {
      setAcceptedLicense(false);
      setShowLicenseConfirmation(false);
      // Prefilled with the local culture's own name so the field never starts
      // empty — the user can still overwrite it if no official species
      // matches, or if they want to propose a different one.
      setSpeciesInputValue(culture?.name ?? '');
      // Same idea for the variety field: pre-fill with the local variety's
      // own name. If a matching public entry is found once the search
      // results load (see the publicCultureOptions effect), it's also
      // auto-selected there.
      setExistingVarietyInputValue(culture?.variety ?? '');
      setProposedSpeciesName(null);
      setProposeSpeciesError('');
      setGeneralNoticeDismissed(false);
      setShowLanguageOverride(false);
      setValidationResult(null);
      setOriginalLanguageCode(getDefaultLanguageCode());
      setPublicCultureInput(culture?.name ?? '');
      setSelectedPublicCulture(null);
    });
  }, [culture?.name, culture?.variety, open]);

  useEffect(() => {
    const publicCultureId = ownedPublicCultureId ?? culture?.source_public_culture;
    if (!open || !publicCultureId) return;
    let cancelled = false;
    publicCultureAPI.get(publicCultureId)
      .then((response) => {
        if (cancelled) return;
        setSelectedPublicCulture(response.data);
        setPublicCultureInput(getPublicCultureOptionLabel(response.data));
        if (ownedPublicCultureId) {
          setOriginalLanguageCode(response.data.original_language_code || getDefaultLanguageCode());
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [culture?.source_public_culture, open, ownedPublicCultureId]);

  useEffect(() => {
    if (isOwnedPublicCultureUpdate || isCropLevelPublish) return undefined;
    if (!open) return undefined;
    const searchTerm = selectedSpecies?.name.trim() || '';
    if (!searchTerm) {
      queueMicrotask(() => setPublicCultureOptions([]));
      return undefined;
    }

    let cancelled = false;
    const abortController = new AbortController();
    const timeoutId = window.setTimeout(() => {
      setPublicCultureLoading(true);
      publicCultureAPI.list({ q: searchTerm }, abortController.signal)
        .then((response) => {
          if (cancelled) return;
          const filtered = response.data.results.filter((entry) => (
            !selectedSpecies || entry.crop_species === selectedSpecies.id
          ));
          setPublicCultureOptions(filtered);
          // If the local variety already has a matching public entry,
          // recognize it immediately instead of leaving the field empty —
          // mirrors the species field's own-name prefill above.
          const normalizedLocalVariety = normalizeSpeciesName(culture?.variety);
          const match = normalizedLocalVariety
            ? filtered.find((entry) => normalizeSpeciesName(entry.variety) === normalizedLocalVariety)
            : undefined;
          if (match) {
            setSelectedPublicCulture((prevSelected) => prevSelected ?? match);
            setExistingVarietyInputValue((prevInput) => (
              prevInput === (culture?.variety ?? '') ? getExistingVarietyOptionLabel(match) : prevInput
            ));
          }
        })
        .catch(() => {
          if (!cancelled && !abortController.signal.aborted) setPublicCultureOptions([]);
        })
        .finally(() => {
          if (!cancelled) setPublicCultureLoading(false);
        });
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
      abortController.abort();
    };
  }, [culture?.variety, isOwnedPublicCultureUpdate, isCropLevelPublish, open, selectedSpecies]);

  useEffect(() => {
    if (isOwnedPublicCultureUpdate) return;
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
        setSelectedSpecies(findInitialSpecies(response.data.results, culture));
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
  }, [culture, isOwnedPublicCultureUpdate, open]);

  const missingRequiredFields = validationResult?.missing_required_fields ?? EMPTY_REQUIRED_FIELDS;
  const duplicates = validationResult?.duplicates ?? EMPTY_DUPLICATES;
  const licenseAccepted = termsAlreadyAccepted || acceptedLicense;
  const hasVisibleValidationIssues = missingRequiredFields.length > 0 || duplicates.length > 0;
  const isUpdatingOwnedPublicCulture = Boolean(
    selectedPublicCulture && selectedPublicCulture.id === ownedPublicCultureId,
  );
  const comparison = useMemo(
    () => (isUpdatingOwnedPublicCulture && culture && selectedPublicCulture
      ? buildPublicCultureComparison(culture, selectedPublicCulture, t, { publishAsGeneral: isCropLevelPublish })
      : null),
    [isUpdatingOwnedPublicCulture, culture, isCropLevelPublish, selectedPublicCulture, t],
  );
  const isBlockedByValidation = !isUpdatingOwnedPublicCulture
    && !selectedPublicCulture
    && validationResult !== null
    && !validationResult.can_publish;
  const existingVarietyOptions = publicCultureOptions.filter((option) => (option.variety || '').trim());

  const resetValidationResult = useCallback(() => {
    setValidationResult(null);
  }, []);

  const handleProposeSpecies = useCallback(async (name: string) => {
    const trimmedName = name.trim();
    if (!trimmedName) return;
    setProposingSpecies(true);
    setProposeSpeciesError('');
    try {
      const response = await cropSpeciesAPI.propose(trimmedName);
      const created = response.data;
      // Make the pending species immediately usable for this publish attempt
      // instead of leaving the user stuck until a moderator reviews it — the
      // backend accepts `proposed` species as a publish target (see
      // resolve_publishing_crop_species), and the variety becomes fully
      // official automatically once the species is approved.
      setSpecies((prev) => [...prev, created]);
      setSelectedSpecies(created);
      setSpeciesInputValue(getCropSpeciesOptionLabel(created));
      setSelectedPublicCulture(null);
      resetValidationResult();
      setProposedSpeciesName(getCropSpeciesOptionLabel(created));
    } catch (error) {
      setProposeSpeciesError(extractApiErrorMessage(error, t, t('library.publishWizard.proposeSpeciesError')));
    } finally {
      setProposingSpecies(false);
    }
  }, [resetValidationResult, t]);

  const handlePublish = useCallback(async () => {
    if (!culture?.id) return;
    if (selectedPublicCulture && !isUpdatingOwnedPublicCulture) {
      onPublish({
        acceptedPublicLibraryTerms: false,
        originalLanguageCode,
        publicCultureId: selectedPublicCulture.id,
      });
      return;
    }
    const cropSpeciesId = isUpdatingOwnedPublicCulture
      ? selectedPublicCulture?.crop_species
      : selectedSpecies?.id;
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
      const response = await cultureAPI.publishPreview(culture.id, {
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
    culture,
    isCropLevelPublish,
    licenseAccepted,
    onPublish,
    originalLanguageCode,
    selectedPublicCulture,
    selectedSpecies,
    showLicenseConfirmation,
    termsAlreadyAccepted,
    isUpdatingOwnedPublicCulture,
  ]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{t('library.publishWizard.title')}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={isOwnedPublicCultureUpdate ? 1.5 : 2.25} sx={{ pt: 0.5 }}>
          {isOwnedPublicCultureUpdate ? (
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              {t('library.publishWizard.updateHeading', {
                name: selectedPublicCulture ? getPublicCultureOptionLabel(selectedPublicCulture) : publicCultureInput,
              })}
            </Typography>
          ) : (
            <Typography variant="body2" color="text.secondary">
              {t(
                isCropLevelPublish ? 'library.publishWizard.introGeneral' : 'library.publishWizard.intro',
                { name: culture?.name ?? '' },
              )}
            </Typography>
          )}

          <Stack spacing={2}>
            {isOwnedPublicCultureUpdate ? null : (
              <>
                <Autocomplete
                  options={species}
                  value={selectedSpecies}
                  inputValue={speciesInputValue}
                  loading={speciesLoading}
                  getOptionLabel={getCropSpeciesOptionLabel}
                  isOptionEqualToValue={(option, value) => option.id === value.id}
                  onChange={(_, value) => {
                    setSelectedSpecies(value);
                    setSelectedPublicCulture(null);
                    setProposedSpeciesName(null);
                    resetValidationResult();
                  }}
                  onInputChange={(_, value) => {
                    setSpeciesInputValue(value);
                    setProposeSpeciesError('');
                  }}
                  noOptionsText={speciesLoading ? (
                    <Typography variant="body2" color="text.secondary">{t('common:loading')}</Typography>
                  ) : speciesInputValue.trim() ? (
                    <Stack spacing={0.5} sx={{ alignItems: "flex-start", }} >
                      <Button
                        size="small"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => void handleProposeSpecies(speciesInputValue)}
                        disabled={proposingSpecies}
                      >
                        {proposingSpecies
                          ? t('library.publishWizard.proposeSpeciesButton')
                          : t('library.publishWizard.proposeSpeciesInline', { name: speciesInputValue.trim() })}
                      </Button>
                      {proposeSpeciesError ? (
                        <Typography variant="body2" color="error.main" sx={{ px: 1 }}>
                          {proposeSpeciesError}
                        </Typography>
                      ) : null}
                    </Stack>
                  ) : (
                    t('library.publishWizard.speciesNoOptions')
                  )}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      inputRef={speciesInputRef}
                      label={t('library.publishWizard.speciesLabel')}
                      required
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
                    value={selectedPublicCulture}
                    inputValue={existingVarietyInputValue}
                    loading={publicCultureLoading}
                    getOptionLabel={getExistingVarietyOptionLabel}
                    isOptionEqualToValue={(option, value) => option.id === value.id}
                    filterOptions={(options) => options}
                    onChange={(_, value) => {
                      setSelectedPublicCulture(value);
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
                        helperText={culture?.variety?.trim()
                          ? t('library.publishWizard.existingVarietyHelp')
                          : t('library.publishWizard.publicCultureHelp')}
                        slotProps={{
                          ...params.slotProps,

                          input: {
                            ...params.slotProps.input,
                            endAdornment: (
                              <>
                                {publicCultureLoading ? <CircularProgress color="inherit" size={20} /> : null}
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

            {!isOwnedPublicCultureUpdate ? (
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

          {proposedSpeciesName ? (
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
                to={`/app/crop-library?cultureId=${validationResult.general_crop_notice.public_culture_id}`}
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
                            <Link component={RouterLink} to={`/app/crop-library?cultureId=${item.id}`} target="_blank" rel="noopener">
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
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} variant="outlined">{t('common:actions.cancel')}</Button>
        <Button
          onClick={() => void handlePublish()}
          variant="contained"
          disabled={
            (isUpdatingOwnedPublicCulture ? !selectedPublicCulture?.crop_species : !selectedSpecies)
            || !originalLanguageCode
            || publishing
            || validationLoading
            || isBlockedByValidation
            || (isUpdatingOwnedPublicCulture && comparison?.length === 0)
            || (showLicenseConfirmation && !termsAlreadyAccepted && !acceptedLicense)
          }
        >
          {publishing || validationLoading
            ? t('library.publishing')
            : isBlockedByValidation
              ? t('library.publishWizard.resolveBlockingIssues')
              : isUpdatingOwnedPublicCulture
                ? t('library.publishWizard.updateExisting')
                : selectedPublicCulture
                  ? t('library.publishWizard.linkExisting')
                  : t('library.publishWizard.publishNow')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
