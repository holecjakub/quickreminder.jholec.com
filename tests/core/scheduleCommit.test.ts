import { describe, expect, it } from 'vitest';
import { ScheduleCommit, type ScheduleAction } from '../../src/recreation/core/scheduleCommit';
import { prague, pragueCalendar as cal, pragueString } from '../support';

describe('ScheduleCommitTests', () => {
  const draft = prague(2026, 10, 24, 9, 0);
  it('setWritesTheParsedDateOrTheDraft', () => {
    const typed = prague(2026, 10, 25, 16, 0);
    expect(ScheduleCommit.dateToSet({ type: 'date', date: typed }, draft)).toEqual(typed);
    expect(ScheduleCommit.dateToSet({ type: 'empty' }, draft)).toEqual(draft);
    expect(ScheduleCommit.dateToSet({ type: 'invalid' }, draft)).toBeNull();
  });
  it.each<ScheduleAction>(['set', 'preset'])('anyDateWriteConsumesThePrefilledPhrase (%s)', (a) =>
    expect(ScheduleCommit.consumesSuggestion('zítra', a)).toBe(true));
  it.each<ScheduleAction>(['cancel', 'clear'])('cancelAndClearKeepTheTitle (%s)', (a) =>
    expect(ScheduleCommit.consumesSuggestion('zítra', a)).toBe(false));
  it.each([null, '', '  '])('noSuggestionNothingToConsume (%j)', (t) => {
    expect(ScheduleCommit.consumesSuggestion(t, 'set')).toBe(false);
    expect(ScheduleCommit.consumesSuggestion(t, 'preset')).toBe(false);
  });
});

describe('ScheduleOpeningTests', () => {
  const now = prague(2026, 10, 23, 10, 0);
  it('anExistingDateWinsAndTheFieldStartsEmpty', () => {
    const set = prague(2026, 11, 2, 15, 0);
    expect(ScheduleCommit.opening(set, 'zítra', now, cal)).toEqual({ draft: set, text: '' });
  });
  it('aLiveSuggestionIsPrefilledAndDrivesTheDraft', () => {
    const o = ScheduleCommit.opening(null, ' zítra 14:00 ', now, cal);
    expect(pragueString(o.draft)).toBe('2026-10-24 14:00');
    expect(o.text).toBe('zítra 14:00');
  });
  it.each([null, '', '  '])('otherwiseTomorrowMorning (%j)', (t) => {
    const o = ScheduleCommit.opening(null, t, now, cal);
    expect(pragueString(o.draft)).toBe('2026-10-24 09:00');
    expect(o.text).toBe('');
  });
  it('anUnreadablePhraseStaysInTheFieldOverTomorrow', () => {
    const o = ScheduleCommit.opening(null, 'zítra prosím', now, cal);
    expect(pragueString(o.draft)).toBe('2026-10-24 09:00');
    expect(o.text).toBe('zítra prosím');
  });
});

describe('TextRowSubmitTests', () => {
  it('returnInTheTitleCommitsTheOpenSection', () => {
    expect(ScheduleCommit.textRowSubmit(true, true)).toBe('setSchedule');
    expect(ScheduleCommit.textRowSubmit(true, false)).toBe('setSchedule');
    expect(ScheduleCommit.textRowSubmit(false, true)).toBe('saveReminder');
    expect(ScheduleCommit.textRowSubmit(false, false)).toBe('none');
  });
});
