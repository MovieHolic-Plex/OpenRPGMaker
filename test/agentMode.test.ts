// @vitest-environment happy-dom

import { afterEach, expect, it, vi, beforeEach, describe } from "vitest";
import { mountAgentModeDock } from "@/editor/agentMode/agentModeDock";
import { refreshAiConnectionStatus, resetAiConnectionStatusCache } from "@/editor/panels/aiConnectionStatus";
import { getMapEditHistoryState, resetMapEditHistory, undoMapEdit } from "@/editor/mapEditHistory";
import { callAgentModeTool, newAgentTurn } from "@/editor/agentMode/agentModeTools";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import type { Project } from "@/project/types";
import { isolateTimers } from "./mergedTeardown";

describe("agentModeChatGpt", () => {
  isolateTimers();
  let dispose: (() => void) | undefined;
  afterEach(() => {
    dispose?.();
    dispose = undefined;
    resetAiConnectionStatusCache();
    document.body.replaceChildren();
    localStorage.clear();
    vi.unstubAllGlobals();
  });
  it("uses the editor's companion composer when ChatGPT is ready and none of the local agents are installed", async () => {
    const detect = vi.fn(async () => ({
      agents: ["codex", "claude", "opencode"].map(id => ({
        id, label: id, cliFound: false, adapterFound: false, ready: false, installHint: "", loginHint: "",
      })),
      state: { running: false, busy: false, seq: 0 },
    }));
    const start = vi.fn();
    vi.stubGlobal("oprn", { agent: { detect, start, poll: () => new Promise(() => {}) } });
    vi.stubGlobal("fetch", async () => Response.json({ connected: true, authKind: "oauth" }));
    localStorage.setItem("oprn:ai-config", JSON.stringify({ providerId: "openai-codex", model: "gpt-6.2-sol" }));

    const host = document.createElement("div");
    document.body.append(host);
    dispose = mountAgentModeDock(host);
    await vi.waitFor(() => expect(detect).toHaveBeenCalled());
    const tab = host.querySelector<HTMLButtonElement>("[data-testid='agent-mode-tab-agent']")!;
    tab.click();
    await refreshAiConnectionStatus();
    expect(tab.getAttribute("aria-selected")).toBe("true");
    expect(tab.querySelector<HTMLElement>(".agent-mode-tab-setup")?.hidden).toBe(true);
    expect(tab.title).toBe("");
    expect(host.querySelector<HTMLElement>("[data-testid='agent-mode-chatgpt-ready']")?.hidden).toBe(false);
    expect(host.classList.contains("is-agent-mode")).toBe(false);
    expect(start).not.toHaveBeenCalled();

    const switchRoute = host.querySelector<HTMLButtonElement>("[data-testid='agent-mode-switch-route']")!;
    switchRoute.click();
    expect(host.classList.contains("is-agent-mode")).toBe(true);
    switchRoute.click();
    expect(host.classList.contains("is-agent-mode")).toBe(false);
  });
});

describe("agentModeTurnUndo", () => {
  isolateTimers();
  function firstMapId(project: Project): string {
    const id = Object.keys(project.maps)[0];
    if (!id) throw new Error("fixture project has no maps");
    return id;
  }
  function lowerTiles(): readonly number[] {
    const project = store.getCurrent();
    return project.maps[firstMapId(project)]!.lowerTiles;
  }
  describe("agent mode: one turn = one undo", () => {
    beforeEach(() => {
      store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
      store.replace(createBlankProject());
      resetMapEditHistory();
    });

    it("undoes every write of a turn with a single undo, and keeps the previous turn", async () => {
      const mapId = firstMapId(store.getCurrent());
      const original = [...lowerTiles()];

      const first = newAgentTurn("첫 턴");
      const a = await callAgentModeTool("paint_tiles", { mapId, layer: "lower", mode: "cells", tile: 1, cells: [{ x: 0, y: 0 }, { x: 1, y: 0 }] }, first);
      expect(a.isError).toBe(false);
      const afterFirstTurn = [...lowerTiles()];
      expect(afterFirstTurn).not.toEqual(original);

      const second = newAgentTurn("둘째 턴");
      const b = await callAgentModeTool("oprn_call", { name: "paint_tiles", args: { mapId, layer: "lower", mode: "cells", tile: 2, cells: [{ x: 3, y: 0 }] } }, second);
      const c = await callAgentModeTool("paint_tiles", { mapId, layer: "lower", mode: "cells", tile: 2, cells: [{ x: 5, y: 0 }] }, second);
      expect(b.isError).toBe(false);
      expect(c.isError).toBe(false);
      expect(lowerTiles()).not.toEqual(afterFirstTurn);

      expect(undoMapEdit()).toBe(true);
      expect([...lowerTiles()]).toEqual(afterFirstTurn);
      expect(undoMapEdit()).toBe(true);
      expect([...lowerTiles()]).toEqual(original);
      expect(getMapEditHistoryState().canUndo).toBe(false);
    });

    it("does not record history for read tools", async () => {
      const turn = newAgentTurn("읽기");
      const result = await callAgentModeTool("get_project_summary", {}, turn);
      expect(result.isError).toBe(false);
      expect(turn.recorded).toBe(false);
      expect(getMapEditHistoryState().canUndo).toBe(false);
    });
  });
});
