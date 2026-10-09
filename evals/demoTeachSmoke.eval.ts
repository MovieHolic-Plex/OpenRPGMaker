// 라이브 스모크: 시연으로 가르치기 — 시연 메시지를 받은 모델이 교정 툴을 실제로 호출하는지.
// 시나리오: "나무 290은 뭉쳐야 한다"를 붓질 시연으로 전달 → set_tile_metadata/upsert_tile_group 기록.
// 실행: VITE_LLM_API_KEY 로드 후 `npx vitest run --config evals/vitest.config.mjs evals/demoTeachSmoke.eval.ts`
import { describe, expect, it } from "vitest";
import { AssistantSession } from "@/ai/assistantSession";
import { buildDemonstrationMessage } from "@/ai/demonstrationPrompt";
import { defaultAiConfig } from "@/ai/llmClient";
import { createBlankProject } from "@/project/defaults";
import { DEFAULT_TILESET_ID } from "@/project/defaults/constants";

describe("live smoke — 시연으로 가르치기", () => {
  it.skipIf(!process.env.VITE_LLM_API_KEY)("시연을 해석해 교정 메타데이터를 기록한다", async () => {
    const session = new AssistantSession(createBlankProject(), {
      config: { ...defaultAiConfig(), apiKey: process.env.VITE_LLM_API_KEY ?? "" },
    });
    const toolLog: string[] = [];
    const message = buildDemonstrationMessage({
      w: 4,
      h: 3,
      seed: null,
      lower: [
        [240, 290, 290, 240],
        [240, 290, 290, 240],
        [240, 240, 240, 240],
      ],
      upper: [
        [-1, -1, -1, -1],
        [-1, -1, -1, -1],
        [-1, -1, -1, -1],
      ],
      strokes: [
        { layer: "lower", x: 1, y: 0, tile: 290 },
        { layer: "lower", x: 2, y: 0, tile: 290 },
        { layer: "lower", x: 1, y: 1, tile: 290 },
        { layer: "lower", x: 2, y: 1, tile: 290 },
      ],
      explanation: "타일 290(침엽수 숲)은 이렇게 최소 2×2로 뭉쳐 깔아야 한다. 1칸 단독은 금지.",
    });
    const result = await session.sendUserMessage(message, (event) => {
      if (event.type === "tool_call") toolLog.push(`${event.result.ok ? "OK" : "FAIL"} ${event.name} — ${event.result.summary}`);
    });
    const proposed = session.getProposedProject();
    const tileset = proposed.tilesets[DEFAULT_TILESET_ID];
    const meta290 = tileset.tileMeta?.[290];
    const groups290 = (tileset.tileGroups ?? []).filter((group) => group.tileIds.includes(290) && group.placementRules.includes("2"));
    console.log(JSON.stringify({
      toolLog,
      stoppedReason: result.stoppedReason,
      meta290: meta290 ? { label: meta290.label, source: meta290.source, description: meta290.description.slice(0, 80) } : null,
      matchedGroups: groups290.map((group) => ({ id: group.id, rules: group.placementRules.slice(0, 80) })),
      failCount: toolLog.filter((line) => line.startsWith("FAIL")).length,
      tail: result.assistantText.slice(-200),
      error: result.error ?? null,
    }, null, 2));
    expect(result.error).toBeUndefined();
    // 핵심 계약: 시연이 교정 기록 툴 호출로 이어진다(메타데이터 또는 그룹 규칙).
    const recorded = toolLog.some((line) => line.startsWith("OK set_tile_metadata") || line.startsWith("OK upsert_tile_group"));
    expect(recorded).toBe(true);
  }, 300000);
});
