import { useCallback, useEffect, useRef, useState } from 'react';
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
  FormLabel,
  InputLabel,
  Link,
  MenuItem,
  Radio,
  RadioGroup,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { Link as RouterLink } from 'react-router';
import { cropSpeciesAPI, cultureAPI, publicCultureAPI, type Culture } from '../api/api';
import type { CropSpecies, PublicCulture, PublishPublicCulturePreview } from '../api/types';
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
type PublishTarget = 'species' | 'variety';

const getDefaultLanguageCode = (): string => {
  const language = (i18n.language || 'de').split('-')[0];
  return LANGUAGE_CODES.includes(language as (typeof LANGUAGE_CODES)[number]) ? language : 'de';
};

const normalizeSpeciesName = (value: string | undefined | null): string => (
  (value || '').split(/\s+/).filter(Boolean).join(' ').toLocaleLowerCase('de')
);

const findInitialSpecies = (items: CropSpecies[], culture: Culture | undefined): CropSpecies | null => {
  const cultureSpeciesId = culture?.crop_species ?? null;
  if (cultureSpeciesId) {
    return items.find((item) => item.id === cultureSpeciesId) ?? null;
  }

  const normalizedCultureName = normalizeSpeciesName(culture?.name);
  if (!normalizedCultureName) {
    return null;
  }
  return items.find((item) => normalizeSpeciesName(item.name) === normalizedCultureName) ?? null;
};

const getPublicCultureOptionLabel = (option: PublicCulture): string => {
  const name = option.display_name || option.crop_species_name || option.name;
  return option.variety ? `${name} · ${option.variety}` : name;
};

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
  const [publishTarget, setPublishTarget] = useState<PublishTarget>('variety');
  const [originalLanguageCode, setOriginalLanguageCode] = useState(getDefaultLanguageCode());
  const [acceptedLicense, setAcceptedLicense] = useState(false);
  const [validationResult, setValidationResult] = useState<PublishPublicCulturePreview | null>(null);
  const [validationLoading, setValidationLoading] = useState(false);
  const [showLicenseConfirmation, setShowLicenseConfirmation] = useState(false);
  const [showProposalForm, setShowProposalForm] = useState(false);
  const [proposalName, setProposalName] = useState('');
  const [proposalSent, setProposalSent] = useState(false);
  const speciesInputRef = useRef<HTMLInputElement | null>(null);
  const languageInputRef = useRef<HTMLInputElement | null>(null);
  const ownedPublicCultureId = culture?.owned_public_culture_id ?? null;
  const isOwnedPublicCultureUpdate = Boolean(ownedPublicCultureId);

  useEffect(() => {
    if (!open) return;
    queueMicrotask(() => {
      setAcceptedLicense(false);
      setShowLicenseConfirmation(false);
      setShowProposalForm(false);
      setProposalName('');
      setProposalSent(false);
      setValidationResult(null);
      setOriginalLanguageCode(getDefaultLanguageCode());
      setPublicCultureInput(culture?.name ?? '');
      setSelectedPublicCulture(null);
      setPublishTarget(culture?.variety?.trim() ? 'variety' : 'species');
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
    if (isOwnedPublicCultureUpdate) return undefined;
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
          if (!cancelled) {
            setPublicCultureOptions(response.data.results.filter((entry) => (
              !selectedSpecies || entry.crop_species === selectedSpecies.id
            )));
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
  }, [isOwnedPublicCultureUpdate, open, selectedSpecies]);

  useEffect(() => {
    if (isOwnedPublicCultureUpdate) return;
    if (!open) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) setSpeciesLoading(true);
    });
    cropSpeciesAPI.list()
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
  const comparison = isUpdatingOwnedPublicCulture && culture && selectedPublicCulture
    ? buildPublicCultureComparison(culture, selectedPublicCulture, t)
    : null;
  const isBlockedByValidation = !isUpdatingOwnedPublicCulture
    && !selectedPublicCulture
    && validationResult !== null
    && !validationResult.can_publish;
  const existingGeneralPublicCulture = publicCultureOptions.find((option) => !(option.variety || '').trim()) ?? null;
  const existingVarietyOptions = publicCultureOptions.filter((option) => (option.variety || '').trim());

  const handleProposeSpecies = useCallback(async () => {
    const trimmedName = proposalName.trim();
    if (!trimmedName) return;
    await cropSpeciesAPI.propose(trimmedName);
    setProposalName('');
    setProposalSent(true);
  }, [proposalName]);

  const resetValidationResult = useCallback(() => {
    setValidationResult(null);
  }, []);

  const handlePublish = useCallback(async () => {
    if (!culture?.id) return;
    const publicCultureToLink = publishTarget === 'species' ? existingGeneralPublicCulture : selectedPublicCulture;
    if (publicCultureToLink && !isUpdatingOwnedPublicCulture) {
      onPublish({
        acceptedPublicLibraryTerms: false,
        originalLanguageCode,
        publicCultureId: publicCultureToLink.id,
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
        publish_as_general: publishTarget === 'species',
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
      ...(publishTarget === 'species' ? { publishAsGeneral: true } : {}),
    });
  }, [
    acceptedLicense,
    culture,
    licenseAccepted,
    onPublish,
    originalLanguageCode,
    selectedPublicCulture,
    selectedSpecies,
    showLicenseConfirmation,
    termsAlreadyAccepted,
    isUpdatingOwnedPublicCulture,
    publishTarget,
    existingGeneralPublicCulture,
  ]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{t('library.publishWizard.title')}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2.25} sx={{ pt: 0.5 }}>
          <Typography variant="body2" color="text.secondary">
            {t(isOwnedPublicCultureUpdate ? 'library.publishWizard.updateIntro' : 'library.publishWizard.intro', {
              name: culture?.name ?? '',
            })}
          </Typography>

          <Stack spacing={2}>
            {isOwnedPublicCultureUpdate ? (
              <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 1.5 }}>
                <Typography variant="caption" color="text.secondary">
                  {t('library.publishWizard.publicEntryLabel')}
                </Typography>
                <Typography variant="body1" sx={{ fontWeight: 600 }}>
                  {selectedPublicCulture ? getPublicCultureOptionLabel(selectedPublicCulture) : publicCultureInput}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  {t('library.publishWizard.publicCultureUpdateHelp')}
                </Typography>
              </Box>
            ) : (
              <>
                <Autocomplete
                  options={species}
                  value={selectedSpecies}
                  loading={speciesLoading}
                  getOptionLabel={(option) => option.name}
                  isOptionEqualToValue={(option, value) => option.id === value.id}
                  onChange={(_, value) => {
                    setSelectedSpecies(value);
                    setSelectedPublicCulture(null);
                    resetValidationResult();
                  }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      inputRef={speciesInputRef}
                      label={t('library.publishWizard.speciesLabel')}
                      required
                      InputProps={{
                        ...params.InputProps,
                        endAdornment: (
                          <>
                            {speciesLoading ? <CircularProgress color="inherit" size={20} /> : null}
                            {params.InputProps.endAdornment}
                          </>
                        ),
                      }}
                    />
                  )}
                />

                <FormControl>
                  <FormLabel>{t('library.publishWizard.publishAsLabel')}</FormLabel>
                  <RadioGroup
                    value={publishTarget}
                    onChange={(event) => {
                      setPublishTarget(event.target.value as PublishTarget);
                      setSelectedPublicCulture(null);
                      resetValidationResult();
                    }}
                  >
                    <FormControlLabel value="species" control={<Radio />} label={t('library.publishWizard.publishAsSpecies')} />
                    <FormControlLabel value="variety" control={<Radio />} label={t('library.publishWizard.publishAsVariety')} />
                  </RadioGroup>
                </FormControl>

                {publishTarget === 'species' ? (
                  <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 1.5 }}>
                    <Typography variant="caption" color="text.secondary">
                      {t('library.publishWizard.publicEntryLabel')}
                    </Typography>
                    <Typography variant="body1" sx={{ fontWeight: 600 }}>
                      {existingGeneralPublicCulture
                        ? getPublicCultureOptionLabel(existingGeneralPublicCulture)
                        : t('library.publishWizard.newGeneralEntry')}
                    </Typography>
                  </Box>
                ) : (
                  <Autocomplete
                    options={existingVarietyOptions}
                    value={selectedPublicCulture}
                    loading={publicCultureLoading}
                    getOptionLabel={getPublicCultureOptionLabel}
                    isOptionEqualToValue={(option, value) => option.id === value.id}
                    filterOptions={(options) => options}
                    onChange={(_, value) => {
                      setSelectedPublicCulture(value);
                      resetValidationResult();
                    }}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label={t('library.publishWizard.existingVarietyLabel')}
                        helperText={culture?.variety?.trim()
                          ? t('library.publishWizard.existingVarietyHelp')
                          : t('library.publishWizard.publicCultureHelp')}
                        InputProps={{
                          ...params.InputProps,
                          endAdornment: (
                            <>
                              {publicCultureLoading ? <CircularProgress color="inherit" size={20} /> : null}
                              {params.InputProps.endAdornment}
                            </>
                          ),
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
                        <Typography component="dt" variant="body2" fontWeight={600}>{change.label}</Typography>
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
              <>
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
              </>
            ) : null}
          </Stack>

          {!selectedPublicCulture ? (
          <Box>
            <Button size="small" variant="text" onClick={() => setShowProposalForm((value) => !value)}>
              {t('library.publishWizard.proposeSpeciesToggle')}
            </Button>
            {showProposalForm ? (
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mt: 1 }}>
                <TextField
                  value={proposalName}
                  onChange={(event) => setProposalName(event.target.value)}
                  label={t('library.publishWizard.proposeSpeciesLabel')}
                  size="small"
                  fullWidth
                />
                <Button variant="outlined" onClick={() => void handleProposeSpecies()} disabled={!proposalName.trim()}>
                  {t('library.publishWizard.proposeSpeciesButton')}
                </Button>
              </Stack>
            ) : null}
            {proposalSent ? <Typography sx={{ mt: 1 }} variant="body2" color="success.main">{t('library.publishWizard.proposalSent')}</Typography> : null}
          </Box>
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
                  {t('library.publishWizard.duplicateBlocking', {
                    duplicates: duplicates.map((item) => item.variety ? `${item.name} (${item.variety})` : item.name).join(', '),
                  })}
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
                : (publishTarget === 'species' ? existingGeneralPublicCulture : selectedPublicCulture)
                  ? t('library.publishWizard.linkExisting')
                  : t('library.publishWizard.publishNow')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
