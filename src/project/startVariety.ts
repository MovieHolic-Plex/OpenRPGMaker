// project/startVariety.ts
// 새 게임 시작의 「첫 장소 구상」 — 컨셉(기획)에서 결정적으로 뽑는 형태·지형·길 맵 기하.
//
// 왜 (2026-10-11 사용자 지적 「프리셋으로 만들면 맵 구조가 주구장창 비슷하다」):
//   1. 첫 구간 뼈대가 장르와 무관하게 24×12 길 맵 · 입구 (0,6) · 구간 끝 (22,6) 으로 고정이었다.
//   2. 시작 맵은 장르와 무관하게 같은 빈 맵이었고, 「예제로 시작」은 늘 seed 7 도시였다.
//   3. 프롬프트가 「뼈대를 보존하라」고 해서 AI 가 그 모양에서 벗어나지 못했다.
//   다양성은 출력에서 「다르게」 시켜 봐야 안 나온다(2026-10-11 실험) — 입력에서 정한다. 이 모듈이 그 입력이다.
//
// 같은 기획이면 같은 구상이다(재현 가능). 기획이 달라지면 구상이 달라진다.
// 이 모듈은 순수 함수만 가진다 — 도구·편집기 의존이 없어 프롬프트 모듈과 뼈대 모듈이 같이 읽는다.

import type { GameDesignBrief } from "@/project/gameDesignBrief";

export type StartTheme = "river" | "coast" | "desert" | "snow" | "swamp";
export type StartForm = "street" | "scatter" | "riverbank" | "plaza";
export type StartTerrain = "flat" | "terraces" | "hillside" | "basin" | "ridge";

export interface StartPlan {
  /** 구상을 뽑은 씨앗(0 이상 정수). author_beodeul_town 의 seed 로도 쓴다. */
  readonly seed: number;
  readonly theme: StartTheme;
  readonly form: StartForm;
  readonly terrain: StartTerrain;
  /** 길 맵(첫 구간의 두 번째 맵) 크기. */
  readonly routeW: number;
  readonly routeH: number;
  /** 길 맵 입구 줄(x=0)과 구간 끝 줄. 둘이 달라 길이 한 번 꺾인다. */
  readonly entryY: number;
  readonly endY: number;
  /** 컨셉이 고른 타일셋(기획 요약의 「타일셋:」 줄). 없으면 버들항. 시작 맵과 길 맵이 이 칩셋을 따른다(칩셋 계열은 첫 맵이 정한다). */
  readonly tilesetId: string;
  /** 컨셉이 정한 타일셋이 버들항이 아니면 코드가 시작 마을을 미리 짓지 않는다(조선·마법 학교 등은 AI 가 자기 칩셋으로 지음). */
  readonly prebuildTown: boolean;
}

export const START_THEME_LABEL: Record<StartTheme, string> = { river: "강가 마을", coast: "포구", desert: "사막 오아시스", snow: "설원 마을", swamp: "늪 수상 마을" };
export const START_FORM_LABEL: Record<StartForm, string> = { street: "길가 마을", scatter: "흩어진 마을", riverbank: "물가 띠 마을", plaza: "광장 마을" };
export const START_TERRAIN_LABEL: Record<StartTerrain, string> = { flat: "평지", terraces: "계단식 비탈", hillside: "눈 덮인 비탈", basin: "오아시스 골", ridge: "마른 둔덕" };

/** 시공기(beodeulTerrain.allowedVillageTerrains)와 같은 표 — 이 모듈은 편집기를 끌어오지 않으려고 복사해 둔다. 테스트가 둘을 맞춘다. */
export const START_TERRAINS_BY_THEME: Record<StartTheme, readonly StartTerrain[]> = {
  river: ["terraces", "flat"], coast: ["terraces", "flat"], desert: ["basin", "flat"], snow: ["hillside", "flat"], swamp: ["ridge", "flat"],
};
/** 시공기(allowedVillageForms)와 같은 표. 광장은 기본 후보가 아니다(2026-10-11 「중심 광장을 기본으로 삼지 말 것」). */
export const START_FORMS_BY_THEME: Record<StartTheme, readonly StartForm[]> = {
  river: ["street", "riverbank", "scatter"], coast: ["street", "scatter"], desert: ["street", "scatter"], snow: ["street", "scatter"], swamp: ["street", "scatter"],
};

/** 기획 글에서 무대 낱말로 theme 를 짐작한다. 못 짚으면 undefined(씨앗이 고른다). */
const THEME_WORDS: readonly (readonly [StartTheme, RegExp])[] = [
  ["snow", /설원|눈\s?덮|눈마을|겨울\s?마을|빙|얼음|설산|snow|frozen/iu],
  ["desert", /사막|오아시스|모래|사구|desert|oasis/iu],
  ["swamp", /늪|습지|수상\s?마을|갈대|swamp|marsh|bog/iu],
  ["coast", /항구|포구|해안|바닷가|어촌|등대|섬|부두|port|harbou?r|coast|island/iu],
  ["river", /강가|강변|나루|물레방아|방앗간|시냇|개울|river/iu],
];

/** FNV-1a 32bit — 안정적이고 의존이 없다. */
export function startHash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h >>> 0;
}

function mulberry(seed: number): () => number {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** 기획의 「타일셋: X」 줄(conceptBrief 가 쓴다). 없으면 undefined. */
export function briefTilesetHint(summary: string): string | undefined {
  const match = /(?:^|\n)타일셋:\s*([A-Za-z0-9_]+)/u.exec(summary);
  return match?.[1];
}

/**
 * 구상의 씨앗 글. 컨셉 카드면 slug(같은 카드는 늘 같은 구상), 인터뷰면 확정 요약.
 * 기획이 없는 프로젝트(예제로 시작)는 제목.
 */
export function startSeedText(brief: GameDesignBrief | undefined, title: string): string {
  if (brief?.concept?.slug) return `concept:${brief.concept.slug}`;
  if (brief?.summary) return `brief:${brief.summary.slice(0, 400)}`;
  return `title:${title}`;
}

export function planStart(input: { readonly seedText: string; readonly stageText?: string; readonly tilesetHint?: string }): StartPlan {
  const seed = startHash(input.seedText) % 100000;
  const rng = mulberry(seed ^ 0x5a17c0de);
  const stage = input.stageText ?? "";
  const named = THEME_WORDS.find(([, pattern]) => pattern.test(stage))?.[0];
  // 무대를 말하지 않은 기획: 강가·포구 중 씨앗이 고른다. 사막·설원·늪은 기획이 말했을 때만 — 방과후 연금 동아리가 사막 오아시스에 서면 안 된다.
  const neutral: readonly StartTheme[] = ["river", "coast"];
  const theme = named ?? neutral[Math.floor(rng() * neutral.length)]!;
  const forms = START_FORMS_BY_THEME[theme];
  const form = forms[Math.floor(rng() * forms.length)]!;
  const terrains = START_TERRAINS_BY_THEME[theme];
  // 지형은 평지가 아닌 것 우선(늘 평지가 나오지 않게) — 시공기 기본과 같다. 넷 중 하나는 평지로 쉬게 한다.
  const terrain = rng() < 0.4 ? "flat" : terrains[0]!;
  const routeW = 22 + Math.floor(rng() * 13);   // 22..34
  const routeH = 10 + Math.floor(rng() * 7);    // 10..16
  const lo = 3, hi = routeH - 4;
  const entryY = lo + Math.floor(rng() * (hi - lo + 1));
  // 입구와 끝 줄이 3칸 안에서 어긋나 길이 한 번 꺾인다(이야기 산책길 광장이 끝 줄 ±3 을 쓴다).
  const shift = Math.floor(rng() * 7) - 3;
  const endY = Math.max(lo, Math.min(hi, entryY + shift));
  const hint = input.tilesetHint;
  return { seed, theme, form, terrain, routeW, routeH, entryY, endY, tilesetId: hint ?? "beodeul_city", prebuildTown: hint === undefined || hint === "beodeul_city" };
}

/** 프로젝트에서 구상을 낸다 — 뼈대(playableSegment)와 프롬프트가 같은 입력으로 같은 구상을 얻는다. */
export function planStartForBrief(brief: GameDesignBrief | undefined, title: string): StartPlan {
  return planStart({ seedText: startSeedText(brief, title), stageText: brief?.summary, tilesetHint: brief ? briefTilesetHint(brief.summary) : undefined });
}

/** AI 에게 주는 첫 장소 구상 블록. 보존 대상은 연결 계약뿐이고 맵 모양은 아니라는 것을 분명히 한다. */
export function startPlanPrompt(plan: StartPlan): string {
  return [
    `[첫 장소 구상 — 씨앗 ${plan.seed}]`,
    `코드가 이 기획에서 뽑은 첫 마을의 구상: ${START_THEME_LABEL[plan.theme]} · ${START_FORM_LABEL[plan.form]} · 지형 ${START_TERRAIN_LABEL[plan.terrain]}. 길 맵은 ${plan.routeW}×${plan.routeH}, 입구 줄 ${plan.entryY}, 구간 끝 줄 ${plan.endY}.`,
    plan.prebuildTown
      ? "시작 맵이 이미 이 구상대로 지어져 있으면(풀밭 한 장이 아니면) 먼저 읽고 그 위에서 기획에 맞게 고친다. 아직 빈 풀밭이면 이 구상으로 author_beodeul_town({theme, form, terrain, seed}) 를 불러 먼저 짓는다."
      : "컨셉이 고른 타일셋이 따로 있다 — 이 구상은 마을의 형태(길가·흩어진·물가 띠)와 길 맵 크기의 참고로만 쓴다.",
    "뼈대가 지키는 것은 「핵심 행동 → 문 → 길 → 구간 끝」의 연결뿐이다. 마을의 모양·광장·십자 길·가운데 앵커는 보존 대상이 아니다.",
    "기획의 무대·분위기가 이 구상과 어긋나면 author_beodeul_town 의 theme/form/terrain 을 직접 골라 시작 맵을 다시 짓는다. 이때 문(시작 맵 동쪽 끝)과 길 맵 연결, 뼈대 이벤트 id 는 유지한다.",
    "광장·십자 길·한가운데 건물을 기본으로 두지 않는다. 앵커(시작 NPC·핵심 건물)는 「왜 거기에 있는지」가 있는 자리에 둔다 — 물가·길목·언덕 위처럼 지형이 말해 주는 곳.",
  ].join("\n");
}
