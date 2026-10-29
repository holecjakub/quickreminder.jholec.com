// Page copy contrast (landing §9: ≥ 4.5:1) measured with the app's own AccentContrast maths.
import { AccentContrast, hexToRgb } from '../../src/recreation/core/accentContrast';
import { WALLPAPER } from '../../src/desktop/Wallpaper';

const ratio = (fg: string, bg: string) => {
  const a = hexToRgb(fg)!, b = hexToRgb(bg)!;
  return AccentContrast.contrastRatio(AccentContrast.relativeLuminance(a.r, a.g, a.b), AccentContrast.relativeLuminance(b.r, b.g, b.b));
};

/** sRGB alpha composite of `fg` (0…255 channels) at `alpha` over the opaque `bg`, as `#RRGGBB`. */
const over = (fg: [number, number, number], alpha: number, bg: string) => {
  const b = hexToRgb(bg)!;
  const channel = (f: number, c: number) => Math.round(f * alpha + c * 255 * (1 - alpha)).toString(16).padStart(2, '0');
  return `#${channel(fg[0], b.r)}${channel(fg[1], b.g)}${channel(fg[2], b.b)}`.toUpperCase();
};

it.each([
  ['#0A0A0A', '#FFFFFF', 19.80], ['#757575', '#FFFFFF', 4.61], ['#A8A8A8', '#0A0A0A', 8.33], ['#FFFFFF', '#121212', 18.73],
  ['#4D4D4D', '#EBEBEB', 7.09], ['#0099FF', '#0A0A0A', 6.60],
])('page text %s on %s ≥ 4.5:1', (fg, bg, expected) => {
  expect(ratio(fg, bg)).toBeGreaterThanOrEqual(4.5);
  expect(ratio(fg, bg)).toBeCloseTo(expected, 1);
});
it('accent blue is never body text on white (3.00:1)', () => expect(ratio('#0099FF', '#FFFFFF')).toBeLessThan(4.5));
it('muted gray is never body text on the light-gray card (3.86:1)', () => expect(ratio('#757575', '#EBEBEB')).toBeLessThan(4.5));
it('hint lines stay ≥ 4.5:1 over every wallpaper blob', () => {
  for (const blob of ['#9DB8FF', '#F4B6D2', '#FFD7A6', '#E8ECF6']) {
    expect(WALLPAPER.light).toContain(blob);
    const bg = over([255, 255, 255], 0.78, blob);
    expect(ratio('#1D1D1F', bg)).toBeGreaterThanOrEqual(4.5);
    expect(ratio('#3A3A3C', bg)).toBeGreaterThanOrEqual(4.5);
  }
  for (const blob of ['#2C3F92', '#6A2C6F', '#1D5D66', '#0B1020']) {
    expect(WALLPAPER.dark).toContain(blob);
    const bg = over([0, 0, 0], 0.45, blob);
    expect(ratio('#F5F5F7', bg)).toBeGreaterThanOrEqual(4.5);
    expect(ratio('#C7C7CC', bg)).toBeGreaterThanOrEqual(4.5);
  }
});
