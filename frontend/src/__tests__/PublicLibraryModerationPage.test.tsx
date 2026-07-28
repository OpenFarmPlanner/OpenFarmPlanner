import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import PublicLibraryModerationPage from '../crops/pages/PublicLibraryModerationPage';

const authUser = vi.hoisted(() => ({
  is_public_library_moderator: true,
  is_staff: true,
  is_superuser: false,
}));

const apiMocks = vi.hoisted(() => ({
  cropSpeciesList: vi.fn(),
  cropSpeciesApprove: vi.fn(),
  cropSpeciesReject: vi.fn(),
  moderatorRequestList: vi.fn(),
  moderatorRequestApprove: vi.fn(),
  moderatorRequestReject: vi.fn(),
}));

vi.mock('../auth/useAuth', () => ({
  useAuth: () => ({ user: authUser }),
}));

vi.mock('../api/api', () => ({
  cropSpeciesAPI: {
    list: apiMocks.cropSpeciesList,
    approve: apiMocks.cropSpeciesApprove,
    reject: apiMocks.cropSpeciesReject,
  },
  publicLibraryModeratorRequestAPI: {
    list: apiMocks.moderatorRequestList,
    approve: apiMocks.moderatorRequestApprove,
    reject: apiMocks.moderatorRequestReject,
  },
}));

describe('PublicLibraryModerationPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authUser.is_public_library_moderator = true;
    authUser.is_staff = true;
    authUser.is_superuser = false;
    apiMocks.cropSpeciesList.mockResolvedValue({
      data: {
        results: [
          {
            id: 7,
            name: 'Baumspinat',
            status: 'proposed',
            proposed_by_label: 'Mara',
            similar_species: [{ id: 2, name: 'Spinat', match_type: 'similar' }],
          },
        ],
      },
    });
    apiMocks.cropSpeciesApprove.mockResolvedValue({ data: { id: 7, name: 'Baumspinat', status: 'published' } });
    apiMocks.cropSpeciesReject.mockResolvedValue({ data: { id: 7, name: 'Baumspinat', status: 'rejected' } });
    apiMocks.moderatorRequestList.mockResolvedValue({
      data: {
        results: [
          {
            id: 3,
            user: 5,
            user_label: 'Jonas',
            motivation: 'Ich möchte helfen.',
            status: 'pending',
            created_at: '2026-07-27T08:00:00Z',
          },
        ],
      },
    });
    apiMocks.moderatorRequestApprove.mockResolvedValue({ data: { id: 3, status: 'approved' } });
    apiMocks.moderatorRequestReject.mockResolvedValue({ data: { id: 3, status: 'rejected' } });
  });

  it('reviews crop species proposals and admin moderator requests', async () => {
    const user = userEvent.setup();
    render(<PublicLibraryModerationPage />);

    expect(await screen.findByText('Kulturart-Vorschläge')).toBeInTheDocument();
    expect(screen.getByText('Baumspinat')).toBeInTheDocument();
    expect(screen.getByText('Spinat')).toBeInTheDocument();
    expect(screen.getByText('Moderator-Anfragen')).toBeInTheDocument();
    expect(screen.getByText('Jonas')).toBeInTheDocument();

    await user.click(screen.getAllByRole('button', { name: 'Annehmen' })[0]);

    await waitFor(() => expect(apiMocks.cropSpeciesApprove).toHaveBeenCalledWith(7));
  });

  it('hides moderator request management from non-admin moderators', async () => {
    authUser.is_staff = false;
    render(<PublicLibraryModerationPage />);

    expect(await screen.findByText('Kulturart-Vorschläge')).toBeInTheDocument();
    expect(screen.queryByText('Moderator-Anfragen')).not.toBeInTheDocument();
    expect(apiMocks.moderatorRequestList).not.toHaveBeenCalled();
  });
});
