// editor/toolCursor.ts
// 선택된 도구를 body 의 data 속성으로 내보내 맵 캔버스 커서가 도구를 반영하게 한다.
//
// 왜 필요한가: 맵 캔버스(.phaser-container / [data-testid="edit-canvas"])에 cursor 규칙이
// 하나도 없어서, 지금이 연필인지 채우기인지 스포이드인지 선택인지 커서만 봐서는 알 수 없었다.
// 감독은 툴바를 다시 쳐다보거나 일단 칠해 보고 Ctrl+Z 하는 왕복을 반복했다.
// 저장소 전체에서 crosshair 를 쓰는 4곳은 전부 칩셋/팔레트 셀이지 캔버스가 아니다.
//
// 실제 커서 매핑은 CSS(editor/core.part-1.css)가 갖는다 — 여기서는 상태만 흘린다.
import { editorState, type Tool } from "@/editor/editorState";

let installed = false;
let lastTool: Tool | null = null;

function applyTool(tool: Tool): void {
  if (typeof document === "undefined" || !document.body) return;
  if (tool === lastTool) return;
  lastTool = tool;
  document.body.dataset.editorTool = tool;
}

/** 에디터 부팅 시 1회 설치. 도구가 바뀔 때만 DOM 을 건드린다. */
export function installToolCursor(): void {
  if (installed) return;
  installed = true;
  applyTool(editorState.get().tool);
  editorState.subscribe((state) => applyTool(state.tool));
}

/** 테스트 헬퍼: 모듈 상태 초기화. */
export function resetToolCursorForTest(): void {
  installed = false;
  lastTool = null;
  if (typeof document !== "undefined" && document.body) delete document.body.dataset.editorTool;
}
