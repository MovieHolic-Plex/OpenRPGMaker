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
  /** 컨셉 칩셋에 완성 야외 장소가 있으면 그 id — 시작 맵이 이 장소를 통째로 붙여 열린다(조수가 빈 풀밭에서 처음부터 짓지 않게). 지금은 jp_city 만. */
  readonly placeId?: string;
  /** 컨셉 칩셋이 jp_city 이고 학교·역 같은 특정 장소가 아니면, 완성 장소를 붙이지 않고 구성기(jpCityStreetComposer)가 씨앗으로 거리를 새로 짠다. */
  readonly composeStreet?: boolean;
}

/** 칩셋별 완성 야외 장소. 학교·역 낱말이면 그 장소, 아니면 씨앗이 상가 거리·노면전차 거리·동네 한 장 중 고른다. */
export const KIT_START_PLACES: Readonly<Record<string, readonly string[]>> = {
  jp_city: ["jp-city-school-68x48", "jp-city-tram-street-48x30"],
};
export function kitStartPlaceId(tilesetId: string | undefined, seed: number, stageText: string): string | undefined {
  const list = tilesetId ? KIT_START_PLACES[tilesetId] : undefined;
  if (!list) return undefined;
  if (/학교|교실|교정|등교|수업|동아리/u.test(stageText)) return "jp-city-school-68x48";
  if (/역|전차|전철|지하철|열차/u.test(stageText)) return "jp-city-tram-street-48x30";
  return undefined;
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
  const placeId = kitStartPlaceId(hint, seed, stage);
  const composeStreet = hint === "jp_city" && !placeId;
  return { seed, theme, form, terrain, routeW, routeH, entryY, endY, tilesetId: hint ?? "beodeul_city", prebuildTown: hint === undefined || hint === "beodeul_city", ...(placeId ? { placeId } : {}), ...(composeStreet ? { composeStreet } : {}) };
}

/** 프로젝트에서 구상을 낸다 — 뼈대(playableSegment)와 프롬프트가 같은 입력으로 같은 구상을 얻는다. */
export function planStartForBrief(brief: GameDesignBrief | undefined, title: string): StartPlan {
  return planStart({ seedText: startSeedText(brief, title), stageText: brief?.summary, tilesetHint: brief ? briefTilesetHint(brief.summary) : undefined });
}

/** 칩셋마다 시작 맵을 짓는 길(조수 시스템 프롬프트의 칩셋 지침과 같은 도구 이름). 버들항 도구 author_beodeul_town 은 다른 칩셋에서 쓰지 않는다. */
const KIT_BUILD_LINES: Readonly<Record<string, string>> = {
  jp_city: "일본 도시(jp_city): 큰길 하나와 골목을 fill_region·lay_path(생활도로·보도 연석·횡단보도)로 먼저 내고, 건물은 list_jp_city_building_parts → build_jp_city_building 으로 세우고(문 앞 접근칸 확보), 가게·집 안은 build_hand_interior_room({tileset:\"jp_city\"}) 또는 import_region_reference 로 짓고 link_jp_city_interior 로 문과 잇는다. 먼저 list_tileset_references → read_tileset_reference 로 참고문서를 읽는다. 시작 맵을 버들항 마을로 바꾸지 않는다.",
  joseon_baram: "조선(joseon_baram): 완성 장소를 먼저 쓴다 — list_spatial_designs({kind:\"place\", query:\"조선\"}) 로 마을·민가·주막 같은 장소를 찾아 import_region_reference 로 가져와 기획에 맞게 고친다. 시작 맵을 버들항 마을로 바꾸지 않는다.",
  wizarding_world: "마법 학교(wizarding_world): build_wizarding_space 로 성채 공간(복도·교실·기숙사 등)을 짓고 참고문서를 읽는다. 시작 맵을 버들항 마을로 바꾸지 않는다.",
};

/** AI 에게 주는 첫 장소 구상 블록. 보존 대상은 연결 계약뿐이고 맵 모양은 아니라는 것을 분명히 한다. */
export function startPlanPrompt(plan: StartPlan): string {
  const kit = KIT_BUILD_LINES[plan.tilesetId];
  const common = [
    "뼈대가 지키는 것은 「핵심 행동 → 문 → 길 → 구간 끝」의 연결뿐이다. 마을·거리의 모양·광장·십자 길·가운데 앵커는 보존 대상이 아니다. 문(시작 맵 동쪽 끝)과 길 맵 연결, 뼈대 이벤트 id 는 유지한다.",
    "광장·십자 길·한가운데 건물을 기본으로 두지 않는다. 앵커(시작 NPC·핵심 건물)는 「왜 거기에 있는지」가 있는 자리에 둔다 — 물가·길목·언덕 위처럼 지형이 말해 주는 곳.",
  ];
  if (kit && plan.composeStreet) {
    return [
      `[첫 장소 구상 — 씨앗 ${plan.seed}]`,
      `시작 맵은 코드의 거리 구성기가 이 씨앗으로 짠 일본 도시 거리(뒷줄·앞줄 건물, 보도, 도로, 횡단보도, 가로등·자판기·노보리)로 이미 열려 있다. 길 맵(${plan.routeW}×${plan.routeH})은 그 칩셋의 길이다. 이 거리를 지우거나 풀밭으로 덮지 않는다.`,
      "해야 할 일: ① get_map_region/show_map_region 으로 거리와 건물 문을 읽는다. ② 기획의 가게와 안 맞으면 compose_jp_city_street({mapId, seed:다른 값, style, shops:[기획의 가게…], replace:true}) 로 다시 짜거나 build_jp_city_building 으로 건물 몇 채만 고친다(문 앞 접근칸을 유지). ③ 기획의 핵심 장소를 문마다 골라 link_jp_city_interior 로 완성 실내를 잇는다 — 장소 id 예: jp-city-konbini-14x12, jp-city-ramen-9x9, jp-city-izakaya-14x14, jp-city-kissaten-10x9, jp-city-bakery-10x14, jp-city-bookstore-11x14, jp-city-pharmacy-11x13, jp-city-clinic-14x9, jp-city-koban-14x9, jp-city-house-interior-21x15. 문은 간판·차양이 그 가게와 어울리는 건물에서 고른다. ④ 실내에 기획의 인물·단서·이벤트를 둔다.",
      "뼈대가 지키는 것은 핵심 행동 → 시작 맵 동쪽 끝 문 → 길 맵 → 구간 끝의 연결이다. 이벤트 id 와 문은 유지한다.",
    ].join("\n");
  }
  if (kit && plan.placeId) {
    return [
      `[첫 장소 구상 — 씨앗 ${plan.seed}]`,
      `시작 맵은 이미 완성된 일본 도시 장소(${plan.placeId}, 건물·도로·소품·문 앞 접근칸이 짜여 있다)로 열려 있다. 길 맵(${plan.routeW}×${plan.routeH})은 그 칩셋의 길로 깔려 있다. 이 맵을 지우거나 풀밭으로 다시 칠하지 않는다(fill_region 으로 잔디·큰 면을 덮지 말 것 — 보도·도로·광장이 사라진다) — 기획에 맞게 이어서 만든다.`,
      "해야 할 일: ① get_map_region/show_map_region 으로 건물 문 칸을 읽는다. ② 기획의 핵심 장소(가게·집·역 등)를 문마다 하나씩 골라 link_jp_city_interior 로 완성 실내를 잇는다 — 장소 id 예: jp-city-konbini-14x12, jp-city-ramen-9x9, jp-city-izakaya-14x14, jp-city-kissaten-10x9, jp-city-bakery-10x14, jp-city-bookstore-11x14, jp-city-pharmacy-11x13, jp-city-clinic-14x9, jp-city-koban-14x9, jp-city-house-interior-21x15 (list_spatial_designs({kind:\"place\", query:\"일본\"}) 로 전체). 문은 간판·차양·외형이 그 가게와 어울리는 건물에서 고른다(show_map_region 으로 건물을 보고 — 아파트 문에 편의점을 잇지 않는다). 기획에 없는 가게는 건드리지 않아도 된다. ③ 실내에 기획의 인물·단서·이벤트를 둔다. ④ 필요한 부분만 build_jp_city_building·fill_region 으로 고친다.",
      "뼈대가 지키는 것은 핵심 행동 → 시작 맵 동쪽 끝 문 → 길 맵 → 구간 끝의 연결이다. 이벤트 id 와 문은 유지한다.",
    ].join("\n");
  }
  if (kit) {
    return [
      `[첫 장소 구상 — 씨앗 ${plan.seed}]`,
      `컨셉이 고른 칩셋은 ${plan.tilesetId} 이다. 시작 맵은 이미 그 칩셋의 빈 땅으로 열려 있고, 길 맵(${plan.routeW}×${plan.routeH}, 입구 줄 ${plan.entryY}, 구간 끝 줄 ${plan.endY})은 그 칩셋의 길·마당으로 깔려 있다. 이 칩셋 안에서 시작 맵을 짓는다.`,
      kit,
      `거리·마을의 형태 참고: ${START_FORM_LABEL[plan.form]}(길가 = 큰길 한 줄 양옆, 흩어진 = 골목과 빈터가 번갈아, 물가 띠 = 물가를 따라 긴 띠). 이 형태에서 시작해 기획의 무대에 맞게 바꾼다.`,
      ...common,
    ].join("\n");
  }
  return [
    `[첫 장소 구상 — 씨앗 ${plan.seed}]`,
    `코드가 이 기획에서 뽑은 첫 마을의 구상: ${START_THEME_LABEL[plan.theme]} · ${START_FORM_LABEL[plan.form]} · 지형 ${START_TERRAIN_LABEL[plan.terrain]}. 길 맵은 ${plan.routeW}×${plan.routeH}, 입구 줄 ${plan.entryY}, 구간 끝 줄 ${plan.endY}.`,
    "시작 맵이 이미 이 구상대로 지어져 있으면(풀밭 한 장이 아니면) 먼저 읽고 그 위에서 기획에 맞게 고친다. 아직 빈 풀밭이면 이 구상으로 author_beodeul_town({theme, form, terrain, seed}) 를 불러 먼저 짓는다. 기획의 무대·분위기가 구상과 어긋나면 theme/form/terrain 을 직접 골라 다시 짓는다.",
    ...common,
  ].join("\n");
}
