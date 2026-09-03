import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import CheckOutlinedIcon from '@mui/icons-material/CheckOutlined';
import CloseOutlinedIcon from '@mui/icons-material/CloseOutlined';
import GavelOutlinedIcon from '@mui/icons-material/GavelOutlined';
import RestoreOutlinedIcon from '@mui/icons-material/RestoreOutlined';
import { cropSpeciesAPI, publicCropAPI, publicLibraryModeratorRequestAPI } from '../../api/api';
import type { CropSpecies, PublicCrop, PublicLibraryModeratorRequest } from '../../api/types';
import { useAuth } from '../../auth/useAuth';
import PageContainer from '../../components/layout/PageContainer';
import PageHeader from '../../components/layout/PageHeader';
import { useTranslation } from '../../i18n';
import { showGlobalSnackbar } from '../../utils/globalSnackbar';
import { resolveLocaleFromLanguage } from '../../utils/numberLocalization';

type RequiredSpeciesLanguage = 'de' | 'en';
type SpeciesApprovalTranslations = Record<RequiredSpeciesLanguage, string>;

const REQUIRED_SPECIES_LANGUAGES: RequiredSpeciesLanguage[] = ['de', 'en'];

export default function PublicLibraryModerationPage() {
  const { user } = useAuth();
  const { t, i18n } = useTranslation('crops');
  const [speciesProposals, setSpeciesProposals] = useState<CropSpecies[]>([]);
  const [moderatorRequests, setModeratorRequests] = useState<PublicLibraryModeratorRequest[]>([]);
  const [removedCrops, setRemovedCrops] = useState<PublicCrop[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [approvalProposal, setApprovalProposal] = useState<CropSpecies | null>(null);
  const [approvalTranslations, setApprovalTranslations] = useState<SpeciesApprovalTranslations>({ de: '', en: '' });

  const canModerate = Boolean(user?.is_public_library_moderator || user?.is_staff || user?.is_superuser);
  const canManageRequests = Boolean(user?.is_staff || user?.is_superuser);
  const locale = resolveLocaleFromLanguage(i18n.resolvedLanguage);

  const formatDate = (value?: string | null): string => {
    if (!value) {
      return t('library.moderation.unknownDate');
    }
    return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(value));
  };

  const getInitialApprovalTranslations = (proposal: CropSpecies): SpeciesApprovalTranslations => {
    const translations: SpeciesApprovalTranslations = { de: '', en: '' };
    for (const translation of proposal.translations ?? []) {
      if (translation.language_code === 'de' || translation.language_code === 'en') {
        translations[translation.language_code] = translation.common_name;
      }
    }
    if (!translations.de && !translations.en) {
      const fallbackLanguage = proposal.display_language_code === 'de' || proposal.display_language_code === 'en'
        ? proposal.display_language_code
        : i18n.resolvedLanguage === 'de' ? 'de' : 'en';
      translations[fallbackLanguage] = proposal.display_name || proposal.name;
    }
    return translations;
  };

  const loadQueues = useCallback(async (): Promise<void> => {
    if (!canModerate) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const speciesResponse = await cropSpeciesAPI.list({ status: 'proposed', include_proposed: true });
      setSpeciesProposals(speciesResponse.data.results);
      if (canManageRequests) {
        const requestsResponse = await publicLibraryModeratorRequestAPI.list({ status: 'pending' });
        setModeratorRequests(requestsResponse.data.results);
      } else {
        setModeratorRequests([]);
      }
      const removedResponse = await publicCropAPI.list({ status: 'removed' });
      setRemovedCrops(removedResponse.data.results);
    } catch {
      setError(t('library.moderation.loadError'));
    } finally {
      setLoading(false);
    }
  }, [canManageRequests, canModerate, t]);

  useEffect(() => {
    void loadQueues();
  }, [loadQueues]);

  const openSpeciesApproval = (proposal: CropSpecies): void => {
    setApprovalProposal(proposal);
    setApprovalTranslations(getInitialApprovalTranslations(proposal));
  };

  const closeSpeciesApproval = (): void => {
    if (busyAction !== null) return;
    setApprovalProposal(null);
  };

  const approveSpecies = async (): Promise<void> => {
    if (!approvalProposal) return;
    setBusyAction(`species-${approvalProposal.id}-approve`);
    try {
      await cropSpeciesAPI.approve(
        approvalProposal.id,
        '',
        REQUIRED_SPECIES_LANGUAGES.map((languageCode) => ({
          language_code: languageCode,
          common_name: approvalTranslations[languageCode].trim(),
        })),
      );
      showGlobalSnackbar({ message: t('library.moderation.species.approveSuccess'), severity: 'success' });
      setApprovalProposal(null);
      await loadQueues();
    } catch {
      showGlobalSnackbar({ message: t('library.moderation.actionError'), severity: 'error' });
    } finally {
      setBusyAction(null);
    }
  };

  const reviewSpecies = async (proposal: CropSpecies, action: 'reject'): Promise<void> => {
    setBusyAction(`species-${proposal.id}-${action}`);
    try {
      await cropSpeciesAPI.reject(proposal.id);
      showGlobalSnackbar({ message: t(`library.moderation.species.${action}Success`), severity: 'success' });
      await loadQueues();
    } catch {
      showGlobalSnackbar({ message: t('library.moderation.actionError'), severity: 'error' });
    } finally {
      setBusyAction(null);
    }
  };

  const canApproveSpecies = REQUIRED_SPECIES_LANGUAGES.every((languageCode) => approvalTranslations[languageCode].trim());

  const reviewModeratorRequest = async (request: PublicLibraryModeratorRequest, action: 'approve' | 'reject'): Promise<void> => {
    setBusyAction(`request-${request.id}-${action}`);
    try {
      if (action === 'approve') {
        await publicLibraryModeratorRequestAPI.approve(request.id);
      } else {
        await publicLibraryModeratorRequestAPI.reject(request.id);
      }
      showGlobalSnackbar({ message: t(`library.moderation.requests.${action}Success`), severity: 'success' });
      await loadQueues();
    } catch {
      showGlobalSnackbar({ message: t('library.moderation.actionError'), severity: 'error' });
    } finally {
      setBusyAction(null);
    }
  };

  const restoreCrop = async (crop: PublicCrop): Promise<void> => {
    const name = crop.variety ? `${crop.name} · ${crop.variety}` : crop.name;
    setBusyAction(`removed-${crop.id}-restore`);
    try {
      await publicCropAPI.restore(crop.id);
      showGlobalSnackbar({ message: t('library.moderation.removed.restoreSuccess', { name }), severity: 'success' });
      await loadQueues();
    } catch {
      showGlobalSnackbar({ message: t('library.moderation.removed.restoreError'), severity: 'error' });
    } finally {
      setBusyAction(null);
    }
  };

  if (!canModerate) {
    return (
      <PageContainer>
        <Alert severity="warning">{t('library.moderation.forbidden')}</Alert>
      </PageContainer>
    );
  }

  return (
    <PageContainer variant="wide">
      <Stack spacing={2.5}>
        <PageHeader title={t('library.moderation.title')} />
        {error ? <Alert severity="error">{error}</Alert> : null}
        {loading ? (
          <Box sx={{ minHeight: 240, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            <Paper variant="outlined" sx={{ p: { xs: 1.5, sm: 2 }, borderRadius: 1 }}>
              <Stack direction="row" spacing={1} sx={{ mb: 1.5,
                alignItems: "center", }}  >
                <GavelOutlinedIcon color="primary" />
                <Typography variant="h6">{t('library.moderation.species.title')}</Typography>
              </Stack>
              {speciesProposals.length === 0 ? (
                <Typography color="text.secondary">{t('library.moderation.species.empty')}</Typography>
              ) : (
                <TableContainer>
                  <Table size="small" aria-label={t('library.moderation.species.title')}>
                    <TableHead>
                      <TableRow>
                        <TableCell>{t('library.moderation.columns.name')}</TableCell>
                        <TableCell>{t('library.moderation.columns.proposer')}</TableCell>
                        <TableCell>{t('library.moderation.columns.similar')}</TableCell>
                        <TableCell align="right">{t('library.moderation.columns.actions')}</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {speciesProposals.map((proposal) => (
                        <TableRow key={proposal.id}>
                          <TableCell>{proposal.name}</TableCell>
                          <TableCell>{proposal.proposed_by_label || t('library.anonymousAuthor')}</TableCell>
                          <TableCell>
                            {(proposal.similar_species ?? []).length > 0
                              ? proposal.similar_species?.map((item) => <Chip key={item.id} size="small" label={item.name} sx={{ mr: 0.5, mb: 0.5 }} />)
                              : t('library.moderation.none')}
                          </TableCell>
                          <TableCell align="right">
                            <Stack direction="row" spacing={1} sx={{ justifyContent: "flex-end", }} >
                              <Button
                                size="small"
                                variant="contained"
                                startIcon={<CheckOutlinedIcon />}
                                disabled={busyAction !== null}
                                onClick={() => openSpeciesApproval(proposal)}
                              >
                                {busyAction === `species-${proposal.id}-approve` ? t('library.moderation.saving') : t('library.moderation.approve')}
                              </Button>
                              <Button
                                size="small"
                                variant="outlined"
                                color="error"
                                startIcon={<CloseOutlinedIcon />}
                                disabled={busyAction !== null}
                                onClick={() => void reviewSpecies(proposal, 'reject')}
                              >
                                {t('library.moderation.reject')}
                              </Button>
                            </Stack>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Paper>

            {canManageRequests ? (
              <Paper variant="outlined" sx={{ p: { xs: 1.5, sm: 2 }, borderRadius: 1 }}>
                <Typography variant="h6" sx={{ mb: 1.5 }}>{t('library.moderation.requests.title')}</Typography>
                {moderatorRequests.length === 0 ? (
                  <Typography color="text.secondary">{t('library.moderation.requests.empty')}</Typography>
                ) : (
                  <TableContainer>
                    <Table size="small" aria-label={t('library.moderation.requests.title')}>
                      <TableHead>
                        <TableRow>
                          <TableCell>{t('library.moderation.columns.user')}</TableCell>
                          <TableCell>{t('library.moderation.columns.motivation')}</TableCell>
                          <TableCell>{t('library.moderation.columns.date')}</TableCell>
                          <TableCell align="right">{t('library.moderation.columns.actions')}</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {moderatorRequests.map((request) => (
                          <TableRow key={request.id}>
                            <TableCell>{request.user_label}</TableCell>
                            <TableCell sx={{ maxWidth: 420, whiteSpace: 'pre-wrap' }}>{request.motivation}</TableCell>
                            <TableCell>{formatDate(request.created_at)}</TableCell>
                            <TableCell align="right">
                              <Stack direction="row" spacing={1} sx={{ justifyContent: "flex-end", }} >
                                <Button
                                  size="small"
                                  variant="contained"
                                  startIcon={<CheckOutlinedIcon />}
                                  disabled={busyAction !== null}
                                  onClick={() => void reviewModeratorRequest(request, 'approve')}
                                >
                                  {busyAction === `request-${request.id}-approve` ? t('library.moderation.saving') : t('library.moderation.approve')}
                                </Button>
                                <Button
                                  size="small"
                                  variant="outlined"
                                  color="error"
                                  startIcon={<CloseOutlinedIcon />}
                                  disabled={busyAction !== null}
                                  onClick={() => void reviewModeratorRequest(request, 'reject')}
                                >
                                  {t('library.moderation.reject')}
                                </Button>
                              </Stack>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </Paper>
            ) : null}

            <Paper variant="outlined" sx={{ p: { xs: 1.5, sm: 2 }, borderRadius: 1 }}>
              <Typography variant="h6" sx={{ mb: 1.5 }}>{t('library.moderation.removed.title')}</Typography>
              {removedCrops.length === 0 ? (
                <Typography color="text.secondary">{t('library.moderation.removed.empty')}</Typography>
              ) : (
                <TableContainer>
                  <Table size="small" aria-label={t('library.moderation.removed.title')}>
                    <TableHead>
                      <TableRow>
                        <TableCell>{t('library.moderation.columns.name')}</TableCell>
                        <TableCell>{t('library.moderation.removed.reason')}</TableCell>
                        <TableCell>{t('library.moderation.columns.date')}</TableCell>
                        <TableCell align="right">{t('library.moderation.columns.actions')}</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {removedCrops.map((crop) => (
                        <TableRow key={crop.id}>
                          <TableCell>{crop.variety ? `${crop.name} · ${crop.variety}` : crop.name}</TableCell>
                          <TableCell>
                            {crop.removal_reason ? t(`library.removeReasons.${crop.removal_reason}`) : t('library.moderation.none')}
                          </TableCell>
                          <TableCell>{formatDate(crop.updated_at)}</TableCell>
                          <TableCell align="right">
                            <Stack direction="row" spacing={1} sx={{ justifyContent: "flex-end", }} >
                              <Button
                                size="small"
                                variant="contained"
                                startIcon={<RestoreOutlinedIcon />}
                                disabled={busyAction !== null}
                                onClick={() => void restoreCrop(crop)}
                              >
                                {busyAction === `removed-${crop.id}-restore` ? t('library.moderation.saving') : t('library.moderation.removed.restore')}
                              </Button>
                            </Stack>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Paper>
          </>
        )}
      </Stack>
      <Dialog open={Boolean(approvalProposal)} onClose={closeSpeciesApproval} maxWidth="sm" fullWidth>
        <DialogTitle>{t('library.moderation.species.approveDialogTitle')}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ pt: 0.5 }}>
            <Typography variant="body2" color="text.secondary">
              {t('library.moderation.species.approveDialogIntro', { name: approvalProposal?.name ?? '' })}
            </Typography>
            <TextField
              label={t('library.moderation.species.germanName')}
              value={approvalTranslations.de}
              required
              fullWidth
              onChange={(event) => setApprovalTranslations((previous) => ({ ...previous, de: event.target.value }))}
            />
            <TextField
              label={t('library.moderation.species.englishName')}
              value={approvalTranslations.en}
              required
              fullWidth
              onChange={(event) => setApprovalTranslations((previous) => ({ ...previous, en: event.target.value }))}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={closeSpeciesApproval} variant="outlined">{t('library.moderation.cancel')}</Button>
          <Button
            onClick={() => void approveSpecies()}
            variant="contained"
            disabled={!canApproveSpecies || busyAction !== null}
          >
            {busyAction === `species-${approvalProposal?.id}-approve`
              ? t('library.moderation.saving')
              : t('library.moderation.approve')}
          </Button>
        </DialogActions>
      </Dialog>
    </PageContainer>
  );
}
