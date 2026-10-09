import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  auxCompositeKey,
  bindAuxDetails,
  getAuxOpen,
  getAuxOpenSet,
  isAuxOpen,
  setAuxOpen,
  setAuxClosed,
  syncAuxHosts,
} from "@/editor/panels/eventEditor/auxOpenController";
import { installFakeDom } from "./fakeDom";

describe("auxOpenController non-exclusive preview+flow", () => {
  let restoreDom: (() => void) | undefined;

  beforeEach(() => {
    restoreDom = installFakeDom();
  });

  afterEach(() => {
    restoreDom?.();
  });

  it("AI is exclusive — closes preview and flow when opened", () => {
    const key = auxCompositeKey("map_a", "ev_1", "p1");
    const ai = document.createElement("details");
    const preview = document.createElement("details");
    const flow = document.createElement("details");
    bindAuxDetails(key, "ai", ai);
    bindAuxDetails(key, "preview", preview);
    bindAuxDetails(key, "flow", flow);

    setAuxOpen(key, "preview");
    setAuxOpen(key, "flow");
    expect(preview.open).toBe(true);
    expect(flow.open).toBe(true);

    setAuxOpen(key, "ai");
    expect(ai.open).toBe(true);
    expect(preview.open).toBe(false);
    expect(flow.open).toBe(false);
  });

  it("preview and flow can be open simultaneously", () => {
    const key = auxCompositeKey("map_b", "ev_2", "p1");
    const ai = document.createElement("details");
    const preview = document.createElement("details");
    const flow = document.createElement("details");
    bindAuxDetails(key, "ai", ai);
    bindAuxDetails(key, "preview", preview);
    bindAuxDetails(key, "flow", flow);

    setAuxOpen(key, "preview");
    expect(preview.open).toBe(true);
    expect(flow.open).toBe(false);

    setAuxOpen(key, "flow");
    expect(preview.open).toBe(true);
    expect(flow.open).toBe(true);
    expect(ai.open).toBe(false);
  });

  it("closing preview does not close flow", () => {
    const key = auxCompositeKey("map_c", "ev_3", "p1");
    const ai = document.createElement("details");
    const preview = document.createElement("details");
    const flow = document.createElement("details");
    bindAuxDetails(key, "ai", ai);
    bindAuxDetails(key, "preview", preview);
    bindAuxDetails(key, "flow", flow);

    setAuxOpen(key, "preview");
    setAuxOpen(key, "flow");
    setAuxClosed(key, "preview");

    expect(preview.open).toBe(false);
    expect(flow.open).toBe(true);
  });

  it("opening preview closes AI but not flow", () => {
    const key = auxCompositeKey("map_d", "ev_4", "p1");
    const ai = document.createElement("details");
    const preview = document.createElement("details");
    const flow = document.createElement("details");
    bindAuxDetails(key, "ai", ai);
    bindAuxDetails(key, "preview", preview);
    bindAuxDetails(key, "flow", flow);

    setAuxOpen(key, "ai");
    expect(ai.open).toBe(true);

    setAuxOpen(key, "preview");
    expect(ai.open).toBe(false);
    expect(preview.open).toBe(true);
    expect(flow.open).toBe(false);

    setAuxOpen(key, "flow");
    expect(preview.open).toBe(true);
    expect(flow.open).toBe(true);
  });

  it("setAuxOpen(null) closes all panels", () => {
    const key = auxCompositeKey("map_e", "ev_5", "p1");
    const ai = document.createElement("details");
    const preview = document.createElement("details");
    const flow = document.createElement("details");
    bindAuxDetails(key, "ai", ai);
    bindAuxDetails(key, "preview", preview);
    bindAuxDetails(key, "flow", flow);

    setAuxOpen(key, "preview");
    setAuxOpen(key, "flow");
    setAuxOpen(key, null);

    expect(ai.open).toBe(false);
    expect(preview.open).toBe(false);
    expect(flow.open).toBe(false);
  });

  it("isAuxOpen checks individual panel state", () => {
    const key = auxCompositeKey("map_f", "ev_6", "p1");
    const ai = document.createElement("details");
    const preview = document.createElement("details");
    const flow = document.createElement("details");
    bindAuxDetails(key, "ai", ai);
    bindAuxDetails(key, "preview", preview);
    bindAuxDetails(key, "flow", flow);

    setAuxOpen(key, "preview");
    setAuxOpen(key, "flow");

    expect(isAuxOpen(key, "preview")).toBe(true);
    expect(isAuxOpen(key, "flow")).toBe(true);
    expect(isAuxOpen(key, "ai")).toBe(false);
  });

  it("getAuxOpenSet returns the full set of open panels", () => {
    const key = auxCompositeKey("map_g", "ev_7", "p1");
    const ai = document.createElement("details");
    const preview = document.createElement("details");
    const flow = document.createElement("details");
    bindAuxDetails(key, "ai", ai);
    bindAuxDetails(key, "preview", preview);
    bindAuxDetails(key, "flow", flow);

    setAuxOpen(key, "preview");
    setAuxOpen(key, "flow");

    const set = getAuxOpenSet(key);
    expect(set.has("preview")).toBe(true);
    expect(set.has("flow")).toBe(true);
    expect(set.has("ai")).toBe(false);
    expect(set.size).toBe(2);
  });

  it("syncAuxHosts restores open state after re-bind", () => {
    const key = auxCompositeKey("map_h", "ev_8", "p1");
    const ai = document.createElement("details");
    const preview = document.createElement("details");
    const flow = document.createElement("details");
    bindAuxDetails(key, "ai", ai);
    bindAuxDetails(key, "preview", preview);
    bindAuxDetails(key, "flow", flow);

    setAuxOpen(key, "preview");
    setAuxOpen(key, "flow");

    const preview2 = document.createElement("details");
    const flow2 = document.createElement("details");
    bindAuxDetails(key, "preview", preview2);
    bindAuxDetails(key, "flow", flow2);
    syncAuxHosts(key);

    expect(preview2.open).toBe(true);
    expect(flow2.open).toBe(true);
  });

  it("getAuxOpen returns primary open panel for backward compat", () => {
    const key = auxCompositeKey("map_i", "ev_9", "p1");
    const ai = document.createElement("details");
    const preview = document.createElement("details");
    const flow = document.createElement("details");
    bindAuxDetails(key, "ai", ai);
    bindAuxDetails(key, "preview", preview);
    bindAuxDetails(key, "flow", flow);

    setAuxOpen(key, "preview");
    setAuxOpen(key, "flow");
    expect(getAuxOpen(key)).toBe("preview");

    setAuxClosed(key, "preview");
    expect(getAuxOpen(key)).toBe("flow");

    setAuxClosed(key, "flow");
    expect(getAuxOpen(key)).toBe(null);
  });
});
