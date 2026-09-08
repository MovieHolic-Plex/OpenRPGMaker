/** @vitest-environment happy-dom */
import { EventEmitter, once } from "node:events";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PlayScene } from "@/player/PlayScene";
import { createDialogueUI } from "@/player/dialogue";
import { createBlankProject } from "@/project/defaults";
import { normalizeItemRecord } from "@/project/databaseRecordModel";
import { startSession } from "@/project/session";
import { store } from "@/project/store";
import type { GameEvent } from "@/project/types";

vi.mock("@/app/phaserRuntime", () => ({ getLoadedPhaser: () => ({ Scene: class {} }) }));

const previousProject = store.getCurrent();
const cleanups: Array<() => void> = [];
beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup();
  vi.clearAllTimers();
  vi.restoreAllMocks();
  vi.useRealTimers();
  document.body.replaceChildren();
  store.replaceProject(previousProject);
});

type Path = "gift" | "no-items" | "talk-feedback" | "original-talk";
function setup(path: Path) {
  const project = createBlankProject();
  project.system.giftSystem = path === "gift" || path === "no-items";
  project.database.items.push(normalizeItemRecord({ id: "present", name: "Present", scope: "none", price: 1 }));
  const event: GameEvent = {
    id: "npc", characterId: "friend", x: 1, y: 1, trigger: { kind: "action" },
    giftPrefs: { loved: ["present"] }, talkFriendship: true,
    commands: path === "original-talk" ? [
      { kind: "text", body: "Original" },
      { kind: "setSwitch", switchId: "oldTail", value: true },
    ] : [],
  };
  const map = project.maps[project.startMapId]!;
  map.events = [event, {
    id: "replacement", x: 2, y: 1, trigger: { kind: "action" },
    commands: [{ kind: "text", body: "Replacement" }, { kind: "setSwitch", switchId: "newTail", value: true }],
  }];
  store.replaceProject(project);
  const host = document.createElement("div");
  document.body.append(host);
  const dialogue = createDialogueUI(host);
  cleanups.push(() => dialogue.hide());
  const surfaces = new EventEmitter();
  const showText = dialogue.showText.bind(dialogue);
  vi.spyOn(dialogue, "showText").mockImplementation(request => {
    const result = showText(request);
    surfaces.emit("text", request);
    return result;
  });
  const close = vi.spyOn(dialogue, "close");
  const events = new EventEmitter();
  let active = true;
  const scene = Object.assign(new PlayScene(), {
    session: startSession(project, 7), map, events, sys: { isActive: () => active },
    game: { registry: { get: (key: string) => key === "dialogue" ? dialogue : key === "dialogueHost" ? host : undefined } },
    setInputEnabled: vi.fn((value: boolean): void => { scene.inputEnabled = value; }),
    refreshRuntimeSurfaces: vi.fn(), syncRuntimeState: vi.fn(), clearRuntimeOverlay: vi.fn(),
  });
  scene.session.inventory = path === "gift" ? { present: 2 } : {};
  // Model the lifecycle owner's hard cut, not a rejected showText mock.
  for (const event of ["shutdown", "destroy"]) events.once(event, () => { active = false; dialogue.hide(); });
  async function start() {
    const text = once(surfaces, "text");
    const execution = scene.runEvent("npc");
    // Observe rejection immediately: RED must report a contract failure, not leak
    // an unhandled rejection into the next scenario. Keep the pending promise boxed.
    const settled = execution.then(() => ({ resolved: true }), (error: unknown) => ({ resolved: false, error }));
    if (project.system.giftSystem) {
      const itemMounted = path === "gift" ? new Promise<void>(resolve => {
        const observer = new MutationObserver(() => {
          if (!host.querySelector(".runtime-gift-item")) return;
          observer.disconnect(); resolve();
        });
        observer.observe(host, { childList: true, subtree: true });
        cleanups.push(() => observer.disconnect());
      }) : undefined;
      press("ArrowDown"); press("Enter");
      if (itemMounted) { await itemMounted; press("Enter"); }
    }
    await text;
    return { settled };
  }
  return { project, scene, host, dialogue, close, surfaces, events, start };
}

function press(key: string) {
  (document.activeElement ?? document).dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
}
async function acknowledge() {
  await vi.runAllTimersAsync();
  press("Enter");
}

const paths: Path[] = ["gift", "no-items", "talk-feedback", "original-talk"];
describe.each(paths)("%s cancellation through public runEvent", path => {
  it.each(["replacement", "shutdown", "destroy"] as const)("preserves ownership on %s", async mode => {
    const f = setup(path);
    const oldSession = f.scene.session;
    const { settled } = await f.start();
    let replacement: Promise<unknown> | undefined;
    if (mode === "replacement") {
      f.scene.session = startSession(f.project, 8);
      f.scene.running = false;
      f.scene.setInputEnabled(true);
      // The new event uses the SAME DialogueUI, as an in-game load does.
      // showText takeover really rejects the old text before its microtask resumes.
      replacement = f.scene.runEvent("replacement").then(() => "done", (error: unknown) => error);
    } else {
      f.events.emit(mode);
    }
    f.scene.lastActionTargetKey = "new-owner";
    const snapshot = structuredClone(f.scene.session);
    const oldSnapshot = structuredClone(oldSession);
    f.close.mockClear();
    f.scene.setInputEnabled.mockClear();
    f.scene.refreshRuntimeSurfaces.mockClear();
    f.scene.syncRuntimeState.mockClear();
    const box = f.host.querySelector(".dialogue-box");
    const unexpectedText = once(f.surfaces, "text");
    const result = await Promise.race([
      settled.then(outcome => ({ kind: "settled", outcome })),
      unexpectedText.then(() => ({ kind: "stale-text" })),
    ]);
    try {
      expect.soft(result).toEqual({ kind: "settled", outcome: { resolved: true } });
      expect.soft(f.scene.session).toEqual(snapshot);
      expect.soft(oldSession).toEqual(oldSnapshot);
      expect.soft(f.scene.running).toBe(true);
      expect.soft(f.scene.inputEnabled).toBe(false);
      expect.soft(f.scene.lastActionTargetKey).toBe("new-owner");
      expect.soft(f.close).not.toHaveBeenCalled();
      expect.soft(f.scene.setInputEnabled).not.toHaveBeenCalled();
      expect.soft(f.scene.refreshRuntimeSurfaces).not.toHaveBeenCalled();
      expect.soft(f.scene.syncRuntimeState).not.toHaveBeenCalled();
      expect.soft(f.host.querySelector(".dialogue-box")).toBe(box);
      if (mode === "replacement" && result.kind === "settled") {
        await acknowledge();
        expect.soft(await replacement).toBe("done");
        expect.soft(f.scene.session.switches.newTail).toBe(true);
      }
    } finally {
      // Also settle any erroneous social follow-up on RED; no pending UI escapes.
      f.dialogue.hide();
      await settled;
      await replacement;
      f.surfaces.removeAllListeners();
    }
  });

  it("completes normally and keeps social effects action-scoped", async () => {
    const f = setup(path);
    const { settled } = await f.start();
    if (path === "original-talk") {
      const feedback = once(f.surfaces, "text");
      await acknowledge();
      await feedback;
      expect(f.scene.session.switches.oldTail).toBe(true);
    }
    await acknowledge();
    expect(await settled).toEqual({ resolved: true });
    expect(f.scene.running).toBe(false);
    expect(f.scene.inputEnabled).toBe(true);
    expect(f.scene.session.friendship?.friend ?? 0).toBe(path === "gift" ? 80 : path === "no-items" ? 0 : 10);
    expect(f.scene.session.inventory.present ?? 0).toBe(path === "gift" ? 1 : 0);
    expect(Boolean(f.scene.session.dailyGifts?.friend)).toBe(path === "gift");
    expect(Boolean(f.scene.session.dailyTalks?.friend)).toBe(path === "talk-feedback" || path === "original-talk");
  });
});

describe("public runEvent error boundary", () => {
  it.each(["active", "replacement", "shutdown"] as const)("propagates genuine text failures on %s", async mode => {
    const f = setup("talk-feedback");
    const failure = new Error("Injected renderer failure");
    vi.spyOn(f.dialogue, "showText").mockImplementation(() => {
      if (mode === "replacement") f.scene.session = startSession(f.project, 8);
      if (mode === "shutdown") f.events.emit("shutdown");
      return Promise.reject(failure);
    });
    await expect(f.scene.runEvent("npc")).rejects.toBe(failure);
  });

  it("does not classify active-scene AbortError as lifecycle cancellation", async () => {
    const f = setup("talk-feedback");
    const { settled } = await f.start();
    f.dialogue.hide();
    expect(await settled).toMatchObject({ resolved: false, error: { name: "AbortError" } });
    expect(f.scene.running).toBe(false);
    expect(f.scene.inputEnabled).toBe(true);
  });
});
