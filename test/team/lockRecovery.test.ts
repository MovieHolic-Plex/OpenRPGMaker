import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const { flush, lock } = vi.hoisted(() => ({ flush: vi.fn(), lock: vi.fn() }));
vi.mock('@/project/store', () => ({ store: { flush } }));
vi.mock('@/editor/editorState', () => ({ editorState: { get: () => ({}) } }));
vi.mock('@/editor/teamSession', () => ({ teamSessionStatus: () => null }));
beforeEach(() => {
  vi.resetModules(); vi.useFakeTimers(); flush.mockReset(); lock.mockReset();
  lock.mockImplementation(async () => ({ kind: 'held', expiresAt: Date.now() + 90_000 }));
  vi.stubGlobal('window', { oprn: { team: { lock } } });
});
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); });
it('retains the old lease on save failure and retries save before releasing it', async () => {
  const m = await import('@/editor/mapEditLocks');
  await m.checkoutMapForEditing('a', 'A');
  flush.mockRejectedValueOnce(new Error('offline')).mockResolvedValue({ kind: 'saved' });
  await m.checkoutMapForEditing('b', 'B');
  expect(m.getMapEditLockStatus().kind).toBe('unavailable');
  expect(lock).not.toHaveBeenCalledWith({ resource: 'map:a', release: true });
  await vi.advanceTimersByTimeAsync(20_000);
  expect(flush).toHaveBeenCalledTimes(2);
  expect(lock).toHaveBeenCalledWith({ resource: 'map:a', release: true });
  expect(m.canEditMap('b')).toBe(true);
});
it('does not release the old lease after a disabled save', async () => {
  const m = await import('@/editor/mapEditLocks');
  await m.checkoutMapForEditing('a', 'A');
  flush.mockResolvedValue({ kind: 'disabled' });
  await m.checkoutMapForEditing('b', 'B');
  await vi.advanceTimersByTimeAsync(20_000);
  expect(lock).not.toHaveBeenCalledWith({ resource: 'map:a', release: true });
  expect(m.canEditMap('b')).toBe(false);
});
