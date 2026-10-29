// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import { DOWNLOAD_COPY, FOOTER_COPY } from '../../../src/app/choreography/copy';
import { LINKS } from '../../../src/app/Nav';
import { Download } from '../../../src/app/sections/Download';
import { Footer } from '../../../src/app/sections/Footer';
import { installMatchMedia } from '../../fakes/matchMedia';

afterEach(cleanup);

function mount(matches: Record<string, boolean> = {}) {
  installMatchMedia(matches);
  return render(<Download />);
}

describe('Download', () => {
  it('copy', () =>
    expect(DOWNLOAD_COPY).toMatchObject({
      headline: 'Free. Open source. macOS 26.',
      primary: 'Download for macOS',
      secondary: 'View on GitHub',
      requirements:
        'Requires macOS 26 on Apple silicon. Works on Macs without a notch too, with a virtual notch at the top of the screen.',
      note: 'On first launch, macOS asks for access to Reminders.',
    }));

  it('facts', () =>
    expect(DOWNLOAD_COPY.facts.map((f) => f.title)).toEqual([
      'Notarized Developer ID build',
      'Only EventKit, no private APIs',
      'MIT licence',
    ]));

  it('is the dark #0A0A0A section the nav links to', () => {
    mount();
    const section = document.querySelector('section#download') as HTMLElement;
    expect(section.getAttribute('data-section')).toBe('dark');
    expect(section.getAttribute('aria-labelledby')).toBe('download-title');
    expect(section.style.background || section.style.backgroundColor).toBe('var(--jh-bg)');
    expect(document.getElementById('download-title')?.tagName).toBe('H2');
    expect(screen.getByRole('heading', { level: 2, name: DOWNLOAD_COPY.headline })).toBeTruthy();
  });

  it('primary button downloads from the latest release; secondary opens the repo', () => {
    mount();
    expect(screen.getByRole('link', { name: 'Download for macOS' }).getAttribute('href')).toBe(
      'https://github.com/holecjakub/QuickReminder/releases/latest',
    );
    expect(screen.getByRole('link', { name: 'View on GitHub' }).getAttribute('href')).toBe(LINKS.appRepo);
  });

  it('shows the three facts with their details, requirements and note', () => {
    mount();
    for (const fact of DOWNLOAD_COPY.facts) {
      expect(screen.getByText(fact.title)).toBeTruthy();
      expect(screen.getByText(fact.detail)).toBeTruthy();
    }
    expect(screen.getByText(DOWNLOAD_COPY.requirements)).toBeTruthy();
    expect(screen.getByText(DOWNLOAD_COPY.note)).toBeTruthy();
  });

  it('the MIT fact links the LICENSE', () => {
    mount();
    const fact = screen.getByText('MIT licence').closest('li') as HTMLElement;
    expect(within(fact).getByRole('link').getAttribute('href')).toBe(LINKS.license);
  });

  it('facts are one column below 810 and three from 810', () => {
    const { unmount } = mount({ '(min-width: 810px)': false });
    expect((document.querySelector('ul') as HTMLElement).style.gridTemplateColumns).toBe('1fr');
    unmount();
    mount({ '(min-width: 810px)': true });
    expect((document.querySelector('ul') as HTMLElement).style.gridTemplateColumns).toBe('repeat(3, 1fr)');
  });

  it('app icon has intrinsic size and loads lazily', () => {
    mount();
    const img = screen.getByAltText('QuickReminder app icon');
    expect(img.getAttribute('src')).toBe('/app-icon-512.png');
    expect(img.getAttribute('width')).toBe('96');
    expect(img.getAttribute('height')).toBe('96');
    expect(img.getAttribute('loading')).toBe('lazy');
    expect(img.getAttribute('decoding')).toBe('async');
  });
});

describe('Footer', () => {
  it('disclaimer is the app README’s, verbatim', () =>
    expect(FOOTER_COPY.disclaimer).toBe(
      'Not affiliated with, endorsed by or sponsored by Apple Inc. Apple, macOS, iOS, Xcode, SF Symbols and Reminders are trademarks of Apple Inc. ' +
        'QuickReminder is an independent, from-scratch implementation using only public Apple frameworks; it contains no Apple source code or assets and uses no private APIs. ' +
        'It reads and writes your reminders through the public EventKit framework.',
    ));

  it('site note', () =>
    expect(FOOTER_COPY.siteNote).toBe(
      'The desktop, wallpaper, window and cursor on this page are original drawings, and the icons are Phosphor. Nothing on this page is an Apple asset.',
    ));

  it('links: jholec.com, the app repo, the site source, NOTICE', () => {
    render(<Footer />);
    expect(screen.getByRole('link', { name: 'Made by Jakub Holec' }).getAttribute('href')).toBe('https://jholec.com');
    expect(screen.getByRole('link', { name: 'QuickReminder on GitHub' }).getAttribute('href')).toBe(LINKS.appRepo);
    expect(screen.getByRole('link', { name: 'Source of this site' }).getAttribute('href')).toBe(LINKS.siteRepo);
    expect(screen.getByRole('link', { name: 'Trademarks and acknowledgements' }).getAttribute('href')).toBe(LINKS.notice);
  });

  it('shows the disclaimer and the site note', () => {
    render(<Footer />);
    expect(screen.getByText(FOOTER_COPY.disclaimer)).toBeTruthy();
    expect(screen.getByText(FOOTER_COPY.siteNote)).toBeTruthy();
  });

  it('is a dark contentinfo landmark', () => {
    render(<Footer />);
    expect(screen.getByRole('contentinfo').getAttribute('data-section')).toBe('dark');
  });
});
