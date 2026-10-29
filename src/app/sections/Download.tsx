// Section 08 (landing §7.4): the dark download block the nav links to. Static, outside the stage.
import { DownloadSimple, GithubLogo } from '@phosphor-icons/react';
import type { CSSProperties, JSX } from 'react';
import { useMediaQuery } from '../../desktop/useMediaQuery';
import { DOWNLOAD_COPY } from '../choreography/copy';
import { LINKS } from '../Nav';
import { CAMERA } from '../stageCamera';

const TABLET_QUERY = `(min-width: ${CAMERA.phoneBreakpoint}px)`;
const GRAY = 'var(--jh-gray)';

const sectionStyle: CSSProperties = {
  padding: 'var(--jh-page-margin-y) var(--jh-page-margin-x)',
  background: 'var(--jh-bg)',
  color: 'var(--jh-fg)',
};
const innerStyle: CSSProperties = { maxWidth: 1200, margin: '0 auto' };
const iconStyle: CSSProperties = { display: 'block', width: 96, height: 96, borderRadius: 22 };
const buttonBase: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  height: 48,
  padding: '0 24px',
  borderRadius: 999,
  fontSize: 16,
  fontWeight: 600,
  textDecoration: 'none',
  boxSizing: 'border-box',
};
const primaryStyle: CSSProperties = { ...buttonBase, background: '#FFFFFF', color: '#0A0A0A' };
const secondaryStyle: CSSProperties = { ...buttonBase, border: '1px solid #4D4D4D', color: '#FFFFFF' };
const factTitleStyle: CSSProperties = { margin: 'var(--jh-space-16) 0 0', fontSize: 16, fontWeight: 500, color: '#FFFFFF' };
const factDetailStyle: CSSProperties = { margin: 'var(--jh-space-8) 0 0', fontSize: 14, fontWeight: 400, lineHeight: 'var(--jh-leading-body)', color: GRAY };
const smallStyle: CSSProperties = { margin: 'var(--jh-space-48) 0 0', fontSize: 14, fontWeight: 400, lineHeight: 'var(--jh-leading-body)', color: GRAY };

export function Download(): JSX.Element {
  const isTablet = useMediaQuery(TABLET_QUERY);

  return (
    <section id="download" data-section="dark" aria-labelledby="download-title" style={sectionStyle}>
      <div style={innerStyle}>
        <img src="/app-icon-512.png" alt="QuickReminder app icon" width={96} height={96} loading="lazy" decoding="async" style={iconStyle} />
        <h2
          id="download-title"
          style={{
            margin: 'var(--jh-space-24) 0 0',
            fontSize: isTablet ? 'var(--jh-text-h1)' : 'var(--jh-text-h2)',
            fontWeight: 600,
            lineHeight: 'var(--jh-leading-heading)',
            color: '#FFFFFF',
          }}
        >
          {DOWNLOAD_COPY.headline}
        </h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginTop: 'var(--jh-space-40)' }}>
          <a href={LINKS.releasesLatest} style={primaryStyle}>
            <DownloadSimple size={20} weight="regular" aria-hidden="true" />
            {DOWNLOAD_COPY.primary}
          </a>
          <a href={LINKS.appRepo} style={secondaryStyle}>
            <GithubLogo size={20} weight="regular" aria-hidden="true" />
            {DOWNLOAD_COPY.secondary}
          </a>
        </div>
        <ul
          style={{
            display: 'grid',
            gridTemplateColumns: isTablet ? 'repeat(3, 1fr)' : '1fr',
            gap: 24,
            margin: 'var(--jh-space-80) 0 0',
            padding: 0,
            listStyle: 'none',
          }}
        >
          {DOWNLOAD_COPY.facts.map(({ icon: Glyph, title, detail }) => (
            <li key={title}>
              <Glyph size={24} weight="regular" color="#FFFFFF" aria-hidden="true" />
              <p style={factTitleStyle}>{title}</p>
              <p style={factDetailStyle}>
                {title === 'MIT licence' ? (
                  <a href={LINKS.license} style={{ color: 'inherit', textDecoration: 'underline' }}>
                    {detail}
                  </a>
                ) : (
                  detail
                )}
              </p>
            </li>
          ))}
        </ul>
        <p style={smallStyle}>{DOWNLOAD_COPY.requirements}</p>
        <p style={{ ...smallStyle, marginTop: 'var(--jh-space-16)' }}>{DOWNLOAD_COPY.note}</p>
      </div>
    </section>
  );
}
