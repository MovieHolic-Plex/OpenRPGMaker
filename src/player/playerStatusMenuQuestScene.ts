// player/playerStatusMenuQuestScene.ts
// 임무(퀘스트 로그) 함수 화면. project.quests + 세션 상태를 buildQuestLog로 계산해 목록/단계를 표시한다.
// 읽기 전용(renderStatusScene와 동일한 classicScene 관례).

import { buildQuestLog, questStateLabel, type QuestLogEntry } from "@/player/questLog";
import { classicScene, classicWindow, descriptionStrip } from "@/player/playerStatusMenuClassicDom";
import type { StatusMenuFunctionSceneOptions } from "@/player/playerStatusMenuFunctionTypes";
import { el } from "@/util/dom";

export function renderQuestScene(options: StatusMenuFunctionSceneOptions): HTMLElement {
  const quests = buildQuestLog(options.project, options.session);
  if (quests.length === 0) {
    return classicScene({
      commandId: "quests",
      title: "임무",
      testId: "status-menu-classic-quests",
      className: "status-menu-classic-quests-scene",
      children: [descriptionStrip("등록된 임무가 없습니다.")],
    });
  }
  return classicScene({
    commandId: "quests",
    title: "임무",
    testId: "status-menu-classic-quests",
    className: "status-menu-classic-quests-scene",
    children: quests.map((quest) => questWindow(quest)),
  });
}

function questWindow(quest: QuestLogEntry): HTMLElement {
  return classicWindow(
    "status-menu-classic-quest",
    [
      el("div", {
        class: "status-menu-quest-header",
        dataset: { testid: `status-menu-quest-${quest.key}` },
        children: [
          el("span", { class: "status-menu-quest-title", text: quest.title }),
          el("span", {
            class: `status-menu-quest-state status-menu-quest-state-${quest.state}`,
            text: `${questStateLabel(quest.state)} (${quest.completedSteps}/${quest.totalSteps})`,
            dataset: { testid: `status-menu-quest-state-${quest.key}` },
          }),
        ],
      }),
      el("div", { class: "status-menu-quest-summary", text: quest.summary }),
      el("ul", {
        class: "status-menu-quest-steps",
        children: quest.steps.map((step) =>
          el("li", {
            class: `status-menu-quest-step ${step.done ? "done" : "pending"}`,
            text: `${step.done ? "✓" : "•"} ${step.label}`,
            dataset: { testid: `status-menu-quest-step-${quest.key}-${step.index}` },
          })
        ),
      }),
    ],
    `status-menu-quest-window-${quest.key}`
  );
}
