// `HeaderView` (Views/HeaderView.swift): "Reminders ▾" list picker on the left, grey ⓧ close button on the right.
import { listById } from '../core/lists';
import { HoverButton } from './buttons';
import { SFIcon } from './icons';
import { useCore, useRecreationState } from './RecreationContext';
import { px } from './units';

export function HeaderView(): JSX.Element {
  const { controller } = useCore();
  const { listId, listPickerOpen } = useRecreationState();
  return (
    <div data-qr-header="" style={{ display: 'flex', alignItems: 'center' }}>
      <HoverButton
        aria-label="Choose list" aria-haspopup="menu" aria-expanded={listPickerOpen} target="header"
        onClick={() => controller.toggleListPicker()}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: px(7) }}>
          <span style={{ fontSize: px(22), fontWeight: 700, color: 'var(--qr-list-accent)', whiteSpace: 'nowrap' }}>
            {listById(listId).title}
          </span>
          <SFIcon
            name="chevron.down" pointSize={13}
            style={{ color: 'var(--qr-list-accent)', transform: `translateY(${px(0.5)})` }}
          />
        </span>
      </HoverButton>
      <div data-qr-header-spacer="" style={{ flex: '1 0 auto', minWidth: px(12) }} />
      <HoverButton
        aria-label="Close" target="close" onClick={() => void controller.hide()}
        style={{ width: px(36), height: px(36) }}
      >
        <span
          data-qr-close-circle=""
          style={{
            width: px(24), height: px(24), borderRadius: '50%', background: 'var(--qr-gray-circle)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--qr-white)',
          }}
        >
          <SFIcon name="xmark" pointSize={11} />
        </span>
      </HoverButton>
    </div>
  );
}
