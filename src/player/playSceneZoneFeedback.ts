import type { PlaySession } from "@/project/session";
import { store } from "@/project/store";
import { stampEmeraldSurface } from "@/player/emeraldSurfaces";
import type { RuntimeEventView } from "@/project/runtimeEventState"
import type { PlaySceneContext } from "@/player/playSceneTypes";
import { footprintBounds, footprintContains } from "@/project/footprint";
import { objectClusterAt } from "@/project/objectFootprint";
import { fieldGuidesOn, objectiveShown, promptTargetName } from "@/player/objectiveTarget";
import { mapTileSize } from "@/project/tileGeometry";
import { runtimePixelDensity } from "@/player/runtimeViewScale";
import type { GameMap } from "@/project/types";
import { createObjectiveCard, destroyObjectiveCard, syncObjectiveCard, type ObjectiveCard } from "@/player/objectiveCard";
import { choosePromptPlacement, objectiveHome, type ObjectivePlacement, type PlacementRect } from "@/player/objectivePlacement";
import { applyHudYield } from "@/player/hudYield";
import { eventMenuLocked } from "@/player/eventMenuLock";
import { pickNearbyActionTarget } from "@/player/nearbyActionTarget";
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
  // 숫자 입력창 뒤로 목표 안내가 비쳐 두 창이 겹쳐 보였다(장부 hud #18·#37).
  "runtime-input-number",
] as const;

// 매 프레임 불린다. 예전에는 가림 id 마다 호스트와 문서를 한 번씩 훑었다(빈 필드에서 최대 20번).
// 선택자 한 줄로 호스트를 한 번, 없으면 문서를 한 번만 본다.
const SUPPRESSING_SELECTOR = SUPPRESSING_TEST_IDS.map((id) => `[data-testid='${id}']`).join(",");

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
  /** 목표 안내창 자리 고르기에 쓰는 화면 기하(PlayScene 이 가진 것). 없으면 CSS 기본 자리(오른쪽 위). */
  cameras?: { main: { worldView: { x: number; y: number }; zoom: number } };
  player?: { getBounds(): PlacementRect } | null;
  eventSprites?: ReadonlyMap<string, { visible: boolean; alpha: number; getBounds(): PlacementRect }>;
  map?: GameMap;
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
  /** 목표 안내창 자리(제자리 — objectiveHome). OBJECTIVE_PLACE_MS 마다 다시 잰다. */
  objectivePlace?: { atMs: number; text: string; placement: ObjectivePlacement; height: number };
  /** 상시 창 비키기(hudYield)를 마지막으로 잰 때. */
  yieldAtMs?: number;
  /** 상호작용 안내 자리. 같은 주기로 다시 고른다. */
  promptPlace?: { atMs: number; text: string; x: number; y: number };
  /** 첫 조작·목표 변경 때 가운데에 잠깐 뜨는 목표 카드(objectiveCard.ts). */
  card?: ObjectiveCard | null;
  /** 지금 보이는 목표 글(objectiveShown) — 글·맵·안내 켬/끔이 같으면 다시 만들지 않는다. */
  objectiveOnMap?: { readonly raw: string; readonly mapId: string; readonly guides: boolean; readonly shown: string };
};

const OBJECTIVE_PLACE_MS = 300;
/** 상시 창 비키기를 재는 주기 — 한 칸 걷는 시간(약 250ms)보다 짧게. */
const HUD_YIELD_MS = 90;

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
    destroyObjectiveCard(feedback.card); feedback.card = null;
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
  // 목표 꼬리의 「<맵> 입구: <자리>」 는 그 맵에 들어선 뒤에는 틀린 말이다 — 지금 맵에서 읽는 글로 보인다(objectiveTextOnMap).
  const view = objectiveViewOnMap(scene, feedback, update.view);
  feedback.dom?.render(view, update.effects);
  // 안내를 먼저 놓는다 — 목표 창은 안내(다른 HUD)를 피해 자리를 고른다.
  if (host && feedback.dom && view.prompt && !view.suppressed) placePrompt(scene, feedback, host, view.prompt);
  if (host && feedback.dom && view.objective && !view.suppressed) placeObjective(feedback, host, view.objective);
  else feedback.objectivePlace = undefined;
  // 상시 창이 주인공·마주 본 것·잠깐 뜨는 알림을 덮지 않게 한다(hudYield.ts). 매 프레임 재지 않는다.
  if (host && !suppressed && feedback.elapsedMs - (feedback.yieldAtMs ?? -Infinity) >= HUD_YIELD_MS) {
    feedback.yieldAtMs = feedback.elapsedMs;
    applyHudYield(host, yieldProtectRects(scene, host));
  }
  // 이벤트가 메뉴를 잠근 동안(기본, @/player/eventMenuLock) 터치 「메뉴」 단추를 숨긴다 — 눌러도 열리지 않는 단추를 보이지 않게.
  // 키보드 X·Esc 는 player.ts 가 같은 규칙으로 막는다. 매 프레임 불러 이어지는 이벤트 사이 틈 보정도 여기서 센다.
  const menuLocked = eventMenuLocked(scene.running, scene.session, performance.now());
  const viewport = host?.closest<HTMLElement>(".play-viewport");
  if (viewport && (viewport.dataset.eventMenuLocked === "true") !== menuLocked) {
    if (menuLocked) viewport.dataset.eventMenuLocked = "true";
    else delete viewport.dataset.eventMenuLocked;
  }
  if (host) {
    // 로딩 막이 걷히고 이벤트(도입 연출)가 끝나 실제로 움직일 수 있는 첫 순간부터 센다.
    const controllable = !suppressed && !scene.running && !menuLocked && !document.querySelector("[data-testid='play-loading-overlay']");
    // 벽시계로 센다 — 게임 시간(elapsedMs)은 느린 기계에서 프레임 델타 상한 때문에 늘어져 2.8초 카드가 6초 떠 있었다.
    syncObjectiveCard(feedback.card ??= createObjectiveCard(), host, scene.session, view.objective, controllable, performance.now());
  }
}

function objectiveViewOnMap(scene: ZoneFeedbackScene, feedback: PlaySceneZoneFeedback, view: ZoneFeedbackView): ZoneFeedbackView {
  const map = scene.map;
  if (!map || !view.objective) return view;
  let seen = feedback.objectiveOnMap;
  // 필드 안내를 끈 게임(system.fieldGuides "off")은 「어디」 꼬리 없이 목표 문장만 보인다.
  const project = store.getCurrent();
  const guides = fieldGuidesOn(project);
  if (!seen || seen.raw !== view.objective || seen.mapId !== map.id || seen.guides !== guides) {
    seen = feedback.objectiveOnMap = { raw: view.objective, mapId: map.id, guides, shown: objectiveShown(project, map, view.objective) };
  }
  return seen.shown === view.objective ? view : { ...view, objective: seen.shown };
}

function placePrompt(scene: ZoneFeedbackScene, feedback: PlaySceneZoneFeedback, host: HTMLElement, text: string): void {
  const element = host.querySelector<HTMLElement>(":scope > .zone-feedback > .zone-feedback-prompt");
  if (!element || element.hidden) return;
  const memo = feedback.promptPlace;
  if (memo && memo.text === text && feedback.elapsedMs - memo.atMs < OBJECTIVE_PLACE_MS) return;
  const geometry = sceneGeometry(scene, host);
  if (!geometry) return;
  const box = { width: element.offsetWidth, height: element.offsetHeight };
  if (box.width <= 0 || box.height <= 0) return;
  const stage = { width: host.clientWidth, height: host.clientHeight };
  const uiScale = Number.parseFloat(getComputedStyle(host).getPropertyValue("--play-ui-scale")) || 1;
  const placement = choosePromptPlacement({
    stage, box, margin: Math.round(4 * uiScale),
    player: geometry.player, actors: geometry.actors, map: geometry.map,
    // 자기 자신은 뺀다. 목표 창은 제자리에 있으므로 안내가 목표 창을 피한다.
    hud: hudRects(host, element, stage),
    current: memo?.text === text ? { x: memo.x, y: memo.y } : null,
  });
  feedback.promptPlace = { atMs: feedback.elapsedMs, text, x: placement.x, y: placement.y };
  Object.assign(element.style, { left: `${placement.x}px`, top: `${placement.y}px`, bottom: "auto", right: "auto", transform: "none" });
}

/**
 * 목표 안내창을 제자리(오른쪽 위, 그 자리의 고정 HUD 밑 — objectivePlacement.objectiveHome)에 둔다. 주인공·인물을 보고 옮기지 않는다.
 * 300ms 마다, 또는 글이 바뀔 때만 잰다(HUD 구성이 바뀌면 그때 따라간다).
 */
function placeObjective(feedback: PlaySceneZoneFeedback, host: HTMLElement, text: string): void {
  const element = host.querySelector<HTMLElement>(":scope > .zone-feedback > .zone-feedback-objective");
  if (!element || element.hidden) return;
  const memo = feedback.objectivePlace;
  if (memo && memo.text === text && feedback.elapsedMs - memo.atMs < OBJECTIVE_PLACE_MS) return;
  // 자연 크기(CSS 최대 폭으로 줄바꿈한 창)를 잰다. 왼쪽 끝에 놓고 잰다 — 지난 자리(left)에 둔 채 재면 남은 폭만큼 줄어든 크기를 자연 크기로 잘못 읽는다.
  Object.assign(element.style, { width: "", maxWidth: "", left: "0px", right: "auto" });
  const box = { width: element.offsetWidth, height: element.offsetHeight };
  if (box.width <= 0 || box.height <= 0) return;
  const stage = { width: host.clientWidth, height: host.clientHeight };
  const uiScale = Number.parseFloat(getComputedStyle(host).getPropertyValue("--play-ui-scale")) || 1;
  const placement = objectiveHome({ stage, box, margin: Math.round(4 * uiScale), hud: hudRects(host, element, stage, HOME_HUD_SELECTOR) });
  feedback.objectivePlace = { atMs: feedback.elapsedMs, text, placement, height: box.height };
  element.dataset.placed = "true";
  Object.assign(element.style, { left: `${placement.x}px`, top: `${placement.y}px`, right: "auto", bottom: "auto" });
}

/**
 * 주인공과 그 둘레 한 칸, 그 칸에 걸친 사람·적 그림 — 상시 창이 덮으면 안 되는 곳(hudYield.ts). 화면 논리 px.
 * 마주 본 것·「Z 조사」 대상·길을 막은 통은 늘 둘레 한 칸 안에 있다.
 */
function yieldProtectRects(scene: ZoneFeedbackScene, host: HTMLElement): PlacementRect[] {
  const geometry = sceneGeometry(scene, host, false);
  const camera = scene.cameras?.main;
  const tile = scene.map ? mapTileSize(scene.map) : 0;
  if (!geometry || !camera || tile <= 0) return geometry?.player ? [geometry.player] : [];
  const scale = camera.zoom / runtimePixelDensity(scene);
  const ring: PlacementRect = {
    x: ((scene.tileX - 1) * tile - camera.worldView.x) * scale,
    y: ((scene.tileY - 1) * tile - camera.worldView.y) * scale,
    width: 3 * tile * scale,
    height: 3 * tile * scale,
  };
  const touches = (rect: PlacementRect): boolean => rect.x < ring.x + ring.width && rect.x + rect.width > ring.x && rect.y < ring.y + ring.height && rect.y + rect.height > ring.y;
  return [ring, ...(geometry.player ? [geometry.player] : []), ...geometry.actors.filter(touches)];
}

type SceneGeometry = { readonly player: PlacementRect | null; readonly actors: PlacementRect[]; readonly map: PlacementRect | null };

/** `withTargets` = 그림 없는 조사 대상(결정 키 이벤트) 칸도 인물로 센다 — 이벤트 뷰를 만들어야 해서 안내 자리를 고를 때만 켠다. */
function sceneGeometry(scene: ZoneFeedbackScene, host: HTMLElement, withTargets = true): SceneGeometry | null {
  const camera = scene.cameras?.main;
  if (!camera || !(camera.zoom > 0)) return null;
  // 손 슬롯 칩과 같은 환산: worldView 원점 기준, 캔버스 px 를 픽셀 밀도로 나눠 논리 px.
  const scale = camera.zoom / runtimePixelDensity(scene);
  const toScreen = (rect: PlacementRect): PlacementRect => ({
    x: (rect.x - camera.worldView.x) * scale,
    y: (rect.y - camera.worldView.y) * scale,
    width: rect.width * scale,
    height: rect.height * scale,
  });
  const player = scene.player ? toScreen(scene.player.getBounds()) : null;
  const actors: PlacementRect[] = [];
  const width = host.clientWidth, height = host.clientHeight;
  for (const sprite of scene.eventSprites?.values() ?? []) {
    if (!sprite.visible || sprite.alpha <= 0.05) continue;
    const rect = toScreen(sprite.getBounds());
    if (rect.x + rect.width < 0 || rect.y + rect.height < 0 || rect.x > width || rect.y > height) continue;
    actors.push(rect);
  }
  const tile = scene.map ? mapTileSize(scene.map) : 0;
  // 조사 대상(결정 키 이벤트)은 그림이 없는 투명 이벤트여도 피한다 — 방탈출의 책장·금고·벽시계가 대개 그렇다.
  if (tile > 0 && withTargets) {
    for (const view of scene.activeRuntimeEvents("action")) {
      const b = footprintBounds(view.x, view.y, view.footprint);
      const rect = toScreen({ x: b.left * tile, y: b.top * tile, width: (b.right - b.left + 1) * tile, height: (b.bottom - b.top + 1) * tile });
      if (rect.x + rect.width < 0 || rect.y + rect.height < 0 || rect.x > width || rect.y > height) continue;
      actors.push(rect);
    }
  }
  const map = scene.map ? toScreen({ x: 0, y: 0, width: scene.map.width * tile, height: scene.map.height * tile }) : null;
  return { player, actors, map };
}

/** 상호작용 안내가 피할 다른 화면 고정 UI(필드 HUD 위젯·지역 알림·목표 창을 뺀 안내·미니맵 등). */
const HUD_SELECTOR = [
  ".field-hud > .hud-widget:not([hidden])",
  ".zone-feedback > :not([hidden])",
  ".action-hud", ".hand-slot", ".runtime-time-hud", "[data-testid='minimap-root']",
].join(",");

/** 목표 창 제자리를 정할 때 보는 고정 HUD — 주인공을 피해 옮겨 앉는 칸(autoAvoid)과 잠깐 뜨는 안내는 뺀다(그쪽이 목표 창을 비킨다). */
const HOME_HUD_SELECTOR = [
  ".field-hud > .hud-widget:not([hidden]):not([data-auto-avoid='true'])",
  ".action-hud", ".hand-slot", ".runtime-time-hud", "[data-testid='minimap-root']",
].join(",");

function hudRects(host: HTMLElement, objective: HTMLElement, stage: { width: number; height: number }, selector = HUD_SELECTOR): PlacementRect[] {
  const hostRect = host.getBoundingClientRect();
  const scale = hostRect.width > 0 && stage.width > 0 ? hostRect.width / stage.width : 1;
  const rects: PlacementRect[] = [];
  for (const node of host.querySelectorAll<HTMLElement>(selector)) {
    if (node === objective || node.offsetParent === null) continue;
    const r = node.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) continue;
    rects.push({ x: (r.x - hostRect.x) / scale, y: (r.y - hostRect.y) / scale, width: r.width / scale, height: r.height / scale });
  }
  return rects;
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

/** 목표 창이 지금 차지한 자리(무대 논리 px) — 필드 HUD 의 옮겨 앉는 칸이 그 위로 올라가지 않게 넘긴다. 안 보이면 undefined. */
export function objectiveBoxRect(feedback: PlaySceneZoneFeedback | null): PlacementRect | undefined {
  const place = feedback?.objectivePlace;
  return place ? { x: place.placement.x, y: place.placement.y, width: place.placement.width, height: place.height } : undefined;
}

export function destroyPlaySceneZoneFeedback(feedback: PlaySceneZoneFeedback): void {
  feedback.dom?.destroy();
  destroyObjectiveCard(feedback.card); feedback.card = null;
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
    if (elements.root.isConnected) elements.root.remove();
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
  const hidden = message === null;
  const text = message ?? "";
  // 같은 글을 다시 대입하면 텍스트 노드가 바뀐다. 매 프레임 같은 안내를 다시 쓰지 않는다.
  if (element.hidden !== hidden) element.hidden = hidden;
  if (element.textContent !== text) element.textContent = text;
}

function dialogueHost(scene: Pick<ZoneFeedbackScene, "game">): HTMLElement | null {
  const host: unknown = scene.game.registry.get("dialogueHost");
  return host instanceof HTMLElement ? host : null;
}

export function feedbackSuppressedByOverlay(host: HTMLElement | null): boolean {
  if (!host) return true;
  // 호스트를 먼저 본다. 대사 호스트가 문서에서 떨어져 있어도 그 안의 창은 안내를 가린다.
  if (host.querySelector(SUPPRESSING_SELECTOR)) return true;
  // 상점·전투·타이틀은 대사 호스트 밖에 붙을 수 있다.
  const doc = host.ownerDocument;
  return Boolean(doc?.querySelector(SUPPRESSING_SELECTOR));
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
  // 숨어 있는 동안의 안내도 다른 안내처럼 처음 몇 초만 — 늘 떠 있는 띠는 잠입 내내 답을 불러 주는 손잡이였다
  // (폴른 스타 B1 막사 검수 2026-11-04: 「숨어 있음 · 나오기」 가 숨을 때마다 화면 아래에 계속 남았다).
  const hiding = scene.session.horror?.hiding;
  if (hiding) {
    const label = hiding.witnessedBy.length ? "발각 위험 · 나오기" : "숨어 있음 · 나오기";
    return rememberPrompt(scene.session, `${(scene.session as { currentMapId?: string }).currentMapId ?? ""}:hiding:${label}`) ? label : null;
  }
  const delta = facingDelta(scene.facing);
  const targetX = scene.tileX + delta.x;
  const targetY = scene.tileY + delta.y;
  const events = scene.activeRuntimeEvents("action");
  const faced = events.find((event) => footprintContains(event.x, event.y, event.footprint, targetX, targetY))
    ?? events.find((event) => footprintContains(event.x, event.y, event.footprint, scene.tileX, scene.tileY));
  // 은신처는 가구 타일 위의 투명 이벤트라 들어가기 전엔 안 보인다 — 바로 곁(상하좌우)에 서면 등을 대고 있어도 「숨기」 를 띄운다(2026-10-29).
  const target = promptForEvent(faced) ? faced
    : events.find((event) => event.page?.interaction?.kind === "hiding" && Math.abs(event.x - scene.tileX) + Math.abs(event.y - scene.tileY) === 1)
      // 정면에 없으면 Z 가 실제로 열 곁의 대상(performAction 과 같은 고르기)을 알려 준다.
      ?? pickNearbyActionTarget(events, scene.tileX, scene.tileY, { front: { x: targetX, y: targetY }, usable: (view) => promptForEvent(view) !== null })?.view
      ?? faced;
  const label = promptForEvent(target);
  return rememberPrompt(scene.session, label && target ? `${(scene.session as { currentMapId?: string }).currentMapId ?? ""}:${target.event.id}:${target.pageId ?? ""}:${label}` : null) ? namedPrompt(scene, target, label) : null;
}

/**
 * 「Z 조사」 → 「Z 조사 · 책상의 메모」 — 무엇을 조사하는지(이벤트 이름, 문이면 가는 맵, 없으면 그 칸 가구 이름표)를 붙인다.
 * 2026-10-29 VM 측정 판 5개 판정자: 「메모·시계·금고가 어느 오브젝트인지 화면에서 구분이 안 된다」 — 투명 조사 칸 앞에서 무엇인지 알려 준다.
 */
function namedPrompt(scene: ZoneFeedbackScene, target: RuntimeEventView | undefined, label: string | null): string | null {
  if (!label || !target || label.includes(" · ")) return label;
  const project = store.getCurrent();
  const map = scene.map;
  const tile = map ? objectClusterAt(project, map, target.x, target.y)?.label : undefined;
  const name = promptTargetName(project, target, label, tile);
  return name ? `${label} · ${name}` : label;
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
