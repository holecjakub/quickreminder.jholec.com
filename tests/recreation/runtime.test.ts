// @vitest-environment jsdom
import '../ui/setup';
import { NotchRuntime, type NotchRuntimeHost } from '../../src/recreation/runtime';
import type { Mock } from 'vitest';
import { useTestTime } from '../ui/support';
type HostMock = { [K in keyof NotchRuntimeHost]: Mock<NotchRuntimeHost[K]> };
const host = (): HostMock => ({ setFlags: vi.fn(), focusTitle: vi.fn(), blurAll: vi.fn(),
  setIgnoresMouse: vi.fn(), haptic: vi.fn(), willShow: vi.fn(), didHide: vi.fn() });
const make = (h: NotchRuntimeHost, o: Partial<{ reduce: boolean; scale: number; onNotch: boolean }> = {}) => new NotchRuntime(h, {
  reduceMotion: () => o.reduce ?? false, timeScale: () => o.scale ?? 1, hasNotch: () => true, pointerOnNotch: () => o.onNotch ?? false });
beforeEach(() => useTestTime());

test('parks at construction', () => {
  const h = host(); const rt = make(h);
  expect(rt.machine.phase).toEqual({ type: 'closed', parked: true });
  expect(h.setFlags).toHaveBeenCalledWith({ isOpen: false, contentVisible: false, isHovering: false }, 'none');
});
test('show: will-show now, open spring next turn, focus at 0.12 / 0.30 s, settled at 0.5 s', () => {
  const h = host(); const rt = make(h);
  rt.dispatch({ type: 'show' });
  expect(h.willShow).toHaveBeenCalledTimes(1);
  expect(h.setIgnoresMouse).toHaveBeenLastCalledWith(false);
  expect(h.setFlags).not.toHaveBeenCalledWith(expect.anything(), 'open');
  vi.advanceTimersByTime(0);
  expect(h.setFlags).toHaveBeenLastCalledWith({ isSaving: false, isHovering: false, isOpen: true, contentVisible: true }, 'open');
  vi.advanceTimersByTime(119); expect(h.focusTitle).toHaveBeenCalledTimes(0);
  vi.advanceTimersByTime(1);   expect(h.focusTitle).toHaveBeenCalledTimes(1);
  vi.advanceTimersByTime(180); expect(h.focusTitle).toHaveBeenCalledTimes(2);
  vi.advanceTimersByTime(199); expect(h.setFlags).not.toHaveBeenCalledWith({ isSettled: true }, 'none');
  vi.advanceTimersByTime(1);   expect(h.setFlags).toHaveBeenLastCalledWith({ isSettled: true }, 'none');
});
test('?debug=motion stretches every timer 4×', () => {
  const h = host(); const rt = make(h, { scale: 4 });
  rt.dispatch({ type: 'show' });
  vi.advanceTimersByTime(1999); expect(h.setFlags).not.toHaveBeenCalledWith({ isSettled: true }, 'none');
  vi.advanceTimersByTime(1);    expect(h.setFlags).toHaveBeenLastCalledWith({ isSettled: true }, 'none');
});
test('hide: close spring, parked after 0.36 s', () => {
  const h = host(); const rt = make(h);
  rt.dispatch({ type: 'show' }); vi.advanceTimersByTime(600);
  rt.dispatch({ type: 'hide' });
  expect(h.didHide).toHaveBeenCalledTimes(1);
  expect(h.blurAll).toHaveBeenCalled();
  expect(h.setFlags).toHaveBeenCalledWith({ contentVisible: false, isOpen: false, isSaving: false, section: 'none' }, 'close');
  vi.advanceTimersByTime(359); expect(rt.machine.phase).toEqual({ type: 'closing' });
  vi.advanceTimersByTime(1);   expect(rt.machine.phase).toEqual({ type: 'closed', parked: true });
});
test('save: saved pill, 1.0 s hold, then close', () => {
  const h = host(); const rt = make(h);
  rt.dispatch({ type: 'show' }); vi.advanceTimersByTime(600);
  rt.dispatch({ type: 'save', reduceMotion: false });
  expect(h.setFlags).toHaveBeenCalledWith({ contentVisible: false, isOpen: false, isSaving: true, section: 'none', savedBadgeShown: true }, 'saving');
  expect(h.setIgnoresMouse).toHaveBeenLastCalledWith(true);
  vi.advanceTimersByTime(999);  expect(rt.machine.phase).toEqual({ type: 'saving' });
  vi.advanceTimersByTime(1);    expect(rt.machine.phase).toEqual({ type: 'closing' });
  vi.advanceTimersByTime(360);  expect(rt.machine.phase).toEqual({ type: 'closed', parked: true });
  expect(h.setFlags).toHaveBeenCalledWith({ savedBadgeShown: false }, 'none');
});
test('save with reduce motion is a plain close', () => {
  const h = host(); const rt = make(h);
  rt.dispatch({ type: 'show' }); vi.advanceTimersByTime(600);
  rt.dispatch({ type: 'save', reduceMotion: true });
  expect(rt.machine.phase).toEqual({ type: 'closing' });
  expect(h.setFlags).not.toHaveBeenCalledWith(expect.anything(), 'saving');
});
test('hover: 90 ms dwell, then swell; reduce motion → haptic only', () => {
  const h = host(); const rt = make(h);
  rt.dispatch({ type: 'hoverEntered' });
  vi.advanceTimersByTime(89); expect(h.setFlags).not.toHaveBeenCalledWith({ isHovering: true }, 'hoverIn');
  vi.advanceTimersByTime(1);  expect(h.setFlags).toHaveBeenLastCalledWith({ isHovering: true }, 'hoverIn');
  expect(h.haptic).toHaveBeenCalledTimes(1);
  rt.dispatch({ type: 'hoverExited' });
  expect(h.setFlags).toHaveBeenLastCalledWith({ isHovering: false }, 'hoverOut');
  const h2 = host(); const rt2 = make(h2, { reduce: true });
  rt2.dispatch({ type: 'hoverEntered' }); vi.advanceTimersByTime(90);
  expect(h2.setFlags).not.toHaveBeenCalledWith({ isHovering: true }, 'hoverIn');
  expect(h2.haptic).toHaveBeenCalledTimes(1);
});
test('a section grows with the schedule spring and re-settles; Set Date → Location is one step', () => {
  const h = host(); const rt = make(h);
  rt.dispatch({ type: 'show' }); vi.advanceTimersByTime(600);
  rt.dispatch({ type: 'sectionChanged', section: 'controls' });
  expect(h.setFlags).toHaveBeenCalledWith({ isSettled: false }, 'none');
  expect(h.setFlags).toHaveBeenLastCalledWith({ section: 'controls' }, 'schedule');
  vi.advanceTimersByTime(500);
  expect(h.setFlags).toHaveBeenLastCalledWith({ isSettled: true }, 'none');
  rt.dispatch({ type: 'sectionChanged', section: 'location' });
  expect(h.setFlags).toHaveBeenLastCalledWith({ section: 'location' }, 'schedule');
  expect(h.setFlags).not.toHaveBeenCalledWith({ section: 'none' }, 'schedule');      // no close first
  vi.advanceTimersByTime(500);
  expect(h.setFlags).toHaveBeenLastCalledWith({ isSettled: true }, 'none');
  expect(rt.machine.section).toBe('location');
});
test('events raised during effects run after the batch', () => {
  const h = host();
  h.willShow = vi.fn(() => rt.dispatch({ type: 'hide' }));
  const rt = make(h);
  rt.dispatch({ type: 'show' });
  expect(rt.machine.phase).toEqual({ type: 'closing' });
});
test('destroy clears timers; reset parks a fresh machine', () => {
  const h = host(); const rt = make(h);
  rt.dispatch({ type: 'show' }); rt.destroy();
  const n = h.setFlags.mock.calls.length;
  vi.advanceTimersByTime(1000);
  expect(h.setFlags.mock.calls.length).toBe(n);
  const rt2 = make(host()); rt2.dispatch({ type: 'show' }); rt2.reset();
  expect(rt2.machine.phase).toEqual({ type: 'closed', parked: true });
});
