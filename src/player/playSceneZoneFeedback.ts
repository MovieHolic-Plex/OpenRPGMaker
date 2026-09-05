import type { PlaySession } from "@/project/session";
import type { RuntimeEventView } from "@/project/runtimeEventState"
import type { PlaySceneContext } from "@/player/playSceneTypes";
import { footprintContains } from "@/project/footprint";
import {
  createZoneFeedbackModel,
  interactionPromptLabel,
  updateZoneFeedback,
  type ZoneFeedbackEffect,
  type ZoneFeedbackModel,
  type ZoneFeedbackView,
} from "@/player/zoneFeedback";

const CHECKPOINT_EVENT = "oprn:checkpoint-feedback";
const SUPPRESSING_TEST_IDS = [
  "dialogue-box",
  "battle-scene",
  "title-screen",
  "game-over-screen",
  "main-menu",
  "status-menu",
  "shop-scene",
  "inn-scene",
  "chest-scene",
  "ending-screen",
] as const;

// ── 씬 로컬 농사 안내 채널 ──
// session.m2Runtime.ui 를 쓰면 안 된다: updateZoneFeedback 은 surface+message 로
// 세션 전체를 중복 제거하므로 "괭이가 필요합니다" 가 평생 한 번만 보이고,
// 그 항목은 세이브 파일에까지 직렬화된다. 그래서 세션을 건드리지 않는 별도 채널을 둔다.
// 씬 객체를 키로 하는 WeakMap 이라 씬이 죽으면 같이 사라진다.
const FARM_MESSAGE_DURATION_MS = 1600;

type FarmMessage = { message: string; remainingMs: number };

const farmMessages = new WeakMap<object, FarmMessage>();

/** 반복 가능한 농사 실패 안내를 띄운다. 같은 문구를 몇 번이든 다시 띄울 수 있다. */
export function showFarmFeedbackMessage(scene: object, message: string): void {
  farmMessages.set(scene, { message, remainingMs: FARM_MESSAGE_DURATION_MS });
}

export function peekFarmFeedbackMessage(scene: object): string | null {
  return farmMessages.get(scene)?.message ?? null;
}

export type ZoneFeedbackScene = {
  session: PlaySession;
  facing: PlaySceneContext["facing"];
  tileX: number;
  tileY: number;
  activeRuntimeEvents: (trigger: "action") => RuntimeEventView[];
  game: { registry: { get: (key: string) => unknown } };
};

type FeedbackElements = {
  readonly root: HTMLElement;
  readonly banner: HTMLElement;
  readonly toast: HTMLElement;
  readonly objective: HTMLElement;
  readonly prompt: HTMLElement;
};

export type ZoneFeedbackDom = {
  readonly render: (view: ZoneFeedbackView, effects: readonly ZoneFeedbackEffect[]) => void;
  readonly destroy: () => void;
};

export type PlaySceneZoneFeedback = {
  model: ZoneFeedbackModel;
  elapsedMs: number;
  session: PlaySession;
  awaitingFirstUi: boolean;
  host: HTMLElement | null;
  dom: ZoneFeedbackDom | null;
};

export function createPlaySceneZoneFeedback(session: PlaySession): PlaySceneZoneFeedback {
  const ui = session.m2Runtime?.ui;
  return {
    model: createZoneFeedbackModel(ui ?? []),
    elapsedMs: 0,
    session,
    awaitingFirstUi: ui === undefined,
    host: null,
    dom: null,
  };
}

export function syncPlaySceneZoneFeedback(
  scene: ZoneFeedbackScene,
  feedback: PlaySceneZoneFeedback,
  deltaMs: number,
): void {
  feedback.elapsedMs += Math.max(0, deltaMs);
  syncSessionSource(scene.session, feedback);
  const host = dialogueHost(scene);
  if (host !== feedback.host) {
    feedback.dom?.destroy();
    feedback.host = host;
    feedback.dom = host ? createZoneFeedbackDom(host) : null;
  }

  const farm = farmMessages.get(scene);
  if (farm) {
    farm.remainingMs -= Math.max(0, deltaMs);
    if (farm.remainingMs <= 0) farmMessages.delete(scene);
  }

  const entries = scene.session.m2Runtime?.ui ?? [];
  const update = updateZoneFeedback(feedback.model, {
    entries,
    nowMs: feedback.elapsedMs,
    prompt: facingPrompt(scene),
    suppressed: feedbackSuppressedByOverlay(host),
    transientToast: farmMessages.get(scene)?.message ?? null,
  });
  feedback.model = update.model;
  feedback.dom?.render(update.view, update.effects);
}

function syncSessionSource(session: PlaySession, feedback: PlaySceneZoneFeedback): void {
  const ui = session.m2Runtime?.ui;
  if (feedback.session !== session) {
    feedback.session = session;
    feedback.model = createZoneFeedbackModel(ui ?? []);
    feedback.awaitingFirstUi = ui === undefined;
    return;
  }
  if (!feedback.awaitingFirstUi || ui === undefined) return;
  feedback.model = createZoneFeedbackModel(ui, "consumeExisting");
  feedback.awaitingFirstUi = false;
}

export function destroyPlaySceneZoneFeedback(feedback: PlaySceneZoneFeedback): void {
  feedback.dom?.destroy();
  feedback.dom = null;
  feedback.host = null;
}

export function createZoneFeedbackDom(host: HTMLElement): ZoneFeedbackDom {
  const elements = createElements();
  return {
    render: (view, effects) => renderFeedback(host, elements, view, effects),
    destroy: () => elements.root.remove(),
  };
}

function createElements(): FeedbackElements {
  const root = document.createElement("section");
  root.className = "zone-feedback";
  root.dataset.testid = "zone-feedback";
  root.setAttribute("aria-label", "탐험 안내");

  const banner = feedbackLine("banner", "지역 알림");
  const toast = feedbackLine("toast", "체크포인트 알림");
  const objective = feedbackLine("objective", "현재 목표");
  const prompt = feedbackLine("prompt", "상호작용 안내");
  root.append(banner, toast, objective, prompt);
  return { root, banner, toast, objective, prompt };
}

function feedbackLine(kind: "banner" | "toast" | "objective" | "prompt", label: string): HTMLElement {
  const element = document.createElement("div");
  element.className = `zone-feedback-${kind}`;
  element.dataset.testid = `zone-feedback-${kind}`;
  element.setAttribute("role", "status");
  element.setAttribute("aria-live", "polite");
  element.setAttribute("aria-label", label);
  return element;
}

function renderFeedback(
  host: HTMLElement,
  elements: FeedbackElements,
  view: ZoneFeedbackView,
  effects: readonly ZoneFeedbackEffect[],
): void {
  setLine(elements.banner, view.banner);
  setLine(elements.toast, view.toast);
  setLine(elements.objective, view.objective);
  setLine(elements.prompt, view.prompt);
  const hasContent = Boolean(view.banner || view.toast || view.objective || view.prompt);
  if (view.suppressed || !hasContent) {
    elements.root.remove();
    return;
  }
  if (elements.root.parentElement !== host) host.append(elements.root);
  for (const effect of effects) {
    if (effect.kind === "checkpointChime") host.dispatchEvent(new Event(CHECKPOINT_EVENT, { bubbles: true }));
  }
}

function setLine(element: HTMLElement, message: string | null): void {
  element.hidden = message === null;
  element.textContent = message ?? "";
}

function dialogueHost(scene: Pick<ZoneFeedbackScene, "game">): HTMLElement | null {
  const host: unknown = scene.game.registry.get("dialogueHost");
  return host instanceof HTMLElement ? host : null;
}

export function feedbackSuppressedByOverlay(host: HTMLElement | null): boolean {
  if (!host) return true;
  return SUPPRESSING_TEST_IDS.some((testId) =>
    host.querySelector(`[data-testid='${testId}']`) !== null
    || document.querySelector(`[data-testid='${testId}']`) !== null
  );
}

function facingPrompt(scene: ZoneFeedbackScene): string | null {
  if (scene.session.horror?.hiding) return scene.session.horror.hiding.witnessedBy.length ? "발각 위험 · 나오기" : "숨어 있음 · 나오기";
  const delta = facingDelta(scene.facing);
  const targetX = scene.tileX + delta.x;
  const targetY = scene.tileY + delta.y;
  const events = scene.activeRuntimeEvents("action");
  const target = events.find((event) => footprintContains(event.x, event.y, event.footprint, targetX, targetY))
    ?? events.find((event) => footprintContains(event.x, event.y, event.footprint, scene.tileX, scene.tileY));
  return promptForEvent(target);
}

function promptForEvent(event: RuntimeEventView | undefined): string | null {
  if (event?.page?.interaction?.kind === "hiding") return "숨기";
  if (event?.page?.interaction?.kind === "pushable") return "밀기";
  return interactionPromptLabel(event?.page);
}

function facingDelta(facing: ZoneFeedbackScene["facing"]): { readonly x: number; readonly y: number } {
  switch (facing) {
    case "down": return { x: 0, y: 1 };
    case "left": return { x: -1, y: 0 };
    case "right": return { x: 1, y: 0 };
    case "up": return { x: 0, y: -1 };
  }
}
