import { describe, expect, it } from 'vitest';
import { accentFor, DEFAULT_LIST_ID, FAKE_LISTS, listById, type ListId } from '../../src/recreation/core/lists';
import { buildNotes, toSavedReminder } from '../../src/recreation/core/reminder';
import { SuggestionDateFormatter } from '../../src/recreation/core/suggestionDateFormatter';
import { plainSpaces, prague, pragueCalendar as cal } from '../support';

describe('BuildNotesTests', () => {
  it('notesAndLocation', () => {
    expect(buildNotes('', null)).toBeNull();
    expect(buildNotes('Bring cake', null)).toBe('Bring cake');
    expect(buildNotes('Bring cake', ' Office ')).toBe('Bring cake\n📍 Office');
    expect(buildNotes('', '\n  \t')).toBeNull();
  });
});

describe('lists', () => {
  it('fiveFakeListsInPickerOrder', () => {
    expect(FAKE_LISTS.map((l) => [l.id, l.title, l.color])).toEqual([
      ['reminders', 'Reminders', '#0A84FF'], ['work', 'Work', '#BF5AF2'], ['home', 'Home', '#FF9F0A'],
      ['groceries', 'Groceries', '#30D158'], ['ideas', 'Ideas', '#FF375F'],
    ]);
    expect(DEFAULT_LIST_ID).toBe('reminders');
  });
  it('accentFor', () => {
    expect(accentFor('work')).toBe('#BF5AF2');
    expect(accentFor('nope' as ListId)).toBe('#0A84FF');
    expect(listById('home').title).toBe('Home');
  });
});

describe('toSavedReminder', () => {
  it('buildsTheWindowRow', () => {
    const now = prague(2026, 10, 23, 10, 0);
    const f = new SuggestionDateFormatter({ locale: 'en-US', calendar: cal });
    const saved = toSavedReminder({ title: 'Call mum', notes: '', listId: 'work', dueDate: prague(2026, 10, 24, 14, 0), flagged: true, location: 'Office' }, now, f);
    expect(saved).toMatchObject({ title: 'Call mum', notes: '📍 Office', listId: 'work', listColor: '#BF5AF2', flagged: true, savedAt: now });
    expect(plainSpaces(saved.dueLabel!)).toBe('Tomorrow, 2:00 PM');
    expect(saved.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(toSavedReminder({ title: 'x', notes: '', listId: 'home', dueDate: null, flagged: false, location: null }, now, f).dueLabel).toBeNull();
  });
});
