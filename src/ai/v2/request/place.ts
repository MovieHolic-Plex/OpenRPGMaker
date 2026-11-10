// 장소 요청 낱말 — 장소를 짓는 말, 실내, 덧그릴 지형, 작은 방, 들어가는 장소(동굴·던전).
import type { PlaceSpec } from "../types";
import type { Side } from "../transferSpot";

/** 장소를 짓거나 다시 짓는 요청 낱말 — 장소 이름 뒤 열두 글자 안에 짓기 동사, 또는 «새 ○○». 넉넉히 잡는다(잘못 맞으면 예전처럼 다 실을 뿐이다). */
const PLACE_NOUNS = "맵|지도|마을|도시|거리|골목|던전|동굴|미궁|탑|성|궁|방|실내|집|건물|가게|상점|여관|주점|교회|성당|신전|사당|숲|들판|필드|평원|항구|부두|광장|학교|병원|저택|감옥|지하|층|섬|산|장소|무대|공간|place|map|village|town|city|dungeon|cave|room|house|building|interior|street";

const BUILD_VERBS = "만들|지어|짓|그려|그리|깔아|깔|넓혀|넓히|키워|늘려|추가|하나 더|고쳐|바꿔|꾸며|꾸미|배치|build|make|add|create|expand|redesign|rebuild|draw";

export const PLACE_BUILD_WORDS = new RegExp(`(${PLACE_NOUNS})[^.!?\\n]{0,12}(${BUILD_VERBS})|(새|새로운|new)\\s*(${PLACE_NOUNS})`, "iu");

/** 실내 칸 배치용 칩셋 목록 카드(영어, 만든 것) — 실내 요청이거나 지금 맵이 손 도트 실내일 때만 싣는다(약 4k 토큰). */
export const INTERIOR_WORDS = /실내|방|여관|주점|선술집|객잔|가게|상점|잡화|서재|도서|서고|감옥|뇌옥|감방|교회|성당|예배당|대장간|길드|집\s*안|부엌|연구실|inn|tavern|shop|store|library|study|jail|prison|room|interior|chapel|forge|guild|kitchen/iu;

/** 이미 있는 맵에 물길·다리·작은 물건을 덧그리는 요청(맵을 새로 짓지 않는다) — v1 결정론 덧그리기 도구 셋. */
export const TERRAIN_WORDS = /다리\s*(를|가|위|에|앞|옆|건너|밑|아래|목)|돌다리|나무다리|강을|강이|강물|강 상류|강 하류|개울|냇물|시냇|연못을|물길|폭포|레버|팻말|표지판|간판|bridge|lever|signpost/iu;

export function wantsTerrainTools(task: string): boolean {
  return TERRAIN_WORDS.test(task);
}

/** 요청이 정말 작은 방인가(한 구역을 허락) — designAreas.wantsSmallRoom 과 같은 낱말. */
export const SMALL_ROOM_WORDS = /작은\s*방|좁은|조그만|자그마한|단칸|한\s*칸|골방|cramped|tiny|small room/iu;

/** 요청이 정말 작은 방인가(한 구역을 허락) — loop/roomZones.ts 의 SMALL_ROOM_WORDS 와 같은 낱말. */
export function wantsSmallRoom(spec: PlaceSpec, task: string): boolean {
  return spec.size === "small" || /작은\s*방|좁은|조그만|자그마한|단칸|한\s*칸|골방|창고\s*하나|cramped|tiny|small room/iu.test(task);
}

/** 요청 글에서 들어가는 장소(동굴·던전·광산…) 낱말 — 그림 한 장(draw_object)이 아니라 make_place 로 지을 장소다. */
export const DUNGEON_PLACE_WORD = /동굴|동혈|굴\s*입구|던전|광산|갱도|미궁|지하\s*(?:묘지|감옥|수로)|cave|cavern|dungeon|\bmine\b/i;

const KO_SIDE: Record<string, Side> = { 동: "east", 서: "west", 남: "south", 북: "north" };

/** 「마을 서쪽 길 끝에 동굴」처럼 요청이 그 장소의 세계 방향을 말하면 그 쪽. 없으면 undefined(설계 입구 쪽을 쓴다). */
export function requestedDungeonSide(task: string): Side | undefined {
  const a = task.match(/(동|서|남|북)\s*쪽[^.!?\n]{0,16}?(?:동굴|동혈|굴|던전|광산|갱도|미궁)/);
  if (a) return KO_SIDE[a[1]!];
  const b = task.match(/(?:동굴|동혈|던전|광산|갱도|미궁)[^.!?\n]{0,8}?(동|서|남|북)\s*쪽/);
  if (b) return KO_SIDE[b[1]!];
  const c = task.match(/\b(north|south|east|west)(?:ern)?\b[^.!?\n]{0,24}?\b(?:cave|cavern|dungeon|mine)\b/i);
  return c ? (c[1]!.toLowerCase() as Side) : undefined;
}
