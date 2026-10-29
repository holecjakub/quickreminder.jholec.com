import type { RecreationState } from '../../src/recreation/store';
import { recreationKeyFor, platformCmdKey, type KeyContext } from '../../src/recreation/ui/keyboard';
const base = { phase: { type: 'open' }, section: 'none', suggestion: null, badgeShown: false };
const ctx = (field: KeyContext['field'], state: Record<string, unknown> = {}): KeyContext => ({ state: { ...base, ...state } as unknown as RecreationState, field, cmdKey: 'meta' });
const k = (key: string, mods: Partial<{ meta: boolean; shift: boolean; ctrl: boolean; alt: boolean; code: string; isComposing: boolean }> = {}) =>
  ({ key, code: mods.code ?? '', metaKey: !!mods.meta, shiftKey: !!mods.shift, ctrlKey: !!mods.ctrl, altKey: !!mods.alt, isComposing: !!mods.isComposing });
test.each([
  [k('Escape'), ctx('title'), { type: 'escape' }],
  [k('Escape'), ctx('title', { phase: { type: 'saving' } }), { type: 'escape' }],
  [k('a'), ctx(null, { phase: { type: 'saving' } }), { type: 'swallow' }],
  [k('r', { meta: true, shift: true }), ctx('title'), { type: 'toggle' }],
  [k('Enter', { meta: true }), ctx('notes'), { type: 'submit' }],
  [k('Enter'), ctx('title'), { type: 'textRowSubmit' }],
  [k('Enter'), ctx('scheduleField', { section: 'controls' }), { type: 'commitSchedule' }],
  [k('Enter'), ctx('timeField', { section: 'controls' }), { type: 'applyTypedTime' }],
  [k('Enter'), ctx('locationField', { section: 'location' }), { type: 'commitLocation' }],
  [k('Enter'), ctx(null, { section: 'calendar' }), { type: 'commitSection' }],
  [k('Enter'), ctx(null, { section: 'location' }), { type: 'commitSection' }],
  [k('d', { meta: true }), ctx('locationField', { section: 'location' }), { type: 'openSchedule' }],
  [k('k', { meta: true }), ctx('locationField', { section: 'location' }), null],
  [k('3', { meta: true, code: 'Digit3' }), ctx('locationField', { section: 'location' }), null],
  [k('Enter'), ctx(null), null],
  [k('Tab'), ctx('title', { suggestion: { matchedText: 'tomorrow' } }), { type: 'applySuggestion' }],
  [k('Tab'), ctx('title'), null],
  [k('Tab', { shift: true }), ctx('title', { suggestion: { matchedText: 'tomorrow' } }), null],
  [k('d', { meta: true }), ctx('notes'), { type: 'openSchedule' }],
  [k('d', { meta: true }), ctx('notes', { badgeShown: true }), null],
  [k('k', { meta: true }), ctx('scheduleField', { section: 'controls' }), { type: 'toggleCalendar' }],
  [k('k', { meta: true }), ctx('title'), null],
  [k('3', { meta: true, code: 'Digit3' }), ctx(null, { section: 'controls' }), { type: 'preset', preset: 'tomorrow' }],
  [k('6', { meta: true, code: 'Digit6' }), ctx(null, { section: 'calendar' }), { type: 'preset', preset: 'nextMonth' }],
  [k('1', { meta: true, code: 'Digit1' }), ctx('title'), null],
  [k('ArrowUp'), ctx('timeField', { section: 'controls' }), { type: 'stepTime', steps: 1 }],
  [k('ArrowDown'), ctx('timeField', { section: 'controls' }), { type: 'stepTime', steps: -1 }],
  [k('ArrowLeft'), ctx('calendar', { section: 'calendar' }), { type: 'moveDay', days: -1 }],
  [k('ArrowDown'), ctx('calendar', { section: 'calendar' }), { type: 'moveDay', days: 7 }],
  [k('ArrowUp'), ctx('title'), null],
  [k('Enter', { isComposing: true }), ctx('title'), null],
])('%j in %j → %j', (e, c, expected) => expect(recreationKeyFor(e, c)).toEqual(expected));
test('Ctrl stands in for ⌘ off Apple platforms', () => {
  expect(platformCmdKey('MacIntel')).toBe('meta');
  expect(platformCmdKey('Win32')).toBe('ctrl');
  expect(recreationKeyFor(k('d', { ctrl: true }), { ...ctx('title'), cmdKey: 'ctrl' })).toEqual({ type: 'openSchedule' });
  expect(recreationKeyFor(k('d', { ctrl: true }), ctx('title'))).toBeNull();
});
