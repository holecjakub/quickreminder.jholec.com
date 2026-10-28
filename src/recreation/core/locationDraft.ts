// Port of Services/LocationDraft.swift: the in-notch Location section's working state — the field,
// and what Done / ✓ / a switch to Set Date write. The text is written as typed; the save path
// (`buildNotes`) trims it.

/** Swift `LocationDraft.SaveDecision`. */
export type LocationSaveDecision = { readonly type: 'saveAsIs' } | { readonly type: 'applyThenSave'; readonly text: string };

export class LocationDraft {
  /** The reminder's location when the section opened ('' = none). */
  readonly original: string;
  /** The field. */
  text: string;

  constructor(original: string) {
    this.original = original;
    this.text = original;
  }

  /** The user changed the text since the section opened. */
  get isDirty(): boolean {
    return this.text !== this.original;
  }

  /** What Done writes: the field as typed (the save path trims; blank removes the location). */
  get committed(): string {
    return this.text;
  }

  /** What ✓ does while the section is open: an edit is applied first, an untouched field is
   *  saved as it was. */
  get saveDecision(): LocationSaveDecision {
    return this.isDirty ? { type: 'applyThenSave', text: this.committed } : { type: 'saveAsIs' };
  }

  /** Switching to Set Date keeps what was typed: an edit is written (like Done); null = nothing
   *  to write. */
  get textToKeepOnSwitch(): string | null {
    return this.isDirty ? this.committed : null;
  }
}
