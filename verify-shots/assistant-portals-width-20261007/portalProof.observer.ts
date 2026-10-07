import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync, openSync, closeSync, unlinkSync } from 'node:fs';
import { resolve } from 'node:path';
import { backup, DatabaseSync } from 'node:sqlite';
import { isDeepStrictEqual } from 'node:util';
import { execFileSync } from 'node:child_process';
import { firefox } from 'playwright';
import { createBlankProject, TILE, COMBINED_TOWN_TILESET_ID } from '../../../project/defaults';
import { createBlankMap } from '../../../project/defaults/defaultMaps';
import { canMove } from '../../../project/collision';
import { layerTileAt } from '../../../project/mapLayers';
import { runTool } from '../../../editor/tools';
import { SMALL_BEODEUL_HOUSES } from '../../../editor/tools/beodeulSmallVillage';
import { touchBlockedCells } from '../../../editor/tools/transferReachability';
import { handInteriorMapExits } from '../../../editor/handInterior/exits';
import { createAtlasBiomeInteriorTileset, ensureAtlasBiomeInteriorCurrent } from '../../../project/defaults/atlasBiomeInterior';
import { initLocalProjectStore } from '../../../../electron/local-store/store';
import { sharedContentFile } from '../../../../scripts/lib/sharedContentSqlite';
import { execute, digest } from './editorDriver.mjs';
import { startPlayerQaServer, runRuntimeQa } from '../../../../scripts/lib/runtimeQaRun.mjs';
import type { Command, GameMap, Project } from '../../../project/types';

type Point = { x: number; y: number };
const MAP = 'map_portal_village', SENTINEL = 'map_portal_sentinel';
const save = (file: string, value: unknown) => writeFileSync(file, JSON.stringify(value, null, 2) + '\n');
const check = (id: string, ok: unknown, detail: string) => ({ id, ok: Boolean(ok), detail });

export async function runPortalControls(root: string): Promise<number> {
  if (existsSync(root)) throw Error('기존 controls 덮어쓰기 거부');
  mkdirSync(root, { recursive: true });
  const rows: ReturnType<typeof check>[] = [];
  {
    const fresh = createAtlasBiomeInteriorTileset();
    const id = 'hand-interior-v5-exit-width';
    rows.push(check('new-project-exit-width-reference', fresh.referenceDocuments?.some(c => c.documents.some(d => d.id === id && d.markdown.includes('width:1'))), '새 번들이 문 폭 계약을 함께 소유'));
    const old = structuredClone(fresh);
    old.referenceDocuments![0]!.documents = old.referenceDocuments![0]!.documents.filter(d => d.id !== id);
    old.referenceDocuments![0]!.documents.push({ id: 'authored-width-note', name: '저자 문서', markdown: '보존 원문' });
    const first = old.referenceDocuments![0]!.documents[0]!;
    first.markdown = '저자가 수정한 원문';
    const p = { tilesets: { [old.id]: old } };
    const changed = ensureAtlasBiomeInteriorCurrent(p, old.id);
    rows.push(check('existing-project-reference-backfilled', changed && old.referenceDocuments!.some(c => c.documents.some(d => d.id === id)) && old.referenceDocuments![0]!.documents.find(d => d.id === first.id)?.markdown === '저자가 수정한 원문' && old.referenceDocuments![0]!.documents.some(d => d.id === 'authored-width-note'), '같은 시트 판본의 기존 참고문서에 새 계약을 추가하며 저자 문서를 보존'));
  }
  const fixture = () => {
    const p = createBlankProject();
    const a = createBlankMap('A', 12, 10, COMBINED_TOWN_TILESET_ID), b = createBlankMap('B', 12, 10, COMBINED_TOWN_TILESET_ID);
    a.id = 'map_control_a'; b.id = 'map_control_b';
    p.maps = { [a.id]: a, [b.id]: b }; p.startMapId = a.id; p.startPos = { x: 2, y: 5 };
    p.mapTree = { mapId: a.id, children: [{ mapId: b.id, children: [] }] };
    return { p, a, b };
  };
  for (const name of ['create_transfer_pair', 'link_maps']) {
    const { p, a, b } = fixture();
    for (let y = 0; y < a.height; y++) a.lowerTiles[y * a.width + 8] = TILE.WALL;
    const before = JSON.stringify(p.maps);
    const from = { mapId: a.id, x: 11, y: 5 }, to = { mapId: b.id, x: 0, y: 5 };
    const result = runTool({ project: p }, name, name === 'link_maps' ? { from, to } : { a: from, b: to });
    rows.push(check(`${name}:unreachable-rejected`, !result.ok, result.summary));
    rows.push(check(`${name}:failed-pair-atomic`, before === JSON.stringify(p.maps), '거절된 쌍은 두 맵 모두 불변'));
  }
  {
    const { p, a, b } = fixture();
    for (let y = 0; y < a.height; y++) a.lowerTiles[y * a.width + 4] = TILE.WALL;
    a.lowerTiles[1 * a.width + 6] = TILE.WALL;
    const before = JSON.stringify(p.maps);
    const result = runTool({ project: p }, 'create_transfer_pair', { a: { mapId: a.id, x: 6, y: 2, doorAt: { x: 6, y: 1 } }, b: { mapId: b.id, x: 0, y: 5 } });
    rows.push(check('door-front-fixed', !result.ok && before === JSON.stringify(p.maps), '막힌 문앞을 옆 빈칸으로 바꾸지 않고 원자적으로 거절'));
  }
  {
    const ctx = { project: fixture().p }, from = { mapId: 'map_control_a', x: 11, y: 5 }, to = { mapId: 'map_control_b', x: 0, y: 5 };
    const first = runTool(ctx, 'link_maps', { from, to }), firstMaps = JSON.stringify(ctx.project.maps);
    const second = runTool(ctx, 'link_maps', { from, to });
    rows.push(check('stable-link-repeat', first.ok && second.ok && firstMaps === JSON.stringify(ctx.project.maps), '같은 연결 재실행 시 기존 ID·좌표·이벤트 수 보존'));
  }
  {
    const ctx = { project: fixture().p };
    const wide = { mapId: 'map_width_control', plan: ['##########', '#........#', '#........#', '#........#', '#........#', '#........#', '####..####'], floor: 'boards', wall: 'plaster', start: [{ x: 4, y: 5 }] };
    const before = JSON.stringify(ctx.project.maps);
    const rejected = runTool(ctx, 'build_hand_interior_room', wide);
    rows.push(check('two-cell-exit-rejected', !rejected.ok && rejected.summary.includes('가로 2칸'), rejected.summary));
    rows.push(check('exit-start-cannot-hide-width', !rejected.ok && before === JSON.stringify(ctx.project.maps), 'start 한 칸 선언에도 두 칸 틈은 거부하며 맵 불변'));
    const allowed = runTool(ctx, 'build_hand_interior_room', { ...wide, exitWidth: 2 });
    rows.push(check('explicit-wide-entrance-retained', allowed.ok && handInteriorMapExits(ctx.project, ctx.project.maps[wide.mapId]!).some(e => e.width === 2), allowed.summary));
    for (const name of ['create_transfer_pair', 'link_maps']) {
      const a = { mapId: 'map_control_a', x: 3, y: 3, doorAt: { x: 3, y: 2 } }, b = { mapId: wide.mapId, x: 4, y: 6 };
      const maps = JSON.stringify(ctx.project.maps);
      const pair = runTool(ctx, name, name === 'link_maps' ? { from: a, to: b } : { a, b });
      rows.push(check(`${name}:door-width-mismatch`, !pair.ok && pair.summary.includes('가로 폭') && maps === JSON.stringify(ctx.project.maps), pair.summary));
    }
    const narrow = runTool(ctx, 'build_hand_interior_room', { ...wide, replace: true, plan: [...wide.plan.slice(0, -1), '####.#####'] });
    const linked = runTool(ctx, 'create_transfer_pair', { a: { mapId: 'map_control_a', x: 3, y: 3, doorAt: { x: 3, y: 2 } }, b: { mapId: wide.mapId, x: 4, y: 6 } });
    rows.push(check('single-door-single-exit-linked', narrow.ok && linked.ok && handInteriorMapExits(ctx.project, ctx.project.maps[wide.mapId]!).every(e => e.width === 1), linked.summary));
  }
  save(resolve(root, 'controls.json'), { kind: 'tool-controls', modelCalls: 0, pass: rows.every(row => row.ok), checks: rows });
  console.log(JSON.stringify(rows));
  return rows.every(row => row.ok) ? 0 : 1;
}

function transfers(project: Project, map: GameMap) {
  return map.events.flatMap(event => (event.pages ?? []).flatMap(page => page.commands.filter((c): c is Extract<Command, { kind: 'transfer' }> => c.kind === 'transfer').map(command => ({ event, page, command }))));
}

function route(project: Project, map: GameMap, from: Point, target: Point): Point[] {
  const blocked = touchBlockedCells(map);
  for (const e of map.events) if (e.pages?.[0]?.priority === 'same' && e.pages[0].overlapForbidden !== false) blocked.add(`${e.x},${e.y}`);
  // 마지막 입력은 막힌 playerTouch 문에 부딪혀도 이동을 발동한다(playSceneMovement).
  // 다른 이벤트는 우회하지만 검사할 문 자체를 경로에서 제외하지 않는다.
  blocked.delete(`${target.x},${target.y}`);
  const key = (p: Point) => p.y * map.width + p.x;
  const queue = [from], previous = new Map<number, Point | null>([[key(from), null]]);
  for (let i = 0; i < queue.length; i++) {
    const here = queue[i]!;
    if (key(here) === key(target)) {
      const path: Point[] = []; let cell: Point | null = here;
      while (cell) { path.push(cell); cell = previous.get(key(cell)) ?? null; }
      return path.reverse();
    }
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const next = { x: here.x + dx!, y: here.y + dy! };
      if (next.x < 0 || next.x >= map.width || next.y < 0 || next.y >= map.height || blocked.has(`${next.x},${next.y}`) || previous.has(key(next))) continue;
      if (!canMove(project, map, here.x, here.y, next.x, next.y)) continue;
      previous.set(key(next), here); queue.push(next);
    }
  }
  throw Error(`실제 통행 경로 없음: ${map.id} (${from.x},${from.y})→(${target.x},${target.y})`);
}

async function runtime(project: Project, dir: string, links: ReturnType<typeof transfers>, observation = 'runtime') {
  const playerFile = resolve(dir, 'player.json');
  const receiptFile = `${playerFile}.receipt.json`;
  const projection = existsSync(receiptFile) ? JSON.parse(readFileSync(receiptFile, 'utf8')) : null;
  const reuse = projection?.sourceSha256 === digest(readFileSync(resolve(dir, 'live.json')))
    && existsSync(playerFile) && projection.playerSha256 === digest(readFileSync(playerFile))
    && existsSync(`${playerFile}.assets.json`);
  if (!reuse) execFileSync(process.execPath, [resolve('node_modules/vite-node/vite-node.mjs'), '--config', 'vite.config.ts', 'src/harnesses/assistant-capability/node/runtimeProjection.ts', '--', resolve(dir, 'live.json'), playerFile], { stdio: 'pipe', maxBuffer: 1024 * 1024 });
  const beats: any[] = [{ id: 'title', ops: [], expect: { testidPresent: ['title-screen'] }, shot: false },
    { id: 'village-start', ops: [{ kind: 'key', key: 'Enter' }, { kind: 'waitForRuntime' }], expect: { mapId: MAP, ...project.startPos }, shot: true }];
  let current: Point = project.startPos;
  const ready = [{ kind: 'waitForText', testid: 'runtime-state-json', text: '"inputEnabled":true', timeoutMs: 15000 }, { kind: 'waitForText', testid: 'runtime-state-json', text: '"running":false', timeoutMs: 15000 }];
  const walk = (map: GameMap, from: Point, gate: Point, target: { mapId: string; x: number; y: number }, prefix: string) => {
    const path = route(project, map, from, gate);
    for (let i = 1; i < path.length; i++) {
      const previous = path[i - 1]!, cell = path[i]!;
      const dir = cell.x > previous.x ? 'right' : cell.x < previous.x ? 'left' : cell.y > previous.y ? 'down' : 'up';
      const final = i === path.length - 1;
      const position = final ? { mapId: target.mapId, x: target.x, y: target.y } : { mapId: map.id, ...cell };
      beats.push({ id: `${prefix}-${i}`, ops: [...ready, { kind: 'key', key: `Arrow${dir[0]!.toUpperCase()}${dir.slice(1)}` }, { kind: 'waitForPosition', ...position, timeoutMs: 5000 }], expect: position, shot: final || i === path.length - 2 });
    }
  };
  for (const [index, link] of links.entries()) {
    const other = project.maps[link.command.mapId]!;
    const returning = transfers(project, other).find(t => t.command.mapId === MAP);
    if (!returning) throw Error(`귀환문 없음: ${other.id}`);
    walk(project.maps[MAP]!, current, link.event, link.command, `enter-${index}`);
    // A real wait observes immediate re-transfer bugs; no runtime data is altered.
    beats.push({ id: `arrival-stable-${index}`, ops: [...ready, { kind: 'waitForRuntime' }], expect: { mapId: other.id, x: link.command.x, y: link.command.y }, shot: true });
    const inside = route(project, other, link.command, returning.event);
    if (inside.length < 2) throw Error('착지와 귀환문 겹침');
    walk(other, link.command, returning.event, returning.command, `return-${index}`);
    current = returning.command;
    beats.push({ id: `returned-${index}`, ops: ready, expect: { mapId: MAP, ...current }, shot: true });
  }
  const scenario = { id: 'assistant-map-portals', viewport: { width: 1024, height: 768 }, projectFixture: playerFile, beats };
  save(resolve(dir, `${observation}-scenario.json`), scenario);
  const server = await startPlayerQaServer({ logLevel: 'silent' });
  const browser = await firefox.launch();
  try {
    const page = await browser.newPage();
    const assets = new Map(JSON.parse(readFileSync(`${playerFile}.assets.json`, 'utf8')).map((a: any) => [`/${a.zipPath}`, a]));
    await page.route('**/assets/uploaded/**', r => { const a: any = assets.get(decodeURIComponent(new URL(r.request().url()).pathname)); return a ? r.fulfill({ path: a.file, contentType: a.mime }) : r.fulfill({ status: 404 }); });
    const report = await runRuntimeQa(page, scenario, { serverUrl: server.url, outDir: resolve(dir, observation) });
    const targets = report.beats.filter((b: any) => b.shot && (/^(arrival-stable|returned)-/.test(b.id)
      || /^enter-/.test(b.id) && scenario.beats[b.index + 1]?.id.startsWith('enter-')));
    appendFileSync(resolve(dir, `${observation}/SUMMARY.md`), '\n## 출입구 수행 필수 시각 QA\n\n비트 통과와 별도로 문앞·착지·귀환의 실제 화면을 읽는다.\n\n'
      + targets.map((b: any) => `- 즉시 확인: ${b.shot} — ${b.id}`).join('\n') + '\n');
    console.log(readFileSync(resolve(dir, `${observation}/SUMMARY.md`), 'utf8').slice(0, 2500));
    return { pass: !report.errors.length && report.beats.every((b: any) => !b.failures.length), beats: report.beats.length, errors: report.errors, failures: report.beats.filter((b: any) => b.failures.length).map((b: any) => ({ id: b.id, failures: b.failures })) };
  } finally { await browser.close(); await server.close(); }
}

export async function runPortalProof(root: string): Promise<number> {
  if (existsSync(root)) throw Error('기존 실제 시도 덮어쓰기 거부');
  const dir = resolve(root, 'map-portals'), projectDir = resolve(dir, 'project');
  mkdirSync(dir, { recursive: true });
  const config = JSON.parse(readFileSync(resolve('harness-data/assistant-capability/seed.json'), 'utf8')).portalProbe;
  const project = createBlankProject();
  const sentinel = Object.values(project.maps)[0]!; sentinel.id = SENTINEL; sentinel.name = '보존 표본';
  const map = createBlankMap('입구 시험장', 40, 30, 'beodeul_city'); map.id = MAP;
  project.maps = { [MAP]: map, [SENTINEL]: sentinel }; project.mapTree = { mapId: MAP, children: [{ mapId: SENTINEL, children: [] }] };
  project.startMapId = MAP; project.startPos = { x: 1, y: 14 }; project.meta.title = '조수 출입구 실제 시험';
  if (project.system.opening) project.system.opening.enabled = false;
  const sourcePath = sharedContentFile();
  if (existsSync(sourcePath)) { const db = new DatabaseSync(sourcePath, { readOnly: true }); try { await backup(db, resolve(dir, 'shared-content.sqlite')); } finally { db.close(); } }
  const store = await initLocalProjectStore({ projectDir });
  try { await store.saveProject(project); save(resolve(dir, 'fixture.json'), { projectId: store.projectId, task: config.prompt, source: 'blank shipped project', seedDigest: digest(readFileSync('harness-data/assistant-capability/seed.json')) }); } finally { store.close(); }
  const lockPath = resolve(dir, 'run.lock'), lock = openSync(lockPath, 'wx');
  writeFileSync(lock, JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() })); closeSync(lock);
  const result: any = { inputMode: 'natural', gates: { visual: { status: 'pending' } } };
  try {
    const run = await execute(config, dir, config.timeoutMs, {});
    const full = JSON.parse(readFileSync(resolve(dir, 'live.json'), 'utf8')) as Project;
    const village = full.maps[MAP]!;
    const links = transfers(full, village).filter(t => t.command.mapId !== MAP);
    const interiorLinks = links.filter(t => full.maps[t.command.mapId]?.tilesetId === 'atlas_biome_interior');
    const fieldLinks = links.filter(t => full.maps[t.command.mapId]?.tilesetId === 'beodeul_city');
    const kit = full.tilesets.beodeul_city?.structureKits?.find(k => k.id === SMALL_BEODEUL_HOUSES[0].kit);
    const entrance = kit?.parts?.find(p => p.kind === 'entrance');
    const expectedFront = entrance ? { x: SMALL_BEODEUL_HOUSES[0].x + entrance.dx, y: SMALL_BEODEUL_HOUSES[0].y + entrance.dy + entrance.h } : null;
    const required = [check('native-pi-completed', run.realRun && !run.events.some((e: any) => ['error', 'stream_error'].includes(e.type)) && !run.errors.length, '실제 입력창·모델 응답 완료, 오류 없음'),
      check('house-door-linked', expectedFront && interiorLinks.some(t => t.event.x === expectedFront.x && t.event.y === expectedFront.y), `첫 집의 실제 원본 문앞: ${JSON.stringify(expectedFront)}`),
      check('east-edge-linked', fieldLinks.some(t => t.event.x === village.width - 1), '마을 동쪽 맵 끝에서 들판 연결'),
      check('interior-authored', interiorLinks.some(t => new Set(full.maps[t.command.mapId]!.upperTiles).size > 4), '손 도트 실내 가구 배치 존재'),
      check('house-exit-width-matched', interiorLinks.length > 0 && interiorLinks.every(t => {
        const inside = full.maps[t.command.mapId]!;
        const spans = handInteriorMapExits(full, inside);
        return spans.length > 0 && spans.every(exit => exit.width === 1)
          && transfers(full, inside).some(back => back.command.mapId === MAP && spans.some(exit => back.event.x === exit.x && back.event.y === exit.y));
      }), '첫 집 문 폭 1칸과 실내의 실제 남쪽 틈 폭·귀환 이벤트 일치(start 선언과 무관)'),
      check('start-preserved', run.after.startMapId === run.before.startMapId && isDeepStrictEqual(run.after.startPos, run.before.startPos), '시작 맵·위치 보존'),
      check('sentinel-preserved', isDeepStrictEqual(run.before.maps[SENTINEL], run.after.maps[SENTINEL]), '기존 표본 맵 전체 보존'),
      check('sqlite-reloaded', run.receipt.sameTarget && run.receipt.sameStoredDocument && run.receipt.reloadEqual, '동일 SQLite SHA·새 브라우저 context의 저장본 재로드')];
    // The raster, not the assistant summary, must contain all three shipped houses.
    for (const house of SMALL_BEODEUL_HOUSES.slice(0, 3)) {
      const source = full.tilesets.beodeul_city.structureKits?.find(k => k.id === house.kit);
      const cells = source?.rows.flatMap((row, y) => (row.upperTiles ?? []).map((tile, x) => ({ tile, x: house.x + x, y: house.y + y }))).filter(c => c.tile >= 0) ?? [];
      required.push(check(`house-raster-${house.kit}`, cells.length && cells.every(c => layerTileAt(village, 3, c.y * village.width + c.x) === c.tile), '설치된 원본 집 전체 도트와 좌표 일치'));
    }
    result.gates.data = { status: required.every(r => r.ok) ? 'pass' : 'fail', checks: required };
    result.modelRequests = run.requests; result.persistence = run.receipt;
    result.portals = links.map(t => ({ mapId: MAP, x: t.event.x, y: t.event.y, target: t.command }));
    result.gates.runtime = await runtime(full, dir, [...interiorLinks.slice(0, 1), ...fieldLinks.slice(0, 1)]).catch(e => ({ pass: false, detail: e.message }));
    if (!interiorLinks.length || !fieldLinks.length) result.gates.runtime.pass = false;
  } catch (e: any) { result.failure = e.message; result.failurePhase = e.harnessPhase; }
  finally { unlinkSync(lockPath); }
  save(resolve(dir, 'result.json'), result);
  writeFileSync(resolve(root, 'SUMMARY.md'), '# 조수 출입구 실제 시험\n\n' + JSON.stringify(result, null, 2) + '\n\n즉시 확인: map-portals/after.png, map-portals/reloaded.png, map-portals/runtime/SUMMARY.md\n');
  console.log(JSON.stringify(result, null, 2));
  return result.gates.data?.status === 'pass' && result.gates.runtime?.pass ? 0 : 1;
}

export async function reviewPortalProof(root: string, args: string[]): Promise<number> {
  const option = (name: string) => { const i = args.indexOf(`--${name}`); return i < 0 ? undefined : args[i + 1]; };
  const status = option('status'), reviewer = option('reviewer'), notes = option('notes');
  const files = option('images')?.split(',').filter(Boolean) ?? [];
  if (!['pass', 'fail'].includes(status ?? '') || !reviewer || !notes || !files.length) throw Error('review는 status·reviewer·images·구체적인 notes가 필요합니다.');
  const dir = resolve(root, 'map-portals'), resultFile = resolve(dir, 'result.json');
  const result = JSON.parse(readFileSync(resultFile, 'utf8'));
  if (status === 'pass' && (!files.includes('after.png') || !files.includes('reloaded.png') || !files.some(f => /^runtime(?:-[\w-]+)?\//.test(f)))) throw Error('합격 검수는 적용·재로드·실제 플레이 그림을 모두 읽어야 합니다.');
  const images = files.map(file => {
    const path = resolve(dir, file);
    if (!path.startsWith(dir + '/') || !file.endsWith('.png')) throw Error('이 실행의 PNG만 검수할 수 있습니다.');
    return { file, sha256: digest(readFileSync(path)) };
  });
  save(resolve(dir, 'visual-review.json'), { status, reviewer, notes, resultDigest: digest(readFileSync(resultFile)), images });
  const complete = result.gates.data?.status === 'pass' && result.gates.runtime?.pass && status === 'pass';
  writeFileSync(resolve(root, 'REVIEW.md'), `# 출입구 검수\n\n${complete ? '검수 완료: 요구·보존·SQLite·왕복·시각 통과' : '검수 완료: 결함 또는 다른 관문 실패'}\n\n${notes}\n\n` + files.map(f => `- ${f}`).join('\n') + '\n');
  console.log(JSON.stringify({ complete, status, images: images.length, notes }));
  return complete ? 0 : 1;
}

export async function recheckPortalRuntime(root: string, args: string[] = []): Promise<number> {
  const at = args.indexOf('--attempt'), attempt = at < 0 ? undefined : args[at + 1];
  if (at >= 0 && (!attempt || !/^[a-z0-9-]{1,32}$/.test(attempt))) throw Error('attempt는 소문자·숫자·하이픈 1~32자로 지정합니다.');
  const observation = attempt ? `runtime-${attempt}` : 'runtime';
  const dir = resolve(root, 'map-portals'), receiptFile = resolve(dir, `runtime-recheck${attempt ? `-${attempt}` : ''}.json`);
  if (existsSync(receiptFile) || existsSync(resolve(dir, observation))) throw Error('기존 플레이 관측 덮어쓰기 거부');
  const source = readFileSync(resolve(dir, 'live.json'));
  const project = JSON.parse(source.toString()) as Project;
  const links = transfers(project, project.maps[MAP]!).filter(t => ['atlas_biome_interior', 'beodeul_city'].includes(project.maps[t.command.mapId]?.tilesetId ?? ''));
  const result = await runtime(project, dir, links, observation);
  save(receiptFile, { kind: 'saved-output-runtime-recheck', modelCalls: 0, observation, observerDigest: digest(readFileSync(resolve('src/harnesses/assistant-capability/node/portalProof.ts'))), originalResultDigest: digest(readFileSync(resolve(dir, 'result.json'))), sourceDigest: digest(source), ...result });
  return result.pass ? 0 : 1;
}
