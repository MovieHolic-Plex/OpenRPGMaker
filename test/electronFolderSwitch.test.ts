import { describe, expect, it, vi } from "vitest";
import { allowFolderSwitch, folderSwitchFlushOk, isAppRendererFrame } from "../electron/shared/folderSwitch";

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
