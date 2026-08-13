// API-token management for the account settings page.
//
// A token is bound to exactly one project and can never be pointed at another
// one, so the project is chosen at creation time and shown read-only
// afterwards. The plaintext value is displayed once, in a dialog the user has
// to dismiss deliberately — the backend stores only a hash and cannot show it
// again.

import {
  Alert,
  Box,
  Button,
  Chip,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { apiTokenAPI } from '../api/api';
import type { ApiToken, ApiTokenCreated, ApiTokenScope } from '../api/types';
import { extractApiErrorMessage } from '../api/errors';
import { useAuth } from '../auth/useAuth';
import { useTranslation } from '../i18n';
import { mediumStackedFieldSx, wideSingleColumnFieldSx } from '../components/forms/formLayout';
import { actionButtonSx } from './accountSettingsForm';
import { InlineEditor, SectionAlerts, SettingsCard } from './accountSettingsCards';

const SCOPES: ApiTokenScope[] = ['read', 'write', 'delete'];

const STATUS_COLOR: Record<ApiToken['status'], 'success' | 'default' | 'error'> = {
  active: 'success',
  expired: 'default',
  revoked: 'error',
};

/** Format an ISO timestamp for display, or return the placeholder for null. */
function formatMoment(value: string | null, fallback: string): string {
  if (!value) {
    return fallback;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed.toLocaleString();
}

function isInactiveToken(token: ApiToken): boolean {
  if (token.status === 'revoked' || token.status === 'expired' || token.revoked_at) {
    return true;
  }
  if (!token.expires_at) {
    return false;
  }
  const expiresAt = new Date(token.expires_at);
  return !Number.isNaN(expiresAt.getTime()) && expiresAt < new Date();
}

interface ApiTokenCardProps {
  token: ApiToken;
  onRevoke: (token: ApiToken) => void;
}

function ApiTokenCard({ token, onRevoke }: ApiTokenCardProps) {
  const { t } = useTranslation('account');

  return (
    <Stack
      component="li"
      direction={{ xs: 'column', sm: 'row' }}
      spacing={1}
      sx={{
        alignItems: { xs: 'flex-start', sm: 'center' },
        justifyContent: 'space-between',
        border: 1,
        borderColor: 'divider',
        borderRadius: 1,
        p: 1.5,
      }}
    >
      <Box sx={{ minWidth: 0 }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
          <Typography sx={{ fontWeight: 600 }}>{token.name}</Typography>
          <Chip
            size="small"
            label={t(`apiTokens.status.${token.status}`)}
            color={STATUS_COLOR[token.status]}
          />
          <Chip size="small" variant="outlined" label={t(`apiTokens.scopes.${token.scope}`)} />
        </Stack>
        <Typography variant="body2" color="text.secondary">
          {t('apiTokens.meta.project')}: {token.project_name} · {t('apiTokens.meta.prefix')}:{' '}
          <code>{token.token_prefix}…</code>
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {t('apiTokens.meta.created')}: {formatMoment(token.created_at, '–')} ·{' '}
          {t('apiTokens.meta.expires')}: {formatMoment(token.expires_at, t('apiTokens.meta.never'))} ·{' '}
          {t('apiTokens.meta.lastUsed')}: {formatMoment(token.last_used_at, t('apiTokens.meta.neverUsed'))}
        </Typography>
      </Box>
      {token.status === 'active' ? (
        <Button
          color="error"
          variant="outlined"
          size="small"
          sx={actionButtonSx}
          onClick={() => onRevoke(token)}
        >
          {t('apiTokens.actions.revoke')}
        </Button>
      ) : null}
    </Stack>
  );
}

interface ApiTokenListProps {
  tokens: ApiToken[];
  onRevoke: (token: ApiToken) => void;
}

function ApiTokenList({ tokens, onRevoke }: ApiTokenListProps) {
  return (
    <Stack spacing={1.5} component="ul" sx={{ listStyle: 'none', p: 0, m: 0 }}>
      {tokens.map((token) => (
        <ApiTokenCard key={token.id} token={token} onRevoke={onRevoke} />
      ))}
    </Stack>
  );
}

export default function AccountSettingsApiTokensCard() {
  const { t } = useTranslation('account');
  const { user } = useAuth();

  const [tokens, setTokens] = useState<ApiToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [createdToken, setCreatedToken] = useState<ApiTokenCreated | null>(null);
  const [inactiveTokensOpen, setInactiveTokensOpen] = useState(false);

  const [name, setName] = useState('');
  const [projectId, setProjectId] = useState<number | ''>('');
  const [scope, setScope] = useState<ApiTokenScope>('read');
  const [expiresAt, setExpiresAt] = useState('');

  const memberships = useMemo(() => user?.memberships ?? [], [user?.memberships]);

  const loadTokens = useCallback(async () => {
    setLoading(true);
    setListError(null);
    try {
      const response = await apiTokenAPI.list();
      setTokens(response.data);
    } catch (error) {
      setListError(extractApiErrorMessage(error, t, t('errors.generic')));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadTokens();
  }, [loadTokens]);

  useEffect(() => {
    if (projectId === '' && memberships.length > 0) {
      setProjectId(memberships[0].project_id);
    }
  }, [memberships, projectId]);

  const { activeTokens, inactiveTokens } = useMemo(() => {
    const nextActiveTokens: ApiToken[] = [];
    const nextInactiveTokens: ApiToken[] = [];

    for (const token of tokens) {
      if (isInactiveToken(token)) {
        nextInactiveTokens.push(token);
      } else {
        nextActiveTokens.push(token);
      }
    }

    return { activeTokens: nextActiveTokens, inactiveTokens: nextInactiveTokens };
  }, [tokens]);

  const resetForm = () => {
    setName('');
    setScope('read');
    setExpiresAt('');
    setFormError(null);
  };

  const closeForm = () => {
    setFormOpen(false);
    resetForm();
  };

  const handleCreate = async () => {
    if (!name.trim() || projectId === '') {
      return;
    }
    setSubmitting(true);
    setFormError(null);
    setMessage(null);
    try {
      const response = await apiTokenAPI.create({
        name: name.trim(),
        project: projectId,
        scope,
        // A date input yields a plain date; the API expects a timestamp, and
        // end-of-day keeps the token usable for the whole chosen day.
        expires_at: expiresAt ? new Date(`${expiresAt}T23:59:59`).toISOString() : null,
      });
      setCreatedToken(response.data);
      closeForm();
      await loadTokens();
    } catch (error) {
      setFormError(extractApiErrorMessage(error, t, t('errors.generic')));
    } finally {
      setSubmitting(false);
    }
  };

  const handleRevoke = async (token: ApiToken) => {
    setMessage(null);
    setListError(null);
    try {
      await apiTokenAPI.revoke(token.id);
      setMessage(t('apiTokens.revoked', { name: token.name }));
      await loadTokens();
    } catch (error) {
      setListError(extractApiErrorMessage(error, t, t('errors.generic')));
    }
  };

  const hasProjects = memberships.length > 0;

  return (
    <SettingsCard title={t('apiTokens.title')} description={t('apiTokens.description')} collapsible defaultExpanded>
      <Stack spacing={2}>
        <SectionAlerts message={message} error={listError} />

        {!hasProjects ? <Alert severity="info">{t('apiTokens.noProjects')}</Alert> : null}

        {loading ? (
          <Typography variant="body2" color="text.secondary">
            {t('apiTokens.loading')}
          </Typography>
        ) : tokens.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            {t('apiTokens.empty')}
          </Typography>
        ) : (
          <Stack spacing={1.5}>
            {activeTokens.length > 0 ? (
              <ApiTokenList tokens={activeTokens} onRevoke={(token) => void handleRevoke(token)} />
            ) : null}
            {inactiveTokens.length > 0 ? (
              <Box>
                <Button
                  type="button"
                  variant="text"
                  sx={actionButtonSx}
                  onClick={() => setInactiveTokensOpen((open) => !open)}
                  aria-expanded={inactiveTokensOpen}
                >
                  {t('apiTokens.inactiveToggle', { count: inactiveTokens.length })}
                </Button>
                <Collapse in={inactiveTokensOpen} unmountOnExit>
                  <Box sx={{ pt: 1.5 }}>
                    <ApiTokenList tokens={inactiveTokens} onRevoke={(token) => void handleRevoke(token)} />
                  </Box>
                </Collapse>
              </Box>
            ) : null}
          </Stack>
        )}

        <Box>
          {!formOpen ? (
            <Button
              variant="outlined"
              sx={actionButtonSx}
              disabled={!hasProjects}
              onClick={() => setFormOpen(true)}
            >
              {t('apiTokens.actions.create')}
            </Button>
          ) : null}
        </Box>

        <InlineEditor
          open={formOpen}
          saveLabel={t('apiTokens.actions.create')}
          onSave={() => void handleCreate()}
          onCancel={closeForm}
          submitting={submitting}
          saveDisabled={!name.trim() || projectId === ''}
        >
          {formError ? <Alert severity="error">{formError}</Alert> : null}
          <TextField
            label={t('apiTokens.form.name')}
            value={name}
            onChange={(event) => setName(event.target.value)}
            sx={wideSingleColumnFieldSx}
            slotProps={{ htmlInput: { maxLength: 120 } }}
          />
          <TextField
            select
            label={t('apiTokens.form.project')}
            value={projectId}
            onChange={(event) => setProjectId(Number(event.target.value))}
            sx={mediumStackedFieldSx}
            helperText={t('apiTokens.form.projectHelper')}
          >
            {memberships.map((membership) => (
              <MenuItem key={membership.project_id} value={membership.project_id}>
                {membership.project_name}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label={t('apiTokens.form.scope')}
            value={scope}
            onChange={(event) => setScope(event.target.value as ApiTokenScope)}
            sx={mediumStackedFieldSx}
            helperText={t(`apiTokens.scopeHelp.${scope}`)}
          >
            {SCOPES.map((value) => (
              <MenuItem key={value} value={value}>
                {t(`apiTokens.scopes.${value}`)}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            type="date"
            label={t('apiTokens.form.expiresAt')}
            value={expiresAt}
            onChange={(event) => setExpiresAt(event.target.value)}
            sx={mediumStackedFieldSx}
            helperText={t('apiTokens.form.expiresAtHelper')}
            slotProps={{ inputLabel: { shrink: true } }}
          />
        </InlineEditor>
      </Stack>

      <Dialog
        open={createdToken !== null}
        onClose={() => setCreatedToken(null)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>{t('apiTokens.created.title')}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Alert severity="warning">{t('apiTokens.created.warning')}</Alert>
            <DialogContentText>{t('apiTokens.created.description')}</DialogContentText>
            <TextField
              label={t('apiTokens.created.tokenLabel')}
              value={createdToken?.token ?? ''}
              multiline
              minRows={2}
              sx={wideSingleColumnFieldSx}
              slotProps={{ htmlInput: { readOnly: true, 'aria-label': t('apiTokens.created.tokenLabel') } }}
            />
            <DialogContentText>{t('apiTokens.created.usageHint')}</DialogContentText>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button variant="contained" onClick={() => setCreatedToken(null)}>
            {t('apiTokens.created.confirm')}
          </Button>
        </DialogActions>
      </Dialog>
    </SettingsCard>
  );
}
