// src/editor/workshop/oneClick/infer.ts
/**
 * 공방 「한 번에 만들기」(2026-10-23, 사용자 「딸깍 하고 나오는 수준이어야」) — 한 줄 부탁에서 나머지를 정하는 순수 모듈(DOM 없음).
 * 물건: 놓는 방식(바닥·벽 걸이·깔개). 크기·발밑·종류는 조수 도구와 같은 크기 사전(footprint.decideFootprint)이 정한다.
 * 지형: tile-gen 종류·프리셋(--mode). 캐릭터: 바탕 칩은 호스트(scripts/lib/workshopGen.mjs chooseCharBase)가 고른다.
 */
import type { ObjectGenKind } from "../objectRequest";

export type OneClickKind = "object" | "character" | "terrain";

export const ONE_CLICK_KINDS: readonly { readonly id: OneClickKind; readonly label: string; readonly placeholder: string; readonly examples: readonly string[] }[] = [
  { id: "object", label: "물건", placeholder: "예: 낡은 우물", examples: ["낡은 우물", "나무 벤치", "꽃 화분"] },
  { id: "character", label: "캐릭터", placeholder: "예: 검은 머리 여고생", examples: ["검은 머리 여고생", "파란 외투 선원", "밀짚모자 농부"] },
  { id: "terrain", label: "지형", placeholder: "예: 용암 바닥", examples: ["용암 바닥", "눈 덮인 땅", "돌 포장길"] },
];

const HANG = /(액자|그림|간판|시계|거울|포스터|깃발|현수막|벽걸이|벽등|횃불걸이|선반|창문|커튼|frame|painting|sign|clock|mirror|poster|banner|shelf|curtain)/iu;
const FLAT = /(깔개|러그|카펫|양탄자|매트|돗자리|멍석|발판|맨홀|배수구|rug|carpet|mat|manhole|drain)/iu;

/** 놓는 방식 — 이름으로 정한다. 모르면 바닥에 세우는 물건. */
export function inferObjectKind(text: string): ObjectGenKind {
  if (FLAT.test(text)) return "flat";
  if (HANG.test(text) && !/(받침|스탠드|거치대|stand)/iu.test(text)) return "hang";
  return "floor";
}

/** 한 줄 부탁 → 물건 이름(짧은 명사구)과 설명. 사용자가 「낡은 우물」만 적으면 이름도 설명도 그것이다. */
export function objectTitleAndDescription(text: string): { title: string; description: string } {
  const clean = text.trim().replace(/\s+/g, " ");
  const [head, ...rest] = clean.split(/[.,。,]\s*/u);
  const title = (head ?? clean).slice(0, 24).trim() || clean.slice(0, 24);
  return { title, description: rest.length ? clean : `${clean}. 1배에서 바로 그 물건으로 알아보게, 그 물건의 가장 큰 특징 두세 가지를 살려 그린다.` };
}

/** tile-gen --mode 값 — 종류 다섯(floor·autotile·water·forest·cliff) + 재질 프리셋. */
export type TerrainModeId = "floor" | "autotile" | "water" | "forest" | "cliff"
  | "lava" | "swamp" | "poison" | "deep_water" | "beach" | "snow" | "ice" | "sand" | "road" | "cobble" | "meadow";

const TERRAIN_WORDS: readonly (readonly [RegExp, TerrainModeId])[] = [
  [/(용암|마그마|lava|magma)/iu, "lava"],
  [/(늪|진흙탕|swamp|bog|marsh)/iu, "swamp"],
  [/(독|오염|poison|toxic)/iu, "poison"],
  [/(깊은 ?물|심해|deep)/iu, "deep_water"],
  [/(바닷가|해변|모래사장|파도|beach|shore)/iu, "beach"],
  [/(얼음|빙판|ice)/iu, "ice"],
  [/(눈|설원|snow)/iu, "snow"],
  [/(사막|모래|sand|desert)/iu, "sand"],
  [/(돌길|돌 ?포장|자갈|보도블록|석재 ?길|cobble|paving)/iu, "cobble"],
  [/(흙길|오솔길|길|도로|road|path|trail)/iu, "road"],
  [/(꽃밭|꽃|meadow|flower)/iu, "meadow"],
  [/(숲|수풀|forest|woods)/iu, "forest"],
  [/(절벽|낭떠러지|바위벽|cliff)/iu, "cliff"],
  [/(연못|호수|강|물|pond|lake|river|water)/iu, "water"],
  [/(풀밭|잔디|초원|grass)/iu, "autotile"],
];

/** 지형 종류 — 낱말로 정한다. 모르면 이음매 없는 바닥 채우기(가장 단순하고 빨리 끝난다). */
export function inferTerrainMode(text: string): TerrainModeId {
  return TERRAIN_WORDS.find(([pattern]) => pattern.test(text))?.[1] ?? "floor";
}

/** 지형 종류의 쉬운 이름(진행 카드·자세히). */
export const TERRAIN_MODE_LABELS: Readonly<Record<TerrainModeId, string>> = {
  floor: "바닥 채우기", autotile: "가장자리 자동 타일", water: "물가·움직이는 물", forest: "숲 바닥 + 나무", cliff: "절벽·단",
  lava: "용암", swamp: "늪", poison: "독 웅덩이", deep_water: "깊은 물", beach: "바닷가", snow: "눈 덮인 땅", ice: "얼음판",
  sand: "사막 모래", road: "흙길", cobble: "돌길", meadow: "꽃밭",
};

/**
 * 지형이 색을 따를 「참고 칸」 — 지금 맵 아래층에서 가장 많이 쓴 칸들(땅). 그 칸이 바탕 시트 안(번들 칸)일 때만 쓴다(이식 칸은 시트에 없다).
 * 돌려주는 값은 시트의 (열, 행). 최대 2칸.
 */
export function terrainRefCells(lowerTiles: readonly number[], sheetCount: number, tilesPerRow: number, limit = 2): [number, number][] {
  const counts = new Map<number, number>();
  for (const tile of lowerTiles) if (Number.isInteger(tile) && tile >= 0 && tile < sheetCount) counts.set(tile, (counts.get(tile) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0]).slice(0, limit).map(([tile]) => [tile % tilesPerRow, Math.floor(tile / tilesPerRow)]);
}

/** 1분 단위 쉬운 시간 글 */
export function minutesText(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s}초`;
  const m = Math.floor(s / 60);
  return s % 60 >= 30 && m < 10 ? `${m}분 반` : `${m}분`;
}
