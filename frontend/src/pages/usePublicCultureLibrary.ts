import { useState, useCallback, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router';
import axios from 'axios';
import { cultureAPI, publicCultureAPI } from '../api/api';
import type { Culture } from '../api/api';
import type { PublicCulture, PublishPublicCultureDuplicateError } from '../api/types';
import { useTranslation } from '../i18n';
import { useAuth } from '../auth/useAuth';
import { extractApiErrorMessage } from '../api/errors';
import { dedupePublicCultures } from './publicCultureUtils';

interface UsePublicCultureLibraryConfig {
  shouldShowProjectRequiredState: boolean;
  selectedCulture: Culture | undefined;
  onImportSuccess: (cultureId: number) => Promise<void>;
  onClearForm: () => void;
  showSnackbar: (message: string, severity: 'success' | 'error' | 'info') => void;
}

export function usePublicCultureLibrary({
  shouldShowProjectRequiredState,
  selectedCulture,
  onImportSuccess,
  onClearForm,
  showSnackbar,
}: UsePublicCultureLibraryConfig) {
  const { t } = useTranslation(['cultures', 'common']);
  const { refreshUser } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [publicLibraryOpen, setPublicLibraryOpen] = useState(false);
  const [publicLibraryLoading, setPublicLibraryLoading] = useState(false);
  const [publicLibraryError, setPublicLibraryError] = useState<string | null>(null);
  const [publicCultures, setPublicCultures] = useState<PublicCulture[]>([]);
  const [publicLibraryImportingId, setPublicLibraryImportingId] = useState<number | null>(null);
  const [publicLibraryInitialSelectedId, setPublicLibraryInitialSelectedId] = useState<number | null>(null);
  const [publicLibraryInitialQuery, setPublicLibraryInitialQuery] = useState('');
  const [publishingCultureId, setPublishingCultureId] = useState<number | null>(null);

  const fetchPublicCultures = useCallback(async (
    query = '',
    exactMatch?: { name: string; variety?: string },
  ) => {
    try {
      setPublicLibraryLoading(true);
      setPublicLibraryError(null);
      const params = exactMatch
        ? { name: exactMatch.name, variety: exactMatch.variety || '' }
        : query ? { q: query } : undefined;
      const response = await publicCultureAPI.list(params);
      setPublicCultures(dedupePublicCultures(response.data.results));
    } catch (error) {
      console.error('Error fetching public cultures:', error);
      setPublicLibraryError(t('library.loadError'));
    } finally {
      setPublicLibraryLoading(false);
    }
  }, [t]);

  const handleOpenPublicLibrary = useCallback(async () => {
    setPublicLibraryInitialSelectedId(null);
    setPublicLibraryInitialQuery('');
    setPublicLibraryOpen(true);
    await fetchPublicCultures();
  }, [fetchPublicCultures]);

  const handleViewPublicLibraryMatch = useCallback(async (match: Pick<PublicCulture, 'id' | 'name' | 'variety'>) => {
    onClearForm();
    setPublicLibraryInitialSelectedId(match.id);
    setPublicLibraryInitialQuery(`${match.name} ${match.variety || ''}`.trim());
    setPublicLibraryOpen(true);
    await fetchPublicCultures('', { name: match.name, variety: match.variety });
  }, [fetchPublicCultures, onClearForm]);

  const handleImportPublicCulture = async (publicCulture: PublicCulture) => {
    try {
      setPublicLibraryImportingId(publicCulture.id);
      const response = await publicCultureAPI.importToProject(publicCulture.id);
      await onImportSuccess(response.data.id!);
      setPublicLibraryOpen(false);
      showSnackbar(t('library.importSuccess', { name: publicCulture.name }), 'success');
    } catch (error) {
      console.error('Error importing public culture:', error);
      setPublicLibraryError(extractApiErrorMessage(error, t, t('library.importError')));
    } finally {
      setPublicLibraryImportingId(null);
    }
  };

  const handlePublishCurrentCulture = async (acceptedPublicLibraryTerms = false): Promise<boolean> => {
    if (!selectedCulture?.id) {
      return false;
    }

    try {
      setPublishingCultureId(selectedCulture.id);
      const response = await cultureAPI.publishPublic(selectedCulture.id, {
        accepted_public_library_terms: acceptedPublicLibraryTerms,
      });
      if (response.data.operation === 'updated') {
        showSnackbar(t('library.updateSuccess', { name: selectedCulture.name }), 'success');
      } else {
        showSnackbar(t('library.publishSuccess', { name: selectedCulture.name }), 'success');
      }
      if (acceptedPublicLibraryTerms) {
        await refreshUser();
      }
      return true;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 409) {
        const duplicateError = error.response.data as PublishPublicCultureDuplicateError | undefined;
        const duplicateNames = (duplicateError?.duplicates || [])
          .map((entry) => entry.variety ? `${entry.name} (${entry.variety})` : entry.name)
          .join(', ');
        if (duplicateNames) {
          showSnackbar(t('library.publishDuplicateErrorWithCandidates', { duplicates: duplicateNames }), 'info');
        } else {
          showSnackbar(t('library.publishDuplicateError'), 'info');
        }
        return false;
      }
      console.error('Error publishing culture:', error);
      showSnackbar(extractApiErrorMessage(error, t, t('library.publishError')), 'error');
      return false;
    } finally {
      setPublishingCultureId(null);
    }
  };

  useEffect(() => {
    if (shouldShowProjectRequiredState || publicLibraryOpen) {
      return;
    }
    const searchParams = new URLSearchParams(location.search);
    if (searchParams.get('library') !== 'true') {
      return;
    }

    void handleOpenPublicLibrary();
    searchParams.delete('library');
    const nextSearch = searchParams.toString();
    navigate(
      {
        pathname: location.pathname,
        search: nextSearch ? `?${nextSearch}` : '',
      },
      { replace: true },
    );
  }, [handleOpenPublicLibrary, location.pathname, location.search, navigate, publicLibraryOpen, shouldShowProjectRequiredState]);

  return {
    publicLibraryOpen,
    setPublicLibraryOpen,
    publicLibraryLoading,
    publicLibraryError,
    publicCultures,
    publicLibraryImportingId,
    publicLibraryInitialSelectedId,
    publicLibraryInitialQuery,
    publishingCultureId,
    isUpdatingOwnPublicCulture: Boolean(selectedCulture?.owned_public_culture_id),
    fetchPublicCultures,
    handleOpenPublicLibrary,
    handleViewPublicLibraryMatch,
    handleImportPublicCulture,
    handlePublishCurrentCulture,
  };
}
