// test/aiMoreMenuLayout.test.ts
// ☰ 더보기 팝오버의 CSS 계약.
//
// 유래: 이 두 케이스는 `test/aiGlassPanelWidth.test.ts` 에 얹혀 있었다. 그 파일의 본론은
// 유리 카드(chat-dock-glass)의 반응형 폭이었고, 2026-08-31 에 도크 축이 삭제되면서
// 유리 카드 자체가 없어져 파일이 통째로 사라졌다. 살아남은 것은 도크와 무관한
// 액션 접기뿐이다. 대기 화면 온도 선택은 그 접기 위의 라디오와 함께 걷었다.
import { describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const COMMAND_BAR_CSS = "src/styles/database/assistant-command-bar.css";

function readCssFile(relativePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf-8");
}

describe("더보기 팝오버 레이아웃", () => {
  it("액션들을 `.ai-more-actions` 아래로 접어 팝오버가 내용에 붙게 한다", () => {
    const css = readCssFile(COMMAND_BAR_CSS);
    expect(css).toMatch(/\.ai-more-actions\s*\{/);
    expect(css).toMatch(/\.ai-more-actions-summary/);
  });
});
