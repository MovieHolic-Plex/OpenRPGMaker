/** @vitest-environment happy-dom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mode = vi.hoisted(() => ({ startPlayGame: vi.fn(), destroyGame: vi.fn() }));
vi.mock("@/app/mode", () => mode);
vi.mock("@/project/store", () => import("@/player/exportProjectStoreShim"));
vi.mock("@/assets/bundledAssetWarmup", () => ({ warmBundledPlayAssets: vi.fn() }));
vi.mock("@/player/runtimeJuice", () => ({ emitRuntimeJuice: vi.fn() }));
vi.mock("@/player/audio", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/player/audio")>(),
  playAudioCommand: vi.fn(), stopAudioCommand: vi.fn(),
}));
import { EventEmitter } from "node:events";
import { showGameOverScreen, showEndingScreen } from "@/player/playSceneOverlays";
import { renderPlayer, teardownPlayer, type PlayerRunControls } from "@/player/player";
import { setExportedProject } from "@/player/exportProjectStoreShim";
import { createBlankProject } from "@/project/defaults";
import { startSession, type PlaySession } from "@/project/session";
const sequence = { enabled: true, skippable: true, scenes: [
  { id: "opening-1", kind: "text" as const, narration: "<b>opening</b>", durationMs: 0 },
] };
let main: HTMLElement;
let project: ReturnType<typeof createBlankProject>;
let controls: PlayerRunControls;
function key(key: string, repeat = false): KeyboardEvent {
  const event = new KeyboardEvent("keydown", { key, repeat, bubbles: true, cancelable: true });
  (document.activeElement ?? document).dispatchEvent(event);
  return event;
}
beforeEach(() => {
  vi.useFakeTimers();
  window.localStorage.clear();
  project = createBlankProject();
  project.system.opening = structuredClone(sequence);
  setExportedProject(project);
  main = document.createElement("main");
  document.body.append(main);
  mode.startPlayGame.mockReset();
  mode.startPlayGame.mockImplementation(async (_host: HTMLElement, session: PlaySession) => ({
    destroy: vi.fn(), registry: { set: vi.fn() }, events: { once: vi.fn(), off: vi.fn() },
    scene: { getScene: () => ({ session, getSession: () => session, applySession: vi.fn(),
      refreshRuntimeSurfaces: vi.fn(), sys: { settings: { status: 5 } } }) },
  }));
});
afterEach(() => { teardownPlayer(); main.remove(); vi.useRealTimers(); vi.restoreAllMocks(); });
describe("opening at the real player shell seam", () => {
  it("defers New Game boot until opening completes without input fallthrough", async () => {
    renderPlayer(main, { trackGlobalGame: false });
    key("Enter");
    await vi.advanceTimersByTimeAsync(180);
    expect(mode.startPlayGame).not.toHaveBeenCalled();
    expect(main.querySelector('[data-testid="cinematic-sequence"]')).not.toBeNull();
    expect(key("Enter", true).defaultPrevented).toBe(true);
    expect(mode.startPlayGame).not.toHaveBeenCalled();
    const fallthrough = vi.fn();
    document.addEventListener("keydown", fallthrough);
    key("Enter");
    await Promise.resolve();
    expect(fallthrough).not.toHaveBeenCalled();
    document.removeEventListener("keydown", fallthrough);
    expect(mode.startPlayGame).toHaveBeenCalledTimes(1);
    expect(main.querySelector('[data-testid="main-menu"]')).toBeNull();
  });
  it("runs autoStart and fresh restart but cancels stale openings on title return", async () => {
    renderPlayer(main, { autoStartRun: true, trackGlobalGame: false, onRunControlsReady: value => { controls = value; } });
    expect(mode.startPlayGame).not.toHaveBeenCalled();
    controls.restartRun();
    await vi.advanceTimersByTimeAsync(1100);
    expect(main.querySelectorAll('[data-testid="cinematic-sequence"]')).toHaveLength(1);
    controls.returnToTitle();
    await Promise.resolve();
    expect(mode.startPlayGame).not.toHaveBeenCalled();
    expect(main.querySelector('[data-testid="title-screen"]')).not.toBeNull();
  });
  it("lets the host skip the opening per run without reopening the player", async () => {
    let playOpening = false;
    renderPlayer(main, { autoStartRun: true, trackGlobalGame: false,
      shouldPlayOpening: () => playOpening, onRunControlsReady: value => { controls = value; } });
    // 오프닝을 끄면 곧장 런으로 들어간다 — 타이틀/세션 우회 없이도.
    expect(main.querySelector('[data-testid="cinematic-sequence"]')).toBeNull();
    expect(mode.startPlayGame).toHaveBeenCalledTimes(1);

    playOpening = true;
    controls.restartRun();
    // 같은 창에서 다시 켜면 다음 런부터 오프닝이 돌아온다.
    expect(main.querySelector('[data-testid="cinematic-sequence"]')).not.toBeNull();
    expect(mode.startPlayGame).toHaveBeenCalledTimes(1);
    await Promise.resolve();
  });
  it.each(["loaded", "test-here", "selected-event"] as const)("bypasses opening for %s", async kind => {
    const session = startSession(project);
    renderPlayer(main, { trackGlobalGame: false,
      ...(kind === "test-here" ? { startOverride: { mapId: project.startMapId, ...project.startPos } }
        : { initialSession: session, ...(kind === "selected-event" ? { initialEventTestId: "event-test" } : {}) }),
    });
    expect(mode.startPlayGame).toHaveBeenCalledTimes(1);
    expect(main.querySelector('[data-testid="cinematic-sequence"]')).toBeNull();
    await Promise.resolve();
  });
  it("never boots after teardown during opening or pending title confirmation", async () => {
    renderPlayer(main, { autoStartRun: true, trackGlobalGame: false });
    teardownPlayer();
    await Promise.resolve();
    expect(mode.startPlayGame).not.toHaveBeenCalled();
    renderPlayer(main, { trackGlobalGame: false });
    key("Enter");
    teardownPlayer();
    await vi.advanceTimersByTimeAsync(180);
    expect(main.querySelector('[data-testid="cinematic-sequence"]')).toBeNull();
    expect(mode.startPlayGame).not.toHaveBeenCalled();
  });
});

describe("game-over sequence lifecycle", () => {
  function terminal(checkpoint = true) {
    const events = new EventEmitter();
    const scene = {
      game: { registry: { get: () => main } }, events,
      hasCheckpoint: () => checkpoint, restoreCheckpoint: vi.fn(), returnToTitle: vi.fn(),
      input_: { releaseAllKeys: vi.fn() },
    };
    // Only the Phaser boundary is faked; DOM, cursor, playback and project store are real.
    return { scene: scene as unknown as Parameters<typeof showGameOverScreen>[0], events,
      restore: scene.restoreCheckpoint, title: scene.returnToTitle };
  }
  it("plays before the terminal menu and applies authored labels with event-message precedence", async () => {
    project.system.gameOver = { sequence, title: "<b>terminal</b>", message: "default-message",
      retryLabel: "retry-label", titleLabel: "title-label", backgroundResourceId: "oprn-title-field" };
    const { scene, restore } = terminal();
    showGameOverScreen(scene, "event-message");
    expect(main.querySelector('[data-testid="checkpoint-retry"]')).toBeNull();
    await vi.advanceTimersByTimeAsync(1100);
    expect(main.querySelector('[data-testid="cinematic-sequence"]')).not.toBeNull();
    key("Enter");
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(700);
    expect(restore).not.toHaveBeenCalled();
    expect(main.querySelector('.runtime-overlay-title')?.textContent).toBe(project.system.gameOver.title);
    expect(main.querySelector('.runtime-overlay-message')?.textContent).toBe("event-message");
    expect(main.querySelector('[data-testid="checkpoint-retry"]')?.textContent).toBe(project.system.gameOver.retryLabel);
    expect(main.querySelector('[data-testid="return-title"]')?.textContent).toBe(project.system.gameOver.titleLabel);
    expect(main.querySelector('b')).toBeNull();
    key("Enter", true);
    expect(restore).not.toHaveBeenCalled();
    key("Enter");
    await vi.advanceTimersByTimeAsync(400);
    expect(restore).toHaveBeenCalledTimes(1);
  });
  it("blocks early confirmation and cancels blackout recovery on shutdown", async () => {
    project.system.gameOver = { presentation: "blackout" };
    const { scene, events } = terminal();
    scene.recoverFromDefeat = vi.fn(() => true);
    showGameOverScreen(scene);
    key("Enter");
    await vi.advanceTimersByTimeAsync(1600);
    expect(main.querySelector(".blackout-message")).not.toBeNull();
    expect(main.querySelector('[data-testid="return-title"]')).toBeNull();
    events.emit("shutdown");
    await vi.advanceTimersByTimeAsync(10000);
    expect(scene.recoverFromDefeat).not.toHaveBeenCalled();
  });
  it("holds the ending, advances through credits once, and tears down on title return", async () => {
    const { scene, title } = terminal();
    showEndingScreen(scene, "Dawn", "Home again", { credits: "Story\nTravellers" });
    key("Enter");
    expect(title).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(3400);
    expect(main.querySelector(".ending-heading")?.textContent).toBe("Dawn");
    key("Enter");
    await vi.advanceTimersByTimeAsync(1400);
    expect(main.querySelector(".ending-credits-roll")?.textContent).toBe("Story\nTravellers");
    key("Enter");
    expect(main.querySelector(".ending-final-title")?.textContent).toBe("THE END");
    expect(title).not.toHaveBeenCalled();
    key("Enter", true);
    expect(title).not.toHaveBeenCalled();
    key("Enter");
    await vi.advanceTimersByTimeAsync(400);
    expect(title).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(200000);
    expect(main.querySelector('[data-testid="ending-screen"]')).toBeNull();
  });
  it("replaces old sequences and cancels them on shutdown without mounting a stale terminal", async () => {
    project.system.gameOver = { sequence };
    const { scene, events } = terminal();
    showGameOverScreen(scene);
    showGameOverScreen(scene);
    await vi.advanceTimersByTimeAsync(1100);
    expect(main.querySelectorAll('[data-testid="cinematic-sequence"]')).toHaveLength(1);
    events.emit("shutdown");
    await Promise.resolve();
    expect(main.querySelector('[data-testid="game-over-screen"]')).toBeNull();
    expect(events.listenerCount("shutdown")).toBe(0);
    expect(events.listenerCount("destroy")).toBe(0);
  });
  it("blocks the field immediately and reveals conditional choices after the result", async () => {
    project.system.gameOver = { message: "default-message" };
    const { scene, events } = terminal(false);
    showGameOverScreen(scene);
    expect(main.querySelector('[data-testid="checkpoint-retry"]')).toBeNull();
    expect(main.querySelector('[data-testid="return-title"]')).toBeNull();
    await vi.advanceTimersByTimeAsync(1800);
    expect(main.querySelector('.runtime-overlay-message')?.textContent).toBe(project.system.gameOver.message);
    expect(main.querySelector('.game-over-panel')).toBeNull();
    expect(main.querySelector('.game-over-screen')).not.toBeNull();
    const art = main.querySelector<HTMLImageElement>('.cinematic-background');
    expect(art?.src).toContain('Game%20Over.png');
    expect(main.querySelector<HTMLElement>('.game-over-heading')?.hidden).toBe(true);
    art?.dispatchEvent(new Event('error'));
    expect(main.querySelector<HTMLElement>('.game-over-heading')?.hidden).toBe(false);
    events.emit("destroy");
    expect(main.querySelector('[data-testid="game-over-screen"]')).toBeNull();
  });
});
