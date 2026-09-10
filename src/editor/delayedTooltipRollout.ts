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
  { label: "덧그림", name: "레이어 필터: 덧그림(상위) 타일만", testid: "tileset-layer-filter-upper" },
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
