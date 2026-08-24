import { describe, expect, it } from "vitest";
import { buildAiActivityLogRecord } from "@/ai/activityLog";

describe("AI activity diagnostics", () => {
  it("성공으로 끝난 의도 재질문도 QA 경고로 분류한다", () => {
    const record = buildAiActivityLogRecord({
      channel: "chat",
      instruction: "집 2채와 실내 방 하나를 만들어줘",
      result: { ok: true, stoppedReason: "final", proposedCalls: 0 },
      audit: [
        {
          kind: "status",
          text: "의도 확인(house-vs-interior): 실내·야외 표지가 동시에 있음",
          at: "2026-08-23T00:00:00.000Z",
        },
      ],
    });

    expect(record.diagnostics.severity).toBe("warning");
    expect(record.diagnostics.kinds).toContain("intent-clarification");
  });

  it("ok:false 툴은 턴 결과가 true여도 오류와 툴 이름을 남긴다", () => {
    const record = buildAiActivityLogRecord({
      channel: "chat",
      instruction: "적을 만들어줘",
      result: { ok: true, stoppedReason: "final" },
      toolCalls: [
        { name: "upsert_enemy", args: {}, ok: false, summary: "enemy.id is required" },
      ],
    });

    expect(record.diagnostics.severity).toBe("error");
    expect(record.diagnostics.kinds).toContain("tool-failure");
    expect(record.diagnostics.failedTools).toEqual(["upsert_enemy"]);
  });


  it("실패한 완료 게이트는 WorkPlan 오류로 분류한다", () => {
    const record = buildAiActivityLogRecord({
      channel: "chat",
      instruction: "계획을 완료해줘",
      result: { ok: true, stoppedReason: "final" },
      toolCalls: [{ name: "complete_work_item", args: { itemId: "L1-a" }, ok: false, summary: "필수 툴 미실행" }],
    });

    expect(record.diagnostics.kinds).toEqual(expect.arrayContaining(["tool-failure", "work-plan"]));
  });

  it("노출 툴 목록의 complete_work_item·skip_work_item 문자열은 WorkPlan 실패가 아니다", () => {
    const record = buildAiActivityLogRecord({
      channel: "chat",
      instruction: "현재 맵을 설명해줘",
      result: { ok: true, stoppedReason: "final" },
      audit: [{
        kind: "status",
        text: "tools:exposed 3 — get_map_region,complete_work_item,skip_work_item",
        at: "2026-08-23T00:00:00.000Z",
      }],
    });

    expect(record.diagnostics).toEqual({ severity: "ok", kinds: [], messages: [], failedTools: [] });
  });
  it("문제 없는 턴은 ok로 분류한다", () => {
    const record = buildAiActivityLogRecord({
      channel: "chat",
      instruction: "현재 맵을 설명해줘",
      result: { ok: true, stoppedReason: "final" },
    });

    expect(record.diagnostics).toEqual({ severity: "ok", kinds: [], messages: [], failedTools: [] });
  });
});
