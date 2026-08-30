import { describe, expect, it } from 'vitest';
import {
  formatHistoryChangeValue,
  getBatchSummary,
  getHistoryChangeFieldLabel,
  getHistoryActorLabel,
  getHistoryEntryMeta,
  getHistoryEntryTarget,
  getHistoryEntryTitle,
  isBatchGroupEntry,
} from '../pages/culturesHistoryUtils';
import i18n from '../i18n';
import type { CultureHistoryEntry } from '../api/types';

const t = i18n.getFixedT('de', 'cultures');

function buildEntry(partial: Partial<CultureHistoryEntry>): CultureHistoryEntry {
  return {
    history_id: 1,
    history_date: '2026-03-23T14:48:00.000Z',
    history_type: 'snapshot',
    history_user: null,
    summary: '',
    ...partial,
  };
}

describe('culturesHistoryUtils', () => {
  it('builds a localized title with object label and display name', () => {
    const entry = buildEntry({
      object_type: 'culture',
      object_display_name: 'Bijella',
      action: 'updated',
    });

    expect(getHistoryEntryTitle(entry, t)).toBe('Kultur „Bijella“ bearbeitet');
  });

  it('falls back to generic localized labels for unknown object type and missing name', () => {
    const entry = buildEntry({
      object_type: 'unknown_type',
      object_display_name: null,
      action: 'created',
    });

    expect(getHistoryEntryTitle(entry, t)).toBe('Eintrag erstellt');
  });

  it('prefers actor_label over history_user and falls back to unknown user', () => {
    const withActor = buildEntry({ actor_label: 'Martin Stipsitz', history_user: 'ignored@example.com' });
    const withHistoryUser = buildEntry({ actor_label: '', history_user: 'user@example.com' });
    const withoutActor = buildEntry({ actor_label: '', history_user: null });

    expect(getHistoryActorLabel(withActor, t)).toBe('Martin Stipsitz');
    expect(getHistoryActorLabel(withHistoryUser, t)).toBe('user@example.com');
    expect(getHistoryActorLabel(withoutActor, t)).toBe('Unbekannter Nutzer');
    expect(getHistoryActorLabel(withoutActor, t, 'Fallback User')).toBe('Fallback User');
  });

  it('builds metadata line with explicit version timestamp wording', () => {
    const entry = buildEntry({
      actor_label: 'Martin Stipsitz',
      history_date: '2026-03-23T14:48:00.000Z',
    });

    const meta = getHistoryEntryMeta(entry, t);
    expect(meta).toContain('Version vom');
  });

  it('builds culture links from culture_id and summary fallback', () => {
    const withCultureId = buildEntry({
      object_type: 'culture',
      culture_id: 42,
      summary: 'Culture #42 updated',
    });
    const withSummaryId = buildEntry({
      object_type: 'culture',
      summary: 'Culture #7 updated',
    });

    expect(getHistoryEntryTarget(withCultureId)).toBe('/app/cultures?cultureId=42');
    expect(getHistoryEntryTarget(withSummaryId)).toBe('/app/cultures?cultureId=7');
  });

  it('builds planting plan link and returns null for unsupported types', () => {
    const plantingPlanEntry = buildEntry({
      object_type: 'planting_plan',
      summary: 'PlantingPlan #3 created',
    });
    const unsupportedEntry = buildEntry({
      object_type: 'field',
      summary: 'Field #2 updated',
    });

    expect(getHistoryEntryTarget(plantingPlanEntry)).toBe('/app/planting-plans');
    expect(getHistoryEntryTarget(unsupportedEntry)).toBeNull();
  });

  it('treats a batch entry as a group only once it holds two or more revisions', () => {
    const child = buildEntry({ object_type: 'planting_plan', action: 'deleted' });
    expect(isBatchGroupEntry(buildEntry({ is_batch: true, children: [child] }))).toBe(false);
    expect(isBatchGroupEntry(buildEntry({ is_batch: true, children: [child, child] }))).toBe(true);
    expect(isBatchGroupEntry(buildEntry({ children: [child, child] }))).toBe(false);
  });

  it('summarizes a season-delete batch with per-action planting-plan counts', () => {
    const entry = buildEntry({
      is_batch: true,
      batch_operation_type: 'season_delete',
      batch_context: { season_label: '25/26' },
      children: [
        buildEntry({ object_type: 'season', action: 'deleted' }),
        buildEntry({ object_type: 'planting_plan', action: 'deleted' }),
        buildEntry({ object_type: 'planting_plan', action: 'deleted' }),
      ],
    });

    expect(getBatchSummary(entry, t)).toBe('Saison 25/26 gelöscht: 2 Anbaupläne gelöscht');
  });

  it('summarizes a season copy-data batch', () => {
    const entry = buildEntry({
      is_batch: true,
      batch_operation_type: 'season_copy_data',
      batch_context: { source_season_label: '24/25', target_season_label: '25/26' },
      children: [
        buildEntry({ object_type: 'planting_plan', action: 'created' }),
      ],
    });

    expect(getBatchSummary(entry, t)).toBe('Daten aus Saison 24/25 übernommen: 1 Anbauplan neu angelegt');
  });

  it('formats culture history change labels and values', () => {
    const change = {
      field: 'expected_yield',
      old_value: 2.5,
      new_value: 3,
    };

    expect(getHistoryChangeFieldLabel(change, t)).toBe('Erwarteter Ertrag');
    expect(formatHistoryChangeValue(change.old_value, change.field, t)).toBe('2,5 kg');
    expect(formatHistoryChangeValue(change.new_value, change.field, t)).toBe('3 kg');
  });
});
