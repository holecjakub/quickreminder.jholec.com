import { NotchLayout } from '../../src/recreation/machine/notchLayout';
import {
  CAMERA,
  cameraFor,
  cameraTransform,
  clipFor,
  featuresPt,
  featuresScale,
  heroPt,
  heroScreenRect,
  phoneHeroPt,
  phoneNotchPt,
  phoneSectionLeadPx,
  phoneStageHeight,
  phoneTitleOpacityFor,
  pinnedColumnWidth,
  renderPtFor,
  runwayVhFor,
  titleOpacityFor,
  type Camera,
} from '../../src/app/stageCamera';

const V1440 = { width: 1440, height: 900 }, V1280 = { width: 1280, height: 800 }, V1920 = { width: 1920, height: 1080 }, V1024 = { width: 1024, height: 700 }, V390 = { width: 390, height: 844 };
const close = (c: Camera, e: Partial<Record<keyof Camera, number>>) => Object.entries(e).forEach(([k, v]) => expect(c[k as keyof Camera]).toBeCloseTo(v!, 3));

it('pinned column is 58 % on desktop, full width on phones', () => { expect(pinnedColumnWidth(V1440)).toBe(835); expect(pinnedColumnWidth(V1280)).toBe(742); expect(pinnedColumnWidth(V390)).toBe(390); });
it('heroPt fits the whole MacBook (1700 × 1070) inside the gutters and the air', () => { expect(heroPt(V1440)).toBeCloseTo(804 / 1070, 6); expect(heroPt(V1920)).toBeCloseTo(984 / 1070, 6); expect(heroPt(V1024)).toBeCloseTo(604 / 1070, 6); expect(heroPt({ width: 1200, height: 1000 })).toBeCloseTo(1152 / 1700, 6); });
it('heroScreenRect centres the MacBook and puts the screen inside the bezel', () => { const r = heroScreenRect(V1440); expect(r.pt).toBeCloseTo(0.751402, 6); expect(r.x).toBeCloseTo(720 - 756 * r.pt, 6); expect(r.y).toBeCloseTo(48 + 18 * r.pt, 6); });
it('featuresPt is 1 px per pt, clamped to [0.75, 1]', () => { expect(featuresPt(835)).toBe(1); expect(featuresPt(742)).toBeCloseTo(0.976316, 6); expect(featuresPt(500)).toBe(0.75); });
it('featuresScale also fits the calendar height', () => {
  expect(featuresScale(V1440, 835)).toBe(1);
  expect(featuresScale({ width: 1440, height: 600 }, 835)).toBeCloseTo(Math.max(0.75, 512 / NotchLayout.scheduleCalendarSize.height), 6);
  expect(featuresScale({ width: 1440, height: 500 }, 835)).toBe(0.75);
});
it('1440 × 900 hero: the whole MacBook, 48 px of air, screen under the bezel', () => close(cameraFor(0, V1440, 835), { scale: 0.751402, originX: 720, originY: 61.5252, translateX: 151.9402, translateY: 61.5252 }));
it('1440 × 900 halfway to the overview', () => close(cameraFor(0.3125, V1440, 835), { scale: 0.646206, originX: 720, originY: 86.9448, translateX: 231.4686 }));
it('1440 × 900 overview: 72 % of the hero, centred at 42 % of the height', () => close(cameraFor(0.625, V1440, 835), { scale: 0.541009, originX: 720, originY: 112.3644, translateX: 310.9969 }));
it('1440 × 900 halfway to the notch', () => close(cameraFor(0.8125, V1440, 835), { scale: 0.770505, originX: 568.75, originY: 88.1822, translateX: -13.7515 }));
it('1440 × 900 features: 1 px per pt, notch at the column centre, 64 px down', () => close(cameraFor(1, V1440, 835), { scale: 1, originX: 417.5, originY: 64, translateX: -338.5, translateY: 64 }));
// R-04: the 751 pt calendar clamps the features scale at 800 px tall: (800 − 64 − 24) / 751.
it('1280 × 800 features', () => close(cameraFor(1, V1280, 742), { scale: 0.948069, originX: 371, translateX: -345.740 }));
it('1920 × 1080 hero and features', () => { close(cameraFor(0, V1920, 1114), { scale: 0.919626, translateX: 264.7626, translateY: 64.5533 }); close(cameraFor(1, V1920, 1114), { scale: 1, originX: 557, translateX: -199 }); });
it('1024 × 700 features keep the 0.75 floor out of reach', () => close(cameraFor(1, V1024, 594), { scale: 0.781579, translateX: -293.8737 }));
it('progress is clamped', () => { expect(cameraFor(-1, V1440, 835)).toEqual(cameraFor(0, V1440, 835)); expect(cameraFor(2, V1440, 835)).toEqual(cameraFor(1, V1440, 835)); });
it('renderPtFor is the sharper of hero and features', () => { expect(renderPtFor(V1440, 835)).toBe(1); expect(renderPtFor(V1920, 1114)).toBe(1); expect(renderPtFor({ width: 2560, height: 1600 }, 1485)).toBeCloseTo(1504 / 1070, 6); });
it('clipFor crops to the pinned column in the second half', () => { expect(clipFor(0.5, V1440, 835).right).toBe(0); expect(clipFor(0.8125, V1440, 835).right).toBeCloseTo(302.5, 6); expect(clipFor(1, V1440, 835).right).toBe(605); expect(clipFor(1, V390, 390).right).toBe(0); });
it('titleOpacityFor', () => { expect(titleOpacityFor(0.3)).toBe(0); expect(titleOpacityFor(0.45)).toBeCloseTo(0.5, 6); expect(titleOpacityFor(0.6)).toBe(1); expect(titleOpacityFor(0.775)).toBeCloseTo(0.5, 6); expect(titleOpacityFor(0.9)).toBe(0); });
it('cameraTransform', () => expect(cameraTransform(cameraFor(0, V1440, 835), 1)).toBe('translate3d(151.94px, 61.53px, 0) scale(0.75140)'));

const V390S = { width: 390, height: 667 };
const V740L = { width: 740, height: 360 };
it('phoneStageHeight is 56 svh', () => expect(phoneStageHeight(V390)).toBeCloseTo(472.64, 6));
it('phoneHeroPt fits the MacBook into the band under the nav and above the title', () => {
  expect(phoneHeroPt(V390)).toBeCloseTo(358 / 1700, 6);
  expect(phoneHeroPt(V390S)).toBeCloseTo((0.56 * 667 - 160) / 1070, 6);
});
it('phoneHeroPt stays positive on a very short viewport (landscape 740 × 250: the band under the nav is negative)', () => {
  const short = { width: 740, height: 250 };
  expect(0.56 * short.height - 160).toBeLessThan(0);
  expect(phoneHeroPt(short)).toBe(0.05);
  expect(cameraFor(0, short, 740).scale).toBeGreaterThan(0);
});
it('phoneNotchPt fills the width with the panel, clamped to the calendar and the 0.4 floor', () => {
  expect(phoneNotchPt(V390)).toBeCloseTo((0.56 * 844 - 44) / 751, 6);
  expect(phoneNotchPt(V390S)).toBeCloseTo((0.56 * 667 - 44) / 751, 6);
  expect(phoneNotchPt(V740L)).toBe(0.4);
});
it('390 × 844 hero', () => close(cameraFor(0, V390, 390), { scale: 0.210588, originX: 195, originY: 111.446, translateX: 35.7953, translateY: 111.446 }));
it('390 × 844 midway', () => close(cameraFor(0.5, V390, 390), { scale: 0.390674, originX: 195, originY: 69.723, translateX: -100.349 }));
it('390 × 844 notch: the panel fills the width, notch top at 28 px', () => close(cameraFor(1, V390, 390), { scale: 0.570759, originX: 195, originY: 28, translateX: -236.494, translateY: 28 }));
it('phone progress is clamped and never clips', () => {
  expect(cameraFor(-1, V390, 390)).toEqual(cameraFor(0, V390, 390));
  expect(cameraFor(2, V390, 390)).toEqual(cameraFor(1, V390, 390));
  expect(clipFor(0.5, V390, 390).right).toBe(0);
});
it('renderPtFor on phones is the notch scale', () => expect(renderPtFor(V390, 390)).toBeCloseTo(0.570759, 6));
it('phoneTitleOpacityFor fades over the first half', () => { expect(phoneTitleOpacityFor(0)).toBe(1); expect(phoneTitleOpacityFor(0.25)).toBeCloseTo(0.5, 6); expect(phoneTitleOpacityFor(0.5)).toBe(0); expect(phoneTitleOpacityFor(1)).toBe(0); });
it('runwayVhFor', () => { expect(runwayVhFor(V390)).toBe(100); expect(runwayVhFor(V1440)).toBe(160); });
it('the layout flag on the viewport decides the camera, not the width', () => {
  const wideButPhone = { ...V1440, phone: true };
  const narrowButDesktop = { ...V390, phone: false };
  expect(runwayVhFor(wideButPhone)).toBe(100);
  expect(runwayVhFor(narrowButDesktop)).toBe(160);
  expect(pinnedColumnWidth(wideButPhone)).toBe(1440);
  expect(pinnedColumnWidth(narrowButDesktop)).toBe(226);
  expect(renderPtFor(wideButPhone, 1440)).toBeCloseTo(phoneNotchPt(V1440), 6);
  expect(clipFor(1, narrowButDesktop, 226).right).toBe(390 - 226);
  expect(cameraFor(1, wideButPhone, 1440).originY).toBe(28);
});
it('phoneSectionLeadPx keeps the first section behind the zoom: 78 % of the viewport, the trigger share', () => {
  expect(phoneSectionLeadPx(V390)).toBeCloseTo(658.32, 6);
  expect(CAMERA.phoneSectionStart).toBe(`top ${CAMERA.phoneSectionLeadPercent}%`);
});
