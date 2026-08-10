import type { ReactElement, ReactNode } from 'react';
import Box from '@mui/material/Box';
import { PAGE_CONTAINER_SX, type PageContainerVariant } from './pageContainerStyles';

export type { PageContainerVariant };

interface PageContainerProps {
  children: ReactNode;
  variant?: PageContainerVariant;
}

function PageContainer({
  children,
  variant = 'standard',
}: PageContainerProps): ReactElement {
  return (
    <Box sx={PAGE_CONTAINER_SX[variant]}>
      {children}
    </Box>
  );
}

export default PageContainer;
