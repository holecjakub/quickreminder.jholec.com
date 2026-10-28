// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { HINT_COPY, HINT_FADE_MS, NotchHint, type NotchHintProps } from '../../src/desktop/NotchHint';
import { installMatchMedia } from '../fakes/matchMedia';

beforeEach(() => {
  vi.useFakeTimers();
  installMatchMedia({});
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function hint(overrides: Partial<NotchHintProps> = {}): NotchHintProps {
  return { visible: true, scheme: 'light', reduceMotion: false, onOpen: () => {}, ...overrides };
}
const root = () => screen.getByRole('button') as HTMLElement;

describe('<NotchHint>', () => {
  it('pins the copy and the fade', () => {
    expect(HINT_COPY).toEqual({
      line1: 'Click the notch to add a reminder',
      line1Touch: 'Tap the notch to add a reminder',
      line2: 'In the app: ⇧⌘R from anywhere.',
    });
    expect(HINT_FADE_MS).toBe(400);
  });

  it('shows both lines of the §11.3 copy', () => {
    render(<NotchHint {...hint()} />);
    expect(screen.getByText(HINT_COPY.line1)).toBeTruthy();
    expect(screen.getByText('In the app: ⇧⌘R from anywhere.')).toBeTruthy();
  });

  it('says "Tap" on a coarse pointer', () => {
    installMatchMedia({ '(pointer: coarse)': true });
    render(<NotchHint {...hint()} />);
    expect(screen.getByText('Tap the notch to add a reminder')).toBeTruthy();
    expect(screen.queryByText(HINT_COPY.line1)).toBeNull();
  });

  it('is a button that opens the panel', () => {
    const onOpen = vi.fn();
    render(<NotchHint {...hint({ onOpen })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Click the notch to add a reminder' }));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('sits centred under the notch at y 58 pt', () => {
    render(<NotchHint {...hint()} />);
    expect(root().style.top).toBe('calc(58 * var(--pt) * 1px)');
    expect(root().style.left).toBe('calc(756 * var(--pt) * 1px)');
    expect(root().style.transform).toContain('translateX(-50%)');
  });

  it('uses the dark palette', () => {
    render(<NotchHint {...hint({ scheme: 'dark' })} />);
    expect(root().style.background).toBe('rgba(0, 0, 0, 0.45)');
  });

  it('fades out over 400 ms when visible turns false, then unmounts', () => {
    const { rerender } = render(<NotchHint {...hint()} />);
    expect(root().style.opacity).toBe('1');
    rerender(<NotchHint {...hint({ visible: false })} />);
    expect(root().style.opacity).toBe('0');
    expect(root().style.transition).toBe('opacity 400ms ease-out');
    act(() => {
      vi.advanceTimersByTime(399);
    });
    expect(screen.queryByRole('button')).not.toBeNull();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('scales the fade with timeScale', () => {
    const { rerender } = render(<NotchHint {...hint({ timeScale: 4 })} />);
    rerender(<NotchHint {...hint({ visible: false, timeScale: 4 })} />);
    expect(root().style.transition).toBe('opacity 1600ms ease-out');
  });

  it('comes back when visible turns true again before the fade ends', () => {
    const { rerender } = render(<NotchHint {...hint()} />);
    rerender(<NotchHint {...hint({ visible: false })} />);
    rerender(<NotchHint {...hint()} />);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(root().style.opacity).toBe('1');
  });

  it('renders nothing when it starts hidden', () => {
    const { container } = render(<NotchHint {...hint({ visible: false })} />);
    expect(container.firstChild).toBeNull();
  });

  it('reduced motion: no bob animation and a 150 ms fade', () => {
    const { rerender } = render(<NotchHint {...hint({ reduceMotion: true })} />);
    expect(root().style.animation).toBe('none');
    rerender(<NotchHint {...hint({ reduceMotion: true, visible: false })} />);
    expect(root().style.transition).toBe('opacity 150ms ease-out');
  });

  it('bobs when motion is allowed', () => {
    render(<NotchHint {...hint()} />);
    expect(root().style.animation).toContain('qr-hint-bob 1600ms ease-in-out infinite');
  });
});
