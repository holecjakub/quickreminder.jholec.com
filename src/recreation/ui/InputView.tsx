// `InputView` (Views/InputView.swift): the dotted checkbox ring beside the "New Reminder" title
// row and the "Notes" row, exactly like the iOS overlay.
import { useCore, useRecreationState } from './RecreationContext';
import { DashedCircle } from './DashedCircle';
import { NOTES_ROW, PlaceholderTextField, TITLE_ROW } from './PlaceholderTextField';
import { px } from './units';

export { flattenLineBreaks } from './PlaceholderTextField';

export function InputView(): JSX.Element {
  const { controller } = useCore();
  const { title, notes } = useRecreationState();
  return (
    <div data-qr-input-row="" style={{ display: 'flex', alignItems: 'flex-start', gap: px(10) }}>
      <DashedCircle style={{ marginTop: px(2) }} />
      <div data-qr-input-column="" style={{ display: 'flex', flexDirection: 'column', gap: px(1), flex: 1, minWidth: 0 }}>
        <PlaceholderTextField field="title" row={TITLE_ROW} value={title} onChange={(v) => controller.setTitle(v, 'user')} />
        <PlaceholderTextField field="notes" row={NOTES_ROW} value={notes} onChange={(v) => controller.setNotes(v, 'user')} />
      </div>
    </div>
  );
}
