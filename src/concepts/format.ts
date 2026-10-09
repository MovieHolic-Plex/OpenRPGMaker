// 컨셉 피드 카드 한 장(oprn-concept/1). 스토어 서버·Electron 중계·하네스·화면이 같이 쓰는 순수 모듈이다.
// DOM·node 의존을 두지 않는다 — store-server 와 하네스 CLI 도 이 파일을 그대로 import 한다.
import { GAME_BRIEF_SLOTS, GAME_PRESET_IDS, type GameBriefSlot, type GamePresetId } from "../project/gameDesignIds";

export const CONCEPT_FORMAT = "oprn-concept/1";
export const CONCEPT_TAGS = [
  "웹소설", "패러디", "퓨전 사극", "정통 JRPG", "몬스터 수집", "추리", "연애", "호러", "힐링", "농장", "액션", "SF", "학원", "코미디",
] as const;
export type ConceptTag = typeof CONCEPT_TAGS[number];
export const CONCEPT_LOCALES = ["en", "ja", "zh"] as const;
export type ConceptLocale = typeof CONCEPT_LOCALES[number];
export const CONCEPT_TWEAK_LIMIT = 300;
/**
 * 지금 그림이 준비된 공용 번들 타일셋 — 피드는 이 넷 중 하나로 지을 수 있는 컨셉만 보인다(2026-10-08 사용자 결정).
 * 칩셋이 준비되면 여기에 더한다. 몬스터 수집은 첫 구간 도로 도구(author_wild_route)가 버들항 전용이라 아직 뺀다.
 */
export const BUILDABLE_CONCEPT_TILESETS = ["joseon_baram", "wizarding_world", "jp_city", "beodeul_city"] as const;
export const UNBUILDABLE_CONCEPT_PRESETS: readonly string[] = ["monster-collect"];
export const CONCEPT_LIMITS = { title: 40, hook: 120, description: 600, protagonist: 120, stage: 120, firstScene: 160, brief: 1000 } as const;

export interface GameConcept {
  slug: string;
  title: string;
  hook: string;
  description: string;
  tags: ConceptTag[];
  /** 장르 틀 — 엔진이 실제로 지을 수 있는 시작 프리셋. */
  presetId: GamePresetId;
  protagonist: string;
  stage: string;
  firstScene: string;
  /** 조수에게 가는 기획 5칸. */
  brief: Record<GameBriefSlot, string>;
  /** 이미 있는 번들 타일셋 id(joseon_baram, wizarding_world, jp_city …). */
  tilesetHint?: string;
  /** 번들은 경로, 스토어는 blob sha256. */
  thumb: { full: string; card: string };
  locales?: Partial<Record<ConceptLocale, { title: string; hook: string; description: string }>>;
  source: "official" | "user";
  author?: { name: string };
  madeCount?: number;
  aiGenerated: true;
}

/** 지금 칩셋으로 지을 수 있는 컨셉인가 — 준비된 번들 타일셋을 무대로 쓰고, 아직 못 짓는 장르 틀이 아닐 것. */
export function isBuildableConcept(concept: Pick<GameConcept, "tilesetHint" | "presetId">): boolean {
  return (BUILDABLE_CONCEPT_TILESETS as readonly string[]).includes(concept.tilesetHint ?? "") && !UNBUILDABLE_CONCEPT_PRESETS.includes(concept.presetId);
}

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

function text(value: unknown, label: string, max: number): string {
  if (typeof value !== "string") throw new Error(`컨셉 ${label}이(가) 글자가 아닙니다.`);
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > max) throw new Error(`컨셉 ${label} 길이가 올바르지 않습니다(1~${max}자).`);
  return trimmed;
}

export function normalizeGameConcept(value: unknown): GameConcept {
  if (!isRecord(value)) throw new Error("컨셉이 객체가 아닙니다.");
  const slug = text(value.slug, "slug", 80);
  if (slug.length < 3 || !SLUG.test(slug)) throw new Error("컨셉 slug 는 소문자·숫자·하이픈 3~80자입니다.");
  if (!GAME_PRESET_IDS.includes(value.presetId as GamePresetId)) throw new Error("컨셉 장르 틀이 올바르지 않습니다.");
  if (!Array.isArray(value.tags) || value.tags.length < 1 || value.tags.length > 4) throw new Error("컨셉 분류는 1~4개입니다.");
  const tags = value.tags.map((tag) => {
    if (!CONCEPT_TAGS.includes(tag as ConceptTag)) throw new Error(`모르는 컨셉 분류입니다: ${String(tag)}`);
    return tag as ConceptTag;
  });
  if (!isRecord(value.brief)) throw new Error("컨셉 기획 5칸이 없습니다.");
  const rawBrief = value.brief;
  const brief = {} as Record<GameBriefSlot, string>;
  for (const slot of GAME_BRIEF_SLOTS) brief[slot] = text(rawBrief[slot], `기획(${slot})`, CONCEPT_LIMITS.brief);
  if (!isRecord(value.thumb)) throw new Error("컨셉 썸네일이 없습니다.");
  const thumb = { full: text(value.thumb.full, "썸네일", 300), card: text(value.thumb.card, "썸네일", 300) };
  let locales: GameConcept["locales"];
  if (value.locales !== undefined) {
    if (!isRecord(value.locales)) throw new Error("컨셉 번역이 올바르지 않습니다.");
    locales = {};
    for (const locale of CONCEPT_LOCALES) {
      const entry = value.locales[locale];
      if (entry === undefined) continue;
      if (!isRecord(entry)) throw new Error("컨셉 번역이 올바르지 않습니다.");
      locales[locale] = { title: text(entry.title, "번역 제목", 80), hook: text(entry.hook, "번역 훅", 240), description: text(entry.description, "번역 설명", 1200) };
    }
  }
  if (value.source !== "official" && value.source !== "user") throw new Error("컨셉 출처가 올바르지 않습니다.");
  return {
    slug,
    title: text(value.title, "제목", CONCEPT_LIMITS.title),
    hook: text(value.hook, "훅", CONCEPT_LIMITS.hook),
    description: text(value.description, "설명", CONCEPT_LIMITS.description),
    tags: [...new Set(tags)],
    presetId: value.presetId as GamePresetId,
    protagonist: text(value.protagonist, "주인공", CONCEPT_LIMITS.protagonist),
    stage: text(value.stage, "무대", CONCEPT_LIMITS.stage),
    firstScene: text(value.firstScene, "첫 장면", CONCEPT_LIMITS.firstScene),
    brief,
    ...(typeof value.tilesetHint === "string" && value.tilesetHint.trim() ? { tilesetHint: text(value.tilesetHint, "타일셋", 80) } : {}),
    thumb,
    ...(locales && Object.keys(locales).length > 0 ? { locales } : {}),
    source: value.source,
    ...(isRecord(value.author) ? { author: { name: text(value.author.name, "작가", 60) } } : {}),
    ...(typeof value.madeCount === "number" && Number.isFinite(value.madeCount) ? { madeCount: Math.max(0, Math.floor(value.madeCount)) } : {}),
    aiGenerated: true,
  };
}

/** 한글 제목도 ascii slug 로 바꾼다. 로마자가 거의 없는 제목은 해시 꼬리만 남는다. 같은 제목 충돌은 salt 로 피한다. */
export function conceptSlug(title: string, salt = ""): string {
  const ascii = title.normalize("NFKD").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  let hash = 2166136261;
  for (const ch of title + salt) hash = Math.imul(hash ^ ch.codePointAt(0)!, 16777619) >>> 0;
  const tail = hash.toString(36).padStart(6, "0").slice(0, 6);
  const head = ascii.length >= 3 ? ascii.slice(0, 60).replace(/-+$/g, "") : "concept";
  return `${head}-${tail}`.replace(/-+/g, "-");
}

/** 화면 언어의 제목·훅·설명. 번역이 없으면 원문(한국어). */
export function localizedConcept(concept: GameConcept, locale: string): Pick<GameConcept, "title" | "hook" | "description"> {
  const entry = concept.locales?.[locale as ConceptLocale];
  return entry ?? { title: concept.title, hook: concept.hook, description: concept.description };
}
