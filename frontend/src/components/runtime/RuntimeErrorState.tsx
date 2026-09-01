import { Box, Button, Stack, Typography } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import { useTranslation } from '../../i18n';
import { reloadForManualRecovery } from '../../runtime/chunkLoadErrors';

interface RuntimeErrorStateProps {
  variant: 'applicationUpdated' | 'routeError';
}

export default function RuntimeErrorState({ variant }: RuntimeErrorStateProps) {
  const { t } = useTranslation('common');
  const isApplicationUpdated = variant === 'applicationUpdated';

  return (
    <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', p: 2 }}>
      <Stack spacing={2} sx={{ maxWidth: 480, alignItems: 'center' }}>
        <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
          {t(isApplicationUpdated ? 'runtime.applicationUpdatedFallback' : 'runtime.routeErrorFallback')}
        </Typography>
        <Button
          variant="contained"
          startIcon={<RefreshIcon />}
          onClick={() => reloadForManualRecovery()}
          sx={{ alignSelf: 'center' }}
        >
          {t('runtime.reloadAction')}
        </Button>
      </Stack>
    </Box>
  );
}
