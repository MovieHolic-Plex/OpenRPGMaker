import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  auxCompositeKey,
  bindAuxDetails,
  getAuxOpen,
  setAuxOpen,
} from "@/editor/panels/eventEditor/auxOpenController";
import { installFakeDom } from "./fakeDom";

describe("auxOpenController exclusive accordion", () => {
  let restoreDom: (() => void) | undefined;

  beforeEach(() => {
    restoreDom = installFakeDom();
  });

  afterEach(() => {
    restoreDom?.();
  });

  it("opens only one panel and restores after re-bind", () => {
    const key = auxCompositeKey("map_a", "ev_1", "p1");
    const ai = document.createElement("details");
    const preview = document.createElement("details");
    const flow = document.createElement("details");
    bindAuxDetails(key, "ai", ai);
    bindAuxDetails(key, "preview", preview);
    bindAuxDetails(key, "flow", flow);

    setAuxOpen(key, "ai");
    expect(getAuxOpen(key)).toBe("ai");
    expect(ai.open).toBe(true);
    expect(preview.open).toBe(false);
    expect(flow.open).toBe(false);

    setAuxOpen(key, "preview");
    expect(getAuxOpen(key)).toBe("preview");
    expect(ai.open).toBe(false);
    expect(preview.open).toBe(true);
    expect(flow.open).toBe(false);

    setAuxOpen(key, "flow");
    expect(getAuxOpen(key)).toBe("flow");
    expect(ai.open).toBe(false);
    expect(preview.open).toBe(false);
    expect(flow.open).toBe(true);

    // re-bind hosts after remount should restore exclusive open
    const ai2 = document.createElement("details");
    const preview2 = document.createElement("details");
    const flow2 = document.createElement("details");
    bindAuxDetails(key, "ai", ai2);
    bindAuxDetails(key, "preview", preview2);
    bindAuxDetails(key, "flow", flow2);
    expect(getAuxOpen(key)).toBe("flow");
    expect(ai2.open).toBe(false);
    expect(preview2.open).toBe(false);
    expect(flow2.open).toBe(true);

    setAuxOpen(key, null);
    expect(getAuxOpen(key)).toBe(null);
    expect(ai2.open).toBe(false);
    expect(preview2.open).toBe(false);
    expect(flow2.open).toBe(false);
  });
});