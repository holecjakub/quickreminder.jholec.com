// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react';
import { ScrollTrigger as RealScrollTrigger } from '../../src/app/gsap';
import type { ScrollTrigger as MockScrollTrigger } from '../fakes/gsapMock';
import { LINKS, Nav, navPosition } from '../../src/app/Nav';
import { ScrollProgress, progressTransform } from '../../src/app/ScrollProgress';

vi.mock('../../src/app/gsap', () => import('../fakes/gsapMock'));
const ScrollTrigger = RealScrollTrigger as unknown as typeof MockScrollTrigger;

function setViewport(width: number, height: number, scrollY = 0) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: width });
  Object.defineProperty(window, 'innerHeight', { configurable: true, writable: true, value: height });
  Object.defineProperty(window, 'scrollY', { configurable: true, writable: true, value: scrollY });
}

beforeEach(() => {
  vi.clearAllMocks();
  setViewport(1440, 900);
});
afterEach(cleanup);

it('progressTransform', () => {
  expect(progressTransform(0.5)).toBe('scaleX(0.5)');
  expect(progressTransform(1.2)).toBe('scaleX(1)');
  expect(progressTransform(-1)).toBe('scaleX(0)');
});

it('ScrollProgress is a 2 px decorative bar driven by a page-long ScrollTrigger', () => {
  const { container } = render(<ScrollProgress />);
  const bar = container.firstElementChild as HTMLElement;
  expect(bar.getAttribute('aria-hidden')).toBe('true');
  expect(bar.style.height).toBe('var(--jh-progress-height)');
  expect(bar.style.transformOrigin).toMatch(/^(0 50%|left)/);
  expect(ScrollTrigger.create).toHaveBeenCalledWith(expect.objectContaining({ start: 0, end: 'max' }));
  const vars = ScrollTrigger.create.mock.calls[0]![0] as { onUpdate: (self: { progress: number }) => void };
  act(() => vars.onUpdate({ progress: 0.25 }));
  expect(bar.style.transform).toBe('scaleX(0.25)');
});

it('ScrollProgress kills its trigger on unmount', () => {
  const { unmount } = render(<ScrollProgress />);
  const trigger = ScrollTrigger.create.mock.results[0]!.value as { kill: ReturnType<typeof vi.fn> };
  unmount();
  expect(trigger.kill).toHaveBeenCalledTimes(1);
});

it('navPosition 1920 × 1080', () => {
  const p = navPosition({ width: 1920, height: 1080 });
  expect(p.top).toBeCloseTo(111.499, 3);
  expect(p.right).toBeCloseTo(280.763, 3);
});

it('navPosition 1440 × 900', () => {
  const p = navPosition({ width: 1440, height: 900 });
  expect(p.top).toBeCloseTo(102.079, 3);
  expect(p.right).toBeCloseTo(167.940, 3);
});

it('navPosition phone', () => expect(navPosition({ width: 390, height: 844 })).toEqual({ top: 12, right: 16 }));

it('Nav links', () => {
  render(<Nav />);
  expect(screen.getByRole('navigation', { name: 'Primary' })).toBeTruthy();
  expect(screen.getByRole('link', { name: 'GitHub' }).getAttribute('href')).toBe(LINKS.appRepo);
  expect(screen.getByRole('link', { name: 'Download' }).getAttribute('href')).toBe('#download');
});

it('Nav hides once the page is scrolled past 0.6 viewport heights', () => {
  render(<Nav />);
  const nav = screen.getByRole('navigation', { name: 'Primary' });
  expect(nav.getAttribute('data-hidden')).toBe('false');
  expect(nav.getAttribute('aria-hidden')).toBeNull();
  setViewport(1440, 900, 541);
  act(() => {
    window.dispatchEvent(new Event('scroll'));
  });
  expect(nav.getAttribute('data-hidden')).toBe('true');
  expect(nav.style.pointerEvents).toBe('none');
  expect(nav.style.opacity).toBe('0');
  expect(nav.getAttribute('aria-hidden')).toBe('true');
  expect(nav.style.visibility).toBe('hidden');
  expect(screen.queryByRole('navigation', { name: 'Primary' })).toBeNull();
  for (const link of screen.getAllByRole('link', { hidden: true })) expect(link.tabIndex).toBe(-1);
});
