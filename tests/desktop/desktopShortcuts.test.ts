// @vitest-environment jsdom
import { DATE_PRESETS } from '../../src/recreation/core/datePresets';
import type { DateSuggestion, RecreationHandle, RecreationState } from '../../src/recreation';
import { focusTargetOf, performShortcut, shortcutFor } from '../../src/desktop/desktopShortcuts';

type KeyPick = Pick<KeyboardEvent, 'key' | 'code' | 'metaKey' | 'shiftKey' | 'altKey' | 'ctrlKey'>;
type Mods = Partial<Pick<KeyboardEvent, 'metaKey' | 'shiftKey' | 'altKey' | 'ctrlKey'>>;

function key(k: string, mods: Mods = {}): KeyPick {
  const code = /^[a-z]$/i.test(k) ? `Key${k.toUpperCase()}` : /^\d$/.test(k) ? `Digit${k}` : k;
  return { key: k, code, metaKey: false, shiftKey: false, altKey: false, ctrlKey: false, ...mods };
}

/** The closed initial state of contracts §3.1 (A-D5 / B-D3 applied), merged with `patch`. */
function st(patch: Partial<RecreationState>): RecreationState {
  return {
    phase: { type: 'closed', parked: false }, section: 'none', contentVisible: false, settled: true,
    hoverSwollen: false, badgeShown: false, title: '', notes: '', listId: 'reminders', flagged: false,
    location: null, dueDate: null, presetPick: null, suggestion: null, dismissedSuggestionText: null,
    listPickerOpen: false, locationField: null, saveError: null, savedItems: [], dirty: false, openedOnce: false,
    canSave: false, accent: '#0A84FF', schedulingInNotch: false, locationInNotch: false, sectionOpen: false,
    ...patch,
  };
}

const OPEN: Partial<RecreationState> = { phase: { type: 'open' } };
const SUGGESTION: DateSuggestion = {
  date: new Date('2026-10-24T12:00:00Z'), hasTime: true, matchedRange: { start: 9, end: 24 }, matchedText: 'tomorrow at 2pm',
};

describe('shortcutFor', () => {
  it('Esc while open → escape', () => expect(shortcutFor(key('Escape'), { state: st(OPEN), focus: 'title' })).toEqual({ type: 'escape' }));
  it('Esc while closed → null', () => expect(shortcutFor(key('Escape'), { state: st({}), focus: 'none' })).toBeNull());
  it('⇧⌘R → show hotkey, closed or open', () => {
    for (const s of [st({}), st(OPEN)]) expect(shortcutFor(key('R', { metaKey: true, shiftKey: true }), { state: s, focus: 'none' })).toEqual({ type: 'show', source: 'hotkey' });
  });
  it('⌘↩ while open → submit from any focus', () => {
    for (const f of ['none', 'title', 'notes', 'scheduleField', 'timeField', 'calendar'] as const)
      expect(shortcutFor(key('Enter', { metaKey: true }), { state: st(OPEN), focus: f })).toEqual({ type: 'submit' });
  });
  it('Ctrl+↩ counts as ⌘↩', () => expect(shortcutFor(key('Enter', { ctrlKey: true }), { state: st(OPEN), focus: 'none' })).toEqual({ type: 'submit' }));
  it('↩ in title, notes, scheduleField → submit', () => {
    for (const f of ['title', 'notes', 'scheduleField'] as const) expect(shortcutFor(key('Enter'), { state: st(OPEN), focus: f })).toEqual({ type: 'submit' });
  });
  it('↩ in the time field → applyTypedTime', () => expect(shortcutFor(key('Enter'), { state: st({ ...OPEN, section: 'controls' }), focus: 'timeField' })).toEqual({ type: 'applyTypedTime' }));
  it('↩ in the location field → null (Done belongs to the field)', () => expect(shortcutFor(key('Enter'), { state: st({ ...OPEN, section: 'location' }), focus: 'locationField' })).toBeNull());
  it('↩ without a focused field → null', () => expect(shortcutFor(key('Enter'), { state: st(OPEN), focus: 'none' })).toBeNull());
  it('Tab in the title with a live suggestion → tab', () => expect(shortcutFor(key('Tab'), { state: st({ ...OPEN, suggestion: SUGGESTION }), focus: 'title' })).toEqual({ type: 'tab' }));
  it('Tab without a suggestion → null', () => expect(shortcutFor(key('Tab'), { state: st(OPEN), focus: 'title' })).toBeNull());
  it('⇧Tab → null', () => expect(shortcutFor(key('Tab', { shiftKey: true }), { state: st({ ...OPEN, suggestion: SUGGESTION }), focus: 'title' })).toBeNull());
  it('⌘D opens Set Date only while open and Set Date is not shown (from Location it switches over)', () => {
    expect(shortcutFor(key('d', { metaKey: true }), { state: st(OPEN), focus: 'title' })).toEqual({ type: 'openSchedule' });
    expect(shortcutFor(key('d', { metaKey: true }), { state: st({ ...OPEN, section: 'location' }), focus: 'locationField' })).toEqual({ type: 'openSchedule' });
    expect(shortcutFor(key('d', { metaKey: true }), { state: st({ ...OPEN, section: 'controls' }), focus: 'title' })).toBeNull();
    expect(shortcutFor(key('d', { metaKey: true }), { state: st({}), focus: 'none' })).toBeNull();
  });
  it('⌘K toggles the calendar only with Set Date open', () => {
    expect(shortcutFor(key('k', { metaKey: true }), { state: st({ ...OPEN, section: 'location' }), focus: 'locationField' })).toBeNull();
    expect(shortcutFor(key('k', { metaKey: true }), { state: st({ ...OPEN, section: 'controls' }), focus: 'scheduleField' })).toEqual({ type: 'toggleCalendar' });
    expect(shortcutFor(key('k', { metaKey: true }), { state: st(OPEN), focus: 'title' })).toBeNull();
  });
  it('⌘1…⌘6 by code map to DATE_PRESETS order, section open only', () => {
    DATE_PRESETS.forEach((preset, i) =>
      expect(shortcutFor({ key: '+ěščř'[i] ?? 'ž', code: `Digit${i + 1}`, metaKey: true, shiftKey: false, altKey: false, ctrlKey: false },
        { state: st({ ...OPEN, section: 'controls' }), focus: 'scheduleField' })).toEqual({ type: 'preset', preset }));
    expect(shortcutFor(key('1', { metaKey: true }), { state: st(OPEN), focus: 'title' })).toBeNull();
  });
  it('↑/↓ in the time field → stepTime ±1', () => {
    const s = st({ ...OPEN, section: 'controls' });
    expect(shortcutFor(key('ArrowUp'), { state: s, focus: 'timeField' })).toEqual({ type: 'stepTime', steps: 1 });
    expect(shortcutFor(key('ArrowDown'), { state: s, focus: 'timeField' })).toEqual({ type: 'stepTime', steps: -1 });
  });
  it('arrows in the calendar → moveDay −1 / +1 / −7 / +7', () => {
    const s = st({ ...OPEN, section: 'calendar' });
    expect(shortcutFor(key('ArrowLeft'), { state: s, focus: 'calendar' })).toEqual({ type: 'moveDay', days: -1 });
    expect(shortcutFor(key('ArrowRight'), { state: s, focus: 'calendar' })).toEqual({ type: 'moveDay', days: 1 });
    expect(shortcutFor(key('ArrowUp'), { state: s, focus: 'calendar' })).toEqual({ type: 'moveDay', days: -7 });
    expect(shortcutFor(key('ArrowDown'), { state: s, focus: 'calendar' })).toEqual({ type: 'moveDay', days: 7 });
  });
  it('arrows elsewhere → null', () => expect(shortcutFor(key('ArrowDown'), { state: st(OPEN), focus: 'title' })).toBeNull());
  it('browser shortcuts pass through', () => {
    for (const k of ['c', 'v', 'a', 'l', 't', 'r']) expect(shortcutFor(key(k, { metaKey: true }), { state: st(OPEN), focus: 'title' })).toBeNull();
  });
  it('⌥-modified keys → null', () => expect(shortcutFor(key('Enter', { metaKey: true, altKey: true }), { state: st(OPEN), focus: 'title' })).toBeNull());
});

describe('focusTargetOf', () => {
  it('reads data-qr-field', () => { const el = document.createElement('input'); el.dataset.qrField = 'timeField'; expect(focusTargetOf(el)).toBe('timeField'); });
  it('maps the title placeholder', () => { const el = document.createElement('input'); el.placeholder = 'New Reminder'; expect(focusTargetOf(el)).toBe('title'); });
  it('maps aria-label "Type a date"', () => { const el = document.createElement('input'); el.setAttribute('aria-label', 'Type a date'); expect(focusTargetOf(el)).toBe('scheduleField'); });
  it('maps a grid ancestor to calendar', () => { const g = document.createElement('div'); g.setAttribute('role', 'grid'); const b = document.createElement('button'); g.append(b); expect(focusTargetOf(b)).toBe('calendar'); });
  it('is none for null and unrelated elements', () => { expect(focusTargetOf(null)).toBe('none'); expect(focusTargetOf(document.body)).toBe('none'); });
});

describe('performShortcut', () => {
  it('show toggles: open → hide, closed → show hotkey', () => {
    let state = st(OPEN);
    const handle = { getState: () => state, hide: vi.fn(() => Promise.resolve()), show: vi.fn(() => Promise.resolve()) };
    performShortcut({ type: 'show', source: 'hotkey' }, handle as unknown as RecreationHandle);
    expect(handle.hide).toHaveBeenCalledTimes(1);
    expect(handle.show).not.toHaveBeenCalled();
    state = st({});
    performShortcut({ type: 'show', source: 'hotkey' }, handle as unknown as RecreationHandle);
    expect(handle.show).toHaveBeenCalledWith({ source: 'hotkey' });
    expect(handle.hide).toHaveBeenCalledTimes(1);
  });
  it('stepTime goes through the live draft', () => {
    const draft = { stepTime: vi.fn() };
    const handle = { scheduleDraft: () => draft };
    performShortcut({ type: 'stepTime', steps: 1 }, handle as unknown as RecreationHandle);
    expect(draft.stepTime).toHaveBeenCalledWith(1);
  });
  it('applyTypedTime passes the typed text', () => {
    const draft = { applyTypedTime: vi.fn(() => true) };
    const handle = { scheduleDraft: () => draft };
    performShortcut({ type: 'applyTypedTime' }, handle as unknown as RecreationHandle, { typed: '1430' });
    expect(draft.applyTypedTime).toHaveBeenCalledWith('1430');
  });
});
