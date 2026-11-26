import { describe, expect, it, vi } from "vitest";
import { allowFolderSwitch, folderSwitchFlushOk, isAppRendererFrame } from "../electron/shared/folderSwitch";
import { planWindowReload, reloadFlushAllowsReload } from "../electron/shared/reloadFlow";
import { isolateTimers } from "./mergedTeardown";

describe("electronFolderSwitch", () => {
  isolateTimers();
  describe("folder switch flush", () => {
    it("accepts a settled save with nothing left dirty", () => {
      expect(folderSwitchFlushOk({ kind: "saved", dirty: false })).toBe(true);
      expect(folderSwitchFlushOk({ kind: "saved-local", dirty: false })).toBe(true);
      expect(folderSwitchFlushOk({ kind: "not-loaded", dirty: false })).toBe(true);
      expect(folderSwitchFlushOk({ kind: "not-configured", dirty: false })).toBe(true);
      expect(folderSwitchFlushOk({ kind: "disabled", dirty: false })).toBe(true);
    });

    it.each(["blocked", "timeout"] as const)("continues after %s only on explicit discard", async result => {
      const confirm = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
      expect(await allowFolderSwitch(result, confirm)).toBe(false);
      expect(await allowFolderSwitch(result, confirm)).toBe(true);
      expect(confirm).toHaveBeenCalledWith(result);
      expect(await allowFolderSwitch("closed", confirm)).toBe(false);
      expect(await allowFolderSwitch("unavailable", confirm)).toBe(false);
      expect(confirm).toHaveBeenCalledTimes(2);
    });

    it("refuses a save that left changes, a conflict, or a bad report", () => {
      expect(folderSwitchFlushOk({ kind: "saved", dirty: true })).toBe(false);
      expect(folderSwitchFlushOk({ kind: "conflict", dirty: false })).toBe(false);
      expect(folderSwitchFlushOk({ kind: "error", dirty: true })).toBe(false);
      expect(folderSwitchFlushOk({ kind: "saved" })).toBe(false);
      expect(folderSwitchFlushOk({ dirty: false })).toBe(false);
      expect(folderSwitchFlushOk(null)).toBe(false);
      expect(folderSwitchFlushOk("saved")).toBe(false);
    });
  });
  describe("app renderer frame", () => {
    it("trusts the app scheme and the dev server origin only", () => {
      expect(isAppRendererFrame("app://oprn/index.html", undefined)).toBe(true);
      expect(isAppRendererFrame("http://127.0.0.1:9999/index.html", "http://127.0.0.1:9999/")).toBe(true);
      expect(isAppRendererFrame("http://127.0.0.1:9998/index.html", "http://127.0.0.1:9999/")).toBe(false);
      expect(isAppRendererFrame("https://example.com/", "http://127.0.0.1:9999/")).toBe(false);
      expect(isAppRendererFrame("http://127.0.0.1:9999/", undefined)).toBe(false);
      expect(isAppRendererFrame("not a url", "http://[")).toBe(false);
    });
  });
});

describe("electronReloadFlow", () => {
  isolateTimers();
  describe("reload saves the open project before the view menu refreshes", () => {
    const ready = { hasSession: true, flushListenerReady: true, closeFlushInProgress: false, reloadFlushInProgress: false };

    it("refreshes immediately when there is nothing in renderer memory to save", () => {
      expect(planWindowReload({ ...ready, hasSession: false })).toBe("reload-now");
      expect(planWindowReload({ ...ready, flushListenerReady: false })).toBe("reload-now");
    });

    it("saves first when a project is open and the editor is listening", () => {
      expect(planWindowReload(ready)).toBe("flush-then-reload");
    });

    it("does not start a second save while a close or a reload save is already running", () => {
      expect(planWindowReload({ ...ready, closeFlushInProgress: true })).toBe("ignore");
      expect(planWindowReload({ ...ready, reloadFlushInProgress: true })).toBe("ignore");
    });

    it("refreshes only after the save left the editor clean", () => {
      for (const kind of ["saved", "saved-local", "not-loaded", "not-configured", "disabled"]) {
        expect(reloadFlushAllowsReload(kind, false)).toBe(true);
        expect(reloadFlushAllowsReload(kind, true)).toBe(false);
      }
      expect(reloadFlushAllowsReload("conflict", false)).toBe(false);
      expect(reloadFlushAllowsReload("error", false)).toBe(false);
    });
  });
});
