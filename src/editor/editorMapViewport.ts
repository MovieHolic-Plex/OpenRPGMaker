// 에디터 맵 카메라 뷰포트 스냅샷 — AI 어시스턴트가 매 턴 읽어 "지금 보는 곳"을 안다.
// EditScene이 갱신하고, aiChatPanel / AssistantSession이 읽는다(Phaser 비의존 소비자).

import type { MapViewportSnapshot } from "@/ai/mapViewportContext";

let current: MapViewportSnapshot | null = null;

export function setEditorMapViewport(snapshot: MapViewportSnapshot | null): void {
  current = snapshot;
}

export function getEditorMapViewport(): MapViewportSnapshot | null {
  return current;
}
