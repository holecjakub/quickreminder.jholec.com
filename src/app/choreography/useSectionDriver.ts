// The section driver (contracts §4.4, landing spec §11.2): one ScrollTrigger per section at
// "top center"; onEnter reconciles the section downward, onLeaveBack the previous one upward. One
// action at a time: a running action may finish up to MAX_ACTION_MS before the next one starts.
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import type { FakeCursorHandle } from '../../desktop/fakeCursor';
import { useMediaQuery } from '../../desktop/useMediaQuery';
import type { Calendar, Clock, RecreationHandle } from '../../recreation';
import { ScrollTrigger } from '../gsap';
import { MOTION_TIME_SCALE } from '../motionDebug';
import { SECTION_SNAPSHOTS } from './demo';
import { reconcile, type ReconcileResult } from './reconcile';
import { previousSection, SECTION_ORDER, type SectionId } from './snapshot';

export interface SectionJob {
  readonly id: SectionId;
  readonly direction: 'down' | 'up';
}

/** Landing §11.2: a running action may take "max ~2.5 s" once the next section is waiting. */
export const MAX_ACTION_MS = 2500 as const;

const DEMO_CPS = 18;
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

interface SectionQueueOptions<R> {
  run(job: SectionJob, signal: AbortSignal): Promise<R>;
  maxDurationMs?: number;
  timeScale?: () => number;
  onAbort?(): void;
}

interface RunningJob {
  readonly job: SectionJob;
  readonly controller: AbortController;
}

/** Runs one job at a time; keeps only the latest pending job; aborts the running one at its deadline. */
export class SectionQueue<R = unknown> {
  private readonly opts: SectionQueueOptions<R>;
  private current: RunningJob | null = null;
  private next: SectionJob | null = null;
  private deadline: ReturnType<typeof setTimeout> | null = null;
  private startedAt = 0;
  private disposed = false;

  constructor(opts: SectionQueueOptions<R>) {
    this.opts = opts;
  }

  get running(): SectionJob | null {
    return this.current?.job ?? null;
  }

  get pending(): SectionJob | null {
    return this.next;
  }

  /** Idle → starts now; running → becomes the single pending job (latest wins) and arms the deadline. */
  enqueue(job: SectionJob): void {
    if (this.disposed) return;
    if (!this.current) {
      this.start(job);
      return;
    }
    this.next = job;
    this.armDeadline();
  }

  /** Visitor interaction: aborts the running job; the pending one stays. */
  interrupt(): void {
    this.abortRunning();
  }

  dispose(): void {
    this.disposed = true;
    this.next = null;
    this.clearDeadline();
    this.current?.controller.abort();
    this.current = null;
  }

  private start(job: SectionJob): void {
    const running: RunningJob = { job, controller: new AbortController() };
    this.current = running;
    this.startedAt = Date.now();
    this.opts.run(job, running.controller.signal).then(
      () => this.finish(running),
      () => this.finish(running),
    );
  }

  private finish(running: RunningJob): void {
    if (this.current !== running) return;
    this.current = null;
    this.clearDeadline();
    const next = this.next;
    this.next = null;
    if (next) this.start(next);
  }

  private armDeadline(): void {
    this.clearDeadline();
    if (!this.current || !this.next || this.current.controller.signal.aborted) return;
    const budget = (this.opts.maxDurationMs ?? MAX_ACTION_MS) * (this.opts.timeScale?.() ?? 1);
    this.deadline = setTimeout(() => {
      this.deadline = null;
      this.abortRunning();
    }, Math.max(0, budget - (Date.now() - this.startedAt)));
  }

  private clearDeadline(): void {
    if (this.deadline !== null) clearTimeout(this.deadline);
    this.deadline = null;
  }

  private abortRunning(): void {
    const running = this.current;
    if (!running || running.controller.signal.aborted) return;
    this.clearDeadline();
    running.controller.abort();
    this.opts.onAbort?.();
  }
}

/** Contracts §4.4: ScrollTrigger onEnter / onLeaveBack per section → the throttled reconcile queue. */
export function useSectionDriver(args: {
  handle: RefObject<RecreationHandle | null>;
  cursor: RefObject<FakeCursorHandle | null>;
  clock: Clock;
  calendar: Calendar;
  enabled: boolean;
}): { register(id: SectionId, el: HTMLElement | null): void; current: SectionId } {
  const { handle, cursor, enabled } = args;
  const reduce = useMediaQuery(REDUCED_MOTION_QUERY);
  const [current, setCurrent] = useState<SectionId>('hero');

  // The queue lives as long as `enabled`; its runs read the latest clock, calendar and motion preference.
  const latest = useRef({ clock: args.clock, calendar: args.calendar, reduce });
  useEffect(() => {
    latest.current = { clock: args.clock, calendar: args.calendar, reduce };
  }, [args.clock, args.calendar, reduce]);

  const elements = useRef(new Map<SectionId, HTMLElement>());
  const triggers = useRef(new Map<SectionId, ScrollTrigger>());
  const queueRef = useRef<SectionQueue<ReconcileResult | null> | null>(null);

  const go = useCallback((job: SectionJob) => {
    setCurrent(job.id);
    queueRef.current?.enqueue(job);
  }, []);

  const createTrigger = useCallback(
    (id: SectionId, el: HTMLElement) => {
      triggers.current.set(id, ScrollTrigger.create({
        trigger: el,
        start: 'top center',
        onEnter: () => go({ id, direction: 'down' }),
        onLeaveBack: () => go({ id: previousSection(id), direction: 'up' }),
      }));
    },
    [go],
  );

  const register = useCallback(
    (id: SectionId, el: HTMLElement | null) => {
      triggers.current.get(id)?.kill();
      triggers.current.delete(id);
      if (!el) {
        elements.current.delete(id);
        return;
      }
      elements.current.set(id, el);
      if (queueRef.current) createTrigger(id, el);
    },
    [createTrigger],
  );

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    const live = triggers.current;

    const queue = new SectionQueue<ReconcileResult | null>({
      run: (job, signal) => {
        const recreation = handle.current;
        if (!recreation) return Promise.resolve(null);
        const { clock, calendar, reduce: reduced } = latest.current;
        return reconcile(recreation, SECTION_SNAPSHOTS[job.id], {
          now: clock(),
          calendar,
          direction: job.direction,
          signal,
          cursor: reduced ? null : cursor.current,
          maxDurationMs: MAX_ACTION_MS,
          cps: reduced ? Infinity : DEMO_CPS,
        });
      },
      maxDurationMs: MAX_ACTION_MS,
      timeScale: () => MOTION_TIME_SCALE,
      onAbort: () => {
        handle.current?.cancel();
        cursor.current?.cancel();
      },
    });
    queueRef.current = queue;
    for (const [id, el] of elements.current) createTrigger(id, el);

    // Visitor edits win: the first change that makes the draft dirty interrupts the running action.
    let wasDirty = handle.current?.getState().dirty ?? false;
    const unsubscribe = handle.current?.subscribe((state) => {
      if (state.dirty && !wasDirty) queue.interrupt();
      wasDirty = state.dirty;
    });

    void (document.fonts?.ready ?? Promise.resolve()).then(() => {
      if (!alive) return;
      ScrollTrigger.refresh();
      const reached = SECTION_ORDER.filter((id) => {
        const el = elements.current.get(id);
        return el !== undefined && el.getBoundingClientRect().top < window.innerHeight / 2;
      });
      const last = reached[reached.length - 1];
      if (last) go({ id: last, direction: 'down' });
    });

    return () => {
      alive = false;
      unsubscribe?.();
      for (const trigger of live.values()) trigger.kill();
      live.clear();
      queue.dispose();
      queueRef.current = null;
    };
  }, [enabled, handle, cursor, createTrigger, go]);

  return { register, current };
}
