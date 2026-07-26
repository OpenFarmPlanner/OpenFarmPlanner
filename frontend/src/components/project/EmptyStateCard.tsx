import { Box, Button, Paper, Typography, type SxProps, type Theme } from '@mui/material';
import { Link as RouterLink, UNSAFE_LocationContext } from 'react-router';
import RequirementChecklist from './RequirementChecklist';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { useContext, type ReactNode } from 'react';

export interface EmptyStateAction {
  label: string;
  to?: string;
  onClick?: () => void;
  icon?: ReactNode;
}

interface EmptyStateCardProps {
  title: string;
  description: ReactNode;
  actions?: EmptyStateAction[];
  checklist?: Array<{ label: string; done: boolean; doneLabel?: string; missingLabel?: string }>;
  supplement?: ReactNode;
  showInfoIcon?: boolean;
  containerSx?: SxProps<Theme>;
  titleSx?: SxProps<Theme>;
}

export default function EmptyStateCard({
  title,
  description,
  actions = [],
  checklist = [],
  supplement,
  showInfoIcon = true,
  containerSx,
  titleSx,
}: EmptyStateCardProps) {
  const locationContext = useContext(UNSAFE_LocationContext);
  const currentPathname = locationContext?.location.pathname ?? window.location.pathname;
  const visibleActions = actions.filter((action) => {
    if (!action.to || action.onClick) {
      return true;
    }

    const target = new URL(action.to, window.location.origin);
    return target.pathname !== currentPathname || target.search !== '' || target.hash !== '';
  });

  return (
    <Paper
      variant="outlined"
      sx={{
        mb: 2,
        p: 2,
        width: '100%',
        maxWidth: 880,
        mx: 'auto',
        borderColor: 'success.200',
        backgroundColor: 'success.50',
        borderLeft: 4,
        borderLeftColor: 'success.main',
        boxShadow: 'none',
        ...containerSx,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.75 }}>
        {showInfoIcon ? <InfoOutlinedIcon fontSize="small" color="success" /> : null}
        <Typography variant="subtitle1" sx={{ fontWeight: 600, ...titleSx }}>{title}</Typography>
      </Box>
      <Typography variant="body2" component="div" sx={{ mb: supplement || visibleActions.length > 0 || checklist.length > 0 ? 1.5 : 0 }}>
        {description}
      </Typography>
      {supplement ? (
        <Box sx={{ mb: visibleActions.length > 0 || checklist.length > 0 ? 1.5 : 0 }}>
          {supplement}
        </Box>
      ) : null}
      {checklist.length > 0 ? (
        <Box sx={{ mb: 1.5 }}>
          <RequirementChecklist
            items={checklist.map((item) => ({
              label: item.label,
              satisfied: item.done,
              satisfiedLabel: item.doneLabel,
              missingLabel: item.missingLabel,
            }))}
          />
        </Box>
      ) : null}
      {visibleActions.length > 0 ? (
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center', flexDirection: { xs: 'column', sm: 'row' } }}>
          {visibleActions.map((action, index) => (
            <Button
              key={`${action.label}-${action.to}`}
              component={action.to ? RouterLink : 'button'}
              to={action.to}
              onClick={action.onClick}
              variant={index === 0 ? 'contained' : 'outlined'}
              size="small"
              startIcon={action.icon}
            >
              {action.label}
            </Button>
          ))}
        </Box>
      ) : null}
    </Paper>
  );
}
