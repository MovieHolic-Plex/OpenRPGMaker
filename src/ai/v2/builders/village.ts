// 조수 v2 마을 빌더 — PlaceSpec(village) → v1 author_beodeul_town 인자. 모델은 칸·좌표를 쓰지 않는다.
// 명세의 낱말(size·theme·style·features·hints)만 도구 손잡이로 옮기고, 도구가 못 하는 것은 missingArt 로 정직하게 보고한다.
import { isBlankMap } from "@/editor/tools/mapEmptiness";
import { cloneProjectSharingSharedDictionaries } from "@/project/projectClone";
import { createBuildRun } from "../buildRun";
import type { BuildRun, BuilderCall, PlaceBuildResult, PlaceBuilder, PlaceRecord, PlaceSpec } from "../types";
import { runMachineChecks } from "../checks";

/** v2 계획 모델에게 주는 유일한 마을 지식(≤900자). */
export const VILLAGE_CARD =
  "[마을 type:village] 버들항 판타지 바깥 마을. size small(집3)·medium(4)·large(5). " +
  "theme/style: river(강가·기본)·coast(포구)·desert(사막 오아시스)·snow(설원)·swamp(늪 수상 마을). " +
  "features 낱말: river(강)·plaza/square(광장 마을)·riverbank(물가 띠)·scatter(흩어진 농가·산촌)·harbour(포구, 큰 맵)·" +
  "walls/성벽(river·desert·snow 만)·forest(숲 둘레)·dense forest(숲속 빈터)·conifer(침엽수)·" +
  "highland·hillside·basin·ridge·terraces·flat(땅 모양). 우물·밭·방앗간·여관(광장 북쪽 앵커)은 도구가 알아서 놓는다. " +
  "교회·시장 건물·특정 건물 지정은 못 한다(보고됨). hints 키: houseCount(3~5)·roofs(red|slate|moss|log)·" +
  "water(river|none)·woods(edge|dense)·form·terrain·theme·forestType(broadleaf|conifer|mixed)·walls·wallGate(S|N|NS)·" +
  "width·height·seed·variant(씨앗 바꾸기). 집이 선 마을은 AI 가 다시 지을 수 없다(완성된 집 보호) — 처음 make_place 에 원하는 것을 다 넣는다. 모르는 키는 무시되고 경고된다. 모양 취향이 없으면 비워 두면 씨앗이 고른다.";

const KNOWN_HINTS = new Set(["houseCount", "roofs", "water", "woods", "form", "terrain", "theme", "forestType", "walls", "wallGate", "wallSideGaps", "width", "height", "seed", "variant", "harbour"]);
const BEODEUL_TILESET = "beodeul_city";

interface VillageState { readonly args: Record<string, unknown>; readonly seed?: number; readonly variant?: number }

const words = (spec: PlaceSpec): string => [spec.name, spec.style, spec.theme, ...(spec.features ?? []), ...(spec.zones ?? []).map((z) => `${z.kind} ${z.purpose ?? ""}`)].join(" ").toLowerCase();
const has = (text: string, re: RegExp): boolean => re.test(text);

function pickTheme(spec: PlaceSpec, text: string): string | undefined {
  const own = `${spec.theme ?? ""} ${spec.style ?? ""}`.toLowerCase();
  const order: [string, RegExp][] = [["snow", /snow|설원|눈|겨울|얼음/], ["desert", /desert|사막|오아시스/], ["swamp", /swamp|늪|습지/], ["coast", /coast|harbou?r|port|항구|포구|해안|바닷가|어촌/], ["river", /river|강/]];
  for (const [theme, re] of order) if (has(own, re)) return theme;
  for (const [theme, re] of order) if (theme !== "river" && has(text, re)) return theme;
  return undefined;
}

/** 명세 → author_beodeul_town 인자 + 도구가 표현 못 하는 요청·경고. */
export function villageArgs(spec: PlaceSpec): { args: Record<string, unknown>; missing: string[]; warnings: string[] } {
  const args: Record<string, unknown> = {};
  const missing: string[] = [];
  const warnings: string[] = [];
  const text = words(spec);
  const theme = pickTheme(spec, text);
  if (theme) args.theme = theme;
  if (has(text, /plaza|square|광장|장터|market/)) args.form = "plaza";
  else if (has(text, /riverbank|물가|강변/)) args.form = "riverbank";
  else if (has(text, /scatter|흩어|농가|산촌/)) args.form = "scatter";
  const terrains: [string, RegExp][] = [["highland", /highland|고지|고원/], ["hillside", /hillside|언덕|비탈/], ["basin", /basin|분지/], ["ridge", /ridge|능선/], ["terraces", /terrace|계단식|단구/], ["flat", /flat|평지|평평/]];
  for (const [t, re] of terrains) if (has(text, re)) { args.terrain = t; break; }
  if (has(text, /no.?river|강\s*없/)) args.water = "none";
  else if (has(text, /river|강/) && (args.theme === undefined || args.theme === "river")) args.water = "river";
  if (has(text, /dense|숲속|울창/)) args.woods = "dense";
  else if (has(text, /forest|숲|woods/)) args.woods = "edge";
  if (has(text, /conifer|침엽|소나무/)) args.forestType = "conifer";
  else if (has(text, /broadleaf|활엽/)) args.forestType = "broadleaf";
  if (has(text, /wall|성벽|성곽|성문|요새|fortress|castle wall/)) {
    if (["river", "desert", "snow", undefined].includes(args.theme as string | undefined)) args.walls = true;
    else missing.push(`성벽(theme ${String(args.theme)} 마을은 성벽을 못 지음 — river·desert·snow 만)`);
  }
  if (has(text, /harbou?r|항구|포구/) && args.theme === "coast") args.harbour = true;
  const count = spec.size === "small" ? 3 : spec.size === "large" ? 5 : spec.size === "medium" ? 4 : undefined;
  if (count) args.houseCount = count;
  if (has(text, /church|교회|chapel|성당/)) missing.push("교회(새 마을은 교회를 짓지 못함 — 고정 예제 작은 마을에만 있음)");
  if (has(text, /inn\b|여관|tavern|주점/) && args.form !== "plaza") warnings.push("여관은 광장 마을의 북쪽 앵커로만 앉는다(form plaza 아님 — 앵커 건물이 따로 놓임)");
  for (const [key, value] of Object.entries(spec.hints ?? {})) {
    if (!KNOWN_HINTS.has(key)) { warnings.push(`알 수 없는 hints.${key} 는 무시했다`); continue; }
    if (key !== "variant") args[key] = value;
  }
  if (args.harbour === true) { args.width = Math.max(Number(args.width ?? 0), 84); args.height = Math.max(Number(args.height ?? 0), 30); }
  return { args, missing, warnings };
}

/** 지을 맵 고르기: 명세 mapId → (이전 기록) → 현재 맵이 빈 버들항 맵이면 그 맵 → 새 맵. */
function targetMapId(run: BuildRun, spec: PlaceSpec, previous?: PlaceRecord): string | undefined {
  if (previous?.result.mapIds[0]) return previous.result.mapIds[0];
  if (spec.mapId) return spec.mapId;
  const cur = run.ctx.currentMapId ? run.ctx.project.maps[run.ctx.currentMapId] : undefined;
  if (cur && cur.tilesetId === BEODEUL_TILESET && isBlankMap(cur)) return cur.id;
  return undefined;
}

const num = (v: unknown): number | undefined => (typeof v === "number" && Number.isFinite(v) ? v : undefined);

/** 농촌 요청이면 밭을 더한다 — 도구는 밭을 둘까지 맵 가장자리에 둬서 「농사 쪽이 빈약하다」(2026-10-23 눈가림 2차).
 *  열린 풀밭(타일 무리 beodeul:grass + bd-ground-lawn 키트 칸, 위층 비어 있음, 둘레 한 칸 포함)에만, 맵 가운데에 가까운 자리부터
 *  울타리 밭·작물 밭 키트를 stamp_object 로 찍는다. 찍을 때마다 도달 검사를 다시 하고 길을 막으면 되돌린다. */
function addFarmFields(run: BuildRun, mapId: string, want: number): number {
  const project0 = run.ctx.project;
  const map0 = project0.maps[mapId];
  const tileset = map0 ? project0.tilesets[map0.tilesetId] as unknown as { id: string; tileGroups?: { id: string; tileIds: number[] }[]; structureKits?: { id: string; width: number; height: number; rows: { tiles: number[]; upperTiles?: number[] }[] }[] } : undefined;
  if (!map0 || !tileset) return 0;
  const lawn = new Set<number>();
  for (const g of tileset.tileGroups ?? []) if (g.id === "beodeul:grass") for (const t of g.tileIds) lawn.add(t);
  for (const k of tileset.structureKits ?? []) if (/^bd-ground-lawn-/u.test(k.id)) for (const r of k.rows) for (const t of r.tiles) if (t >= 0) lawn.add(t);
  const kits = new Map((tileset.structureKits ?? []).map((k) => [k.id, k] as const));
  const order = ["bd-farm-fenced-plot", "bd-farm-plot-wheat", "bd-farm-plot-cabbage", "bd-farm-plot-tomato", "bd-farm-plot-sowing"].filter((id) => kits.has(id));
  let added = 0;
  for (let n = 0; n < want && order.length; n++) {
    const kit = kits.get(order[n % order.length]!)!;
    const m = run.ctx.project.maps[mapId]!;
    const free = (x: number, y: number) => {
      for (let j = -1; j <= kit.height; j++) for (let i = -1; i <= kit.width; i++) {
        const cx = x + i, cy = y + j;
        if (cx < 1 || cy < 1 || cx >= m.width - 1 || cy >= m.height - 1) return false;
        const idx = cy * m.width + cx;
        if ((m.upperTiles[idx] ?? -1) >= 0 || (m.lowerOverlayTiles?.[idx] ?? -1) >= 0 || !lawn.has(m.lowerTiles[idx]!)) return false;
      }
      return !(m.events ?? []).some((e) => e.x >= x - 1 && e.x <= x + kit.width && e.y >= y - 1 && e.y <= y + kit.height);
    };
    const cands: { x: number; y: number; d: number }[] = [];
    for (let y = 1; y < m.height - kit.height; y++) for (let x = 1; x < m.width - kit.width; x++) if (free(x, y)) cands.push({ x, y, d: Math.abs(x + kit.width / 2 - m.width / 2) + Math.abs(y + kit.height / 2 - m.height / 2) });
    cands.sort((a, b) => a.d - b.d);
    let ok = false;
    for (const c of cands.slice(0, 6)) {
      const snap = run.ctx.project;
      const res = run.call("stamp_object", { objectId: `kit:${tileset.id}/${kit.id}`, mapId, x: c.x, y: c.y });
      if (res.ok && runMachineChecks(run.ctx.project, [mapId]).every((ch) => ch.id !== "reach" || ch.ok)) { ok = true; break; }
      run.ctx.project = snap;
    }
    if (ok) added++;
  }
  return added;
}

function build(run: BuildRun, spec: PlaceSpec, previous?: PlaceRecord): PlaceBuildResult {
  const { args, missing, warnings } = villageArgs(spec);
  const prev = previous?.result.state as VillageState | undefined;
  const mapId = targetMapId(run, spec, previous);
  const variant = num(spec.hints?.variant);
  if (prev) {
    // 고치기: 같은 씨앗으로 같은 마을(명세만 바꾼 부분이 반영됨). seed·variant 를 바꾸면 다른 배치.
    if (args.seed === undefined && prev.seed !== undefined) args.seed = prev.seed + (variant !== undefined && variant !== prev.variant ? variant : 0);
  }
  // 집 수 맞추기: 씨앗을 정하지 않았으면 사본 위에서 씨앗 몇 개를 미리 지어 보고 요청한 집 수에 가장 가까운 것을 고른다.
  // 실제 맵에 한 번 지으면 「완성된 집 보호」로 AI 가 다시 지을 수 없어서(2026-10-23 v2), 고르기는 짓기 전에 끝낸다.
  const wantHouses = num(args.houseCount);
  if (!prev && args.seed === undefined && wantHouses !== undefined) {
    let best: { seed: number; houses: number } | undefined;
    const salt = [...spec.name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
    for (let i = 0; i < 5; i++) {
      const seed = (salt + i * 7919) % 100000;
      const trial = createBuildRun({ ...run.ctx, project: cloneProjectSharingSharedDictionaries(run.ctx.project) });
      const r = trial.call("author_beodeul_town", { name: spec.name, ...args, seed, ...(mapId ? { mapId } : {}) });
      const houses = num((r.data as Record<string, unknown> | undefined)?.houses);
      if (!r.ok || houses === undefined) continue;
      if (!best || Math.abs(houses - wantHouses) < Math.abs(best.houses - wantHouses)) best = { seed, houses };
      if (houses >= wantHouses) break;
    }
    if (best) args.seed = best.seed;
  }
  const base: Record<string, unknown> = { name: spec.name, ...args };
  if (mapId) base.mapId = mapId;
  const firstCall = run.calls.length;
  let result = run.call("author_beodeul_town", base);
  // 완성된 집 보호: 집이 선 맵은 덮어 짓기가 거절된다 → 지우고 같은 id 로 다시 짓는다.
  if (!result.ok && mapId && run.ctx.project.maps[mapId] && /집 보호|house|완성된/.test(`${result.summary} ${(result.issues ?? []).map((i) => i.message).join(" ")}`)) {
    const removed = run.call("remove_map", { mapId });
    if (removed.ok) result = run.call("author_beodeul_town", { ...base, id: mapId });
  }
  const calls: BuilderCall[] = run.calls.slice(firstCall);
  const data = (result.data ?? {}) as Record<string, unknown>;
  const builtId = typeof data.mapId === "string" ? data.mapId : mapId;
  if (!result.ok || !builtId) {
    return { ok: false, mapIds: mapId ? [mapId] : [], summary: `마을 짓기 실패: ${result.summary}`, warnings: [...warnings, ...(result.issues ?? []).map((i) => i.message)], missingArt: missing, calls, state: prev };
  }
  const seed = num(data.seed);
  const houses = num(data.houses);
  if (!prev && /농촌|농가|농장|농사|farm|밭|경작/u.test(words(spec))) {
    const more = addFarmFields(run, builtId, spec.size === "large" ? 3 : 2);
    if (more) warnings.push(`농촌이라 밭 ${more}곳을 더 일궜다(마을 가운데 쪽 열린 풀밭)`);
  }
  const asked = num(args.houseCount);
  if (asked !== undefined && houses !== undefined && houses < asked - 1) warnings.push(`집 ${asked}채 요청, 집 ${houses}채만 앉음(앵커 건물 별도) — 지형이 좁으면 size 를 키우거나 variant 를 바꿔 본다`);
  warnings.push(...(result.warnings ?? []));
  const start = run.ctx.project.startPos;
  const ent = data.entrance as { x?: number; y?: number } | undefined;
  const entrance = run.ctx.project.startMapId === builtId && start
    ? { mapId: builtId, x: start.x, y: start.y }
    : { mapId: builtId, x: ent?.x ?? Math.floor((num(data.width) ?? 40) / 2), y: ent?.y ?? Math.floor((num(data.height) ?? 32) / 2) };
  const parts = [`${String(data.theme ?? "")} ${String(data.form ?? "")} 마을`, `집 ${houses ?? "?"}채`, data.gathering ? `모이는 곳 ${(data.gathering as { why?: string }).why ?? ""}` : "", data.walls ? "성벽" : "", data.bridge ? "다리" : ""].filter(Boolean);
  const state: VillageState = { args, seed, variant };
  return { ok: true, mapIds: [builtId], entrance, summary: `${spec.name}: ${parts.join(" · ")} (${num(data.width)}×${num(data.height)}, seed ${seed})`, warnings, missingArt: missing, calls, state };
}

export const VILLAGE_BUILDER: PlaceBuilder = {
  id: "village",
  accepts: (spec) => spec.type === "village" && !/jp-modern|modern-city|wizarding|sengoku/.test(spec.style ?? ""),
  build,
};
