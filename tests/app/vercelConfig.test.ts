import { readFileSync } from 'node:fs';

const cfg = JSON.parse(readFileSync('vercel.json', 'utf8'));

it('static Vite build', () =>
  expect(cfg).toMatchObject({ framework: 'vite', buildCommand: 'npm run build', outputDirectory: 'dist', cleanUrls: true, trailingSlash: false }));

it('hashed assets are immutable', () =>
  expect(cfg.headers).toContainEqual({ source: '/assets/(.*)', headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }] }));

it('security headers on every path', () => {
  const all = cfg.headers.find((h: { source: string }) => h.source === '/(.*)').headers;
  expect(all).toEqual([
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
    { key: 'X-Frame-Options', value: 'DENY' },
  ]);
});

it('README names the flags and the deploy rule', () => {
  const readme = readFileSync('README.md', 'utf8');
  for (const s of [
    '?now=',
    '?debug=motion',
    'npm run e2e',
    'npm run lighthouse',
    '`main` deploys to production',
    'cname.vercel-dns.com',
    'Not affiliated with, endorsed by or sponsored by Apple Inc.',
  ])
    expect(readme).toContain(s);
});
