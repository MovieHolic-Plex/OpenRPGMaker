import { IDBFactory, IDBObjectStore } from 'fake-indexeddb';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createActivityTrace } from '@/ai/activityTrace';
beforeEach(() => { vi.resetModules(); vi.stubGlobal('indexedDB', new IDBFactory()); });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
it('writes only the current run between pruning passes and rejects older snapshots', async () => {
  const { retainActivityTrace, flushActivityArchive, readActivityArchive } = await import('@/ai/activityTraceArchive');
  for (let i = 0; i < 20; i++) { retainActivityTrace({ ...createActivityTrace('run', 'project'), id: 'r' + i, serial: 1 }); await flushActivityArchive(); }
  const all = vi.spyOn(IDBObjectStore.prototype, 'getAll'), put = vi.spyOn(IDBObjectStore.prototype, 'put');
  const trace = { ...createActivityTrace('run', 'project'), id: 'r19', serial: 5, phase: '실행 중' };
  retainActivityTrace(trace); await flushActivityArchive(); retainActivityTrace({ ...trace, serial: 4, phase: '준비' }); await flushActivityArchive();
  expect(all).not.toHaveBeenCalled(); expect(put).toHaveBeenCalledTimes(1);
  const saved = await readActivityArchive('project'); expect(saved).toHaveLength(20); expect(saved.find(t => t.id === 'r19')).toMatchObject({ serial: 5, phase: '실행 중' });
});
it('prunes on new runs, settlement and low frequency, retaining count, TTL and byte limits', async () => {
  const { retainActivityTrace, flushActivityArchive, readActivityArchive } = await import('@/ai/activityTraceArchive');
  for (let i = 0; i < 22; i++) { retainActivityTrace({ ...createActivityTrace('run', 'project'), id: 'r' + i, serial: 1, updatedAt: Date.now() + i }); await flushActivityArchive(); }
  expect(await readActivityArchive('project')).toHaveLength(20);
  const all = vi.spyOn(IDBObjectStore.prototype, 'getAll'), now = Date.now();
  const settled = { ...createActivityTrace('done', 'project'), id: 'r21', serial: 2, phase: '완료', updatedAt: now + 22 };
  retainActivityTrace(settled); await flushActivityArchive(); expect(all).toHaveBeenCalledOnce(); all.mockClear();
  retainActivityTrace({ ...settled, serial: 3 }); await flushActivityArchive(); expect(all).not.toHaveBeenCalled();
  vi.spyOn(Date, 'now').mockReturnValue(now + 61_000); retainActivityTrace({ ...settled, serial: 4 }); await flushActivityArchive(); expect(all).toHaveBeenCalledOnce();
  retainActivityTrace({ ...createActivityTrace('old', 'project'), id: 'expired', serial: 1, updatedAt: now - 8 * 86400_000 }); await flushActivityArchive();
  expect((await readActivityArchive('project')).some(t => t.id === 'expired')).toBe(false);
  retainActivityTrace({ ...createActivityTrace('big', 'project'), id: 'big', serial: 1, bytes: 6_000_000 }); await flushActivityArchive();
  expect((await readActivityArchive('project')).some(t => t.id === 'big')).toBe(false);
});
it('reports write failure and clears it on a successful retry', async () => {
  const { retainActivityTrace, flushActivityArchive, activityArchiveFailed } = await import('@/ai/activityTraceArchive');
  const trace = { ...createActivityTrace('run', 'project'), serial: 1 };
  const failure = vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementationOnce(() => { throw new Error('quota'); });
  retainActivityTrace(trace); await flushActivityArchive(); expect(activityArchiveFailed(trace.id)).toBe(true);
  failure.mockRestore(); retainActivityTrace(trace); await flushActivityArchive(); expect(activityArchiveFailed(trace.id)).toBe(false);
});
