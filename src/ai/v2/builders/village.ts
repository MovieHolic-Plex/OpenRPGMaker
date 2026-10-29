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
  "[마을 type:village] 버들항 판타지 마을. 땅은 코드가 만든다 — 첫 make_place 는 짓지 않고 땅 그림(좌표 눈금)·요약을 준다. " +
  "그림을 보고 hints.layout 에 자리를 골라 다시 부르면 짓는다: gather{x,y,plaza}·landmark(높은 단 건물)·anchor(여관)·work(일터)·houses[{x,y}](3~12)·fields[{x,y}]·exits(west|east|north|south). " +
  "함수는 가까운 놓을 자리로 옮기고 길·계단·다리를 잇고 옮김·실패를 보고한다. hints.terrainSeed 를 바꾸면 다른 땅. " +
    "theme/style: river(풀밭 들 마을 — 강이 있는지는 water 로 따로)·coast(포구)·desert(사막 오아시스)·snow(설원)·swamp(늪 수상 마을). " +
  "땅 성격 힌트: landform(terraces|hill|slope|plateau|flat)·water(river 강|none, 풀밭 마을)·high(north|south|west|east|center)·tiers(1~4). " +
  "features: plaza(광장)·scatter(흩어진 농가)·harbour(포구, 큰 맵)·walls(성벽, river·desert·snow, 평지)·forest·dense forest·conifer. " +
  "그 밖 hints: houseCount(3~5)·roofs(red|slate|moss|log)·woods(edge|dense)·forestType·wallGate(S|N|NS)·width·height·variant(같은 명세의 다른 배치). " +
  "교회·시장 건물 지정은 못 한다(보고됨). 집이 선 마을은 다시 지을 수 없다 — 처음 make_place 에 다 넣는다.";

/** 스키마 칸을 0·빈 값으로 다 채우는 모델(terra)이 보낸 layout 에서 {x:0,y:0} 자리·빈 배열을 버린다. 모이는 곳도 집도 없으면 「안 줬다」(null). */
export function cleanLayoutHint(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  const lay = { ...(value as Record<string, unknown>) };
  const real = (p: unknown) => !!p && typeof p === "object" && !(Number((p as { x?: unknown }).x) === 0 && Number((p as { y?: unknown }).y) === 0);
  for (const k of ["gather", "landmark", "anchor", "work"]) if (!real(lay[k])) delete lay[k];
  for (const k of ["houses", "fields", "forests", "pastures"]) { const a = Array.isArray(lay[k]) ? (lay[k] as unknown[]).filter(real) : []; if (a.length) lay[k] = a; else delete lay[k]; }
  if (!Array.isArray(lay.exits) || !(lay.exits as unknown[]).length) delete lay.exits;
  return lay.gather || lay.houses ? lay : null;
}

const KNOWN_HINTS = new Set(["fishing", "layout", "terrainSeed", "terrainGen", "landform", "settle", "tiers", "high", "houseCount", "roofs", "water", "woods", "form", "terrain", "theme", "forestType", "walls", "wallGate", "wallSideGaps", "width", "height", "variant", "harbour"]);
const BEODEUL_TILESET = "beodeul_city";

interface VillageState { readonly args: Record<string, unknown>; readonly seed?: number; readonly variant?: number; readonly doors?: readonly { x: number; y: number; kit?: string }[] }

const words = (spec: PlaceSpec): string => [spec.name, spec.style, spec.theme, ...(spec.features ?? []), ...(spec.zones ?? []).map((z) => `${z.kind} ${z.purpose ?? ""}`)].join(" ").toLowerCase();
const has = (text: string, re: RegExp): boolean => re.test(text);

function pickTheme(spec: PlaceSpec, text: string): string | undefined {
  const own = `${spec.theme ?? ""} ${spec.style ?? ""}`.toLowerCase();
  const order: [string, RegExp][] = [["snow", /snow|설원|눈|겨울|얼음/], ["desert", /desert|사막|오아시스/], ["swamp", /swamp|늪|습지/], ["coast", /coast|harbou?r|port|항구|포구|해안|바닷가|어촌/], ["river", /river|강/]];
  for (const [theme, re] of order) if (has(own, re)) return theme;
  // 「강가 어촌」은 바다 포구가 아니라 강 마을(어촌 낱말만으로 바다를 깔면 강이 사라졌다) — 바다 낱말이 없고 강 낱말이 있으면 강
  const riverFishing = has(text, /강가|강변|강나루|냇가|\briver/) && !has(text, /바다|바닷가|해안|항구|포구|harbou?r|coast|\bsea\b/);
  for (const [theme, re] of order) if (theme !== "river" && has(text, re) && !(theme === "coast" && riverFishing)) return theme;
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
  // 지형 설계 낱말(모델이 hints.landform 을 주면 아래 hints 가 덮는다)
  const landforms: [string, RegExp][] = [["plateau", /plateau|mesa|고원|대지 위/], ["slope", /산골|산촌|산마을|산비탈|mountain/], ["hill", /\bhill\b|언덕/], ["terraces", /terrace|계단식|다랑/], ["flat", /\bflat\b|평지|평평/]];
  for (const [l, re] of landforms) if (has(text, re)) { args.landform = l; break; }
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
  // 강가 어촌(2026-10-30 씬 벤치 「강가 마을」: 어촌 요청인데 부두·그물 없이 강 낀 들판) — 물가에 그물 말림대·통발·배·계류 말뚝 띠
  if (has(text, /어촌|어부|고깃배|fishing|fisher/) && (args.theme === undefined || args.theme === "river")) args.fishing = true;
  const count = spec.size === "small" ? 3 : spec.size === "large" ? 5 : spec.size === "medium" ? 4 : undefined;
  if (count) args.houseCount = count;
  // 무협(중국 무림)은 전용 칩셋이 아직 번들에 없다(murim-chipset 하네스는 후보 단계) — 지어낸 대체 대신 버들항으로 지었다고 알린다.
  if (has(text, /murim|wuxia|무협|무림|강호|객잔|문파|협객/)) missing.push("무협 마을(무림 전용 칩셋 murim_wuxia 가 번들에 없어 버들항 판타지 마을로 지었다)");
  if (has(text, /church|교회|chapel|성당/)) missing.push("교회(새 마을은 교회를 짓지 못함 — 고정 예제 작은 마을에만 있음)");
  if (has(text, /inn\b|여관|tavern|주점/) && args.form !== "plaza") warnings.push("여관은 광장 마을의 북쪽 앵커로만 앉는다(form plaza 아님 — 앵커 건물이 따로 놓임)");
  for (const [key, value] of Object.entries(spec.hints ?? {})) {
    // 씨앗은 모델이 정하지 않는다 — 스키마 칸을 다 채우는 모델(terra)이 seed 0·1 을 보내 무작위가 꺼졌다(같은 요청 = 같은 마을). make_place 의 salt(요청마다 새로)가 정한다
    if (key === "seed") continue;
    if (!KNOWN_HINTS.has(key)) { warnings.push(`알 수 없는 hints.${key} 는 무시했다`); continue; }
    // 스키마 칸을 다 채워 보내는 모델(gpt-6.1-terra)은 안 정한 칸을 ""·0 으로 보낸다 — width·height 0 이 최소 크기(36×30)로 잘려 지형 먼저의 위 단이 설 자리가 없었다(2026-10-29 실조수)
    if (value === "" || value === null || (["width", "height", "tiers", "houseCount", "terrainSeed"].includes(key) && typeof value === "number" && value <= 0)) continue;
    if (key === "layout") { const lay = cleanLayoutHint(value); if (lay) args.layout = lay; continue; }
    if (key !== "variant") args[key] = value;
  }
  // 모델이 땅 모양 낱말(hillside·terraces·highland)을 form 에 넣으면 인자 검증에서 한 번 실패했다(2026-10-29 실조수 flash) — terrain 으로 옮긴다
  if (typeof args.form === "string" && ["hillside", "terraces", "highland"].includes(args.form)) { if (args.terrain === undefined) args.terrain = args.form; delete args.form; warnings.push("hints.form 의 땅 모양 낱말을 terrain 으로 옮겼다"); }
  // 땅 모양 낱말 없는 요청에 모델이 단을 얹는다(2026-10-30 실조수: 「강가 장터 마을」에 terra 가 landform terraces·tiers 2 → 강이 협곡이 되어 남북 절벽,
  // opus 는 「강가 시골」에 landform flat → 덩이 둔덕과 평지 한가운데 계단). 명세 이름·특징·구역에 땅 모양 낱말이 없으면 그 힌트를 버리고 평지(북쪽 동서 띠 하나)로 짓는다.
  const terrainWord = /언덕|산골|산촌|산마을|산비탈|비탈|계단식|다랑|고원|절벽|능선|분지|고지|높은|hill|mountain|slope|terrace|plateau|mesa|cliff|ridge|highland|basin/;
  if (!has(text, terrainWord) && (args.theme === undefined || args.theme === "river" || args.theme === "coast")) {
    const dropped = (["landform", "terrain", "tiers", "high", "settle"] as const).filter((k) => args[k] !== undefined && args[k] !== "flat");
    if (dropped.length) warnings.push(`요청에 땅 모양 낱말이 없어 hints.${dropped.join("·")} 를 버리고 평지(북쪽 동서 단 하나)로 지었다`);
    for (const k of ["landform", "terrain", "tiers", "high", "settle"]) delete args[k];
  }
  if (args.harbour === true) { args.width = Math.max(Number(args.width ?? 0), 84); args.height = Math.max(Number(args.height ?? 0), args.landform === "flat" || args.terrain === "flat" ? 30 : 38); } // 지형 먼저 포구는 마을 단 뒤 높은 단 자리까지 8줄 더
  return { args, missing, warnings };
}

/**
 * 코드 지형 그림을 본 조수가 hints.layout 을 고를 때 읽는 지침(make_place 미리보기 답과 프로브가 같은 글을 쓴다).
 * 테마마다 다른 것: 늪은 물 위 널판 집·널길, 강가 어촌·포구는 물가에 일터.
 */
export function villageLayoutGuide(theme: string, fishing = false, scatter = false): string {
  const swamp = theme === "swamp";
  return "hints.layout 에 gather{x,y,plaza}(모이는 곳), landmark(높은 곳 건물 — 높은 단 넓은 터), anchor(여관·회관 — 모이는 곳 곁), work(일터), houses[{x,y}] 3~12(집 가운데), "
    + "fields[{x,y}](밭), forests[{x,y}](숲 덩이), pastures[{x,y}](울타리 친 목초지·양), exits(큰길이 나가는 맵 가장자리) 를 넣는다. "
    + "집 하나는 문 앞까지 약 5×6칸이라 집 가운데끼리 6칸 이상 띄우고(큰 건물은 8칸), 한 단 평지에(단 경계 검은 선을 걸치지 않게) 둔다. "
    + (swamp ? "늪 마을은 물 위에 짓는다 — 집은 물(파랑) 위나 물가에 두면 널판 마루를 깔고 그 위에 서고, 길은 물을 건너는 널길이 된다. 진흙 섬만 쓰지 말고 물 위 집을 절반 넘게. "
      : "물(파랑) 위는 안 된다. ")
    + (fishing || theme === "coast" ? "어촌·포구는 모이는 곳·일터·집 몇 채를 물가(물에서 6칸 안)에 두어 물가 길에 그물·배·말림대가 서게 한다. " : "")
    + (scatter ? "흩어진 농가·들판 마을은 집을 3~6채만, 집 가운데끼리 9칸 넘게 흩고 집마다 곁에 밭(fields)·목초지(pastures)를 둔다 — 집이 모인 읍내가 되지 않게. " : "")
    + (theme === "river" ? "강가 마을이면 모이는 곳을 강에서 10칸 안에 둔다(시작 자리가 모이는 곳 곁이다). " : "")
    + "집·길이 닿지 않는 넓은 빈 단은 비워 두지 말고 그 단에 맞는 쓰임(밭·숲·목초지)을 자리로 준다. 길·계단·널다리는 함수가 잇고, 못 놓은 자리·옮긴 거리·못 낸 길을 보고한다.";
}

/** 마을이 지어질 맵 크기(build·authorBeodeulTown 기본값과 같은 계산) — 코드 지형 미리보기가 같은 크기로 땅을 만든다. */
export function villageMapSize(spec: PlaceSpec, args: Record<string, unknown>): [number, number] {
  const w = num(args.width), h = num(args.height);
  const flat = args.walls === true || args.landform === "flat" || args.terrain === "flat";
  if (w !== undefined && h !== undefined) return [w, h];
  const theme = args.theme as string | undefined;
  if (spec.salt !== undefined && (theme === undefined || theme === "river" || theme === "coast") && w === undefined && h === undefined) {
    const [a, b] = ([[42, 34], [50, 32], [38, 40]] as const)[Math.floor(spec.salt / 9) % 3]!; return [a, b + (flat ? 0 : 8)];
  }
  const hc = num(args.houseCount);
  const base: [number, number] = hc === undefined ? ({ river: [56, 44], coast: [56, 40], desert: [58, 44], snow: [56, 44], swamp: [56, 44] } as Record<string, [number, number]>)[theme ?? "river"] ?? [56, 44]
    : hc <= 3 ? [40, 32] : hc === 4 ? [42, 34] : [44, 36];
  return [w ?? base[0], h ?? base[1] + (flat ? 0 : 8)];
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
    // 지형 먼저(평지·성벽이 아닌 마을)는 낮은 단·마을 단·높은 단이 세로로 쌓이므로 8줄 더
    if (args.width === undefined && args.height === undefined) { const [w, h] = ([[42, 34], [50, 32], [38, 40]] as const)[Math.floor(spec.salt / 9) % 3]!; args.width = w; args.height = h + (args.walls === true || args.landform === "flat" || args.terrain === "flat" ? 0 : 8); }
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
  if (!prev && args.seed === undefined && wantHouses !== undefined && !args.layout) {
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
