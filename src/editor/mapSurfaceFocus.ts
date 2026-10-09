// editor/mapSurfaceFocus.ts
// 맵 캔버스를 누르면 키보드 소유권을 캔버스로 되돌린다.
//
// 왜 필요한가(실측 2026-08-27): Phaser 캔버스는 포커스를 받지 않는다. 어시스턴트 입력창이나
// 타일 검색창에 한 번 포커스가 들어가면 맵을 칠해도 activeElement 가 그 텍스트 필드로 남고,
// 그 뒤의 Ctrl+Z 는 맵이 아니라 그 텍스트를 되돌린다(프롬프트 "마을에 길 하나" → "마을에 길 하",
// 맵은 그대로). 텍스트 필드 포커스 중 브라우저 텍스트 undo 를 양보하는 규칙(hotkeys.ts) 자체는
// 맞지만, 캔버스를 누른 뒤에는 그 필드가 더 이상 키보드 주인이 아니어야 한다.

import { isTextEditingElement } from "@/editor/hotkeys";

/** 텍스트 필드나 탐색 키 소유 영역(자식 포함)의 포커스를 반납한다. 반납했으면 true. */
export function releaseTextEntryFocus(): boolean {
  if (typeof document === "undefined") return false;
  const active = document.activeElement;
  if (!isTextEditingElement(active) && !active?.closest('[data-editor-navigation-owner="true"]')) return false;
  (active as HTMLElement).blur?.();
  return true;
}

/** 맵 표면(캔버스 host)의 포인터 누름을 키보드 소유권 이전으로 취급한다. */
export function bindMapSurfaceFocusHandoff(host: HTMLElement): void {
  host.addEventListener("pointerdown", () => void releaseTextEntryFocus(), true);
}
