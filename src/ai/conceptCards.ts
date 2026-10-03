/**
 * 개념 카드 — 「미궁」「카타콤」처럼 조수가 재료·조립법을 모르는 낱말을 위한 공용 참고.
 *
 * 카드는 슈퍼하네스(src/harnesses/super-harness)가 만들고 적대 검수·조수 시험을 거쳐
 * `src/assets/conceptCards.json` 번들에 굽는다. 사용자 문장에 별칭이 있으면 의도 노트에 카드가 붙고
 * (executionRoute.buildPiIntentNote), 카드가 빈칸 검사를 빼라고 하면 배치 품질 수리 턴을 건너뛴다
 * (scripts/lib/piAgentRuntime.ts). 2026-10-03 실측: 「미궁을 만들어줘」 3판 모두 쓸데없는 기물이
 * 배치 품질 수리 턴에서 들어왔고, 보물상자·함정·세이브 수정을 이벤트 없이 바닥 그림으로만 칠했다.
 */
import bundledCards from "@/assets/conceptCards.json";

/** 재료 하나 — 그림(타일)으로 까는가, 동작(이벤트)으로 까는가. */
export interface ConceptMaterial {
  readonly what: string;
  readonly as: "tile" | "event";
  /** 어떻게 까는지 — 도구 이름과 인자 요지. 이벤트는 place_chest·place_trap 처럼 이벤트 도구. */
  readonly how: string;
}

export interface ConceptExampleCall {
  readonly name: string;
  readonly args: Record<string, unknown>;
}

export interface ConceptExample {
  readonly id: string;
  readonly title: string;
  /** 번들 공개 경로(/assets/concept-cards/…png). 조수 노트에는 넣지 않는다. */
  readonly image?: string;
  readonly width?: number;
  readonly height?: number;
  /**
   * 새 프로젝트에서 이 순서로 부르면 예제 맵이 그대로 나온다(슈퍼하네스가 헤드리스로 확인).
   * 구운 카드에서는 비고, 호출은 `src/assets/conceptCardExamples/<카드 id>.json` 에 따로 둔다 — 80×80 미궁의 평면만
   * 6천 자라 편집기 첫 번들·조수 노트에 실을 수 없다. 조수는 build_concept_example 로 통째로 짓는다.
   */
  readonly calls?: readonly ConceptExampleCall[];
}

/** 하위 개념(층·구역)이나 먼저 있어야 할 상위 개념. 슈퍼하네스가 이 목록으로 다음 카드를 낸다. */
export interface ConceptLink {
  readonly id: string;
  readonly title: string;
  readonly why?: string;
}

export interface ConceptVariant {
  readonly id: string;
  readonly title: string;
  /** 세계관 — 중세 지하, 현대 하수도 … */
  readonly worldview: string;
  /** 세계관 id(harness-data/super-harness/seed.json 의 worldviews) — 그 세계관의 칩셋·기물만 쓴다. */
  readonly worldviewId?: string;
  /** 공간 종류 — 검사 기준이 다르다(던전·미궁은 고리가 있어야, 야외는 빈칸 기준이 느슨). */
  readonly layout?: "room" | "building" | "dungeon" | "outdoor";
  readonly tilesetId: string;
  /** 짓는 도구와 순서 한 줄. */
  readonly build: string;
  readonly structure: readonly string[];
  readonly include: readonly ConceptMaterial[];
  readonly exclude: readonly string[];
  /** 빈 바닥이 얼마면 정상인가 — 사람이 읽는 문장. */
  readonly emptiness: string;
  /** 이 공간의 정상 크기(칸). 미궁 80×80, 성도 150×150 처럼 — 작게 지으면 개념이 안 산다. */
  readonly size?: string;
  readonly examples: readonly ConceptExample[];
}

export interface ConceptCard {
  readonly id: string;
  readonly title: string;
  readonly aliases: readonly string[];
  /** 이 구절이 같이 있으면 이 개념이 아니다(「사건이 미궁에 빠지다」). */
  readonly excludeContexts?: readonly string[];
  readonly summary: string;
  readonly variants: readonly ConceptVariant[];
  /** 통로가 비어 있는 게 정상인 공간 — 배치 품질(빈칸·대칭) 수리 턴을 건너뛴다. */
  readonly skipLayoutQuality?: boolean;
  /** 이 개념이 속한 상위 개념(학교 복도 → 학교). */
  readonly parent?: string;
  /** 이 카드가 쓰는, 먼저 있어야 하는 개념(학교 복도는 학교 카드의 재료·규칙을 따른다). */
  readonly requires?: readonly string[];
  /** 이 개념에서 자라는 하위 개념(카타콤 → 카타콤 2층·최심부). */
  readonly children?: readonly ConceptLink[];
  /** 이 세계관 재료(기물 그림)가 아직 없어 정직하게 지을 수 없다 — 슈퍼하네스가 그림을 주문하고 기다린다. 구운 카드에는 없다. */
  readonly needsArt?: boolean;
  readonly bakedAt?: string;
}

let CARDS: readonly ConceptCard[] = (bundledCards as { cards?: ConceptCard[] }).cards ?? [];

export function conceptCards(): readonly ConceptCard[] {
  return CARDS;
}

/** 굽기 전 카드를 시험할 때만(qa:game gen --concept-card). 같은 id 는 바꾸고 새 id 는 더한다. */
export function overrideConceptCards(extra: readonly ConceptCard[]): void {
  const ids = new Set(extra.map((card) => card.id));
  CARDS = [...CARDS.filter((card) => !ids.has(card.id)), ...extra];
  for (const id of ids) exampleFiles.delete(id);
}

/**
 * 별칭이 낱말 머리에서 시작하는가 — 앞 글자가 글자·숫자면 다른 낱말의 일부다(「흥미로운」의 「미로」, 「amazed」의 「maze」).
 * 뒤는 보지 않는다: 한국어는 조사가 붙는다(「미로를」).
 */
function hasAlias(lower: string, alias: string): boolean {
  const needle = alias.toLocaleLowerCase();
  for (let at = lower.indexOf(needle); at >= 0; at = lower.indexOf(needle, at + 1)) {
    if (at === 0 || !/[\p{L}\p{N}]/u.test(lower[at - 1]!)) return true;
  }
  return false;
}

/** 문장에 별칭이 (낱말 머리로) 들어 있는 카드. 대소문자를 가리지 않고, 제외 구절이 있으면 뺀다. */
export function conceptCardsForText(text: string | undefined, cards: readonly ConceptCard[] = CARDS): ConceptCard[] {
  if (!text) return [];
  const lower = text.toLocaleLowerCase();
  return cards.filter((card) =>
    card.aliases.some((alias) => alias && hasAlias(lower, alias))
    && !(card.excludeContexts ?? []).some((phrase) => phrase && lower.includes(phrase.toLocaleLowerCase())));
}

export function conceptSkipsLayoutQuality(text: string | undefined, cards: readonly ConceptCard[] = CARDS): boolean {
  return conceptCardsForText(text, cards).some((card) => card.skipLayoutQuality === true);
}

// ── 예제 호출 (build_concept_example) ──────────────────────────────
const exampleFiles = new Map<string, Record<string, readonly ConceptExampleCall[]>>();

function exampleKey(variantId: string, exampleId: string): string {
  return `${variantId}/${exampleId}`;
}

/** 카드의 예제 호출을 불러 둔다. 굽기 전 카드(호출을 품고 있음)는 그대로, 구운 카드는 따로 둔 JSON 을 읽는다. */
export async function preloadConceptExamples(cardId: string): Promise<void> {
  if (exampleFiles.has(cardId)) return;
  const card = CARDS.find((c) => c.id === cardId);
  const inline: Record<string, readonly ConceptExampleCall[]> = {};
  for (const variant of card?.variants ?? []) for (const example of variant.examples) {
    if (example.calls?.length) inline[exampleKey(variant.id, example.id)] = example.calls;
  }
  if (Object.keys(inline).length) { exampleFiles.set(cardId, inline); return; }
  try {
    const mod = await import(`../assets/conceptCardExamples/${cardId}.json`) as { default?: Record<string, ConceptExampleCall[]> };
    exampleFiles.set(cardId, mod.default ?? {});
  } catch {
    exampleFiles.set(cardId, {});
  }
}

export function conceptExampleCalls(cardId: string, variantId: string, exampleId: string): readonly ConceptExampleCall[] | undefined {
  return exampleFiles.get(cardId)?.[exampleKey(variantId, exampleId)];
}

export function conceptExamplesLoaded(cardId: string): boolean {
  return exampleFiles.has(cardId);
}

/** 조수 노트 — 규칙·재료(그림/동작)·금지·예제를 짓는 한 호출. */
export function formatConceptCardNote(cards: readonly ConceptCard[]): string | null {
  if (cards.length === 0) return null;
  return cards.map((card) => {
    const lines = [
      `[개념 카드 · ${card.title}] ${card.summary}`,
      "세계관에 맞는 변형 하나를 골라 그 방법대로 짓는다. 동작하는 것(보물상자·함정·스위치·세이브 지점·문)은 바닥 그림이 아니라 이벤트 도구로 깐다 — 그림으로만 칠하면 열리지도 밟히지도 않는다.",
    ];
    for (const variant of card.variants) {
      lines.push(`- 변형 「${variant.title}」(${variant.worldview}, 칩셋 ${variant.tilesetId}): ${variant.build}`);
      if (variant.structure.length) lines.push(`  구조: ${variant.structure.join(" / ")}`);
      const tiles = variant.include.filter((m) => m.as === "tile").map((m) => `${m.what}(${m.how})`);
      const events = variant.include.filter((m) => m.as === "event").map((m) => `${m.what}(${m.how})`);
      if (tiles.length) lines.push(`  그림으로: ${tiles.join(", ")}`);
      if (events.length) lines.push(`  이벤트로: ${events.join(", ")}`);
      if (variant.exclude.length) lines.push(`  넣지 않는다: ${variant.exclude.join(", ")}`);
      if (variant.emptiness) lines.push(`  빈칸: ${variant.emptiness}`);
      if (variant.size) lines.push(`  크기: ${variant.size}`);
      for (const example of variant.examples) {
        const size = example.width && example.height ? ` ${example.width}×${example.height}` : "";
        lines.push(`  예제 「${example.title}」${size}: build_concept_example({card:"${card.id}", variant:"${variant.id}", example:"${example.id}", newMapId?, name?}) 한 번으로 통째로 짓는다(검수된 평면·이벤트). 그다음 요청에 맞게 고치고 기존 맵과 create_transfer_pair 로 잇는다.`);
      }
    }
    if (card.children?.length) lines.push(`- 이어지는 공간: ${card.children.map((c) => `「${c.title}」`).join(", ")} — 요청하면 같은 재료로 이어 짓는다.`);
    return lines.join("\n");
  }).join("\n");
}
