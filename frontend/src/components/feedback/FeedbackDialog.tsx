/**
 * In-app user feedback form, opened from the global menu. Unrelated to the
 * snackbar/confirmation components in this folder: those give feedback *to*
 * the user, this one collects feedback *from* them.
 */
import { useEffect, useId, useState, type FormEvent } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutlineOutlined';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import MailOutlineIcon from '@mui/icons-material/MailOutlineOutlined';
import { feedbackAPI, type FeedbackCategory } from '../../api/api';
import { useTranslation } from '../../i18n';
import { AppTooltip } from '../AppTooltip';
import {
  segmentedToggleButtonGroupSx,
  segmentedToggleButtonSx,
} from '../buttons/segmentedControlStyles';

const CATEGORIES: FeedbackCategory[] = ['bug', 'idea', 'question', 'other'];

interface FeedbackDialogProps {
  open: boolean;
  /** Active project name; empty when the user has no project selected. */
  projectName: string;
  /** Current route, shown in the context box and sent along. */
  route: string;
  /** Account email — only transmitted when the user allows being contacted. */
  userEmail: string;
  onClose: () => void;
}

function describeBrowser(): string {
  if (typeof window === 'undefined') {
    return '';
  }
  return `${window.navigator.userAgent} – ${window.innerWidth}x${window.innerHeight}`;
}

export function FeedbackDialog({ open, projectName, route, userEmail, onClose }: FeedbackDialogProps) {
  const { t } = useTranslation('feedback');
  const [category, setCategory] = useState<FeedbackCategory | ''>('');
  const [message, setMessage] = useState('');
  const [contactConsent, setContactConsent] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState('');
  const [isSent, setIsSent] = useState(false);
  const titleId = useId();

  useEffect(() => {
    if (!open) {
      return;
    }
    setCategory('');
    setMessage('');
    setContactConsent(false);
    setIsSending(false);
    setError('');
    setIsSent(false);
  }, [open]);

  const canSubmit = message.trim().length > 0 && !isSending;

  const submitFeedback = async (): Promise<void> => {
    if (!canSubmit) {
      return;
    }
    try {
      setIsSending(true);
      setError('');
      await feedbackAPI.submit({
        category,
        message: message.trim(),
        project_name: projectName,
        route,
        browser_info: describeBrowser(),
        contact_consent: contactConsent,
      });
      setIsSent(true);
    } catch (submitError) {
      console.error('Error sending feedback', submitError);
      setError(t('dialog.error'));
    } finally {
      setIsSending(false);
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    void submitFeedback();
  };

  const handleClose = (): void => {
    if (!isSending) {
      onClose();
    }
  };

  if (isSent) {
    return (
      <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm" aria-labelledby={titleId}>
        <DialogContent>
          <Stack spacing={1.5} sx={{ alignItems: 'center', textAlign: 'center', py: 2 }}>
            <CheckCircleOutlineIcon fontSize="large" sx={{ color: 'primary.main' }} />
            <Typography id={titleId} variant="h6" component="h2">{t('success.title')}</Typography>
            <Typography variant="body2" color="text.secondary">{t('success.text')}</Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button variant="contained" onClick={onClose}>{t('success.close')}</Button>
        </DialogActions>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm" aria-labelledby={titleId}>
      <Box component="form" onSubmit={handleSubmit}>
        <DialogTitle id={titleId} sx={{ pb: 0.5 }}>{t('dialog.title')}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {t('dialog.subtitle')}
          </Typography>

          <Typography variant="subtitle2" component="p" sx={{ mb: 1 }}>
            {t('dialog.categoryLabel')}
          </Typography>
          <ToggleButtonGroup
            exclusive
            size="small"
            value={category}
            aria-label={t('dialog.categoryAriaLabel')}
            onChange={(_event, next: FeedbackCategory | null) => setCategory(next ?? '')}
            sx={{ ...segmentedToggleButtonGroupSx, mb: 2, flexWrap: 'wrap' }}
          >
            {CATEGORIES.map((value) => (
              <ToggleButton key={value} value={value} sx={segmentedToggleButtonSx}>
                {t(`dialog.categories.${value}`)}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>

          <TextField
            fullWidth
            required
            multiline
            minRows={4}
            label={t('dialog.messageLabel')}
            placeholder={t('dialog.messagePlaceholder')}
            value={message}
            disabled={isSending}
            onChange={(event) => setMessage(event.target.value)}
          />

          <Box
            sx={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 1,
              mt: 2,
              p: 1.5,
              borderRadius: 1,
              bgcolor: 'action.hover',
            }}
          >
            <InfoOutlinedIcon fontSize="small" sx={{ color: 'text.secondary' }} />
            <Typography variant="caption" color="text.secondary">
              {t('dialog.context', {
                project: projectName || t('dialog.contextNoProject'),
                route,
              })}
            </Typography>
          </Box>

          <Box sx={{ mt: 2 }}>
            <FormControlLabel
              control={(
                <Checkbox
                  checked={contactConsent}
                  disabled={isSending}
                  onChange={(event) => setContactConsent(event.target.checked)}
                />
              )}
              label={t('dialog.contactConsent')}
            />
            <Typography variant="caption" color="text.secondary" component="p" sx={{ ml: 4 }}>
              {t('dialog.contactConsentHint')}
            </Typography>
            {contactConsent ? (
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center', ml: 4, mt: 1 }}>
                <MailOutlineIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                <Typography variant="body2" color="text.secondary">
                  {t('dialog.contactEmail', { email: userEmail })}
                </Typography>
              </Stack>
            ) : null}
          </Box>

          {error ? <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert> : null}
        </DialogContent>
        <DialogActions>
          <Button type="button" onClick={handleClose} disabled={isSending}>{t('dialog.cancel')}</Button>
          {/* A disabled button fires no pointer events, so the "why" tooltip
              needs a wrapper element to hang off — same pattern as the
              disabled menu entries in GlobalMenu. */}
          <AppTooltip title={message.trim().length === 0 ? t('dialog.messageRequiredTooltip') : ''}>
            <Box component="span">
              <Button
                type="submit"
                variant="contained"
                disabled={!canSubmit}
                startIcon={isSending ? <CircularProgress size={16} color="inherit" /> : undefined}
              >
                {t('dialog.submit')}
              </Button>
            </Box>
          </AppTooltip>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
