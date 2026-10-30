// 스토어 효과음 팩이 소리마다 싣는 고르기용 설명(UploadedAsset.meta.oprnSound, 판 1).
// 팩을 넣으면 meta 가 그대로 프로젝트에 들어온다(src/assetStore/pack.ts applyPackToProject).
// 조수는 이 값으로 자리(cue)·화풍(style)·분위기에 맞는 소리를 고르고(store_find_sound), 자리 표(project.system.seCues)에 건다.
//
// 계약(스토어 효과음 제작자와 맞춘 판 1, 2026-10-30):
//   { version:1, slots: string[](1..4, slots[0] 이 주 자리), group: ui|battle|magic|field, style: retro|modern, set, variant: a|b|c,
//     mood: string[](≤8), intensity 1..5, durationSec, loopable, pairWith: string[], lufs, summaryKo(≤200), feelTags(≤12), qa? }
// - 자리 id 는 `@/project/seCues` 의 SE_CUE_SPECS. 옛 이름 별칭(collapse → faint, evasion → miss)을 받는다.
// - 아는 자리가 하나도 없으면 null(고르기에 쓸 수 없다). 모르는 새 자리 id 는 버리지 않고 extraSlots 로 넘긴다(태그·미래 자리).
// - qa 는 참고용(제작자 자체 점수) — 순위에는 아주 작은 동점 깨기로만 쓴다.
import { isKnownSeCue, isSeCueId } from "@/project/seCues";

export const STORE_SOUND_STYLES = ["retro", "modern"] as const;
export type StoreSoundStyle = (typeof STORE_SOUND_STYLES)[number];
export const STORE_SOUND_GROUPS = ["ui", "battle", "magic", "field"] as const;
export type StoreSoundGroup = (typeof STORE_SOUND_GROUPS)[number];

/** 옛 이름 → 지금 자리 id. 팩이 두 이름을 같이 싣는다(["faint","collapse"]). */
const SLOT_ALIASES: Readonly<Record<string, string>> = { collapse: "faint", evasion: "miss", decide: "confirm", recovery: "heal", guard: "defend" };

export const STORE_SOUND_STYLE_LABELS: Readonly<Record<StoreSoundStyle, string>> = { retro: "레트로 칩", modern: "현대" };

export interface StoreSoundMeta {
  /** 아는 자리(정규화·별칭 풀림), 주 자리가 맨 앞. */
  readonly slots: readonly string[];
  /** 모르는 자리 id(새 팩 자리) — 고르기에서 태그로만 쓴다. */
  readonly extraSlots: readonly string[];
  readonly group: StoreSoundGroup | null;
  readonly style: StoreSoundStyle | null;
  readonly set: string;
  readonly variant: "a" | "b" | "c" | null;
  readonly mood: readonly string[];
  readonly intensity: number | null;
  readonly durationSec: number | null;
  readonly loopable: boolean;
  readonly pairWith: readonly string[];
  readonly summaryKo: string;
  readonly feelTags: readonly string[];
  /** 제작자 자체 점수 평균(0~10). 없으면 null. 동점 깨기에만 쓴다. */
  readonly qaScore: number | null;
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const text = (value: unknown, max: number): string => (typeof value === "string" ? value.trim().slice(0, max) : "");
const words = (value: unknown, max: number, len = 40): string[] =>
  Array.isArray(value) ? [...new Set(value.map((item) => text(item, len)).filter(Boolean))].slice(0, max) : [];
const number = (value: unknown, min: number, max: number): number | null =>
  typeof value === "number" && Number.isFinite(value) && value >= min && value <= max ? value : null;

/** 자리 하나 정리(별칭 풀기). 꼴이 틀리면 null. */
export function normalizeStoreSoundSlot(value: unknown): string | null {
  const raw = text(value, 64);
  if (!raw) return null;
  const aliased = SLOT_ALIASES[raw] ?? raw;
  return isSeCueId(aliased) ? aliased : null;
}

/** meta.oprnSound 를 읽는다. 아는 자리가 하나도 없으면 null. */
export function readStoreSoundMeta(meta: unknown): StoreSoundMeta | null {
  const raw = isRecord(meta) ? meta.oprnSound : undefined;
  if (!isRecord(raw)) return null;
  const all = Array.isArray(raw.slots) ? [...new Set(raw.slots.slice(0, 8).map(normalizeStoreSoundSlot).filter((slot): slot is string => slot !== null))] : [];
  const slots = all.filter(isKnownSeCue);
  if (!slots.length) return null;
  const group = (STORE_SOUND_GROUPS as readonly unknown[]).includes(raw.group) ? raw.group as StoreSoundGroup : null;
  const style = (STORE_SOUND_STYLES as readonly unknown[]).includes(raw.style) ? raw.style as StoreSoundStyle : null;
  const variant = raw.variant === "a" || raw.variant === "b" || raw.variant === "c" ? raw.variant : null;
  const qa = isRecord(raw.qa) ? [raw.qa.clapFit, raw.qa.tech, raw.qa.ear].map((v) => number(v, 0, 10)).filter((v): v is number => v !== null) : [];
  return {
    slots,
    extraSlots: all.filter((slot) => !isKnownSeCue(slot)),
    group, style,
    set: text(raw.set, 60),
    variant,
    mood: words(raw.mood, 8, 24),
    intensity: number(raw.intensity, 1, 5),
    durationSec: number(raw.durationSec, 0, 600),
    loopable: raw.loopable === true,
    pairWith: words(raw.pairWith, 8, 120),
    summaryKo: text(raw.summaryKo, 200),
    feelTags: words(raw.feelTags, 12),
    qaScore: qa.length ? qa.reduce((a, b) => a + b, 0) / qa.length : null,
  };
}

/** 검색 태그: 자리·화풍·묶음·분위기·느낌. */
export function storeSoundTags(sound: StoreSoundMeta): string[] {
  return [...new Set([
    ...sound.slots, ...sound.extraSlots,
    ...(sound.style ? [sound.style, STORE_SOUND_STYLE_LABELS[sound.style]] : []),
    ...(sound.group ? [sound.group] : []),
    ...sound.mood, ...sound.feelTags,
  ].filter(Boolean))];
}

/** 조수가 읽는 한 줄 설명. */
export function storeSoundDescription(sound: StoreSoundMeta): string {
  const facts = [
    `자리 ${sound.slots.join("·")}`,
    sound.style ? `화풍 ${STORE_SOUND_STYLE_LABELS[sound.style]}` : "",
    sound.variant ? `${sound.variant.toUpperCase()}안` : "",
    sound.mood.length ? `분위기 ${sound.mood.join("·")}` : "",
    sound.intensity !== null ? `세기 ${sound.intensity}/5` : "",
    sound.durationSec !== null ? `${sound.durationSec.toFixed(2)}초` : "",
  ].filter(Boolean);
  return [sound.summaryKo, facts.join(" · ")].filter(Boolean).join(" — ");
}
