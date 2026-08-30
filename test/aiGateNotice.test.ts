// 차단 게이트 경고의 순수 부분 — 사유를 요약해 버리지 않는지, append scope 의 구조적 한계를
// 사용자에게 말해 주는지, 모달이 한 장만 뜨고 Escape 로 닫히는지.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  aiGateNoticeToPlainText,
  commitGateNotice,
  eventCommandGateNotice,
  layoutGateNotice,
  turnErrorNotice,
  MAX_GATE_REASONS,
} from "@/ai/aiGateNotice";
import { showAiGateNotice } from "@/editor/ui/aiGateModal";
import { modalStackDepthForTest, resetModalStackForTest } from "@/editor/ui/modalStack";
import type { LintIssue } from "@/project/lint/projectLint";
import { findByTestId, installFakeDom } from "./fakeDom";

describe("aiGateNotice — 사유를 버리지 않는다", () => {
  it("배치 검증: error 사유를 전부 싣고 맵/좌표를 붙인다", () => {
    const issues: LintIssue[] = [
      { severity: "error", code: "layout-prop-on-water", mapId: "map_a", x: 3, y: 4, message: "물 타일 위에 소품이 2칸 있습니다." },
      { severity: "warning", code: "layout-tree-expectation", mapId: "map_a", message: "나무 0그루" },
      { severity: "error", code: "layout-tree-incomplete", mapId: "map_b", message: "수관 아래 밑동이 없습니다." },
    ];
    const notice = layoutGateNotice(issues);
    expect(notice.kind).toBe("layout-validation");
    expect(notice.reasons).toEqual([
      "[map_a (3, 4)] 물 타일 위에 소품이 2칸 있습니다.",
      "[map_b] 수관 아래 밑동이 없습니다.",
    ]);
    // warning 은 차단 사유가 아니므로 error 가 있는 한 사유 목록에 섞지 않는다.
    expect(notice.reasons.join("\n")).not.toContain("나무 0그루");
    expect(notice.nextSteps.length).toBeGreaterThan(0);
  });

  it("커밋 게이트: 사유가 상한을 넘으면 남은 건수를 마지막 줄에 적는다", () => {
    const messages = Array.from({ length: MAX_GATE_REASONS + 4 }, (_, index) => `오류 ${index}`);
    const notice = commitGateNotice(messages);
    expect(notice.reasons).toHaveLength(MAX_GATE_REASONS);
    expect(notice.reasons.at(-1)).toBe(`…외 ${messages.length - (MAX_GATE_REASONS - 1)}건`);
  });

  it("커밋 게이트: 사유가 비어도 «확인할 수 없다»고 말한다(빈 목록 금지)", () => {
    expect(commitGateNotice([]).reasons).toHaveLength(1);
  });

  it("중복 사유는 접는다 — 같은 문장이 맵마다 반복되면 화면만 밀린다", () => {
    expect(commitGateNotice(["같은 오류", "같은 오류", " 같은 오류 "]).reasons).toEqual(["같은 오류"]);
  });

  it("턴 오류: «찾을 수 없습니다» 계열이면 대상을 고르라고 안내한다", () => {
    const notFound = turnErrorNotice({ message: "제거할 이벤트를 찾을 수 없습니다: ev_9" });
    expect(notFound.nextSteps[0]).toContain("클릭해 고른");
    const other = turnErrorNotice({ message: "네트워크 오류" });
    expect(other.nextSteps[0]).toContain("한 번 더");
  });

  it("이벤트 명령 AI: append scope 는 지우기가 표현 불가라는 사실을 사유에 싣는다", () => {
    const notice = eventCommandGateNotice({ message: "빈 배열입니다.", scope: "append", commandCount: 120 });
    expect(notice.reasons.join("\n")).toContain("120개");
    expect(notice.reasons.join("\n")).toContain("지우기");
    expect(notice.nextSteps.join("\n")).toContain("직접 고른");
  });

  it("이벤트 명령 AI: page scope 는 목록이 그대로임을 알린다", () => {
    const notice = eventCommandGateNotice({ message: "kind 오류", scope: "page", commandCount: 4 });
    expect(notice.headline).toContain("그대로");
    expect(notice.reasons).toEqual(["kind 오류"]);
  });

  it("평문 복사에 사유·다음 행동이 모두 들어간다", () => {
    const text = aiGateNoticeToPlainText(commitGateNotice(["참조 검증 실패: itemId 없음"]));
    expect(text).toContain("[commit-rejected]");
    expect(text).toContain("- 참조 검증 실패: itemId 없음");
    expect(text).toContain("이렇게 해 보세요:");
  });
});

describe("showAiGateNotice — 모달", () => {
  let restoreDom: () => void;

  beforeEach(() => {
    resetModalStackForTest();
    restoreDom = installFakeDom();
  });

  afterEach(() => {
    restoreDom();
    resetModalStackForTest();
  });

  it("사유·다음 행동·게이트 종류를 렌더하고 모달 스택에 등록한다", () => {
    const overlay = showAiGateNotice(commitGateNotice(["[map_a] 참조 검증 실패: itemId 없음"]));
    expect(overlay).not.toBeNull();
    const root = document.body as unknown as Parameters<typeof findByTestId>[0];
    const modal = findByTestId(root, "ai-gate-modal");
    expect(modal).not.toBeNull();
    expect(modal?.dataset.gateKind).toBe("commit-rejected");
    expect(findByTestId(root, "ai-gate-modal-reasons")?.textContent).toContain("itemId 없음");
    expect(findByTestId(root, "ai-gate-modal-steps")).not.toBeNull();
    expect(modalStackDepthForTest()).toBe(1);
  });

  it("닫기 버튼이 모달과 스택 등록을 함께 정리한다", () => {
    showAiGateNotice(turnErrorNotice({ message: "네트워크 오류" }));
    const root = document.body as unknown as Parameters<typeof findByTestId>[0];
    findByTestId(root, "ai-gate-modal-close")?.dispatchEvent(new Event("click"));
    expect(findByTestId(root, "ai-gate-modal")).toBeNull();
    expect(modalStackDepthForTest()).toBe(0);
  });

  it("두 번 띄우면 한 장만 남는다 — 뒤엣것만 닫고 앞엣것을 못 읽는 일을 막는다", () => {
    showAiGateNotice(commitGateNotice(["첫 게이트"]));
    showAiGateNotice(layoutGateNotice([{ severity: "error", code: "layout-prop-on-water", message: "둘째 게이트" }]));
    const root = document.body as unknown as Parameters<typeof findByTestId>[0];
    expect(findByTestId(root, "ai-gate-modal")?.dataset.gateKind).toBe("layout-validation");
    expect(modalStackDepthForTest()).toBe(1);
  });

  it("원문이 사유와 다를 때만 접히는 원문 영역을 만든다", () => {
    showAiGateNotice(eventCommandGateNotice({ message: "kind 오류", scope: "page", commandCount: 2 }));
    const root = document.body as unknown as Parameters<typeof findByTestId>[0];
    // page scope 는 사유 == 원문이라 중복 영역을 만들지 않는다.
    expect(findByTestId(root, "ai-gate-modal-detail")).toBeNull();
  });
});
