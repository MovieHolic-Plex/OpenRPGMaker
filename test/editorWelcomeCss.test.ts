// happy-dom 은 CSS 를 읽지 않으므로 editorWelcome.test 의 `notice.hidden` 단언은 실제 화면을 보지 못한다.
// 실측(2026-09-23): `.editor-welcome-ai-notice { display: flex }` 가 [hidden] 을 이겨, AI 가 있어도 안내가
// 늘 떠 있었고 AI 없이 「만들기」를 눌러도 화면이 바뀌지 않았다.
import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

it("AI 안내는 hidden 일 때 실제로 숨는다", () => {
  const css = readFileSync("src/styles/shell/editor-welcome.css", "utf8");
  expect(css).toMatch(/\.editor-welcome-briefing \.editor-welcome-ai-notice\[hidden\]\s*\{\s*display:\s*none;/);
});
