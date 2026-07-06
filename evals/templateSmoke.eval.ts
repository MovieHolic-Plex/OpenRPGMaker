// 라이브 스모크: 지형 템플릿 지식뱅크 소비 경로 종단 검증.
// 시나리오: "템플릿으로 집 지어줘" → list_terrain_templates → stamp_terrain_template(또는 get 후 스탬프).
// 실행: OPENROUTER_API_KEY 로드 후 `npx vitest run --config evals/vitest.config.mjs evals/templateSmoke.eval.ts`
import { describe, expect, it } from "vitest";
import { AssistantSession } from "@/ai/assistantSession";
import { defaultAiConfig } from "@/ai/llmClient";
import { runTool } from "@/editor/tools";
import { createBlankProject } from "@/project/defaults";

describe("live smoke — 지형 템플릿으로 집 짓기", () => {
  it.skipIf(!process.env.OPENROUTER_API_KEY)("템플릿 조회→스탬프 경로를 사용한다", async () => {
    const project = createBlankProject();
    const ctx = { project };
    expect(runTool(ctx, "create_map", { name: "템플릿 마을", width: 30, height: 30, id: "map_tpl_smoke" }).ok).toBe(true);

    const session = new AssistantSession(ctx.project, {
      config: { ...defaultAiConfig(), apiKey: process.env.OPENROUTER_API_KEY ?? "" },
    });
    const toolLog: string[] = [];
    const result = await session.sendUserMessage(
      "map_tpl_smoke 맵의 (2,2) 근처에 지형 템플릿을 사용해서 집을 한 채 지어줘. 템플릿 지식을 먼저 확인하고 지어.",
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
      usedTemplateTools: toolLog.some((line) => line.includes("terrain_template")),
      tilesChanged,
      failCount: toolLog.filter((line) => line.startsWith("FAIL")).length,
      error: result.error ?? null,
    }, null, 2));
    expect(result.error).toBeUndefined();
    // 핵심 계약: 템플릿 지식 경로(list/get/stamp 중 하나 이상)를 실제로 사용해 집을 지었다.
    expect(toolLog.some((line) => line.includes("terrain_template"))).toBe(true);
    expect(tilesChanged).toBeGreaterThan(0);
  }, 300000);
});
