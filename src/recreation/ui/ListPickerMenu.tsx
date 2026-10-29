// `ListPickerMenu` (Views/ListPickerMenu.swift) in the §11.4 popover: a "Lists" heading and one
// row per list — colour dot, title, checkmark on the current one; a pick closes the picker.
import { AnimatePresence } from 'motion/react';
import { FAKE_LISTS } from '../core/lists';
import { NotchFillButton } from './buttons';
import { SFIcon } from './icons';
import { LIST_PICKER_ANCHOR, PopoverSurface } from './Popover';
import { useCore, useRecreationState } from './RecreationContext';
import { px } from './units';

export function ListPickerMenu(): JSX.Element {
  const { controller } = useCore();
  const { listPickerOpen, listId } = useRecreationState();
  return (
    <AnimatePresence>
      {listPickerOpen && (
        <PopoverSurface
          key="lists" anchor={LIST_PICKER_ANCHOR} name="lists" label="Lists" role="menu"
          minWidth={200} padding={`0 0 ${px(8)}`}
        >
          <div
            style={{
              fontSize: px(13), fontWeight: 600, color: 'rgba(255, 255, 255, 0.5)',
              padding: `${px(12)} ${px(16)} ${px(6)}`,
            }}
          >
            Lists
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: px(2), padding: `0 ${px(4)}` }}>
            {FAKE_LISTS.map((list) => {
              const selected = list.id === listId;
              return (
                <NotchFillButton
                  key={list.id} role="menuitemradio" aria-checked={selected} target={`list:${list.id}`}
                  kind={selected ? 'selected' : 'neutral'} radius={8}
                  onClick={() => controller.setList(list.id, 'user')}
                  style={{ display: 'flex', justifyContent: 'flex-start', gap: px(8), padding: `${px(8)} ${px(12)}` }}
                >
                  <span
                    data-qr-dot=""
                    style={{ width: px(10), height: px(10), borderRadius: '50%', flex: 'none', background: list.color }}
                  />
                  <span style={{ fontSize: px(15), fontWeight: 400, color: 'var(--qr-white)' }}>{list.title}</span>
                  <span style={{ flex: 1 }} />
                  {selected && <SFIcon name="checkmark" pointSize={13} style={{ color: 'var(--qr-accent)' }} />}
                </NotchFillButton>
              );
            })}
          </div>
        </PopoverSurface>
      )}
    </AnimatePresence>
  );
}
