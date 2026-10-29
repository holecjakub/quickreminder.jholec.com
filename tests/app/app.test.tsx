// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { cleanup, render, screen } from '@testing-library/react';
import App from '../../src/App';
import { installMatchMedia } from '../fakes/matchMedia';

vi.mock('../../src/app/gsap', () => import('../fakes/gsapMock'));
vi.mock('../../src/recreation', () => import('../fakes/recreationMock'));

beforeEach(() => {
  installMatchMedia({ '(min-width: 810px)': true });
});
afterEach(() => {
  cleanup();
});

it('landmarks in order', () => {
  render(<App />);
  expect(screen.getByRole('navigation', { name: 'Primary' })).toBeTruthy();
  const main = screen.getByRole('main');
  const ids = [...main.querySelectorAll('[data-stage-track], section#integrations, section#download')].map(e => e.id || 'stage');
  expect(ids).toEqual(['stage', 'integrations', 'download']); expect(screen.getByRole('contentinfo')).toBeTruthy();
});
it('one h1, the hero title', () => { render(<App />); expect(screen.getAllByRole('heading', { level: 1 }).map(h => h.textContent)).toEqual(['A reminder, straight out of the notch.']); });
it('the features column sits inside the stage track', () => { render(<App />); expect(document.querySelector('[data-features-column] #feature-01')).not.toBeNull(); });
it('index.html metadata', () => {
  const html = readFileSync('index.html', 'utf8');
  expect(html).toContain('<html lang="en">');
  expect(html).toContain('<title>QuickReminder · A reminder, straight out of the notch</title>');
  expect(html).toContain('<meta name="description" content="QuickReminder is a free, open-source macOS 26 app that opens a reminder panel out of the MacBook notch. Try it in the browser." />');
  expect(html).toContain('<meta name="theme-color" content="#0A0A0A" />');
  expect(html).toContain('<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png" />');
  expect(html).toContain('<link rel="apple-touch-icon" href="/apple-touch-icon.png" />');
  expect(html).toContain('<meta property="og:url" content="https://quickreminder.jholec.com/" />');
});
