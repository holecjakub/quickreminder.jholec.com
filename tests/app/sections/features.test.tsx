// @vitest-environment jsdom
import { act, cleanup, render, screen, within } from '@testing-library/react';
import { FEATURE_COPY, HERO_COPY, INTEGRATIONS_COPY, sectionTitle } from '../../../src/app/choreography/copy';
import { ScrollTrigger } from '../../../src/app/gsap';
import { Features } from '../../../src/app/sections/Features';
import { Stage } from '../../../src/app/Stage';
import { installMatchMedia } from '../../fakes/matchMedia';

vi.mock('../../../src/app/gsap', () => import('../../fakes/gsapMock'));
vi.mock('../../../src/recreation', () => import('../../fakes/recreationMock'));
vi.mock('../../../src/app/choreography/reconcile', () => ({
  reconcile: vi.fn(async () => ({ performed: 'none', keptVisitorEdits: false, aborted: false })),
}));

const DESKTOP = '(min-width: 810px)';

async function mount(matches: Record<string, boolean> = {}) {
  installMatchMedia(matches);
  const view = render(
    <Stage title="" subtitle="">
      <Features />
    </Stage>,
  );
  await act(async () => {});
  return view;
}

/** The element whose whole text is `text` (the label spans two nodes: the mono number and the rest). */
function byWholeText(tag: string, text: string): HTMLElement {
  return screen.getByText((_, el) => el?.tagName === tag && el.textContent === text);
}

beforeEach(() => {
  vi.clearAllMocks();
});
afterEach(() => {
  cleanup();
});

it('headlines are the spec’s, in order', () => {
  expect(FEATURE_COPY.map((c) => c.headline)).toEqual([
    'One shortcut.',
    'Say when.',
    'Set the date in the notch.',
    'Your lists, your colour.',
    'Flag it, pin it.',
    'Save, and it flies home.',
  ]);
  expect(FEATURE_COPY.map((c) => c.id)).toEqual(['01', '02', '03', '04', '05', '06']);
  expect(INTEGRATIONS_COPY.headline).toBe('Everywhere you already are.');
  expect(HERO_COPY.title).toBe('A reminder, straight out of the notch.');
});

it('sectionTitle', () => expect(sectionTitle('02', 'Dates')).toBe('(02) Dates /'));

it('every section has 2–3 bullets', () => {
  [...FEATURE_COPY, INTEGRATIONS_COPY].forEach((c) => {
    if (c.id !== '07') expect(c.bullets.length).toBeGreaterThanOrEqual(2);
    expect(c.bullets.length).toBeLessThanOrEqual(3);
  });
});

it('02 shows the Czech example', () => expect(FEATURE_COPY[1]!.secondary).toBe('Czech works too: “zavolat mámě zítra ve 14:00”.'));

it('renders each section with label, h2 and bullets', async () => {
  const { container } = await mount();
  const sections = [...container.querySelectorAll('section[aria-labelledby]')];
  expect(sections.map((s) => s.id)).toEqual(['feature-01', 'feature-02', 'feature-03', 'feature-04', 'feature-05', 'feature-06']);
  sections.forEach((section, i) => {
    const heading = section.querySelector('h2')!;
    expect(section.getAttribute('aria-labelledby')).toBe(heading.id);
    expect(heading.textContent).toBe(FEATURE_COPY[i]!.headline);
  });

  const label = byWholeText('P', '(01) Shortcut /');
  const number = within(label).getByText('(01)');
  expect(number.tagName).toBe('SPAN');
  expect(number.style.fontFamily).toBe('var(--jh-font-mono)');

  const heading = screen.getByRole('heading', { level: 2, name: 'Say when.' });
  const section = heading.closest('section')!;
  expect(section.id).toBe('feature-02');
  const items = within(section).getAllByRole('listitem');
  expect(items.map((li) => li.textContent)).toEqual(FEATURE_COPY[1]!.bullets.map((b) => b.text));
  for (const li of items) expect(li.querySelector('svg')!.getAttribute('aria-hidden')).toBe('true');
});

it('the Czech example is marked lang="cs"', async () => {
  await mount();
  const example = screen.getByText('zavolat mámě zítra ve 14:00');
  expect(example.getAttribute('lang')).toBe('cs');
  expect(example.closest('p')!.textContent).toBe(FEATURE_COPY[1]!.secondary);
});

it('typography: label 14/500 muted, headline 24/600, paragraph 18/500, bullets 16/500', async () => {
  await mount();
  const label = byWholeText('P', '(02) Dates /');
  expect(label.style.fontSize).toBe('var(--jh-text-label)');
  expect(label.style.fontWeight).toBe('500');
  expect(label.style.color).toBe('var(--jh-muted)');

  const heading = screen.getByRole('heading', { level: 2, name: 'Say when.' });
  expect(heading.style.fontSize).toBe('var(--jh-text-h3)');
  expect(heading.style.fontWeight).toBe('600');
  expect(heading.style.lineHeight).toBe('var(--jh-leading-heading)');
  expect(heading.style.color).toBe('var(--jh-fg)');

  const paragraph = heading.nextElementSibling as HTMLElement;
  expect(paragraph.tagName).toBe('P');
  expect(paragraph.textContent).toBe(FEATURE_COPY[1]!.paragraph);
  expect(paragraph.style.fontSize).toBe('var(--jh-text-body-l)');
  expect(paragraph.style.fontWeight).toBe('500');
  expect(paragraph.style.lineHeight).toBe('var(--jh-leading-body)');

  const bullet = screen.getByText(FEATURE_COPY[1]!.bullets[0]!.text);
  expect(bullet.tagName).toBe('SPAN');
  expect(bullet.style.fontSize).toBe('var(--jh-text-body)');
  expect(bullet.style.fontWeight).toBe('500');
});

it('≥ 810 px: each section fills the viewport height with its copy centred', async () => {
  const { container } = await mount({ [DESKTOP]: true });
  const section = container.querySelector<HTMLElement>('#feature-01')!;
  expect(section.style.minHeight).toBe('100svh');
  expect(section.style.display).toBe('flex');
  expect(section.style.flexDirection).toBe('column');
  expect(section.style.justifyContent).toBe('center');
  expect(section.style.padding).toBe('80px var(--jh-page-margin-x) 80px 40px');
});

it('< 810 px: sections flow below the stage and the column ends with the section gap', async () => {
  const { container } = await mount();
  const section = container.querySelector<HTMLElement>('#feature-01')!;
  expect(section.style.minHeight).toBe('');
  expect(section.style.padding).toBe('80px var(--jh-page-margin-x) 0');
  const column = section.parentElement!;
  expect(column.style.paddingBottom).toBe('var(--jh-section-gap)');
});

/** The section triggers (the Stage's own camera trigger on the runway is created too). */
const sectionTriggerCalls = () =>
  vi.mocked(ScrollTrigger.create).mock.calls.filter(([vars]) => (vars.trigger as Element).tagName === 'SECTION');

it('registers 01…06 with the driver (one ScrollTrigger each)', async () => {
  const { container } = await mount();
  const calls = sectionTriggerCalls();
  expect(calls).toHaveLength(6);
  const sections = [...container.querySelectorAll('section[aria-labelledby]')];
  expect(calls.map(([vars]) => vars.trigger)).toEqual(sections);
});

it('< 810 px: sections start at 78 % of the viewport (the centre lies under the band)', async () => {
  await mount();
  const calls = sectionTriggerCalls();
  expect(calls).toHaveLength(6);
  expect(calls.every(([vars]) => vars.start === 'top 78%')).toBe(true);
});

it('≥ 810 px: sections start at the viewport centre', async () => {
  await mount({ [DESKTOP]: true });
  const calls = sectionTriggerCalls();
  expect(calls).toHaveLength(6);
  expect(calls.every(([vars]) => vars.start === 'top center')).toBe(true);
});
