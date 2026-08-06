import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import CheckOutlinedIcon from '@mui/icons-material/CheckOutlined';
import CloseOutlinedIcon from '@mui/icons-material/CloseOutlined';
import GavelOutlinedIcon from '@mui/icons-material/GavelOutlined';
import RestoreOutlinedIcon from '@mui/icons-material/RestoreOutlined';
import { cropSpeciesAPI, publicCultureAPI, publicLibraryModeratorRequestAPI } from '../../api/api';
import type { CropSpecies, PublicCulture, PublicLibraryModeratorRequest } from '../../api/types';
import { useAuth } from '../../auth/useAuth';
import PageContainer from '../../components/layout/PageContainer';
import PageHeader from '../../components/layout/PageHeader';
import { useTranslation } from '../../i18n';
import { showGlobalSnackbar } from '../../utils/globalSnackbar';

export default function PublicLibraryModerationPage() {
  const { user } = useAuth();
  const { t, i18n } = useTranslation('cultures');
  const [speciesProposals, setSpeciesProposals] = useState<CropSpecies[]>([]);
  const [moderatorRequests, setModeratorRequests] = useState<PublicLibraryModeratorRequest[]>([]);
  const [removedCultures, setRemovedCultures] = useState<PublicCulture[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const canModerate = Boolean(user?.is_public_library_moderator || user?.is_staff || user?.is_superuser);
  const canManageRequests = Boolean(user?.is_staff || user?.is_superuser);
  const locale = i18n.resolvedLanguage === 'de' ? 'de-DE' : 'en-US';

  const formatDate = (value?: string | null): string => {
    if (!value) {
      return t('library.moderation.unknownDate');
    }
    return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(value));
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
      const removedResponse = await publicCultureAPI.list({ status: 'removed' });
      setRemovedCultures(removedResponse.data.results);
    } catch {
      setError(t('library.moderation.loadError'));
    } finally {
      setLoading(false);
    }
  }, [canManageRequests, canModerate, t]);

  useEffect(() => {
    void loadQueues();
  }, [loadQueues]);

  const reviewSpecies = async (proposal: CropSpecies, action: 'approve' | 'reject'): Promise<void> => {
    setBusyAction(`species-${proposal.id}-${action}`);
    try {
      if (action === 'approve') {
        await cropSpeciesAPI.approve(proposal.id);
      } else {
        await cropSpeciesAPI.reject(proposal.id);
      }
      showGlobalSnackbar({ message: t(`library.moderation.species.${action}Success`), severity: 'success' });
      await loadQueues();
    } catch {
      showGlobalSnackbar({ message: t('library.moderation.actionError'), severity: 'error' });
    } finally {
      setBusyAction(null);
    }
  };

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

  const restoreCulture = async (culture: PublicCulture): Promise<void> => {
    const name = culture.variety ? `${culture.name} · ${culture.variety}` : culture.name;
    setBusyAction(`removed-${culture.id}-restore`);
    try {
      await publicCultureAPI.restore(culture.id);
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
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
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
                            <Stack direction="row" spacing={1} justifyContent="flex-end">
                              <Button
                                size="small"
                                variant="contained"
                                startIcon={<CheckOutlinedIcon />}
                                disabled={busyAction !== null}
                                onClick={() => void reviewSpecies(proposal, 'approve')}
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
                              <Stack direction="row" spacing={1} justifyContent="flex-end">
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
              {removedCultures.length === 0 ? (
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
                      {removedCultures.map((culture) => (
                        <TableRow key={culture.id}>
                          <TableCell>{culture.variety ? `${culture.name} · ${culture.variety}` : culture.name}</TableCell>
                          <TableCell>
                            {culture.removal_reason ? t(`library.removeReasons.${culture.removal_reason}`) : t('library.moderation.none')}
                          </TableCell>
                          <TableCell>{formatDate(culture.updated_at)}</TableCell>
                          <TableCell align="right">
                            <Stack direction="row" spacing={1} justifyContent="flex-end">
                              <Button
                                size="small"
                                variant="contained"
                                startIcon={<RestoreOutlinedIcon />}
                                disabled={busyAction !== null}
                                onClick={() => void restoreCulture(culture)}
                              >
                                {busyAction === `removed-${culture.id}-restore` ? t('library.moderation.saving') : t('library.moderation.removed.restore')}
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
    </PageContainer>
  );
}
