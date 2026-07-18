// 라이브 스모크: 맵 인터뷰(소크라테스식 타일 가르치기) 프로토콜 종단 검증.
// 시나리오: 사람이 깐 맵(설명 없는 타일 포함) → 킥오프 → 모델이 분석+강조+[선택지] 질문
//          → 사용자 답변 → set_tile_metadata(confirmedByUser)로 기록 → 다음 질문.
// 실행: VITE_LLM_API_KEY 로드 후 `npx vitest run --config evals/vitest.config.mjs evals/interviewSmoke.eval.ts`
import { describe, expect, it } from "vitest";
import { AssistantSession } from "@/ai/assistantSession";
import { buildInterviewKickoff, parseQuickReplies } from "@/ai/interviewPrompt";
import { defaultAiConfig } from "@/ai/llmClient";
import { runTool } from "@/editor/tools";
import { createBlankProject } from "@/project/defaults";
import { DEFAULT_TILESET_ID } from "@/project/defaults/constants";

const UNKNOWN_TILE = 264; // 어떤 메타데이터에도 없는 상위 레이어 타일(인터뷰 질문 대상).

describe("live smoke — 맵 인터뷰", () => {
  it.skipIf(!process.env.VITE_LLM_API_KEY)("질문→답변→사용자 확정 메타데이터 기록 루프가 돈다", async () => {
    // 사람이 깐 맵 흉내: 설명 없는 타일 클러스터가 있는 맵.
    const project = createBlankProject();
    const ctx = { project };
    const created = runTool(ctx, "create_map", { name: "인터뷰 마을", width: 12, height: 12, id: "map_interview" });
    expect(created.ok, created.summary).toBe(true);
    const map = ctx.project.maps.map_interview;
    for (let y = 3; y <= 4; y += 1) {
      for (let x = 3; x <= 6; x += 1) map.upperTiles[y * map.width + x] = UNKNOWN_TILE;
    }

    const session = new AssistantSession(ctx.project, {
      config: { ...defaultAiConfig(), apiKey: process.env.VITE_LLM_API_KEY ?? "" },
    });
    const toolLog: string[] = [];
    const onEvent = (event: { type: string; name?: string; result?: { ok: boolean; summary: string } }): void => {
      if (event.type === "tool_call" && event.result) {
        toolLog.push(`${event.result.ok ? "OK" : "FAIL"} ${event.name} — ${event.result.summary}`);
      }
    };

    // 1턴: 킥오프 — 분석하고 첫 질문을 해야 한다.
    const turn1 = await session.sendUserMessage(buildInterviewKickoff("map_interview"), onEvent);
    const chips1 = parseQuickReplies(turn1.assistantText);

    // 2턴: 사용자 답변 — 창문이라고 가르친다.
    const turn2 = await session.sendUserMessage(
      "그건 창문이야. 집 벽에 붙는 장식이고 통행과는 무관해. 다음 질문 해줘.",
      onEvent
    );

    const proposed = session.getProposedProject();
    const meta = proposed.tilesets[DEFAULT_TILESET_ID].tileMeta?.[UNKNOWN_TILE];
    console.log(JSON.stringify({
      toolLog,
      turn1Stopped: turn1.stoppedReason,
      turn2Stopped: turn2.stoppedReason,
      chips1,
      turn1Tail: turn1.assistantText.slice(-200),
      turn2Tail: turn2.assistantText.slice(-200),
      recordedMeta: meta ? { label: meta.label, source: meta.source, userLocked: meta.userLocked } : null,
      analyzeCalled: toolLog.some((line) => line.includes("analyze_map_tile_usage")),
      highlightCalled: toolLog.some((line) => line.includes("highlight_map_region")),
      failCount: toolLog.filter((line) => line.startsWith("FAIL")).length,
      error: turn1.error ?? turn2.error ?? null,
    }, null, 2));

    expect(turn1.error).toBeUndefined();
    expect(turn2.error).toBeUndefined();
    // 프로토콜 핵심: 분석 툴 사용 + 답변이 사용자 확정 메타데이터로 기록됨.
    expect(toolLog.some((line) => line.startsWith("OK analyze_map_tile_usage"))).toBe(true);
    expect(toolLog.some((line) => line.startsWith("OK set_tile_metadata"))).toBe(true);
    expect(meta?.source).toBe("user");
    expect(meta?.userLocked).toBe(true);
    expect(`${meta?.label} ${meta?.description}`).toContain("창");
  }, 300000);
});
