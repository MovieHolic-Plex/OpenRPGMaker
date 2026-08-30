// @vitest-environment happy-dom
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { createCollapsedUndoButton } from "@/editor/panels/aiDirectorChrome";

/**
 * PR #310 은 맵 위 «적용 완료» 밴드를 지우고 되돌리기를 컴포저 행으로 옮긴다. 방향은 맞지만
 * 그대로 두면 **접힌 상태에서 되돌리기에 닿을 수 없다** — 컴포저 행은 사이드·도크가 접힌 동안
 * `display: none` 이고(03-three-tier-ia.css), 접힘은 사용자가 직접 하며
 * `savePanelCollapsed` 로 새로고침을 넘어 유지된다. 삭제되는 밴드는 패널 자식이라 그 선택자에
 * 걸리지 않았으므로 이것은 이 PR 이 새로 만드는 구멍이다.
 *
 * 그래서 접힌 레일에 같은 상태로 움직이는 진입점을 둔다. 이 테스트가 그 계약을 고정한다.
 */

const CSS = readFileSync(
  resolve(__dirname, "../src/styles/database/tabs-b-assistant-panel/03-three-tier-ia.css"),
  "utf8",
);

describe("접힌 레일의 되돌리기", () => {
  it("기본은 숨김이고 aria-hidden 이 붙는다 — 되돌릴 것이 없을 때 읽히지 않는다", () => {
    const button = createCollapsedUndoButton(() => {});
    expect(button.hidden).toBe(true);
    expect(button.getAttribute("aria-hidden")).toBe("true");
  });

  it("클릭이 위임된다 — 진입점마다 동작이 갈라지지 않는다", () => {
    let calls = 0;
    const button = createCollapsedUndoButton(() => {
      calls += 1;
    });
    document.body.append(button);
    button.click();
    expect(calls).toBe(1);
  });

  it("사람이 읽는 이름이 붙는다 — 아이콘만으로는 무엇을 되돌리는지 알 수 없다", () => {
    const button = createCollapsedUndoButton(() => {});
    expect(button.getAttribute("aria-label")).toContain("되돌리기");
    expect(button.dataset.testid).toBe("ai-collapsed-undo");
  });

  // 아래 둘은 CSS 계약이다. 컴포저 행을 끄는 규칙과 짝이라 한쪽만 바뀌면 구멍이 다시 생긴다.
  it("접힘 상태에서 보인다 — 사이드와 도크 둘 다", () => {
    expect(CSS).toMatch(/\.ai-chat-panel\.chat-dock-side\.is-collapsed > \.ai-collapsed-undo/);
    expect(CSS).toMatch(/\.ai-chat-panel\.is-docked\.is-collapsed > \.ai-collapsed-undo/);
  });

  it("펼친 상태에서는 숨는다 — 컴포저 행의 것과 중복이면 어느 쪽이 무엇을 되돌리는지 모른다", () => {
    expect(CSS).toMatch(/\.ai-collapsed-undo\s*\{\s*display:\s*none;/);
  });

  it("컴포저 행을 끄는 규칙이 여전히 있다 — 이 짝이 깨지면 계약이 무의미해진다", () => {
    expect(CSS).toMatch(/\.is-collapsed > \.ai-command-bar/);
  });
});
