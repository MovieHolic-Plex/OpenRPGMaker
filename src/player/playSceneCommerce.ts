import { changeGold } from "@/project/session";
import { recoverPartyVitals } from "@/project/sessionVitals";
import { dialogueHost } from "@/player/playSceneDom";
import { applySystemGraphic } from "@/player/systemGraphics";
import type { StepResult } from "@/player/interpreter";
import type { PlaySceneContext } from "@/player/playSceneTypes";

export { playShop } from "@/player/playSceneShop";

type ShopStep = Extract<StepResult, { kind: "shop" }>;
type InnStep = Extract<StepResult, { kind: "inn" }>;

type CommerceOverlayOptions = {
  readonly testId: string;
  readonly title: string;
  readonly note: string;
};

export function playInn(scene: PlaySceneContext, step: InnStep): Promise<void> {
  return new Promise((resolve) => {
    const overlay = createCommerceOverlay({
      testId: "inn-scene",
      title: "여관",
      note: `숙박 요금은 ${step.price} G입니다.`,
    });
    const actions = document.createElement("div");
    actions.className = "runtime-commerce-actions";
    const status = commerceStatus("숙박하면 요금이 차감되고 이벤트가 계속됩니다.");
    actions.append(
      closeButton(
        "숙박한다",
        () => {
          if (scene.session.gold < step.price) {
            status.textContent = "소지금이 부족합니다.";
            scene.syncRuntimeState();
            return;
          }
          changeGold(scene.session, "-=", step.price);
          recoverPartyVitals(scene.session.actorVitals, scene.session.partyActorIds);
          scene.syncRuntimeState();
          finishCommerce(scene, overlay, resolve);
        },
        "inn-stay"
      ),
      closeButton("그만둔다", () => finishCommerce(scene, overlay, resolve), "inn-cancel")
    );
    overlay.append(status, actions);
    mountCommerceOverlay(scene, overlay);
  });
}

export function commerceOverlayText(step: ShopStep | InnStep): string {
  switch (step.kind) {
    case "shop":
      return `상점: ${step.itemIds.length}개 상품`;
    case "inn":
      return `여관: ${step.price} G`;
  }
}

function commerceStatus(text: string): HTMLElement {
  const status = document.createElement("p");
  status.className = "runtime-commerce-status";
  status.dataset.testid = "commerce-status";
  status.textContent = text;
  return status;
}

function createCommerceOverlay(options: CommerceOverlayOptions): HTMLElement {
  const overlay = document.createElement("section");
  overlay.className = "runtime-overlay runtime-commerce-overlay";
  overlay.dataset.testid = options.testId;
  applySystemGraphic(overlay);
  const title = document.createElement("div");
  title.className = "runtime-overlay-title";
  title.textContent = options.title;
  const note = document.createElement("p");
  note.className = "runtime-commerce-note";
  note.dataset.testid = "commerce-note";
  note.textContent = options.note;
  overlay.append(title, note);
  return overlay;
}

function closeButton(text: string, click: () => void, testId?: string): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = text;
  if (testId) button.dataset.testid = testId;
  button.addEventListener("click", click);
  return button;
}

function mountCommerceOverlay(scene: PlaySceneContext, overlay: HTMLElement): void {
  const host = dialogueHost(scene);
  if (!host) return;
  host.querySelector(`[data-testid='${overlay.dataset.testid ?? ""}']`)?.remove();
  host.append(overlay);
}

function finishCommerce(scene: PlaySceneContext, overlay: HTMLElement, resolve: () => void): void {
  overlay.remove();
  scene.syncRuntimeState();
  resolve();
}
