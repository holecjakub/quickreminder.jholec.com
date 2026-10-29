import { checkReport } from '../../scripts/assert-lighthouse.mjs';

const report = (score: number, cls: number) => ({ categories: { performance: { score } }, audits: { 'cumulative-layout-shift': { numericValue: cls } } });

it('passes at 0.95 and no shift', () => expect(checkReport(report(0.95, 0))).toMatchObject({ ok: true, performance: 0.95, cls: 0 }));
it('fails below 0.95', () => expect(checkReport(report(0.94, 0)).ok).toBe(false));
it('fails on a layout shift of 0.01', () => expect(checkReport(report(0.99, 0.01)).ok).toBe(false));
it('message', () => expect(checkReport(report(0.97, 0.002)).message).toBe('performance 0.97 · CLS 0.002'));
