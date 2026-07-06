import { changeGold } from "@/project/session";
import { recoverPartyVitals } from "@/project/sessionVitals";
import { dialogueHost } from "@/player/playSceneDom";
import { applySystemGraphic } from "@/player/systemGraphics";
import { attachCursorMenu } from "@/player/runtimeCursorMenu";
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
  // RM2003 여관 처리: 인사 → "N G 묵으시겠습니까?" 예/아니오 → (예) 요금 차감·회복 →
  // 화면이 어두워졌다가(휴식) 기상 메시지와 함께 밝아지고 이벤트가 계속된다.
  return new Promise((resolve) => {
    const overlay = createCommerceOverlay({
      testId: "inn-scene",
      title: "여관",
      note: "어서 오세요. 편히 쉬어가시겠어요?",
    });
    const question = commerceStatus(`하룻밤 묵는 데 ${step.price} G 입니다. 묵으시겠습니까?`);
    const actions = document.createElement("div");
    actions.className = "runtime-commerce-actions";
    let detachCursor: (() => void) | null = null;
    const teardownCursor = (): void => {
      detachCursor?.();
      detachCursor = null;
    };
    const stayButton = closeButton(
      "예",
      () => {
        if (scene.session.gold < step.price) {
          question.textContent = "소지금이 부족합니다.";
          scene.syncRuntimeState();
          return;
        }
        // 회복/차감은 즉시 반영하고, 이후 휴식 연출을 거쳐 이벤트를 재개한다.
        teardownCursor();
        changeGold(scene.session, "-=", step.price);
        recoverPartyVitals(scene.session.actorVitals, scene.session.partyActorIds);
        scene.syncRuntimeState();
        playInnRest(scene, overlay, resolve);
      },
      "inn-stay"
    );
    const cancelButton = closeButton(
      "아니오",
      () => {
        teardownCursor();
        finishCommerce(scene, overlay, resolve);
      },
      "inn-cancel"
    );
    actions.append(stayButton, cancelButton);
    overlay.append(question, actions);
    mountCommerceOverlay(scene, overlay);
    // 예/아니오 를 방향키(←→)로 선택, Z/Enter 결정, X/Esc(=아니오) 취소.
    detachCursor = attachCursorMenu(overlay, {
      items: [stayButton, cancelButton],
      cancelEl: cancelButton,
      columns: 2,
    });
  });
}

// 숙박 연출: 어두워짐(휴식) → 기상 메시지 → 밝아지며 종료.
function playInnRest(scene: PlaySceneContext, overlay: HTMLElement, resolve: () => void): void {
  overlay.classList.add("runtime-inn-rest");
  const fade = document.createElement("div");
  fade.className = "runtime-inn-fade";
  fade.dataset.testid = "inn-resting";
  overlay.replaceChildren(fade);
  scene.syncRuntimeState();
  scene.time.delayedCall(500, () => {
    const wake = commerceStatus("좋은 아침입니다! 파티가 모두 회복했습니다.");
    wake.dataset.testid = "inn-wake";
    overlay.classList.remove("runtime-inn-rest");
    overlay.classList.add("runtime-inn-wake-view");
    const title = document.createElement("div");
    title.className = "runtime-overlay-title";
    title.textContent = "여관";
    overlay.replaceChildren(title, wake);
    scene.syncRuntimeState();
    scene.time.delayedCall(750, () => finishCommerce(scene, overlay, resolve));
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
