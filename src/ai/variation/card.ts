// 변주 카드 — 뽑은 변주(pick.ts)를 지시문 한 덩어리로. v2 지시문(영어)과 v1·팀 지시문(한국어)이 같은 뽑기에서 문장만 다르게 붙인다.
// 600자 안쪽(지시문 3.3만~5.5만 자의 1~2%) — 장소 이름·사건·분위기·구조는 한국어 그대로 싣는다(게임 글이 한국어다).
import type { Build } from "./decks";
import type { Variation } from "./pick";

export const VARIATION_MARK = "[이 게임의 변주]";
/** 카드 길이 상한(자). */
export const VARIATION_CARD_MAX = 600;

/** 짓는 길 한 줄 — make_place 의 type:세부, 또는 이 게임의 세계의 장소 종류. */
export function buildPath(build: Build): string {
  switch (build.via) {
    case "world": return `world:${build.world}/${build.kind}`;
    case "interior": return `interior:${build.room}`;
    case "house": return `house:kr-modern/${build.word}`;
    case "street": return `street:${build.style}/${build.hint}`;
    case "village": return `village:${build.theme}`;
    case "dungeon": return `dungeon:${build.theme}`;
  }
}

const CIRCLED = ["①", "②", "③"] as const;

export interface CardOptions {
  readonly lang: "en" | "ko";
}

/** 변주 카드. 뽑을 것이 하나도 없으면(사용자 글이 모든 축을 말했다) undefined. */
export function variationCard(v: Variation, options: CardOptions): string | undefined {
  const en = options.lang === "en";
  const places = v.places.map((p, i) => `${CIRCLED[i]}«${p.ko}»${v.pinned.includes(p.ko) ? (en ? "(named by the user)" : "(사용자가 말함)") : ""} ${buildPath(p.build)}`);
  const parts: string[] = [];
  if (places.length) {
    const worldNote = v.world ? (en ? ` All places are kinds of the world ${v.world} (World card, build_places).` : ` 모든 장소는 세계 ${v.world} 의 종류다(그 세계의 compose_* 구성기를 find_tools 로 찾아 짓는다).`) : "";
    parts.push(en
      ? `Places (1st = where the game starts; path = make_place type:detail, world:W/K = place kind K of this game's world): ${places.join(" ")}.${worldNote}`
      : `장소(첫째 = 게임이 시작하는 곳; 길 = make_place type:세부, world:W/K = 이 게임 세계의 장소 종류 K): ${places.join(" ")}.${worldNote}`);
  }
  if (v.event) parts.push(`${en ? "Event" : "사건"}: ${v.event.ko}.`);
  if (v.mood) parts.push(`${en ? "Mood" : "분위기"}: ${v.mood.ko}.`);
  if (v.structure) parts.push(`${en ? "Structure" : "구조"}: ${v.structure.ko}.`);
  if (!parts.length) return undefined;
  const head = en
    ? `${VARIATION_MARK} Defaults for what the user left open — the user's own words always win; this only breaks ties so games of one genre differ.`
    : `${VARIATION_MARK} 사용자가 말하지 않은 부분의 기본값이다. 사용자 말이 늘 우선이고, 같은 장르의 게임이 서로 다르게 나오게 하는 용도다.`;
  return [head, ...parts].join(" ");
}
