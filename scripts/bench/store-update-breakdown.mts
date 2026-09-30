/**
 * store.update 한 번의 구간별 ms. 사용: LAG_PROJECT_DIR=/tmp/lag-proj-b npx tsx scripts/bench/store-update-breakdown.mts
 */
import { loadLagProject } from './lib/lagLoad.mts';
import { store } from '../../src/project/store';
import { cloneProjectForMutation, finishProjectMutation } from '../../src/project/projectClone';
import { repairMapTreeOrphans } from '../../src/project/mapTree';
import { ensureSwitchVariableSlots } from '../../src/project/defaults/blankProject';
import { removeLegacySpriteReferences } from '../../src/project/defaults/defaultAssets';
import { assertCanonicalReplacement } from '../../src/project/spatial/saveRouting';

const dir = process.env.LAG_PROJECT_DIR ?? '/tmp/lag-proj-b';
const { project } = await loadLagProject(dir);
store.replace(project, { preserveEventDrafts: false, change: { label: 'bench', projectSwitch: true } });
store._setPersistenceStateForTest({ loaded: true, remotePersistenceEnabled: false });
const base = store.getCurrent();
const time = <T>(label: string, fn: () => T): T => { const t = performance.now(); const r = fn(); console.log(label.padEnd(36), (performance.now() - t).toFixed(2)); return r; };
for (let round = 0; round < 3; round += 1) {
  console.log('--- round', round);
  const draft = time('cloneProjectForMutation', () => cloneProjectForMutation(base));
  time('finishProjectMutation', () => finishProjectMutation(draft));
  time('assertCanonicalReplacement', () => assertCanonicalReplacement(draft, null));
  time('repairMapTreeOrphans', () => repairMapTreeOrphans(draft));
  time('ensureSwitchVariableSlots', () => ensureSwitchVariableSlots(draft));
  time('removeLegacySpriteReferences', () => removeLegacySpriteReferences(draft));
}
process.exit(0);
