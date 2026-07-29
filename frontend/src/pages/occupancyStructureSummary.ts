import type { OccupancyHierarchyNode } from './ganttChartUtils';

/**
 * Structural counts shown as the grey meta line under a Standort/Parzelle
 * row of the occupancy calendar ("2 Parzellen · 6 Beete · 5 belegt").
 *
 * `fieldCount` is only meaningful for Standort rows — a Parzelle has no
 * Parzellen of its own, so it stays undefined there and drops out of the
 * formatted label.
 */
export interface OccupancyStructureSummary {
  fieldCount?: number;
  bedCount: number;
  occupiedBedCount: number;
}

/** Separator between the summary's parts. Punctuation, not translatable copy. */
const SUMMARY_SEPARATOR = ' · ';

type SummaryTranslator = (key: string, options: { count: number }) => string;

/**
 * Aggregates the structural counts for every Standort/Parzelle row of an
 * occupancy tree, keyed by node id.
 *
 * The counts are derived from exactly the nodes handed in, never from the
 * pre-computed `bedCount`/`occupiedBedCount` on the nodes themselves: those
 * always describe the *full* tree, so reusing them would make a filtered
 * view claim more beds than it shows ("6 Beete" above three visible rows
 * once "Nur belegte Beete" or a search has pruned the rest). Callers pass
 * the already-filtered node list and get numbers that match what is on
 * screen.
 *
 * Expand/collapse state is deliberately *not* part of that filtering:
 * collapsing a Parzelle hides its rows but does not remove its beds from the
 * structure, so the summary must not change when a row is folded away.
 */
export function buildOccupancyStructureSummaries(
  nodes: OccupancyHierarchyNode[],
): Map<string, OccupancyStructureSummary> {
  const parentById = new Map<string, string | null>(
    nodes.map((node) => [node.id, node.parentId]),
  );
  const summaries = new Map<string, OccupancyStructureSummary>();

  nodes.forEach((node) => {
    if (node.type === 'location') {
      summaries.set(node.id, { fieldCount: 0, bedCount: 0, occupiedBedCount: 0 });
    } else if (node.type === 'field') {
      summaries.set(node.id, { bedCount: 0, occupiedBedCount: 0 });
    }
  });

  nodes.forEach((node) => {
    if (node.type === 'field' && node.parentId) {
      const locationSummary = summaries.get(node.parentId);
      if (locationSummary?.fieldCount !== undefined) {
        locationSummary.fieldCount += 1;
      }
      return;
    }

    if (node.type !== 'bed') {
      return;
    }

    // Walk the ancestor chain instead of assuming a fixed Standort ->
    // Parzelle -> Beet depth, so a bed still counts towards its Standort if
    // the tree ever grows another level.
    const occupied = node.occupiedBedCount > 0 ? 1 : 0;
    const seen = new Set<string>();
    let ancestorId = node.parentId;
    while (ancestorId && !seen.has(ancestorId)) {
      seen.add(ancestorId);
      const summary = summaries.get(ancestorId);
      if (summary) {
        summary.bedCount += 1;
        summary.occupiedBedCount += occupied;
      }
      ancestorId = parentById.get(ancestorId) ?? null;
    }
  });

  return summaries;
}

/**
 * Renders a summary as the localized meta line. Singular/plural comes from
 * i18next's own plural resolution (`_one`/`_other`), so languages that count
 * differently than German stay correct.
 */
export function formatOccupancyStructureSummary(
  summary: OccupancyStructureSummary,
  t: SummaryTranslator,
): string {
  const parts: string[] = [];

  if (summary.fieldCount !== undefined) {
    parts.push(t('ganttChart:structureSummary.fields', { count: summary.fieldCount }));
  }
  parts.push(t('ganttChart:structureSummary.beds', { count: summary.bedCount }));
  parts.push(t('ganttChart:structureSummary.occupiedBeds', { count: summary.occupiedBedCount }));

  return parts.join(SUMMARY_SEPARATOR);
}
