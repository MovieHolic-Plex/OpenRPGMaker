// [선택지] 칩이 대화 본문 칸을 0px 로 밀어내던 결함의 CSS 계약 (2026-08-30).
//
// 실측(verify-shots/ai-panel-clip/reachability, side 도크 1280x800): 마지막 답변의
// `.ai-command-row-body` 가 rect 0×485 로 눌려, 답이 열 오른쪽 끝에서 **한 글자씩 세로로**
// 쓰이고 있었다. 프리픽스 칸은 반대로 358px 까지 벌어져 있었다.
//
// 원인: `.ai-command-row` 은 `grid-template-columns: auto minmax(0, 1fr)` 두 칸 그리드인데,
// `renderQuickReplies` 가 칩 상자를 **본문의 형제로** 그 줄 안에 꽂는다(`lastAssistant.after`).
// 배치 규칙이 없으면 칩이 1열(프리픽스 칸)로 자동 배치되고, 칩 폭이 그 칸을 벌려 본문 칸
// (`minmax(0, 1fr)`)이 0 으로 눌린다. 같은 줄에 꽂히는 `.ai-command-attachment` 는 예전부터
// `grid-column: 2` 를 갖고 있었다 — 칩만 짝을 안 달고 들어온 것이다.
//
// 브라우저 레이아웃 결과라 fakeDom 으로는 못 잡는다. CSS 원문을 읽어 잠근다
// (선례: test/aiTurnGroupSquash.test.ts, test/aiGlassPanelWidth.test.ts).
// E2E 는 test/e2e/ai-panel-reachability.spec.ts 의 "본문 눌림" 판정이 같은 계약을 지킨다.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const BUBBLES_CSS = "src/styles/database/tabs-b-assistant-panel/04-chat-bubbles-proposals.css";
const PANEL_TS = "src/editor/panels/aiChatPanel.ts";

function read(relativePath: string): string {
  return readFileSync(path.resolve(process.cwd(), relativePath), "utf-8");
}

function ruleBody(css: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const match = css.match(new RegExp(`(?:^|\\})\\s*${escaped}\\s*\\{([^}]*)\\}`, "mu"));
  return match?.[1] ?? "";
}

describe("커맨드 줄 안에 꽂히는 상자는 그리드 배치를 명시한다", () => {
  it(".ai-quick-replies 는 두 칸을 다 쓴다 — 1열로 자동 배치되면 본문 칸이 0px 로 눌린다", () => {
    const body = ruleBody(read(BUBBLES_CSS), ".ai-command-row > .ai-quick-replies");
    expect(body).not.toBe("");
    expect(body).toMatch(/grid-column:\s*1\s*\/\s*-1/u);
  });

  it(".ai-command-row 는 여전히 auto + minmax(0, 1fr) 두 칸이다 — 이 전제가 깨지면 위 규칙의 이유가 사라진다", () => {
    const body = ruleBody(read(BUBBLES_CSS), ".ai-command-row");
    expect(body).toMatch(/display:\s*grid/u);
    expect(body).toMatch(/grid-template-columns:\s*auto\s+minmax\(0,\s*1fr\)/u);
  });

  it("칩은 여전히 마지막 답변 줄 안에 꽂힌다 — 줄 밖으로 옮기면 위 규칙이 아니라 DOM 이 계약이다", () => {
    expect(read(PANEL_TS)).toMatch(/lastAssistant\.after\(chipsHost\)/u);
  });
});
