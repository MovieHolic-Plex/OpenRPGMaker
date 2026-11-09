// 폴른 스타 — 수납을 열 때의 연출을 물건 종류마다 다르게(오너 2026-11-09 「'여는 연출' 이 하나로 통일되어있음. 오브젝트마다 달라야한단말이다」).
//
// 데이터만 둔다. 연출은 엔진에 이미 있는 내장 수납 연출(showAnimation `fx:container:<종류>`, project/containerFx.ts ·
// player/playSceneFieldFx.ts)과 효과음(playAudio se)·이모트로 짠다. 엔진 명령은 새로 만들지 않는다.
//  - 종류는 수납 이벤트 이름(「수납 · 생선 상자」)의 낱말로 고른다. 위에서부터 처음 맞는 줄.
//  - style: 엔진 연출 종류(소리·흔들림·뚜껑·파편·뒤진 흔적). 종류마다 소리 하나가 따라온다.
//  - extra: 엔진 연출에 덧붙이는 짧은 소리(같은 종류 안에서도 귀로 구별되게) — 번들 CC0/EasyRPG 효과음만.
//  - 전부 0.6초 안에 끝난다. 연출은 showAnimation wait 라 컷신 건너뛰기(Esc 두 번)로 넘길 수 있다.
//  - 보상·플래그·집주인 시야는 건드리지 않는다 — 시끄러운 종류도 들음 거리는 0(예전과 같다).
//
// 없는 그림(빠진 자산): 이 칩셋에는 통·옷장·항아리·서랍의 「열린」 그림 칸이 없다. 그래서 칸 그림을 바꾸지 않고
// 엔진이 칸 위에 그리는 뒤진 흔적(lid-open · pried · lid-off · drawer · spill)으로 대신한다.
import type { ContainerStyle } from "@/project/containerFx";

export type FallenOpenKind = "chest" | "crate" | "barrel" | "wardrobe" | "drawer" | "jar" | "basket" | "sack" | "bag";

export interface FallenOpenEffect {
  readonly kind: FallenOpenKind;
  readonly match: RegExp;
  readonly style: ContainerStyle;
  readonly extraSe?: string;
  readonly note: string;
}

/** 위에서부터 처음 맞는 줄. 「궤짝」은 「상자」보다, 「서랍장」·「찬장」은 「통」보다 먼저 본다. */
export const FALLEN_OPEN_EFFECTS: readonly FallenOpenEffect[] = [
  {
    kind: "wardrobe", match: /옷장|장롱/, style: "drawer", extraSe: "easyrpg-sound-close1",
    note: "옷장: 경첩이 삐걱이며 문짝이 열린다(삐걱+덜컥), 먼지 몇 점, 빠진 문 흔적",
  },
  {
    kind: "drawer", match: /서랍|협탁|화장대|찬장/, style: "drawer", extraSe: "cc0-se-osx-paper-04",
    note: "서랍·찬장: 나무 서랍이 미끄러져 나오는 탁 소리와 속을 뒤지는 바스락, 서랍 빠진 흔적",
  },
  {
    kind: "chest", match: /궤짝|보물|트렁크/, style: "chest", extraSe: "easyrpg-sound-key",
    note: "궤짝: 묵직한 걸쇠가 풀리고 뚜껑이 젖혀지며 금빛 반짝임",
  },
  {
    kind: "bag", match: /가방/, style: "chest", extraSe: "cc0-se-osx-key-open-01",
    note: "가방: 버클이 짤랑 풀리고 덮개가 젖혀진다(작은 반짝임)",
  },
  {
    kind: "barrel", match: /통/, style: "barrel", extraSe: "cc0-se-orp-inventory-cloth",
    note: "통: 손마디로 통통 두드리고 흔들어 본다, 나무 뚜껑이 벗겨진 흔적",
  },
  {
    kind: "jar", match: /항아리|단지|독/, style: "jar", extraSe: "cc0-se-ors-wood-04",
    note: "항아리: 사기 뚜껑을 살짝 들어 올리는 맑은 팅 소리, 흔들림 거의 없음",
  },
  {
    kind: "basket", match: /바구니/, style: "straw", extraSe: "cc0-se-osx-paper-03",
    note: "바구니: 마른 풀이 바스락거리며 흘러나온다",
  },
  {
    kind: "sack", match: /자루|포대/, style: "sack", extraSe: "cc0-se-ors-chain-01",
    note: "자루: 묵직한 천 자루를 풀자 낟알이 사르륵 쏟아진다",
  },
  {
    kind: "crate", match: /상자|짐짝/, style: "crate",
    note: "상자: 못 박힌 판자를 비집어 연다(둔탁한 쿵, 나무 조각 튐)",
  },
];

/** 수납 이름표(「수납 · 」 접두는 있어도 없어도 된다)의 여는 연출. 모르는 이름은 상자. */
export function fallenOpenEffectFor(name: string): FallenOpenEffect {
  const label = name.replace(/^수납 · /, "");
  return FALLEN_OPEN_EFFECTS.find((e) => e.match.test(label)) ?? FALLEN_OPEN_EFFECTS[FALLEN_OPEN_EFFECTS.length - 1]!;
}
