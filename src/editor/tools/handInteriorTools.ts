// 손 도트 실내 v5 도구 — 조수가 실내를 까는 유일한 경로(2026-09-29, 옛 실내 칩셋 폐기).
//   list_hand_interior_parts : 방 종류별 가구(예제 26맵) · 낱말 검색(설명·태그까지) · 바닥·벽면·천장·탁자·줄·단·탁상 물건 목록
//   build_hand_interior_room : 평면 문자열 → 벽·천장 자동, 가구는 v5 물건 id → atlas_biome_interior 새 맵(또는 같은 칩셋 맵 다시 짓기)
//   두 도구 모두 tileset:"jp_city" 이면 일본 실내(jp_city 번들 안, 화실·LDK·욕실·현관)를 같은 규칙으로 짓는다.
// 조립 규칙은 src/editor/handInterior/builder.ts, 칸 사전은 src/assets/handInteriorSpec.json · jpInteriorSpec.json.
import { withHandInteriorEdit } from "@/editor/handInterior/edit";
import { fitStairTransfers } from "@/project/stairs/fit";
import { describeSpecStairEntrance } from "@/project/stairs/contract";
import { buildHandInteriorLayers, roomSpecOf, HAND_INTERIOR_SPEC, HAND_INTERIOR_SPECS, HAND_INTERIOR_TILESET_ID, JP_INTERIOR_SPEC, JP_INTERIOR_TILESET_ID, WIZARDING_INTERIOR_SPEC, WIZARDING_INTERIOR_TILESET_ID, SENGOKU_INTERIOR_SPEC, SENGOKU_INTERIOR_TILESET_ID, CAMPUS_INTERIOR_SPEC, MODERN_CITY_INTERIOR_SPEC, MODERN_CITY_INTERIOR_TILESET_ID, HandInteriorError, VEHICLE_DOORS, type HandInteriorInput, type HandInteriorLayers, type HandInteriorSpec } from "@/editor/handInterior/builder";
import { roomIndex, roomParts, searchParts, fullRow, shortRow } from "@/editor/handInterior/parts";
import { handInteriorShapeFromPlan, nearestOpening, PLAIN_BOX_MIN_CELLS, type HandInteriorShape } from "@/editor/handInterior/shape";
import { createAtlasBiomeInteriorTileset, ensureAtlasBiomeInteriorCurrent } from "@/project/defaults/atlasBiomeInterior";
import { createSengokuEdoTileset, ensureSengokuEdoTileset } from "@/project/defaults/sengokuEdo";
import { createJpCityTileset, ensureJpCityTileset } from "@/project/defaults/jpCity";
import { createWizardingWorldTileset, ensureWizardingWorldTileset } from "@/project/defaults/wizardingWorld";
import { createModernCityTileset, ensureModernCityTileset } from "@/project/defaults/modernCity";
import { kitHandObjects } from "@/project/roomKit";
import { passabilityOf } from "@/project/collision";
import { isDoorArtCell } from "@/project/lint/scenePolishLint";
import { isUntouchedMap } from "@/project/projectBlankness";
import type { Command, GameEvent, GameMap, Project, TilesetDef } from "@/project/types";
import { workshopHandObjects } from "@/project/workshopTiles";
import { referenceOwner } from "@/project/tilesetReferences";
import { handInteriorPlanExits } from '@/editor/handInterior/exits';
import { withComposedRooms } from '@/editor/handInterior/rooms';
import { layoutAscii, layoutCandidates, LayoutError, type LayoutCandidate, type LayoutRequest } from '@/editor/handInterior/layout';
import { composeInteriorBlueprint, type BlueprintInteriorArgs } from '@/editor/handInterior/blueprintComposers';
import { furnishRooms } from '@/editor/handInterior/furnish';
import { addMapLocation, COMPOSED_LAYOUT_TAG } from '@/project/mapNamedLocations';

/** layout 으로 짠 방의 이름표 — 다시 지을 때 이 이름표만 갈아 끼운다. */
const HAND_LAYOUT_ROOM_TAG = 'hand-layout-room';
import { programKinds, roomPrograms, roomTemplates } from '@/editor/handInterior/templates';
import { genId } from "@/util/id";
import { assignCreatedMapBgm } from "./mapTools";
import { ToolError, type ToolDefinition, type ToolExecResult } from "./types";
import { venueScaleBrief } from "@/editor/handInterior/venueScale";
import { handInteriorCompositionLint } from "@/editor/handInterior/compositionLint";

// 바닥·벽면·천장 id 를 enum 으로 연다 — 자유 문자열이면 모델이 wood·stone·brick 처럼 그럴듯한 이름을 지어
// 「바닥 "wood" 이 없다」로 거부된 뒤 다시 부른다(2026-10-05 헤드리스 스트레스 13판 중 4판).
// 두 칩셋 id 를 합친 enum 이다 — 고른 칩셋에 없는 id 는 조립기가 그 칩셋의 목록과 함께 거부한다.
const uniq = (pick: (s: HandInteriorSpec) => object) => [...new Set([HAND_INTERIOR_SPEC, JP_INTERIOR_SPEC, WIZARDING_INTERIOR_SPEC, SENGOKU_INTERIOR_SPEC, CAMPUS_INTERIOR_SPEC, MODERN_CITY_INTERIOR_SPEC].flatMap((s) => Object.keys(pick(s))))];
// 칩셋 사양(손 도트·jp_city·마법 학교·캠퍼스) id 를 합친 enum 이다 — 고른 칩셋에 없는 id 는 조립기가 그 칩셋의 목록과 함께 거부한다.
// 타일셋 「방 짓기」 탭에서 사용자가 만든 역할표(src/project/roomKit.ts)는 바닥 floor · 벽면 wall · 천장 default 하나씩이다.
const FLOOR_IDS = [...uniq((s) => s.floors), "floor"];
const WALL_IDS = [...uniq((s) => s.walls), "wall"];
const CEILING_IDS = uniq((s) => s.ceilings);
const TILESET_IDS = Object.keys(HAND_INTERIOR_SPECS);
/** 새 실내 맵에 BGM 을 자동으로 고르는 현대 칩셋. */
const MODERN_BGM_TILESETS: ReadonlySet<string> = new Set(["modern_campus", MODERN_CITY_INTERIOR_TILESET_ID, JP_INTERIOR_TILESET_ID]);
const TILESET_PARAM = { type: "string", description: `실내 칩셋 id — 방 짓기 역할표(roomKit)가 있는 타일셋. ${HAND_INTERIOR_TILESET_ID}(기본, 판타지·중세 손 도트) · ${JP_INTERIOR_TILESET_ID}(일본 현대 집: 현관·화실·LDK·욕실·화장실·침실, 일본 거리 jp_city 와 같은 칩셋 — 2층 단독주택은 layout:{program:"jp-house-1f"|"jp-house-2f", seed} 가 가운데 복도·현관·계단·물 쓰는 곳 덩이·독립 화장실 구조로 짓는다) · ${WIZARDING_INTERIOR_TILESET_ID}(마법 학교 성채·병동·온실·도서관 — 가구는 그 칩셋 조립 부품 wz-… id) · ${SENGOKU_INTERIOR_TILESET_ID}(전국·에도 일본: 다다미 방·다실·여관 손님방·성 알현실·가게·농가·도장·목욕간 — layout:{program:"samurai-house"|"ryokan-1f"|"ryokan-2f"|"castle-hall"|"machiya"|"minka"|"dojo"}) · modern_campus(현대 학교: 교실·복도·도서관·보건실·급식실·기숙사 — 남쪽 출구가 2칸인 예제 평면이면 exitWidth:2) · ${MODERN_CITY_INTERIOR_TILESET_ID}(도쿄풍 현대 도시 실내: 백화점·대형 마트·지하철역·종합병원·영화관 아케이드·레스토랑 바·미술관 박물관·사무실·편의점·아파트·빌딩 로비·카페·은행·창고 — layout:{program:"department-store"|"supermarket-mart"|"subway-station"|"hospital-ward"|"cinema-arcade"|"restaurant-bar"|"museum-gallery"|"office-floor"|"konbini"|"apartment"|"lobby"|"cafe"|"bank"|"concourse"|"warehouse"}, 남쪽 출구 2칸 이상이면 exitWidth) · 스토어에서 받은 그 사본(store_…)도 된다. 인자 없이 list_hand_interior_parts 를 부르면 이 프로젝트에서 쓸 수 있는 칩셋이 나온다.` } as const;
/** 역할표가 있는 이 프로젝트의 칩셋 + 번들 칩셋(프로젝트에 아직 없어도 짓기 전에 넣는다). */
function roomTilesetIds(project: Project): string[] {
  return [...new Set([...TILESET_IDS, ...Object.values(project.tilesets).filter((t) => roomSpecOf(t)).map((t) => t.id)])];
}
/**
 * tileset 을 빠뜨린 호출 — 다시 지을 맵의 칩셋, 아니면 바닥·벽면 id 가 한 칩셋에만 있으면 그 칩셋. 그래도 모르면 손 도트 v5.
 * 2026-10-08 조수 시험: 일본 집을 tileset 없이 floor:"flooring" 으로 불러 v5 바닥 목록과 함께 거부됐다.
 */
function inferTileset(project: Project, args: Record<string, unknown>): string {
  const map = typeof args.mapId === "string" ? project.maps[args.mapId] : undefined;
  if (map && (HAND_INTERIOR_SPECS[map.tilesetId] || roomSpecOf(project.tilesets[map.tilesetId]))) return map.tilesetId;
  for (const [key, id] of [["floors", args.floor], ["walls", args.wall]] as const) {
    const found = typeof id === "string" ? TILESET_IDS.filter((t) => HAND_INTERIOR_SPECS[t]![key][id]) : [];
    if (found.length === 1) return found[0]!;
  }
  const nameText = typeof args.name === "string" ? args.name : "";
  const briefText = [project.gameDesignBrief?.summary, project.gameDesignBrief?.interview?.concept, project.gameDesignBrief?.interview?.notes].filter(Boolean).join("\n");
  const text = [nameText, briefText].filter(Boolean).join("\n");
  const jpRe = /일본|도쿄|신주쿠|시부야|교토|오사카|사쿠라|다다미|화실|昇降口|和室|玄関|jp_city/iu;
  const campusRe = /대학교|대학\s*강의|캠퍼스|학부|고등학교\s*교실|중학교\s*교실|학생회관|기숙사|modern_campus/iu;
  const modernCityRe = /현대\s*도시|현대\s*은행|현대\s*동네|백화점|대형\s*마트|지하철역|종합병원|오피스\s*타워|시중\s*은행|은행\s*지점|초등학교|개인\s*병원|의원|클리닉|시청|도서관|파출소|지구대|편의점|원룸|오피스텔|modern_city/iu;
  const nameWantsJp = jpRe.test(nameText);
  const nameWantsCampus = campusRe.test(nameText);
  const nameWantsModernCity = modernCityRe.test(nameText) && !nameWantsJp;
  const hasJp = Object.values(project.maps).some((m) => m.tilesetId === JP_INTERIOR_TILESET_ID);
  const hasCampus = Object.values(project.maps).some((m) => m.tilesetId === "modern_campus");
  const hasModernCity = Object.values(project.maps).some((m) => m.tilesetId === MODERN_CITY_INTERIOR_TILESET_ID);
  const prog = args.layout && typeof args.layout === "object" ? (args.layout as Record<string, unknown>).program : undefined;
  if (typeof prog === "string" && prog.trim()) {
    const p = prog.trim();
    const pOwners = TILESET_IDS.filter((t) => programKinds(t, p));
    if (pOwners.length === 1) return pOwners[0]!;
    if (nameWantsJp && pOwners.includes(JP_INTERIOR_TILESET_ID)) return JP_INTERIOR_TILESET_ID;
    if (nameWantsCampus && pOwners.includes("modern_campus")) return "modern_campus";
    if (nameWantsModernCity && pOwners.includes(MODERN_CITY_INTERIOR_TILESET_ID)) return MODERN_CITY_INTERIOR_TILESET_ID;
    if (hasJp && !hasModernCity && pOwners.includes(JP_INTERIOR_TILESET_ID)) return JP_INTERIOR_TILESET_ID;
    if (hasCampus && pOwners.includes("modern_campus")) return "modern_campus";
    if (hasModernCity && pOwners.includes(MODERN_CITY_INTERIOR_TILESET_ID)) return MODERN_CITY_INTERIOR_TILESET_ID;
    if (jpRe.test(briefText) && pOwners.includes(JP_INTERIOR_TILESET_ID)) return JP_INTERIOR_TILESET_ID;
    if (pOwners.includes(MODERN_CITY_INTERIOR_TILESET_ID) && (!pOwners.includes(HAND_INTERIOR_TILESET_ID) || p === "museum-gallery")) {
      return MODERN_CITY_INTERIOR_TILESET_ID;
    }
  }
  if (nameWantsJp) return JP_INTERIOR_TILESET_ID;
  if (nameWantsCampus) return "modern_campus";
  if (nameWantsModernCity) return MODERN_CITY_INTERIOR_TILESET_ID;
  const startMap = project.maps[project.startMapId];
  if (startMap && HAND_INTERIOR_SPECS[startMap.tilesetId] && startMap.tilesetId !== HAND_INTERIOR_TILESET_ID) {
    return startMap.tilesetId;
  }
  if (jpRe.test(text)) return JP_INTERIOR_TILESET_ID;
  if (campusRe.test(text)) return "modern_campus";
  if (modernCityRe.test(text)) return MODERN_CITY_INTERIOR_TILESET_ID;
  return HAND_INTERIOR_TILESET_ID;
}
/** 방 구성표 — 예제 맵마다 방 종류 목록, 방 견본 종류별 크기. build_hand_interior_room 의 layout.program·layout.rooms 에 쓴다. */
function interiorPrograms(tilesetId: string) {
  const P = roomPrograms(tilesetId);
  if (!Object.keys(P).length) return {};
  const kinds = new Map<string, string[]>();
  for (const t of roomTemplates(tilesetId)) (kinds.get(t.kind) ?? kinds.set(t.kind, []).get(t.kind)!).push(`${t.w}×${t.h}`);
  return {
    programs: Object.entries(P).flatMap(([building, list]) => list.map((m) => ({ program: m.map, building, rooms: m.kinds.join(" · ") }))),
    roomKinds: [...kinds].map(([kind, sizes]) => ({ kind, templates: sizes.length, sizes: [...new Set(sizes)].slice(0, 4).join(" ") })),
  };
}
function pickTileset(project: Project, args: Record<string, unknown>): string {
  const t = typeof args.tileset === "string" && args.tileset.trim() ? args.tileset.trim() : inferTileset(project, args);
  if (!HAND_INTERIOR_SPECS[t] && !roomSpecOf(project.tilesets[t])) {
    const known = project.tilesets[t] ? ` 사용자에게 「자료집 → 타일 → ${project.tilesets[t]!.name} → 방 짓기」 탭에서 바닥·벽면·천장 칸을 골라 역할표를 만들어 달라고 안내한다(1분이면 된다).` : "";
    throw new ToolError(`실내 칩셋 "${t}" 은 방 짓기 역할표가 없다 — 지금 쓸 수 있는 칩셋: ${roomTilesetIds(project).join(", ")}.${known}`, { code: "unknown-tileset" });
  }
  return t;
}
/** 칩셋 정의를 프로젝트에 두고(없으면 번들 사본) 최신으로 맞춘다. 번들 밖 칩셋(스토어 사본 등)은 그대로 쓴다. */
function ensureInteriorTileset(draft: Project, id: string): TilesetDef | undefined {
  if (!HAND_INTERIOR_SPECS[id]) return draft.tilesets[id];
  if (id === JP_INTERIOR_TILESET_ID) {
    if (!draft.tilesets[id]) draft.tilesets[id] = createJpCityTileset();
    else ensureJpCityTileset(draft.tilesets[id]!);
  } else if (id === WIZARDING_INTERIOR_TILESET_ID) {
    if (!draft.tilesets[id]) draft.tilesets[id] = createWizardingWorldTileset();
    else ensureWizardingWorldTileset(draft.tilesets[id]!);
  } else if (id === SENGOKU_INTERIOR_TILESET_ID) {
    if (!draft.tilesets[id]) draft.tilesets[id] = createSengokuEdoTileset();
    else ensureSengokuEdoTileset(draft.tilesets[id]!);
  } else if (id === MODERN_CITY_INTERIOR_TILESET_ID) {
    if (!draft.tilesets[id]) draft.tilesets[id] = createModernCityTileset();
    else ensureModernCityTileset(draft.tilesets[id]!);
  } else if (!draft.tilesets[id]) draft.tilesets[id] = createAtlasBiomeInteriorTileset();
  else ensureAtlasBiomeInteriorCurrent(draft, id);
  return draft.tilesets[id];
}
/**
 * 칩셋 역할표 + 사용자가 공방에서 그려 이 칩셋에 구운 기물(id workshop:…).
 * 역할표에 가구 표가 없으면(마법 학교·「방 짓기」 탭에서 만든 역할표) 칩셋의 조립 부품을 가구로 쓴다(kitHandObjects).
 */
let bundledWizarding: TilesetDef | undefined;
function specFor(project: Project, tilesetId: string): HandInteriorSpec {
  // 프로젝트에 아직 마법 학교 칩셋이 없으면(짓기 전 목록 보기) 번들 정의의 조립 부품을 읽는다.
  const tileset = project.tilesets[tilesetId] ?? (tilesetId === WIZARDING_INTERIOR_TILESET_ID ? (bundledWizarding ??= createWizardingWorldTileset()) : undefined);
  const base = roomSpecOf(tileset) ?? HAND_INTERIOR_SPECS[tilesetId]!;
  const kits = Object.keys(base.objects).length ? {} : kitHandObjects(tileset);
  const workshop = workshopHandObjects(tileset);
  return Object.keys(kits).length || Object.keys(workshop).length ? { ...base, objects: { ...base.objects, ...kits, ...workshop } as HandInteriorSpec["objects"] } : base;
}
const PAIR = { type: "object", properties: { a: { type: "string" }, b: { type: "string" } }, required: ["a", "b"], additionalProperties: false } as const;
const XY = { type: "object", properties: { x: { type: "integer" }, y: { type: "integer" } }, required: ["x", "y"], additionalProperties: false } as const;

/** 검색 결과가 이 수 이하면 행마다 설명·태그·놓는 곳·짝 소품까지, 넘으면 id·이름·종류·크기·설명 한 줄만. */
const FULL_ROWS = 12;

export const LIST_HAND_INTERIOR_PARTS_TOOL: ToolDefinition = {
  name: "list_hand_interior_parts",
  mode: "read",
  domains: ["tile", "map"],
  description: "손 도트 실내(atlas_biome_interior, 또는 tileset:\"jp_city\" 일본 집 실내) 부품 사전 — 가구마다 설명(desc)·쓰는 방(tags)·놓는 곳(place)·짝 소품(pair)이 들어 있어 가구 사전 참고문서를 따로 읽지 않아도 된다. "
    + "① room(방 종류 또는 건물: 빵집·bakery·여관 객실·부엌·침실·서재·선술집·예배당·대장간 등) → 예제 26맵에서 그 방에 실제로 쓰인 가구를 종류별(floor 바닥 가구 막힘 · wall 북쪽 벽 앞 · hang 벽면 윗줄 걸이 · flat 밟는 무늬 · table 탁자 자동 타일 · line 줄 자동 타일 · dais 단)로, 쓰인 방 수·개수와 함께 준다. 건물이면 방마다 가구 목록도 준다. "
    + "② query(여러 낱말 가능, 예: \"여관 벽\"·\"침실 바닥\"·bed·화덕) → id·이름·분류·태그·설명을 모두 찾아 모든 낱말이 맞는 것부터 준다. 결과가 적으면(12 이하) 행마다 desc·tags·place·pair, 많으면 desc 한 줄만 — 좁히려면 낱말을 더하거나 category 를 준다. "
    + "③ 인자 없이 → 바닥·벽면·천장·탁자·줄·단·탁상 물건 목록, 가구 분류, 방 종류·건물 id. "
    + "행의 use = 게임에서의 쓰임(sit 앉기 · sleep 자기 · open 열기(아이템 이벤트) · search 조사 · read 읽기 · counter 카운터 너머 대화 · travel 이동 · light 불빛 · save 저장 · heal 회복 · switch 켬/끔 장치 · push 밀기 · trap 함정 · key 열쇠·보물 받침 · gate 여닫는 문 · seal 봉인 · walk 밟음 · block 장식), "
    + "facing = 바라보는 쪽(앉는 가구는 탁자·제단 쪽을 보게 놓는다), states = 같은 물건의 다른 상태 그림(닫힘↔열림 등 — 이벤트 1쪽과 2쪽 그림). use 가 open·search·read·save·heal·switch·key 면 그 칸에 이벤트를 붙일 자리다. "
    + "결과 id 는 build_hand_interior_room 의 objects[].id 에 그대로 넣는다. 사용자가 공방에서 그려 넣은 기물은 id workshop:… · 분류 workshop(공방)으로 함께 나온다.",
  parameters: {
    type: "object",
    properties: {
      room: { type: "string", description: "방 종류 또는 건물(한국어·영어 id). 예: 빵집, bakery, 여관 객실, inn_room, 부엌, 침실, 선술집 홀" },
      query: { type: "string", description: "찾을 낱말(여러 개는 띄어 쓴다, 한국어·영어). 예: 여관 벽, 침실 바닥, bed" },
      category: { type: "string", description: "가구 분류 id(bake·pharm·home·church·kitchen·tavern…, 인자 없이 불러 목록 확인)" },
      limit: { type: "integer", minimum: 1, maximum: 200 },
      tileset: TILESET_PARAM,
    },
    additionalProperties: false,
  },
  run(project, args): ToolExecResult {
    const tilesetId = pickTileset(project, args);
    const S = specFor(project, tilesetId);
    const q = typeof args.query === "string" ? args.query.trim() : "";
    const cat = typeof args.category === "string" ? args.category.trim() : "";
    const room = typeof args.room === "string" ? args.room.trim() : "";
    const limit = typeof args.limit === "number" ? args.limit : 40;
    const categories = new Map<string, { ko: string; count: number }>();
    for (const o of Object.values(S.objects)) { const c = categories.get(o.category) ?? { ko: o.category_ko, count: 0 }; c.count++; categories.set(o.category, c); }
    if (room) {
      const r = roomParts(room, Math.min(limit, 16), S);
      if (!r) {
        const idx = roomIndex(S);
        // 다른 실내 칩셋에는 그 방이 있다(2026-10-22 조수 시험: 「카페」를 기본 판타지 실내에서 찾다 실패 — modern_city 에 cafe 가 있었다).
        const elsewhere = roomTilesetIds(project).filter((id) => id !== tilesetId).filter((id) => {
          try { return Boolean(roomParts(room, 1, specFor(project, id))); } catch { return false; }
        });
        const hint = elsewhere.length
          ? ` → '${room}' 은(는) 다른 실내 칩셋에 있다: ${elsewhere.map((id) => `list_hand_interior_parts({tileset:"${id}", room:"${room}"})`).join(" · ")} — 시대(현대·판타지)에 맞는 칩셋을 고른다.`
          : "";
        throw new ToolError(`방 종류·건물 '${room}' 을(를) ${tilesetId} 에서 모른다${hint} — ${tilesetId} 의 방: ${idx.rooms} / 건물: ${idx.buildings}`, { code: "unknown-room" });
      }
      const n = Object.values(r.groups).reduce((a, g) => a + (g?.length ?? 0), 0);
      return { summary: `${r.mode === "building" ? "건물" : "방"} ${r.ko}: 예제 ${r.exampleDocs.length}맵 ${r.roomCount}방에서 쓰인 가구 ${n}종(종류별)${r.alsoTagged ? ` + 태그가 맞는 ${r.alsoTagged.length}종` : ""}. 예제 참고문서 documentId: ${r.exampleDocs.slice(0, 4).join(", ")}${r.exampleDocs.length > 4 ? " …" : ""}.`,
        data: { tilesetId, ...r } };
    }
    if (!q && !cat) {
      const idx = roomIndex(S);
      return { summary: `${tilesetId === JP_INTERIOR_TILESET_ID ? "일본 집 실내(jp_city)" : tilesetId === WIZARDING_INTERIOR_TILESET_ID ? "마법 학교 실내(wizarding_world)" : HAND_INTERIOR_SPECS[tilesetId] ? "손 도트 실내" : `${project.tilesets[tilesetId]?.name ?? tilesetId} 실내`} 부품: 가구 ${Object.keys(S.objects).length}종(분류 ${categories.size}) · 바닥 ${Object.keys(S.floors).length} · 벽면 ${Object.keys(S.walls).length} · 천장 ${Object.keys(S.ceilings).length} · 탁상 물건 ${Object.keys(S.goods).length}. 가구는 room(방 종류)·query(낱말)·category 로 찾는다.${Object.keys(roomPrograms(tilesetId)).length ? ` 방 구성(programs ${Object.values(roomPrograms(tilesetId)).flat().length}개)·방 견본 종류(roomKinds)는 build_hand_interior_room 의 layout 에 쓴다.` : ""}`,
        data: { tilesetId, roomTilesets: roomTilesetIds(project), ...interiorPrograms(tilesetId),
          floors: Object.entries(S.floors).map(([id, f]) => ({ id, ko: f.ko })),
          walls: Object.entries(S.walls).map(([id, w]) => ({ id, ko: w.ko })),
          ceilings: Object.keys(S.ceilings),
          tables: Object.entries(S.tables).map(([id, t]) => ({ id, ko: t.ko, oneRow: t.oneRow, overhangPx: t.up })),
          lines: Object.entries(S.lines).map(([id, l]) => ({ id, ko: l.ko, walkable: l.kind === "flat" })),
          daises: Object.entries(S.daises).map(([id, d]) => ({ id, ko: d.ko })),
          goods: Object.keys(S.goods),
          objectCategories: [...categories].map(([id, c]) => ({ id, ko: c.ko, count: c.count })),
          rooms: idx.rooms, buildings: idx.buildings } };
    }
    const found = searchParts(q, cat, S);
    const shown = found.ids.slice(0, limit);
    const full = shown.length <= FULL_ROWS;
    const multi = found.tokens.length > 1;
    const rows = shown.map((id) => {
      const hit = multi ? `${found.hits.get(id)}/${found.tokens.length}` : undefined;
      const entrance = describeSpecStairEntrance(project.tilesets[tilesetId]?.roomKit?.builtin ?? tilesetId, id, S.objects[id]!.cells);
      return full ? fullRow(id, S.objects[id]!, hit, entrance) : shortRow(id, S.objects[id]!, hit, entrance);
    });
    const total = found.ids.length;
    const which = !multi ? "" : found.allMatch ? ` — 모든 낱말이 맞는 것만(일부만 맞는 ${found.partial}종은 뺐다)` : ` — 모든 낱말이 맞는 것이 없어 가장 많이 맞는 것부터`;
    return {
      summary: `가구 ${total}종${which}${total > limit ? ` · 앞 ${limit}` : ""}${full ? "" : " · 행이 많아 desc 만 — 낱말·category 를 더해 12종 이하로 좁히면 tags·place·pair 까지 준다"}`,
      data: { tilesetId, objects: rows, total, ...(multi ? { allMatch: found.allMatch, partial: found.partial } : {}) },
    };
  },
};

function transfer(mapId: string, x: number, y: number, to: { mapId: string; x: number; y: number; direction?: string }, index: number): GameEvent {
  const id = `${mapId}-link-${index}`;
  const direction = (to.direction ?? "down") as "up" | "down" | "left" | "right";
  return {
    id, name: "이동", x, y, trigger: { kind: "playerTouch" }, commands: [],
    pages: [{ id: `${id}-p1`, name: "1", conditions: [], graphic: {}, trigger: { kind: "playerTouch" }, priority: "below", overlapForbidden: false,
      movement: { type: "fixed", speed: 3, frequency: 3 },
      commands: [{ kind: "transfer", mapId: to.mapId, x: to.x, y: to.y, direction, fade: "black" }] }],
  } as unknown as GameEvent;
}

type TransferCommand = Extract<Command, { kind: "transfer" }>;
/** 이벤트의 맨 위 명령에 든 이동(문). 조건 분기 안의 이동은 문이 아니다. */
function eventTransfers(event: GameEvent): TransferCommand[] {
  const lists = [event.commands ?? [], ...(event.pages ?? []).map((page) => page.commands)];
  return lists.flatMap((commands) => commands.filter((command): command is TransferCommand => command.kind === "transfer"));
}

/**
 * 층 이동 착지를 돌아오는 계단 그림 칸 바로 앞으로 당긴다. liftTravelLinksOntoArt 가 트리거를 한 줄 올리면 조수가 예전 탈 자리
 * 아래 줄에 둔 착지가 2칸 떨어진다(scene-transfer-pair). 착지가 돌아오는 문에서 1칸 안이 아니고, 바로 위 두 칸째가 층 이동 그림 칸
 * 트리거면 그 앞 칸(통행)으로 옮긴다.
 */
function snapArrivalsToTravelArt(draft: Project, notes: string[]): void {
  for (const from of Object.values(draft.maps)) {
    for (const event of from.events ?? []) {
      for (const t of eventTransfers(event)) {
        const target = draft.maps[t.mapId];
        if (!target || target.climate?.mode !== "indoor" || target.id === from.id) continue;
        const returns = (target.events ?? []).filter((e) => eventTransfers(e).some((r) => r.mapId === from.id) && isDoorArtCell(draft, target, e.x, e.y));
        if (!returns.length || returns.some((e) => Math.max(Math.abs(e.x - t.x), Math.abs(e.y - t.y)) <= 1)) continue;
        const above = returns.find((e) => e.x === t.x && e.y === t.y - 2);
        if (!above) continue;
        const tileset = draft.tilesets[target.tilesetId];
        const idx = (t.y - 1) * target.width + t.x;
        const p = tileset ? passabilityOf(tileset, target.lowerTiles[idx] ?? -1, target.lowerOverlayTiles?.[idx] ?? -1, target.upperTiles[idx] ?? -1, target.upperOverlayTiles?.[idx] ?? -1) : null;
        if (!p || !(p.up || p.down || p.left || p.right)) continue;
        notes.push(`${from.id} ${event.id} 착지 ${target.id}(${t.x},${t.y}) → (${t.x},${t.y - 1}) — 돌아오는 계단 그림 칸 바로 앞`);
        (t as { y: number }).y = t.y - 1;
      }
    }
  }
}

/**
 * 층 이동 트리거를 계단·엘리베이터 그림 칸으로 올린다. 탈 자리(그림 앞 첫 바닥 줄)는 도착 칸으로 남긴다.
 * 왜(2026-10-22 장면 교훈 시험 「집 계단」): 도구가 알려 준 탈 자리(그림 앞 바닥)에 links 를 두자 scene-transfer-off-door 가
 * 여섯 건 났다 — 계단 앞 바닥을 지나가기만 해도 층이 바뀐다. 데모 교훈은 「문·계단 그림 칸에서 발동, 착지는 그 앞」이다.
 * 그림 칸이 이미 문 그림(엘리베이터 문턱)이면 그대로 두고, 그림 칸이 막혀 있으면 priority:"same" 부딪힘으로 발동한다.
 */
function liftTravelLinksOntoArt(draft: Project, map: GameMap, tileset: TilesetDef, notes: string[]): void {
  const taken = new Set((map.events ?? []).map((e) => `${e.x},${e.y}`));
  for (const event of map.events ?? []) {
    const indoor = eventTransfers(event).some((t) => t.mapId !== map.id && draft.maps[t.mapId]?.climate?.mode === "indoor");
    if (!indoor || isDoorArtCell(draft, map, event.x, event.y) || !isDoorArtCell(draft, map, event.x, event.y - 1)) continue;
    if (taken.has(`${event.x},${event.y - 1}`)) continue;
    const idx = (event.y - 1) * map.width + event.x;
    const p = passabilityOf(tileset, map.lowerTiles[idx] ?? -1, map.lowerOverlayTiles?.[idx] ?? -1, map.upperTiles[idx] ?? -1, map.upperOverlayTiles?.[idx] ?? -1);
    const walkable = p.up || p.down || p.left || p.right;
    taken.delete(`${event.x},${event.y}`);
    notes.push(`층 이동 ${event.id} 트리거 (${event.x},${event.y}) → 그림 칸 (${event.x},${event.y - 1})${walkable ? "" : " 부딪힘"} — 앞 바닥은 도착 칸`);
    event.y -= 1;
    taken.add(`${event.x},${event.y}`);
    if (!walkable) for (const page of event.pages ?? []) (page as { priority: string }).priority = "same";
  }
}

/**
 * 다시 지은 실내에 맞춰 문을 옮긴다. 바깥으로 나가는 문 이벤트는 가장자리 틈 위로, 다른 맵에서 들어오는 이동은 틈 바로 안쪽 바닥으로.
 * 왜(2026-10-07): 첫 구간 뼈대의 동쪽 문(19,8)이 새 평면에서 벽이 되자 커밋이 「transfer 목적지가 통행 불가」로 두 번 거부됐고,
 * 모델은 문을 방 안 바닥(18,8)으로 옮겨 통과시켰다 — 벽에 틈도 없는 보이지 않는 이동 칸이 출구가 됐다.
 */
function fitDoorsToPlan(
  draft: Project,
  mapId: string,
  events: GameEvent[],
  shape: HandInteriorShape,
  built: HandInteriorLayers,
  tileset: TilesetDef,
  notes: string[],
): void {
  const isWalkableFloor = (x: number, y: number): boolean => {
    if (!shape.isFloor(x, y)) return false;
    const idx = y * built.width + x;
    const p = passabilityOf(
      tileset,
      built.lowerTiles[idx] ?? -1,
      built.lowerOverlayTiles[idx] ?? -1,
      built.upperTiles[idx] ?? -1,
      built.upperOverlayTiles[idx] ?? -1,
    );
    return p.up || p.down || p.left || p.right;
  };
  const occupied = new Set(events.map((e) => `${e.x},${e.y}`));
  for (const event of events) {
    const transfers = eventTransfers(event).filter((t) => t.mapId !== mapId);
    const outbound = transfers.filter((t) => draft.maps[t.mapId]?.climate?.mode !== "indoor");
    const indoorTransfers = transfers.filter((t) => draft.maps[t.mapId]?.climate?.mode === "indoor");
    if (!outbound.length) {
      // 층 사이 이동(엘리베이터·계단): built.travel 탈 자리가 있으면 그 자리로 맞추고, 막힌 칸이면 가까운 열린 바닥으로 옮긴다.
      if (indoorTransfers.length && built.travel.length) {
        // 계단 입구 계약이 있는 탈 자리: 이벤트는 그 계단 그림 칸(trigger)에 — 앞 바닥에 두면 지나가기만 해도 층이 바뀐다.
        const contracted = built.travel.filter((tr) => tr.trigger);
        if (contracted.length && !contracted.some((tr) => tr.trigger!.x === event.x && tr.trigger!.y === event.y)) {
          const best = [...contracted]
            .filter((tr) => !occupied.has(`${tr.trigger!.x},${tr.trigger!.y}`))
            .sort((a, b) => (Math.abs(a.trigger!.x - event.x) + Math.abs(a.trigger!.y - event.y)) - (Math.abs(b.trigger!.x - event.x) + Math.abs(b.trigger!.y - event.y)))[0];
          if (best && Math.abs(best.trigger!.x - event.x) + Math.abs(best.trigger!.y - event.y) <= 4) {
            occupied.delete(`${event.x},${event.y}`);
            notes.push(`층 이동 ${event.id} (${event.x},${event.y}) → 계단 그림 칸 (${best.trigger!.x},${best.trigger!.y})${best.mode === "bump" ? " 부딪힘" : ""} — 앞 칸 (${best.x},${best.y}) 은 도착 칸`);
            event.x = best.trigger!.x;
            event.y = best.trigger!.y;
            occupied.add(`${event.x},${event.y}`);
            if (best.mode === "bump") for (const page of event.pages ?? []) (page as { priority: string }).priority = "same";
            continue;
          }
        }
        if (contracted.some((tr) => tr.trigger!.x === event.x && tr.trigger!.y === event.y)) continue;
        if (!built.travel.some((tr) => tr.x === event.x && tr.y === event.y)) {
          const bestTravel = [...built.travel]
            .filter((tr) => !occupied.has(`${tr.x},${tr.y}`) || (tr.x === event.x && tr.y === event.y))
            .sort((a, b) => (Math.abs(a.x - event.x) + Math.abs(a.y - event.y)) - (Math.abs(b.x - event.x) + Math.abs(b.y - event.y)))[0];
          if (bestTravel) {
            occupied.delete(`${event.x},${event.y}`);
            notes.push(`층 이동 ${event.id} (${event.x},${event.y}) → 탈 자리 (${bestTravel.x},${bestTravel.y})`);
            event.x = bestTravel.x;
            event.y = bestTravel.y;
            occupied.add(`${bestTravel.x},${bestTravel.y}`);
          }
        }
      }
      continue;
    }
    if (shape.openings.some((o) => o.x === event.x && o.y === event.y)) continue;
    const target = nearestOpening(shape, event);
    if (!target) {
      // 바깥 출구 틈이 없는 방(전철 차내 J45)은 그린 탈것 문 앞 탈 자리가 드나드는 곳이다 — 바깥으로 가는 문도 그리로 옮긴다.
      const vehicleSpot = [...built.travel]
        .filter((tr) => [...VEHICLE_DOORS].some((id) => tr.label.includes(`(${id})`)) && (!occupied.has(`${tr.x},${tr.y}`) || (tr.x === event.x && tr.y === event.y)))
        .sort((a, b) => (Math.abs(a.x - event.x) + Math.abs(a.y - event.y)) - (Math.abs(b.x - event.x) + Math.abs(b.y - event.y)))[0];
      if (vehicleSpot && !shape.openings.length) {
        if (vehicleSpot.x !== event.x || vehicleSpot.y !== event.y) {
          occupied.delete(`${event.x},${event.y}`);
          notes.push(`문 ${event.id} (${event.x},${event.y}) → 탈 자리 (${vehicleSpot.x},${vehicleSpot.y})`);
          event.x = vehicleSpot.x; event.y = vehicleSpot.y;
          occupied.add(`${event.x},${event.y}`);
        }
        continue;
      }
      const outdoors = outbound.find((t) => draft.maps[t.mapId] && draft.maps[t.mapId]!.tilesetId !== HAND_INTERIOR_TILESET_ID);
      if (outdoors) throw new ToolError(`바깥(${outdoors.mapId})으로 나가는 문 ${event.id}(${event.x},${event.y}) 이 있는데 평면 가장자리에 출입구 틈이 없다 — plan 맨 아래 줄의 '#' 하나를 '.' 로 비워 문을 낸다(그 칸이 출구가 된다)`, { code: "no-exit-gap", mapId });
      continue;
    }
    if (occupied.has(`${target.x},${target.y}`)) continue;
    occupied.delete(`${event.x},${event.y}`);
    notes.push(`문 ${event.id} (${event.x},${event.y}) → 출입구 틈 (${target.x},${target.y})`);
    event.x = target.x; event.y = target.y;
    occupied.add(`${target.x},${target.y}`);
  }
  // 문이 아닌 이벤트(인물·조사물)가 벽이나 가구 위에 놓였으면 가장 가까운 걸을 수 있는 빈 바닥으로 옮긴다.
  const isClearFloor = (x: number, y: number): boolean => {
    if (!isWalkableFloor(x, y)) return false;
    const idx = y * built.width + x;
    return (built.upperTiles[idx] ?? -1) < 0 && (built.upperOverlayTiles[idx] ?? -1) < 0;
  };
  for (const event of events) {
    if (eventTransfers(event).some((t) => t.mapId !== mapId) || isClearFloor(event.x, event.y)) continue;
    let best: { x: number; y: number } | null = null, bestDistance = Infinity;
    for (let y = 0; y < shape.height; y++) for (let x = 0; x < shape.width; x++) {
      const distance = Math.abs(x - event.x) + Math.abs(y - event.y);
      if (distance < bestDistance && isClearFloor(x, y) && !occupied.has(`${x},${y}`) && !shape.openings.some((o) => o.x === x && o.y === y)) {
        best = { x, y };
        bestDistance = distance;
      }
    }
    if (!best) continue;
    occupied.delete(`${event.x},${event.y}`);
    notes.push(`이벤트 ${event.id} (${event.x},${event.y}) → 바닥 (${best.x},${best.y})`);
    event.x = best.x; event.y = best.y;
    occupied.add(`${best.x},${best.y}`);
  }
  // 시작 위치: 다시 지은 시작 맵에서 벽·가구 위가 되면 출입구 안쪽으로.
  if (draft.startMapId === mapId && !isWalkableFloor(draft.startPos.x, draft.startPos.y)) {
    const opening = nearestOpening(shape, draft.startPos);
    const inward = opening && shape.inwardOf(opening);
    if (inward) {
      notes.push(`시작 위치 (${draft.startPos.x},${draft.startPos.y}) → 출입구 안쪽 (${inward.x},${inward.y})`);
      draft.startPos = { ...draft.startPos, x: inward.x, y: inward.y };
    }
  }
  // 들어오는 이동: 벽·가구·문 칸 위로 떨어지면 가장 가까운 출입구 안쪽 또는 층 이동 탈 자리 앞 바닥으로.
  const doorCells = new Set(events.filter((e) => eventTransfers(e).some((t) => t.mapId !== mapId)).map((e) => `${e.x},${e.y}`));
  for (const other of Object.values(draft.maps)) {
    if (other.id === mapId) continue;
    for (const event of other.events) for (const t of eventTransfers(event)) {
      if (t.mapId !== mapId) continue;
      if (other.climate?.mode === "indoor" && built.travel.length) {
        const tr = [...built.travel]
          .sort((a, b) => (Math.abs(a.x - t.x) + Math.abs(a.y - t.y)) - (Math.abs(b.x - t.x) + Math.abs(b.y - t.y)))[0]!;
        if (tr.facing) {
          // 계약 계단: 앞 칸(들어서는 칸)에 내려 계단을 등진다.
          if (t.x !== tr.x || t.y !== tr.y || t.direction !== tr.facing) {
            notes.push(`${other.id}/${event.id} 도착 (${t.x},${t.y}) → 계단 앞 (${tr.x},${tr.y}) ${tr.facing}`);
            t.x = tr.x; t.y = tr.y; t.direction = tr.facing;
          }
          continue;
        }
        const landY = isWalkableFloor(tr.x, tr.y + 1) && !doorCells.has(`${tr.x},${tr.y + 1}`) ? tr.y + 1 : tr.y;
        if (t.x !== tr.x || t.y !== landY) {
          notes.push(`${other.id}/${event.id} 도착 (${t.x},${t.y}) → 층 이동 앞 (${tr.x},${landY})`);
          t.x = tr.x;
          t.y = landY;
        }
        continue;
      }
      if (isWalkableFloor(t.x, t.y) && !doorCells.has(`${t.x},${t.y}`)) continue;
      const opening = nearestOpening(shape, t);
      const inward = opening && shape.inwardOf(opening);
      if (!inward) continue;
      notes.push(`${other.id}/${event.id} 도착 (${t.x},${t.y}) → 출입구 안쪽 (${inward.x},${inward.y})`);
      t.x = inward.x;
      t.y = inward.y;
      t.direction = inward.direction;
    }
  }
}

/**
 * 바닥만 바꾼 구역이 칸막이 없이 다른 바닥 한가운데 떠 있는가 — 둘레 바닥 칸의 절반 넘게가 구역 밖 바닥과 맞닿으면 경고.
 * 2026-10-08 조수 시험: 일본 집 1층의 다다미방·부엌이 마루 위 무늬 구역일 뿐이었다(칸막이 0).
 */
function floatingZones(input: HandInteriorInput, shape: HandInteriorShape): string[] {
  const out: string[] = [];
  for (const z of input.zones ?? []) {
    if (!z.floor || z.floor === input.floor) continue;
    // 출구에 붙은 구역(현관 타타키·문 앞 깔판)은 트여 있는 것이 맞다.
    if (shape.openings.some((o) => o.x >= z.x0 - 1 && o.x <= z.x1 + 1 && o.y >= z.y0 - 1 && o.y <= z.y1 + 1)) continue;
    const inZ = (x: number, y: number) => z.x0 <= x && x <= z.x1 && z.y0 <= y && y <= z.y1;
    let edge = 0, open = 0;
    for (let y = z.y0; y <= z.y1; y++) for (let x = z.x0; x <= z.x1; x++) {
      if (!shape.isFloor(x, y)) continue;
      const out4 = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => !inZ(x + dx!, y + dy!));
      if (!out4.length) continue;
      edge++;
      if (out4.some(([dx, dy]) => shape.isFloor(x + dx!, y + dy!))) open++;
    }
    if (edge >= 6 && open * 2 > edge) out.push(`구역 (${z.x0},${z.y0})~(${z.x1},${z.y1}) 바닥 ${z.floor} 이 칸막이 없이 다른 바닥과 ${open}칸 맞닿아 떠 있다 — 따로 쓰는 방(화실·욕실·부엌·침실)이면 rooms+connect 로 칸막이를 세운다`);
  }
  return out;
}

/**
 * 고른 칩셋 사양에 맞춰 인자를 고친다 — 2026-10-08 조수 시험(사용자가 올린 칩셋): 역할표가 바닥 floor·벽면 wall·천장 default 하나씩인데
 * 모델이 v5 이름(plank·log·wood)을 넣어 세 번 거부된 뒤 칩셋을 바꾸자고 물었다.
 *  · 바닥·벽면·천장이 하나뿐인 사양이면 모르는 id 를 그 하나로 바꾼다.
 *  · 가구·탁자·줄·단·탁상 물건이 하나도 없는 사양이면 그 목록을 빼고 방만 짓는다(경고로 알린다).
 */
function fitToSpec(args: Record<string, unknown>, S: HandInteriorSpec, tilesetId: string, notes: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = { ...args };
  const only = (table: object) => { const keys = Object.keys(table); return keys.length === 1 ? keys[0]! : undefined; };
  const fit = (table: object, label: string) => {
    const one = only(table);
    const seen = new Set<string>();
    return (id: unknown) => {
      if (!one || typeof id !== "string" || id in table) return id;
      if (!seen.has(id)) { seen.add(id); notes.push(`이 칩셋 ${label}은 "${one}" 하나뿐이라 "${id}" 대신 깔았다`); }
      return one;
    };
  };
  const floor = fit(S.floors, "바닥"), wall = fit(S.walls, "벽면"), ceiling = fit(S.ceilings, "천장");
  if ("floor" in out) out.floor = floor(out.floor);
  if ("wall" in out) out.wall = wall(out.wall);
  if ("ceiling" in out) out.ceiling = ceiling(out.ceiling);
  const fixRect = (list: unknown) => Array.isArray(list) ? list.map((z) => z && typeof z === "object"
    ? { ...z, ...("floor" in z ? { floor: floor((z as { floor?: unknown }).floor) } : {}), ...("wall" in z ? { wall: wall((z as { wall?: unknown }).wall) } : {}) } : z) : list;
  if (out.zones) out.zones = fixRect(out.zones);
  if (out.rooms) out.rooms = fixRect(out.rooms);
  const dropped: string[] = [];
  for (const [key, table, label] of [["objects", S.objects, "가구"], ["tables", S.tables, "탁자"], ["lines", S.lines, "줄"], ["daises", S.daises, "단"], ["goods", S.goods, "탁상 물건"]] as const) {
    if (!Object.keys(table).length && Array.isArray(out[key]) && (out[key] as unknown[]).length) {
      // 문(door·sidedoor)은 rooms 가 사양에서 고르므로 여기 오는 것은 모두 모델이 지은 이름이다.
      dropped.push(`${label} ${(out[key] as unknown[]).length}개`);
      delete out[key];
    }
  }
  if (dropped.length) notes.push(`칩셋 ${tilesetId} 에는 방 짓기 ${dropped.map((d) => d.split(" ")[0]).join("·")} 가 없어 ${dropped.join("·")}를 빼고 방(바닥·벽·천장)만 지었다 — 가구는 이 칩셋의 기물(list_tileset_objects → stamp_tileset_object)이나 공용 기물(list_spatial_designs kind:object → stamp_object, 그림이 이 칩셋에 이식된다)로 놓는다. 칩셋을 바꾸자고 하지 않는다`);
  return out;
}

/** 양옆 또는 위아래가 실내인 막힌 칸 수 — 칸막이의 양. */
function partitionCells(plan: readonly string[]): number {
  const open = (x: number, y: number) => (plan[y]?.[x] ?? "#") !== "#";
  let n = 0;
  for (let y = 0; y < plan.length; y++) for (let x = 0; x < plan[y]!.length; x++) {
    if (open(x, y)) continue;
    if ((open(x - 1, y) && open(x + 1, y)) || (open(x, y - 1) && open(x, y + 1))) n++;
  }
  return n;
}
const examplePlanCache = new WeakMap<object, { name: string; plan: string[] }[]>();
/** 칩셋 참고문서 예제의 build_hand_interior_room 입력 평면들(마크다운 안 ```json 의 "plan"). */
function examplePlans(project: Project, tileset: TilesetDef): { name: string; plan: string[] }[] {
  const docs = referenceOwner(project, tileset).referenceDocuments;
  if (!docs) return [];
  const hit = examplePlanCache.get(docs);
  if (hit) return hit;
  const out: { name: string; plan: string[] }[] = [];
  for (const category of docs) for (const doc of category.documents ?? []) {
    const md = doc.markdown ?? "";
    for (const m of md.matchAll(/"plan"\s*:\s*(\[[^\]]*\])/gu)) {
      try {
        const plan = JSON.parse(m[1]!) as unknown;
        // 칸막이로 방이 나뉜 예제만 — 네모 방 하나짜리 예제와는 어떤 네모 방이든 닮는다.
        if (Array.isArray(plan) && plan.length >= 3 && plan.every((r) => typeof r === "string") && partitionCells(plan as string[]) >= 5) out.push({ name: doc.name || doc.id, plan: plan as string[] });
      } catch { /* 예제가 아닌 글 */ }
    }
  }
  examplePlanCache.set(docs, out);
  return out;
}
/**
 * 참고 예제 평면을 그대로 베꼈는가(같은 크기, 칸 90% 이상 같음) — 2026-10-08 조수 시험: 「일본 집 1층」 요청에 예제 2층 단독주택 1층의
 * 평면·가구를 통째로 넣었다. 매번 같은 집이 나온다.
 */
function copiedExample(project: Project, tileset: TilesetDef, plan: readonly string[]): { name: string; same: number } | undefined {
  // 한두 줄·열을 더하거나 빼 비켜 가는 것도 잡는다(2026-10-08 시험: 경고 뒤 가로 1칸만 늘려 다시 냈다) — 위치를 ±3칸 밀어 보며
  // 두 평면 중 큰 쪽 넓이 대비 같은 칸(막힘/실내) 비율을 본다.
  const H = plan.length, W = Math.max(0, ...plan.map((r) => r.length));
  const at = (p: readonly string[], x: number, y: number) => (p[y]?.[x] ?? "#") === "#";
  let best: { name: string; same: number } | undefined;
  for (const ex of examplePlans(project, tileset)) {
    const eh = ex.plan.length, ew = Math.max(0, ...ex.plan.map((r) => r.length));
    if (Math.abs(eh - H) > 3 || Math.abs(ew - W) > 3) continue;
    const area = Math.max(W * H, ew * eh);
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
      let same = 0;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const ey = y + dy, exX = x + dx;
        if (ey < 0 || ey >= eh || exX < 0 || exX >= ew) continue;
        if (at(plan, x, y) === at(ex.plan, exX, ey)) same++;
      }
      const pct = Math.round(same * 100 / Math.max(1, area));
      if (pct >= 94 && (!best || pct > best.same)) best = { name: ex.name, same: pct };
    }
  }
  return best;
}

/** 맨 아래 출입구 틈 안쪽에 발깔개를 깐다 — 모델이 출구를 표시하지 않았을 때 「여기가 문」이 보이게. */
function withDoormat(input: HandInteriorInput, shape: HandInteriorShape): HandInteriorInput {
  if ((input.objects ?? []).some((o) => o.id === "doormat") || !HAND_INTERIOR_SPEC.objects.doormat) return input;
  const first = shape.openings.find((o) => o.y === shape.height - 1);
  const gap = first && nearestOpening(shape, first);   // 이어진 틈의 가운데 — 문 이벤트가 서는 칸과 같다.
  // 2칸 틈이면 깔개(2칸)가 틈과 딱 맞는다. 1칸 틈은 반 칸 어긋날 수밖에 없다.
  const inward = gap && shape.inwardOf(gap);
  if (!inward) return input;
  const taken = (x: number, y: number) => (input.objects ?? []).some((o) => o.x === x && o.y === y)
    || (input.tables ?? []).some((t) => x >= t.x && x < t.x + t.w && y >= t.y && y < t.y + t.h)
    || (input.lines ?? []).some((l) => (l.cells ?? []).some((c) => c.x === x && c.y === y)
      || (l.rect ? x >= Math.min(l.rect.x0, l.rect.x1) && x <= Math.max(l.rect.x0, l.rect.x1) && y >= Math.min(l.rect.y0, l.rect.y1) && y <= Math.max(l.rect.y0, l.rect.y1) : false));
  for (const x of [inward.x, inward.x - 1]) {
    if ([x, x + 1].every((cx) => shape.isFloor(cx, inward.y) && !taken(cx, inward.y))) {
      return { ...input, objects: [...(input.objects ?? []), { id: "doormat", x, y: inward.y }] };
    }
  }
  return input;
}


type XYLike = { x: number; y: number };
/**
 * 평면 바깥의 「막힌 칸('#')만 있는」 여백을 한 칸만 남기고 잘라 낸다. 좌표 인자(가구·탁자·깔개·단·물건·구역·출입구·links)는
 * 같은 만큼 옮긴다. 실측(2026-10-07 space-craft): gpt-6.1-sol 이 서재 82칸을 44×28 평면 구석에 그려 맵 대부분이 빈 공간이었다.
 */
function trimPlanMargin(args: Record<string, unknown>): { args: Record<string, unknown>; dx: number; dy: number; trimmed?: true } {
  const plan = Array.isArray(args.plan) ? (args.plan as unknown[]).filter((row): row is string => typeof row === "string") : [];
  if (plan.length === 0) return { args, dx: 0, dy: 0 };
  const W = Math.max(...plan.map((row) => row.length));
  let x0 = W, y0 = plan.length, x1 = -1, y1 = -1;
  const include = (x: unknown, y: unknown) => {
    if (typeof x !== "number" || typeof y !== "number") return;
    x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
  };
  plan.forEach((row, y) => { for (let x = 0; x < row.length; x++) if (row[x] !== "#") include(x, y); });
  if (x1 < 0) return { args, dx: 0, dy: 0 };
  const points = (value: unknown): XYLike[] => Array.isArray(value) ? value.filter((v): v is XYLike => !!v && typeof v === "object" && typeof (v as XYLike).x === "number" && typeof (v as XYLike).y === "number") : [];
  for (const key of ["objects", "goods", "start", "links"]) for (const p of points(args[key])) include(p.x, p.y);
  for (const key of ["tables", "daises"]) for (const p of points(args[key]) as (XYLike & { w?: number; h?: number })[]) { include(p.x, p.y); include(p.x + (p.w ?? 1) - 1, p.y + (p.h ?? 1) - 1); }
  for (const zone of Array.isArray(args.zones) ? args.zones as Record<string, number>[] : []) { include(zone.x0, zone.y0); include(zone.x1, zone.y1); }
  for (const line of Array.isArray(args.lines) ? args.lines as { cells?: unknown; rect?: Record<string, number> }[] : []) {
    for (const p of points(line.cells)) include(p.x, p.y);
    if (line.rect) { include(line.rect.x0, line.rect.y0); include(line.rect.x1, line.rect.y1); }
  }
  const dx = Math.max(0, x0 - 1), dy = Math.max(0, y0 - 1);
  const right = Math.min(W - 1, x1 + 1), bottom = Math.min(plan.length - 1, y1 + 1);
  if (dx === 0 && dy === 0 && right === W - 1 && bottom === plan.length - 1) return { args, dx: 0, dy: 0 };
  const shift = <T extends XYLike>(p: T): T => ({ ...p, x: p.x - dx, y: p.y - dy });
  const shiftList = (value: unknown) => Array.isArray(value) ? value.map((v) => v && typeof v === "object" && typeof (v as XYLike).x === "number" ? shift(v as XYLike) : v) : value;
  const next: Record<string, unknown> = { ...args, plan: plan.slice(dy, bottom + 1).map((row) => row.padEnd(W, "#").slice(dx, right + 1)) };
  for (const key of ["objects", "goods", "start", "links", "tables", "daises"]) if (key in args) next[key] = shiftList(args[key]);
  if (Array.isArray(args.zones)) next.zones = (args.zones as Record<string, number>[]).map((z) => ({ ...z, x0: z.x0 - dx, x1: z.x1 - dx, y0: z.y0 - dy, y1: z.y1 - dy }));
  if (Array.isArray(args.lines)) next.lines = (args.lines as { cells?: unknown; rect?: Record<string, number> }[]).map((line) => ({
    ...line,
    ...(line.cells ? { cells: shiftList(line.cells) } : {}),
    ...(line.rect ? { rect: { x0: line.rect.x0 - dx, x1: line.rect.x1 - dx, y0: line.rect.y0 - dy, y1: line.rect.y1 - dy } } : {}),
  }));
  return { args: next, dx, dy, trimmed: true };
}

/** 다른 맵에서 이 맵으로 오는 이동의 도착 칸을 같은 만큼 옮긴다(다시 짓기에서 여백을 잘랐을 때). */
function shiftIncomingTransfers(draft: Project, mapId: string, dx: number, dy: number): number {
  let moved = 0;
  const walk = (value: unknown): void => {
    if (Array.isArray(value)) { value.forEach(walk); return; }
    if (!value || typeof value !== "object") return;
    const record = value as Record<string, unknown>;
    if (record.kind === "transfer" && record.mapId === mapId && typeof record.x === "number" && typeof record.y === "number") {
      record.x = (record.x as number) - dx; record.y = (record.y as number) - dy; moved++;
    }
    Object.values(record).forEach(walk);
  };
  for (const other of Object.values(draft.maps)) if (other.id !== mapId) walk(other.events);
  return moved;
}

/** 공공시설 program 별칭 → modern_city·jp_city 공통 표준 구성. */
const PUBLIC_PROGRAM_ALIASES: Readonly<Record<string, string>> = {
  library: "central-library", "public-library": "central-library", "city-library": "central-library", 도서관: "central-library", 시립도서관: "central-library",
  "city-hall": "city-hall", cityhall: "city-hall", "town-hall": "city-hall", 시청: "city-hall", 구청: "city-hall", 市役所: "city-hall",
  bank: "bank-branch", "bank-branch": "bank-branch", 은행: "bank-branch", 銀行: "bank-branch",
  clinic: "private-clinic", "private-clinic": "private-clinic", 의원: "private-clinic", 클리닉: "private-clinic", 동네의원: "private-clinic",
};

export const BUILD_HAND_INTERIOR_ROOM_TOOL: ToolDefinition = {
  name: "build_hand_interior_room",
  mode: "write",
  domains: ["tile", "map"],
  description: "실내(집·민가·가게·상점·여관·주막·빵집·대장간·저택·교회·성 방·지하·박물관·미술관 전시실·배 안 선장실·화물칸·투기장 등)를 지어줘·만들어줘 — 한 층을 손 도트 실내 칩셋 atlas_biome_interior 로 짓는다 — 실내를 까는 유일한 도구다. "
    + "plan = 한 줄씩 문자열 배열, '#' = 막힌 칸(외벽·칸막이·건물 밖), 그 밖 문자('.') = 실내. 벽면(막힌 칸 바로 아래 두 줄)·천장 띠·바닥·그림자는 자동이다. "
    + "방을 네모 하나로만 그리지 않는다 — 바깥 모양을 ㄱ·ㄷ·T 자로 꺾거나 알코브(벽에서 들어간 자리)·칸막이로 공간을 나눈다. 꺾인 모서리 벽·천장도 자동이다(예: [\"################\",\"#......#########\",\"#......#########\",\"#..............#\",\"#..............#\",\"#######..#######\"] = ㄱ자 방). "
    + "★ 건물·방이 둘 이상인 실내(집·가게+뒤채·여관·대장간·저택·일본 집·편의점 등)는 layout 하나만 준다: layout:{program:\"house-1f\"} 또는 layout:{rooms:[{kind:\"genkan\"},{kind:\"hall\"},{kind:\"ldk\"},{kind:\"toilet\"},{kind:\"bath\"}]} — 도구가 방 크기·배치(칸막이·문·트인 곳·출구, ㄱ·ㄷ자 바깥 모양)를 짜고 방마다 제작자 예제 방의 가구 한 벌을 심는다. "
    + "공공시설은 modern_city·jp_city 모두 program 하나로 짓는다: 도서관 = program:\"library\", 시청·구청 민원실 = \"city-hall\", 은행 지점 = \"bank\", 동네 의원·클리닉 = \"clinic\" (보고 있는 맵 칩셋을 tileset 에 그대로). 일본 집 2층 = \"house-2f\", 일본 학교 = \"school-1f\"·\"school-2f\"·\"school-3f\" — 2층·3층 program 은 남쪽 외부 출구를 뚫지 않고 계단으로만 잇는다. 박물관·미술관 = program:\"museum\", 배 안 위 갑판(선장실·조타실·배 주방·선원 숙소) = \"ship\", 아래 갑판(포 갑판·화물칸·배 감방) = \"ship_hold\", 투기장·콜로세움 = \"arena\"(방 종류 museum_*·ship_*·arena_*·gladiator_cell). 호러·고딕 미술관은 build_gothic_place. "
    + "program·방 종류(roomKinds) 목록은 list_hand_interior_parts({tileset}) 인자 없이. 보고 있는 맵 크기에 맞추지 않는다 — 크기는 방 구성이 정한다. 결과 data.layout.picture 로 배치를 보고, 다른 배치는 layout.variant 1·2, 다른 견본은 layout.seed. "
    + `modern_city 공간 규모 규격(벽 포함 가로×세로 — program 은 이 크기로 서고, rooms 를 직접 짤 때도 이 규모를 따른다. 대형마트를 30×20 으로 줄이지 않는다): ${venueScaleBrief()}. `
    + "가구를 더하거나 빼려면 data.rebuild(rooms·connect·exit·objects…)를 고쳐 같은 mapId·replace:true 로 넘긴다. "
    + "직접 방 사각형을 정하려면 plan 대신 rooms(방 사각형) + connect(이을 방 쌍) + exit(출구 방)를 준다 — 칸막이·문 틈·남쪽 출구·방별 바닥/벽면·문 기물(일본 집)을 도구가 계산하고 결과 data.plan·openings(문 자리)를 돌려준다. "
    + "방마다 쓰임이 다르면(화실·욕실·화장실·부엌·침실·창고) 바닥만 zones 로 바꾸지 말고 칸막이로 나눈 방으로 만든다 — 바닥 무늬만 다른 구역은 마루 한가운데 떠 보인다. 큰 방 하나는 방 사각형 둘을 맞닿게(사이 0칸) 놓아 ㄱ·ㄷ자로 만든다. "
    + "예: rooms:[{id:\"hall\",x0:6,y0:8,x1:11,y1:14},{id:\"washitsu\",x0:1,y0:1,x1:7,y1:6,floor:\"tatami\"}], connect:[{a:\"washitsu\",b:\"hall\",door:\"fusuma-open\"}], exit:{room:\"hall\"}. "
    + "칸막이 규칙: 세로 칸막이('#' 한 열) 틈 1칸 = 문, 가로 칸막이('#' 한 줄) 틈은 그 아래 벽면 두 줄까지 통로가 된다. 맨 아래 줄의 '.' 틈이 실제 출구이며 결과 exits[].x,y로 반환한다. start는 통행 검사 출발점이다. "
    + "거리 문에 연결할 남쪽 출구 폭은 기본 1칸이다. 한 칸 문이면 마지막 줄을 '####.#####'처럼 한 칸만 연다. '..'로 두 칸을 열면 거부한다. start를 한 칸 지정해도 실제 열린 폭은 줄지 않는다. 넓은 외부 문·대문에 맞출 때만 exitWidth를 명시하며 실제 문 폭과 같아야 한다. "
    + "floor·wall = list_hand_interior_parts 의 바닥·벽면 id, zones 로 방마다 바꾼다(찬 창고·손질터=wetstone, 가게=plank/terra, 부엌=ktile, 작업장=earth, 침실=dplank+깔개). "
    + "objects[].id = v5 가구 id(좌표 = 발밑 왼쪽 위 칸; wall 종류는 북쪽 벽면 바로 아래 첫 바닥 줄, hang 은 벽면 윗줄 y — 천문대 dome 조각(dome slit tall·dome rib·dome cornice·dome vault)은 그 위 천장 줄 y — 관측 틈이 지붕까지 트여 보이려면 plan 맨 위에 '#' 4줄 + 3칸마다 한 줄씩 오르는 계단식 북벽, dome vault(30×8) @(왼벽 다음 칸, 0) 과 dome slit tall @(그 x+14, 3) — 칸 조각 dome cornice·shell 은 1배에서 벽 위 말뚝으로 읽힌다). tables = 탁자 자동 타일(dining·work·desk·display·counter·kcounter·sideboard·tea·felt), "
    + "lines = 깔개·울타리·창살·선로·제단 난간(칸 목록 또는 rect), daises = 밟는 단, goods = 탁상 물건(윗면 있는 가구 칸 위). "
    + "천문대·의식실·성소처럼 주인공 물건이 있는 큰 방: 주인공은 하나(작은 것을 여러 개 흩뿌려 크기를 대신하지 않는다) — 큰 그림을 먼저 쓴다: great telescope + 북벽 dome slit tall, great stone brazier(+ lit), star lens, star seal; 큰 그림이 없으면 단 위 하나 + 마법진/깔개 축 + 양옆 짝으로 키운다. 돌 단 맨 아랫줄에 dais riser stone L/가운데/R + dais steps stone(단 위 바닥 무늬는 빌더가 단 위에 얹는다), 지붕 틈·천창을 평면 홈으로 흉내 내지 않는다, 알코브마다 쓰임 하나 + 그 가구 세 점 이상, 한 건물 = 벽면 재질 하나 — 참고문서 hand-interior-v5-rules 「주인공 물건이 있는 큰 방」. "
    + "결과는 통행 BFS(출입구에서 모든 바닥·가구 옆 칸)와 오류를 돌려준다 — error 가 있으면 맵을 만들지 않는다. 층 사이 계단은 links 로 이동 이벤트를 단다. 외부 집 문과 연결하는 작업은 exits의 실제 좌표에 playerTouch 이동을 연결한다. 출구 그림만으로는 이동 이벤트가 생기지 않는다. "
    + "칩셋은 사용자가 보고 있는 맵의 칩셋을 먼저 쓴다 — 그 칩셋에 역할표가 있으면 tileset 에 그 id 를 넣는다(사용자가 올린 칩셋의 바닥·벽면·천장 id 는 floor·wall·default 하나씩, list_hand_interior_parts({tileset}) 로 확인). 사용자가 올린 칩셋에 가구가 없으면 방만 짓고 가구는 그 칩셋 기물로 놓는다 — 가구 때문에 다른 칩셋으로 바꾸자고 하지 않는다. "
    + "손 도트 v5(atlas_biome_interior)로 지을 때는 먼저 list_tileset_references({tilesetId:\"atlas_biome_interior\"}) 의 조립법(정답 배열·예제 그림)을 읽는다. 참고 예제 평면을 그대로 베끼지 않는다 — 예제는 문법이고, 방 수·크기·배치는 요청에 맞춰 새로 짠다. "
    + "일본 현대 집(현관 타타키·화실 다다미·LDK·욕실·화장실·아파트 원룸)은 tileset:\"jp_city\" 로 짓는다 — 가구·바닥·벽면 id 는 list_hand_interior_parts({tileset:\"jp_city\"}) 로 찾고, 조립법은 list_tileset_references({tilesetId:\"jp_city\"}) 의 일본 실내 용도를 읽는다. "
    + "jp_city 방문(door 종류: 열린 양식 문·화장실 문·후스마·쇼지)은 objects 에 넣되 좌표 = 가로 칸막이('#' 줄)의 1칸 틈 칸 — 틈 위 인방과 아래 벽면 높이 문틀을 그리고 통로는 막지 않는다. 세로 칸막이('#' 열) 3줄 틈에는 옆문(sidedoor 종류)을 그 통로 칸(셋째 줄)에 단다.",
  parameters: {
    type: "object",
    properties: withHandInteriorEdit({
      tileset: TILESET_PARAM,
      mapId: { type: "string", description: "새 맵 id(생략 시 자동). 이미 있는 같은 칩셋 실내 맵이면 replace:true 로 다시 짓는다." },
      name: { type: "string", description: "맵 이름" },
      replace: { type: "boolean", description: "같은 칩셋의 기존 맵을 통째로 다시 짓기(기본 false)" },
      plan: { type: "array", items: { type: "string" }, description: "평면 — 줄마다 같은 길이, '#' 막힘 · '.' 실내. 방이 여럿이면 plan 대신 rooms 를 준다." },
      layout: { type: "object", description: "건물·여러 방 실내는 이것을 쓴다 — 방 구성만 주면 도구가 방 배치(칸막이·문·출구)를 짜고 방마다 제작자 예제 방의 가구 한 벌을 심는다. program = 예제 구성 id(list_hand_interior_parts 인자 없이 → data.programs: house-1f·bakery·inn…, 공공시설 library·city-hall·bank·clinic 은 modern_city·jp_city 공통) 또는 rooms = 방 종류 목록(roomKinds: genkan·hall·ldk·kitchen·toilet·bath·washitsu·bedroom… / bakery_shop·forge·tavern·inn_room…, w·h 생략하면 견본 크기). plan·rooms 와 같이 주지 않는다.",
        properties: {
          program: { type: "string", description: "예제 구성 id — 공공시설: library(도서관)·city-hall(시청)·bank(은행)·clinic(의원) / 일본 집·학교 층: house-1f·house-2f·school-1f·school-2f·school-3f" },
          rooms: { type: "array", items: { type: "object", properties: { id: { type: "string" }, kind: { type: "string" }, w: { type: "integer", minimum: 2 }, h: { type: "integer", minimum: 4, description: "세로(벽면 두 줄 포함) — 방은 5 이상, 복도·화장실은 4" },
            floor: { type: "string", enum: FLOOR_IDS }, wall: { type: "string", enum: WALL_IDS } }, required: ["kind"], additionalProperties: false } },
          entrance: { type: "string", description: "출구 방 id 또는 종류(생략 시 현관·입구·복도·가게 순)" },
          prefer: { type: "array", description: "문으로 바로 잇고 싶은 방 쌍 — a·b 는 방 id 또는 종류", items: PAIR },
          open: { type: "array", description: "칸막이 없이 트고 싶은 방 쌍(현관↔복도·부엌↔거실은 기본으로 튼다)", items: PAIR },
          variant: { type: "integer", minimum: 0, description: "배치 후보 번호(0 = 가장 좋은 것). 결과가 마음에 안 들면 1·2·3 으로 다시 짓는다" },
          styleVariant: { type: "string", enum: ["A", "B", "C", "D"], description: "구조·배치·바닥/벽 색감 변형(A=기본, B=동↔서 반전·웜 우드, C=광폭 오픈·쿨 스톤, D=비대칭 코너·다크 헤링본)" },
          seed: { type: "integer", minimum: 1, description: "다른 견본·다른 배치 묶음" },
          furnish: { type: "boolean", description: "방마다 견본 가구를 심는다(기본 true). false 면 빈 방만" },
          maxWidth: { type: "integer", minimum: 6 }, maxHeight: { type: "integer", minimum: 6 },
        }, additionalProperties: false },
      rooms: { type: "array", description: "방 사각형 목록(plan 대신) — 바닥 칸 x0..x1·y0..y1(맨 위 두 줄은 벽면), 방 밖은 전부 벽. 사이 1칸 = 칸막이, 맞닿음 = 트인 한 방(ㄱ·ㄷ자), 2칸 이상 = 두꺼운 벽. floor·wall 은 그 방 바닥·벽면.",
        items: { type: "object", properties: { id: { type: "string" }, x0: { type: "integer", minimum: 1 }, y0: { type: "integer", minimum: 1 }, x1: { type: "integer" }, y1: { type: "integer" },
          floor: { type: "string", enum: FLOOR_IDS }, wall: { type: "string", enum: WALL_IDS } }, required: ["id", "x0", "y0", "x1", "y1"], additionalProperties: false } },
      connect: { type: "array", description: "1칸 칸막이를 사이에 둔 두 방을 문으로 잇는다 — 위·아래 방은 1칸 틈, 왼·오른 방은 3줄 틈(셋째 줄이 통로). at = 문 자리(가로 칸막이 x · 세로 칸막이 통로 y), door = 문 기물 id(일본 집: fusuma-open·door-open-toilet·door-side-sliding…, none = 틈만). open = 칸막이를 걷어 트기(span 을 주면 위·아래 방 사이 span 칸만 튼다 — 아래 방 북쪽 벽면이 남는다).",
        items: { type: "object", properties: { a: { type: "string" }, b: { type: "string" }, at: { type: "integer" }, door: { type: "string" }, open: { type: "boolean" }, span: { type: "integer", minimum: 1 } }, required: ["a", "b"], additionalProperties: false } },
      exit: { type: "object", description: "남쪽 출구 — room(맨 아래 줄에 닿은 방 id)·x(생략 시 그 방 가운데)·width(기본 1). 생략하면 가장 아래 방.",
        properties: { room: { type: "string" }, x: { type: "integer" }, width: { type: "integer", minimum: 1 } }, required: ["room"], additionalProperties: false },
      exitWidth: { type: 'integer', minimum: 1, maximum: 120, description: '남쪽 출구의 실제 가로 폭. 기본 1칸. 외부 문 폭과 일치해야 하며 한 칸 문에 두 칸 출구를 연결하지 않는다.' },
      floor: { type: "string", enum: FLOOR_IDS, description: "기본 바닥 id (사용자가 만든 역할표 칩셋은 floor)" },
      wall: { type: "string", enum: WALL_IDS, description: "기본 벽면 id (사용자가 만든 역할표 칩셋은 wall)" },
      ceiling: { type: "string", enum: CEILING_IDS, description: "천장 색" },
      zones: { type: "array", items: { type: "object", properties: { x0: { type: "integer" }, y0: { type: "integer" }, x1: { type: "integer" }, y1: { type: "integer" }, floor: { type: "string", enum: FLOOR_IDS }, wall: { type: "string", enum: WALL_IDS } }, required: ["x0", "y0", "x1", "y1"], additionalProperties: false } },
      objects: { type: "array", items: { type: "object", properties: { id: { type: "string" }, x: { type: "integer" }, y: { type: "integer" } }, required: ["id", "x", "y"], additionalProperties: false } },
      tables: { type: "array", items: { type: "object", properties: { style: { type: "string" }, x: { type: "integer" }, y: { type: "integer" }, w: { type: "integer", minimum: 1 }, h: { type: "integer", minimum: 1 } }, required: ["style", "x", "y", "w", "h"], additionalProperties: false } },
      lines: { type: "array", items: { type: "object", properties: {
        id: { type: "string" },
        cells: { type: "array", items: XY },
        rect: { type: "object", properties: { x0: { type: "integer" }, y0: { type: "integer" }, x1: { type: "integer" }, y1: { type: "integer" } }, required: ["x0", "y0", "x1", "y1"], additionalProperties: false },
      }, required: ["id"], additionalProperties: false } },
      daises: { type: "array", items: { type: "object", properties: { id: { type: "string" }, x: { type: "integer" }, y: { type: "integer" }, w: { type: "integer", minimum: 1 }, h: { type: "integer", minimum: 1 } }, required: ["id", "x", "y", "w", "h"], additionalProperties: false } },
      goods: { type: "array", items: { type: "object", properties: { id: { type: "string" }, x: { type: "integer" }, y: { type: "integer" } }, required: ["id", "x", "y"], additionalProperties: false } },
      start: { type: "array", items: XY, description: "출입구 칸(생략 시 맨 아래 줄 실내 칸). 위층은 계단 도착 칸." },
      links: { type: "array", description: "이동 이벤트(계단·문): 이 맵의 x,y 에 닿으면 toMapId 의 toX,toY 로", items: { type: "object", properties: {
        x: { type: "integer" }, y: { type: "integer" }, toMapId: { type: "string" }, toX: { type: "integer" }, toY: { type: "integer" }, direction: { type: "string", enum: ["up", "down", "left", "right"] },
      }, required: ["x", "y", "toMapId", "toX", "toY"], additionalProperties: false } },
    }),
    // floor·wall 은 layout 없이 plan·rooms 로 직접 지을 때만 필수다 — 도구가 run() 에서 확인한다(layout 이면 방 견본이 정한다).
    required: [],
    additionalProperties: false,
  },
  invalidArgsExample: { name: "빵집", plan: ["##########", "#....#####", "#....#####", "#....#####", "#........#", "#........#", "####.#####"], floor: "plank", wall: "plaster", objects: [{ id: "bread oven", x: 1, y: 3 }] },
  run(draft, rawArgs): ToolExecResult {
    // edit(고친 곳만)는 조수 실행기가 앞선 짓기 인자에 얹어 전체 인자로 바꿔 넘긴다(editor/handInterior/edit.ts). 여기까지 왔으면 얹을 짓기가 없었다.
    if ((rawArgs as { edit?: unknown }).edit) throw new ToolError("edit(고친 곳만)는 이 실행에서 같은 mapId 로 성공한 짓기가 있어야 쓴다 — 이번에는 전체 인자(plan·objects…)로 부른다.", { code: "edit-without-base" });
    const trimmed = trimPlanMargin(rawArgs);
    let args = trimmed.args;
    const tilesetId = pickTileset(draft, args);
    const spec = specFor(draft, tilesetId);
    const fitNotes: string[] = [];
    args = fitToSpec(args, spec, tilesetId, fitNotes);
    // layout(방 구성) → 배치 후보 중 하나를 rooms·connect·exit 로 바꾸고, 뒤에서 방마다 견본 가구를 심는다.
    const mapName = typeof args.name === "string" && args.name.trim()
      ? args.name.trim()
      : (typeof args.mapId === "string" ? draft.maps[args.mapId]?.name ?? "" : "");
    const briefText = [draft.gameDesignBrief?.summary, draft.gameDesignBrief?.interview?.concept, draft.gameDesignBrief?.interview?.notes].filter(Boolean).join("\n");
    if (tilesetId === "modern_campus") {
      const isSchool = /교실|학생회|고등학교|중학교|학급/u.test(mapName);
      const isUniversity = !isSchool && /대강의실|강의실|전공|세미나|대학|캠퍼스/u.test(`${mapName}\n${briefText}`);
      const campusProgram = isUniversity ? "university-lecture-wing" : isSchool ? "school-class-wing" : undefined;
      // 맵 이름은 «제안» 만 한다 — 명시한 layout.program·plan 을 이름으로 갈아끼우지 않는다(2026-10-21 「첫사랑」:
      // 이름의 「승강장」이 계획한 평면을 무작위 씨앗 청사진으로 바꿔 버렸다). 이름이 표준 구성과 맞으면 알리기만 한다.
      if (args.layout && typeof args.layout === "object") {
        const lbag = args.layout as Record<string, unknown>;
        if (lbag.program === "school-class-wing" && isUniversity) {
          fitNotes.push(`이름이 대학 강의동과 맞는다 — 대학 표준 구성을 원하면 layout:{program:"university-lecture-wing"} 로 다시 부른다(요청한 "school-class-wing" 으로 지었다)`);
        }
      } else if (campusProgram && Array.isArray(args.plan) && args.plan.length > 0) {
        fitNotes.push(`이름이 "${campusProgram}" 표준 구성과 맞는다 — 준 평면대로 지었다. 다구역 표준 배치를 원하면 plan 을 빼고 layout:{program:"${campusProgram}"} 로 부른다`);
      }
    } else if (tilesetId === "modern_city" || tilesetId === "jp_city") {
      const matchedProgram =
        /백화점|면세점|아울렛|부티크\s*몰|department\s*store/iu.test(mapName) ? "department-store"
        : /대형\s*마트|슈퍼마켓|할인점|하이퍼마켓|식자재\s*마트|supermarket|mart/iu.test(mapName) ? "supermarket-mart"
        : /지하철|전철역|승강장|개찰구|대합실|subway|station/iu.test(mapName) ? "subway-station"
        : /종합\s*병원|대학\s*병원|병동|입원실|응급실|hospital|ward/iu.test(mapName) ? "hospital-ward"
        : /의원|클리닉|개인\s*병원|진찰실|내과|소아과|이비인후과|정형외과|가정의학과|clinic/iu.test(mapName) ? "private-clinic"
        : /은행|창구.*금고|금고.*창구|금융\s*지점|bank/iu.test(mapName) ? "bank-branch"
        : /시청|구청|주민센터|동사무소|민원실|관공서|city\s*hall|ward\s*office/iu.test(mapName) ? "city-hall"
        : !/학교|3층/u.test(mapName) && /중앙\s*도서관|시립\s*도서관|공공\s*도서관|도서관|열람실|library/iu.test(mapName) ? "central-library"
        : tilesetId === "modern_city" && /초등학교|국민학교|elementary\s*school/iu.test(mapName) ? "elementary-school"
        : tilesetId === "modern_city" && /고등학교|중학교|high\s*school/iu.test(mapName) ? "high-school"
        : tilesetId === "jp_city" && /학교.*3층|3층.*교실|음악실.*과학실|과학실.*도서실|특별실.*3층|school[\s_-]*3f/iu.test(mapName) ? "school-3f"
        : tilesetId === "jp_city" && /학교.*2층|2층.*교실|교실.*2층|학급.*2층|school[\s_-]*2f/iu.test(mapName) ? "school-2f"
        : tilesetId === "jp_city" && /학교.*1층|1층.*교무실|교무실.*보건실|신발장.*교무실|昇降口|school[\s_-]*1f/iu.test(mapName) ? "school-1f"
        : tilesetId === "jp_city" && /(집|주택|민가|가정집).*2층|2층.*(침실|아이방|서재|발코니)|house[\s_-]*2f/iu.test(mapName) ? "house-2f"
        : tilesetId === "jp_city" && /(집|주택|민가|가정집).*1층|1층.*(거실|화실|현관|LDK)|단독주택\s*1층|house[\s_-]*1f/iu.test(mapName) ? "house-1f"
        : /영화관|시네마|상영관|오락실|아케이드|게임\s*센터|복합\s*문화|cinema|arcade/iu.test(mapName) ? "cinema-arcade"
        : /레스토랑|다이닝\s*바|비스트로|스테이크\s*하우스|재즈\s*바|라운지\s*바|와인\s*바|restaurant|dining\s*bar/iu.test(mapName) ? "restaurant-bar"
        : /미술관|박물관|전시실|전시관|갤러리|아트\s*센터|museum|gallery/iu.test(mapName) ? "museum-gallery"
        : tilesetId === "modern_city" && /로비|1층\s*홀/u.test(mapName) ? "lobby"
        : tilesetId === "modern_city" && /오피스|사무실|사무층|마케팅|디자인팀|개발팀|기획팀|본사\s*[2-9]층/u.test(mapName) ? "office-floor"
        : undefined;
      // 명시한 layout.program·plan 은 이름이 무엇이든 그대로 짓는다(위 캠퍼스와 같은 규칙). 이름이 다른 표준 구성과 맞으면 알리기만 한다.
      if (args.layout && typeof args.layout === "object") {
        const lbag = args.layout as Record<string, unknown>;
        if (matchedProgram && typeof lbag.program === "string" && lbag.program !== matchedProgram && !lbag.rooms) {
          fitNotes.push(`이름이 "${matchedProgram}" 표준 구성과 맞는다 — 요청한 "${lbag.program}" 으로 지었다. 바꾸려면 layout:{program:"${matchedProgram}"} 로 다시 부른다`);
        }
      } else if (matchedProgram && Array.isArray(args.plan) && args.plan.length > 0 && typeof args.plan[0] === "string") {
        fitNotes.push(`이름이 "${matchedProgram}" 표준 구성과 맞는다 — 준 평면대로 지었다. 표준 다구역 배치를 원하면 plan 을 빼고 layout:{program:"${matchedProgram}"} 로 부른다`);
      }
      // 공공시설 짧은 이름(library·city-hall·bank·clinic, 한국어 이름)은 두 칩셋 모두 같은 표준 구성으로 맞춘다 — 2026-10-19 RCA r2: jp_city 에서 "library" 가
      // 「방 구성이 없다」로 거부돼 조수가 수백 줄 plan 을 손으로 짰다.
      if (args.layout && typeof args.layout === "object") {
        const lbag = args.layout as Record<string, unknown>;
        const raw = typeof lbag.program === "string" ? lbag.program.trim() : "";
        const canon = raw && !programKinds(tilesetId, raw) ? PUBLIC_PROGRAM_ALIASES[raw.toLowerCase()] : undefined;
        if (canon && programKinds(tilesetId, canon)) args = { ...args, layout: { ...lbag, program: canon } };
      }
    }
    let picked: { c: LayoutCandidate; variant: number; variants: number; furnish: boolean } | undefined;
    // 청사진 구성기가 있는 공간(오피스 로비·대학 강의동·왕성 알현실·백화점)은 견본 한 벌 대신 청사진 규칙으로 매번 새로 짠다 —
    // 2026-10-18 사용자 반려 「프리셋을 그대로 깔지 말고 AI 가 참고해서, 똑같이 깔지 말고」. 방 목록을 직접 준 layout 은 그대로 따른다.
    let blueprint: BlueprintInteriorArgs | undefined;
    if (args.layout && typeof args.layout === "object") {
      const req = args.layout as LayoutRequest & { seed?: number };
      // 청사진 출구는 한 칸이다 — 두 칸 출구(exitWidth:2)를 요구한 호출은 견본 배치를 쓴다.
      if (typeof req.program === "string" && !req.rooms?.length && ((args.exitWidth as number | undefined) ?? 1) === 1) {
        const seed = typeof req.seed === "number" ? req.seed : Math.floor(Math.random() * 10_000);
        blueprint = composeInteriorBlueprint(tilesetId, req.program, spec, `${mapName}\n${briefText}`, seed);
        if (blueprint) {
          const { layout: _l, plan: _p, rooms: _r, connect: _c, exit: _e, ...rest } = args as Record<string, unknown>;
          const { areas: _a, decisions, tileset: _t, ...built } = blueprint;
          args = { ...rest, ...built } as typeof args;
          fitNotes.push(`청사진 "${req.program}"(씨앗 ${seed})으로 새로 짰다 — ${decisions.join(" / ")}`);
        }
      }
    }
    if (!blueprint && args.layout && typeof args.layout === "object") {
      // 선택 칸을 다 채우는 모델이 layout 과 plan·rooms·connect·exit 를 함께 보낸다(2026-10-12 jp_city 도그푸딩: 같은 호출 4연속 거절).
      // layout 이 방 배치를 짜므로 layout 을 따르고, 같이 온 배치 칸은 버린 채 알린다.
      if (args.plan || args.rooms || args.connect || args.exit) {
        // 스키마의 빈 기본값(plan:[]·rooms:[]·exit:{room:""})만 채워 보내는 모델도 있다(2026-10-14 modern_city 실조수: 빈 칸 경고를 보고 방을 다시 지으려다 연결을 깼다) — 빈 값은 버려도 알리지 않는다.
        const meaningful = (value: unknown): boolean =>
          Array.isArray(value) ? value.length > 0
            : value && typeof value === "object" ? Object.values(value as Record<string, unknown>).some((v) => typeof v === "string" ? v.trim() !== "" : Array.isArray(v) ? v.length > 0 : false)
              : value !== undefined && value !== null && value !== "";
        const dropped = ["plan", "rooms", "connect", "exit"].filter((key) => meaningful((args as Record<string, unknown>)[key]));
        const { plan: _plan, rooms: _rooms, connect: _connect, exit: _exit, ...kept } = args as Record<string, unknown>;
        args = kept as typeof args;
        if (dropped.length) fitNotes.push(`layout 이 방 배치를 짜므로 같이 온 ${dropped.join("·")} 는 버리고 layout 대로 지었다(plan·rooms 를 직접 주려면 layout 을 빼라)`);
      }
      const req = args.layout as LayoutRequest & { variant?: number; furnish?: boolean };
      const variant = Math.max(0, Math.floor(req.variant ?? 0));
      let cands: LayoutCandidate[];
      try { cands = layoutCandidates(tilesetId, req, spec, Math.max(4, variant + 1)); }
      catch (error) { if (error instanceof LayoutError) throw new ToolError(error.message, { code: "layout-failed" }); throw error; }
      const c = cands[Math.min(variant, cands.length - 1)]!;
      picked = { c, variant: Math.min(variant, cands.length - 1), variants: cands.length, furnish: req.furnish !== false };
      const { layout: _l, ...rest } = args;
      args = { ...rest, rooms: c.rooms, connect: c.connect, exit: c.exit };
    }
    // floor·wall 은 방에 따로 없는 칸의 바탕이다. layout·rooms 면 방 견본/방 목록이 정하므로 안 줘도 된다(2026-10-16 실조수: program 만 줘도 필수였다) —
    // 가장 많이 쓰인 방 바닥·벽면을 바탕으로 쓰고 알린다. plan 으로 직접 지을 때만 필수.
    {
      const bag = args as unknown as Record<string, unknown>;
      const roomList = (Array.isArray(bag.rooms) ? bag.rooms : []) as ReadonlyArray<{ floor?: string; wall?: string }>;
      const baseOf = (key: "floor" | "wall"): string | undefined => {
        const counts = new Map<string, number>();
        for (const room of roomList) { const id = room?.[key]; if (typeof id === "string" && id) counts.set(id, (counts.get(id) ?? 0) + 1); }
        return [...counts].sort((x, y) => y[1] - x[1])[0]?.[0] ?? (roomList.length ? Object.keys(key === "floor" ? spec.floors : spec.walls)[0] : undefined);
      };
      for (const key of ["floor", "wall"] as const) {
        if (typeof bag[key] === "string" && bag[key]) continue;
        const base = baseOf(key);
        if (!base) throw new ToolError("floor·wall(바탕 바닥·벽면 id)을 준다 — layout:{program|rooms} 이나 rooms 로 방 구성을 주면 생략해도 된다. id 는 list_hand_interior_parts 로 본다.", { code: "floor-wall-missing" });
        bag[key] = base;
        fitNotes.push(`${key} 를 안 줘서 방들의 ${key === "floor" ? "바닥" : "벽면"} "${base}" 을 바탕으로 썼다`);
      }
    }
    // rooms(방 사각형 + 이을 쌍)면 평면·칸막이·문 틈·방별 바닥/벽면·문 기물을 계산해 plan 으로 바꾼다.
    let composed: ReturnType<typeof withComposedRooms>["composed"];
    try {
      const c = withComposedRooms(args as never, spec);
      args = c.input as unknown as typeof args; composed = c.composed;
    } catch (error) {
      if (error instanceof HandInteriorError) throw new ToolError(error.message, { code: error.code });
      throw error;
    }
    if (!Array.isArray(args.plan) || !args.plan.length) throw new ToolError("plan(평면 글자) 또는 rooms(방 사각형 목록) 중 하나를 준다", { code: "plan-missing" });
    const exitWidth = (args.exitWidth as number | undefined) ?? (picked?.c.exit.width === 0 ? 0 : 1);
    const exits = Array.isArray(args.plan) && args.plan.every(row => typeof row === 'string')
      ? handInteriorPlanExits(args.plan as string[]) : [];
    const mismatch = exitWidth === 0 ? undefined : exits.find(exit => exit.width !== exitWidth);
    if (mismatch) throw new ToolError(`남쪽 출구 (${mismatch.x},${mismatch.y})가 가로 ${mismatch.width}칸으로 열려 있지만 문 폭은 ${exitWidth}칸입니다. 마지막 줄의 '.' 틈을 ${exitWidth}칸으로 고치세요. start는 통행 검사 출발점이며 출구 폭을 정하지 않습니다. 한 칸 문을 두 칸 출구에 연결하지 않습니다.`, { code: 'interior-exit-width', x: mismatch.x, y: mismatch.y });
    const tileset = ensureInteriorTileset(draft, tilesetId);
    if (!tileset) throw new ToolError(`타일셋 ${tilesetId} 이 없다`, { code: "tileset-not-found" });
    const shape = handInteriorShapeFromPlan((args as unknown as HandInteriorInput).plan ?? []);
    // 틈=문 맞춤·문 앞 매트는 손 도트 실내(판타지) 문법이다. 일본 집·스토어 칩셋은 문을 기물(door·sidedoor)로 단다.
    const fitsGapDoors = tilesetId === HAND_INTERIOR_TILESET_ID;
    let input = fitsGapDoors ? withDoormat(args as unknown as HandInteriorInput, shape) : args as unknown as HandInteriorInput;
    let furnished: ReturnType<typeof furnishRooms>["perRoom"] | undefined;
    if (picked?.furnish && composed) {
      const f = furnishRooms(input, picked.c.rooms, composed, tilesetId, tileset, spec, picked.c.styleVariant ?? "A");
      input = f.input; furnished = f.perRoom;
    }
    let built;
    try { built = buildHandInteriorLayers(input, tileset, spec); }
    catch (error) {
      if (error instanceof HandInteriorError) throw new ToolError(error.message, { code: error.code });
      throw error;
    }
    const errors = built.issues.filter((i) => i.severity === "error");
    if (errors.length) {
      throw new ToolError(`실내를 짓지 않았다 — 오류 ${errors.length}건: ${errors.slice(0, 8).map((e) => e.message).join(" / ")}${errors.length > 8 ? " …" : ""}`, { code: errors[0]!.code });
    }
    const soleStartMap = Object.keys(draft.maps).length === 1 ? draft.maps[draft.startMapId] : undefined;
    const reuseUntouchedStart = (!args.mapId || typeof args.mapId !== "string" || !args.mapId.trim())
      && soleStartMap
      && isUntouchedMap(soleStartMap)
      && (soleStartMap.tilesetId === tilesetId || soleStartMap.id === "map_blank_start");
    const mapId = typeof args.mapId === "string" && args.mapId.trim()
      ? args.mapId.trim()
      : reuseUntouchedStart ? soleStartMap!.id : genId("map");
    const existing = draft.maps[mapId];
    const existingUntouched = existing ? isUntouchedMap(existing) : false;
    if (existing && !existingUntouched && !(args.replace === true && existing.tilesetId === tilesetId)) {
      throw new ToolError(existing.tilesetId === tilesetId
        ? `맵 ${mapId} 가 이미 있다 — 다시 지으려면 replace:true`
        : roomSpecOf(draft.tilesets[existing.tilesetId])
          ? `맵 ${mapId} 는 칩셋 ${existing.tilesetId}(${draft.tilesets[existing.tilesetId]!.name}) 맵이다 — 이 맵에 지으려면 tileset:"${existing.tilesetId}"·replace:true 로 부른다(그 칩셋 바닥·벽면 id 는 list_hand_interior_parts({tileset:"${existing.tilesetId}"})). 다른 칩셋으로 지으려면 새 mapId`
          : `맵 ${mapId} 는 다른 칩셋(${existing.tilesetId}) 맵이다 — 새 mapId 로 짓는다`, { code: "map-exists", mapId });
    }
    const name = typeof args.name === "string" && args.name.trim() ? args.name.trim() : existing?.name ?? "실내";
    const links = Array.isArray(args.links) ? (args.links as { x: number; y: number; toMapId: string; toX: number; toY: number; direction?: string }[]) : [];
    // 아직 없는 맵을 가리키는 이동은 커밋 무결성 검사가 일반 오류로 거부한다 — 층 여럿을 짓는 순서를 알려 주며 먼저 거부한다(2026-10-07 조수 시험: 1층을 2층 links 와 함께 먼저 지으려다 거부).
    const missing = links.filter((l) => l.toMapId !== mapId && !draft.maps[l.toMapId]);
    if (missing.length) {
      throw new ToolError(`links 의 toMapId ${[...new Set(missing.map((l) => l.toMapId))].join(", ")} 맵이 아직 없다 — 층이 여럿이면 ① 한 층을 links 없이 짓고 ② 다른 층을 그 층으로 가는 links 와 함께 짓고 ③ 처음 층을 같은 mapId·replace:true 로 links 를 넣어 다시 짓는다(또는 두 층을 다 지은 뒤 create_transfer_pair). 도착 칸(toX,toY)은 그 맵에서 걸을 수 있는 바닥이어야 한다.`, { code: "link-target-missing" });
    }
    const events: GameEvent[] = [
      ...structuredClone(existing?.events ?? []).filter((e) => !e.id.startsWith(`${mapId}-link-`)),
      ...links.map((l, i) => transfer(mapId, l.x, l.y, { mapId: l.toMapId, x: l.toX, y: l.toY, direction: l.direction }, i)),
    ];
    // 여백을 잘라 다시 지으면 이 맵의 기존 이벤트·시작 위치·들어오는 이동을 같은 만큼 먼저 옮긴다 — 그다음 문 맞춤이 남은 어긋남을 고친다.
    if (trimmed.trimmed && existing) {
      for (const event of events) if (!event.id.startsWith(`${mapId}-link-`)) { event.x -= trimmed.dx; event.y -= trimmed.dy; }
      if (draft.startMapId === mapId) draft.startPos = { ...draft.startPos, x: draft.startPos.x - trimmed.dx, y: draft.startPos.y - trimmed.dy };
      shiftIncomingTransfers(draft, mapId, trimmed.dx, trimmed.dy);
    }
    const doorNotes: string[] = [];
    // 문 맞춤은 모든 역할표 칩셋에 쓴다(깔개만 v5 전용) — 2026-10-14 modern_city 실조수: 거리와 이은 병동을 작게 다시 지으려 하자
    // 거리의 들어오는 이동이 벽·밖을 가리켜 커밋이 두 번 거부됐고, 조수는 연결 이벤트를 지우다 멈췄다.
    fitDoorsToPlan(draft, mapId, events, shape, built, tileset, doorNotes);
    const map: GameMap = {
      ...(existing ?? {}),
      id: mapId, name, width: built.width, height: built.height, tilesetId, tileSize: tileset.tileSize,
      lowerTiles: built.lowerTiles, upperTiles: built.upperTiles, lowerOverlayTiles: built.lowerOverlayTiles, upperOverlayTiles: built.upperOverlayTiles,
      events, climate: { mode: "indoor" },
    } as GameMap;
    delete (map as Partial<GameMap>).lowerTileStacks; delete (map as Partial<GameMap>).upperTileStacks; delete (map as Partial<GameMap>).shadowBits; delete (map as Partial<GameMap>).relief;
    // layout(program·rooms)으로 짠 방은 방마다 제작자 예제 가구 한 벌을 심은 배치다 — 방 이름표(composed-layout)를 달아 배치 품질 권고(빈 바닥 → 줄여라)가
    // 이 배치를 손으로 다시 짜게 하지 않는다. 2026-10-14 gemini-4-argon 실조수: 「학교 복도와 신발장」을 school-1f 로 잘 지은 뒤 권고를 받고
    // 35×16 → 22×16 손 평면·손 가구로 다시 지어 견본 배치를 버렸다(복도는 원래 비어 있는 동선이다).
    if (picked) {
      map.locations = (map.locations ?? []).filter((l) => !(l.tags ?? []).includes(HAND_LAYOUT_ROOM_TAG));
      for (const r of picked.c.rooms) addMapLocation(map, { name: r.kind, x: r.x0, y: r.y0, w: r.x1 - r.x0 + 1, h: r.y1 - r.y0 + 1, note: "layout 으로 짠 방(견본 가구 한 벌)", tags: [HAND_LAYOUT_ROOM_TAG, COMPOSED_LAYOUT_TAG] });
    }
    if (blueprint) {
      map.locations = (map.locations ?? []).filter((l) => !(l.tags ?? []).includes(HAND_LAYOUT_ROOM_TAG));
      for (const a of blueprint.areas) addMapLocation(map, { name: a.name, x: a.x, y: a.y, w: a.w, h: a.h, note: "청사진으로 짠 구역", tags: [HAND_LAYOUT_ROOM_TAG, COMPOSED_LAYOUT_TAG] });
    }
    // 1배 화면 구성 검사(빈 바닥·걸이 반복·평면 속 허공·돌 바닥 가족·빈 단·앞 턱 없는 돌 단) — compositionLint.ts. 손 도트 v5 만(다른 역할표 칩셋은 가구 사전이 다르다).
    const composition = tilesetId === HAND_INTERIOR_TILESET_ID
      ? handInteriorCompositionLint({ ...draft, maps: { ...draft.maps, [mapId]: map } } as Project, map, input, spec, { composed: !!picked || !!blueprint })
      : { errors: [] as string[], warnings: [] as string[] };
    if (composition.errors.length) throw new ToolError(`실내를 짓지 않았다 — 오류 ${composition.errors.length}건: ${composition.errors.slice(0, 6).join(" / ")}`, { code: "composition-error" });
    // 현대 실내(캠퍼스·도시·일본 도시)를 새로 지을 때 BGM 이 비면 맵 이름으로 곡을 고른다 — 연애·학원물 실내가 무음으로 남던 구멍(2026-10-16 실제 Argon 시험).
    // 다시 짓는 맵(replace)은 저작자가 정했을 수 있으니 건드리지 않는다. 환상 실내(손 도트 v5 등)는 그대로 둔다.
    // 2026-10-22 장면 교훈 시험(Sonnet 5.5): 환상 실내(손 도트 v5)도 새로 지으면 무음으로 남아 지하 창고·여관·집 2층·서재 등 7건에서
    // scene-map-no-bgm 이 났다 — create_map 처럼 새 실내는 모두 이름으로 곡을 고른다(현대 실내는 일상 곡, 환상 실내는 마을 곡이 기본).
    if ((!existing || existingUntouched) && !map.bgm) assignCreatedMapBgm(map, {}, { draft, fallbackTheme: MODERN_BGM_TILESETS.has(tilesetId) ? "everyday" : "village" });
    liftTravelLinksOntoArt(draft, map, tileset, doorNotes);
    draft.maps[mapId] = map;
    snapArrivalsToTravelArt(draft, doorNotes);
    // 계단 입구 계약: 이 맵과 links 로 이은 맵의 계단 이동을 계단 그림 칸·앞 칸(등지는 방향)으로 맞춘다(project/stairs/fit.ts).
    doorNotes.push(...fitStairTransfers(draft, [mapId, ...new Set(links.map((l) => l.toMapId).filter((id) => id !== mapId))]));
    const trimNote = trimmed.trimmed
      ? `평면 바깥 막힌 여백을 잘라 ${built.width}×${built.height} 로 지었다 — 입력 좌표는 왼쪽 ${trimmed.dx}·위 ${trimmed.dy} 칸만큼 옮겨졌다. 이후 이 맵 좌표는 새 기준을 쓴다.`
      : "";
    if (!existing) {
      if (!draft.maps[draft.mapTree.mapId]) draft.mapTree = { mapId, children: [] };
      else if (draft.mapTree.mapId !== mapId && !draft.mapTree.children.some((c) => c.mapId === mapId)) draft.mapTree.children.push({ mapId, children: [] });
      if (!draft.maps[draft.startMapId]) { draft.startMapId = mapId; const s = built.start[Math.floor(built.start.length / 2)]; draft.startPos = { x: s?.x ?? 0, y: s?.y ?? 0 }; }
    } else if (existingUntouched && draft.startMapId === mapId) {
      const s = built.start[Math.floor(built.start.length / 2)];
      if (s) draft.startPos = { x: s.x, y: s.y };
    }
    const warnings = [...(trimNote ? [trimNote] : []), ...built.issues.filter((i) => i.severity === "warning").map((i) => i.message)];
    if (shape.plainBox && shape.innerCells >= PLAIN_BOX_MIN_CELLS) warnings.push(`방이 칸막이·알코브 없는 직사각형 하나(ㅁ자, 실내 ${shape.innerCells}칸)다 — 큰 방은 ㄱ·ㄷ자 외곽, 벽에서 들어간 알코브, 두꺼운 칸막이('#' 덩이)로 공간을 나누거나 평면을 줄인다`);
    warnings.push(...fitNotes);
    warnings.push(...composition.warnings);
    if (!composed) warnings.push(...floatingZones(input, shape));
    // layout.program 은 도구가 예제 구성대로 짠 평면이다 — 예제를 손으로 베꼈는지 보는 경고는 모델이 plan·rooms 를 줄 때만(2026-10-14: 병원 1층 program 이 예제와 96% 같다고 경고해 조수가 다시 짜게 했다).
    const copied = picked ? undefined : copiedExample(draft, tileset, input.plan);
    if (copied) {
      // 2026-10-14 campus 실조수(argon): 「교실 둘 + 복도」 요청에 교실 둘 + 복도 예제가 그대로 맞았는데 이 경고가 「새로 짠다」만 말해
      // 같은 방을 3~6번 다시 지었다(361초) — 닮음 %를 낮추려는 재시공 루프. 경고의 뜻은 「요청과 안 맞는데 베꼈다」이지 「닮으면 불합격」이 아니다.
      warnings.push(existing
        ? `평면이 참고 예제 「${copied.name}」와 ${copied.same}% 같다 — 이미 다시 지은 방이다. 이 방이 요청(방 수·쓰임·크기)을 충족하면 그대로 두고 끝낸다: 닮은 정도를 낮추려고 같은 방을 또 짓지 않는다. 다시 지을 때는 방 수·쓰임·크기를 실제로 바꿀 때만`
        : `평면이 참고 예제 「${copied.name}」와 ${copied.same}% 같다 — 이 방이 요청(방 수·쓰임·크기)을 이미 충족하면 그대로 두고 끝낸다(예제와 같다는 것만으로 다시 짓지 않는다). 요청과 다른데 예제를 베낀 것이면 rooms 로 방 사각형을 요청에 맞게 다시 놓는다. 예제는 문법을 배우는 자료다`);
    }
    warnings.push(...doorNotes.map((note) => `자동 맞춤: ${note}`));
    // 엘리베이터 문·계단은 북벽 벽면에 박히고 그 앞 첫 바닥 줄이 탈 자리다 — 층 이동 출입구를 엉뚱한 칸에 두어 장식만 남은 엘리베이터가 생겼다(r4-rom-d 4대 중 3대).
    const travelSpots = [...new Map(built.travel.map((t) => [t.label, t] as const)).values()];
    const travelNote = travelSpots.length
      ? ` — 층 이동 탈 자리(벽면에 박힌 문 앞 첫 바닥 칸, create_transfer_pair 를 여기에): ${travelSpots.slice(0, 6).map((t) => t.trigger
        ? `${t.label.replace(/ @\(.*$/u, "")} 계단 앞 칸(도착) (${t.x},${t.y}) ${t.facing ?? ""} · 이동 칸 (${t.trigger.x},${t.trigger.y})${t.mode === "bump" ? " 부딪힘" : ""}`
        : `${t.label.replace(/ @\(.*$/u, "")} (${t.x},${t.y})`).join(" · ")}`
      : "";
    return {
      summary: `손 도트 실내 '${name}' ${built.width}×${built.height} (${mapId}, ${tilesetId})${picked ? ` — 배치 후보 ${picked.variant + 1}/${picked.variants}(방 ${picked.c.rooms.length}개, 견본 가구 ${Object.values(furnished ?? {}).reduce((a, f) => a + f.placed, 0)}점 — data.layout.picture 로 배치를 보고, 다른 배치는 layout.variant 를 바꿔 replace:true)` : ""} — 출입구에서 닿는 칸 ${built.reachable}, 닿지 못한 빈 바닥 ${built.unreachedFloor.length}, 경고 ${warnings.length}${warnings.length ? ` — ${warnings.slice(0, 4).join(" / ")}${warnings.length > 4 ? " …" : ""}` : ""}${travelNote}`,
      data: { mapId, tilesetId, width: built.width, height: built.height, reachable: built.reachable, floorCells: built.floorCells,
        unreachedFloor: built.unreachedFloor.slice(0, 20), ...("bareFloor" in composition && composition.bareFloor !== undefined ? { bareFloorPct: composition.bareFloor } : {}), entrance: built.start, exitWidth, exits, links: links.length, warnings: warnings.slice(0, 20), travel: travelSpots,
        ...(composed ? { plan: composed.plan, openings: composed.openings } : {}),
        ...(picked && composed ? {
          layout: { variant: picked.variant, variants: picked.variants, score: picked.c.score, notes: picked.c.notes, picture: layoutAscii(picked.c, composed.plan),
            rooms: picked.c.rooms.map((r, i) => ({ letter: String.fromCharCode(65 + (i % 26)), id: r.id, kind: r.kind, x0: r.x0, y0: r.y0, x1: r.x1, y1: r.y1, floor: r.floor, wall: r.wall, notches: r.notches, template: furnished?.[r.id]?.template ?? r.template, furniture: furnished?.[r.id] })) },
          // 이 집을 손보려면 이 값을 그대로 rooms·connect·exit·objects… 로 넘기고 replace:true(가구를 빼거나 더해서)
          rebuild: { rooms: picked.c.rooms.map(({ kind: _k, template: _t, ...r }) => r), connect: picked.c.connect, exit: picked.c.exit,
            objects: (input.objects ?? []).filter((o) => !composed.doors.some((d) => d.id === o.id && d.x === o.x && d.y === o.y)), tables: input.tables, goods: input.goods, lines: input.lines, daises: input.daises },
        } : {}) },
      ...(warnings.length ? { warnings } : {}),
    };
  },
};

export const HAND_INTERIOR_TOOLS: readonly ToolDefinition[] = [LIST_HAND_INTERIOR_PARTS_TOOL, BUILD_HAND_INTERIOR_ROOM_TOOL];
