import type { ReactElement, ReactNode } from 'react';
import { DropdownAwareTooltip } from '../components/DropdownAwareTooltip';

interface VarietyFieldTooltipProps {
  tooltipTitle?: ReactNode;
  children: ReactElement;
}

/**
 * Wraps a form field with the override/inherited tooltip when the crop/variety
 * inheritance concept applies to it. Renders the field unchanged otherwise, so
 * fields outside a variety-editing context (e.g. species-level cultures, or
 * forms without a `cultures` list) are unaffected.
 */
export function VarietyFieldTooltip({ tooltipTitle, children }: VarietyFieldTooltipProps) {
  if (!tooltipTitle) {
    return children;
  }

  return (
    <DropdownAwareTooltip title={tooltipTitle} arrow>
      {children}
    </DropdownAwareTooltip>
  );
}
