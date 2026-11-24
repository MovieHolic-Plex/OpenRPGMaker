// 변주 뽑기 — 같은 씨앗(프로젝트 열쇠 + 다시 만든 횟수)은 늘 같은 결과, 다른 게임은 다른 결과. 순수 함수(프로젝트·실행기를 모른다).
//
// 규칙:
//  1) 사용자 말이 늘 이긴다 — 사용자 글이 말한 축은 뽑지 않는다. 글이 장소 낱말을 대면(예: «마을») 그 장소를 첫 장소로 고정한다.
//  2) 장소 3 · 사건 1 · 분위기 1 · 구조 1. 장소 셋은 종류가 겹치지 않는다.
//  3) 한 게임은 세계 하나다(place/world.ts) — 첫 장소가 세계에 묶인 후보면 나머지 둘도 같은 세계의 후보에서 뽑는다. 첫 장소는 바깥이어야 한다(실내는 문에 달린다).
import { DECKS, type AxisOption, type Deck, type DeckId, type PlaceCandidate } from "./decks";

export interface VariationInput {
  /** 사용자가 쓴 글(의도 메모를 뗀 것 + 고른 시작 장르 이름). */
  readonly text: string;
  /** 프로젝트 열쇠 — 비면 뽑지 않는다(같은 게임을 알아볼 수 없으니 씨앗이 없다). */
  readonly key: string;
  /** 같은 게임을 다시 만든 횟수(기본 0) — 다시 만들면 다른 변주. */
  readonly regen?: number;
  /** 이 프로젝트가 지을 수 있는 세계 id(칩셋이 있고 장르 잠금이 막지 않는 것). 비면 세계에 묶인 후보는 뽑지 않는다. */
  readonly allowedWorlds?: readonly string[];
  /** 세계(칩셋)가 이미 사용자 글·열쇠 풀로 정해졌다 — 장소는 그 세계의 카드가 정하므로 장소 축은 뽑지 않는다. */
  readonly worldFixed?: boolean;
  /**
   * 사용자 글이 장소 테마(조선·학교·사막…)를 말했다 — 그 낱말을 가진 후보가 없으면 장소 축은 뽑지 않는다. 함수면 «데크 장르 낱말(추리·연애·공포…)을 뺀 글»을 받는다:
   * 장르 낱말은 장소 테마가 아니다(「추리 게임」이 장소를 말한 것으로 읽히면 추리 데크가 늘 장소 없이 간다).
   */
  readonly placeStated?: boolean | ((residual: string) => boolean);
  /** 아무 장르도 안 말한 모험·RPG 요청이다(데크 «모험»은 이때만). */
  readonly adventureOk?: boolean;
}

export interface Variation {
  readonly deck: DeckId;
  /** 첫 장소부터 순서대로(0~3곳). */
  readonly places: readonly PlaceCandidate[];
  /** 사용자 글이 말해서 고정한 장소 이름(places 의 앞). */
  readonly pinned: readonly string[];
  /** 첫 장소가 세계에 묶여 있으면 그 세계 id — v2 세계 고르기가 이 세계를 쓴다. */
  readonly world?: string;
  readonly event?: AxisOption;
  readonly mood?: AxisOption;
  readonly structure?: AxisOption;
  /** 사용자 글이 이미 말해서 뽑지 않은 축. */
  readonly skipped: readonly ("places" | "event" | "mood" | "structure")[];
}

/** FNV-1a + 섞기(murmur3 fmix) — 글 하나를 32비트 수로. 안정적이고 의존이 없다. */
export function hash32(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b) >>> 0; h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35) >>> 0; h ^= h >>> 16;
  return h >>> 0;
}

const PARTICLE = "(?:을|를|이|가|은|는|에|에서|의|으로|로|과|와|도|만){0,2}";
/** 계절·시간·날씨를 사용자가 말했나 — 분위기 축은 그때 뽑지 않는다. */
const MOOD_STATED = new RegExp(`(?<![가-힣])(?:봄|여름|가을|겨울|새벽|아침|한낮|저녁|노을|밤|비|눈|안개|폭우|폭풍|벚꽃)(?=${PARTICLE}(?![가-힣]))|비\\s*오는|눈\\s*내리는|해\\s*질\\s*녘`, "u");

/**
 * 장르 이름 그 자체 — 글이 장르를 이름으로 말했으면 그 덱이 낱말 하나(단서·가족·기억)로 걸린 다른 덱보다 먼저다.
 * 2026-11-24 assistant-measure 실측: «단서를 모아 빠져나가는 공포 게임» 이 덱 순서상 추리 덱(«단서»)에 걸려 «용의자별 챕터» 카드를 받았다.
 */
const GENRE_NAME: Partial<Record<DeckId, RegExp>> = {
  recall: /회상|flashback/iu,
  mystery: /추리|탐정|미스터리|mystery|detective/iu,
  warm: /감동|힐링|일상\s*물|heartwarming|slice\s*of\s*life/iu,
  horror: /공포|호러|horror/iu,
  romance: /연애|로맨스|미연시|romance|dating/iu,
};

export function deckFor(text: string, adventureOk = false): Deck | undefined {
  const genres = DECKS.filter((d) => d.id !== "adventure");
  const specific = genres.find((d) => GENRE_NAME[d.id]?.test(text)) ?? genres.find((d) => d.match.test(text));
  if (specific) return specific;
  return adventureOk ? DECKS.find((d) => d.id === "adventure") : undefined;
}

const stated = (options: readonly AxisOption[], text: string): boolean => options.some((o) => o.words?.test(text));
const pickOption = (options: readonly AxisOption[], seed: string): AxisOption => options[hash32(seed) % options.length]!;

/** 몫(w)을 따라 하나 — 같은 씨앗은 같은 후보. */
function weighted(cands: readonly PlaceCandidate[], seed: string): PlaceCandidate {
  const weight = (p: PlaceCandidate) => p.w ?? 2;
  const total = cands.reduce((sum, p) => sum + weight(p), 0);
  let at = hash32(seed) % total;
  for (const p of cands) { at -= weight(p); if (at < 0) return p; }
  return cands[cands.length - 1]!;
}

export function pickVariation(input: VariationInput): Variation | undefined {
  const key = input.key.trim();
  if (!key) return undefined;
  const deck = deckFor(input.text, input.adventureOk);
  if (!deck) return undefined;
  const seed = `${key}|${input.regen ?? 0}|${deck.id}`;
  const text = input.text;
  const skipped: ("places" | "event" | "mood" | "structure")[] = [];
  const allowed = new Set(input.allowedWorlds ?? []);
  const eligible = (p: PlaceCandidate) => p.build.via !== "world" || allowed.has(p.build.world);

  // ── 장소 ──
  let places: PlaceCandidate[] = [];
  const pinned: PlaceCandidate[] = [];
  if (input.worldFixed) {
    skipped.push("places");
  } else {
    for (const p of deck.places) if (eligible(p) && p.words?.test(text) && !pinned.some((q) => q.kind === p.kind)) pinned.push(p);
    const residual = text.replace(new RegExp(deck.match.source, "giu"), " ");
    const placeStated = typeof input.placeStated === "function" ? input.placeStated(residual) : input.placeStated;
    if (!pinned.length && placeStated) {
      skipped.push("places");
    } else {
      const first = pinned.find((p) => !p.indoor) ?? pinned[0] ?? weighted(deck.places.filter((p) => eligible(p) && !p.indoor), `${seed}|first`);
      const world = first.build.via === "world" ? first.build.world : undefined;
      const rest = deck.places
        .filter((p) => p.id !== first.id && eligible(p) && (world ? p.build.via === "world" && p.build.world === world : p.build.via !== "world"))
        .sort((a, b) => Number(pinned.includes(b)) - Number(pinned.includes(a)) || hash32(`${seed}|p|${a.id}`) - hash32(`${seed}|p|${b.id}`));
      places = [first];
      for (const p of rest) { if (places.length >= 3) break; if (!places.some((q) => q.kind === p.kind)) places.push(p); }
    }
  }

  // ── 사건·분위기·구조 ──
  const axis = (name: "event" | "mood" | "structure", options: readonly AxisOption[], extra?: RegExp): AxisOption | undefined => {
    if (stated(options, text) || (extra && extra.test(text))) { skipped.push(name); return undefined; }
    return pickOption(options, `${seed}|${name}`);
  };
  const event = axis("event", deck.events);
  const mood = axis("mood", deck.moods, MOOD_STATED);
  const structure = axis("structure", deck.structures);

  const first = places[0];
  return {
    deck: deck.id, places, pinned: pinned.map((p) => p.ko), ...(first?.build.via === "world" ? { world: first.build.world } : {}),
    ...(event ? { event } : {}), ...(mood ? { mood } : {}), ...(structure ? { structure } : {}), skipped,
  };
}
