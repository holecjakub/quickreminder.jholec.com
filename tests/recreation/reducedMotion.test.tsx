// @vitest-environment jsdom
import '../ui/setup';
import { render, act, fireEvent, screen } from '@testing-library/react';
import { createRef } from 'react';
import { Recreation, type RecreationHandle } from '../../src/recreation';
import { useTestTime, testCalendar } from '../ui/support';
import { setPrefersReducedMotion } from '../ui/setup';
beforeEach(() => useTestTime());
afterEach(() => setPrefersReducedMotion(false));
function mount(props: Record<string, unknown> = {}) {
  const ref = createRef<RecreationHandle>();
  const u = render(<Recreation ref={ref} notch={{ width: 221, height: 38 }} screenHeight={982} shortcutsEnabled sceneScale={1}
    notchOrigin={{ x: 756, y: 0 }} clock={() => new Date()} calendar={testCalendar} {...props} />);
  return { ref, ...u };
}
test('the media query alone switches the recreation to reduced motion', async () => {
  setPrefersReducedMotion(true);
  const { ref, container } = mount();
  const h = ref.current!;
  h.show(); await act(async () => { vi.advanceTimersByTime(500); });
  const content = container.querySelector('[data-qr-content]') as HTMLElement;
  expect(content.style.filter).toBe('blur(calc(0 * var(--pt) * 1px))');
  h.setTitle('Buy milk');
  const saving = h.save();
  expect(h.machine().phase).toEqual({ type: 'closing' });           // plain collapse
  expect(container.querySelector('[data-qr-badge-slot]')).toBeNull();
  expect(h.getState().savedItems).toHaveLength(1);                  // lands at once without a badge
  await act(async () => { vi.advanceTimersByTime(360); });
  await expect(saving).resolves.toMatchObject({ title: 'Buy milk' });
});
test('no hover scale on round controls, no press scale on fills, no row drop', async () => {
  const { ref, container } = mount({ reduceMotion: true });
  const h = ref.current!;
  h.show(); await act(async () => { vi.advanceTimersByTime(500); });
  const close = screen.getByRole('button', { name: 'Close' });
  fireEvent.pointerEnter(close);
  expect(['', 'none'].includes((close.firstElementChild as HTMLElement).style.transform)).toBe(true);
  await act(async () => { h.openSchedule(); });
  const rows = [...container.querySelectorAll('[data-qr-row]')] as HTMLElement[];
  expect(rows.every(r => !r.style.transform.includes('-6'))).toBe(true);
  const cancel = screen.getByRole('button', { name: 'Cancel' });
  fireEvent.pointerDown(cancel);
  expect(['', 'none'].includes(cancel.style.transform)).toBe(true);
});
