// The menu-bar clock: the visitor's real time, re-rendered on every minute boundary.
import { useEffect, useRef, useState } from 'react';
import type { Clock } from '../recreation';
import { ptCss } from './scene';

function partsOf(date: Date, locale: string, options: Intl.DateTimeFormatOptions): Record<string, string> {
  const parts: Record<string, string> = {};
  for (const p of new Intl.DateTimeFormat(locale, options).formatToParts(date)) parts[p.type] = p.value;
  return parts;
}

/** en*: "Fri Oct 23 10:00 AM" (weekday short, month short, day, j:mm); other locales: "pá 23. 10. 10:00"
 *  (weekday short, numeric day.month, j:mm). U+202F / U+00A0 become plain spaces. */
export function formatMenuBarClock(date: Date, locale: string, timeZone: string): string {
  const time = new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit', timeZone }).format(date);
  let text: string;
  if (locale.toLowerCase().startsWith('en')) {
    const p = partsOf(date, locale, { weekday: 'short', month: 'short', day: 'numeric', timeZone });
    text = `${p.weekday} ${p.month} ${p.day} ${time}`;
  } else {
    const p = partsOf(date, locale, { weekday: 'short', month: 'numeric', day: 'numeric', timeZone });
    text = `${p.weekday} ${p.day}. ${p.month}. ${time}`;
  }
  return text.replace(/[\u202F\u00A0]/g, ' ');
}

/** 60000 − (s·1000 + ms); 60000 exactly on the minute. */
export function msUntilNextMinute(now: Date): number {
  return 60000 - (now.getSeconds() * 1000 + now.getMilliseconds());
}

export function MenuBarClock({ clock, locale, timeZone }: { clock: Clock; locale: string; timeZone: string }) {
  const [text, setText] = useState(() => formatMenuBarClock(clock(), locale, timeZone));
  // A parent may pass a fresh clock function each render; the timers read the latest one.
  const clockRef = useRef(clock);
  useEffect(() => {
    clockRef.current = clock;
  });

  useEffect(() => {
    const now = (): Date => clockRef.current();
    const tick = (): void => setText(formatMenuBarClock(now(), locale, timeZone));
    tick();
    let interval: ReturnType<typeof setInterval> | undefined;
    const timeout = setTimeout(() => {
      tick();
      interval = setInterval(tick, 60000);
    }, msUntilNextMinute(now()));
    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
    };
  }, [locale, timeZone]);

  return (
    <span data-menubar-clock="" style={{ fontSize: ptCss(13), fontWeight: 500, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
      {text}
    </span>
  );
}
