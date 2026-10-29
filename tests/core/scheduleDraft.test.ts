import { describe, expect, it, vi } from 'vitest';
import { ScheduleDraft } from '../../src/recreation/core/scheduleDraft';
import { prague, pragueCalendar as cal, pragueString } from '../support';

const NOW = prague(2026, 10, 23, 10, 0);
const make = (selected: Date | null = null, initialText: string | null = null) =>
  new ScheduleDraft({ selected, initialText, calendar: cal, clock: () => NOW });

describe('ScheduleDraftTests', () => {
  it('opensOnTheSharedRules', () => {
    expect(pragueString(make().draft)).toBe('2026-10-24 09:00');
    const fromPhrase = make(null, 'zítra 14:00');
    expect(fromPhrase.text).toBe('zítra 14:00');
    expect(pragueString(fromPhrase.draft)).toBe('2026-10-24 14:00');
    expect(fromPhrase.textIsDate).toBe(true);
    const existing = prague(2026, 11, 2, 15, 0);
    expect(make(existing, 'zítra').draft).toEqual(existing);
  });
  it('relativeTextResolvesAtSetNotAtTheLastKeystroke', () => {
    let t = NOW;
    const d = new ScheduleDraft({ selected: null, initialText: null, calendar: cal, clock: () => t });
    d.text = '+2h';
    t = prague(2026, 10, 23, 10, 30);
    expect(d.set()?.date).toEqual(prague(2026, 10, 23, 12, 30));
  });
  it('typingParsesOnceAndMovesTheDraft', () => {
    const d = make();
    d.text = 'fri 2pm';
    expect(d.parsed).toEqual({ type: 'date', date: prague(2026, 10, 30, 14, 0) });
    expect(d.draft).toEqual(prague(2026, 10, 30, 14, 0));
    d.text = 'fri 2pm please';
    expect(d.isInvalid).toBe(true);
    expect(d.draft).toEqual(prague(2026, 10, 30, 14, 0));
    d.text = '';
    expect(d.parsed).toEqual({ type: 'empty' });
  });
  it('controlsClearTheTypedText', () => {
    const d = make(null, 'zítra');
    d.setTime(15);
    expect(d.text).toBe('');
    expect(pragueString(d.draft)).toBe('2026-10-24 15:00');
    d.pick(prague(2026, 10, 28));
    expect(pragueString(d.draft)).toBe('2026-10-28 15:00');
    expect(d.applyTypedTime('1430')).toBe(true);
    expect(pragueString(d.draft)).toBe('2026-10-28 14:30');
    expect(d.applyTypedTime('25:00')).toBe(false);
    expect(pragueString(d.draft)).toBe('2026-10-28 14:30');
  });
  it('timeStepsSnapToQuarterHours', () => {
    const d = make();
    d.setTime(9, 7); d.stepTime(1);
    expect(pragueString(d.draft)).toBe('2026-10-24 09:15');
    d.setTime(9, 7); d.stepTime(-1);
    expect(pragueString(d.draft)).toBe('2026-10-24 09:00');
    d.setTime(23, 50); d.stepTime(1);
    expect(pragueString(d.draft)).toBe('2026-10-24 00:00');
  });
  it('gridMovementAndPaging', () => {
    const d = make();
    expect(d.moveDay(7)).toBe(true);
    expect(pragueString(d.draft)).toBe('2026-10-31 09:00');
    expect(d.moveDay(-14)).toBe(false);
    d.moveInto(prague(2026, 12, 1));
    expect(pragueString(d.draft)).toBe('2026-12-31 09:00');
    d.moveInto(prague(2026, 11, 1));
    expect(pragueString(d.draft)).toBe('2026-11-30 09:00');
  });
  it('setWritesTheTypedDateOnceAndConsumesThePhrase', () => {
    const d = make(null, 'zítra');
    d.text = 'zítra 16:00';
    const o = d.set()!;
    expect(pragueString(o.date!)).toBe('2026-10-24 16:00');
    expect(o.presetPick).toBeNull();
    expect(o.consumesSuggestion).toBe(true);
    expect(d.committed).toBe(true);
    expect(d.set()).toBeNull();
    expect(d.apply('tomorrow')).toBeNull();
  });
  it('setOnInvalidTextStaysOpen', () => {
    const d = make();
    d.text = 'not a date';
    expect(d.set()).toBeNull();
    expect(d.committed).toBe(false);
  });
  it('presetRecordsThePickAndClearKeepsTheTitle', () => {
    const weekend = make().apply('weekend')!;
    expect(weekend.presetPick).toEqual({ preset: 'weekend', date: prague(2026, 10, 24, 9, 0) });
    expect(weekend.consumesSuggestion).toBe(false);
    const cleared = make(prague(2026, 11, 2, 9, 0), 'zítra').clear()!;
    expect(cleared).toEqual({ date: null, presetPick: null, consumesSuggestion: false });
  });
  it('singleHighlight', () => {
    const d = make();
    expect(d.highlightedPreset(null)).toBe('tomorrow');
    expect(d.highlightedPreset({ preset: 'weekend', date: prague(2026, 10, 24, 9, 0) })).toBe('weekend');
  });
  it('untouchedSavesAsIs', () => {
    const d = make();
    expect(d.isDirty).toBe(false);
    expect(d.prepareSave()).toEqual({ type: 'saveAsIs' });
    expect(d.committed).toBe(false);
    const prefilled = make(null, 'zítra');
    expect(prefilled.isDirty).toBe(false);
    expect(prefilled.prepareSave()).toEqual({ type: 'saveAsIs' });
  });
  it('anEditIsCommittedBeforeSaving', () => {
    const typed = make(null, 'zítra');
    typed.text = 'zítra 16:00';
    const a = typed.prepareSave();
    expect(a.type).toBe('commitThenSave');
    if (a.type === 'commitThenSave') {
      expect(pragueString(a.outcome.date!)).toBe('2026-10-24 16:00');
      expect(a.outcome.consumesSuggestion).toBe(true);
    }
    expect(typed.committed).toBe(true);
    const chip = make();
    chip.setTime(15);
    const b = chip.prepareSave();
    expect(b.type === 'commitThenSave' && pragueString(b.outcome.date!)).toBe('2026-10-24 15:00');
  });
  it('invalidTextBlocksTheSave', () => {
    const d = make();
    d.text = 'not a date';
    expect(d.prepareSave()).toEqual({ type: 'invalid' });
    expect(d.committed).toBe(false);
  });
  it('afterACommitTheSaveGoesThroughAsIs', () => {
    const d = make();
    d.setTime(15);
    d.set();
    expect(d.committed).toBe(true);
    expect(d.prepareSave()).toEqual({ type: 'saveAsIs' });
  });
  it('switchingKeepsTheEdit', () => {
    expect(make().prepareSwitch()).toEqual({ type: 'saveAsIs' });        // untouched: nothing written
    const edited = make();
    edited.setTime(15);
    const d = edited.prepareSwitch();
    expect(d.type === 'commitThenSave' && pragueString(d.outcome.date!)).toBe('2026-10-24 15:00');
    const invalid = make();
    invalid.text = 'not a date';
    expect(invalid.prepareSwitch()).toEqual({ type: 'invalid' });       // blocks the switch
  });
});

describe('scheduleDraft (TS)', () => {
  it('subscribersHearEveryMutation', () => {
    const d = make();
    const listener = vi.fn();
    const off = d.subscribe(listener);
    d.text = 'fri 2pm'; d.setTime(9); d.set();
    expect(listener).toHaveBeenCalledTimes(3);
    off(); d.clear();
    expect(listener).toHaveBeenCalledTimes(3);
  });
});
