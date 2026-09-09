import { requireRecord, requireString, requireNumber, requireBoolean, assert } from "@/project/io/guards";
import { parseReportAssets } from "./reportAssets.mjs";
import type { BlobRef } from "./contracts";
import { AUTONOMY_LEVEL_IDS } from "../autonomyLevels";
import type { AiConfig } from "../llmClient";
import type { ContextOptions } from "../contextBuilder";
import type { TurnSelectionSnapshot } from "../conversationTurnContext";
import type { SessionTurnOptions } from "../assistantSessionCore";
import type { ToolDomain } from "@/editor/tools/types";
import type { MapViewportSnapshot } from "../mapViewportContext";

export interface AssistantJobPayload {
  instruction: string;
  config: Omit<AiConfig, "apiKey" | "baseUrl">;
  context: Omit<ContextOptions, "getViewport" | "getCurrentMapId"> & { budgetChars: number; preferenceMemorySection: string };
  domain: ToolDomain;
  selection?: TurnSelectionSnapshot;
  turn?: SessionTurnOptions;
  priorTranscript?: string;
  continuation?: { sourceJobId: string; resultSha256: string };
  reportAssets?: Record<string, BlobRef>;
}
export function enumValue<const T extends string>(value: unknown, values: readonly T[]): T {
  for (const candidate of values) if (candidate === value) return candidate;
  throw new Error(`Invalid enum value: ${String(value)}`);
}
function optionalString(value: unknown): string | undefined { return value === undefined ? undefined : requireString("string", value); }
function positive(value: unknown): number { const n = requireNumber("positive integer", value); assert(Number.isSafeInteger(n) && n > 0, "Expected positive integer"); return n; }
function optionalNumber(value: unknown): number | undefined { return value === undefined ? undefined : requireNumber("number", value); }
function shape(value: unknown, keys: readonly string[]): Record<string, unknown> {
  const r = requireRecord("captured input", value);
  assert(Object.keys(r).every(key => keys.includes(key)), "Unexpected captured input field"); return r;
}
function rectangle(value: unknown) {
  const r = requireRecord("rectangle", value);
  return { x: requireNumber("x", r.x), y: requireNumber("y", r.y), width: positive(r.width), height: positive(r.height) };
}
function viewport(value: unknown): MapViewportSnapshot | null | undefined {
  if (value === undefined || value === null) return value;
  const r = shape(value, ["mapId", "x", "y", "w", "h", "centerX", "centerY", "viewX", "viewY", "viewW", "viewH"]);
  return { mapId: requireString("mapId", r.mapId), x: requireNumber("x", r.x), y: requireNumber("y", r.y), w: positive(r.w), h: positive(r.h),
    centerX: requireNumber("centerX", r.centerX), centerY: requireNumber("centerY", r.centerY),
    viewX: optionalNumber(r.viewX), viewY: optionalNumber(r.viewY), viewW: optionalNumber(r.viewW), viewH: optionalNumber(r.viewH) };
}
export function parseAssistantPayload(value: unknown): AssistantJobPayload {
  const p = shape(value, ["instruction", "config", "context", "domain", "selection", "turn", "priorTranscript", "reportAssets", "continuation"]);
  const c = shape(p.config, ["authMode", "providerId", "model", "liteModel", "maxToolCalls", "maxTokens", "reasoningEffort", "autonomyLevel", "agentMode"]);
  const context = shape(p.context, ["currentMapId", "budgetChars", "viewport", "projectScopeKey", "preferenceMemorySection"]);
  const instruction = requireString("instruction", p.instruction); assert(instruction.trim().length > 0, "Instruction required");
  const model = requireString("model", c.model); assert(model.trim().length > 0, "Model required");
  let selection: TurnSelectionSnapshot | undefined;
  if (p.selection !== undefined) { const r = shape(p.selection, ["mapId", "x", "y", "width", "height"]); selection = { mapId: requireString("mapId", r.mapId), ...rectangle(r) }; }
  let turn: SessionTurnOptions | undefined;
  if (p.turn !== undefined) {
    const t = shape(p.turn, ["autonomous", "instruction", "scope", "composerMode"]);
    const scope = t.scope == null ? t.scope : requireRecord("scope", t.scope);
    turn = { autonomous: t.autonomous === undefined ? undefined : requireBoolean("autonomous", t.autonomous), instruction: optionalString(t.instruction),
      composerMode: t.composerMode === undefined ? undefined : enumValue(t.composerMode, ["ask", "plan", "do"]),
      scope: scope == null ? scope : { mapId: requireString("mapId", scope.mapId), region: rectangle(scope.region) } };
  }
  let continuation: AssistantJobPayload["continuation"];
  if (p.continuation !== undefined) {
    const c = shape(p.continuation, ["sourceJobId", "resultSha256"]);
    const sourceJobId = requireString("sourceJobId", c.sourceJobId), resultSha256 = requireString("resultSha256", c.resultSha256);
    assert(sourceJobId.trim().length > 0 && /^[a-f0-9]{64}$/.test(resultSha256), "Invalid continuation binding");
    continuation = { sourceJobId, resultSha256 };
  }
  return {
    instruction, domain: enumValue(p.domain, ["core", "tile", "map", "event", "database", "world", "quest", "battle", "system"]),
    config: { authMode: enumValue(c.authMode, ["chatgpt"]), providerId: c.providerId === undefined ? undefined : enumValue(c.providerId, ["google-antigravity", "openai-codex"]),
      model, liteModel: optionalString(c.liteModel), maxToolCalls: positive(c.maxToolCalls), maxTokens: positive(c.maxTokens),
      reasoningEffort: c.reasoningEffort === undefined ? undefined : enumValue(c.reasoningEffort, ["off", "low", "medium", "high"]),
      autonomyLevel: c.autonomyLevel === undefined ? undefined : enumValue(c.autonomyLevel, AUTONOMY_LEVEL_IDS),
      agentMode: c.agentMode === undefined ? undefined : enumValue(c.agentMode, ["auto", "chat"]) },
    context: { currentMapId: optionalString(context.currentMapId), projectScopeKey: optionalString(context.projectScopeKey), viewport: viewport(context.viewport),
      budgetChars: positive(context.budgetChars), preferenceMemorySection: requireString("preferenceMemorySection", context.preferenceMemorySection) },
    selection, turn, priorTranscript: optionalString(p.priorTranscript),
    ...(continuation ? { continuation } : {}),
    ...(p.reportAssets === undefined ? {} : { reportAssets: parseReportAssets(p.reportAssets) }),
  };
}
