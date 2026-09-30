/** diff 시간이 어느 가지에서 나는지 — 최상위 키·타일셋 필드별 요약 ms. 사용: LAG_PROJECT_DIR=/tmp/lag-proj-b npx tsx scripts/bench/digest-probe.mts */
import { loadLagProject } from './lib/lagLoad.mts';
import { store } from '../../src/project/store';
import { projectWireView } from '../../src/project/io/serialize';
import { projectViewWithoutEventDrafts, projectWithoutEventDrafts } from '../../src/project/eventDrafts';
import { jsonContentDigest, shareContentDigests } from '../../src/project/persistence/core/contentDigest';

const { project } = await loadLagProject(process.env.LAG_PROJECT_DIR ?? '/tmp/lag-proj-b');
store.replace(project, { preserveEventDrafts: false, change: { label: 'bench', projectSwitch: true } });
store._setPersistenceStateForTest({ loaded: true, remotePersistenceEnabled: false });
const base = projectWithoutEventDrafts(store.getCurrent());
shareContentDigests(store.getCurrent(), base);
jsonContentDigest(projectWireView(base));
shareContentDigests(base, store.getCurrent());
const local = projectWireView(projectViewWithoutEventDrafts(store.getCurrent())) as unknown as Record<string, any>;
const b = projectWireView(base) as unknown as Record<string, any>;
const t = (fn: () => unknown) => { const s = performance.now(); fn(); return +(performance.now() - s).toFixed(1); };
for (let round = 0; round < 2; round += 1) {
  console.log('--- round', round);
  const rows: [string, number][] = [];
  for (const key of Object.keys(local)) {
    if (key === 'tilesets') continue;
    rows.push([key, t(() => { jsonContentDigest(b[key], key); jsonContentDigest(local[key], key); })]);
  }
  console.log(rows.filter(([, ms]) => ms > 1).map(([k, ms]) => `${k}=${ms}`).join(' '));
  const trows: [string, number][] = [];
  for (const id of Object.keys(local.tilesets)) {
    const te = local.tilesets[id]; const be = b.tilesets[id];
    const per: string[] = [];
    let total = 0;
    for (const f of Object.keys(te)) {
      if (f === 'referenceDocuments') continue;
      const ms = t(() => { jsonContentDigest(be?.[f], f); jsonContentDigest(te[f], f); });
      total += ms;
      if (ms > 2) per.push(`${f}=${ms}`);
    }
    trows.push([`${id} ${per.join(' ')}`, total]);
  }
  trows.sort((x, y) => y[1] - x[1]);
  console.log('tilesets total', trows.reduce((a, r) => a + r[1], 0).toFixed(1), 'n', trows.length);
  console.log(trows.slice(0, 6).map(([k, ms]) => `${ms.toFixed(1)} ${k}`).join('\n'));
}
process.exit(0);
