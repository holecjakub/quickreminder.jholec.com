import { expect, it } from 'vitest';
it('runs in a non-Prague time zone so core code cannot lean on the host zone', () =>
  expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe('Pacific/Auckland'));
