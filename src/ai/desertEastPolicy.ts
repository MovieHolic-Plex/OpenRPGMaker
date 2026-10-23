// 사막·동양풍(desert_east) 조수 연결 — 사막·오아시스·바자르·피라미드·아라비안·실크로드 요청이 버들항 로마풍 사막(author_beodeul_town theme:desert) 대신 이 칩셋으로 가게 한다.
// gothicPolicy·campusPolicy 와 같은 모양(대상 판정 + 포인터 줄 + 상세 줄 + 노트)이다.
//  - desert_east 는 번들에 구워졌다(2026-10-14, 야외·실내 한 시트, defaultAssets 의 ensureBundledTilesets 가 모든 프로젝트에 붙인다). 그래도 길은 «프로젝트에 칩셋이 있을 때만» 열린다.
//  - 「로마풍 사막」「버들항 사막」처럼 버들항을 가리키면 버들항이 이긴다(이 정책은 null). jp_city·고딕·캠퍼스가 먼저 잡으면 부르지 않는다.
// 배치는 구성기(src/project/desertEastComposer.ts)가 짠다 — 조수는 용도(kind)·씨앗만 고른다(맵 품질은 구성기의 조화 규칙이 지킨다).
// 주의: 노트·문장은 모델 지시문에 실린다 — PAW 전용 게이트를 켜는 낱말(현대·모던·modern)을 쓰지 않는다.

import type { IntentDeclaration } from "@/ai/intentDeclaration";
import type { Project, TilesetDef } from "@/project/types";

export const DESERT_EAST_TILESET_ID = "desert_east";
const DESERT_EAST_TEXTURE = "tex_desert_east";

export function isDesertEastTilesetDef(tileset: Pick<TilesetDef, "image"> | undefined): boolean {
  return tileset?.image.type === "bundled" && tileset.image.id === DESERT_EAST_TEXTURE;
}

/** 칩셋을 이름으로 부른 식별자. */
const NAMES_DESERT_EAST_RE = /desert[_-]?east|oprn-desert-east|사막\s*·?\s*동양풍\s*(?:칩셋|타일셋)?/iu;
/** 사막·동양풍 풍경 낱말. */
const DESERT_EAST_RE = /사막|오아시스|바자르|바자|수크|피라미드|스핑크스|오벨리스크|지구라트|아라비(?:아|안)|페르시아|실크\s*로드|비단길|대상\s*(?:숙소|행렬)|카라반|캐러밴|낙타|술탄|칼리프|파라오|이집트|메소포타미아|사막\s*궁전|모래\s*(?:마을|도시|왕국)|함맘|\b(?:desert(?!\s*island)|oasis|bazaar|souk|pyramid|sphinx|ziggurat|arabian|silk\s*road|caravan(?:serai)?|sultan|pharaoh)\b/iu;
/** 버들항 로마풍 사막을 가리키는 말 — 버들항이 이긴다. */
const BEODEUL_DESERT_RE = /로마(?:풍|식)?|버들항|beodeul|지중해/iu;

export function namesDesertEastTileset(text: string | undefined): boolean {
  return !!text && NAMES_DESERT_EAST_RE.test(text);
}
/** 사막·동양풍 장소를 말한 문장인가(로마풍·버들항 사막 제외). */
export function describesDesertEast(text: string | undefined): boolean {
  return !!text && DESERT_EAST_RE.test(text) && !BEODEUL_DESERT_RE.test(text);
}
export function hasDesertEastTileset(project: Pick<Project, "tilesets">): boolean {
  const def = project.tilesets[DESERT_EAST_TILESET_ID];
  return !!def && isDesertEastTilesetDef(def);
}

export interface DesertEastTarget {
  readonly mapId?: string;
  readonly lived?: boolean;
  /** 실내(찻집·가게·알현실·묘실·목욕탕·여관) 요청. */
  readonly indoor?: boolean;
  /** 야외 용도 추정(문장 낱말) — 노트에 kind 로 권한다. */
  readonly kinds?: readonly string[];
  /** 야외 요청이 함께 말한 실내(묘실·찻집 …). */
  readonly rooms?: readonly string[];
}

const DUNGEON_RE = /던전|dungeon|미궁|지하\s*\d+\s*층/iu;
const INDOOR_RE = /찻집|다방|가게\s*안|상점\s*안|알현실|왕좌|옥좌|묘실|무덤\s*(?:안|내부)|피라미드\s*(?:안|내부|속)|내부|실내|목욕탕|함맘|여관\s*방|객실|방\s*안|interior|tomb\s*chamber|tea\s*house|hammam/iu;
const OUTDOOR_RE = /마을|거리|시장|바자르|오아시스|유적|도시|성벽|궁전\s*(?:마당|정원)|야영|대상\s*숙소|town|village|street|ruins/iu;

/** 문장 → 야외 kind 추정(여러 개면 모두). */
export function desertKindsFor(text: string): string[] {
  const out: string[] = [];
  if (/오아시스|oasis|마을|village/iu.test(text)) out.push("oasis");
  if (/바자르|바자|수크|시장|장터|bazaar|souk|market/iu.test(text)) out.push("bazaar");
  if (/궁전|술탄|칼리프|왕궁|palace|sultan/iu.test(text)) out.push("palace");
  if (/피라미드|스핑크스|오벨리스크|유적|파라오|pyramid|ruins|sphinx|tomb/iu.test(text)) out.push("pyramid");
  if (/대상\s*숙소|카라반|캐러밴|caravan/iu.test(text)) out.push("caravanserai");
  return out.length ? out : ["oasis"];
}

/** 문장 → 실내 kind 추정. */
export function desertRoomKindsFor(text: string): string[] {
  const out: string[] = [];
  if (/찻집|다방|tea/iu.test(text)) out.push("teahouse");
  if (/가게|상점|shop/iu.test(text)) out.push("shop");
  if (/알현실|왕좌|옥좌|궁전\s*(?:안|내부)|throne/iu.test(text)) out.push("palace_hall");
  if (/묘실|무덤|피라미드|tomb/iu.test(text)) out.push("tomb");
  if (/목욕탕|함맘|hammam|bath/iu.test(text)) out.push("hammam");
  if (/여관|객실|inn/iu.test(text)) out.push("inn");
  return out;
}

/**
 * 이 요청이 사막·동양풍 칩셋 작업인가.
 *  - 대상 맵이 이미 desert_east 이면 그 맵.
 *  - 아니면 «시공 생성» 요청이 칩셋 이름이나 사막·오아시스·바자르·피라미드·아라비안 낱말을 말했을 때 새 맵 — 프로젝트에 칩셋이 있을 때만.
 * 호출자는 jp_city·고딕·캠퍼스가 잡았으면 부르지 않는다. 버들항(로마풍) 사막을 가리키면 null.
 */
export function desertEastTargetFor(
  project: Pick<Project, "tilesets" | "maps">,
  intent: Pick<IntentDeclaration, "mode" | "space" | "source">,
  requestText: string | undefined,
  mapId: string | null | undefined,
  lived: boolean,
): DesertEastTarget | null {
  if (intent.source !== "llm" || (intent.mode !== "create" && intent.mode !== "modify")) return null;
  if (!hasDesertEastTileset(project)) return null;
  const text = requestText ?? "";
  const map = mapId ? project.maps[mapId] : undefined;
  if (map && isDesertEastTilesetDef(project.tilesets[map.tilesetId])) return { mapId: map.id, lived, kinds: desertKindsFor(text) };
  if (intent.mode !== "create") return null;
  if (!NAMES_DESERT_EAST_RE.test(text) && !describesDesertEast(text)) return null;
  // 「사막 피라미드 던전」은 던전 시공기(author_dungeon type pyramid — 여러 방·함정·보스)의 일이다. 칩셋 이름을 직접 부르지 않았으면 비켜 준다
  // (dt r2 pyramid-a: 사막·파라오 낱말에 잡혀 desert_east 묘실 한 칸 방으로 지어졌다).
  if (!NAMES_DESERT_EAST_RE.test(text) && DUNGEON_RE.test(text)) return null;
  const rooms = desertRoomKindsFor(text);
  const indoorish = INDOOR_RE.test(text);
  // «피라미드 유적과 내부»처럼 야외 낱말이 함께 있으면 야외부터(실내는 rooms 로 노트에 붙는다).
  const outdoorish = OUTDOOR_RE.test(text);
  if (!outdoorish && (intent.space === "interior" || (indoorish && intent.space !== "outdoor"))) return { indoor: true, kinds: rooms };
  return { kinds: desertKindsFor(text), rooms: indoorish ? rooms : [] };
}

export function scopeUsesDesertEast(project: Pick<Project, "tilesets" | "maps">, mapIds: readonly string[]): boolean {
  return mapIds.some((id) => isDesertEastTilesetDef(project.tilesets[project.maps[id]?.tilesetId ?? ""]));
}

/** 첫 요청부터 스키마가 보여야 하는 도구. */
export const DESERT_EAST_EXPOSED_TOOLS: readonly string[] = [
  "list_tileset_references", "read_tileset_reference", "create_map", "resize_map", "compose_desert_east_map", "compose_desert_east_room", "link_desert_east_interior",
  "list_tileset_objects", "stamp_tileset_object", "check_reachability", "show_map_region", "ask_tileset_change",
];

export const DESERT_EAST_POINTER_LINE =
  "사막·오아시스·바자르(시장 거리)·피라미드·지구라트·아라비안·실크로드 대상 숙소·사막 궁전 풍경은 번들 칩셋 desert_east(사막·동양풍 손 도트)로 짓는다 — 버들항 author_beodeul_town theme:\"desert\" 는 「로마풍 사막」을 말했을 때만 쓴다: "
  + "새 맵 create_map tilesetId:\"desert_east\"(보는 맵이 다른 계열이면 ask_tileset_change 로 견본을 보이고 묻는다), 크기는 resize_map 으로 맞춘 뒤 "
  + "compose_desert_east_map({kind:\"oasis\"|\"bazaar\"|\"palace\"|\"pyramid\"|\"caravanserai\", seed}) 한 번으로 땅·길·건물·소품을 깐다(오아시스 48×36·바자르 48×32·궁전 46×38·피라미드 48×36·대상 숙소 40×32 언저리). "
  + "실내(찻집·가게·궁전 알현실·피라미드 묘실·목욕탕·여관)는 desert_east 맵을 하나 더 만들어 compose_desert_east_room({kind:\"teahouse\"|\"shop\"|\"palace_hall\"|\"tomb\"|\"hammam\"|\"inn\"}) 로 짓고 link_desert_east_interior 로 야외 문과 잇는다. "
  + "칸 번호로 칠하지 않는다 — 소품을 더할 때만 list_tileset_objects → stamp_tileset_object(문 접근칸·길은 막지 않는다). 사람은 Actor1 캐릭터 이벤트로 놓는다. "
  + "단 「피라미드 던전」「왕묘 던전」처럼 던전을 말하면 여러 방·함정·보스가 있는 던전이다 — desert_east 묘실 한 칸이 아니라 author_dungeon({type:\"pyramid\"}) 한 번으로 짓는다.";

export const DESERT_EAST_DETAIL_LINE =
  "이 작업의 맵은 사막·동양풍 칩셋(desert_east)이다. ⓪ 땅·길·건물·소품은 compose_desert_east_map 이 조화 규칙(바닥은 모래 한 재질 + 길·광장·풀·물·사구만 모서리 왕 타일, 건물 문은 남향·접근칸은 길, 소품은 맞는 땅 위·겹침 없음, 빈 땅마다 용도)을 지켜 한 번에 깐다. 손댄 맵을 다시 깔려면 replace:true. "
  + "① 결과 data.buildings[].doors 가 건물 문 칸(막힘)이고 access 가 문 앞 접근칸(걷는다) — 실내를 잇는 이동은 link_desert_east_interior 가 접근칸에 건다. "
  + "② 피라미드 입구(de-pyramid-door)는 compose 결과에 건물로 들어 있다 — 묘실(compose_desert_east_room kind:\"tomb\")과 잇는다. "
  + "③ compose 결과는 완성본이다 — 사용자가 따로 원하지 않으면 유적 조각·석재·소품을 낱개로 더 흩지 않는다(흩은 조각은 땅·짝 규칙을 모르고 떠 보인다). 소품을 더할 때는 길·광장·문 접근칸과 그 아래 한 칸, 물 칸을 피하고, 야자·갈대는 풀 위, 노점·분수는 포석 위, 낙타·천막은 모래 위에 둔다. ④ 마지막에 check_reachability 로 시작 칸 → 모든 문을 확인한다.";

export function desertEastPromptLines(project: Pick<Project, "tilesets" | "maps">, mapIds: readonly string[]): string[] {
  if (!hasDesertEastTileset(project)) return [];
  return scopeUsesDesertEast(project, mapIds) ? [DESERT_EAST_POINTER_LINE, DESERT_EAST_DETAIL_LINE] : [DESERT_EAST_POINTER_LINE];
}

const SIZE: Readonly<Record<string, string>> = { oasis: "48×36", bazaar: "48×32", palace: "46×38", pyramid: "48×36", caravanserai: "40×32" };
const ROOM_SIZE: Readonly<Record<string, string>> = { teahouse: "13×10", shop: "11×9", palace_hall: "17×14", tomb: "15×17", hammam: "13×11", inn: "13×10" };

export function formatDesertEastNote(target: DesertEastTarget, targetMap: { id: string; width: number; height: number } | null): string {
  if (target.indoor) {
    const kinds = target.kinds?.length ? target.kinds : ["teahouse"];
    return [
      "[사막·동양풍 실내 — desert_east] 이 요청은 사막·동양풍 실내다. 판타지 손 도트 실내(atlas_biome_interior)·build_hand_interior_room 은 쓰지 않는다(벽·바닥 결이 다르다).",
      `짓는 법: 방마다 create_map({name, width, height, tilesetId:"desert_east"}) → compose_desert_east_room({mapId, kind, seed}) 한 번. 이 요청의 방: ${kinds.map((k) => `${k}(${ROOM_SIZE[k] ?? "13×10"})`).join(" · ")}. `
        + "피라미드 «유적과 내부»처럼 야외도 함께 말했으면 야외(compose_desert_east_map kind:\"pyramid\")를 먼저 짓고 결과의 피라미드 입구 문과 묘실을 link_desert_east_interior 로 잇는다.",
      "도구가 벽·천장 테·바닥·가구·문 틈을 짜고 문에서 모든 바닥이 닿는지 확인한다 — 가구를 낱칸으로 더 칠하지 않는다.",
    ].join("\n");
  }
  const kinds = target.kinds?.length ? target.kinds : ["oasis"];
  const where = target.mapId && !target.lived
    ? `지금 맵 '${target.mapId}'(${targetMap?.width ?? "?"}×${targetMap?.height ?? "?"})은 desert_east 이고 비어 있다 → 크기를 맞춘 뒤 이 맵에 짓는다.`
    : target.mapId
      ? `지금 맵 '${target.mapId}' 는 desert_east 이고 이미 내용이 있다 → 다시 짜려면 compose_desert_east_map(replace:true), 더하려면 빈 땅에 stamp_tileset_object.`
      : `desert_east 맵이 아직 없다 → create_map({name, width, height, tilesetId:"desert_east"}). 지금 보는 맵이 다른 계열이면 실행기가 거부한다 — 그때는 칠하지 말고 ask_tileset_change(toTilesetId:"desert_east", reason) 로 묻고 이 턴을 끝낸다.`;
  return [
    "[사막·동양풍 시공 — desert_east] 이 요청의 칩셋은 번들 사막·동양풍 칩셋(desert_east)이다. 버들항 author_beodeul_town(theme desert, 로마풍)은 쓰지 않는다.",
    where,
    `순서: (선택) list_tileset_references({tilesetId:"desert_east"}) 로 배치 규칙·예제를 읽는다 → create_map/resize_map → compose_desert_east_map({mapId, kind, seed}) — 이 요청의 kind: ${kinds.map((k) => `${k}(${SIZE[k] ?? "48×36"})`).join(" · ")}`
      + " → 실내를 말했으면 compose_desert_east_room 으로 방 맵을 짓고 link_desert_east_interior 로 문과 잇는다 → check_reachability. 길·집을 손으로 깔지 않는다.",
    "compose 결과는 완성본이다: 사용자가 더 원하지 않으면 stamp_tileset_object 로 유적 조각·석재·소품을 낱개로 더 흩지 않는다(구성기는 땅 재질·짝·용도를 맞춰 놓지만 낱개 찍기는 그 규칙을 모른다). 확인은 show_map_region 한두 번이면 된다.",
    ...(target.rooms?.length ? [`이 요청은 실내도 말했다: ${target.rooms.map((k) => `${k}(${ROOM_SIZE[k] ?? "13×10"})`).join(" · ")} — 야외를 깐 뒤 방 맵마다 create_map(tilesetId:"desert_east") → compose_desert_east_room → link_desert_east_interior(door = 야외 결과 data.buildings 의 문 칸, interiorMapId).`] : []),
  ].join("\n");
}

/** 컨셉 카드 무대 낱말 → 타일셋 id(seed.json tilesetHints 와 BUILDABLE_CONCEPT_TILESETS 에 같은 줄이 있다). */
export const DESERT_EAST_CONCEPT_HINT: Readonly<Record<string, string>> = { "사막·오아시스·아라비안": DESERT_EAST_TILESET_ID };
