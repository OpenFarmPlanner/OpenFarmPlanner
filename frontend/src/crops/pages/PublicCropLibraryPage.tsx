import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Stack,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
  useMediaQuery,
} from '@mui/material';
import DownloadOutlinedIcon from '@mui/icons-material/DownloadOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import ForumOutlinedIcon from '@mui/icons-material/ForumOutlined';
import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined';
import RestoreOutlinedIcon from '@mui/icons-material/RestoreOutlined';
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined';
import SpaOutlinedIcon from '@mui/icons-material/SpaOutlined';
import { publicCultureAPI } from '../../api/api';
import type {
  Culture,
  PublicCulture,
  PublicCultureDiscussionComment,
  PublicCultureDiscussionTopic,
  PublicCultureRevision,
} from '../../api/types';
import PageContainer from '../../components/layout/PageContainer';
import PageHeader from '../../components/layout/PageHeader';
import PageHelp from '../../components/help/PageHelp';
import { useTranslation } from '../../i18n';
import { showGlobalSnackbar } from '../../utils/globalSnackbar';
import { stripCitationMarkers } from '../../components/data-grid/markdown';
import { useCultureListKeyboardNavigation } from '../../cultures/useCultureListKeyboardNavigation';
import { CultureForm } from '../../cultures/CultureForm';
import {
  buildPublicCultureUpdatePayload,
  publicCultureToCultureFormData,
} from '../../cultures/publicCultureFormAdapter';
import { useCommandContextTag, useRegisterCommands } from '../../commands/useCommandContext';
import { createPublicCropLibraryCommandSpecs } from '../publicCropLibraryCommandSpecs';

type CollaborationLoadStatus = 'idle' | 'loading' | 'success' | 'error';

const SELECTED_PUBLIC_CULTURE_STORAGE_KEY = 'selectedPublicCultureId';

function parsePublicCultureId(value: string | null): number | null {
  if (!value) {
    return null;
  }
  const parsedId = Number.parseInt(value, 10);
  return Number.isFinite(parsedId) ? parsedId : null;
}

function getStoredPublicCultureId(): number | null {
  return parsePublicCultureId(window.localStorage.getItem(SELECTED_PUBLIC_CULTURE_STORAGE_KEY));
}

const getCultureTitle = (culture: PublicCulture): string => (
  culture.variety ? `${culture.name} (${culture.variety})` : culture.name
);

function formatLocalizedNumber(value: number | string | null | undefined, locale: string, fallback: string, options?: Intl.NumberFormatOptions): string {
  if (value === null || value === undefined || value === '') {
    return fallback;
  }
  const numericValue = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numericValue)) {
    return fallback;
  }
  return new Intl.NumberFormat(locale, options).format(numericValue);
}

function formatDays(value: number | null | undefined, locale: string, fallback: string, dayLabel: string): string {
  return value === null || value === undefined
    ? fallback
    : `${formatLocalizedNumber(value, locale, fallback)} ${dayLabel}`;
}

function formatMetersAsCentimeters(value: number | null | undefined, locale: string, fallback: string): string {
  return value === null || value === undefined
    ? fallback
    : `${formatLocalizedNumber(value * 100, locale, fallback, { maximumFractionDigits: 1 })} cm`;
}

function formatPercent(value: number | null | undefined, locale: string, fallback: string): string {
  return value === null || value === undefined
    ? fallback
    : `${formatLocalizedNumber(value, locale, fallback, { maximumFractionDigits: 1 })} %`;
}

function formatSeedUnit(unit: string | null | undefined, t: (key: string, options?: Record<string, unknown>) => string): string {
  if (!unit) {
    return '';
  }
  return t(`library.page.seedUnits.${unit}`, { defaultValue: unit });
}

function formatSeedRate(
  value: number | null | undefined,
  unit: string | null | undefined,
  locale: string,
  fallback: string,
  t: (key: string, options?: Record<string, unknown>) => string,
): string {
  if (value === null || value === undefined || !unit) {
    return fallback;
  }
  return `${formatLocalizedNumber(value, locale, fallback, { maximumFractionDigits: 2 })} ${formatSeedUnit(unit, t)}`;
}

function getCultivationTypeLabel(
  value: PublicCulture['cultivation_type'],
  t: (key: string, options?: Record<string, unknown>) => string,
  fallback: string,
): string {
  if (value === 'direct_sowing') {
    return t('library.page.fields.cultivationTypes.directSowing');
  }
  if (value === 'pre_cultivation') {
    return t('library.page.fields.cultivationTypes.preCultivation');
  }
  return fallback;
}

function getNutrientDemandLabel(
  value: PublicCulture['nutrient_demand'],
  t: (key: string, options?: Record<string, unknown>) => string,
  fallback: string,
): string {
  if (value === 'low' || value === 'medium' || value === 'high') {
    return t(`library.page.fields.nutrientDemandValues.${value}`);
  }
  return fallback;
}

function getCultivationTypesLabel(
  culture: PublicCulture,
  t: (key: string, options?: Record<string, unknown>) => string,
  fallback: string,
): string {
  const values = culture.cultivation_types?.length
    ? culture.cultivation_types
    : culture.cultivation_type ? [culture.cultivation_type] : [];
  const labels = values
    .map((value) => getCultivationTypeLabel(value, t, ''))
    .filter(Boolean);
  return labels.length > 0 ? labels.join(', ') : fallback;
}

function getHarvestMethodLabel(
  value: PublicCulture['harvest_method'],
  t: (key: string, options?: Record<string, unknown>) => string,
  fallback: string,
): string {
  if (value === 'per_plant') {
    return t('library.page.harvestMethods.perPlant');
  }
  if (value === 'per_sqm') {
    return t('library.page.harvestMethods.perSqm');
  }
  return fallback;
}

function getSeedingRequirementTypeLabel(value: PublicCulture['seeding_requirement_type'], t: (key: string, options?: Record<string, unknown>) => string): string {
  if (value === 'per_sqm') {
    return t('library.page.seedingRequirementTypes.perSqm');
  }
  if (value === 'per_plant') {
    return t('library.page.seedingRequirementTypes.perPlant');
  }
  return '';
}

function getPublicCultureStatusLabel(status: PublicCulture['status'], t: (key: string, options?: Record<string, unknown>) => string): string {
  return t(`library.page.statusValues.${status}`);
}

function getLanguageLabel(code: string | null | undefined, t: (key: string, options?: Record<string, unknown>) => string, fallback: string): string {
  if (!code) {
    return fallback;
  }
  return t(`library.publishWizard.languages.${code}`, { defaultValue: code });
}

function formatSeedPackages(
  culture: PublicCulture,
  locale: string,
  fallback: string,
  t: (key: string, options?: Record<string, unknown>) => string,
): string {
  const packages = culture.seed_packages ?? [];
  if (packages.length === 0) {
    return fallback;
  }
  return packages
    .map((entry) => `${formatLocalizedNumber(entry.size_value, locale, fallback, { maximumFractionDigits: 1 })} ${t(`library.page.packageUnits.${entry.size_unit}`, { defaultValue: entry.size_unit })}`)
    .join(', ');
}

function formatSeedRateByCultivation(
  culture: PublicCulture,
  locale: string,
  fallback: string,
  t: (key: string, options?: Record<string, unknown>) => string,
): string {
  const entries = Object.entries(culture.seed_rate_by_cultivation ?? {});
  if (entries.length === 0) {
    return fallback;
  }
  return entries
    .map(([type, rate]) => {
      const methodLabel = type === 'pre_cultivation'
        ? t('library.page.fields.cultivationTypes.preCultivation')
        : t('library.page.fields.cultivationTypes.directSowing');
      return `${methodLabel}: ${formatSeedRate(rate?.value, rate?.unit, locale, fallback, t)}`;
    })
    .join(', ');
}

function getPublicCultureFieldLabel(field: string, t: (key: string, options?: Record<string, unknown>) => string): string {
  const fieldLabelKeys: Partial<Record<string, string>> = {
    name: 'library.page.fields.cropSpecies',
    variety: 'library.page.fields.variety',
    notes: 'library.page.fields.notes',
    growth_duration_days: 'library.page.fields.growthDurationDays',
    harvest_duration_days: 'library.page.fields.harvestDurationDays',
    propagation_duration_days: 'library.page.fields.propagationDurationDays',
  };
  const key = fieldLabelKeys[field];
  if (key) {
    return t(key);
  }
  return field;
}

function getRevisionValueLabel(value: unknown, fallback: string): string {
  if (value === null || value === undefined || value === '') {
    return fallback;
  }
  if (Array.isArray(value)) {
    return value.join(', ');
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
}

interface DetailRowProps {
  label: string;
  value: string;
}

function DetailRow({ label, value }: DetailRowProps) {
  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ display: 'block' }}>
        {label}
      </Typography>
      <Typography variant="body1" sx={{ overflowWrap: 'anywhere' }}>
        {value}
      </Typography>
    </Box>
  );
}

interface DetailSectionProps {
  title: string;
  children: ReactNode;
  outlined?: boolean;
}

function DetailSection({ title, children, outlined = false }: DetailSectionProps) {
  return (
    <Box sx={outlined ? { p: { xs: 1.25, sm: 2 }, border: '1px solid', borderColor: 'divider', borderRadius: 2 } : undefined}>
      <Typography variant="h6" gutterBottom>
        {title}
      </Typography>
      {children}
    </Box>
  );
}

function DetailGrid({ children }: { children: ReactNode }) {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' }, gap: 2 }}>
      {children}
    </Box>
  );
}

interface VersionCardProps {
  revision: PublicCultureRevision;
  currentVersion: number;
  anonymousLabel: string;
  formatDate: (value?: string | null) => string;
  onRevert: (version: number) => Promise<void>;
  revertingVersion: number | null;
  t: (key: string, options?: Record<string, unknown>) => string;
  onDiscuss: (revision: PublicCultureRevision) => void;
}

function VersionCard({
  revision,
  currentVersion,
  anonymousLabel,
  formatDate,
  onRevert,
  revertingVersion,
  t,
  onDiscuss,
}: VersionCardProps) {
  const isCurrentVersion = revision.version === currentVersion;
  const changedFields = revision.changed_fields ?? [];

  return (
    <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 1.5 }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ xs: 'flex-start', sm: 'center' }} justifyContent="space-between">
        <Box>
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
            {t('library.page.versions.versionTitle', { version: revision.version })}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {t('library.page.metaByDate', {
              author: revision.created_by_label || anonymousLabel,
              date: formatDate(revision.created_at),
            })}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} alignItems="center">
          {revision.action === 'restored' && revision.restored_from_version ? (
            <Chip size="small" label={t('library.page.versions.restoredFrom', { version: revision.restored_from_version })} variant="outlined" />
          ) : null}
          <Chip
            size="small"
            label={isCurrentVersion ? t('library.page.versions.current') : t(`library.page.versions.actions.${revision.action}`)}
            color={isCurrentVersion ? 'success' : 'default'}
          />
        </Stack>
      </Stack>
      {changedFields.length > 0 ? (
        <Stack spacing={0.75} sx={{ mt: 1.25 }}>
          {changedFields.map((change) => (
            <Box key={change.field}>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                {getPublicCultureFieldLabel(change.field, t)}
              </Typography>
              <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                {getRevisionValueLabel(change.old_value, t('library.page.notSpecified'))}
                {' → '}
                {getRevisionValueLabel(change.new_value, t('library.page.notSpecified'))}
              </Typography>
            </Box>
          ))}
        </Stack>
      ) : (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1.25 }}>
          {t('library.page.versions.noFieldChanges')}
        </Typography>
      )}
      {!isCurrentVersion ? (
        <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
          <Button
            size="small"
            variant="outlined"
            startIcon={<RestoreOutlinedIcon />}
            disabled={revertingVersion !== null}
            onClick={() => void onRevert(revision.version)}
          >
            {revertingVersion === revision.version ? t('library.page.versions.reverting') : t('library.page.versions.revert')}
          </Button>
          <Button size="small" variant="text" startIcon={<ForumOutlinedIcon />} onClick={() => onDiscuss(revision)}>
            {t('library.page.versions.discuss')}
          </Button>
        </Stack>
      ) : null}
    </Box>
  );
}

export default function PublicCropLibraryPage() {
  const { t, i18n } = useTranslation('cultures');
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const selectedCultureParam = searchParams.get('cultureId');
  const selectedCultureIdFromUrl = parsePublicCultureId(selectedCultureParam);
  const [query, setQuery] = useState('');
  const [cultures, setCultures] = useState<PublicCulture[]>([]);
  const [selectedCultureId, setSelectedCultureId] = useState<number | null>(() => selectedCultureIdFromUrl ?? getStoredPublicCultureId());
  const selectedCultureIdRef = useRef<number | null>(selectedCultureId);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [activeTab, setActiveTab] = useState(0);
  const [topics, setTopics] = useState<PublicCultureDiscussionTopic[]>([]);
  const [comments, setComments] = useState<PublicCultureDiscussionComment[]>([]);
  const [selectedTopicId, setSelectedTopicId] = useState<number | null>(null);
  const [versions, setVersions] = useState<PublicCultureRevision[]>([]);
  const [collaborationStatus, setCollaborationStatus] = useState<CollaborationLoadStatus>('idle');
  const [newTopicOpen, setNewTopicOpen] = useState(false);
  const [topicTitle, setTopicTitle] = useState('');
  const [commentBody, setCommentBody] = useState('');
  const [topicRevision, setTopicRevision] = useState<number | undefined>();
  const [replyTo, setReplyTo] = useState<number | null>(null);
  const [editingCommentId, setEditingCommentId] = useState<number | null>(null);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [importingId, setImportingId] = useState<number | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [revertingVersion, setRevertingVersion] = useState<number | null>(null);
  const isMobile = useMediaQuery('(max-width:600px)');
  const searchInputRef = useRef<HTMLInputElement>(null);

  const focusSearch = useCallback(() => {
    searchInputRef.current?.focus();
    searchInputRef.current?.select();
  }, []);

  const locale = i18n.resolvedLanguage === 'de' ? 'de-DE' : 'en-US';
  const anonymousLabel = t('library.anonymousAuthor');

  const replaceSelectedCultureSearchParam = useCallback((cultureId: number | null): void => {
    const nextParams = new URLSearchParams(location.search);
    if (cultureId === null) {
      nextParams.delete('cultureId');
    } else {
      nextParams.set('cultureId', String(cultureId));
    }
    const nextSearch = nextParams.toString();
    const currentSearch = location.search.startsWith('?') ? location.search.slice(1) : location.search;
    if (nextSearch === currentSearch) {
      return;
    }
    navigate(
      {
        pathname: location.pathname,
        search: nextSearch ? `?${nextSearch}` : '',
        hash: location.hash,
      },
      { replace: true },
    );
  }, [location.hash, location.pathname, location.search, navigate]);

  const updateSelectedCultureId = useCallback((cultureId: number | null): void => {
    setSelectedCultureId(cultureId);
    selectedCultureIdRef.current = cultureId;
    if (cultureId === null) {
      window.localStorage.removeItem(SELECTED_PUBLIC_CULTURE_STORAGE_KEY);
    } else {
      window.localStorage.setItem(SELECTED_PUBLIC_CULTURE_STORAGE_KEY, String(cultureId));
    }
    replaceSelectedCultureSearchParam(cultureId);
  }, [replaceSelectedCultureSearchParam]);

  const formatDate = useCallback((value?: string | null): string => {
    if (!value) {
      return t('library.page.unknownDate');
    }
    return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(value));
  }, [locale, t]);

  const selectedCulture = useMemo(
    () => cultures.find((culture) => culture.id === selectedCultureId) ?? null,
    [cultures, selectedCultureId],
  );

  const cultureListNavigation = useCultureListKeyboardNavigation({
    items: cultures,
    selectedId: selectedCultureId,
    getId: (culture) => culture.id,
    onSelect: (culture) => updateSelectedCultureId(culture.id),
  });

  const goToRelativeCulture = useCallback((direction: 'next' | 'previous') => {
    if (selectedCultureId === null || cultures.length === 0) {
      return;
    }

    const currentIndex = cultures.findIndex((culture) => culture.id === selectedCultureId);
    if (currentIndex === -1) {
      return;
    }

    const delta = direction === 'next' ? 1 : -1;
    const nextIndex = (currentIndex + delta + cultures.length) % cultures.length;
    const nextCulture = cultures[nextIndex];
    if (nextCulture) {
      updateSelectedCultureId(nextCulture.id);
    }
  }, [cultures, selectedCultureId, updateSelectedCultureId]);

  useCommandContextTag('publicCropLibrary');

  useEffect(() => {
    selectedCultureIdRef.current = selectedCultureId;
  }, [selectedCultureId]);

  useEffect(() => {
    if (selectedCultureIdFromUrl !== null) {
      if (selectedCultureId !== selectedCultureIdFromUrl) {
        setSelectedCultureId(selectedCultureIdFromUrl);
        selectedCultureIdRef.current = selectedCultureIdFromUrl;
        window.localStorage.setItem(SELECTED_PUBLIC_CULTURE_STORAGE_KEY, String(selectedCultureIdFromUrl));
      }
      return;
    }

    const storedCultureId = getStoredPublicCultureId();
    if (storedCultureId !== null) {
      if (selectedCultureId !== storedCultureId) {
        setSelectedCultureId(storedCultureId);
        selectedCultureIdRef.current = storedCultureId;
      }
      replaceSelectedCultureSearchParam(storedCultureId);
    }
  }, [replaceSelectedCultureSearchParam, selectedCultureId, selectedCultureIdFromUrl]);

  const loadCultures = useCallback(async (searchQuery: string): Promise<void> => {
    setLoading(true);
    setLoadError('');
    try {
      const response = await publicCultureAPI.list(searchQuery.trim() ? { q: searchQuery.trim() } : undefined);
      let results = response.data.results;
      const currentSelectedCultureId = selectedCultureIdRef.current;
      if (currentSelectedCultureId !== null && !results.some((culture) => culture.id === currentSelectedCultureId)) {
        try {
          const selectedCultureResponse = await publicCultureAPI.get(currentSelectedCultureId);
          results = [selectedCultureResponse.data, ...results];
        } catch {
          updateSelectedCultureId(null);
        }
      }
      setCultures(results);
    } catch {
      setLoadError(t('library.loadError'));
      setCultures([]);
      updateSelectedCultureId(null);
    } finally {
      setLoading(false);
    }
  }, [t, updateSelectedCultureId]);

  const loadCollaboration = useCallback(async (cultureId: number): Promise<void> => {
    setCollaborationStatus('loading');
    try {
      const [topicsResponse, versionsResponse] = await Promise.all([
        publicCultureAPI.discussionTopics(cultureId),
        publicCultureAPI.versions(cultureId),
      ]);
      setTopics(topicsResponse.data);
      setComments([]);
      setSelectedTopicId(null);
      setVersions(versionsResponse.data);
      setCollaborationStatus('success');
    } catch {
      setComments([]);
      setTopics([]);
      setVersions([]);
      setCollaborationStatus('error');
    }
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadCultures(query);
    }, query.trim() ? 250 : 0);
    return () => window.clearTimeout(timeout);
  }, [loadCultures, query]);

  useEffect(() => {
    if (selectedCultureId === null) {
      setComments([]);
      setVersions([]);
      setCollaborationStatus('idle');
      return;
    }
    void loadCollaboration(selectedCultureId);
  }, [loadCollaboration, selectedCultureId]);

  useEffect(() => {
    setCommentBody('');
    setTopicTitle('');
    setNewTopicOpen(false);
    setEditDialogOpen(false);
  }, [selectedCultureId]);

  const handleSearchSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    void loadCultures(query);
  };

  const handleImport = useCallback(async (): Promise<void> => {
    if (!selectedCulture) {
      return;
    }
    setImportingId(selectedCulture.id);
    try {
      await publicCultureAPI.importToProject(selectedCulture.id);
      showGlobalSnackbar({ message: t('library.importSuccess', { name: getCultureTitle(selectedCulture) }), severity: 'success' });
    } catch {
      showGlobalSnackbar({ message: t('library.importError'), severity: 'error' });
    } finally {
      setImportingId(null);
    }
  }, [selectedCulture, t]);

  const openEditDialog = useCallback((): void => {
    if (!selectedCulture) {
      return;
    }
    setEditDialogOpen(true);
  }, [selectedCulture]);

  const closeEditDialog = (): void => {
    setEditDialogOpen(false);
  };

  const commandSpecs = useMemo(() => createPublicCropLibraryCommandSpecs({
    cultures,
    focusSearch,
    goToRelativeCulture,
    handleImport: () => void handleImport(),
    openEditDialog,
    selectedCulture,
    importing: importingId !== null,
  }), [cultures, focusSearch, goToRelativeCulture, handleImport, importingId, openEditDialog, selectedCulture]);

  useRegisterCommands('public-crop-library-page', commandSpecs);

  const upsertCultureInList = (updatedCulture: PublicCulture): void => {
    setCultures((current) => {
      const existingIndex = current.findIndex((culture) => culture.id === updatedCulture.id);
      if (existingIndex === -1) {
        return [updatedCulture, ...current];
      }
      const next = [...current];
      next[existingIndex] = updatedCulture;
      return next;
    });
  };

  const handleEditSave = async (draft: Culture): Promise<void> => {
    if (!selectedCulture) {
      return;
    }
    try {
      const response = await publicCultureAPI.update(
        selectedCulture.id,
        buildPublicCultureUpdatePayload(draft, selectedCulture.version),
      );
      upsertCultureInList(response.data);
      setEditDialogOpen(false);
      await loadCollaboration(response.data.id);
      showGlobalSnackbar({ message: t('library.page.edit.success'), severity: 'success' });
    } catch {
      showGlobalSnackbar({ message: t('library.page.edit.error'), severity: 'error' });
    }
  };

  const handleRevertVersion = async (version: number): Promise<void> => {
    if (!selectedCulture) {
      return;
    }
    setRevertingVersion(version);
    try {
      const response = await publicCultureAPI.revert(selectedCulture.id, {
        version,
        base_version: selectedCulture.version,
      });
      upsertCultureInList(response.data);
      await loadCollaboration(response.data.id);
      showGlobalSnackbar({ message: t('library.page.versions.revertSuccess'), severity: 'success' });
    } catch {
      showGlobalSnackbar({ message: t('library.page.versions.revertError'), severity: 'error' });
    } finally {
      setRevertingVersion(null);
    }
  };

  const handleCommentSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!selectedCulture || !commentBody.trim() || (!selectedTopicId && !topicTitle.trim())) {
      return;
    }
    setSubmittingComment(true);
    try {
      if (selectedTopicId) {
        if (editingCommentId) {
          await publicCultureAPI.updateDiscussionComment(selectedCulture.id, editingCommentId, commentBody.trim());
        } else {
          await publicCultureAPI.createDiscussionComment(selectedCulture.id, selectedTopicId, commentBody.trim(), replyTo ?? undefined);
        }
        const response = await publicCultureAPI.discussionComments(selectedCulture.id, selectedTopicId);
        setComments(response.data);
      } else {
        await publicCultureAPI.createDiscussionTopic(selectedCulture.id, { title: topicTitle.trim(), body: commentBody.trim(), revision: topicRevision });
        await loadCollaboration(selectedCulture.id);
        setNewTopicOpen(false);
        setTopicTitle('');
      }
      setCommentBody('');
      setReplyTo(null);
      setEditingCommentId(null);
      showGlobalSnackbar({ message: t('library.page.discussion.commentSuccess'), severity: 'success' });
    } catch {
      showGlobalSnackbar({ message: t('library.page.discussion.commentError'), severity: 'error' });
    } finally {
      setSubmittingComment(false);
    }
  };

  const openTopic = async (topicId: number): Promise<void> => {
    if (!selectedCulture) return;
    setSelectedTopicId(topicId);
    const response = await publicCultureAPI.discussionComments(selectedCulture.id, topicId);
    setComments(response.data);
  };

  const startDiscussionForVersion = (revision: PublicCultureRevision): void => {
    setActiveTab(2);
    setSelectedTopicId(null);
    setNewTopicOpen(true);
    setTopicRevision(revision.id);
  };

  const deleteComment = async (commentId: number): Promise<void> => {
    if (!selectedCulture || !selectedTopicId) return;
    await publicCultureAPI.deleteDiscussionComment(selectedCulture.id, commentId);
    const response = await publicCultureAPI.discussionComments(selectedCulture.id, selectedTopicId);
    setComments(response.data);
  };

  const libraryCardSx = {
    borderRadius: 1,
    border: '1px solid',
    borderColor: 'divider',
    boxShadow: '0 8px 24px rgba(15, 23, 42, 0.08)',
    overflow: 'hidden',
    bgcolor: 'background.paper',
  } as const;

  return (
    <PageContainer variant="xwide">
      <Box sx={{ width: '100%' }}>
        <Stack spacing={2}>
          <PageHeader
            title={t('library.page.title')}
            help={<PageHelp pageKey="cropLibrary" ariaLabel={t('library.page.help.openAria')} tooltip={t('library.page.help.tooltip')} />}
          />
          {loadError ? <Alert severity="error">{loadError}</Alert> : null}

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: '1fr',
                sm: '220px minmax(0, 1fr)',
                md: '230px minmax(0, 1fr)',
                lg: '300px minmax(0, 1fr)',
                xl: '330px minmax(0, 1fr)',
              },
              gap: { xs: 1.25, lg: 1.1, xl: 1.25 },
              alignItems: 'start',
              minHeight: { md: 560 },
            }}
          >
            <Card variant="outlined" sx={{ ...libraryCardSx, minHeight: 280, maxHeight: { md: 'calc(100vh - 210px)' } }}>
              <Box component="form" onSubmit={handleSearchSubmit} sx={{ p: 1.5, borderBottom: '1px solid', borderColor: 'divider', bgcolor: 'action.hover' }}>
                <TextField
                  inputRef={searchInputRef}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  label={t('library.searchLabel')}
                  size="small"
                  fullWidth
                />
              </Box>
              {loading ? (
                <Box sx={{ minHeight: 220, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <CircularProgress size={28} />
                </Box>
              ) : cultures.length === 0 ? (
                <Box sx={{ p: 3, textAlign: 'center' }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                    {t('library.emptyState.noResultsTitle')}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
                    {t('library.empty')}
                  </Typography>
                </Box>
              ) : (
                <List
                  disablePadding
                  role="listbox"
                  aria-label={t('library.page.title')}
                  sx={{ maxHeight: { xs: 280, sm: 'calc(100vh - 290px)' }, overflow: 'auto' }}
                >
                  {cultures.map((culture) => (
                    <ListItemButton
                      key={culture.id}
                      {...cultureListNavigation.getItemProps(culture)}
                      selected={culture.id === selectedCultureId}
                      onClick={() => cultureListNavigation.selectItem(culture)}
                      sx={{
                        borderBottom: '1px solid',
                        borderColor: 'divider',
                        alignItems: 'flex-start',
                        px: 1.5,
                        py: 1.25,
                        '&.Mui-selected': {
                          bgcolor: 'success.50',
                          borderLeft: '3px solid',
                          borderLeftColor: 'success.main',
                          pl: 1.125,
                        },
                        '&.Mui-selected:hover': {
                          bgcolor: 'success.100',
                        },
                      }}
                    >
                      <ListItemText
                        primary={getCultureTitle(culture)}
                        secondary={culture.crop_species_name || culture.name}
                        primaryTypographyProps={{ fontWeight: 700, noWrap: true }}
                        secondaryTypographyProps={{ noWrap: true }}
                      />
                    </ListItemButton>
                  ))}
                </List>
              )}
            </Card>

            <Box sx={{ minWidth: 0, width: '100%', display: 'flex', justifyContent: 'flex-start' }}>
              <Card variant="outlined" sx={{ ...libraryCardSx, width: '100%', maxWidth: { sm: 920, lg: 980, xl: 1040 }, minHeight: 420 }}>
                {!selectedCulture ? (
                <Box sx={{ p: { xs: 3, sm: 4 }, display: 'flex', flexDirection: 'column', gap: { xs: 3, sm: 3.5 } }}>
                  <Stack spacing={1} alignItems="center" sx={{ textAlign: 'center', maxWidth: 480, mx: 'auto' }}>
                    <Box
                      sx={{
                        width: 56,
                        height: 56,
                        borderRadius: '50%',
                        bgcolor: 'success.50',
                        color: 'success.main',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <SpaOutlinedIcon sx={{ fontSize: 30 }} />
                    </Box>
                    <Typography variant="h6" sx={{ fontWeight: 700, textWrap: 'balance' }}>
                      {t('library.emptyState.noSelectionTitle')}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {t('library.emptyState.noSelectionDescription')}
                    </Typography>
                  </Stack>
                  <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' }, gap: { xs: 2.5, sm: 3 } }}>
                    <Stack spacing={0.75} alignItems="center" sx={{ textAlign: 'center' }}>
                      <SearchOutlinedIcon sx={{ color: 'success.main', fontSize: 28 }} />
                      <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                        {t('library.emptyState.discoverTitle')}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.5 }}>
                        {t('library.emptyState.discoverDescription')}
                      </Typography>
                    </Stack>
                    <Stack spacing={0.75} alignItems="center" sx={{ textAlign: 'center' }}>
                      <DownloadOutlinedIcon sx={{ color: 'success.main', fontSize: 28 }} />
                      <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                        {t('library.emptyState.importTitle')}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.5 }}>
                        {t('library.emptyState.importDescription')}
                      </Typography>
                    </Stack>
                    <Stack spacing={0.75} alignItems="center" sx={{ textAlign: 'center' }}>
                      <HistoryOutlinedIcon sx={{ color: 'success.main', fontSize: 28 }} />
                      <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                        {t('library.emptyState.improveTitle')}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.5 }}>
                        {t('library.emptyState.improveDescription')}
                      </Typography>
                    </Stack>
                  </Box>
                </Box>
                ) : (
                <Stack sx={{ minHeight: '100%' }}>
                  <CardContent sx={{ p: { xs: 2, sm: 2.5 }, '&:last-child': { pb: { xs: 2, sm: 2.5 } } }}>
                    <Stack direction="row" spacing={1.5} alignItems="flex-start" justifyContent="space-between">
                      <Box sx={{ minWidth: 0, flex: 1, display: 'flex', alignItems: 'stretch', gap: 1.75 }}>
                        {selectedCulture.display_color ? (
                          <Box
                            sx={{
                              width: 4,
                              borderRadius: 1,
                              backgroundColor: selectedCulture.display_color,
                              opacity: 0.75,
                              my: 0.5,
                              alignSelf: 'stretch',
                              flexShrink: 0,
                            }}
                            aria-label={t('library.page.fields.displayColor')}
                            title={selectedCulture.display_color}
                          />
                        ) : null}
                        <Box sx={{ minWidth: 0, display: 'flex', flexDirection: 'column', py: 0.25 }}>
                          <Typography variant="h5" component="h2" sx={{ fontWeight: 600, overflowWrap: 'anywhere', lineHeight: 1.2 }}>
                            {selectedCulture.name}
                          </Typography>
                          {selectedCulture.variety ? (
                            <Typography variant="body2" color="text.secondary">
                              {selectedCulture.variety}
                            </Typography>
                          ) : null}
                          <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ mt: 1 }}>
                            <Chip size="small" label={t('library.versionLabel', { defaultValue: 'Version' }) + ` ${selectedCulture.version}`} />
                            <Chip size="small" label={selectedCulture.crop_species_name || selectedCulture.name} variant="outlined" />
                            <Chip size="small" label={t('library.page.byAuthor', { author: selectedCulture.created_by_label || anonymousLabel })} variant="outlined" />
                          </Stack>
                        </Box>
                      </Box>
                      {isMobile ? (
                        <Stack direction="row" spacing={0.5} sx={{ mt: -0.5 }}>
                          <Tooltip title={t('library.page.edit.open')}>
                            <IconButton
                              color="primary"
                              aria-label={t('library.page.edit.open')}
                              onClick={openEditDialog}
                            >
                              <EditOutlinedIcon />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title={t('library.importButton')}>
                            <span>
                              <IconButton
                                color="primary"
                                aria-label={t('library.importButton')}
                                disabled={importingId !== null}
                                onClick={() => void handleImport()}
                              >
                                <DownloadOutlinedIcon />
                              </IconButton>
                            </span>
                          </Tooltip>
                        </Stack>
                      ) : (
                        <Stack direction="row" spacing={1} sx={{ flexShrink: 0 }}>
                          <Button
                            variant="outlined"
                            size="small"
                            startIcon={<EditOutlinedIcon />}
                            onClick={openEditDialog}
                          >
                            {t('library.page.edit.open')}
                          </Button>
                          <Button
                            variant="contained"
                            size="small"
                            startIcon={<DownloadOutlinedIcon />}
                            disabled={importingId !== null}
                            onClick={() => void handleImport()}
                          >
                            {importingId ? t('library.importing') : t('library.importButton')}
                          </Button>
                        </Stack>
                      )}
                    </Stack>
                  </CardContent>
                  <Divider />
                  <Tabs
                    value={activeTab}
                    onChange={(_, value: number) => setActiveTab(value)}
                    variant={isMobile ? 'fullWidth' : 'scrollable'}
                    allowScrollButtonsMobile
                    sx={{ px: { xs: 1, sm: 2 } }}
                  >
                    <Tab icon={isMobile ? undefined : <SpaOutlinedIcon />} iconPosition="start" label={t('library.page.tabs.details')} />
                    <Tab icon={isMobile ? undefined : <HistoryOutlinedIcon />} iconPosition="start" label={t('library.page.tabs.versions')} />
                    <Tab icon={isMobile ? undefined : <ForumOutlinedIcon />} iconPosition="start" label={t('library.page.tabs.discussion')} />
                  </Tabs>
                  <Divider />

                  {activeTab === 0 ? (
                    <Stack spacing={2.5} sx={{ p: { xs: 2, sm: 2.5 } }}>
                      <DetailSection title={t('library.page.sections.general')} outlined>
                        <DetailGrid>
                          <DetailRow label={t('library.page.fields.cropSpecies')} value={selectedCulture.crop_species_name || selectedCulture.name || t('library.page.notSpecified')} />
                          <DetailRow label={t('library.page.fields.variety')} value={selectedCulture.variety || t('library.page.notSpecified')} />
                          <DetailRow label={t('library.page.fields.cropFamily')} value={selectedCulture.crop_family || t('library.page.notSpecified')} />
                          <DetailRow
                            label={t('library.page.fields.nutrientDemand')}
                            value={getNutrientDemandLabel(selectedCulture.nutrient_demand, t, t('library.page.notSpecified'))}
                          />
                          <DetailRow
                            label={t('library.page.fields.cultivationType')}
                            value={getCultivationTypesLabel(selectedCulture, t, t('library.page.notSpecified'))}
                          />
                        </DetailGrid>
                      </DetailSection>

                      <Divider />

                      <DetailSection title={t('library.page.sections.timing')}>
                        <DetailGrid>
                          <DetailRow label={t('library.page.fields.growthDurationDays')} value={formatDays(selectedCulture.growth_duration_days, locale, t('library.page.notSpecified'), t('library.page.units.days'))} />
                          <DetailRow label={t('library.page.fields.harvestDurationDays')} value={formatDays(selectedCulture.harvest_duration_days, locale, t('library.page.notSpecified'), t('library.page.units.days'))} />
                          <DetailRow label={t('library.page.fields.propagationDurationDays')} value={formatDays(selectedCulture.propagation_duration_days, locale, t('library.page.notSpecified'), t('library.page.units.days'))} />
                        </DetailGrid>
                      </DetailSection>

                      <Divider />

                      <DetailSection title={t('library.page.sections.spacing')}>
                        <DetailGrid>
                          <DetailRow label={t('library.page.fields.distanceWithinRow')} value={formatMetersAsCentimeters(selectedCulture.distance_within_row_m, locale, t('library.page.notSpecified'))} />
                          <DetailRow label={t('library.page.fields.rowSpacing')} value={formatMetersAsCentimeters(selectedCulture.row_spacing_m, locale, t('library.page.notSpecified'))} />
                          <DetailRow label={t('library.page.fields.sowingDepth')} value={formatMetersAsCentimeters(selectedCulture.sowing_depth_m, locale, t('library.page.notSpecified'))} />
                        </DetailGrid>
                      </DetailSection>

                      <Divider />

                      <DetailSection title={t('library.page.sections.seed')}>
                        <DetailGrid>
                          <DetailRow
                            label={t('library.page.fields.seedRate')}
                            value={formatSeedRate(selectedCulture.seed_rate_value, selectedCulture.seed_rate_unit, locale, t('library.page.notSpecified'), t)}
                          />
                          <DetailRow
                            label={t('library.page.fields.seedRateByCultivation')}
                            value={formatSeedRateByCultivation(selectedCulture, locale, t('library.page.notSpecified'), t)}
                          />
                          <DetailRow
                            label={t('library.page.fields.seedRateDirect')}
                            value={formatSeedRate(selectedCulture.seed_rate_direct_value, selectedCulture.seed_rate_direct_unit, locale, t('library.page.notSpecified'), t)}
                          />
                          <DetailRow
                            label={t('library.page.fields.seedRatePreCultivation')}
                            value={formatSeedRate(selectedCulture.seed_rate_pre_cultivation_value, selectedCulture.seed_rate_pre_cultivation_unit, locale, t('library.page.notSpecified'), t)}
                          />
                          <DetailRow label={t('library.page.fields.sowingSafetyPercent')} value={formatPercent(selectedCulture.sowing_calculation_safety_percent, locale, t('library.page.notSpecified'))} />
                          <DetailRow label={t('library.page.fields.sowingSafetyPercentDirect')} value={formatPercent(selectedCulture.sowing_calculation_safety_percent_direct, locale, t('library.page.notSpecified'))} />
                          <DetailRow label={t('library.page.fields.sowingSafetyPercentPreCultivation')} value={formatPercent(selectedCulture.sowing_calculation_safety_percent_pre_cultivation, locale, t('library.page.notSpecified'))} />
                          <DetailRow label={t('library.page.fields.thousandKernelWeight')} value={selectedCulture.thousand_kernel_weight_g === null || selectedCulture.thousand_kernel_weight_g === undefined ? t('library.page.notSpecified') : `${formatLocalizedNumber(selectedCulture.thousand_kernel_weight_g, locale, t('library.page.notSpecified'), { maximumFractionDigits: 2 })} g`} />
                          <DetailRow
                            label={t('library.page.fields.seedingRequirement')}
                            value={selectedCulture.seeding_requirement === null || selectedCulture.seeding_requirement === undefined
                              ? t('library.page.notSpecified')
                              : `${formatLocalizedNumber(selectedCulture.seeding_requirement, locale, t('library.page.notSpecified'), { maximumFractionDigits: 2 })}${getSeedingRequirementTypeLabel(selectedCulture.seeding_requirement_type, t) ? ` ${getSeedingRequirementTypeLabel(selectedCulture.seeding_requirement_type, t)}` : ''}`}
                          />
                          <DetailRow label={t('library.page.fields.seedPackages')} value={formatSeedPackages(selectedCulture, locale, t('library.page.notSpecified'), t)} />
                        </DetailGrid>
                      </DetailSection>

                      <Divider />

                      <DetailSection title={t('library.page.sections.harvest')}>
                        <DetailGrid>
                          <DetailRow label={t('library.page.fields.harvestMethod')} value={getHarvestMethodLabel(selectedCulture.harvest_method, t, t('library.page.notSpecified'))} />
                          <DetailRow label={t('library.page.fields.expectedYield')} value={selectedCulture.expected_yield === null || selectedCulture.expected_yield === undefined ? t('library.page.notSpecified') : `${formatLocalizedNumber(selectedCulture.expected_yield, locale, t('library.page.notSpecified'), { maximumFractionDigits: 2 })} kg`} />
                          <DetailRow label={t('library.page.fields.allowDeviationDeliveryWeeks')} value={selectedCulture.allow_deviation_delivery_weeks ? t('library.page.boolean.yes') : t('library.page.boolean.no')} />
                        </DetailGrid>
                      </DetailSection>

                      <Divider />

                      <DetailSection title={t('library.page.sections.metadata')}>
                        <DetailGrid>
                          <DetailRow label={t('library.versionLabel')} value={String(selectedCulture.version)} />
                          <DetailRow label={t('library.page.fields.originalLanguage')} value={getLanguageLabel(selectedCulture.original_language_code, t, t('library.page.notSpecified'))} />
                          <DetailRow label={t('library.page.fields.createdAt')} value={formatDate(selectedCulture.created_at)} />
                          <DetailRow label={t('library.page.fields.publishedAt')} value={formatDate(selectedCulture.published_at)} />
                          <DetailRow label={t('library.page.fields.updatedAt')} value={formatDate(selectedCulture.updated_at)} />
                          <DetailRow label={t('library.page.fields.status')} value={getPublicCultureStatusLabel(selectedCulture.status, t)} />
                        </DetailGrid>
                      </DetailSection>

                      <Divider />

                      <DetailSection title={t('library.page.sections.notes')} outlined>
                        {selectedCulture.notes ? (
                          <Box
                            sx={{
                              '& h3': { mt: 2, mb: 1, fontSize: '1.05rem' },
                              '& h3:first-of-type': { mt: 0.25 },
                              '& p': { mb: 1, maxWidth: '95ch' },
                              '& ul': { pl: 3, mb: 1 },
                              '& li': { mb: 0.5 },
                              '& a': { color: 'primary.main' },
                              '& em': { color: 'text.secondary' },
                            }}
                          >
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                              {stripCitationMarkers(selectedCulture.notes)}
                            </ReactMarkdown>
                          </Box>
                        ) : (
                          <Typography variant="body2" color="text.secondary">
                            {t('library.page.noNotes')}
                          </Typography>
                        )}
                      </DetailSection>
                    </Stack>
                  ) : null}

                  {activeTab === 1 ? (
                    <Stack spacing={2} sx={{ p: { xs: 2, sm: 2.5 } }}>
                      {collaborationStatus === 'loading' ? <CircularProgress size={24} /> : null}
                      {collaborationStatus === 'error' ? <Alert severity="error">{t('library.page.collaborationLoadError')}</Alert> : null}
                      {versions.length === 0 ? (
                        <Typography variant="body2" color="text.secondary">
                          {t('library.page.versions.empty')}
                        </Typography>
                      ) : (
                        <Stack spacing={1.25}>
                          {versions.map((revision) => (
                            <VersionCard
                              key={revision.id}
                              revision={revision}
                              currentVersion={selectedCulture.version}
                              anonymousLabel={anonymousLabel}
                              formatDate={formatDate}
                              onRevert={handleRevertVersion}
                              revertingVersion={revertingVersion}
                              t={t}
                              onDiscuss={startDiscussionForVersion}
                            />
                          ))}
                        </Stack>
                      )}
                    </Stack>
                  ) : null}

                  {activeTab === 2 ? (
                    <Stack spacing={2} sx={{ p: { xs: 2, sm: 2.5 } }}>
                      {collaborationStatus === 'loading' ? <CircularProgress size={24} /> : null}
                      {collaborationStatus === 'error' ? <Alert severity="error">{t('library.page.collaborationLoadError')}</Alert> : null}
                      {selectedTopicId === null ? (
                        <Stack spacing={1.25}>
                          <Button variant="outlined" sx={{ alignSelf: 'flex-start' }} onClick={() => { setNewTopicOpen(true); setTopicRevision(versions.find((version) => version.version === selectedCulture.version)?.id); }}>
                            {t('library.page.discussion.newTopic')}
                          </Button>
                          {newTopicOpen ? (
                            <Box component="form" onSubmit={(event) => void handleCommentSubmit(event)} sx={{ display: 'grid', gap: 1.25 }}>
                              <TextField autoFocus label={t('library.page.discussion.titleLabel')} value={topicTitle} onChange={(event) => setTopicTitle(event.target.value)} />
                              <TextField label={t('library.page.discussion.commentLabel')} value={commentBody} onChange={(event) => setCommentBody(event.target.value)} multiline minRows={3} />
                              {topicRevision ? <Typography variant="caption">{t('library.page.discussion.versionReference', { version: versions.find((version) => version.id === topicRevision)?.version })}</Typography> : null}
                              <Stack direction="row" spacing={1}>
                                <Button type="submit" variant="contained" disabled={submittingComment || !topicTitle.trim() || !commentBody.trim()}>{t('library.page.discussion.create')}</Button>
                                <Button onClick={() => setNewTopicOpen(false)}>{t('library.page.discussion.cancel')}</Button>
                              </Stack>
                            </Box>
                          ) : null}
                          {topics.length === 0 && !newTopicOpen ? (
                            <Box><Typography variant="subtitle2">{t('library.page.discussion.emptyTitle')}</Typography><Typography variant="body2" color="text.secondary">{t('library.page.discussion.empty')}</Typography></Box>
                          ) : topics.map((topic) => (
                            <ListItemButton key={topic.id} onClick={() => void openTopic(topic.id)} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                              <ListItemText primary={topic.title} secondary={t('library.page.discussion.topicMeta', { author: topic.created_by_label || anonymousLabel, date: formatDate(topic.created_at), count: topic.comment_count })} />
                              {topic.version ? <Chip size="small" label={t('library.page.versions.versionTitle', { version: topic.version })} /> : null}
                            </ListItemButton>
                          ))}
                        </Stack>
                      ) : (
                        <Stack spacing={1.25}>
                          <Button size="small" sx={{ alignSelf: 'flex-start' }} onClick={() => { setSelectedTopicId(null); setComments([]); }}>{t('library.page.discussion.back')}</Button>
                          <Typography variant="h6">{topics.find((topic) => topic.id === selectedTopicId)?.title}</Typography>
                          {comments.map((comment) => (
                            <Box key={comment.id} sx={{ borderLeft: comment.parent ? 2 : 0, borderColor: 'divider', pl: comment.parent ? 2 : 0, ml: comment.parent ? { xs: 1, sm: 3 } : 0 }}>
                              <Typography variant="caption" color="text.secondary">{t('library.page.metaByDate', { author: comment.created_by_label || anonymousLabel, date: formatDate(comment.created_at) })}{comment.is_edited ? ` · ${t('library.page.discussion.edited')}` : ''}</Typography>
                              <Typography variant="body2" color={comment.deleted_at ? 'text.secondary' : 'text.primary'} sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', mt: 0.5 }}>{comment.deleted_at ? t('library.page.discussion.deleted') : comment.body}</Typography>
                              {!comment.deleted_at ? <Stack direction="row" spacing={1}><Button size="small" onClick={() => { setReplyTo(comment.id); setEditingCommentId(null); setCommentBody(''); }}>{t('library.page.discussion.reply')}</Button>{comment.can_edit ? <><Button size="small" onClick={() => { setEditingCommentId(comment.id); setReplyTo(null); setCommentBody(comment.body); }}>{t('library.page.discussion.edit')}</Button><Button size="small" color="error" onClick={() => void deleteComment(comment.id)}>{t('library.page.discussion.delete')}</Button></> : null}</Stack> : null}
                            </Box>
                          ))}
                          <Box component="form" onSubmit={(event) => void handleCommentSubmit(event)} sx={{ display: 'grid', gap: 1 }}>
                            <TextField autoFocus={replyTo !== null || editingCommentId !== null} label={replyTo ? t('library.page.discussion.replyLabel') : t('library.page.discussion.commentLabel')} value={commentBody} onChange={(event) => setCommentBody(event.target.value)} multiline minRows={2} />
                            <Stack direction="row" spacing={1}><Button type="submit" variant="contained" disabled={!commentBody.trim()}>{t('library.page.discussion.submit')}</Button>{replyTo || editingCommentId ? <Button onClick={() => { setReplyTo(null); setEditingCommentId(null); setCommentBody(''); }}>{t('library.page.discussion.cancel')}</Button> : null}</Stack>
                          </Box>
                        </Stack>
                      )}
                    </Stack>
                  ) : null}
                </Stack>
                )}
              </Card>
            </Box>
          </Box>
        </Stack>
      </Box>
      {editDialogOpen && selectedCulture ? (
        <CultureForm
          culture={publicCultureToCultureFormData(selectedCulture)}
          onSave={handleEditSave}
          onCancel={closeEditDialog}
          title={t('library.page.edit.title')}
          variant="publicLibrary"
        />
      ) : null}
    </PageContainer>
  );
}
