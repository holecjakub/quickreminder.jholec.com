// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react';
import { useColorScheme } from '../../src/desktop/useMediaQuery';
import { WALLPAPER, Wallpaper } from '../../src/desktop/Wallpaper';
import { installMatchMedia } from '../fakes/matchMedia';

const DARK_QUERY = '(prefers-color-scheme: dark)';

function Probe({ pref }: { pref: 'light' | 'dark' | 'auto' }) {
  return <span data-testid="scheme">{useColorScheme(pref)}</span>;
}
const printed = () => document.querySelector('[data-testid="scheme"]')?.textContent;

afterEach(cleanup);

describe('Wallpaper', () => {
  it('light wallpaper is three soft blobs on a pale base', () => {
    expect(WALLPAPER.light).toBe(
      'radial-gradient(60% 70% at 18% 22%, #9DB8FF 0%, rgba(157, 184, 255, 0) 70%), ' +
        'radial-gradient(55% 65% at 84% 30%, #F4B6D2 0%, rgba(244, 182, 210, 0) 70%), ' +
        'radial-gradient(70% 60% at 58% 96%, #FFD7A6 0%, rgba(255, 215, 166, 0) 72%), #E8ECF6',
    );
  });

  it('dark wallpaper keeps the layout with deep colours', () => {
    expect(WALLPAPER.dark).toBe(
      'radial-gradient(60% 70% at 18% 22%, #2C3F92 0%, rgba(44, 63, 146, 0) 70%), ' +
        'radial-gradient(55% 65% at 84% 30%, #6A2C6F 0%, rgba(106, 44, 111, 0) 70%), ' +
        'radial-gradient(70% 60% at 58% 96%, #1D5D66 0%, rgba(29, 93, 102, 0) 72%), #0B1020',
    );
  });

  it('renders the scheme it is given, aria-hidden, filling the scene', () => {
    render(<Wallpaper scheme="dark" />);
    const el = document.querySelector('[data-wallpaper]') as HTMLElement;
    expect(el.getAttribute('data-wallpaper')).toBe('dark');
    expect(el.getAttribute('aria-hidden')).toBe('true');
    expect(el.className).toContain('absolute inset-0');
    expect(el.style.background).not.toBe('');
  });
});

describe('useColorScheme', () => {
  it("'auto' follows prefers-color-scheme and updates on change", () => {
    const mm = installMatchMedia({ [DARK_QUERY]: false });
    render(<Probe pref="auto" />);
    expect(printed()).toBe('light');
    act(() => mm.set(DARK_QUERY, true));
    expect(printed()).toBe('dark');
  });

  it("'dark' ignores the media query", () => {
    installMatchMedia({ [DARK_QUERY]: false });
    render(<Probe pref="dark" />);
    expect(printed()).toBe('dark');
  });

  it('is light when matchMedia is missing', () => {
    Object.defineProperty(window, 'matchMedia', { configurable: true, writable: true, value: undefined });
    render(<Probe pref="auto" />);
    expect(printed()).toBe('light');
  });
});
