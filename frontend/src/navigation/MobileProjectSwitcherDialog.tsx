import {
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import CheckIcon from '@mui/icons-material/Check';

import { useTranslation } from '../i18n';
import type { ProjectMembershipInfo } from '../auth/types';

interface MobileProjectSwitcherDialogProps {
  open: boolean;
  onClose: () => void;
  activeProjectLabel: string;
  memberships: ProjectMembershipInfo[];
  activeProjectId: number | null;
  isSwitchingProject: boolean;
  onSwitchProject: (projectId: number) => void;
  onOpenCreateProject: () => void;
}

/**
 * Presentational mobile project-switcher dialog: shows the active project,
 * the membership list and a create-project shortcut. All state and the
 * switch/create handlers live in RootLayout.tsx; this component only renders.
 */
export function MobileProjectSwitcherDialog({
  open,
  onClose,
  activeProjectLabel,
  memberships,
  activeProjectId,
  isSwitchingProject,
  onSwitchProject,
  onOpenCreateProject,
}: MobileProjectSwitcherDialogProps) {
  const { t } = useTranslation('navigation');

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{t('projectSwitcher.ariaLabel')}</DialogTitle>
      <DialogContent>
        <Typography variant="caption" sx={{ display: 'block', mb: 1.25, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.4 }}>
          {t('projectSwitcher.activeProject')}
        </Typography>
        <Paper variant="outlined" sx={{ p: 1.25, mb: 2 }}>
          <Stack direction="row" sx={{ alignItems: "center", }}  spacing={1}>
            <CheckIcon fontSize="small" color="success" />
            <Typography variant="body2" sx={{ fontWeight: 600 }}>{activeProjectLabel}</Typography>
          </Stack>
        </Paper>
        <Typography variant="caption" sx={{ display: 'block', mb: 1.25, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.4 }}>
          {t('projectSwitcher.projects')}
        </Typography>
        <List dense sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, py: 0 }}>
          {memberships.length === 0 ? (
            <ListItem><ListItemText primary={t('projectSwitcher.zeroProjects')} /></ListItem>
          ) : memberships.map((membership) => (
            <ListItemButton
              key={`switcher-${membership.project_id}`}
              onClick={() => onSwitchProject(membership.project_id)}
              selected={membership.project_id === activeProjectId}
              disabled={isSwitchingProject}
            >
              <ListItemIcon sx={{ minWidth: 28 }}>
                {membership.project_id === activeProjectId ? <CheckIcon fontSize="small" color="success" /> : null}
              </ListItemIcon>
              <ListItemText primary={membership.project_name} />
            </ListItemButton>
          ))}
        </List>
        <Button
          startIcon={<AddIcon fontSize="small" />}
          variant="outlined"
          onClick={onOpenCreateProject}
          sx={{ mt: 2, textTransform: 'none' }}
        >
          {t('project.create')}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
