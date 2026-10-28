import { defineConfig } from 'vitest/config';

// Pacific/Auckland is far from Prague and has its own DST, so any accidental use of the host
// time zone in recreation/core or recreation/machine breaks a test. UI test files opt into
// jsdom with `// @vitest-environment jsdom`.
export default defineConfig({
  test: {
    globals: true,
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    environment: 'node',
    env: { TZ: 'Pacific/Auckland' },
  },
});
