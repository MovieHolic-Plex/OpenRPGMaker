// retro2003 직업 스킬 **공용 조회 한 곳** — 기존 12직업 계약(retroClassSkills.ts)과 2차 로스터 묶음(retroRosterSkills/*)을 합친다.
// 런타임 재생기·편집기 스킬 탭·기본 DB 생성기가 모두 여기서 읽는다. 계약 파일은 읽기 전용이라 합치는 자리를 따로 둔다.
import { RETRO_CLASS_SKILLS, retroClassSkill as baseClassSkill, type RetroClassSkill, type RetroFxAnchor, type RetroFxLayer, type RetroSkillMotion } from "@/assets/retroClassSkills";
import { retroRosterClass } from "@/assets/retroRoster";
import { RETRO_ROSTER_SKILLS } from "@/assets/retroRosterSkills";
import { RETRO_MONSTER_FX_SHEETS, RETRO_MONSTER_SKILLS, retroMonsterSkill, type RetroMonsterSkill, type RetroMonsterSkillMotion } from "@/assets/retroMonsterSkills";
import { retroChoreographyHay, retroQueryMatches, expandQueryWord, koreanWordsOfKey } from "@/assets/retroSearchIndex";
import type { SkillChoreographyLayer, SkillChoreographyRecord } from "@/project/types/database";

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

/** 프로젝트 연출 레코드 목록(database.skillChoreographies). 없으면 기본 연출만 본다. */
export type RetroChoreographyRecords = readonly SkillChoreographyRecord[] | undefined;

/** 연출 한 벌을 런타임이 읽는 **한 가지 모양**. 기본 연출(계약)과 프로젝트 레코드가 같은 모양으로 나온다. */
export interface ResolvedSkillChoreography {
  /** default = 번들 계약(읽기 전용), project = database.skillChoreographies 레코드. */
  readonly origin: "default" | "project";
  readonly id: string;
  readonly kind: "class" | "monster";
  /** kind 에 맞는 동작(프로젝트 레코드는 반대편 동작을 짝 동작으로 바꿔 둔 값). */
  readonly motion: RetroSkillMotion | RetroMonsterSkillMotion;
  /** 런타임·편집기 무대가 그대로 먹는 계약 모양. 프로젝트 레코드는 이 모양으로 합성한다(frame/frames 는 시트 메타에서). */
  readonly skill: RetroClassSkill | RetroMonsterSkill;
  readonly record?: SkillChoreographyRecord;
}

const CLASS_TO_MONSTER: Readonly<Record<RetroSkillMotion, RetroMonsterSkillMotion>> = {
  "dash-strike": "lunge", "blink-strike": "lunge", flurry: "lunge", "leap-strike": "stomp", spin: "stomp",
  cast: "cast", shoot: "shoot", buff: "buff", finisher: "finisher",
};
const MONSTER_TO_CLASS: Readonly<Record<RetroMonsterSkillMotion, RetroSkillMotion>> = {
  lunge: "dash-strike", stomp: "leap-strike", breath: "cast", cast: "cast", shoot: "shoot", buff: "buff", finisher: "finisher",
};
const MONSTER_ONLY_MOTIONS: ReadonlySet<string> = new Set(["lunge", "breath", "stomp"]);

/** 프로젝트 레코드의 기본 편: 복제 원본이 몬스터 계약이면 몬스터, 몬스터 전용 동작이면 몬스터, 아니면 직업. */
export function skillChoreographyRecordKind(record: SkillChoreographyRecord): "class" | "monster" {
  const source = record.sourceId ? retroChoreographyKind(record.sourceId) : undefined;
  if (source) return source;
  return MONSTER_ONLY_MOTIONS.has(record.motion) ? "monster" : "class";
}

type MutableLayer = { -readonly [K in keyof RetroFxLayer]: RetroFxLayer[K] };

function recordLayers(layers: readonly SkillChoreographyLayer[]): RetroFxLayer[] {
  return layers.flatMap((layer) => {
    const meta = retroFxSheetMeta(layer.sheet);
    if (!meta) return [];
    const out: MutableLayer = { key: layer.sheet, anchor: layer.anchor, frame: meta.frame, frames: meta.frames };
    if (layer.startMs !== undefined) out.startMs = layer.startMs;
    if (layer.scale !== undefined) out.scale = layer.scale;
    if (layer.repeat !== undefined) out.repeat = layer.repeat;
    if (layer.onHit !== undefined) out.onHit = layer.onHit;
    if (layer.tint !== undefined) out.tint = layer.tint;
    if (layer.se !== undefined) out.se = layer.se;
    return [out];
  });
}

const synthesized = new WeakMap<SkillChoreographyRecord, { class?: RetroClassSkill; monster?: RetroMonsterSkill }>();

function synthesizeRecord(record: SkillChoreographyRecord, kind: "class" | "monster"): RetroClassSkill | RetroMonsterSkill {
  const cache = synthesized.get(record) ?? {};
  synthesized.set(record, cache);
  if (kind === "class") {
    return cache.class ??= {
      id: record.id, classId: "", actorId: "", name: record.name, level: 1,
      motion: (MONSTER_TO_CLASS as Record<string, RetroSkillMotion | undefined>)[record.motion] ?? (record.motion as RetroSkillMotion),
      description: record.description ?? "", layers: recordLayers(record.layers),
    };
  }
  const layers = recordLayers(record.layers);
  const motion = (CLASS_TO_MONSTER as Record<string, RetroMonsterSkillMotion | undefined>)[record.motion] ?? (record.motion as RetroMonsterSkillMotion);
  const effect: RetroMonsterSkill["effect"] = motion === "buff"
    ? (layers.some((layer) => layer.anchor === "allAllies") ? "buffAllies" : "buffSelf")
    : (layers.some((layer) => layer.anchor === "allTargets" || layer.anchor === "screen") ? "damageAll" : "damage");
  return cache.monster ??= { id: record.id, name: record.name, motion, description: record.description ?? "", effect, layers };
}

/**
 * 스킬 레코드의 연출 **한 곳 조회**. 조회 순서:
 * ① 스킬 id 가 계약(기본 연출) id 이면 그 계약 ② retroChoreographyId 가 프로젝트 연출 레코드(chor_*) 면 그 레코드
 * ③ retroChoreographyId 가 기본 연출 id 이면 그 계약. 없으면 undefined.
 * `want` 를 주면 그 편의 모양으로 돌려준다. 기본 연출은 자기 편만(다른 편이면 undefined), 프로젝트 레코드는 동작을 짝 동작으로 바꿔 어느 편에서든 나온다.
 */
export function resolveSkillChoreography(
  ref: RetroChoreographyRef | undefined,
  records?: RetroChoreographyRecords,
  want?: "class" | "monster",
): ResolvedSkillChoreography | undefined {
  if (!ref) return undefined;
  const contract = (id: string | undefined): ResolvedSkillChoreography | undefined => {
    const classSkill = retroClassSkill(id);
    if (classSkill) return want === "monster" ? undefined : { origin: "default", id: classSkill.id, kind: "class", motion: classSkill.motion, skill: classSkill };
    const monsterSkill = retroMonsterSkill(id);
    if (monsterSkill) return want === "class" ? undefined : { origin: "default", id: monsterSkill.id, kind: "monster", motion: monsterSkill.motion, skill: monsterSkill };
    return undefined;
  };
  const own = contract(ref.id);
  // A request for the other kind cannot replace an existing own contract with a borrowed one.
  if (retroChoreographyKind(ref.id)) return own;
  const record = ref.retroChoreographyId && records ? records.find((row) => row.id === ref.retroChoreographyId) : undefined;
  if (record) {
    const kind = want ?? skillChoreographyRecordKind(record);
    const skill = synthesizeRecord(record, kind);
    return { origin: "project", id: record.id, kind, motion: skill.motion, skill, record };
  }
  return contract(ref.retroChoreographyId);
}

/** 어떤 적이 행동 패턴(actions[].skillId)으로 이 스킬을 쓰는가. 적이 쓰는 스킬은 런타임이 자동 추천을 끄고(기본 몬스터 연출) 연출 레코드·연출 id 만 반영한다. */
export function isEnemyUsedSkill(
  database: { enemies?: readonly { actions?: readonly { skillId?: string }[] }[] } | undefined,
  skillId: string | undefined,
): boolean {
  return Boolean(skillId && database?.enemies?.some((enemy) => enemy.actions?.some((row) => row.skillId === skillId)));
}

/** 직업 모양의 연출(계약 또는 프로젝트 레코드). `records` 를 주지 않으면 기본 연출만 본다. */
export function resolveRetroClassChoreography(record: RetroChoreographyRef | undefined, records?: RetroChoreographyRecords): RetroClassSkill | undefined {
  return resolveSkillChoreography(record, records, "class")?.skill as RetroClassSkill | undefined;
}

/** 위와 같으나 몬스터 모양(skill_mon_*). 적 스킬이 다른 몬스터 스킬의 연출을 빌리거나 프로젝트 레코드를 쓸 때. */
export function resolveRetroMonsterChoreography(record: RetroChoreographyRef | undefined, records?: RetroChoreographyRecords): RetroMonsterSkill | undefined {
  return resolveSkillChoreography(record, records, "monster")?.skill as RetroMonsterSkill | undefined;
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
  // 계약 id 가 자기 id 면 계약이 이긴다. 아니고 프로젝트 연출 레코드(chor_*)를 빌려 쓰고 있으면 그 id 를 이어받는다.
  if (!retroChoreographyKind(source.id) && source.retroChoreographyId?.startsWith("chor_")) return source.retroChoreographyId;
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
  /** default = 번들 계약(읽기 전용), project = database.skillChoreographies 레코드. */
  readonly origin: "default" | "project";
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
      origin: "default", id: skill.id, name: skill.name, kind: "class", family: retroClassFamilyOf(skill.classId) ?? "base", classId: skill.classId,
      className: retroRosterClass(skill.classId)?.name ?? skill.classId.replace(/^class_/, ""), motion: skill.motion, description: skill.description,
      element: inferElement(skill.mechanic?.element, `${layerKeys.join(" ")} ${skill.name} ${skill.description}`),
      anchors: [...new Set(skill.layers.map((layer) => layer.anchor))], layerSummary: summarizeLayers(skill.layers), layerKeys,
    };
  });
  const monsterEntries = RETRO_MONSTER_SKILLS.map((skill): RetroChoreographyEntry => {
    const layerKeys = skill.layers.map((layer) => layer.key);
    return {
      origin: "default", id: skill.id, name: skill.name, kind: "monster", family: "monster", motion: skill.motion, description: skill.description,
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
  /** default(번들 계약) / project(프로젝트 레코드). */
  readonly origin?: string;
}

/** 프로젝트 연출 레코드를 기본 연출과 같은 색인 모양으로 편다(도구 목록·오류 후보용). */
export function projectRetroChoreographyEntries(records: RetroChoreographyRecords): RetroChoreographyEntry[] {
  return (records ?? []).map((record): RetroChoreographyEntry => {
    const layers = recordLayers(record.layers);
    const layerKeys = layers.map((layer) => layer.key);
    const source = record.sourceId ? retroChoreographyEntries().find((entry) => entry.id === record.sourceId) : undefined;
    return {
      origin: "project", id: record.id, name: record.name, kind: skillChoreographyRecordKind(record), family: source?.family ?? "base",
      ...(source?.classId ? { classId: source.classId, className: source.className } : {}),
      motion: record.motion, description: record.description ?? "",
      element: inferElement(record.tags?.element, `${layerKeys.join(" ")} ${record.name} ${record.description ?? ""}`),
      anchors: [...new Set(layers.map((layer) => layer.anchor))], layerSummary: summarizeLayers(layers), layerKeys,
    };
  });
}

export function filterRetroChoreographies(filter: RetroChoreographyFilter, records?: RetroChoreographyRecords): RetroChoreographyEntry[] {
  const query = filter.query;
  const pool = records && records.length > 0 ? [...projectRetroChoreographyEntries(records), ...retroChoreographyEntries()] : retroChoreographyEntries();
  return pool.filter((entry) => {
    if (filter.origin && entry.origin !== filter.origin) return false;
    if (filter.motion && entry.motion !== filter.motion) return false;
    if (filter.element && entry.element !== filter.element) return false;
    if (filter.anchor && !entry.anchors.includes(filter.anchor as RetroFxAnchor)) return false;
    if (filter.family && entry.family !== filter.family) return false;
    if (filter.classId && entry.classId !== filter.classId) return false;
    return retroQueryMatches(query, retroChoreographyHay(entry));
  });
}

/** 잘못된 연출 id 에 가까운 후보(부분 문자열 → 낱말 겹침 순). 조수 도구의 오류 안내용. */
export function nearbyRetroChoreographies(badId: string, limit = 5, records?: RetroChoreographyRecords): RetroChoreographyEntry[] {
  const needle = badId.toLowerCase().replace(/^skill_/, "");
  const tokens = needle.split(/[^a-z0-9가-힣]+/).filter((token) => token.length >= 2);
  const scored = [...projectRetroChoreographyEntries(records), ...retroChoreographyEntries()].map((entry) => {
    const hay = `${entry.id} ${entry.name}`.toLowerCase();
    let score = hay.includes(needle) ? 10 : 0;
    for (const token of tokens) if (hay.includes(token)) score += 2;
    return { entry, score };
  }).filter((item) => item.score > 0);
  return scored.sort((a, b) => b.score - a.score).slice(0, limit).map((item) => item.entry);
}

// ---- 이펙트 시트 색인(조수 list_fx_sheets / upsert_choreography 오류 후보) ----

export interface RetroFxSheetEntry {
  readonly key: string;
  readonly frame: 32 | 64 | 128;
  readonly frames: number;
  /** 이 시트를 층으로 쓰는 기본 연출(직업+몬스터 계약) 개수. */
  readonly usedBy: number;
}

let sheetCache: readonly RetroFxSheetEntry[] | undefined;

/** 시트 전부(키 순). 처음 부를 때 한 번 만든다. */
export function retroFxSheetEntries(): readonly RetroFxSheetEntry[] {
  if (sheetCache) return sheetCache;
  const used = new Map<string, number>();
  for (const entry of retroChoreographyEntries()) for (const key of new Set(entry.layerKeys)) used.set(key, (used.get(key) ?? 0) + 1);
  return sheetCache = [...FX_SHEET_META.values()]
    .map((layer): RetroFxSheetEntry => ({ key: layer.key, frame: layer.frame, frames: layer.frames, usedBy: used.get(layer.key) ?? 0 }))
    .sort((a, b) => a.key.localeCompare(b.key));
}

let sheetHayCache: Map<string, string> | undefined;

/**
 * 시트 검색 건초더미: 영어 키 + 키 조각의 한국어 + 이 시트를 쓰는 기본 연출의 이름·설명·직업.
 * 「번개」로 찾으면 키에 bolt 가 든 시트와, 번개 스킬이 쓰는 시트가 함께 나온다.
 */
export function retroFxSheetHay(key: string): string {
  if (!sheetHayCache) {
    const names = new Map<string, Set<string>>();
    for (const entry of retroChoreographyEntries()) {
      const text = `${entry.name} ${entry.description} ${entry.className ?? ""}`;
      for (const layerKey of new Set(entry.layerKeys)) {
        let set = names.get(layerKey);
        if (!set) names.set(layerKey, set = new Set());
        set.add(text);
      }
    }
    sheetHayCache = new Map();
    for (const sheet of retroFxSheetEntries()) sheetHayCache.set(sheet.key, `${sheet.key} ${koreanWordsOfKey(sheet.key)} ${[...(names.get(sheet.key) ?? [])].slice(0, 6).join(" ")}`);
  }
  return sheetHayCache.get(key) ?? `${key} ${koreanWordsOfKey(key)}`;
}

/** 시트 검색(공백=AND). 영어 키·한국어 낱말·속성 동의어(번개↔thunder/bolt/…)·쓰는 스킬의 이름/설명을 본다. */
export function searchRetroFxSheets(query: string | undefined): RetroFxSheetEntry[] {
  return retroFxSheetEntries().filter((entry) => retroQueryMatches(query, retroFxSheetHay(entry.key)));
}

/** 모르는 시트 키에 가까운 후보(부분 문자열 → 낱말 겹침 → 많이 쓰이는 순). */
export function nearbyRetroFxSheets(badKey: string, limit = 5): RetroFxSheetEntry[] {
  const needle = badKey.toLowerCase();
  const tokens = [...new Set(needle.split(/[^a-z0-9가-힣]+/).filter((token) => token.length >= 2).flatMap((token) => [...expandQueryWord(token)].filter((item) => item.length >= 2 && /^[a-z0-9]+$/.test(item))))];
  return retroFxSheetEntries()
    .map((entry) => {
      const key = entry.key.toLowerCase();
      let score = key.includes(needle) || needle.includes(key) ? 10 : 0;
      for (const token of tokens) if (key.includes(token)) score += 2;
      return { entry, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || b.entry.usedBy - a.entry.usedBy)
    .slice(0, limit)
    .map((item) => item.entry);
}
