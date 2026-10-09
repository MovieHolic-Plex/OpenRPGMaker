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


  // 진행 중(pending)인 턴을 실패로 진단하면 아직 끝나지 않은 작업이 오류로 집계된다 —
  // 사용자 QA 원장 LOG-004 는 같은 행에 `result.pending:true` 와 `diagnostics.severity:error`,
  // `턴 실패: unknown` 이 함께 기록된 것을 실측으로 남겼다(docs/qa/saesol-three-hour-ai-authoring.md:135-142).
  // 사람이 읽는 요약은 이미 "진행 중" 이다(activityLogText.ts 의 pending 분기) — 진단도 같아야 한다.
  it("진행 중인 턴은 실패 진단을 만들지 않는다", () => {
    const record = buildAiActivityLogRecord({
      channel: "chat",
      instruction: "마을을 만들어줘",
      result: { ok: false, pending: true },
    });

    expect(record.diagnostics.severity).toBe("ok");
    expect(record.diagnostics.kinds).not.toContain("turn-error");
    expect(record.diagnostics.messages.some(message => message.includes("턴 실패"))).toBe(false);
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
  // 2026-08-29 실측: `run_interior_room_pipeline` 실패 3건의 진단이 전부 이 한 줄이었다.
  //   run_interior_room_pipeline: 'run_interior_room_pipeline' 커밋 거부(무결성 오류)
  // 커밋 거부 summary 는 어느 lint 가 터졌든 고정 문구라 그 줄만으로는 원인을 알 수 없다.
  // 정작 원인(`시작 위치가 통행 불가 타일입니다: (10, 12)`)은 audit[].issues 에 이미 있었고,
  // toolCalls 가 먼저 밋밋한 줄을 넣으면 audit 쪽 줄이 이름 중복으로 건너뛰어졌다.
  it("커밋 거부의 실제 lint 메시지를 진단 한 줄에 싣는다", () => {
    const record = buildAiActivityLogRecord({
      channel: "chat",
      instruction: "이 맵을 집으로 만들어라",
      result: { ok: true, stoppedReason: "final" },
      toolCalls: [{
        name: "run_interior_room_pipeline",
        args: { mapId: "map_gallery_main" },
        ok: false,
        summary: "'run_interior_room_pipeline' 커밋 거부(무결성 오류)",
      }],
      audit: [{
        kind: "tool",
        name: "run_interior_room_pipeline",
        args: { mapId: "map_gallery_main" },
        ok: false,
        summary: "'run_interior_room_pipeline' 커밋 거부(무결성 오류)",
        issues: ["시작 위치가 통행 불가 타일입니다: (10, 12)"],
        at: "2026-08-29T09:32:41.367Z",
      }],
    });

    const message = record.diagnostics.messages.find((entry) => entry.startsWith("run_interior_room_pipeline:"));
    expect(message, `messages: ${JSON.stringify(record.diagnostics.messages)}`).toBeDefined();
    // 핵심: 좌표까지 그대로 남아야 한다. 이게 없으면 코드를 역추적해야 한다.
    expect(message).toContain("시작 위치가 통행 불가 타일입니다: (10, 12)");
    // 도구 이름과 원래 summary 도 유지한다.
    expect(message).toContain("커밋 거부");
  });

  it("issue 가 많으면 앞 3건만 싣고 나머지는 개수로 알린다 — 요약이 로그가 되면 안 된다", () => {
    const record = buildAiActivityLogRecord({
      channel: "chat",
      instruction: "실내를 다시 지어줘",
      result: { ok: true, stoppedReason: "final" },
      audit: [{
        kind: "tool",
        name: "run_interior_room_pipeline",
        args: {},
        ok: false,
        summary: "커밋 거부(무결성 오류)",
        issues: ["첫째", "둘째", "셋째", "넷째", "다섯째"],
        at: "2026-08-29T09:32:41.367Z",
      }],
    });

    const message = record.diagnostics.messages[0]!;
    expect(message).toContain("첫째");
    expect(message).toContain("셋째");
    expect(message).not.toContain("넷째");
    expect(message).toContain("+2건");
  });

  it("issue 가 없는 실패는 예전 형식 그대로 남긴다", () => {
    const record = buildAiActivityLogRecord({
      channel: "chat",
      instruction: "적을 만들어줘",
      result: { ok: true, stoppedReason: "final" },
      toolCalls: [{ name: "upsert_enemy", args: {}, ok: false, summary: "enemy.id is required" }],
    });

    expect(record.diagnostics.messages).toEqual(["upsert_enemy: enemy.id is required"]);
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
