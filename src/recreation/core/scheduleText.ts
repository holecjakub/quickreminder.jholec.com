// Port of Views/ScheduleText.swift and the invalid hint of ScheduleNotchSection: copy and
// constants shared by every Set Date control, so they never drift.

/** The invalid hint's example follows the UI language a Czech user would type in. */
function invalidExample(locale: string): string {
  return locale.split(/[-_]/)[0].toLowerCase() === 'cs' ? 'zítra 14:00' : 'tomorrow 2pm';
}

export const ScheduleText = {
  /** Time chips under the day + time row. */
  chipHours: [9, 12, 15, 19],
  /** Short enough for the field at default text size. */
  placeholder: 'fri 2pm, zítra 14:00, +2h',
  invalidExample,
  notADate: (example: string): string => `Not a date — try “${example}”`,
  inThePast: 'In the past',
} as const;
