/** @vitest-environment happy-dom */
import { describe, expect, it, vi } from "vitest";
import { openEventMenu } from "@/player/playerEventMenus";
import { runCommands } from "@/player/playSceneInterpreter";
import { createBlankProject } from "@/project/defaults";
import { startSession } from "@/project/session";
import { store } from "@/project/store";
import type { PlaySceneContext } from "@/player/playSceneTypes";

describe("event menus block subsequent commands", () => {
  it.each([["m2-078-open-menu-screen", "openMenuScreen"], ["m2-093-open-load-menu", "openLoadMenu"]])("%s resumes only after closing its requested screen", async (id, callback) => {
    const project = createBlankProject(); store.replace(project);
    const session = startSession(project);
    const root = document.createElement("div"); document.body.append(root);
    const menu = document.createElement("div"); menu.dataset.testid = "main-menu";
    const show = vi.fn(() => openEventMenu(root, () => root.append(menu)));
    const save = vi.fn();
    const dialogue = { showText: vi.fn(), showChoices: vi.fn(), showNumberInput: vi.fn(), hide: vi.fn(), close: vi.fn() };
    const registry = new Map<string, unknown>([["dialogue", dialogue], [callback, show], ["openSaveMenu", save]]);
    const scene = {
      session, map: project.maps[project.startMapId], running: false, inputEnabled: true,
      game: { registry: { get: (key: string) => registry.get(key) } },
      setInputEnabled: vi.fn(), refreshRuntimeSurfaces: vi.fn(), syncRuntimeState: vi.fn(),
      clearRuntimeOverlay: vi.fn(), showRuntimeOverlay: vi.fn(),
    } as unknown as PlaySceneContext;
    try {
      const pending = runCommands(scene, [
        { kind: "m2Command", commandId: id!, fields: {} },
        { kind: "setSwitch", switchId: "after", value: true },
      ]);
      expect(show).toHaveBeenCalledOnce();
      expect(save).not.toHaveBeenCalled();
      expect(session.switches.after).not.toBe(true);
      await Promise.resolve();
      expect(session.switches.after).not.toBe(true);
      menu.remove();
      await pending;
      expect(session.switches.after).toBe(true);
    } finally { root.remove(); }
  });

  it("resolves when the player is removed without leaking an observer", async () => {
    const root = document.createElement("div"); document.body.append(root);
    const pending = openEventMenu(root, () => { root.innerHTML = '<div data-testid="main-menu"></div>'; });
    root.remove();
    await pending;
  });

  it("loading abandons the old event without closing a new session's dialogue or unlocking it", async () => {
    const project = createBlankProject(); store.replace(project);
    const oldSession = startSession(project), newSession = startSession(project);
    const close = vi.fn(), input = vi.fn();
    const dialogue = { showText: vi.fn(), showChoices: vi.fn(), showNumberInput: vi.fn(), hide: vi.fn(), close };
    const scene = {
      session: oldSession, map: project.maps[project.startMapId], running: false, inputEnabled: true,
      game: { registry: { get: (key: string) => key === "dialogue" ? dialogue : async () => {
        scene.session = newSession; scene.running = true;
      } } },
      setInputEnabled: input, refreshRuntimeSurfaces: vi.fn(), syncRuntimeState: vi.fn(),
      clearRuntimeOverlay: vi.fn(), showRuntimeOverlay: vi.fn(),
    } as unknown as PlaySceneContext;
    await runCommands(scene, [
      { kind: "m2Command", commandId: "m2-093-open-load-menu", fields: {} },
      { kind: "setSwitch", switchId: "stale", value: true },
    ]);
    expect(oldSession.switches.stale).not.toBe(true);
    expect(newSession.switches.stale).not.toBe(true);
    expect(scene.running).toBe(true);
    expect(close).not.toHaveBeenCalled();
    expect(input).not.toHaveBeenCalledWith(true);
  });
});
