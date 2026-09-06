import type { JsonObject, JsonValue } from "./contracts";
import type { Command } from "@/project/types";
import { eventCommandBranches } from "@/editor/eventCommandBranches";

export interface ReportFlowNode { readonly id: string; readonly label: string; readonly value: JsonValue }
export interface ReportFlowEdge { readonly from: string; readonly to: string; readonly label: string }
export interface ReportFlow { readonly nodes: readonly ReportFlowNode[]; readonly edges: readonly ReportFlowEdge[] }
const object = (v: JsonValue | undefined): v is JsonObject => v !== null && typeof v === "object" && !Array.isArray(v);

/** Authored command structure, not a gameplay execution/QA claim. Edges explicitly
 * distinguish list order from branch containment; nested branches are never sampled. */
export function commandReportFlow(commands: readonly JsonValue[]): ReportFlow {
  const nodes: ReportFlowNode[] = [], edges: ReportFlowEdge[] = [];
  const labels = new Map<string, string>();
  const jumps: Array<{ from: string; name: string }> = [];
  function list(values: readonly JsonValue[], prefix: string, parent?: string, branch?: string) {
    let previous: string | undefined;
    values.forEach((value, index) => {
      const id = `${prefix}/${index}`;
      const kind = object(value) ? String(value.kind ?? "command") : "command";
      nodes.push({ id, label: object(value) ? `${kind}: ${String(value.body && typeof value.body === "string" ? value.body : value.name ?? value.prompt ?? "")}` : kind, value });
      if (previous) edges.push({ from: previous, to: id, label: "authored order" });
      else if (parent) edges.push({ from: parent, to: id, label: branch ?? "branch" });
      previous = id;
      if (!object(value)) return;
      if (kind === "label") labels.set(String(value.name), id);
      if (kind === "gotoLabel") jumps.push({ from: id, name: String(value.name) });
      for (const child of eventCommandBranches(value as unknown as Command)) {
        if (child.commands.length) list(child.commands as unknown as readonly JsonValue[], `${id}/${child.branchIndex}`, id, child.label);
        else {
          const emptyId = `${id}/${child.branchIndex}/empty`;
          nodes.push({ id: emptyId, label: "Empty branch", value: [] });
          edges.push({ from: id, to: emptyId, label: child.label });
        }
      }
    });
  }
  list(commands, "commands");
  for (const jump of jumps) { const to = labels.get(jump.name); if (to) edges.push({ from: jump.from, to, label: "goto" }); }
  return { nodes, edges };
}
export function questReportFlow(quest: JsonObject): ReportFlow {
  if (quest.kind === "graph" && Array.isArray(quest.nodes) && Array.isArray(quest.edges)) {
    return { nodes: quest.nodes.filter(object).map(node => ({ id: String(node.id), label: String(node.description ?? node.id), value: node })),
      edges: quest.edges.filter(object).map(edge => ({ from: String(edge.from), to: String(edge.to), label: "requires" })) };
  }
  const steps = Array.isArray(quest.steps) ? quest.steps : [];
  return { nodes: steps.map((value, i) => ({ id: String(i), label: object(value) ? String(value.kind) : "step", value })),
    edges: steps.slice(1).map((_, i) => ({ from: String(i), to: String(i + 1), label: "next step" })) };
}
function shortLabel(text: string, limit: number): string {
  const points = Array.from(text.replace(/[\r\n\t]/g, " "));
  return points.length > limit ? `${points.slice(0, limit - 3).join("")}...` : points.join("");
}
const escape = (text: string) => text.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]!);
export function reportFlowSvg(flow: ReportFlow): { svg: string; width: number; height: number } {
  const width = 960, height = Math.max(100, flow.nodes.length * 100 + 40);
  const positions = new Map(flow.nodes.map((node, index) => [node.id, index * 100 + 20]));
  const edges = flow.edges.map(edge => {
    const from = positions.get(edge.from), to = positions.get(edge.to);
    if (from === undefined || to === undefined) return "";
    return `<path d="M 620 ${from + 28} H 680 V ${to + 28} H 620" fill="none" stroke="#667085"/><text x="690" y="${(from + to) / 2 + 28}" font-size="11">${escape(shortLabel(edge.label, 18))}</text>`;
  }).join("");
  const nodes = flow.nodes.map(node => {
    const y = positions.get(node.id)!;
    return `<g><title>${escape(node.label)}</title><rect x="20" y="${y}" width="600" height="66" rx="6" fill="#eef2ff" stroke="#6366f1"/><svg x="34" y="${y + 4}" width="566" height="58" overflow="hidden"><text y="16" font-size="11">${escape(shortLabel(node.id, 48))}</text><text y="41" font-size="14">${escape(shortLabel(node.label, 36))}</text></svg></g>`;
  }).join("");
  return { svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="white"/><g font-family="sans-serif" fill="#182230">${edges}${nodes}</g></svg>`, width, height };
}
