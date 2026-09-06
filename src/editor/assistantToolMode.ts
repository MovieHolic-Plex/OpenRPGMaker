// editor/assistantToolMode.ts
// 컨텍스트 모드 결정(2026-07-07 타일 시공 흐름 재설계 §2.2.2 — 원칙 0).
// AI 어시스턴트에 노출할 툴 집합(toOpenAiTools({mode}))의 mode를 **UI 상태에서만**
// 결정론으로 계산한다 — 모델 판단 금지. 우선순위:
//   1. DB 모달 열림           → "database"
//   2. 이벤트 에디터 열림      → "event"
//   3. 이벤트 레이어/도구 활성 → "event"
//   4. 타일 팔레트 활성(좌측 팔레트 보임 + 타일 레이어 편집) → "tile"
//   5. 판정 불가/일반          → "map" (기본, 넓게)
//
// 활성 도메인 = 코어 + UI 도메인 + **의도 선언이 여는 도메인** + 최근 쓴 툴의 도메인.
// 예전에는 여기 221개 키워드 표(INTENT_KEYWORDS)가 사용자 문장을 substring 으로 훑어 도메인을 열었다 —
// 「낮게」가 시간 시스템을, 「적게」가 전투·DB 를, 「이 지역에」가 월드 그래프를 열었다(2026-09-03 감사).
// 이제 문장은 모델이 한 번 읽어 선언하고(intentDeclaration), 이 모듈은 선언 필드를 도메인으로 옮기기만 한다.

import { type IntentDeclaration } from "@/ai/intentDeclaration";
import { editorState } from "@/editor/editorState";
import type { ToolDomain } from "@/editor/tools";
import { computeActiveToolDomains as computeDomains } from "@/ai/toolDomainState";
export * from "@/ai/toolDomainState";

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
  if (typeof document === "undefined") return "map";
  if (modalOpen("database-modal")) return "database";
  if (modalOpen("event-editor-content")) return "event";
  const state = editorState.get();
  if (state.layer === "event" || state.tool === "event") return "event";
  if ((state.layer === "lower" || state.layer === "upper") && tilePaletteVisible()) return "tile";
  return "map";
}

export function computeActiveToolDomains(intent: IntentDeclaration | null): Set<ToolDomain> {
  return computeDomains(intent, computeAssistantToolMode());
}
