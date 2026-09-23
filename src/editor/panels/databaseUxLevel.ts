// editor/panels/databaseUxLevel.ts
//
// 자료집 화면의 칸을 편집기 모드(초보·표준·전문가)에 따라 보이거나 숨긴다.
// 숨기는 건 CSS 가 한다(`database/modern/monster-ux.css`) — body 의 `editor-ui-*` 클래스를 보므로
// 모드를 바꾸면 다시 그리지 않아도 바로 반영된다. 칸은 DOM 에 그대로 남으므로 testid·저장 경로는 그대로다.
//
// - "advanced": 표준·전문가에서만 보인다(초보에게는 숨김).
// - "expert":   전문가에서만 보인다.
// - "guide":    초보·표준에서만 보인다(채울 순서 같은 안내 — 전문가에게는 숨김).
import { getEditorUiMode } from "@/editor/editorUiMode";

export type DatabaseUxLevel = "advanced" | "expert" | "guide";

export function uxLevel<T extends HTMLElement>(node: T, level: DatabaseUxLevel): T {
  node.dataset.dbUx = level;
  return node;
}

/** 글자 자체를 모드에 따라 바꿔야 할 때(숫자 대신 말 등). 칸을 숨길 때는 `uxLevel` 을 쓴다. */
export function isDatabaseUxVisible(level: DatabaseUxLevel): boolean {
  const mode = getEditorUiMode();
  if (level === "advanced") return mode !== "beginner";
  if (level === "guide") return mode !== "expert";
  return mode === "expert";
}
