// One `(0n) Label /` feature section (landing §7.3, contracts §6.1): numbered label, 24-semibold
// headline, 18-medium paragraph, an optional muted second line and 2–3 Phosphor bullets.
import { forwardRef, type CSSProperties, type ReactNode } from 'react';
import { DEMO_REMINDER } from '../choreography/demo';
import type { FeatureCopy } from '../choreography/copy';
import { useIsDesktop } from '../stageCamera';

export interface FeatureSectionProps {
  copy: FeatureCopy;
  tone?: 'light' | 'dark';
}

const BULLET_ICON_SIZE = 20;

const DESKTOP_LAYOUT: CSSProperties = {
  minHeight: '100svh',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  padding: '80px var(--jh-page-margin-x) 80px 40px',
};
const PHONE_LAYOUT: CSSProperties = { padding: '80px var(--jh-page-margin-x) 0' };

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
const secondaryStyle: CSSProperties = {
  margin: 'var(--jh-space-8) 0 0',
  fontSize: 'var(--jh-text-body)',
  fontWeight: 500,
  lineHeight: 'var(--jh-leading-body)',
  color: 'var(--jh-muted)',
};
const listStyle: CSSProperties = {
  margin: 'var(--jh-space-24) 0 0',
  padding: 0,
  listStyle: 'none',
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--jh-space-16)',
};
const bulletStyle: CSSProperties = { display: 'flex', alignItems: 'flex-start', gap: 'var(--jh-space-8)', color: 'var(--jh-fg)' };
/** Centres the 20 px icon on the first line of 16 px text at the body leading. */
const bulletIconStyle: CSSProperties = { flexShrink: 0, marginTop: `calc((var(--jh-text-body) * var(--jh-leading-body) - ${BULLET_ICON_SIZE}px) / 2)` };
const bulletTextStyle: CSSProperties = { fontSize: 'var(--jh-text-body)', fontWeight: 500, lineHeight: 'var(--jh-leading-body)' };

/** The Czech demo phrase inside the secondary line carries `lang="cs"` for screen readers. */
function withCzechExample(text: string): ReactNode {
  const example = DEMO_REMINDER.czechExample;
  const at = text.indexOf(example);
  if (at < 0) return text;
  return (
    <>
      {text.slice(0, at)}
      <span lang="cs">{example}</span>
      {text.slice(at + example.length)}
    </>
  );
}

export const FeatureSection = forwardRef<HTMLElement, FeatureSectionProps>(function FeatureSection({ copy, tone = 'light' }, ref) {
  const isDesktop = useIsDesktop();
  const sectionId = `feature-${copy.id}`;
  const titleId = `${sectionId}-title`;
  const dark = tone === 'dark';

  return (
    <section
      ref={ref}
      id={sectionId}
      aria-labelledby={titleId}
      data-section={dark ? 'dark' : undefined}
      style={{ ...(isDesktop ? DESKTOP_LAYOUT : PHONE_LAYOUT), backgroundColor: dark ? 'var(--jh-bg)' : undefined }}
    >
      <p style={labelStyle}>
        <span style={{ fontFamily: 'var(--jh-font-mono)' }}>({copy.id})</span> {copy.label} /
      </p>
      <h2 id={titleId} style={headlineStyle}>
        {copy.headline}
      </h2>
      <p style={paragraphStyle}>{copy.paragraph}</p>
      {copy.secondary !== undefined && <p style={secondaryStyle}>{withCzechExample(copy.secondary)}</p>}
      <ul style={listStyle}>
        {copy.bullets.map(({ icon: Icon, text }) => (
          <li key={text} style={bulletStyle}>
            <Icon size={BULLET_ICON_SIZE} weight="regular" aria-hidden="true" style={bulletIconStyle} />
            <span style={bulletTextStyle}>{text}</span>
          </li>
        ))}
      </ul>
    </section>
  );
});
