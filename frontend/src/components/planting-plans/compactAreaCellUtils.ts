const TOOLTIP_TEXT_LENGTH_THRESHOLD = 40;

export function shouldShowAreaTooltip(label: string, isOverflowing: boolean): boolean {
  return isOverflowing || label.length > TOOLTIP_TEXT_LENGTH_THRESHOLD;
}
