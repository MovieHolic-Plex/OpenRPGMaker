/** 프로젝트 루트 키별 JSON 크기·structuredClone ms. 사용: npx tsx scripts/bench/project-shape.mts */
import { loadLagProject } from './lib/lagLoad.mts';

const { project } = await loadLagProject(process.env.LAG_PROJECT_DIR ?? '/tmp/lag-proj-b');
const p = project as unknown as Record<string, unknown>;
const rows: string[] = [];
for (const key of Object.keys(p)) {
  const t = performance.now();
  let bytes = 0;
  try { bytes = JSON.stringify(p[key])?.length ?? 0; } catch { bytes = -1; }
  const t1 = performance.now();
  if (key !== 'tilesets') structuredClone(p[key]);
  const t2 = performance.now();
  rows.push(`${key.padEnd(24)} ${String(bytes).padStart(10)} bytes  json ${(t1 - t).toFixed(1)}ms  clone ${(t2 - t1).toFixed(1)}ms`);
}
console.log(rows.join('\n'));
const db = p.database as Record<string, unknown>;
console.log('--- database');
for (const key of Object.keys(db)) {
  const t = performance.now();
  const bytes = JSON.stringify(db[key])?.length ?? 0;
  const t1 = performance.now();
  structuredClone(db[key]);
  const t2 = performance.now();
  if (bytes > 2000) console.log(`${key.padEnd(24)} ${String(bytes).padStart(10)} bytes  clone ${(t2 - t1).toFixed(1)}ms`);
}
const maps = p.maps as Record<string, unknown>;
console.log('--- maps', Object.keys(maps).length);
let total = 0;
const t = performance.now();
for (const id of Object.keys(maps)) structuredClone(maps[id]);
console.log('all maps clone', (performance.now() - t).toFixed(1), 'ms');
process.exit(total);
