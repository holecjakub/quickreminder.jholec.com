// @vitest-environment jsdom
import '../ui/setup';
import { render, act, screen } from '@testing-library/react';
import { createRef } from 'react';
import { Recreation, type RecreationHandle } from '../../src/recreation';
import { useTestTime, testCalendar, ptOf } from '../ui/support';
import { plainSpaces } from '../support';

beforeEach(() => useTestTime());

const adv = (ms: number) => act(async () => { vi.advanceTimersByTime(ms); });

/** A synchronous handle call inside `act()`: the store change is rendered before the next assertion. */
function run<T>(call: () => T): T {
  let result!: T;
  act(() => { result = call(); });
  return result;
}

function mount(extra: Record<string, unknown> = {}) {
  const ref = createRef<RecreationHandle>();
  const utils = render(<Recreation ref={ref} notch={{ width: 221, height: 38 }} screenHeight={982} shortcutsEnabled sceneScale={1}
    notchOrigin={{ x: 756, y: 0 }} clock={() => new Date()} calendar={testCalendar} {...extra} />);
  return { ref, ...utils };
}

test('placed on the notch', () => {
  const { container } = mount();
  const root = container.querySelector('[data-qr-root]') as HTMLElement;
  expect([ptOf(root.style.left), ptOf(root.style.top)]).toEqual([432, 0]);
});

test('scroll-driven demo: no focus, no dirty, the reminder lands', async () => {
  const onSaved = vi.fn();
  const { ref } = mount({ onSaved });
  const h = ref.current!;
  const shown = run(() => h.show({ source: 'scroll' }));
  await adv(500); await shown;
  expect(document.activeElement).toBe(document.body);
  const typed = run(() => h.typeTitle('Call mum tomorrow at 2pm'));
  await adv(Math.ceil(24 * 1000 / 18) + 1); await typed;
  expect(h.getState().suggestion!.matchedText).toBe('tomorrow at 2pm');
  expect(run(() => h.applySuggestion())).toBe(true);
  run(() => { h.setList('work'); h.setFlag(true); });
  const loc = run(() => h.typeLocation('Office')); await adv(Math.ceil(6 * 1000 / 18) + 1); await loc;
  expect(h.getState()).toMatchObject({ title: 'Call mum', listId: 'work', accent: '#BF5AF2', flagged: true, location: 'Office', section: 'none', locationField: null, dirty: false });
  const saved = run(() => h.save());
  await adv(320);
  expect(onSaved).toHaveBeenCalledTimes(1);
  expect(onSaved.mock.calls[0]![0]).toMatchObject({ title: 'Call mum', listColor: '#BF5AF2', flagged: true, notes: '📍 Office' });
  expect(plainSpaces(onSaved.mock.calls[0]![0].dueLabel)).toBe('Tomorrow, 2:00 PM');
  await adv(1040);
  await expect(saved).resolves.toMatchObject({ title: 'Call mum' });
  expect(h.machine().phase).toEqual({ type: 'closed', parked: true });
});

test('a click or the hotkey focuses the title', async () => {
  const { ref } = mount();
  run(() => ref.current!.show({ source: 'hotkey' }));
  await adv(300);
  expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'New Reminder' }));
});

test('Location through the handle: typeLocation opens the section, types into the field, then Done', async () => {
  const { ref, container } = mount();
  const h = ref.current!;
  run(() => h.show()); await adv(500);
  const typing = run(() => h.typeLocation('Office'));
  expect(h.getState().section).toBe('location');
  await adv(Math.ceil(3 * 1000 / 18));
  expect(h.getState()).toMatchObject({ locationField: 'Off', location: null });
  await adv(Math.ceil(3 * 1000 / 18) + 1); await typing;
  expect(h.getState()).toMatchObject({ section: 'none', location: 'Office', locationField: null, dirty: false });
  run(() => { h.openLocation(); h.setLocationText('Home'); });
  expect(h.locationDraft()!.saveDecision).toEqual({ type: 'applyThenSave', text: 'Home' });
  expect(run(() => h.escape())).toBe('section');
  expect(h.getState().location).toBe('Office');
  run(() => h.toggleLocation());
  expect(container.querySelector('[data-qr-target="locationDone"]')).not.toBeNull();
  run(() => h.clearLocation());
  expect(h.getState()).toMatchObject({ section: 'none', location: null });
});

test('Set Date through the handle', async () => {
  const { ref } = mount();
  const h = ref.current!;
  run(() => h.show()); await adv(500);
  run(() => h.openSchedule());
  expect(h.scheduleDraft()!.draft).toEqual(new Date('2026-09-19T07:00:00Z'));
  run(() => h.openCalendar());
  expect(h.getState().section).toBe('calendar');
  run(() => { h.pickDay(new Date('2026-09-24T22:00:00Z')); h.setTime(15); });
  expect(run(() => h.commitSchedule())).toBe(true);
  expect(h.getState()).toMatchObject({ section: 'none', dueDate: new Date('2026-09-25T13:00:00Z') });
  expect(run(() => h.escape())).toBe('panel');
});

test('cancel aborts typing; reset closes and clears', async () => {
  const { ref } = mount();
  const h = ref.current!;
  run(() => h.show()); await adv(500);
  const typing = run(() => h.typeTitle('Buy milk'));
  await adv(120);
  run(() => h.cancel());
  await expect(typing).rejects.toMatchObject({ name: 'AbortError' });
  expect(h.getState().title).toBe('Bu');
  run(() => h.reset());
  expect(h.getState()).toMatchObject({ title: '', phase: { type: 'closed', parked: true }, listId: 'reminders' });
});

test('pointer targets in scene points and the cursor click path', async () => {
  const cursor = { moveTo: vi.fn(async () => {}), click: vi.fn(async () => {}), cancel: vi.fn() };
  const { ref, container } = mount({ cursor: { current: cursor } });
  const h = ref.current!;
  expect(h.pointFor('notch')).toEqual({ x: 756, y: 19.5 });
  run(() => h.show()); await adv(500);
  const canvas = container.querySelector('[data-qr-canvas]') as HTMLElement;
  canvas.getBoundingClientRect = () => ({ left: 100, top: 0, width: 648, height: 775, right: 748, bottom: 775, x: 100, y: 0, toJSON() {} });
  const flag = container.querySelector('[data-qr-target="flagIcon"]') as HTMLElement;
  flag.getBoundingClientRect = () => ({ left: 100 + 184, top: 178, width: 38, height: 38, right: 0, bottom: 0, x: 0, y: 0, toJSON() {} });
  expect(h.pointFor('flagIcon')).toEqual({ x: 432 + 203, y: 197 });
  await act(async () => { await h.pointerTo('flagIcon', { click: true }); });
  expect(cursor.moveTo).toHaveBeenCalledWith({ x: 635, y: 197 }, { durationMs: undefined });
  expect(cursor.click).toHaveBeenCalled();
  expect(h.getState()).toMatchObject({ flagged: true, dirty: false });
  expect(h.pointFor('set')).toBeNull();
});
