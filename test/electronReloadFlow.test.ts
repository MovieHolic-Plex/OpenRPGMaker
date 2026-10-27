import { describe, expect, it } from "vitest";
import { planWindowReload, reloadFlushAllowsReload } from "../electron/shared/reloadFlow";

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
