/**
 * Generic parent-child tree flattening, independent of any domain
 * (locations/fields/beds, crops, etc.). Used to turn a flat list of
 * {id, parentId} nodes into an ordered, depth-annotated list of visible
 * rows, respecting expand/collapse state and an optional visibility
 * filter (e.g. from search) that keeps ancestors of a match visible.
 */

export interface TreeRowNode {
  id: string | number;
  parentId?: string | number | null;
}

export interface FlattenedTreeRow<T> {
  node: T;
  depth: number;
  hasChildren: boolean;
}

export function buildChildrenIndex<T extends TreeRowNode>(
  nodes: readonly T[],
): Map<string | number | null, T[]> {
  const index = new Map<string | number | null, T[]>();
  nodes.forEach((node) => {
    const key = node.parentId ?? null;
    const list = index.get(key);
    if (list) {
      list.push(node);
    } else {
      index.set(key, [node]);
    }
  });
  return index;
}

/**
 * Given a set of "matched" node ids (e.g. search/filter results), returns
 * that set expanded to include every ancestor of each match, so a matched
 * leaf's parent chain stays visible for context.
 */
export function collectVisibleIdsWithAncestors<T extends TreeRowNode>(
  nodes: readonly T[],
  matchedIds: ReadonlySet<string | number>,
): Set<string | number> {
  const byId = new Map<string | number, T>(nodes.map((node) => [node.id, node]));
  const visible = new Set<string | number>();

  matchedIds.forEach((id) => {
    let current: T | undefined = byId.get(id);
    while (current) {
      if (visible.has(current.id)) {
        break;
      }
      visible.add(current.id);
      const parentId = current.parentId;
      current = parentId != null ? byId.get(parentId) : undefined;
    }
  });

  return visible;
}

/**
 * Flattens a parent-child node list into ordered, depth-annotated rows.
 *
 * - Without `visibleIds`, every node is included and descending into
 *   children is gated by `expandedIds` (normal expand/collapse browsing).
 * - With `visibleIds` (typically matches + their ancestors, see
 *   `collectVisibleIdsWithAncestors`), only nodes in that set are
 *   included, and descending into children ignores `expandedIds` — an
 *   active filter reveals the full path to every match regardless of
 *   manual collapse state.
 */
export function flattenTreeRows<T extends TreeRowNode>(
  nodes: readonly T[],
  options: {
    expandedIds: ReadonlySet<string | number>;
    visibleIds?: ReadonlySet<string | number> | null;
  },
): FlattenedTreeRow<T>[] {
  const childrenIndex = buildChildrenIndex(nodes);
  const { expandedIds, visibleIds } = options;
  const isFiltering = visibleIds != null;

  const result: FlattenedTreeRow<T>[] = [];

  const walk = (parentId: string | number | null, depth: number): void => {
    const children = childrenIndex.get(parentId) ?? [];
    children.forEach((node) => {
      if (isFiltering && !visibleIds.has(node.id)) {
        return;
      }

      const hasChildren = (childrenIndex.get(node.id)?.length ?? 0) > 0;
      result.push({ node, depth, hasChildren });

      const shouldDescend = isFiltering || expandedIds.has(node.id);
      if (shouldDescend) {
        walk(node.id, depth + 1);
      }
    });
  };

  walk(null, 0);
  return result;
}

/**
 * Returns the ids of every node (root = depth 0) with children whose depth
 * is less than `maxDepth`. Passing this set to an expand/collapse state
 * reveals every node up to (but not including) that depth — e.g. maxDepth=1
 * expands only root-level nodes (revealing their direct children), while
 * those children's own children stay collapsed. Pass `Number.POSITIVE_INFINITY`
 * to expand every level, or 0 to collapse everything (an empty set).
 *
 * Domain-agnostic: works for any tree fed through `flattenTreeRows` (the
 * Standort/Parzelle/Beet hierarchy, the occupancy calendar tree, etc.),
 * backing a single shared "expand to level N" control across pages.
 */
export function collectExpandedIdsUpToDepth<T extends TreeRowNode>(
  nodes: readonly T[],
  maxDepth: number,
): Set<string | number> {
  const childrenIndex = buildChildrenIndex(nodes);
  const result = new Set<string | number>();

  const walk = (parentId: string | number | null, depth: number): void => {
    if (depth >= maxDepth) {
      return;
    }
    const children = childrenIndex.get(parentId) ?? [];
    children.forEach((node) => {
      if ((childrenIndex.get(node.id)?.length ?? 0) > 0) {
        result.add(node.id);
      }
      walk(node.id, depth + 1);
    });
  };

  walk(null, 0);
  return result;
}

/**
 * Number of distinct levels present in the tree (root = level 1). A plain
 * Standort -> Parzelle -> Beet tree has 3; a tree that omits the location
 * level entirely (single-location projects, see FieldsBedsHierarchy) has 2.
 * Backs a depth control that offers exactly as many levels as the tree
 * actually has, instead of assuming a fixed depth.
 */
export function getTreeLevelCount<T extends TreeRowNode>(nodes: readonly T[]): number {
  const childrenIndex = buildChildrenIndex(nodes);
  let maxDepth = 0;

  const walk = (parentId: string | number | null, depth: number): void => {
    const children = childrenIndex.get(parentId) ?? [];
    children.forEach((node) => {
      maxDepth = Math.max(maxDepth, depth);
      walk(node.id, depth + 1);
    });
  };

  walk(null, 0);
  return maxDepth + 1;
}

/**
 * The deepest level (1-based, root = level 1) for which every branch of the
 * tree is guaranteed expanded — i.e. `collectExpandedIdsUpToDepth(nodes, level - 1)`
 * is fully contained in `expandedIds`. Always returns a value between 1 and
 * `levelCount`: manual per-row toggles beyond this floor don't prevent a
 * result, so the expand/collapse-one-level toolbar always has a well-defined
 * level to step from. Level sets are nested (level N's required ids are a
 * subset of level N+1's), so the scan can stop at the first unmet level.
 *
 * Only ids that are actually expandable nodes in this tree are considered,
 * so unrelated leftover ids in a shared/persisted `expandedIds` set (e.g.
 * from a different project or view) don't affect the result.
 */
export function computeExpandedDepthLevel<T extends TreeRowNode>(
  nodes: readonly T[],
  expandedIds: ReadonlySet<string | number>,
  levelCount: number,
): number {
  const childrenIndex = buildChildrenIndex(nodes);
  const expandableIds = new Set(
    nodes
      .filter((node) => (childrenIndex.get(node.id)?.length ?? 0) > 0)
      .map((node) => node.id),
  );
  const relevantExpanded = new Set(
    [...expandedIds].filter((id) => expandableIds.has(id)),
  );

  let level = 1;
  for (let candidate = 2; candidate <= levelCount; candidate += 1) {
    const required = collectExpandedIdsUpToDepth(nodes, candidate - 1);
    if (![...required].every((id) => relevantExpanded.has(id))) {
      break;
    }
    level = candidate;
  }
  return level;
}
