// 선사 시대 원시 세계(prehistoric) 조수 연결 — 선사·원시·석기·공룡·동굴 부족 요청이 «칩셋이 프로젝트에 있을 때만» 이 칩셋으로 가게 한다.
// steampunkCityPolicy·gothicPolicy 와 같은 모양(대상 판정 + 포인터 줄 + 상세 줄 + 노트)이다. 차이:
//  - 「동굴」 하나만으로는 잡지 않는다 — 그냥 동굴·던전·광산 요청은 던전 칩셋(beodeul_dungeon)의 몫이다. 동굴 벽화·동굴 거처·동굴 부족·혈거처럼
//    «사람이 사는 원시 동굴»을 말하거나, 선사·원시·석기·공룡 낱말이 같이 있을 때만 잡는다.
//  - 「부족」「화산」「늪」도 혼자서는 잡지 않는다(판타지 부족 마을·화산 던전과 겹친다). 원시·선사·석기·공룡·매머드 낱말이 함께 있어야 한다.
//  - 배치는 모델이 하지 않는다: compose_prehistoric_map 한 번이 마을·늪·화산 골짜기·화석 계곡 또는 실내 한 장을 짠다(prehistoricComposer.ts).
// 주의: 이 파일의 노트·문장은 모델 지시문에 실린다 — requestsModernMap 의 PAW 전용 게이트를 켜는 낱말(현대·모던·modern 한글/영문)을 쓰지 않는다.

import type { IntentDeclaration } from "@/ai/intentDeclaration";
import type { Project, TilesetDef } from "@/project/types";

export const PREHISTORIC_TILESET_ID = "prehistoric";
const PREHISTORIC_TEXTURE = "tex_prehistoric";

export function isPrehistoricTilesetDef(tileset: Pick<TilesetDef, "image"> | undefined): boolean {
  return tileset?.image.type === "bundled" && tileset.image.id === PREHISTORIC_TEXTURE;
}

/** 사용자가 칩셋을 직접 가리킨 식별자·이름. */
const NAMES_PREHISTORIC_RE = /\bprehistoric\b|oprn-prehistoric|선사\s*(?:시대\s*)?(?:칩셋|타일셋)/iu;
/** 시대 낱말(이것만으로 잡는다). */
const ERA_RE = /선사\s*(?:시대)?|원시\s*(?:시대|부족|인|세계|마을|사람|사냥|생활|동굴|정글|밀림)?|[구신]?석기\s*(?:시대)?|공룡|매머드|맘모스|화석\s*(?:계곡|발굴|지대|산지)|혈거|움집\s*마을|\b(?:prehistoric|stone\s*age|caveman|cavemen|dinosaurs?|mammoth|primeval|primitive\s+tribe)\b/iu;
/** 사람이 사는 원시 동굴(시대 낱말 없이도 잡는다). 그냥 「동굴」·「동굴 던전」은 아니다. */
const CAVE_DWELLING_RE = /동굴\s*(?:벽화|거처|집|부족|사람|인|주거|마을)|cave\s*(?:painting|dwelling|tribe)/iu;
/** 던전 요청 — 시대 낱말이 없으면 던전 칩셋 몫이다. */
const DUNGEON_RE = /던전|미궁|광산|지하\s*감옥|dungeon|labyrinth|mine\b/iu;

export function namesPrehistoricTileset(text: string | undefined): boolean {
  return !!text && NAMES_PREHISTORIC_RE.test(text);
}
/** 선사 원시 세계 풍경을 말한 문장인가. 동굴 던전은 시대 낱말이 있을 때만. */
export function describesPrehistoric(text: string | undefined): boolean {
  if (!text) return false;
  if (ERA_RE.test(text)) return true;
  return CAVE_DWELLING_RE.test(text) && !DUNGEON_RE.test(text);
}
export function hasPrehistoricTileset(project: Pick<Project, "tilesets">): boolean {
  const def = project.tilesets[PREHISTORIC_TILESET_ID];
  return !!def && isPrehistoricTilesetDef(def);
}

export type PrehistoricRoom = "cave-dwelling" | "chieftain-hut" | "shaman-hut" | "cave-gallery";
export type PrehistoricOutdoor = "village" | "swamp" | "volcano" | "fossil";
export interface PrehistoricTarget {
  readonly mapId?: string;
  readonly lived?: boolean;
  readonly room?: PrehistoricRoom;
  readonly outdoor?: PrehistoricOutdoor;
}

const INDOOR_RE = /실내|안\s*(?:쪽|모습)|내부|방\s*안|거처|벽화|interior|indoor|inside/iu;
const OUTDOOR_RE = /마을|계곡|골짜기|늪|습지|화산|들판|정글|밀림|숲|강가|부락|야영지|village|valley|swamp|volcano|jungle/iu;

/** 문장 → 야외 구성(부족 마을 · 늪지 · 화산 골짜기 · 화석 계곡). */
export function prehistoricOutdoorStyleFor(text: string): PrehistoricOutdoor {
  if (/화석|발굴|뼈\s*(?:무덤|계곡|밭)|공룡\s*(?:뼈|화석|무덤|계곡)|\b(?:fossil|bones?)\b/iu.test(text)) return "fossil";
  if (/화산|용암|분화구|\b(?:volcan\w*|lava)\b/iu.test(text)) return "volcano";
  if (/늪|습지|소택|타르|\b(?:swamp|marsh|bog|tar)\b/iu.test(text)) return "swamp";
  return "village";
}
/** 문장 → 실내 종류. 「동굴 벽화 거처」는 거처(벽화가 있는 동굴 집), 「벽화 회랑·성소」는 회랑. */
export function prehistoricRoomFor(text: string): PrehistoricRoom | null {
  if (/족장|추장|chief/iu.test(text)) return "chieftain-hut";
  if (/무당|주술사|샤먼|무녀|shaman/iu.test(text)) return "shaman-hut";
  if (/벽화\s*(?:회랑|동굴|성소|방)|회랑|성소|갤러리|gallery/iu.test(text) && !/거처|집|주거/u.test(text)) return "cave-gallery";
  if (/거처|동굴\s*(?:집|안|속|주거)|혈거|cave\s*dwelling/iu.test(text)) return "cave-dwelling";
  if (/벽화|cave\s*painting/iu.test(text)) return "cave-gallery";
  return null;
}

/**
 * 이 요청이 선사 칩셋 작업인가.
 *  - 대상 맵이 이미 prehistoric 이면 그 맵(생성·수정만).
 *  - 아니면 «생성» 요청이 칩셋 이름을 부르거나 선사·원시·석기·공룡·동굴 부족을 말했을 때 새 맵 — **프로젝트에 칩셋이 있을 때만**.
 */
export function prehistoricTargetFor(
  project: Pick<Project, "tilesets" | "maps">,
  intent: Pick<IntentDeclaration, "mode" | "space" | "source">,
  requestText: string | undefined,
  mapId: string | null | undefined,
  lived: boolean,
): PrehistoricTarget | null {
  if (intent.source !== "llm" || (intent.mode !== "create" && intent.mode !== "modify")) return null;
  if (!hasPrehistoricTileset(project)) return null;
  const text = requestText ?? "";
  const map = mapId ? project.maps[mapId] : undefined;
  const room = prehistoricRoomFor(text);
  const indoorAsk = intent.space === "interior" || (!!room && (INDOOR_RE.test(text) || !OUTDOOR_RE.test(text)));
  if (map && isPrehistoricTilesetDef(project.tilesets[map.tilesetId])) {
    return indoorAsk && room ? { mapId: map.id, lived, room } : { mapId: map.id, lived, outdoor: prehistoricOutdoorStyleFor(text) };
  }
  if (intent.mode !== "create") return null;
  if (!NAMES_PREHISTORIC_RE.test(text) && !describesPrehistoric(text)) return null;
  if (indoorAsk) return { room: room ?? "cave-dwelling" };
  return { outdoor: prehistoricOutdoorStyleFor(text) };
}

export function scopeUsesPrehistoric(project: Pick<Project, "tilesets" | "maps">, mapIds: readonly string[]): boolean {
  return mapIds.some((id) => isPrehistoricTilesetDef(project.tilesets[project.maps[id]?.tilesetId ?? ""]));
}

/** 첫 요청부터 스키마가 보여야 하는 도구. */
export const PREHISTORIC_EXPOSED_TOOLS: readonly string[] = [
  "list_tileset_references", "read_tileset_reference", "compose_prehistoric_map", "link_prehistoric_interior",
  "create_map", "resize_map", "list_tileset_objects", "stamp_tileset_object", "check_reachability", "show_map_region", "ask_tileset_change",
];

export const PREHISTORIC_POINTER_LINE =
  "선사 시대·원시 부족·석기 시대·공룡·매머드·동굴 벽화 풍경은 번들 칩셋 prehistoric 으로 짓는다(그냥 동굴·던전·광산은 던전 칩셋이다): "
  + "야외·실내 모두 compose_prehistoric_map 한 번으로 한 장을 짠다 — style:\"village\"(모닥불 광장 + 움집·족장 집·무당 천막 + 동굴 입구 + 작업터 + 개울과 밧줄 다리, 44×34 이상) | "
  + "\"swamp\"(진흙 늪 웅덩이 + 둑길 + 늪 나무·갈대·타르 웅덩이 + 흙 섬 움집, 40×30 이상) | \"volcano\"(화산 언덕 + 용암 웅덩이·굳은 용암 + 현무암 동굴 + 사냥 야영지, 40×32 이상) | "
  + "\"fossil\"(공룡 뼈대 발굴터 + 갈비뼈·머리뼈 화석 + 발자국 진흙 + 바위 능선 + 발굴 야영지, 42×32 이상) | 실내 \"cave-dwelling\"|\"cave-gallery\"|\"chieftain-hut\"|\"shaman-hut\". "
  + "새 맵이 필요하면 newMap:{name} 만 주면(크기 생략 권장 — 기본 크기가 가장 알차다) 도구가 칩셋·크기를 맞춰 만든다. 바닥 가장자리·집·소품 자리·문 앞 비움·통행은 구성기가 정한다 — 낱칸 번호로 다시 칠하거나 소품을 흩뿌리지 않는다. "
  + "씨앗(seed)을 바꾸면 다른 배치가 나온다. 집·동굴 문 ↔ 실내는 link_prehistoric_interior 로 잇는다. 사람은 Actor1 캐릭터 이벤트로 놓는다.";

export const PREHISTORIC_DETAIL_LINE =
  "이 작업의 맵은 선사 칩셋(prehistoric)이다. ① 다시 짜려면 compose_prehistoric_map({style, seed, replace:true}) — 이벤트는 남는다. ② 결과 data.buildings[].doors 가 집·동굴 문 칸(막힘)이고 바로 아래 줄이 접근칸이다(이동 이벤트는 접근칸에). "
  + "③ 바닥 가장자리(w-*)는 꼭짓점 격자로 맞물린 조각이라 손으로 칠하지 않는다. 소품을 더할 때는 list_tileset_objects({tilesetId:\"prehistoric\"}) → stamp_tileset_object 로 키트째 찍고, 자기 바닥에만 둔다(늪 나무·갈대는 진흙, 고목·현무암은 화산재, 화석은 흙·자갈). 문 접근칸·길·다리를 막지 않는다. "
  + "④ check_reachability 로 시작 칸 → 모든 문까지 이어지는지 확인한다.";

export function prehistoricPromptLines(project: Pick<Project, "tilesets" | "maps">, mapIds: readonly string[]): string[] {
  if (!hasPrehistoricTileset(project)) return [];
  return scopeUsesPrehistoric(project, mapIds) ? [PREHISTORIC_POINTER_LINE, PREHISTORIC_DETAIL_LINE] : [PREHISTORIC_POINTER_LINE];
}

const ROOM_KO: Readonly<Record<PrehistoricRoom, string>> = { "cave-dwelling": "동굴 거처", "cave-gallery": "동굴 벽화 회랑", "chieftain-hut": "족장 집 안", "shaman-hut": "무당 천막 안" };
const OUT_KO: Readonly<Record<PrehistoricOutdoor, string>> = { village: "원시 부족 마을", swamp: "원시 늪지", volcano: "화산 골짜기", fossil: "공룡 화석 계곡" };

export function formatPrehistoricNote(target: PrehistoricTarget, targetMap: { id: string; width: number; height: number } | null): string {
  const head = "[선사 원시 세계 — prehistoric 칩셋] 이 요청의 칩셋은 번들 선사 칩셋(prehistoric)이다. author_beodeul_town(버들항)·던전 칩셋·손 도트 판타지 실내(build_hand_interior_room)는 쓰지 않는다(시대·칩셋이 다르다).";
  if (target.room) {
    const where = target.mapId && !target.lived
      ? `지금 맵 '${target.mapId}' 은 선사 칩셋이고 비어 있다 → compose_prehistoric_map({mapId:"${target.mapId}", style:"${target.room}"}) (맵이 작으면 resize_map 먼저).`
      : `새 실내 맵: compose_prehistoric_map({style:"${target.room}", newMap:{name:"${ROOM_KO[target.room]}"}}) — 도구가 칩셋·크기를 맞춰 맵을 만들고 방을 짓는다.`;
    return [head, `요청은 실내(${ROOM_KO[target.room]})다. ${where}`,
      "방은 천장 바위·북쪽 벽면 두 줄(동굴은 열마다 높이가 오르내린다)·바닥·남쪽 출입구 틈(2칸)으로 지어지고, 벽화·벽걸이는 벽면에, 가구는 방 종류 규칙(화덕은 가운데, 잠자리·제단·족장 자리는 북쪽 벽 앞, 출입구 앞 비움)대로 놓인다. "
      + "야외 집·동굴과 잇는다면 그 다음 link_prehistoric_interior."].join("\n");
  }
  const style = target.outdoor ?? "village";
  const where = target.mapId && !target.lived
    ? `지금 맵 '${target.mapId}'(${targetMap?.width ?? "?"}×${targetMap?.height ?? "?"}) 은 선사 칩셋이고 비어 있다 → 이 맵에 짓는다(작으면 resize_map 먼저).`
    : target.mapId
      ? `지금 맵 '${target.mapId}' 는 선사 칩셋이고 이미 내용이 있다 → 다시 짜려면 replace:true(이벤트는 남는다), 더하기만 하려면 stamp_tileset_object.`
      : `선사 맵이 아직 없다 → compose_prehistoric_map({style:"${style}", newMap:{name:"${OUT_KO[style]}"}}) 가 칩셋·크기를 맞춰 새 맵을 만들고 짓는다. 지금 보는 맵이 다른 계열이어도 새 맵이라 괜찮다.`;
  return [head, `요청은 야외(${OUT_KO[style]})다 → style:"${style}". ${where}`,
    "순서: (원하면 list_tileset_references → read_tileset_reference 로 배치 규칙·예제를 읽는다) → compose_prehistoric_map 한 번 → 결과 data.buildings 의 동굴·집 문마다 실내가 필요하면 같은 도구 style:\"cave-dwelling\"|\"chieftain-hut\"|\"shaman-hut\"|\"cave-gallery\" 의 newMap 으로 실내를 짓고 link_prehistoric_interior 로 잇는다 → check_reachability."].join("\n");
}

/** 컨셉 카드의 무대 낱말 → 타일셋 id. 같은 줄이 harness-data/game-concepts/seed.json tilesetHints 와 src/concepts/format.ts BUILDABLE_CONCEPT_TILESETS 에 있다. */
export const PREHISTORIC_CONCEPT_HINT: Readonly<Record<string, string>> = { "선사 시대·원시 부족·공룡 세계": PREHISTORIC_TILESET_ID };
