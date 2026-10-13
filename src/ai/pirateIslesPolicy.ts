// 열대 군도·해적 항구(pirate_isles, 계열 oprn-pirate) 조수 연결 — 해적 항구·열대 섬 마을·해안 요새·난파선·보물 동굴·배 안 요청이
// 이 번들 칩셋과 맵 구성기(compose_pirate_isles_map)로 가게 한다. sfStationPolicy·gothicPolicy 와 같은 모양(대상 판정 + 포인터·상세 줄 + 의도 노트).
// 칩셋이 프로젝트에 «있을 때만» 라우팅한다(번들이라 새 프로젝트·옛 프로젝트 모두 ensureBundledTilesets 로 갖는다).
// 버들항(로마풍 항구)과 겹치는 낱말: «항구»·«부두»·«등대»만으로는 끌어오지 않는다 — 해적·열대·군도·야자·보물섬·난파선처럼 이 칩셋만의 낱말이 있어야 한다.
// 주의: 노트·문장은 모델 지시문에 실린다 — PAW 게이트 낱말(현·대·모·던 이어 쓴 말, 영어 m-o-d-e-r-n)을 쓰지 않는다.

import type { IntentDeclaration } from "@/ai/intentDeclaration";
import type { Project, TilesetDef } from "@/project/types";

export const PIRATE_ISLES_TILESET_ID = "pirate_isles";
const PIRATE_ISLES_TEXTURE = "tex_pirate_isles";

export function isPirateIslesTilesetDef(tileset: Pick<TilesetDef, "image" | "id"> | undefined): boolean {
  return !!tileset && (tileset.id === PIRATE_ISLES_TILESET_ID || (tileset.image.type === "bundled" && tileset.image.id === PIRATE_ISLES_TEXTURE));
}

/** 사용자가 칩셋을 직접 가리킨 식별자·이름. */
const NAMES_PIRATE_RE = /pirate[_-]isles|oprn-pirate|해적\s*(?:군도\s*)?(?:칩셋|타일셋)|군도\s*칩셋/iu;
/** 이 칩셋만의 낱말: 해적·열대 섬·군도·야자수 해변·보물섬·난파선·카리브. «항구»만으로는 버들항이다. */
const PIRATE_WORD_RE = /해적|열대|군도|남국|남태평양|카리브|야자(?:수)?\s*(?:해변|섬|마을|숲)|보물\s*(?:섬|동굴|지도|상자)|난파(?:선)?|무인도|산호\s*(?:섬|초|해변)|수상\s*가옥|pirate|tropical|archipelago|caribbean|treasure\s*(?:island|cave)|shipwreck|desert\s*island|palm\s*(?:beach|island)/iu;

export function namesPirateIslesTileset(text: string | undefined): boolean {
  return !!text && NAMES_PIRATE_RE.test(text);
}

export function describesPiratePlace(text: string | undefined): boolean {
  return !!text && PIRATE_WORD_RE.test(text);
}

export interface PirateIslesTarget {
  /** 대상 맵이 이미 pirate_isles 면 그 맵 — 아니면 새 맵. */
  readonly mapId?: string;
  readonly lived?: boolean;
}

/**
 * 이 요청이 해적 군도 칩셋 작업인가. 대상 맵이 이미 pirate_isles 면 그 맵(생성·수정), 아니면 프로젝트에 칩셋이 «있고» 요청이 칩셋을 부르거나
 * 이 칩셋만의 장소 낱말을 말한 새 맵 생성. 버들항 마을 노트보다 먼저 본다(«해적 항구»가 로마풍 버들항으로 가지 않게).
 */
export function pirateIslesTargetFor(
  project: Pick<Project, "tilesets" | "maps">,
  intent: Pick<IntentDeclaration, "mode" | "space" | "source">,
  requestText: string | undefined,
  mapId: string | null | undefined,
  lived: boolean,
): PirateIslesTarget | null {
  if (intent.source !== "llm" || (intent.mode !== "create" && intent.mode !== "modify")) return null;
  const map = mapId ? project.maps[mapId] : undefined;
  if (map && isPirateIslesTilesetDef(project.tilesets[map.tilesetId])) return { mapId: map.id, lived };
  if (intent.mode !== "create") return null;
  if (!Object.values(project.tilesets).some(isPirateIslesTilesetDef)) return null;
  const text = requestText ?? "";
  return NAMES_PIRATE_RE.test(text) || describesPiratePlace(text) ? {} : null;
}

export function scopeUsesPirateIsles(project: Pick<Project, "tilesets" | "maps">, mapIds: readonly string[]): boolean {
  return mapIds.some((id) => isPirateIslesTilesetDef(project.tilesets[project.maps[id]?.tilesetId ?? ""]));
}

/** 첫 요청부터 스키마가 보여야 하는 도구 — 구성기 → 확인 → 보정 → 접근칸 검사. */
export const PIRATE_ISLES_EXPOSED_TOOLS: readonly string[] = [
  "compose_pirate_isles_map", "create_map", "resize_map", "show_map_region", "list_map_locations", "list_tileset_references", "read_tileset_reference",
  "stamp_object", "check_reachability", "create_transfer_pair", "link_maps",
];

const KIND_GUIDE =
  "kind 고르기: 해적 항구·부두·선착장 마을 → harbor(56×40) / 열대 섬 해변 마을·야자 마을·수상 가옥 → beach(52×40) / 해안 요새·포대 → fort(48×40) / 난파선·보물 동굴·무인도 → wreck(46×36) / "
  + "배 안(선장실·선실·주방·선창) → ship(36×26) / 해적 술집 안 → tavern(32×24) / 오두막 안 → hut(16×14) / 보물 동굴 안 → cave(36×28). "
  + "«난파선과 보물 동굴 섬»처럼 바깥과 안을 함께 말하면 맵 두 장: wreck(바깥) + cave(안)을 짓고, 바깥 맵 «보물 동굴 입구» 접근칸과 안 맵 «바깥 문 자리»를 create_transfer_pair 로 잇는다.";

export const PIRATE_ISLES_POINTER_LINE =
  "해적 항구·열대 섬 마을·해안 요새·난파선·보물 동굴·배 안 같은 해적/열대 장소는 번들 칩셋 pirate_isles(계열 oprn-pirate)로 짓는다: 새 맵 create_map({name, width, height, tilesetId:\"pirate_isles\"}) → "
  + "**compose_pirate_isles_map({kind, seed}) 가 기본**이다 — 손으로 바다·해안·건물·소품을 하나씩 깔지 않는다(해안선 오토타일·건물 문 앞 길·부두·통행 검사를 구성기가 한다). " + KIND_GUIDE
  + " 다시 짜려면 seed 를 바꿔 replace:true. 로마풍 항구(버들항)는 이 칩셋이 아니다 — 해적·열대 낱말이 없으면 버들항으로 짓는다.";

export const PIRATE_ISLES_DETAIL_LINE =
  "이 작업의 맵은 해적 군도 칩셋(pirate_isles)이다. ① 맵이 비어 있으면 compose_pirate_isles_map({kind, seed}) 를 먼저 부른다(손댄 맵은 replace:true). 작다고 거절되면 resize_map 으로 권장 크기로 키운다. "
  + "② show_map_region 으로 결과를 보고 list_map_locations 의 건물·구역 이름표(문 좌표·문 앞 접근칸)를 읽어 기획과 맞춘다 — 안 맞으면 seed 를 바꿔 다시 짠다. "
  + "③ 문 앞 접근칸에 이동 이벤트·NPC·단서를 둔다(문 그림 칸이 아니라 그 아래 칸). 기물 하나를 더할 때만 stamp_object({objectId:\"kit:pirate_isles/pi-<id>\", x, y}) — 배·산호·물 바위는 물 위에만, 나머지는 맞는 땅 위에만, 건물과 1칸 띄우고 길·문 앞·부두 위에는 두지 않는다. "
  + "④ 끝나면 check_reachability 로 출발 칸에서 문 앞 접근칸·부두 끝에 닿는지 확인한다. "
  + "⑤ 구성기 결과는 완성된 배치다 — 「비어 보인다」고 기물을 흩뿌리지 않는다. 바다·해변의 빈 곳은 쓰임이 있는 빈 곳(배가 지나는 물·걷는 모래)이다. 방이 비면 seed 를 바꿔 다시 짠다.";

export function pirateIslesPromptLines(project: Pick<Project, "tilesets" | "maps">, mapIds: readonly string[]): string[] {
  if (!Object.values(project.tilesets).some(isPirateIslesTilesetDef)) return [];
  return scopeUsesPirateIsles(project, mapIds) ? [PIRATE_ISLES_POINTER_LINE, PIRATE_ISLES_DETAIL_LINE] : [PIRATE_ISLES_POINTER_LINE];
}

export function formatPirateIslesNote(target: PirateIslesTarget, targetMap: { id: string; width: number; height: number } | null): string {
  const where = target.mapId && !target.lived
    ? `지금 맵 '${target.mapId}'(${targetMap?.width ?? "?"}×${targetMap?.height ?? "?"})은 pirate_isles 이고 비어 있다 → 이 맵에 compose_pirate_isles_map 으로 짓는다(작으면 resize_map 먼저).`
    : target.mapId
      ? `지금 맵 '${target.mapId}' 는 pirate_isles 이고 이미 내용이 있다 → 다시 짜는 요청이면 compose_pirate_isles_map({kind, seed:다른 값, replace:true}), 더하는 요청이면 show_map_region 으로 빈 곳을 찾아 stamp_object 로 더한다.`
      : "pirate_isles 맵이 아직 없다 → 묻지 말고 create_map({name, width, height, tilesetId:\"pirate_isles\"}) 로 권장 크기의 새 맵을 만든다(새 맵은 계열 확인이 필요 없다 — 지금 보는 맵이 버들항이어도 그 맵은 건드리지 않는다). "
        + "ask_tileset_change 는 사용자가 «지금 이 맵»을 해적 군도로 바꿔 칠하라고 했을 때만 쓴다.";
  return [
    "[해적·열대 장소 시공 — pirate_isles] 이 요청의 칩셋은 번들 열대 군도·해적 항구(pirate_isles, 계열 oprn-pirate)다. 버들항·일본 도시·고딕 도구(author_beodeul_town 등)는 쓰지 않는다. 맵 한 장은 compose_pirate_isles_map({kind, seed}) 한 번이 기본이다.",
    where,
    KIND_GUIDE,
    "순서: create_map(권장 크기) → compose_pirate_isles_map → show_map_region·list_map_locations 로 확인 → 문 앞 접근칸에 이벤트 → check_reachability. 기획과 안 맞으면 seed 만 바꿔 replace:true 로 다시 짠다.",
    "구성기 결과에 기물을 흩뿌려 채우지 않는다 — 길·부두·방파제 가장자리·문 앞에는 찍지 않고, 배는 물 위에만 둔다. 더할 것은 기획의 인물·단서·이동 이벤트다.",
  ].join("\n");
}
