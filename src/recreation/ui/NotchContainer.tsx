// Port of Views/NotchContainerView.swift with PanelController's click monitors: the black silhouette
// whose shape springs between the states, the open content (`QuickReminderView`) fading, un-blurring
// and scaling in behind it while masked to the live silhouette until the panel has settled, the
// saved badge in the right-hand extension of the collapsed pill, the list picker popover on top,
// and the click outside the black shape that collapses the panel.
import { LayoutGroup, animate, motion, useMotionValue, useTransform, type MotionValue, type Transition } from 'motion/react';
import { useEffect, useRef, type CSSProperties, type RefObject } from 'react';
import { NotchLayout, type Size } from '../machine/notchLayout';
import { currentSize, panelSize, radii, savedSize, tallestSectionSize, type NotchSizes } from '../machine/notchState';
import { Motion } from '../machine/springs';
import { ListPickerMenu } from './ListPickerMenu';
import { useMotionPrefs } from './motionPrefs';
import { NotchSilhouette, useNotchGeometry, useNotchPath, type ShapeTarget } from './NotchSilhouette';
import { QuickReminderView } from './QuickReminderView';
import { useCore, usePanel, useRecreationState } from './RecreationContext';
import { SavedCheckView } from './SavedCheckView';
import { INSTANT, effective, toTransition, type FlagAnimation } from './transitions';
import { px } from './units';

/** `NotchState.canvasSize` in notch style: sized for the tallest section (the calendar), never resized by one. */
export function canvasFor(sizes: NotchSizes): Size {
  return NotchLayout.openCanvasSize(sizes.openSize, tallestSectionSize(sizes));
}

/** `PanelController.perform`'s content animation: in with `effectiveContentIn`, out with
 *  `effectiveContentOut`, and the save always with `contentOutAnimation`; the content does not
 *  change for a section or hover change. */
export function contentTransition(animation: FlagAnimation, reduceMotion: boolean, timeScale: number): Transition {
  switch (animation) {
    case 'open':
      return effective('contentIn', reduceMotion, timeScale);
    case 'close':
      return effective('contentOut', reduceMotion, timeScale);
    case 'saving':
      return toTransition(Motion.contentOut, timeScale);
    case 'schedule':
    case 'hoverIn':
    case 'hoverOut':
    case 'none':
      return INSTANT;
  }
}

/** Top-left of the badge: its right edge `savedBadgeTrailingPadding` in from the pill's right edge,
 *  centred on the pill's height (Swift `.padding(.trailing, …)` in a trailing-aligned `savedSize` frame). */
export function badgeOrigin(sizes: NotchSizes, canvasWidth: number): { left: number; top: number } {
  const pill = savedSize(sizes);
  const right = canvasWidth / 2 + pill.width / 2 - NotchLayout.savedBadgeTrailingPadding;
  return { left: right - NotchLayout.savedBadgeSize, top: (pill.height - NotchLayout.savedBadgeSize) / 2 };
}

/** The hidden content: blurred 8 pt and scaled 0.94 from the top; under reduce motion only the opacity moves. */
const HIDDEN = { blur: 8, scale: 0.94 } as const;

interface ContentMotion {
  readonly opacity: MotionValue<number>;
  readonly filter: MotionValue<string>;
  readonly scale: MotionValue<number>;
}

/** Opacity, blur and scale of the content as motion values; a visibility change animates all three
 *  with the transition the flag change named (like `useNotchGeometry` does for the shape). */
function useContentMotion(visible: boolean, animation: FlagAnimation): ContentMotion {
  const { reduceMotion, timeScale } = useMotionPrefs();
  const opacityTarget = visible ? 1 : 0;
  const blurTarget = visible || reduceMotion ? 0 : HIDDEN.blur;
  const scaleTarget = visible || reduceMotion ? 1 : HIDDEN.scale;
  const opacity = useMotionValue(opacityTarget);
  const blur = useMotionValue(blurTarget);
  const scale = useMotionValue(scaleTarget);
  useEffect(() => {
    const transition = contentTransition(animation, reduceMotion, timeScale);
    const pairs = [[opacity, opacityTarget], [blur, blurTarget], [scale, scaleTarget]] as const;
    for (const [mv] of pairs) mv.stop();
    const controls = pairs.map(([mv, value]) => animate(mv, value, transition));
    return () => controls.forEach((c) => c.stop());
    // The animation and prefs only choose how the next target change moves, never trigger one.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opacity, blur, scale, opacityTarget, blurTarget, scaleTarget]);
  const filter = useTransform(blur, (b) => `blur(${px(b)})`);
  return { opacity, filter, scale };
}

const SHAPE_SELECTOR = '[data-qr-content], path[data-qr-target="notch"]';

/** The closed notch's hover region is the path plus the hit layer over it, one tracking area like
 *  the app's: while swollen the silhouette sticks out of the 235 × 39 rectangle, and a pointer
 *  crossing between the two must neither exit (un-swell, re-arm) nor enter (dwell, swell again). */
const HOVER_REGION_SELECTOR = 'path[data-qr-target="notch"], [data-qr-target="notchHit"]';

function insideHoverRegion(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest(HOVER_REGION_SELECTOR) !== null;
}

/** `installLocalEventMonitor` + `installGlobalClickMonitor` while the panel is visible: a press
 *  outside the black shape collapses the panel; one inside the shape while the list picker is up
 *  closes just the picker (a popover's own presses are its own). With a `[data-qr-screen]`
 *  ancestor only presses on that screen count, like the app's monitors see only its display. */
function useClickOutside(rootRef: RefObject<HTMLDivElement>, active: boolean): void {
  const { controller, store } = useCore();
  useEffect(() => {
    if (!active) return;
    const onPointerDown = (e: PointerEvent): void => {
      const node = e.target as Node | null;
      const target = node instanceof Element ? node : node?.parentElement ?? null;
      if (!target) return;
      const screen = rootRef.current?.closest('[data-qr-screen]') ?? null;
      if (screen && !screen.contains(target)) return;
      if (target.closest('[data-qr-popover]')) return;
      if (target.closest(SHAPE_SELECTOR)) {
        if (store.getState().listPickerOpen) controller.closeListPicker();
        return;
      }
      controller.pointerDownOutside();
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => document.removeEventListener('pointerdown', onPointerDown, true);
  }, [active, controller, store, rootRef]);
}

export function NotchContainer(): JSX.Element {
  const { controller } = useCore();
  const { flags, animation, sizes } = usePanel();
  const { phase, accent } = useRecreationState();
  const rootRef = useRef<HTMLDivElement>(null);

  const canvas = canvasFor(sizes);
  const panel = panelSize(sizes, flags.section);
  const shape: ShapeTarget = { ...currentSize(flags, sizes), ...radii(flags) };
  const geometry = useNotchGeometry(shape, animation);

  // The mask: the live silhouette in the content's own coordinates (the content is centred in the canvas).
  const silhouettePath = useNotchPath(geometry, panel.width);
  const settled = flags.isSettled;
  const clipPath = useTransform(silhouettePath, (d) => (settled ? 'none' : `path("${d}")`));
  const content = useContentMotion(flags.contentVisible, animation);

  useClickOutside(rootRef, phase.type === 'open' || phase.type === 'saving');

  // One hover region for the path and the hit layer: a crossing between them is not a change.
  const onHoverChange = (entered: boolean, relatedTarget: EventTarget | null): void => {
    if (!insideHoverRegion(relatedTarget)) controller.hover(entered);
  };

  const badge = badgeOrigin(sizes, canvas.width);
  const canvasStyle = {
    position: 'relative', width: px(canvas.width), height: px(canvas.height), pointerEvents: 'none',
    '--qr-list-accent': accent,
  } as CSSProperties;

  return (
    <LayoutGroup>
      <div ref={rootRef} data-qr-canvas="" className="qr-root" style={canvasStyle}>
        <div style={{ position: 'absolute', left: 0, top: 0, lineHeight: 0 }}>
          <NotchSilhouette
            geometry={geometry}
            canvas={canvas}
            onHoverChange={onHoverChange}
            onPress={() => void controller.show('click', true)}
          />
        </div>
        {/* Landing §7 "remains tappable": at phone scale the closed silhouette is 61 × 10 CSS px, so an
            invisible layer of at least 44 × 44 px over it takes the press and the hover while closed. */}
        <div
          data-qr-target="notchHit"
          className="qr-notch-hit"
          aria-hidden="true"
          style={{
            '--qr-hit-w': px(sizes.closedSize.width), '--qr-hit-h': px(sizes.closedSize.height),
            pointerEvents: phase.type === 'closed' ? 'auto' : 'none',
          } as CSSProperties}
          onPointerEnter={(e) => onHoverChange(true, e.relatedTarget)}
          onPointerLeave={(e) => onHoverChange(false, e.relatedTarget)}
          onPointerDown={() => void controller.show('click', true)}
        />
        <motion.div
          data-qr-content=""
          aria-hidden={flags.isOpen ? undefined : true}
          {...(flags.isOpen ? {} : { inert: '' })}
          style={{
            position: 'absolute', left: px((canvas.width - panel.width) / 2), top: 0,
            width: px(panel.width), height: px(panel.height),
            transformOrigin: 'top center', pointerEvents: 'none',
            opacity: content.opacity, filter: content.filter, scale: content.scale, clipPath,
          }}
        >
          <QuickReminderView />
        </motion.div>
        {flags.savedBadgeShown && (
          <div
            data-qr-badge-slot=""
            style={{ position: 'absolute', left: px(badge.left), top: px(badge.top), pointerEvents: 'none' }}
          >
            <SavedCheckView visible={flags.isSaving} />
          </div>
        )}
        <ListPickerMenu />
      </div>
    </LayoutGroup>
  );
}
