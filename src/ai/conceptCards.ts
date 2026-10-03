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
  /** 새 프로젝트에서 이 순서로 부르면 예제 맵이 그대로 나온다(슈퍼하네스가 헤드리스로 확인). */
  readonly calls: readonly ConceptExampleCall[];
}

export interface ConceptVariant {
  readonly id: string;
  readonly title: string;
  /** 세계관 — 중세 지하, 현대 하수도 … */
  readonly worldview: string;
  readonly tilesetId: string;
  /** 짓는 도구와 순서 한 줄. */
  readonly build: string;
  readonly structure: readonly string[];
  readonly include: readonly ConceptMaterial[];
  readonly exclude: readonly string[];
  /** 빈 바닥이 얼마면 정상인가 — 사람이 읽는 문장. */
  readonly emptiness: string;
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

const EXAMPLE_ARGS_LIMIT = 4000;

/** 조수 노트 — 규칙·재료(그림/동작)·금지·첫 예제의 호출 순서. */
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
      const example = variant.examples[0];
      if (example) {
        const calls = JSON.stringify(example.calls);
        lines.push(`  예제 「${example.title}」 호출 순서: ${calls.length > EXAMPLE_ARGS_LIMIT ? `${calls.slice(0, EXAMPLE_ARGS_LIMIT)}…(잘림)` : calls}`);
      }
    }
    return lines.join("\n");
  }).join("\n");
}
