/** @vitest-environment happy-dom */
/**
 * 맵 캔버스 커서가 선택된 도구를 반영해야 한다.
 *
 * 회귀 배경: 실측(Chromium 1440x900) 에서 erase 는 core.part-1.css 에 매핑이 아예 없어
 * default 로 떨어졌고 — 도구를 안 고른 상태와 같은 커서였다 — select 는 paint 와 바이트 단위로
 * 같은 crosshair 여서 클릭이 타일을 칠하는지 영역만 표시하는지 커서가 답하지 못했다.
 * 예전 테스트는 "값 7종이 서로 다르다"를 body.dataset 으로 확인했는데, 그건 방금 자기가 넣은
 * 도구 이름을 다시 읽는 동어반복이라 CSS 가 어떻든 통과했다. 그래서 여기서는 상태 전달과
 * 별개로 스타일시트 텍스트를 직접 읽어 도구→커서 표를 고정한다.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { editorState, type Tool } from "@/editor/editorState";
import { installToolCursor, resetToolCursorForTest } from "@/editor/toolCursor";

const TOOLS: readonly Tool[] = ["paint", "fill", "eyedropper", "pan", "select", "erase", "collision", "event"];

const EDITOR_CORE_CSS = resolve(__dirname, "..", "src", "styles", "editor", "core.part-1.css");
const EDITOR_STATE_TS = resolve(__dirname, "..", "src", "editor", "editorState.ts");

/** editorState.ts 의 `export type Tool = "a" | "b";` 유니온을 소스에서 그대로 읽는다. */
function declaredTools(): string[] {
  const src = readFileSync(EDITOR_STATE_TS, "utf8");
  const decl = /export type Tool =([^;]+);/.exec(src);
  if (!decl) throw new Error("editorState.ts 에서 Tool 유니온 선언을 찾지 못했다");
  return [...decl[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
}

/** core.part-1.css 의 body[data-editor-tool="X"] { --editor-tool-cursor: Y } 표를 추출한다. */
function cursorTable(): Map<string, string> {
  const css = readFileSync(EDITOR_CORE_CSS, "utf8");
  const table = new Map<string, string>();
  const re = /body\[data-editor-tool="([^"]+)"\]\s*\{\s*--editor-tool-cursor:\s*([^;}]+?)\s*;?\s*\}/g;
  for (const m of css.matchAll(re)) table.set(m[1], m[2]);
  return table;
}

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

describe("core.part-1.css 도구별 커서 표", () => {
  it("Tool 유니온의 모든 도구에 매핑이 있다", () => {
    const table = cursorTable();
    const missing = declaredTools().filter((tool) => !table.has(tool));
    expect(missing, `커서 매핑이 없는 도구: ${missing.join(", ")}`).toEqual([]);
  });

  it("어떤 도구도 default 로 떨어지지 않는다", () => {
    const fallback = [...cursorTable()].filter(([, value]) => value === "default").map(([tool]) => tool);
    expect(fallback, `default 커서를 쓰는 도구: ${fallback.join(", ")}`).toEqual([]);
  });

  it("도구별 커서 값이 전부 서로 다르다", () => {
    const table = cursorTable();
    const byValue = new Map<string, string[]>();
    for (const [tool, value] of table) byValue.set(value, [...(byValue.get(value) ?? []), tool]);
    const collisions = [...byValue].filter(([, tools]) => tools.length > 1).map(([value, tools]) => `${tools.join("+")}=${value}`);
    expect(collisions, `같은 커서를 공유하는 도구: ${collisions.join(", ")}`).toEqual([]);
    expect(table.size).toBe(declaredTools().length);
  });
});
