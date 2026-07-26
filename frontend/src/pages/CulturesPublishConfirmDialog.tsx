import {
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Link,
  Stack,
  Typography,
} from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import PublicIcon from '@mui/icons-material/Public';
import VerifiedOutlinedIcon from '@mui/icons-material/VerifiedOutlined';
import { Link as RouterLink } from 'react-router';

type Translator = (key: string, options?: Record<string, unknown>) => string;

type CulturesPublishConfirmDialogProps = {
  open: boolean;
  cultureName: string;
  accepted: boolean;
  onAcceptedChange: (accepted: boolean) => void;
  onClose: () => void;
  onConfirm: () => void;
  t: Translator;
};

const PUBLIC_LIBRARY_CONFIRM_ITEMS = [
  { key: 'permanent', icon: <PublicIcon fontSize="small" /> },
  { key: 'privateData', icon: <LockOutlinedIcon fontSize="small" /> },
  { key: 'reuse', icon: <CheckCircleOutlineIcon fontSize="small" /> },
  { key: 'license', icon: <VerifiedOutlinedIcon fontSize="small" /> },
] as const;

/**
 * Presentational confirmation dialog for publishing a culture to the public
 * library. State and the publish handler live in Cultures.tsx.
 */
export function CulturesPublishConfirmDialog({
  open,
  cultureName,
  accepted,
  onAcceptedChange,
  onClose,
  onConfirm,
  t,
}: CulturesPublishConfirmDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="xs"
    >
      <DialogTitle sx={{ pb: 1 }}>
        {t('library.publishConfirm.title')}
      </DialogTitle>
      <DialogContent sx={{ pt: 1 }}>
        <Stack spacing={1.5}>
          <Typography color="text.secondary">
            {t('library.publishConfirm.intro', { name: cultureName })}
          </Typography>
          <Stack spacing={1}>
            {PUBLIC_LIBRARY_CONFIRM_ITEMS.map((item) => (
              <Stack
                key={item.key}
                direction="row"
                spacing={1.25}
                alignItems="flex-start"
                sx={{ color: 'text.secondary' }}
              >
                <Box sx={{ color: 'success.main', display: 'flex', pt: 0.25 }}>
                  {item.icon}
                </Box>
                <Typography variant="body2" color="text.secondary">
                  {t(`library.publishConfirm.items.${item.key}`)}
                </Typography>
              </Stack>
            ))}
          </Stack>
          <FormControlLabel
            control={(
              <Checkbox
                checked={accepted}
                onChange={(event) => onAcceptedChange(event.target.checked)}
              />
            )}
            label={t('library.publishConfirm.acceptLicense')}
            sx={{ alignItems: 'flex-start', color: 'text.secondary' }}
          />
          <Typography variant="body2" color="text.secondary">
            {t('library.publishConfirm.linkPrefix')}
            <Link component={RouterLink} to="/datenschutz" target="_blank" rel="noopener">
              {t('library.publishConfirm.privacyLinkLabel')}
            </Link>
            {t('library.publishConfirm.linkMiddle')}
            <Link component={RouterLink} to="/nutzungsbedingungen" target="_blank" rel="noopener">
              {t('library.publishConfirm.termsLinkLabel')}
            </Link>
            {t('library.publishConfirm.linkSuffix')}
          </Typography>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5, pt: 1 }}>
        <Button variant="outlined" onClick={onClose}>
          {t('common:actions.cancel')}
        </Button>
        <Button variant="contained" onClick={onConfirm} disabled={!accepted}>
          {t('library.publishConfirm.confirmButton')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
