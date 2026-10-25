// project/fieldApproachStyle.ts
// 필드 적의 «다가오는 방식»(EventPageMovement.approachStyle) — 종족마다 쫓아오는 몸짓이 다르다(2026-10-25 폴른 스타 지적:
// 「늑대는 훨씬 빠르게 덮치고, 거미는 아치로 뛰어들고, 슬라임은 통통 튀고, 박쥐는 들쭉날쭉 날아들고, 골렘은 느릿하지만 떨치기 어렵게」).
// 순수 표·함수 — 런타임(playSceneAutonomous)·조수 도구(place_field_enemy·tune_field_enemies·set_field_approach_style)가 같은 수를 쓴다.

export const FIELD_APPROACH_STYLES = ["walk", "dash", "pounce", "hop", "swoop", "lumber", "float", "slither"] as const;
export type FieldApproachStyle = (typeof FIELD_APPROACH_STYLES)[number];

export const FIELD_APPROACH_STYLE_LABELS: Readonly<Record<FieldApproachStyle, string>> = {
  walk: "걷기(기본)",
  dash: "질주 — 쉬지 않고 빠르게, 덮치기는 훨씬 빠르게(늑대·짐승)",
  pounce: "도약 — 웅크렸다 두 칸을 아치로 뛰어든다(거미·개구리)",
  hop: "통통 — 한 칸씩 튀어 오르며 착지에 찌그러진다(슬라임)",
  swoop: "급강하 — 좌우로 흔들리며 들쭉날쭉 날아든다(박쥐·새)",
  lumber: "육중 — 느릿하지만 쉬지 않고 끝까지 쫓는다(골렘·거인)",
  float: "부유 — 둥실 떠서 미끄러지듯 온다(유령·정령)",
  slither: "기기 — 몸을 S자로 흔들며 다가온다(뱀·벌레)",
};

export interface FieldApproachRecipe {
  /** 추격 한 칸 시간(ms). 주인공 걷기 160. */
  readonly stepMs: number;
  /** 덮치기(chaseLunge) 칸의 시간 상한(ms) — 덮치기 랭크보다 빠르게 깎는다. */
  readonly lungeStepMs?: number;
  /** 몇 칸마다 쉰다(0 = 매 칸 뒤). */
  readonly burst: number;
  /** 묶음 뒤 쉬는 시간(ms). 0 = 쉬지 않음. */
  readonly pauseMs: number;
  /** 칸마다 튀어 오르는 높이(칸 비율). */
  readonly hop?: number;
  /** 진행 방향과 수직으로 흔드는 폭(칸 비율). */
  readonly sway?: number;
  /** 위아래로 둥실(칸 비율, 연속). */
  readonly bob?: number;
  /** 칸마다 옆으로 새는 확률(0~1). */
  readonly erratic?: number;
  /** 놓쳐도 이만큼 더 멀리까지 쫓는다(칸). */
  readonly giveUpBonus?: number;
}

const RECIPES: Readonly<Record<Exclude<FieldApproachStyle, "walk">, FieldApproachRecipe>> = {
  dash: { stepMs: 130, lungeStepMs: 85, burst: 0, pauseMs: 0 },
  pounce: { stepMs: 150, lungeStepMs: 120, burst: 2, pauseMs: 520, hop: 0.7 },
  hop: { stepMs: 260, burst: 1, pauseMs: 200, hop: 0.38 },
  swoop: { stepMs: 135, lungeStepMs: 110, burst: 0, pauseMs: 60, sway: 0.4, bob: 0.12, erratic: 0.3 },
  lumber: { stepMs: 300, burst: 0, pauseMs: 0, bob: -0.06, giveUpBonus: 8 },
  float: { stepMs: 230, burst: 0, pauseMs: 0, bob: 0.14 },
  slither: { stepMs: 170, burst: 0, pauseMs: 90, sway: 0.22 },
};

export function isFieldApproachStyle(value: unknown): value is FieldApproachStyle {
  return typeof value === "string" && (FIELD_APPROACH_STYLES as readonly string[]).includes(value);
}

/** walk 나 모르는 값이면 undefined — 기존 추격 그대로. */
export function fieldApproachRecipe(style: unknown): FieldApproachRecipe | undefined {
  return isFieldApproachStyle(style) && style !== "walk" ? RECIPES[style] : undefined;
}

/** n번째(0부터) 칸을 마친 뒤 쉴 시간. */
export function fieldApproachPauseAfter(recipe: FieldApproachRecipe, stepIndex: number): number {
  if (recipe.pauseMs <= 0) return 0;
  if (recipe.burst <= 1) return recipe.pauseMs;
  return (stepIndex + 1) % recipe.burst === 0 ? recipe.pauseMs : 0;
}

// 영어 낱말은 앞뒤가 글자가 아닐 때만(「charset-battler」 의 bat 같은 오탐 방지), 복수형 s/es 허용. 한글은 그대로.
const word = (english: string, korean: string): RegExp => new RegExp(`(?<![a-z])(?:${english})(?:e?s)?(?![a-z])|${korean}`, "i");
const FAMILY_RULES: ReadonlyArray<readonly [RegExp, FieldApproachStyle]> = [
  [word("wolf|wolve|hound|dog|boar|beast|fox|tiger|lion|panther", "늑대|사냥개|들개|멧돼지|짐승|여우|호랑이|사자|표범"), "dash"],
  [word("spider|frog|toad|mantis|cricket|flea", "거미|개구리|두꺼비|사마귀|메뚜기|벼룩"), "pounce"],
  [word("slime|jelly|jellie|blob|ooze|pudding", "슬라임|젤리|점액"), "hop"],
  [word("bat|bird|crow|raven|harpy|harpie|wasp|bee|hornet|moth|griffin", "박쥐|까마귀|독수리|하피|말벌|꿀벌|나방|그리핀"), "swoop"],
  [word("golem|giant|ogre|troll|armou?r|statue|construct|machine|guardian", "골렘|거인|오우거|트롤|갑옷|석상|기계|수호자|파수병"), "lumber"],
  [word("ghost|spirit|wraith|phantom|wisp|specter|spectre|soul", "유령|정령|망령|원령|도깨비불|혼령|영혼"), "float"],
  [word("snake|serpent|worm|lizard|eel|naga", "뱀|구렁이|벌레|지렁이|도마뱀|장어|나가"), "slither"],
];

/** 이름·id 에서 종족을 읽어 기본 방식을 고른다. 모르면 walk. */
export function defaultFieldApproachStyle(...hints: ReadonlyArray<string | undefined>): FieldApproachStyle {
  // 맨 앞에 나온 종족이 이긴다(이벤트 이름 → 적 그룹 → 선두 적 순으로 넘긴다).
  const text = hints.filter(Boolean).join(" ");
  let best: { index: number; style: FieldApproachStyle } | undefined;
  for (const [rule, style] of FAMILY_RULES) {
    const match = rule.exec(text);
    if (match && (!best || match.index < best.index)) best = { index: match.index, style };
  }
  return best?.style ?? "walk";
}
