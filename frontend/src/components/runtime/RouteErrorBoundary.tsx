import { useEffect, useRef, useState } from 'react';
import { useLocation, useRouteError } from 'react-router';
import RuntimeErrorState from './RuntimeErrorState';
import {
  isDynamicImportLoadError,
  reloadPage,
  shouldAutomaticallyReloadForRouteLoadError,
} from '../../runtime/chunkLoadErrors';

export default function RouteErrorBoundary() {
  const error = useRouteError();
  const location = useLocation();
  const isApplicationUpdateError = isDynamicImportLoadError(error);
  const routeKey = `${location.pathname}${location.search}`;
  const [isReloading, setIsReloading] = useState(isApplicationUpdateError);
  // The retry budget is consumed in session storage, so it must be claimed
  // exactly once per mounted boundary. StrictMode invokes state initializers
  // and effects twice in development, which previously burned the budget on
  // the second call and left the user on the fallback instead of reloading.
  const hasClaimedRetryRef = useRef(false);

  useEffect(() => {
    if (!isApplicationUpdateError || hasClaimedRetryRef.current) {
      return;
    }

    hasClaimedRetryRef.current = true;
    if (shouldAutomaticallyReloadForRouteLoadError(routeKey)) {
      reloadPage();
      return;
    }

    setIsReloading(false);
  }, [isApplicationUpdateError, routeKey]);

  if (isReloading) {
    return null;
  }

  return <RuntimeErrorState variant={isApplicationUpdateError ? 'applicationUpdated' : 'routeError'} />;
}
