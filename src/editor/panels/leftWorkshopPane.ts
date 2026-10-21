// src/editor/panels/leftWorkshopPane.ts
import "@/styles/database/workshop/index.css";
/**
 * 왼쪽 활동 막대 「공방」: 이 프로젝트에서 쓸 수 있는 하네스(레지스트리 workshopHarnesses)와 진행 중인 판 수.
 * 누르면 큰 화면(오버레이)을 연다. 모델 연결이 안 됐으면 AI 설정으로 가는 버튼만 보인다.
 */
import { loadAiConfig } from "@/ai/llmClient";
import { workshopHarnesses } from "@/harnesses/_core/registry";
import { AI_CONNECTION_STATUS_CHANGED_EVENT, getAiConnectionStatus } from "@/editor/panels/aiConnectionStatus";
import { openAiSettingsModal } from "@/editor/panels/aiSettingsModal";
import { WORKSHOP_MODEL_ADVICE, workshopAiReady } from "@/editor/workshop/chat";
import { peekWorkshopSession, WORKSHOP_CHANGED_EVENT } from "@/editor/workshop/workshopSession";
import { itemState } from "@/editor/workshop/workshopStatus";
import { openWorkshop } from "@/editor/workshop/workshopWorkspace";
import { store } from "@/project/store";
import { clearChildren, el } from "@/util/dom";

/**
 * 목록에 보이는 글은 화면용 쉬운 말이다. 하네스 manifest 의 title/summary 는 문서·INDEX 용(16px·슈퍼하네싱 같은 내부 말)이라
 * 그대로 두고, 여기서만 id 별로 바꿔 보인다. 새 하네스는 manifest 글로 되돌아간다.
 */
const WORKSHOP_DISPLAY: Record<string, { title: string; summary: string }> = {
  "interior-props": {
    title: "실내 가구·소품 그리기",
    summary: "방 안 가구와 소품을 새로 그리거나 다시 그려요. AI가 후보 5장을 그리고, 모양을 스스로 점검한 뒤 다른 AI가 한 번 더 검사해요. 그 가운데서 마음에 드는 한 장을 고르세요.",
  },
  "map-objects": {
    title: "맵 소품 그리기",
    summary: "지금 맵에 없는 물건을 지금 맵의 그림 느낌에 맞춰 그려요. AI가 후보 3장을 그리고 다른 AI가 검사해요. 마음에 드는 한 장을 고르세요.",
  },
};

export function createLeftWorkshopPane(): { root: HTMLElement; show(): void; dispose(): void } {
  const root = el("section", { class: "left-workshop-pane", attrs: { "aria-label": "공방" }, dataset: { testid: "left-workshop-pane" } });
  const render = (): void => {
    if (root.hidden) return;
    clearChildren(root);
    root.append(
      el("h2", { class: "left-workshop-title", text: "공방" }),
      el("p", { class: "left-workshop-lead", text: "공방은 AI가 새 그림 후보를 여러 장 그려 주면, 마음에 드는 한 장을 직접 골라 게임에 넣는 곳이에요." }),
      el("ul", {
        class: "left-workshop-guide",
        children: [
          el("li", { children: [el("strong", { text: "만들기" }), el("span", { text: " 가구·소품 그림 후보를 AI가 여러 장 그려요." })] }),
          el("li", { children: [el("strong", { text: "고르기" }), el("span", { text: " 후보를 비교해서 쓸 한 장을 골라요." })] }),
          el("li", { children: [el("strong", { text: "넣기" }), el("span", { text: " 고른 그림이 이 게임에서 바로 쓸 수 있게 들어가요." })] }),
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
    if (!aiReady) {
      const hostOff = getAiConnectionStatus(loadAiConfig()).hostAiDisabled === true;
      root.append(
        el("p", {
          class: "left-workshop-empty", dataset: { testid: "left-workshop-no-ai" },
          text: hostOff
            ? "이 서버에서는 AI가 꺼져 있어요. 서버 관리자에게 AI를 켜 달라고 요청하세요."
            : "AI를 연결하면 후보를 만들 수 있어요. 연결 전에도 어떤 공방이 있는지 둘러볼 수 있어요.",
        }),
      );
      if (!hostOff) {
        root.append(el("button", {
          class: "left-workshop-connect", text: "AI 연결하기", attrs: { type: "button" }, dataset: { testid: "left-workshop-connect" },
          on: { click: () => { openAiSettingsModal(); } },
        }));
      }
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
              el("strong", { text: WORKSHOP_DISPLAY[harness.id]?.title ?? harness.title }),
              el("span", { class: "left-workshop-description", text: WORKSHOP_DISPLAY[harness.id]?.summary ?? harness.summary }),
              el("span", { class: "left-workshop-meta", text: session ? `그리는 중 ${drawing} · 고를 차례 ${choose}` : "후보 만들기 시작" }),
            ],
          })],
        });
      }),
    }));
  };
  // 프로젝트 store 는 칠할 때마다 알린다 — 그걸 듣지 않고, 공방 세션이 바뀔 때만 다시 그린다(펼칠 때는 show).
  window.addEventListener(WORKSHOP_CHANGED_EVENT, render);
  // AI 연결 상태(연결됨·서버에서 꺼짐)가 바뀌면 연결 안내도 바로 바꾼다.
  window.addEventListener(AI_CONNECTION_STATUS_CHANGED_EVENT, render);
  return {
    root, show: render,
    dispose: () => {
      window.removeEventListener(WORKSHOP_CHANGED_EVENT, render);
      window.removeEventListener(AI_CONNECTION_STATUS_CHANGED_EVENT, render);
    },
  };
}
