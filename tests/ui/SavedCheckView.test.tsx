// @vitest-environment jsdom
import './setup';
import { render, screen } from '@testing-library/react';
import { SavedCheckView, checkmarkPath, badgeTimeline } from '../../src/recreation/ui/SavedCheckView';
import { MotionPrefsProvider } from '../../src/recreation/ui/motionPrefs';
import { ptOf } from './support';

type SpringTiming = { stiffness: number; damping: number; delay: number };
test('CheckmarkShape geometry', () => {
  expect(checkmarkPath(11.04, 11.04)).toBe('M0 6.072 L4.195 10.157 L11.04 1.325');
});
test('badge: 24 pt accent disc, 2.64 pt white tick inset 6.48', () => {
  render(<SavedCheckView visible />);
  const badge = screen.getByRole('img', { name: 'Saved' });
  expect([ptOf(badge.style.width), ptOf(badge.style.height), badge.style.background, badge.style.borderRadius]).toEqual([24, 24, 'var(--qr-list-accent)', '50%']);
  const svg = badge.querySelector('svg') as SVGSVGElement;
  expect([ptOf(svg.style.left), ptOf(svg.style.top), ptOf(svg.style.width)]).toEqual([6.48, 6.48, 11.04]);
  const path = svg.querySelector('path')!;
  expect([path.getAttribute('stroke'), path.getAttribute('stroke-width'), path.getAttribute('stroke-linecap'), path.getAttribute('stroke-linejoin')])
    .toEqual(['#FFFFFF', '2.64', 'round', 'round']);
});
test('timeline: trim after the flight, pop, settle', () => {
  const t = badgeTimeline(false, 1)!;
  expect(t.tick).toEqual({ type: 'tween', ease: [0, 0, 0.58, 1], duration: 0.28, delay: 0.32 });
  expect((t.up as SpringTiming).stiffness).toBeCloseTo(503.55, 2);
  expect((t.up as SpringTiming).delay).toBe(0.55);
  expect(t.up.to).toBe(1.18);
  expect((t.settle as SpringTiming).damping).toBeCloseTo(29.322, 3);
  expect((t.settle as SpringTiming).delay).toBe(0.72);
  expect(badgeTimeline(true, 1)).toBeNull();
});
test('reduce motion: the tick is simply there', () => {
  render(<MotionPrefsProvider value={{ reduceMotion: true, timeScale: 1 }}><SavedCheckView visible /></MotionPrefsProvider>);
  expect(screen.getByRole('img', { name: 'Saved' }).dataset.progress).toBe('1');
});
