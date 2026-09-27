// 팀 초기 생성의 맵 사이 이음새(출입구·착지) 계약. 순수 모듈 — 실행은 scripts/lib/piTeamRuntime.ts.
//
// 왜 따로 두는가: 팀 모드는 맵마다 다른 에이전트가 자기 사본에서 짓고 도착 순서대로 병합한다.
// 맵 안의 품질은 각 담당과 검수가 보지만, 맵과 맵을 잇는 문은 한쪽 담당만 안다. 연구와 실측이
// 같은 곳을 가리킨다 — 다중 에이전트는 «남에게 필요한 정보를 전하지 않음» 과 «말한 것과 한 것이 다름»
// 에서 깨진다. 그래서 이음새는 메시지 문장이 아니라 프로젝트 데이터(worldGraph + 실제 transfer 이벤트)로
// 들고, 시공 전에 담당에게 알려 주고(describeMapSeams), 끝나기 전에 병합본으로 검사한다(inspectWorldSeams).

import { collectCommands, reachableMapIdsFromStart } from "@/project/mapInspection";
import type { LintIssue } from "@/project/lint/projectLint";
import type { Command, Project } from "@/project/types";
import { lintWorldGraph, normalizeProjectWorldGraph } from "@/project/worldGraph";

export interface WorldSeamIssue {
  readonly code: string;
  readonly severity: LintIssue["severity"];
  readonly mapId?: string;
  readonly x?: number;
  readonly y?: number;
  readonly message: string;
}

export interface WorldSeamReport {
  /** worldGraph 노드 수. 0 이면 계약이 없다(검사할 이음새도 없다). */
  readonly nodes: number;
  readonly edges: number;
  readonly issues: readonly WorldSeamIssue[];
}

type TransferCommand = Extract<Command, { kind: "transfer" }>;

const MAX_SEAM_LINES = 12;

function transfersOf(project: Project, mapId: string): { readonly x: number; readonly y: number; readonly command: TransferCommand }[] {
  const map = project.maps[mapId];
  if (!map) return [];
  const out: { x: number; y: number; command: TransferCommand }[] = [];
  for (const event of map.events) {
    for (const command of collectCommands([event])) {
      if (command.kind === "transfer" && command.mapId !== mapId) out.push({ x: event.x, y: event.y, command });
    }
  }
  return out;
}

function mapLabel(project: Project, mapId: string): string {
  const name = project.maps[mapId]?.name;
  return name && name !== mapId ? `${mapId}「${name}」` : mapId;
}

/**
 * 시공 담당에게 줄 이 맵의 이음새 목록. 비어 있으면 빈 배열(프롬프트에 아무것도 붙이지 않는다).
 * 좌표는 지금 병합본의 실제 이벤트에서 읽는다 — 계획(worldGraph)만 보면 build_world 가 스냅한
 * 실제 칸과 어긋날 수 있다.
 */
export function describeMapSeams(project: Project, mapId: string): string[] {
  const lines: string[] = [];
  for (const { x, y, command } of transfersOf(project, mapId)) {
    lines.push(`- 출입구 (${x},${y}) → ${mapLabel(project, command.mapId)} (${command.x},${command.y})`);
  }
  for (const otherId of Object.keys(project.maps)) {
    if (otherId === mapId) continue;
    for (const { command } of transfersOf(project, otherId)) {
      if (command.mapId === mapId) lines.push(`- 도착 칸 (${command.x},${command.y}) ← ${mapLabel(project, otherId)} 에서 온다`);
    }
  }
  let graphEdges: ReturnType<typeof normalizeProjectWorldGraph>["edges"] = [];
  try {
    graphEdges = normalizeProjectWorldGraph(project).edges;
  } catch {
    graphEdges = [];
  }
  for (const edge of graphEdges) {
    if (edge.kind !== "transfer" || edge.from.mapId !== mapId) continue;
    if (transfersOf(project, mapId).some(({ command }) => command.mapId === edge.to.mapId)) continue;
    lines.push(`- 아직 없는 연결: 이 맵 → ${mapLabel(project, edge.to.mapId)} (계획에만 있다. 팀장이 맡기지 않았으면 만들지 말고 보고한다)`);
  }
  if (lines.length === 0) return [];
  const shown = lines.slice(0, MAX_SEAM_LINES);
  if (lines.length > shown.length) shown.push(`- …외 ${lines.length - shown.length}건`);
  return [
    "이 맵의 연결 계약(다른 담당의 맵과 이어지는 자리):",
    ...shown,
    "출입구 이벤트를 지우거나 옮기지 않는다. 도착 칸과 그 앞은 통행 가능하게 비워 둔다. 지형 때문에 옮겨야 하면 먼저 send_team_message 로 팀장에게 새 좌표를 알리고, 다른 맵의 도착 칸은 고치지 않는다.",
  ];
}

/**
 * 병합본의 이음새 검사. worldGraph 가 없으면 이슈 없음 — 계약이 없는 팀 작업(맵 하나 고치기 등)을 막지 않는다.
 * lint_world 와 같은 판정(lintWorldGraph)에 «계획한 맵이 시작 맵에서 닿는가» 를 더한다. 문이 한쪽에만
 * 있어도 lintWorldGraph 는 통과할 수 있지만 플레이어는 그 맵에 못 간다.
 */
export function inspectWorldSeams(project: Project): WorldSeamReport {
  let graph: ReturnType<typeof normalizeProjectWorldGraph>;
  try {
    graph = normalizeProjectWorldGraph(project);
  } catch {
    return { nodes: 0, edges: 0, issues: lintWorldGraph(project).map(toSeamIssue) };
  }
  if (graph.nodes.length === 0) return { nodes: 0, edges: graph.edges.length, issues: [] };
  const issues: WorldSeamIssue[] = lintWorldGraph(project).map(toSeamIssue);
  const reachable = reachableMapIdsFromStart(project);
  for (const node of graph.nodes) {
    if (!project.maps[node.mapId] || reachable.has(node.mapId)) continue;
    issues.push({
      code: "world-node-unreachable",
      severity: "error",
      mapId: node.mapId,
      message: `계획한 맵 ${mapLabel(project, node.mapId)} 에 시작 맵에서 문으로 갈 수 없습니다 — 거기 만든 것이 플레이에 나오지 않습니다.`,
    });
  }
  return { nodes: graph.nodes.length, edges: graph.edges.length, issues };
}

function toSeamIssue(issue: LintIssue): WorldSeamIssue {
  return {
    code: issue.code,
    severity: issue.severity,
    ...(issue.mapId ? { mapId: issue.mapId } : {}),
    ...(issue.x !== undefined ? { x: issue.x } : {}),
    ...(issue.y !== undefined ? { y: issue.y } : {}),
    message: issue.message,
  };
}

/** 보고 한 줄 요약. finish 거절·최종 보고가 같은 문장을 쓴다. */
export function formatSeamIssues(issues: readonly WorldSeamIssue[], limit = 6): string {
  const shown = issues.slice(0, limit).map((issue) => issue.message);
  return shown.join("; ") + (issues.length > limit ? ` 외 ${issues.length - limit}건` : "");
}
