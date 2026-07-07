import { validateArgs } from "@/editor/tools/jsonSchema";
import { allTools, getTool } from "@/editor/tools/toolRegistry";
import { ToolError, type ChangeSummary, type JsonSchema, type ToolMode, type ToolResult } from "@/editor/tools/types";
import { deserialize } from "@/project/io";
import { readStoredZipEntry } from "@/project/packageZip";
import { projectLint, type LintIssue } from "@/project/lint/projectLint";
import type { GameEvent, GameMap, Project } from "@/project/types";

const decoder = new TextDecoder();

export interface HeadlessToolInfo {
  readonly name: string;
  readonly description: string;
  readonly mode: ToolMode;
  readonly parameters: JsonSchema;
}

export interface HeadlessMcpToolInfo {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: JsonSchema;
}

export function loadHeadlessProject(json: string): Project {
  return deserialize(json);
}

export function loadHeadlessProjectFromPackage(bytes: Uint8Array): Project {
  const entry = readStoredZipEntry(bytes, "project.json");
  if (!entry) throw new Error(".rpgzzu package does not contain project.json");
  return loadHeadlessProject(decoder.decode(entry));
}

export function listHeadlessTools(): readonly HeadlessToolInfo[] {
  return allTools().map((tool) => ({
    name: tool.name,
    description: tool.description,
    mode: tool.mode,
    parameters: tool.parameters,
  }));
}

export function listHeadlessMcpTools(): readonly HeadlessMcpToolInfo[] {
  return allTools().map((tool) => ({
    name: tool.name,
    description: tool.mode === "write" ? `${tool.description} [dry-run only]` : tool.description,
    inputSchema: tool.parameters,
  }));
}

export function runHeadlessTool(project: Project, name: string, args: Record<string, unknown>): ToolResult {
  const tool = getTool(name);
  if (!tool) {
    return {
      ok: false,
      summary: `알 수 없는 툴: ${name}`,
      issues: [{ severity: "error", code: "unknown-tool", message: `등록되지 않은 툴: ${name}` }],
    };
  }

  const argErrors = validateArgs(tool.parameters, args);
  if (argErrors.length > 0) {
    return {
      ok: false,
      summary: `'${name}' 인자 검증 실패`,
      issues: argErrors.map((message) => ({ severity: "error", code: "invalid-args", message })),
    };
  }

  if (tool.mode === "read") {
    try {
      const exec = tool.run(project, args);
      return { ok: true, summary: exec.summary, data: exec.data };
    } catch (cause) {
      return { ok: false, summary: failureSummary(name, cause), issues: [issueFromError(cause)] };
    }
  }

  const draft = cloneProject(project);
  try {
    const exec = tool.run(draft, args);
    const diff = summarizeHeadlessChanges(project, draft);
    if (exec.warnings) diff.warnings.push(...exec.warnings);
    const issues = projectLint(draft);
    return {
      ok: true,
      summary: exec.summary,
      diff,
      issues: issues.length > 0 ? issues : undefined,
    };
  } catch (cause) {
    return { ok: false, summary: failureSummary(name, cause), issues: [issueFromError(cause)] };
  }
}

function cloneProject(project: Project): Project {
  return structuredClone(project);
}

function issueFromError(cause: unknown): LintIssue {
  if (cause instanceof ToolError) {
    return { severity: "error", code: cause.code, mapId: cause.mapId, x: cause.x, y: cause.y, message: cause.message };
  }
  return { severity: "error", code: "tool-exception", message: cause instanceof Error ? cause.message : String(cause) };
}

function failureSummary(name: string, cause: unknown): string {
  const issue = issueFromError(cause);
  const message = issue.message.length > 200 ? `${issue.message.slice(0, 200)}...` : issue.message;
  return `'${name}' 실행 실패: ${message}`;
}

function emptySummary(): ChangeSummary {
  return {
    tilesChanged: 0,
    eventsAdded: 0,
    eventsModified: 0,
    eventsRemoved: 0,
    mapsAdded: 0,
    mapsRemoved: 0,
    dbRecordsChanged: 0,
    tilesetsChanged: 0,
    switchesAdded: 0,
    variablesAdded: 0,
    worldEntitiesAdded: 0,
    worldEntitiesModified: 0,
    sessionChanged: false,
    systemChanged: false,
    warnings: [],
  };
}

function summarizeHeadlessChanges(before: Project, after: Project): ChangeSummary {
  const summary = emptySummary();
  const beforeMapIds = new Set(Object.keys(before.maps));
  const afterMapIds = new Set(Object.keys(after.maps));
  for (const id of afterMapIds) {
    if (!beforeMapIds.has(id)) summary.mapsAdded += 1;
  }
  for (const id of beforeMapIds) {
    if (!afterMapIds.has(id)) summary.mapsRemoved += 1;
  }
  for (const [id, afterMap] of Object.entries(after.maps)) {
    const beforeMap = before.maps[id];
    if (beforeMap) summary.tilesChanged += countTileChanges(beforeMap, afterMap);
    diffMapEvents(beforeMap, afterMap, summary);
  }
  diffDatabase(before, after, summary);
  for (const [id, afterTileset] of Object.entries(after.tilesets)) {
    if (JSON.stringify(before.tilesets[id]) !== JSON.stringify(afterTileset)) summary.tilesetsChanged += 1;
  }
  summary.switchesAdded = countNamedDefChanges(before.switches, after.switches);
  summary.variablesAdded = countNamedDefChanges(before.variables, after.variables);
  diffWorld(before, after, summary);
  summary.sessionChanged = JSON.stringify(before.session) !== JSON.stringify(after.session);
  summary.systemChanged = JSON.stringify(before.system) !== JSON.stringify(after.system);
  return summary;
}

function countTileChanges(before: GameMap, after: GameMap): number {
  let changed = 0;
  const size = Math.max(before.lowerTiles.length, after.lowerTiles.length);
  for (let i = 0; i < size; i += 1) {
    if (before.lowerTiles[i] !== after.lowerTiles[i]) changed += 1;
    else if (before.upperTiles[i] !== after.upperTiles[i]) changed += 1;
  }
  return changed;
}

function indexEvents(events: readonly GameEvent[]): Map<string, GameEvent> {
  const map = new Map<string, GameEvent>();
  for (const event of events) map.set(event.id, event);
  return map;
}

function diffMapEvents(before: GameMap | undefined, after: GameMap, summary: ChangeSummary): void {
  const beforeEvents = indexEvents(before?.events ?? []);
  const afterEvents = indexEvents(after.events);
  for (const [id, event] of afterEvents) {
    const prev = beforeEvents.get(id);
    if (!prev) summary.eventsAdded += 1;
    else if (JSON.stringify(prev) !== JSON.stringify(event)) summary.eventsModified += 1;
  }
  for (const id of beforeEvents.keys()) {
    if (!afterEvents.has(id)) summary.eventsRemoved += 1;
  }
}

function diffDatabase(before: Project, after: Project, summary: ChangeSummary): void {
  const keys: Array<keyof Project["database"]> = [
    "actors",
    "classes",
    "skills",
    "items",
    "equipment",
    "enemies",
    "troops",
    "states",
    "battleAnimations",
  ];
  for (const key of keys) {
    const beforeList = (before.database[key] ?? []) as Array<{ id: string }>;
    const afterList = (after.database[key] ?? []) as Array<{ id: string }>;
    const beforeById = new Map(beforeList.map((record) => [record.id, JSON.stringify(record)]));
    const afterById = new Map(afterList.map((record) => [record.id, JSON.stringify(record)]));
    for (const [id, json] of afterById) {
      const prev = beforeById.get(id);
      if (prev === undefined || prev !== json) summary.dbRecordsChanged += 1;
    }
    for (const id of beforeById.keys()) {
      if (!afterById.has(id)) summary.dbRecordsChanged += 1;
    }
  }
}

function countNamedDefChanges(
  before: readonly { id: string; name: string }[],
  after: readonly { id: string; name: string }[]
): number {
  const beforeByName = new Map(before.map((entry) => [entry.id, entry.name]));
  let changed = 0;
  for (const entry of after) {
    const prev = beforeByName.get(entry.id);
    if (prev === undefined && entry.name !== "") changed += 1;
    else if (prev !== undefined && prev === "" && entry.name !== "") changed += 1;
  }
  return changed;
}

function diffWorld(before: Project, after: Project, summary: ChangeSummary): void {
  const beforeEntities = before.world?.entities ?? [];
  const afterEntities = after.world?.entities ?? [];
  const beforeById = new Map(beforeEntities.map((entity) => [entity.id, JSON.stringify(entity)]));
  for (const entity of afterEntities) {
    const prev = beforeById.get(entity.id);
    if (prev === undefined) summary.worldEntitiesAdded += 1;
    else if (prev !== JSON.stringify(entity)) summary.worldEntitiesModified += 1;
  }
}
