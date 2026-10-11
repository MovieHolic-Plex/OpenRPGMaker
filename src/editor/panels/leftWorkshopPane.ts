// src/editor/panels/leftWorkshopPane.ts
import "@/styles/database/workshop/index.css";
/**
 * 왼쪽 활동 막대 「공방」: 이 프로젝트에서 쓸 수 있는 하네스(레지스트리 workshopHarnesses)와 진행 중인 판 수.
 * 누르면 큰 화면(오버레이)을 연다. 모델 연결이 안 됐으면 AI 설정으로 가는 버튼만 보인다.
 */
import { workshopHarnesses } from "@/harnesses/_core/registry";
import { openAiSettingsModal } from "@/editor/panels/aiSettingsModal";
import { WORKSHOP_MODEL_ADVICE, workshopAiReady } from "@/editor/workshop/chat";
import { peekWorkshopSession, WORKSHOP_CHANGED_EVENT } from "@/editor/workshop/workshopSession";
import { itemState } from "@/editor/workshop/workshopStatus";
import { openWorkshop } from "@/editor/workshop/workshopWorkspace";
import { store } from "@/project/store";
import { clearChildren, el } from "@/util/dom";

export function createLeftWorkshopPane(): { root: HTMLElement; show(): void; dispose(): void } {
  const root = el("section", { class: "left-workshop-pane", attrs: { "aria-label": "공방" }, dataset: { testid: "left-workshop-pane" } });
  const render = (): void => {
    if (root.hidden) return;
    clearChildren(root);
    root.append(
      el("h2", { class: "left-workshop-title", text: "공방" }),
      el("p", { class: "left-workshop-lead", text: "공방은 AI에게 새 도트 후보를 만들게 하고, 마음에 드는 한 장을 직접 골라 프로젝트에 넣는 곳입니다." }),
      el("ul", {
        class: "left-workshop-guide",
        children: [
          el("li", { children: [el("strong", { text: "만들기" }), el("span", { text: " 실내 가구·맵 기물 후보를 여러 장 만듭니다." })] }),
          el("li", { children: [el("strong", { text: "고르기" }), el("span", { text: " 결과를 비교하고 사용할 한 장을 고릅니다." })] }),
          el("li", { children: [el("strong", { text: "넣기" }), el("span", { text: " 고른 그림을 이 프로젝트의 칩셋에 굽습니다." })] }),
        ],
      }),
      el("p", { class: "left-workshop-lead", dataset: { testid: "left-workshop-model-advice" }, text: WORKSHOP_MODEL_ADVICE }),
    );
    const aiReady = workshopAiReady();
    const harnesses = workshopHarnesses(store.getCurrent().system.genre ?? null);
    if (harnesses.length === 0) {
      root.append(el("p", { class: "left-workshop-empty", text: "이 프로젝트에서 쓸 수 있는 공방이 아직 없습니다." }));
      return;
    }
    root.append(el("ul", {
      class: "left-workshop-list",
      children: harnesses.map((harness) => {
        const session = peekWorkshopSession(harness.id);
        const items = session?.items() ?? [];
        const drawing = items.filter((item) => itemState(item.key, session!.rounds, session!.picks) === "drawing").length;
        const choose = items.filter((item) => itemState(item.key, session!.rounds, session!.picks) === "choose").length;
        return el("li", {
          children: [el("button", {
            class: "left-workshop-open", attrs: { type: "button" }, dataset: { testid: `left-workshop-open-${harness.id}` },
            on: { click: () => { void openWorkshop(harness.id); } },
            children: [
              el("strong", { text: harness.title }),
              el("span", { class: "left-workshop-description", text: harness.summary }),
              el("span", { class: "left-workshop-meta", text: session ? `그리는 중 ${drawing} · 고를 차례 ${choose}` : "후보 만들기 시작" }),
            ],
          })],
        });
      }),
    }));
    if (!aiReady) {
      root.append(
        el("p", { class: "left-workshop-empty", text: "후보를 만들려면 AI 연결이 필요합니다. 먼저 만들 수 있는 공방을 둘러볼 수 있습니다." }),
        el("button", {
          class: "left-workshop-connect", text: "AI 설정에서 연결", attrs: { type: "button" }, dataset: { testid: "left-workshop-connect" },
          on: { click: () => { openAiSettingsModal(); } },
        }),
      );
    }
  };
  // 프로젝트 store 는 칠할 때마다 알린다 — 그걸 듣지 않고, 공방 세션이 바뀔 때만 다시 그린다(펼칠 때는 show).
  window.addEventListener(WORKSHOP_CHANGED_EVENT, render);
  return { root, show: render, dispose: () => window.removeEventListener(WORKSHOP_CHANGED_EVENT, render) };
}
