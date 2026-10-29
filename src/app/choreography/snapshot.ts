// Section snapshots of the scroll choreography (contracts §4.4 with A-D5, landing spec §11.2): the
// state the recreation should show once a section has entered, and the one delta it animates.
import type { Calendar } from '../../recreation/core/calendar';
import { DatePresets, type DatePreset, type PresetPick } from '../../recreation/core/datePresets';
import type { ListId } from '../../recreation/core/lists';
import { NaturalDateParser } from '../../recreation/core/naturalDateParser';
import { ScheduleDefaults } from '../../recreation/core/scheduleDefaults';
import type { NotchSection } from '../../recreation/machine/notchMachine';

export type SectionId = 'hero' | '01' | '02' | '03' | '04' | '05' | '06' | '07';
export type SectionAction = 'none' | 'close' | 'open' | 'typeTitle' | 'schedule' | 'lists' | 'flagLocation' | 'save';

/** Page order of the sections, top to bottom. */
export const SECTION_ORDER: readonly SectionId[] = ['hero', '01', '02', '03', '04', '05', '06', '07'];

/** The section above `id`; the hero is its own predecessor. */
export function previousSection(id: SectionId): SectionId {
  const index = SECTION_ORDER.indexOf(id);
  return SECTION_ORDER[index - 1] ?? 'hero';
}

/** Due date relative to `now`, resolved by resolveDue(). */
export type DueSpec =
  | null
  | { readonly type: 'phrase'; readonly text: string }        // NaturalDateParser on the phrase, day-only → resolveDayOnly
  | { readonly type: 'preset'; readonly preset: DatePreset };

export interface SectionSnapshot {
  readonly id: SectionId;
  readonly panel: 'closed' | 'open';
  readonly section: NotchSection;
  readonly title: string;            // final title (phrase already stripped when `due` is a phrase and applied)
  readonly typedTitle?: string;      // what typeTitle types in 02 ("Call mum tomorrow at 2pm")
  readonly notes: string;
  readonly listId: ListId;
  readonly flagged: boolean;
  readonly location: string | null;
  readonly due: DueSpec;
  readonly saved: boolean;           // 06: the item is in the window and the panel closed again
  /** The one delta this section animates; everything else is set instantly. */
  readonly action: SectionAction;
  readonly highlightPreset?: DatePreset;     // 03: 'tomorrow'
  readonly listCycle?: readonly ListId[];    // 04: ['reminders', 'work', 'home', 'work'] — ends on the demo list (C-N2)
  readonly applyDelayMs?: number;            // 02: 900 (chip shows, then Tab animation)
}

/** The absolute due date a snapshot asks for at `now`; null when there is none or the phrase does not parse. */
export function resolveDue(spec: DueSpec, now: Date, calendar: Calendar): { date: Date; presetPick: PresetPick | null } | null {
  if (spec === null) return null;
  if (spec.type === 'preset') {
    const date = DatePresets.date(spec.preset, now, calendar);
    return { date, presetPick: { preset: spec.preset, date } };
  }
  const suggestion = NaturalDateParser.parse(spec.text, now, calendar);
  if (!suggestion) return null;
  const date = suggestion.hasTime ? suggestion.date : ScheduleDefaults.resolveDayOnly(suggestion.date, now, calendar);
  return { date, presetPick: null };
}
