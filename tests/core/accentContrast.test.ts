import { describe, expect, it } from 'vitest';
import { AccentContrast as A, hexToRgb } from '../../src/recreation/core/accentContrast';

const onWhite = (r: number, g: number, b: number) => A.contrastRatio(A.relativeLuminance(r / 255, g / 255, b / 255), 1);

describe('AccentContrastTests', () => {
  it('luminanceEndpointsAndRatio', () => {
    expect(A.relativeLuminance(0, 0, 0)).toBe(0);
    expect(A.relativeLuminance(1, 1, 1)).toBeCloseTo(1, 9);
    expect(A.contrastRatio(0, 1)).toBeCloseTo(21, 9);
    expect(A.contrastRatio(0.3, 0.3)).toBe(1);
  });
  it.each([['orange', 255, 141, 40], ['green', 131, 215, 84], ['yellow', 255, 204, 0], ['light blue', 27, 173, 248]])(
    'lightListColoursGetADarkLabel (%s)', (_n, r, g, b) => {
      expect(onWhite(r, g, b)).toBeLessThan(3);
      expect(A.prefersDarkLabel(r / 255, g / 255, b / 255)).toBe(true);
      expect(A.contrastRatio(A.relativeLuminance(r / 255, g / 255, b / 255), 0)).toBeGreaterThanOrEqual(4.5);
    });
  it.each([['blue', 0, 122, 255], ['default blue', 10, 132, 255], ['sky blue', 0, 136, 255], ['purple', 203, 48, 224], ['red', 255, 56, 60]])(
    'midToneListColoursKeepWhite (%s)', (_n, r, g, b) => {
      expect(onWhite(r, g, b)).toBeGreaterThanOrEqual(3);
      expect(A.prefersDarkLabel(r / 255, g / 255, b / 255)).toBe(false);
    });
  it('darkListColoursKeepWhite', () => {
    expect(A.prefersDarkLabel(0, 0.25, 0.63)).toBe(false);
    expect(A.prefersDarkLabel(0.55, 0.12, 0.1)).toBe(false);
    expect(onWhite(140, 31, 26)).toBeGreaterThanOrEqual(4.5);
  });
  it('labelResolvesSwiftUIColours', () => {
    expect(A.label('#FFCC00')).toBe('#000000');
    expect(A.label('#0040A1')).toBe('#FFFFFF');
  });
});

describe('accentContrast (TS)', () => {
  it.each([['#0A84FF', '#FFFFFF'], ['#BF5AF2', '#FFFFFF'], ['#FF375F', '#FFFFFF'], ['#FF9F0A', '#000000'], ['#30D158', '#000000']])(
    'fake list %s → %s', (fill, label) => expect(A.label(fill)).toBe(label));
  it('unparseableKeepsWhite', () => expect(A.label('not a colour')).toBe('#FFFFFF'));
  it('hexToRgb', () => {
    expect(hexToRgb('#FF0000')).toEqual({ r: 1, g: 0, b: 0 });
    expect(hexToRgb('0a84ff')).toEqual({ r: 10 / 255, g: 132 / 255, b: 1 });
    expect(hexToRgb('#FFF')).toBeNull();
  });
  it('threshold', () => expect(A.minimumTextContrast).toBe(3));
});
