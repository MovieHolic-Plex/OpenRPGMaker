// presentItem(아이템 제시) 명령의 실플레이어 UI.
// 선물하기 창(playSceneGift)과 같은 목록·커서 메뉴를 쓴다 — 새 스타일을 만들지 않는다.
import { store } from "@/project/store";
import type { StepResult } from "@/player/interpreter";
import { dialogueHost, dialogueUi } from "@/player/playSceneDom";
import { attachCursorMenu } from "@/player/runtimeCursorMenu";
import type { PlaySceneContext } from "@/player/playSceneTypes";
import { el } from "@/util/dom";

type PresentItemStep = Extract<StepResult, { kind: "presentItem" }>;

const DEFAULT_PRESENT_PROMPT = "무엇을 보여줄까?";

/** 고른 itemId, 닫았거나 보여줄 것이 없으면 undefined. */
export async function playPresentItem(scene: PlaySceneContext, step: PresentItemStep): Promise<string | undefined> {
  if (step.items.length === 0) {
    // 후보가 없으면 prompt 만 보여 주고 닫힘(cancelBranch)으로 이어 간다.
    const dialogue = dialogueUi(scene);
    await dialogue?.showText({
      body: step.prompt || DEFAULT_PRESENT_PROMPT,
      settings: step.settings,
      textContext: { session: scene.session, project: store.getCurrent() },
      playerTileY: scene.tileY,
      mapHeight: scene.map.height,
    });
    return undefined;
  }
  const host = dialogueHost(scene);
  if (!host) return undefined;
  const names = new Map(store.getCurrent().database.items.map((item) => [item.id, item.name]));
  return new Promise((resolve) => {
    const overlay = document.createElement("section");
    overlay.className = "runtime-overlay runtime-gift-overlay runtime-present-overlay";
    overlay.dataset.testid = "present-item-scene";
    const buttons = step.items.map((item, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "runtime-gift-item";
      button.dataset.testid = `present-item-${item.itemId}`;
      if (index === 0) button.classList.add("selected");
      button.append(
        el("span", { class: "runtime-gift-item-name", text: names.get(item.itemId) ?? item.itemId }),
        el("span", { class: "runtime-gift-item-count", text: String(item.count) }),
      );
      button.addEventListener("click", () => resolveWith(item.itemId));
      return button;
    });
    const cancel = el("button", {
      class: "runtime-gift-cancel",
      text: "그만두기",
      attrs: { type: "button" },
      dataset: { testid: "present-item-cancel" },
      on: { click: () => resolveWith(undefined) },
    }) as HTMLButtonElement;
    overlay.append(el("div", {
      class: "runtime-gift-window",
      children: [
        el("div", { class: "runtime-gift-title", text: step.prompt || DEFAULT_PRESENT_PROMPT }),
        el("div", { class: "runtime-gift-list", dataset: { testid: "present-item-list" }, children: buttons }),
        cancel,
      ],
    }));
    const layer = host.closest(".play-viewport") ?? host;
    layer.querySelector("[data-testid='present-item-scene']")?.remove();
    layer.append(overlay);
    let detachCursor: (() => void) | null = attachCursorMenu(overlay, {
      items: buttons,
      cancelEl: cancel,
      initialIndex: 0,
    });

    function resolveWith(itemId: string | undefined): void {
      detachCursor?.();
      detachCursor = null;
      overlay.remove();
      resolve(itemId);
    }
  });
}
