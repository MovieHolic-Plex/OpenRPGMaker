import { describe, expect, it } from "vitest";
import { buildToolUsageReport, toolUsageReportJson, type ToolUsageObservation } from "@/ai/toolUsageReport";

const calls: ToolUsageObservation[] = [
  { name: "web_search", at: "2026-09-25T01:00:00.000Z", ok: true, summary: "검색", durationMs: 1200, query: "호그와트 구조", source: "trace" },
  { name: "web_search", at: "2026-09-25T01:00:01.000Z", ok: true, summary: "검색", query: "호그와트 구조", source: "conversation" },
  { name: "web_search", at: "2026-09-25T01:02:00.000Z", ok: false, summary: "시간 초과", durationMs: 800, query: "최신 버전", source: "trace" },
  { name: "get_map_region", at: "2026-09-25T01:03:00.000Z", ok: true, summary: "영역", source: "activity" },
  { name: "pi:시공", at: "2026-09-25T01:04:00.000Z", ok: true, summary: "역할", source: "activity" },
];

describe("tool usage report", () => {
  it("같은 호출은 한 번만 세고 도구별 횟수와 검색어를 남긴다", () => {
    const report = buildToolUsageReport({
      observations: calls,
      projectId: "project-1",
      exportedAt: "2026-09-25T02:00:00.000Z",
      sourceCounts: { traces: 1, conversations: 2, activityLogs: 3 },
    });
    expect(report.totals.calls).toBe(4);
    expect(report.totals.failed).toBe(1);
    expect(report.sources.droppedDuplicates).toBe(1);
    expect(report.sources.traces).toBe(1);
    const search = report.tools.find((tool) => tool.name === "web_search");
    expect(search?.calls).toBe(2);
    expect(search?.failed).toBe(1);
    expect(search?.recentQueries).toEqual(["최신 버전", "호그와트 구조"]);
    expect(search?.avgDurationMs).toBe(1000);
    const json = JSON.parse(toolUsageReportJson(report)) as { version: number; projectId: string };
    expect(json.version).toBe(1);
    expect(json.projectId).toBe("project-1");
  });
});