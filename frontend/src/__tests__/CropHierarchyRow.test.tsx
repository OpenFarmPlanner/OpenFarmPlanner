import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { List } from '@mui/material';
import { CropHierarchyRow } from '../cultures/CropHierarchyRow';

const baseProps = {
  depth: 0,
  hasChildren: false,
  isExpanded: false,
  onToggleExpand: () => {},
  expandLabel: 'Expand',
  collapseLabel: 'Collapse',
  isSelected: false,
  isClickable: true,
  primary: 'Tomate',
  isPrimaryEmphasized: true,
  onClick: () => {},
  onDoubleClick: () => {},
};

describe('CropHierarchyRow', () => {
  it('shows the variety count as a compact "(N)" badge instead of a family/varieties subtitle', () => {
    render(
      <List>
        <CropHierarchyRow {...baseProps} varietyCount={3} />
      </List>,
    );

    expect(screen.getByText('(3)')).toBeInTheDocument();
    expect(screen.queryByText(/varieties/i)).not.toBeInTheDocument();
  });

  it('omits the count badge when there are no varieties', () => {
    render(
      <List>
        <CropHierarchyRow {...baseProps} varietyCount={0} />
      </List>,
    );

    expect(screen.queryByText('(0)')).not.toBeInTheDocument();
  });

  it('renders the secondary text passed in for variety rows', () => {
    render(
      <List>
        <CropHierarchyRow {...baseProps} isPrimaryEmphasized={false} secondary="Direktsaat" />
      </List>,
    );

    expect(screen.getByText('Direktsaat')).toBeInTheDocument();
  });

  it('toggles expansion via the chevron without triggering the row click', async () => {
    const user = userEvent.setup();
    const onToggleExpand = vi.fn();
    const onClick = vi.fn();

    render(
      <List>
        <CropHierarchyRow
          {...baseProps}
          hasChildren
          onToggleExpand={onToggleExpand}
          onClick={onClick}
        />
      </List>,
    );

    await user.click(screen.getByRole('button', { name: 'Expand' }));

    expect(onToggleExpand).toHaveBeenCalledTimes(1);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('invokes onClick when the row itself is clicked', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();

    render(
      <List>
        <CropHierarchyRow {...baseProps} onClick={onClick} />
      </List>,
    );

    await user.click(screen.getByRole('option', { name: 'Tomate' }));

    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
