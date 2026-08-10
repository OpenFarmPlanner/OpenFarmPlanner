import type { ReactElement, ReactNode } from 'react';
import { PAGE_CONTAINER_CLASSES, type PageContainerVariant } from './pageContainerStyles';

export type { PageContainerVariant };

interface PageContainerProps {
  children: ReactNode;
  variant?: PageContainerVariant;
  className?: string;
}

function PageContainer({
  children,
  variant = 'standard',
  className,
}: PageContainerProps): ReactElement {
  const containerClassName = className
    ? `${PAGE_CONTAINER_CLASSES[variant]} ${className}`
    : PAGE_CONTAINER_CLASSES[variant];

  return (
    <div className={containerClassName}>
      {children}
    </div>
  );
}

export default PageContainer;
