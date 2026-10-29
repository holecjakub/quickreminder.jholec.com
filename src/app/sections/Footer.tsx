// Landing §7.5: the dark footer with the Made-by line, the repo links and the trademark disclaimer. Static, outside the stage.
import type { CSSProperties, JSX } from 'react';
import { FOOTER_COPY } from '../choreography/copy';
import { LINKS } from '../Nav';

const footerStyle: CSSProperties = {
  background: 'var(--jh-bg)',
  color: 'var(--jh-fg)',
  borderTop: '1px solid #4D4D4D',
  padding: '48px var(--jh-page-margin-x) 64px',
};
const innerStyle: CSSProperties = { maxWidth: 1200, margin: '0 auto' };
const rowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 16,
};
const madeByStyle: CSSProperties = { fontSize: 16, fontWeight: 500, color: '#FFFFFF', textDecoration: 'none' };
const linkStyle: CSSProperties = { fontSize: 14, fontWeight: 500, color: '#FFFFFF', textDecoration: 'none' };
const linksStyle: CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: 24 };
const smallStyle: CSSProperties = {
  margin: '32px 0 0',
  maxWidth: '70ch',
  fontSize: 14,
  fontWeight: 400,
  lineHeight: 'var(--jh-leading-body)',
  color: '#A8A8A8',
};

export function Footer(): JSX.Element {
  return (
    <footer data-section="dark" style={footerStyle}>
      <div style={innerStyle}>
        <div style={rowStyle}>
          <a href={LINKS.jholec} style={madeByStyle}>
            {FOOTER_COPY.madeBy}
          </a>
          <nav aria-label="Footer links" style={linksStyle}>
            <a href={LINKS.appRepo} style={linkStyle}>
              QuickReminder on GitHub
            </a>
            <a href={LINKS.siteRepo} style={linkStyle}>
              Source of this site
            </a>
            <a href={LINKS.notice} style={linkStyle}>
              Trademarks and acknowledgements
            </a>
          </nav>
        </div>
        <p style={smallStyle}>{FOOTER_COPY.disclaimer}</p>
        <p style={{ ...smallStyle, marginTop: 16 }}>{FOOTER_COPY.siteNote}</p>
      </div>
    </footer>
  );
}
