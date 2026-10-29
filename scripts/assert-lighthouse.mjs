// Asserts the landing's Lighthouse budget (landing spec §9) on a Lighthouse JSON report.
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const BUDGET = { performance: 0.95, cls: 0.01 }; // landing §9: ≥ 95 performance on desktop, no layout shift from the hero

/** A missing score or audit reads as NaN, which fails both comparisons. */
export function checkReport(report) {
  const performance = report?.categories?.performance?.score ?? NaN;
  const cls = report?.audits?.['cumulative-layout-shift']?.numericValue ?? NaN;
  const ok = performance >= BUDGET.performance && cls < BUDGET.cls;
  return { ok, performance, cls, message: `performance ${performance} · CLS ${cls}` };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const path = process.argv[2];
  if (!path) {
    console.error('usage: node scripts/assert-lighthouse.mjs <report.json>');
    process.exit(1);
  }
  const result = checkReport(JSON.parse(readFileSync(path, 'utf8')));
  console.log(result.message);
  if (!result.ok) {
    console.error(`over budget: performance ≥ ${BUDGET.performance} and CLS < ${BUDGET.cls} required`);
  }
  process.exit(result.ok ? 0 : 1);
}
