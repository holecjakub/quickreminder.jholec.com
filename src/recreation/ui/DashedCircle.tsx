// `DashedCircleView` (Views/DashedCircle.swift): the empty "not completed" checkbox ring of iOS
// Reminders, `Circle().stroke(Theme.dashedRing, lineWidth 1.5, lineCap .round, dash [0.1, 3.2])`.
// `.stroke` straddles the inscribed circle, so the ring's outer half overflows the frame.
import type { CSSProperties } from 'react';
import { px } from './units';

/** `style` carries the caller's placement (InputView's `.padding(.top, 2)`). */
export function DashedCircle(props: { size?: number; style?: CSSProperties }): JSX.Element {
  const size = props.size ?? 21;
  return (
    <svg
      data-qr-dashed-circle=""
      aria-hidden="true"
      viewBox="0 0 21 21"
      style={{ display: 'block', flex: 'none', width: px(size), height: px(size), overflow: 'visible', ...props.style }}
    >
      <circle
        cx="10.5"
        cy="10.5"
        r="10.5"
        fill="none"
        stroke="var(--qr-dashed-ring)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeDasharray="0.1 3.2"
      />
    </svg>
  );
}
