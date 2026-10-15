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
import { deckIcon } from "./aiDeckIcons";
import type { DeckState } from "./aiDeckRail";

const DIRECTOR_NAME = "조수";

/**
 * 접힘 알약. 점 + 「조수」 + 상태 문장 + 확인 필요 개수.
 *
 * 데크(2026-09-03): 접어 둔 동안에도 진행·확인 필요·완료·오류가 보여야 한다 — 이전에는
 * `is-turn-running` 에서만 점이 켜져 승인 대기가 접힘 뒤로 사라졌다. 상태는 데크 레일과
 * 같은 `data-ai-state` 다섯 값이고 패널이 `setRestoreButtonState` 로 밀어넣는다.
 */
export function createDirectorRestoreButton(): HTMLButtonElement {
  return el("button", {
    class: "ai-collapsed-restore",
    attrs: {
      type: "button",
      title: "조수 열기",
      "aria-label": DIRECTOR_NAME,
    },
    dataset: { testid: "ai-collapsed-restore", aiState: "idle" },
    children: [
      el("span", { class: "ai-collapsed-restore-dot", attrs: { "aria-hidden": "true" } }),
      el("span", { class: "ai-collapsed-restore-name", text: DIRECTOR_NAME }),
      el("span", { class: "ai-collapsed-restore-state", dataset: { testid: "ai-collapsed-restore-state" } }),
      el("span", {
        class: "ai-collapsed-restore-count",
        attrs: { hidden: "" },
        dataset: { testid: "ai-collapsed-restore-count" },
      }),
      // 접힌 채 돌고 있는 AI 작업 수 + 가장 급한 상태(확인 필요 > 실패 > 진행). 일이 둘 이상일 때만 보인다.
      el("span", {
        class: "ai-collapsed-restore-jobs",
        attrs: { hidden: "", "aria-hidden": "true" },
        dataset: { testid: "ai-collapsed-restore-jobs" },
      }),
    ],
  }) as HTMLButtonElement;
}

/** 알약의 상태 점·문장·개수 배지를 한 번에 갱신한다. 유휴에서는 문장을 비운다. */
export function setRestoreButtonState(
  button: HTMLElement,
  state: DeckState,
  label: string,
  pendingCount: number,
): void {
  button.dataset.aiState = state;
  const stateNode = button.querySelector<HTMLElement>(".ai-collapsed-restore-state");
  if (stateNode) stateNode.textContent = state === "idle" ? "" : label;
  const countNode = button.querySelector<HTMLElement>(".ai-collapsed-restore-count");
  if (countNode) {
    countNode.hidden = pendingCount <= 0;
    countNode.textContent = pendingCount > 0 ? String(pendingCount) : "";
  }
}

/**
 * 접힌 레일의 「몇 개 · 가장 급한 것」 배지. 접힌 도크는 지도 아래 줄이 열린 도크의 대화 카드를 대신하지만, 줄이 가려지는 폭에서도
 * 레일은 늘 보인다 — 일이 둘 이상이면 개수를, 확인·실패가 있으면 그 수를 앞세운다(2026-10-16: 드래그 영역·팀 레인이 「조수 하나」로 보이던 문제).
 * 읽는 원천은 aiPresence 요약 하나다. 숫자만 쓰므로 번역이 필요 없다(자세한 문장은 열린 뒤 상태 줄이 말한다).
 */
export function setRestoreJobs(
  button: HTMLElement,
  summary: { readonly total: number; readonly review: number; readonly failed: number; readonly running: number; readonly top: "review" | "failed" | "running" | null },
): void {
  const node = button.querySelector<HTMLElement>(".ai-collapsed-restore-jobs");
  if (!node) return;
  const urgent = summary.review + summary.failed;
  const show = summary.total >= 2 || urgent > 0;
  node.hidden = !show;
  node.textContent = show ? String(urgent > 0 ? urgent : summary.total) : "";
  node.dataset.top = summary.top ?? "";
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
    children: [deckIcon("undo")],
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
