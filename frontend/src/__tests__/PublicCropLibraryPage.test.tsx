import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PublicCropLibraryPage from '../crops/pages/PublicCropLibraryPage';
import type { PublicCulture, PublicCultureDiscussionComment, PublicCultureDiscussionTopic } from '../api/types';
import { CommandProvider } from '../commands/CommandProvider';
import { FocusManagerProvider } from '../focus/FocusManager';

const publicCultureApiMocks = vi.hoisted(() => ({
  list: vi.fn(),
  get: vi.fn(),
  discussionTopics: vi.fn(),
  discussionComments: vi.fn(),
  createDiscussionTopic: vi.fn(),
  createDiscussionComment: vi.fn(),
  updateDiscussionComment: vi.fn(),
  deleteDiscussionComment: vi.fn(),
  versions: vi.fn(),
  importToProject: vi.fn(),
  update: vi.fn(),
}));

vi.mock('../auth/useAuth', () => ({
  useAuth: () => ({
    user: {
      id: 1,
      email: 'test@example.com',
      display_name: 'Test User',
      display_label: 'Test User',
      public_display_name: 'Test User',
      is_active: true,
      default_project_id: 1,
      last_project_id: 1,
      resolved_project_id: 1,
      needs_project_selection: false,
      memberships: [],
      account_pending_deletion: false,
      scheduled_deletion_at: null,
      pending_consents: [],
      public_library_terms_accepted: true,
      is_guest_demo: false,
      guest_demo_session_id: null,
      has_password: true,
    },
  }),
}));

vi.mock('../api/api', async () => {
  const actual = await vi.importActual<typeof import('../api/api')>('../api/api');
  return {
    ...actual,
    publicCultureAPI: {
      ...actual.publicCultureAPI,
      list: publicCultureApiMocks.list,
      get: publicCultureApiMocks.get,
      discussionTopics: publicCultureApiMocks.discussionTopics,
      discussionComments: publicCultureApiMocks.discussionComments,
      createDiscussionTopic: publicCultureApiMocks.createDiscussionTopic,
      createDiscussionComment: publicCultureApiMocks.createDiscussionComment,
      updateDiscussionComment: publicCultureApiMocks.updateDiscussionComment,
      deleteDiscussionComment: publicCultureApiMocks.deleteDiscussionComment,
      versions: publicCultureApiMocks.versions,
      importToProject: publicCultureApiMocks.importToProject,
      update: publicCultureApiMocks.update,
    },
  };
});

const publicCultures: PublicCulture[] = [
  {
    id: 1,
    status: 'published',
    name: 'Tomate',
    variety: 'Roma',
    crop_species_name: 'Tomate',
    growth_duration_days: 70,
    harvest_duration_days: 28,
    display_color: '#7cb342',
    version: 1,
    original_language_code: 'de',
    published_at: '2026-07-23T10:00:00Z',
    created_at: '2026-07-20T08:00:00Z',
    updated_at: '2026-07-27T12:00:00Z',
  },
  {
    id: 2,
    status: 'published',
    name: 'Salat',
    variety: 'Maikönig',
    crop_species_name: 'Salat',
    growth_duration_days: 45,
    harvest_duration_days: 10,
    version: 1,
    original_language_code: 'de',
    published_at: '2026-07-24T10:00:00Z',
    created_at: '2026-07-21T08:00:00Z',
    updated_at: '2026-07-25T12:00:00Z',
  },
];

function renderPage(): ReturnType<typeof render> {
  return render(
    <FocusManagerProvider>
      <CommandProvider>
        <MemoryRouter initialEntries={['/app/crop-library']}>
          <Routes>
            <Route path="/app/crop-library" element={<PublicCropLibraryPage />} />
          </Routes>
        </MemoryRouter>
      </CommandProvider>
    </FocusManagerProvider>,
  );
}

function createDeferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
} {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
}

describe('PublicCropLibraryPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    publicCultureApiMocks.list.mockResolvedValue({ data: { results: publicCultures } });
    publicCultureApiMocks.discussionTopics.mockResolvedValue({ data: [] });
    publicCultureApiMocks.discussionComments.mockResolvedValue({ data: [] });
    publicCultureApiMocks.versions.mockResolvedValue({ data: [] });
    publicCultureApiMocks.update.mockResolvedValue({
      data: {
        ...publicCultures[0],
        growth_duration_days: 48,
        display_color: '#123456',
        version: 2,
      },
    });
  });

  it('does not show the empty state while public cultures are still loading', () => {
    const deferredList = createDeferred<{ data: { results: PublicCulture[] } }>();
    publicCultureApiMocks.list.mockReturnValue(deferredList.promise);

    renderPage();

    expect(screen.getAllByText('Kulturen werden geladen…').length).toBeGreaterThan(0);
    expect(screen.queryByText('Keine öffentlichen Kulturen gefunden.')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Die Kulturbibliothek wächst mit der Community' })).not.toBeInTheDocument();
  });

  it('shows loaded public cultures without flashing an empty state first', async () => {
    window.localStorage.setItem('selectedPublicCultureId', '1');
    renderPage();

    expect(screen.queryByText('Keine öffentlichen Kulturen gefunden.')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Die Kulturbibliothek wächst mit der Community' })).not.toBeInTheDocument();
    expect(await screen.findByRole('heading', { level: 2, name: 'Tomate' })).toBeInTheDocument();
    expect(screen.queryByText('Keine öffentlichen Kulturen gefunden.')).not.toBeInTheDocument();
  });

  it('shows a compact, single-surface empty state before any culture is selected', async () => {
    publicCultureApiMocks.list.mockResolvedValue({ data: { results: [] } });
    renderPage();

    await screen.findByText('Keine öffentlichen Kulturen gefunden.');

    // Regression guard for a layout bug where the empty state's intro used
    // a separate grey header block (bgcolor + border-bottom) on top of the
    // three feature blocks, with a large forced min-height creating a big
    // empty gap below them. The intro and the three blocks should now sit
    // in one unified surface with a short subtitle.
    expect(screen.getByRole('heading', { name: 'Die Kulturbibliothek wächst mit der Community' })).toBeInTheDocument();
    expect(screen.getByText('Teile deine bewährten Kulturen mit anderen.')).toBeInTheDocument();
    expect(screen.queryByText(/Jede veröffentlichte Kultur erweitert die gemeinsame Kulturbibliothek/)).not.toBeInTheDocument();

    expect(screen.getByText('Entdecken')).toBeInTheDocument();
    expect(screen.getByText('Übernehmen')).toBeInTheDocument();
    expect(screen.getByText('Verbessern')).toBeInTheDocument();
    expect(screen.getByText(/Spätere Änderungen der öffentlichen Kultur wirken sich nicht auf bereits importierte Projektkulturen aus/)).toBeInTheDocument();
  });

  it('shows the public library load error without rendering an empty state', async () => {
    publicCultureApiMocks.list.mockRejectedValue(new Error('Network error'));
    renderPage();

    expect(await screen.findAllByText('Die Kulturbibliothek konnte nicht geladen werden.')).toHaveLength(3);
    expect(screen.queryByText('Keine öffentlichen Kulturen gefunden.')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Die Kulturbibliothek wächst mit der Community' })).not.toBeInTheDocument();
  });


  it('shows discussion topics empty state and opens the new topic form', async () => {
    renderPage();
    await userEvent.click(await screen.findByRole('option', { name: /Tomate \(Roma\)/ }));
    await userEvent.click(screen.getByRole('tab', { name: 'Diskussionen' }));
    expect(await screen.findByText('Noch keine Diskussionen')).toBeInTheDocument();
    expect(screen.getByText(/Frage zu den Daten/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Neue Diskussion' }));
    expect(screen.getByRole('textbox', { name: 'Titel' })).toHaveFocus();
    expect(screen.getByRole('textbox', { name: 'Kommentar' })).toBeInTheDocument();
  });

  it('shows discussion topics as an interactive activity-sorted overview', async () => {
    const user = userEvent.setup();
    const topics: PublicCultureDiscussionTopic[] = [
      {
        id: 11,
        public_culture: 1,
        title: 'TKG ok?',
        created_by_label: 'Martin Public',
        created_at: '2026-07-27T10:00:00Z',
        revision: 99,
        version: 4,
        comment_count: 1,
        last_activity_at: '2026-07-28T10:00:00Z',
        last_comment_preview: '**Was** ist die Quelle für das TKG?',
      },
      {
        id: 10,
        public_culture: 1,
        title: 'Allgemeine Diskussion',
        created_by_label: 'Martin Public',
        created_at: '2026-07-27T09:00:00Z',
        comment_count: 3,
        last_activity_at: '2026-07-27T12:00:00Z',
        last_comment_preview: 'Da stimmt was nicht',
      },
    ];
    publicCultureApiMocks.discussionTopics.mockResolvedValue({ data: topics });
    publicCultureApiMocks.discussionComments.mockResolvedValue({ data: [] });

    const { container } = renderPage();
    await user.click(await screen.findByRole('option', { name: /Tomate \(Roma\)/ }));
    await user.click(screen.getByRole('tab', { name: 'Diskussionen' }));

    const overviewText = container.textContent ?? '';
    expect(overviewText.indexOf('TKG ok?')).toBeLessThan(overviewText.indexOf('Allgemeine Diskussion'));
    expect(screen.getByText('Martin Public · 1 Beitrag · zuletzt aktiv 28.07.2026')).toBeInTheDocument();
    expect(screen.getByText('Martin Public · 3 Beiträge · zuletzt aktiv 27.07.2026')).toBeInTheDocument();
    expect(screen.getByText('Was ist die Quelle für das TKG?')).toBeInTheDocument();
    expect(screen.getByText('Da stimmt was nicht')).toBeInTheDocument();
    expect(screen.getByText('Version 4')).toBeInTheDocument();

    const topicRow = screen.getByRole('button', { name: /TKG ok?/ });
    topicRow.focus();
    await user.keyboard('{Enter}');

    await waitFor(() => expect(publicCultureApiMocks.discussionComments).toHaveBeenCalledWith(1, 11));
  });

  it('creates a new discussion inline and opens it after saving', async () => {
    const user = userEvent.setup();
    const createdTopic: PublicCultureDiscussionTopic = {
      id: 20,
      public_culture: 1,
      title: 'Neue Frage',
      created_by_label: 'Martin Public',
      created_at: '2026-07-28T10:00:00Z',
      comment_count: 1,
      last_activity_at: '2026-07-28T10:00:00Z',
      last_comment_preview: 'Was ist hier gemeint?',
    };
    const createdComment: PublicCultureDiscussionComment = {
      id: 21,
      topic: 20,
      parent: null,
      body: 'Was ist hier gemeint?',
      created_by_label: 'Martin Public',
      created_at: '2026-07-28T10:00:00Z',
      updated_at: '2026-07-28T10:00:00Z',
      deleted_at: null,
      is_edited: false,
      can_edit: true,
    };
    publicCultureApiMocks.createDiscussionTopic.mockResolvedValue({ data: createdTopic });
    publicCultureApiMocks.discussionTopics
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: [createdTopic] });
    publicCultureApiMocks.discussionComments.mockResolvedValue({ data: [createdComment] });

    renderPage();
    await user.click(await screen.findByRole('option', { name: /Tomate \(Roma\)/ }));
    await user.click(screen.getByRole('tab', { name: 'Diskussionen' }));
    await user.click(await screen.findByRole('button', { name: 'Neue Diskussion' }));

    expect(screen.queryByRole('button', { name: 'Neue Diskussion' })).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Titel' })).toHaveFocus();
    await user.type(screen.getByRole('textbox', { name: 'Titel' }), 'Neue Frage');
    await user.type(screen.getByRole('textbox', { name: 'Kommentar' }), 'Was ist hier gemeint?');
    await user.click(screen.getByRole('button', { name: 'Diskussion starten' }));

    await waitFor(() => expect(publicCultureApiMocks.createDiscussionTopic).toHaveBeenCalledWith(1, {
      title: 'Neue Frage',
      body: 'Was ist hier gemeint?',
      revision: undefined,
    }));
    expect(await screen.findByRole('heading', { name: 'Neue Frage' })).toBeInTheDocument();
    expect(screen.getByText('Was ist hier gemeint?')).toBeInTheDocument();
  });

  it('returns focus to the new discussion button after cancelling the inline editor', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('option', { name: /Tomate \(Roma\)/ }));
    await user.click(screen.getByRole('tab', { name: 'Diskussionen' }));
    const newTopicButton = await screen.findByRole('button', { name: 'Neue Diskussion' });

    await user.click(newTopicButton);
    await user.click(screen.getByRole('button', { name: 'Abbrechen' }));

    expect(screen.getByRole('button', { name: 'Neue Diskussion' })).toHaveFocus();
  });

  it('keeps the selected version reference when starting a discussion from the version history', async () => {
    const user = userEvent.setup();
    publicCultureApiMocks.versions.mockResolvedValue({
      data: [{
        id: 99,
        public_culture: 1,
        version: 4,
        action: 'updated',
        snapshot: {},
        changed_fields: [],
        created_by_label: 'Martin Public',
        created_at: '2026-07-28T10:00:00Z',
      }],
    });
    publicCultureApiMocks.createDiscussionTopic.mockResolvedValue({
      data: {
        id: 30,
        public_culture: 1,
        title: 'TKG ok?',
        created_by_label: 'Martin Public',
        created_at: '2026-07-28T10:00:00Z',
        revision: 99,
        version: 4,
        comment_count: 1,
        last_activity_at: '2026-07-28T10:00:00Z',
        last_comment_preview: 'Quelle?',
      },
    });
    publicCultureApiMocks.discussionTopics.mockResolvedValue({ data: [] });
    publicCultureApiMocks.discussionComments.mockResolvedValue({ data: [] });

    renderPage();
    await user.click(await screen.findByRole('option', { name: /Tomate \(Roma\)/ }));
    await user.click(screen.getByRole('tab', { name: 'Versionen' }));
    await user.click(await screen.findByRole('button', { name: 'Diskutieren' }));

    expect(screen.getByText('Bezug:')).toBeInTheDocument();
    expect(screen.getByText('Version 4')).toBeInTheDocument();
    await user.type(screen.getByRole('textbox', { name: 'Titel' }), 'TKG ok?');
    await user.type(screen.getByRole('textbox', { name: 'Kommentar' }), 'Quelle?');
    await user.click(screen.getByRole('button', { name: 'Diskussion starten' }));

    await waitFor(() => expect(publicCultureApiMocks.createDiscussionTopic).toHaveBeenCalledWith(1, {
      title: 'TKG ok?',
      body: 'Quelle?',
      revision: 99,
    }));
  });

  it('renders a real parent-child reply tree and keeps reply focus local', async () => {
    const user = userEvent.setup();
    const topics: PublicCultureDiscussionTopic[] = [{
      id: 10,
      public_culture: 1,
      title: 'Allgemeine Diskussion',
      created_by_label: 'Martin Public',
      created_at: '2026-07-27T10:00:00Z',
      comment_count: 4,
      last_activity_at: '2026-07-28T10:00:00Z',
    }];
    const initialComments: PublicCultureDiscussionComment[] = [
      {
        id: 1,
        topic: 10,
        parent: null,
        body: 'test2',
        created_by_label: 'Martin Public',
        created_at: '2026-07-27T10:00:00Z',
        updated_at: '2026-07-27T10:00:00Z',
        deleted_at: null,
        is_edited: false,
        can_edit: true,
      },
      {
        id: 2,
        topic: 10,
        parent: 1,
        body: 'nein',
        created_by_label: 'Martin Public',
        created_at: '2026-07-28T09:00:00Z',
        updated_at: '2026-07-28T09:00:00Z',
        deleted_at: null,
        is_edited: false,
        can_edit: true,
      },
      {
        id: 3,
        topic: 10,
        parent: 2,
        body: 'ja',
        created_by_label: 'Martin Public',
        created_at: '2026-07-28T09:10:00Z',
        updated_at: '2026-07-28T09:10:00Z',
        deleted_at: null,
        is_edited: false,
        can_edit: true,
      },
      {
        id: 4,
        topic: 10,
        parent: 3,
        body: 'reply zu ja',
        created_by_label: 'Martin Public',
        created_at: '2026-07-28T09:20:00Z',
        updated_at: '2026-07-28T09:20:00Z',
        deleted_at: null,
        is_edited: false,
        can_edit: true,
      },
      {
        id: 5,
        topic: 10,
        parent: 4,
        body: 'sehr tiefe Antwort',
        created_by_label: 'Martin Public',
        created_at: '2026-07-28T09:30:00Z',
        updated_at: '2026-07-28T09:30:00Z',
        deleted_at: null,
        is_edited: false,
        can_edit: true,
      },
      {
        id: 6,
        topic: 10,
        parent: 5,
        body: 'noch tiefere Antwort',
        created_by_label: 'Martin Public',
        created_at: '2026-07-28T09:40:00Z',
        updated_at: '2026-07-28T09:40:00Z',
        deleted_at: null,
        is_edited: false,
        can_edit: true,
      },
      {
        id: 7,
        topic: 10,
        parent: 1,
        body: 'reply zu test2',
        created_by_label: 'Martin Public',
        created_at: '2026-07-28T09:50:00Z',
        updated_at: '2026-07-28T09:50:00Z',
        deleted_at: null,
        is_edited: false,
        can_edit: true,
      },
    ];
    const createdReply: PublicCultureDiscussionComment = {
      id: 8,
      topic: 10,
      parent: 2,
      body: 'Neue Antwort auf nein',
      created_by_label: 'Martin Public',
      created_at: '2026-07-28T10:00:00Z',
      updated_at: '2026-07-28T10:00:00Z',
      deleted_at: null,
      is_edited: false,
      can_edit: true,
    };

    publicCultureApiMocks.discussionTopics.mockResolvedValue({ data: topics });
    publicCultureApiMocks.discussionComments
      .mockResolvedValueOnce({ data: initialComments })
      .mockResolvedValueOnce({ data: [...initialComments, createdReply] });
    publicCultureApiMocks.createDiscussionComment.mockResolvedValue({ data: createdReply });

    const { container } = renderPage();
    await user.click(await screen.findByRole('option', { name: /Tomate \(Roma\)/ }));
    await user.click(screen.getByRole('tab', { name: 'Diskussionen' }));
    await user.click(await screen.findByText('Allgemeine Diskussion'));

    const threadText = container.textContent ?? '';
    expect(threadText.indexOf('test2')).toBeLessThan(threadText.indexOf('nein'));
    expect(threadText.indexOf('nein')).toBeLessThan(threadText.indexOf('ja'));
    expect(threadText.indexOf('ja')).toBeLessThan(threadText.indexOf('reply zu ja'));
    expect(threadText.indexOf('reply zu ja')).toBeLessThan(threadText.indexOf('reply zu test2'));
    expect(screen.queryByRole('menuitem', { name: 'Bearbeiten' })).not.toBeInTheDocument();

    const commentA = container.querySelector('[data-comment-id="1"]');
    const commentB = container.querySelector('[data-comment-id="2"]');
    const commentC = container.querySelector('[data-comment-id="3"]');
    const commentD = container.querySelector('[data-comment-id="7"]');
    const deepComment = container.querySelector('[data-comment-id="6"]');
    expect(commentA).toHaveAttribute('data-logical-depth', '0');
    expect(commentB).toHaveAttribute('data-logical-depth', '1');
    expect(commentC).toHaveAttribute('data-logical-depth', '2');
    expect(commentD).toHaveAttribute('data-logical-depth', '1');
    expect(commentB).toHaveAttribute('data-visual-depth', '1');
    expect(commentD).toHaveAttribute('data-visual-depth', '1');
    expect(deepComment).toHaveAttribute('data-logical-depth', '5');
    expect(deepComment).toHaveAttribute('data-visual-depth', '3');
    expect(screen.getAllByText('Antwort auf Martin Public').length).toBeGreaterThan(0);

    expect(commentB).not.toBeNull();
    await user.click(within(commentB as HTMLElement).getByRole('button', { name: 'Auf Beitrag von Martin Public antworten' }));
    expect(screen.getByRole('textbox', { name: 'Antwort' })).toHaveFocus();
    await user.type(screen.getByRole('textbox', { name: 'Antwort' }), 'Neue Antwort auf nein');
    await user.click(screen.getByRole('button', { name: 'Absenden' }));

    await waitFor(() => expect(publicCultureApiMocks.createDiscussionComment).toHaveBeenCalledWith(1, 10, 'Neue Antwort auf nein', 2));
    await screen.findByText('Neue Antwort auf nein');
    const updatedThreadText = container.textContent ?? '';
    expect(updatedThreadText.indexOf('ja')).toBeLessThan(updatedThreadText.indexOf('Neue Antwort auf nein'));
    expect(updatedThreadText.indexOf('Neue Antwort auf nein')).toBeLessThan(updatedThreadText.indexOf('reply zu test2'));
    expect(document.activeElement).toHaveTextContent('Neue Antwort auf nein');
  });

  it('creates a root-level contribution from the general comment field', async () => {
    const user = userEvent.setup();
    const topics: PublicCultureDiscussionTopic[] = [{
      id: 10,
      public_culture: 1,
      title: 'Allgemeine Diskussion',
      created_by_label: 'Martin Public',
      created_at: '2026-07-27T10:00:00Z',
      comment_count: 0,
      last_activity_at: null,
    }];
    const createdRootComment: PublicCultureDiscussionComment = {
      id: 50,
      topic: 10,
      parent: null,
      body: 'Neuer Root-Beitrag',
      created_by_label: 'Martin Public',
      created_at: '2026-07-28T10:00:00Z',
      updated_at: '2026-07-28T10:00:00Z',
      deleted_at: null,
      is_edited: false,
      can_edit: true,
    };
    publicCultureApiMocks.discussionTopics.mockResolvedValue({ data: topics });
    publicCultureApiMocks.discussionComments
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: [createdRootComment] });
    publicCultureApiMocks.createDiscussionComment.mockResolvedValue({ data: createdRootComment });

    const { container } = renderPage();
    await user.click(await screen.findByRole('option', { name: /Tomate \(Roma\)/ }));
    await user.click(screen.getByRole('tab', { name: 'Diskussionen' }));
    await user.click(await screen.findByText('Allgemeine Diskussion'));
    await user.type(screen.getByRole('textbox', { name: 'Kommentar' }), 'Neuer Root-Beitrag');
    await user.click(screen.getByRole('button', { name: 'Absenden' }));

    await waitFor(() => expect(publicCultureApiMocks.createDiscussionComment).toHaveBeenCalledWith(1, 10, 'Neuer Root-Beitrag', undefined));
    await screen.findByText('Neuer Root-Beitrag');
    expect(container.querySelector('[data-comment-id="50"]')).toHaveAttribute('data-logical-depth', '0');
  });

  it('keeps deleted posts in the reply tree with a neutral placeholder', async () => {
    const user = userEvent.setup();
    const topics: PublicCultureDiscussionTopic[] = [{
      id: 10,
      public_culture: 1,
      title: 'Allgemeine Diskussion',
      created_by_label: 'Martin Public',
      created_at: '2026-07-27T10:00:00Z',
      comment_count: 2,
      last_activity_at: '2026-07-28T10:00:00Z',
    }];
    const comments: PublicCultureDiscussionComment[] = [
      {
        id: 1,
        topic: 10,
        parent: null,
        body: '',
        created_by_label: 'Martin Public',
        created_at: '2026-07-27T10:00:00Z',
        updated_at: '2026-07-28T09:00:00Z',
        deleted_at: '2026-07-28T09:00:00Z',
        is_edited: false,
        can_edit: false,
        can_delete: false,
      },
      {
        id: 2,
        topic: 10,
        parent: 1,
        body: 'Antwort bleibt sichtbar',
        created_by_label: 'Martin Public',
        created_at: '2026-07-28T10:00:00Z',
        updated_at: '2026-07-28T10:00:00Z',
        deleted_at: null,
        is_edited: false,
        can_edit: true,
        can_delete: true,
      },
    ];
    publicCultureApiMocks.discussionTopics.mockResolvedValue({ data: topics });
    publicCultureApiMocks.discussionComments.mockResolvedValue({ data: comments });

    const { container } = renderPage();
    await user.click(await screen.findByRole('option', { name: /Tomate \(Roma\)/ }));
    await user.click(screen.getByRole('tab', { name: 'Diskussionen' }));
    await user.click(await screen.findByText('Allgemeine Diskussion'));

    expect(screen.getByLabelText('Dieser Beitrag wurde gelöscht.')).toBeInTheDocument();
    expect(screen.getByText('Antwort bleibt sichtbar')).toBeInTheDocument();
    expect(container.querySelector('[data-comment-id="2"]')).toHaveAttribute('data-logical-depth', '1');
    expect(screen.queryByText('Ursprünglicher Inhalt')).not.toBeInTheDocument();
  });

  it('does not offer delete for an editable root post', async () => {
    const user = userEvent.setup();
    const topics: PublicCultureDiscussionTopic[] = [{
      id: 10,
      public_culture: 1,
      title: 'Allgemeine Diskussion',
      created_by_label: 'Martin Public',
      created_at: '2026-07-27T10:00:00Z',
      comment_count: 1,
      last_activity_at: '2026-07-27T10:00:00Z',
    }];
    const comments: PublicCultureDiscussionComment[] = [{
      id: 1,
      topic: 10,
      parent: null,
      body: 'Root bleibt editierbar',
      created_by_label: 'Martin Public',
      created_at: '2026-07-27T10:00:00Z',
      updated_at: '2026-07-27T10:00:00Z',
      deleted_at: null,
      is_edited: false,
      can_edit: true,
      can_delete: false,
    }];
    publicCultureApiMocks.discussionTopics.mockResolvedValue({ data: topics });
    publicCultureApiMocks.discussionComments.mockResolvedValue({ data: comments });

    renderPage();
    await user.click(await screen.findByRole('option', { name: /Tomate \(Roma\)/ }));
    await user.click(screen.getByRole('tab', { name: 'Diskussionen' }));
    await user.click(await screen.findByText('Allgemeine Diskussion'));
    await user.click(screen.getByRole('button', { name: 'Weitere Aktionen' }));

    expect(screen.getByRole('menuitem', { name: 'Bearbeiten' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Löschen' })).not.toBeInTheDocument();
  });

  it('shows only provenance metadata in the public culture detail section', async () => {
    renderPage();
    await userEvent.click(await screen.findByRole('option', { name: /Tomate \(Roma\)/ }));

    const metadataHeading = await screen.findByRole('heading', { name: 'Bibliotheksdaten' });
    const metadataSection = metadataHeading.closest('div');
    expect(metadataSection).not.toBeNull();
    const metadata = within(metadataSection as HTMLElement);

    expect(metadata.getByText('Originalsprache')).toBeInTheDocument();
    expect(metadata.getByText('Deutsch')).toBeInTheDocument();
    expect(metadata.getByText('Veröffentlicht am')).toBeInTheDocument();
    expect(metadata.getByText('23.07.2026')).toBeInTheDocument();
    expect(metadata.getByText('Zuletzt geändert')).toBeInTheDocument();
    expect(metadata.getByText('27.07.2026')).toBeInTheDocument();
    expect(metadata.queryByText('Version')).not.toBeInTheDocument();
    expect(metadata.queryByText('Angelegt am')).not.toBeInTheDocument();
    expect(metadata.queryByText('Status')).not.toBeInTheDocument();
  });

  it('uses the shared culture list keyboard navigation on the full public library page', async () => {
    const user = userEvent.setup();
    renderPage();

    const tomatoOption = await screen.findByRole('option', { name: /Tomate/ });
    tomatoOption.focus();

    await user.keyboard('{ArrowDown}');

    expect(screen.getByRole('heading', { level: 2, name: 'Salat' })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByRole('option', { name: /Salat/ })).toHaveFocus();
    });

    await user.keyboard('{ArrowUp}');

    expect(screen.getByRole('heading', { level: 2, name: 'Tomate' })).toBeInTheDocument();
  });

  it('edits public cultures with the shared culture form and public-library save shortcut', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole('option', { name: /Tomate/ }));
    await screen.findByRole('heading', { level: 2, name: 'Tomate' });
    await user.click(screen.getByRole('button', { name: 'Bearbeiten' }));

    const editDialog = await screen.findByRole('dialog', { name: 'Öffentliche Kultur bearbeiten' });
    expect(editDialog).toHaveTextContent('Allgemeine Informationen');
    expect(editDialog).toHaveTextContent('Öffentliche Identität');
    expect(editDialog).toHaveTextContent('Tomate · Roma');
    expect(editDialog).toHaveTextContent('#7CB342');
    expect(editDialog).not.toHaveTextContent('Kulturspezifische Lieferantendaten');
    expect(screen.queryByLabelText('Name')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Sorte')).not.toBeInTheDocument();

    const growthInput = screen.getByLabelText('Wachstumszeit (Tage)');
    const colorInput = within(editDialog).getByLabelText('Anzeigefarbe');
    fireEvent.change(growthInput, { target: { value: '48' } });
    fireEvent.change(colorInput, { target: { value: '#123456' } });
    growthInput.focus();
    fireEvent.keyDown(window, {
      bubbles: true,
      cancelable: true,
      ctrlKey: true,
      key: 's',
    });

    await waitFor(() => expect(publicCultureApiMocks.update).toHaveBeenCalledTimes(1));
    expect(publicCultureApiMocks.update).toHaveBeenCalledWith(1, expect.objectContaining({
      base_version: 1,
      growth_duration_days: 48,
      display_color: '#123456',
      row_spacing_m: null,
    }));
    expect(publicCultureApiMocks.update.mock.calls[0][1]).not.toHaveProperty('name');
    expect(publicCultureApiMocks.update.mock.calls[0][1]).not.toHaveProperty('variety');
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Öffentliche Kultur bearbeiten' })).not.toBeInTheDocument());
  }, 30000);

  it('supports the same keyboard shortcuts as the project culture list (Alt+E, Alt+I, Alt+Shift+arrows)', async () => {
    publicCultureApiMocks.importToProject.mockResolvedValue({ data: {} });
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole('option', { name: /Tomate/ }));
    await screen.findByRole('heading', { level: 2, name: 'Tomate' });
    (document.activeElement as HTMLElement | null)?.blur();

    await user.keyboard('{Alt>}{Shift>}{ArrowRight}{/Shift}{/Alt}');
    expect(await screen.findByRole('heading', { level: 2, name: 'Salat' })).toBeInTheDocument();

    await user.keyboard('{Alt>}{Shift>}{ArrowLeft}{/Shift}{/Alt}');
    expect(await screen.findByRole('heading', { level: 2, name: 'Tomate' })).toBeInTheDocument();

    await user.keyboard('{Alt>}e{/Alt}');
    expect(await screen.findByRole('dialog', { name: 'Öffentliche Kultur bearbeiten' })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Öffentliche Kultur bearbeiten' })).not.toBeInTheDocument());

    await user.keyboard('{Alt>}i{/Alt}');
    await waitFor(() => expect(publicCultureApiMocks.importToProject).toHaveBeenCalledWith(1));
  });
});
