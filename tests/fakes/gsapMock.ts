import { vi, type Mock } from 'vitest';

/** Module shape of src/app/gsap.ts for vi.mock('.../app/gsap'). */
export type ScrollTriggerVars = Record<string, unknown>;

export const gsap: { registerPlugin: Mock; globalTimeline: { timeScale: Mock } } = {
  registerPlugin: vi.fn(),
  globalTimeline: { timeScale: vi.fn() },
};

export const ScrollTrigger: {
  create: Mock<(vars: ScrollTriggerVars) => { kill: Mock; progress: number }>;
  refresh: Mock;
  getAll: Mock;
} = {
  create: vi.fn<(vars: ScrollTriggerVars) => { kill: Mock; progress: number }>(() => ({ kill: vi.fn(), progress: 0 })),
  refresh: vi.fn(),
  getAll: vi.fn(() => []),
};
