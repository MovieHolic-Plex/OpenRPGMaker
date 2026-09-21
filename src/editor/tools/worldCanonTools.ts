import { compactWorldCanon, resolveWorldCanon, type WorldCanon, type WorldCanonLawKind, type WorldCanonStatus, type WorldCanonTone } from "@/project/world/canon";
import { ToolError, type JsonSchema, type ToolDefinition } from "./types";

const TONES: readonly WorldCanonTone[] = ["hopeful", "grim", "comic", "political", "slice", "gothic", "fairytale", "mythic"];
const LAWS: readonly WorldCanonLawKind[] = ["power", "gods", "death", "money"];

const LAW_SCHEMA: JsonSchema = {
  type: "object",
  properties: {
    present: { type: "boolean" },
    note: { type: "string", maxLength: 160 },
  },
  additionalProperties: false,
};

const WORLD_CANON_SCHEMA: JsonSchema = {
  type: "object",
  properties: {
    name: { type: "string", maxLength: 120 },
    premise: { type: "string", maxLength: 280 },
    tones: { type: "array", items: { type: "string", enum: TONES } },
    era: { type: "string", maxLength: 80 },
    techCeiling: { type: "string", maxLength: 80 },
    absences: { type: "array", items: { type: "string", maxLength: 40 } },
    laws: {
      type: "object",
      properties: Object.fromEntries(LAWS.map((key) => [key, LAW_SCHEMA])),
      additionalProperties: false,
    },
    body: { type: "string", maxLength: 50_000 },
    status: { type: "string", enum: ["draft", "canon", "secret"] },
    visibility: { type: "string", enum: ["public", "secret"] },
  },
  additionalProperties: false,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function optionalText(value: unknown, label: string, max: number): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || value.trim().length === 0) throw new ToolError(`${label}는 비어 있지 않은 문자열이어야 합니다.`, { code: "invalid-args" });
  if (value.trim().length > max) throw new ToolError(`${label}는 ${max}자 이하여야 합니다.`, { code: "invalid-args" });
  return value.trim();
}

function mergeCanon(current: WorldCanon | undefined, raw: unknown): WorldCanon {
  if (!isRecord(raw)) throw new ToolError("canon 객체가 필요합니다.", { code: "invalid-args" });
  const resolved = resolveWorldCanon(current);
  const next: WorldCanon = {
    name: optionalText(raw.name, "canon.name", 120) ?? resolved.name,
    premise: optionalText(raw.premise, "canon.premise", 280) ?? resolved.premise,
    tones: raw.tones === undefined ? resolved.tones : (Array.isArray(raw.tones) && raw.tones.every((tone): tone is WorldCanonTone => typeof tone === "string" && TONES.includes(tone as WorldCanonTone)) ? raw.tones : (() => { throw new ToolError("canon.tones가 올바르지 않습니다.", { code: "invalid-args" }); })()),
    era: optionalText(raw.era, "canon.era", 80) ?? resolved.era,
    techCeiling: optionalText(raw.techCeiling, "canon.techCeiling", 80) ?? resolved.techCeiling,
    absences: raw.absences === undefined ? resolved.absences : (Array.isArray(raw.absences) && raw.absences.every((item) => typeof item === "string") ? raw.absences.map((item) => item.trim()).filter(Boolean).slice(0, 32) : (() => { throw new ToolError("canon.absences는 문자열 배열이어야 합니다.", { code: "invalid-args" }); })()),
    laws: raw.laws === undefined ? resolved.laws : isRecord(raw.laws) ? Object.fromEntries(LAWS.flatMap((key) => {
      const value = (raw.laws as Record<string, unknown>)[key];
      if (value === undefined) return [[key, resolved.laws[key]]];
      if (!isRecord(value) || (value.present !== undefined && typeof value.present !== "boolean") || (value.note !== undefined && typeof value.note !== "string")) throw new ToolError(`canon.laws.${key}가 올바르지 않습니다.`, { code: "invalid-args" });
      return [[key, { present: value.present, note: typeof value.note === "string" ? value.note.trim().slice(0, 160) : "" }]];
    })) as WorldCanon["laws"] : (() => { throw new ToolError("canon.laws는 객체여야 합니다.", { code: "invalid-args" }); })(),
    body: optionalText(raw.body, "canon.body", 50_000) ?? resolved.body,
    status: raw.status === undefined ? resolved.status : (raw.status === "draft" || raw.status === "canon" || raw.status === "secret" ? raw.status as WorldCanonStatus : (() => { throw new ToolError("canon.status가 올바르지 않습니다.", { code: "invalid-args" }); })()),
    visibility: raw.visibility === undefined ? resolved.visibility : (raw.visibility === "public" || raw.visibility === "secret" ? raw.visibility : (() => { throw new ToolError("canon.visibility가 올바르지 않습니다.", { code: "invalid-args" }); })()),
  };
  return compactWorldCanon(resolveWorldCanon(next)) ?? {};
}

/** Stores the concise world backbone that every later map, NPC and event turn reads. */
export const SET_WORLD_CANON_TOOL: ToolDefinition = {
  name: "set_world_canon",
  description: "세계관 정본을 등록/수정한다. 이름·전제·시대·기술 상한·톤·금지 요소·세계 법칙을 저장하며 기존 값은 전달한 필드만 병합한다. 중세 RPG처럼 장르만 주어져도 맵을 만들기 전에 세계관의 최소 뼈대를 먼저 기록한다.",
  mode: "write",
  domains: ["world", "database"],
  parameters: {
    type: "object",
    properties: { canon: WORLD_CANON_SCHEMA },
    required: ["canon"],
    additionalProperties: false,
  },
  run(draft, args) {
    draft.worldCanon = mergeCanon(draft.worldCanon, args.canon);
    return { summary: `세계관 정본 저장 — ${draft.worldCanon?.name || "이름 없는 세계"}`, data: { worldCanon: draft.worldCanon } };
  },
};

export const WORLD_CANON_TOOLS: readonly ToolDefinition[] = [SET_WORLD_CANON_TOOL];
