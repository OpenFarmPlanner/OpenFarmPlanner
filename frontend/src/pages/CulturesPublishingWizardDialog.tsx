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
  InputLabel,
  Link,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { Link as RouterLink } from 'react-router';
import { cropSpeciesAPI, cultureAPI, type Culture } from '../api/api';
import type { CropSpecies, PublishPublicCulturePreview } from '../api/types';
import { useTranslation } from '../i18n';
import i18n from '../i18n/config';

interface CulturesPublishingWizardDialogProps {
  open: boolean;
  culture: Culture | undefined;
  termsAlreadyAccepted: boolean;
  publishing: boolean;
  onClose: () => void;
  onPublish: (data: { acceptedPublicLibraryTerms: boolean; cropSpeciesId: number; originalLanguageCode: string }) => void;
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
    });
  }, [open]);

  useEffect(() => {
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
  }, [culture, open]);

  const missingRequiredFields = validationResult?.missing_required_fields ?? EMPTY_REQUIRED_FIELDS;
  const duplicates = validationResult?.duplicates ?? EMPTY_DUPLICATES;
  const licenseAccepted = termsAlreadyAccepted || acceptedLicense;
  const hasVisibleValidationIssues = missingRequiredFields.length > 0 || duplicates.length > 0;

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
    if (!selectedSpecies) {
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
        crop_species_id: selectedSpecies.id,
        original_language_code: originalLanguageCode,
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
      cropSpeciesId: selectedSpecies.id,
      originalLanguageCode,
    });
  }, [
    acceptedLicense,
    culture?.id,
    licenseAccepted,
    onPublish,
    originalLanguageCode,
    selectedSpecies,
    showLicenseConfirmation,
    termsAlreadyAccepted,
  ]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{t('library.publishWizard.title')}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2.25} sx={{ pt: 0.5 }}>
          <Typography variant="body2" color="text.secondary">
            {t('library.publishWizard.intro', { name: culture?.name ?? '' })}
          </Typography>

          <Stack spacing={2}>
            <Autocomplete
              options={species}
              value={selectedSpecies}
              loading={speciesLoading}
              getOptionLabel={(option) => option.name}
              isOptionEqualToValue={(option, value) => option.id === value.id}
              onChange={(_, value) => {
                setSelectedSpecies(value);
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
                  <MenuItem key={code} value={code}>{t(`library.publishWizard.languages.${code}`)}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>

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
          disabled={!selectedSpecies || !originalLanguageCode || publishing || validationLoading || (showLicenseConfirmation && !termsAlreadyAccepted && !acceptedLicense)}
        >
          {publishing || validationLoading ? t('library.publishing') : t('library.publishWizard.publishNow')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
