// The stage (landing §7 Mobile, §7.2, §11.1): the fake desktop inside the MacBook frame under a scroll-scrubbed
// camera. The stage is sticky on both layouts and one GSAP ScrollTrigger scrubs the camera along the runway:
// ≥ 810 px a full-height stage over a 160svh runway, hero → overview → notch crop; below 810 px a 56svh band
// pinned above the copy over a 100svh runway, hero → notch. The hero title sits inside the stage on both
// (the subtitle on desktop only: on phones it would not fit the title reserve).
// Per-frame writes go straight to the DOM (no React render); React owns the layout only.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type JSX,
  type ReactNode,
  type RefObject,
} from 'react';
import { DesktopScene } from '../desktop/DesktopScene';
import type { FakeCursorHandle } from '../desktop/fakeCursor';
import { useColorScheme, useMediaQuery } from '../desktop/useMediaQuery';
import type { RecreationHandle } from '../recreation';
import { AppClock, type Clock } from '../recreation/clock';
import { currentCalendar, type Calendar } from '../recreation/core/calendar';
import { ScrollTrigger } from './gsap';
import { MacBookFrame } from './MacBookFrame';
import { MOTION_TIME_SCALE } from './motionDebug';
import {
  CAMERA,
  cameraFor,
  cameraTransform,
  clipFor,
  phoneTitleOpacityFor,
  pinnedColumnWidth,
  renderPtFor,
  runwayVhFor,
  titleOpacityFor,
  type Viewport,
  useIsDesktop,
} from './stageCamera';

export interface StageContextValue {
  recreationRef: RefObject<RecreationHandle | null>;
  cursorRef: RefObject<FakeCursorHandle | null>;
  clock: Clock;
  calendar: Calendar;
}

export interface StageProps {
  title: string;
  subtitle: string;
  /** The features column. */
  children?: ReactNode;
}

const StageContext = createContext<StageContextValue | null>(null);

export function useStage(): StageContextValue {
  const value = useContext(StageContext);
  if (!value) throw new Error('useStage() must be called inside <Stage>');
  return value;
}

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
const PHONE_STAGE_HEIGHT = `${CAMERA.phoneStageSvh}svh`;
const PINNED_COLUMN_PERCENT = Math.round(CAMERA.pinnedColumnRatio * 100);
const PINNED_COLUMN = `${PINNED_COLUMN_PERCENT}%`;
const FEATURES_COLUMN = `${100 - PINNED_COLUMN_PERCENT}%`;
/** The hero letterbox is black; the page white reveals with the camera (landing §7.2). */
const STAGE_BACKGROUND = 'var(--jh-white)';

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));

function readViewport(): Viewport {
  return { width: window.innerWidth, height: window.innerHeight };
}

/** Scroll progress along the runway, used before the ScrollTrigger exists (first paint). */
function progressFromScroll(viewport: Viewport): number {
  return clamp01(window.scrollY / ((runwayVhFor(viewport) / 100) * viewport.height));
}

/** Reduced motion: no zoom motion, the camera snaps at half progress. */
function cameraProgressFor(progress: number, reduced: boolean): number {
  if (!reduced) return progress;
  return progress < 0.5 ? 0 : 1;
}

export function Stage({ title, subtitle, children }: StageProps): JSX.Element {
  const [context] = useState<StageContextValue>(() => ({
    recreationRef: { current: null },
    cursorRef: { current: null },
    clock: AppClock.now,
    calendar: currentCalendar(),
  }));
  const [viewport, setViewport] = useState<Viewport>(readViewport);
  const isDesktop = useIsDesktop();
  const reduced = useMediaQuery(REDUCED_MOTION_QUERY);
  const scheme = useColorScheme('auto');

  const column = pinnedColumnWidth(viewport);
  const renderPt = renderPtFor(viewport, column);

  const stageRef = useRef<HTMLDivElement>(null);
  const clipRef = useRef<HTMLDivElement>(null);
  const cameraRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<SVGSVGElement>(null);
  const runwayRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const subtitleRef = useRef<HTMLParagraphElement>(null);

  const writeFrame = useCallback(
    (progress: number) => {
      const p = clamp01(progress);
      const cameraProgress = cameraProgressFor(p, reduced);
      const camera = cameraFor(cameraProgress, viewport, column);
      if (cameraRef.current) cameraRef.current.style.transform = cameraTransform(camera, renderPt);
      if (clipRef.current) clipRef.current.style.clipPath = `inset(0px ${clipFor(cameraProgress, viewport, column).right}px 0px 0px)`;
      const titleOpacity = String(isDesktop ? titleOpacityFor(p) : phoneTitleOpacityFor(p));
      if (titleRef.current) titleRef.current.style.opacity = titleOpacity;
      if (subtitleRef.current) subtitleRef.current.style.opacity = titleOpacity;
    },
    [viewport, column, renderPt, reduced, isDesktop],
  );

  // The ScrollTrigger is created once per layout; it always calls the latest writer.
  const writeFrameRef = useRef(writeFrame);

  // Before paint: the camera for the current scroll position (no layout shift on load or resize).
  useLayoutEffect(() => {
    writeFrameRef.current = writeFrame;
    writeFrame(progressFromScroll(viewport));
  }, [writeFrame, viewport]);

  // Viewport updates, one per animation frame.
  useEffect(() => {
    let frame = 0;
    const onResize = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        setViewport(readViewport());
      });
    };
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  // One scrubbed trigger on the runway, re-created when the layout flips and killed when the stage unmounts.
  useEffect(() => {
    const runway = runwayRef.current;
    if (!runway) return;
    const trigger = ScrollTrigger.create({
      trigger: runway,
      start: 'top top',
      end: 'bottom top',
      scrub: true,
      invalidateOnRefresh: true,
      onUpdate: (self) => writeFrameRef.current(self.progress),
    });
    return () => trigger.kill();
  }, [isDesktop]);

  // Crossing the breakpoint changes the stage and runway heights: re-measure every trigger on the page (review focus R3).
  const layoutRef = useRef(isDesktop);
  useEffect(() => {
    if (layoutRef.current === isDesktop) return;
    layoutRef.current = isDesktop;
    ScrollTrigger.refresh();
  }, [isDesktop]);

  const stageStyle: CSSProperties = isDesktop
    ? { position: 'sticky', top: 0, height: '100svh' }
    : { position: 'sticky', top: 0, height: PHONE_STAGE_HEIGHT, zIndex: 20 };
  const titleBlockStyle: CSSProperties = isDesktop
    ? { position: 'absolute', insetInline: 0, bottom: '7svh', textAlign: 'center', pointerEvents: 'none' }
    : { position: 'absolute', insetInline: 0, bottom: '16px', padding: '0 var(--jh-page-margin-x)', textAlign: 'center', pointerEvents: 'none' };

  const heroTitle = (
    <>
      <h1
        ref={titleRef}
        data-hero-title=""
        style={{
          margin: 0,
          fontSize: isDesktop ? 'var(--jh-text-h2)' : 'var(--jh-text-h3)',
          fontWeight: 600,
          lineHeight: 'var(--jh-leading-heading)',
          color: 'var(--jh-fg)',
          opacity: isDesktop ? 0 : 1,
        }}
      >
        {title}
      </h1>
      {/* Phones show the title only: with the subtitle the block outgrows the 96 px reserve and
          paints over the keyboard deck; the band's tap hint carries the subtitle's call to action. */}
      {isDesktop && (
        <p
          ref={subtitleRef}
          style={{
            margin: 'var(--jh-space-8) 0 0',
            fontSize: 'var(--jh-text-body-l)',
            fontWeight: 500,
            lineHeight: 'var(--jh-leading-body)',
            color: 'var(--jh-muted)',
            opacity: 0,
          }}
        >
          {subtitle}
        </p>
      )}
    </>
  );

  return (
    <StageContext.Provider value={context}>
      <div data-stage-track="" style={{ position: 'relative' }}>
        <div
          ref={stageRef}
          data-stage=""
          style={{ ...stageStyle, overflow: 'hidden', backgroundColor: STAGE_BACKGROUND }}
        >
          <div ref={clipRef} data-clip="" style={{ position: 'absolute', inset: 0 }}>
            <div
              ref={cameraRef}
              data-camera=""
              // `--pt` here is for the MacBookFrame; the DesktopScene sets the same value on its own root.
              style={{ position: 'absolute', left: 0, top: 0, transformOrigin: '0 0', willChange: 'transform', '--pt': String(renderPt) } as CSSProperties}
            >
              <MacBookFrame ref={frameRef} drawIn={1} scheme={scheme} />
              <DesktopScene
                recreationRef={context.recreationRef}
                cursorRef={context.cursorRef}
                pt={renderPt}
                clock={context.clock}
                calendar={context.calendar}
                timeScale={MOTION_TIME_SCALE}
              />
            </div>
          </div>
          <div style={titleBlockStyle}>{heroTitle}</div>
        </div>
        <div
          ref={runwayRef}
          data-runway=""
          style={{
            height: `${runwayVhFor(viewport)}svh`,
            marginTop: isDesktop ? '-100svh' : `-${PHONE_STAGE_HEIGHT}`,
            pointerEvents: 'none',
          }}
        />
        <div
          data-features-column=""
          style={isDesktop ? { marginLeft: PINNED_COLUMN, width: FEATURES_COLUMN, position: 'relative', zIndex: 10 } : { position: 'relative', zIndex: 10 }}
        >
          {children}
        </div>
      </div>
    </StageContext.Provider>
  );
}
