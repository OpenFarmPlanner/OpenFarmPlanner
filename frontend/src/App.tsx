/**
 * Main application component.
 * 
 * Provides the routing structure and navigation for OpenFarmPlanner.
 * Uses React Router data router for client-side routing with a persistent navigation bar.
 * UI text is in German, code comments remain in English.
 * 
 * @returns The main App component with routing
 */

import { createBrowserRouter, Outlet, redirect, useLocation, Navigate, useRouteError } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import React, { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import './App.css';
import ProtectedRoute from './auth/ProtectedRoute';
import RootLayout from './navigation/RootLayout';
export type { RootLayoutOutletContext, TopbarContextAction } from './navigation/topbarTypes';
import { buildInvitationAcceptPath } from './pages/invitationAcceptance';
import { resolveRouterBasename } from './routerBasename';
import RuntimeErrorState from './components/runtime/RuntimeErrorState';
import RouteSeo from './seo/RouteSeo';
import {
  isDynamicImportLoadError,
  reloadOnceForDynamicImportError,
  reloadPage,
  shouldAutomaticallyReloadForRouteLoadError,
} from './runtime/chunkLoadErrors';


const HomePage = React.lazy(() => import('./pages/public/HomePage'));
const DemoPage = React.lazy(() => import('./pages/public/DemoPage'));
const ImprintPage = React.lazy(() => import('./pages/public/ImprintPage'));
const PrivacyPolicyPage = React.lazy(() => import('./pages/public/PrivacyPolicyPage'));
const TermsOfServicePage = React.lazy(() => import('./pages/public/TermsOfServicePage'));
const LoginPage = React.lazy(() => import('./pages/auth/LoginPage'));
const RegisterPage = React.lazy(() => import('./pages/auth/RegisterPage'));
const ActivatePage = React.lazy(() => import('./pages/auth/ActivatePage'));
const ForgotPasswordPage = React.lazy(() => import('./pages/auth/ForgotPasswordPage'));
const ResetPasswordPage = React.lazy(() => import('./pages/auth/ResetPasswordPage'));
const ConfirmEmailChangePage = React.lazy(() => import('./pages/auth/ConfirmEmailChangePage'));
const ProjectSelectionPage = React.lazy(() => import('./pages/ProjectSelectionPage'));
const AccountSettingsPage = React.lazy(() => import('./pages/AccountSettingsPage'));
const ProjectSettingsPage = React.lazy(() => import('./pages/ProjectSettingsPage'));
const InvitationAcceptPage = React.lazy(() => import('./pages/InvitationAcceptPage'));
const Dashboard = React.lazy(() => import('./pages/Dashboard'));
const Locations = React.lazy(() => import('./pages/Locations'));
const FieldsBedsPage = React.lazy(() => import('./pages/FieldsBedsPage'));
const Cultures = React.lazy(() => import('./pages/Cultures'));
const PublicCropLibraryPage = React.lazy(() => import('./crops/pages/PublicCropLibraryPage'));
const PublicLibraryModerationPage = React.lazy(() => import('./crops/pages/PublicLibraryModerationPage'));
const PlantingPlans = React.lazy(() => import('./pages/PlantingPlans'));
const GanttChart = React.lazy(() => import('./pages/GanttChart'));
const SeedDemandPage = React.lazy(() => import('./pages/SeedDemand'));
const YieldOverviewPage = React.lazy(() => import('./pages/YieldOverview'));
const Suppliers = React.lazy(() => import('./pages/Suppliers'));

function LegacyInvitationRedirect() {
  const location = useLocation();
  const token = new URLSearchParams(location.search).get('token');
  if (!token) {
    return <Navigate to="/invite/invalid" replace />;
  }
  return <Navigate to={buildInvitationAcceptPath(token)} replace />;
}

function TokenInvitationRedirect() {
  const location = useLocation();
  const token = location.pathname.split('/').pop();
  if (!token) {
    return <Navigate to="/invite/invalid" replace />;
  }
  return <Navigate to={buildInvitationAcceptPath(token)} replace />;
}

function withLazyFallback(element: React.ReactElement): React.ReactElement {
  return <Suspense fallback={null}>{element}</Suspense>;
}

function RouteErrorBoundary() {
  const error = useRouteError();
  const location = useLocation();
  const isApplicationUpdateError = isDynamicImportLoadError(error);
  const routeKey = `${location.pathname}${location.search}`;
  const [isReloading] = useState(() => shouldAutomaticallyReloadForRouteLoadError(routeKey));

  useEffect(() => {
    if (isReloading) {
      reloadPage();
    }
  }, [isReloading]);

  if (isReloading) {
    return null;
  }

  return <RuntimeErrorState variant={isApplicationUpdateError ? 'applicationUpdated' : 'routeError'} />;
}

interface GlobalRuntimeErrorHandlerProps {
  children: React.ReactNode;
}

function GlobalRuntimeErrorHandler({ children }: GlobalRuntimeErrorHandlerProps) {
  const [hasApplicationUpdateError, setHasApplicationUpdateError] = useState(false);

  const handleDynamicImportError = useCallback((error: unknown) => {
    if (!isDynamicImportLoadError(error)) {
      return;
    }

    if (!reloadOnceForDynamicImportError(error)) {
      setHasApplicationUpdateError(true);
    }
  }, []);

  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      const error = event.error ?? event.message;
      if (!isDynamicImportLoadError(error)) {
        return;
      }

      event.preventDefault();
      handleDynamicImportError(error);
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (!isDynamicImportLoadError(event.reason)) {
        return;
      }

      event.preventDefault();
      handleDynamicImportError(event.reason);
    };

    const handleVitePreloadError = (event: Event) => {
      event.preventDefault();
      const payload = (event as CustomEvent<unknown>).detail
        ?? (event as Event & { payload?: unknown }).payload
        ?? 'vite:preloadError';
      handleDynamicImportError(payload);
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    window.addEventListener('vite:preloadError', handleVitePreloadError);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      window.removeEventListener('vite:preloadError', handleVitePreloadError);
    };
  }, [handleDynamicImportError]);

  if (hasApplicationUpdateError) {
    return <RuntimeErrorState variant="applicationUpdated" />;
  }

  return children;
}

function RootSeoLayout() {
  return (
    <>
      <RouteSeo />
      <Outlet />
    </>
  );
}

function createAppRouter(basename: string) {
  return createBrowserRouter([
    {
      path: '/',
      element: <RootSeoLayout />,
      errorElement: <RouteErrorBoundary />,
      children: [
        {
          index: true,
          element: withLazyFallback(<HomePage />),
        },
        {
          path: 'demo',
          element: withLazyFallback(<DemoPage />),
        },
        {
          path: 'impressum',
          element: withLazyFallback(<ImprintPage />),
        },
        {
          path: 'datenschutz',
          element: withLazyFallback(<PrivacyPolicyPage />),
        },
        {
          path: 'nutzungsbedingungen',
          element: withLazyFallback(<TermsOfServicePage />),
        },
        {
          path: 'login',
          element: withLazyFallback(<LoginPage />),
        },
        {
          path: 'register',
          element: withLazyFallback(<RegisterPage />),
        },
        {
          path: 'activate',
          element: withLazyFallback(<ActivatePage />),
        },
        {
          path: 'activate/:uid/:token',
          element: withLazyFallback(<ActivatePage />),
        },
        {
          path: 'forgot-password',
          element: withLazyFallback(<ForgotPasswordPage />),
        },
        {
          path: 'reset-password',
          element: withLazyFallback(<ResetPasswordPage />),
        },
        {
          path: 'confirm-email-change',
          element: withLazyFallback(<ConfirmEmailChangePage />),
        },
        {
          path: 'invitation',
          element: <LegacyInvitationRedirect />,
        },
        {
          path: 'invite/accept',
          element: withLazyFallback(<InvitationAcceptPage />),
        },
        {
          path: 'invite/:token',
          element: <TokenInvitationRedirect />,
        },
        {
          path: 'app',
          element: <ProtectedRoute />,
          children: [
            {
              path: '',
              element: <RootLayout />,
              children: [
                {
                  index: true,
                  loader: () => redirect('/app/dashboard'),
                },
                { path: 'dashboard', element: withLazyFallback(<Dashboard />) },
                { path: 'locations', element: withLazyFallback(<Locations />) },
                { path: 'fields-beds', element: withLazyFallback(<FieldsBedsPage />) },
                { path: 'cultures', element: withLazyFallback(<Cultures />) },
                { path: 'crop-library', element: withLazyFallback(<PublicCropLibraryPage />) },
                { path: 'public-library-moderation', element: withLazyFallback(<PublicLibraryModerationPage />) },
                { path: 'crops', element: withLazyFallback(<PublicCropLibraryPage />) },
                { path: 'anbauplaene', element: withLazyFallback(<PlantingPlans />) },
                { path: 'suppliers', element: withLazyFallback(<Suppliers />) },
                { path: 'planting-plans', element: withLazyFallback(<PlantingPlans />) },
                { path: 'gantt-chart', element: withLazyFallback(<GanttChart />) },
                { path: 'yield-overview', element: withLazyFallback(<YieldOverviewPage />) },
                { path: 'seed-demand', element: withLazyFallback(<SeedDemandPage />) },
                { path: 'project-selection', element: withLazyFallback(<ProjectSelectionPage />) },
                { path: 'account-settings', element: withLazyFallback(<AccountSettingsPage />) },
                { path: 'project-settings', element: withLazyFallback(<ProjectSettingsPage />) },
                { path: '*', element: <Navigate to="/app/dashboard" replace /> },
              ],
            },
          ],
        },
        { path: '*', element: <Navigate to="/" replace /> },
      ],
    },
  ], {
    basename,
  });
}

function App() {
  // Use Vite's base URL when URL is inside that subdirectory, otherwise fall back to root.
  const configuredBase = import.meta.env.BASE_URL.replace(/\/$/, '');
  const currentPath = window.location.pathname;
  const basename = resolveRouterBasename(configuredBase, currentPath);

  const router = useMemo(() => createAppRouter(basename), [basename]);

  return (
    <GlobalRuntimeErrorHandler>
      <RouterProvider router={router} />
    </GlobalRuntimeErrorHandler>
  );
}

export default App;
