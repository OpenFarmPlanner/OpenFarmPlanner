import { Navigate, Outlet, useLocation } from 'react-router';
import { useAuth } from './useAuth';
import ConsentGate from './ConsentGate';
import { useTranslation } from '../i18n';

export default function ProtectedRoute() {
  const { user, isLoading } = useAuth();
  const { t } = useTranslation('common');
  const location = useLocation();

  if (isLoading) {
    return <div style={{ padding: 24 }}>{t('messages.loading')}</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (user.pending_consents.length > 0) {
    return <ConsentGate />;
  }

  return <Outlet />;
}
