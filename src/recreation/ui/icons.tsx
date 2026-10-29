// SF Symbol -> Phosphor glyph table. The app draws SF Symbols; the site ships Phosphor glyphs sized so
// their ink box fits the SF glyph's ink box at the size and weight the Swift view uses (Task 23 table).
import { useId, type CSSProperties, type ComponentType } from 'react';
import {
  Armchair, CalendarDots, CalendarPlus, CaretDown, CaretLeft, CaretRight, Check, Clock, Flag, Keyboard,
  Moon, NavigationArrow, SunHorizon, Warning, X, XCircle, type IconProps,
} from '@phosphor-icons/react';
import { px } from './units';

export type SFSymbol = 'calendar.badge.clock' | 'calendar' | 'calendar.badge.plus' | 'location' | 'location.fill'
  | 'flag' | 'flag.fill' | 'checkmark' | 'xmark' | 'xmark.circle.fill' | 'chevron.down' | 'chevron.left'
  | 'chevron.right' | 'keyboard' | 'exclamationmark.triangle.fill' | 'clock' | 'moon' | 'sunrise' | 'sofa';

export interface GlyphSpec {
  readonly phosphor: string;
  readonly weight: 'regular' | 'bold' | 'fill';
  readonly size: number;
  readonly mirrored?: true;
}

/** Keys are `name@pt`; the calendar.badge.clock composite is drawn by CalendarClockIcon. */
export const GLYPHS: Readonly<Record<string, GlyphSpec>> = {
  'location@18': { phosphor: 'NavigationArrow', weight: 'regular', size: 21, mirrored: true },
  'location.fill@18': { phosphor: 'NavigationArrow', weight: 'fill', size: 21, mirrored: true },
  'location@12': { phosphor: 'NavigationArrow', weight: 'regular', size: 14, mirrored: true },
  'flag@18': { phosphor: 'Flag', weight: 'regular', size: 21.5 },
  'flag.fill@18': { phosphor: 'Flag', weight: 'fill', size: 21.5 },
  'checkmark@22': { phosphor: 'Check', weight: 'bold', size: 23.5 },
  'checkmark@13': { phosphor: 'Check', weight: 'bold', size: 14 },
  'xmark@11': { phosphor: 'X', weight: 'bold', size: 15 },
  'xmark.circle.fill@13': { phosphor: 'XCircle', weight: 'fill', size: 16 },
  'chevron.down@13': { phosphor: 'CaretDown', weight: 'bold', size: 15.5 },
  'chevron.down@9': { phosphor: 'CaretDown', weight: 'bold', size: 12 },
  'chevron.left@11': { phosphor: 'CaretLeft', weight: 'bold', size: 13.5 },
  'chevron.right@11': { phosphor: 'CaretRight', weight: 'bold', size: 13.5 },
  'calendar@12': { phosphor: 'CalendarDots', weight: 'regular', size: 13.5 },
  'calendar@13': { phosphor: 'CalendarDots', weight: 'regular', size: 14.5 },
  'keyboard@12': { phosphor: 'Keyboard', weight: 'regular', size: 16 },
  'exclamationmark.triangle.fill@12': { phosphor: 'Warning', weight: 'fill', size: 14.5 },
  'clock@13': { phosphor: 'Clock', weight: 'regular', size: 17 },
  'clock@11': { phosphor: 'Clock', weight: 'regular', size: 14.5 },
  'moon@13': { phosphor: 'Moon', weight: 'regular', size: 16 },
  'sunrise@13': { phosphor: 'SunHorizon', weight: 'regular', size: 17 },
  'sofa@13': { phosphor: 'Armchair', weight: 'regular', size: 16.5 },
  'calendar.badge.plus@13': { phosphor: 'CalendarPlus', weight: 'regular', size: 16 },
};

const COMPONENTS: Readonly<Record<string, ComponentType<IconProps>>> = {
  Armchair, CalendarDots, CalendarPlus, CaretDown, CaretLeft, CaretRight, Check, Clock, Flag, Keyboard,
  Moon, NavigationArrow, SunHorizon, Warning, X, XCircle,
};

export function SFIcon(props: { name: SFSymbol; pointSize: number; style?: CSSProperties; className?: string }) {
  const { name, pointSize, style, className } = props;
  if (name === 'calendar.badge.clock') {
    if (pointSize !== 18 && pointSize !== 12) throw new Error(`No glyph for ${name}@${pointSize}`);
    return <CalendarClockIcon pointSize={pointSize} style={style} />;
  }
  const key = `${name}@${pointSize}`;
  const spec = GLYPHS[key];
  if (!spec) throw new Error(`No glyph for ${key}`);
  const Glyph = COMPONENTS[spec.phosphor];
  if (!Glyph) throw new Error(`No Phosphor component ${spec.phosphor}`);
  return (
    <Glyph
      size={spec.size}
      weight={spec.weight}
      className={className}
      aria-hidden="true"
      data-sf={key}
      data-phosphor={`${spec.phosphor}:${spec.weight}`}
      style={{
        width: px(spec.size), height: px(spec.size), flex: 'none',
        ...(spec.mirrored ? { transform: 'scaleX(-1)' } : null),
        ...style,
      }}
    />
  );
}

/** calendar.badge.clock: CalendarDots with a clock-shaped hole, plus Clock in the bottom-right corner.
 *  All numbers are the 18 pt measurements scaled by pointSize / 18. */
export function CalendarClockIcon(props: { pointSize: 18 | 12; style?: CSSProperties }) {
  const { pointSize, style } = props;
  const maskId = useId();
  const k = pointSize / 18;
  const width = 21.75 * k;
  const height = 18.88 * k;
  return (
    <svg
      aria-hidden="true"
      data-sf={`calendar.badge.clock@${pointSize}`}
      data-phosphor="CalendarDots+Clock:regular"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      overflow="visible"
      style={{ width: px(width), height: px(height), flex: 'none', ...style }}
    >
      <defs>
        <mask id={maskId} maskUnits="userSpaceOnUse" x={-4 * k} y={-4 * k} width={width + 8 * k} height={height + 8 * k}>
          <rect x={-4 * k} y={-4 * k} width={width + 8 * k} height={height + 8 * k} fill="white" />
          <circle cx={16.46875 * k} cy={13.59875 * k} r={6.78125 * k} fill="black" />
        </mask>
      </defs>
      <g mask={`url(#${maskId})`}>
        <CalendarDots size={23 * k} weight="regular" x={-2.875 * k} y={-1.4375 * k} />
      </g>
      <Clock size={13 * k} weight="regular" x={9.96875 * k} y={7.09875 * k} />
    </svg>
  );
}
