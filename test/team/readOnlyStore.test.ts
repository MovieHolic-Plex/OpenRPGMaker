import { afterEach, expect, it, vi } from 'vitest';
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
