// @vitest-environment jsdom
import './setup';
import { render, fireEvent, waitFor } from '@testing-library/react';
import { useNotchGeometry, NotchSilhouette, translatedNotchPath, geometryTransition, type ShapeTarget } from '../../src/recreation/ui/NotchSilhouette';
import type { FlagAnimation } from '../../src/recreation/ui/transitions';
import { ptOf } from './support';
type Spring = { stiffness: number; damping: number };
const spring = (a: FlagAnimation): Spring => geometryTransition(a, false, 1) as Spring;
const CLOSED: ShapeTarget = { width: 235, height: 39, top: 6, bottom: 14 };
const OPEN: ShapeTarget = { width: 600, height: 241, top: 19, bottom: 32 };
function Harness(p: { target: ShapeTarget; animation: FlagAnimation; onHover?: (v: boolean) => void; onPress?: () => void }) {
  const g = useNotchGeometry(p.target, p.animation);
  return <NotchSilhouette geometry={g} canvas={{ width: 648, height: 775 }} onHoverChange={p.onHover ?? (() => {})} onPress={p.onPress ?? (() => {})} />;
}
test('path is centred in the canvas', () => {
  const d = translatedNotchPath(CLOSED, 648);
  expect(d.startsWith('M206.5 0 Q212.5 0 212.5 6 ')).toBe(true);  // (648 − 235) / 2 = 206.5; fillet control (6, 0) → (6, 6)
  expect(d.endsWith('Z')).toBe(true);
});
test('transition per animation', () => {
  expect(spring('open').stiffness).toBeCloseTo(223.80, 2);
  expect(spring('close').damping).toBeCloseTo(38.537, 3);
  expect(spring('saving').stiffness).toBeCloseTo(194.96, 2);
  expect(spring('schedule').damping).toBeCloseTo(26.456, 3);
  expect(spring('hoverIn').damping).toBeCloseTo(21.598, 3);
  expect(spring('hoverOut').damping).toBeCloseTo(35.605, 3);
  expect(geometryTransition('open', true, 1)).toEqual({ type: 'tween', ease: [0, 0, 0.58, 1], duration: 0.15 });
  expect(geometryTransition('none', false, 1)).toEqual({ duration: 0 });
});
test('the path follows the target', async () => {
  const { container, rerender } = render(<Harness target={CLOSED} animation="none" />);
  const svg = container.querySelector('svg')!;
  expect(ptOf(svg.style.width)).toBe(648);
  const path = container.querySelector('path[data-qr-target="notch"]')!;
  expect(path.getAttribute('d')).toBe(translatedNotchPath(CLOSED, 648));
  rerender(<Harness target={OPEN} animation="open" />);
  await waitFor(() => expect(path.getAttribute('d')).toBe(translatedNotchPath(OPEN, 648)));
});
test('hover and press on the black shape only', () => {
  const onHover = vi.fn(), onPress = vi.fn();
  const { container } = render(<Harness target={CLOSED} animation="none" onHover={onHover} onPress={onPress} />);
  const path = container.querySelector('path')!;
  expect((container.querySelector('svg') as SVGElement).style.pointerEvents).toBe('none');
  expect(path.style.pointerEvents).toBe('visiblepainted');  // `visiblePainted`; CSSOM serialises keywords in lower case
  fireEvent.pointerEnter(path); fireEvent.pointerLeave(path); fireEvent.pointerDown(path);
  expect(onHover.mock.calls).toEqual([[true], [false]]);
  expect(onPress).toHaveBeenCalledTimes(1);
});
