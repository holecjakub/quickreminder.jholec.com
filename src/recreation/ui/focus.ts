// Keyboard focus of the recreation's fields, by name: the web counterpart of SwiftUI's
// `@FocusState` (`ScheduleNotchSection.Field`, `LocationNotchSection.fieldFocused`) and of
// `PanelController.focusTitleFieldIfNeeded` / `restoreKeyFocus`. Field components register their
// element; the controller focuses by name and asks where focus is.

export type FocusField = 'title' | 'notes' | 'scheduleField' | 'timeField' | 'calendar' | 'locationField';

export interface FocusRegistry {
  setRoot(el: HTMLElement | null): void;
  /** Registers (or, with null, forgets) the element of a field; the element also carries `data-qr-field`. */
  register(field: FocusField, el: HTMLElement | null): void;
  /** `el.focus({ preventScroll: true })`; a text input gets the caret at the end (SingleLineTextView). False when not mounted. */
  focus(field: FocusField): boolean;
  /** The registered field that holds `document.activeElement`, if any. */
  active(): FocusField | null;
  /** `document.activeElement` is inside the root. */
  isInside(): boolean;
  /** `resignFirstResponder`: blurs the active element when it is inside the root. */
  blur(): void;
}

function isTextInput(el: HTMLElement): el is HTMLInputElement | HTMLTextAreaElement {
  return el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement;
}

/** Puts the caret after the last character; silently skips inputs whose type has no selection. */
function moveCaretToEnd(el: HTMLInputElement | HTMLTextAreaElement): void {
  const end = el.value.length;
  try {
    el.setSelectionRange(end, end);
  } catch {
    // `type="number"` and friends throw; the caret stays where the browser put it.
  }
}

export function createFocusRegistry(): FocusRegistry {
  let root: HTMLElement | null = null;
  const fields = new Map<FocusField, HTMLElement>();

  const activeElement = (): Element | null => (typeof document === 'undefined' ? null : document.activeElement);

  return {
    setRoot(el) {
      root = el;
    },
    register(field, el) {
      if (el === null) {
        fields.delete(field);
        return;
      }
      el.dataset.qrField = field;
      fields.set(field, el);
    },
    focus(field) {
      const el = fields.get(field);
      if (!el || !el.isConnected) return false;
      el.focus({ preventScroll: true });
      if (isTextInput(el)) moveCaretToEnd(el);
      return true;
    },
    active() {
      const active = activeElement();
      if (!active) return null;
      for (const [field, el] of fields) {
        if (el === active || el.contains(active)) return field;
      }
      return null;
    },
    isInside() {
      const active = activeElement();
      return root !== null && active !== null && root.contains(active);
    },
    blur() {
      const active = activeElement();
      if (root !== null && active instanceof HTMLElement && root.contains(active)) active.blur();
    },
  };
}
