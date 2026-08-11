import CloseIcon from '@mui/icons-material/Close';
import {
  Box,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Stack,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import type { ReactElement } from 'react';
import { useTranslation } from '../../i18n';

interface HelpSection {
  title: string;
  points: string[];
}

interface HelpDialogProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Displays the global OpenFarmPlanner help dialog.
 *
 * @remarks
 * This dialog presents the shared workflow overview for the main application pages.
 *
 * @param props - Component properties.
 * @param props.open - Controls whether the dialog is visible.
 * @param props.onClose - Callback invoked when the dialog should be closed.
 * @returns JSX element rendering the help dialog.
 */
export function HelpDialog({ open, onClose }: HelpDialogProps): ReactElement {
  const { t } = useTranslation('help');
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const sections = t('sections', { returnObjects: true }) as unknown;
  const helpSections = Array.isArray(sections)
    ? sections
        .map((section) => {
          if (!section || typeof section !== 'object') {
            return null;
          }
          const typedSection = section as { title?: unknown; points?: unknown };
          if (typeof typedSection.title !== 'string' || !Array.isArray(typedSection.points)) {
            return null;
          }
          return {
            title: typedSection.title,
            points: typedSection.points.map((point) => String(point)),
          } satisfies HelpSection;
        })
        .filter((section): section is HelpSection => section !== null)
    : [];

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="md"
      fullScreen={isMobile}
      slotProps={{
        paper: {
          sx: {
            borderRadius: isMobile ? 0 : 3,
            width: isMobile ? '100%' : 880,
          },
        }
      }}
    >
      <DialogTitle sx={{ pr: 6 }}>
        <Stack direction="row" sx={{ alignItems: "center",
          justifyContent: "space-between", }}   spacing={2}>
          <Typography variant="h6" component="span">
            {t('globalTitle')}
          </Typography>
          <IconButton
            aria-label={t('common:actions.close')}
            onClick={onClose}
            size="small"
            sx={{ position: 'absolute', top: 8, right: 8 }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </Stack>
      </DialogTitle>
      <DialogContent sx={{ pb: 3 }}>
        <Stack spacing={2}>
          <Typography variant="body1">
            {t('intro')}
          </Typography>

          <Stack spacing={1.5}>
            {helpSections.map((section) => (
              <Box key={section.title}>
                <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 0.5 }}>
                  {section.title}
                </Typography>
                <List dense disablePadding>
                  {section.points.map((point) => (
                    <ListItem key={`${section.title}-${point}`} disableGutters sx={{ py: 0.125 }}>
                      <ListItemText slotProps={{ primary: { variant: 'body2' } }} primary={`• ${point}`} />
                    </ListItem>
                  ))}
                </List>
              </Box>
            ))}
          </Stack>

          <Box sx={{ pt: 1 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 0.5 }}>
              {t('workflowTitle')}
            </Typography>
            <Box
              sx={{
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 2,
                px: 2,
                py: 1.25,
                backgroundColor: 'action.hover',
                overflowX: 'auto',
              }}
            >
              <Typography variant="body2" sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
                {t('workflow')}
              </Typography>
            </Box>
          </Box>
        </Stack>
      </DialogContent>
    </Dialog>
  );
}
