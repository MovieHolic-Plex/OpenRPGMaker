/**
 * 편집기 스토어 렉 벤치(헤드리스). 큰 프로젝트 사본을 읽어 store.update 계열과 diffProjectDocuments 의 ms 를 잰다.
 * 사용: LAG_PROJECT_DIR=/tmp/lag-proj-b npx tsx scripts/bench/editor-store-lag.mts [out.json]
 * 프로젝트 폴더는 **사본**이어야 한다(store 가 열 때 마이그레이션을 쓸 수 있다).
 */
import { writeFileSync } from 'node:fs';
import { loadLagProject } from './lib/lagLoad.mts';
import { store } from '../../src/project/store';
import { diffProjectDocuments } from '../../src/project/persistence/core/projectPatch';
import type { Project } from '../../src/project/types';

const dir = process.env.LAG_PROJECT_DIR ?? '/tmp/lag-proj-b';
const out = process.argv[2];
const { project } = await loadLagProject(dir);
store.replace(project, { preserveEventDrafts: false, change: { label: 'bench', projectSwitch: true } });
store._setPersistenceStateForTest({ loaded: true, remotePersistenceEnabled: false });
const base: Project = store.getCurrent();

const ms = (fn: () => void): number => { const t = performance.now(); fn(); return performance.now() - t; };
const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] ?? 0;
const sample = (fn: () => void, runs = 9): number => { fn(); return Math.round(median(Array.from({ length: runs }, () => ms(fn))) * 100) / 100; };

const mapIds = Object.keys(base.maps);
const sizeOf = (id: string) => JSON.stringify(base.maps[id]).length;
const biggest = mapIds.reduce((a, b) => (sizeOf(a) >= sizeOf(b) ? a : b));
const map = base.maps[biggest]!;
const w = (map as any).width as number;
const cellsOf = (n: number) => Array.from({ length: n }, (_, i) => ({ x: i % w, y: Math.floor(i / w) }));
let tick = 1;
const paint = (cells: { x: number; y: number }[]) => (d: any) => { tick += 1; for (const c of cells) d.lowerTiles[c.y * w + c.x] = tick % 50; };
const dbKey = (Object.keys(base.database) as (keyof Project['database'])[]).find((k) => Array.isArray(base.database[k]) && (base.database[k] as unknown[]).length > 0)!;
const dbEdit = (list: any) => { tick += 1; list[0].name = `b${tick}`; };

const result: Record<string, number | string> = { project: dir, biggestMap: biggest, biggestMapBytes: sizeOf(biggest), dbCollection: String(dbKey) };
result['updateMapTiles 1셀'] = sample(() => store.updateMapTiles(biggest, paint(cellsOf(1))));
result['updateMapTiles 20셀 드래그(20회 합)'] = sample(() => { for (let i = 0; i < 20; i += 1) store.updateMapTiles(biggest, paint([{ x: i, y: 3 }])); });
result['update 1셀 (일반 경로)'] = sample(() => store.update((d) => paint(cellsOf(1))(d.maps[biggest])));
result['update 20셀 (일반 경로, 1회)'] = sample(() => store.update((d) => paint(cellsOf(20))(d.maps[biggest])));
result['update DB 필드 (일반 경로)'] = sample(() => store.update((d) => dbEdit((d.database as any)[dbKey])));
result['updateDatabase DB 필드 (빠른 경로)'] = sample(() => store.updateDatabase(dbKey, (d) => dbEdit((d as any)[dbKey] ?? d)));
result['update 맵 이름 변경(일반 경로)'] = sample(() => store.update((d) => { (d.maps[biggest] as any).name = `n${tick++}`; }));
result['update 1셀 후 diffProjectDocuments'] = (() => { store.update((d) => paint(cellsOf(1))(d.maps[biggest])); return sample(() => { diffProjectDocuments(base, store.getCurrent()); }, 5); })();
result['updateMapTiles 후 diffProjectDocuments'] = (() => { store.updateMapTiles(biggest, paint(cellsOf(1))); return sample(() => { diffProjectDocuments(base, store.getCurrent()); }, 5); })();
result['DB 편집 후 diffProjectDocuments'] = (() => { store.updateDatabase(dbKey, (d) => dbEdit((d as any)[dbKey] ?? d)); return sample(() => { diffProjectDocuments(base, store.getCurrent()); }, 5); })();

console.log(JSON.stringify(result, null, 2));
if (out) writeFileSync(out, JSON.stringify(result, null, 2));
process.exit(0);
