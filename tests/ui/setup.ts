// Shared jsdom setup for the recreation UI tests: jest-dom matchers, motion animations that land on
// their target at once, a controllable `prefers-reduced-motion` media query, and per-test cleanup.
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { MotionGlobalConfig } from 'motion/react';

MotionGlobalConfig.skipAnimations = true;

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
let reducedMotionQuery = false;

/** Sets what `matchMedia('(prefers-reduced-motion: reduce)').matches` reports for queries created afterwards. */
export function setPrefersReducedMotion(v: boolean): void {
  reducedMotionQuery = v;
}

window.matchMedia = (query: string): MediaQueryList => ({
  matches: query === REDUCED_MOTION_QUERY && reducedMotionQuery,
  media: query,
  onchange: null,
  addEventListener: () => {},
  removeEventListener: () => {},
  addListener: () => {},
  removeListener: () => {},
  dispatchEvent: () => false,
});

Element.prototype.scrollIntoView = vi.fn();

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
