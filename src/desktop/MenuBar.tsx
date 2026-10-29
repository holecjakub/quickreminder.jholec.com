// The fake menu bar: an Apple-free app name and menus on the left, the hardware notch in the middle
// (the recreation's closed silhouette covers it), QuickReminder's status item and the clock on the right.
import { ListChecks } from '@phosphor-icons/react';
import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import type { Clock } from '../recreation';
import { MenuBarClock } from './MenuBarClock';
import { NOTCH_LEFT, NOTCH_RIGHT, SCENE, ptCss } from './scene';

export const MENU_BAR: {
  readonly appName: 'Notes';
  readonly menus: readonly ['File', 'Edit', 'Format', 'View', 'Window', 'Help'];
  readonly fontSize: 13;
  readonly leftInset: 20;
  readonly itemGap: 20;
  readonly rightInset: 16;
  readonly statusGap: 18;
  readonly iconSize: 16;
} = {
  appName: 'Notes',
  menus: ['File', 'Edit', 'Format', 'View', 'Window', 'Help'],
  fontSize: 13,
  leftInset: 20,
  itemGap: 20,
  rightInset: 16,
  statusGap: 18,
  iconSize: 16,
};

export interface MenuBarProps {
  scheme: 'light' | 'dark';
  clock: Clock;
  locale: string;
  timeZone: string;
  onShowPanel(): void;
}

const COLORS = {
  light: { background: 'rgba(255, 255, 255, 0.28)', text: 'rgba(0, 0, 0, 0.86)', iconHover: 'rgba(0, 0, 0, 0.10)' },
  dark: { background: 'rgba(0, 0, 0, 0.22)', text: 'rgba(255, 255, 255, 0.92)', iconHover: 'rgba(255, 255, 255, 0.15)' },
} as const;

const BACKDROP = `blur(${ptCss(24)}) saturate(1.6)`;
/** The status-item button: 28 × 22 pt, vertically centred in the 38 pt bar (top at 8 pt). */
const ICON_BUTTON = { width: 28, height: 22, radius: 5 } as const;
/** The menu hangs at scene y 42 pt; measured from the button's top (8 pt). */
const MENU_TOP = 42 - (SCENE.menuBarHeight - ICON_BUTTON.height) / 2;
/** Landing §11.4 popup language (the list picker's): black, 12 pt corners, 1 pt #3D3D3F stroke. */
const MENU_STYLE = { radius: 12, stroke: '#3D3D3F', minWidth: 220, padding: 5, rowHeight: 26, rowRadius: 6, rowInset: 10 } as const;
const ROW_FILL = { rest: 'rgba(255, 255, 255, 0.06)', hover: 'rgba(255, 255, 255, 0.11)', pressed: 'rgba(255, 255, 255, 0.15)' } as const;

/** `AppDelegate.swift` lines 63–66 (ruling R-09): Show · Settings… · separator · Quit. */
const APP_MENU = [
  { kind: 'item', title: 'Show Quick Reminder', enabled: true },
  { kind: 'item', title: 'Settings…', enabled: false },
  { kind: 'separator' },
  { kind: 'item', title: 'Quit', enabled: false },
] as const;

function MenuRow({ title, enabled, onActivate }: { title: string; enabled: boolean; onActivate(): void }) {
  const [fill, setFill] = useState<keyof typeof ROW_FILL>('rest');
  const track = (next: keyof typeof ROW_FILL) => () => enabled && setFill(next);
  return (
    <div
      role="menuitem"
      tabIndex={-1}
      aria-disabled={enabled ? undefined : 'true'}
      onClick={() => enabled && onActivate()}
      onKeyDown={(e) => {
        if (enabled && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onActivate();
        }
      }}
      onPointerEnter={track('hover')}
      onPointerLeave={track('rest')}
      onPointerDown={track('pressed')}
      onPointerUp={track('hover')}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: ptCss(16),
        height: ptCss(MENU_STYLE.rowHeight),
        padding: `0 ${ptCss(MENU_STYLE.rowInset)}`,
        borderRadius: ptCss(MENU_STYLE.rowRadius),
        background: ROW_FILL[fill],
        color: '#FFFFFF',
        fontSize: ptCss(13),
        cursor: enabled ? 'default' : 'not-allowed',
        outline: 'none',
      }}
    >
      <span>{title}</span>
      {!enabled && (
        <span aria-hidden="true" style={{ fontSize: ptCss(11), color: 'rgba(255, 255, 255, 0.5)' }}>
          In the app
        </span>
      )}
    </div>
  );
}

function StatusItem({ scheme, onShowPanel }: { scheme: 'light' | 'dark'; onShowPanel(): void }) {
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState(false);
  const rootRef = useRef<HTMLSpanElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus({ preventScroll: true });
    const onPointerDown = (e: PointerEvent): void => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  const close = (): void => {
    setOpen(false);
    buttonRef.current?.focus({ preventScroll: true });
  };
  const onMenuKeyDown = (e: ReactKeyboardEvent): void => {
    if (e.key !== 'Escape') return;
    e.preventDefault();
    e.stopPropagation();
    close();
  };

  return (
    <span ref={rootRef} style={{ position: 'relative', display: 'flex' }}>
      <button
        ref={buttonRef}
        type="button"
        aria-label="QuickReminder menu"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        onPointerEnter={() => setHovered(true)}
        onPointerLeave={() => setHovered(false)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: ptCss(ICON_BUTTON.width),
          height: ptCss(ICON_BUTTON.height),
          borderRadius: ptCss(ICON_BUTTON.radius),
          border: 'none',
          padding: 0,
          color: 'inherit',
          background: hovered || open ? COLORS[scheme].iconHover : 'transparent',
        }}
      >
        <ListChecks weight="regular" aria-hidden="true" style={{ width: ptCss(MENU_BAR.iconSize), height: ptCss(MENU_BAR.iconSize) }} />
      </button>
      {open && (
        <div
          ref={menuRef}
          role="menu"
          aria-label="QuickReminder"
          onKeyDown={onMenuKeyDown}
          style={{
            position: 'absolute',
            top: ptCss(MENU_TOP),
            right: 0,
            minWidth: ptCss(MENU_STYLE.minWidth),
            padding: ptCss(MENU_STYLE.padding),
            display: 'flex',
            flexDirection: 'column',
            gap: ptCss(2),
            background: '#000000',
            border: `${ptCss(1)} solid ${MENU_STYLE.stroke}`,
            borderRadius: ptCss(MENU_STYLE.radius),
            lineHeight: 'normal',
            fontWeight: 400,
            zIndex: 1,
          }}
        >
          {APP_MENU.map((row, i) =>
            row.kind === 'separator' ? (
              <div
                key={i}
                role="separator"
                style={{ height: ptCss(1), margin: `${ptCss(3)} ${ptCss(MENU_STYLE.rowInset)}`, background: MENU_STYLE.stroke }}
              />
            ) : (
              <MenuRow
                key={row.title}
                title={row.title}
                enabled={row.enabled}
                onActivate={() => {
                  close();
                  onShowPanel();
                }}
              />
            ),
          )}
        </div>
      )}
    </span>
  );
}

export function MenuBar({ scheme, clock, locale, timeZone, onShowPanel }: MenuBarProps) {
  const colors = COLORS[scheme];
  const segment = { position: 'absolute', top: 0, bottom: 0, background: colors.background, backdropFilter: BACKDROP, WebkitBackdropFilter: BACKDROP } as const;
  return (
    <div
      data-menubar=""
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        right: 0,
        height: ptCss(SCENE.menuBarHeight),
        lineHeight: ptCss(SCENE.menuBarHeight),
        fontFamily: 'var(--qr-font)',
        fontSize: ptCss(MENU_BAR.fontSize),
        color: colors.text,
      }}
    >
      <div data-menubar-bg="left" style={{ ...segment, left: 0, width: ptCss(NOTCH_LEFT) }} />
      <div data-menubar-bg="right" style={{ ...segment, left: ptCss(NOTCH_RIGHT), right: 0 }} />
      <div
        data-hardware-notch=""
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: 0,
          left: ptCss(NOTCH_LEFT),
          width: ptCss(SCENE.notch.width),
          height: ptCss(SCENE.notch.height),
          backgroundColor: '#000000',
          borderBottomLeftRadius: ptCss(8),
          borderBottomRightRadius: ptCss(8),
        }}
      />
      <div
        data-menubar-left=""
        aria-hidden="true"
        style={{ position: 'absolute', top: 0, left: ptCss(MENU_BAR.leftInset), display: 'flex', gap: ptCss(MENU_BAR.itemGap), whiteSpace: 'nowrap' }}
      >
        <span style={{ fontWeight: 700 }}>{MENU_BAR.appName}</span>
        {MENU_BAR.menus.map((name) => (
          <span key={name} style={{ fontWeight: 400 }}>
            {name}
          </span>
        ))}
      </div>
      <div
        data-menubar-right=""
        style={{
          position: 'absolute',
          top: 0,
          right: ptCss(MENU_BAR.rightInset),
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: ptCss(MENU_BAR.statusGap),
        }}
      >
        <StatusItem scheme={scheme} onShowPanel={onShowPanel} />
        <MenuBarClock clock={clock} locale={locale} timeZone={timeZone} />
      </div>
    </div>
  );
}
