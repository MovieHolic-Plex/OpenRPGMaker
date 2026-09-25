// Opt-in real assistant observation for one direct-authoring case card. No answer arrays or mocked model responses.
// Usage: bun scripts/qa/pixel-art-world-family-live.mts <case id> <output dir> [resume dir|-] [feedback file|-]
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
import {PNG} from 'pngjs';
import {readSharedContent} from '../lib/sharedContentSqlite.ts';
import {createBlankProject} from '../../src/project/defaults/blankProject.ts';
import {runPiAgent} from '../lib/piAgentRuntime.ts';
import {resolveRequestApiKey} from '../lib/aiAuthRuntime.ts';
import {inspectInteriorPlacement} from '../../src/project/interiorPlacementAudit.ts';

const [caseId, out, resumeArg, feedbackArg] = process.argv.slice(2);
if (!caseId || !out) throw Error('Usage: <case id> <output dir> [resume dir|-] [feedback file|-]');
const card = JSON.parse(fs.readFileSync('tiledata/pixel-art-world/direct-cases.json', 'utf8')).cases.find((c: any) => c.id === caseId);
if (!card) throw Error('Unknown case ' + caseId);
const maxTurns = Number(process.env.PAW_DIRECT_MAX_TURNS ?? 100), timeoutMs = Number(process.env.PAW_DIRECT_TIMEOUT_MS ?? 900000);
fs.mkdirSync(out, {recursive: true});
const snapshot = readSharedContent(), library = snapshot.libraries['pixel-art-world-direct-families-local'];
const tilesetId = 'shared_paw_direct_' + card.family, owner = library?.tilesets[tilesetId];
if (!owner) throw Error('Publish the direct-authoring families first');
const mapId = 'direct-' + caseId;
let project: any = createBlankProject(); project.meta.title = 'PAW · ' + card.name;
project.tilesets = {[tilesetId]: structuredClone(owner)};
project.assets.uploaded = {[owner.image.id]: structuredClone(library.assets[owner.image.id])};
project.maps = {[mapId]: {id: mapId, name: '조수 직접 설계 · ' + card.name, width: card.width, height: card.height, tileSize: 32, tilesetId,
  lowerTiles: Array(card.width * card.height).fill(-1), upperTiles: Array(card.width * card.height).fill(-1), events: [], encounterRate: 0}};
project.mapTree = {mapId, children: []}; project.startMapId = mapId; project.startPos = {x: Math.floor(card.width / 2), y: card.height - 2};
const resume = resumeArg && resumeArg !== '-' ? resumeArg : undefined;
if (resume) project = JSON.parse(fs.readFileSync(resume + '/result-project.json', 'utf8'));

const calls: any[] = [], events: any[] = [], renders: any[] = [], cache = new Map();
function png(p: any, data: any) {
  const map = p.maps[data.mapId], ts = p.tilesets[map.tilesetId], asset = p.assets.uploaded[ts.image.id];
  let src = cache.get(ts.image.id); if (!src) { src = PNG.sync.read(Buffer.from(asset.dataUrl.split(',')[1], 'base64')); cache.set(ts.image.id, src); }
  const width = data.w ?? map.width, height = data.h ?? map.height, ox = data.x ?? 0, oy = data.y ?? 0, size = ts.tileSize;
  const dst = new PNG({width: width * size, height: height * size});
  for (const layer of [map.lowerTiles, map.upperTiles]) for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const tile = layer[(oy + y) * map.width + ox + x]; if (tile < 0) continue;
    for (let py = 0; py < size; py++) for (let px = 0; px < size; px++) {
      const si = ((Math.floor(tile / ts.tilesPerRow) * size + py) * src.width + tile % ts.tilesPerRow * size + px) * 4, di = ((y * size + py) * dst.width + x * size + px) * 4;
      const a = src.data[si + 3] / 255, b = dst.data[di + 3] / 255, v = a + b * (1 - a);
      for (let k = 0; k < 3; k++) dst.data[di + k] = v ? Math.round((src.data[si + k] * a + dst.data[di + k] * b * (1 - a)) / v) : 0;
      dst.data[di + 3] = Math.round(v * 255);
    }
  }
  return PNG.sync.write(dst);
}
async function render(p: any, data: any) {
  const bytes = png(p, data); fs.writeFileSync(`${out}/map-${renders.length}.png`, bytes); renders.push({file: `map-${renders.length}.png`, ...data});
  const resized = spawnSync('python3', ['-c', "from PIL import Image; import sys,io; im=Image.open(io.BytesIO(sys.stdin.buffer.read())); im.thumbnail((960,960),Image.Resampling.NEAREST); im.save(sys.stdout.buffer,format='PNG')"], {input: bytes, maxBuffer: 16 * 1024 * 1024});
  if (resized.status !== 0) throw Error('Preview resize failed'); return resized.stdout.toString('base64');
}

const task = `완성 맵을 복사하지 말고 ${resume ? '이전 조수가 직접 배치한 맵' : '빈 맵'} ${mapId}에서 직접 타일을 배치해라. 설계 대상: ${card.name}. ${card.brief}
타일셋 ${tilesetId}의 direct-authoring 용도의 모든 MD 페이지와 그림을 먼저 읽어라. 벽 재료는 ${card.wall}를 쓴다(천장 아래 벽 행 수는 사전 표를 따른다).
초기 캔버스 ${card.width}×${card.height}는 최종 크기 요구가 아니다. 방과 가구 크기를 고려해 필요하면 resize_map으로 맞춘다.
천장 아래 벽 정면 전체가 남쪽 외곽까지 맵 안에 들어가고, 모든 가구의 바닥 지지와 완전 조립, 의자 뒤와 조작면 접근을 확보한다.
완성 방/맵 배열이나 복제 도구는 없다. 네가 구조와 모든 가구 좌표를 정하고 paint_tiles로 직접 칠한다. materials.mapped와 objects.tiles가 현재 번호다.
정확한 부품은 cells 모드로 같은 tile 값의 여러 좌표를 묶어 호출한다. set_start_position을 정문 안에 지정한다.
마지막에 inspect_interior_layout(mapId, wallMaterial:'${card.wall}', entry, rooms, requirements)로 검사하고 오류 좌표를 직접 고쳐 다시 검사한다.
독립방은 rooms의 id/seed/doorways를 선언한다. 구조 오류0만으로 요청을 만족했다고 하지 말고 show_map_region의 실제 그림도 확인한다.
상위층 전체나 넓은 영역을 tile:-1로 지우고 다시 짓지 않는다. 틀린 곳만 고친다. 마지막에 구획/문턱/가구와 한계를 간결히 보고해라.
고정 요구조건(requirements 인자로 그대로 전달, 변경하지 말 것): ${JSON.stringify(card.requirements)}`;
const request = resume ? task + '\n\n이전 실행의 실제 배치를 이어서 수정한다. 이미 맞는 배치는 보존한다. 감독 검토 결과: ' + fs.readFileSync(feedbackArg!, 'utf8') : task;
fs.writeFileSync(out + '/request.txt', request);

let report: any;
try {
  const provider = 'google-antigravity', apiKey = await resolveRequestApiKey(provider); if (!apiKey) throw Error('Provider not connected');
  const done = await runPiAgent({provider, task: request, project, mapIds: [], scopeStrict: false, mode: 'single', applyMode: 'default', maxTurns, thinkingLevel: 'high'} as any, {
    apiKey, interiorRequirements: {[mapId]: card.requirements}, timeoutMs,
    toolNames: ['list_tileset_references', 'read_tileset_reference', 'get_map_region', 'get_tile_info', 'paint_tiles', 'show_map_region', 'set_start_position', 'resize_map', 'inspect_interior_layout'],
    renderToolImage: async (p: any, _name: string, data: any) => render(p, data),
    onToolCall: (r: any) => { calls.push(r); fs.writeFileSync(out + '/tool-calls.json', JSON.stringify(calls)); },
    onEvent: (e: any) => { if (['start', 'tool_start', 'tool_end', 'assistant', 'error', 'turn'].includes(e.type)) { events.push(e); fs.writeFileSync(out + '/events.json', JSON.stringify(events)); if (['start', 'tool_end', 'error'].includes(e.type)) console.log(JSON.stringify({type: e.type, ...(e.type === 'tool_end' ? {name: e.name} : {}), ...(e.type === 'error' ? {error: String(e.message ?? e).slice(0, 200)} : {})})); } },
  } as any);
  fs.writeFileSync(out + '/result-project.json', JSON.stringify(done.project));
  // Independent re-check of the final arrays with the card, not the model's own last call.
  const final = done.project, lastInspect = calls.filter(c => c.name === 'inspect_interior_layout' && c.result.ok).at(-1);
  const audit = inspectInteriorPlacement(final, mapId, card.wall, final.startPos, lastInspect?.args.rooms ?? [], card.requirements);
  fs.writeFileSync(out + '/actual-final.png', png(final, {mapId}));
  fs.writeFileSync(out + '/placement-audit.json', JSON.stringify(audit, null, 2));
  const writes = calls.filter(c => c.name === 'paint_tiles' && c.result.ok).length, errors = events.filter(e => e.type === 'error');
  report = {liveModel: true, caseId, family: card.family, model: events.find(e => e.type === 'start')?.model, resumedFrom: resume ?? null, stats: done.stats, writes,
    inspections: calls.filter(c => c.name === 'inspect_interior_layout' && c.result.ok).map(c => c.result.data.totalIssues),
    auditIssues: audit.totalIssues, auditCodes: [...new Set(audit.issues.map((i: any) => i.code))], errors: errors.map(e => String(e.message ?? '').slice(0, 300)),
    assistant: events.filter(e => e.type === 'assistant').map(e => e.text).at(-1), pass: audit.valid && errors.length === 0 && writes > 0};
} catch (e) { report = {liveModel: true, caseId, pass: false, error: String(e), stack: (e as Error)?.stack}; }
fs.writeFileSync(out + '/report.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify({caseId, pass: report.pass, writes: report.writes, inspections: report.inspections, auditCodes: report.auditCodes, error: report.error}));
if (!report.pass) process.exitCode = 1;
