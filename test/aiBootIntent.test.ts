/** @vitest-environment happy-dom */
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  applyPendingAiBootIntent,
  clearPendingAiBootIntent,
  clearWelcomeIntentBootFlags,
  peekPendingAiBootAutoSend,
  peekPendingAiBootDisplayText,
  peekPendingAiBootIntent,
  prefillAiAssistantInput,
  registerAiBootIntentTarget,
  setPendingAiBootIntent,
  setPendingWelcomePipeline,
  shouldSuppressCoachMarksForWelcomeIntent,
  wasWelcomeIntentAppliedThisBoot,
} from "@/editor/aiBootIntent";

beforeEach(() => {
  clearPendingAiBootIntent();
  clearWelcomeIntentBootFlags();
  registerAiBootIntentTarget(null);
});

describe("aiBootIntent", () => {
  it("stores pending intent and suppresses coach marks", () => {
    setPendingAiBootIntent("  포켓몬 같은 몬스터 수집  ");
    expect(peekPendingAiBootIntent()).toBe("포켓몬 같은 몬스터 수집");
    expect(peekPendingAiBootAutoSend()).toBe(false);
    expect(shouldSuppressCoachMarksForWelcomeIntent()).toBe(true);
  });

  it("applies open+prefill without send by default", () => {
    const open = vi.fn();
    const prefill = vi.fn();
    const send = vi.fn();
    registerAiBootIntentTarget({ open, prefill, send });
    setPendingAiBootIntent("스타듀 같은 농장 생활");
    expect(applyPendingAiBootIntent()).toBe(true);
    expect(open).toHaveBeenCalledOnce();
    expect(prefill).toHaveBeenCalledWith("스타듀 같은 농장 생활");
    expect(send).not.toHaveBeenCalled();
    expect(peekPendingAiBootIntent()).toBeNull();
    expect(wasWelcomeIntentAppliedThisBoot()).toBe(true);
    expect(applyPendingAiBootIntent()).toBe(false);
  });

  it("auto-sends when pipeline requests autoSend", () => {
    const open = vi.fn();
    const prefill = vi.fn();
    const send = vi.fn();
    registerAiBootIntentTarget({ open, prefill, send });
    setPendingWelcomePipeline({
      prompt: "장르 프리셋: 모험 JRPG",
      autoSend: true,
      replaceWithBlank: true,
      source: "chip",
      presetId: "adventure-jrpg",
    });
    expect(peekPendingAiBootAutoSend()).toBe(true);
    expect(applyPendingAiBootIntent()).toBe(true);
    expect(send).toHaveBeenCalledWith("장르 프리셋: 모험 JRPG");
    expect(prefill).not.toHaveBeenCalled();
  });

  it("carries the visible user sentence separately from the prompt sent to the model", () => {
    // Break: 보이는 문장이 핸드오프에서 빠지면 조수 말풍선이 「사용자 의도: …」 내부 지시문으로 뜬다.
    const open = vi.fn();
    const prefill = vi.fn();
    const send = vi.fn();
    registerAiBootIntentTarget({ open, prefill, send });
    setPendingWelcomePipeline({ prompt: "사용자 의도: 고양이 찾기\n\n한국어로 진행하고…", displayText: "고양이 찾기", autoSend: true, source: "free-text" });
    expect(peekPendingAiBootDisplayText()).toBe("고양이 찾기");
    expect(applyPendingAiBootIntent()).toBe(true);
    expect(send).toHaveBeenCalledWith("사용자 의도: 고양이 찾기\n\n한국어로 진행하고…", "고양이 찾기");
    expect(peekPendingAiBootDisplayText()).toBeNull();

    // AI 연결 전: 입력창에 담기는 쪽도 같은 두 문장을 받는다.
    setPendingAiBootIntent("장르 프리셋: 모험 JRPG\n체크리스트", { displayText: "모험 JRPG · 시작 마을" });
    expect(applyPendingAiBootIntent()).toBe(true);
    expect(prefill).toHaveBeenCalledWith("장르 프리셋: 모험 JRPG\n체크리스트", "모험 JRPG · 시작 마을");

    // 쓰던 초안은 두 문장 모두의 앞에 그대로 남는다.
    const draftPrefill = vi.fn();
    registerAiBootIntentTarget({ open, prefill: draftPrefill, getDraft: () => "내 메모" });
    expect(prefillAiAssistantInput("전체 지시", { preserveDraft: true, displayText: "요약" })).toBe(true);
    expect(draftPrefill).toHaveBeenCalledWith("내 메모\n\n전체 지시", "내 메모\n\n요약");
  });

  it("prefillAiAssistantInput never sends and requires target", () => {
    expect(prefillAiAssistantInput("x")).toBe(false);
    const open = vi.fn();
    const prefill = vi.fn();
    registerAiBootIntentTarget({ open, prefill });
    expect(prefillAiAssistantInput("모험 JRPG")).toBe(true);
    expect(prefill).toHaveBeenCalledWith("모험 JRPG");
  });

  it("appends an unsent handoff without overwriting existing draft bytes", () => {
    // Given: a mounted composer with unfinished user instructions and a send hook.
    let draft = "  original instructions\n";
    const send = vi.fn();
    const open = vi.fn();
    registerAiBootIntentTarget({ open, getDraft: () => draft, prefill: text => { draft = text; }, send });
    // When: a diagnostic is explicitly prepared with draft preservation.
    expect(prefillAiAssistantInput("UNSENT", { preserveDraft: true })).toBe(true);
    // Then: both blocks remain editable and no turn was sent.
    expect(draft).toBe("  original instructions\n\n\nUNSENT");
    expect(send).not.toHaveBeenCalled();
    expect(open).toHaveBeenCalledOnce();
  });

  it("refuses preserving handoff when the target cannot read its draft", () => {
    const prefill = vi.fn();
    registerAiBootIntentTarget({ open: vi.fn(), prefill });
    expect(prefillAiAssistantInput("UNSENT", { preserveDraft: true })).toBe(false);
    expect(prefill).not.toHaveBeenCalled();
  });
  it("does not auto-apply on register (focus order owned by finishEditorBoot)", () => {
    setPendingAiBootIntent("대기", { autoSend: true });
    const open = vi.fn();
    const prefill = vi.fn();
    const send = vi.fn();
    registerAiBootIntentTarget({ open, prefill, send });
    expect(open).not.toHaveBeenCalled();
    expect(peekPendingAiBootIntent()).toBe("대기");
    applyPendingAiBootIntent();
    expect(send).toHaveBeenCalledWith("대기");
  });
});
