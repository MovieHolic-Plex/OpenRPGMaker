// 에이전트 모드(실험) — 외부 코딩 에이전트가 MCP 로 부른 도구를 「열린 편집기」의 스토어에서 실행한다.
// 조수와 같은 실행기(prepareTool + runTool)를 쓰고, 성공한 쓰기는 바로 스토어에 얹는다 — 캔버스가 즉시 다시 그리고
// 저장은 편집기 평소 경로(자동 저장 → 브리지)로 간다. 한 턴의 첫 쓰기만 되돌리기 기록을 만들어 「한 턴 = 되돌리기 한 번」.
import { focusAcceptedAgentChanges, summarizeAcceptedAgentChanges } from "@/editor/agentFocus";
import { editorState } from "@/editor/editorState";
import { applyProjectInAgentTurn } from "@/editor/mapEditHistory";
import { prepareTool } from "@/editor/tools/asyncToolRunner";
import { activeTools, getTool } from "@/editor/tools/toolRegistry";
import { runTool } from "@/editor/tools/toolRunner";
import type { ToolDefinition } from "@/editor/tools/types";
import { store } from "@/project/store";

/**
 * 처음부터 보이는 직접 도구. 나머지 500여 개는 oprn_tools → oprn_schema → oprn_call 로 찾아 쓴다
 * (전부 노출하면 ~410k 토큰이라 첫 턴에 컨텍스트가 넘친다 — openwiki/agent-direct-edit.md).
 */
export const AGENT_DIRECT_TOOLS = [
  "get_project_summary",
  "get_map_region",
  "show_map_region",
  "paint_tiles",
  "stamp_object",
  "place_props",
  "place_door",
  "place_chest",
  "find_events",
  "get_event",
  "create_map",
  "check_reachability",
] as const;

const DESCRIPTION_CAP = 1200;

export type McpToolInfo = { readonly name: string; readonly description: string; readonly inputSchema: unknown; readonly annotations?: Record<string, unknown> };
export type McpCallResult = { readonly text: string; readonly isError: boolean; readonly changed?: AgentChange };
export type AgentChange = { readonly mapId: string; readonly cells: number; readonly label: string };

const META_TOOLS: readonly McpToolInfo[] = [
  {
    name: "oprn_tools",
    description: "Search all OPRN editor tools by a word (Korean or English: npc, door, paint, event, battle, dungeon, village...). Returns `name [read|write] one-line description` lines. Use before oprn_schema/oprn_call.",
    inputSchema: { type: "object", properties: { query: { type: "string" } } },
    annotations: { title: "도구 찾기", readOnlyHint: true },
  },
  {
    name: "oprn_schema",
    description: "Full JSON schema and description of one OPRN editor tool.",
    inputSchema: { type: "object", properties: { name: { type: "string" } }, required: ["name"] },
    annotations: { title: "도구 설명 읽기", readOnlyHint: true },
  },
  {
    name: "oprn_call",
    description: "Call any OPRN editor tool by name with its arguments. A successful write is applied to the open editor at once.",
    inputSchema: { type: "object", properties: { name: { type: "string" }, args: { type: "object" } }, required: ["name"] },
    annotations: { title: "도구 실행" },
  },
];

function toMcp(tool: ToolDefinition): McpToolInfo {
  const description = tool.description.length > DESCRIPTION_CAP ? `${tool.description.slice(0, DESCRIPTION_CAP)}…` : tool.description;
  return {
    name: tool.name,
    description: tool.mode === "write" ? `${description} [writes to the open map]` : description,
    inputSchema: tool.parameters,
    annotations: { readOnlyHint: tool.mode === "read" },
  };
}

export function listAgentModeTools(): readonly McpToolInfo[] {
  const direct = AGENT_DIRECT_TOOLS.map((name) => getTool(name)).filter((tool): tool is ToolDefinition => tool !== undefined);
  return [...META_TOOLS, ...direct.map(toMcp)];
}

function firstLine(text: string): string {
  const line = text.split(/\n/u)[0] ?? "";
  return line.length > 160 ? `${line.slice(0, 160)}…` : line;
}

export function searchAgentModeTools(query: string): string {
  const words = query.toLowerCase().split(/\s+/u).filter(Boolean);
  const hits = activeTools().filter((tool) => {
    const hay = `${tool.name} ${tool.description}`.toLowerCase();
    return words.every((word) => hay.includes(word));
  });
  if (hits.length === 0) return `No tool matched "${query}". Try a shorter or different word.`;
  const shown = hits.slice(0, 40).map((tool) => `${tool.name} [${tool.mode}] ${firstLine(tool.description)}`);
  return `${hits.length} tools${hits.length > 40 ? " (first 40)" : ""}:\n${shown.join("\n")}`;
}

/** 한 턴 동안의 상태 — 첫 쓰기 전에는 되돌리기 기록이 없다. */
export type AgentTurn = { recorded: boolean; readonly label: string };

export function newAgentTurn(prompt: string): AgentTurn {
  const short = prompt.replace(/\s+/gu, " ").trim();
  return { recorded: false, label: `에이전트: ${short.length > 40 ? `${short.slice(0, 40)}…` : short}` };
}

function resultText(result: { ok: boolean; summary: string; data?: unknown; warnings?: string[]; issues?: unknown[] }): string {
  const parts = [result.summary];
  if (result.warnings?.length) parts.push(`warnings: ${result.warnings.join(" / ")}`);
  if (!result.ok && result.issues?.length) parts.push(`issues: ${JSON.stringify(result.issues).slice(0, 4000)}`);
  if (result.data !== undefined) parts.push(JSON.stringify(result.data));
  return parts.join("\n");
}

/** 도구 하나를 열린 편집기에서 실행한다. 쓰기가 성공하면 스토어에 얹고 바뀐 칸을 캔버스에 잠깐 표시한다. */
export async function callAgentModeTool(name: string, rawArgs: unknown, turn: AgentTurn | null): Promise<McpCallResult> {
  const args = rawArgs && typeof rawArgs === "object" && !Array.isArray(rawArgs) ? rawArgs as Record<string, unknown> : {};
  if (name === "oprn_tools") return { text: searchAgentModeTools(String(args.query ?? "")), isError: false };
  if (name === "oprn_schema") {
    const tool = getTool(String(args.name ?? ""));
    if (!tool) return { text: `Unknown tool ${String(args.name)}. Search with oprn_tools.`, isError: true };
    return { text: JSON.stringify({ name: tool.name, mode: tool.mode, description: tool.description, parameters: tool.parameters }), isError: false };
  }
  if (name === "oprn_call") return await callAgentModeTool(String(args.name ?? ""), args.args ?? {}, turn);
  const tool = getTool(name);
  if (!tool) return { text: `Unknown tool ${name}. Search with oprn_tools.`, isError: true };
  const before = store.getCurrent();
  const currentMapId = editorState.get().currentMapId ?? undefined;
  const ctx = { project: before, ...(currentMapId ? { currentMapId } : {}), assistantRun: true };
  await prepareTool(name, args, before);
  const result = runTool(ctx, name, args);
  if (!result.ok || tool.mode !== "write" || ctx.project === before) return { text: resultText(result), isError: !result.ok };
  if (store.getCurrent() !== before) {
    return { text: `${resultText(result)}\n(not applied: the project changed while the tool ran — call again)`, isError: true };
  }
  const label = turn?.label ?? `에이전트: ${name}`;
  const applied = applyProjectInAgentTurn(ctx.project, label, turn ? !turn.recorded : true);
  if (applied && turn) turn.recorded = true;
  const target = applied ? summarizeAcceptedAgentChanges(before, store.getCurrent()) : null;
  if (applied) focusAcceptedAgentChanges(before, store.getCurrent());
  const changed = target ? { mapId: target.mapId, cells: target.cells.length, label: name } : undefined;
  return { text: resultText(result), isError: false, ...(changed ? { changed } : {}) };
}
