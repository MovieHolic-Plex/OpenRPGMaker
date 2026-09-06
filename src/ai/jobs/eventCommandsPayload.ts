import { assert, requireArray, requireNumber, requireRecord, requireString } from "@/project/io/guards";
import { validateCommandArray } from "@/project/io/shapeCommandFields";
import { resolveCommandListAtPath } from "@/editor/eventCommandPaths";
import { commandBranches } from "@/editor/tools/commandTraversal";
import type { Command, EventPage, Project } from "@/project/types";
import type { AiConfig } from "../llmClient";
import type { AssistScope, EventAssistContext } from "../eventCommandAssist";
import { enumValue } from "./assistantPayload";
import type { BlobRef } from "./contracts";

/** input.target. common-event still captures the map used for reference context. */
export type EventCommandsTarget =
  | { kind: "map-event-page"; mapId: string; eventId: string; pageId: string }
  | { kind: "common-event"; mapId: string; commonEventId: string };

/** input.payload. baseCommands includes unsaved command-editor draft edits. */
export interface EventCommandsJobPayload {
  prompt: string;
  config: Pick<AiConfig, "model" | "liteModel" | "maxTokens" | "maxToolCalls" | "reasoningEffort"> & {
    authMode: "chatgpt";
    providerId?: "google-antigravity" | "openai-codex";
  };
  baseCommands: Command[];
  selection: number[] | null;
  selectionLabel?: string;
  preferenceMemorySection: string;
  projectScopeKey?: string;
}

function shape(value: unknown, keys: readonly string[]): Record<string, unknown> {
  const r = requireRecord("event commands input", value);
  assert(Object.keys(r).every(key => keys.includes(key)), "Unexpected event commands field");
  return r;
}
function text(label: string, value: unknown): string {
  const result = requireString(label, value);
  assert(result.trim().length > 0, `${label} required`);
  return result;
}
function positive(label: string, value: unknown): number {
  const n = requireNumber(label, value);
  assert(Number.isSafeInteger(n) && n > 0, `${label} must be a positive integer`);
  return n;
}
function optionalString(value: unknown): string | undefined {
  return value === undefined ? undefined : requireString("string", value);
}
export function parseEventCommandsTarget(value: unknown): EventCommandsTarget {
  const r = requireRecord("event commands target", value);
  if (r.kind === "map-event-page") {
    shape(r, ["kind", "mapId", "eventId", "pageId"]);
    return { kind: r.kind, mapId: text("mapId", r.mapId), eventId: text("eventId", r.eventId), pageId: text("pageId", r.pageId) };
  }
  assert(r.kind === "common-event", "Invalid event commands target kind");
  shape(r, ["kind", "mapId", "commonEventId"]);
  return { kind: r.kind, mapId: text("mapId", r.mapId), commonEventId: text("commonEventId", r.commonEventId) };
}
export function parseEventCommands(value: unknown): Command[] {
  validateCommandArray("captured commands", value);
  const commands = structuredClone(value as Command[]);
  // The shared shape validator leaves text fields to consumers. Validate them at
  // this untrusted capture boundary rather than letting numeric bodies enter a draft.
  const checkText = (commands: readonly Command[]): void => {
    for (const command of commands) {
      if (command.kind === "text") {
        requireString("text.body", command.body);
        if (command.speaker !== undefined) requireString("text.speaker", command.speaker);
      }
      for (const branch of commandBranches(command)) checkText(branch.commands);
    }
  };
  checkText(commands);
  return commands;
}
export function parseEventCommandsPayload(value: unknown): EventCommandsJobPayload {
  const p = shape(value, ["prompt", "config", "baseCommands", "selection", "selectionLabel", "preferenceMemorySection", "projectScopeKey"]);
  const c = shape(p.config, ["authMode", "providerId", "model", "liteModel", "maxTokens", "maxToolCalls", "reasoningEffort"]);
  const selection = p.selection === null ? null : requireArray("selection", p.selection).map((value, index) => {
    const n = requireNumber("selection index", value);
    assert(Number.isSafeInteger(n) && (index % 2 !== 0 || n >= 0), "Invalid command selection index");
    return n;
  });
  assert(selection === null || selection.length === 0 || selection.length % 2 === 1, "Invalid command selection path");
  return {
    prompt: text("prompt", p.prompt),
    config: {
      authMode: enumValue(c.authMode, ["chatgpt"]),
      providerId: c.providerId === undefined ? undefined : enumValue(c.providerId, ["google-antigravity", "openai-codex"]),
      model: text("model", c.model), liteModel: optionalString(c.liteModel),
      maxTokens: positive("maxTokens", c.maxTokens), maxToolCalls: positive("maxToolCalls", c.maxToolCalls),
      reasoningEffort: c.reasoningEffort === undefined ? undefined : enumValue(c.reasoningEffort, ["off", "low", "medium", "high"]),
    },
    baseCommands: parseEventCommands(p.baseCommands), selection,
    selectionLabel: optionalString(p.selectionLabel), preferenceMemorySection: requireString("preferenceMemorySection", p.preferenceMemorySection),
    projectScopeKey: optionalString(p.projectScopeKey),
  };
}
export function eventCommandsContext(project: Project, target: EventCommandsTarget, payload: EventCommandsJobPayload): EventAssistContext {
  assert(Boolean(project.maps[target.mapId]), "Event commands context map not found");
  let page: EventPage;
  let event: EventAssistContext["event"];
  if (target.kind === "map-event-page") {
    event = project.maps[target.mapId].events.find(event => event.id === target.eventId);
    assert(event !== undefined, "Event commands target event not found");
    const source = event.pages?.find(page => page.id === target.pageId);
    assert(source !== undefined, "Event commands target page not found");
    page = { ...source, commands: payload.baseCommands };
  } else {
    const common = project.commonEvents.find(event => event.id === target.commonEventId);
    assert(common !== undefined, "Event commands common event not found");
    // The assist only reads page name/id/commands, not map-page execution settings.
    page = { id: common.id, name: common.name, commands: payload.baseCommands,
      conditions: [], graphic: {}, trigger: { kind: "action" }, priority: "same",
      movement: { type: "fixed", speed: 3, frequency: 3 } };
  }
  return { project, mapId: target.mapId, event, page, selection: payload.selection, selectionLabel: payload.selectionLabel };
}

/** Same insertion contract as foreground withAppended, including nested selection and missing-branch fallback. */
export function eventCommandsFinalList(payload: EventCommandsJobPayload, commands: readonly Command[], scope: AssistScope): Command[] {
  const fresh = commands.map(command => structuredClone(command));
  if (scope === "page") return fresh;
  const next = structuredClone(payload.baseCommands);
  const selection = payload.selection;
  if (!selection?.length) return [...next, ...fresh];
  const list = resolveCommandListAtPath(next, selection);
  if (!list) return [...next, ...fresh];
  list.splice(selection[selection.length - 1] + 1, 0, ...fresh);
  return next;
}

export function parseEventCommandsRef(value: unknown): BlobRef {
  const r = requireRecord("event commands blob reference", value);
  const sha256 = requireString("sha256", r.sha256);
  const byteLength = requireNumber("byteLength", r.byteLength);
  assert(/^[a-f0-9]{64}$/.test(sha256) && Number.isSafeInteger(byteLength) && byteLength >= 0, "Invalid event commands blob reference");
  assert(r.mediaType === "application/json", "Event commands artifacts must be JSON");
  return { sha256, byteLength, mediaType: "application/json" };
}
