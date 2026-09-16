// recommend_bgm — 분위기/장면 질의 → 후보 10곡 + 전체 설명 1호출.
// list_resources(제목만, 240자 잘림) + get_audio_resource N번의 1+N 호출을
// 한 번으로 합친 읽기 툴. 제목 먼저 훑고 설명까지 보고 고르는 계약을 강제한다.
import { describe, expect, it } from "vitest";
import { getTool } from "@/editor/tools/toolRegistry";
import { runTool } from "@/editor/tools/toolRunner";
import type { ToolContext } from "@/editor/tools/types";
import { createEmptyToolProject } from "@/editor/tools/emptyProject";

function run(ctx: ToolContext, args: Record<string, unknown>) {
  return runTool(ctx, "recommend_bgm", args, { dryRun: false });
}

describe("recommend_bgm RED", () => {
  it("등록된 읽기 툴이다", () => {
    expect(getTool("recommend_bgm")?.mode).toBe("read");
  });

  it("분위기 질의에 후보 10곡 + 전체 설명을 한 번에 돌려준다", () => {
    const ctx: ToolContext = { project: createEmptyToolProject() };
    const result = run(ctx, { query: "슬픈 마을", limit: 10 });
    expect(result.ok, result.summary).toBe(true);
    const data = result.data as {
      candidates: Array<{
        resourceId: string; name: string; score: number;
        description: string; descriptionTruncated: boolean; descriptionSource: string;
      }>;
      total: number;
    };
    expect(data.candidates).toHaveLength(10);
    for (const candidate of data.candidates) {
      // 전체 설명 — 잘림 없음
      expect(candidate.descriptionTruncated).toBe(false);
      expect(candidate.description.length).toBeGreaterThan(0);
      expect(typeof candidate.score).toBe("number");
    }
  });

  it("query 없이 장면만으로도 후보를 돌려준다", () => {
    const ctx: ToolContext = { project: createEmptyToolProject() };
    const result = run(ctx, { scene: "village", limit: 10 });
    expect(result.ok, result.summary).toBe(true);
    const data = result.data as { candidates: unknown[] };
    expect(data.candidates).toHaveLength(10);
  });

  it("query도 scene도 없으면 거절한다", () => {
    const ctx: ToolContext = { project: createEmptyToolProject() };
    const result = run(ctx, { limit: 10 });
    expect(result.ok).toBe(false);
  });
});
