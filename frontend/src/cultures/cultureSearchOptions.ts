import type { SearchableSelectOption } from '../components/inputs/SearchableSelect';
import { buildCropHierarchy } from './cropHierarchy';
import type { Culture } from '../api/types';

export interface CultureSearchGroup {
  key: string;
  /** The Kultur name shown in the group header and announced as the group name. */
  label: string;
  /**
   * The option that stands for the general Kultur itself, or `null` when the
   * project has no varietyless row for this group. A group without one still
   * gets a header, but a header nothing can be selected on.
   */
  headerOptionValue: number | null;
}

export interface CultureSearchGrouping {
  /** Options in group order: each group's header first, then its varieties. */
  options: SearchableSelectOption<Culture>[];
  groups: Map<string, CultureSearchGroup>;
  groupKeyByOptionValue: Map<number, string>;
  optionLabelByValue: Map<number, string>;
}

const UNGROUPED_KEY_PREFIX = 'option:';

/**
 * Turns the flat culture options into the grouped structure the search
 * dropdown renders: one group per Kultur, its general entry as the header row
 * and its Sorten below it.
 *
 * The grouping itself comes from `buildCropHierarchy`, so the dropdown groups
 * cultures exactly like the tree next to it instead of re-deriving what
 * belongs together. Options the hierarchy cannot place (no culture payload)
 * keep their own single-row group rather than disappearing.
 */
export function buildCultureSearchGrouping(
  options: readonly SearchableSelectOption<Culture>[],
): CultureSearchGrouping {
  const optionsByCultureId = new Map<number, SearchableSelectOption<Culture>>();
  const optionLabelByValue = new Map<number, string>();
  options.forEach((option) => {
    optionLabelByValue.set(option.value, option.label);
    if (option.data?.id !== undefined) {
      optionsByCultureId.set(option.data.id, option);
    }
  });

  const groupedOptions: SearchableSelectOption<Culture>[] = [];
  const groups = new Map<string, CultureSearchGroup>();
  const groupKeyByOptionValue = new Map<number, string>();
  const placedOptionValues = new Set<number>();

  const cultures = options
    .map((option) => option.data)
    .filter((culture): culture is Culture => culture !== undefined);

  buildCropHierarchy(cultures).forEach((item) => {
    const cultureId = item.culture?.id;
    const option = cultureId === undefined ? undefined : optionsByCultureId.get(cultureId);
    if (item.kind === 'species') {
      groups.set(item.speciesKey, {
        key: item.speciesKey,
        label: item.label,
        headerOptionValue: option?.value ?? null,
      });
    }
    if (!option || placedOptionValues.has(option.value)) {
      return;
    }
    placedOptionValues.add(option.value);
    groupKeyByOptionValue.set(option.value, item.speciesKey);
    groupedOptions.push(option);
  });

  options.forEach((option) => {
    if (placedOptionValues.has(option.value)) {
      return;
    }
    const key = `${UNGROUPED_KEY_PREFIX}${option.value}`;
    groups.set(key, { key, label: option.label, headerOptionValue: null });
    groupKeyByOptionValue.set(option.value, key);
    groupedOptions.push(option);
  });

  return {
    options: groupedOptions,
    groups,
    groupKeyByOptionValue,
    optionLabelByValue,
  };
}

/**
 * The text a variety row shows: only the Sorte, since its group header already
 * names the Kultur.
 */
export function getCultureSearchVarietyLabel(
  option: SearchableSelectOption<Culture>,
  fallbackLabel: string,
): string {
  return (option.data?.variety || '').trim() || fallbackLabel;
}
