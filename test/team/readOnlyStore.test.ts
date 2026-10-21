import { afterEach, expect, it, vi } from 'vitest';
// 사람 팀 협업은 꺼져 있다(2026-10-21). 이 파일은 잠든 팀 코드의 계약을 지키므로 스위치를 켠 채로 검사한다.
vi.mock("../../electron/shared/teamCollab", () => ({ TEAM_COLLAB_ENABLED: true, TEAM_COLLAB_DEPRECATION_NOTE: "" }));
import { store } from '@/project/store';
import { createBlankProject } from '@/project/defaults';
import { setTeamRole } from '@/project/teamAccess';
afterEach(() => { setTeamRole(null); vi.unstubAllGlobals(); });
it('rejects viewer mutations before changing content, generation or dirty state', async () => {
  const project = createBlankProject();
  store.replaceProject(project);
  const before = store.getCurrent(), version = store.getVersionToken(), dirty = store.hasUnsavedChanges();
  vi.stubGlobal('window', { oprn: { team: {} } }); setTeamRole('viewer');
  const mutator = vi.fn();
  store.update(mutator); store.updateMap(project.startMapId, mutator);
  store.replace(createBlankProject()); store.replaceProject(createBlankProject()); await store.clearAll();
  expect(mutator).not.toHaveBeenCalled();
  expect(store.getCurrent()).toBe(before);
  expect(store.getVersionToken()).toEqual(version);
  expect(store.hasUnsavedChanges()).toBe(dirty);
  expect(await store.flush()).toEqual({ kind: 'disabled' });
});
