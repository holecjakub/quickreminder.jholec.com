import { SECTION_SNAPSHOTS } from '../../../src/app/choreography/demo';
import { RECONCILE_TIMING, reconcile, type ReconcileOptions } from '../../../src/app/choreography/reconcile';
import type { FakeCursorHandle } from '../../../src/desktop/fakeCursor';
import { FakeRecreationHandle } from '../../fakes/fakeRecreationHandle';
import { prague, pragueCalendar } from '../../support';

const NOW = prague(2026, 10, 23, 10, 0);
const PHRASE_DATE = prague(2026, 10, 24, 14, 0);

const opts = (o?: Partial<ReconcileOptions>): ReconcileOptions => ({
  now: NOW, calendar: pragueCalendar, direction: 'down', signal: new AbortController().signal, cursor: null, ...o,
});

async function run<T>(p: Promise<T>): Promise<T> {
  await vi.runAllTimersAsync();
  return p;
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

it('pins RECONCILE_TIMING', () => {
  expect(RECONCILE_TIMING).toEqual({ scheduleRowsMs: 420, presetHoverMs: 450, listOpenMs: 220, listStepMs: 380, flagToLocationMs: 300, locationFieldMs: 300 });
});
it('jumping straight to 06 fills the reminder instantly and plays only the save', async () => {
  const h = new FakeRecreationHandle({ phraseDate: PHRASE_DATE, now: NOW });
  const r = await run(reconcile(h, SECTION_SNAPSHOTS['06'], opts()));
  expect(h.methods()).toEqual(['show', 'markClean', 'setList', 'setFlag', 'setLocation', 'setTitle', 'setDueDate', 'markClean', 'save']);
  expect(h.calls[0]!.args).toEqual([{ source: 'scroll' }]);
  expect(h.calls.find(c => c.method === 'setDueDate')!.args).toEqual([PHRASE_DATE, null]);
  expect(r).toEqual({ performed: 'save', keptVisitorEdits: false, aborted: false });
  expect(h.getState().savedItems.map(i => [i.title, i.listId, i.flagged, i.notes])).toEqual([['Call mum', 'work', true, '📍 Office']]);
});
it('02 types at 18 cps, waits 900 ms, then applies the chip', async () => {
  const h = new FakeRecreationHandle({ phraseDate: PHRASE_DATE, state: { phase: { type: 'open' } } });
  const p = reconcile(h, SECTION_SNAPSHOTS['02'], opts());
  await vi.advanceTimersByTimeAsync(2100); expect(h.methods()).not.toContain('applySuggestion');
  await vi.advanceTimersByTimeAsync(300); expect(h.methods()).toEqual(['markClean', 'typeTitle', 'applySuggestion', 'markClean']);
  expect(h.calls[1]!.args).toEqual(['Call mum tomorrow at 2pm', 18]);
  expect((await p).performed).toBe('typeTitle'); expect(h.getState().title).toBe('Call mum'); expect(h.getState().dueDate).toEqual(PHRASE_DATE);
});
it('instant mode (cps Infinity) sets the title and applies at once', async () => {
  const h = new FakeRecreationHandle({ phraseDate: PHRASE_DATE, state: { phase: { type: 'open' } } });
  const r = await reconcile(h, SECTION_SNAPSHOTS['02'], opts({ cps: Infinity }));
  expect(h.methods()).toEqual(['markClean', 'setTitle', 'applySuggestion', 'markClean']); expect(r.performed).toBe('typeTitle');
});
it('instant mode plays the whole demo without the cursor or a single timer', async () => {
  const h = new FakeRecreationHandle({ phraseDate: PHRASE_DATE, now: NOW, state: { phase: { type: 'open' }, title: 'Call mum', dueDate: PHRASE_DATE } });
  const cursor = { cancel: vi.fn() } as unknown as FakeCursorHandle;
  await reconcile(h, SECTION_SNAPSHOTS['03'], opts({ cps: Infinity, cursor }));
  await reconcile(h, SECTION_SNAPSHOTS['04'], opts({ cps: Infinity, cursor }));
  await reconcile(h, SECTION_SNAPSHOTS['05'], opts({ cps: Infinity, cursor }));
  expect(h.methods()).not.toContain('pointerTo'); expect(h.methods()).not.toContain('typeLocation');
  expect(h.calls.filter(c => c.method === 'setLocation').map(c => c.args[0])).toEqual(['Office']);
  expect(h.getState()).toMatchObject({ listId: 'work', flagged: true, location: 'Office', section: 'none' });
  expect(vi.getTimerCount()).toBe(0);
});
it('dirty: 02 keeps the visitor title and types nothing', async () => {
  const h = new FakeRecreationHandle({ state: { phase: { type: 'open' }, title: 'Buy milk', dirty: true } });
  const r = await run(reconcile(h, SECTION_SNAPSHOTS['02'], opts()));
  expect(h.methods()).toEqual([]); expect(r).toEqual({ performed: 'none', keptVisitorEdits: true, aborted: false });
});
it('dirty: 03 opens Set Date and the calendar on the visitor title', async () => {
  const h = new FakeRecreationHandle({ state: { phase: { type: 'open' }, title: 'Buy milk', dirty: true } });
  const r = await run(reconcile(h, SECTION_SNAPSHOTS['03'], opts()));
  expect(h.methods()).toEqual(['openSchedule', 'openCalendar']); expect(h.getState().title).toBe('Buy milk'); expect(r.keptVisitorEdits).toBe(true);
});
it('03 with the cursor points at the Tomorrow preset between the two steps', async () => {
  const h = new FakeRecreationHandle({ phraseDate: PHRASE_DATE, state: { phase: { type: 'open' }, title: 'Call mum', dueDate: PHRASE_DATE } });
  await run(reconcile(h, SECTION_SNAPSHOTS['03'], opts({ cursor: {} as FakeCursorHandle })));
  expect(h.methods()).toEqual(['markClean', 'openSchedule', 'pointerTo', 'openCalendar']); expect(h.calls[2]!.args[0]).toBe('preset:tomorrow');
});
it('dirty: 06 saves the visitor reminder', async () => {
  const h = new FakeRecreationHandle({ state: { phase: { type: 'open' }, title: 'Buy milk', canSave: true, dirty: true } });
  await run(reconcile(h, SECTION_SNAPSHOTS['06'], opts())); expect(h.methods()).toEqual(['save']); expect(h.getState().savedItems[0]!.title).toBe('Buy milk');
});
it('06 with the cursor clicks ✓ before saving', async () => {
  const h = new FakeRecreationHandle({ phraseDate: PHRASE_DATE, now: NOW, state: { phase: { type: 'open' }, title: 'Call mum', listId: 'work', flagged: true, location: 'Office', dueDate: PHRASE_DATE } });
  await run(reconcile(h, SECTION_SNAPSHOTS['06'], opts({ cursor: {} as FakeCursorHandle })));
  expect(h.methods()).toEqual(['markClean', 'pointerTo', 'save']); expect(h.calls[1]!.args).toEqual(['save', { click: true }]);
});
it('06 with an empty visitor title performs nothing', async () => {
  const h = new FakeRecreationHandle({ state: { phase: { type: 'open' }, dirty: true } });
  const r = await run(reconcile(h, SECTION_SNAPSHOTS['06'], opts()));
  expect(h.methods()).toEqual([]); expect(r).toEqual({ performed: 'none', keptVisitorEdits: true, aborted: false });
});
it('a dirty flag left from a closed panel is cleared by show (the draft was reset)', async () => {
  const h = new FakeRecreationHandle({ phraseDate: PHRASE_DATE, state: { dirty: true } });
  const r = await run(reconcile(h, SECTION_SNAPSHOTS['04'], opts())); expect(r.keptVisitorEdits).toBe(false); expect(h.getState().listId).toBe('work');
});
it('04 leaves Set Date instantly, then cycles reminders → work → home → work', async () => {
  const h = new FakeRecreationHandle({ state: { phase: { type: 'open' }, section: 'calendar', title: 'Call mum', dueDate: PHRASE_DATE } });
  await run(reconcile(h, SECTION_SNAPSHOTS['04'], opts()));
  expect(h.methods()).toEqual(['cancelSchedule', 'markClean', 'openListPicker', 'setList', 'openListPicker', 'setList', 'openListPicker', 'setList', 'markClean']);
  expect(h.calls.filter(c => c.method === 'setList').map(c => c.args[0])).toEqual(['work', 'home', 'work']);
});
it('04 with the cursor clicks the header and each list on the way', async () => {
  const h = new FakeRecreationHandle({ state: { phase: { type: 'open' }, title: 'Call mum', dueDate: PHRASE_DATE } });
  await run(reconcile(h, SECTION_SNAPSHOTS['04'], opts({ cursor: {} as FakeCursorHandle })));
  expect(h.calls.filter(c => c.method === 'pointerTo').map(c => c.args)).toEqual([
    ['header', { click: true }], ['list:work', { click: true }],
    ['header', { click: true }], ['list:home', { click: true }],
    ['header', { click: true }], ['list:work', { click: true }],
  ]);
});
it('an open list picker is closed before a section that does not cycle the lists', async () => {
  const h = new FakeRecreationHandle({ state: { phase: { type: 'open' }, title: 'Call mum', dueDate: PHRASE_DATE, listPickerOpen: true } });
  await run(reconcile(h, SECTION_SNAPSHOTS['03'], opts()));
  expect(h.methods()[0]).toBe('closeListPicker'); expect(h.getState().listPickerOpen).toBe(false);
});
it('a Location section left open is closed without writing before 04 cycles the lists', async () => {
  const h = new FakeRecreationHandle({ state: { phase: { type: 'open' }, section: 'location', locationField: 'Home', title: 'Call mum', dueDate: PHRASE_DATE } });
  await run(reconcile(h, SECTION_SNAPSHOTS['04'], opts()));
  expect(h.methods()[0]).toBe('cancelLocation');
  expect(h.getState()).toMatchObject({ section: 'none', location: null, locationField: null });
});
it('05 flags, then opens the Location section, types Office and presses Done', async () => {
  const h = new FakeRecreationHandle({ state: { phase: { type: 'open' }, title: 'Call mum', listId: 'work', dueDate: PHRASE_DATE } });
  await run(reconcile(h, SECTION_SNAPSHOTS['05'], opts()));
  expect(h.methods()).toEqual(['markClean', 'setFlag', 'typeLocation', 'markClean']); expect(h.calls[2]!.args).toEqual(['Office', 18]);
  expect(h.getState()).toMatchObject({ flagged: true, location: 'Office', section: 'none', locationField: null });
});
it('05 with the cursor clicks the flag and the location icons', async () => {
  const h = new FakeRecreationHandle({ state: { phase: { type: 'open' }, title: 'Call mum', listId: 'work', dueDate: PHRASE_DATE } });
  await run(reconcile(h, SECTION_SNAPSHOTS['05'], opts({ cursor: {} as FakeCursorHandle })));
  expect(h.methods()).toEqual(['markClean', 'pointerTo', 'setFlag', 'pointerTo', 'typeLocation', 'markClean']);
  expect(h.calls[1]!.args).toEqual(['flagIcon', { click: true }]); expect(h.calls[3]!.args).toEqual(['locationIcon', { click: true }]);
});
it('a flag and location already set by hand are undone instantly before 05 replays them', async () => {
  const h = new FakeRecreationHandle({ state: { phase: { type: 'open' }, title: 'Call mum', listId: 'work', dueDate: PHRASE_DATE, flagged: true, location: 'Home' } });
  await run(reconcile(h, SECTION_SNAPSHOTS['05'], opts()));
  expect(h.methods()).toEqual(['setFlag', 'setLocation', 'markClean', 'setFlag', 'typeLocation', 'markClean']);
  expect(h.calls[0]!.args).toEqual([false]); expect(h.calls[1]!.args).toEqual([null]);
});
it('up into the hero closes a clean panel', async () => { const h = new FakeRecreationHandle({ state: { phase: { type: 'open' } } }); const r = await run(reconcile(h, SECTION_SNAPSHOTS.hero, opts({ direction: 'up' }))); expect(h.methods()).toEqual(['hide']); expect(r.performed).toBe('close'); });
it('up into the hero keeps a dirty panel open', async () => { const h = new FakeRecreationHandle({ state: { phase: { type: 'open' }, dirty: true } }); expect((await run(reconcile(h, SECTION_SNAPSHOTS.hero, opts({ direction: 'up' })))).performed).toBe('none'); expect(h.methods()).toEqual([]); });
it('up into any other section leaves content alone', async () => { const h = new FakeRecreationHandle({ state: { phase: { type: 'open' }, section: 'calendar' } }); await run(reconcile(h, SECTION_SNAPSHOTS['03'], opts({ direction: 'up' }))); expect(h.methods()).toEqual([]); });
it('hero down with a closed panel and 07 are no-ops', async () => { const h = new FakeRecreationHandle(); await run(reconcile(h, SECTION_SNAPSHOTS.hero, opts())); await run(reconcile(h, SECTION_SNAPSHOTS['07'], opts())); expect(h.methods()).toEqual([]); });
it('abort mid-typing resolves aborted and cancels the handle', async () => {
  const h = new FakeRecreationHandle({ state: { phase: { type: 'open' } } }); const ac = new AbortController();
  const p = reconcile(h, SECTION_SNAPSHOTS['02'], opts({ signal: ac.signal })); await vi.advanceTimersByTimeAsync(500); ac.abort();
  await vi.runAllTimersAsync(); expect(await p).toEqual({ performed: 'typeTitle', keptVisitorEdits: false, aborted: true }); expect(h.methods()).toContain('cancel'); expect(h.methods()).not.toContain('applySuggestion');
});
it('abort during a sleep cancels the cursor too and stops the sequence', async () => {
  const h = new FakeRecreationHandle({ state: { phase: { type: 'open' }, title: 'Call mum', dueDate: PHRASE_DATE } }); const ac = new AbortController();
  const cursor = { cancel: vi.fn() } as unknown as FakeCursorHandle;
  const p = reconcile(h, SECTION_SNAPSHOTS['03'], opts({ signal: ac.signal, cursor })); await vi.advanceTimersByTimeAsync(100); ac.abort();
  await vi.runAllTimersAsync(); expect(await p).toEqual({ performed: 'schedule', keptVisitorEdits: false, aborted: true });
  expect(h.methods()).toEqual(['markClean', 'openSchedule', 'cancel']); expect(cursor.cancel).toHaveBeenCalledTimes(1);
});
it('a signal aborted before the call performs nothing', async () => {
  const h = new FakeRecreationHandle({ state: { phase: { type: 'open' } } }); const ac = new AbortController(); ac.abort();
  expect(await run(reconcile(h, SECTION_SNAPSHOTS['02'], opts({ signal: ac.signal })))).toEqual({ performed: 'none', keptVisitorEdits: false, aborted: true });
  expect(h.methods()).toEqual([]);
});
it('honours the motion time scale in sleeps', async () => {
  vi.resetModules();
  vi.doMock('../../../src/app/motionDebug', () => ({ scaleMs: (ms: number) => ms * 4 }));
  try {
    const { reconcile: scaled } = await import('../../../src/app/choreography/reconcile');
    const h = new FakeRecreationHandle({ phraseDate: PHRASE_DATE, state: { phase: { type: 'open' } } });
    const p = scaled(h, SECTION_SNAPSHOTS['02'], opts());
    // The fake types unscaled (R-10): 24 chars at 18 cps = 1333 ms on the fake clock; the 900 ms apply delay is 4× = 3600.
    await vi.advanceTimersByTimeAsync(1333 + 900); expect(h.methods()).not.toContain('applySuggestion');
    await vi.advanceTimersByTimeAsync(3600 - 900 - 1); expect(h.methods()).not.toContain('applySuggestion');
    await vi.advanceTimersByTimeAsync(1); expect(h.methods()).toContain('applySuggestion');
    expect((await p).performed).toBe('typeTitle');
  } finally {
    vi.doUnmock('../../../src/app/motionDebug');
    vi.resetModules();
  }
});
