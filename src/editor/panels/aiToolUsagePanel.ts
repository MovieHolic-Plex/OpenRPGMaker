import { listAiActivityLogs } from "@/ai/activityLog";
import { readActivityArchive } from "@/ai/activityTraceArchive";
import type { ActivityEntry, ActivityTrace } from "@/ai/activityTrace";
import { listConversations, loadConversation } from "@/ai/conversationStore";
import {
  buildToolUsageReport,
  queryFromArgs,
  toolUsageReportJson,
  type ToolUsageObservation,
  type ToolUsageReport,
} from "@/ai/toolUsageReport";
import { store } from "@/project/store";
import { el } from "@/util/dom";
import { toolLabel } from "./aiToolLabels";

export function renderAiToolUsagePanel(): HTMLElement {
  const host = el("div", {
    class: "ai-tool-usage",
    dataset: { testid: "ai-tool-usage" },
    children: [el("p", { class: "ai-config-help", text: "이 브라우저에 남은 조수 실행 기록을 모으는 중…" })],
  });
  void loadToolUsageReport().then((report) => {
    host.replaceChildren(renderReport(report));
  }).catch((error: unknown) => {
    host.replaceChildren(el("p", {
      class: "ai-config-help",
      text: error instanceof Error ? error.message : "사용량을 읽지 못했습니다.",
    }));
  });
  return host;
}

export async function loadToolUsageReport(): Promise<ToolUsageReport> {
  const projectId = store.getProjectIdentity().id;
  const observations: ToolUsageObservation[] = [];
  let traces = 0;
  let conversations = 0;
  let activityLogs = 0;
  try {
    const archive = await readActivityArchive(projectId);
    traces = archive.length;
    for (const trace of archive) observations.push(...observationsFromTrace(trace));
  } catch {
    /* IndexedDB 가 없으면 대화·활동 로그만 센다. */
  }
  const summaries = await listConversations();
  const records = await Promise.all(summaries.map((summary) => loadConversation(summary.id)));
  for (const record of records) {
    if (!record) continue;
    conversations += 1;
    for (const entry of record.entries) {
      if (entry.kind !== "tool" || !entry.name || entry.name.startsWith("pi:")) continue;
      observations.push({
        name: entry.name,
        at: entry.at ?? new Date(record.savedAt).toISOString(),
        ok: entry.ok,
        summary: entry.summary,
        query: queryFromArgs(entry.args),
        source: "conversation",
      });
    }
  }
  for (const log of listAiActivityLogs()) {
    const calls = log.toolCalls.filter((call) => call.name && !call.name.startsWith("pi:"));
    if (calls.length === 0) continue;
    activityLogs += 1;
    for (const call of calls) {
      observations.push({
        name: call.name,
        at: log.at,
        ok: call.ok ?? null,
        summary: call.summary ?? "",
        query: queryFromArgs(call.args),
        source: "activity",
      });
    }
  }
  return buildToolUsageReport({
    observations,
    projectId,
    sourceCounts: { traces, conversations, activityLogs },
  });
}

function observationsFromTrace(trace: ActivityTrace): ToolUsageObservation[] {
  return trace.entries.filter((entry) => entry.kind === "tool" && (entry.status === "ok" || entry.status === "error")).map((entry) => ({
    name: entry.name,
    at: new Date(entry.endedAt ?? entry.at).toISOString(),
    ok: entry.status === "ok",
    summary: entry.summary,
    ...(entry.durationMs !== undefined ? { durationMs: entry.durationMs } : {}),
    query: queryFromTrace(entry),
    source: "trace" as const,
  }));
}

function queryFromTrace(entry: ActivityEntry): string | undefined {
  const input = entry.input;
  if (!input || typeof input !== "object") return undefined;
  const record = input as { query?: unknown; args?: unknown };
  return queryFromArgs(record) ?? queryFromArgs(record.args);
}

function renderReport(report: ToolUsageReport): HTMLElement {
  const selected = { name: report.tools[0]?.name ?? "" };
  const detail = el("div", { class: "ai-tool-usage-detail", dataset: { testid: "ai-tool-usage-detail" } });
  const rows = el("div", { class: "ai-tool-usage-rows", attrs: { role: "list" } });
  const paintDetail = (): void => {
    const tool = report.tools.find((row) => row.name === selected.name);
    const calls = report.recent.filter((call) => call.name === selected.name);
    detail.replaceChildren(...detailNodes(tool, calls));
  };
  for (const tool of report.tools) {
    const button = el("button", {
      class: "ai-tool-usage-row",
      attrs: { type: "button", role: "listitem" },
      dataset: { testid: `ai-tool-usage-row-${tool.name}` },
      children: [
        el("span", { class: "ai-tool-usage-name", children: [
          el("strong", { text: toolLabel(tool.name) }),
          el("small", { text: tool.name }),
        ] }),
        el("span", { class: "ai-tool-usage-count", text: String(tool.calls) }),
        el("span", { class: "ai-tool-usage-meta", text: metaText(tool) }),
      ],
    }) as HTMLButtonElement;
    button.addEventListener("click", () => {
      selected.name = tool.name;
      for (const node of rows.querySelectorAll(".ai-tool-usage-row")) node.classList.toggle("is-active", node === button);
      paintDetail();
    });
    rows.append(button);
  }
  if (report.tools.length > 0) {
    rows.querySelector(".ai-tool-usage-row")?.classList.add("is-active");
    paintDetail();
  }

  const exportButton = el("button", {
    class: "ai-assistant-action",
    attrs: { type: "button" },
    dataset: { testid: "ai-tool-usage-export" },
    text: "JSON으로 보내기",
  }) as HTMLButtonElement;
  exportButton.addEventListener("click", () => downloadReport(report));

  return el("div", {
    class: "ai-tool-usage-report",
    children: [
      el("div", { class: "ai-tool-usage-stats", children: [
        stat("호출", String(report.totals.calls)),
        stat("도구", String(report.totals.tools)),
        stat("실패", String(report.totals.failed)),
        stat("웹 검색", String(report.tools.find((tool) => tool.name === "web_search")?.calls ?? 0)),
      ] }),
      el("p", { class: "ai-config-help", text: sourceNote(report) }),
      report.tools.length === 0
        ? el("p", { class: "ai-tool-usage-empty", text: "이 브라우저에 남은 조수 도구 호출이 없습니다. 실행 영수증은 7일, 20회까지 이 기기에만 남습니다." })
        : el("div", { class: "ai-tool-usage-split", children: [rows, detail] }),
      el("div", { class: "ai-tool-usage-actions", children: [exportButton] }),
    ],
  });
}

function detailNodes(
  tool: ToolUsageReport["tools"][number] | undefined,
  calls: readonly ToolUsageReport["recent"][number][],
): HTMLElement[] {
  if (!tool) return [el("p", { class: "ai-config-help", text: "왼쪽에서 도구를 고르면 최근 호출이 나옵니다." })];
  const nodes: HTMLElement[] = [
    el("h4", { text: toolLabel(tool.name) }),
    el("p", { class: "ai-config-help", text: `${tool.calls}회 · 성공 ${tool.ok} · 실패 ${tool.failed}${tool.avgDurationMs !== null ? ` · 평균 ${formatDuration(tool.avgDurationMs)}` : ""}` }),
  ];
  if (tool.recentQueries.length > 0) {
    nodes.push(el("ul", {
      class: "ai-tool-usage-queries",
      children: tool.recentQueries.map((query) => el("li", { text: query })),
    }));
  }
  nodes.push(el("ol", {
    class: "ai-tool-usage-calls",
    children: calls.map((call) => el("li", {
      children: [
        el("span", { class: call.ok === false ? "is-failed" : "is-ok", text: call.ok === false ? "실패" : call.ok === true ? "성공" : "기록" }),
        el("time", { text: formatWhen(call.at), attrs: { dateTime: call.at } }),
        el("span", { text: (call.query ?? call.summary) || "요약 없음" }),
      ],
    })),
  }));
  if (calls.length === 0) {
    nodes.push(el("p", { class: "ai-config-help", text: "최근 40건 밖입니다. JSON에는 횟수와 검색어가 남아 있습니다." }));
  }
  return nodes;
}

function stat(label: string, value: string): HTMLElement {
  return el("div", {
    class: "ai-tool-usage-stat",
    children: [el("strong", { text: value }), el("span", { text: label })],
  });
}

function metaText(tool: ToolUsageReport["tools"][number]): string {
  const parts = [`실패 ${tool.failed}`];
  if (tool.avgDurationMs !== null) parts.push(formatDuration(tool.avgDurationMs));
  return parts.join(" · ");
}

function sourceNote(report: ToolUsageReport): string {
  const { traces, conversations, activityLogs, droppedDuplicates } = report.sources;
  return `실행 영수증 ${traces}개, 대화 ${conversations}개, 활동 로그 ${activityLogs}개에서 모았습니다. 겹친 호출 ${droppedDuplicates}건은 한 번만 세었습니다.`;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(ms >= 10_000 ? 0 : 1)}초`;
}

function formatWhen(iso: string): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return iso;
  return at.toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function downloadReport(report: ToolUsageReport): void {
  const blob = new Blob([toolUsageReportJson(report)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = el("a", {
    attrs: { href: url, download: `ai-tool-usage-${report.exportedAt.slice(0, 10)}.json` },
  });
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
