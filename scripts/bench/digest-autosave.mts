/**
 * 1셀 칠하기 + 자동저장 한 번의 diff·요약 ms (헤드리스). electronRepository.saveMapPatch 흐름을 그대로 흉내 낸다:
 * diff(projectWireView(base), projectWireView(viewOfCurrent)) → patch → accepted = applyProjectDocumentPatch(base, patch) → 다음 base.
 * 사용: LAG_PROJECT_DIR=/tmp/lag-proj-b npx tsx scripts/bench/digest-autosave.mts [out.json]
 */
import { writeFileSync } from 'node:fs';
import { loadLagProject } from './lib/lagLoad.mts';
import { store } from '../../src/project/store';
import { projectWireView } from '../../src/project/io/serialize';
import { projectViewWithoutEventDrafts, projectWithoutEventDrafts } from '../../src/project/eventDrafts';
import { diffProjectDocuments, applyProjectDocumentPatch, withWirePatchValues } from '../../src/project/persistence/core/projectPatch';
import { jsonContentDigest, shareContentDigests, sharedEntryDigest } from '../../src/project/persistence/core/contentDigest';
import type { Project } from '../../src/project/types';

const dir = process.env.LAG_PROJECT_DIR ?? '/tmp/lag-proj-b';
const out = process.argv[2];
const { project } = await loadLagProject(dir);
store.replace(project, { preserveEventDrafts: false, change: { label: 'bench', projectSwitch: true } });
store._setPersistenceStateForTest({ loaded: true, remotePersistenceEnabled: false });
const t = <T>(fn: () => T): [T, number] => { const s = performance.now(); const r = fn(); return [r, performance.now() - s]; };

// baselineFrom 과 같다: 복제 + 기억 넘기기 + 한가할 때 미리 요약.
let base: Project = projectWithoutEventDrafts(store.getCurrent());
const [, warm] = t(() => { shareContentDigests(store.getCurrent(), base); jsonContentDigest(projectWireView(base)); shareContentDigests(base, store.getCurrent()); for (const v of [base, store.getCurrent()]) for (const [id, e] of Object.entries((projectWireView(v) as any).tilesets ?? {})) sharedEntryDigest(e, id); });

const mapIds = Object.keys(store.getCurrent().maps);
const sizeOf = (id: string) => JSON.stringify(store.getCurrent().maps[id]).length;
const biggest = mapIds.reduce((a, b) => (sizeOf(a) >= sizeOf(b) ? a : b));
const w = (store.getCurrent().maps[biggest] as any).width as number;
let tick = 1;
const rows: Record<string, number> = { '기준본 예열(idle)': Math.round(warm) };
const cycle = (label: string) => {
  tick += 1;
  const [, paint] = t(() => store.updateMapTiles(biggest, (d: any) => { d.lowerTiles[3 * w + (tick % 20)] = tick % 50; }));
  const view = projectViewWithoutEventDrafts(store.getCurrent());
  const [patch, diff] = t(() => diffProjectDocuments(projectWireView(base), projectWireView(view)));
  const [wire, wirems] = t(() => withWirePatchValues(patch));
  const [accepted, applyms] = t(() => applyProjectDocumentPatch(base, wire) as Project);
  base = accepted;
  rows[`${label} 칠하기`] = +paint.toFixed(2);
  rows[`${label} diff`] = +diff.toFixed(1);
  rows[`${label} wire`] = +wirems.toFixed(1);
  rows[`${label} apply`] = +applyms.toFixed(1);
  rows[`${label} 합(칠하기 제외)`] = +(diff + wirems + applyms).toFixed(1);
};
for (const label of ['1회차', '2회차', '3회차', '4회차']) cycle(label);
console.log(JSON.stringify(rows, null, 2));
if (out) writeFileSync(out, JSON.stringify(rows, null, 2));
process.exit(0);
