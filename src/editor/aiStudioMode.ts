// 스튜디오 모드 진입점 — 톱바 버튼과 조수 패널이 같은 토글을 쓴다.
//
// 패널이 숨은 `ai-studio-toggle` 훅을 소유한다. 톱바는 그 훅을 누르고, 패널은
// 켜짐/꺼짐을 `oprn:ai-studio-change` 로 알려 헤더 단추의 pressed 상태를 맞춘다.

import { STUDIO_MODE_KEY } from "@/editor/panels/aiChatPanelHelpers";

export const AI_STUDIO_TOGGLE_EVENT = "oprn:ai-studio-toggle";
export const AI_STUDIO_CHANGE_EVENT = "oprn:ai-studio-change";

export function readStudioMode(): boolean {
  return typeof localStorage !== "undefined" && localStorage.getItem(STUDIO_MODE_KEY) === "1";
}

export function requestAiStudioToggle(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(AI_STUDIO_TOGGLE_EVENT));
}

export function publishAiStudioChange(open: boolean): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(AI_STUDIO_CHANGE_EVENT, { detail: { open } }));
}
