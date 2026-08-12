import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NotesDrawer } from '../components/data-grid/NotesDrawer';

vi.mock('../api/api', () => ({
  noteAttachmentAPI: {
    list: vi.fn().mockResolvedValue({ data: [] }),
    upload: vi.fn().mockResolvedValue({ data: { id: 1 } }),
    delete: vi.fn().mockResolvedValue({}),
  },
}));

vi.mock('../components/data-grid/RichTextEditor', () => ({
  RichTextEditor: ({
    value,
    onChange,
    autoFocus = true,
  }: {
    value: string;
    onChange: (value: string) => void;
    autoFocus?: boolean;
  }) => (
    <textarea
      aria-label="notes"
      autoFocus={autoFocus}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  ),
}));

describe('NotesDrawer attachments', () => {
  beforeEach(() => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows camera + gallery buttons', async () => {
    render(<NotesDrawer open title="Notes" value="" onChange={() => {}} onSave={() => {}} onClose={() => {}} noteId={1} />);
    expect(await screen.findByText('Foto aufnehmen')).toBeInTheDocument();
    expect(screen.getByText('Aus Galerie wählen')).toBeInTheDocument();
  });

  it('uses capture environment for camera input', () => {
    render(<NotesDrawer open title="Notes" value="" onChange={() => {}} onSave={() => {}} onClose={() => {}} noteId={1} />);
    const fileInputs = Array.from(document.querySelectorAll('input[type="file"]')) as HTMLInputElement[];
    expect(fileInputs).toHaveLength(2);
    expect(fileInputs.every((input) => input.accept === 'image/*')).toBe(true);

    const cameraInput = document.querySelector('input[capture]') as HTMLInputElement | null;
    expect(cameraInput).not.toBeNull();
    expect(cameraInput?.getAttribute('capture')).toBe('environment');
    expect(cameraInput?.accept).toBe('image/*');
  });

  it('opens the webcam directly on desktop instead of the file picker', async () => {
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: false }));
    const stopTrack = vi.fn();
    const getUserMedia = vi.fn().mockResolvedValue({ getTracks: () => [{ stop: stopTrack }] });
    Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia }, configurable: true });
    const cameraInput = document.createElement('input');
    const clickSpy = vi.spyOn(HTMLInputElement.prototype, 'click');

    render(<NotesDrawer open title="Notes" value="" onChange={() => {}} onSave={() => {}} onClose={() => {}} noteId={1} />);
    fireEvent.click(screen.getByText('Foto aufnehmen'));

    const captureButton = await screen.findByRole('button', { name: 'Aufnehmen' });
    expect(captureButton).toBeInTheDocument();
    expect(getUserMedia).toHaveBeenCalledWith({ video: { facingMode: 'environment' } });
    expect(clickSpy).not.toHaveBeenCalled();

    const dialog = captureButton.closest('[role="dialog"]') as HTMLElement;
    fireEvent.click(within(dialog).getByText('Abbrechen'));
    expect(stopTrack).toHaveBeenCalled();
    cameraInput.remove();
  });

  it('offers a file-picker fallback if the camera never produces a frame', async () => {
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: false }));
    const stopTrack = vi.fn();
    const getUserMedia = vi.fn().mockResolvedValue({ getTracks: () => [{ stop: stopTrack }] });
    Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia }, configurable: true });
    const clickSpy = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => {});

    render(<NotesDrawer open title="Notes" value="" onChange={() => {}} onSave={() => {}} onClose={() => {}} noteId={1} />);
    fireEvent.click(screen.getByText('Foto aufnehmen'));

    // jsdom's <video> never produces a real frame on its own, so the "still
    // no signal after a few seconds" fallback fires for real here — this
    // waits out the actual timeout rather than faking it.
    expect(await screen.findByText(/kein Kamerabild/, {}, { timeout: 6000 })).toBeInTheDocument();
    const fallbackButton = screen.getByRole('button', { name: 'Stattdessen Datei wählen' });
    fireEvent.click(fallbackButton);
    expect(stopTrack).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalledTimes(1);
  }, 10000);

  it('falls back to the file picker on a touch device without opening the webcam', () => {
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: true }));
    const getUserMedia = vi.fn();
    Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia }, configurable: true });
    const clickSpy = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => {});

    render(<NotesDrawer open title="Notes" value="" onChange={() => {}} onSave={() => {}} onClose={() => {}} noteId={1} />);
    fireEvent.click(screen.getByText('Foto aufnehmen'));

    expect(getUserMedia).not.toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: 'Aufnehmen' })).not.toBeInTheDocument();
  });

  it('falls back to the file picker when the webcam cannot be opened', async () => {
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: false }));
    const getUserMedia = vi.fn().mockRejectedValue(new Error('Permission denied'));
    Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia }, configurable: true });
    const clickSpy = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => {});

    render(<NotesDrawer open title="Notes" value="" onChange={() => {}} onSave={() => {}} onClose={() => {}} noteId={1} />);
    fireEvent.click(screen.getByText('Foto aufnehmen'));

    await waitFor(() => expect(clickSpy).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('button', { name: 'Aufnehmen' })).not.toBeInTheDocument();
  });

  it('opens interactive crop dialog after file select', () => {
    render(<NotesDrawer open title="Notes" value="" onChange={() => {}} onSave={() => {}} onClose={() => {}} noteId={1} />);
    const galleryInput = document.querySelectorAll('input[type="file"]')[0] as HTMLInputElement;
    const file = new File(['x'], 'crop.jpg', { type: 'image/jpeg' });
    fireEvent.change(galleryInput, { target: { files: [file] } });

    const image = screen.getByAltText('Zuschneidequelle');
    Object.defineProperty(image, 'naturalWidth', { value: 2000, configurable: true });
    Object.defineProperty(image, 'naturalHeight', { value: 1200, configurable: true });
    fireEvent.load(image);

    expect(screen.getByTestId('crop-stage')).toBeInTheDocument();
    expect(screen.getByTestId('crop-handle-se')).toBeInTheDocument();
  });

  it('saves with Ctrl+S', () => {
    const onSave = vi.fn();
    render(<NotesDrawer open title="Notes" value="Some note" onChange={() => {}} onSave={onSave} onClose={() => {}} noteId={1} />);

    fireEvent.keyDown(screen.getByRole('textbox'), { key: 's', ctrlKey: true });

    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it('closes the drawer with Escape when notes are unchanged', () => {
    const onClose = vi.fn();
    render(<NotesDrawer open title="Notes" value="Existing note" onChange={() => {}} onSave={() => {}} onClose={onClose} noteId={1} />);

    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Escape' });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('asks before closing with Escape when notes have unsaved changes', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <NotesDrawer
        open
        title="Notes"
        value="Changed note"
        onChange={() => {}}
        onSave={() => {}}
        onClose={onClose}
        hasUnsavedChanges
        noteId={1}
      />,
    );

    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Escape' });

    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('heading', { name: 'Ungespeicherte Notizen' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Weiter bearbeiten' }));
    expect(onClose).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: 'Ungespeicherte Notizen' })).not.toBeInTheDocument();
    });

    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Escape' });
    await user.click(screen.getByRole('button', { name: 'Verwerfen' }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('uses the unsaved confirmation when Cancel is clicked with dirty notes', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <NotesDrawer
        open
        title="Notes"
        value="Changed note"
        onChange={() => {}}
        onSave={() => {}}
        onClose={onClose}
        hasUnsavedChanges
        noteId={1}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Abbrechen' }));

    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('heading', { name: 'Ungespeicherte Notizen' })).toBeInTheDocument();
  });

  it('focuses the text field after the drawer slide transition completes', async () => {
    render(
      <NotesDrawer open title="Notizen" value="" onChange={() => {}} onSave={() => {}} onClose={() => {}} />,
    );

    await waitFor(() => {
      expect(screen.getByRole('textbox')).toHaveFocus();
    });
  });
});
