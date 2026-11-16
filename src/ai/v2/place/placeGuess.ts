// 청사진 장소 이름 → 짓는 명세(PlaceSpec) 추정 — 끝맺음 단계가 모델이 짓지 않은 청사진 장소를 대신 지을 때 쓴다.
//
// 왜(2026-10-28 스위트): 싼 모델은 청사진에 장소 셋을 적고 하나만 짓고 끝냈다(blueprint-place-missing/unreachable).
// 종류는 모델이 그 장소에 대해 이미 말한 것에서 먼저 온다(placeSpecFor) — 없을 때만 이름 낱말(서재·여관·교실 = 실내, 동굴 = 동굴, 마을·저잣거리 = 마을…).
// 화풍(style)은 이 게임에 이미 있는 같은 종류 맵의 칩셋에서 물려받는다 — 칩셋 계열을 섞지 않는다.
import type { Project } from "@/project/types";
import type { PlaceSpec, PlaceType } from "../shared/types";

const INTERIOR = /실$|방$|관측실|서재|교실|강의실|도서관|서고|여관|주막|객잔|가게|상점|잡화점|대장간|식당|부엌|주방|창고|사무실|침실|거실|기숙사|학교|학당|교회|성당|예배당|포도청|관청|관아|저택|대저택|집$|집 안|오두막|공방|연구소|연구실|실험실|술집|선술집|주점|홀$|복도|왕좌|알현|성 안|궁$|궁전|병원|의원|약방|카페|찻집|빵집|역사$|박물관|미술관|study|library|inn|tavern|shop|room|hall|house|manor|lab|office|church|chapel|school|classroom/iu;
const CAVE = /동굴|굴$|광산|광맥|cave|mine|grotto/iu;
const DUNGEON = /던전|미궁|유적|폐허|지하 ?묘지|카타콤|묘지|신전|사원|성채|요새|지하 ?감옥|감옥|탑$|탑 |하수도|dungeon|tower|ruin|crypt|catacomb|temple|fortress|sewer|lair|소굴/iu;
const VILLAGE = /마을|촌$|항구|포구|저잣거리|장터|시장|읍내|읍$|성읍|town|village|harbor|port/iu;
const STREET = /거리|골목|역 ?앞|상점가|번화가|street|alley/iu;
const FIELD = /숲|들판|초원|평원|고개|산길|오솔길|forest|woods|field|meadow/iu;

/** 맵 칩셋 → 이 계열 실내·거리를 짓는 style. */
function styleOfTileset(tilesetId: string): string | undefined {
  if (/wizard/u.test(tilesetId)) return "wizarding";
  if (/sengoku|edo/u.test(tilesetId)) return "sengoku";
  if (/jp_city/u.test(tilesetId)) return "jp-modern";
  if (/modern_city|modern_campus|kr_modern/u.test(tilesetId)) return "modern";
  return undefined;
}

/**
 * 이름 낱말만으로 정해지는 장소 종류(모르면 undefined) — 끝맺음이 모델이 지은 맵을 청사진 장소에 이을 때 실내/바깥이 맞는지 본다.
 * 마을은 이름의 끝 낱말이 마을 낱말일 때만이다(「갈매기 포구」 = 마을, 「포구 회관」 = 포구에 있는 회관 — 앞 낱말은 꾸미는 말이다).
 * 마을은 틀렸을 때 가장 비싼 종류라(큰 맵 한 장) 꾸미는 말만으로는 정하지 않는다.
 */
export function placeTypeFromName(name: string): PlaceType | undefined {
  if (CAVE.test(name)) return "cave";
  if (INTERIOR.test(name)) return "interior";
  if (DUNGEON.test(name)) return "dungeon";
  const last = name.trim().split(/\s+/u).at(-1) ?? "";
  if (VILLAGE.test(last)) return "village";
  if (STREET.test(name)) return "street";
  if (FIELD.test(name)) return "dungeon";
  // 「○○ 안」 · 「○○ 내부」 는 이름이 스스로 «어느 곳의 안» 이라고 말한다(「방앗간 안」).
  return /^(?:안|내부)$/u.test(last) ? "interior" : undefined;
}

/**
 * 모델이 이 실행에서 그 장소에 대해 말한 것 — 끝맺음 자동 짓기는 이름 낱말로 추측하기 전에 이것을 읽는다(V2Session.placeFacts).
 * asked = make_place 로 보낸 마지막 명세(거절됐어도 남는다) · kind = 세계 없는 청사진의 places 나 할 일 목록에 적은 종류 · from = 청사진에 적은 앞 장소.
 */
export interface PlaceFacts { readonly asked?: PlaceSpec; readonly kind?: string; readonly from?: string }

/** 장소 사실의 열쇠 — 공백을 뺀 이름(청사진의 place 와 make_place 의 name 은 같은 이름을 쓴다). */
export const placeFactKey = (name: string): string => name.normalize("NFC").replace(/\s+/gu, "").toLowerCase();

const TYPES: readonly PlaceType[] = ["interior", "village", "dungeon", "cave", "street", "house"];
/** 모델이 적은 종류 낱말이 곧 짓는 종류의 이름일 때만 그 종류 — «field» 는 바깥 들판이다(들판 빌더가 없어 숲 던전이 가장 가깝다). 세계의 종류 id(lake·tomb…)는 여기서 읽지 않는다. */
function typeFromKind(kind: string | undefined): { type: PlaceType; theme?: string } | undefined {
  const k = (kind ?? "").trim().toLowerCase();
  if (k === "field") return { type: "dungeon", theme: "forest" };
  return (TYPES as readonly string[]).includes(k) ? { type: k as PlaceType } : undefined;
}

/** 실내 맵인가 — 실내 기후 또는 실내 칩셋. 이미 선 맵은 이름이 아니라 맵이 사실이다. */
export const isIndoorMap = (m: { readonly tilesetId: string }): boolean =>
  (m as unknown as { climate?: { mode?: string } }).climate?.mode === "indoor" || /interior|wizard|sengoku|modern_city|campus|gothic/u.test(m.tilesetId);

/**
 * 청사진 장소 하나를 짓는 명세 — 아는 사실이 추측보다 먼저다:
 * ① 모델이 그 장소로 make_place 를 부른 적이 있으면 그 명세(종류·화풍·방 목록 — 거절됐어도. 거절된 칸 배치는 쓰지 않는다) ② 청사진·할 일에 적은 종류
 * ③ 이름이 말하는 종류 ④ 건물 안이 기본인 장르(방탈출·추리·공포·연애·일상)면 실내. 넷 다 없으면 undefined — 짓지 않고 모델에게 종류를 묻는다.
 * 왜(2026-11-15 확인 빌드 r6, r5a 재생): 모델이 실내로 청했다 칸 배치가 거절된 「방앗간 안」 을 끝맺음이 이름·장르로 추측해(모험 = 마을) 42×45 강마을 한 장으로 세웠다.
 * 「바닷가 등대」 · 「물때 어물전」 · 「포구 회관」 · 「말순네 농가」 도 같은 추측이었다 — 틀렸을 때 가장 비싼 쪽(마을 한 장)으로 조용히 떨어졌다.
 */
export function placeSpecFor(name: string, project: Project, genre: string, task: string, facts: PlaceFacts = {}): PlaceSpec | undefined {
  const asked = facts.asked;
  const fromKind = typeFromKind(facts.kind);
  const named = placeTypeFromName(name);
  const street = named === "street" && !/현대|도시|서울|도쿄|일본|modern|city/iu.test(`${genre} ${task}`) ? "village" : named;
  const type: PlaceType | undefined = asked?.type ?? fromKind?.type ?? street
    ?? (/모험|jrpg|rpg|판타지|용사|마왕/iu.test(genre) ? undefined : "interior");
  if (!type) return undefined;
  // 같은 종류(실내끼리·바깥끼리)의 기존 맵 칩셋 계열에서 style 을 물려받는다.
  const inside = type === "interior" || type === "house";
  // 같은 종류 맵이 하나라도 있으면 그 칩셋이 정답이다(기본 손 도트 실내면 style 없음 = fantasy) — 요청 낱말로 다른 계열을 고르지 않는다
  // (standin magic: 「마법학교」 낱말로 wizarding 을 골랐다가 atlas_biome_interior 맵과 계열이 달라 거부됐다).
  const sameKind = Object.values(project.maps).find((m) => isIndoorMap(m) === inside);
  const fromTask = /마법\s*학교|호그와트|wizard/iu.test(`${genre} ${task}`) ? "wizarding" : /전국|에도|사무라이|sengoku/iu.test(`${genre} ${task}`) ? "sengoku" : undefined;
  const style = asked?.style ?? (sameKind ? styleOfTileset(sameKind.tilesetId) : fromTask);
  const theme = asked?.theme ?? (!asked ? fromKind?.theme : undefined) ?? (type === "dungeon" && FIELD.test(name) ? "forest" : undefined);
  // 모델이 보낸 명세의 종류·화풍·방 목록·던전 설계는 그대로 쓴다 — 맵 id·씨앗(짓는 쪽이 새로 정한다)과 실내 칸 배치는 뺀다.
  // 칸 배치는 거절된 것이다: 걸리는 기물을 빼고 깔면 방이 휑하다(r5a 재생 선술집: 기물 26개짜리 배치에 문제 15건) — 방은 종전대로 설계를 따로 받는다(designMissingRooms).
  const { mapId: _mapId, salt: _salt, variety: _variety, gate: _gate, layout: _layout, ...rest } = (asked ?? {}) as PlaceSpec;
  return { ...(asked ? rest : {}), type, name, ...(style ? { style } : {}), ...(theme ? { theme } : {}), size: asked?.size ?? "small" };
}
