// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import { RemindersWindow, WINDOW_COPY, WINDOW_DELAY_S, WINDOW_SPRING, type RemindersWindowProps } from '../../src/desktop/RemindersWindow';
import type { SavedReminder } from '../../src/recreation';
import { springFromResponse } from '../../src/recreation/machine/springs';

afterEach(cleanup);

const ITEM: SavedReminder = {
  id: 'a',
  title: 'Call mum',
  notes: '📍 Office',
  listId: 'work',
  listColor: '#BF5AF2',
  dueDate: new Date('2026-10-24T12:00:00Z'),
  dueLabel: 'Tomorrow, 2:00 PM',
  flagged: true,
  savedAt: new Date('2026-10-23T08:00:00Z'),
};

function props(overrides: Partial<RemindersWindowProps> = {}): RemindersWindowProps {
  return { items: [ITEM], scheme: 'light', pt: 1, reduceMotion: false, ...overrides };
}
const region = () => screen.getByRole('region', { name: 'Your reminders' });

describe('<RemindersWindow>', () => {
  it('WINDOW_SPRING equals the chip spring', () => {
    const s = springFromResponse(0.3, 0.8);
    expect(WINDOW_SPRING.type).toBe('spring');
    expect(WINDOW_SPRING.mass).toBe(1);
    expect(WINDOW_SPRING.stiffness).toBeCloseTo(s.stiffness, 2);
    expect(WINDOW_SPRING.damping).toBeCloseTo(s.damping, 2);
  });

  it('pins the delay and the copy', () => {
    expect(WINDOW_DELAY_S).toBe(0.2);
    expect(WINDOW_COPY).toEqual({
      title: 'Your reminders',
      footnote: 'Saved in this demo only. Nothing leaves your browser.',
    });
  });

  it('renders nothing before the first save', () => {
    const { container } = render(<RemindersWindow {...props({ items: [] })} />);
    expect(container.firstChild).toBeNull();
  });

  it('is a region named "Your reminders" at x 790, y 330, 320 pt wide', () => {
    render(<RemindersWindow {...props()} />);
    const el = region();
    expect(el.style.left).toBe('calc(790 * var(--pt) * 1px)');
    expect(el.style.top).toBe('calc(330 * var(--pt) * 1px)');
    expect(el.style.width).toBe('calc(320 * var(--pt) * 1px)');
    expect(screen.getByText(WINDOW_COPY.footnote)).toBeTruthy();
  });

  it('shows title, list dot, due label, flag and notes', () => {
    const { container } = render(<RemindersWindow {...props()} />);
    expect(screen.getByText('Call mum')).toBeTruthy();
    const dot = container.querySelector('[data-list-dot]') as HTMLElement;
    expect(dot.style.backgroundColor).toBe('rgb(191, 90, 242)');
    expect(dot.style.width).toBe('calc(10 * var(--pt) * 1px)');
    expect(dot.style.height).toBe('calc(10 * var(--pt) * 1px)');
    expect(screen.getByText('Tomorrow, 2:00 PM')).toBeTruthy();
    expect(screen.getByLabelText('Flagged')).toBeTruthy();
    expect(screen.getByText('📍 Office')).toBeTruthy();
  });

  it('lists the newest first and shows the count', () => {
    const later: SavedReminder = { ...ITEM, id: 'b', title: 'Buy milk', savedAt: new Date('2026-10-23T09:00:00Z') };
    render(<RemindersWindow {...props({ items: [ITEM, later] })} />);
    const rows = within(region()).getAllByRole('listitem');
    expect(rows.map((r) => within(r).getByText(/Buy milk|Call mum/).textContent)).toEqual(['Buy milk', 'Call mum']);
    expect(screen.getByText('2')).toBeTruthy();
  });

  it('omits the flag and the notes line when absent', () => {
    const { container } = render(<RemindersWindow {...props({ items: [{ ...ITEM, flagged: false, notes: null }] })} />);
    expect(screen.queryByLabelText('Flagged')).toBeNull();
    expect(container.querySelector('[data-notes]')).toBeNull();
  });

  it('uses the dark palette', () => {
    render(<RemindersWindow {...props({ scheme: 'dark' })} />);
    expect(region().style.background).toBe('rgba(28, 28, 30, 0.86)');
    expect(region().style.color).toBe('rgb(245, 245, 247)');
  });

  it('uses the light palette', () => {
    render(<RemindersWindow {...props()} />);
    expect(region().style.background).toBe('rgba(255, 255, 255, 0.86)');
    expect(region().style.color).toBe('rgb(29, 29, 31)');
  });
});
