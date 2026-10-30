// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react';
import { ScrollTrigger } from '../../src/app/gsap';
import { Stage, useStage, type StageContextValue } from '../../src/app/Stage';
import { cameraFor, cameraTransform, renderPtFor } from '../../src/app/stageCamera';
import { installMatchMedia } from '../fakes/matchMedia';
import { lastRecreation } from '../fakes/recreationMock';

vi.mock('../../src/app/gsap', () => import('../fakes/gsapMock'));
vi.mock('../../src/recreation', () => import('../fakes/recreationMock'));

const DESKTOP = '(min-width: 810px)';
const REDUCED = '(prefers-reduced-motion: reduce)';
const V1440 = { width: 1440, height: 900 };
const V390 = { width: 390, height: 844 };

let rafQueue: FrameRequestCallback[] = [];
function runRaf() {
  const callbacks = rafQueue;
  rafQueue = [];
  act(() => {
    for (const cb of callbacks) cb(performance.now());
  });
}

function innerSize(width: number, height: number) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: width });
  Object.defineProperty(window, 'innerHeight', { configurable: true, writable: true, value: height });
}

function resize(width: number, height: number) {
  innerSize(width, height);
  act(() => {
    window.dispatchEvent(new Event('resize'));
  });
  runRaf();
}

beforeEach(() => {
  vi.clearAllMocks();
  rafQueue = [];
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => rafQueue.push(cb));
  vi.stubGlobal('cancelAnimationFrame', () => {});
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const el = <T extends HTMLElement = HTMLElement>(selector: string) => document.querySelector<T>(selector)!;

function mountDesktop(matches: Record<string, boolean> = {}) {
  const mm = installMatchMedia({ [DESKTOP]: true, ...matches });
  innerSize(V1440.width, V1440.height);
  render(
    <Stage title="T" subtitle="S">
      <p>copy</p>
    </Stage>,
  );
  return mm;
}

function mountPhone(matches: Record<string, boolean> = {}) {
  const mm = installMatchMedia({ [DESKTOP]: false, ...matches });
  innerSize(V390.width, V390.height);
  render(
    <Stage title="T" subtitle="S">
      <p>copy</p>
    </Stage>,
  );
  return mm;
}

/** The vars and the trigger object of the n-th ScrollTrigger.create call (the gsap mock). */
function createdTrigger(index = 0) {
  const create = vi.mocked(ScrollTrigger.create);
  return {
    vars: create.mock.calls[index]![0] as { onUpdate?(self: { progress: number }): void },
    trigger: create.mock.results[index]!.value as { kill: ReturnType<typeof vi.fn> },
  };
}

function onUpdate(progress: number) {
  act(() => {
    createdTrigger().vars.onUpdate!({ progress });
  });
}

it('≥ 810 px: sticky full-height stage, 160svh runway that ignores the pointer, 58 % column', () => {
  mountDesktop();
  const stage = el('[data-stage]');
  expect(stage.style.position).toBe('sticky');
  expect(stage.style.top).toBe('0px');
  expect(stage.style.height).toBe('100svh');
  const runway = el('[data-runway]');
  expect(runway.style.height).toBe('160svh');
  expect(runway.style.marginTop).toBe('-100svh');
  expect(runway.style.pointerEvents).toBe('none');
  const col = el('[data-features-column]');
  expect(col.style.marginLeft).toBe('58%');
  expect(col.style.width).toBe('42%');
  expect(col.textContent).toBe('copy');
  expect(el('[data-stage-track]').contains(stage)).toBe(true);
  expect(el('[data-stage] > [data-clip] > [data-camera]')).toBeTruthy();
});

it('applies the hero camera before paint (no layout shift)', () => {
  mountDesktop();
  const camera = el('[data-camera]');
  expect(camera.style.transform).toBe('translate3d(151.94px, 61.53px, 0) scale(0.75140)');
  expect(camera.style.transformOrigin).toBe('0 0');
  expect(el('[data-rim]').getAttribute('stroke-dashoffset')).toBe('0'); // the frame is drawn from the start
  expect(el('[data-clip]').style.clipPath).toBe('inset(0px 0px 0px 0px)');
});

it('renders the desktop at renderPt', () => {
  mountDesktop();
  expect(lastRecreation.props!.sceneScale).toBe(1);
  expect(screen.getByRole('application').style.getPropertyValue('--pt')).toBe('1');
  expect(el('[data-camera]').style.getPropertyValue('--pt')).toBe('1'); // the MacBookFrame scales with the scene
});

it('creates one scrubbed ScrollTrigger on the runway', () => {
  mountDesktop();
  expect(ScrollTrigger.create).toHaveBeenCalledTimes(1);
  expect(ScrollTrigger.create).toHaveBeenCalledWith(
    expect.objectContaining({
      trigger: el('[data-runway]'),
      start: 'top top',
      end: 'bottom top',
      scrub: true,
      onUpdate: expect.any(Function),
    }),
  );
  onUpdate(1);
  expect(el('[data-camera]').style.transform).toBe('translate3d(-338.50px, 64.00px, 0) scale(1.00000)');
  expect(el('[data-clip]').style.clipPath).toBe('inset(0px 605px 0px 0px)');
  expect(el('[data-hero-title]').style.opacity).toBe('0');
  expect(el('[data-rim]').getAttribute('stroke-dashoffset')).toBe('0');
});

it('reduced motion snaps the camera at half progress but fades the title by raw progress', () => {
  mountDesktop({ [REDUCED]: true });
  onUpdate(0.45);
  expect(el('[data-camera]').style.transform).toBe(cameraTransform(cameraFor(0, V1440, 835), 1));
  onUpdate(0.6);
  expect(el('[data-camera]').style.transform).toBe(cameraTransform(cameraFor(1, V1440, 835), 1));
  expect(el('[data-hero-title]').style.opacity).toBe('1');
});

it('phones pin a 56 svh band (in px from the small viewport) above the copy', () => {
  mountPhone();
  const stage = el('[data-stage]');
  expect(stage.style.position).toBe('sticky');
  expect(stage.style.top).toBe('0px');
  expect(stage.style.height).toBe('472.64px');
  expect(stage.style.zIndex).toBe('20');
  expect(stage.style.overflow).toBe('hidden');
  expect(el('[data-runway]').style.height).toBe('844px');
  expect(el('[data-runway]').style.marginTop).toBe('-472.64px');
  expect(el('[data-features-column]').style.marginLeft).toBe('');
  expect(el('[data-features-column]').style.zIndex).toBe('10');
  // The lead above the first section: its 'top 78%' trigger fires once the zoom has finished (runway end).
  expect(el('[data-features-column]').style.paddingTop).toBe('658.32px');
});

it('phones apply the hero camera before paint and keep the title inside the band', () => {
  mountPhone();
  expect(el('[data-camera]').style.transform).toBe(cameraTransform(cameraFor(0, V390, 390), renderPtFor(V390, 390)));
  expect(el('[data-stage]').contains(el('[data-hero-title]'))).toBe(true);
  expect(el('[data-hero-title]').style.opacity).toBe('1');
});

it('phones show only the title in the band: the subtitle would paint over the deck', () => {
  mountPhone();
  expect(screen.getByRole('heading', { level: 1, name: 'T' })).toBeTruthy();
  expect(screen.queryByText('S')).toBeNull();
});

it('phones scrub the camera to the notch and fade the title', () => {
  mountPhone();
  expect(ScrollTrigger.create).toHaveBeenCalledTimes(1);
  expect(ScrollTrigger.create).toHaveBeenCalledWith(
    expect.objectContaining({ trigger: el('[data-runway]'), start: 'top top', end: 'bottom top', scrub: true }),
  );
  onUpdate(1);
  expect(el('[data-camera]').style.transform).toBe(cameraTransform(cameraFor(1, V390, 390), renderPtFor(V390, 390)));
  expect(el('[data-hero-title]').style.opacity).toBe('0');
  expect(el('[data-clip]').style.clipPath).toBe('inset(0px 0px 0px 0px)');
});

it('reduced motion on phones snaps the camera at half progress but fades the title by raw progress', () => {
  mountPhone({ [REDUCED]: true });
  onUpdate(0.4);
  expect(el('[data-camera]').style.transform).toBe(cameraTransform(cameraFor(0, V390, 390), renderPtFor(V390, 390)));
  expect(el('[data-hero-title]').style.opacity).toBe('0.19999999999999996'); // 1 − 0.4 / 0.5, as String(number)
});

it('the hero title is an h1 with the given copy', () => {
  mountDesktop();
  const h1 = screen.getByRole('heading', { level: 1, name: 'T' });
  expect(h1.hasAttribute('data-hero-title')).toBe(true);
  expect(screen.getByText('S')).toBeTruthy();
});

it('useStage exposes the refs to children', () => {
  let seen: StageContextValue | null = null;
  function Child() {
    seen = useStage();
    return null;
  }
  installMatchMedia({ [DESKTOP]: true });
  innerSize(V1440.width, V1440.height);
  render(
    <Stage title="T" subtitle="S">
      <Child />
    </Stage>,
  );
  expect(seen!.recreationRef.current).toBe(lastRecreation.handle);
  expect(seen!.cursorRef.current).not.toBeNull();
  expect(seen!.clock()).toBeInstanceOf(Date);
  expect(seen!.calendar.locale).toBe('en-US');
});

it('useStage throws outside <Stage>', () => {
  function Orphan() {
    useStage();
    return null;
  }
  // React dev rethrows the render error through a window error event and logs it; keep the output clean.
  const swallow = (e: Event) => e.preventDefault();
  window.addEventListener('error', swallow);
  const error = vi.spyOn(console, 'error').mockImplementation(() => {});
  expect(() => render(<Orphan />)).toThrow(/useStage/);
  error.mockRestore();
  window.removeEventListener('error', swallow);
});

it('review focus: crossing 810 px re-creates the trigger, recomputes --pt and refreshes ScrollTrigger', () => {
  const mm = mountDesktop();
  expect(ScrollTrigger.create).toHaveBeenCalledTimes(1);
  const { trigger } = createdTrigger();

  act(() => mm.set(DESKTOP, false));
  resize(390, 844);
  expect(trigger.kill).toHaveBeenCalledTimes(1);
  expect(ScrollTrigger.create).toHaveBeenCalledTimes(2);
  expect(ScrollTrigger.refresh).toHaveBeenCalled();
  const stage = el('[data-stage]');
  expect(stage.style.position).toBe('sticky');
  expect(stage.style.height).toBe('472.64px');
  expect(el('[data-runway]').style.height).toBe('844px');
  expect(screen.getByRole('application').style.getPropertyValue('--pt')).toBe(String(renderPtFor(V390, 390)));
  expect(el('[data-camera]').style.transform).toBe(cameraTransform(cameraFor(0, V390, 390), renderPtFor(V390, 390)));

  act(() => mm.set(DESKTOP, true));
  resize(1440, 900);
  expect(ScrollTrigger.create).toHaveBeenCalledTimes(3);
  expect(createdTrigger(1).trigger.kill).toHaveBeenCalledTimes(1);
  expect(el('[data-stage]').style.height).toBe('100svh');
  expect(el('[data-runway]').style.height).toBe('160svh');
  expect(screen.getByRole('application').style.getPropertyValue('--pt')).toBe('1');
});

it('the runway follows the layout query at once, before the viewport catches up one frame later', () => {
  const mm = mountDesktop();
  act(() => mm.set(DESKTOP, false));
  // No resize frame yet (still 1440 × 900): the band, the runway and the camera already agree on the phone layout.
  expect(el('[data-stage]').style.height).toBe('504px');
  expect(el('[data-runway]').style.height).toBe('900px');
  expect(el('[data-runway]').style.marginTop).toBe('-504px');
  const phoneAt1440 = { width: 1440, height: 900, phone: true };
  expect(el('[data-camera]').style.transform).toBe(cameraTransform(cameraFor(0, phoneAt1440, 1440), renderPtFor(phoneAt1440, 1440)));
});

it('the camera reads the small viewport (100 svh), not the dynamic innerHeight', () => {
  const SVH = 844;
  const rect = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    const height = this.style.position === 'fixed' && this.style.height === '100svh' ? SVH : 0;
    return { x: 0, y: 0, top: 0, left: 0, right: 0, bottom: height, width: 0, height, toJSON: () => ({}) } as DOMRect;
  });
  const expected = cameraTransform(cameraFor(0, V390, 390), renderPtFor(V390, 390));
  installMatchMedia({ [DESKTOP]: false });
  innerSize(390, 934); // iOS Safari with the toolbars retracted
  render(
    <Stage title="T" subtitle="S">
      <p>copy</p>
    </Stage>,
  );
  expect(el('[data-camera]').style.transform).toBe(expected);
  resize(390, 754); // toolbars back: innerHeight shrinks, the small viewport does not
  expect(el('[data-camera]').style.transform).toBe(expected);
  expect(document.querySelectorAll('body > div[style*="100svh"]')).toHaveLength(0);
  rect.mockRestore();
});
