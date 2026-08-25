/** @vitest-environment happy-dom */
/**
 * 맵 캔버스 커서가 선택된 도구를 반영해야 한다.
 *
 * 회귀 배경: 캔버스 셀렉터에 cursor 규칙이 하나도 없어 지금이 연필인지 채우기인지
 * 스포이드인지 커서만 봐서는 알 수 없었다. 감독은 툴바를 다시 보거나 일단 칠해 보고
 * 되돌리는 왕복을 반복했다. 실제 커서 모양은 CSS 가 갖고, 여기서는 상태 전달을 지킨다.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { editorState, type Tool } from "@/editor/editorState";
import { installToolCursor, resetToolCursorForTest } from "@/editor/toolCursor";

const TOOLS: readonly Tool[] = ["paint", "fill", "eyedropper", "pan", "select", "collision", "event"];

beforeEach(() => {
  document.body.innerHTML = "";
  resetToolCursorForTest();
  editorState.set({ tool: "paint" });
});

describe("installToolCursor", () => {
  it("설치 즉시 현재 도구를 내보낸다", () => {
    editorState.set({ tool: "fill" });
    installToolCursor();
    expect(document.body.dataset.editorTool).toBe("fill");
  });

  it("도구를 바꾸면 따라 바뀐다", () => {
    installToolCursor();
    for (const tool of TOOLS) {
      editorState.set({ tool });
      expect(document.body.dataset.editorTool, `${tool} 이 반영되지 않았다`).toBe(tool);
    }
  });

  it("도구 7종이 전부 서로 다른 값으로 나간다", () => {
    installToolCursor();
    const seen = new Set<string>();
    for (const tool of TOOLS) {
      editorState.set({ tool });
      seen.add(document.body.dataset.editorTool ?? "");
    }
    expect(seen.size).toBe(TOOLS.length);
  });

  it("두 번 설치해도 구독이 중복되지 않는다", () => {
    installToolCursor();
    installToolCursor();
    editorState.set({ tool: "pan" });
    expect(document.body.dataset.editorTool).toBe("pan");
  });

  it("도구와 무관한 상태 변경으로는 값이 흔들리지 않는다", () => {
    installToolCursor();
    editorState.set({ tool: "select" });
    editorState.set({ zoom: 2, showGrid: false });
    expect(document.body.dataset.editorTool).toBe("select");
  });
});
