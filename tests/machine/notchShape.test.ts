import { describe, expect, it } from 'vitest';
import { contains, NotchGeometry, notchPath, notchPathSegments, NotchRadius, widthForNotch } from '../../src/recreation/machine/notchShape';

describe('NotchShapeTests', () => {
  it('widthAddsBothTopFillets', () => expect(widthForNotch(221, 6)).toBe(233));
  it('closedSilhouetteContainsTests', () => {
    const r = (x: number, y: number) => contains({ x, y }, 233, { width: 233, height: 38 }, 6, 14);
    expect(r(116, 19)).toBe(true);
    expect(r(1, 37)).toBe(false);
    expect(r(7, 37)).toBe(false);
    expect(r(3, 0.05)).toBe(true);
  });
  it('openShapeFillsItsRect', () => {
    const xs = notchPathSegments(600, 241, 19, 32).flatMap((s) => s.args.filter((_, i) => i % 2 === 0));
    expect(Math.max(...xs) - Math.min(...xs)).toBe(600);
  });
  it('hitTestTopDownCanvasCoordinates', () => {
    const canvas = 648, size = { width: 600, height: 241 }, ox = 24;
    const r = (x: number, y: number) => contains({ x, y }, canvas, size, 19, 32);
    expect(r(ox + 300, 120.5)).toBe(true);
    expect(r(ox + 2, 0.2)).toBe(true);
    expect(r(ox + 25, 237)).toBe(false);
    expect(r(ox - 5, 50)).toBe(false);
    expect(r(ox + 20, 50)).toBe(true);
  });
  it('notchGeometryChecks', () => expect(NotchGeometry.fallbackSize).toEqual({ width: 200, height: 32 }));
});

describe('notchShape (TS)', () => {
  it('radii', () => expect(NotchRadius).toEqual({ closedTop: 6, closedBottom: 14, openTop: 19, openBottom: 32 }));
  it('closedShapeSizeOfThe14InchNotch', () => expect(NotchGeometry.closedShapeSize({ width: 221, height: 38 }, 6)).toEqual({ width: 235, height: 39 }));
  it('pathString', () => expect(notchPath(233, 38, 6, 14)).toBe('M0 0 Q6 0 6 6 L6 24 Q6 38 20 38 L213 38 Q227 38 227 24 L227 6 Q227 0 233 0 L0 0 Z'));
  it('equalCommandCountInEveryState', () => {
    const states: [number, number, number, number][] = [[235, 39, 6, 14], [600, 241, 19, 32], [379, 39, 6, 14], [600, 751, 19, 32]];
    for (const [w, h, t, b] of states)
      expect(notchPathSegments(w, h, t, b).map((s) => s.cmd).join('')).toBe('MQLQLQLQL');
  });
  it('clampsATooSmallRect', () => expect(notchPath(20, 10, 19, 32)).toBe('M0 0 Q10 0 10 10 L10 10 Q10 10 10 10 L10 10 Q10 10 10 10 L10 10 Q10 0 20 0 L0 0 Z'));
  it.each([[0.5, 2.5], [4.5, 12.944], [10.5, 17.3], [240, 44]])('matchesCoreGraphicsFlattening (open, left edge at y %f ≈ x %f)', (y, x) => {
    const r = (px: number) => contains({ x: px, y }, 600, { width: 600, height: 241 }, 19, 32);
    expect(r(x + 0.02)).toBe(true);
    expect(r(x - 0.02)).toBe(false);
  });
});
