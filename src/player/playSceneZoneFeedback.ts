import type { PlaySession } from "@/project/session";
import { store } from "@/project/store";
import { stampEmeraldSurface } from "@/player/emeraldSurfaces";
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
  /** 이벤트(컷신·대사 사이 걷기)가 도는 중 — 조작할 수 없으니 「Z 조사」 안내를 띄우지 않는다. */
  running?: boolean;
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
  /** 정면 조사 안내 기억. 칸·방향·세션이 같으면 PROMPT_REFRESH_MS 동안 다시 찾지 않는다. */
  prompt?: { readonly x: number; readonly y: number; readonly facing: string; readonly session: PlaySession; readonly atMs: number; readonly value: string | null };
};

/**
 * 정면 조사 안내를 다시 계산하는 주기. 예전에는 매 프레임 맵의 모든 조사 이벤트 뷰(페이지 조건
 * 평가 포함)를 만들었다. 칸·방향이 바뀌면 즉시 다시 찾고, 제자리에서는 스위치로 페이지가 바뀐
 * 경우만 이 주기 안에 따라온다.
 */
const PROMPT_REFRESH_MS = 250;

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
  // 가려진 동안에는 안내 줄이 그려지지 않으므로 정면 조사 대상을 찾지 않는다(매 프레임 이벤트 뷰 조회).
  const suppressed = feedbackSuppressedByOverlay(host);
  const update = updateZoneFeedback(feedback.model, {
    entries,
    nowMs: feedback.elapsedMs,
    prompt: suppressed || scene.running ? null : cachedFacingPrompt(scene, feedback),
    suppressed,
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
  stampEmeraldSurface(root, store.getCurrent(), "zone-feedback");

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
  setPromptLine(elements.objective, view.objective);
  setPromptLine(elements.prompt, view.prompt);
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

/**
 * 목표 줄도 같은 방식으로 다시 또렷해진다 — 글이 바뀔 때 또렷하고 몇 초 뒤 반투명으로 가라앉는다(zone-objective-settle).
 * 작은 방을 화면에 채우면(playSceneCamera smallMapFillZoom) 오른쪽 위 목표 창이 책장·벽을 늘 덮었다(2026-10-28 적대 VQA).
 *
 * 「Z 조사」 같은 상호작용 안내는 처음 보일 때만 또렷하고 몇 초 뒤 옅어진다(zoneFeedback.css 의 zone-prompt-settle).
 * 같은 이벤트 앞에 서 있는 내내 화면 아래에 남아 시각 소음이 됐다(폴른 스타 가혹 검수 r3~r5). 글이 바뀌면 다시 또렷해진다.
 */
function setPromptLine(element: HTMLElement, message: string | null): void {
  const changed = element.textContent !== (message ?? "") || element.hidden !== (message === null);
  setLine(element, message);
  if (!changed || message === null) return;
  element.style.animation = "none";
  void element.offsetWidth;
  element.style.animation = "";
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

function cachedFacingPrompt(scene: ZoneFeedbackScene, feedback: PlaySceneZoneFeedback): string | null {
  const cached = feedback.prompt;
  if (cached && cached.x === scene.tileX && cached.y === scene.tileY && cached.facing === scene.facing
    && cached.session === scene.session && !scene.session.horror?.hiding
    && feedback.elapsedMs - cached.atMs < PROMPT_REFRESH_MS) return cached.value;
  const value = facingPrompt(scene);
  feedback.prompt = { x: scene.tileX, y: scene.tileY, facing: scene.facing, session: scene.session, atMs: feedback.elapsedMs, value };
  return value;
}

function facingPrompt(scene: ZoneFeedbackScene): string | null {
  if (scene.session.horror?.hiding) return scene.session.horror.hiding.witnessedBy.length ? "발각 위험 · 나오기" : "숨어 있음 · 나오기";
  const delta = facingDelta(scene.facing);
  const targetX = scene.tileX + delta.x;
  const targetY = scene.tileY + delta.y;
  const events = scene.activeRuntimeEvents("action");
  const target = events.find((event) => footprintContains(event.x, event.y, event.footprint, targetX, targetY))
    ?? events.find((event) => footprintContains(event.x, event.y, event.footprint, scene.tileX, scene.tileY));
  const label = promptForEvent(target);
  return rememberPrompt(scene.session, label && target ? `${(scene.session as { currentMapId?: string }).currentMapId ?? ""}:${target.event.id}:${target.pageId ?? ""}:${label}` : null) ? label : null;
}

/**
 * 같은 대상(맵·이벤트·페이지·문구) 앞의 안내는 세션에 한 번만 보인다 — 한 번 등을 돌리면 다음부터는 띄우지 않는다.
 * 후퇴 뒤 보스 앞·금고 문 앞에 「Z 전투」가 다시 떠 「상시 표시」로 읽혔다(폴른 스타 가혹 검수 r6·r7).
 * 페이지가 바뀌면(새 상태) 키가 달라져 다시 한 번 보인다.
 */
const PROMPT_SHOW_MS = 4000;
const promptMemory = new WeakMap<object, { readonly seen: Set<string>; current: string | null; show: boolean; since: number }>();
function rememberPrompt(session: object, key: string | null): boolean {
  let memory = promptMemory.get(session);
  if (!memory) { memory = { seen: new Set(), current: null, show: false, since: 0 }; promptMemory.set(session, memory); }
  const now = typeof performance !== "undefined" ? performance.now() : Date.now();
  if (memory.current !== key) {
    memory.current = key;
    memory.show = key !== null && !memory.seen.has(key);
    memory.since = now;
    if (key !== null) memory.seen.add(key);
  }
  // 같은 대상 앞에 계속 서 있어도 처음 몇 초만 — 대화·전투가 끝나 창이 다시 비어도 또 띄우지 않는다(r9 「재도전 뒤 Z 전투」).
  return memory.show && now - memory.since < PROMPT_SHOW_MS;
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
