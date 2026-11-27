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
    // 세계가 아닌 장소는 청사진에 places 칸이 없다(blueprint.ts places 는 세계 카드가 있을 때만) — 걸음의 place 로 옮겨 적으라고 말해야 모델이 사용자 집 한 채로 줄이지 않는다(2026-11-26 variant-remeasure).
    const how = v.world
      ? (en ? `world:W/K = kind K of world ${v.world}, built by build_places from the World card` : `world:W/K = 세계 ${v.world} 의 장소 종류 K, 그 세계의 compose_* 구성기를 find_tools 로 찾아 짓는다`)
      : (en ? "path = make_place type:detail; one map each, named as written, steps' place spread over all" : "길 = make_place type:세부; 장소마다 맵 하나, 적힌 이름 그대로, 걸음 place 를 모두에 나눔");
    parts.push(en ? `Places (1st = start; ${how}): ${places.join(" ")}.` : `장소(첫째 = 시작하는 곳; ${how}): ${places.join(" ")}.`);
  }
  // 층 이름은 적힌 장소 이름 앞에 붙인다 — «지하 2층 응접실» 처럼 이름을 줄이면 카드 장소(«저택 응접실»)를 못 따른 것이 된다(2026-11-26 variant-remeasure after6 r1: 장소 2/3).
  const FLOORS = ["1층", "지하 1층", "지하 2층"] as const;
  const floorExample = v.places.length ? v.places.map((p, i) => `${FLOORS[Math.min(i, FLOORS.length - 1)]} ${p.ko}`).join("→") : FLOORS.join("→");
  const orderNote = (order: "descend" | "days" | undefined): string => order === "descend" ? (en ? ` — names as written, floor in front: ${floorExample}` : ` — 이름 그대로 앞에 층: ${floorExample}`)
    : order === "days" ? (en ? " — split the steps 첫째 날 → 둘째 날 → 셋째 날" : " — 걸음을 첫째 날 → 둘째 날 → 셋째 날로 나눈다") : "";
  if (v.event) parts.push(`${en ? "Event" : "사건"}: ${v.event.ko}${orderNote(v.event.order)}.`);
  if (v.mood) parts.push(`${en ? "Mood" : "분위기"}: ${v.mood.ko}.`);
  if (v.structure) parts.push(`${en ? "Structure" : "구조"}: ${v.structure.ko}${v.structure.tools?.length ? ` (${en ? "tools:" : "짓는 도구"} ${v.structure.tools.join(", ")})` : ""}${orderNote(v.structure.order)}.`);
  if (!parts.length) return undefined;
  const head = en
    ? `${VARIATION_MARK} Fill what the user left open (user wins); in write_blueprint: event→premise, mood→tones+opening, structure→step links.`
    : `${VARIATION_MARK} 사용자가 말하지 않은 부분은 이것으로 채운다(사용자 말이 이긴다). 청사진에: 사건→전제, 분위기→tones·오프닝, 구조→걸음 잇기.`;
  return [head, ...parts].join(" ");
}
