import {
  Box,
  Chip,
  Divider,
  Dialog,
  DialogContent,
  DialogTitle,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Typography,
} from '@mui/material';
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CommandPalette } from './CommandPalette';
import { getRunnableCommands, getVisibleCommands } from './commands';
import type { CommandContextTag, CommandSpec, CreateAction } from './types';
import type { ShortcutSpec } from '../hooks/useKeyboardShortcuts';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { useTranslation } from '../i18n';
import { AlertSnackbar } from '../components/feedback/AlertSnackbar';
import { CommandContext } from './commandContextShared';
import { useFocusManager } from '../focus/useFocusManager';

const CONTEXT_TITLE_KEYS: Record<CommandContextTag, string> = {
  global: 'commandPalette.contextTitles.global',
  cultures: 'commandPalette.contextTitles.cultures',
  publicCropLibrary: 'commandPalette.contextTitles.publicCropLibrary',
  locations: 'commandPalette.contextTitles.locations',
  areas: 'commandPalette.contextTitles.areas',
  plans: 'commandPalette.contextTitles.plans',
  calendar: 'commandPalette.contextTitles.calendar',
  seedDemand: 'commandPalette.contextTitles.seedDemand',
};

const SHORTCUT_HINT_KEY = 'ofp.shortcutHintSeen';
const CREATE_SHORTCUT_HINT = 'Alt+Shift+N';
const CREATE_SHORTCUT_KEYS = { alt: true, shift: true, key: 'n' } as const;

function getShortcutParts(shortcutHint: string): string[] {
  return shortcutHint.split('/').map((part) => part.trim()).filter(Boolean);
}

function ShortcutHelpRow({ label, shortcutHint }: { label: string; shortcutHint: string }): React.ReactElement {
  return (
    <ListItem disableGutters sx={{ gap: 2, py: 0.75, px: 0, alignItems: 'center' }}>
      <Typography variant="body2" sx={{ flexGrow: 1, minWidth: 0 }}>
        {label}
      </Typography>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 0.75, flexShrink: 0 }}>
        {getShortcutParts(shortcutHint).map((part) => (
          <Chip
            key={part}
            label={part}
            size="small"
            variant="outlined"
            sx={{ borderRadius: 1, fontFamily: 'monospace', bgcolor: 'background.paper' }}
          />
        ))}
      </Box>
    </ListItem>
  );
}

function ShortcutHelpSection({ title, children }: { title: string; children: React.ReactNode }): React.ReactElement {
  return (
    <Box component="section" sx={{ mt: 2.5 }}>
      <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 0.5, fontWeight: 600 }}>
        {title}
      </Typography>
      <List dense disablePadding sx={{ borderTop: '1px solid', borderColor: 'divider' }}>
        {children}
      </List>
    </Box>
  );
}

const getAvailableCreateActions = (actions: CreateAction[]): CreateAction[] => actions
  .filter((action) => !action.hidden && !action.disabled)
  .sort((first, second) => (first.priority ?? 0) - (second.priority ?? 0) || first.label.localeCompare(second.label));

export function CommandProvider({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation(['navigation', 'common']);
  const { activeRegionId, getRegionShortcutsHelp } = useFocusManager();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [createChooserOpen, setCreateChooserOpen] = useState(false);
  const [hintOpen, setHintOpen] = useState(false);
  const [commandsByScope, setCommandsByScope] = useState<Record<string, CommandSpec[]>>({});
  const [createActionsByScope, setCreateActionsByScope] = useState<Record<string, CreateAction[]>>({});
  const [contextTagMap, setContextTagMap] = useState<Record<CommandContextTag, boolean>>({ global: true } as Record<CommandContextTag, boolean>);
  const previouslyFocusedElementRef = useRef<HTMLElement | null>(null);

  const currentContextTags = useMemo(
    () => Object.entries(contextTagMap).filter(([, active]) => active).map(([tag]) => tag as CommandContextTag),
    [contextTagMap],
  );

  const hasVisitedFeaturePageRef = useRef(false);

  useEffect(() => {
    if (currentContextTags.some((tag) => tag !== 'global')) {
      hasVisitedFeaturePageRef.current = true;
    }
  }, [currentContextTags]);

  useEffect(() => {
    if (localStorage.getItem(SHORTCUT_HINT_KEY) !== null || !hasVisitedFeaturePageRef.current) {
      return;
    }
    if (typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches) {
      return;
    }

    const timerId = window.setTimeout(() => {
      setHintOpen(true);
      localStorage.setItem(SHORTCUT_HINT_KEY, '1');
    }, 1800);

    return () => window.clearTimeout(timerId);
  }, [currentContextTags]);

  const openPalette = useCallback(() => {
    previouslyFocusedElementRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setPaletteOpen(true);
  }, []);

  const closePalette = useCallback(() => {
    setPaletteOpen(false);
    previouslyFocusedElementRef.current?.focus();
  }, []);

  const openShortcutsHelp = useCallback(() => {
    previouslyFocusedElementRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setHelpOpen(true);
  }, []);

  const closeShortcutsHelp = useCallback(() => {
    setHelpOpen(false);
    previouslyFocusedElementRef.current?.focus();
  }, []);

  const registerCommands = useCallback((scope: string, commands: CommandSpec[]) => {
    setCommandsByScope((previous) => ({ ...previous, [scope]: commands }));

    return () => {
      setCommandsByScope((previous) => {
        const nextState = { ...previous };
        delete nextState[scope];
        return nextState;
      });
    };
  }, []);

  const registerCreateActions = useCallback((scope: string, actions: CreateAction[]) => {
    setCreateActionsByScope((previous) => ({ ...previous, [scope]: actions }));

    return () => {
      setCreateActionsByScope((previous) => {
        const nextState = { ...previous };
        delete nextState[scope];
        return nextState;
      });
    };
  }, []);

  const setContextTag = useCallback((tag: CommandContextTag, active: boolean) => {
    setContextTagMap((previous) => {
      if (previous[tag] === active) {
        return previous;
      }

      return {
        ...previous,
        [tag]: active,
      };
    });
  }, []);

  const allCommands = useMemo(() => Object.values(commandsByScope).flat(), [commandsByScope]);
  const activeCreateActions = useMemo(
    () => getAvailableCreateActions(Object.values(createActionsByScope).flat()),
    [createActionsByScope],
  );

  const runPrimaryCreateAction = useCallback(() => {
    if (activeCreateActions.length === 1) {
      activeCreateActions[0].handler();
      return;
    }
    if (activeCreateActions.length > 1) {
      setCreateChooserOpen(true);
    }
  }, [activeCreateActions]);

  const createCommand = useMemo<CommandSpec | null>(() => {
    if (activeCreateActions.length === 0) {
      return null;
    }
    const label = activeCreateActions.length === 1
      ? `${activeCreateActions[0].label} (${CREATE_SHORTCUT_HINT})`
      : `${t('commandPalette.createNew')} (${CREATE_SHORTCUT_HINT})`;
    return {
      id: 'global.createNew',
      label,
      group: 'navigation',
      keywords: ['neu', 'erstellen', 'create', 'new'],
      shortcutHint: CREATE_SHORTCUT_HINT,
      keys: CREATE_SHORTCUT_KEYS,
      contextTags: ['global'],
      isEnabled: () => activeCreateActions.length > 0,
      action: runPrimaryCreateAction,
    };
  }, [activeCreateActions, runPrimaryCreateAction, t]);

  const commandsWithCreateAction = useMemo(
    () => (createCommand ? [createCommand, ...allCommands] : allCommands),
    [allCommands, createCommand],
  );

  const activeCommands = useMemo(() => {
    return getRunnableCommands(
      commandsWithCreateAction.filter((command) => command.contextTags.every((tag) => currentContextTags.includes(tag))),
    );
  }, [commandsWithCreateAction, currentContextTags]);

  const helpCommands = useMemo(
    () => getVisibleCommands(commandsWithCreateAction).filter((command) => (
      command.contextTags.some((tag) => currentContextTags.includes(tag))
      && Boolean(command.keys)
      && Boolean(command.shortcutHint?.trim())
    )),
    [commandsWithCreateAction, currentContextTags],
  );

  const shortcutSpecs = useMemo<ShortcutSpec[]>(() => {
    const commandShortcuts: ShortcutSpec[] = activeCommands
      .filter((command): command is CommandSpec & { keys: NonNullable<CommandSpec['keys']> } => Boolean(command.keys))
      .map((command) => ({
        id: command.id,
        title: command.label,
        keys: command.keys,
        contexts: command.contextTags,
        allowRepeat: command.allowRepeat,
        when: () => (command.isVisible?.() ?? true) && (command.isEnabled?.() ?? true),
        action: () => { void command.action(); },
      }));

    return commandShortcuts;
  }, [activeCommands]);

  useKeyboardShortcuts(shortcutSpecs, !paletteOpen, { currentContexts: currentContextTags });

  const groupedHelpCommands = useMemo(() => {
    const grouped = new Map<CommandContextTag, CommandSpec[]>();

    helpCommands.forEach((command) => {
      const tags = command.contextTags.length > 0 ? command.contextTags : (['global'] as const);
      tags.forEach((tag) => {
        const existing = grouped.get(tag) ?? [];
        grouped.set(tag, [...existing, command]);
      });
    });

    return (Object.keys(CONTEXT_TITLE_KEYS) as CommandContextTag[])
      .map((tag) => ({ tag, title: t(CONTEXT_TITLE_KEYS[tag]), commands: grouped.get(tag) ?? [] }))
      .filter((group) => group.commands.length > 0);
  }, [helpCommands, t]);

  const currentRegionShortcuts = useMemo(
    () => getRegionShortcutsHelp(activeRegionId),
    [activeRegionId, getRegionShortcutsHelp],
  );

  const contextValue = useMemo(
    () => ({
      registerCommands,
      registerCreateActions,
      setContextTag,
      openPalette,
      closePalette,
      openShortcutsHelp,
      closeShortcutsHelp,
      currentContextTags,
      activeCreateActions,
      runPrimaryCreateAction,
    }),
    [
      activeCreateActions,
      closePalette,
      closeShortcutsHelp,
      currentContextTags,
      openPalette,
      openShortcutsHelp,
      registerCommands,
      registerCreateActions,
      runPrimaryCreateAction,
      setContextTag,
    ],
  );

  return (
    <CommandContext.Provider value={contextValue}>
      {children}
      <CommandPalette open={paletteOpen} commands={activeCommands} onClose={closePalette} />
      <Dialog open={createChooserOpen} onClose={() => setCreateChooserOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>{t('commandPalette.createNew')}</DialogTitle>
        <DialogContent>
          <List dense>
            {activeCreateActions.map((action) => (
              <ListItemButton
                key={action.id}
                onClick={() => {
                  setCreateChooserOpen(false);
                  action.handler();
                }}
              >
                <ListItemText primary={action.label} secondary={action.shortcut ?? CREATE_SHORTCUT_HINT} />
              </ListItemButton>
            ))}
          </List>
        </DialogContent>
      </Dialog>
      <Dialog open={helpOpen} onClose={closeShortcutsHelp} fullWidth maxWidth="md">
        <DialogTitle>{t('commandPalette.contextualShortcutsTitle')}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            {t('commandPalette.contextualShortcutsDescription')}
          </Typography>
          <ShortcutHelpSection title={t('commandPalette.universalShortcutsTitle')}>
            <ShortcutHelpRow label={t('commandPalette.universalShortcuts.nextRegion')} shortcutHint="F6" />
            <Divider component="li" />
            <ShortcutHelpRow label={t('commandPalette.universalShortcuts.previousRegion')} shortcutHint="Shift+F6" />
            <Divider component="li" />
            <ShortcutHelpRow label={t('commandPalette.universalShortcuts.withinRegion')} shortcutHint="Tab / Shift+Tab" />
            <Divider component="li" />
            <ShortcutHelpRow label={t('commandPalette.universalShortcuts.closeDialog')} shortcutHint="Esc" />
          </ShortcutHelpSection>
          {currentRegionShortcuts.length > 0 && (
            <ShortcutHelpSection title={t('commandPalette.currentRegionShortcutsTitle')}>
              {currentRegionShortcuts.map((shortcut, index) => (
                <Fragment key={`region-${shortcut.key}`}>
                  {index > 0 ? <Divider component="li" /> : null}
                  <ShortcutHelpRow label={shortcut.label} shortcutHint={shortcut.key} />
                </Fragment>
              ))}
            </ShortcutHelpSection>
          )}
          {groupedHelpCommands.map((group) => (
            <ShortcutHelpSection key={group.tag} title={group.title}>
              {group.commands.map((command, index) => (
                <Fragment key={`${group.tag}-${command.id}`}>
                  {index > 0 ? <Divider component="li" /> : null}
                  <ShortcutHelpRow label={command.label} shortcutHint={command.shortcutHint ?? ''} />
                </Fragment>
              ))}
            </ShortcutHelpSection>
          ))}
        </DialogContent>
      </Dialog>
      <AlertSnackbar
        open={hintOpen}
        autoHideDuration={6000}
        onClose={() => setHintOpen(false)}
        message={<>💡 {t('commandPalette.shortcutHint')}</>}
        severity="info"
        closeText={t('common:actions.close')}
      />
    </CommandContext.Provider>
  );
}
