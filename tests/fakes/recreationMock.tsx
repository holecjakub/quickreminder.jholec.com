// Module stand-in for src/recreation in component tests:
//   vi.mock('../../src/recreation', () => import('../fakes/recreationMock'))
// `Recreation` installs a FakeRecreationHandle as its ref and forwards its changes to the props callbacks.
import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react';
import type { RecreationHandle, RecreationProps } from '../../src/recreation';
import { FakeRecreationHandle } from './fakeRecreationHandle';

export { DATE_PRESETS } from '../../src/recreation/core/datePresets';
// The runtime defaults DesktopScene reads through the index.
export { AppClock } from '../../src/recreation/clock';
export { currentCalendar } from '../../src/recreation/core/calendar';

/** The props and handle of the most recently rendered Recreation. */
export const lastRecreation: { props: RecreationProps | null; handle: FakeRecreationHandle | null } = {
  props: null,
  handle: null,
};

export const Recreation = forwardRef<RecreationHandle, RecreationProps>(function Recreation(props, ref) {
  const [fake] = useState(() => new FakeRecreationHandle());
  const propsRef = useRef(props);
  useImperativeHandle(ref, () => fake, [fake]);

  useLayoutEffect(() => {
    propsRef.current = props;
    lastRecreation.props = props;
    lastRecreation.handle = fake;
  });

  useEffect(() => {
    let savedCount = fake.getState().savedItems.length;
    return fake.subscribe((state) => {
      propsRef.current.onStateChange?.(state);
      for (const item of state.savedItems.slice(savedCount)) propsRef.current.onSaved?.(item);
      savedCount = state.savedItems.length;
    });
  }, [fake]);

  return (
    <div data-qr-root="">
      <input placeholder="New Reminder" />
    </div>
  );
});
