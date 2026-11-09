
// Default leak table: two blank projects (wholeGamePrepare path) + saved Terra games vs factory defaults.
import { cpSync, mkdirSync, existsSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createBlankProject } from '@/project/defaults';
import { openLocalProjectStore } from '../../../electron/local-store/store';
const out = resolve(process.argv[2]);
mkdirSync(out, { recursive: true });
const prep = resolve('src/harnesses/assistant-capability/node/wholeGamePrepare.ts');
for (const [n, t] of [['A', '붉은 달의 여관'], ['B', '바다 위의 도서관']] as const)
  if (!existsSync(resolve(out, n, 'project/project.sqlite'))) execFileSync('bun', [prep, resolve(out, n), t], { stdio: 'inherit' });
async function load(dir: string) {
  const s = await openLocalProjectStore({ projectDir: dir });
  try { return s.loadSnapshot()!.project as any; } finally { s.close(); }
}
const FIELDS: Record<string, (p: any) => unknown> = {
  'meta.title': p => p.meta?.title,
  'system.titleScreen.title': p => p.system?.titleScreen?.title,
  'system.titleScreen.backgroundResourceId': p => p.system?.titleScreen?.backgroundResourceId,
  'system.titleResourceId': p => p.system?.titleResourceId,
  'system.titleScreen.logoSubtitle (title subtitle; unset -> player draws "이야기가 시작되는 곳"/"A NEW ADVENTURE")': p => p.system?.titleScreen?.logoSubtitle ?? '(unset -> runtime default text)',
  'system.titleScreen.musicResourceId': p => p.system?.titleScreen?.musicResourceId ?? '(unset)',
  'start party names': p => (p.system?.startActorIds ?? []).map((i: string) => p.database.actors.find((a: any) => a.id === i)?.name),
  'start party initialEquipment': p => (p.system?.startActorIds ?? []).map((i: string) => p.database.actors.find((a: any) => a.id === i)?.initialEquipment),
  'start party character/face': p => (p.system?.startActorIds ?? []).map((i: string) => { const a = p.database.actors.find((x: any) => x.id === i); return [a?.characterResourceId, a?.faceResourceId]; }),
  'endings[].presentation.backgroundResourceId (unset -> runtime falls back to titleScreen.backgroundResourceId)': p => (p.endings ?? []).map((e: any) => e.presentation?.backgroundResourceId ?? '(unset->title bg)'),
  'opening.scenes (resource|narration)': p => (p.system?.opening?.scenes ?? []).map((s: any) => `${s.resourceId}|${s.narration ?? ''}`),
  'system.battleBgmResourceId': p => p.system?.battleBgmResourceId,
  'system.defaultBgmResourceId': p => p.system?.defaultBgmResourceId,
  'system.systemResourceId (window skin)': p => p.system?.systemResourceId,
  'system.fieldHud': p => p.system?.fieldHud ?? '(unset)',
  'system.gameOver': p => p.system?.gameOver ?? '(unset)',
};
const J = (v: unknown) => JSON.stringify(v);
const A = await load(resolve(out, 'A/project')), B = await load(resolve(out, 'B/project'));
const factory = createBlankProject() as any;
const rows: any[] = [];
for (const [k, f] of Object.entries(FIELDS)) rows.push({ field: k, a: f(A), b: f(B), identicalAcrossProjects: J(f(A)) === J(f(B)) && k !== 'meta.title', isFactoryDefault: J(f(A)) === J(f(factory)) });
const games = process.argv[3] ? readdirSync(process.argv[3]).filter(g => existsSync(resolve(process.argv[3], g, 'project/project.sqlite'))).sort() : [];
const terra: any[] = [];
for (const g of games) {
  const src = resolve(process.argv[3], g, 'project'), dst = resolve(out, 'terra', g);
  if (!existsSync(dst)) { mkdirSync(dst, { recursive: true }); cpSync(src, dst, { recursive: true, filter: (s) => !s.endsWith('-shm') && !s.endsWith('-wal') || true }); }
  try {
    const p = await load(dst);
    const row: any = { game: g };
    for (const [k, f] of Object.entries(FIELDS)) row[k] = J(f(p)) === J(f(factory));
    row._title = p.meta?.title; row._endings = (p.endings ?? []).length;
    terra.push(row);
  } catch (e) { terra.push({ game: g, error: String(e).slice(0, 200) }); }
}
writeFileSync(resolve(out, 'leak-table.json'), JSON.stringify({ rows, terra }, null, 1));
console.log(JSON.stringify({ rows, terra }, null, 1));
