import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type FormEvent, type UIEvent } from 'react';
import { useLocation, useNavigate, useOutletContext, useSearchParams } from 'react-router';
import axios from 'axios';
import TranslateOutlinedIcon from '@mui/icons-material/TranslateOutlined';
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
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  InputLabel,
  List,
  ListItemButton,
  ListItemText,
  MenuItem,
  Select,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
  useMediaQuery,
} from '@mui/material';
import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import ArrowBackOutlinedIcon from '@mui/icons-material/ArrowBackOutlined';
import DownloadOutlinedIcon from '@mui/icons-material/DownloadOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import ForumOutlinedIcon from '@mui/icons-material/ForumOutlined';
import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined';
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined';
import SpaOutlinedIcon from '@mui/icons-material/SpaOutlined';
import SyncOutlinedIcon from '@mui/icons-material/SyncOutlined';
import { publicCultureAPI } from '../../api/api';
import type {
  CultivationType,
  Culture,
  ImportPublicCultureConfirmationRequiredError,
  PublicCulture,
  PublicCultureDiscussionComment,
  PublicCultureDiscussionTopic,
  PublicCultureRemovalReason,
  PublicCultureRevision,
} from '../../api/types';
import { useAuth } from '../../auth/useAuth';
import PageContainer from '../../components/layout/PageContainer';
import { DetailPageActions } from '../../components/layout/DetailPageActions';
import { useTranslation } from '../../i18n';
import { getLanguageDisplayName, normalizeLanguageTag } from '../../i18n/languages';
import { showGlobalSnackbar } from '../../utils/globalSnackbar';
import { stripCitationMarkers } from '../../components/data-grid/markdown';
import { useCultureListKeyboardNavigation } from '../../cultures/useCultureListKeyboardNavigation';
import { buildCropHierarchy, findSpeciesCulture, getCropSpeciesKey, type CropHierarchyItemKind } from '../../cultures/cropHierarchy';
import { flattenTreeRows } from '../../components/hierarchy/utils/treeRows';
import { useExpandedState } from '../../components/hierarchy/hooks/useExpandedState';
import { CultureForm } from '../../cultures/CultureForm';
import { CultureTitleSelectorButton } from '../../cultures/CultureTitleSelectorButton';
import {
  buildPublicCultureUpdatePayload,
  publicCultureToCultureFormData,
} from '../../cultures/publicCultureFormAdapter';
import { useCommandContextTag, useRegisterCommands } from '../../commands/useCommandContext';
import type { RootLayoutOutletContext, TopbarContextAction } from '../../navigation/topbarTypes';
import { useTopbarContextActions } from '../../hooks/useTopbarContextActions';
import { createPublicCropLibraryCommandSpecs } from '../publicCropLibraryCommandSpecs';
import {
  getCultivationTypeLabel,
  getDescriptionFallbackNotice,
  getFallbackNotice,
  getPublicCultureDescription,
  getPublicCultureName,
  getPublicCultureTitle,
} from '../publicCultureDisplay';
import { applySavedCultures } from '../publicCultureListMerge';
import { MultilingualTextFieldSection } from '../components/MultilingualTextFieldSection';
import { AppTooltip } from '../../components/AppTooltip';
import { CultureSeedDetails, type CultureSeedRateRow, type ValueSource } from '../../cultures/CultureSeedDetails';
import { VarietyValueLegend } from '../../cultures/VarietyValueLegend';
import { CropHierarchyExpandToggle } from '../../cultures/CropHierarchyExpandToggle';
import { desktopCropChevronButtonSx } from '../../cultures/cropHierarchyRowSx';
import { DetailGrid, DetailRow, DetailSection } from '../components/publicCropLibrary/DetailPrimitives';
import { VersionCard } from '../components/publicCropLibrary/VersionCard';
import { CommentForm } from '../components/publicCropLibrary/CommentForm';
import { ThreadCommentBranch } from '../components/publicCropLibrary/DiscussionComment';
import { PublicCultureMobileSelectorDialog } from '../components/publicCropLibrary/PublicCultureMobileSelectorDialog';
import { ImportConflictDialog } from '../components/publicCropLibrary/ImportConflictDialog';
import {
  PUBLIC_CULTURE_TAB_BY_INDEX,
  PUBLIC_CULTURE_TAB_INDEX_BY_PARAM,
  SELECTED_PUBLIC_CULTURE_STORAGE_KEY,
  arePublicValuesEqual,
  buildPublicCultureDescriptionDrafts,
  buildThreadCommentTree,
  formatDays,
  formatDiscussionPreview,
  formatLocalizedNumber,
  formatMetersAsCentimeters,
  getCultivationTypesLabel,
  getCultureTitle,
  getHarvestMethodLabel,
  getLanguageLabel,
  getNutrientDemandLabel,
  getPublicCultureOriginalLanguageCode,
  getPublicCultureTabIndex,
  getStoredPublicCropLibraryViewState,
  getStoredPublicCultureId,
  isEmptyPublicValue,
  parsePublicCultureId,
  storePublicCropLibraryViewState,
  type PublicCropLibraryViewState,
} from '../components/publicCropLibrary/formatters';

type CollaborationLoadStatus = 'idle' | 'loading' | 'success' | 'error';
type PublicCultureLoadStatus = 'loading' | 'success' | 'error';
export default function PublicCropLibraryPage() {
  const { user } = useAuth();
  const { t, i18n } = useTranslation('cultures');
  const language = i18n.resolvedLanguage ?? i18n.language;
  const outletContext = useOutletContext<RootLayoutOutletContext | null>();
  const setTopbarContextActions = outletContext?.setTopbarContextActions;
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  // navigateToLibraryState reads location fresh via this ref instead of depending on
  // location.search directly: selecting a culture calls navigate(), which changes
  // location.search, which would otherwise recreate navigateToLibraryState (and the
  // updateSelectedCultureId/loadCultures callbacks chained off it) on every selection,
  // re-triggering the culture list fetch and remounting the list mid keyboard-navigation.
  const locationRef = useRef(location);
  useEffect(() => {
    locationRef.current = location;
  }, [location]);
  const selectedCultureParam = searchParams.get('cultureId');
  const selectedCultureIdFromUrl = parsePublicCultureId(selectedCultureParam);
  const selectedTopicIdFromUrl = parsePublicCultureId(searchParams.get('discussionId'));
  const hasExplicitLibraryState = searchParams.has('cultureId') || searchParams.has('tab') || searchParams.has('discussionId');
  const storedViewState = hasExplicitLibraryState ? null : getStoredPublicCropLibraryViewState();
  const activeTab = getPublicCultureTabIndex(searchParams.get('tab'), selectedTopicIdFromUrl);
  const selectedTopicId = activeTab === PUBLIC_CULTURE_TAB_INDEX_BY_PARAM.discussion ? selectedTopicIdFromUrl : null;
  const [query, setQuery] = useState(() => storedViewState?.query ?? '');
  const [cultures, setCultures] = useState<PublicCulture[]>([]);
  const [selectedCultureId, setSelectedCultureId] = useState<number | null>(() => (
    selectedCultureIdFromUrl ?? storedViewState?.cultureId ?? getStoredPublicCultureId()
  ));
  const selectedCultureIdRef = useRef<number | null>(selectedCultureId);
  const [loadStatus, setLoadStatus] = useState<PublicCultureLoadStatus>('loading');
  const [loadError, setLoadError] = useState('');
  const [topics, setTopics] = useState<PublicCultureDiscussionTopic[]>([]);
  const [comments, setComments] = useState<PublicCultureDiscussionComment[]>([]);
  const [versions, setVersions] = useState<PublicCultureRevision[]>([]);
  const [collaborationStatus, setCollaborationStatus] = useState<CollaborationLoadStatus>('idle');
  const [commentsStatus, setCommentsStatus] = useState<CollaborationLoadStatus>('idle');
  const [newTopicOpen, setNewTopicOpen] = useState(false);
  const [topicTitle, setTopicTitle] = useState('');
  const [commentBody, setCommentBody] = useState('');
  const [topicRevision, setTopicRevision] = useState<number | undefined>();
  const [replyTo, setReplyTo] = useState<number | null>(null);
  const [editingCommentId, setEditingCommentId] = useState<number | null>(null);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [importingId, setImportingId] = useState<number | null>(null);
  const [importConflict, setImportConflict] = useState<{ publicCultureId: number; name: string } | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);
  const [removeReason, setRemoveReason] = useState<PublicCultureRemovalReason | ''>('');
  const [removing, setRemoving] = useState(false);
  const [descriptionDrafts, setDescriptionDrafts] = useState<Record<string, string>>({});
  const [mobileSelectorOpen, setMobileSelectorOpen] = useState(false);
  const [selectedSpeciesViewKey, setSelectedSpeciesViewKey] = useState<string | null>(null);
  const [revertingVersion, setRevertingVersion] = useState<number | null>(null);
  const isMobile = useMediaQuery('(max-width:600px)');
  const useCompactLibraryLayout = useMediaQuery('(max-width:899.95px)');
  const libraryAreaRef = useRef<HTMLDivElement>(null);
  // How tall the two-pane area is allowed to be, measured directly from where it
  // actually starts in the viewport rather than guessed via a hardcoded "chrome
  // height" offset (which drifts whenever the surrounding header/layout changes
  // and silently leaves the panes shorter than the available space).
  const [libraryAreaMaxHeight, setLibraryAreaMaxHeight] = useState<number | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const cultureListRef = useRef<HTMLUListElement>(null);
  const cultureListScrollTopRef = useRef<number>(storedViewState?.listScrollTop ?? 0);
  const cultureListRequestIdRef = useRef(0);
  const collaborationLoadRequestIdRef = useRef(0);
  const {
    expandedRows: expandedCropRows,
    toggleExpand: toggleCropRow,
    ensureExpanded: ensureCropRowExpanded,
  } = useExpandedState('publicCropLibrary');
  // Cultures this client has saved, kept until a list response catches up with
  // them. Bumping cultureListRequestIdRef on save only discards list requests
  // that are already in flight; one started right after the save (the search
  // box refreshes on a debounce) still carries pre-save data and would
  // otherwise write the old values straight back over the saved ones.
  const savedCulturesRef = useRef<Map<number, PublicCulture>>(new Map());
  const newTopicButtonRef = useRef<HTMLButtonElement>(null);
  const newTopicTitleInputRef = useRef<HTMLInputElement>(null);
  const activeCommentFormInputRef = useRef<HTMLInputElement>(null);
  const replyActionRefs = useRef(new Map<number, HTMLButtonElement>());
  const commentRefs = useRef(new Map<number, HTMLDivElement>());
  const [commentActionMenu, setCommentActionMenu] = useState<{ commentId: number; anchorElement: HTMLElement } | null>(null);
  const [pendingFocusCommentId, setPendingFocusCommentId] = useState<number | null>(null);
  const isCultureLoading = loadStatus === 'loading';
  useLayoutEffect(() => {
    if (useCompactLibraryLayout) {
      return undefined;
    }
    const element = libraryAreaRef.current;
    if (!element) {
      return undefined;
    }
    const BOTTOM_MARGIN_PX = 24;
    const updateMaxHeight = () => {
      const top = element.getBoundingClientRect().top;
      setLibraryAreaMaxHeight(Math.max(0, window.innerHeight - top - BOTTOM_MARGIN_PX));
    };
    updateMaxHeight();
    window.addEventListener('resize', updateMaxHeight);
    const resizeObserver = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(updateMaxHeight) : undefined;
    resizeObserver?.observe(document.body);
    return () => {
      window.removeEventListener('resize', updateMaxHeight);
      resizeObserver?.disconnect();
    };
  }, [useCompactLibraryLayout, loadError, isCultureLoading]);
  const canEditPublicCulture = Boolean(user);
  const canModeratePublicLibrary = Boolean(user?.is_public_library_moderator || user?.is_staff || user?.is_superuser);

  const focusSearch = useCallback(() => {
    if (useCompactLibraryLayout) {
      setMobileSelectorOpen(true);
      return;
    }
    searchInputRef.current?.focus();
    searchInputRef.current?.select();
  }, [useCompactLibraryLayout]);

  const locale = i18n.resolvedLanguage === 'de' ? 'de-DE' : 'en-US';
  const anonymousLabel = t('library.anonymousAuthor');

  const navigateToLibraryState = useCallback(({
    cultureId,
    tab,
    discussionId,
    replace = false,
  }: {
    cultureId: number | null;
    tab?: number;
    discussionId?: number | null;
    replace?: boolean;
  }): void => {
    const currentLocation = locationRef.current;
    const nextParams = new URLSearchParams(currentLocation.search);
    if (cultureId === null) {
      nextParams.delete('cultureId');
      nextParams.delete('tab');
      nextParams.delete('discussionId');
    } else {
      nextParams.set('cultureId', String(cultureId));

      const nextTab = tab ?? activeTab;
      const tabParam = PUBLIC_CULTURE_TAB_BY_INDEX[nextTab] ?? 'details';
      if (tabParam === 'details') {
        nextParams.delete('tab');
      } else {
        nextParams.set('tab', tabParam);
      }

      const nextDiscussionId = tabParam === 'discussion' ? (discussionId ?? null) : null;
      if (nextDiscussionId === null) {
        nextParams.delete('discussionId');
      } else {
        nextParams.set('discussionId', String(nextDiscussionId));
        nextParams.set('tab', 'discussion');
      }
    }

    const nextSearch = nextParams.toString();
    const currentSearch = currentLocation.search.startsWith('?') ? currentLocation.search.slice(1) : currentLocation.search;
    if (nextSearch === currentSearch) {
      return;
    }
    const nextLocation = {
      pathname: currentLocation.pathname,
      search: nextSearch ? `?${nextSearch}` : '',
      hash: currentLocation.hash,
    };
    // Write through immediately: locationRef is otherwise only refreshed by the
    // location-changed effect above, which runs one render behind. Selecting
    // several cultures in quick succession (fast clicks, arrow-key repeat)
    // calls this function multiple times before that effect can catch up, so
    // without this each call after the first would build its URL from a stale
    // base and could even skip navigating entirely (the nextSearch === currentSearch
    // check above false-matching a stale, already-superseded search) — the
    // selection then snaps back to whatever the stale URL said once the
    // URL-to-state sync effect (below) reconciles it, which reads as the
    // culture list "jumping back and forth" after a fast selection.
    locationRef.current = { ...currentLocation, ...nextLocation };
    navigate(nextLocation, { replace });
  }, [activeTab, navigate]);

  const updateSelectedCultureId = useCallback((cultureId: number | null, options: { replace?: boolean; speciesViewKey?: string | null } = {}): void => {
    setSelectedSpeciesViewKey(options.speciesViewKey ?? null);
    setSelectedCultureId(cultureId);
    selectedCultureIdRef.current = cultureId;
    if (cultureId === null) {
      window.localStorage.removeItem(SELECTED_PUBLIC_CULTURE_STORAGE_KEY);
    } else {
      window.localStorage.setItem(SELECTED_PUBLIC_CULTURE_STORAGE_KEY, String(cultureId));
    }
    navigateToLibraryState({
      cultureId,
      tab: activeTab,
      discussionId: null,
      replace: options.replace ?? true,
    });
  }, [activeTab, navigateToLibraryState]);

  const selectMobileCulture = useCallback((culture: PublicCulture, itemKind: CropHierarchyItemKind, speciesKey: string): void => {
    updateSelectedCultureId(culture.id, { replace: false, speciesViewKey: itemKind === 'species' ? speciesKey : null });
    setMobileSelectorOpen(false);
  }, [updateSelectedCultureId]);

  const persistViewState = useCallback((overrides: Partial<PublicCropLibraryViewState> = {}): void => {
    if (selectedCultureId === null) {
      return;
    }

    const tab = PUBLIC_CULTURE_TAB_BY_INDEX[activeTab] ?? 'details';
    storePublicCropLibraryViewState({
      cultureId: selectedCultureId,
      tab,
      discussionId: tab === 'discussion' ? selectedTopicId : null,
      query,
      listScrollTop: cultureListScrollTopRef.current,
      ...overrides,
    });
  }, [activeTab, query, selectedCultureId, selectedTopicId]);

  const handleCultureListScroll = useCallback((event: UIEvent<HTMLUListElement>): void => {
    cultureListScrollTopRef.current = event.currentTarget.scrollTop;
    persistViewState({ listScrollTop: event.currentTarget.scrollTop });
  }, [persistViewState]);

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
  const selectedCultureSpeciesKey = selectedCulture ? getCropSpeciesKey(selectedCulture) : null;
  const isSelectedSpeciesEntry = Boolean(selectedCulture && !(selectedCulture.variety || '').trim());
  const isSpeciesView = Boolean(
    selectedCulture
    && (
      isSelectedSpeciesEntry
      || (selectedSpeciesViewKey !== null && selectedSpeciesViewKey === selectedCultureSpeciesKey)
    ),
  );
  // Converted to the project `Culture` shape (matching units/field names) so the edit
  // form can reuse the same crop/variety inheritance highlighting as the project side.
  const editFormCultures = useMemo(
    () => cultures.map(publicCultureToCultureFormData),
    [cultures],
  );
  const selectedSpeciesCulture = useMemo(
    () => findSpeciesCulture(selectedCulture, cultures),
    [cultures, selectedCulture],
  );
  const getPublicFieldValue = useCallback(<TValue,>(field: keyof PublicCulture, value: TValue): TValue => {
    if (
      selectedCulture?.variety
      && !isSpeciesView
      && selectedSpeciesCulture
      && isEmptyPublicValue(value)
    ) {
      return selectedSpeciesCulture[field] as TValue;
    }
    return value;
  }, [isSpeciesView, selectedCulture?.variety, selectedSpeciesCulture]);
  const getPublicFieldSource = useCallback((field: keyof PublicCulture): ValueSource | null => {
    if (isSpeciesView || !selectedCulture?.variety || !selectedSpeciesCulture) {
      return null;
    }
    const ownValue = selectedCulture[field];
    if (isEmptyPublicValue(ownValue)) {
      return null;
    }
    const cropValue = selectedSpeciesCulture[field];
    return arePublicValuesEqual(ownValue, cropValue) ? null : 'ownValue';
  }, [isSpeciesView, selectedCulture, selectedSpeciesCulture]);
  const showVarietyValueLegend = Boolean(!isSpeciesView && selectedCulture?.variety && selectedSpeciesCulture);
  const publicActiveCultivationTypes: CultivationType[] = useMemo(() => (selectedCulture
    ? (
      selectedCulture.cultivation_types && selectedCulture.cultivation_types.length > 0
        ? selectedCulture.cultivation_types
        : (
          !isSpeciesView
          && selectedCulture.variety
          && selectedSpeciesCulture?.cultivation_types
          && selectedSpeciesCulture.cultivation_types.length > 0
            ? selectedSpeciesCulture.cultivation_types
            : (
              getPublicFieldValue('cultivation_type', selectedCulture.cultivation_type)
                ? [getPublicFieldValue('cultivation_type', selectedCulture.cultivation_type)]
                : []
            )
        )
    ).filter((item): item is CultivationType => item === 'direct_sowing' || item === 'pre_cultivation')
    : []), [getPublicFieldValue, isSpeciesView, selectedCulture, selectedSpeciesCulture]);
  const publicSeedRateRows: CultureSeedRateRow[] = useMemo(() => (selectedCulture
    ? (() => {
      const isDirectActive = publicActiveCultivationTypes.includes('direct_sowing');
      const isPreCultivationActive = publicActiveCultivationTypes.includes('pre_cultivation');
      const directValue = getPublicFieldValue('seed_rate_direct_value', selectedCulture.seed_rate_direct_value);
      const directUnit = getPublicFieldValue('seed_rate_direct_unit', selectedCulture.seed_rate_direct_unit);
      const preCultivationValue = getPublicFieldValue('seed_rate_pre_cultivation_value', selectedCulture.seed_rate_pre_cultivation_value);
      const preCultivationUnit = getPublicFieldValue('seed_rate_pre_cultivation_unit', selectedCulture.seed_rate_pre_cultivation_unit);
      const rows: CultureSeedRateRow[] = [];

      if (isDirectActive && directValue !== null && directValue !== undefined && directUnit) {
        rows.push({
          method: 'direct_sowing',
          value: directValue,
          unit: directUnit,
          safety: getPublicFieldValue('sowing_calculation_safety_percent_direct', selectedCulture.sowing_calculation_safety_percent_direct) ?? null,
          valueSource: getPublicFieldSource('seed_rate_direct_value') ?? getPublicFieldSource('seed_rate_direct_unit'),
          safetySource: getPublicFieldSource('sowing_calculation_safety_percent_direct'),
        });
      }
      if (isPreCultivationActive && preCultivationValue !== null && preCultivationValue !== undefined && preCultivationUnit) {
        rows.push({
          method: 'pre_cultivation',
          value: preCultivationValue,
          unit: preCultivationUnit,
          safety: getPublicFieldValue('sowing_calculation_safety_percent_pre_cultivation', selectedCulture.sowing_calculation_safety_percent_pre_cultivation) ?? null,
          valueSource: getPublicFieldSource('seed_rate_pre_cultivation_value') ?? getPublicFieldSource('seed_rate_pre_cultivation_unit'),
          safetySource: getPublicFieldSource('sowing_calculation_safety_percent_pre_cultivation'),
        });
      }

      if (rows.length > 0) {
        return rows;
      }

      const seedRateByCultivation = getPublicFieldValue('seed_rate_by_cultivation', selectedCulture.seed_rate_by_cultivation);
      if (seedRateByCultivation && Object.keys(seedRateByCultivation).length > 0) {
        return Object.entries(seedRateByCultivation)
          .filter(([method, payload]) => (
            publicActiveCultivationTypes.includes(method as CultivationType)
            && (method === 'direct_sowing' || method === 'pre_cultivation')
            && payload
            && typeof payload.value === 'number'
            && typeof payload.unit === 'string'
          ))
          .map(([method, payload]) => ({
            method: method as CultivationType,
            value: payload.value,
            unit: payload.unit,
            safety: null,
            valueSource: getPublicFieldSource('seed_rate_by_cultivation'),
            safetySource: null,
          }));
      }

      const generalSeedRateValue = getPublicFieldValue('seed_rate_value', selectedCulture.seed_rate_value);
      const generalSeedRateUnit = getPublicFieldValue('seed_rate_unit', selectedCulture.seed_rate_unit);
      if (
        publicActiveCultivationTypes.length > 0
        && generalSeedRateValue !== null
        && generalSeedRateValue !== undefined
        && generalSeedRateUnit
      ) {
        return [{
          method: publicActiveCultivationTypes.includes('direct_sowing') ? 'direct_sowing' : 'pre_cultivation',
          value: generalSeedRateValue,
          unit: generalSeedRateUnit,
          safety: getPublicFieldValue('sowing_calculation_safety_percent', selectedCulture.sowing_calculation_safety_percent) ?? null,
          valueSource: getPublicFieldSource('seed_rate_value') ?? getPublicFieldSource('seed_rate_unit'),
          safetySource: getPublicFieldSource('sowing_calculation_safety_percent'),
        }];
      }

      return [];
    })()
    : []), [getPublicFieldSource, getPublicFieldValue, publicActiveCultivationTypes, selectedCulture]);
  const cropHierarchyItems = useMemo(
    () => buildCropHierarchy(cultures),
    [cultures],
  );
  useEffect(() => {
    if (!selectedCulture?.variety || isSpeciesView || !selectedCultureSpeciesKey) {
      return;
    }
    ensureCropRowExpanded(`species:${selectedCultureSpeciesKey}`);
  }, [ensureCropRowExpanded, isSpeciesView, selectedCulture, selectedCultureSpeciesKey]);
  useEffect(() => {
    if (!query.trim()) {
      return;
    }
    cropHierarchyItems.forEach((item) => {
      if (item.kind === 'variety' && item.parentId) {
        ensureCropRowExpanded(item.parentId);
      }
    });
  }, [cropHierarchyItems, ensureCropRowExpanded, query]);
  const visibleCropRows = useMemo(
    () => flattenTreeRows(cropHierarchyItems, { expandedIds: expandedCropRows }),
    [cropHierarchyItems, expandedCropRows],
  );
  const selectableCropRows = useMemo(
    () => visibleCropRows.map((row) => row.node).filter((item) => item.culture?.id !== undefined),
    [visibleCropRows],
  );
  // Localized species name for the selected entry, plus the notice shown when
  // only another language's text is available.
  const selectedCultureName = useMemo(
    () => (selectedCulture
      ? getPublicCultureName(selectedCulture, language, t('library.translation.missingName'))
      : { text: '', languageCode: null, isFallback: false }),
    [language, selectedCulture, t],
  );
  const nameFallbackNotice = useMemo(
    () => getFallbackNotice(selectedCultureName, t, language),
    [selectedCultureName, t, language],
  );
  const selectedCultureDescription = useMemo(
    () => (selectedCulture
      ? getPublicCultureDescription(selectedCulture, language)
      : { text: '', languageCode: null, isFallback: false }),
    [language, selectedCulture],
  );
  const descriptionFallbackNotice = useMemo(
    () => getDescriptionFallbackNotice(selectedCultureDescription, t, language),
    [selectedCultureDescription, t, language],
  );
  const currentLanguageCode = normalizeLanguageTag(language) ?? 'de';
  const selectedCultureOriginalLanguageCode = selectedCulture
    ? getPublicCultureOriginalLanguageCode(selectedCulture, currentLanguageCode)
    : currentLanguageCode;
  const originalDescriptionDraft = selectedCulture
    ? descriptionDrafts[selectedCultureOriginalLanguageCode] ?? ''
    : '';
  const currentDescriptionDraft = selectedCulture
    ? descriptionDrafts[currentLanguageCode] ?? ''
    : '';
  const hasDescriptionDraftChanges = useMemo(() => {
    if (!selectedCulture) {
      return false;
    }
    const initialDrafts = buildPublicCultureDescriptionDrafts(selectedCulture);
    const originalChanged = (descriptionDrafts[selectedCultureOriginalLanguageCode] ?? '')
      !== (initialDrafts[selectedCultureOriginalLanguageCode] ?? '');
    const currentChanged = currentLanguageCode !== selectedCultureOriginalLanguageCode
      && (descriptionDrafts[currentLanguageCode] ?? '') !== (initialDrafts[currentLanguageCode] ?? '');
    return originalChanged || currentChanged;
  }, [currentLanguageCode, descriptionDrafts, selectedCulture, selectedCultureOriginalLanguageCode]);
  const selectedTopic = useMemo(
    () => topics.find((topic) => topic.id === selectedTopicId) ?? null,
    [selectedTopicId, topics],
  );
  const threadCommentTree = useMemo(() => buildThreadCommentTree(comments), [comments]);

  const registerReplyActionRef = useCallback((commentId: number, element: HTMLButtonElement | null): void => {
    if (element) {
      replyActionRefs.current.set(commentId, element);
      return;
    }
    replyActionRefs.current.delete(commentId);
  }, []);

  const registerCommentRef = useCallback((commentId: number, element: HTMLDivElement | null): void => {
    if (element) {
      commentRefs.current.set(commentId, element);
      return;
    }
    commentRefs.current.delete(commentId);
  }, []);

  const focusReplyAction = useCallback((commentId: number): void => {
    window.setTimeout(() => {
      replyActionRefs.current.get(commentId)?.focus();
    }, 0);
  }, []);

  const ensureDiscardableCommentDraft = useCallback((nextCommentId: number | null): boolean => {
    const hasActiveDraft = (replyTo !== null || editingCommentId !== null) && commentBody.trim().length > 0;
    const keepsCurrentTarget = nextCommentId !== null && (replyTo === nextCommentId || editingCommentId === nextCommentId);
    if (!hasActiveDraft || keepsCurrentTarget) {
      return true;
    }
    return window.confirm(t('library.page.discussion.discardDraftConfirm'));
  }, [commentBody, editingCommentId, replyTo, t]);

  const focusActiveCommentForm = useCallback((): void => {
    window.setTimeout(() => {
      activeCommentFormInputRef.current?.focus();
    }, 0);
  }, []);

  const selectedCropRowId = selectedCulture
    ? (isSpeciesView && selectedCultureSpeciesKey ? `species:${selectedCultureSpeciesKey}` : `culture:${selectedCulture.id}`)
    : null;

  const cultureListNavigation = useCultureListKeyboardNavigation({
    items: selectableCropRows,
    selectedId: selectedCropRowId,
    getId: (item) => item.id,
    onSelect: (item) => {
      if (item.culture?.id !== undefined) {
        updateSelectedCultureId(item.culture.id, { speciesViewKey: item.kind === 'species' ? item.speciesKey : null });
      }
    },
    autoFocusSelected: !useCompactLibraryLayout,
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

    if (!hasExplicitLibraryState) {
      const savedViewState = getStoredPublicCropLibraryViewState();
      if (savedViewState) {
        if (selectedCultureId !== savedViewState.cultureId) {
          setSelectedCultureId(savedViewState.cultureId);
          selectedCultureIdRef.current = savedViewState.cultureId;
          window.localStorage.setItem(SELECTED_PUBLIC_CULTURE_STORAGE_KEY, String(savedViewState.cultureId));
        }
        if (query !== savedViewState.query) {
          setQuery(savedViewState.query);
        }
        cultureListScrollTopRef.current = savedViewState.listScrollTop;
        navigateToLibraryState({
          cultureId: savedViewState.cultureId,
          tab: PUBLIC_CULTURE_TAB_INDEX_BY_PARAM[savedViewState.tab],
          discussionId: savedViewState.tab === 'discussion' ? savedViewState.discussionId : null,
          replace: true,
        });
        return;
      }
    }

    const storedCultureId = getStoredPublicCultureId();
    if (storedCultureId !== null) {
      if (selectedCultureId !== storedCultureId) {
        setSelectedCultureId(storedCultureId);
        selectedCultureIdRef.current = storedCultureId;
      }
      navigateToLibraryState({
        cultureId: storedCultureId,
        tab: activeTab,
        discussionId: null,
        replace: true,
      });
    }
  }, [activeTab, hasExplicitLibraryState, navigateToLibraryState, query, selectedCultureId, selectedCultureIdFromUrl]);

  useEffect(() => {
    if (!hasExplicitLibraryState || selectedCultureId === null) {
      return;
    }
    persistViewState();
  }, [hasExplicitLibraryState, persistViewState, selectedCultureId]);

  useEffect(() => {
    if (loadStatus !== 'success' || selectedCultureId === null || cultures.length === 0) {
      return;
    }

    const savedViewState = getStoredPublicCropLibraryViewState();
    if (!savedViewState || savedViewState.cultureId !== selectedCultureId) {
      return;
    }

    cultureListScrollTopRef.current = savedViewState.listScrollTop;
    window.setTimeout(() => {
      if (cultureListRef.current) {
        cultureListRef.current.scrollTop = savedViewState.listScrollTop;
      }
    }, 0);
  }, [cultures.length, loadStatus, selectedCultureId]);

  const loadCultures = useCallback(async (searchQuery: string): Promise<void> => {
    const requestId = cultureListRequestIdRef.current + 1;
    cultureListRequestIdRef.current = requestId;
    setLoadStatus('loading');
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
          if (requestId !== cultureListRequestIdRef.current) {
            return;
          }
          updateSelectedCultureId(null);
        }
      }
      if (requestId !== cultureListRequestIdRef.current) {
        return;
      }
      setCultures(applySavedCultures(results, savedCulturesRef.current));
      setLoadStatus('success');
    } catch {
      if (requestId !== cultureListRequestIdRef.current) {
        return;
      }
      setLoadError(t('library.loadError'));
      setCultures([]);
      updateSelectedCultureId(null);
      setLoadStatus('error');
    }
  }, [t, updateSelectedCultureId]);

  const loadCollaboration = useCallback(async (cultureId: number): Promise<void> => {
    const requestId = collaborationLoadRequestIdRef.current + 1;
    collaborationLoadRequestIdRef.current = requestId;
    setCollaborationStatus('loading');
    try {
      const [topicsResponse, versionsResponse] = await Promise.all([
        publicCultureAPI.discussionTopics(cultureId),
        publicCultureAPI.versions(cultureId),
      ]);
      if (requestId !== collaborationLoadRequestIdRef.current) {
        return;
      }
      setTopics(topicsResponse.data);
      setComments([]);
      setVersions(versionsResponse.data);
      setCollaborationStatus('success');
    } catch {
      if (requestId !== collaborationLoadRequestIdRef.current) {
        return;
      }
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
      setCommentsStatus('idle');
      return;
    }
    void loadCollaboration(selectedCultureId);
  }, [loadCollaboration, selectedCultureId]);

  useEffect(() => {
    if (selectedCultureId === null || selectedTopicId === null) {
      setComments([]);
      setCommentsStatus('idle');
      return;
    }
    if (collaborationStatus !== 'success') {
      return;
    }
    const topicExists = topics.some((topic) => topic.id === selectedTopicId);
    if (!topicExists) {
      navigateToLibraryState({
        cultureId: selectedCultureId,
        tab: PUBLIC_CULTURE_TAB_INDEX_BY_PARAM.discussion,
        discussionId: null,
        replace: true,
      });
      setComments([]);
      setCommentsStatus('idle');
      return;
    }

    let cancelled = false;
    setCommentsStatus('loading');
    publicCultureAPI.discussionComments(selectedCultureId, selectedTopicId)
      .then((response) => {
        if (!cancelled) {
          setComments(response.data);
          setCommentsStatus('success');
        }
      })
      .catch(() => {
        if (!cancelled) {
          setComments([]);
          setCommentsStatus('error');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [collaborationStatus, navigateToLibraryState, selectedCultureId, selectedTopicId, topics]);

  useEffect(() => {
    setCommentBody('');
    setTopicTitle('');
    setNewTopicOpen(false);
    setEditDialogOpen(false);
    setReplyTo(null);
    setEditingCommentId(null);
    setCommentBody('');
    setCommentActionMenu(null);
  }, [selectedCultureId]);

  useEffect(() => {
    if (!selectedCulture) {
      setDescriptionDrafts({});
      return;
    }
    setDescriptionDrafts(buildPublicCultureDescriptionDrafts(selectedCulture));
  }, [selectedCulture]);

  useEffect(() => {
    setReplyTo(null);
    setEditingCommentId(null);
    setCommentActionMenu(null);
    if (selectedTopicId !== null) {
      setNewTopicOpen(false);
      setTopicTitle('');
      setTopicRevision(undefined);
    }
  }, [selectedTopicId]);

  useEffect(() => {
    if (replyTo !== null || editingCommentId !== null) {
      focusActiveCommentForm();
    }
  }, [editingCommentId, focusActiveCommentForm, replyTo]);

  useEffect(() => {
    if (newTopicOpen) {
      window.setTimeout(() => {
        newTopicTitleInputRef.current?.focus();
      }, 0);
    }
  }, [newTopicOpen]);

  useEffect(() => {
    if (pendingFocusCommentId === null) {
      return;
    }
    const commentElement = commentRefs.current.get(pendingFocusCommentId);
    if (commentElement) {
      commentElement.focus();
      setPendingFocusCommentId(null);
    }
  }, [comments, pendingFocusCommentId]);

  const handleSearchSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    void loadCultures(query);
  };

  const performImport = useCallback(async (
    publicCultureId: number,
    name: string,
    mode?: 'update' | 'new',
  ): Promise<void> => {
    setImportingId(publicCultureId);
    try {
      const response = await publicCultureAPI.importToProject(publicCultureId, mode);
      const importedCulture = response.data.culture;
      setCultures((current) => current.map((culture) => (
        culture.id === publicCultureId
          ? {
            ...culture,
            project_import_status: {
              culture_id: importedCulture.id as number,
              culture_name: importedCulture.culture_display_name || importedCulture.name,
              is_modified_from_source: Boolean(importedCulture.is_modified_from_source),
            },
          }
          : culture
      )));
      if (mode === 'update') {
        showGlobalSnackbar({ message: t('library.importUpdatedForced', { name }), severity: 'success' });
      } else if (mode === 'new') {
        showGlobalSnackbar({ message: t('library.importedAsNew', { name }), severity: 'success' });
      } else if (response.data.operation === 'unchanged') {
        showGlobalSnackbar({ message: t('library.importUnchanged', { name }), severity: 'info' });
      } else if (response.data.operation === 'updated') {
        showGlobalSnackbar({ message: t('library.importUpdated', { name }), severity: 'success' });
      } else {
        showGlobalSnackbar({ message: t('library.importSuccess', { name }), severity: 'success' });
      }
      setImportConflict(null);
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 409) {
        const conflict = error.response.data as ImportPublicCultureConfirmationRequiredError | undefined;
        if (conflict?.code === 'import_requires_confirmation') {
          setImportConflict({ publicCultureId, name });
          return;
        }
      }
      showGlobalSnackbar({ message: t('library.importError'), severity: 'error' });
    } finally {
      setImportingId(null);
    }
  }, [t]);

  const handleImport = useCallback(async (): Promise<void> => {
    if (!selectedCulture) {
      return;
    }
    await performImport(selectedCulture.id, getCultureTitle(selectedCulture, t, language));
  }, [language, performImport, selectedCulture, t]);

  const closeImportConflictDialog = useCallback((): void => {
    if (importingId !== null) {
      return;
    }
    setImportConflict(null);
  }, [importingId]);

  const handleImportConflictUpdate = useCallback((): void => {
    if (!importConflict) {
      return;
    }
    void performImport(importConflict.publicCultureId, importConflict.name, 'update');
  }, [importConflict, performImport]);

  const handleImportConflictNew = useCallback((): void => {
    if (!importConflict) {
      return;
    }
    void performImport(importConflict.publicCultureId, importConflict.name, 'new');
  }, [importConflict, performImport]);

  const openEditDialog = useCallback((): void => {
    if (!selectedCulture) {
      return;
    }
    setEditDialogOpen(true);
  }, [selectedCulture]);

  const closeEditDialog = (): void => {
    setEditDialogOpen(false);
  };

  const openRemoveDialog = useCallback((): void => {
    if (!selectedCulture) {
      return;
    }
    setRemoveReason('');
    setRemoveDialogOpen(true);
  }, [selectedCulture]);

  const closeRemoveDialog = (): void => {
    if (removing) {
      return;
    }
    setRemoveDialogOpen(false);
    setRemoveReason('');
  };

  const handleConfirmRemove = async (): Promise<void> => {
    if (!selectedCulture || !removeReason) {
      return;
    }
    setRemoving(true);
    try {
      await publicCultureAPI.remove(selectedCulture.id, removeReason);
      showGlobalSnackbar({
        message: t('library.removeSuccess', { name: getCultureTitle(selectedCulture, t, language) }),
        severity: 'success',
      });
      setRemoveDialogOpen(false);
      setRemoveReason('');
      updateSelectedCultureId(null);
      await loadCultures(query);
    } catch {
      showGlobalSnackbar({ message: t('library.removeError'), severity: 'error' });
    } finally {
      setRemoving(false);
    }
  };

  const openModeration = useCallback((): void => {
    navigate('/app/public-library-moderation');
  }, [navigate]);

  const topbarContextActions = useMemo<TopbarContextAction[]>(() => (
    canModeratePublicLibrary
      ? [
        {
          id: 'public-crop-library-moderation',
          label: t('library.page.moderation.open'),
          ariaLabel: t('library.page.moderation.open'),
          onClick: openModeration,
          appearance: 'standard' as const,
        },
        ...(selectedCulture ? [{
          id: 'public-crop-library-remove',
          label: t('library.removeAction'),
          ariaLabel: t('library.removeAction'),
          onClick: openRemoveDialog,
          appearance: 'standard' as const,
        }] : []),
      ]
      : []
  ), [canModeratePublicLibrary, openModeration, openRemoveDialog, selectedCulture, t]);

  useTopbarContextActions(setTopbarContextActions, topbarContextActions);

  const commandSpecs = useMemo(() => createPublicCropLibraryCommandSpecs({
    t,
    cultures,
    focusSearch,
    goToRelativeCulture,
    handleImport: () => void handleImport(),
    openEditDialog,
    selectedCulture,
    importing: importingId !== null,
  }), [cultures, focusSearch, goToRelativeCulture, handleImport, importingId, openEditDialog, selectedCulture, t]);

  useRegisterCommands('public-crop-library-page', commandSpecs);

  const upsertCultureInList = (updatedCulture: PublicCulture): void => {
    cultureListRequestIdRef.current += 1;
    savedCulturesRef.current.set(updatedCulture.id, updatedCulture);
    setLoadError('');
    setLoadStatus('success');
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
      const draftWithOriginalNotes = {
        ...draft,
        notes: descriptionDrafts[selectedCultureOriginalLanguageCode] ?? '',
      };
      const response = await publicCultureAPI.update(
        selectedCulture.id,
        buildPublicCultureUpdatePayload(draftWithOriginalNotes, selectedCulture.version),
      );

      let updatedCulture = response.data;
      const initialDrafts = buildPublicCultureDescriptionDrafts(selectedCulture);
      const currentTranslationChanged = currentLanguageCode !== selectedCultureOriginalLanguageCode
        && (descriptionDrafts[currentLanguageCode] ?? '') !== (initialDrafts[currentLanguageCode] ?? '');
      if (currentTranslationChanged) {
        await publicCultureAPI.updateTranslations(selectedCulture.id, {
          [currentLanguageCode]: descriptionDrafts[currentLanguageCode] ?? '',
        });
        const refreshedResponse = await publicCultureAPI.get(selectedCulture.id);
        updatedCulture = refreshedResponse.data;
      }

      upsertCultureInList(updatedCulture);
      setEditDialogOpen(false);
      await loadCollaboration(updatedCulture.id);
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
          const updatedComment = await publicCultureAPI.updateDiscussionComment(selectedCulture.id, editingCommentId, commentBody.trim());
          setPendingFocusCommentId(updatedComment.data.id);
        } else {
          const createdComment = await publicCultureAPI.createDiscussionComment(selectedCulture.id, selectedTopicId, commentBody.trim(), replyTo ?? undefined);
          setPendingFocusCommentId(createdComment.data.id);
        }
        const response = await publicCultureAPI.discussionComments(selectedCulture.id, selectedTopicId);
        setComments(response.data);
      } else {
        const createdTopic = await publicCultureAPI.createDiscussionTopic(selectedCulture.id, { title: topicTitle.trim(), body: commentBody.trim(), revision: topicRevision });
        collaborationLoadRequestIdRef.current += 1;
        const [topicsResponse, commentsResponse] = await Promise.all([
          publicCultureAPI.discussionTopics(selectedCulture.id),
          publicCultureAPI.discussionComments(selectedCulture.id, createdTopic.data.id),
        ]);
        setTopics(topicsResponse.data);
        setComments(commentsResponse.data);
        setCommentsStatus('success');
        setCollaborationStatus('success');
        navigateToLibraryState({
          cultureId: selectedCulture.id,
          tab: PUBLIC_CULTURE_TAB_INDEX_BY_PARAM.discussion,
          discussionId: createdTopic.data.id,
          replace: false,
        });
        setNewTopicOpen(false);
        setTopicTitle('');
        setTopicRevision(undefined);
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

  const openTopic = (topicId: number): void => {
    if (!selectedCulture) return;
    if (!ensureDiscardableCommentDraft(null)) {
      return;
    }
    setReplyTo(null);
    setEditingCommentId(null);
    setCommentBody('');
    navigateToLibraryState({
      cultureId: selectedCulture.id,
      tab: PUBLIC_CULTURE_TAB_INDEX_BY_PARAM.discussion,
      discussionId: topicId,
      replace: false,
    });
  };

  const startDiscussionForVersion = (revision: PublicCultureRevision): void => {
    if (selectedCulture) {
      navigateToLibraryState({
        cultureId: selectedCulture.id,
        tab: PUBLIC_CULTURE_TAB_INDEX_BY_PARAM.discussion,
        discussionId: null,
        replace: false,
      });
    }
    setNewTopicOpen(true);
    setTopicRevision(revision.id);
  };

  const openNewTopicForm = (): void => {
    setNewTopicOpen(true);
    setTopicRevision(undefined);
  };

  const handleTabChange = (_event: unknown, value: number): void => {
    if (!selectedCulture) {
      return;
    }
    navigateToLibraryState({
      cultureId: selectedCulture.id,
      tab: value,
      discussionId: null,
      replace: false,
    });
    setReplyTo(null);
    setEditingCommentId(null);
    setCommentBody('');
    setCommentActionMenu(null);
    if (value !== PUBLIC_CULTURE_TAB_INDEX_BY_PARAM.discussion) {
      setNewTopicOpen(false);
      setTopicTitle('');
      setTopicRevision(undefined);
    }
  };

  const cancelNewTopicForm = (): void => {
    setNewTopicOpen(false);
    setTopicTitle('');
    setCommentBody('');
    setTopicRevision(undefined);
    window.setTimeout(() => {
      newTopicButtonRef.current?.focus();
    }, 0);
  };

  const deleteComment = async (commentId: number): Promise<void> => {
    if (!selectedCulture || !selectedTopicId) return;
    try {
      await publicCultureAPI.deleteDiscussionComment(selectedCulture.id, commentId);
      const [topicsResponse, commentsResponse] = await Promise.all([
        publicCultureAPI.discussionTopics(selectedCulture.id),
        publicCultureAPI.discussionComments(selectedCulture.id, selectedTopicId),
      ]);
      setTopics(topicsResponse.data);
      setComments(commentsResponse.data);
      if (!topicsResponse.data.some((topic) => topic.id === selectedTopicId)) {
        navigateToLibraryState({
          cultureId: selectedCulture.id,
          tab: PUBLIC_CULTURE_TAB_INDEX_BY_PARAM.discussion,
          discussionId: null,
          replace: true,
        });
      }
    } catch {
      showGlobalSnackbar({ message: t('library.page.discussion.commentError'), severity: 'error' });
    }
  };

  const showRootDeleteBlockedMessage = (): void => {
    showGlobalSnackbar({ message: t('library.page.discussion.rootDeleteBlocked'), severity: 'error' });
  };

  const startReply = (commentId: number): void => {
    if (!ensureDiscardableCommentDraft(commentId)) {
      return;
    }
    setReplyTo(commentId);
    setEditingCommentId(null);
    setCommentBody('');
  };

  const startEdit = (comment: PublicCultureDiscussionComment): void => {
    if (!ensureDiscardableCommentDraft(comment.id)) {
      return;
    }
    setEditingCommentId(comment.id);
    setReplyTo(null);
    setCommentBody(comment.body);
  };

  const cancelActiveCommentForm = (): void => {
    const focusCommentId = replyTo ?? editingCommentId;
    setReplyTo(null);
    setEditingCommentId(null);
    setCommentBody('');
    if (focusCommentId !== null) {
      focusReplyAction(focusCommentId);
    }
  };

  const closeSelectedTopic = (): void => {
    if (!ensureDiscardableCommentDraft(null)) {
      return;
    }
    setComments([]);
    setCommentsStatus('idle');
    setReplyTo(null);
    setEditingCommentId(null);
    setCommentBody('');
    navigateToLibraryState({
      cultureId: selectedCultureId,
      tab: PUBLIC_CULTURE_TAB_INDEX_BY_PARAM.discussion,
      discussionId: null,
      replace: false,
    });
  };

  const libraryCardSx = {
    borderRadius: 1,
    border: '1px solid',
    borderColor: 'divider',
    boxShadow: '0 8px 24px rgba(15, 23, 42, 0.08)',
    overflow: 'hidden',
    bgcolor: 'background.paper',
  } as const;

  const cropActions = selectedCulture ? (
    <DetailPageActions
      compact={useCompactLibraryLayout}
      primaryActions={[
        {
          label: t('library.page.edit.open'),
          icon: <EditOutlinedIcon fontSize="small" />,
          onClick: openEditDialog,
        },
        {
          label: importingId
            ? t('library.importing')
            : selectedCulture.project_import_status
              ? t('library.importUpdateButton')
              : t('library.importButton'),
          icon: selectedCulture.project_import_status
            ? <SyncOutlinedIcon fontSize="small" />
            : <DownloadOutlinedIcon fontSize="small" />,
          onClick: () => void handleImport(),
          disabled: importingId !== null,
          variant: 'contained',
        },
      ]}
    />
  ) : null;
  return (
    <PageContainer variant="xwide">
      <Box sx={{ width: '100%' }}>
        <Stack spacing={2}>
          {loadError ? <Alert severity="error">{loadError}</Alert> : null}

          <Box
            ref={libraryAreaRef}
            sx={{
              display: 'flex',
              flexDirection: { xs: 'column', md: 'row' },
              gap: { xs: 1.25, lg: 1.1, xl: 1.25 },
              height: { md: libraryAreaMaxHeight !== null ? `${libraryAreaMaxHeight}px` : 'calc(100vh - 210px)' },
            }}
          >
            {!useCompactLibraryLayout ? (
            <Card
              variant="outlined"
              sx={{
                ...libraryCardSx,
                width: { md: 230, lg: 300, xl: 330 },
                flexShrink: 0,
                height: { md: '100%' },
                // Flex items default to `min-height: auto`, which ignores the
                // parent's bounded height and lets content push the card taller
                // than its 100% instead of letting the inner list scroll.
                minHeight: { xs: 280, md: 0 },
                display: 'flex',
                flexDirection: 'column',
              }}
            >
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
              {isCultureLoading ? (
                <Box sx={{ minHeight: 220, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Stack spacing={1} alignItems="center">
                    <CircularProgress size={28} />
                    <Typography variant="body2" color="text.secondary">{t('messages.loadingCultures')}</Typography>
                  </Stack>
                </Box>
              ) : loadStatus === 'error' ? (
                <Box sx={{ p: 2 }}>
                  <Alert severity="error">{loadError}</Alert>
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
                  ref={cultureListRef}
                  {...cultureListNavigation.getListProps()}
                  dense
                  role="listbox"
                  aria-label={t('library.page.title')}
                  onScroll={handleCultureListScroll}
                  // MUI breakpoint values cascade upward when not overridden, so the
                  // mobile-only 280px cap must be explicitly cleared at md+ or it
                  // silently caps the list there too, leaving the flex-grown space
                  // below it blank no matter how tall the surrounding card is.
                  sx={{
                    py: { xs: 0.5, lg: 0.75 },
                    px: { xs: 0.5, lg: 0.75 },
                    maxHeight: { xs: 280, md: 'none' },
                    flex: { md: 1 },
                    minHeight: 0,
                    overflow: 'auto',
                  }}
                >
                  {visibleCropRows.map(({ node, depth, hasChildren }) => {
                    const culture = node.culture;
                    const itemProps = culture?.id !== undefined ? cultureListNavigation.getItemProps(node) : {};
                    const isRowSelected = Boolean(
                      culture?.id !== undefined
                      && culture.id === selectedCultureId
                      && (node.kind === 'species' ? isSpeciesView : !isSpeciesView),
                    );
                    return (
                    <ListItemButton
                      key={node.id}
                      {...itemProps}
                      role={culture ? 'option' : 'presentation'}
                      aria-label={node.kind === 'species'
                        ? node.label
                        : culture ? getPublicCultureTitle(culture, language, t('library.translation.missingName')) : undefined}
                      aria-selected={culture ? isRowSelected : undefined}
                      selected={isRowSelected}
                      disabled={!culture}
                      onClick={() => {
                        if (culture?.id !== undefined) {
                          updateSelectedCultureId(culture.id, {
                            replace: false,
                            speciesViewKey: node.kind === 'species' ? node.speciesKey : null,
                          });
                          cultureListNavigation.focusItem(node.id);
                        }
                      }}
                      onDoubleClick={(event) => {
                        if (!hasChildren) {
                          return;
                        }
                        event.preventDefault();
                        event.stopPropagation();
                        toggleCropRow(node.id);
                      }}
                      sx={{
                        borderRadius: 1.5,
                        ml: `calc(${depth * 1.75}rem)`,
                        pl: { xs: 0.75, lg: 0.875 },
                        pr: { xs: 0.875, lg: 1 },
                        py: { xs: 0.5, lg: 0.75 },
                        mb: { xs: 0.375, lg: 0.5 },
                        alignItems: 'flex-start',
                        border: '1px solid transparent',
                        '&:hover': { bgcolor: '#f4f8f4', borderColor: '#d6e6d8' },
                        '&.Mui-selected': {
                          bgcolor: 'rgba(37, 111, 42, 0.12)',
                          borderColor: 'rgba(37, 111, 42, 0.32)',
                        },
                        '&.Mui-selected:hover': { bgcolor: 'rgba(37, 111, 42, 0.16)' },
                      }}
                    >
                      <CropHierarchyExpandToggle
                        hasChildren={hasChildren}
                        isExpanded={expandedCropRows.has(node.id)}
                        onToggle={() => toggleCropRow(node.id)}
                        expandLabel={t('hierarchy.expandCrop')}
                        collapseLabel={t('hierarchy.collapseCrop')}
                        sx={desktopCropChevronButtonSx}
                      />
                      <ListItemText
                        primary={node.kind === 'species' ? node.label : node.label}
                        secondary={node.kind === 'species'
                          ? [
                            culture?.crop_family,
                            node.varietyCount > 0 ? t('hierarchy.varietyCount', { count: node.varietyCount }) : '',
                          ].filter(Boolean).join(' • ') || undefined
                          : (culture ? getCultivationTypeLabel(culture.cultivation_type, t, '') : '') || undefined}
                        primaryTypographyProps={{
                          fontSize: { xs: '0.9rem', lg: '0.95rem' },
                          fontWeight: node.kind === 'species' ? 700 : 500,
                          lineHeight: 1.25,
                        }}
                        secondaryTypographyProps={{ fontSize: { xs: '0.76rem', lg: '0.8rem' }, color: 'text.secondary', lineHeight: 1.25 }}
                      />
                    </ListItemButton>
                    );
                  })}
                </List>
              )}
            </Card>
            ) : null}

            <Box
              sx={{
                minWidth: 0,
                width: '100%',
                flex: { md: 1 },
                display: 'flex',
                justifyContent: 'flex-start',
                height: { md: '100%' },
              }}
            >
              <Card
                variant="outlined"
                sx={{
                  ...libraryCardSx,
                  width: '100%',
                  maxWidth: { sm: 920, lg: 980, xl: 1040 },
                  minHeight: 420,
                  // The card itself (not a wider wrapper spanning the full column) owns
                  // the bounded height and scroll, so its own scrollbar hugs the card's
                  // right edge instead of sitting far away at the wrapper's full width.
                  height: { md: '100%' },
                  overflowY: { md: 'auto' },
                }}
              >
                {isCultureLoading ? (
                  <Box sx={{ minHeight: 420, display: 'flex', alignItems: 'center', justifyContent: 'center', p: 3 }}>
                    <Stack spacing={1} alignItems="center">
                      <CircularProgress size={28} />
                      <Typography variant="body2" color="text.secondary">{t('messages.loadingCultures')}</Typography>
                    </Stack>
                  </Box>
                ) : loadStatus === 'error' ? (
                  <Box sx={{ p: { xs: 2, sm: 2.5 } }}>
                    <Alert severity="error">{loadError}</Alert>
                  </Box>
                ) : !selectedCulture ? (
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
                    {useCompactLibraryLayout && cultures.length > 0 ? (
                      <Button variant="outlined" onClick={() => setMobileSelectorOpen(true)}>
                        {t('selectCulture')}
                      </Button>
                    ) : null}
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
                    <Stack
                      data-testid="public-crop-detail-header"
                      direction="row"
                      spacing={1.5}
                      useFlexGap
                      flexWrap="wrap"
                      alignItems="flex-start"
                      justifyContent="space-between"
                    >
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
                          {useCompactLibraryLayout ? (
                            <CultureTitleSelectorButton
                              title={selectedCultureName.text}
                              ariaLabel={t('selectCulture')}
                              onClick={() => setMobileSelectorOpen(true)}
                              titleSx={{ fontSize: '1.5rem' }}
                            />
                          ) : (
                            <Typography variant="h5" component="h2" sx={{ fontWeight: 600, overflowWrap: 'anywhere', lineHeight: 1.2 }}>
                              {selectedCultureName.text}
                            </Typography>
                          )}
                          {selectedCulture.variety ? (
                            !isSpeciesView ? (
                              <Stack spacing={0.25} sx={{ mt: 0.5 }}>
                                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, textTransform: 'uppercase' }}>
                                  {t('hierarchy.varietyLabel')}
                                </Typography>
                                <Typography variant="body2" color="text.primary" sx={{ fontWeight: 600 }}>
                                  {selectedCulture.variety}
                                </Typography>
                              </Stack>
                            ) : null
                          ) : null}
                          <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ mt: 1 }}>
                            {/* Say plainly that this is another language's text
                                rather than letting an English name read as a
                                German translation. */}
                            {nameFallbackNotice ? (
                              <AppTooltip title={nameFallbackNotice.tooltip}>
                                <Chip
                                  size="small"
                                  icon={<TranslateOutlinedIcon fontSize="small" />}
                                  label={nameFallbackNotice.label}
                                  variant="outlined"
                                  color="warning"
                                />
                              </AppTooltip>
                            ) : null}
                            <Chip size="small" label={t('library.page.byAuthor', { author: selectedCulture.created_by_label || anonymousLabel })} variant="outlined" />
                          </Stack>
                        </Box>
                      </Box>
                      {cropActions ? (
                        <Box sx={{ flexShrink: 0, ml: 'auto' }}>
                          {cropActions}
                        </Box>
                      ) : null}
                    </Stack>
                  </CardContent>
                  <Divider />
                  <Tabs
                    value={activeTab}
                    onChange={handleTabChange}
                    variant={isMobile ? 'fullWidth' : 'scrollable'}
                    allowScrollButtonsMobile
                    sx={{ px: { xs: 1, sm: 2 } }}
                  >
                    <Tab icon={isMobile ? undefined : <SpaOutlinedIcon />} iconPosition="start" label={t('library.page.tabs.details')} />
                    <Tab icon={isMobile ? undefined : <HistoryOutlinedIcon />} iconPosition="start" label={t('library.page.tabs.versions')} />
                    <Tab
                      icon={isMobile ? undefined : <ForumOutlinedIcon />}
                      iconPosition="start"
                      label={t('library.page.tabs.discussion')}
                      onClick={() => {
                        if (selectedTopicId !== null) {
                          closeSelectedTopic();
                        }
                      }}
                    />
                  </Tabs>
                  <Divider />

                  {activeTab === 0 ? (
                    <Stack spacing={2.5} sx={{ p: { xs: 2, sm: 2.5 } }}>
                      {showVarietyValueLegend ? (
                        <VarietyValueLegend
                          sampleLabel={t('hierarchy.ownValueLegendSample')}
                          description={t('hierarchy.ownValueLegendDescription')}
                        />
                      ) : null}

                      <DetailSection title={t('library.page.sections.general')} outlined>
                        <DetailGrid>
                          <DetailRow label={t('library.page.fields.cropSpecies')} value={selectedCultureName.text || t('library.page.notSpecified')} />
                          {!isSpeciesView ? (
                            <DetailRow label={t('library.page.fields.variety')} value={selectedCulture.variety || t('library.page.notSpecified')} />
                          ) : null}
                          <DetailRow label={t('library.page.fields.cropFamily')} value={getPublicFieldValue('crop_family', selectedCulture.crop_family) || t('library.page.notSpecified')} source={getPublicFieldSource('crop_family')} />
                          <DetailRow
                            label={t('library.page.fields.nutrientDemand')}
                            value={getNutrientDemandLabel(getPublicFieldValue('nutrient_demand', selectedCulture.nutrient_demand), t, t('library.page.notSpecified'))}
                            source={getPublicFieldSource('nutrient_demand')}
                          />
                          <DetailRow
                            label={t('library.page.fields.cultivationType')}
                            value={getCultivationTypesLabel({
                              ...selectedCulture,
                              cultivation_types: getPublicFieldValue('cultivation_types', selectedCulture.cultivation_types),
                              cultivation_type: getPublicFieldValue('cultivation_type', selectedCulture.cultivation_type),
                            }, t, t('library.page.notSpecified'))}
                            source={getPublicFieldSource('cultivation_types') ?? getPublicFieldSource('cultivation_type')}
                          />
                        </DetailGrid>
                      </DetailSection>

                      <Divider />

                      <DetailSection title={t('library.page.sections.timing')}>
                        <DetailGrid>
                          <DetailRow label={t('library.page.fields.growthDurationDays')} value={formatDays(getPublicFieldValue('growth_duration_days', selectedCulture.growth_duration_days), locale, t('library.page.notSpecified'), t('library.page.units.days'))} source={getPublicFieldSource('growth_duration_days')} />
                          <DetailRow label={t('library.page.fields.harvestDurationDays')} value={formatDays(getPublicFieldValue('harvest_duration_days', selectedCulture.harvest_duration_days), locale, t('library.page.notSpecified'), t('library.page.units.days'))} source={getPublicFieldSource('harvest_duration_days')} />
                          <DetailRow label={t('library.page.fields.propagationDurationDays')} value={formatDays(getPublicFieldValue('propagation_duration_days', selectedCulture.propagation_duration_days), locale, t('library.page.notSpecified'), t('library.page.units.days'))} source={getPublicFieldSource('propagation_duration_days')} />
                        </DetailGrid>
                      </DetailSection>

                      <Divider />

                      <DetailSection title={t('library.page.sections.spacing')}>
                        <DetailGrid>
                          <DetailRow label={t('library.page.fields.distanceWithinRow')} value={formatMetersAsCentimeters(getPublicFieldValue('distance_within_row_m', selectedCulture.distance_within_row_m), locale, t('library.page.notSpecified'))} source={getPublicFieldSource('distance_within_row_m')} />
                          <DetailRow label={t('library.page.fields.rowSpacing')} value={formatMetersAsCentimeters(getPublicFieldValue('row_spacing_m', selectedCulture.row_spacing_m), locale, t('library.page.notSpecified'))} source={getPublicFieldSource('row_spacing_m')} />
                          <DetailRow label={t('library.page.fields.sowingDepth')} value={formatMetersAsCentimeters(getPublicFieldValue('sowing_depth_m', selectedCulture.sowing_depth_m), locale, t('library.page.notSpecified'))} source={getPublicFieldSource('sowing_depth_m')} />
                        </DetailGrid>
                      </DetailSection>

                      <Divider />

                      <DetailSection title={t('library.page.sections.seed')}>
                        <CultureSeedDetails
                          activeCultivationTypes={publicActiveCultivationTypes}
                          seedRateRows={publicSeedRateRows}
                          sowingSafetyPercent={getPublicFieldValue('sowing_calculation_safety_percent', selectedCulture.sowing_calculation_safety_percent)}
                          sowingSafetySource={getPublicFieldSource('sowing_calculation_safety_percent')}
                          seedingRequirement={getPublicFieldValue('seeding_requirement', selectedCulture.seeding_requirement)}
                          seedingRequirementSource={getPublicFieldSource('seeding_requirement')}
                          seedingRequirementType={getPublicFieldValue('seeding_requirement_type', selectedCulture.seeding_requirement_type)}
                          seedingRequirementTypeSource={getPublicFieldSource('seeding_requirement_type')}
                          thousandKernelWeightG={getPublicFieldValue('thousand_kernel_weight_g', selectedCulture.thousand_kernel_weight_g)}
                          thousandKernelWeightSource={getPublicFieldSource('thousand_kernel_weight_g')}
                          emptyValueLabel={t('library.page.notSpecified')}
                          locale={locale}
                          t={t}
                        />
                      </DetailSection>

                      <Divider />

                      <DetailSection title={t('library.page.sections.harvest')}>
                        <DetailGrid>
                          <DetailRow label={t('library.page.fields.harvestMethod')} value={getHarvestMethodLabel(getPublicFieldValue('harvest_method', selectedCulture.harvest_method), t, t('library.page.notSpecified'))} source={getPublicFieldSource('harvest_method')} />
                          <DetailRow label={t('library.page.fields.expectedYield')} value={getPublicFieldValue('expected_yield', selectedCulture.expected_yield) === null || getPublicFieldValue('expected_yield', selectedCulture.expected_yield) === undefined ? t('library.page.notSpecified') : `${formatLocalizedNumber(getPublicFieldValue('expected_yield', selectedCulture.expected_yield), locale, t('library.page.notSpecified'), { maximumFractionDigits: 2 })} kg`} source={getPublicFieldSource('expected_yield')} />
                          <DetailRow label={t('library.page.fields.allowDeviationDeliveryWeeks')} value={getPublicFieldValue('allow_deviation_delivery_weeks', selectedCulture.allow_deviation_delivery_weeks) ? t('library.page.boolean.yes') : t('library.page.boolean.no')} source={getPublicFieldSource('allow_deviation_delivery_weeks')} />
                        </DetailGrid>
                      </DetailSection>

                      <Divider />

                      <DetailSection title={t('library.page.sections.metadata')}>
                        <DetailGrid>
                          <DetailRow label={t('library.page.fields.originalLanguage')} value={getLanguageLabel(selectedCulture.original_language_code, i18n.resolvedLanguage ?? i18n.language, t('library.page.notSpecified'))} />
                          <DetailRow label={t('library.page.fields.publishedAt')} value={formatDate(selectedCulture.published_at)} />
                          <DetailRow label={t('library.page.fields.updatedAt')} value={formatDate(selectedCulture.updated_at)} />
                        </DetailGrid>
                      </DetailSection>

                      <Divider />

                      <DetailSection title={t('library.page.sections.notes')} outlined>
                        {/* The public description is translatable; when only
                            another language exists, say so instead of showing
                            it as if it were this language. */}
                        {descriptionFallbackNotice ? (
                          <Stack
                            direction={{ xs: 'column', sm: 'row' }}
                            spacing={1}
                            alignItems={{ xs: 'flex-start', sm: 'center' }}
                            sx={{ mb: 1 }}
                          >
                            <AppTooltip title={descriptionFallbackNotice.tooltip}>
                              <Chip
                                size="small"
                                icon={<TranslateOutlinedIcon fontSize="small" />}
                                label={descriptionFallbackNotice.label}
                                variant="outlined"
                                color="warning"
                              />
                            </AppTooltip>
                            {canEditPublicCulture ? (
                              <Button
                                size="small"
                                variant="outlined"
                                startIcon={<TranslateOutlinedIcon fontSize="small" />}
                                onClick={openEditDialog}
                              >
                                {t('library.translation.addTranslationAction', {
                                  language: getLanguageDisplayName(currentLanguageCode, language),
                                })}
                              </Button>
                            ) : null}
                          </Stack>
                        ) : null}
                        {selectedCultureDescription.text ? (
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
                              {stripCitationMarkers(selectedCultureDescription.text)}
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
                          {!newTopicOpen && topics.length > 0 ? (
                            <Button ref={newTopicButtonRef} variant="outlined" startIcon={<AddOutlinedIcon />} sx={{ alignSelf: 'flex-start' }} onClick={openNewTopicForm}>
                              {t('library.page.discussion.newTopic')}
                            </Button>
                          ) : null}
                          {newTopicOpen ? (
                            <Box component="form" onSubmit={(event) => void handleCommentSubmit(event)} sx={{ display: 'grid', gap: 1, pb: 1.25, borderBottom: '1px solid', borderColor: 'divider' }}>
                              <Typography variant="subtitle2">{t('library.page.discussion.newTopic')}</Typography>
                              <TextField inputRef={newTopicTitleInputRef} label={t('library.page.discussion.titleLabel')} value={topicTitle} onChange={(event) => setTopicTitle(event.target.value)} />
                              <TextField label={t('library.page.discussion.commentLabel')} value={commentBody} onChange={(event) => setCommentBody(event.target.value)} multiline minRows={2} maxRows={8} />
                              {topicRevision ? (
                                <Stack direction="row" spacing={1} alignItems="center">
                                  <Typography variant="caption" color="text.secondary">{t('library.page.discussion.versionReference')}</Typography>
                                  <Chip size="small" label={t('library.page.versions.versionTitle', { version: versions.find((version) => version.id === topicRevision)?.version })} />
                                </Stack>
                              ) : null}
                              <Stack direction="row" spacing={1}>
                                <Button type="submit" variant="contained" disabled={submittingComment || !topicTitle.trim() || !commentBody.trim()}>{t('library.page.discussion.create')}</Button>
                                <Button onClick={cancelNewTopicForm}>{t('library.page.discussion.cancel')}</Button>
                              </Stack>
                            </Box>
                          ) : null}
                          {topics.length === 0 && !newTopicOpen ? (
                            <Box sx={{ display: 'grid', gap: 1 }}>
                              <Box>
                                <Typography variant="subtitle2">{t('library.page.discussion.emptyTitle')}</Typography>
                                <Typography variant="body2" color="text.secondary">{t('library.page.discussion.empty')}</Typography>
                              </Box>
                              <Button ref={newTopicButtonRef} variant="outlined" startIcon={<AddOutlinedIcon />} sx={{ justifySelf: 'flex-start' }} onClick={openNewTopicForm}>
                                {t('library.page.discussion.newTopic')}
                              </Button>
                            </Box>
                          ) : topics.map((topic) => (
                            <ListItemButton
                              key={topic.id}
                              onClick={() => void openTopic(topic.id)}
                              sx={{
                                alignItems: 'flex-start',
                                borderBottom: '1px solid',
                                borderColor: 'divider',
                                borderRadius: 0,
                                cursor: 'pointer',
                                display: 'grid',
                                gap: 0.5,
                                gridTemplateColumns: { xs: '1fr', sm: 'minmax(0, 1fr) auto' },
                                px: 0,
                                py: 1.25,
                                '&:hover': { bgcolor: 'action.hover' },
                                '&.Mui-focusVisible': {
                                  boxShadow: (theme) => `inset 0 0 0 2px ${theme.palette.primary.main}`,
                                },
                              }}
                            >
                              <Box sx={{ minWidth: 0 }}>
                                <Typography variant="subtitle2" sx={{ overflowWrap: 'anywhere' }}>{topic.title}</Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {t('library.page.discussion.topicMeta', {
                                    author: topic.created_by_label || anonymousLabel,
                                    count: topic.comment_count,
                                    date: formatDate(topic.last_activity_at || topic.created_at),
                                  })}
                                </Typography>
                                {topic.last_comment_preview ? (
                                  <Typography
                                    variant="body2"
                                    color="text.secondary"
                                    sx={{
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      whiteSpace: 'nowrap',
                                      mt: 0.25,
                                    }}
                                  >
                                    {formatDiscussionPreview(topic.last_comment_preview)}
                                  </Typography>
                                ) : null}
                              </Box>
                              {topic.version ? (
                                <Chip
                                  size="small"
                                  label={t('library.page.versions.versionTitle', { version: topic.version })}
                                  sx={{ justifySelf: { xs: 'flex-start', sm: 'flex-end' }, mt: { xs: 0.25, sm: 0 } }}
                                />
                              ) : null}
                            </ListItemButton>
                          ))}
                        </Stack>
                      ) : (
                        <Stack spacing={2}>
                          <Button
                            size="small"
                            variant="text"
                            startIcon={<ArrowBackOutlinedIcon />}
                            sx={{ alignSelf: 'flex-start' }}
                            onClick={closeSelectedTopic}
                          >
                            {t('library.page.discussion.back')}
                          </Button>
                          <Typography variant="h6" component="h2">
                            {selectedTopic?.title}
                          </Typography>
                          {commentsStatus === 'loading' || !selectedTopic ? <CircularProgress size={24} /> : null}
                          {commentsStatus === 'error' ? <Alert severity="error">{t('library.page.collaborationLoadError')}</Alert> : null}
                          {commentsStatus !== 'loading' && commentsStatus !== 'error' && selectedTopic ? (
                            <Stack spacing={2.25}>
                              {threadCommentTree.map((node) => (
                                <ThreadCommentBranch
                                  key={node.comment.id}
                                  node={node}
                                  depth={0}
                                  anonymousLabel={anonymousLabel}
                                  formatDate={formatDate}
                                  replyTo={replyTo}
                                  editingCommentId={editingCommentId}
                                  commentActionMenu={commentActionMenu}
                                  submittingComment={submittingComment}
                                  commentBody={commentBody}
                                  t={t}
                                  onReply={startReply}
                                  onEdit={startEdit}
                                  onDelete={(commentId) => void deleteComment(commentId)}
                                  onDeleteBlocked={showRootDeleteBlockedMessage}
                                  onOpenMenu={(commentId, anchorElement) => setCommentActionMenu({ commentId, anchorElement })}
                                  onCloseMenu={() => setCommentActionMenu(null)}
                                  onCancelEdit={cancelActiveCommentForm}
                                  onCommentSubmit={(event) => void handleCommentSubmit(event)}
                                  onCommentBodyChange={setCommentBody}
                                  registerReplyActionRef={registerReplyActionRef}
                                  registerCommentRef={registerCommentRef}
                                  activeFormInputRef={activeCommentFormInputRef}
                                />
                              ))}
                            </Stack>
                          ) : null}
                          {replyTo === null && editingCommentId === null && commentsStatus !== 'loading' && commentsStatus !== 'error' && selectedTopic ? (
                            <CommentForm
                              body={commentBody}
                              disabled={submittingComment}
                              label={t('library.page.discussion.commentLabel')}
                              submitLabel={t('library.page.discussion.submit')}
                              t={t}
                              onBodyChange={setCommentBody}
                              onSubmit={(event) => void handleCommentSubmit(event)}
                            />
                          ) : null}
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
      <PublicCultureMobileSelectorDialog
        open={mobileSelectorOpen}
        query={query}
        cultures={cultures}
        loading={isCultureLoading}
        error={loadStatus === 'error' ? loadError : ''}
        selectedCultureId={selectedCultureId}
        selectedSpeciesViewKey={selectedSpeciesViewKey}
        listRef={cultureListRef}
        onClose={() => setMobileSelectorOpen(false)}
        onQueryChange={setQuery}
        onSearchSubmit={handleSearchSubmit}
        onSelect={selectMobileCulture}
        onListScroll={handleCultureListScroll}
      />
      {editDialogOpen && selectedCulture ? (
        <CultureForm
          culture={publicCultureToCultureFormData(selectedCulture)}
          cultures={editFormCultures}
          onSave={handleEditSave}
          onCancel={closeEditDialog}
          title={t('library.page.edit.title')}
          variant="publicLibrary"
          hasExternalChanges={hasDescriptionDraftChanges}
          extraSections={(
            <MultilingualTextFieldSection
              title={t('form.notes')}
              fieldLabel={t('form.notes')}
              originalLanguageCode={selectedCultureOriginalLanguageCode}
              currentLanguageCode={currentLanguageCode}
              originalValue={originalDescriptionDraft}
              translationValue={currentDescriptionDraft}
              translationPlaceholder={t('library.translation.descriptionPlaceholder')}
              onOriginalValueChange={(value) => setDescriptionDrafts((current) => ({
                ...current,
                [selectedCultureOriginalLanguageCode]: value,
              }))}
              onTranslationValueChange={(value) => setDescriptionDrafts((current) => ({
                ...current,
                [currentLanguageCode]: value,
              }))}
            />
          )}
        />
      ) : null}
      <Dialog open={removeDialogOpen} onClose={closeRemoveDialog} maxWidth="sm" fullWidth>
        <DialogTitle>{t('library.removeDialog.title')}</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
            {t('library.removeDialog.moderationMessage', {
              name: selectedCulture ? getCultureTitle(selectedCulture, t, language) : '',
            })}
          </Typography>
          <FormControl fullWidth size="small">
            <InputLabel id="public-culture-removal-reason-label">
              {t('library.removeDialog.reasonLabel')}
            </InputLabel>
            <Select
              labelId="public-culture-removal-reason-label"
              value={removeReason}
              label={t('library.removeDialog.reasonLabel')}
              onChange={(event) => setRemoveReason(event.target.value as PublicCultureRemovalReason)}
            >
              {([
                'accidental_publication',
                'test_data',
                'duplicate',
                'wrong_mapping',
                'unlawful_content',
                'other',
              ] as PublicCultureRemovalReason[]).map((reason) => (
                <MenuItem key={reason} value={reason}>
                  {t(`library.removeReasons.${reason}`)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, pt: 1 }}>
          <Button variant="outlined" onClick={closeRemoveDialog} disabled={removing}>
            {t('common:actions.cancel')}
          </Button>
          <Button
            color="error"
            variant="contained"
            disabled={!removeReason || removing}
            onClick={() => void handleConfirmRemove()}
          >
            {removing ? t('library.moderation.saving') : t('library.removeAction')}
          </Button>
        </DialogActions>
      </Dialog>
      <ImportConflictDialog
        open={importConflict !== null}
        cultureName={importConflict?.name ?? ''}
        busy={importingId !== null}
        t={t}
        onCancel={closeImportConflictDialog}
        onUpdate={handleImportConflictUpdate}
        onImportAsNew={handleImportConflictNew}
      />
    </PageContainer>
  );
}
