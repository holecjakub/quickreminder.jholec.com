// @vitest-environment jsdom
import './setup';
import { render } from '@testing-library/react';
import { SFIcon, GLYPHS, CalendarClockIcon, type SFSymbol } from '../../src/recreation/ui/icons';
import { ptOf } from './support';

test('every table entry renders its Phosphor glyph at the pinned size', () => {
  const expected: Record<string, [string, number, boolean?]> = {
    'location@18': ['NavigationArrow:regular', 21, true], 'location.fill@18': ['NavigationArrow:fill', 21, true], 'location@12': ['NavigationArrow:regular', 14, true],
    'flag@18': ['Flag:regular', 21.5], 'flag.fill@18': ['Flag:fill', 21.5], 'checkmark@22': ['Check:bold', 23.5],
    'checkmark@13': ['Check:bold', 14], 'xmark@11': ['X:bold', 15], 'xmark.circle.fill@13': ['XCircle:fill', 16],
    'chevron.down@13': ['CaretDown:bold', 15.5], 'chevron.down@9': ['CaretDown:bold', 12],
    'chevron.left@11': ['CaretLeft:bold', 13.5], 'chevron.right@11': ['CaretRight:bold', 13.5],
    'calendar@12': ['CalendarDots:regular', 13.5], 'calendar@13': ['CalendarDots:regular', 14.5],
    'keyboard@12': ['Keyboard:regular', 16], 'exclamationmark.triangle.fill@12': ['Warning:fill', 14.5],
    'clock@13': ['Clock:regular', 17], 'clock@11': ['Clock:regular', 14.5], 'moon@13': ['Moon:regular', 16],
    'sunrise@13': ['SunHorizon:regular', 17], 'sofa@13': ['Armchair:regular', 16.5], 'calendar.badge.plus@13': ['CalendarPlus:regular', 16],
  };
  expect(Object.keys(GLYPHS).sort()).toEqual(Object.keys(expected).sort());
  for (const [key, [phosphor, size, mirrored]] of Object.entries(expected)) {
    const [name, pt] = key.split('@');
    const { container, unmount } = render(<SFIcon name={name as SFSymbol} pointSize={Number(pt)} />);
    const el = container.querySelector(`[data-sf="${key}"]`) as HTMLElement;
    expect(el.dataset.phosphor).toBe(phosphor);
    expect(ptOf(el.style.width)).toBe(size);
    expect(ptOf(el.style.height)).toBe(size);
    expect(el.style.transform).toBe(mirrored ? 'scaleX(-1)' : '');
    expect(el.getAttribute('aria-hidden')).toBe('true');
    unmount();
  }
});

test('an unlisted size is a programming error', () => {
  const log = vi.spyOn(console, 'error').mockImplementation(() => {});
  const swallow = (e: ErrorEvent) => e.preventDefault();
  window.addEventListener('error', swallow);
  expect(() => render(<SFIcon name="flag" pointSize={17} />)).toThrow(/flag@17/);
  window.removeEventListener('error', swallow);
  log.mockRestore();
});

test('calendar.badge.clock is the CalendarDots + Clock composite with a knockout', () => {
  const { container } = render(<SFIcon name="calendar.badge.clock" pointSize={18} />);
  const root = container.querySelector('[data-sf="calendar.badge.clock@18"]') as SVGElement;
  expect(root.dataset.phosphor).toBe('CalendarDots+Clock:regular');
  expect(ptOf(root.style.width)).toBe(21.75);
  expect(ptOf(root.style.height)).toBe(18.88);
  expect(root.querySelector('mask circle')!.getAttribute('r')).toBe('6.78125');
  const small = render(<CalendarClockIcon pointSize={12} />).container.firstElementChild as SVGElement;
  expect(ptOf(small.style.width)).toBeCloseTo(14.5, 3);
  expect(small.querySelector('mask circle')!.getAttribute('r')).toBe(String(6.78125 * 12 / 18));
});
