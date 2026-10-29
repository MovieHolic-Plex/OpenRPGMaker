// 조수 v2 마을 빌더 — PlaceSpec(village) → v1 author_beodeul_town 인자. 모델은 칸·좌표를 쓰지 않는다.
// 명세의 낱말(size·theme·style·features·hints)만 도구 손잡이로 옮기고, 도구가 못 하는 것은 missingArt 로 정직하게 보고한다.
import { isBlankMap } from "@/editor/tools/mapEmptiness";
import { cloneProjectSharingSharedDictionaries } from "@/project/projectClone";
import { createBuildRun } from "../buildRun";
import { isPassable } from "@/project/collision";
import { eventsOf, roadCellSet, tileLabel } from "../people";
import type { BuildRun, BuilderCall, PlaceBuildResult, PlaceBuilder, PlaceRecord, PlaceSpec } from "../types";

/** v2 계획 모델에게 주는 유일한 마을 지식(≤900자). */
export const VILLAGE_CARD =
  "[마을 type:village] 버들항 판타지 바깥 마을. size small(집3)·medium(4)·large(5). " +
  "theme/style: river(강가·기본)·coast(포구)·desert(사막 오아시스)·snow(설원)·swamp(늪 수상 마을). " +
  "features 낱말: river(강)·plaza/square(광장 마을)·riverbank(물가 띠)·scatter(흩어진 농가·산촌)·harbour(포구, 큰 맵)·" +
  "walls/성벽(river·desert·snow 만)·forest(숲 둘레)·dense forest(숲속 빈터)·conifer(침엽수)·" +
  "highland·hillside·basin·ridge·terraces·flat(땅 모양). 우물·밭·방앗간·여관(광장 북쪽 앵커)은 도구가 알아서 놓는다. " +
  "교회·시장 건물·특정 건물 지정은 못 한다(보고됨). hints 키: houseCount(3~5)·roofs(red|slate|moss|log)·" +
  "water(river|none)·woods(edge|dense)·form·terrain·theme·forestType(broadleaf|conifer|mixed)·walls·wallGate(S|N|NS)·" +
  "width·height·seed·variant(씨앗 바꾸기)·landform(terraces|hill|slope, 높이 먼저 — 땅 모양을 먼저 짓고 길이 등고선을 따름)·settle(middle|low, 마을이 앉는 단). 집이 선 마을은 AI 가 다시 지을 수 없다(완성된 집 보호) — 처음 make_place 에 원하는 것을 다 넣는다. 모르는 키는 무시되고 경고된다. 모양 취향이 없으면 비워 두면 씨앗이 고른다.";

const KNOWN_HINTS = new Set(["landform", "settle", "houseCount", "roofs", "water", "woods", "form", "terrain", "theme", "forestType", "walls", "wallGate", "wallSideGaps", "width", "height", "seed", "variant", "harbour"]);
const BEODEUL_TILESET = "beodeul_city";

interface VillageState { readonly args: Record<string, unknown>; readonly seed?: number; readonly variant?: number; readonly doors?: readonly { x: number; y: number; kit?: string }[] }

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
  // 무협(중국 무림)은 전용 칩셋이 아직 번들에 없다(murim-chipset 하네스는 후보 단계) — 지어낸 대체 대신 버들항으로 지었다고 알린다.
  if (has(text, /murim|wuxia|무협|무림|강호|객잔|문파|협객/)) missing.push("무협 마을(무림 전용 칩셋 murim_wuxia 가 번들에 없어 버들항 판타지 마을로 지었다)");
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

function build(run: BuildRun, spec: PlaceSpec, previous?: PlaceRecord): PlaceBuildResult {
  const { args, missing, warnings } = villageArgs(spec);
  // 같은 요청 세 번이 같은 마을이 되지 않게(2026-10-23 다양성 검수: 강가 마을 세 판이 같은 강·다리·방앗간 자리 8/10).
  // 요청이 정하지 않은 땅 모양·숲 종류는 make_place 의 salt 로 고른다. 고치기는 명세에 남은 salt 로 같은 값을 다시 고른다.
  if (spec.salt !== undefined && (args.theme === undefined || args.theme === "river" || args.theme === "coast")) {
    if (args.terrain === undefined && spec.salt % 3 === 0) args.terrain = "terraces";
    if (args.forestType === undefined) args.forestType = (["broadleaf", "conifer", "mixed"] as const)[Math.floor(spec.salt / 3) % 3];
    // 맵 크기가 블록 격자를 정한다 — 같은 형태라도 가로·세로가 다르면 집·광장·밭 자리가 달라진다.
    if (args.width === undefined && args.height === undefined) { const [w, h] = ([[42, 34], [50, 32], [38, 40]] as const)[Math.floor(spec.salt / 9) % 3]!; args.width = w; args.height = h; }
  }
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
  if (!prev && args.seed === undefined && wantHouses === undefined && spec.salt !== undefined) args.seed = spec.salt % 100000;
  if (!prev && args.seed === undefined && wantHouses !== undefined) {
    let best: { seed: number; houses: number } | undefined;
    const salt = ([...spec.name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) + (spec.salt ?? 0)) >>> 0;
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
  // 이미 지은 마을에 게임 내용(사람·문·이벤트)이 붙었으면 다시 짓지 않는다 — 다시 지으면 그것이 다 지워지고, 시작 맵은 지울 수도 없어
  // 「완성된 집 보호」 거절이 되풀이됐다(2026-10-25 조수 단독 게임 G4: 같은 거절 2번 + 되돌림 4번).
  const existingMap = prev && mapId ? run.ctx.project.maps[mapId] : undefined;
  if (existingMap && existingMap.events.length > 0) {
    return {
      ok: false, mapIds: [mapId!],
      summary: `마을 다시 짓기 안 함: ${existingMap.name} 에 이미 이벤트·사람 ${existingMap.events.length}개가 있다${run.ctx.project.startMapId === mapId ? "(시작 맵)" : ""} — 다시 지으면 다 지워진다. 같은 edit_place 를 되풀이하지 말고, 남은 그림 문제는 덧그리기(stamp_object·fill_region)나 add_people·move_event 로 고치거나 보고에 그대로 적는다.`,
      warnings, missingArt: missing, calls: [], state: prev,
    };
  }
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
  const asked = num(args.houseCount);
  if (asked !== undefined && houses !== undefined && houses < asked - 1) warnings.push(`집 ${asked}채 요청, 집 ${houses}채만 앉음(앵커 건물 별도) — 지형이 좁으면 size 를 키우거나 variant 를 바꿔 본다`);
  warnings.push(...(result.warnings ?? []));
  const start = run.ctx.project.startPos;
  const ent = data.entrance as { x?: number; y?: number } | undefined;
  const entrance = run.ctx.project.startMapId === builtId && start
    ? { mapId: builtId, x: start.x, y: start.y }
    : { mapId: builtId, x: ent?.x ?? Math.floor((num(data.width) ?? 40) / 2), y: ent?.y ?? Math.floor((num(data.height) ?? 32) / 2) };
  const farm = farmAddons(run, builtId, words(spec), warnings, missing);
  calls.push(...run.calls.slice(firstCall + calls.length));
  const parts = [`${String(data.theme ?? "")} ${String(data.form ?? "")} 마을`, farm.length ? `농가 ${farm.join("·")}` : "", `집 ${houses ?? "?"}채`, data.gathering ? `모이는 곳 ${(data.gathering as { why?: string }).why ?? ""}` : "", data.walls ? "성벽" : "", data.bridge ? "다리" : ""].filter(Boolean);
  const state: VillageState = { args, seed, variant, ...(Array.isArray(data.doors) ? { doors: data.doors as VillageState["doors"] } : {}) };
  return { ok: true, mapIds: [builtId], entrance, summary: `${spec.name}: ${parts.join(" · ")} (${num(data.width)}×${num(data.height)}, seed ${seed})`, warnings, missingArt: missing, calls, state };
}

/**
 * 농가 덧붙이기: 요청에 밭·헛간·농장이 있으면 지은 마을의 빈 풀밭에 농장 키트(bd-farm-*)를 찍는다.
 * 2026-10-24 스위트: 「밭이 있는 강가 마을」에 밭이 없고, 「헛간 있는 농촌 마을」에 헛간이 없었다(마을 도구는 농장 키트를 안 놓는다).
 * 자리: 키트 칸 + 둘레 한 칸이 모두 풀밭(길·물·물건·이벤트·건물 도장 아님)이고 걸을 수 있는 곳 — 둘레가 비어 길이 끊기지 않는다.
 */
function farmAddons(run: BuildRun, mapId: string, text: string, warnings: string[], missing: string[]): string[] {
  const wantBarn = /barn|헛간|곳간|축사|농장|farm/.test(text);
  const wantFields = /\bfields?\b|밭|농경|경작|crop|농장|farm|농촌|농가/.test(text);
  if (!wantBarn && !wantFields) return [];
  const kits: { id: string; w: number; h: number; label: string }[] = [];
  const map0 = run.ctx.project.maps[mapId];
  // 마을 도구가 이미 그린 밭(위층 「밀밭 칸·이랑」)이 넉넉하면 밭은 더 놓지 않는다.
  const cropCells = map0 ? ((map0 as unknown as { upperTiles?: number[] }).upperTiles ?? []).filter((t) => t >= 0 && /밀밭|밭 칸|이랑|작물|crop/i.test(tileLabel(run.ctx.project, map0, t))).length : 0;
  const done: string[] = cropCells >= 20 ? [`이미 그린 밭 ${cropCells}칸`] : [];
  if (wantBarn) kits.push({ id: "bd-farm-barn", w: 6, h: 6, label: "헛간" });
  if (wantFields && cropCells < 20) kits.push({ id: "bd-farm-fenced-plot", w: 7, h: 6, label: "울타리 밭" }, { id: "bd-farm-plot-cabbage", w: 0, h: 0, label: "작물 밭" });
  const taken = new Set<number>();
  for (const kit of kits) {
    const map = run.ctx.project.maps[mapId];
    if (!map) break;
    // 작물 밭 키트 크기는 모른다 — 울타리 밭과 같은 자리 찾기로 7×5 를 쓴다.
    const w = kit.w || 7, h = kit.h || 5;
    const roads = roadCellSet(run.ctx.project, map);
    const evCells = new Set(eventsOf(map).map((e) => e.y * map.width + e.x));
    const stamps = ((map as unknown as { structurePlacements?: { x: number; y: number; w: number; h: number }[] }).structurePlacements ?? []);
    const lower = (map as unknown as { lowerTiles?: number[] }).lowerTiles ?? [];
    const upper = (map as unknown as { upperTiles?: number[] }).upperTiles ?? [];
    const grassCache = new Map<number, boolean>();
    // 걷어 내도 되는 작은 풀밭 장식(들꽃·고사리·낮은 덤불·징검돌·짚가리) — 나무는 반쪽이 남으니 안 걷는다.
    const decoCache = new Map<number, boolean>();
    const deco = (t: number): boolean => {
      let d = decoCache.get(t);
      if (d === undefined) { d = /들꽃|고사리|헤더 덤불|꽃 무더기|풀덩이|별꽃|징검돌|짚가리|밀 단|곡식 자루/.test(tileLabel(run.ctx.project, map, t)); decoCache.set(t, d); }
      return d;
    };
    const grass = (i: number): boolean => {
      const t = lower[i];
      if (typeof t !== "number" || t < 0) return false;
      let g = grassCache.get(t);
      if (g === undefined) { g = /풀|잔디|grass/i.test(tileLabel(run.ctx.project, map, t)); grassCache.set(t, g); }
      return g;
    };
    // 「나무·덤불」 칸 하나가 홀로 있으면(위아래·좌우에 같은 이름 없음) 한 칸 덤불이다 — 큰 나무는 여러 칸이 붙어 있다.
    const bushy = (x: number, y: number): boolean => {
      if (x < 0 || y < 0 || x >= map.width || y >= map.height) return false;
      const t = upper[y * map.width + x] ?? -1;
      return t >= 0 && /나무·덤불/.test(tileLabel(run.ctx.project, map, t));
    };
    // 붙은 「나무·덤불」 덩이가 16칸 이하면(덤불·측백·작은 나무) 통째로 걷을 수 있다 — 걷을 때 덩이 전체가 걷는 칸 안에 들어야 한다(아래 후보 검사).
    const loneCache = new Map<number, boolean>();
    const compOf = new Map<number, Set<number>>();
    const loneBush = (x: number, y: number): boolean => {
      if (!bushy(x, y)) return false;
      const k = y * map.width + x;
      const hit = loneCache.get(k);
      if (hit !== undefined) return hit;
      const seen = new Set<number>([k]); const stack = [[x, y]];
      while (stack.length && seen.size <= 16) {
        const [cx0, cy0] = stack.pop()!;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = cx0! + dx!, ny = cy0! + dy!, nk = ny * map.width + nx;
          if (!seen.has(nk) && bushy(nx, ny)) { seen.add(nk); stack.push([nx, ny]); }
        }
      }
      const ok = seen.size <= 16;
      for (const c of seen) { loneCache.set(c, ok); if (ok) compOf.set(c, seen); }
      return ok;
    };
    const inStamp = (x: number, y: number) => stamps.some((sp) => x >= sp.x && x < sp.x + sp.w && y >= sp.y && y < sp.y + sp.h);
    const free = (x: number, y: number): boolean => {
      if (x < 1 || y < 1 || x >= map.width - 1 || y >= map.height - 1) return false;
      const i = y * map.width + x;
      if (!grass(i) || roads.has(i) || evCells.has(i) || taken.has(i) || inStamp(x, y)) return false;
      // 빈 칸은 실제로 걸을 수 있어야 하고, 걷을 장식·덤불 칸은 풀밭 바닥이면 걷은 뒤 걸을 수 있다(덤불이 막던 칸).
      return (upper[i] ?? -1) < 0 ? isPassable(run.ctx.project, map, x, y) : deco(upper[i]!) || loneBush(x, y);
    };
    const cands: { x: number; y: number; d: number }[] = [];
    const cx = map.width / 2, cy = map.height / 2;
    for (let y = 1; y + h + 1 < map.height; y++) for (let x = 1; x + w + 1 < map.width; x++) {
      let ok = true;
      for (let yy = y - 1; yy <= y + h && ok; yy++) for (let xx = x - 1; xx <= x + w && ok; xx++) if (!free(xx, yy)) ok = false;
      // 걷을 덤불 덩이가 걷는 칸(키트+둘레 한 칸) 밖으로 삐져나가면 반쪽 덤불이 남는다 — 그런 자리는 뺀다.
      if (ok) for (let yy = y - 1; yy <= y + h && ok; yy++) for (let xx = x - 1; xx <= x + w && ok; xx++) {
        const comp = compOf.get(yy * map.width + xx);
        if (comp) for (const c of comp) { const cx2 = c % map.width, cy2 = Math.floor(c / map.width); if (cx2 < x - 1 || cx2 > x + w || cy2 < y - 1 || cy2 > y + h) { ok = false; break; } }
      }
      if (ok) cands.push({ x, y, d: Math.abs(x + w / 2 - cx) + Math.abs(y + h / 2 - cy) });
    }
    // 마을 가까이(가운데 쪽)부터 — 맵 끝 구석에 홀로 떨어진 헛간이 되지 않게.
    cands.sort((a, b) => a.d - b.d);
    let placed = false;
    for (const c of cands.slice(0, 12)) {
      run.call("clear_region", { mapId, x: c.x - 1, y: c.y - 1, w: w + 2, h: h + 2, layer: "upper" });
      const r = run.call("stamp_object", { objectId: `kit:beodeul_city/${kit.id}`, mapId, x: c.x, y: c.y });
      if (r.ok) {
        placed = true;
        for (let yy = c.y - 1; yy <= c.y + h; yy++) for (let xx = c.x - 1; xx <= c.x + w; xx++) taken.add(yy * map.width + xx);
        done.push(`${kit.label}(${c.x},${c.y})`);
        break;
      }
    }
    // 헛간 자리가 없으면 마을 도구가 그린 울타리 밭 하나(울타리째)를 헛간 마당으로 바꾼다 — 농가 마을은 밭이 넉넉하다.
    if (!placed && kit.id === "bd-farm-barn" && cropCells >= 40) {
      const farmish = (x: number, y: number): boolean => {
        if (x < 0 || y < 0 || x >= map.width || y >= map.height) return false;
        const t = upper[y * map.width + x] ?? -1;
        if (t < 0) return false;
        // 울타리 칸은 이름표가 비어 있다(실측 34560~34567) — 이름 없는 칸도 잇고, 덩이에 밭 칸이 8개 이상일 때만 밭으로 본다.
        const l = tileLabel(run.ctx.project, map, t);
        return !l || /밀밭|밭 칸|이랑|울타리|fence|허수아비/i.test(l);
      };
      const crop = (x: number, y: number): boolean => /밀밭|밭 칸|이랑/.test(tileLabel(run.ctx.project, map, upper[y * map.width + x] ?? -1));
      const seenF = new Set<number>();
      const boxes: { x0: number; y0: number; x1: number; y1: number; n: number; crops: number }[] = [];
      for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) {
        const k = y * map.width + x;
        if (seenF.has(k) || !farmish(x, y)) continue;
        const box = { x0: x, y0: y, x1: x, y1: y, n: 0, crops: 0 }; const st = [[x, y]]; seenF.add(k);
        while (st.length) {
          const [a, b] = st.pop()!; box.n++; if (crop(a!, b!)) box.crops++;
          box.x0 = Math.min(box.x0, a!); box.x1 = Math.max(box.x1, a!); box.y0 = Math.min(box.y0, b!); box.y1 = Math.max(box.y1, b!);
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = a! + dx!, ny = b! + dy!, nk = ny * map.width + nx; if (!seenF.has(nk) && farmish(nx, ny)) { seenF.add(nk); st.push([nx, ny]); } }
        }
        if (box.crops >= 8 && box.x1 - box.x0 + 1 >= w && box.y1 - box.y0 + 1 >= h && box.x1 - box.x0 < 14 && box.y1 - box.y0 < 12) boxes.push(box);
      }
      boxes.sort((a, b) => a.n - b.n);
      for (const b of boxes) {
        const bw = b.x1 - b.x0 + 1, bh = b.y1 - b.y0 + 1;
        const x = b.x0 + Math.floor((bw - w) / 2), y = b.y1 - h + 1;
        run.call("clear_region", { mapId, x: b.x0, y: b.y0, w: bw, h: bh, layer: "upper" });
        const r = run.call("stamp_object", { objectId: `kit:beodeul_city/${kit.id}`, mapId, x, y });
        if (r.ok) { placed = true; done.push(`${kit.label}(${x},${y}, 울타리 밭 하나를 헛간 마당으로)`); break; }
      }
    }
    if (!placed) (kit.id === "bd-farm-barn" ? missing : warnings).push(`${kit.label}(${kit.id}) — 마을에 ${w}×${h} 빈 풀밭이 없어 못 놓음(size 를 키우거나 variant 를 바꾼다)`);
  }
  return done;
}

export const VILLAGE_BUILDER: PlaceBuilder = {
  id: "village",
  accepts: (spec) => spec.type === "village" && !/jp-modern|modern-city|wizarding|sengoku/.test(spec.style ?? ""),
  build,
};
