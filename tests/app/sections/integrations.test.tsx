// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { INTEGRATIONS_COPY } from '../../../src/app/choreography/copy';
import { LINKS } from '../../../src/app/Nav';
import { COPIED_MS, Integrations } from '../../../src/app/sections/Integrations';
import { installMatchMedia } from '../../fakes/matchMedia';

const REDUCED = '(prefers-reduced-motion: reduce)';

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function mount(matches: Record<string, boolean> = {}) {
  installMatchMedia(matches);
  return render(<Integrations />);
}

it('title, headline and paragraph', () => {
  mount();
  expect(screen.getByText((_, el) => el?.tagName === 'P' && el.textContent === '(07) Integrations /')).toBeTruthy();
  expect(screen.getByRole('heading', { level: 2, name: 'Everywhere you already are.' })).toBeTruthy();
  expect(screen.getByText(INTEGRATIONS_COPY.paragraph)).toBeTruthy();
  const section = document.querySelector('section#integrations');
  expect(section?.getAttribute('aria-labelledby')).toBe('feature-07-title');
  expect(document.getElementById('feature-07-title')?.tagName).toBe('H2');
});

it('four dark cards in order', () => {
  mount();
  const titles = screen.getAllByRole('heading', { level: 3 });
  expect(titles.map((t) => t.textContent)).toEqual(['Raycast', 'Shortcuts', 'URL scheme', 'Settings']);
  for (const title of titles) {
    const card = title.closest('article') as HTMLElement;
    expect(card.style.background || card.style.backgroundColor).toBe('var(--jh-black-light)');
    expect(card.style.borderRadius).toBe('var(--jh-radius)');
  }
});

it('terminal shows the prompt and the command in mono', () => {
  mount();
  const command = screen.getByText('open quickreminder://show');
  expect(command.style.fontFamily).toBe('var(--jh-font-mono)');
  expect(screen.getByText('~ %')).toBeTruthy();
});

it('Copy writes the command to the clipboard and says Copied for 1.6 s', async () => {
  const writeText = vi.fn(() => Promise.resolve());
  Object.assign(navigator, { clipboard: { writeText } });
  mount();
  expect(COPIED_MS).toBe(1600);
  const status = screen.getByRole('status');
  expect(status.textContent).toBe('Copy');
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Copy command' }));
  });
  expect(writeText).toHaveBeenCalledWith('open quickreminder://show');
  expect(status.textContent).toBe('Copied');
  await act(async () => {
    vi.advanceTimersByTime(COPIED_MS);
  });
  expect(status.textContent).toBe('Copy');
});

it('the caret blinks unless reduced motion', () => {
  const { container, unmount } = mount();
  expect((container.querySelector('[data-caret]') as HTMLElement).style.animation).toContain('qr-caret-blink 1.06s steps(1) infinite');
  unmount();
  const reduced = mount({ [REDUCED]: true });
  expect((reduced.container.querySelector('[data-caret]') as HTMLElement).style.animation).toBe('none');
});

it('the Raycast card links the Script Command folder', () => {
  mount();
  expect(screen.getByRole('link', { name: 'Script Command' }).getAttribute('href')).toBe(LINKS.raycastScript);
});

it('the Script Command link is underlined, not told apart by colour alone (axe link-in-text-block)', () => {
  mount();
  expect(screen.getByRole('link', { name: 'Script Command' }).style.textDecoration).toBe('underline');
});
