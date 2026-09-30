// retro2003 직업 스킬 **공용 조회 한 곳** — 기존 12직업 계약(retroClassSkills.ts)과 2차 로스터 묶음(retroRosterSkills/*)을 합친다.
// 런타임 재생기·편집기 스킬 탭·기본 DB 생성기가 모두 여기서 읽는다. 계약 파일은 읽기 전용이라 합치는 자리를 따로 둔다.
import { RETRO_CLASS_SKILLS, retroClassSkill as baseClassSkill, type RetroClassSkill, type RetroFxAnchor, type RetroFxLayer } from "@/assets/retroClassSkills";
import { retroRosterClass } from "@/assets/retroRoster";
import { RETRO_ROSTER_SKILLS } from "@/assets/retroRosterSkills";
import { RETRO_MONSTER_FX_SHEETS, RETRO_MONSTER_SKILLS, retroMonsterSkill, type RetroMonsterSkill } from "@/assets/retroMonsterSkills";

/** 기존 96개 + 로스터 묶음 스킬 전부. */
export const RETRO_ALL_CLASS_SKILLS: readonly RetroClassSkill[] = [...RETRO_CLASS_SKILLS, ...RETRO_ROSTER_SKILLS];

/** 이펙트 시트(키 하나 = 시트 한 장) 목록. 같은 키는 첫 정의를 쓴다. */
export const RETRO_ALL_FX_SHEETS: readonly RetroFxLayer[] = [...new Map(RETRO_ALL_CLASS_SKILLS.flatMap((skill) => skill.layers).map((layer) => [layer.key, layer])).values()];

const FX_SHEET_META = new Map<string, RetroFxLayer>([...RETRO_ALL_FX_SHEETS, ...RETRO_MONSTER_FX_SHEETS].map((layer) => [layer.key, layer]));

/** 시트 키 → {frame, frames}. 직업·몬스터 계약이 쓰는 모든 시트의 정본 한 곳. 모르는 키는 undefined. */
export function retroFxSheetMeta(key: string | undefined): { readonly frame: 32 | 64 | 128; readonly frames: number } | undefined {
  const layer = key ? FX_SHEET_META.get(key) : undefined;
  return layer ? { frame: layer.frame, frames: layer.frames } : undefined;
}

/** 시트 키 전부(도구·정규화용). */
export function retroFxSheetKeys(): string[] {
  return [...FX_SHEET_META.keys()];
}

const rosterById = new Map(RETRO_ROSTER_SKILLS.map((skill) => [skill.id, skill]));

/** 기존 계약 → 로스터 묶음 순으로 찾는다. */
export function retroClassSkill(id: string | undefined): RetroClassSkill | undefined {
  return baseClassSkill(id) ?? (id ? rosterById.get(id) : undefined);
}

/** 연출을 빌릴 수 있는 레코드 모양(SkillRecord 의 일부). */
export interface RetroChoreographyRef {
  readonly id: string;
  /** 계약에 없는 스킬이 연출만 빌려 올 계약 스킬 id. 자기 id 가 계약이면 무시한다. */
  readonly retroChoreographyId?: string;
}

/**
 * 스킬 레코드의 직업 연출 계약. 조회 순서: ① 레코드 id 가 계약이면 그것 ② 아니면 retroChoreographyId 가 가리키는 직업 계약.
 * 새 스킬·복제 스킬이 계약 약 850개 연출을 그대로 빌려 쓰는 유일한 길이다(런타임 재생기·편집기 무대·조수 도구가 모두 여기서 읽는다).
 */
export function resolveRetroClassChoreography(record: RetroChoreographyRef | undefined): RetroClassSkill | undefined {
  if (!record) return undefined;
  return retroClassSkill(record.id) ?? retroClassSkill(record.retroChoreographyId);
}

/** 위와 같으나 몬스터 계약(skill_mon_*) 쪽. 적 스킬이 다른 몬스터 스킬의 연출을 빌릴 때 쓴다. */
export function resolveRetroMonsterChoreography(record: RetroChoreographyRef | undefined): RetroMonsterSkill | undefined {
  if (!record) return undefined;
  return retroMonsterSkill(record.id) ?? retroMonsterSkill(record.retroChoreographyId);
}

/** 계약 id 하나가 직업 계약인가 몬스터 계약인가(도구 검증용). */
export function retroChoreographyKind(id: string | undefined): "class" | "monster" | undefined {
  if (!id) return undefined;
  return retroClassSkill(id) ? "class" : retroMonsterSkill(id) ? "monster" : undefined;
}

/**
 * 스킬을 복제할 때 사본이 가져갈 연출 계약 id. 원본 id 가 계약이면 그 id, 이미 빌려 쓰고 있으면 그 계약 id, 아니면 undefined.
 * 사본은 새 id 라 계약 조회에서 빠지므로, 이 값을 retroChoreographyId 에 넣어 원본과 같은 도트 연출을 이어받게 한다.
 */
export function retroChoreographyIdForClone(source: RetroChoreographyRef): string | undefined {
  return resolveRetroClassChoreography(source)?.id ?? resolveRetroMonsterChoreography(source)?.id;
}

// ---- 연출 색인(편집기 「도트 연출」 고르기와 조수 list_retro_choreographies 가 함께 읽는다) ----

/** 연출 계열. base=기본 12직업 · actor/people/animal/vehicles/monster-party=2차 로스터 · monster=몬스터 계약(skill_mon_*). */
export type RetroChoreographyFamily = "base" | "actor" | "people" | "animal" | "vehicles" | "monster-party" | "monster";

export const RETRO_CHOREOGRAPHY_FAMILIES: readonly RetroChoreographyFamily[] = ["base", "actor", "people", "animal", "vehicles", "monster-party", "monster"];

export const RETRO_ELEMENT_IDS = ["fire", "ice", "thunder", "water", "earth", "wind", "holy", "dark"] as const;
export type RetroChoreographyElement = (typeof RETRO_ELEMENT_IDS)[number];

const BASE_CLASS_IDS: ReadonlySet<string> = new Set(RETRO_CLASS_SKILLS.map((skill) => skill.classId));

/** 직업이 속한 계열(기본 12직업 → base, 나머지는 걷기 칩 시트 이름). 로스터에 없으면 undefined. */
export function retroClassFamilyOf(classId: string): Exclude<RetroChoreographyFamily, "monster"> | undefined {
  if (BASE_CLASS_IDS.has(classId)) return "base";
  const row = retroRosterClass(classId);
  if (!row) return undefined;
  const sheet = /^([a-z]+)/.exec(row.chip)?.[1];
  return sheet === "actor" ? "actor" : sheet === "people" ? "people" : sheet === "animal" ? "animal" : sheet === "vehicles" ? "vehicles" : "monster-party";
}

export interface RetroChoreographyEntry {
  readonly id: string;
  readonly name: string;
  readonly kind: "class" | "monster";
  readonly family: RetroChoreographyFamily;
  /** 직업 계약이면 그 직업 id(monster 는 undefined). */
  readonly classId?: string;
  readonly className?: string;
  readonly motion: string;
  readonly description: string;
  /** 추정 속성(기믹 칸 > 몬스터 계약 element > 레이어 키·설명 낱말). 없으면 undefined. */
  readonly element?: RetroChoreographyElement;
  readonly anchors: readonly RetroFxAnchor[];
  /** 「user:키×프레임 → target:키×프레임」 한 줄. */
  readonly layerSummary: string;
  readonly layerKeys: readonly string[];
}

const ELEMENT_WORDS: readonly (readonly [RetroChoreographyElement, RegExp])[] = [
  ["fire", /fire|flame|burn|inferno|ember|magma|lava|불|화염|용암|화룡|지옥불/],
  ["ice", /ice|frost|blizzard|freez|snow|glacier|얼음|서리|냉기|눈보라|빙/],
  ["thunder", /thunder|lightning|volt|spark|번개|전기|뇌전|벼락|천둥/],
  ["water", /water|wave|tide|rain|aqua|torrent|물|파도|해일|폭포|빗/],
  ["earth", /earth|quake|rock|stone|crack|sand|대지|지진|땅|바위|모래/],
  ["wind", /wind|gale|tornado|cyclone|바람|회오리|돌풍|태풍/],
  ["holy", /holy|smite|bless|divine|angel|radian|성스|신성|축복|심판|천사|빛/],
  ["dark", /dark|shadow|curse|void|blood|skull|nightmare|암흑|어둠|저주|그림자|흡혈|악몽/],
];

function inferElement(explicit: string | null | undefined, text: string): RetroChoreographyElement | undefined {
  if (explicit && (RETRO_ELEMENT_IDS as readonly string[]).includes(explicit)) return explicit as RetroChoreographyElement;
  for (const [element, pattern] of ELEMENT_WORDS) if (pattern.test(text)) return element;
  return undefined;
}

function summarizeLayers(layers: readonly RetroFxLayer[]): string {
  return layers.map((layer) => `${layer.anchor}:${layer.key}×${layer.frames}`).join(" → ");
}

let entryCache: readonly RetroChoreographyEntry[] | undefined;

/** 계약 전체(직업 96 + 로스터 + 몬스터)를 평평하게 편 색인. 처음 부를 때 한 번만 만든다. */
export function retroChoreographyEntries(): readonly RetroChoreographyEntry[] {
  if (entryCache) return entryCache;
  const classEntries = RETRO_ALL_CLASS_SKILLS.map((skill): RetroChoreographyEntry => {
    const layerKeys = skill.layers.map((layer) => layer.key);
    return {
      id: skill.id, name: skill.name, kind: "class", family: retroClassFamilyOf(skill.classId) ?? "base", classId: skill.classId,
      className: retroRosterClass(skill.classId)?.name ?? skill.classId.replace(/^class_/, ""), motion: skill.motion, description: skill.description,
      element: inferElement(skill.mechanic?.element, `${layerKeys.join(" ")} ${skill.name} ${skill.description}`),
      anchors: [...new Set(skill.layers.map((layer) => layer.anchor))], layerSummary: summarizeLayers(skill.layers), layerKeys,
    };
  });
  const monsterEntries = RETRO_MONSTER_SKILLS.map((skill): RetroChoreographyEntry => {
    const layerKeys = skill.layers.map((layer) => layer.key);
    return {
      id: skill.id, name: skill.name, kind: "monster", family: "monster", motion: skill.motion, description: skill.description,
      element: inferElement(skill.element, `${layerKeys.join(" ")} ${skill.name} ${skill.description}`),
      anchors: [...new Set(skill.layers.map((layer) => layer.anchor))], layerSummary: summarizeLayers(skill.layers), layerKeys,
    };
  });
  return entryCache = [...classEntries, ...monsterEntries];
}

export interface RetroChoreographyFilter {
  readonly motion?: string;
  readonly element?: string;
  readonly anchor?: string;
  readonly family?: string;
  readonly classId?: string;
  /** id·이름·설명·레이어 키·직업 이름에서 찾는 낱말(공백 = AND). */
  readonly query?: string;
}

export function filterRetroChoreographies(filter: RetroChoreographyFilter): RetroChoreographyEntry[] {
  const words = (filter.query ?? "").toLowerCase().split(/\s+/).filter(Boolean);
  return retroChoreographyEntries().filter((entry) => {
    if (filter.motion && entry.motion !== filter.motion) return false;
    if (filter.element && entry.element !== filter.element) return false;
    if (filter.anchor && !entry.anchors.includes(filter.anchor as RetroFxAnchor)) return false;
    if (filter.family && entry.family !== filter.family) return false;
    if (filter.classId && entry.classId !== filter.classId) return false;
    if (words.length === 0) return true;
    const hay = `${entry.id} ${entry.name} ${entry.description} ${entry.className ?? ""} ${entry.layerKeys.join(" ")}`.toLowerCase();
    return words.every((word) => hay.includes(word));
  });
}

/** 잘못된 연출 id 에 가까운 후보(부분 문자열 → 낱말 겹침 순). 조수 도구의 오류 안내용. */
export function nearbyRetroChoreographies(badId: string, limit = 5): RetroChoreographyEntry[] {
  const needle = badId.toLowerCase().replace(/^skill_/, "");
  const tokens = needle.split(/[^a-z0-9가-힣]+/).filter((token) => token.length >= 2);
  const scored = retroChoreographyEntries().map((entry) => {
    const hay = `${entry.id} ${entry.name}`.toLowerCase();
    let score = hay.includes(needle) ? 10 : 0;
    for (const token of tokens) if (hay.includes(token)) score += 2;
    return { entry, score };
  }).filter((item) => item.score > 0);
  return scored.sort((a, b) => b.score - a.score).slice(0, limit).map((item) => item.entry);
}
