// 스킬 연출 레코드(database.skillChoreographies) 정규화. 설계: docs/superpowers/specs/2026-09-30-skill-choreography-records-design.md
// 모르는 시트 키·잘못된 anchor/motion 층은 **버리고**, 숫자는 범위로 자른다. 저장·불러오기·조수 도구가 모두 이 한 함수를 지난다.
import { retroFxSheetMeta } from "@/assets/retroSkillCatalog";
import type { SkillChoreographyLayer, SkillChoreographyRecord } from "@/project/types/database";

export const SKILL_CHOREOGRAPHY_ID_PREFIX = "chor_";
export const SKILL_CHOREOGRAPHY_LIMIT = 500;
export const SKILL_CHOREOGRAPHY_LAYER_LIMIT = 8;
export const SKILL_CHOREOGRAPHY_ANCHORS = ["user", "target", "allTargets", "allAllies", "screen", "projectile"] as const;
export const SKILL_CHOREOGRAPHY_CLASS_MOTIONS = ["dash-strike", "leap-strike", "blink-strike", "flurry", "spin", "cast", "shoot", "buff", "finisher"] as const;
export const SKILL_CHOREOGRAPHY_MONSTER_MOTIONS = ["lunge", "shoot", "cast", "breath", "stomp", "buff", "finisher"] as const;
export const SKILL_CHOREOGRAPHY_MOTIONS: readonly string[] = [...new Set([...SKILL_CHOREOGRAPHY_CLASS_MOTIONS, ...SKILL_CHOREOGRAPHY_MONSTER_MOTIONS])];
export const SKILL_CHOREOGRAPHY_WEIGHTS = ["light", "normal", "heavy"] as const;

/** 층 옵션 범위. 도구·검사기·문서가 같은 숫자를 읽는다. */
export const SKILL_CHOREOGRAPHY_RANGES = {
  speed: [0.5, 2],
  scale: [0.5, 3],
  repeat: [1, 6],
  startMs: [0, 5000],
  shake: [0, 12],
} as const;

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function text(value: unknown, max: number): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, max) : undefined;
}
function clamp(value: unknown, [min, max]: readonly [number, number]): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : undefined;
}
function color(value: unknown): string | undefined {
  return typeof value === "string" && HEX_COLOR.test(value.trim()) ? value.trim().toLowerCase() : undefined;
}

/** 층 하나. 시트 키가 시트 메타에 없거나 anchor 가 잘못이면 undefined(그 층을 버린다). */
export function normalizeSkillChoreographyLayer(raw: unknown): SkillChoreographyLayer | undefined {
  if (!isRecord(raw)) return undefined;
  const sheet = text(raw.sheet, 96);
  if (!sheet || !retroFxSheetMeta(sheet)) return undefined;
  if (!(SKILL_CHOREOGRAPHY_ANCHORS as readonly unknown[]).includes(raw.anchor)) return undefined;
  const startMs = clamp(raw.startMs, SKILL_CHOREOGRAPHY_RANGES.startMs);
  const scale = clamp(raw.scale, SKILL_CHOREOGRAPHY_RANGES.scale);
  const repeatRaw = clamp(raw.repeat, SKILL_CHOREOGRAPHY_RANGES.repeat);
  const tint = color(raw.tint);
  const se = text(raw.se, 96);
  return {
    sheet,
    anchor: raw.anchor as SkillChoreographyLayer["anchor"],
    ...(startMs !== undefined ? { startMs: Math.round(startMs) } : {}),
    ...(scale !== undefined ? { scale: Math.round(scale * 100) / 100 } : {}),
    ...(repeatRaw !== undefined ? { repeat: Math.round(repeatRaw) } : {}),
    ...(raw.onHit === "each" || raw.onHit === "first" ? { onHit: raw.onHit } : {}),
    ...(tint ? { tint } : {}),
    ...(se ? { se } : {}),
  };
}

/** 레코드 하나. id 가 chor_ 로 시작하지 않거나 동작이 잘못이거나 남은 층이 0이면 undefined. */
export function normalizeSkillChoreographyRecord(raw: unknown): SkillChoreographyRecord | undefined {
  if (!isRecord(raw)) return undefined;
  const id = text(raw.id, 96);
  if (!id || !id.startsWith(SKILL_CHOREOGRAPHY_ID_PREFIX) || id.length === SKILL_CHOREOGRAPHY_ID_PREFIX.length) return undefined;
  if (typeof raw.motion !== "string" || !SKILL_CHOREOGRAPHY_MOTIONS.includes(raw.motion)) return undefined;
  const layers = (Array.isArray(raw.layers) ? raw.layers : [])
    .slice(0, SKILL_CHOREOGRAPHY_LAYER_LIMIT)
    .map(normalizeSkillChoreographyLayer)
    .filter((layer): layer is SkillChoreographyLayer => layer !== undefined);
  if (layers.length === 0) return undefined;
  const description = text(raw.description, 400);
  const speed = clamp(raw.speed, SKILL_CHOREOGRAPHY_RANGES.speed);
  const tint = color(raw.tint);
  const sourceId = text(raw.sourceId, 96);
  const screen = normalizeScreen(raw.screen);
  const tags = normalizeTags(raw.tags);
  return {
    id,
    name: text(raw.name, 80) ?? id,
    ...(description ? { description } : {}),
    motion: raw.motion as SkillChoreographyRecord["motion"],
    layers,
    ...(speed !== undefined ? { speed: Math.round(speed * 100) / 100 } : {}),
    ...((SKILL_CHOREOGRAPHY_WEIGHTS as readonly unknown[]).includes(raw.weight) ? { weight: raw.weight as SkillChoreographyRecord["weight"] } : {}),
    ...(tint ? { tint } : {}),
    ...(screen ? { screen } : {}),
    ...(tags ? { tags } : {}),
    ...(sourceId ? { sourceId } : {}),
  };
}

function normalizeScreen(raw: unknown): SkillChoreographyRecord["screen"] | undefined {
  if (!isRecord(raw)) return undefined;
  const shake = clamp(raw.shake, SKILL_CHOREOGRAPHY_RANGES.shake);
  const flash = color(raw.flash);
  const out: NonNullable<SkillChoreographyRecord["screen"]> = {
    ...(shake !== undefined ? { shake } : {}),
    ...(flash ? { flash } : {}),
    ...(raw.dim === true ? { dim: true } : {}),
    ...(raw.cutIn === true ? { cutIn: true } : {}),
  };
  return Object.keys(out).length > 0 ? out : undefined;
}

function normalizeTags(raw: unknown): SkillChoreographyRecord["tags"] | undefined {
  if (!isRecord(raw)) return undefined;
  const family = text(raw.family, 40);
  const element = text(raw.element, 40);
  return family || element ? { ...(family ? { family } : {}), ...(element ? { element } : {}) } : undefined;
}

/** 컬렉션. 잘못된 행·중복 id 는 버린다(먼저 온 것이 이긴다). */
export function normalizeSkillChoreographyRecords(values: readonly unknown[] | undefined): SkillChoreographyRecord[] | undefined {
  if (!Array.isArray(values)) return undefined;
  const seen = new Set<string>();
  return values.slice(0, SKILL_CHOREOGRAPHY_LIMIT).flatMap((raw): SkillChoreographyRecord[] => {
    const record = normalizeSkillChoreographyRecord(raw);
    if (!record || seen.has(record.id)) return [];
    seen.add(record.id);
    return [record];
  });
}
