// `PlaceholderTextField` over `PlainTextView` (Views/InputView.swift, Views/PlainTextView.swift):
// one fixed-height, single-line text row. The web `<input>` is already single-line and draws its
// own placeholder; what the port adds is the paste rule of `shouldChangeTextIn` (line breaks
// become spaces, the result is capped at `maxLength` UTF-16 units) and no automatic substitutions.
import { useCallback, type ClipboardEvent, type CSSProperties } from 'react';
import { useCore } from './RecreationContext';
import { px } from './units';

/** Row geometry: `Theme.s(19 | 15)`, `PlainTextView.lineHeight(for:)`, row = line + 2, the length cap. */
export const TITLE_ROW = { fontSize: 19, lineHeight: 23, rowHeight: 25, maxLength: 2000, placeholder: 'New Reminder' } as const;
export const NOTES_ROW = { fontSize: 15, lineHeight: 18, rowHeight: 20, maxLength: 10000, placeholder: 'Notes' } as const;

/** Swift `Character.isNewline`: LF, VT, FF, CR, NEL, LS, PS; "\r\n" is one grapheme, so one space. */
const LINE_BREAK = /\r\n|[\n\v\f\r\u0085\u2028\u2029]/g;

/** `PlainTextView.flattened`: every kind of line break becomes one space. */
export function flattenLineBreaks(s: string): string {
  return s.replace(LINE_BREAK, ' ');
}

/** `String(flat.utf16.prefix(room)) ?? ""`: a prefix that splits a surrogate pair is not a string, so nothing is inserted. */
function clipToUtf16(s: string, room: number): string {
  if (s.length <= room) return s;
  const prefix = s.slice(0, room);
  const last = prefix.charCodeAt(prefix.length - 1);
  return last >= 0xd800 && last <= 0xdbff ? '' : prefix;
}

export function PlaceholderTextField(props: {
  field: 'title' | 'notes';
  row: typeof TITLE_ROW | typeof NOTES_ROW;
  value: string;
  onChange(v: string): void;
}): JSX.Element {
  const { field, row, value, onChange } = props;
  const { focus } = useCore();
  const register = useCallback((el: HTMLInputElement | null) => focus.register(field, el), [focus, field]);

  const onPaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const el = e.currentTarget;
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? start;
    const room = Math.max(0, row.maxLength - (el.value.length - (end - start)));
    el.setRangeText(clipToUtf16(flattenLineBreaks(e.clipboardData.getData('text/plain')), room), start, end, 'end');
    onChange(el.value);
  };

  return (
    <input
      ref={register}
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onPaste={onPaste}
      placeholder={row.placeholder}
      aria-label={row.placeholder}
      data-qr-field={field}
      data-qr-target={field}
      maxLength={row.maxLength}
      spellCheck={false}
      autoComplete="off"
      autoCorrect="off"
      autoCapitalize="off"
      style={
        {
          display: 'block',
          width: '100%',
          height: px(row.rowHeight),
          fontSize: px(row.fontSize),
          lineHeight: px(row.lineHeight),
          fontWeight: 400,
          color: 'var(--qr-white)',
          caretColor: 'var(--qr-list-accent)',
          '--qr-ph': 'var(--qr-placeholder)',
        } as CSSProperties
      }
    />
  );
}
