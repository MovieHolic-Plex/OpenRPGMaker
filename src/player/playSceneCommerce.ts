import { changeGold } from "@/project/session";
import { recoverPartyVitals } from "@/project/sessionVitals";
import { store } from "@/project/store";
import { resolveTerms, type ResolvedTerms } from "@/project/terms";
import { dialogueHost } from "@/player/playSceneDom";
import { applySystemGraphic } from "@/player/systemGraphics";
import { attachCursorMenu } from "@/player/runtimeCursorMenu";
import type { StepResult } from "@/player/interpreter";
import type { PlaySceneContext } from "@/player/playSceneTypes";

export { playShop } from "@/player/playSceneShop";

type ShopStep = Extract<StepResult, { kind: "shop" }>;
type InnStep = Extract<StepResult, { kind: "inn" }>;

export type InnOutcome = "stayed" | "cancelled" | "notEnough";

type CommerceOverlayOptions = {
  readonly testId: string;
  readonly title: string;
  readonly note: string;
};

export function playInn(scene: PlaySceneContext, step: InnStep): Promise<InnOutcome> {
  // RM2003 여관 처리: 인사 → "N G 묵으시겠습니까?" 예/아니오 → (예) 요금 차감·회복 →
  // 화면이 어두워졌다가(휴식) 기상 메시지와 함께 밝아지고 이벤트가 계속된다.
  // 골드 부족 시 기본은 상태 문구만 갱신. branchOnNotEnoughGold 면 notEnough 로 resume 분기.
  const text = innTextModel(step, resolveTerms(store.getCurrent()));
  return new Promise((resolve) => {
    const overlay = createCommerceOverlay({
      testId: "inn-scene",
      title: text.title,
      note: text.note,
    });
    const question = commerceStatus(text.question);
    const actions = document.createElement("div");
    actions.className = "runtime-commerce-actions";
    let detachCursor: (() => void) | null = null;
    const teardownCursor = (): void => {
      detachCursor?.();
      detachCursor = null;
    };
    const finish = (outcome: InnOutcome): void => {
      teardownCursor();
      finishCommerce(scene, overlay, () => resolve(outcome));
    };
    const stayButton = closeButton(
      text.yes,
      () => {
        if (scene.session.gold < step.price) {
          question.textContent = text.notEnoughGold;
          question.dataset.testid = "commerce-status";
          question.dataset.innStatus = "not-enough";
          scene.syncRuntimeState();
          if (step.branchOnNotEnoughGold) {
            finish("notEnough");
          }
          return;
        }
        // 회복/차감은 즉시 반영하고, 이후 휴식 연출을 거쳐 이벤트를 재개한다.
        teardownCursor();
        changeGold(scene.session, "-=", step.price);
        recoverPartyVitals(scene.session.actorVitals, scene.session.partyActorIds, {
          recoverMp: step.recoverMp !== false,
        });
        scene.syncRuntimeState();
        void playInnRest(scene, overlay, step, text, () => resolve("stayed"));
      },
      "inn-stay"
    );
    const cancelButton = closeButton(
      text.no,
      () => {
        finish("cancelled");
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
async function playInnRest(
  scene: PlaySceneContext,
  overlay: HTMLElement,
  step: InnStep,
  text: InnTextModel,
  resolve: () => void
): Promise<void> {
  const restMs = clampDurationMs(step.restDurationMs, 500);
  const wakeMs = clampDurationMs(step.wakeDurationMs, 750);
  overlay.classList.add("runtime-inn-rest");
  const fade = document.createElement("div");
  fade.className = "runtime-inn-fade";
  fade.dataset.testid = "inn-resting";
  overlay.replaceChildren(fade);
  scene.syncRuntimeState();

  await delay(scene, restMs);

  if (step.advanceToMorning) {
    try {
      await scene.sleepUntilMorning();
    } catch {
      // 시간 시스템이 없거나 중첩 잠금이면 회복 연출만 유지한다.
    }
  }

  const wake = commerceStatus(text.wakeMessage);
  wake.dataset.testid = "inn-wake";
  overlay.classList.remove("runtime-inn-rest");
  overlay.classList.add("runtime-inn-wake-view");
  const title = document.createElement("div");
  title.className = "runtime-overlay-title";
  title.textContent = text.title;
  overlay.replaceChildren(title, wake);
  scene.syncRuntimeState();
  await delay(scene, wakeMs);
  finishCommerce(scene, overlay, resolve);
}

export function commerceOverlayText(step: ShopStep | InnStep): string {
  const terms = resolveTerms(store.getCurrent());
  switch (step.kind) {
    case "shop":
      return `상점: ${step.itemIds.length}개 상품`;
    case "inn":
      return `${terms.innTitle}: ${step.price} ${terms.gold}`;
  }
}

export type InnTextModel = {
  readonly title: string;
  readonly note: string;
  readonly question: string;
  readonly yes: string;
  readonly no: string;
  readonly notEnoughGold: string;
  readonly wakeMessage: string;
};

export function innTextModel(step: InnStep, terms: ResolvedTerms): InnTextModel {
  const price = Math.max(0, Math.trunc(step.price) || 0);
  const recoverMp = step.recoverMp !== false;
  const note = step.note?.trim() || "어서 오세요. 편히 쉬어가시겠어요?";
  const question =
    step.question?.trim() ||
    (price <= 0
      ? "하룻밤 묵으시겠습니까? (무료)"
      : `하룻밤 묵는 데 ${price} ${terms.gold} 입니다. 묵으시겠습니까?`);
  const wakeMessage = recoverMp
    ? "좋은 아침입니다! 파티가 모두 회복했습니다."
    : "좋은 아침입니다! 파티 HP가 회복했습니다.";
  return {
    title: terms.innTitle,
    note,
    question,
    yes: terms.yes,
    no: terms.no,
    notEnoughGold: terms.notEnoughGold,
    wakeMessage,
  };
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

function clampDurationMs(value: number | undefined, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(0, Math.min(10_000, Math.trunc(value as number)));
}

function delay(scene: PlaySceneContext, ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => {
    scene.time.delayedCall(ms, () => resolve());
  });
}
