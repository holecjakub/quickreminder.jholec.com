// The features column (landing §7.3): sections 01…06 beside the pinned stage, each registered with the
// section driver so the recreation plays its state when the copy reaches the viewport middle.
// Section 07 (Integrations) is static and lives outside the stage.
import { useMemo, type JSX } from 'react';
import { useMediaQuery } from '../../desktop/useMediaQuery';
import { FEATURE_COPY } from '../choreography/copy';
import { useSectionDriver } from '../choreography/useSectionDriver';
import { useStage } from '../Stage';
import { CAMERA } from '../stageCamera';
import { FeatureSection } from './FeatureSection';

const DESKTOP_QUERY = `(min-width: ${CAMERA.phoneBreakpoint}px)`;

export function Features(): JSX.Element {
  const { recreationRef, cursorRef, clock, calendar } = useStage();
  const { register } = useSectionDriver({ handle: recreationRef, cursor: cursorRef, clock, calendar, enabled: true });
  const isDesktop = useMediaQuery(DESKTOP_QUERY);

  // Stable ref callbacks, one per section, so React does not re-register on every render.
  const refs = useMemo(
    () => new Map(FEATURE_COPY.map((copy) => [copy.id, (el: HTMLElement | null) => register(copy.id, el)] as const)),
    [register],
  );

  return (
    // Phone: the last section closes the column with the section gap before Integrations.
    <div data-features="" style={isDesktop ? undefined : { paddingBottom: 'var(--jh-section-gap)' }}>
      {FEATURE_COPY.map((copy) => (
        <FeatureSection key={copy.id} ref={refs.get(copy.id)} copy={copy} />
      ))}
    </div>
  );
}
