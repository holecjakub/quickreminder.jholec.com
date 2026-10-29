// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react';
import { createRef } from 'react';
import { CURSOR_HOME, cursorDuration, type FakeCursorHandle } from '../../src/desktop/fakeCursor';
import { FakeCursor } from '../../src/desktop/FakeCursor.tsx';

const TRANSITION_300 = 'transform 300ms cubic-bezier(0.42, 0, 0.58, 1), opacity 250ms ease-out';

function cursorEl(): HTMLElement {
  return document.querySelector('[data-fake-cursor]') as HTMLElement;
}
function arrowEl(): SVGElement {
  return cursorEl().querySelector('svg') as unknown as SVGElement;
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('cursorDuration', () => {
  it('clamps short moves to 220 ms', () => expect(cursorDuration({ x: 0, y: 0 }, { x: 160, y: 0 })).toBe(220));
  it('is distance / 1.6 in range', () => expect(cursorDuration({ x: 0, y: 0 }, { x: 480, y: 640 })).toBe(500));
  it('clamps long moves to 700 ms', () => expect(cursorDuration({ x: 0, y: 0 }, { x: 2000, y: 0 })).toBe(700));
});

it('rests at CURSOR_HOME', () => expect(CURSOR_HOME).toEqual({ x: 1180, y: 640 }));

describe('<FakeCursor>', () => {
  it('is aria-hidden and ignores the pointer', () => {
    render(<FakeCursor />);
    expect(arrowEl().getAttribute('aria-hidden')).toBe('true');
    expect(cursorEl().style.pointerEvents).toBe('none');
    expect(arrowEl().style.pointerEvents).toBe('none');
  });

  it('starts at the home position with the idle opacity', () => {
    const ref = createRef<FakeCursorHandle>();
    render(<FakeCursor ref={ref} idleOpacity={0.4} />);
    expect(ref.current!.position()).toEqual(CURSOR_HOME);
    expect(cursorEl().style.transform).toBe('translate(calc(1178 * var(--pt) * 1px), calc(638.5 * var(--pt) * 1px))');
    expect(cursorEl().style.opacity).toBe('0.4');
  });

  it('moveTo writes the hotspot-adjusted transform and resolves after the default duration', async () => {
    const ref = createRef<FakeCursorHandle>();
    render(<FakeCursor ref={ref} />);
    let done = false;
    void ref.current!.moveTo({ x: 700, y: 640 }).then(() => {
      done = true;
    }); // 480 pt -> 300 ms
    expect(cursorEl().style.transform).toBe('translate(calc(698 * var(--pt) * 1px), calc(638.5 * var(--pt) * 1px))');
    expect(cursorEl().style.transition).toBe(TRANSITION_300);
    expect(cursorEl().style.opacity).toBe('1');
    await vi.advanceTimersByTimeAsync(299);
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(done).toBe(true);
    expect(ref.current!.position()).toEqual({ x: 700, y: 640 });
  });

  it('durations scale with timeScale', async () => {
    const ref = createRef<FakeCursorHandle>();
    render(<FakeCursor ref={ref} timeScale={4} />);
    let done = false;
    void ref.current!.moveTo({ x: 700, y: 640 }).then(() => {
      done = true;
    });
    expect(cursorEl().style.transition).toBe('transform 1200ms cubic-bezier(0.42, 0, 0.58, 1), opacity 250ms ease-out');
    await vi.advanceTimersByTimeAsync(1199);
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(done).toBe(true);
  });

  it('an explicit durationMs wins over the distance rule', async () => {
    const ref = createRef<FakeCursorHandle>();
    render(<FakeCursor ref={ref} />);
    void ref.current!.moveTo({ x: 700, y: 640 }, { durationMs: 100 });
    expect(cursorEl().style.transition).toBe('transform 100ms cubic-bezier(0.42, 0, 0.58, 1), opacity 250ms ease-out');
  });

  it('reduced motion moves instantly', async () => {
    const ref = createRef<FakeCursorHandle>();
    render(<FakeCursor ref={ref} reduceMotion />);
    let done = false;
    void ref.current!.moveTo({ x: 700, y: 640 }).then(() => {
      done = true;
    });
    expect(cursorEl().style.transition).toBe('opacity 250ms ease-out');
    expect(cursorEl().style.transform).toBe('translate(calc(698 * var(--pt) * 1px), calc(638.5 * var(--pt) * 1px))');
    await vi.advanceTimersByTimeAsync(0);
    expect(done).toBe(true);
  });

  it('auto-hides 1.2 s after the last move to idleOpacity, unless pinned', async () => {
    const ref = createRef<FakeCursorHandle>();
    render(<FakeCursor ref={ref} idleOpacity={0.4} />);
    void ref.current!.moveTo({ x: 700, y: 640 });
    await vi.advanceTimersByTimeAsync(300);
    expect(cursorEl().style.opacity).toBe('1');
    await vi.advanceTimersByTimeAsync(1199);
    expect(cursorEl().style.opacity).toBe('1');
    await vi.advanceTimersByTimeAsync(1);
    expect(cursorEl().style.opacity).toBe('0.4');

    ref.current!.pin(true);
    void ref.current!.moveTo({ x: 600, y: 600 });
    await vi.advanceTimersByTimeAsync(5000);
    expect(cursorEl().style.opacity).toBe('1');
    act(() => ref.current!.pin(false));
    await vi.advanceTimersByTimeAsync(1200);
    expect(cursorEl().style.opacity).toBe('0.4');
  });

  it('hide() fades out at once and show() brings it back', () => {
    const ref = createRef<FakeCursorHandle>();
    render(<FakeCursor ref={ref} idleOpacity={0.4} />);
    ref.current!.show();
    expect(cursorEl().style.opacity).toBe('1');
    ref.current!.hide();
    expect(cursorEl().style.opacity).toBe('0');
  });

  it('click presses to 0.94 for 80 ms', async () => {
    const ref = createRef<FakeCursorHandle>();
    render(<FakeCursor ref={ref} />);
    let done = false;
    void ref.current!.click().then(() => {
      done = true;
    });
    expect(arrowEl().style.transform).toBe('scale(0.94)');
    await vi.advanceTimersByTimeAsync(79);
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(done).toBe(true);
    expect(arrowEl().style.transform).toBe('scale(1)');
  });

  it('cancel rejects a running move with AbortError', async () => {
    const ref = createRef<FakeCursorHandle>();
    render(<FakeCursor ref={ref} />);
    const p = ref.current!.moveTo({ x: 0, y: 0 });
    ref.current!.cancel();
    await expect(p).rejects.toMatchObject({ name: 'AbortError' });
  });
});
