// 피드가 컨셉을 받는 곳. 데스크톱 앱이면 스토어(Electron 메인 중계)에서 24개씩, 안 되면 앱 번들 비상용으로 대신한다.
// 스토어가 한 번 실패해도 붙들지 않는다 — 다음 쪽 요청마다 다시 시도한다(잠깐 끊긴 네트워크로 세션 내내 비상용만 보이지 않게).
import bundled from "@/assets/bundledConcepts.json";
import type { OprnStoreBridge } from "@/assetStore/bridgeTypes";
import { NEW_PROJECT_CHOICES } from "@/editor/newProjectChoices";
import type { GamePresetId } from "@/project/gameDesignIds";
import { CONCEPT_TAGS, isBuildableConcept, normalizeGameConcept, type ConceptTag, type GameConcept } from "./format";

export type ConceptQuery = { readonly tag?: string; readonly q?: string };
/** 비상용으로 대신한 까닭. offline = 스토어에 닿지 못함(연결 끊김·응답 늦음), bundled = 닿았지만 컨셉이 없거나 아직 지원하지 않음·스토어 없는 화면. */
export type ConceptFallback = "offline" | "bundled";
export type ConceptPage = { readonly items: readonly GameConcept[]; readonly nextCursor: string | null; readonly fallback: ConceptFallback | null };
export type ConceptDetail = { readonly concept: GameConcept; readonly similar: readonly GameConcept[] };

export interface ConceptSource {
  page(query: ConceptQuery, cursor: string | null): Promise<ConceptPage>;
  detail(concept: GameConcept): Promise<ConceptDetail>;
  thumbUrl(concept: GameConcept, size: "full" | "card"): Promise<string>;
  made(slug: string): void;
  /** 분류 칩에 낼 분류 — 내보내는 컨셉에 실제로 있는 것만. 없으면 화면이 전 분류를 쓴다. */
  tags?(): readonly ConceptTag[];
}

/** 썸네일을 받지 못했을 때 — 장르 틀의 기존 대표 그림. */
export const CONCEPT_FALLBACK_THUMB: Record<GamePresetId, string> = Object.fromEntries(
  NEW_PROJECT_CHOICES.map((choice) => [choice.id, choice.thumb]),
) as Record<GamePresetId, string>;

const BUNDLE_PAGE = 24;
const SHA256 = /^[a-f0-9]{64}$/;

let bundledCache: readonly GameConcept[] | null = null;
export function bundledConcepts(): readonly GameConcept[] {
  // 지금 칩셋으로 못 짓는 컨셉은 번들에 들어 있어도 내보내지 않는다(format.ts isBuildableConcept).
  bundledCache ??= ((bundled as { concepts: unknown[] }).concepts).flatMap((raw) => {
    try { const concept = normalizeGameConcept(raw); return isBuildableConcept(concept) ? [concept] : []; } catch { return []; }
  });
  return bundledCache;
}

export function matchesQuery(concept: GameConcept, query: ConceptQuery): boolean {
  if (query.tag && !concept.tags.includes(query.tag as GameConcept["tags"][number])) return false;
  const q = query.q?.trim().toLowerCase();
  if (!q) return true;
  const locales = Object.values(concept.locales ?? {}).flatMap((entry) => [entry.title, entry.hook]);
  return [concept.title, concept.hook, concept.description, ...concept.tags, ...locales].some((text) => text.toLowerCase().includes(q));
}

function bundledPage(query: ConceptQuery, cursor: string | null, fallback: ConceptFallback = "bundled"): ConceptPage {
  const all = bundledConcepts().filter((concept) => matchesQuery(concept, query));
  const start = cursor && /^b:\d+$/.test(cursor) ? Number(cursor.slice(2)) : 0;
  const items = all.slice(start, start + BUNDLE_PAGE);
  return { items, nextCursor: start + BUNDLE_PAGE < all.length ? `b:${start + BUNDLE_PAGE}` : null, fallback };
}

/** 같은 태그를 많이 공유하는 것부터, 그다음 같은 장르 틀. 자기 자신은 뺀다. */
export function similarFrom(pool: readonly GameConcept[], concept: GameConcept, limit = 6): GameConcept[] {
  return pool
    .filter((other) => other.slug !== concept.slug)
    .map((other) => ({ other, score: other.tags.filter((tag) => concept.tags.includes(tag)).length * 2 + (other.presetId === concept.presetId ? 1 : 0) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry) => entry.other);
}

/** 메인 중계는 스토어 오류를 {"message","status"} JSON 으로 넘긴다. status 0 = 스토어에 닿지 못함. 응답 늦음도 닿지 못한 것으로 친다. */
export function conceptFallbackOf(error: unknown): ConceptFallback {
  const message = error instanceof Error ? error.message : String(error);
  const json = message.match(/\{[\s\S]*\}\s*$/);
  if (json) {
    try {
      const status = (JSON.parse(json[0]) as { status?: unknown }).status;
      if (typeof status === "number" && status > 0) return "bundled";
    } catch { /* 아래로 */ }
  }
  return "offline";
}

function withTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("스토어 응답이 늦습니다.")), ms);
    work.then((value) => { clearTimeout(timer); resolve(value); }, (error: unknown) => { clearTimeout(timer); reject(error); });
  });
}

export type ConceptSourceDeps = {
  readonly bridge?: OprnStoreBridge | null;
  readonly timeoutMs?: number;
  readonly toUrl?: (bytes: Uint8Array) => string;
};

function defaultBridge(): OprnStoreBridge | null {
  if (typeof window === "undefined") return null;
  return (window as unknown as { oprn?: { store?: OprnStoreBridge } }).oprn?.store ?? null;
}

export function createConceptSource(deps: ConceptSourceDeps = {}): ConceptSource {
  const bridge = deps.bridge === undefined ? defaultBridge() : deps.bridge;
  const timeoutMs = deps.timeoutMs ?? 3000;
  const toUrl = deps.toUrl ?? ((bytes: Uint8Array) => URL.createObjectURL(new Blob([bytes as BlobPart], { type: "image/webp" })));
  const thumbs = new Map<string, Promise<string>>();
  return {
    async page(query, cursor) {
      // 비상용 쪽을 넘기는 중이면 그 이어서. 스토어 커서(rank:id)는 스토어로.
      if (!bridge || (cursor && cursor.startsWith("b:"))) return bundledPage(query, cursor);
      try {
        const page = await withTimeout(bridge.concepts({ ...(query.tag ? { tag: query.tag } : {}), ...(query.q?.trim() ? { q: query.q.trim() } : {}), ...(cursor ? { cursor } : {}) }), timeoutMs);
        if (!cursor && page.items.length === 0 && !query.tag && !query.q?.trim()) return bundledPage(query, null);
        return { items: page.items.filter(isBuildableConcept), nextCursor: page.nextCursor, fallback: null };
      } catch (error) {
        // 첫 쪽이 실패하면 비상용으로. 이어지는 쪽이 실패하면 여기서 멈춘다(앞 쪽과 섞지 않는다).
        const fallback = conceptFallbackOf(error);
        return cursor ? { items: [], nextCursor: null, fallback } : bundledPage(query, null, fallback);
      }
    },
    async detail(concept) {
      if (bridge && SHA256.test(concept.thumb.full)) {
        try {
          const detail = await withTimeout(bridge.concept({ slug: concept.slug }), timeoutMs);
          return { concept: detail.concept, similar: detail.similar.filter(isBuildableConcept) };
        } catch { /* 아래 비상용 비슷한 컨셉으로 */ }
      }
      return { concept, similar: similarFrom(bundledConcepts(), concept) };
    },
    thumbUrl(concept, size) {
      const ref = concept.thumb[size];
      if (!SHA256.test(ref)) return Promise.resolve(ref);
      if (!bridge) return Promise.resolve(CONCEPT_FALLBACK_THUMB[concept.presetId]);
      let pending = thumbs.get(ref);
      if (!pending) {
        pending = bridge.blob({ sha256: ref }).then(toUrl, () => {
          thumbs.delete(ref);
          return CONCEPT_FALLBACK_THUMB[concept.presetId];
        });
        thumbs.set(ref, pending);
      }
      return pending;
    },
    tags() {
      const present = new Set(bundledConcepts().flatMap((concept) => concept.tags));
      return CONCEPT_TAGS.filter((tag) => present.has(tag));
    },
    made(slug) {
      void bridge?.conceptMade({ slug }).catch(() => false);
    },
  };
}
