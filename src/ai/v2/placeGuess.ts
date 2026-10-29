// 청사진 장소 이름 → 짓는 명세(PlaceSpec) 추정 — 끝맺음 단계가 모델이 짓지 않은 청사진 장소를 대신 지을 때 쓴다.
//
// 왜(2026-10-28 스위트): 싼 모델은 청사진에 장소 셋을 적고 하나만 짓고 끝냈다(blueprint-place-missing/unreachable).
// 이름 낱말로 종류를 정하고(서재·여관·교실 → 실내, 동굴 → 동굴, 마을·저잣거리 → 마을…), 모르면 장르 기본.
// 화풍(style)은 이 게임에 이미 있는 같은 종류 맵의 칩셋에서 물려받는다 — 칩셋 계열을 섞지 않는다.
import type { Project } from "@/project/types";
import type { PlaceSpec, PlaceType } from "./types";

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

/** 장소 종류 하나 — 이름이 말하지 않으면 장르·요청으로. */
export function guessPlaceType(name: string, genre: string, task: string): PlaceType {
  if (CAVE.test(name)) return "cave";
  if (INTERIOR.test(name)) return "interior";
  if (DUNGEON.test(name)) return "dungeon";
  if (VILLAGE.test(name)) return "village";
  if (STREET.test(name)) return /현대|도시|서울|도쿄|일본|modern|city/iu.test(`${genre} ${task}`) ? "street" : "village";
  if (FIELD.test(name)) return "dungeon"; // 바깥 들판 빌더가 없다 — 숲 던전(테마 forest)이 가장 가깝다
  if (/모험|jrpg|rpg|판타지|용사|마왕/iu.test(genre)) return "village";
  return "interior"; // 방탈출·추리·공포·연애·일상 — 건물 안이 기본
}

/** 이름·장르·요청·이미 있는 맵으로 짓는 명세 하나. */
export function guessPlaceSpec(name: string, project: Project, genre: string, task: string): PlaceSpec {
  const type = guessPlaceType(name, genre, task);
  // 같은 종류(실내끼리·바깥끼리)의 기존 맵 칩셋 계열에서 style 을 물려받는다.
  const inside = type === "interior" || type === "house";
  // 같은 종류 맵이 하나라도 있으면 그 칩셋이 정답이다(기본 손 도트 실내면 style 없음 = fantasy) — 요청 낱말로 다른 계열을 고르지 않는다
  // (standin magic: 「마법학교」 낱말로 wizarding 을 골랐다가 atlas_biome_interior 맵과 계열이 달라 거부됐다).
  const sameKind = Object.values(project.maps).find((m) => {
    const indoor = (m as unknown as { climate?: { mode?: string } }).climate?.mode === "indoor" || /interior|wizard|sengoku|modern_city|campus|gothic/u.test(m.tilesetId);
    return indoor === inside;
  });
  const fromTask = /마법\s*학교|호그와트|wizard/iu.test(`${genre} ${task}`) ? "wizarding" : /전국|에도|사무라이|sengoku/iu.test(`${genre} ${task}`) ? "sengoku" : undefined;
  const style = sameKind ? styleOfTileset(sameKind.tilesetId) : fromTask;
  const theme = type === "dungeon" && FIELD.test(name) ? "forest" : undefined;
  return { type, name, ...(style ? { style } : {}), ...(theme ? { theme } : {}), size: "small" };
}
