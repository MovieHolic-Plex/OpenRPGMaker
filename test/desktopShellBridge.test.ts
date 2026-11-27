// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import {
  desktopFilePathToSaveStorageKey,
  hydrateSavesFromDesktopHost,
  installDesktopShellBridge,
  quitDesktopPlayer,
  saveStorageKeyToDesktopFilePath,
} from "@/player/desktopShellBridge";

describe("desktopShellBridge save sync and quit", () => {
  afterEach(() => {
    delete window.__oprnDesktopPlayer;
    delete window.__oprnDesktopShellState;
    window.localStorage.clear();
  });

  it("maps save slots 1 through 20+, autosave, clear-record, and gallery-record bidirectionally", () => {
    for (let slot = 1; slot <= 25; slot += 1) {
      const padded = String(slot).padStart(2, "0");
      const storageKey = `steam-app-480-game:save-slot:v5:${slot}`;
      const filePath = `saves/slot-${padded}.oprn-save.json`;
      expect(saveStorageKeyToDesktopFilePath(storageKey)).toBe(filePath);
      expect(desktopFilePathToSaveStorageKey(filePath, "steam-app-480-game")).toBe(storageKey);
    }
    expect(saveStorageKeyToDesktopFilePath("ns:save-slot:v6:14")).toBe("saves/slot-14.oprn-save.json");
    expect(saveStorageKeyToDesktopFilePath("ns:save-slot:v5:auto")).toBe("saves/autosave.oprn-save.json");
    expect(desktopFilePathToSaveStorageKey("saves/autosave.oprn-save.json", "ns")).toBe("ns:save-slot:v5:auto");
    expect(desktopFilePathToSaveStorageKey("saves/clear-record.oprn-save.json", "ns")).toBe("ns:clear-record:v1");
    expect(desktopFilePathToSaveStorageKey("saves/gallery-record.oprn-save.json", "ns")).toBe("ns:gallery-record:v1");
  });

  it("hydrates missing and newer saves from disk, pushes newer local saves back, and ignores legacy placeholders", async () => {
    const ns = "shared-save-chrono";
    const diskFiles = new Map<string, string>([
      ["saves/slot-01.oprn-save.json", JSON.stringify({ schemaVersion: 5, savedAt: "2026-11-20T10:00:00.000Z", gold: 500 })],
      ["saves/slot-02.oprn-save.json", JSON.stringify({ schemaVersion: 5, savedAt: "2026-11-20T12:00:00.000Z", gold: 900 })],
      ["saves/slot-03.oprn-save.json", JSON.stringify({ schemaVersion: 5, savedAt: "2026-11-19T08:00:00.000Z", gold: 100 })],
      ["saves/slot-04.oprn-save.json", JSON.stringify({ schemaVersion: 5, status: "empty-slot-placeholder" })],
      ["saves/slot-12.oprn-save.json", JSON.stringify({ schemaVersion: 5, savedAt: "2026-11-21T01:00:00.000Z", gold: 1200 })],
    ]);
    const written: Array<{ path: string; content: string }> = [];

    window.__oprnDesktopPlayer = {
      listSaveFiles: async () => [...diskFiles.keys()],
      readSaveFile: async (path) => diskFiles.get(path) ?? null,
      writeSaveFile: async (path, content) => {
        written.push({ path, content });
        diskFiles.set(path, content);
      },
    };

    // slot-02 is older locally -> disk should win
    window.localStorage.setItem(
      `${ns}:save-slot:v5:2`,
      JSON.stringify({ schemaVersion: 5, savedAt: "2026-11-20T09:00:00.000Z", gold: 200 }),
    );
    // slot-03 is newer locally -> local should win and push to disk
    window.localStorage.setItem(
      `${ns}:save-slot:v5:3`,
      JSON.stringify({ schemaVersion: 5, savedAt: "2026-11-22T08:00:00.000Z", gold: 3333 }),
    );
    // autosave exists only locally -> should push to disk
    window.localStorage.setItem(
      `${ns}:save-slot:v5:auto`,
      JSON.stringify({ schemaVersion: 5, savedAt: "2026-11-22T09:00:00.000Z", gold: 4444 }),
    );

    const cleanup = installDesktopShellBridge(document.body, { enabled: true });
    try {
      const result = await hydrateSavesFromDesktopHost(ns, window.localStorage);
      expect(result.hydratedFiles).toEqual([
        "saves/slot-01.oprn-save.json",
        "saves/slot-02.oprn-save.json",
        "saves/slot-12.oprn-save.json",
      ]);
      expect(result.pushedFiles).toEqual([
        "saves/slot-03.oprn-save.json",
        "saves/autosave.oprn-save.json",
      ]);

      expect(JSON.parse(window.localStorage.getItem(`${ns}:save-slot:v5:1`)!).gold).toBe(500);
      expect(JSON.parse(window.localStorage.getItem(`${ns}:save-slot:v5:2`)!).gold).toBe(900);
      expect(JSON.parse(window.localStorage.getItem(`${ns}:save-slot:v5:3`)!).gold).toBe(3333);
      expect(window.localStorage.getItem(`${ns}:save-slot:v5:4`)).toBeNull();
      expect(JSON.parse(window.localStorage.getItem(`${ns}:save-slot:v5:12`)!).gold).toBe(1200);

      // Hydrating from disk must NOT echo writes back to disk
      expect(written.map((w) => w.path)).toEqual([
        "saves/slot-03.oprn-save.json",
        "saves/autosave.oprn-save.json",
      ]);
    } finally {
      cleanup();
    }
  });

  it("calls host quit when available and returns false when absent", async () => {
    expect(await quitDesktopPlayer()).toBe(false);
    let quitCalled = 0;
    window.__oprnDesktopPlayer = {
      quit: async () => {
        quitCalled += 1;
      },
    };
    expect(await quitDesktopPlayer()).toBe(true);
    expect(quitCalled).toBe(1);
  });
});
