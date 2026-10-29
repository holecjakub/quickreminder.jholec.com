import { describe, expect, it } from 'vitest';
import { LocationDraft } from '../../src/recreation/core/locationDraft';
import { buildNotes } from '../../src/recreation/core/reminder';

describe('LocationDraftTests', () => {
  it('opensOnTheCurrentLocation', () => {
    const d = new LocationDraft('Café Slavia');
    expect(d.text).toBe('Café Slavia');
    expect(d.isDirty).toBe(false);
    expect(d.saveDecision).toEqual({ type: 'saveAsIs' });
  });
  it('doneWritesTheFieldAsTyped', () => {
    const d = new LocationDraft('');
    d.text = '  Holešovice, Praha \n';
    expect(d.isDirty).toBe(true);
    expect(d.committed).toBe('  Holešovice, Praha \n');
    expect(d.saveDecision).toEqual({ type: 'applyThenSave', text: '  Holešovice, Praha \n' });
    expect(buildNotes('', d.committed)).toBe('📍 Holešovice, Praha');
  });
  it('blankingTheFieldRemovesTheLocation', () => {
    const d = new LocationDraft('Office');
    d.text = '   ';
    expect(d.saveDecision).toEqual({ type: 'applyThenSave', text: '   ' });
    expect(buildNotes('', d.committed)).toBeNull();
  });
  it('switchingKeepsWhatWasTyped', () => {
    const d = new LocationDraft('Office');
    expect(d.textToKeepOnSwitch).toBeNull();
    d.text = 'Home';
    expect(d.textToKeepOnSwitch).toBe('Home');
  });
  it('typingBackTheOriginalIsNotAnEdit', () => {
    const d = new LocationDraft('Office');
    d.text = 'Off';
    d.text = 'Office';
    expect(d.isDirty).toBe(false);
    expect(d.saveDecision).toEqual({ type: 'saveAsIs' });
  });
});
