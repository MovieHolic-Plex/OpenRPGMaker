// src/editor/panels/leftWorkshopPane.ts
import "@/styles/database/workshop/index.css";
/**
 * 왼쪽 활동 막대 「공방」: 이 프로젝트에서 쓸 수 있는 하네스(레지스트리 workshopHarnesses)와 진행 중인 판 수.
 * 누르면 큰 화면(오버레이)을 연다. 모델 연결이 안 됐으면 AI 설정으로 가는 버튼만 보인다.
 */
import { workshopHarnesses } from "@/harnesses/_core/registry";
import { openAiSettingsModal } from "@/editor/panels/aiSettingsModal";
import { workshopAiReady } from "@/editor/workshop/chat";
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
      el("p", { class: "left-workshop-lead", text: "AI 가 그림 후보를 여러 장 그리고, 고르는 건 직접 합니다. 결과는 이 프로젝트에만 남습니다." }),
    );
    if (!workshopAiReady()) {
      root.append(el("button", {
        class: "left-workshop-connect", text: "AI 설정에서 연결", attrs: { type: "button" }, dataset: { testid: "left-workshop-connect" },
        on: { click: () => { openAiSettingsModal(); } },
      }));
      return;
    }
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
              el("span", { class: "left-workshop-meta", text: session ? `그리는 중 ${drawing} · 고를 차례 ${choose}` : "열기" }),
            ],
          })],
        });
      }),
    }));
  };
  // 프로젝트 store 는 칠할 때마다 알린다 — 그걸 듣지 않고, 공방 세션이 바뀔 때만 다시 그린다(펼칠 때는 show).
  window.addEventListener(WORKSHOP_CHANGED_EVENT, render);
  return { root, show: render, dispose: () => window.removeEventListener(WORKSHOP_CHANGED_EVENT, render) };
}
