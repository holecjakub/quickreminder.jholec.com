// Floating nav pill (landing §7): GitHub + Download, tucked under the desktop's menu bar, hidden once the hero is gone.
import { useEffect, useState, type CSSProperties } from 'react';
import { SCENE } from '../desktop/scene';
import { useMediaQuery } from '../desktop/useMediaQuery';
import { CAMERA, heroPt, type Viewport } from './stageCamera';

export const LINKS: {
  readonly appRepo: 'https://github.com/holecjakub/QuickReminder';
  readonly releasesLatest: 'https://github.com/holecjakub/QuickReminder/releases/latest';
  readonly siteRepo: 'https://github.com/holecjakub/quickreminder.jholec.com';
  readonly jholec: 'https://jholec.com';
  readonly notice: 'https://github.com/holecjakub/QuickReminder/blob/main/NOTICE.md';
  readonly license: 'https://github.com/holecjakub/QuickReminder/blob/main/LICENSE';
  readonly raycastScript: 'https://github.com/holecjakub/QuickReminder/tree/main/Scripts/raycast';
} = {
  appRepo: 'https://github.com/holecjakub/QuickReminder',
  releasesLatest: 'https://github.com/holecjakub/QuickReminder/releases/latest',
  siteRepo: 'https://github.com/holecjakub/quickreminder.jholec.com',
  jholec: 'https://jholec.com',
  notice: 'https://github.com/holecjakub/QuickReminder/blob/main/NOTICE.md',
  license: 'https://github.com/holecjakub/QuickReminder/blob/main/LICENSE',
  raycastScript: 'https://github.com/holecjakub/QuickReminder/tree/main/Scripts/raycast',
};

export const NAV_HIDE_AFTER_VH = 0.6 as const;

/** ≥ 810: on the desktop's top-right, under its menu bar; phone: a fixed corner. */
export function navPosition(viewport: Viewport): { top: number; right: number } {
  if (viewport.width < CAMERA.phoneBreakpoint) return { top: 12, right: 16 };
  const pt = heroPt(viewport);
  const sceneTop = (viewport.height - SCENE.height * pt) / 2;
  const sceneGapX = (viewport.width - SCENE.width * pt) / 2;
  return { top: sceneTop + SCENE.menuBarHeight * pt + 12, right: sceneGapX + 16 };
}

const readViewport = (): Viewport => ({ width: window.innerWidth, height: window.innerHeight });
const isHidden = (): boolean => window.scrollY > NAV_HIDE_AFTER_VH * window.innerHeight;

export function Nav(): JSX.Element {
  const [viewport, setViewport] = useState<Viewport>(readViewport);
  const [hidden, setHidden] = useState<boolean>(isHidden);
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');

  useEffect(() => {
    const onScroll = () => setHidden(isHidden());
    const onResize = () => {
      setViewport(readViewport());
      setHidden(isHidden());
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  const { top, right } = navPosition(viewport);
  const pill: CSSProperties = {
    position: 'fixed',
    top,
    right,
    zIndex: 50,
    display: 'flex',
    alignItems: 'center',
    height: 36,
    padding: '0 6px',
    borderRadius: 999,
    background: 'rgba(10, 10, 10, 0.72)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    opacity: hidden ? 0 : 1,
    transform: hidden && !reducedMotion ? 'translateY(-8px)' : 'none',
    pointerEvents: hidden ? 'none' : 'auto',
    transition: 'opacity 200ms ease-out, transform 200ms ease-out',
  };
  const link: CSSProperties = {
    padding: '0 14px',
    fontSize: 14,
    fontWeight: 500,
    color: '#fff',
    textDecoration: 'none',
  };
  const tabIndex = hidden ? -1 : undefined;

  return (
    <nav aria-label="Primary" data-hidden={hidden ? 'true' : 'false'} style={pill}>
      <a href={LINKS.appRepo} style={link} tabIndex={tabIndex}>
        GitHub
      </a>
      <span aria-hidden="true" style={{ color: 'rgba(255, 255, 255, 0.5)' }}>
        ·
      </span>
      <a href="#download" style={link} tabIndex={tabIndex}>
        Download
      </a>
    </nav>
  );
}
