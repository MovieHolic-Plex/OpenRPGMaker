/** @vitest-environment happy-dom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const modeMocks = vi.hoisted(() => ({
  startPlayGame: vi.fn(),
  destroyGame: vi.fn(),
}));

vi.mock("@/app/mode", () => modeMocks);
vi.mock("@/assets/bundledAssetWarmup", () => ({ warmBundledPlayAssets: vi.fn() }));
// 연출(주스)·BGM 은 이 테스트의 검증 대상이 아니고 타이머/오디오 노이즈만 만든다.
vi.mock("@/player/runtimeJuice", () => ({ emitRuntimeJuice: vi.fn(() => ({})) }));
vi.mock("@/player/audio", () => ({
  AUDIO_HANDOFF_REGISTRY_KEY: "oprn:test-audio-handoff",
  getAudioEngine: vi.fn(() => ({ setQaInstrumentation: vi.fn() })),
  playAudioCommand: vi.fn(),
  stopAudioCommand: vi.fn(),
  // renderTitle 은 새 진입에서 stopAllAudio() 를 부른다 — 목에 없으면 타이틀 복귀가 예외로 죽는다.
  stopAllAudio: vi.fn(),
}));

import { renderPlayer, teardownPlayer, type PlayerRunControls } from "@/player/player";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { LocalDiagnosticSession } from "@/util/localDiagnosticSession";
import { clearRecentPlayBootDiagnosticsForTest, listRecentPlayBootDiagnostics } from "@/player/playBootDiagnostics";
import type { StartPlayGameOptions } from "@/app/mode";

const diagnostics = new LocalDiagnosticSession();

type FakeScene = {
  applySession: () => void;
  getSession: () => undefined;
  refreshRuntimeSurfaces: () => void;
  sys: { settings: { status: number } };
};

type FakeGame = {
  destroy: ReturnType<typeof vi.fn>;
  registry: { set: ReturnType<typeof vi.fn> };
  events: { once: () => void; off: () => void };
  scene: { getScene: () => FakeScene };
};

let bootWaiters: Array<() => void> = [];
let bootCount = 0;
let destroyedGames = 0;

function fakeGame(): FakeGame {
  const scene: FakeScene = {
    applySession: () => undefined,
    getSession: () => undefined,
    refreshRuntimeSurfaces: () => undefined,
    // RUNNING(5) 이면 waitForPlaySceneReady 가 폴링/타임아웃 없이 즉시 통과한다.
    sys: { settings: { status: 5 } },
  };
  return {
    destroy: vi.fn(() => {
      destroyedGames += 1;
    }),
    registry: { set: vi.fn() },
    events: { once: () => undefined, off: () => undefined },
    scene: { getScene: () => scene },
  };
}

/** 다음 런의 boot 성공 신호를 미리 구독한다 — 고정 sleep 없이 부팅 완료를 기다린다. */
function nextBoot(): Promise<void> {
  return new Promise<void>((resolve) => {
    bootWaiters.push(resolve);
  });
}

function onPlayBootSuccess(): void {
  bootCount += 1;
  for (const resolve of bootWaiters.splice(0)) resolve();
}

function titleScreen(main: HTMLElement): HTMLElement | null {
  return main.querySelector<HTMLElement>("[data-testid='title-screen']");
}

/** 지금 커서가 놓인 타이틀 항목의 글자. */
function selectedTitleLabel(root: HTMLElement): string | null {
  const option = Array.from(root.querySelectorAll<HTMLElement>(".rm-title-menu-button"))
    .find((button) => button.getAttribute("aria-current") === "true");
  return option ? (option.textContent ?? "").trim() : null;
}

function pressKey(key: string): void {
  document.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
}

let main: HTMLElement;
let controls: PlayerRunControls | null = null;

beforeEach(() => {
  bootWaiters = [];
  bootCount = 0;
  destroyedGames = 0;
  controls = null;
  store.replaceProject(createBlankProject());
  modeMocks.startPlayGame.mockReset();
  modeMocks.startPlayGame.mockImplementation(async () => fakeGame());
  main = document.createElement("div");
  document.body.append(main);
});

afterEach(() => {
  diagnostics.clear();
  clearRecentPlayBootDiagnosticsForTest();
  teardownPlayer();
  main.remove();
  vi.restoreAllMocks();
});

function render(options: Parameters<typeof renderPlayer>[1] = {}): void {
  renderPlayer(main, {
    trackGlobalGame: false,
    onPlayBootSuccess,
    onRunControlsReady: (ready) => {
      controls = ready;
    },
    ...options,
  });
}

describe("renderPlayer run controls", () => {
  it.each(["same-session", "replacement", "initially-disabled"] as const)(
    "owns deferred ready callbacks in the %s diagnostic session", async transition => {
      if (transition !== "initially-disabled") diagnostics.start(true, ["asset"]);
      let complete!: (game: FakeGame) => void;
      const pending = new Promise<FakeGame>(resolve => { complete = resolve; });
      modeMocks.startPlayGame.mockReturnValue(pending);
      const booted = nextBoot();
      render({ autoStartRun: true });
      const callbacks: StartPlayGameOptions = modeMocks.startPlayGame.mock.calls[0]![2];
      if (transition !== "same-session") { diagnostics.clear(); diagnostics.start(true, ["asset"]); }

      callbacks.onPlayLoadStage?.("ready");
      complete(fakeGame());
      await booted;

      const receipts = diagnostics.snapshot().receipts;
      if (transition === "same-session") {
        expect(receipts).toHaveLength(2);
        for (const receipt of receipts) expect(receipt).toMatchObject({ category: "asset", phase: "ready", ok: true });
      } else expect(receipts).toEqual([]);
      expect(listRecentPlayBootDiagnostics().filter(row => row.stage === "ready")).toHaveLength(2);
      expect(main.querySelector("[data-testid='play-loading-overlay']")).toBeNull();
    },
  );

  it.each(["same-session", "replacement", "initially-disabled"] as const)(
    "owns a rejected boot in the %s diagnostic session without changing raw failure delivery", async transition => {
      if (transition !== "initially-disabled") diagnostics.start(true, ["asset"]);
      let fail!: (error: Error) => void;
      modeMocks.startPlayGame.mockReturnValue(new Promise((_resolve, reject) => { fail = reject; }));
      let failureDelivered!: () => void;
      const delivered = new Promise<void>(resolve => { failureDelivered = resolve; });
      render({ autoStartRun: true, diagnosticSink: payload => {
        if (payload.stage === "error") failureDelivered();
      } });
      if (transition !== "same-session") { diagnostics.clear(); diagnostics.start(true, ["asset"]); }

      fail(new Error("private boot failure"));
      await delivered;

      const receipts = diagnostics.snapshot().receipts;
      if (transition === "same-session") {
        expect(receipts).toEqual([{ category: "asset", phase: "error", ok: false, sequence: 1,
          elapsedMs: expect.any(Number), provenance: "runtime", evidence: "observed", savedGeneration: null }]);
      } else expect(receipts).toEqual([]);
      expect(listRecentPlayBootDiagnostics()[0]).toMatchObject({ stage: "error", ok: false, errorMessage: "private boot failure" });
      expect(main.querySelector("[data-testid='play-recovery-panel']")).not.toBeNull();
    },
  );

  it("boots straight into a run when auto start is on", async () => {
    const booted = nextBoot();

    render({ autoStartRun: true });
    await booted;

    expect(titleScreen(main)).toBeNull();
    expect(bootCount).toBe(1);
    expect(modeMocks.startPlayGame).toHaveBeenCalledTimes(1);
    expect(main.querySelector("[data-testid='play-canvas']")).not.toBeNull();
  });

  it("still shows the title screen when auto start is off", () => {
    render({ autoStartRun: false });

    expect(titleScreen(main)).not.toBeNull();
    expect(modeMocks.startPlayGame).not.toHaveBeenCalled();
  });

  it("restarts the current run through the exposed controls", async () => {
    const firstBoot = nextBoot();
    render({ autoStartRun: true });
    await firstBoot;

    const secondBoot = nextBoot();
    controls?.restartRun();
    await secondBoot;

    expect(bootCount).toBe(2);
    expect(modeMocks.startPlayGame).toHaveBeenCalledTimes(2);
    // 이전 런의 Phaser 게임은 재시작 시 파괴돼야 한다(타이머/리스너 누수 방지).
    expect(destroyedGames).toBe(1);
    expect(titleScreen(main)).toBeNull();
  });

  it("returns to the title screen through the exposed controls", async () => {
    const booted = nextBoot();
    render({ autoStartRun: true });
    await booted;

    controls?.returnToTitle();

    expect(titleScreen(main)).not.toBeNull();
    expect(destroyedGames).toBe(1);
  });

  it("puts the title cursor back on the first option when the title is entered again", () => {
    // F1(2026-10-23): 커서를 아래 항목으로 내려 둔 판에서 게임 오버로 타이틀에 돌아오면 Enter 가
    // 새 게임이 아니라 그 항목(보통 「이어하기」)을 눌러 죽은 판의 오토세이브로 되돌아갔다.
    // 타이틀에 **새로 들어올 때** 커서는 언제나 첫 항목(새 게임)이어야 한다.
    render({ autoStartRun: false });
    const first = selectedTitleLabel(main);
    expect(first).toBe("새 게임");

    pressKey("ArrowDown");
    const moved = selectedTitleLabel(main);
    expect(moved).not.toBeNull();
    expect(moved).not.toBe(first);

    controls?.returnToTitle();

    expect(selectedTitleLabel(main)).toBe(first);
  });

  it("marks both the title and the run surface with the requested scale mode", async () => {
    render({ autoStartRun: false, surfaceScaleMode: "fit" });

    expect(main.querySelector<HTMLElement>("[data-testid='play-viewport']")?.dataset.scaleMode).toBe("fit");

    const booted = nextBoot();
    controls?.restartRun();
    await booted;

    expect(main.querySelector<HTMLElement>("[data-testid='play-viewport']")?.dataset.scaleMode).toBe("fit");
  });

  it("keeps the integer surface scale mode by default", () => {
    render({ autoStartRun: false });

    expect(main.querySelector<HTMLElement>("[data-testid='play-viewport']")?.dataset.scaleMode).toBe("integer");
  });

  it("ignores run controls after teardown so no new timers are created", async () => {
    const booted = nextBoot();
    render({ autoStartRun: true });
    await booted;

    teardownPlayer();
    controls?.restartRun();
    controls?.returnToTitle();

    expect(modeMocks.startPlayGame).toHaveBeenCalledTimes(1);
    expect(titleScreen(main)).toBeNull();
  });
});
