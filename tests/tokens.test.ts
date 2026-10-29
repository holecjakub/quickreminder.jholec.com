import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('../src/tokens.css', import.meta.url), 'utf8');
const tokens = new Map([...css.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2]?.trim()]));

describe('tokens.css', () => {
  it.each([
    // page, landing spec §8 / jholec.com
    ['--jh-white', '#FFFFFF'], ['--jh-black', '#0A0A0A'], ['--jh-black-light', '#121212'],
    ['--jh-gray-light', '#EBEBEB'], ['--jh-gray-light-90', 'rgba(235, 235, 235, 0.9)'],
    ['--jh-gray-medium', '#757575'], ['--jh-gray', '#A8A8A8'], ['--jh-gray-dark', '#4D4D4D'],
    ['--jh-accent', '#0099FF'], ['--jh-text-label', '14px'], ['--jh-text-body', '16px'],
    ['--jh-text-body-l', '18px'], ['--jh-text-h3', '24px'], ['--jh-text-h2', '32px'], ['--jh-text-h1', '54px'],
    ['--jh-space-140', '140px'], ['--jh-space-160', '160px'], ['--jh-radius', '16px'], ['--jh-progress-height', '2px'],
    // recreation, Views/Theme.swift
    ['--pt', '1'], ['--qr-black', '#000000'], ['--qr-accent', '#0A84FF'], ['--qr-placeholder', '#59595D'],
    ['--qr-dashed-ring', '#59595D'], ['--qr-gray-circle', '#59595D'], ['--qr-gray-circle-disabled', '#474749'],
    ['--qr-pill-fill', 'rgba(255, 255, 255, 0.03)'], ['--qr-pill-stroke', '#3D3D3F'],
    ['--qr-flag-orange', '#FF9E0A'], ['--qr-error-red', '#FF453A'], ['--qr-padding', '20'], ['--qr-control-radius', '12'],
    ['--qr-list-reminders', '#0A84FF'], ['--qr-list-work', '#BF5AF2'], ['--qr-list-home', '#FF9F0A'],
    ['--qr-list-groceries', '#30D158'], ['--qr-list-ideas', '#FF375F'],
  ])('%s is %s', (name, value) => expect(tokens.get(name)).toBe(value));

  it('recreation font stack is the system stack (landing spec §3)', () =>
    expect(tokens.get('--qr-font')).toBe('-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Helvetica Neue", Inter, sans-serif'));
});
