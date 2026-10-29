// The 14" MacBook Pro around the fake screen (landing §10): lid bezel, aluminium rim and keyboard deck, SVG only.
// The Stage drives `drawIn` (0…1) per frame: the rim traces itself in while the fills fade up.
import { forwardRef, useId } from 'react';
import { ptCss } from '../desktop/scene';

/** 14" MacBook Pro proportions in scene points, around the 1512 × 982 screen (landing §10, author's drawing). */
export const FRAME: {
  readonly bezelSide: 18;
  readonly bezelTop: 18;
  readonly chin: 36;
  readonly lidWidth: 1548;
  readonly lidHeight: 1036;
  readonly lidRadiusTop: 36;
  readonly lidRadiusBottom: 20;
  readonly rim: 3;
  readonly deckWidth: 1700;
  readonly deckHeight: 34;
  readonly deckRadiusBottom: 24;
  readonly scoopWidth: 240;
  readonly scoopHeight: 9;
} = {
  bezelSide: 18,
  bezelTop: 18,
  chin: 36,
  lidWidth: 1548,
  lidHeight: 1036,
  lidRadiusTop: 36,
  lidRadiusBottom: 20,
  rim: 3,
  deckWidth: 1700,
  deckHeight: 34,
  deckRadiusBottom: 24,
  scoopWidth: 240,
  scoopHeight: 9,
};

export const FRAME_COLORS: {
  readonly light: { bezel: '#0B0B0C'; rim: '#A7AAB0'; deckTop: '#DADCE0'; deckBottom: '#A4A7AD'; scoop: '#B9BCC1' };
  readonly dark: { bezel: '#0B0B0C'; rim: '#4A4B4F'; deckTop: '#45464A'; deckBottom: '#222326'; scoop: '#2A2B2E' };
} = {
  light: { bezel: '#0B0B0C', rim: '#A7AAB0', deckTop: '#DADCE0', deckBottom: '#A4A7AD', scoop: '#B9BCC1' },
  dark: { bezel: '#0B0B0C', rim: '#4A4B4F', deckTop: '#45464A', deckBottom: '#222326', scoop: '#2A2B2E' },
};

/** Rounded rectangle with separate top / bottom radii, drawn clockwise from the top-left arc's end. */
export function roundedRectPath(w: number, h: number, rTop: number, rBottom: number): string {
  return (
    `M${rTop} 0H${w - rTop}A${rTop} ${rTop} 0 0 1 ${w} ${rTop}` +
    `V${h - rBottom}A${rBottom} ${rBottom} 0 0 1 ${w - rBottom} ${h}` +
    `H${rBottom}A${rBottom} ${rBottom} 0 0 1 0 ${h - rBottom}` +
    `V${rTop}A${rTop} ${rTop} 0 0 1 ${rTop} 0Z`
  );
}

export interface MacBookFrameProps {
  /** 0…1: how far the rim is traced and the fills are faded in. */
  drawIn: number;
  scheme: 'light' | 'dark';
}

/** Deck left edge relative to the lid (−76): the deck is centred under the lid. */
const DECK_X = (FRAME.lidWidth - FRAME.deckWidth) / 2;
const TOTAL_HEIGHT = FRAME.lidHeight + FRAME.deckHeight;

function drawInAttributes(drawIn: number) {
  const t = Math.min(1, Math.max(0, drawIn));
  return { dashOffset: String(1 - t), opacity: String(t) };
}

export const MacBookFrame = forwardRef<SVGSVGElement, MacBookFrameProps>(function MacBookFrame({ drawIn, scheme }, ref) {
  const colors = FRAME_COLORS[scheme];
  const gradientId = `qr-deck-${useId().replace(/[^A-Za-z0-9_-]/g, '')}`;
  const { dashOffset, opacity } = drawInAttributes(drawIn);
  const lid = roundedRectPath(FRAME.lidWidth, FRAME.lidHeight, FRAME.lidRadiusTop, FRAME.lidRadiusBottom);

  return (
    <svg
      ref={ref}
      aria-hidden="true"
      viewBox={`${DECK_X} 0 ${FRAME.deckWidth} ${TOTAL_HEIGHT}`}
      style={{
        position: 'absolute',
        left: ptCss(-FRAME.bezelSide),
        top: ptCss(-FRAME.bezelTop),
        width: ptCss(FRAME.deckWidth),
        height: ptCss(TOTAL_HEIGHT),
        overflow: 'visible',
        pointerEvents: 'none',
        zIndex: -1,
      }}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={colors.deckTop} />
          <stop offset="1" stopColor={colors.deckBottom} />
        </linearGradient>
      </defs>
      <path data-lid d={lid} fill={colors.bezel} fillOpacity={opacity} />
      <path
        data-rim
        d={lid}
        fill="none"
        stroke={colors.rim}
        strokeWidth={FRAME.rim}
        pathLength={1}
        strokeDasharray="1"
        strokeDashoffset={dashOffset}
      />
      <svg
        data-deck
        x={DECK_X}
        y={FRAME.lidHeight}
        width={FRAME.deckWidth}
        height={FRAME.deckHeight}
        overflow="visible"
        opacity={opacity}
      >
        <path d={roundedRectPath(FRAME.deckWidth, FRAME.deckHeight, 0, FRAME.deckRadiusBottom)} fill={`url(#${gradientId})`} />
        <path
          transform={`translate(${(FRAME.deckWidth - FRAME.scoopWidth) / 2} 0)`}
          d={roundedRectPath(FRAME.scoopWidth, FRAME.scoopHeight, 0, FRAME.scoopHeight)}
          fill={colors.scoop}
        />
      </svg>
    </svg>
  );
});

/** Per-frame write used by the Stage: the same attributes the render sets, without a React render. */
export function applyDrawIn(svg: SVGSVGElement, drawIn: number): void {
  const { dashOffset, opacity } = drawInAttributes(drawIn);
  svg.querySelector('[data-rim]')?.setAttribute('stroke-dashoffset', dashOffset);
  svg.querySelector('[data-lid]')?.setAttribute('fill-opacity', opacity);
  svg.querySelector('[data-deck]')?.setAttribute('opacity', opacity);
}
