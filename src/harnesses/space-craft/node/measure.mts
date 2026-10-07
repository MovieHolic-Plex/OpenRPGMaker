// 결정론 지표 + 원본 크기 렌더. 모델을 부르지 않는다. 기계 통과는 시각 합격이 아니다 — 그림은 판정자·사람이 본다.
//   bun src/harnesses/space-craft/node/measure.mts --out <실행 폴더> [--case id]
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { PNG } from 'pngjs';
import { loadHeadlessProject } from '../../../headless/index';
import { renderMapPng } from '../../../../scripts/qa-game/render.mts';
import { store } from '../../../project/store';
import { measureLayoutQuality } from '../../../ai/piAgent/layoutQuality';
import { computeReachableCells } from '../../../project/lint/reachability';
import { isPassable } from '../../../project/collision';
import { tilesetFamily } from '../../../project/tilesetFamily';
import type { GameMap, Project } from '../../../project/types';

const args = process.argv.slice(2);
const option = (name: string) => { const i = args.indexOf(`--${name}`); return i < 0 ? undefined : args[i + 1]; };
const root = resolve(option('out') ?? '');
const chosen = option('case')?.split(',');
const seed = JSON.parse(readFileSync(resolve('harness-data/space-craft/seed.json'), 'utf8'));

const readJson = (file: string): unknown => {
  if (existsSync(file)) return JSON.parse(readFileSync(file, 'utf8'));
  if (existsSync(`${file}.gz`)) return JSON.parse(gunzipSync(readFileSync(`${file}.gz`)).toString('utf8'));
  throw Error(`없음: ${file}`);
};
const readProject = (file: string): Project => {
  const text = existsSync(file) ? readFileSync(file, 'utf8') : gunzipSync(readFileSync(`${file}.gz`)).toString('utf8');
  try { return loadHeadlessProject(text); } catch { return JSON.parse(text) as Project; }
};
const sha = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');

/** 이 맵으로 들어오는 이동 명령의 도착 칸. 들어오는 길이 없으면 시작 위치 → 아무 통행 칸. */
function entryPoints(project: Project, map: GameMap): { x: number; y: number }[] {
  const found: { x: number; y: number }[] = [];
  const walk = (value: unknown): void => {
    if (Array.isArray(value)) { value.forEach(walk); return; }
    if (!value || typeof value !== 'object') return;
    const record = value as Record<string, unknown>;
    if (record.kind === 'transfer' && record.mapId === map.id && typeof record.x === 'number' && typeof record.y === 'number') found.push({ x: record.x, y: record.y });
    Object.values(record).forEach(walk);
  };
  for (const other of Object.values(project.maps)) for (const event of other.events) walk(event);
  if (project.startMapId === map.id && project.startPos) found.push(project.startPos);
  return found;
}

function reachability(project: Project, map: GameMap) {
  let passable = 0;
  const cells: string[] = [];
  for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) if (isPassable(project, map, x, y)) { passable++; cells.push(`${x},${y}`); }
  const entries = entryPoints(project, map).filter(p => isPassable(project, map, p.x, p.y));
  if (passable === 0) return { passable, reachable: 0, ratio: 0, entry: null, entryFound: entries.length > 0 };
  // 입구가 있으면 거기서, 없으면 가장 큰 통행 덩어리에서 잰다. 과제 문장이 「연결」을 요구하지 않으므로
  // 입구 없음은 공간 품질 실패가 아니다 — 방 안이 끊겼는지만 본다.
  let start = entries[0];
  let seen = start ? computeReachableCells(project, map, start.x, start.y) : new Set<string>();
  if (!start) {
    const visited = new Set<string>();
    for (const key of cells) {
      if (visited.has(key)) continue;
      const [x, y] = key.split(',').map(Number) as [number, number];
      const component = computeReachableCells(project, map, x, y);
      for (const cell of component) visited.add(cell);
      if (component.size > seen.size) { seen = component; start = { x, y }; }
    }
  }
  const reachable = cells.filter(key => seen.has(key)).length;
  return { passable, reachable, ratio: reachable / passable, entry: start ?? null, entryFound: entries.length > 0 };
}

function crop(png: PNG, x0: number, y0: number, w: number, h: number): Buffer {
  const out = new PNG({ width: w, height: h });
  for (let y = 0; y < h; y++) png.data.copy(out.data, y * w * 4, ((y0 + y) * png.width + x0) * 4, ((y0 + y) * png.width + x0 + w) * 4);
  return PNG.sync.write(out);
}

function changedMapIds(before: Project, after: Project): string[] {
  return Object.keys(after.maps).filter(id => {
    const a = before.maps[id], b = after.maps[id]!;
    if (!a) return true;
    return JSON.stringify([a.lowerTiles, a.upperTiles, a.events, a.width, a.height, a.tilesetId])
      !== JSON.stringify([b.lowerTiles, b.upperTiles, b.events, b.width, b.height, b.tilesetId]);
  });
}

const attempts = readdirSync(root, { withFileTypes: true }).filter(d => d.isDirectory() && existsSync(resolve(root, d.name, 'result.json')))
  .map(d => d.name).filter(name => !chosen || chosen.some(id => name === id || name.startsWith(`${id}-r`))).sort();
for (const attempt of attempts) {
  const dir = resolve(root, attempt);
  const result = JSON.parse(readFileSync(resolve(dir, 'result.json'), 'utf8'));
  const category = seed.categories[result.category];
  if (result.status === 'harness-error') {
    writeFileSync(resolve(dir, 'measure.json'), JSON.stringify({ attempt, status: 'not-measured', reason: result.failure }, null, 2));
    console.log(`${attempt}: 측정 안 함(실행 오류)`); continue;
  }
  const before = readJson(resolve(dir, 'before.json')) as Project;
  const after = readProject(resolve(dir, 'live.json'));
  store.replaceProject(after);
  const current = store.getCurrent();
  const targets = changedMapIds(before, current);
  mkdirSync(resolve(dir, 'render'), { recursive: true });
  const maps = targets.map(mapId => {
    const map = current.maps[mapId]!;
    const family = tilesetFamily(current, map.tilesetId);
    const layout = measureLayoutQuality(current, map);
    const reach = reachability(current, map);
    const { png } = renderMapPng(current, map, 1);
    const file = `render/${mapId}.png`;
    writeFileSync(resolve(dir, file), png);
    const decoded = PNG.sync.read(png);
    const hw = Math.floor(decoded.width / 2), hh = Math.floor(decoded.height / 2);
    const quadrants = [[0, 0], [hw, 0], [0, hh], [hw, hh]].map(([x, y], i) => {
      const bytes = crop(decoded, x!, y!, i % 2 ? decoded.width - hw : hw, i < 2 ? hh : decoded.height - hh);
      const name = `render/${mapId}.q${i + 1}.png`; writeFileSync(resolve(dir, name), bytes);
      return { file: name, sha256: sha(bytes) };
    });
    const npcs = map.events.filter(event => (event.pages ?? []).some(page => page.graphic?.sprite)).length;
    const g = seed.gates;
    const checks = [
      { id: 'family-allowed', ok: !seed.forbiddenFamilies.includes(family) && (category.families.length === 0 || category.families.includes(family)),
        detail: `${map.tilesetId} → ${family}${category.families.length ? ` (기대 ${category.families.join('/')})` : ' (무림: 기대 계열 없음 — 기록만)'}` },
      // 참고만: 과제가 연결을 요구하지 않는다. 판정(pass)에는 넣지 않는다.
      { id: 'entry-exists', ok: reach.entryFound, advisory: true, detail: reach.entryFound ? `입구 ${reach.entry!.x},${reach.entry!.y}` : '들어오는 이동·시작 위치 없음(참고 — 가장 큰 통행 덩어리에서 측정)' },
      { id: 'reachable', ok: reach.ratio >= g.reachableRatioMin, detail: `통행 ${reach.passable}칸 중 ${reach.reachable}칸 도달 (${(reach.ratio * 100).toFixed(0)}%)` },
      ...(layout ? [
        { id: 'empty-floor', ok: layout.empty <= g.emptyPctMax, detail: `빈 바닥 ${layout.empty.toFixed(0)}% (≤${g.emptyPctMax})` },
        { id: 'empty-square', ok: layout.square <= g.emptySquareMax, detail: `빈 정사각형 ${layout.square}칸 (≤${g.emptySquareMax})` },
        { id: 'mirror', ok: layout.mirror <= g.mirrorMax, detail: `좌우 대칭 배수 ${layout.mirror.toFixed(2)} (≤${g.mirrorMax})` },
      ] : []),
    ];
    return { mapId, name: map.name, tilesetId: map.tilesetId, family, size: [map.width, map.height], events: map.events.length, npcs,
      layout, reach, render: { file, sha256: sha(png), width: decoded.width, height: decoded.height }, quadrants, checks,
      pass: checks.every(check => check.ok || ('advisory' in check && check.advisory)) };
  });
  const measure = { schemaVersion: 1, attempt, caseId: result.caseId, category: result.category, measuredAt: new Date().toISOString(),
    status: maps.length === 0 ? 'no-map' : maps.every(m => m.pass) ? 'machine-pass' : 'machine-fail', maps };
  writeFileSync(resolve(dir, 'measure.json'), JSON.stringify(measure, null, 2));
  console.log(`${attempt}: ${measure.status} · 맵 ${maps.length}장 ${maps.map(m => `${m.name}(${m.family}) ${m.checks.filter(c => !c.ok && !('advisory' in c && c.advisory)).map(c => c.id).join(',') || 'ok'}`).join(' / ')}`);
}
