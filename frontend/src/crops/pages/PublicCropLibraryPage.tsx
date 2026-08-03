import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode, type Ref, type UIEvent } from 'react';
import { useLocation, useNavigate, useOutletContext, useSearchParams } from 'react-router';
import type { TFunction } from 'i18next';
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
  Divider,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Menu,
  MenuItem,
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
import MoreVertOutlinedIcon from '@mui/icons-material/MoreVertOutlined';
import ReplyOutlinedIcon from '@mui/icons-material/ReplyOutlined';
import RestoreOutlinedIcon from '@mui/icons-material/RestoreOutlined';
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined';
import SpaOutlinedIcon from '@mui/icons-material/SpaOutlined';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import { publicCultureAPI } from '../../api/api';
import type {
  CultivationType,
  Culture,
  PublicCulture,
  PublicCultureDiscussionComment,
  PublicCultureDiscussionTopic,
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
import { useOverlayHistory } from '../../hooks/useOverlayHistory';
import { useCommandContextTag, useRegisterCommands } from '../../commands/useCommandContext';
import type { RootLayoutOutletContext, TopbarContextAction } from '../../navigation/topbarTypes';
import { useTopbarContextActions } from '../../hooks/useTopbarContextActions';
import { createPublicCropLibraryCommandSpecs } from '../publicCropLibraryCommandSpecs';
import {
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
import { varietySpecificFieldAccentSx } from '../../cultures/varietyValueAccent';

type CollaborationLoadStatus = 'idle' | 'loading' | 'success' | 'error';
type PublicCultureLoadStatus = 'loading' | 'success' | 'error';
type PublicCultureTab = 'details' | 'versions' | 'discussion';

const SELECTED_PUBLIC_CULTURE_STORAGE_KEY = 'selectedPublicCultureId';
const PUBLIC_CROP_LIBRARY_VIEW_STATE_STORAGE_KEY = 'publicCropLibraryViewState';
const MAX_VISIBLE_REPLY_DEPTH = 3;
const PUBLIC_CULTURE_TAB_BY_INDEX: PublicCultureTab[] = ['details', 'versions', 'discussion'];
const PUBLIC_CULTURE_TAB_INDEX_BY_PARAM: Record<PublicCultureTab, number> = {
  details: 0,
  versions: 1,
  discussion: 2,
};
const cropChevronButtonSx = {
  width: 30,
  height: 30,
  minWidth: 30,
  p: 0,
  mr: 0.5,
  color: 'text.primary',
  opacity: 0.72,
  flexShrink: 0,
  '&:hover': {
    opacity: 1,
    bgcolor: 'rgba(37, 111, 42, 0.08)',
  },
} as const;
const desktopCropChevronButtonSx = {
  ...cropChevronButtonSx,
  mt: -0.375,
} as const;

interface ThreadCommentGroup {
  comment: PublicCultureDiscussionComment;
  children: ThreadCommentGroup[];
}

interface PublicCropLibraryViewState {
  cultureId: number;
  tab: PublicCultureTab;
  discussionId: number | null;
  query: string;
  listScrollTop: number;
}

function parsePublicCultureId(value: string | null): number | null {
  if (!value) {
    return null;
  }
  const parsedId = Number.parseInt(value, 10);
  return Number.isFinite(parsedId) ? parsedId : null;
}

function getPublicCultureTabIndex(tabParam: string | null, discussionId: number | null): number {
  if (discussionId !== null) {
    return PUBLIC_CULTURE_TAB_INDEX_BY_PARAM.discussion;
  }
  if (tabParam === 'versions' || tabParam === 'discussion') {
    return PUBLIC_CULTURE_TAB_INDEX_BY_PARAM[tabParam];
  }
  return PUBLIC_CULTURE_TAB_INDEX_BY_PARAM.details;
}

function getStoredPublicCultureId(): number | null {
  return parsePublicCultureId(window.localStorage.getItem(SELECTED_PUBLIC_CULTURE_STORAGE_KEY));
}

function isPublicCultureTab(value: unknown): value is PublicCultureTab {
  return value === 'details' || value === 'versions' || value === 'discussion';
}

function getStoredPublicCropLibraryViewState(): PublicCropLibraryViewState | null {
  const rawValue = window.localStorage.getItem(PUBLIC_CROP_LIBRARY_VIEW_STATE_STORAGE_KEY);
  if (!rawValue) {
    return null;
  }

  try {
    const parsedValue = JSON.parse(rawValue) as Partial<PublicCropLibraryViewState>;
    const cultureId = typeof parsedValue.cultureId === 'number' && Number.isFinite(parsedValue.cultureId)
      ? parsedValue.cultureId
      : null;
    if (cultureId === null || !isPublicCultureTab(parsedValue.tab)) {
      return null;
    }

    const discussionId = typeof parsedValue.discussionId === 'number' && Number.isFinite(parsedValue.discussionId)
      ? parsedValue.discussionId
      : null;
    const query = typeof parsedValue.query === 'string' ? parsedValue.query : '';
    const listScrollTop = typeof parsedValue.listScrollTop === 'number' && Number.isFinite(parsedValue.listScrollTop)
      ? Math.max(0, parsedValue.listScrollTop)
      : 0;

    return {
      cultureId,
      tab: parsedValue.tab,
      discussionId,
      query,
      listScrollTop,
    };
  } catch {
    return null;
  }
}

function storePublicCropLibraryViewState(viewState: PublicCropLibraryViewState): void {
  window.localStorage.setItem(PUBLIC_CROP_LIBRARY_VIEW_STATE_STORAGE_KEY, JSON.stringify(viewState));
}

/**
 * Entry title in the active UI language.
 *
 * The species name follows the translation fallback chain; the variety name is
 * a proper name and is appended verbatim in every language.
 */
const getCultureTitle = (culture: PublicCulture, t: TFunction, language: string): string =>
  getPublicCultureTitle(culture, language, t('library.translation.missingName'));

function getCommentTimestamp(comment: PublicCultureDiscussionComment): number {
  if (!comment.created_at) {
    return 0;
  }
  const timestamp = new Date(comment.created_at).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function compareComments(a: PublicCultureDiscussionComment, b: PublicCultureDiscussionComment): number {
  const timestampDifference = getCommentTimestamp(a) - getCommentTimestamp(b);
  return timestampDifference || a.id - b.id;
}

function buildThreadCommentTree(comments: PublicCultureDiscussionComment[]): ThreadCommentGroup[] {
  const nodesById = new Map<number, ThreadCommentGroup>();
  const rootNodes: ThreadCommentGroup[] = [];

  [...comments].sort(compareComments).forEach((comment) => {
    nodesById.set(comment.id, { comment, children: [] });
  });

  [...nodesById.values()].forEach((node) => {
    const parent = node.comment.parent ? nodesById.get(node.comment.parent) : undefined;
    if (!parent || parent.comment.id === node.comment.id) {
      rootNodes.push(node);
      return;
    }
    parent.children.push(node);
  });

  const sortTree = (nodes: ThreadCommentGroup[]): ThreadCommentGroup[] => (
    nodes.sort((a, b) => compareComments(a.comment, b.comment)).map((node) => ({
      ...node,
      children: sortTree(node.children),
    }))
  );

  return sortTree(rootNodes);
}

function getDeletedCommentPlaceholder(
  comment: PublicCultureDiscussionComment,
  t: (key: string, options?: Record<string, unknown>) => string,
): string {
  if (comment.deletion_kind === 'author') {
    return t('library.page.discussion.authorDeleted');
  }
  if (comment.deletion_kind === 'moderator') {
    return t('library.page.discussion.moderatorDeleted');
  }
  return t('library.page.discussion.deleted');
}

function formatDiscussionPreview(value?: string | null): string {
  return stripCitationMarkers(value ?? '')
    .replace(/[`*_>#~\-[\]()]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

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

function getLanguageLabel(code: string | null | undefined, displayLanguage: string, fallback: string): string {
  if (!code) {
    return fallback;
  }
  return getLanguageDisplayName(code, displayLanguage);
}

function getPublicCultureOriginalLanguageCode(culture: PublicCulture, currentLanguage: string): string {
  return normalizeLanguageTag(culture.original_language_code)
    ?? normalizeLanguageTag(culture.description_language_code)
    ?? normalizeLanguageTag(currentLanguage)
    ?? 'de';
}

function buildPublicCultureDescriptionDrafts(culture: PublicCulture): Record<string, string> {
  const translations = { ...(culture.translations ?? {}) };
  const servedLanguageCode = normalizeLanguageTag(culture.description_language_code);
  if (servedLanguageCode && !translations[servedLanguageCode] && culture.description) {
    translations[servedLanguageCode] = culture.description;
  }
  const originalLanguageCode = getPublicCultureOriginalLanguageCode(culture, culture.original_language_code ?? '');
  if (!translations[originalLanguageCode] && culture.notes) {
    translations[originalLanguageCode] = culture.notes;
  }
  return translations;
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

const isEmptyPublicValue = (value: unknown): boolean => (
  value === null
  || value === undefined
  || value === ''
  || (Array.isArray(value) && value.length === 0)
);

function arePublicValuesEqual(left: unknown, right: unknown): boolean {
  if (isEmptyPublicValue(left) && isEmptyPublicValue(right)) {
    return true;
  }
  if (typeof left === 'number' && typeof right === 'number') {
    return Math.abs(left - right) < Number.EPSILON;
  }
  if (Array.isArray(left) || Array.isArray(right) || (typeof left === 'object' && left !== null) || (typeof right === 'object' && right !== null)) {
    return JSON.stringify(left) === JSON.stringify(right);
  }
  return left === right;
}

interface DetailRowProps {
  label: string;
  value: string;
  source?: 'fromCrop' | 'ownValue' | null;
}

function DetailRow({ label, value, source = null }: DetailRowProps) {
  const ownValueSx = source === 'ownValue' ? varietySpecificFieldAccentSx : undefined;

  return (
    <Box sx={ownValueSx}>
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

interface CommentFormProps {
  body: string;
  disabled?: boolean;
  inputRef?: Ref<HTMLInputElement>;
  label: string;
  submitLabel: string;
  t: (key: string, options?: Record<string, unknown>) => string;
  onBodyChange: (body: string) => void;
  onCancel?: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

function CommentForm({
  body,
  disabled = false,
  inputRef,
  label,
  submitLabel,
  t,
  onBodyChange,
  onCancel,
  onSubmit,
}: CommentFormProps) {
  return (
    <Box component="form" onSubmit={onSubmit} sx={{ display: 'grid', gap: 1, maxWidth: 720 }}>
      <TextField
        inputRef={inputRef}
        label={label}
        value={body}
        onChange={(event) => onBodyChange(event.target.value)}
        multiline
        minRows={2}
        maxRows={8}
      />
      <Stack direction="row" spacing={1}>
        <Button type="submit" variant="contained" disabled={disabled || !body.trim()}>
          {submitLabel}
        </Button>
        {onCancel ? <Button onClick={onCancel}>{t('library.page.discussion.cancel')}</Button> : null}
      </Stack>
    </Box>
  );
}

interface DiscussionCommentProps {
  comment: PublicCultureDiscussionComment;
  anonymousLabel: string;
  formatDate: (value?: string | null) => string;
  isReply: boolean;
  logicalDepth: number;
  visualDepth: number;
  parentAuthorLabel?: string;
  isEditing: boolean;
  menuAnchorElement: HTMLElement | null;
  submittingComment: boolean;
  commentBody: string;
  t: (key: string, options?: Record<string, unknown>) => string;
  onReply: (commentId: number) => void;
  onEdit: (comment: PublicCultureDiscussionComment) => void;
  onDelete: (commentId: number) => void;
  onDeleteBlocked: () => void;
  onOpenMenu: (commentId: number, element: HTMLElement) => void;
  onCloseMenu: () => void;
  onCancelEdit: () => void;
  onCommentSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onCommentBodyChange: (body: string) => void;
  registerReplyActionRef: (commentId: number, element: HTMLButtonElement | null) => void;
  registerCommentRef: (commentId: number, element: HTMLDivElement | null) => void;
  activeFormInputRef: Ref<HTMLInputElement>;
}

function DiscussionComment({
  comment,
  anonymousLabel,
  formatDate,
  isReply,
  logicalDepth,
  visualDepth,
  parentAuthorLabel,
  isEditing,
  menuAnchorElement,
  submittingComment,
  commentBody,
  t,
  onReply,
  onEdit,
  onDelete,
  onDeleteBlocked,
  onOpenMenu,
  onCloseMenu,
  onCancelEdit,
  onCommentSubmit,
  onCommentBodyChange,
  registerReplyActionRef,
  registerCommentRef,
  activeFormInputRef,
}: DiscussionCommentProps) {
  const metaText = `${t('library.page.metaByDate', {
    author: comment.created_by_label || anonymousLabel,
    date: formatDate(comment.created_at),
  })}${comment.is_edited ? ` · ${t('library.page.discussion.edited')}` : ''}`;
  const authorLabel = comment.created_by_label || anonymousLabel;
  const replyLabel = t('library.page.discussion.replyToAuthor', { author: authorLabel });
  const deletedPlaceholder = getDeletedCommentPlaceholder(comment, t);
  const canShowDeleteAction = comment.can_delete || comment.delete_blocked_reason === 'visible_replies';

  return (
    <Box
      ref={(element: HTMLDivElement | null) => registerCommentRef(comment.id, element)}
      tabIndex={-1}
      data-comment-id={comment.id}
      data-logical-depth={logicalDepth}
      data-visual-depth={visualDepth}
      sx={{
        display: 'grid',
        gap: 0.5,
        outline: 0,
        py: isReply ? 1 : 0,
        '&:focus-visible': {
          borderRadius: 1,
          boxShadow: (theme) => `0 0 0 2px ${theme.palette.primary.main}`,
        },
      }}
    >
      <Box sx={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', columnGap: 1, alignItems: 'start' }}>
        <Box sx={{ minWidth: 0 }}>
          {isReply && parentAuthorLabel && logicalDepth > MAX_VISIBLE_REPLY_DEPTH ? (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.25 }}>
              {t('library.page.discussion.replyContext', { author: parentAuthorLabel })}
            </Typography>
          ) : null}
          <Typography variant="caption" color="text.secondary">
            {metaText}
          </Typography>
          {isEditing ? (
            <Box sx={{ mt: 1 }}>
              <CommentForm
                body={commentBody}
                disabled={submittingComment}
                inputRef={activeFormInputRef}
                label={t('library.page.discussion.commentLabel')}
                submitLabel={t('library.page.discussion.submit')}
                t={t}
                onBodyChange={onCommentBodyChange}
                onCancel={onCancelEdit}
                onSubmit={onCommentSubmit}
              />
            </Box>
          ) : (
            <Typography
              variant="body2"
              color={comment.deleted_at ? 'text.secondary' : 'text.primary'}
              aria-label={comment.deleted_at ? deletedPlaceholder : undefined}
              sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', mt: 0.5, fontStyle: comment.deleted_at ? 'italic' : 'normal' }}
            >
              {comment.deleted_at ? deletedPlaceholder : comment.body}
            </Typography>
          )}
        </Box>
        {!comment.deleted_at && !isEditing ? (
          <Stack direction="row" spacing={0.25} sx={{ mt: -0.5 }}>
            <AppTooltip title={replyLabel}>
              <IconButton
                ref={(element: HTMLButtonElement | null) => registerReplyActionRef(comment.id, element)}
                size="small"
                aria-label={replyLabel}
                onClick={() => onReply(comment.id)}
              >
                <ReplyOutlinedIcon fontSize="small" />
              </IconButton>
            </AppTooltip>
            {comment.can_edit || canShowDeleteAction ? (
              <>
                <AppTooltip title={t('library.page.discussion.moreActions')}>
                  <IconButton
                    size="small"
                    aria-label={t('library.page.discussion.moreActions')}
                    aria-haspopup="menu"
                    aria-expanded={Boolean(menuAnchorElement)}
                    onClick={(event) => onOpenMenu(comment.id, event.currentTarget)}
                  >
                    <MoreVertOutlinedIcon fontSize="small" />
                  </IconButton>
                </AppTooltip>
                <Menu
                  anchorEl={menuAnchorElement}
                  open={Boolean(menuAnchorElement)}
                  onClose={onCloseMenu}
                >
                  {comment.can_edit ? (
                    <MenuItem onClick={() => { onCloseMenu(); onEdit(comment); }}>{t('library.page.discussion.edit')}</MenuItem>
                  ) : null}
                  {canShowDeleteAction ? (
                    <MenuItem
                      onClick={() => {
                        onCloseMenu();
                        if (comment.delete_blocked_reason === 'visible_replies') {
                          onDeleteBlocked();
                          return;
                        }
                        onDelete(comment.id);
                      }}
                      sx={{ color: comment.can_delete ? 'error.main' : 'text.primary' }}
                    >
                      {t('library.page.discussion.delete')}
                    </MenuItem>
                  ) : null}
                </Menu>
              </>
            ) : null}
          </Stack>
        ) : null}
      </Box>
    </Box>
  );
}

interface ThreadCommentBranchProps {
  node: ThreadCommentGroup;
  depth: number;
  parentAuthorLabel?: string;
  anonymousLabel: string;
  formatDate: (value?: string | null) => string;
  replyTo: number | null;
  editingCommentId: number | null;
  commentActionMenu: { commentId: number; anchorElement: HTMLElement } | null;
  submittingComment: boolean;
  commentBody: string;
  t: (key: string, options?: Record<string, unknown>) => string;
  onReply: (commentId: number) => void;
  onEdit: (comment: PublicCultureDiscussionComment) => void;
  onDelete: (commentId: number) => void;
  onDeleteBlocked: () => void;
  onOpenMenu: (commentId: number, element: HTMLElement) => void;
  onCloseMenu: () => void;
  onCancelEdit: () => void;
  onCommentSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onCommentBodyChange: (body: string) => void;
  registerReplyActionRef: (commentId: number, element: HTMLButtonElement | null) => void;
  registerCommentRef: (commentId: number, element: HTMLDivElement | null) => void;
  activeFormInputRef: Ref<HTMLInputElement>;
}

function ThreadCommentBranch({
  node,
  depth,
  parentAuthorLabel,
  anonymousLabel,
  formatDate,
  replyTo,
  editingCommentId,
  commentActionMenu,
  submittingComment,
  commentBody,
  t,
  onReply,
  onEdit,
  onDelete,
  onDeleteBlocked,
  onOpenMenu,
  onCloseMenu,
  onCancelEdit,
  onCommentSubmit,
  onCommentBodyChange,
  registerReplyActionRef,
  registerCommentRef,
  activeFormInputRef,
}: ThreadCommentBranchProps) {
  const visualDepth = Math.min(depth, MAX_VISIBLE_REPLY_DEPTH);
  const childDepth = depth + 1;
  const childVisualDepth = Math.min(childDepth, MAX_VISIBLE_REPLY_DEPTH);
  const childIndentIncreases = childVisualDepth > visualDepth;
  const childAuthorLabel = node.comment.created_by_label || anonymousLabel;
  const hasChildGroup = node.children.length > 0 || replyTo === node.comment.id;

  return (
    <Box sx={{ display: 'grid', gap: 1 }}>
      <DiscussionComment
        comment={node.comment}
        anonymousLabel={anonymousLabel}
        formatDate={formatDate}
        isReply={depth > 0}
        logicalDepth={depth}
        visualDepth={visualDepth}
        parentAuthorLabel={parentAuthorLabel}
        isEditing={editingCommentId === node.comment.id}
        menuAnchorElement={commentActionMenu?.commentId === node.comment.id ? commentActionMenu.anchorElement : null}
        submittingComment={submittingComment}
        commentBody={commentBody}
        t={t}
        onReply={onReply}
        onEdit={onEdit}
        onDelete={onDelete}
        onDeleteBlocked={onDeleteBlocked}
        onOpenMenu={onOpenMenu}
        onCloseMenu={onCloseMenu}
        onCancelEdit={onCancelEdit}
        onCommentSubmit={onCommentSubmit}
        onCommentBodyChange={onCommentBodyChange}
        registerReplyActionRef={registerReplyActionRef}
        registerCommentRef={registerCommentRef}
        activeFormInputRef={activeFormInputRef}
      />
      {hasChildGroup ? (
        <Box
          role="group"
          aria-label={t('library.page.discussion.repliesForAuthor', { author: childAuthorLabel })}
          sx={{
            borderLeft: childIndentIncreases ? 2 : 0,
            borderColor: 'divider',
            display: 'grid',
            gap: 1,
            ml: childIndentIncreases ? { xs: 1, sm: 2 } : 0,
            pl: childIndentIncreases ? { xs: 1.25, sm: 1.75 } : 0,
          }}
        >
          {node.children.map((childNode) => (
            <ThreadCommentBranch
              key={childNode.comment.id}
              node={childNode}
              depth={childDepth}
              parentAuthorLabel={childAuthorLabel}
              anonymousLabel={anonymousLabel}
              formatDate={formatDate}
              replyTo={replyTo}
              editingCommentId={editingCommentId}
              commentActionMenu={commentActionMenu}
              submittingComment={submittingComment}
              commentBody={commentBody}
              t={t}
              onReply={onReply}
              onEdit={onEdit}
              onDelete={onDelete}
              onDeleteBlocked={onDeleteBlocked}
              onOpenMenu={onOpenMenu}
              onCloseMenu={onCloseMenu}
              onCancelEdit={onCancelEdit}
              onCommentSubmit={onCommentSubmit}
              onCommentBodyChange={onCommentBodyChange}
              registerReplyActionRef={registerReplyActionRef}
              registerCommentRef={registerCommentRef}
              activeFormInputRef={activeFormInputRef}
            />
          ))}
          {replyTo === node.comment.id ? (
            <CommentForm
              body={commentBody}
              disabled={submittingComment}
              inputRef={activeFormInputRef}
              label={t('library.page.discussion.replyLabel')}
              submitLabel={t('library.page.discussion.submit')}
              t={t}
              onBodyChange={onCommentBodyChange}
              onCancel={onCancelEdit}
              onSubmit={onCommentSubmit}
            />
          ) : null}
        </Box>
      ) : null}
    </Box>
  );
}

interface PublicCultureMobileSelectorDialogProps {
  open: boolean;
  query: string;
  cultures: PublicCulture[];
  loading: boolean;
  error: string;
  selectedCultureId: number | null;
  selectedSpeciesViewKey?: string | null;
  listRef: Ref<HTMLUListElement>;
  onClose: () => void;
  onQueryChange: (value: string) => void;
  onSearchSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onSelect: (culture: PublicCulture, itemKind: CropHierarchyItemKind, speciesKey: string) => void;
  onListScroll: (event: UIEvent<HTMLUListElement>) => void;
}

function PublicCultureMobileSelectorDialog({
  open,
  query,
  cultures,
  loading,
  error,
  selectedCultureId,
  selectedSpeciesViewKey = null,
  listRef,
  onClose,
  onQueryChange,
  onSearchSubmit,
  onSelect,
  onListScroll,
}: PublicCultureMobileSelectorDialogProps) {
  const { t, i18n } = useTranslation('cultures');
  const language = i18n.resolvedLanguage ?? i18n.language;
  const {
    expandedRows,
    toggleExpand,
    ensureExpanded,
  } = useExpandedState('publicCropLibraryMobile');
  const hierarchyItems = useMemo(() => buildCropHierarchy(cultures), [cultures]);
  useEffect(() => {
    const selectedVariety = hierarchyItems.find((item) => (
      item.kind === 'variety'
      && item.culture?.id === selectedCultureId
      && selectedSpeciesViewKey !== item.speciesKey
    ));
    if (!selectedVariety?.parentId) {
      return;
    }
    ensureExpanded(selectedVariety.parentId);
  }, [ensureExpanded, hierarchyItems, selectedCultureId, selectedSpeciesViewKey]);
  const visibleRows = useMemo(
    () => flattenTreeRows(hierarchyItems, { expandedIds: expandedRows }),
    [expandedRows, hierarchyItems],
  );

  useOverlayHistory({
    open,
    onClose,
    historyKey: 'openFarmPlannerPublicCultureSelector',
  });

  return (
    <Dialog fullScreen open={open} onClose={onClose}>
      <DialogTitle>{t('selectCulture')}</DialogTitle>
      <DialogContent sx={{ px: 1.5, pb: 2 }}>
        <Box component="form" onSubmit={onSearchSubmit} sx={{ mb: 1.5 }}>
          <TextField
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            label={t('library.searchLabel')}
            size="medium"
            fullWidth
          />
        </Box>
        {loading ? (
          <Box sx={{ minHeight: 220, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Stack spacing={1} alignItems="center">
              <CircularProgress size={28} />
              <Typography variant="body2" color="text.secondary">{t('messages.loadingCultures')}</Typography>
            </Stack>
          </Box>
        ) : error ? (
          <Alert severity="error">{error}</Alert>
        ) : cultures.length === 0 ? (
          <Box sx={{ p: 2, textAlign: 'center' }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
              {t('library.emptyState.noResultsTitle')}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
              {t('library.empty')}
            </Typography>
          </Box>
        ) : (
          <List
            ref={listRef}
            dense
            disablePadding
            role="listbox"
            aria-label={t('library.page.title')}
            onScroll={onListScroll}
            sx={{ py: 0.5, px: 0.25, overflowY: 'auto' }}
          >
            {visibleRows.map(({ node, depth, hasChildren }) => {
              const culture = node.culture;
              const isRowSelected = Boolean(
                culture?.id !== undefined
                && culture.id === selectedCultureId
                && (node.kind === 'species'
                  ? selectedSpeciesViewKey === node.speciesKey || !(culture.variety || '').trim()
                  : selectedSpeciesViewKey !== node.speciesKey),
              );
              return (
              <ListItemButton
                key={`mobile-public-${node.id}`}
                role={culture ? 'option' : 'presentation'}
                aria-label={node.kind === 'species'
                  ? node.label
                  : culture ? getPublicCultureTitle(culture, language, t('library.translation.missingName')) : undefined}
                aria-selected={culture ? isRowSelected : undefined}
                selected={isRowSelected}
                disabled={!culture}
                onClick={() => {
                  if (culture) {
                    onSelect(culture, node.kind, node.speciesKey);
                  }
                }}
                onDoubleClick={(event) => {
                  if (!hasChildren) {
                    return;
                  }
                  event.preventDefault();
                  event.stopPropagation();
                  toggleExpand(node.id);
                }}
                sx={{ borderRadius: 1.25, mb: 0.375, pl: `calc(${0.75 + depth * 0.85}rem)` }}
              >
                {hasChildren ? (
                  <IconButton
                    size="small"
                    aria-label={expandedRows.has(node.id) ? t('hierarchy.collapseCrop') : t('hierarchy.expandCrop')}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      toggleExpand(node.id);
                    }}
                    onDoubleClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                    }}
                    sx={cropChevronButtonSx}
                  >
                    {expandedRows.has(node.id) ? <KeyboardArrowDownIcon fontSize="small" /> : <KeyboardArrowRightIcon fontSize="small" />}
                  </IconButton>
                ) : (
                  <Box component="span" sx={{ width: 24, flexShrink: 0 }} />
                )}
                <ListItemText
                  primary={node.kind === 'species' ? node.label : node.label}
                  secondary={node.kind === 'species'
                    ? [
                      culture?.crop_family,
                      node.varietyCount > 0 ? t('hierarchy.varietyCount', { count: node.varietyCount }) : '',
                    ].filter(Boolean).join(' • ') || undefined
                    : undefined}
                  primaryTypographyProps={{ fontSize: '0.95rem', fontWeight: node.kind === 'species' ? 700 : 500 }}
                  secondaryTypographyProps={{ fontSize: '0.8rem', color: 'text.secondary' }}
                />
              </ListItemButton>
              );
            })}
          </List>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 1.5, py: 1 }}>
        <Button onClick={onClose}>{t('common:actions.cancel')}</Button>
      </DialogActions>
    </Dialog>
  );
}

export default function PublicCropLibraryPage() {
  const { user } = useAuth();
  const { t, i18n } = useTranslation('cultures');
  const language = i18n.resolvedLanguage ?? i18n.language;
  const outletContext = useOutletContext<RootLayoutOutletContext | null>();
  const setTopbarContextActions = outletContext?.setTopbarContextActions;
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
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
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [descriptionDrafts, setDescriptionDrafts] = useState<Record<string, string>>({});
  const [mobileSelectorOpen, setMobileSelectorOpen] = useState(false);
  const [selectedSpeciesViewKey, setSelectedSpeciesViewKey] = useState<string | null>(null);
  const [revertingVersion, setRevertingVersion] = useState<number | null>(null);
  const isMobile = useMediaQuery('(max-width:600px)');
  const useCompactLibraryLayout = useMediaQuery('(max-width:899.95px)');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const cultureListRef = useRef<HTMLUListElement>(null);
  const cultureListScrollTopRef = useRef<number>(storedViewState?.listScrollTop ?? 0);
  const cultureListRequestIdRef = useRef(0);
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
    const nextParams = new URLSearchParams(location.search);
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
      { replace },
    );
  }, [activeTab, location.hash, location.pathname, location.search, navigate]);

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
  const selectedSpeciesCulture = useMemo(
    () => findSpeciesCulture(selectedCulture, cultures),
    [cultures, selectedCulture],
  );
  const getPublicFieldValue = <TValue,>(field: keyof PublicCulture, value: TValue): TValue => {
    if (
      selectedCulture?.variety
      && !isSpeciesView
      && selectedSpeciesCulture
      && isEmptyPublicValue(value)
    ) {
      return selectedSpeciesCulture[field] as TValue;
    }
    return value;
  };
  const getPublicFieldSource = (field: keyof PublicCulture): ValueSource | null => {
    if (isSpeciesView || !selectedCulture?.variety || !selectedSpeciesCulture) {
      return null;
    }
    const ownValue = selectedCulture[field];
    if (isEmptyPublicValue(ownValue)) {
      return null;
    }
    const cropValue = selectedSpeciesCulture[field];
    return arePublicValuesEqual(ownValue, cropValue) ? null : 'ownValue';
  };
  const showVarietyValueLegend = Boolean(!isSpeciesView && selectedCulture?.variety && selectedSpeciesCulture);
  const publicActiveCultivationTypes: CultivationType[] = selectedCulture
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
    : [];
  const publicSeedRateRows: CultureSeedRateRow[] = selectedCulture
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
    : [];
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
    setCollaborationStatus('loading');
    try {
      const [topicsResponse, versionsResponse] = await Promise.all([
        publicCultureAPI.discussionTopics(cultureId),
        publicCultureAPI.versions(cultureId),
      ]);
      setTopics(topicsResponse.data);
      setComments([]);
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

  const handleImport = useCallback(async (): Promise<void> => {
    if (!selectedCulture) {
      return;
    }
    setImportingId(selectedCulture.id);
    try {
      await publicCultureAPI.importToProject(selectedCulture.id);
      showGlobalSnackbar({ message: t('library.importSuccess', { name: getCultureTitle(selectedCulture, t, language) }), severity: 'success' });
    } catch {
      showGlobalSnackbar({ message: t('library.importError'), severity: 'error' });
    } finally {
      setImportingId(null);
    }
  }, [language, selectedCulture, t]);

  const openEditDialog = useCallback((): void => {
    if (!selectedCulture) {
      return;
    }
    setEditDialogOpen(true);
  }, [selectedCulture]);

  const closeEditDialog = (): void => {
    setEditDialogOpen(false);
  };

  const openModeration = useCallback((): void => {
    navigate('/app/public-library-moderation');
  }, [navigate]);

  const topbarContextActions = useMemo<TopbarContextAction[]>(() => (
    canModeratePublicLibrary
      ? [{
        id: 'public-crop-library-moderation',
        label: t('library.page.moderation.open'),
        ariaLabel: t('library.page.moderation.open'),
        onClick: openModeration,
        appearance: 'standard' as const,
      }]
      : []
  ), [canModeratePublicLibrary, openModeration, t]);

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
        const [topicsResponse, commentsResponse] = await Promise.all([
          publicCultureAPI.discussionTopics(selectedCulture.id),
          publicCultureAPI.discussionComments(selectedCulture.id, createdTopic.data.id),
        ]);
        setTopics(topicsResponse.data);
        setComments(commentsResponse.data);
        setCommentsStatus('success');
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
          label: importingId ? t('library.importing') : t('library.importButton'),
          icon: <DownloadOutlinedIcon fontSize="small" />,
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
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: '1fr',
                md: '230px minmax(0, 1fr)',
                lg: '300px minmax(0, 1fr)',
                xl: '330px minmax(0, 1fr)',
              },
              gap: { xs: 1.25, lg: 1.1, xl: 1.25 },
              alignItems: 'start',
              minHeight: { md: 560 },
            }}
          >
            {!useCompactLibraryLayout ? (
            <Card
              variant="outlined"
              sx={{
                ...libraryCardSx,
                minHeight: 280,
                maxHeight: { md: 'calc(100vh - 210px)' },
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
                  disablePadding
                  role="listbox"
                  aria-label={t('library.page.title')}
                  onScroll={handleCultureListScroll}
                  sx={{ maxHeight: { xs: 280, md: 'calc(100vh - 290px)' }, overflow: 'auto' }}
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
                        borderBottom: '1px solid',
                        borderColor: 'divider',
                        alignItems: 'flex-start',
                        pl: `calc(${1.5 + depth * 0.85}rem)`,
                        pr: 1.5,
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
                      {hasChildren ? (
                        <IconButton
                          size="small"
                          aria-label={expandedCropRows.has(node.id) ? t('hierarchy.collapseCrop') : t('hierarchy.expandCrop')}
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            toggleCropRow(node.id);
                          }}
                          onDoubleClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                          }}
                          sx={desktopCropChevronButtonSx}
                        >
                          {expandedCropRows.has(node.id) ? <KeyboardArrowDownIcon fontSize="small" /> : <KeyboardArrowRightIcon fontSize="small" />}
                        </IconButton>
                      ) : (
                        <Box component="span" sx={{ width: 24, flexShrink: 0 }} />
                      )}
                      <ListItemText
                        primary={node.kind === 'species' ? node.label : node.label}
                        secondary={node.kind === 'species'
                          ? [
                            culture?.crop_family,
                            node.varietyCount > 0 ? t('hierarchy.varietyCount', { count: node.varietyCount }) : '',
                          ].filter(Boolean).join(' • ') || undefined
                          : culture?.supplier_name || culture?.seed_supplier || undefined}
                        primaryTypographyProps={{ fontWeight: node.kind === 'species' ? 700 : 500, noWrap: true }}
                        secondaryTypographyProps={{ noWrap: true }}
                      />
                    </ListItemButton>
                    );
                  })}
                </List>
              )}
            </Card>
            ) : null}

            <Box sx={{ minWidth: 0, width: '100%', display: 'flex', justifyContent: 'flex-start' }}>
              <Card variant="outlined" sx={{ ...libraryCardSx, width: '100%', maxWidth: { sm: 920, lg: 980, xl: 1040 }, minHeight: 420 }}>
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
                        <VarietyValueLegend label={t('hierarchy.ownValueLegend')} />
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
    </PageContainer>
  );
}
