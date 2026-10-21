import { afterEach, expect, it, vi } from 'vitest';

// 사람 팀 협업이 꺼져 있으면(TEAM_COLLAB_ENABLED=false) 호스트 연결 끊김·역할 미확인·맵 임대 실패가 편집을 막지 않는다.
// 실측(2026-10-21): 호스트 재시작 뒤 역할 읽기가 실패해 role=null → store 의 모든 쓰기가 조용히 거절됐다.
vi.mock('@/project/store', () => ({ store: { flush: vi.fn(async () => ({ kind: 'saved' })), getCurrent: () => ({ maps: {}, startMapId: 'm' }) } }));
vi.mock('@/editor/editorState', () => ({ editorState: { get: () => ({}) } }));

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

it('keeps the project writable when the team bridge exists but the role could not be read', async () => {
  vi.stubGlobal('window', { oprn: { team: { status: vi.fn(async () => { throw new Error('host down'); }), lock: vi.fn() } } });
  const { TEAM_COLLAB_ENABLED } = await import('../../electron/shared/teamCollab');
  expect(TEAM_COLLAB_ENABLED).toBe(false);
  const access = await import('@/project/teamAccess');
  access.setTeamRole(null);
  expect(access.canWriteTeamProject()).toBe(true);
  access.setTeamRole('viewer');
  expect(access.canWriteTeamProject()).toBe(true);
});

it('never takes a map lease and always allows map edits', async () => {
  const lock = vi.fn(async () => { throw new Error('host down'); });
  vi.stubGlobal('window', { oprn: { team: { status: vi.fn(), lock } } });
  const locks = await import('@/editor/mapEditLocks');
  await locks.checkoutMapForEditing('m', 'map');
  expect(lock).not.toHaveBeenCalled();
  expect(locks.getMapEditLockStatus().kind).toBe('idle');
  expect(locks.canEditMap('m')).toBe(true);
  expect(locks.mapEditLockNotice('m')).toBe('');
});
