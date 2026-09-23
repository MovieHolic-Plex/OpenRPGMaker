import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// 2026-09-23 도그푸딩: 인터뷰 창·조수 대화에서 한국어가 음절 사이로 끊겼다
// (「바꿀 수 있어/요.」·「등대지/기」·「보스/와 귀환까지」). 기본 word-break 와 break-word 는
// 한글 음절 사이를 줄바꿈 기회로 본다. 이 표면들은 keep-all 을 유지해야 한다.
const rule = (path: string, selector: string): string => {
  const css = readFileSync(path, "utf8");
  const start = css.indexOf(`${selector} {`);
  expect(start, `${selector} in ${path}`).toBeGreaterThanOrEqual(0);
  return css.slice(start, css.indexOf("}", start));
};

describe("한국어 줄바꿈은 어절 경계에서만", () => {
  it.each([
    ["src/styles/shell/dialogs/project-interview.css", ".project-interview-window"],
    ["src/styles/database/tabs-b-assistant-panel/18-assistant-deck.css", ".ai-chat-panel.is-left-sidebar:not(.is-studio)"],
    ["src/styles/database/tabs-b-assistant-panel/04-chat-bubbles-proposals.css", ".ai-command-row-body"],
    ["src/styles/database/tabs-b-assistant-panel/04-chat-bubbles-proposals.css", ".ai-chat-bubble"],
  ])("%s %s", (path, selector) => {
    const body = rule(path, selector);
    expect(body).toMatch(/word-break:\s*keep-all/);
    expect(body).not.toMatch(/word-break:\s*break-word/);
  });
});
