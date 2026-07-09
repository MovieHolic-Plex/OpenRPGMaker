// 라이브 스모크: 하네싱 집 키트 소비 경로 종단 검증.
// 시나리오: "키트로 집 지어줘" → build_house_kit + 필요 시 paint_road.
// 실행: OPENROUTER_API_KEY 로드 후 `npx vitest run --config evals/vitest.config.mjs evals/templateSmoke.eval.ts`
import { describe, expect, it } from "vitest";
import { AssistantSession } from "@/ai/assistantSession";
import { defaultAiConfig } from "@/ai/llmClient";
import { runTool } from "@/editor/tools";
import { createBlankProject } from "@/project/defaults";

describe("live smoke — 하네싱 키트로 집 짓기", () => {
  it.skipIf(!process.env.OPENROUTER_API_KEY)("build_house_kit 경로를 사용한다", async () => {
    const project = createBlankProject();
    const ctx = { project };
    expect(runTool(ctx, "create_map", { name: "템플릿 마을", width: 30, height: 30, id: "map_tpl_smoke" }).ok).toBe(true);

    const session = new AssistantSession(ctx.project, {
      config: { ...defaultAiConfig(), apiKey: process.env.OPENROUTER_API_KEY ?? "" },
    });
    const toolLog: string[] = [];
    const result = await session.sendUserMessage(
      "map_tpl_smoke 맵의 (2,2) 근처에 하네싱 집 키트(build_house_kit)를 사용해서 집을 한 채 짓고 문 앞 길은 paint_road로 이어줘.",
      (event) => {
        if (event.type === "tool_call") toolLog.push(`${event.result.ok ? "OK" : "FAIL"} ${event.name} — ${event.result.summary}`);
      }
    );
    const proposed = session.getProposedProject();
    const map = proposed.maps.map_tpl_smoke;
    const tilesChanged = map.lowerTiles.filter((tile, index) => tile !== ctx.project.maps.map_tpl_smoke.lowerTiles[index]).length;
    console.log(JSON.stringify({
      toolLog,
      stoppedReason: result.stoppedReason,
      usedHouseKit: toolLog.some((line) => line.includes("build_house_kit")),
      tilesChanged,
      failCount: toolLog.filter((line) => line.startsWith("FAIL")).length,
      error: result.error ?? null,
    }, null, 2));
    expect(result.error).toBeUndefined();
    expect(toolLog.some((line) => line.includes("build_house_kit"))).toBe(true);
    expect(tilesChanged).toBeGreaterThan(0);
  }, 300000);
});
