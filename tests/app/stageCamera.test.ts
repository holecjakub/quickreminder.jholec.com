import { NotchLayout } from '../../src/recreation/machine/notchLayout';
import {
  type Camera,
  cameraFor,
  cameraTransform,
  clipFor,
  featuresPt,
  featuresScale,
  heroPt,
  phoneStageHeight,
  pinnedColumnWidth,
  renderPtFor,
  titleOpacityFor,
} from '../../src/app/stageCamera';

const V1440 = { width: 1440, height: 900 }, V1280 = { width: 1280, height: 800 }, V1920 = { width: 1920, height: 1080 }, V1024 = { width: 1024, height: 700 }, V390 = { width: 390, height: 844 };
const close = (c: Camera, e: Partial<Record<keyof Camera, number>>) => Object.entries(e).forEach(([k, v]) => expect(c[k as keyof Camera]).toBeCloseTo(v!, 3));

it('pinned column is 58 % on desktop, full width on phones', () => { expect(pinnedColumnWidth(V1440)).toBe(835); expect(pinnedColumnWidth(V1280)).toBe(742); expect(pinnedColumnWidth(V390)).toBe(390); });
it('heroPt letterboxes the 16:10 screen', () => { expect(heroPt(V1440)).toBeCloseTo(0.916497, 6); expect(heroPt(V1920)).toBeCloseTo(1.099796, 6); expect(heroPt(V1024)).toBeCloseTo(0.677249, 6); });
it('featuresPt is 1 px per pt, clamped to [0.75, 1]', () => { expect(featuresPt(835)).toBe(1); expect(featuresPt(742)).toBeCloseTo(0.976316, 6); expect(featuresPt(500)).toBe(0.75); });
it('featuresScale also fits the calendar height', () => {
  expect(featuresScale(V1440, 835)).toBe(1);
  expect(featuresScale({ width: 1440, height: 600 }, 835)).toBeCloseTo(Math.max(0.75, 512 / NotchLayout.scheduleCalendarSize.height), 6);
  expect(featuresScale({ width: 1440, height: 500 }, 835)).toBe(0.75);
});
it('1440 × 900 hero', () => close(cameraFor(0, V1440, 835), { scale: 0.916497, originX: 720, originY: 0, translateX: 27.1283, translateY: 0, frameOpacity: 0, pageReveal: 0 }));
it('1440 × 900 halfway to the overview', () => close(cameraFor(0.3125, V1440, 835), { scale: 0.742363, originX: 720, originY: 49.5, translateX: 158.7739, frameOpacity: 0.5, pageReveal: 0.5 }));
it('1440 × 900 overview', () => close(cameraFor(0.625, V1440, 835), { scale: 0.568228, originX: 720, originY: 99, translateX: 290.4196, frameOpacity: 1 }));
it('1440 × 900 halfway to the notch', () => close(cameraFor(0.8125, V1440, 835), { scale: 0.784114, originX: 568.75, originY: 81.5, translateX: -24.0402 }));
it('1440 × 900 features: 1 px per pt, notch at the column centre, 64 px down', () => close(cameraFor(1, V1440, 835), { scale: 1, originX: 417.5, originY: 64, translateX: -338.5, translateY: 64, frameOpacity: 1, pageReveal: 1 }));
// R-04: the 751 pt calendar clamps the features scale at 800 px tall: (800 − 64 − 24) / 751.
it('1280 × 800 features', () => close(cameraFor(1, V1280, 742), { scale: 0.948069, originX: 371, translateX: -345.740 }));
it('1920 × 1080 hero and features', () => { close(cameraFor(0, V1920, 1114), { scale: 1.099796, translateX: 128.554, translateY: 0 }); close(cameraFor(1, V1920, 1114), { scale: 1, originX: 557, translateX: -199 }); });
it('1024 × 700 features keep the 0.75 floor out of reach', () => close(cameraFor(1, V1024, 594), { scale: 0.781579, translateX: -293.8737 }));
it('progress is clamped', () => { expect(cameraFor(-1, V1440, 835)).toEqual(cameraFor(0, V1440, 835)); expect(cameraFor(2, V1440, 835)).toEqual(cameraFor(1, V1440, 835)); });
it('phones ignore progress', () => { const c = cameraFor(0.4, V390, 390); close(c, { scale: 0.231266, originX: 195, originY: 68.1628, translateX: 20.1628, frameOpacity: 1, pageReveal: 1 }); expect(cameraFor(1, V390, 390)).toEqual(c); });
it('renderPtFor is the sharper of hero and features', () => { expect(renderPtFor(V1440, 835)).toBe(1); expect(renderPtFor(V1920, 1114)).toBeCloseTo(1.099796, 6); expect(renderPtFor(V390, 390)).toBeCloseTo(0.231266, 6); });
it('clipFor crops to the pinned column in the second half', () => { expect(clipFor(0.5, V1440, 835).right).toBe(0); expect(clipFor(0.8125, V1440, 835).right).toBeCloseTo(302.5, 6); expect(clipFor(1, V1440, 835).right).toBe(605); expect(clipFor(1, V390, 390).right).toBe(0); });
it('titleOpacityFor', () => { expect(titleOpacityFor(0.3)).toBe(0); expect(titleOpacityFor(0.45)).toBeCloseTo(0.5, 6); expect(titleOpacityFor(0.6)).toBe(1); expect(titleOpacityFor(0.775)).toBeCloseTo(0.5, 6); expect(titleOpacityFor(0.9)).toBe(0); });
it('phoneStageHeight', () => expect(phoneStageHeight(390)).toBeCloseTo(64 + 1070 * (358 / 1548) + 16, 6));
it('cameraTransform', () => expect(cameraTransform(cameraFor(0, V1440, 835), 1)).toBe('translate3d(27.13px, 0.00px, 0) scale(0.91650)'));
