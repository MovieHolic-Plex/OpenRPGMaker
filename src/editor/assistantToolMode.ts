// editor/assistantToolMode.ts
// 컨텍스트 모드 결정(2026-07-07 타일 시공 흐름 재설계 §2.2.2 — 원칙 0).
// AI 어시스턴트에 노출할 툴 집합(toOpenAiTools({mode}))의 mode를 **UI 상태에서만**
// 결정론으로 계산한다 — 모델 판단 금지. 우선순위:
//   1. DB 모달 열림           → "database"
//   2. 이벤트 에디터 열림      → "event"
//   3. 이벤트 레이어/도구 활성 → "event"
//   4. 타일 팔레트 활성(좌측 팔레트 보임 + 타일 레이어 편집) → "tile"
//   5. 판정 불가/일반          → "map" (기본, 넓게)

import { editorState } from "@/editor/editorState";
import type { ToolDomain } from "@/editor/tools";

function modalOpen(testid: string): boolean {
  if (typeof document === "undefined" || typeof document.querySelector !== "function") return false;
  return document.querySelector(`[data-testid="${testid}"]`) !== null;
}

// 좌측 타일 팔레트가 실제로 보이는가 — 접힘(leftRoot display:none) 상태면 비활성.
function tilePaletteVisible(): boolean {
  if (typeof document === "undefined" || typeof document.querySelector !== "function") return false;
  const root = document.querySelector('[data-testid="left-palette-root"]') as HTMLElement | null;
  if (!root) return false;
  const parent = root.parentElement;
  return !(parent && parent.style && parent.style.display === "none");
}

export function computeAssistantToolMode(): ToolDomain {
  if (modalOpen("database-modal")) return "database";
  if (modalOpen("event-editor-content")) return "event";
  const state = editorState.get();
  if (state.layer === "event" || state.tool === "event") return "event";
  if ((state.layer === "lower" || state.layer === "upper") && tilePaletteVisible()) return "tile";
  return "map";
}

// 모드 배지 라벨(§2.2.3) — dock 헤더가 소비한다.
export const TOOL_MODE_LABELS: Readonly<Record<ToolDomain, string>> = {
  core: "코어",
  tile: "🀫 타일",
  map: "🗺 맵",
  event: "⚑ 이벤트",
  database: "🗃 DB",
  world: "🌍 세계관",
  quest: "📜 퀘스트",
  battle: "⚔ 전투",
  system: "⚙ 시스템",
};
