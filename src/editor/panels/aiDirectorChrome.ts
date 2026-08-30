// 감독 크롬 — 접힌 조수를 되살리는 복귀 버튼 하나뿐이다.
//
// 2026-08-28 감독 지시로 **얼굴과 헤더를 폐기**했다. 이전에는 여기서 48px 페이스셋
// (easyrpg-faceset-actor1-00) 을 잘라 헤더 명패(`.ai-director-plate` = 얼굴 + "조수" +
// 존재 줄)와 복귀 버튼 양쪽에 심었다. 실측(verify-shots/assistant-glass/before/metrics.json):
// 헤더가 518×73px 을 먹으면서 그 안의 48px 얼굴판이 패널 높이 620px 의 12% 를 크롬으로
// 가져갔고, 그 크롬이 담은 실기능은 ☰ 와 ▾ 단 두 개였다. 조수는 이제 얼굴 없이
// 헤더 없는 유리면 하나로 간다.
//
// 복귀 버튼에 이름을 남기는 이유: 접힌 상태에서 이것이 유일한 펼치기 타깃이라
// 라벨이 없으면 무엇을 여는 점인지 알 수 없다. 얼굴이 아니라 글자다.

import { el } from "@/util/dom";

const DIRECTOR_NAME = "조수";

export function createDirectorRestoreButton(): HTMLButtonElement {
  return el("button", {
    class: "ai-collapsed-restore",
    attrs: {
      type: "button",
      title: "조수 열기",
      "aria-label": DIRECTOR_NAME,
    },
    dataset: { testid: "ai-collapsed-restore" },
    children: [
      el("span", { class: "ai-collapsed-restore-dot", attrs: { "aria-hidden": "true" } }),
      el("span", { class: "ai-collapsed-restore-name", text: DIRECTOR_NAME }),
    ],
  }) as HTMLButtonElement;
}

/**
 * 접힌 레일에 달리는 «되돌리기».
 *
 * 맵 위 밴드를 지우면 컴포저 행이 유일한 AI 되돌리기 표면이 되는데, 그 행은 사이드·도크가
 * 접힌 동안 `display: none` 이다(`03-three-tier-ia.css` 의 `.is-collapsed > .ai-command-bar`).
 * 사용자가 직접 접고(`toggleCollapsed`) 그 상태는 `savePanelCollapsed` 로 새로고침을 넘어
 * 유지되므로, 레일을 접어 둔 채 캔버스·지역 작업 경로로 적용하는 사용자는 AI 되돌리기 수단이
 * 아예 없어진다. 삭제되는 밴드는 패널 자식이라 그 선택자에 걸리지 않았으니 새로 생기는 구멍이다.
 *
 * 상태를 새로 들지 않는다 — 컴포저 버튼과 같은 refreshUndoApplied 가 둘을 함께 여닫고 클릭은
 * 같은 undoLastButton 으로 위임한다. 진입점마다 동작이 갈라지면 배지("되돌림")와 시스템
 * 말풍선이 어긋난다.
 */
export function createCollapsedUndoButton(onUndo: () => void): HTMLButtonElement {
  return el("button", {
    class: "ai-collapsed-undo",
    text: "↶",
    attrs: {
      type: "button",
      hidden: "",
      "aria-hidden": "true",
      title: "방금 적용한 AI 변경 되돌리기",
      "aria-label": "방금 적용한 AI 변경 되돌리기",
    },
    dataset: { testid: "ai-collapsed-undo" },
    on: { click: onUndo },
  }) as HTMLButtonElement;
}
