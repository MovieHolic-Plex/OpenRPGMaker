/** 렉 벤치용 로더: /tmp 사본 프로젝트 폴더를 읽기만 해서 편집기와 같은 deserialize 결과를 만든다. */
import { openLocalProjectStore } from '../../../electron/local-store/store';
import { deserialize } from '../../../src/project/io';
import type { Project } from '../../../src/project/types';

export async function loadLagProject(dir: string): Promise<{ project: Project; serialized: string }> {
  const store = await openLocalProjectStore({ projectDir: dir });
  const serialized = store.exportSerialized();
  if (!serialized) throw new Error('no serialized');
  return { project: deserialize(serialized), serialized };
}
