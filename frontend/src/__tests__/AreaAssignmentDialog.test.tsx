import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Bed, Field, Location } from '../api/types';
import { AreaAssignmentDialog } from '../components/planting-plans/AreaAssignmentDialog';

const locations: Location[] = [
  { id: 1, name: 'Regenbogenland' },
  { id: 2, name: 'Sonnengarten' },
  { id: 3, name: 'Leerstandort' },
];

const fields: Field[] = [
  { id: 11, name: '8 Karotte + Zwiebel', location: 1 },
  { id: 12, name: '9 Pastinake', location: 1 },
  { id: 21, name: '5 Tomate', location: 2 },
  { id: 31, name: 'Ohne Beete', location: 3 },
];

const beds: Bed[] = [
  { id: 101, name: '5', field: 11, field_name: '8 Karotte + Zwiebel', area_sqm: 10 },
  { id: 102, name: '6', field: 12, field_name: '9 Pastinake', area_sqm: 8 },
  { id: 201, name: '5', field: 21, field_name: '5 Tomate', area_sqm: 12.5 },
];

const openDialog = async (): Promise<void> => {
  const user = userEvent.setup();
  await user.click(screen.getByLabelText('Anbaufläche bearbeiten'));
  expect(await screen.findByRole('dialog', { name: 'Anbaufläche ändern' })).toBeInTheDocument();
};

const openSelect = async (label: string): Promise<void> => {
  const user = userEvent.setup();
  const trigger = screen.getByRole('combobox', { name: label });
  await user.click(trigger);
};

const expectFocusAfterTab = async (user: ReturnType<typeof userEvent.setup>, element: HTMLElement): Promise<void> => {
  await user.tab();
  await waitFor(() => {
    expect(element).toHaveFocus();
  });
};

describe('AreaAssignmentDialog', () => {
  it('opens with current location/field/bed selection', async () => {
    render(
      <AreaAssignmentDialog
        bedId={101}
        beds={beds}
        fields={fields}
        locations={locations}
        locale="de-DE"
        compactLabel="Regenbogenland · 8 Karotte + Zwiebel · 5 (10,00 m²)"
        onApply={vi.fn()}
      />,
    );

    await openDialog();

    expect(screen.getByRole('combobox', { name: 'Standort' })).toHaveTextContent('Regenbogenland');
    expect(screen.getByRole('combobox', { name: 'Parzelle' })).toHaveTextContent('8 Karotte + Zwiebel');
    expect(screen.getByRole('combobox', { name: 'Beet' })).toHaveTextContent(/5 \(10,00\s+m²\)/);
  });

  it('filters fields and beds when location changes', async () => {
    render(
      <AreaAssignmentDialog bedId={101} beds={beds} fields={fields} locations={locations} locale="de-DE" compactLabel="x" onApply={vi.fn()} />,
    );

    await openDialog();
    await openSelect('Standort');
    await userEvent.setup().click(screen.getByRole('option', { name: 'Sonnengarten' }));

    await openSelect('Parzelle');
    const listbox = await screen.findByRole('listbox');
    expect(within(listbox).getByRole('option', { name: '5 Tomate' })).toBeInTheDocument();
    expect(within(listbox).queryByRole('option', { name: 'Ohne Beete' })).not.toBeInTheDocument();
  });

  it('filters beds when field changes', async () => {
    render(
      <AreaAssignmentDialog bedId={101} beds={beds} fields={fields} locations={locations} locale="de-DE" compactLabel="x" onApply={vi.fn()} />,
    );

    await openDialog();
    await openSelect('Parzelle');
    await userEvent.setup().click(screen.getByRole('option', { name: '9 Pastinake' }));

    await openSelect('Beet');
    const listbox = await screen.findByRole('listbox');
    expect(within(listbox).getByRole('option', { name: /^6 \(8,00\s+m²\)$/ })).toBeInTheDocument();
    expect(within(listbox).queryByRole('option', { name: '5 (10,00 m²)' })).not.toBeInTheDocument();
  });

  it('shows bed option labels without redundant field names', async () => {
    render(
      <AreaAssignmentDialog bedId={101} beds={beds} fields={fields} locations={locations} locale="de-DE" compactLabel="x" onApply={vi.fn()} />,
    );

    await openDialog();
    await openSelect('Beet');
    const listbox = await screen.findByRole('listbox');
    expect(within(listbox).getByRole('option', { name: /^5 \(10,00\s+m²\)$/ })).toBeInTheDocument();
    expect(within(listbox).queryByRole('option', { name: '8 Karotte + Zwiebel | 5 (10,00 m²)' })).not.toBeInTheDocument();
  });

  it('sets location and field automatically when bed changes', async () => {
    render(
      <AreaAssignmentDialog bedId={101} beds={beds} fields={fields} locations={locations} locale="de-DE" compactLabel="x" onApply={vi.fn()} />,
    );

    await openDialog();
    await openSelect('Standort');
    await userEvent.setup().click(screen.getByRole('option', { name: 'Sonnengarten' }));
    await openSelect('Parzelle');
    await userEvent.setup().click(screen.getByRole('option', { name: '5 Tomate' }));
    await openSelect('Beet');
    await userEvent.setup().click(screen.getByRole('option', { name: /^5 \(12,50\s+m²\)$/ }));

    expect(screen.getByRole('combobox', { name: 'Standort' })).toHaveTextContent('Sonnengarten');
    expect(screen.getByRole('combobox', { name: 'Parzelle' })).toHaveTextContent('5 Tomate');
    expect(screen.getByRole('combobox', { name: 'Beet' })).toHaveTextContent(/5 \(12,50\s+m²\)/);
  });

  it('applies the changed bed selection', async () => {
    const onApply = vi.fn();
    render(
      <AreaAssignmentDialog bedId={101} beds={beds} fields={fields} locations={locations} locale="de-DE" compactLabel="x" onApply={onApply} />,
    );

    await openDialog();
    await openSelect('Parzelle');
    await userEvent.setup().click(screen.getByRole('option', { name: '9 Pastinake' }));
    await openSelect('Beet');
    await userEvent.setup().click(screen.getByRole('option', { name: /^6 \(8,00\s+m²\)$/ }));
    await userEvent.setup().click(screen.getByRole('button', { name: 'Übernehmen' }));

    expect(onApply).toHaveBeenCalledWith(102);
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Anbaufläche ändern' })).not.toBeInTheDocument();
    });
  });

  it('cancels dialog changes without applying', async () => {
    const onApply = vi.fn();
    render(
      <AreaAssignmentDialog bedId={101} beds={beds} fields={fields} locations={locations} locale="de-DE" compactLabel="x" onApply={onApply} />,
    );

    await openDialog();
    await openSelect('Parzelle');
    await userEvent.setup().click(screen.getByRole('option', { name: '9 Pastinake' }));
    await openSelect('Beet');
    await userEvent.setup().click(screen.getByRole('option', { name: /^6 \(8,00\s+m²\)$/ }));
    await userEvent.setup().click(screen.getByRole('button', { name: 'Abbrechen' }));

    expect(onApply).not.toHaveBeenCalled();

    await openDialog();
    expect(screen.getByRole('combobox', { name: 'Beet' })).toHaveTextContent(/5 \(10,00\s+m²\)/);
  });

  it('keeps the location selector visible when only one selectable location exists', async () => {
    const singleLocationFields: Field[] = [
      { id: 11, name: '8 Karotte + Zwiebel', location: 1 },
      { id: 12, name: '9 Pastinake', location: 1 },
    ];

    render(
      <AreaAssignmentDialog
        bedId={101}
        beds={beds.filter((item) => item.id !== 201)}
        fields={singleLocationFields}
        locations={locations}
        locale="de-DE"
        compactLabel="x"
        onApply={vi.fn()}
      />,
    );

    await openDialog();
    expect(screen.getByRole('combobox', { name: 'Standort' })).toHaveTextContent('Regenbogenland');
    expect(screen.getByRole('combobox', { name: 'Parzelle' })).toBeInTheDocument();
  });

  it('does not apply the dialog when Enter is used inside an opened dropdown', async () => {
    const onApply = vi.fn();
    const user = userEvent.setup();
    render(
      <AreaAssignmentDialog bedId={101} beds={beds} fields={fields} locations={locations} locale="de-DE" compactLabel="x" onApply={onApply} />,
    );

    await openDialog();
    await user.click(screen.getByRole('combobox', { name: 'Standort' }));
    await user.keyboard('{ArrowDown}{Enter}');

    expect(onApply).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: 'Anbaufläche ändern' })).toBeInTheDocument();
  });

  it('follows logical tab order and supports Enter on action buttons', async () => {
    const onApply = vi.fn();
    const user = userEvent.setup();
    render(
      <AreaAssignmentDialog bedId={101} beds={beds} fields={fields} locations={locations} locale="de-DE" compactLabel="x" onApply={onApply} />,
    );

    await openDialog();
    await expectFocusAfterTab(user, screen.getByRole('combobox', { name: 'Standort' }));
    await expectFocusAfterTab(user, screen.getByRole('combobox', { name: 'Parzelle' }));
    await expectFocusAfterTab(user, screen.getByRole('combobox', { name: 'Beet' }));
    await expectFocusAfterTab(user, screen.getByRole('button', { name: 'Abbrechen' }));
    await user.keyboard('{Enter}');
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Anbaufläche ändern' })).not.toBeInTheDocument();
    });

    await openDialog();
    const applyButton = screen.getByRole('button', { name: 'Übernehmen' });
    await expectFocusAfterTab(user, screen.getByRole('combobox', { name: 'Standort' }));
    await expectFocusAfterTab(user, screen.getByRole('combobox', { name: 'Parzelle' }));
    await expectFocusAfterTab(user, screen.getByRole('combobox', { name: 'Beet' }));
    await expectFocusAfterTab(user, screen.getByRole('button', { name: 'Abbrechen' }));
    await expectFocusAfterTab(user, applyButton);
    await user.keyboard('{Enter}');

    expect(onApply).toHaveBeenCalledWith(101);
  });

  it('supports reverse tab order with Shift+Tab', async () => {
    const user = userEvent.setup();
    render(
      <AreaAssignmentDialog bedId={101} beds={beds} fields={fields} locations={locations} locale="de-DE" compactLabel="x" onApply={vi.fn()} />,
    );

    await openDialog();
    await expectFocusAfterTab(user, screen.getByRole('combobox', { name: 'Standort' }));
    await expectFocusAfterTab(user, screen.getByRole('combobox', { name: 'Parzelle' }));
    await expectFocusAfterTab(user, screen.getByRole('combobox', { name: 'Beet' }));
    await expectFocusAfterTab(user, screen.getByRole('button', { name: 'Abbrechen' }));
    await expectFocusAfterTab(user, screen.getByRole('button', { name: 'Übernehmen' }));

    await user.keyboard('{Shift>}{Tab}{/Shift}');
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Abbrechen' })).toHaveFocus();
    });
    await user.keyboard('{Shift>}{Tab}{/Shift}');
    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: 'Beet' })).toHaveFocus();
    });
    await user.keyboard('{Shift>}{Tab}{/Shift}');
    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: 'Parzelle' })).toHaveFocus();
    });
    await user.keyboard('{Shift>}{Tab}{/Shift}');
    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: 'Standort' })).toHaveFocus();
    });
  });

  it('keeps tab navigation working after confirming a dropdown option with Enter', async () => {
    const user = userEvent.setup();
    render(
      <AreaAssignmentDialog bedId={101} beds={beds} fields={fields} locations={locations} locale="de-DE" compactLabel="x" onApply={vi.fn()} />,
    );

    await openDialog();
    const locationSelect = screen.getByRole('combobox', { name: 'Standort' });
    await user.click(locationSelect);
    await user.keyboard('{ArrowDown}{Enter}');

    expect(screen.getByRole('combobox', { name: 'Standort' })).toHaveFocus();
    await expectFocusAfterTab(user, screen.getByRole('combobox', { name: 'Parzelle' }));
  });
});
