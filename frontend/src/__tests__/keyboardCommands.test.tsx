import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { matchesShortcut, isTypingInEditableElement, useKeyboardShortcuts, type ShortcutSpec } from '../hooks/useKeyboardShortcuts';
import { CommandPalette } from '../commands/CommandPalette';
import { filterCommands } from '../commands/commandPaletteUtils';
import type { CommandSpec } from '../commands/types';

describe('useKeyboardShortcuts helpers', () => {
  it('matches alt/shift shortcut combinations exactly', () => {
    const event = new KeyboardEvent('keydown', { key: 'D', altKey: true, shiftKey: true });
    expect(matchesShortcut(event, { alt: true, shift: true, key: 'd' })).toBe(true);
    expect(matchesShortcut(event, { alt: true, key: 'd' })).toBe(false);
  });

  it('matches ctrl/shift shortcut combinations exactly', () => {
    const event = new KeyboardEvent('keydown', { key: 'ArrowRight', ctrlKey: true, shiftKey: true });
    expect(matchesShortcut(event, { ctrl: true, shift: true, key: 'ArrowRight' })).toBe(true);
    expect(matchesShortcut(event, { shift: true, key: 'ArrowRight' })).toBe(false);
  });

  it('ignores typing focus for editable elements', () => {
    const input = document.createElement('input');
    expect(isTypingInEditableElement(input)).toBe(true);

    const div = document.createElement('div');
    div.setAttribute('contenteditable', 'true');
    expect(isTypingInEditableElement(div)).toBe(true);
  });

  it('allows focused page listboxes while still blocking open popover listboxes', () => {
    const pageListbox = document.createElement('div');
    pageListbox.setAttribute('role', 'listbox');
    expect(isTypingInEditableElement(pageListbox)).toBe(false);

    const popover = document.createElement('div');
    popover.className = 'MuiPopover-root';
    const popoverListbox = document.createElement('div');
    popoverListbox.setAttribute('role', 'listbox');
    popover.append(popoverListbox);
    document.body.append(popover);

    expect(isTypingInEditableElement(popoverListbox)).toBe(true);

    popover.remove();
  });
});

function ShortcutHarness({ contexts, shortcut }: { contexts: string[]; shortcut: ShortcutSpec }): JSX.Element {
  const [count, setCount] = useState(0);
  useKeyboardShortcuts([
    {
      ...shortcut,
      action: () => {
        setCount((value) => value + 1);
        shortcut.action();
      },
    },
  ], true, { currentContexts: contexts });

  return <div data-testid="count">{count}</div>;
}

describe('useKeyboardShortcuts context guard', () => {
  it('runs command only in matching context', () => {
    const action = vi.fn();
    render(
      <ShortcutHarness
        contexts={['global']}
        shortcut={{ id: 'a', title: 'A', keys: { alt: true, key: 'e' }, contexts: ['cropDetail'], action }}
      />,
    );

    fireEvent.keyDown(window, { key: 'e', altKey: true });
    expect(action).not.toHaveBeenCalled();
  });
});

describe('command palette', () => {
  it('filters and executes a command', () => {
    const action = vi.fn();
    const commands: CommandSpec[] = [
      {
        id: 'crop.edit',
        label: 'Kultur bearbeiten',
        group: 'navigation',
        keywords: ['kultur', 'bearbeiten'],
        shortcutHint: 'Alt+E',
        contextTags: ['crops'],
        isEnabled: () => true,
        action,
      },
    ];

    expect(filterCommands(commands, 'bearb')).toHaveLength(1);

    render(<CommandPalette open commands={commands} onClose={vi.fn()} />);

    const input = screen.getByRole('textbox', { name: 'Aktionssuche' });
    fireEvent.change(input, { target: { value: 'bearb' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(action).toHaveBeenCalledTimes(1);
  });

  it('runs the clicked command even when its group is scattered non-contiguously in the input list', () => {
    // Regression test: commands sharing a group (e.g. "navigation") can arrive
    // interleaved with other groups when registered from different scopes
    // (global commands vs. a page's own commands). The palette visually
    // buckets same-group items together, so the click handler must resolve
    // against that same bucketed order — not the original input order.
    const editAction = vi.fn();
    const switchProjectAction = vi.fn();
    const commands: CommandSpec[] = [
      { id: 'nav.first', label: 'Add crop', group: 'navigation', keywords: [], contextTags: ['global'], action: vi.fn() },
      { id: 'project.settings', label: 'Open project settings', group: 'project', keywords: [], contextTags: ['global'], action: vi.fn() },
      { id: 'project.switch.a', label: 'Switch project: Alpha', group: 'project', keywords: [], contextTags: ['global'], action: vi.fn() },
      { id: 'project.switch.b', label: 'Switch project: Beta', group: 'project', keywords: [], contextTags: ['global'], action: switchProjectAction },
      { id: 'nav.second', label: 'Toggle sidebar', group: 'navigation', keywords: [], contextTags: ['global'], action: vi.fn() },
      { id: 'crop.edit', label: 'Edit crop', group: 'navigation', keywords: [], contextTags: ['crops'], action: editAction },
    ];

    render(<CommandPalette open commands={commands} onClose={vi.fn()} />);

    fireEvent.click(screen.getByText('Edit crop'));
    expect(editAction).toHaveBeenCalledTimes(1);
    expect(switchProjectAction).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText('Switch project: Beta'));
    expect(switchProjectAction).toHaveBeenCalledTimes(1);
  });

  it('shows shortcut hints in the result list', () => {
    const commands: CommandSpec[] = [
      {
        id: 'help.palette',
        label: 'Aktionssuche (Alt+K)',
        group: 'help',
        keywords: ['palette'],
        shortcutHint: 'Alt+K',
        contextTags: ['global'],
        action: vi.fn(),
      },
    ];

    render(<CommandPalette open commands={commands} onClose={vi.fn()} />);

    expect(screen.getByText('Alt+K')).toBeInTheDocument();
  });
});
