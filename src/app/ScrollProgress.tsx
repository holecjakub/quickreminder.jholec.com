// Page-long scroll progress bar (landing §7): a 2 px accent line at the very top, decorative only.
import { useEffect, useRef } from 'react';
import { ScrollTrigger } from './gsap';

const clamp01 = (p: number): number => Math.min(1, Math.max(0, p));

export function progressTransform(progress: number): string {
  return `scaleX(${clamp01(progress)})`;
}

export function ScrollProgress(): JSX.Element {
  const bar = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const trigger = ScrollTrigger.create({
      start: 0,
      end: 'max',
      onUpdate: (self: { progress: number }) => {
        if (bar.current) bar.current.style.transform = progressTransform(self.progress);
      },
    });
    return () => trigger.kill();
  }, []);

  return (
    <div
      ref={bar}
      aria-hidden="true"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: 'var(--jh-progress-height)',
        background: 'var(--jh-accent)',
        transform: progressTransform(0),
        transformOrigin: '0 50%',
        zIndex: 100,
        pointerEvents: 'none',
      }}
    />
  );
}
