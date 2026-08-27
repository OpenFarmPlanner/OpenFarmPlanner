import { useCallback, useEffect, useState } from "react";
import { Box } from "@mui/material";
import { AppTooltip } from "../components/AppTooltip";

interface YieldYearBoundaryMarkerProps {
  /** The plot area the marker is positioned inside (must be `position: relative`). */
  plotRef: React.RefObject<HTMLDivElement | null>;
  /** `data-testid` suffix of the first column of the new year. */
  boundaryColumnId: string;
  /** Localized tooltip text, e.g. "Jahreswechsel: 2025 → 2026". */
  label: string;
  /** Changes whenever the columns are rebuilt, forcing a re-measure. */
  remeasureKey: string;
}

/**
 * A subtle dashed vertical line marking where the yield chart's week/month
 * axis crosses a calendar-year boundary (only shown for seasons whose period
 * spans two calendar years). The line spans the plot area and stops above the
 * axis label row. The tooltip opens on hover and, since touch devices have no
 * hover, toggles on tap — the same hover-or-tap pattern the chart segments use.
 */
export function YieldYearBoundaryMarker({
  plotRef,
  boundaryColumnId,
  label,
  remeasureKey,
}: YieldYearBoundaryMarkerProps) {
  const [left, setLeft] = useState<number | null>(null);
  const [hovered, setHovered] = useState(false);
  const [pinned, setPinned] = useState(false);

  useEffect(() => {
    const plot = plotRef.current;
    if (!plot) {
      return undefined;
    }

    const measure = (): void => {
      const column = plot.querySelector<HTMLElement>(
        `[data-testid="yield-bar-column-${CSS.escape(boundaryColumnId)}"]`,
      );
      if (!column) {
        setLeft(null);
        return;
      }
      const plotRect = plot.getBoundingClientRect();
      const columnRect = column.getBoundingClientRect();
      // Sit in the gap just before the first column of the new year.
      setLeft(columnRect.left - plotRect.left - 1);
    };

    measure();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measure);
      return () => window.removeEventListener("resize", measure);
    }
    const resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(plot);
    return () => resizeObserver.disconnect();
  }, [plotRef, boundaryColumnId, remeasureKey]);

  const togglePinned = useCallback(() => setPinned((current) => !current), []);

  if (left === null) {
    return null;
  }

  return (
    <AppTooltip open={hovered || pinned} placement="top" title={label}>
      <Box
        role="button"
        tabIndex={-1}
        aria-label={label}
        data-testid="yield-year-boundary-marker"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={togglePinned}
        sx={{
          position: "absolute",
          top: 0,
          bottom: 0,
          left: `${left}px`,
          width: 0,
          borderLeft: "1px dashed",
          borderColor: "chart.yearBoundary",
          cursor: "pointer",
          zIndex: 1,
          // Widen the pointer/touch target without shifting the visible line.
          "&::before": {
            content: '""',
            position: "absolute",
            top: 0,
            bottom: 0,
            left: "-7px",
            width: "14px",
          },
        }}
      />
    </AppTooltip>
  );
}
