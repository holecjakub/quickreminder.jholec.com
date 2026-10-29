// @vitest-environment jsdom
import '../ui/setup';
import { render, act, fireEvent, waitFor } from '@testing-library/react';
import { createRef } from 'react';
import { Recreation, type RecreationHandle } from '../../src/recreation';
import { translatedNotchPath } from '../../src/recreation/ui/NotchSilhouette';
import { useTestTime, testCalendar } from '../ui/support';
beforeEach(() => useTestTime());
const CLOSED = translatedNotchPath({ width: 235, height: 39, top: 6, bottom: 14 }, 648);
const SWOLLEN = translatedNotchPath({ width: 257, height: 44, top: 6, bottom: 14 }, 648);
function mount(reduceMotion = false) {
  const ref = createRef<RecreationHandle>();
  const u = render(<Recreation ref={ref} notch={{ width: 221, height: 38 }} screenHeight={982} shortcutsEnabled sceneScale={1}
    notchOrigin={{ x: 756, y: 0 }} clock={() => new Date()} calendar={testCalendar} reduceMotion={reduceMotion} />);
  return { ref, path: u.container.querySelector('path[data-qr-target="notch"]')! };
}
test('swells after a 90 ms rest, settles back on leave', async () => {
  const { ref, path } = mount();
  fireEvent.pointerEnter(path);
  await act(async () => { vi.advanceTimersByTime(89); });
  expect(path.getAttribute('d')).toBe(CLOSED);
  await act(async () => { vi.advanceTimersByTime(1); });
  await waitFor(() => expect(path.getAttribute('d')).toBe(SWOLLEN));
  expect(ref.current!.getState().hoverSwollen).toBe(true);
  fireEvent.pointerLeave(path);
  await waitFor(() => expect(path.getAttribute('d')).toBe(CLOSED));
});
test('a pointer crossing the notch does nothing', async () => {
  const { path } = mount();
  fireEvent.pointerEnter(path);
  await act(async () => { vi.advanceTimersByTime(50); });
  fireEvent.pointerLeave(path);
  await act(async () => { vi.advanceTimersByTime(100); });
  expect(path.getAttribute('d')).toBe(CLOSED);
});
test('closing under a resting pointer waits for it to leave first', async () => {
  const { ref, path } = mount();
  fireEvent.pointerEnter(path);
  fireEvent.pointerDown(path);                                 // click opens
  await act(async () => { vi.advanceTimersByTime(600); });
  ref.current!.hide();
  await act(async () => { vi.advanceTimersByTime(360); });     // parks with the pointer still on the notch
  fireEvent.pointerEnter(path);
  await act(async () => { vi.advanceTimersByTime(200); });
  expect(ref.current!.getState().hoverSwollen).toBe(false);
  fireEvent.pointerLeave(path); fireEvent.pointerEnter(path);
  await act(async () => { vi.advanceTimersByTime(90); });
  expect(ref.current!.getState().hoverSwollen).toBe(true);
});
test('reduce motion: no swell', async () => {
  const { ref, path } = mount(true);
  fireEvent.pointerEnter(path);
  await act(async () => { vi.advanceTimersByTime(200); });
  expect(ref.current!.getState().hoverSwollen).toBe(false);
  expect(path.getAttribute('d')).toBe(CLOSED);
});
