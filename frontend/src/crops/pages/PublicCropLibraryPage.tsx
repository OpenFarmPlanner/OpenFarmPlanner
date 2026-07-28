import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode, type Ref } from 'react';
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
  Menu,
  MenuItem,
  Stack,
  Tab,
  Tabs,
  TextField,
  Tooltip,
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
const MAX_VISIBLE_REPLY_DEPTH = 3;

interface ThreadCommentGroup {
  comment: PublicCultureDiscussionComment;
  children: ThreadCommentGroup[];
}

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
              sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', mt: 0.5 }}
            >
              {comment.deleted_at ? t('library.page.discussion.deleted') : comment.body}
            </Typography>
          )}
        </Box>
        {!comment.deleted_at && !isEditing ? (
          <Stack direction="row" spacing={0.25} sx={{ mt: -0.5 }}>
            <Tooltip title={replyLabel}>
              <IconButton
                ref={(element: HTMLButtonElement | null) => registerReplyActionRef(comment.id, element)}
                size="small"
                aria-label={replyLabel}
                onClick={() => onReply(comment.id)}
              >
                <ReplyOutlinedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            {comment.can_edit ? (
              <>
                <Tooltip title={t('library.page.discussion.moreActions')}>
                  <IconButton
                    size="small"
                    aria-label={t('library.page.discussion.moreActions')}
                    aria-haspopup="menu"
                    aria-expanded={Boolean(menuAnchorElement)}
                    onClick={(event) => onOpenMenu(comment.id, event.currentTarget)}
                  >
                    <MoreVertOutlinedIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Menu
                  anchorEl={menuAnchorElement}
                  open={Boolean(menuAnchorElement)}
                  onClose={onCloseMenu}
                >
                  <MenuItem onClick={() => { onCloseMenu(); onEdit(comment); }}>{t('library.page.discussion.edit')}</MenuItem>
                  <MenuItem onClick={() => { onCloseMenu(); onDelete(comment.id); }} sx={{ color: 'error.main' }}>
                    {t('library.page.discussion.delete')}
                  </MenuItem>
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
  const newTopicButtonRef = useRef<HTMLButtonElement>(null);
  const newTopicTitleInputRef = useRef<HTMLInputElement>(null);
  const activeCommentFormInputRef = useRef<HTMLInputElement>(null);
  const replyActionRefs = useRef(new Map<number, HTMLButtonElement>());
  const commentRefs = useRef(new Map<number, HTMLDivElement>());
  const [commentActionMenu, setCommentActionMenu] = useState<{ commentId: number; anchorElement: HTMLElement } | null>(null);
  const [pendingFocusCommentId, setPendingFocusCommentId] = useState<number | null>(null);

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
    setReplyTo(null);
    setEditingCommentId(null);
    setCommentActionMenu(null);
  }, [selectedCultureId]);

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
        setSelectedTopicId(createdTopic.data.id);
        setComments(commentsResponse.data);
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

  const openTopic = async (topicId: number): Promise<void> => {
    if (!selectedCulture) return;
    if (!ensureDiscardableCommentDraft(null)) {
      return;
    }
    setSelectedTopicId(topicId);
    setReplyTo(null);
    setEditingCommentId(null);
    setCommentBody('');
    const response = await publicCultureAPI.discussionComments(selectedCulture.id, topicId);
    setComments(response.data);
  };

  const startDiscussionForVersion = (revision: PublicCultureRevision): void => {
    setActiveTab(2);
    setSelectedTopicId(null);
    setNewTopicOpen(true);
    setTopicRevision(revision.id);
  };

  const openNewTopicForm = (): void => {
    setNewTopicOpen(true);
    setTopicRevision(undefined);
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
    await publicCultureAPI.deleteDiscussionComment(selectedCulture.id, commentId);
    const response = await publicCultureAPI.discussionComments(selectedCulture.id, selectedTopicId);
    setComments(response.data);
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
    setSelectedTopicId(null);
    setComments([]);
    setReplyTo(null);
    setEditingCommentId(null);
    setCommentBody('');
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
                          <DetailRow label={t('library.page.fields.originalLanguage')} value={getLanguageLabel(selectedCulture.original_language_code, t, t('library.page.notSpecified'))} />
                          <DetailRow label={t('library.page.fields.publishedAt')} value={formatDate(selectedCulture.published_at)} />
                          <DetailRow label={t('library.page.fields.updatedAt')} value={formatDate(selectedCulture.updated_at)} />
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
                          {replyTo === null && editingCommentId === null ? (
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
