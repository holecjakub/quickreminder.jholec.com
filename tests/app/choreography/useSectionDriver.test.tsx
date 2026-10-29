// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react';
import { useCallback, useEffect, type RefObject } from 'react';
import { SECTION_SNAPSHOTS } from '../../../src/app/choreography/demo';
import { reconcile, type ReconcileResult } from '../../../src/app/choreography/reconcile';
import type { SectionId } from '../../../src/app/choreography/snapshot';
import { useSectionDriver } from '../../../src/app/choreography/useSectionDriver';
import { ScrollTrigger } from '../../../src/app/gsap';
import type { FakeCursorHandle } from '../../../src/desktop/fakeCursor';
import type { RecreationHandle } from '../../../src/recreation';
import { pragueCalendar } from '../../../src/recreation/core/calendar';
import { FakeRecreationHandle } from '../../fakes/fakeRecreationHandle';
import { installMatchMedia } from '../../fakes/matchMedia';

vi.mock('../../../src/app/gsap', () => import('../../fakes/gsapMock'));
vi.mock('../../../src/app/choreography/reconcile', () => ({
  reconcile: vi.fn(async () => ({ performed: 'none', keptVisitorEdits: false, aborted: false })),
}));

const REDUCED = '(prefers-reduced-motion: reduce)';
const NOW = new Date('2026-10-23T08:00:00Z');
const clockNow = () => NOW;

type Vars = { trigger: HTMLElement; start: string; onEnter(): void; onLeaveBack(): void };
const create = vi.mocked(ScrollTrigger.create);
const reconcileMock = vi.mocked(reconcile);
const vars = (i: number) => create.mock.calls[i]![0] as unknown as Vars;

let fake: FakeRecreationHandle;
let handleRef: RefObject<RecreationHandle | null>;
let cursorRef: RefObject<FakeCursorHandle | null>;
const driver = { current: 'hero' as SectionId };
let tops: Partial<Record<SectionId, number>>;

function Harness({ enabled = true }: { enabled?: boolean }) {
  const { register, current } = useSectionDriver({ handle: handleRef, cursor: cursorRef, clock: clockNow, calendar: pragueCalendar, enabled });
  useEffect(() => {
    driver.current = current;
  }, [current]);
  const ref01 = useCallback((el: HTMLElement | null) => register('01', withTop('01', el)), [register]);
  const ref02 = useCallback((el: HTMLElement | null) => register('02', withTop('02', el)), [register]);
  return (
    <>
      <section ref={ref01} />
      <section ref={ref02} />
    </>
  );
}

function withTop(id: SectionId, el: HTMLElement | null): HTMLElement | null {
  if (el) el.getBoundingClientRect = () => ({ top: tops[id] ?? 2000 }) as DOMRect;
  return el;
}

async function mount(enabled = true) {
  const view = render(<Harness enabled={enabled} />);
  await act(async () => {});
  return view;
}

beforeEach(() => {
  vi.clearAllMocks();
  installMatchMedia({});
  Object.defineProperty(window, 'innerHeight', { configurable: true, writable: true, value: 900 });
  fake = new FakeRecreationHandle({ now: NOW });
  handleRef = { current: fake };
  cursorRef = { current: { cancel: vi.fn() } as unknown as FakeCursorHandle };
  tops = {};
  driver.current = 'hero';
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

it('one ScrollTrigger per registered section at "top center"', async () => {
  const view = await mount();
  expect(create).toHaveBeenCalledTimes(2);
  const sections = view.container.querySelectorAll('section');
  expect(vars(0)).toEqual({ trigger: sections[0], start: 'top center', onEnter: expect.any(Function), onLeaveBack: expect.any(Function) });
  expect(vars(1).trigger).toBe(sections[1]);
});
it('onEnter reconciles the section downward, without focus, at 18 cps with the cursor', async () => {
  await mount();
  act(() => vars(1).onEnter());
  expect(reconcileMock).toHaveBeenCalledWith(fake, SECTION_SNAPSHOTS['02'], expect.objectContaining({
    now: NOW, calendar: pragueCalendar, direction: 'down', cps: 18, maxDurationMs: 2500, cursor: cursorRef.current,
  }));
  expect(driver.current).toBe('02');
});
it('onLeaveBack reconciles the previous snapshot upward', async () => {
  await mount();
  act(() => vars(0).onLeaveBack());
  expect(reconcileMock).toHaveBeenCalledWith(fake, SECTION_SNAPSHOTS.hero, expect.objectContaining({ direction: 'up' }));
  expect(driver.current).toBe('hero');
});
it('visitor interaction interrupts the running action', async () => {
  reconcileMock.mockImplementation(() => new Promise<ReconcileResult>(() => {}));
  await mount();
  act(() => vars(1).onEnter());
  expect(fake.methods()).not.toContain('cancel');
  act(() => fake.visitorEdit({ title: 'x' }));
  expect(fake.methods()).toContain('cancel');
  expect(cursorRef.current!.cancel).toHaveBeenCalled();
});
it('reduced motion runs instant (cps Infinity) without the cursor', async () => {
  installMatchMedia({ [REDUCED]: true });
  await mount();
  act(() => vars(1).onEnter());
  expect(reconcileMock).toHaveBeenCalledWith(fake, SECTION_SNAPSHOTS['02'], expect.objectContaining({ cps: Infinity, cursor: null }));
});
it('initial sync: the last section above the viewport middle runs once after mount', async () => {
  tops = { '01': -400, '02': 100 };
  await mount();
  expect(ScrollTrigger.refresh).toHaveBeenCalledTimes(1);
  expect(reconcileMock).toHaveBeenCalledTimes(1);
  expect(reconcileMock).toHaveBeenCalledWith(fake, SECTION_SNAPSHOTS['02'], expect.objectContaining({ direction: 'down' }));
  expect(driver.current).toBe('02');
});
it('initial sync does nothing when every section is below the viewport middle', async () => {
  await mount();
  expect(reconcileMock).not.toHaveBeenCalled();
  expect(driver.current).toBe('hero');
});
it('enabled false registers nothing', async () => {
  await mount(false);
  expect(create).not.toHaveBeenCalled();
});
it('kills its triggers on unmount', async () => {
  const view = await mount();
  const triggers = create.mock.results.map((r) => r.value as { kill: ReturnType<typeof vi.fn> });
  view.unmount();
  expect(triggers).toHaveLength(2);
  for (const t of triggers) expect(t.kill).toHaveBeenCalledTimes(1);
});
