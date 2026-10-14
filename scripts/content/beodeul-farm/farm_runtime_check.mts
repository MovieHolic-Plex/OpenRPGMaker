// 농사 런타임이 버들항 경작지 그림을 실제로 고르는지 헤드리스로 확인한다(LLM·브라우저 없음).
//
//   npx vite-node --script scripts/content/beodeul-farm/farm_runtime_check.mts [--out DIR]
//
// 생활 픽스처(test/fixtures/life-full.project.json)의 농장 맵을 버들항 타일셋 풀밭으로 바꾸고, 실제 런타임 함수로
// 괭이질 → 물 주기 → 씨 심기 → 하루·이틀 성장 → 수확을 돌린다. 단계마다 실제 renderFarmOverlays 를 스텁 씬에 불러
// 그리기 호출(어느 칸에 어느 타일 번호·스프라이트 프레임·틴트)을 기록하고, 기대와 대조한다:
//   - 경작한 칸은 `farmland` 그룹의 이웃 마스크 모양 칸(27,648~ 꼬리)으로 그린다(187 같은 다른 시트 번호 금지)
//   - 물 준 칸은 `farmland_watered` 그룹의 같은 마스크 칸으로 그리고 틴트 사각형을 얹지 않는다
//   - 작물은 성장 단계 그림(cropGraphicStages → cropGraphicIndexForStage)으로 그린다
// 기록(calls.json)과 바탕 맵 PNG 는 farm_runtime_compose.py 가 한 장으로 합친다.
import fs from "node:fs";
import path from "node:path";
import { createBlankProject } from "../../../src/project/defaults.ts";
import { store } from "../../../src/project/store.ts";
import { startSession } from "../../../src/project/session.ts";
import { interactWithFarmPlot, advanceFarmPlotsForDay } from "../../../src/player/farming.ts";
import { renderFarmOverlays } from "../../../src/player/playSceneFarming.ts";
import { autotileVariantForMask } from "../../../src/project/defaults/autotileEngine.ts";
import { renderMapPng } from "../../qa-game/render.mts";
import type { GameMap, Project } from "../../../src/project/types.ts";

const ROOT = path.resolve(import.meta.dirname, "../../..");
const args = process.argv.slice(2);
const OUT = path.resolve(ROOT, args.includes("--out") ? args[args.indexOf("--out") + 1]! : "verify-shots/beodeul-farm/runtime");
fs.mkdirSync(OUT, { recursive: true });

const raw = JSON.parse(fs.readFileSync(path.join(ROOT, "test/fixtures/life-full.project.json"), "utf8")) as Project;
raw.tilesets.beodeul_city = createBlankProject().tilesets.beodeul_city!;
const mapsArr = (Array.isArray(raw.maps) ? raw.maps : Object.values(raw.maps)) as GameMap[];
const farmMap = mapsArr.find((m) => m.id === "map_farming_demo")!;
farmMap.tilesetId = "beodeul_city";
const n = farmMap.width * farmMap.height;
(farmMap as { lowerTiles: number[] }).lowerTiles = Array(n).fill(737);
for (const k of ["upperTiles", "lowerOverlayTiles", "upperOverlayTiles"] as const) if ((farmMap as Record<string, unknown>)[k]) (farmMap as Record<string, unknown>)[k] = Array(n).fill(-1);
delete (farmMap as { relief?: unknown }).relief;
store.replaceProject(raw);
const project = store.getCurrent();
const map = (Array.isArray(project.maps) ? project.maps : Object.values(project.maps)).find((m: GameMap) => m.id === "map_farming_demo") as GameMap;
const ts = project.tilesets.beodeul_city!;
const dry = ts.autotileGroups!.find((g) => g.id === "farmland")!;
const wet = ts.autotileGroups!.find((g) => g.id === "farmland_watered")!;
fs.writeFileSync(path.join(OUT, "base.png"), renderMapPng(project, map).png);

// 기력 소모는 이 확인의 대상이 아니다(23칸 × 단계마다 깎여 중간에 막힌다) — 꺼 둔다.
(project.system as { energy?: unknown }).energy = undefined;
const session = startSession(project, 18);
session.mapId = map.id;
session.inventory.item_hoe = 1; session.inventory.item_watering_can = 1;
session.inventory.item_potato_seed = 30; session.inventory.item_tomato_seed = 30;
const area = map.farmableArea![0]!;              // {x:4,y:5,w:6,h:4}
const use = (item: string | undefined, x: number, y: number, intent?: "till" | "water" | "plant") => {
  session.equippedToolItemId = item;
  return interactWithFarmPlot(project, session, map, x, y, intent);
};
// 6×4 를 다 갈되 오른쪽 아래 한 칸은 남겨 오목·볼록 모서리가 섞이게 한다.
const tilled: Array<[number, number]> = [];
for (let y = area.y; y < area.y + area.h; y++) for (let x = area.x; x < area.x + area.w; x++) if (!(x === area.x + area.w - 1 && y === area.y + area.h - 1)) tilled.push([x, y]);
const log: Array<{ step: string; results: string[] }> = [];
const kindOf = (r: { kind: string; reason?: string }) => r.reason ? `${r.kind}:${r.reason}` : r.kind;
const step = (name: string, fn: () => string[]) => log.push({ step: name, results: fn() });
step("till", () => tilled.map(([x, y]) => kindOf(use("item_hoe", x, y, "till"))));
step("plant", () => tilled.map(([x, y]) => kindOf(use(y < area.y + 2 ? "item_tomato_seed" : "item_potato_seed", x, y, "plant"))));

type Call = { kind: "image" | "rect" | "sprite"; x: number; y: number; frame?: string | number; texture?: string; color?: number; alpha?: number; depth?: number };
const frames: Record<string, Call[]> = {};
const checks: string[] = [];
function snapshot(name: string) {
  const calls: Call[] = [];
  const obj = (c: Call) => ({ setOrigin() {}, setDepth(d: number) { c.depth = d; }, setAlpha(a: number) { c.alpha = a; } });
  const scene = {
    map, session,
    tileLayer: { add() {} },
    resolveTilesetTexture: () => "tex_beodeul_city",
    add: {
      image: (x: number, y: number, texture: string, frame?: string | number) => { const c: Call = { kind: "image", x, y, texture, frame }; calls.push(c); return obj(c); },
      rectangle: (x: number, y: number, _w: number, _h: number, color?: number, alpha?: number) => { const c: Call = { kind: "rect", x, y, color, alpha }; calls.push(c); return obj(c); },
      sprite: (x: number, y: number, texture: string, frame?: string | number) => { const c: Call = { kind: "sprite", x, y, texture, frame }; calls.push(c); return obj(c); },
    },
  };
  renderFarmOverlays(scene as never, project.database.crops ?? []);
  frames[name] = calls;
  // 기대 대조
  const set = new Set(tilled.map(([x, y]) => `${x},${y}`));
  const plots = session.farmPlots?.[map.id] ?? {};
  for (const [x, y] of tilled) {
    let mask = 0;
    const has = (dx: number, dy: number) => set.has(`${x + dx},${y + dy}`);
    if (has(0, -1)) mask |= 1; if (has(1, 0)) mask |= 2; if (has(0, 1)) mask |= 4; if (has(-1, 0)) mask |= 8;
    if (has(1, -1)) mask |= 16; if (has(1, 1)) mask |= 32; if (has(-1, 1)) mask |= 64; if (has(-1, -1)) mask |= 128;
    const plot = plots[`${x},${y}`];
    if (!plot?.tilled) { checks.push(`${name} (${x},${y}) 경작 상태가 아님`); continue; }
    const want = autotileVariantForMask(plot.watered ? wet : dry, mask);
    const got = calls.find((c) => c.kind === "image" && c.x === x * 16 && c.y === y * 16);
    if (!got) checks.push(`${name} (${x},${y}) 흙 그림 호출 없음`);
    else if (got.frame !== `tile_${want}`) checks.push(`${name} (${x},${y}) 흙 ${got.frame} ≠ 기대 tile_${want}(${plot.watered ? "물 준" : "마른"} mask ${mask})`);
    if (plot.watered && calls.some((c) => c.kind === "rect" && c.x === x * 16 && c.y === y * 16)) checks.push(`${name} (${x},${y}) 물 준 흙인데 틴트 사각형이 덧그려짐`);
  }
}
const waterAll = (only?: (x: number) => boolean) => tilled.filter(([x]) => !only || only(x)).map(([x, y]) => kindOf(use("item_watering_can", x, y, "water")));
step("water-left-half", () => waterAll((x) => x < area.x + 3));
snapshot("day0-planted");
step("day1", () => { advanceFarmPlotsForDay(project, session, 1); return waterAll(); });
snapshot("day1-growing");
step("day2", () => { advanceFarmPlotsForDay(project, session, 1); const r = waterAll((x) => x >= area.x + 3); advanceFarmPlotsForDay(project, session, 1); return r; });
snapshot("day3-ready");
step("harvest", () => tilled.map(([x, y]) => kindOf(use(undefined, x, y))));
snapshot("after-harvest");

const plotsOut = session.farmPlots?.[map.id] ?? {};
fs.writeFileSync(path.join(OUT, "calls.json"), JSON.stringify({ frames, log, checks, plots: plotsOut, dryBody: dry.variantMap["255"], wetBody: wet.variantMap["255"] }, null, 1) + "\n");
const kinds = Object.fromEntries(log.map((l) => [l.step, l.results.reduce<Record<string, number>>((a, k) => ((a[k] = (a[k] ?? 0) + 1), a), {})]));
console.log(JSON.stringify({ steps: kinds, checks: checks.length, firstChecks: checks.slice(0, 5), frames: Object.fromEntries(Object.entries(frames).map(([k, v]) => [k, v.length])) }));
