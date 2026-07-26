import {
  cloneElement,
  useCallback,
  useEffect,
  useState,
  type FocusEvent,
  type FocusEventHandler,
  type MouseEvent,
  type MouseEventHandler,
  type ReactElement,
} from 'react';
import { Tooltip, type TooltipProps } from '@mui/material';

type OverflowTooltipChild = ReactElement<{
  onBlur?: FocusEventHandler<HTMLElement>;
  onFocus?: FocusEventHandler<HTMLElement>;
  onMouseEnter?: MouseEventHandler<HTMLElement>;
  onMouseLeave?: MouseEventHandler<HTMLElement>;
}>;

export interface OverflowTooltipProps
  extends Pick<TooltipProps, 'arrow' | 'placement' | 'enterDelay' | 'slotProps'> {
  children: OverflowTooltipChild;
  title: string;
}

const isFinePointer = (): boolean => {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return true;
  }
  return window.matchMedia('(hover: hover) and (pointer: fine)').matches;
};

const isElementOverflowing = (element: HTMLElement): boolean =>
  element.scrollWidth > element.clientWidth || element.scrollHeight > element.clientHeight;

export function OverflowTooltip({
  children,
  title,
  arrow,
  placement,
  enterDelay,
  slotProps,
}: OverflowTooltipProps) {
  const [activeElement, setActiveElement] = useState<HTMLElement | null>(null);
  const [showTooltip, setShowTooltip] = useState(false);
  const [isActive, setIsActive] = useState(false);

  const updateTooltipVisibility = useCallback((element: HTMLElement | null = activeElement): void => {
    setShowTooltip(Boolean(title) && isFinePointer() && Boolean(element && isElementOverflowing(element)));
  }, [activeElement, title]);

  useEffect(() => {
    if (!activeElement || typeof ResizeObserver === 'undefined') {
      return undefined;
    }

    const observer = new ResizeObserver(() => updateTooltipVisibility(activeElement));
    observer.observe(activeElement);
    return () => observer.disconnect();
  }, [activeElement, updateTooltipVisibility]);

  return (
    <Tooltip
      open={isActive && showTooltip}
      title={showTooltip ? title : ''}
      arrow={arrow}
      placement={placement}
      enterDelay={enterDelay}
      slotProps={slotProps}
      disableTouchListener
    >
      {cloneElement(children, {
        onBlur: (event: FocusEvent<HTMLElement>) => {
          setIsActive(false);
          setActiveElement(null);
          children.props.onBlur?.(event);
        },
        onFocus: (event: FocusEvent<HTMLElement>) => {
          setActiveElement(event.currentTarget);
          setIsActive(true);
          updateTooltipVisibility(event.currentTarget);
          children.props.onFocus?.(event);
        },
        onMouseEnter: (event: MouseEvent<HTMLElement>) => {
          setActiveElement(event.currentTarget);
          setIsActive(true);
          updateTooltipVisibility(event.currentTarget);
          children.props.onMouseEnter?.(event);
        },
        onMouseLeave: (event: MouseEvent<HTMLElement>) => {
          setIsActive(false);
          setActiveElement(null);
          children.props.onMouseLeave?.(event);
        },
      })}
    </Tooltip>
  );
}
