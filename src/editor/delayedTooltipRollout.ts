// 지연 툴팁 1차 적용 대상 — **명시 목록만** 붙인다.
//
// 왜 전면 적용을 안 하는가 (OPRN-OUT-024): 글자가 이미 보이는 버튼에 툴팁을 붙이면
// 중복 소음이고, 806곳의 `title` 을 일괄 변환하면 대화 상자 제목·표 머리글까지 끌려온다.
// 대상은 "아이콘만 있어서 못 알아보는 컨트롤과 탭" 뿐이고, 새 대상은 이 표에 줄을 더해
// 넣는다. `label` 은 화면에 뜨는 짧은 말, `name` 은 스크린 리더가 듣는 완전한 이름이다.
import { attachDelayedTooltip } from "@/editor/delayedTooltip";

export type DelayedTooltipTarget = {
  readonly label: string;
  readonly name: string;
  readonly testid: string;
};

export const DELAYED_TOOLTIP_ROLLOUT: readonly DelayedTooltipTarget[] = [
  { label: "높이", name: "높이", testid: "terrain-tool-height" },
  { label: "표면", name: "표면", testid: "terrain-tool-surface" },
  { label: "강", name: "강", testid: "terrain-tool-river" },
  { label: "군집 선택", name: "군집 선택", testid: "terrain-tool-group" },
  { label: "집", name: "집", testid: "terrain-tool-house" },
  { label: "도로", name: "도로", testid: "terrain-tool-road" },
  { label: "지형지물", name: "지형지물 (D)", testid: "relief-doodad-toggle" },
  { label: "지형 설계", name: "지형 설계", testid: "terrain-design-toggle" },
  { label: "통행 보기", name: "통행 미리보기", testid: "terrain-reachability" },
  { label: "도움말", name: "지형 도움말", testid: "terrain-help-toggle" },
  { label: "윗면 풀", name: "윗면을 풀로 덮기", testid: "relief-top-grass" },
  { label: "군집 옮기기", name: "군집 옮기기", testid: "terrain-group-move" },
  { label: "군집 지우기", name: "군집 지우기", testid: "terrain-group-delete" },
  { label: "올리기", name: "올리기", testid: "relief-mode-raise" },
  { label: "내리기", name: "내리기", testid: "relief-mode-lower" },
  { label: "평탄", name: "평탄", testid: "relief-mode-flatten" },
  { label: "단 지정", name: "단 지정", testid: "relief-mode-set" },
  { label: "산", name: "산", testid: "relief-mode-mountain" },
  { label: "골짜기", name: "골짜기", testid: "relief-mode-canyon" },
  { label: "다듬기", name: "다듬기", testid: "relief-mode-smooth" },
  { label: "거칠게", name: "거칠게", testid: "relief-mode-rough" },
  // 사이드바 탭(맵·그리기·AI)은 글자가 보이므로 넣지 않는다 — 접힌 레일에서만 title 로 이름을 보인다.
  { label: "사이드바", name: "왼쪽 패널 가리기/보이기", testid: "sidebar-collapse" },
  { label: "걷기 전투", name: "걸을 때 적 만나기 설정", testid: "walk-encounter-list-open" },
  { label: "구역 그리기", name: "구역 그리기 켜기/끄기", testid: "map-location-layer-toggle" },
  { label: "배경 보기", name: "맵 배경 미리보기 켜기/끄기", testid: "map-background-preview-toggle" },
  { label: "만들기", name: "선택 영역에 집·길·NPC 만들기", testid: "canvas-ai-create" },
  { label: "다듬기", name: "선택 영역 다듬기", testid: "canvas-ai-polish" },
  { label: "검사", name: "맵 통행·참조·이벤트 검사", testid: "canvas-ai-inspect" },
  { label: "AI 요청", name: "선택 영역이나 현재 맵에 AI 요청", testid: "canvas-ai-ask" },
  { label: "AI 실행", name: "이 영역에 AI 지시 실행 (Enter) — 비어 있으면 AI 작업 창", testid: "selection-chip-ai" },
  { label: "다듬기", name: "다듬기 — 주변과 어울리게 AI가 다시 짜기", testid: "selection-chip-polish" },
  { label: "복사", name: "선택 영역 복사 (Ctrl+C)", testid: "selection-chip-copy" },
  { label: "붙여넣기", name: "클립보드 붙여넣기 (Ctrl+V)", testid: "selection-chip-paste" },
  { label: "지우기", name: "선택 영역 지우기 (Del)", testid: "selection-chip-clear" },
  { label: "걷기 전투", name: "이 영역에서 걸을 때 적 만나기", testid: "selection-chip-walk-encounter" },
  { label: "구조물 저장", name: "선택 영역을 이 맵 타일셋의 구조물 킷으로 저장", testid: "selection-chip-save-structure" },
  { label: "선택 해제", name: "선택 해제 (Esc)", testid: "selection-chip-dismiss" },
  { label: "맵 저장", name: "현재 맵만 PNG로 저장", testid: "editor-map-screenshot-button" },
  { label: "저장 도구", name: "맵 저장 도구 펼치기/접기", testid: "editor-canvas-toolbar-expand" },
  { label: "저장", name: "프로젝트 저장 (Ctrl+S)", testid: "toolbar-save" },
  { label: "명령 팔레트", name: "명령 팔레트 — 명령 실행 · 맵 이동 (Ctrl+K)", testid: "workspace-command-palette-button" },
  { label: "스튜디오", name: "AI 스튜디오 — 장면 모니터와 조수", testid: "topbar-ai-studio" },
  { label: "AI 설정", name: "AI 설정 열기", testid: "topbar-ai-settings" },
  { label: "전체화면", name: "전체화면 전환", testid: "window-fullscreen" },
  { label: "새 대화", name: "새 대화 시작", testid: "ai-new-chat" },
  { label: "명령 메뉴", name: "조수 명령 메뉴 열기", testid: "ai-command-menu-toggle" },
  { label: "중단", name: "실행 중인 조수 작업 중단", testid: "ai-abort" },
  { label: "모두", name: "레이어 필터: 모든 타일", testid: "tileset-layer-filter-all" },
  { label: "바닥", name: "레이어 필터: 바닥(하위) 타일만", testid: "tileset-layer-filter-lower" },
  { label: "상위", name: "레이어 필터: 상위 타일만", testid: "tileset-layer-filter-upper" },
  { label: "자동", name: "레이어 자동 판정에 맡기기", testid: "tileset-layer-auto" },
  { label: "하위 고정", name: "이 타일의 홈 레이어를 하위로 확정", testid: "tileset-layer-lower" },
  { label: "상위 고정", name: "이 타일의 홈 레이어를 상위로 확정", testid: "tileset-layer-upper" },
];

const ATTACHED_FLAG = "delayedTooltipAttached";

/**
 * 목록에 있는 컨트롤에 툴팁을 붙인다. 같은 노드에 두 번 붙지 않으므로 렌더마다 불러도 된다.
 * 반환값은 이번 호출에서 새로 붙인 개수 — 롤아웃이 실제로 걸렸는지 테스트가 이 수를 본다.
 */
export function installDelayedTooltips(root: ParentNode): number {
  let attached = 0;
  for (const target of DELAYED_TOOLTIP_ROLLOUT) {
    const nodes = root.querySelectorAll<HTMLElement>(`[data-testid="${target.testid}"]`);
    for (const node of nodes) {
      if (node.dataset[ATTACHED_FLAG] === "1") continue;
      node.dataset[ATTACHED_FLAG] = "1";
      attachDelayedTooltip(node, { accessibleName: target.name, label: target.label });
      attached += 1;
    }
  }
  return attached;
}
