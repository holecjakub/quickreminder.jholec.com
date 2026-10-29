// Test-only helpers for the recreation UI: the fixed test time and calendar, fake timers, a core
// on the fake 14" screen, rendering under the provider, and the inverse of `px()`.
import { act, render, type RenderResult } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import { createRecreationCore, type RecreationCore, type RecreationCoreOptions } from '../../src/recreation/controller';
import type { Calendar } from '../../src/recreation/core/calendar';
import { NotchLayout } from '../../src/recreation/machine/notchLayout';
import { RecreationProvider } from '../../src/recreation/ui/RecreationContext';

/** Friday 2026-09-18 10:00 Europe/Prague, the parser suite's `now`. */
export const TEST_NOW = new Date('2026-09-18T08:00:00Z');

export const testCalendar: Calendar = { timeZone: 'Europe/Prague', locale: 'en-US', firstWeekday: 1 };

/** The fake timers' clock at minute precision: relative phrases (`+2h`) resolve from `now`, and
 *  the milliseconds a test advanced the timers by must not leak into the dates it expects. */
const MINUTE = 60_000;
export const testClock = (): Date => new Date(Math.floor(Date.now() / MINUTE) * MINUTE);

/** A core on the 14" screen (notch 221 × 38, 982 pt tall, no Dock), en-US, full motion at scale 1. */
export function createTestCore(o: Partial<RecreationCoreOptions> = {}): RecreationCore {
  return createRecreationCore({
    notch: NotchLayout.NOTCH,
    screenHeight: 982,
    dockHeight: 0,
    clock: testClock,
    calendar: testCalendar,
    locale: 'en-US',
    reduceMotion: () => false,
    timeScale: () => 1,
    ...o,
  });
}

/** Renders `ui` under `RecreationProvider`; `rerender(ui)` re-wraps it in the same provider. */
export function renderWithCore(
  ui: ReactElement,
  core: RecreationCore = createTestCore(),
  prefs: { reduceMotion?: boolean } = {},
): RenderResult & { core: RecreationCore } {
  const wrap = (el: ReactNode) => (
    <RecreationProvider core={core} reduceMotion={prefs.reduceMotion ?? false} timeScale={1}>{el}</RecreationProvider>
  );
  const result = render(wrap(ui));
  return { ...result, core, rerender: (next: ReactNode) => result.rerender(wrap(next)) };
}

/** `show('api', false)` and the 600 ms it takes to open and settle, inside `act()`. */
export async function openPanel(core: RecreationCore): Promise<void> {
  await act(async () => {
    void core.controller.show('api', false);
    vi.advanceTimersByTime(600);
  });
}

/** Fakes setTimeout / setInterval / Date and sets the system time to TEST_NOW. */
export function useTestTime(): void {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });
  vi.setSystemTime(TEST_NOW);
}

const PT_LENGTH = /^calc\((-?\d+(?:\.\d+)?) \* var\(--pt\) \* 1px\)$/;

/** Reads the point value back out of a `px(pt)` length; throws on anything else. */
export function ptOf(value: string): number {
  const match = PT_LENGTH.exec(value);
  if (!match) throw new Error(`not a px(pt) length: ${value}`);
  return Number(match[1]);
}
