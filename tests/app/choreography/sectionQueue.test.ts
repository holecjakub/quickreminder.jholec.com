import { MAX_ACTION_MS, SectionQueue, type SectionJob } from '../../../src/app/choreography/useSectionDriver';
import type { SectionId } from '../../../src/app/choreography/snapshot';

/** `run` resolves after the job's duration (default 100 ms), or as soon as its signal aborts. */
function harness(durations: Partial<Record<SectionId, number>> = {}, timeScale?: () => number) {
  const signals = new Map<SectionId, AbortSignal>();
  const run = vi.fn((job: SectionJob, signal: AbortSignal) => {
    signals.set(job.id, signal);
    return new Promise<SectionId>((resolve) => {
      const id = setTimeout(() => resolve(job.id), durations[job.id] ?? 100);
      signal.addEventListener('abort', () => {
        clearTimeout(id);
        resolve(job.id);
      });
    });
  });
  const onAbort = vi.fn();
  const queue = new SectionQueue({ run, onAbort, timeScale });
  return { queue, run, onAbort, signals, ids: () => run.mock.calls.map((c) => c[0].id) };
}

const down = (id: SectionId): SectionJob => ({ id, direction: 'down' });

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

it('pins MAX_ACTION_MS', () => {
  expect(MAX_ACTION_MS).toBe(2500);
});
it('runs the first job at once', () => {
  const { queue, run } = harness();
  queue.enqueue(down('02'));
  expect(run).toHaveBeenCalledTimes(1);
  expect(run.mock.calls[0]![0]).toEqual({ id: '02', direction: 'down' });
  expect(queue.running).toEqual({ id: '02', direction: 'down' });
  expect(queue.pending).toBeNull();
});
it('lets a running job finish before the next starts', async () => {
  const { queue, run, signals, ids } = harness({ '02': 1000 });
  queue.enqueue(down('02'));
  await vi.advanceTimersByTimeAsync(100);
  queue.enqueue(down('03'));
  expect(run).toHaveBeenCalledTimes(1);
  expect(queue.pending).toEqual(down('03'));
  await vi.advanceTimersByTimeAsync(899);
  expect(run).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(1);
  expect(ids()).toEqual(['02', '03']);
  expect(signals.get('02')!.aborted).toBe(false);
  expect(queue.running).toEqual(down('03'));
  expect(queue.pending).toBeNull();
});
it('keeps only the latest pending job', async () => {
  const { queue, ids } = harness({ '02': 1000 });
  queue.enqueue(down('02'));
  queue.enqueue(down('03'));
  queue.enqueue(down('04'));
  expect(queue.pending).toEqual(down('04'));
  await vi.advanceTimersByTimeAsync(1000);
  expect(ids()).toEqual(['02', '04']);
});
it('aborts a running job 2500 ms after it started when another is pending', async () => {
  const { queue, onAbort, signals, ids } = harness({ '02': 10000 });
  queue.enqueue(down('02'));
  await vi.advanceTimersByTimeAsync(500);
  queue.enqueue(down('03'));
  await vi.advanceTimersByTimeAsync(1999);
  expect(signals.get('02')!.aborted).toBe(false);
  expect(onAbort).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(1);
  expect(signals.get('02')!.aborted).toBe(true);
  expect(onAbort).toHaveBeenCalledTimes(1);
  expect(ids()).toEqual(['02', '03']);
});
it('a lone long job is not aborted by time', async () => {
  const { queue, onAbort, signals } = harness({ '02': 10000 });
  queue.enqueue(down('02'));
  await vi.advanceTimersByTimeAsync(10000);
  expect(signals.get('02')!.aborted).toBe(false);
  expect(onAbort).not.toHaveBeenCalled();
  expect(queue.running).toBeNull();
});
it('scales the deadline by the time scale', async () => {
  const { queue, signals } = harness({ '02': 20000 }, () => 4);
  queue.enqueue(down('02'));
  queue.enqueue(down('03'));
  await vi.advanceTimersByTimeAsync(9999);
  expect(signals.get('02')!.aborted).toBe(false);
  await vi.advanceTimersByTimeAsync(1);
  expect(signals.get('02')!.aborted).toBe(true);
});
it('interrupt aborts the running job and keeps the pending one', async () => {
  const { queue, onAbort, signals, ids } = harness({ '02': 10000 });
  queue.enqueue(down('02'));
  queue.enqueue(down('03'));
  queue.interrupt();
  expect(signals.get('02')!.aborted).toBe(true);
  expect(onAbort).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(0);
  expect(ids()).toEqual(['02', '03']);
  expect(queue.running).toEqual(down('03'));
});
it('dispose aborts and drops everything', async () => {
  const { queue, signals, ids } = harness({ '02': 10000 });
  queue.enqueue(down('02'));
  queue.enqueue(down('03'));
  queue.dispose();
  expect(queue.pending).toBeNull();
  expect(signals.get('02')!.aborted).toBe(true);
  await vi.advanceTimersByTimeAsync(20000);
  expect(ids()).toEqual(['02']);
  expect(queue.running).toBeNull();
});
it('pause stops the deadline clock; resume re-arms it with the remaining time', async () => {
  const { queue, onAbort, signals } = harness({ '02': 10000 });
  queue.enqueue(down('02'));
  await vi.advanceTimersByTimeAsync(500);
  queue.enqueue(down('03'));
  await vi.advanceTimersByTimeAsync(1000);
  queue.pause();
  await vi.advanceTimersByTimeAsync(5000);
  expect(signals.get('02')!.aborted).toBe(false);
  queue.resume();
  await vi.advanceTimersByTimeAsync(999);
  expect(signals.get('02')!.aborted).toBe(false);
  await vi.advanceTimersByTimeAsync(1);
  expect(signals.get('02')!.aborted).toBe(true);
  expect(onAbort).toHaveBeenCalledTimes(1);
});
it('lastResult holds what the last settled job resolved to', async () => {
  const { queue } = harness({ '02': 100 });
  expect(queue.lastResult).toBeNull();
  queue.enqueue(down('02'));
  await vi.advanceTimersByTimeAsync(100);
  expect(queue.lastResult).toBe('02');
});
it('a rejected run is reported through onError and the pending job still starts', async () => {
  const boom = new Error('handle threw');
  const onError = vi.fn();
  const run = vi.fn((job: SectionJob) =>
    job.id === '02' ? new Promise<SectionId>((_, reject) => setTimeout(() => reject(boom), 100)) : Promise.resolve(job.id),
  );
  const queue = new SectionQueue({ run, onError });
  queue.enqueue(down('02'));
  queue.enqueue(down('03'));
  await vi.advanceTimersByTimeAsync(100);
  expect(onError).toHaveBeenCalledTimes(1);
  expect(onError).toHaveBeenCalledWith(boom);
  expect(run.mock.calls.map((c) => c[0].id)).toEqual(['02', '03']);
  await vi.advanceTimersByTimeAsync(0);
  expect(queue.lastResult).toBe('03');
});
it('without onError a rejected run is logged to console.error', async () => {
  const boom = new Error('handle threw');
  const log = vi.spyOn(console, 'error').mockImplementation(() => {});
  const queue = new SectionQueue({ run: () => Promise.reject(boom) });
  queue.enqueue(down('02'));
  await vi.advanceTimersByTimeAsync(0);
  expect(log).toHaveBeenCalledWith(boom);
  expect(queue.running).toBeNull();
  expect(queue.lastResult).toBeNull();
  log.mockRestore();
});
