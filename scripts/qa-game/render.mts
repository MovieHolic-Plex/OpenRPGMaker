// 클릭 없이 보는 시각 시트 — 모든 맵을 PNG 로 그리고, 검사 결과·자동 플레이 경로와 함께 자체완결 report.html 로 묶는다.
//
//   bun scripts/qa-game/render.mts qa-runs/<id>        → <id>/render/*.png + <id>/report.html
//   옵션: --project x.json (다른 프로젝트)  --out <dir>  --scale 1
//
// 타일은 에디터 캔버스 렌더러와 같은 함수(`editor/mapTileDraw.drawMapTileLayer`: 받침 타일·4분면 오토타일·호수·겹침 스택)로
// 그린다. 캔버스 대신 pngjs 버퍼 위에 drawImage 만 구현한 작은 2D 컨텍스트를 넘긴다. 이벤트는 스프라이트 대신 표식(문·전투·엔딩·기타).

import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";
import { drawMapTileLayer } from "../../src/editor/mapTileDraw.ts";
import { tilesetBaseImageUrl } from "../../src/editor/tilesetImage.ts";
import { isColorKeyedChipsetTextureKey, resolveTransparentColorKeys } from "../../src/assets/chipsetTransparency.ts";
import { applyTransparentColorKey, applyTransparentColorKeys } from "../../src/assets/transparentColorKey.ts";
import { store } from "../../src/project/store.ts";
import { whereText, type GameCheckReport } from "../../src/qa/gameCheck/index.ts";
import type { GameMap, Project, TilesetDef } from "../../src/project/types.ts";
import { loadProjectFile } from "./check.mts";

let ARGV: readonly string[] = process.argv.slice(2);
const arg = (name: string): string | undefined => { const i = ARGV.indexOf(`--${name}`); return i >= 0 ? ARGV[i + 1] : undefined; };

type Raster = { width: number; height: number; data: Uint8Array };

/** CanvasRenderingContext2D 중 mapTileDraw 가 쓰는 drawImage(9인자)만 — 최근접 표본 + 알파 합성. */
class PngContext {
  constructor(readonly target: Raster) {}
  drawImage(image: Raster, sx: number, sy: number, sw: number, sh: number, dx: number, dy: number, dw: number, dh: number): void {
    const { target } = this;
    const x0 = Math.max(0, Math.floor(dx));
    const y0 = Math.max(0, Math.floor(dy));
    const x1 = Math.min(target.width, Math.ceil(dx + dw));
    const y1 = Math.min(target.height, Math.ceil(dy + dh));
    for (let y = y0; y < y1; y += 1) {
      const syy = Math.floor(sy + ((y - dy + 0.5) * sh) / dh);
      if (syy < 0 || syy >= image.height) continue;
      for (let x = x0; x < x1; x += 1) {
        const sxx = Math.floor(sx + ((x - dx + 0.5) * sw) / dw);
        if (sxx < 0 || sxx >= image.width) continue;
        const si = (syy * image.width + sxx) * 4;
        const a = image.data[si + 3]! / 255;
        if (a === 0) continue;
        const di = (y * target.width + x) * 4;
        for (let c = 0; c < 3; c += 1) target.data[di + c] = Math.round(image.data[si + c]! * a + target.data[di + c]! * (1 - a));
        target.data[di + 3] = Math.max(target.data[di + 3]!, image.data[si + 3]!);
      }
    }
  }
}

const imageCache = new Map<string, Raster | null>();

function loadTilesetRaster(tileset: TilesetDef): Raster | null {
  const url = tilesetBaseImageUrl(tileset);
  const key = `${url}|${tileset.transparentColor ?? ""}`;
  if (imageCache.has(key)) return imageCache.get(key)!;
  let bytes: Buffer | null = null;
  if (url.startsWith("data:")) bytes = Buffer.from(url.slice(url.indexOf(",") + 1), "base64");
  else if (/^\.?\/?assets\//u.test(url)) {
    const file = path.join("public", url.replace(/^\.?\//u, ""));
    if (fs.existsSync(file)) bytes = fs.readFileSync(file);
  }
  let raster: Raster | null = null;
  if (bytes) {
    const png = PNG.sync.read(bytes);
    raster = { width: png.width, height: png.height, data: png.data };
    // 에디터 loadTilesetImage 와 같은 투명색 규칙 — 명시 투명색, 또는 알려진 색키 칩셋.
    const known = tileset.image.type === "bundled" && isColorKeyedChipsetTextureKey(tileset.image.id);
    if (tileset.transparentColor || known) {
      const pixels = new Uint8ClampedArray(raster.data.buffer, raster.data.byteOffset, raster.data.byteLength);
      const keys = resolveTransparentColorKeys(tileset);
      if (keys) applyTransparentColorKeys(pixels, keys); else applyTransparentColorKey(pixels);
    }
  }
  imageCache.set(key, raster);
  return raster;
}

const MARK = { start: [60, 230, 110], door: [70, 150, 255], battle: [235, 60, 60], ending: [255, 200, 40], other: [230, 70, 230] } as const;

function eventKind(event: GameMap["events"][number]): keyof typeof MARK {
  const kinds = new Set<string>();
  const walk = (list: unknown): void => {
    for (const command of Array.isArray(list) ? list : []) {
      if (!command || typeof command !== "object") continue;
      kinds.add(String((command as { kind?: unknown }).kind));
      for (const value of Object.values(command as Record<string, unknown>)) {
        if (Array.isArray(value)) walk(value);
        if (Array.isArray((value as { branch?: unknown })?.branch)) walk((value as { branch: unknown }).branch);
      }
      for (const option of Array.isArray((command as { options?: unknown }).options) ? (command as { options: { branch?: unknown }[] }).options : []) walk(option?.branch);
    }
  };
  for (const page of event.pages ?? []) walk(page.commands);
  walk(event.commands);
  if (kinds.has("triggerEnding") || kinds.has("ending")) return "ending";
  if (kinds.has("battleProcessing")) return "battle";
  if (kinds.has("transfer")) return "door";
  return "other";
}

function outline(target: Raster, x: number, y: number, size: number, rgb: readonly number[]): void {
  for (let i = 0; i < size; i += 1) {
    for (const [px, py] of [[x + i, y], [x + i, y + size - 1], [x, y + i], [x + size - 1, y + i], [x + i, y + 1], [x + i, y + size - 2], [x + 1, y + i], [x + size - 2, y + i]] as const) {
      if (px < 0 || py < 0 || px >= target.width || py >= target.height) continue;
      const di = (py * target.width + px) * 4;
      target.data[di] = rgb[0]!; target.data[di + 1] = rgb[1]!; target.data[di + 2] = rgb[2]!; target.data[di + 3] = 255;
    }
  }
}

export function renderMapPng(project: Project, map: GameMap, scale = 1): { png: Buffer; note?: string } {
  const tileset = project.tilesets[map.tilesetId];
  const size = (tileset?.tileSize ?? 16) * scale;
  const target: Raster = { width: map.width * size, height: map.height * size, data: new Uint8Array(map.width * size * map.height * size * 4) };
  // 바둑판 바탕 — 비어 있는 칸이 보이게.
  for (let y = 0; y < target.height; y += 1) for (let x = 0; x < target.width; x += 1) {
    const dark = ((Math.floor(x / (size / 2)) + Math.floor(y / (size / 2))) % 2) === 0;
    const i = (y * target.width + x) * 4;
    target.data[i] = dark ? 42 : 51; target.data[i + 1] = dark ? 42 : 51; target.data[i + 2] = dark ? 46 : 58; target.data[i + 3] = 255;
  }
  let note: string | undefined;
  const image = tileset ? loadTilesetRaster(tileset) : null;
  if (!tileset || !image) note = `타일셋 이미지를 읽지 못했습니다(${map.tilesetId})`;
  else {
    const context = new PngContext(target) as unknown as CanvasRenderingContext2D;
    drawMapTileLayer(context, image as never, map, tileset, "lower", scale);
    drawMapTileLayer(context, image as never, map, tileset, "upper", scale);
  }
  for (const event of map.events ?? []) outline(target, event.x * size, event.y * size, size, MARK[eventKind(event)]);
  if (map.id === project.startMapId) {
    const sx = project.startPos.x * size;
    const sy = project.startPos.y * size;
    outline(target, sx - 3, sy - 3, size + 6, MARK.start);
    outline(target, sx, sy, size, MARK.start);
  }
  const png = new PNG({ width: target.width, height: target.height });
  png.data = Buffer.from(target.data);
  return { png: PNG.sync.write(png), ...(note ? { note } : {}) };
}

function esc(value: unknown): string {
  return String(value ?? "").replace(/[&<>"]/gu, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[c]!));
}

export function buildReportHtml(input: {
  readonly project: Project;
  readonly report: GameCheckReport | null;
  readonly maps: readonly { map: GameMap; png: Buffer; note?: string }[];
  readonly meta?: Record<string, unknown> | null;
  readonly replay?: string | null;
}): string {
  const { project, report } = input;
  const summaryByMap = new Map((report?.maps ?? []).map((m) => [m.id, m]));
  const findingsByMap = new Map<string, number>();
  for (const f of report?.findings ?? []) if (f.where?.mapId) findingsByMap.set(f.where.mapId, (findingsByMap.get(f.where.mapId) ?? 0) + 1);
  const cards = input.maps.map(({ map, png, note }) => {
    const s = summaryByMap.get(map.id);
    const flags = [
      map.id === project.startMapId ? "<b class=start>시작</b>" : "",
      s && !s.reachable ? "<b class=bad>못 감</b>" : "",
      s && s.events === 0 && s.inbound === 0 && map.id !== project.startMapId ? "<b class=bad>빈 껍데기</b>" : "",
      s?.climate ? `<b>${esc(s.climate)}</b>` : "",
      findingsByMap.get(map.id) ? `<b class=warn>지적 ${findingsByMap.get(map.id)}</b>` : "",
    ].join(" ");
    return `<figure><img src="data:image/png;base64,${png.toString("base64")}" alt="${esc(map.name)}"><figcaption><strong>${esc(map.name)}</strong> <code>${esc(map.id)}</code><br>${map.width}×${map.height} · 이벤트 ${map.events.length} · 들어오는 문 ${s?.inbound ?? "?"} · ${esc(map.tilesetId)} ${flags}${note ? `<br><span class=bad>${esc(note)}</span>` : ""}</figcaption></figure>`;
  }).join("\n");
  const rows = (report?.findings ?? []).map((f) => `<tr class="${f.severity}"><td>${f.severity === "blocker" ? "막힘" : f.severity === "warning" ? "경고" : "참고"}</td><td><code>${esc(f.code)}</code></td><td>${esc(f.message)}</td><td>${esc(whereText(f.where))}</td></tr>`).join("\n");
  const auto = report?.autoPlay;
  const autoHtml = auto ? [
    auto.skipped ? `<p>건너뜀: ${esc(auto.skipped)}</p>` : "",
    auto.plan.length ? `<p><b>경로</b>: ${auto.plan.map(esc).join(" → ")}</p>` : "",
    ...auto.runs.map((run) => `<h3>${esc(run.label)} — ${run.ok ? `<span class=ok>성공${run.endingReached ? ` (엔딩 ${esc(run.endingReached)})` : ""}</span>` : "<span class=bad>실패</span>"} <small>러너 ${run.runs}회 · ${run.ms}ms · 끝 파티 ${esc(JSON.stringify(run.partyAtEnd ?? []))}</small></h3><ol>${run.steps.map((step) => `<li class="${step.ok ? "ok" : "bad"}">${esc(step.goal)} — ${esc(step.detail)} <small>${esc(step.mapId ?? "")} (${step.x ?? "?"},${step.y ?? "?"})${step.where ? ` · ${esc(whereText(step.where))}` : ""}</small></li>`).join("")}</ol>`),
  ].join("\n") : "<p>검사 결과(check.json)가 없습니다 — check 를 먼저 돌리세요.</p>";
  const meta = input.meta;
  const metaHtml = meta ? `<details open><summary>생성 기록(meta.json)</summary><pre>${esc(JSON.stringify({ config: meta.config, ms: meta.ms, timings: meta.timings, toolCalls: meta.toolCalls, toolErrors: meta.toolErrors, tokens: meta.tokens, differences: meta.differences }, null, 2))}</pre></details>` : "";
  const counts = report?.counts;
  return `<!doctype html><html lang=ko><head><meta charset=utf-8><title>QA — ${esc(project.meta.title)}</title>
<style>
body{font:14px/1.5 system-ui,"Apple SD Gothic Neo","Noto Sans KR",sans-serif;margin:24px;background:#111318;color:#e6e6ea;word-break:keep-all}
h1{margin:0 0 4px}h2{margin-top:32px;border-bottom:1px solid #333;padding-bottom:4px}code{color:#9fc4ff}
.counts b{display:inline-block;padding:2px 10px;border-radius:10px;margin-right:6px}.counts .blocker{background:#5b1d1d}.counts .warning{background:#5b4a1d}
.grid{display:flex;flex-wrap:wrap;gap:16px}figure{margin:0;background:#1b1e26;border:1px solid #2c3140;border-radius:8px;padding:8px;max-width:560px}
figure img{max-width:100%;max-height:420px;image-rendering:pixelated;display:block;margin:auto}figcaption{margin-top:6px;font-size:13px}
figcaption b{font-weight:600;font-size:12px;padding:1px 6px;border-radius:6px;background:#2c3140}b.bad{background:#7a2323}b.warn{background:#6b5a1f}b.start{background:#1f5a3a}
table{border-collapse:collapse;width:100%}td{border-bottom:1px solid #2a2d38;padding:4px 6px;vertical-align:top}tr.blocker td:first-child{color:#ff7b7b;font-weight:700}tr.warning td:first-child{color:#f3c75b}
.ok{color:#7ddc9a}.bad{color:#ff8a8a}li{margin:2px 0}small{color:#9aa0ae}pre{white-space:pre-wrap;background:#1b1e26;padding:8px;border-radius:6px}
.legend span{display:inline-block;width:12px;height:12px;border:2px solid;margin:0 4px -2px 10px}
</style></head><body>
<h1>${esc(project.meta.title)} <small>QA 시트</small></h1>
<p class=counts>${counts ? `<b class=blocker>막힘 ${counts.blocker}</b><b class=warning>경고 ${counts.warning}</b>` : ""} 맵 ${input.maps.length}개 · 시작 <code>${esc(project.startMapId)}</code> (${project.startPos.x},${project.startPos.y}) · 파티 ${esc(JSON.stringify(project.session?.partyActorIds ?? []))}</p>
<p class=legend>표식: <span style="border-color:rgb(60,230,110)"></span>시작 위치 <span style="border-color:rgb(70,150,255)"></span>문 <span style="border-color:rgb(235,60,60)"></span>전투 <span style="border-color:rgb(255,200,40)"></span>엔딩 <span style="border-color:rgb(230,70,230)"></span>기타 이벤트</p>
<h2>자동 플레이</h2>${autoHtml}
<h2>검사 지적 ${report?.findings.length ?? 0}건</h2><table>${rows || "<tr><td>지적 없음</td></tr>"}</table>
${input.replay ? `<h2>재생</h2><pre>${esc(input.replay)}</pre>` : ""}
<h2>맵</h2><div class=grid>${cards}</div>
${metaHtml}
</body></html>`;
}

export async function renderMain(argv: readonly string[] = process.argv.slice(2)): Promise<number> {
  ARGV = argv;
  const dir = argv.find((value, index) => !value.startsWith("--") && !(index > 0 && argv[index - 1]!.startsWith("--")));
  const projectFile = arg("project") ?? (dir ? path.join(dir, "project.json") : undefined);
  if (!projectFile || !fs.existsSync(projectFile)) { console.error("사용법: bun scripts/qa-game/render.mts qa-runs/<id>  또는  --project x.json --out <dir>"); return 2; }
  const out = arg("out") ?? dir ?? path.dirname(projectFile);
  const scale = Number(arg("scale") ?? 1);
  const started = Date.now();
  const { project } = loadProjectFile(projectFile);
  store.replaceProject(project);
  const current = store.getCurrent();
  fs.mkdirSync(path.join(out, "render"), { recursive: true });
  const order = Object.values(current.maps).sort((a, b) => Number(b.id === current.startMapId) - Number(a.id === current.startMapId));
  const maps = order.map((map) => {
    const { png, note } = renderMapPng(current, map, scale);
    fs.writeFileSync(path.join(out, "render", `${map.id}.png`), png);
    return { map, png, ...(note ? { note } : {}) };
  });
  const read = (file: string) => (fs.existsSync(file) ? fs.readFileSync(file, "utf8") : null);
  const checkText = read(path.join(out, "check.json"));
  const metaText = read(path.join(out, "meta.json"));
  const html = buildReportHtml({
    project: current,
    report: checkText ? JSON.parse(checkText) as GameCheckReport : null,
    maps,
    meta: metaText ? JSON.parse(metaText) as Record<string, unknown> : null,
    replay: read(path.join(out, "replay", "replay.txt")),
  });
  fs.writeFileSync(path.join(out, "report.html"), html);
  console.log(`[qa-game] 맵 ${maps.length}장 → ${path.join(out, "render")} · report.html ${(html.length / 1024).toFixed(0)}KB · ${Date.now() - started}ms`);
  return 0;
}

if (import.meta.main) process.exit(await renderMain());
