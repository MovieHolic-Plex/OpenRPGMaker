// editor/editRenderGate.ts
// 편집기 Phaser 게임의 유휴 렌더 생략.
//
// 편집기 게임은 fps 제한 없이 RAF 마다 step 을 돌고, 매 step 이 맵 타일 수천 개를 다시 그린다.
// 사용자가 아무것도 하지 않는 동안에도 GPU·메인 스레드를 계속 쓴다. 여기서는 **루프는 그대로 두고
// 렌더 단계만** 건너뛴다 — scene.update·트윈·타이머·애니메이션 시계·입력 폴링(PRE_RENDER)은
// 매 프레임 돈다. 그래서 무엇이 바뀌었는지 놓쳐도 로직은 멈추지 않고, 화면만 최대
// EDIT_RENDER_IDLE_HEARTBEAT_MS 늦는다.
//
// loop.sleep()/wake() 를 쓰지 않는 이유: 잠들면 트윈·공유 물 애니메이션·키보드 큐가 같이 멈춰
// 깨울 지점을 전부 열거해야 하고, 테스트 플레이 창의 잠재우기(editorGameSuspension)와 같은
// 스위치를 두고 다툰다. 렌더만 건너뛰면 둘은 서로를 모른다.
//
// 렌더를 건너뛴 프레임은 GL/2D 컨텍스트를 전혀 건드리지 않으므로 캔버스는 마지막으로 그린
// 그림을 그대로 보여 준다(preserveDrawingBuffer 와 무관 — 그리지 않은 프레임은 합성할 새 버퍼가 없다).

export const EDIT_RENDER_IDLE_MS = 500;
export const EDIT_RENDER_IDLE_HEARTBEAT_MS = 1000;

export type EditRenderGateEvents = {
  readonly PRE_STEP: string;
  readonly STEP: string;
  readonly POST_STEP: string;
  readonly PRE_RENDER: string;
  readonly POST_RENDER: string;
  readonly DESTROY: string;
  readonly VISIBLE: string;
  readonly RESUME: string;
};

type GateEmitter = {
  emit(event: string, ...args: unknown[]): unknown;
  on(event: string, fn: (...args: unknown[]) => void): unknown;
  once(event: string, fn: (...args: unknown[]) => void): unknown;
};

export type EditRenderGateGame = {
  step(time: number, delta: number): void;
  pendingDestroy: boolean;
  isPaused: boolean;
  runDestroy(): void;
  readonly events: GateEmitter;
  readonly scene: { update(time: number, delta: number): void; render(renderer: unknown): void };
  readonly renderer: { preRender(): void; postRender(): void } | null;
  readonly loop: { readonly started: boolean; callback: (time: number, delta: number) => void };
  readonly canvas?: HTMLCanvasElement | null;
};

type GateState = {
  lastActiveAt: number;
  lastRenderAt: number;
  frameRequested: boolean;
  renderedFrames: number;
  skippedFrames: number;
};

const gates = new WeakMap<object, GateState>();

const POINTER_EVENTS = ["pointerdown", "pointermove", "pointerup", "pointercancel", "wheel"] as const;
const KEY_EVENTS = ["keydown", "keyup"] as const;

/** 다음 EDIT_RENDER_IDLE_MS 동안 매 프레임 렌더한다. 게이트가 없는 게임(플레이·테스트 mock)에는 no-op. */
export function markEditRenderActive(game: object | null | undefined): void {
  if (!game) return;
  const gate = gates.get(game);
  if (gate) gate.lastActiveAt = performance.now();
}

/**
 * 다음 step 한 번만 렌더한다. 주기적으로 한 칸씩 바뀌는 것(3fps 물 애니메이션)이 markEditRenderActive 를
 * 부르면 유휴 창이 영영 닫히지 않아 물이 보이는 동안 60fps 로 다시 그리게 된다.
 */
export function requestEditRenderFrame(game: object | null | undefined): void {
  if (!game) return;
  const gate = gates.get(game);
  if (gate) gate.frameRequested = true;
}

/** e2e·진단용 관측점. 게이트가 없으면 null. */
export function editRenderGateStats(game: object | null | undefined): { readonly renderedFrames: number; readonly skippedFrames: number } | null {
  const gate = game ? gates.get(game) : undefined;
  return gate ? { renderedFrames: gate.renderedFrames, skippedFrames: gate.skippedFrames } : null;
}

export function installEditRenderGate(game: EditRenderGateGame, events: EditRenderGateEvents): void {
  if (gates.has(game) || typeof game.step !== "function" || !game.loop) return;
  const now = performance.now();
  const gate: GateState = { lastActiveAt: now, lastRenderAt: -Infinity, frameRequested: false, renderedFrames: 0, skippedFrames: 0 };
  gates.set(game, gate);

  const gatedStep = (time: number, delta: number): void => {
    if (game.pendingDestroy) {
      game.runDestroy();
      return;
    }
    if (game.isPaused) return;
    const emitter = game.events;
    emitter.emit(events.PRE_STEP, time, delta);
    emitter.emit(events.STEP, time, delta);
    game.scene.update(time, delta);
    emitter.emit(events.POST_STEP, time, delta);
    const renderer = game.renderer;
    const at = performance.now();
    const render = renderer !== null && (
      gate.frameRequested
      || at - gate.lastActiveAt < EDIT_RENDER_IDLE_MS
      || at - gate.lastRenderAt >= EDIT_RENDER_IDLE_HEARTBEAT_MS
    );
    if (!render) {
      // InputManager 의 포인터 over/out 폴링이 PRE_RENDER 에 걸려 있다 — 그리지 않아도 보낸다.
      emitter.emit(events.PRE_RENDER, renderer, time, delta);
      gate.skippedFrames += 1;
      return;
    }
    gate.lastRenderAt = at;
    gate.frameRequested = false;
    gate.renderedFrames += 1;
    renderer.preRender();
    emitter.emit(events.PRE_RENDER, renderer, time, delta);
    game.scene.render(renderer);
    renderer.postRender();
    emitter.emit(events.POST_RENDER, renderer, time, delta);
  };
  // Game.start 가 `this.step.bind(this)` 를 루프에 넘기므로, 시작 전이면 자기 속성으로 덮는 것으로 충분하다.
  game.step = gatedStep;
  if (game.loop.started) game.loop.callback = gatedStep;

  const wake = (): void => markEditRenderActive(game);
  // 눌린 채 움직이는 포인터는 캠버스에서 시작한 드래그일 때만 깨운다 — 칠하다 캠버스 밖으로 나가도
  // 계속 그리지만, 사이드바 클릭·스크롤바 드래그마다 맵 전체를 500ms 동안 매 프레임 다시 그리지는 않는다
  // (2026-09-26 실측). 상태를 바꾸는 클릭은 EditScene 의 store/editorState 구독이 따로 깨운다.
  let strokeFromCanvas = false;
  const onPointer = (event: Event): void => {
    const canvas = game.canvas;
    const host = canvas?.parentElement ?? canvas;
    const target = event.target instanceof Node ? event.target : null;
    const inside = Boolean(host && target && host.contains(target));
    if (event.type === "pointerdown") strokeFromCanvas = inside;
    const pressed = "buttons" in event && typeof event.buttons === "number" && event.buttons !== 0;
    if (inside || (pressed && strokeFromCanvas) || (strokeFromCanvas && (event.type === "pointerup" || event.type === "pointercancel"))) wake();
    if (event.type === "pointerup" || event.type === "pointercancel") strokeFromCanvas = false;
  };
  // 글자 입력칸(타일 검색·조수 입력창)의 타이핑은 캠버스를 깨우지 않는다. 단축키는 본문이 받고,
  // 그 결과의 상태 변화·카메라 이동은 EditScene 이 스스로 깨운다.
  const onKey = (event: Event): void => {
    const target = event.target;
    if (target instanceof HTMLElement && (target.isContentEditable || target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT")) return;
    wake();
  };
  if (typeof window !== "undefined") {
    for (const type of POINTER_EVENTS) window.addEventListener(type, onPointer, { capture: true, passive: true });
    for (const type of KEY_EVENTS) window.addEventListener(type, onKey, { capture: true, passive: true });
    window.addEventListener("resize", wake, { passive: true });
  }
  const canvasListeners = (canvas: HTMLCanvasElement | null | undefined, add: boolean): void => {
    if (!canvas) return;
    if (add) canvas.addEventListener("webglcontextrestored", wake);
    else canvas.removeEventListener("webglcontextrestored", wake);
  };
  const boundCanvas = game.canvas ?? null;
  canvasListeners(boundCanvas, true);
  game.events.on(events.VISIBLE, wake);
  game.events.on(events.RESUME, wake);
  game.events.once(events.DESTROY, () => {
    if (typeof window !== "undefined") {
      for (const type of POINTER_EVENTS) window.removeEventListener(type, onPointer, { capture: true });
      for (const type of KEY_EVENTS) window.removeEventListener(type, onKey, { capture: true });
      window.removeEventListener("resize", wake);
    }
    canvasListeners(boundCanvas, false);
    gates.delete(game);
  });
}
