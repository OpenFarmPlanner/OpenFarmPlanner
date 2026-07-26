/**
 * Verifies the initial-expansion behavior introduced for very large
 * hierarchies: small projects still fully expand (locations + fields,
 * revealing every bed) on first load, while projects above
 * HIERARCHY_AUTO_EXPAND_ALL_THRESHOLD only expand locations, leaving fields
 * (and their beds) collapsed for a scannable initial overview.
 *
 * The DataGrid is mocked to a plain row list (no MUI internals), since the
 * behavior under test is which rows the page decides are visible — not
 * DataGrid's own rendering/virtualization.
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router';
import FieldsBedsHierarchy from '../pages/FieldsBedsHierarchy';
import { mockT } from './helpers/testI18n';

const { bedListMock, fieldListMock, locationListMock } = vi.hoisted(() => ({
  bedListMock: vi.fn(),
  fieldListMock: vi.fn(),
  locationListMock: vi.fn(),
}));

vi.mock('../i18n', () => ({ useTranslation: () => ({ t: mockT }) }));
vi.mock('../commands/useCommandContext', () => ({
  useCommandContextTag: vi.fn(),
  useRegisterCommands: vi.fn(),
}));
vi.mock('../hooks/autosave', () => ({ useNavigationBlocker: vi.fn() }));

vi.mock('../api/api', async () => {
  const actual = await vi.importActual<typeof import('../api/api')>('../api/api');
  return {
    ...actual,
    // listAll mirrors whatever list() is mocked to resolve, unwrapped —
    // useHierarchyData uses listAll (not list) to fetch every page.
    bedAPI: {
      create: vi.fn(), delete: vi.fn(), list: bedListMock, update: vi.fn(),
      listAll: async () => (await bedListMock()).data,
    },
    fieldAPI: {
      create: vi.fn(), delete: vi.fn(), list: fieldListMock, update: vi.fn(),
      listAll: async () => (await fieldListMock()).data,
    },
    locationAPI: {
      create: vi.fn(), delete: vi.fn(), list: locationListMock, update: vi.fn(),
      listAll: async () => (await locationListMock()).data,
    },
  };
});

vi.mock('@mui/x-data-grid', async () => {
  const ReactModule = await import('react');
  const useGridApiRef = vi.fn(() => ReactModule.useRef({}));

  const DataGrid = ({ rows }: { rows: Array<{ id: string | number; type: string }> }) => (
    <div data-testid="hierarchy-grid">
      {rows.map((row) => (
        <div data-testid={`row-${row.id}`} key={String(row.id)} role="row">
          {String(row.id)}
        </div>
      ))}
    </div>
  );

  return {
    DataGrid,
    GridRowModes: { Edit: 'edit', View: 'view' },
    GridRowEditStopReasons: {
      escapeKeyDown: 'escapeKeyDown',
      enterKeyDown: 'enterKeyDown',
      rowFocusOut: 'rowFocusOut',
      shiftTabKeyDown: 'shiftTabKeyDown',
      tabKeyDown: 'tabKeyDown',
    },
    useGridApiRef,
  };
});

const renderHierarchy = () =>
  render(
    <MemoryRouter initialEntries={['/app/fields-beds']}>
      <FieldsBedsHierarchy showTitle={false} />
    </MemoryRouter>,
  );

describe('FieldsBedsHierarchy initial expansion at scale', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.sessionStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('fully expands a small hierarchy (below the threshold), showing beds by default', async () => {
    locationListMock.mockResolvedValue({ data: { results: [{ id: 1, name: 'Standort A' }] } });
    fieldListMock.mockResolvedValue({
      data: {
        results: Array.from({ length: 3 }, (_, i) => ({
          id: i + 1, name: `Parzelle ${i + 1}`, location: 1, area_sqm: 10,
        })),
      },
    });
    bedListMock.mockResolvedValue({
      data: {
        results: Array.from({ length: 5 }, (_, i) => ({
          id: i + 1, name: `Beet ${i + 1}`, field: 1, area_sqm: 2,
        })),
      },
    });

    renderHierarchy();

    await waitFor(() => expect(screen.getByTestId('row-field-1')).toBeInTheDocument());
    await waitFor(() => expect(screen.getByTestId(`row-${1}`)).toBeInTheDocument(), { timeout: 3000 });
  });

  it('only expands locations for a very large hierarchy, leaving beds collapsed', async () => {
    const FIELD_COUNT = 250;
    locationListMock.mockResolvedValue({ data: { results: [{ id: 1, name: 'Standort A' }] } });
    fieldListMock.mockResolvedValue({
      data: {
        results: Array.from({ length: FIELD_COUNT }, (_, i) => ({
          id: i + 1, name: `Parzelle ${i + 1}`, location: 1, area_sqm: 10,
        })),
      },
    });
    bedListMock.mockResolvedValue({
      data: { results: [{ id: 1, name: 'Beet 1', field: 1, area_sqm: 2 }] },
    });

    renderHierarchy();

    await waitFor(() => expect(screen.getByTestId('row-field-1')).toBeInTheDocument());
    // Fields are visible (locations expanded)…
    expect(screen.getByTestId('row-field-1')).toBeInTheDocument();
    expect(screen.getByTestId(`row-field-${FIELD_COUNT}`)).toBeInTheDocument();
    // …but beds stay hidden behind their (collapsed) field.
    expect(screen.queryByTestId(`row-${1}`)).not.toBeInTheDocument();
  });
});
