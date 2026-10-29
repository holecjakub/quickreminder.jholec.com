// Dev-only harness for the visual review (Task 46): one `Recreation` at `--pt: 1` on a 1512 × 982 pt
// mid-grey scene, driven through its handle to the state named by `?state=`, then
// `document.body.dataset.ready = 'true'` once that state has settled. Served by `vite` from
// `recreation-harness.html`; never part of the production build.
//
//   ?state=plain|typed|suggestion|applied|flag|section|calendar|saving|hover|lists|location
//   &list=<ListId>   the list chosen after opening (accent)
//   &now=<ISO>       the clock (read by AppClock)
import '../../tokens.css';

import { useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import type { ListId } from '../core/lists';
import { NotchLayout } from '../machine/notchLayout';
import { motionTimeScale } from '../motionScale';
import { Recreation, type RecreationHandle } from '../Recreation';

const HARNESS_STATES = [
  'plain', 'typed', 'suggestion', 'applied', 'flag', 'section', 'calendar', 'saving', 'hover', 'lists', 'location',
] as const;
type HarnessState = (typeof HARNESS_STATES)[number];

const SCENE = { width: 1512, height: 982 } as const;
const NOTCH = { width: 221, height: 38 } as const;
const NOTCH_ORIGIN = { x: SCENE.width / 2, y: 0 } as const;

/** The demo titles: one without a date phrase, one with (the app's `n_en_*` captures). */
const PLAIN_TITLE = 'Buy milk';
const DATED_TITLE = 'Buy milk tomorrow at 2pm';

/** Seconds after the state's trigger at which a timed state is captured (scaled by `?debug=motion`). */
const SAVING_CAPTURE = 0.8;
const HOVER_CAPTURE = 0.6;

function parseState(raw: string | null): HarnessState {
  const state = HARNESS_STATES.find((s) => s === (raw ?? 'plain'));
  if (!state) throw new Error(`Unknown harness state "${raw}"; expected one of ${HARNESS_STATES.join(', ')}`);
  return state;
}

const wait = (seconds: number): Promise<void> =>
  new Promise((resolve) => window.setTimeout(resolve, seconds * motionTimeScale() * 1000));

/** Resolves once the panel's settle timer has fired (immediately when it already has). */
function whenSettled(h: RecreationHandle): Promise<void> {
  return new Promise((resolve) => {
    if (h.getState().settled) return resolve();
    const unsubscribe = h.subscribe((state) => {
      if (!state.settled) return;
      unsubscribe();
      resolve();
    });
  });
}

/** Brings the open panel to `state`; resolves once that state's settle timer has fired. */
async function drive(h: RecreationHandle, state: HarnessState, list: ListId | null): Promise<void> {
  if (state === 'hover') {
    h.hoverNotch(true);
    return wait(HOVER_CAPTURE);
  }
  await h.show({ source: 'scroll' });
  if (list) h.setList(list);
  switch (state) {
    case 'plain':
      return;
    case 'section':
      h.openSchedule();
      return whenSettled(h);
    case 'calendar':
      h.openCalendar();
      return whenSettled(h);
    case 'location':
      h.openLocation();
      return whenSettled(h);
    case 'saving':
      h.setTitle(PLAIN_TITLE);
      void h.save();
      return wait(SAVING_CAPTURE);
    case 'typed':
      h.setTitle(PLAIN_TITLE);
      break;
    case 'suggestion':
      h.setTitle(DATED_TITLE);
      break;
    case 'applied':
      h.setTitle(DATED_TITLE);
      h.applySuggestion();
      break;
    case 'flag':
      h.setFlag(true);
      break;
    case 'lists':
      h.openListPicker();
      break;
  }
  // An edit of the open panel (chip, flag, popover) starts no settle timer of its own: wait the
  // same interval before the capture, so its spring has come to rest.
  return wait(NotchLayout.settleDelay);
}

function Harness(props: { state: HarnessState; list: ListId | null }): JSX.Element {
  const { state, list } = props;
  const handle = useRef<RecreationHandle>(null);
  useEffect(() => {
    const h = handle.current;
    if (!h) return;
    void drive(h, state, list).then(() => {
      document.body.dataset.ready = 'true';
    });
  }, [state, list]);
  return (
    <div
      data-qr-screen=""
      style={{
        position: 'relative', width: SCENE.width, height: SCENE.height, overflow: 'hidden',
        background: '#808080', ['--pt' as string]: 1,
      }}
    >
      <Recreation
        ref={handle}
        notch={NOTCH}
        screenHeight={SCENE.height}
        notchOrigin={NOTCH_ORIGIN}
        sceneScale={1}
        shortcutsEnabled
      />
    </div>
  );
}

const params = new URLSearchParams(window.location.search);
const root = document.getElementById('root');
if (!root) throw new Error('#root is missing from recreation-harness.html');
document.body.style.margin = '0';
createRoot(root).render(<Harness state={parseState(params.get('state'))} list={params.get('list') as ListId | null} />);
