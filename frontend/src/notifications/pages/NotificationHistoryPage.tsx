import { Alert, Box, Button, CircularProgress, List, ListItemButton, Pagination, Paper } from '@mui/material';
import ArrowBackOutlinedIcon from '@mui/icons-material/ArrowBackOutlined';
import { useNavigate, useOutletContext } from 'react-router';
import type { ReactElement } from 'react';
import PageContainer from '../../components/layout/PageContainer';
import PageHeader from '../../components/layout/PageHeader';
import EmptyStateCard from '../../components/project/EmptyStateCard';
import { useTranslation } from '../../i18n';
import type { RootLayoutOutletContext } from '../../navigation/topbarTypes';
import { NotificationItemContent } from '../NotificationItemContent';
import { useNotificationHistory } from '../useNotificationHistory';
import { useNotificationSelection } from '../useNotifications';
import type { AppNotification } from '../../api/types';

/**
 * The complete notification archive, read and unread alike.
 *
 * The topbar dropdowns are deliberately a "what is new" surface (unread only),
 * so this is where a decision the user already clicked past stays findable.
 * Rows behave exactly like dropdown rows — mark exactly that one as read, then
 * open what it refers to — through the same `useNotificationSelection`.
 */
export default function NotificationHistoryPage(): ReactElement {
  const { t } = useTranslation('notifications');
  const navigate = useNavigate();
  // The topbar's controller: marking read here has to move the bell's badge too.
  const { notifications: controller } = useOutletContext<RootLayoutOutletContext>();
  const history = useNotificationHistory();
  const selectNotification = useNotificationSelection(controller);

  const handleSelect = (notification: AppNotification): void => {
    history.applyRead(notification);
    selectNotification(notification);
  };

  const isEmpty = !history.isLoading && !history.hasError && history.totalCount === 0;

  return (
    <PageContainer variant="standardCenteredPage">
      <Button
        size="small"
        variant="text"
        startIcon={<ArrowBackOutlinedIcon />}
        sx={{ mb: 1 }}
        // No deterministic destination: this page is opened from a dropdown
        // that is available on every page, so "back" is wherever the user was.
        onClick={() => { void navigate(-1); }}
      >
        {t('history.back')}
      </Button>
      <PageHeader
        title={t('history.title')}
        description={history.unreadCount > 0
          ? t('history.unreadSubtitle', { unread: history.unreadCount })
          : undefined}
      />

      {history.hasError ? <Alert severity="error">{t('bell.loadError')}</Alert> : null}

      {history.isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress size={24} />
        </Box>
      ) : null}

      {isEmpty ? (
        <EmptyStateCard
          title={t('history.emptyTitle')}
          description={t('history.emptyDescription')}
        />
      ) : null}

      {!history.isLoading && !history.hasError && history.notifications.length > 0 ? (
        <Paper variant="outlined" sx={{ borderRadius: 2 }}>
          <List disablePadding>
            {history.notifications.map((notification) => (
              <ListItemButton
                key={notification.id}
                onClick={() => handleSelect(notification)}
                sx={{
                  alignItems: 'flex-start',
                  px: 2,
                  py: 1.25,
                  borderBottom: '1px solid',
                  borderColor: 'divider',
                  '&:last-of-type': { borderBottom: 'none' },
                }}
              >
                <NotificationItemContent notification={notification} showUnreadDot />
              </ListItemButton>
            ))}
          </List>
        </Paper>
      ) : null}

      {history.pageCount > 1 ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
          <Pagination
            count={history.pageCount}
            page={history.page}
            onChange={(_event, page) => history.goToPage(page)}
            color="primary"
            size="small"
            getItemAriaLabel={(type, page) => (type === 'page'
              ? t('history.pageAriaLabel', { page })
              : t(`history.${type}PageAriaLabel`))}
          />
        </Box>
      ) : null}
    </PageContainer>
  );
}
