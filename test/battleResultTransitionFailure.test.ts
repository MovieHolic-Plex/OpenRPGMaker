/** @vitest-environment happy-dom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { PlayScene } from "@/player/PlayScene";
import { runEvent } from "@/player/playSceneInterpreter";
import { claimForeground, foregroundOwner } from "@/player/foregroundControl";
import { startSession } from "@/project/session";
import type { AudioTrackState } from "@/project/session";
import { mountBattleScene, type BattleDomOptions } from "@/player/battleDom";
import { createSkinBattleTransition } from "@/player/battleTransition";
import { bounded, deferred, encounterHarness, required } from "./fixtures/npcEncounterPipeline";

vi.mock("@/app/phaserRuntime", () => ({ getLoadedPhaser: () => ({ Scene: class {} }) }));
vi.mock("@/project/store", () => ({ store: { getCurrent: vi.fn() } }));
vi.mock("@/player/battleTransition", () => ({ createSkinBattleTransition: vi.fn() }));
// Mount real battle DOM/runtime; expose only its result-confirm callback and omit intro timing.
vi.mock("@/player/battleDom", async importOriginal => {
  const original = await importOriginal<typeof import("@/player/battleDom")>();
  return { ...original, mountBattleScene: vi.fn((options: BattleDomOptions) => original.mountBattleScene({ ...options, introHold: false })) };
});
let fixture: ReturnType<typeof encounterHarness> | undefined;
afterEach(() => {
  fixture?.scene.battleAbortController?.abort();
  fixture?.dispose(); fixture = undefined;
  document.body.replaceChildren(); vi.restoreAllMocks(); vi.unstubAllGlobals();
  vi.mocked(createSkinBattleTransition).mockReset();
  vi.mocked(mountBattleScene).mockClear();
});

async function setup(initialBgm: AudioTrackState = { resourceId: "cc0-bgm-rtp-fld-003", loop: true }) {
  const f = fixture = encounterHarness("parallel");
  f.page.trigger = { kind: "action" };
  const host = document.createElement("div"); document.body.append(host);
  const get = f.scene.game.registry.get.bind(f.scene.game.registry);
  vi.spyOn(f.scene.game.registry, "get").mockImplementation(key => key === "dialogueHost" ? host : get(key));
  f.scene.playBattle = PlayScene.prototype.playBattle.bind(f.scene);
  f.scene.showRuntimeOverlay = PlayScene.prototype.showRuntimeOverlay.bind(f.scene);
  f.scene.clearRuntimeOverlay = PlayScene.prototype.clearRuntimeOverlay.bind(f.scene);
  f.scene.session.audio.bgm = { ...initialBgm };
  const beforeAudio = structuredClone(f.scene.session.audio);
  const beforeGold = f.scene.session.gold;
  const mounted = deferred<BattleDomOptions>();
  const realDom = await vi.importActual<typeof import("@/player/battleDom")>("@/player/battleDom");
  vi.mocked(mountBattleScene).mockImplementation(options => {
    const controller = realDom.mountBattleScene({ ...options, introHold: false });
    mounted.resolve(options);
    return controller;
  });
  const entryDestroy = vi.fn();
  vi.mocked(createSkinBattleTransition).mockReturnValueOnce({
    cover: async () => undefined, reveal: async () => undefined, exit: async () => undefined, destroy: entryDestroy,
  });
  const pending = runEvent(f.scene, f.event.id);
  const battle = await bounded(mounted.promise);
  const runtimeCancel = vi.spyOn(battle.runtime, "cancel");
  const snapshot = battle.runtime.snapshot();
  const confirm = () => battle.onResult("victory", { ...snapshot, rewards: { ...snapshot.rewards, gold: 17 } });
  expect(host.querySelector('[data-testid="battle-scene"]')).not.toBeNull();
  expect(f.scene.running).toBe(true);
  expect(f.scene.inputEnabled).toBe(false);
  return { ...f, host, pending, confirm, beforeAudio, beforeGold, entryDestroy, runtimeCancel };
}

describe("result-confirm transition failure", () => {
  // 저작한 필드 볼륨은 전투를 한 번 거쳐도 살아 있어야 한다. exitBattleAudio 는 진입 때
  // 기억한 **전체** 트랙 기록을 쓴다 — 호출부가 resourceId 만 넘기면 폴백이 gain 을 안 실어
  // volume 0(음소거)·저음량이 기본 믹서 값으로 되돌아온다(2026-09-15 실측).
  it("keeps the authored field volume through the battle round trip", async () => {
    const f = await setup({ resourceId: "cc0-bgm-rtp-fld-003", loop: true, volume: 0 });
    vi.mocked(createSkinBattleTransition).mockReturnValueOnce({
      cover: async () => undefined, reveal: async () => undefined, exit: async () => undefined, destroy: vi.fn(),
    });
    f.confirm();
    await bounded(f.pending);
    expect(f.scene.session.audio.bgm).toEqual({ resourceId: "cc0-bgm-rtp-fld-003", loop: true, volume: 0 });
  });

  it.each(["factory-throw", "exit-throw", "exit-reject"] as const)("settles and releases the event after %s without committing victory", async kind => {
    const f = await setup();
    const error = new Error(kind);
    const exitDestroy = vi.fn();
    vi.mocked(createSkinBattleTransition).mockImplementationOnce(() => {
      if (kind === "factory-throw") throw error;
      return {
        cover: async () => undefined, reveal: async () => undefined, destroy: exitDestroy,
        exit: () => { if (kind === "exit-throw") throw error; return Promise.reject(error); },
      };
    });
    // This is the actual callback supplied to the mounted DOM, after result confirmation.
    // A synchronous escape strands its resultSent latch and the owning event promise.
    expect(f.confirm).not.toThrow();
    await bounded(f.pending);
    const notice = f.host.querySelector<HTMLElement>('[data-testid="runtime-error"]');
    expect(notice?.textContent).toBe(error.message); // injected machine sentinel, not shipped prose
    expect(notice?.hidden).toBe(false);
    expect(f.host.querySelector('[data-testid="battle-scene"]')).toBeNull();
    expect(f.entryDestroy).toHaveBeenCalledTimes(1);
    expect(exitDestroy).toHaveBeenCalledTimes(kind === "factory-throw" ? 0 : 1);
    expect(f.runtimeCancel).toHaveBeenCalled();
    expect(f.scene.session.audio).toEqual(f.beforeAudio);
    expect(f.scene.session.gold).toBe(f.beforeGold);
    expect(f.scene.session.battleResult).toBeUndefined();
    expect(f.scene.session.flags.encounterComplete).not.toBe(true);
    expect(f.scene.session.selfSwitches?.trainer?.A).not.toBe(true);
    expect(f.scene.battleAbortController).toBeUndefined();
    expect(foregroundOwner(f.scene)).toBeUndefined();
    expect(f.scene.running).toBe(false);
    expect(f.scene.inputEnabled).toBe(true);
  });

  it.each(["cancel", "session"] as const)("ignores a late exit rejection after %s without touching a replacement owner", async change => {
    const f = await setup();
    const entered = deferred<void>();
    let rejectExit: (error: Error) => void = () => { throw new Error("Exit not initialized"); };
    const exit = new Promise<void>((_, reject) => { rejectExit = reject; });
    const exitDestroy = vi.fn();
    vi.mocked(createSkinBattleTransition).mockReturnValueOnce({
      cover: async () => undefined, reveal: async () => undefined, destroy: exitDestroy,
      exit: () => { entered.resolve(); return exit; },
    });
    f.confirm(); await bounded(entered.promise);
    const oldSession = f.scene.session;
    if (change === "session") f.scene.session = startSession(f.project);
    required(f.scene.battleAbortController).abort();
    f.scene.running = false; f.scene.inputEnabled = true;
    const replacement = required(claimForeground(f.scene));
    f.scene.session.audio.bgm = { resourceId: "replacement-audio", loop: true };
    f.scene.session.battleResult = "escape";
    const replacementState = structuredClone(f.scene.session);
    await bounded(f.pending);
    rejectExit(new Error("late-exit-rejection"));
    await bounded(exit.catch(() => undefined));
    expect(f.scene.session).toEqual(replacementState);
    expect(oldSession.gold).toBe(f.beforeGold);
    expect(f.host.querySelector('[data-testid="runtime-error"]')).toBeNull();
    expect(f.host.querySelector('[data-testid="battle-scene"]')).toBeNull();
    expect(f.entryDestroy).toHaveBeenCalledTimes(1);
    expect(exitDestroy).toHaveBeenCalledTimes(1);
    expect(foregroundOwner(f.scene)).toBe(replacement);
    expect(f.scene.running).toBe(true); expect(f.scene.inputEnabled).toBe(false);
    replacement.release();
  });
});
