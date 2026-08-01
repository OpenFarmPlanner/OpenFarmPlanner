import type { TaskGroup } from "../types";

type ParsedHierarchy = {
  locationName?: string;
  fieldName?: string;
  bedName?: string;
};

const HIERARCHY_SEPARATOR_PATTERNS = [
  /\s*>\s*/,
  /\s*›\s*/,
  /\s*→\s*/,
  /\s*->\s*/,
  /\s*\|\s*/,
  /\s*\/\s*/,
];

function parseHierarchyFromDescription(
  description?: string,
): ParsedHierarchy | null {
  if (!description) return null;

  const trimmed = description.trim();
  if (!trimmed) return null;

  const multiLineParts = trimmed
    .split("\n")
    .map((part) => part.trim())
    .filter(Boolean);
  if (multiLineParts.length >= 2) {
    return {
      locationName: multiLineParts[0],
      fieldName: multiLineParts[1],
      bedName: multiLineParts[2],
    };
  }

  for (const separator of HIERARCHY_SEPARATOR_PATTERNS) {
    const parts = trimmed.split(separator).map((part) => part.trim());
    if (parts.length >= 2 && parts.every(Boolean)) {
      return {
        locationName: parts[0],
        fieldName: parts[1],
        bedName: parts[2],
      };
    }
  }

  return null;
}

function getParsedHierarchy(taskGroup: TaskGroup): ParsedHierarchy | null {
  const explicitHierarchy: ParsedHierarchy = {
    locationName: taskGroup.locationName,
    fieldName: taskGroup.fieldName,
    bedName: taskGroup.bedName,
  };

  if (explicitHierarchy.locationName || explicitHierarchy.fieldName) {
    return explicitHierarchy;
  }

  return parseHierarchyFromDescription(taskGroup.description);
}

/**
 * Resolves the ordered hierarchy labels (e.g. Location -> Field -> Bed) for a
 * task group, trying hierarchyPath, then flat metadata fields, then a parsed
 * description. Shared by TaskList and TaskRow so both compute the same
 * levels and stay vertically aligned.
 */
export function getHierarchyLevels(taskGroup: TaskGroup): string[] | null {
  const explicitPath = Array.isArray(taskGroup.hierarchyPath)
    ? taskGroup.hierarchyPath
        .map((level) => level?.trim())
        .filter((level): level is string => Boolean(level))
    : [];

  if (explicitPath.length >= 2) {
    return explicitPath;
  }

  const metadataLevels = [
    taskGroup.locationName,
    taskGroup.fieldName,
    taskGroup.name || taskGroup.bedName || "Unnamed",
  ].filter((level): level is string => Boolean(level?.trim()));

  if (metadataLevels.length >= 2) {
    return metadataLevels;
  }

  const parsedHierarchy = getParsedHierarchy(taskGroup);
  if (!parsedHierarchy) {
    return null;
  }

  const parsedLevels = [
    parsedHierarchy.locationName,
    parsedHierarchy.fieldName,
    taskGroup.name || parsedHierarchy.bedName || "Unnamed",
  ].filter((level): level is string => Boolean(level?.trim()));

  return parsedLevels.length >= 2 ? parsedLevels : null;
}

export function normalizeLeftColumnWidth(leftColumnWidth: number): number {
  return Math.max(96, Math.floor(leftColumnWidth));
}

/**
 * Estimates the rendered height of a stack of wrapped label lines in the
 * left column, using a chars-per-line heuristic. Kept in one place so
 * TaskList (left column) and TaskRow (timeline row) always agree.
 */
export function estimateLabelHeight(
  labels: string[],
  leftColumnWidth: number,
): number {
  const normalizedWidth = normalizeLeftColumnWidth(leftColumnWidth);
  const charsPerLine = Math.max(12, Math.floor((normalizedWidth - 24) / 7));

  const estimatedLabelLines = labels.reduce((total, label) => {
    const trimmedLabel = label.trim();
    if (!trimmedLabel) return total;
    return total + Math.max(1, Math.ceil(trimmedLabel.length / charsPerLine));
  }, 0);

  return Math.max(40, estimatedLabelLines * 16 + 20);
}

/**
 * Picks the label lines used to estimate row height: hierarchy levels if
 * present, otherwise the group name and (optionally) its description.
 */
export function getLabelLinesSource(
  taskGroup: TaskGroup,
  hierarchyLevels: string[] | null,
  includeDescription = true,
): string[] {
  if (hierarchyLevels) {
    return hierarchyLevels;
  }

  return [
    taskGroup.name || "Unnamed",
    includeDescription ? (taskGroup.description ?? "") : "",
  ].filter(Boolean);
}

/** Indent applied per tree depth level in the left column (TaskList's tree
 * rows) — subtracted from the available label width below, since indentation
 * eats into the space a wrapped label actually has to render in. */
export const TREE_INDENT_PX = 20;

/**
 * Estimates a task group's row height contribution from its label alone
 * (before factoring in how many task bars need to stack). Used by both
 * TaskList (left column) and TaskRow (timeline row) so a row's height never
 * silently diverges between the two — this exact kind of divergence caused
 * a real sidebar/timeline misalignment bug once already, when TaskRow didn't
 * account for tree-depth indentation the way TaskList did.
 */
export function estimateTaskGroupLabelHeight(
  taskGroup: TaskGroup,
  leftColumnWidth: number,
  options: { includeDescription?: boolean } = {},
): number {
  const isTreeRow = taskGroup.depth !== undefined;
  const hierarchyLevels = isTreeRow ? null : getHierarchyLevels(taskGroup);
  const labelLinesSource = isTreeRow
    ? [taskGroup.name || "Unnamed"]
    : getLabelLinesSource(taskGroup, hierarchyLevels, options.includeDescription ?? true);
  const effectiveWidth = leftColumnWidth - (isTreeRow ? (taskGroup.depth ?? 0) * TREE_INDENT_PX : 0);
  return estimateLabelHeight(labelLinesSource, effectiveWidth);
}
