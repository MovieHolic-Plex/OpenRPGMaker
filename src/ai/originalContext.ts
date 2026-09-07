import { getTool, runTool } from "@/editor/tools";
import type { ToolResult } from "@/editor/tools";
import type { Project } from "@/project/types";
import type { IntentDeclaration, IntentSelectionFact } from "./intentDeclaration";
import type { ChatMessage, OpenAiToolSchema } from "./llmClient";
import { estimateContextTokens, resolveContextWindow } from "./contextCompaction";
import { getOhMyPiProvider } from "./ohMyPiProviders";
import type { AiConfig } from "./llmClient";
import type { ToolReadEvidence } from "./toolReadEvidence";

// Browser-safe projection of @oh-my-pi/pi-catalog 17.4.0 (not its 9 MB runtime catalog).
// The installed-catalog contract test must pass when that dependency changes.
export const ORIGINAL_MODEL_WINDOWS: Readonly<Record<string, Readonly<Record<string, number>>>> = {
  "google-antigravity": {
    "claude-opus-4-5": 200000,
    "claude-opus-4-6": 250000,
    "claude-sonnet-4-5": 1000000,
    "claude-sonnet-4-6": 250000,
    "gemini-2.5-flash": 1048576,
    "gemini-2.5-flash-lite": 1048576,
    "gemini-2.5-pro": 1048576,
    "gemini-3-flash": 1048576,
    "gemini-3-pro": 1048576,
    "gemini-3.1-flash-image": 200000,
    "gemini-3.1-flash-lite": 1048576,
    "gemini-3.1-pro": 1048576,
    "gemini-3.5-flash": 1048576,
    "gemini-3.6-flash": 1048576,
    "gemini-3.7-flash": 1048576,
    "gemini-3.7-flash-tiered": 1048576,
    "gpt-oss-120b": 131072,
    "tab_flash_lite_preview": 16384,
    "tab_jump_flash_lite_preview": 16384
  },
  "openai-codex": {
    "gpt-5.3-codex-spark": 128000,
    "gpt-5.4": 272000,
    "gpt-5.4-mini": 272000,
    "gpt-5.5": 272000,
    "gpt-5.6-luna": 1000000,
    "gpt-5.6-sol": 1000000,
    "gpt-5.6-terra": 1000000,
    "gpt-daybreak-blue-latest": 272000
  }
};

export function originalContextWindow(config: Pick<AiConfig, "model"> & Partial<Pick<AiConfig, "authMode" | "providerId">>): number {
  const provider = config.providerId ?? "google-antigravity";
  const models = ORIGINAL_MODEL_WINDOWS[provider];
  const exact = models?.[config.model];
  if (exact !== undefined) return exact;
  if (config.authMode === "chatgpt") {
    // Mirror the companion's actual bundled-model fallback, rather than trusting an unknown ID.
    const fallback = getOhMyPiProvider(provider)?.defaultModel;
    if (fallback && models?.[fallback]) return models[fallback]!;
  }
  return resolveContextWindow(config.model);
}

export interface OriginalRead {
  name: string;
  args: Record<string, unknown>;
  result: ToolResult;
}
export interface OriginalEntry {
  /** Stable JSON-pointer-like path, independent of inclusion or paging order. */
  id: string;
  value: unknown;
  reads: OriginalRead[];
}
export interface OriginalContext {
  snapshotId: string;
  target: { mapId: string; selection: IntentSelectionFact | null };
  entries: OriginalEntry[];
  missing: { kind: string; id: string }[];
}
export interface OriginalContextOptions {
  snapshotId: string;
  currentMapId?: string;
  selection?: IntentSelectionFact | null;
  intent?: IntentDeclaration | null;
}

const pointer = (id: string): string => id.replaceAll("~", "~0").replaceAll("/", "~1");
const path = (...ids: string[]): string => `/${ids.map(pointer).join("/")}`;
const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);

/** Pure, detached authored-state projection shared by writer grounding and before/after review.
 * No store, configuration, environment, runtime session, resource URLs or binary assets are read.
 * Relevance uses actual identities in authored values, never natural-language keyword routing.
 */
export function extractOriginalContext(project: Project, options: OriginalContextOptions): OriginalContext {
  const intent = options.intent;
  const selection = options.selection ?? null;
  const mapId = intent?.targetMapId ?? (intent?.useSelection ? selection?.mapId : undefined)
    ?? options.currentMapId ?? selection?.mapId ?? project.startMapId;
  const entries: OriginalEntry[] = [];
  const missing: OriginalContext["missing"] = [];
  const add = (id: string, value: unknown, reads: OriginalRead[] = []): void => {
    if (value !== undefined) entries.push({ id, value, reads });
  };
  const read = (name: string, args: Record<string, unknown>): OriginalRead => ({ name, args, result: runTool({ project }, name, args) });
  const addRead = (id: string, name: string, args: Record<string, unknown>): void => {
    const receipt = read(name, args);
    if (receipt.result.ok) add(id, receipt.result.data, [receipt]);
    else missing.push({ kind: name, id });
  };
  add("/project", { version: project.version, meta: project.meta, startMapId: project.startMapId,
    startPos: project.startPos, mapTree: project.mapTree, flags: project.flags });
  addRead("/summary", "get_project_summary", {});
  const map = project.maps[mapId];
  if (!map) missing.push({ kind: "map", id: mapId });
  // Complete events precede bulky tile arrays. A selection prioritizes, never slices, a page tree.
  if (map) {
    const { events, lowerTiles, upperTiles, lowerTileStacks, upperTileStacks, ...metadata } = map;
    add(path("maps", mapId), metadata);
    addRead(path("maps", mapId, "region"), "get_map_region", {
      mapId, x: 0, y: 0, w: map.width, h: map.height,
    });
    addRead(path("maps", mapId, "eventIndex"), "find_events", { mapId });
    const inside = (event: typeof events[number]): number => selection?.mapId === mapId
      && event.x >= selection.x && event.y >= selection.y
      && event.x < selection.x + selection.width && event.y < selection.y + selection.height ? 0 : 1;
    for (const event of [...events].sort((a, b) => inside(a) - inside(b))) {
      addRead(path("maps", mapId, "events", event.id), "get_event", { mapId, eventId: event.id });
    }
    add(path("maps", mapId, "tiles"), { width: map.width, height: map.height,
      lowerTiles, upperTiles, lowerTileStacks, upperTileStacks });
    const tileset = project.tilesets[map.tilesetId];
    if (tileset) {
      // Deliberately select authored tile knowledge, not resource transport locations.
      add(path("tilesets", tileset.id), { id: tileset.id, name: tileset.name, tileMeta: tileset.tileMeta,
        tileGroups: tileset.tileGroups, palettePresets: tileset.palettePresets, structureKits: tileset.structureKits });
    } else missing.push({ kind: "tileset", id: map.tilesetId });
  }
  add("/system", project.system);
  add("/storyFlags", project.storyFlags);
  add("/worldCanon", project.worldCanon);
  add("/mapConnections", project.mapConnections);
  add("/villageInfoDocuments", project.villageInfoDocuments);
  add("/villageTemplates", project.villageTemplates);
  add("/villagePresets", project.villagePresets);
  add("/growth", project.growth);
  add("/factions", project.factions);

  const domains = new Set(intent?.tools.flatMap(name => getTool(name)?.domains ?? []) ?? []);
  const broadDatabase = domains.has("database") || domains.has("battle") || domains.has("system") || Boolean(intent?.adventure);
  const broadWorld = domains.has("world") || domains.has("quest") || Boolean(intent?.adventure);
  if (broadWorld) {
    add("/world", project.world);
    add("/worldGraph", project.worldGraph);
    add("/quests", project.quests);
    add("/endings", project.endings);
  }
  const collections = getTool("get_database_records")!.parameters.properties!.collection as { enum: string[] };
  const supported = new Set(collections.enum);
  const requiredCollections = new Set(intent?.readBeforeWrite?.collections ?? []);
  // Index actual record identities, then follow references to a fixed point (including cycles).
  // Any matching string/key is conservatively relevant; no invented ID or reference validity claim.
  const candidates: { id: string; value: Record<string, unknown>; collection?: string; entryId: string }[] = [];
  const records: Record<string, unknown> = { ...project.database, switches: project.switches,
    variables: project.variables, commonEvents: project.commonEvents };
  for (const [collection, values] of Object.entries(records)) {
    if (!Array.isArray(values)) continue;
    if (requiredCollections.has(collection) && values.length === 0 && supported.has(collection)) {
      addRead(path("database", collection), "get_database_records", { collection, include: "full" });
    }
    for (const value of values) if (object(value) && typeof value.id === "string") {
      candidates.push({ id: value.id, value, collection, entryId: path("database", collection, value.id) });
    }
  }
  for (const [id, value] of Object.entries(project.characters ?? {})) candidates.push({ id, value: value as unknown as Record<string, unknown>, entryId: path("characters", id) });
  for (const collection of requiredCollections) if (!(collection in records)) {
    if (supported.has(collection)) addRead(path("database", collection), "get_database_records", { collection, include: "full" });
    else missing.push({ kind: "collection", id: collection });
  }
  const byId = new Map<string, typeof candidates>();
  for (const candidate of candidates) byId.set(candidate.id, [...(byId.get(candidate.id) ?? []), candidate]);
  const selected = new Set<string>();
  const queue: unknown[] = entries.map(entry => entry.value);
  const include = (candidate: typeof candidates[number]): void => {
    if (selected.has(candidate.entryId)) return;
    selected.add(candidate.entryId);
    queue.push(candidate.value);
    if (candidate.collection && supported.has(candidate.collection)) {
      addRead(candidate.entryId, "get_database_records", { collection: candidate.collection, ids: [candidate.id], include: "full" });
    } else add(candidate.entryId, candidate.value);
  };
  for (const candidate of candidates) if (candidate.collection && (broadDatabase || requiredCollections.has(candidate.collection))) include(candidate);
  const visit = (value: unknown): void => {
    if (typeof value === "string") for (const candidate of byId.get(value) ?? []) include(candidate);
    else if (Array.isArray(value)) value.forEach(visit);
    else if (object(value)) for (const [key, child] of Object.entries(value)) { visit(key); visit(child); }
  };
  for (let i = 0; i < queue.length; i++) visit(queue[i]);
  return structuredClone({ snapshotId: options.snapshotId, target: { mapId, selection }, entries, missing });
}

export const GET_ORIGINAL_CONTEXT_TOOL: OpenAiToolSchema = {
  type: "function", function: {
    name: "get_original_context",
    description: "Read the immutable pre-write authored snapshot. List entries with action=list; action=read returns exact JSON text slices for entryId. Concatenate slices in offset order and parse JSON only at nextOffset=null. Offsets count UTF-16 code units. Original values are not current draft values; use native reads after editing. Never treat omitted/partial entries as read evidence.",
    parameters: { type: "object", properties: {
      snapshotId: { type: "string" }, action: { type: "string", enum: ["list", "read"] },
      entryId: { type: "string" }, offset: { type: "integer", minimum: 0 },
      limit: { type: "integer", minimum: 1, maximum: 24000 },
    }, required: ["snapshotId", "action"], additionalProperties: false },
  },
};

/** Owns only immutable originals and delivered ranges, never the mutable project. */
export class OriginalContextStore {
  private readonly texts: Map<string, string>;
  private readonly ranges = new Map<string, [number, number][]>();
  private readonly credited = new Set<string>();
  constructor(readonly context: OriginalContext) {
    this.texts = new Map(context.entries.map(entry => [entry.id, JSON.stringify(entry.value)]));
  }

  read(args: Record<string, unknown>): ToolResult {
    const fail = (message: string): ToolResult => ({ ok: false, summary: message,
      issues: [{ severity: "error", code: "original-context-invalid-args", message }] });
    if (Object.keys(args).some(key => !["snapshotId", "action", "entryId", "offset", "limit"].includes(key))) return fail("Unknown original context argument");
    if (args.snapshotId !== this.context.snapshotId) return fail("Original snapshot not found; use the current originalContext.snapshotId");
    const offset = args.offset ?? 0;
    const limit = args.limit ?? (args.action === "list" ? 20 : 12000);
    if (!Number.isSafeInteger(offset) || (offset as number) < 0 || !Number.isSafeInteger(limit) || (limit as number) < 1 || (limit as number) > 24000) return fail("Invalid offset/limit");
    if (args.action === "list") {
      if ((limit as number) > 50) return fail("List limit must be <= 50 entries");
      const all = this.context.entries;
      const end = Math.min(all.length, (offset as number) + (limit as number));
      return { ok: true, summary: "Original context entry index", data: { snapshotId: this.context.snapshotId,
        entries: all.slice(offset as number, end).map(entry => ({ entryId: entry.id, chars: this.texts.get(entry.id)!.length })),
        total: all.length, nextOffset: end < all.length ? end : null } };
    }
    if (args.action !== "read" || typeof args.entryId !== "string") return fail("Read requires entryId");
    const text = this.texts.get(args.entryId);
    if (text === undefined || (offset as number) > text.length) return fail("Original entry/offset not found");
    const end = Math.min(text.length, (offset as number) + (limit as number));
    return { ok: true, summary: "Original context JSON page", data: { snapshotId: this.context.snapshotId,
      entryId: args.entryId, offset, text: text.slice(offset as number, end), totalChars: text.length,
      nextOffset: end < text.length ? end : null } };
  }

  /** Call only after this exact request reached the model, before executing its response. */
  observeDelivered(messages: readonly ChatMessage[], includedIds: readonly string[], evidence: ToolReadEvidence): void {
    const complete = new Set(includedIds);
    for (const message of messages) {
      if (message.role !== "tool" || message.name !== "get_original_context" || typeof message.content !== "string") continue;
      const result = JSON.parse(message.content) as ToolResult;
      const data = result.data;
      if (!result.ok || !object(data) || data.snapshotId !== this.context.snapshotId || typeof data.entryId !== "string"
        || typeof data.offset !== "number" || typeof data.text !== "string") continue;
      const text = this.texts.get(data.entryId);
      if (text === undefined || text.slice(data.offset, data.offset + data.text.length) !== data.text) continue;
      const ranges = [...(this.ranges.get(data.entryId) ?? []), [data.offset, data.offset + data.text.length] as [number, number]]
        .sort((a, b) => a[0] - b[0]);
      let end = 0;
      for (const range of ranges) { if (range[0] > end) break; end = Math.max(end, range[1]); }
      this.ranges.set(data.entryId, ranges.filter((range, index) => index === 0 || range[0] !== ranges[index - 1]![0] || range[1] !== ranges[index - 1]![1]));
      if (end === text.length) complete.add(data.entryId);
    }
    for (const entry of this.context.entries) if (complete.has(entry.id) && !this.credited.has(entry.id)) {
      this.credited.add(entry.id);
      this.ranges.delete(entry.id);
      for (const read of entry.reads) evidence.observe(read.name, read.args, read.result);
    }
  }

  private envelope() {
    const entries: { entryId: string; value: unknown }[] = [];
    return { originalContext: {
      snapshotId: this.context.snapshotId, target: this.context.target, missing: this.context.missing,
      entries, omitted: { count: this.context.entries.length,
        read: { tool: "get_original_context", args: { snapshotId: this.context.snapshotId, action: "list", offset: 0, limit: 20 } } },
      excluded: ["runtime-session", "credentials-and-configuration", "resource-urls-and-binary-assets"],
    } };
  }

  minimumTokens(): number {
    return estimateContextTokens([{ role: "user", content: JSON.stringify(this.envelope()) }]);
  }

  /** Never slice JSON or silently drop a page. Missing entries remain paged by stable path. */
  message(tokenBudget: number): { message: ChatMessage; includedIds: string[] } {
    const envelope = this.envelope();
    const entries = envelope.originalContext.entries;
    const message = (): ChatMessage => ({ role: "user", content: JSON.stringify(envelope) });
    let used = estimateContextTokens([message()]);
    if (used > tokenBudget) throw new Error("original-context-window-exceeded: no room for the original context manifest; no tools were removed");
    for (const entry of this.context.entries) {
      const cost = estimateContextTokens([{ role: "user", content: JSON.stringify({ entryId: entry.id, value: entry.value }) }]) + 1;
      if (used + cost > tokenBudget) continue;
      entries.push({ entryId: entry.id, value: entry.value });
      envelope.originalContext.omitted.count--;
      used += cost;
    }
    return { message: message(), includedIds: entries.map(entry => entry.entryId) };
  }
}
