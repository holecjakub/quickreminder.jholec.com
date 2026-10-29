// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { FRAME, MacBookFrame, applyDrawIn, roundedRectPath } from '../../src/app/MacBookFrame';
import { ptCss } from '../../src/desktop/scene';

afterEach(cleanup);

function renderFrame(drawIn: number, scheme: 'light' | 'dark' = 'light') {
  const { container } = render(<MacBookFrame drawIn={drawIn} scheme={scheme} />);
  const svg = container.querySelector('svg') as SVGSVGElement;
  const part = (name: string) => svg.querySelector(`[data-${name}]`) as SVGElement;
  return { svg, part };
}

describe('<MacBookFrame>', () => {
  it('roundedRectPath', () =>
    expect(roundedRectPath(100, 50, 10, 5)).toBe(
      'M10 0H90A10 10 0 0 1 100 10V45A5 5 0 0 1 95 50H5A5 5 0 0 1 0 45V10A10 10 0 0 1 10 0Z',
    ));

  it('lid = screen + bezels', () => {
    expect(FRAME.lidWidth).toBe(1512 + 2 * FRAME.bezelSide);
    expect(FRAME.lidHeight).toBe(982 + FRAME.bezelTop + FRAME.chin);
  });

  it('draws the lid around the screen origin and the deck below it', () => {
    const { svg, part } = renderFrame(1);
    expect(svg.getAttribute('aria-hidden')).toBe('true');
    expect(svg.style.left).toBe(ptCss(-18));
    expect(svg.style.top).toBe(ptCss(-18));
    expect(part('lid').getAttribute('d')).toBe(roundedRectPath(1548, 1036, 36, 20));
    const deck = part('deck');
    expect(deck.getAttribute('x')).toBe('-76');
    expect(deck.getAttribute('y')).toBe('1036');
    expect(deck.getAttribute('width')).toBe('1700');
    expect(deck.getAttribute('height')).toBe('34');
  });

  it('drawIn traces the rim and fades the fills', () => {
    const { part } = renderFrame(0.25);
    const rim = part('rim');
    expect(rim.getAttribute('pathLength')).toBe('1');
    expect(rim.getAttribute('stroke-dasharray')).toBe('1');
    expect(rim.getAttribute('stroke-dashoffset')).toBe('0.75');
    expect(part('lid').getAttribute('fill-opacity')).toBe('0.25');
    expect(part('deck').getAttribute('opacity')).toBe('0.25');
  });

  it('applyDrawIn updates the same attributes', () => {
    const { svg, part } = renderFrame(0);
    applyDrawIn(svg, 0.6);
    expect(part('rim').getAttribute('stroke-dashoffset')).toBe('0.4');
    expect(part('lid').getAttribute('fill-opacity')).toBe('0.6');
    expect(part('deck').getAttribute('opacity')).toBe('0.6');
  });

  it('uses the dark palette for scheme dark', () => {
    const { part } = renderFrame(1, 'dark');
    expect(part('rim').getAttribute('stroke')).toBe('#4A4B4F');
  });
});
