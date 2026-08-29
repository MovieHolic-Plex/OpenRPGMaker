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
