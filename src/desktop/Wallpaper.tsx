/** Original gradient mesh: three soft blobs on a base (no Apple wallpaper). */
export const WALLPAPER = {
  light:
    'radial-gradient(60% 70% at 18% 22%, #9DB8FF 0%, rgba(157, 184, 255, 0) 70%), ' +
    'radial-gradient(55% 65% at 84% 30%, #F4B6D2 0%, rgba(244, 182, 210, 0) 70%), ' +
    'radial-gradient(70% 60% at 58% 96%, #FFD7A6 0%, rgba(255, 215, 166, 0) 72%), #E8ECF6',
  dark:
    'radial-gradient(60% 70% at 18% 22%, #2C3F92 0%, rgba(44, 63, 146, 0) 70%), ' +
    'radial-gradient(55% 65% at 84% 30%, #6A2C6F 0%, rgba(106, 44, 111, 0) 70%), ' +
    'radial-gradient(70% 60% at 58% 96%, #1D5D66 0%, rgba(29, 93, 102, 0) 72%), #0B1020',
} as const;

export function Wallpaper({ scheme }: { scheme: 'light' | 'dark' }) {
  return <div data-wallpaper={scheme} aria-hidden="true" className="absolute inset-0" style={{ background: WALLPAPER[scheme] }} />;
}
