import { ProjectFormatError } from "../io/errors";
import {
  compactWorldCanon,
  isWorldCanonStatus,
  isWorldCanonTone,
  resolveWorldCanon,
  uniqueAbsences,
  uniqueTones,
  type WorldCanon,
  type WorldCanonLaw,
  type WorldCanonLaws,
  type WorldCanonTone,
} from "./canon";

type JsonRecord = Record<string, unknown>;

export function normalizeWorldCanon(value: unknown, label = "worldCanon"): WorldCanon | undefined {
  if (value === undefined) return undefined;
  const record = requireRecord(label, value);
  const tones = record.tones === undefined
    ? undefined
    : uniqueTones(requireArray(`${label}.tones`, record.tones).map((entry, index) => {
      const tone = requireString(`${label}.tones[${index}]`, entry);
      return isWorldCanonTone(tone) ? tone : undefined;
    }).filter((tone): tone is WorldCanonTone => tone !== undefined));
  const absences = record.absences === undefined
    ? undefined
    : uniqueAbsences(requireArray(`${label}.absences`, record.absences).map((entry, index) =>
      requireString(`${label}.absences[${index}]`, entry),
    ));
  const statusRaw = record.status === undefined ? undefined : requireString(`${label}.status`, record.status);
  const visibility = record.visibility === undefined ? undefined : requireString(`${label}.visibility`, record.visibility);
  const resolved = resolveWorldCanon({
    ...(record.name === undefined ? {} : { name: requireString(`${label}.name`, record.name) }),
    ...(record.premise === undefined ? {} : { premise: requireString(`${label}.premise`, record.premise) }),
    ...(tones === undefined ? {} : { tones }),
    ...(record.era === undefined ? {} : { era: requireString(`${label}.era`, record.era) }),
    ...(record.techCeiling === undefined ? {} : { techCeiling: requireString(`${label}.techCeiling`, record.techCeiling) }),
    ...(absences === undefined ? {} : { absences }),
    ...(record.laws === undefined ? {} : { laws: normalizeLaws(`${label}.laws`, record.laws) }),
    ...(record.body === undefined ? {} : { body: requireString(`${label}.body`, record.body) }),
    ...(statusRaw !== undefined && isWorldCanonStatus(statusRaw) ? { status: statusRaw } : {}),
    ...(visibility === "public" || visibility === "secret" ? { visibility } : {}),
  });
  return compactWorldCanon(resolved);
}

function normalizeLaws(label: string, value: unknown): WorldCanonLaws {
  const record = requireRecord(label, value);
  return {
    ...(record.power === undefined ? {} : { power: normalizeLaw(`${label}.power`, record.power) }),
    ...(record.gods === undefined ? {} : { gods: normalizeLaw(`${label}.gods`, record.gods) }),
    ...(record.death === undefined ? {} : { death: normalizeLaw(`${label}.death`, record.death) }),
    ...(record.money === undefined ? {} : { money: normalizeLaw(`${label}.money`, record.money) }),
  };
}

function normalizeLaw(label: string, value: unknown): WorldCanonLaw {
  const record = requireRecord(label, value);
  return {
    ...(record.present === undefined ? {} : { present: requireBoolean(`${label}.present`, record.present) }),
    ...(record.note === undefined ? {} : { note: requireString(`${label}.note`, record.note) }),
  };
}

function requireRecord(label: string, value: unknown): JsonRecord {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) return value as JsonRecord;
  throw new ProjectFormatError(`${label}가 객체가 아닙니다.`);
}

function requireArray(label: string, value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  throw new ProjectFormatError(`${label}가 배열이 아닙니다.`);
}

function requireString(label: string, value: unknown): string {
  if (typeof value === "string") return value;
  throw new ProjectFormatError(`${label}가 문자열이 아닙니다.`);
}

function requireBoolean(label: string, value: unknown): boolean {
  if (typeof value === "boolean") return value;
  throw new ProjectFormatError(`${label}가 boolean이 아닙니다.`);
}
