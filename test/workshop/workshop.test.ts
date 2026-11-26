import { describe, expect, it } from "vitest";
import { etaMinutes, itemState, roundProgress } from "@/editor/workshop/workshopStatus";
import type { WorkshopRound, WorkshopRun } from "@/harnesses/_core/workshop/types";
import { resolveSurfaceAiConfig } from "@/ai/assistantEndpoint";
import { defaultAiConfig } from "@/ai/llmClient";
import { parseRoleModels } from "@/ai/modelRoles";
import { isolateTimers } from "../mergedTeardown";

// test/workshop/workshopStatus.test.ts
describe("workshopStatus", () => {
  isolateTimers();
  const run = (status: WorkshopRun["status"], startedAt: number | null = null, finishedAt: number | null = null): WorkshopRun => ({
    letter: "A", direction: "", status, attempt: 1, attempts: [], grid: null, note: "", topRows: null, verdict: null, error: null, calls: 0, redrawNote: "", startedAt, finishedAt,
  });
  const round = (id: string, created: number, statuses: WorkshopRun["status"][]): WorkshopRound => ({ id, projectKey: "p", harnessId: "h", itemKey: "box", note: "", created, runs: statuses.map((s) => run(s)) });
  describe("공방 기물 상태", () => {
    it("그리는 중 > 고를 차례 > 고름 > 아직", () => {
      expect(itemState("box", [], [])).toBe("idle");
      expect(itemState("box", [round("r1", 1, ["done", "drawing"])], [])).toBe("drawing");
      expect(itemState("box", [round("r1", 1, ["done", "failed"])], [])).toBe("choose");
      // 한 장도 못 그린 판(계정 한도·로그인 막힘)은 고를 차례가 아니라 멈춤
      expect(itemState("box", [round("r1", 1, ["failed", "failed"])], [])).toBe("stopped");
      expect(itemState("box", [round("r1", 1, ["done"])], [{ projectKey: "p", itemKey: "box", roundId: "r1", letter: "A", at: 5 }])).toBe("picked");
      // 고른 뒤 새 판을 뽑아 다 그렸으면 다시 고를 차례
      expect(itemState("box", [round("r1", 1, ["done"]), round("r2", 9, ["done"])], [{ projectKey: "p", itemKey: "box", roundId: "r1", letter: "A", at: 5 }])).toBe("choose");
      // 취소만 남은 판은 고를 것이 없다
      expect(itemState("box", [round("r1", 1, ["cancelled"])], [])).toBe("idle");
    });
    it("진행·예상 시간", () => {
      expect(roundProgress(round("r", 1, ["done", "queued", "failed"]))).toEqual({ done: 2, total: 3 });
      const finished = { ...round("r", 1, []), runs: [run("done", 0, 120_000), run("done", 0, 240_000), run("queued"), run("queued")] };
      expect(etaMinutes([finished], 2)).toBe(3); // 평균 3분 × 남은 2장 ÷ 동시 2
      expect(etaMinutes([round("r", 1, ["queued", "queued", "queued"])], 3)).toBe(3); // 기록 없으면 장당 3분
    });
  });
});

describe("workshopSurfaces", () => {
  isolateTimers();
  const roleModels = parseRoleModels({ vision: { provider: "openai-codex", model: "future-vision", thinkingLevel: "high" } });
  const config = { ...defaultAiConfig(), roleModels };
  describe("공방 AI 표면", () => {
    it("검수는 vision 역할 모델 + 고정 예산 4096", () => {
      expect(resolveSurfaceAiConfig("workshop-review", config)).toMatchObject({ model: "future-vision", providerId: "openai-codex", maxTokens: 4096 });
    });
    it("그리기는 감독(ultrabrain) 티어 + 고정 예산 16384 — 도트 저작 모델을 고르지 않은 설정에서는 구조물 표면과 같은 모델", () => {
      const legacy = { ...config, pixelModel: undefined };
      const draw = resolveSurfaceAiConfig("workshop-draw", legacy);
      expect(draw.model).toBe(resolveSurfaceAiConfig("structure-kit", legacy).model);
      expect(draw.maxTokens).toBe(16384);
    });
    it("도트 저작 모델(pixelModel)을 저장했으면 그리기가 그 모델을 쓴다 — 검수는 vision 그대로", () => {
      const pixel = { ...config, pixelModel: { provider: "google-antigravity", model: "claude-sonnet-4-6", thinkingLevel: "high" as const } };
      expect(resolveSurfaceAiConfig("workshop-draw", pixel)).toMatchObject({ model: "claude-sonnet-4-6", providerId: "google-antigravity", maxTokens: 16384 });
      expect(resolveSurfaceAiConfig("workshop-review", pixel)).toMatchObject({ model: "future-vision", maxTokens: 4096 });
    });
  });
});
