// 하네스 타임라인 병합 — 사람이 누른 것과 모델이 한 것이 한 줄기로 흘러야 한다.
//
// 왜 필요한가: 「압축을 누른 직후 턴이 깨졌다」, 「도크를 바꾸자 답장이 사라졌다」류는 두 스트림을
// 따로 보면 절대 안 보인다. 그리고 병합에는 조용한 함정이 하나 있다 — audit 항목 중 `at` 이 없는
// 것들(초기 상태줄)을 빈 문자열로 정렬하면 전부 맨 앞으로 몰려 «순서가 거짓» 이 된다.
import { describe, expect, it } from "vitest";
import type { AuditEntry } from "@/ai/assistantSession";
import { mergeHarnessTimeline } from "@/editor/panels/aiHarnessModal";

const audit: readonly AuditEntry[] = [
  { kind: "user", text: "석상 좀 고쳐줘", at: "2026-08-30T04:00:00.000Z" },
  { kind: "status", text: "phase:plan" }, // at 없음 — 직전 시각을 물려받아야 한다
  { kind: "tool", name: "set_event", args: {}, ok: true, summary: "이벤트 1건", at: "2026-08-30T04:00:10.000Z" },
];

describe("mergeHarnessTimeline", () => {
  it("interleaves front actions with audit entries by time", () => {
    const merged = mergeHarnessTimeline(audit, [
      { at: "2026-08-30T04:00:05.000Z", seq: 1, surface: "context-panel", action: "context-compact" },
      { at: "2026-08-30T04:00:20.000Z", seq: 2, surface: "panel", action: "turn-rewind" },
    ]);
    expect(
      merged.map((row) => (row.kind === "ui" ? `ui:${row.event.action}` : `audit:${row.entry.kind}`)),
    ).toEqual([
      "audit:user",
      "audit:status", // at 없는 칸이 사용자 발언 뒤에 그대로 남는다
      "ui:context-compact",
      "audit:tool",
      "ui:turn-rewind",
    ]);
  });

  it("puts the audit entry first when the timestamps tie", () => {
    // 액션의 결과가 그 액션보다 앞서 보이면 인과가 뒤집힌다.
    const merged = mergeHarnessTimeline(
      [{ kind: "status", text: "압축 완료", at: "2026-08-30T04:00:05.000Z" }],
      [{ at: "2026-08-30T04:00:05.000Z", seq: 1, surface: "context-panel", action: "context-compact" }],
    );
    expect(merged.map((row) => row.kind)).toEqual(["audit", "ui"]);
  });

  it("returns audit alone when nothing was pressed", () => {
    expect(mergeHarnessTimeline(audit, [])).toHaveLength(audit.length);
    expect(mergeHarnessTimeline([], [])).toHaveLength(0);
  });
});
