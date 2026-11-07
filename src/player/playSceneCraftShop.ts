// 제작 공방(openCraftShop) 명령의 실플레이어 창.
// 선물·아이템 제시 창(runtime-gift-*)과 같은 목록·커서 메뉴를 쓴다. 고른 제작법 id 를 돌려주면 인터프리터가 만들고 이 창을 다시 연다.
import { store } from "@/project/store";
import type { StepResult } from "@/player/interpreter";
import { dialogueHost } from "@/player/playSceneDom";
import { attachCursorMenu } from "@/player/runtimeCursorMenu";
import { emitRuntimeJuice } from "@/player/runtimeJuice";
import type { PlaySceneContext } from "@/player/playSceneTypes";
import type { CraftShopRow } from "@/project/craftShop";
import { el } from "@/util/dom";

type CraftShopStep = Extract<StepResult, { kind: "craftShop" }>;

const TITLE_ID = "runtime-craft-shop-title";

function ingredientText(row: CraftShopRow): string {
  const parts = row.ingredients.map((ingredient) => `${ingredient.name} ${ingredient.have}/${ingredient.need}`);
  if (row.goldCost > 0) parts.push(`${row.goldCost}G`);
  return parts.join(" · ");
}

/** 고른 제작법 id. 닫았으면 undefined. */
export async function playCraftShop(scene: PlaySceneContext, step: CraftShopStep): Promise<string | undefined> {
  const host = dialogueHost(scene);
  if (!host) return undefined;
  return new Promise((resolve) => {
    const overlay = document.createElement("section");
    overlay.className = "runtime-overlay runtime-gift-overlay runtime-craft-shop-overlay";
    overlay.dataset.testid = "craft-shop-scene";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-labelledby", TITLE_ID);
    overlay.tabIndex = -1;
    const buttons = step.rows.map((row) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "runtime-gift-item runtime-craft-shop-row";
      button.dataset.testid = `craft-shop-row-${row.recipeId}`;
      if (row.disabledReason) {
        button.classList.add("is-disabled");
        button.dataset.disabled = "true";
      }
      button.setAttribute("aria-label", `${row.outputText}. ${ingredientText(row)}${row.disabledReason ? `. ${row.disabledReason}` : ""}`);
      button.append(
        el("span", { class: "runtime-craft-shop-output", text: row.outputText }),
        el("span", { class: "runtime-craft-shop-cost", text: ingredientText(row) }),
        ...(row.disabledReason
          ? [el("span", { class: "runtime-craft-shop-reason", text: row.disabledReason, dataset: { testid: `craft-shop-row-${row.recipeId}-reason` } })]
          : []),
      );
      button.addEventListener("click", () => {
        if (row.disabledReason) {
          emitRuntimeJuice({ event: "menu-invalid", target: button, project: store.getCurrent(), session: scene.session });
          return;
        }
        emitRuntimeJuice({ event: "menu-confirm", cue: "shop", project: store.getCurrent(), session: scene.session });
        resolveWith(row.recipeId);
      });
      return button;
    });
    const cancel = el("button", {
      class: "runtime-gift-cancel",
      text: "그만둔다",
      attrs: { type: "button" },
      dataset: { testid: "craft-shop-leave" },
      on: { click: () => resolveWith(undefined) },
    }) as HTMLButtonElement;
    const heading = step.speaker && step.title ? `${step.speaker} · ${step.title}` : step.title ?? step.speaker ?? "제작";
    overlay.append(el("div", {
      class: "runtime-gift-window runtime-craft-shop-window",
      children: [
        el("div", {
          class: "runtime-craft-shop-head",
          children: [
            el("div", { class: "runtime-gift-title", text: heading, attrs: { id: TITLE_ID } }),
            el("div", { class: "runtime-craft-shop-gold", text: `${step.gold}G`, dataset: { testid: "craft-shop-gold" } }),
          ],
        }),
        ...(step.notice
          ? [el("div", {
            class: `runtime-craft-shop-notice ${step.notice.ok ? "is-ok" : "is-fail"}`,
            text: step.notice.text,
            dataset: { testid: "craft-shop-notice" },
            attrs: { role: "status", "aria-live": "polite" },
          })]
          : []),
        el("div", {
          class: "runtime-gift-list",
          dataset: { testid: "craft-shop-list" },
          attrs: { role: "group", "aria-label": "만들 물건" },
          children: buttons,
        }),
        cancel,
      ],
    }));
    const layer = host.closest(".play-viewport") ?? host;
    layer.querySelector("[data-testid='craft-shop-scene']")?.remove();
    layer.append(overlay);
    let detachCursor: (() => void) | null = attachCursorMenu(overlay, {
      items: buttons,
      cancelEl: cancel,
      initialIndex: 0,
      sound: true,
      audioContext: { project: store.getCurrent(), session: scene.session },
      freshDom: true,
    });

    function resolveWith(recipeId: string | undefined): void {
      detachCursor?.();
      detachCursor = null;
      overlay.remove();
      resolve(recipeId);
    }
  });
}
