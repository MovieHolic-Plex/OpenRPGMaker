// 적용 안내를 `[되돌리기](Ctrl+Z)` 로 적으면 채팅 마크다운이 http(s)가 아닌 주소를 버린다.
// 화면에 남는 문장은 「되돌리려면 되돌리기.」뿐이라, 방금 적용한 맵을 어떻게 되돌리는지 사라진다.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { AI_APPLY_UNDO_HINT } from "@/ai/piAgent/userFacingCopy";
import { renderMarkdown } from "@/util/markdown";
import { installFakeDom, renderWithFakeDom } from "./fakeDom";

let restoreDom: (() => void) | null = null;

beforeEach(() => {
  restoreDom = installFakeDom();
});

afterEach(() => {
  restoreDom?.();
  restoreDom = null;
});

function render(text: string) {
  return renderWithFakeDom(() => renderMarkdown(text));
}

describe("AI 적용 안내의 되돌리기 힌트", () => {
  it("옛 링크 문법은 단축키를 지우고 「되돌리기.」만 남긴다", () => {
    const container = render("변경 3건을 프로젝트에 적용했습니다. 되돌리려면 [되돌리기](Ctrl+Z).");

    expect(container.querySelector("a")).toBeNull();
    expect(container.textContent).toBe("변경 3건을 프로젝트에 적용했습니다. 되돌리려면 되돌리기.");
    expect(container.textContent).not.toContain("Ctrl+Z");
  });

  it("지금 안내를 채팅에 그려도 Ctrl+Z와 버튼 이름이 남는다", () => {
    const container = render(`변경 3건을 프로젝트에 적용했습니다. ${AI_APPLY_UNDO_HINT}`);

    expect(container.querySelector("a")).toBeNull();
    expect(container.textContent).toContain("Ctrl+Z");
    expect(container.textContent).toContain("「되돌리기」");
  });

  it("적용 말풍선은 링크 문법을 쓰지 않고 같은 안내를 붙인다", () => {
    const source = readFileSync(new URL("../src/editor/panels/aiProposalCard.ts", import.meta.url), "utf8");

    expect(source).not.toContain("[되돌리기](Ctrl+Z)");
    expect(source).toContain("AI_APPLY_UNDO_HINT");
  });
});
