// 박물관·배 안·투기장 실내(interior-plus, 2026-10-14) 조수 연결 — 손 도트 실내 v5(atlas_biome_interior)에 덧붙인 조각과 방 종류로 짓게 한다.
// 모양은 gothicPolicy·pirateIslesPolicy 와 같다(대상 판정 + 의도 노트 + 첫 요청부터 보일 도구). plainTurn 의 테마 사슬(앞이 잡으면 뒤는 안 본다)에서
// 시대 테마·jp_city 다음, 고딕·해적 군도 앞에 선다. 경계(openwiki/atlas-biome-interior.md 「박물관·배 안·투기장」):
//  · 박물관·미술관·전시실 — 판타지·중세 전시실은 여기. 호러·고딕·흉가·저택·폐성 낱말이 같이 있으면 gothic_manor(build_gothic_place place:"gallery")로 보낸다.
//  · 배 안(선장실·조타실·배 주방·선원 숙소·포 갑판·화물칸·배 감방) — 방 낱말이 있는 배 «안» 요청은 여기. 보고 있는 맵이 이미 pirate_isles 면
//    그 칩셋의 배 안(compose_pirate_isles_map kind ship)을 지킨다(이 정책은 대상 맵이 다른 테마 칩셋이면 잡지 않는다). 해적 항구·섬·난파선 같은 바깥은 해적 군도.
//  · 투기장·콜로세움·검투사 — 여기(관중석·모래 마당·검투사 방·무기고).
// 주의: 노트·문장은 모델 지시문에 실린다 — PAW 게이트 낱말(현대·모던·modern)을 쓰지 않는다.
import type { IntentDeclaration } from "@/ai/intentDeclaration";
import type { Project } from "@/project/types";

export const INTERIOR_PLUS_TILESET_ID = "atlas_biome_interior";

const MUSEUM_RE = /박물관|미술관|전시실|전시관|화랑|갤러리|유물\s*(?:실|전시)|조각\s*(?:실|전시)|자연사|museum|gallery|exhibit/iu;
/** 배 «안» — 배 이름 + 안/속/내부, 또는 배에만 있는 방 낱말. 「배」 한 글자만으로는 잡지 않는다(배 = 과일·배수 등). */
const SHIP_RE = /(?:배|선박|범선|해적선|함선|군함|상선|유령선|갤리선)\s*(?:의\s*)?(?:안|속|내부|선실|방)|선장실|조타실|함교|선실|선원\s*(?:숙소|방|침실)|배\s*주방|선상\s*주방|갤리\s*주방|화물칸|선창(?!가)|포\s*갑판|대포\s*갑판|아래\s*갑판|갑판\s*아래|배\s*감방|영창|captain'?s?\s*cabin|ship'?s?\s*(?:galley|hold|cabin|interior)|cargo\s*hold|gun\s*deck|\bbrig\b/iu;
const ARENA_RE = /투기장|콜로세움|검투사|원형\s*경기장|결투장|격투장|관중석|arena|colosseum|gladiator/iu;
/** 호러·고딕 — 이 낱말이 같이 있으면 박물관·배 요청이라도 이 정책이 잡지 않는다(고딕 저택·유령선 계열로). */
const DARK_RE = /고딕|호러|공포|흉가|폐성|저택|묘지|유령|귀신|괴담|저주받은|haunted|gothic|horror|ghost/iu;
/** 바깥 장소 — 실내 낱말 없이 이것만 있으면 바깥(해적 군도·버들항 등)으로 둔다. */
const OUTDOOR_ONLY_RE = /항구|부두|선착장|해변|섬\b|마을|거리|광장|정원|앞마당|harbor|port|beach|island|village|street/iu;
const INDOOR_HINT_RE = /안|속|내부|실내|방|실\b|홀|전시실|선실|칸|interior|inside|room|hall/iu;

export type InteriorPlusTheme = "museum" | "ship" | "arena";

export interface InteriorPlusTarget {
  readonly themes: readonly InteriorPlusTheme[];
  /** 대상 맵이 이미 손 도트 실내면 그 맵. */
  readonly mapId?: string;
  readonly lived?: boolean;
}

/** 문장이 말한 interior-plus 테마들(없으면 빈 배열). 호러·고딕 낱말이 있으면 박물관·배는 뺀다. */
export function interiorPlusThemes(text: string | undefined): InteriorPlusTheme[] {
  if (!text) return [];
  const dark = DARK_RE.test(text);
  const out: InteriorPlusTheme[] = [];
  if (MUSEUM_RE.test(text) && !dark) out.push("museum");
  if (SHIP_RE.test(text) && !dark) out.push("ship");
  if (ARENA_RE.test(text)) out.push("arena");
  // 바깥 낱말만 있고 실내 힌트가 없으면(«해적 항구에 박물관 건물», «투기장 있는 마을») 바깥 시공이 먼저다.
  if (out.length && OUTDOOR_ONLY_RE.test(text) && !INDOOR_HINT_RE.test(text.replace(MUSEUM_RE, "").replace(ARENA_RE, ""))) return [];
  return out;
}

/**
 * 이 요청이 박물관·배 안·투기장 실내 시공인가. 새 맵 생성(create)만 잡는다 — 대상 맵이 다른 테마 칩셋(해적 군도·고딕 등)이면 잡지 않는다.
 * 대상 맵이 손 도트 실내(atlas_biome_interior)이고 낱말이 맞으면 그 맵을 짓는 수정(modify)도 잡는다.
 */
export function interiorPlusTargetFor(
  project: Pick<Project, "tilesets" | "maps">,
  intent: Pick<IntentDeclaration, "mode" | "source">,
  requestText: string | undefined,
  mapId: string | null | undefined,
  lived: boolean,
): InteriorPlusTarget | null {
  if (intent.source !== "llm" || (intent.mode !== "create" && intent.mode !== "modify")) return null;
  if (!project.tilesets[INTERIOR_PLUS_TILESET_ID]) return null;
  const themes = interiorPlusThemes(requestText);
  if (!themes.length) return null;
  const map = mapId ? project.maps[mapId] : undefined;
  if (map && map.tilesetId === INTERIOR_PLUS_TILESET_ID) return { themes, mapId: map.id, lived };
  if (intent.mode !== "create") return null;
  // 보고 있는 맵이 해적 군도면 그 칩셋의 배 안을 지킨다(배 테마만 빠진다).
  const onPirate = !!map && /pirate/u.test(map.tilesetId);
  const keep = onPirate ? themes.filter((t) => t !== "ship") : themes;
  return keep.length ? { themes: keep } : null;
}

/** 첫 요청부터 스키마가 보여야 하는 도구 — 부품·방 구성 → 짓기 → 확인. */
export const INTERIOR_PLUS_EXPOSED_TOOLS: readonly string[] = [
  "list_hand_interior_parts", "build_hand_interior_room", "list_tileset_references", "read_tileset_reference", "show_map_region", "check_reachability", "create_transfer_pair",
];

/** 말한 방만 짓는다 — 건물 전체(program)는 «박물관»·«배 안 전체»처럼 건물을 말할 때만(2026-10-14 시험: «배 안 주방과 선실» 이 위 갑판 네 방 전체가 됐다). */
const SUBSET_GUIDE =
  "말한 방만 짓는다: «선장실과 화물칸» → layout:{rooms:[{kind:\"ship_cabin\"},{kind:\"ship_cargo\"}]} · «주방과 선실» → rooms:[{kind:\"ship_galley\"},{kind:\"ship_crew\"}](선실 = 선원 숙소, «선장 선실»이면 ship_cabin) · "
  + "«전시실» 한 곳 → rooms:[{kind:\"museum_lobby\"},{kind:\"museum_gallery\"}] · «투기장» → program:\"arena\". program(건물 전체)은 «박물관»·«배 안 전체»·«갑판 아래»처럼 건물을 통째로 말할 때만 쓴다.";
/** 읽을 것 — 이 노트와 도구 결과면 충분하다(2026-10-14 시험: 참고문서 8~20장·프리셋·공용 기물 검색을 돌다 한 판에 8~11분). */
const READ_GUIDE =
  "읽을 것은 이 노트로 충분하다 — list_authoring_presets·list_spatial_designs·find_tools·read_project_wiki 와 참고문서 여러 장을 돌지 않는다. 필요하면 read_tileset_reference({documentId:\"hand-interior-v5-plus\"}) 한 장만. 첫 시공 도구는 build_hand_interior_room 이다.";

const PROGRAM_GUIDE: Record<InteriorPlusTheme, string> = {
  museum: "박물관·미술관 → layout:{program:\"museum\"}(입구 홀 museum_lobby · 미술 전시실 museum_gallery · 유물실 museum_relics · 조각실 museum_sculpture · 자연사실 museum_natural). 전시실 하나만이면 layout:{rooms:[{kind:\"museum_lobby\"},{kind:\"museum_gallery\"}]}.",
  ship: "배 안 → 위 갑판 layout:{program:\"ship\"}(선장실 ship_cabin · 조타실 ship_helm · 배 주방 ship_galley · 선원 숙소 ship_crew), 아래 갑판 layout:{program:\"ship_hold\"}(포 갑판 ship_gundeck · 화물칸 ship_cargo · 배 감방 ship_brig). 말한 방만 고르려면 rooms:[{kind:\"ship_cabin\"},{kind:\"ship_cargo\"}] — 출입 방(ship_crew 또는 ship_cargo)을 하나 넣는다.",
  arena: "투기장·콜로세움 → layout:{program:\"arena\"}(관중석 arena_stands · 모래 마당 arena_floor · 검투사 방 gladiator_cell×2 · 무기고 arena_armory). 관중석은 모래 마당 바로 위(북쪽)에 붙고 칸막이 없이 트인다 — 도구가 맞춘다.",
};

export function formatInteriorPlusNote(target: InteriorPlusTarget, targetMap: { id: string; width: number; height: number } | null): string {
  const where = target.mapId && !target.lived
    ? `지금 맵 '${target.mapId}'(${targetMap?.width ?? "?"}×${targetMap?.height ?? "?"})은 손 도트 실내이고 비어 있다 → build_hand_interior_room({mapId:'${target.mapId}', layout}) 로 이 맵에 짓는다.`
    : target.mapId
      ? `지금 맵 '${target.mapId}' 는 손 도트 실내이고 이미 내용이 있다 → 다시 짓는 요청이면 replace:true, 더하는 요청이면 새 맵(mapId 생략)으로 짓는다.`
      : "새 맵이다 → build_hand_interior_room({tileset:\"atlas_biome_interior\", name, layout}) 가 맵을 만들어 짓는다(mapId 생략). 지금 보는 맵은 건드리지 않는다.";
  return [
    `[박물관·배 안·투기장 실내 — atlas_biome_interior] 이 요청은 손 도트 실내 칩셋의 ${target.themes.map((t) => ({ museum: "박물관·미술관", ship: "배 안", arena: "투기장" })[t]).join("·")} 방 종류로 짓는다. 고딕 저택(build_gothic_place)·해적 군도(compose_pirate_isles_map)·버들항 도구는 쓰지 않는다.`,
    where,
    ...target.themes.map((t) => PROGRAM_GUIDE[t]),
    SUBSET_GUIDE,
    READ_GUIDE,
    "순서: build_hand_interior_room 한 번(layout 이 방 크기·칸막이·문·방마다 예제 가구 한 벌을 정한다) → show_map_region 으로 원본 크기 확인 → check_reachability. 가구를 바꾸고 싶을 때만 list_hand_interior_parts({room:\"museum\"|\"ship\"|\"ship_hold\"|\"arena\"}) 로 방마다 쓰인 가구를 보고 data.rebuild 를 고쳐 replace:true.",
    "평면 문자열이나 큰 네모 한 칸으로 직접 그리지 않는다. 바닥이 비어 보여도 가구를 흩뿌리지 않는다 — 관람 통로·배 안 통로·모래 마당은 비어 있는 것이 쓰임이다. 그림·명판에는 글자가 없다.",
  ].join("\n");
}
