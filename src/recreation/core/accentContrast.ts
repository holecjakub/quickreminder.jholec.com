// Port of Services/AccentContrast.swift: text on a fill of the list's colour (the Set button,
// the selected time chip, the picked day). White when it reaches 3:1 (WCAG large text / UI
// components), otherwise black (whichever of the two contrasts more).

/** `#RRGGBB` / `RRGGBB` (case-insensitive) to sRGB components 0…1; null when unparseable. */
export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const match = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex.trim());
  if (!match) return null;
  const channel = (part: string | undefined): number => parseInt(part ?? '0', 16) / 255;
  return { r: channel(match[1]), g: channel(match[2]), b: channel(match[3]) };
}

const linear = (c: number): number => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

const minimumTextContrast = 3.0;

/** WCAG relative luminance of an sRGB colour (components 0…1). */
function relativeLuminance(red: number, green: number, blue: number): number {
  return 0.2126 * linear(red) + 0.7152 * linear(green) + 0.0722 * linear(blue);
}

/** WCAG contrast ratio of two relative luminances (order does not matter), 1…21. */
function contrastRatio(a: number, b: number): number {
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/** Whether a label on a fill of this colour should be dark instead of white. */
function prefersDarkLabel(red: number, green: number, blue: number): boolean {
  const fill = relativeLuminance(red, green, blue);
  const onWhite = contrastRatio(fill, 1);
  if (onWhite >= minimumTextContrast) return false;
  return contrastRatio(fill, 0) > onWhite;
}

/** Label colour for text on `fill` (a hex colour; an unparseable one keeps white). */
function label(fill: string): '#FFFFFF' | '#000000' {
  const rgb = hexToRgb(fill);
  if (!rgb) return '#FFFFFF';
  return prefersDarkLabel(rgb.r, rgb.g, rgb.b) ? '#000000' : '#FFFFFF';
}

export const AccentContrast = { minimumTextContrast, relativeLuminance, contrastRatio, prefersDarkLabel, label };
