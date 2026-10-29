// Section 07 (landing §7.3): four dark cards and a faux terminal with a Copy button. Static, outside the stage.
import { Check, Copy } from '@phosphor-icons/react';
import { Fragment, useEffect, useRef, useState, type CSSProperties, type JSX, type ReactNode } from 'react';
import { useMediaQuery } from '../../desktop/useMediaQuery';
import { INTEGRATIONS_COPY, sectionTitle } from '../choreography/copy';
import { LINKS } from '../Nav';
import { CAMERA } from '../stageCamera';

export const COPIED_MS = 1600 as const;

const TABLET_QUERY = `(min-width: ${CAMERA.phoneBreakpoint}px)`;
const DESKTOP_QUERY = '(min-width: 1200px)';
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
const CARET_KEYFRAMES = '@keyframes qr-caret-blink { 50% { opacity: 0 } }';
const GRAY = 'var(--jh-gray)';

const sectionStyle: CSSProperties = { padding: 'var(--jh-section-gap) var(--jh-page-margin-x)' };
const innerStyle: CSSProperties = { maxWidth: 1200, margin: '0 auto' };
const labelStyle: CSSProperties = { margin: 0, fontSize: 'var(--jh-text-label)', fontWeight: 500, color: 'var(--jh-muted)' };
const headlineStyle: CSSProperties = {
  margin: 'var(--jh-space-16) 0 0',
  fontSize: 'var(--jh-text-h3)',
  fontWeight: 600,
  lineHeight: 'var(--jh-leading-heading)',
  color: 'var(--jh-fg)',
};
const paragraphStyle: CSSProperties = {
  margin: 'var(--jh-space-16) 0 0',
  maxWidth: '34em',
  fontSize: 'var(--jh-text-body-l)',
  fontWeight: 500,
  lineHeight: 'var(--jh-leading-body)',
  color: 'var(--jh-fg)',
};

const terminalStyle: CSSProperties = {
  marginTop: 'var(--jh-space-40)',
  background: 'var(--jh-black)',
  border: '1px solid var(--jh-gray-dark)',
  borderRadius: 16,
  overflow: 'hidden',
};
const titleBarStyle: CSSProperties = { position: 'relative', height: 36, display: 'flex', alignItems: 'center', padding: '0 16px', gap: 8 };
const dotStyle: CSSProperties = { width: 10, height: 10, borderRadius: '50%', background: '#4D4D4D' };
const titleStyle: CSSProperties = { position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontSize: 12, color: GRAY, pointerEvents: 'none' };
const bodyStyle: CSSProperties = {
  position: 'relative',
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '20px 24px',
  fontFamily: 'var(--jh-font-mono)',
  fontSize: 15,
};
const copyButtonStyle: CSSProperties = {
  position: 'absolute',
  top: 12,
  right: 16,
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '4px 8px',
  border: 0,
  borderRadius: 8,
  background: 'transparent',
  color: 'rgba(255, 255, 255, 0.85)',
  fontFamily: 'var(--jh-font-sans)',
  fontSize: 13,
  fontWeight: 500,
  cursor: 'pointer',
};

const cardStyle: CSSProperties = {
  background: 'var(--jh-black-light)',
  borderRadius: 'var(--jh-radius)',
  padding: 24,
  color: '#FFFFFF',
};
const cardTitleStyle: CSSProperties = { margin: 'var(--jh-space-16) 0 0', fontSize: 16, fontWeight: 500, color: '#FFFFFF' };
const cardBodyStyle: CSSProperties = { margin: 'var(--jh-space-8) 0 0', fontSize: 14, fontWeight: 400, lineHeight: 'var(--jh-leading-body)', color: GRAY };
const monoStyle: CSSProperties = { fontFamily: 'var(--jh-font-mono)' };

export function TerminalCard({ command }: { command: string }): JSX.Element {
  const reducedMotion = useMediaQuery(REDUCED_MOTION_QUERY);
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => () => clearTimeout(timer.current), []);

  const copy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(command);
    } catch {
      return; // clipboard blocked: nothing was copied, so say nothing
    }
    setCopied(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), COPIED_MS);
  };

  const Glyph = copied ? Check : Copy;
  return (
    <div style={terminalStyle}>
      <style>{CARET_KEYFRAMES}</style>
      <div style={titleBarStyle} aria-hidden="true">
        <span style={dotStyle} />
        <span style={dotStyle} />
        <span style={dotStyle} />
        <span style={titleStyle}>zsh</span>
      </div>
      <div style={bodyStyle}>
        <span style={{ color: GRAY }}>~ %</span>
        <span style={{ ...monoStyle, color: '#FFFFFF' }}>{command}</span>
        <span
          data-caret=""
          aria-hidden="true"
          style={{
            width: 8,
            height: 18,
            background: '#FFFFFF',
            animation: reducedMotion ? 'none' : 'qr-caret-blink 1.06s steps(1) infinite',
          }}
        />
        <button type="button" aria-label="Copy command" onClick={() => void copy()} style={copyButtonStyle}>
          <Glyph size={16} weight="regular" aria-hidden="true" />
          <span role="status" aria-live="polite">
            {copied ? 'Copied' : 'Copy'}
          </span>
        </button>
      </div>
    </div>
  );
}

/** Card copy with `quickreminder://…` in mono and "Script Command" linking the repo's Raycast folder. */
function richBody(body: string): ReactNode {
  return body.split(/(Script Command|quickreminder:\/\/\w+)/).map((part, i) => {
    if (part === 'Script Command') {
      return (
        <a key={i} href={LINKS.raycastScript} style={{ color: '#FFFFFF', textDecoration: 'underline' }}>
          {part}
        </a>
      );
    }
    if (part.startsWith('quickreminder://')) {
      return (
        <span key={i} style={monoStyle}>
          {part}
        </span>
      );
    }
    return <Fragment key={i}>{part}</Fragment>;
  });
}

export function Integrations(): JSX.Element {
  const isTablet = useMediaQuery(TABLET_QUERY);
  const isDesktop = useMediaQuery(DESKTOP_QUERY);
  const columns = isDesktop ? 4 : isTablet ? 2 : 1;

  return (
    <section id="integrations" aria-labelledby="feature-07-title" style={sectionStyle}>
      <div style={innerStyle}>
        <p style={labelStyle}>{sectionTitle('07', INTEGRATIONS_COPY.label)}</p>
        <h2 id="feature-07-title" style={headlineStyle}>
          {INTEGRATIONS_COPY.headline}
        </h2>
        <p style={paragraphStyle}>{INTEGRATIONS_COPY.paragraph}</p>
        <TerminalCard command={INTEGRATIONS_COPY.terminalCommand} />
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, gap: 16, marginTop: 'var(--jh-space-16)' }}>
          {INTEGRATIONS_COPY.cards.map(({ icon: Icon, title, body }) => (
            <article key={title} style={cardStyle}>
              <Icon size={24} weight="regular" color="#FFFFFF" aria-hidden="true" />
              <h3 style={cardTitleStyle}>{title}</h3>
              <p style={cardBodyStyle}>{richBody(body)}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
