// 조수 v2 마을 빌더 — PlaceSpec(village) → v1 author_beodeul_town 인자. 모델은 칸·좌표를 쓰지 않는다.
// 명세의 낱말(size·theme·style·features·hints)만 도구 손잡이로 옮기고, 도구가 못 하는 것은 missingArt 로 정직하게 보고한다.
import { doorTail, kitLabel } from "../doorHouse";
import { isBlankMap } from "@/editor/tools/mapEmptiness";
import { usesCodeTerrain } from "@/editor/tools/authorBeodeulTown";
import { BEODEUL_VILLAGE_KINDS, VILLAGE_KIND_EXAMPLES, nearestVillageKind, villageKindById, villageKindExamples, villageKindMenu } from "@/editor/tools/beodeulVillageKinds";
import { FEATURE_WORD_STRENGTH, askedBuildingKits, askedBuildingLabel, askedBuildingMenu, nearestBuildingKits } from "@/editor/tools/beodeulAskedBuildings";
import type { Project } from "@/project/types";
import { cloneProjectSharingSharedDictionaries } from "@/project/projectClone";
import { createBuildRun } from "../../shared/buildRun";
import { SHEER_KINDS_CARD_LINE } from "../sheerKindLines";
import { isPassable } from "@/project/collision";
import { labelHasWord } from "@/project/labelWords";
import { kitServesBuilding, kitTier, type BuildingNeed } from "@/project/kitTier";
import { projectTilesetLook } from "@/project/tilesetLook";
import { eventsOf, tileLabel } from "../cells";
import { roadCells } from "../surface";
import type { BuildRun, BuilderCall, PlaceBuildResult, PlaceBuilder, PlaceRecord, PlaceSpec } from "../../shared/types";

/**
 * v2 계획 모델에게 늘 실리는 마을 지식. 끝 문장은 마을 종류(hints.kind)가 있다는 것과 예 넷뿐이다 — 종류는 코드가 게임 열쇠와 땅으로 고르는 것이 기본이라
 * 서른여덟 종류의 목록을 모든 게임 지시문에 싣지 않는다(2026-11-16 감독: 방탈출 지시문이 +1,170자로 상한 66,700 을 넘었다).
 * 전체 목록은 마을을 지을 때만 온다: 첫 make_place 의 땅 그림 답(villageKindsLine)과 모르는 kind 의 거절 글(unknownVillageKind).
 */
export const VILLAGE_CARD =
  "[Village type:village] Beodeul fantasy village. The first make_place does not build: it returns a land picture (coordinate grid) and a summary. " +
  "Choose spots on it in hints.layout and call again to build: gather{x,y} (well) · landmark (high tier) · anchor (inn) · work · houses[{x,y}] (3–12) · fields[{x,y}] · exits (west|east|north|south). " +
  "theme: river (grassland; a river or not is set by water) · coast (fishing port) · desert (oasis) · snow · swamp (stilt village). " +
  "Land hints: landform · water · high (north|south|west|east|center) · tiers. " +
  "features: plaza · scatter (scattered farms) · harbour (port, big map) · walls (river·desert·snow, flat land) · forest · dense forest · conifer. " +
  "Other hints: houseCount (3–5) · roofs (red|slate|moss|log) · woods (edge|dense) · forestType · wallGate (S|N|NS) · width · height · variant. " +
  "Asked buildings (cathedral, inn…): hints.buildings [kit id or word]. A village with houses cannot be rebuilt — put everything in the building call. " +
  `${SHEER_KINDS_CARD_LINE} ` +
  `hints.kind (optional, river·coast): village kind id, e.g. ${VILLAGE_KIND_EXAMPLES.join(" · ")}. Omitted, the game picks one. The land answer and any unknown id list all ${BEODEUL_VILLAGE_KINDS.length}.`;

/**
 * 이 게임의 마을 카드 — 종류의 예 넷만 게임마다 다르다(요청에 가까운 종류가 앞, 나머지는 게임 열쇠로 섞은 차례 — villageKindExamples).
 * 고정 카드(VILLAGE_CARD)는 r6·r7a·r7 세 판 모두 첫 예 fishing-cove 를 그대로 hints.kind 로 받아 적게 했다. 글자 수는 고정 카드를 넘지 않는다.
 */
export function villageCard(key = "", request = ""): string {
  const fixed = VILLAGE_KIND_EXAMPLES.join(" · ");
  return VILLAGE_CARD.replace(fixed, villageKindExamples(key, request).join(" · "));
}

/**
 * 2026-11-16 실모델 탐침: 예를 섞은 뒤에도 «바닷가 마을» 요청 세 판 모두 모델이 fishing-cove 를 직접 적었다(목록 맨 앞이 saltern 이어도) —
 * 요청이 종류를 말하지 않으면 비워 두라고 적는다(그러면 게임 열쇠가 터에 맞는 종류를 고른다 — chooseVillageKind). 모델이 적은 종류는 그대로 짓는다.
 */
/** 마을 종류를 고를 수 있는 마을(강가·포구)의 땅 그림 답에 붙는 한 줄 — 전체 목록, 이 땅의 물에 맞는 종류가 앞(그 무리 안은 게임 열쇠로 섞은 차례). 다른 테마는 종류가 없다(undefined). */
export function villageKindsLine(theme: string, water?: unknown, key?: string): string | undefined {
  if (theme !== "river" && theme !== "coast") return undefined;
  return `hints.kind: set it only when the request names what the village lives on («a salt-pan village» does; «a seaside village» does not). Left out, the game picks a kind that fits this land, different per game. To set it, put its id in hints.kind of the building call. ${villageKindMenu({ water: theme === "coast" ? "sea" : water === "none" ? "none" : "river", key })} ${SHEER_KINDS_CARD_LINE}`;
}

/** Keep a registered kind that was named for this place, even if the planner omitted its dedicated hint. */
export function namedVillageSpec(spec: PlaceSpec): PlaceSpec | undefined {
  const hint = typeof spec.hints?.kind === "string" ? spec.hints.kind.trim() : "";
  const matches = (text: string) => BEODEUL_VILLAGE_KINDS.filter((kind) => [kind.id, kind.ko, kind.en].some((name) => labelHasWord(text, name)));
  const named = hint ? [] : matches(spec.name);
  const found = !hint && named.length === 0 && spec.theme ? matches(spec.theme) : named;
  const kind = hint ? villageKindById(hint) : found.length === 1 ? found[0] : undefined;
  if (!kind) return undefined;
  const { args: site } = villageArgs(spec);
  if (site.theme !== undefined && site.theme !== "river" && site.theme !== "coast") return undefined;
  const coast = site.theme === undefined && site.water === undefined && kind.fit.water.length === 1 && kind.fit.water[0] === "sea";
  if (hint && !coast) return spec;
  return { ...spec, ...(coast ? { theme: "coast" } : {}), hints: { ...spec.hints, kind: kind.id } };
}

/** 명세가 적은 kind 가 표에 없는 이름이면 그 이름(빈 값·글자가 아닌 값은 안 준 것). */
export function unknownVillageKind(spec: PlaceSpec): string | undefined {
  const value = (spec.hints as Record<string, unknown> | undefined)?.kind;
  return typeof value === "string" && value.trim() && !villageKindById(value.trim()) ? value.trim() : undefined;
}

/** hints.buildings 의 값(글자 배열 · 글자 하나 · 쉼표로 이은 글자)을 낱말 셋까지로. */
export function askedBuildingWords(value: unknown): string[] {
  const raw = Array.isArray(value) ? value : typeof value === "string" ? value.split(",") : [];
  return [...new Set(raw.map((w) => (typeof w === "string" ? w.trim() : "")).filter(Boolean))].slice(0, 3);
}

const beodeulKits = (project: Project) => project.tilesets[BEODEUL_TILESET]?.structureKits ?? [];

/** 문 목록에 싣는 건물 이름 — 킷 이름에서 칩셋 머리(«버들항 », «버들항 읍 건물 · »)와 크기 꼬리(« 5×8»)를 뗀 것. 쓰임은 이름에 들어 있다(«생선 가게 가게집» · «여관» · «첨탑 성당»). 규칙은 한 곳(place/doorHouse.ts kitLabel). */
export function doorBuildingName(kit: { id: string; name?: string }): string {
  return kit.name ? kitLabel(kit) : "";
}

/** 명세의 특징 낱말 — spec.features 와 hints.features(모델이 hints 안에 적기도 한다: r6 «갈매나루» hints.features ["plaza","harbour"]). */
const specFeatures = (spec: PlaceSpec): string[] => {
  const hinted: unknown = (spec.hints as { features?: unknown } | undefined)?.features;
  return [...(spec.features ?? []), ...(Array.isArray(hinted) ? (hinted as unknown[]) : [])].map((f) => String(f).trim()).filter(Boolean);
};

/**
 * 명세가 청한 건물: hints.buildings · hints.layout.landmark.kit · hints.layout.anchor.kit, 그리고 요청 특징 낱말(spec.features) 가운데 건물 킷의 id 인 것
 * (features ["plaza", "cathedral"] 의 cathedral — id 그대로이거나 id 의 끝 토막일 때만 건물로 읽는다).
 * unknown = 이 칩셋의 어느 건물 킷에도 맞지 않는 낱말(모델이 적은 것만 — 특징 낱말은 건물이 아니면 그냥 특징이다).
 */
export function askedVillageBuildings(project: Project, spec: PlaceSpec): { buildings: string[]; unknown: string[] } {
  const kits = beodeulKits(project);
  const hints = (spec.hints ?? {}) as Record<string, unknown>;
  const named = askedBuildingWords(hints.buildings);
  const lay = (hints.layout && typeof hints.layout === "object" ? hints.layout : {}) as Record<string, { kit?: unknown } | undefined>;
  const spotKits = (["landmark", "anchor"] as const).map((role) => lay[role]?.kit).filter((k): k is string => typeof k === "string" && !!k.trim()).map((k) => k.trim());
  const fromFeatures = specFeatures(spec).filter((f) => askedBuildingKits(kits, f, FEATURE_WORD_STRENGTH).length);
  const unknown = [...named, ...spotKits].filter((w) => !nearestBuildingKits(kits, w).kits.length); // 가장 가까운 건물도 없는 낱말만 — 가까운 것이 있으면 그것으로 세운다
  return { buildings: [...new Set([...named.filter((w) => !unknown.includes(w)), ...fromFeatures])].slice(0, 3), unknown };
}

/** 땅 그림 답(첫 make_place)에 붙는 한 줄 — 건물을 어떻게 청하는가. 늘 실리는 카드에는 한 문장뿐이다. */
export const VILLAGE_BUILDINGS_LINE = "A building the request asks for (a cathedral by the square, an inn, a market hall): put it in hints.buildings as a kit id (kit:beodeul_city/bd-house-cathedral — list_spatial_designs{kind:\"object\", query} finds ids) or a word of a kit's id or name (cathedral · inn · market-hall · 성당), up to 3. "
  + "The builder seats each on the edge of the gather (the square when gather.plaza is true), door towards it, and reports its door front. To choose the spot yourself, add kit to layout.landmark or layout.anchor instead ({x, y, kit}). Do not stamp such a building by hand afterwards — a village with houses is not rebuilt.";

/** 땅 그림 답이 없는 마을(성벽 · 띠 지형)의 첫 결과 끝에 붙는 한 줄 — 이미 섰으니 손으로 찍는 길과 다음 마을에서 청하는 길을 말한다. */
export const WALLED_BUILDINGS_LINE = "A building the request asks for (a cathedral, an inn, a market hall) that this village lacks: stamp_object it by the gather — the tool moves it to the nearest spot whose door can be walked to and clears trees under it. For another village, put it in make_place hints.buildings (kit id or a word of it) and the builder seats it by the gather.";

/** 가까운 건물조차 없는 이름을 알리는 글(거절이 아니다 — 마을은 제 큰 건물로 선다) — 이 칩셋에서 청할 수 있는 큰 건물 목록과 찾는 법. */
export function unknownVillageBuildingText(project: Project, unknown: readonly string[]): string {
  return `hints.buildings ${unknown.map((w) => `"${w}"`).join(", ")}: no building kit of this village chipset is close to that id or word, so the village's own big building stands instead. Buildings that can be asked for (kit id or a word of it): ${askedBuildingMenu(beodeulKits(project))}. `
    + "Smaller buildings and shops: list_spatial_designs{kind:\"object\", query:\"<word>\"} — use the id of a row that has an entrance; stamp_object puts one on a spot where its door can be walked to.";
}

/**
 * 모르는 마을 종류(hints.kind)를 가장 가까운 종류로 고친 명세와 알림 글. 가까운 것이 없으면 kind 를 빼고(게임이 고른다) 알린다. 아는 종류면 undefined.
 * 거절하지 않는다 — 고쳐 짓고 무엇으로 지었는지 적는다(전체 목록을 같이 준다).
 */
export function fixUnknownVillageKind(spec: PlaceSpec): { spec: PlaceSpec; note: string } | undefined {
  const name = unknownVillageKind(spec);
  if (!name) return undefined;
  const near = nearestVillageKind(name);
  const { kind: _dropped, ...rest } = (spec.hints ?? {}) as Record<string, unknown>; void _dropped;
  const hints = (near ? { ...rest, kind: near.id } : rest) as PlaceSpec["hints"];
  return { spec: { ...spec, hints }, note: `hints.kind "${name}" is not a village kind — ${near ? `the nearest one, ${near.id} (${near.hint}), is used` : "the game picks one that fits the land"}. ${villageKindMenu({ near: name })}` };
}

/** 선 요청 건물을 적는 글(빌더 결과 요약 — 어느 문이 그 건물인지 조수가 알게). */
export function askedBuildingsNote(project: Project, asked: readonly { asked: string; kit?: string; door?: { x: number; y: number }; failed?: string }[]): string {
  const kits = new Map(beodeulKits(project).map((k) => [k.id, k] as const));
  // 큰 건물(중형 이상)은 단을 같이 적는다 — 그 문 뒤 실내를 make_place hints.door [x,y] 로 지으면 그 단의 방 구성을 탄다(place/doorHouse.ts).
  const tierOf = (id: string) => { const t = kitTier(kits.get(id)); return t && t !== "small" ? ` ${t}` : ""; };
  return asked.map((a) => (a.kit && a.door ? `«${a.asked}» stands as ${(a as { nearest?: boolean }).nearest ? "the nearest kit " : ""}${kits.get(a.kit) ? askedBuildingLabel(kits.get(a.kit)!) : a.kit}${tierOf(a.kit)}, door front (${a.door.x},${a.door.y})` : `«${a.asked}» was NOT built (${a.failed ?? "no spot"})`)).join(" · ");
}

/** 스키마 칸을 0·빈 값으로 다 채우는 모델(terra)이 보낸 layout 에서 {x:0,y:0} 자리·빈 배열을 버린다. 모이는 곳도 집도 없으면 「안 줬다」(null). */
export function cleanLayoutHint(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  const lay = { ...(value as Record<string, unknown>) };
  const real = (p: unknown) => !!p && typeof p === "object" && !(Number((p as { x?: unknown }).x) === 0 && Number((p as { y?: unknown }).y) === 0);
  for (const k of ["gather", "landmark", "anchor", "work"]) if (!real(lay[k])) delete lay[k];
  for (const k of ["houses", "fields", "forests", "pastures", "orchards", "props"]) { const a = Array.isArray(lay[k]) ? (lay[k] as unknown[]).filter(real) : []; if (a.length) lay[k] = a; else delete lay[k]; }
  if (!Array.isArray(lay.exits) || !(lay.exits as unknown[]).length) delete lay.exits;
  return lay.gather || lay.houses ? lay : null;
}

const KNOWN_HINTS = new Set(["fishing", "layout", "terrainSeed", "terrainGen", "landform", "settle", "tiers", "high", "houseCount", "roofs", "water", "woods", "form", "terrain", "theme", "forestType", "walls", "wallGate", "wallSideGaps", "width", "height", "variant", "harbour", "kind", "buildings", "buildingNeeds"]);
const BEODEUL_TILESET = "beodeul_city";
export const COAST_TERRAIN_NOTE = "Coast terrain makes a seashore or bay. This builder cannot lay a river flowing into the sea, and it cannot reshape the coast after the village is built.";

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
  if (has(text, /inn\b|여관|tavern|주점/) && args.form !== "plaza") warnings.push("여관은 광장 마을의 북쪽 앵커로만 앉는다(form plaza 아님 — 앵커 건물이 따로 놓임)");
  for (const [key, value] of Object.entries(spec.hints ?? {})) {
    // 씨앗은 모델이 정하지 않는다 — 스키마 칸을 다 채우는 모델(terra)이 seed 0·1 을 보내 무작위가 꺼졌다(같은 요청 = 같은 마을). make_place 의 salt(요청마다 새로)가 정한다
    if (key === "seed") continue;
    if (!KNOWN_HINTS.has(key)) { warnings.push(`알 수 없는 hints.${key} 는 무시했다`); continue; }
    // 스키마 칸을 다 채워 보내는 모델(gpt-6.1-terra)은 안 정한 칸을 ""·0 으로 보낸다 — width·height 0 이 최소 크기(36×30)로 잘려 지형 먼저의 위 단이 설 자리가 없었다(2026-10-29 실조수)
    if (value === "" || value === null || (["width", "height", "tiers", "houseCount", "terrainSeed"].includes(key) && typeof value === "number" && value <= 0)) continue;
    if (key === "layout") { const lay = cleanLayoutHint(value); if (lay) args.layout = lay; continue; }
    // 종류는 표에 있는 id 만 — 모르는 낱말이면 가장 가까운 종류로 고쳐 짓고 알린다(가까운 것이 없으면 빌더가 터에 맞는 종류를 고른다). 거절하지 않는다.
    // 전체 목록(가까운 이름이 앞)을 같이 준다 — make_place 도 같은 고침을 먼저 한다(verbs/place.ts fixUnknownVillageKind), 이 줄은 다른 길(고치기 · 스크립트)의 것이다.
    if (key === "kind") {
      const name = typeof value === "string" ? value.trim() : "";
      if (name && villageKindById(name)) args.kind = name;
      else { const near = name ? nearestVillageKind(name) : undefined; if (near) args.kind = near.id; warnings.push(`hints.kind '${String(value)}' is not a village kind id — ${near ? `the nearest one, ${near.id}, is used` : "ignored; one that fits the land was picked"}. ${villageKindMenu({ near: String(value) })}`); }
      continue;
    }
    // 요청 건물(hints.buildings): 킷 id 나 종류 낱말 셋까지 — 시공기가 모이는 곳 가장자리에 앉힌다. 낱말 하나만 글자로 와도 받는다.
    if (key === "buildings") { const list = askedBuildingWords(value); if (list.length) args.buildings = list; continue; }
    if (key !== "variant") args[key] = value;
  }
  // 요청의 방향 출구(spec.exits — 「마을 서쪽 길 끝에 동굴」)는 큰길이 그 가장자리까지 가야 한다(강이면 널다리로 건너서). 마을 빌더는 spec.exits 를 읽지 않아
  // 서쪽이 강인 마을에 서쪽 길이 없었고 동굴 문이 강 동쪽 풀밭에 그림 없이 섰다(2026-10-30 dd1030g terra). layout.exits 앞에 합친다(최대 3).
  const specExits = (spec.exits ?? []).filter((e): e is "west" | "east" | "north" | "south" => ["west", "east", "north", "south"].includes(String(e)));
  if (specExits.length) {
    const lay = (args.layout && typeof args.layout === "object" ? args.layout : {}) as Record<string, unknown>;
    const had = Array.isArray(lay.exits) ? (lay.exits as unknown[]).map(String) : [];
    args.layout = { ...lay, exits: [...new Set([...specExits, ...had])].slice(0, 3) };
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
  return "hints.layout 에 gather{x,y}(모이는 곳 — 우물·좌판. 맵이나 터의 한가운데가 아니라 다리·나루 머리, 계단 어귀, 큰길이 드는 어귀, 여관 앞처럼 모일 까닭이 있는 자리. 판석 광장은 장터·교역 마을일 때만 plaza:true), landmark(높은 곳 건물 — 높은 단 넓은 터), anchor(여관·회관 — 모이는 곳 곁), work(일터), houses[{x,y}] 3~12(집 가운데), "
    + "fields[{x,y}](밭), orchards[{x,y}](과수원), pastures[{x,y}](울타리 친 목초지·양), forests[{x,y}](숲 덩이), props[{x,y}](길가 소품 무더기 — 수레·상자·건초·장작·이정표), exits(큰길이 나가는 맵 가장자리) 를 넣는다. "
    + "houses[].kind 에 small·medium·large 를 섞는다(안 섞으면 같은 집 그림이 되풀이된다 — 짓고 나면 반복을 보고한다). "
    + "집 하나는 문 앞까지 약 5×6칸이라 집 가운데끼리 6칸 이상 띄우고(큰 건물은 8칸), 한 단 평지에(단 경계 검은 선을 걸치지 않게) 둔다. "
    + (swamp ? "늪 마을은 물 위에 짓는다 — 집은 물(파랑) 위나 물가에 두면 널판 마루를 깔고 그 위에 서고, 길은 물을 건너는 널길이 된다. 진흙 섬만 쓰지 말고 물 위 집을 절반 넘게. "
      : "물(파랑) 위는 안 된다. ")
    + (fishing || theme === "coast" ? "어촌·포구는 모이는 곳·일터·집 몇 채를 물가(물에서 6칸 안)에 두어 물가 길에 그물·배·말림대가 서게 한다. " : "")
    + (scatter ? "흩어진 농가·들판 마을은 집을 3~6채만, 집 가운데끼리 9칸 넘게 흩고 집마다 곁에 밭(fields)·목초지(pastures)를 둔다 — 집이 모인 읍내가 되지 않게. " : "")
    + (theme === "river" ? "강가 마을이면 모이는 곳을 강에서 10칸 안에 둔다(시작 자리가 모이는 곳 곁이다). " : "")
    + "집·길이 닿지 않는 넓은 빈 풀밭·빈 단은 비워 두지 말고 쓰임(밭·과수원·목초지·숲)을 자리로 주고, 큰길·모이는 곳 둘레에 길가 소품(props) 두세 곳을 둔다. 길·계단·널다리는 함수가 잇고, 못 놓은 자리·옮긴 거리·못 낸 길을 보고한다.";
}

/** 마을이 지어질 맵 크기(build·authorBeodeulTown 기본값과 같은 계산) — 코드 지형 미리보기가 같은 크기로 땅을 만든다. */
export function villageMapSize(spec: PlaceSpec, args: Record<string, unknown>, project?: Project): [number, number] {
  const w = num(args.width), h = num(args.height);
  const flat = args.walls === true || args.landform === "flat" || args.terrain === "flat";
  if (w !== undefined && h !== undefined) return [w, h];
  const theme = args.theme as string | undefined;
  if (spec.salt !== undefined && (theme === undefined || theme === "river" || theme === "coast") && w === undefined && h === undefined) {
    const [a, b] = ([[42, 34], [50, 32], [38, 40]] as const)[Math.floor(spec.salt / 9) % 3]!;
    const height = b + (flat ? 0 : 8);
    if (!flat && project && !spec.hints?.layout && !spec.villageLayout) {
      const kits = beodeulKits(project);
      const footprints = askedBuildingWords(spec.hints?.buildings).flatMap(word => askedBuildingKits(kits, word).slice(0, 1));
      // Coast and river terrains share their height between water, banks and terraces.
      return [Math.max(a, ...footprints.map(k => 4 * k.width)), Math.max(height, ...footprints.map(k => 4 * k.height))];
    }
    return [a, height];
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
  // 요청 건물: hints.buildings 와, 건물 킷의 id 인 특징 낱말(features ["plaza", "cathedral"]) — 시공기가 모이는 곳 가장자리에 앉힌다.
  // 모르는 이름은 빼고 알린다(make_place 는 여기 오기 전에 장소마다 한 번 거절하고 목록을 준다 — 이 줄은 그 뒤에도 모르는 이름이 온 판과 다른 길의 것이다).
  const wanted = askedVillageBuildings(run.ctx.project, spec);
  if (wanted.buildings.length) args.buildings = wanted.buildings; else delete args.buildings;
  const unknownNamed = wanted.unknown.filter((w) => askedBuildingWords(spec.hints?.buildings).includes(w));
  if (unknownNamed.length) warnings.push(unknownVillageBuildingText(run.ctx.project, unknownNamed));
  // 같은 요청 세 번이 같은 마을이 되지 않게(2026-10-23 다양성 검수: 강가 마을 세 판이 같은 강·다리·방앗간 자리 8/10).
  // 요청이 정하지 않은 땅 모양·숲 종류는 make_place 의 salt 로 고른다. 고치기는 명세에 남은 salt 로 같은 값을 다시 고른다.
  if (spec.salt !== undefined && (args.theme === undefined || args.theme === "river" || args.theme === "coast")) {
    // 코드 지형 마을은 땅을 미리보기(villageArgs 만으로 codeTerrainFor)에서 이미 정했다 — 여기서 terraces 를 덧붙이면 지은 땅이 미리본 땅과 달라지고
    // 평지 요청에 세 단이 깔렸다(2026-10-30 실조수 opus 「강가의 평범한 시골 마을」: 미리본 동서 강 → 지은 맵은 서쪽 협곡 강·단 0/2/4, salt%3==0).
    if (args.terrain === undefined && spec.salt % 3 === 0 && !usesCodeTerrain(args, String(args.theme ?? "river"))) args.terrain = "terraces";
    // 게임이 나무 수종을 골랐으면(겉모습 trees — project/tilesetLook.ts) 활엽 나무 자리로 짓는다: 수종 그림은 활엽 나무 킷 칸에 겹쳐 그린다.
    if (args.forestType === undefined) args.forestType = ((look) => look?.trees || look?.stand)(projectTilesetLook(run.ctx.project, "beodeul_city", run.ctx.lookKey, run.ctx.lookTaken)) ? "broadleaf"
      : (["broadleaf", "conifer", "mixed"] as const)[Math.floor(spec.salt / 3) % 3];
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
  // 이야기가 청한 큰 건물(hints.buildingNeeds — 청사진 장소 종류에서 온 안쪽 칸): 지형·물에 따라 그 킷이 못 앉는 씨앗이 있다 — 사본 위에서 씨앗 몇 개를 지어 보고 청한 건물이 모두 선 첫 씨앗을 고른다(없으면 가장 많이 선 것).
  const needs = (Array.isArray(args.buildingNeeds) ? args.buildingNeeds : []) as BuildingNeed[];
  if (!prev && args.seed === undefined && !args.layout && (needs.length || wantHouses !== undefined)) {
    let best: { seed: number; stood: number; houseDelta: number } | undefined;
    // Preserve the house-count seed sequence when the blueprint requests an interior.
    // Changing the first seed moves the terrain and can remove sites for dungeon entrances.
    const nameSeed = [...spec.name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
    const salt = wantHouses === undefined ? spec.salt ?? nameSeed : (nameSeed + (spec.salt ?? 0)) >>> 0;
    for (let i = 0; i < (needs.length ? 6 : 5); i++) {
      const seed = (salt + i * 7919) % 100000;
      const trial = createBuildRun({ ...run.ctx, project: cloneProjectSharingSharedDictionaries(run.ctx.project) });
      const r = trial.call("author_beodeul_town", { name: spec.name, ...args, seed, ...(mapId ? { mapId } : {}) });
      const data = r.data as { mapId?: string; houses?: number; doors?: { kit?: string; reached?: boolean }[] } | undefined;
      const tm = data?.mapId ? trial.ctx.project.maps[data.mapId] : undefined;
      const houses = num(data?.houses);
      if (!r.ok || !tm || (wantHouses !== undefined && houses === undefined)) continue;
      const left = needs.length ? (data?.doors ?? []).filter((d) => d.reached !== false).map((d) => trial.ctx.project.tilesets[tm.tilesetId]?.structureKits?.find((k) => k.id === d.kit)).filter((k) => !!k) : [];
      // 한 킷은 한 주문만 채운다(여관과 회관을 한 건물이 겸하지 않는다).
      let stood = 0;
      for (const need of needs) { const at = left.findIndex((k) => kitServesBuilding(k, need)); if (at >= 0) { left.splice(at, 1); stood++; } }
      const houseDelta = wantHouses === undefined ? 0 : Math.abs(houses! - wantHouses);
      if (!best || stood > best.stood || (stood === best.stood && houseDelta < best.houseDelta)) best = { seed, stood, houseDelta };
      if (stood === needs.length && (wantHouses === undefined || houses! >= wantHouses)) break;
    }
    if (best) args.seed = best.seed;
  }
  if (!prev && args.seed === undefined && wantHouses === undefined && spec.salt !== undefined) args.seed = spec.salt % 100000;
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
  // 완성된 집 보호: 집이 선 맵은 덮어 짓기가 거절된다. 같은 id 로 지우고 다시 지어도 적용 단계의 보호 검사(같은 맵의 옛 집 칸)가 거절하고,
  // 시작 맵은 지울 수도 없었다(2026-10-30 실조수 terra 「강가 장터」: 비평가가 고칠 곳을 짚었는데 edit_place 두 번 모두 거절).
  // 그 맵에 이벤트가 없고 다른 맵이 그 맵으로 이어지지 않으면 새 id 로 다시 짓고, 시작 맵이었으면 시작을 새 맵으로 옮긴 뒤 옛 맵을 지운다
  // (맵째 지운 집은 보호 대상이 아니다 — houseProtection). 문이 이어진 맵은 그대로 두고 고치는 길을 알려 준다.
  let replacedFrom: string | undefined;
  if (!result.ok && mapId && run.ctx.project.maps[mapId] && /집 보호|house|완성된/.test(`${result.summary} ${(result.issues ?? []).map((i) => i.message).join(" ")}`)) {
    const proj = run.ctx.project, old = proj.maps[mapId]!;
    const linked = Object.values(proj.maps).some((m) => m.id !== mapId && JSON.stringify(m.events ?? []).includes(`"${mapId}"`));
    if (old.events.length === 0 && !linked) {
      let newId = `${mapId}_r2`; for (let n = 3; proj.maps[newId]; n += 1) newId = `${mapId}_r${n}`;
      const { mapId: _drop, ...rest } = base; void _drop;
      const rebuilt = run.call("author_beodeul_town", { ...rest, id: newId });
      if (rebuilt.ok) {
        let moved = run.ctx.project.startMapId !== mapId;
        if (!moved) {
          const ent = (rebuilt.data as { entrance?: { x?: number; y?: number } } | undefined)?.entrance;
          const st = run.ctx.project.startPos;
          for (const at of [st, ent && typeof ent.x === "number" && typeof ent.y === "number" ? { x: ent.x, y: ent.y } : undefined]) {
            if (!at) continue;
            if (run.call("set_start_position", { mapId: newId, x: at.x, y: at.y }).ok) { moved = true; break; }
          }
        }
        const removed = moved ? run.call("remove_map", { mapId }) : { ok: false };
        if (removed.ok) { result = rebuilt; replacedFrom = mapId; }
        else run.call("remove_map", { mapId: newId });
      }
    } else {
      warnings.push(`「${old.name}」(${mapId}) 은 집이 선 맵이라 다시 지을 수 없다(${old.events.length ? `이벤트 ${old.events.length}개` : "다른 맵의 문이 이어짐"}) — 같은 edit_place 를 되풀이하지 말고 집 밖 칸은 stamp_object·fill_region, 사람은 add_people 로 고친다.`);
    }
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
  // 숲 구성(stand)을 다 채우지 못한 마을: 쓰기 도구의 경고는 diff.warnings 로 온다 — 그 한 줄(무엇이 모자라고 몇 번 해 봤는지)을 보고에 싣는다. 조용히 넘어가지 않는다.
  warnings.push(...((result as { diff?: { warnings?: string[] } }).diff?.warnings ?? []).filter((w) => w.startsWith("The stand ") && !warnings.includes(w)));
  if (replacedFrom) warnings.push(`완성된 집 보호로 「${replacedFrom}」 맵을 덮어 지을 수 없어 새 맵 ${builtId} 로 다시 짓고 옛 맵을 지웠다${run.ctx.project.startMapId === builtId ? "(시작 위치도 새 맵으로)" : ""} — 이 마을의 mapId 는 이제 ${builtId} 다.`);
  const start = run.ctx.project.startPos;
  const ent = data.entrance as { x?: number; y?: number } | undefined;
  const entrance = run.ctx.project.startMapId === builtId && start
    ? { mapId: builtId, x: start.x, y: start.y }
    : { mapId: builtId, x: ent?.x ?? Math.floor((num(data.width) ?? 40) / 2), y: ent?.y ?? Math.floor((num(data.height) ?? 32) / 2) };
  const farm = farmAddons(run, builtId, words(spec), warnings, missing);
  calls.push(...run.calls.slice(firstCall + calls.length));
  if (data.theme === "coast") warnings.unshift(COAST_TERRAIN_NOTE);
  const parts = [`${String(data.theme ?? "")} ${String(data.form ?? "")} 마을`, farm.length ? `농가 ${farm.join("·")}` : "", `집 ${houses ?? "?"}채`, data.gathering ? `모이는 곳 ${(data.gathering as { why?: string }).why ?? ""}` : "", data.walls ? "성벽" : "", data.bridge ? "다리" : ""].filter(Boolean);
  // 시작에서 걸어 닿지 않는 집(강 건너·막힌 터)의 문은 목록에서 뺀다 — 그 문앞으로 이으면 출입구가 닿는 맨바닥으로 옮겨 붙는다(2026-11-11 문 앞 칸 탐침 seed 202).
  const allDoors = Array.isArray(data.doors) ? data.doors as (NonNullable<VillageState["doors"]>[number] & { reached?: boolean })[] : undefined;
  const doors = allDoors?.filter((d) => d.reached !== false);
  if (allDoors && doors && doors.length < allDoors.length) warnings.push(`${allDoors.length - doors.length} house door(s) cannot be walked to from the map entrance and are left out of the door list — do not link interiors to those houses.`);
  const state: VillageState = { args, seed, variant, ...(doors ? { doors } : {}) };
  // 집 문 앞 칸 — 실내를 잇는 create_transfer_pair 는 이 칸을 쓴다(2026-11-03 조수 대조 B8 서리나루 Opus: 결과에 문 자리가 없어
  // 광장 칸(34,27)을 문으로 짐작해 「맨바닥 이동」이 남았고, set_map_door 로 문 그림을 찾다 여섯 번 거절됐다).
  // 문마다 건물 이름과 크기 단을 같이 싣는다 — 킷 id 만으로는 어느 문이 어떤 건물인지 읽을 수 없었다(2026-11-16 r6: 어물전이 화물 창고 문에 달리고 생선 가게는 빈 채 남았다).
  const doorList = (state.doors ?? []).slice(0, 14).map((d) => `${String(d.kit ?? "").replace(/^bd-/, "")}(${d.x},${d.y})${doorTail(run.ctx.project, builtId, d.kit)}`);
  const doorNote = doorList.length ? ` · 집 문 앞 칸(실내 잇기 create_transfer_pair 의 a 좌표; «건물 이름» · medium/large/xlarge = 방이 여럿인 큰 건물 — 그 문 뒤 실내는 make_place 의 hints.door [x,y] 로 지으면 건물 크기를 따른다): ${doorList.join(" · ")}${(state.doors?.length ?? 0) > doorList.length ? " …" : ""}` : "";
  // 마을 종류와 선 장면 — 장면 이름은 사람·사건의 where 낱말로 쓸 수 있다(place/where.ts 가 맵의 장면 기록에서 찾는다).
  const vk = data.villageKind as { id?: string } | undefined;
  const sceneList = (Array.isArray(data.scenes) ? data.scenes as { ko: string; en: string; stand: { x: number; y: number } }[] : []).map((sc) => `«${sc.ko}» ${sc.en} (${sc.stand.x},${sc.stand.y})`);
  const kindNote = vk?.id ? ` · kind ${vk.id}${sceneList.length ? ` — scenes, usable as where: ${sceneList.join(" · ")}` : ""}` : "";
  // 요청 건물이 어디에 섰는지(또는 서지 못했는지) — 그 건물의 문 앞 칸을 조수가 바로 쓴다(실내 잇기). 서지 못한 것은 조용히 넘어가지 않는다.
  const askedList = Array.isArray(data.asked) ? data.asked as { asked: string; kit?: string; door?: { x: number; y: number }; failed?: string }[] : [];
  const askedNote = askedList.length ? ` · asked buildings: ${askedBuildingsNote(run.ctx.project, askedList)}` : "";
  return { ok: true, mapIds: [builtId], entrance, summary: `${spec.name}: ${parts.join(" · ")} (${num(data.width)}×${num(data.height)}, seed ${seed})${askedNote}${kindNote}${doorNote}`, warnings, missingArt: missing, calls, state, ...(replacedFrom ? { relaidFrom: replacedFrom } : {}) };
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
    const roads = roadCells(run.ctx.project, map);
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
