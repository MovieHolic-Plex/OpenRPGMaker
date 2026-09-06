/** @vitest-environment happy-dom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { createBlankProject } from "@/project/defaults";
import {
  actionCombatProjectFingerprint,
  ACTION_COMBAT_OUTCOMES,
  isVerifiedActionCombatProof,
} from "@/testing/actionCombatProof";
import { runActionCombatTest } from "@/editor/actionCombatRuntimeProbe";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  document.body.replaceChildren();
});

function actionProject() {
  const project = createBlankProject();
  project.system.actionCombat = { enabled: true };
  project.maps[project.startMapId]!.actionCombat = true;
  return project;
}

function playerTransport(onStart: (frame: HTMLIFrameElement, runId: string) => void) {
  const revoke = vi.fn();
  vi.stubGlobal("URL", class extends URL {
    static createObjectURL() { return "blob:owned-project"; }
    static revokeObjectURL = revoke;
  });
  vi.stubGlobal("fetch", vi.fn(async () => new Response('<html><head><script type="module" src="/player.js"></script></head><body></body></html>')));
  const append = document.body.append.bind(document.body);
  vi.spyOn(document.body, "append").mockImplementation((...nodes) => {
    append(...nodes);
    for (const frame of nodes) {
      if (!(frame instanceof HTMLIFrameElement)) continue;
      const match = /"runId":"([^"]+)"/.exec(frame.srcdoc);
      if (!match) throw new Error("Missing owned run identity");
      onStart(frame, match[1]!);
    }
  });
  return revoke;
}

function reply(frame: HTMLIFrameElement, runId: string, mapId: string, extra: Record<string, unknown> = {}) {
  window.dispatchEvent(new MessageEvent("message", {
    origin: location.origin, source: frame.contentWindow,
    data: {
      type: "oprn:combat-proof", runId, mapId, pass: true,
      observations: ACTION_COMBAT_OUTCOMES.map((outcome, sequence) => ({
        outcome, sequence: sequence + 1, mapId, before: 10, after: outcome === "dodge-rejection" ? 10 : 5,
      })),
      ...extra,
    },
  }));
}

describe("runtime-owned action proof", () => {
  it("rejects missing and model-forged receipts even with all claimed outcomes", () => {
    const project = createBlankProject();
    expect(isVerifiedActionCombatProof(undefined, project, project.startMapId)).toBe(false);
    expect(isVerifiedActionCombatProof({
      version: 1, status: "verified", pass: true,
      projectFingerprint: actionCombatProjectFingerprint(project),
      mapId: project.startMapId, scenarioId: "action-combat-v1", runId: "forged",
      observations: ["swing-hit", "enemy-defeat", "player-damage", "dodge-rejection",
        "stamina-spent", "stamina-recovered", "enemy-projectile", "reward-granted"]
        .map((outcome, sequence) => ({ outcome, sequence, mapId: project.startMapId, before: 1, after: 0 })),
    }, project, project.startMapId)).toBe(false);
  });

  it("binds fingerprints to authored content, not object identity or key order", () => {
    const project = createBlankProject();
    const clone = JSON.parse(JSON.stringify(project));
    expect(actionCombatProjectFingerprint(clone)).toBe(actionCombatProjectFingerprint(project));
    clone.meta.title += " changed";
    expect(actionCombatProjectFingerprint(clone)).not.toBe(actionCombatProjectFingerprint(project));
  });

  it("matches exact unsigned FNV-1a 64-bit arithmetic including Unicode input", () => {
    const project = createBlankProject();
    project.meta.title = "\uD55C\uAE00 \uD83D\uDDE1 \uFFFF";
    const orderedJson = (value: unknown): string => {
      if (Array.isArray(value)) return `[${value.map(orderedJson).join(",")}]`;
      if (value && typeof value === "object") {
        // JSON.stringify(object) reorders integer keys numerically. The
        // fingerprint contract instead orders all authored keys lexically.
        const entries = new Map(Object.entries(value));
        return `{${[...entries.keys()].sort().map(key =>
          `${JSON.stringify(key)}:${orderedJson(entries.get(key))}`).join(",")}}`;
      }
      return JSON.stringify(value) ?? "null";
    };
    const source = orderedJson(JSON.parse(JSON.stringify(project)));
    let oracle = 0xcbf29ce484222325n;
    for (let i = 0; i < source.length; i += 1) {
      oracle = BigInt.asUintN(64, (oracle ^ BigInt(source.charCodeAt(i))) * 0x100000001b3n);
    }
    expect(actionCombatProjectFingerprint(project)).toBe(`action-v1:${source.length}:${oracle.toString(16)}`);
  });

  it("returns cancelled without creating a player or accepting any evidence", async () => {
    const project = createBlankProject();
    const controller = new AbortController();
    controller.abort();
    const receipt = await runActionCombatTest(project, { mapId: project.startMapId, signal: controller.signal });
    expect(receipt.status).toBe("cancelled");
    expect(receipt.pass).toBe(false);
    expect(receipt.observations).toEqual([]);
    expect(isVerifiedActionCombatProof(receipt, project, project.startMapId)).toBe(false);
    expect(document.querySelector("iframe")).toBeNull();
  });

  it("does not verify an unavailable or wrong-map run", async () => {
    const project = createBlankProject();
    const receipt = await runActionCombatTest(project, { mapId: "absent" });
    expect(receipt.status).toBe("unverified");
    expect(isVerifiedActionCombatProof(receipt, project, project.startMapId)).toBe(false);
    project.meta.title += " stale";
    expect(isVerifiedActionCombatProof(receipt, project, "absent")).toBe(false);
  });

  it("owns only the returned immutable receipt, bound to current revision and map", async () => {
    const project = actionProject();
    const revoke = playerTransport((frame, runId) => reply(frame, runId, project.startMapId));
    const receipt = await runActionCombatTest(project, { mapId: project.startMapId });
    expect(receipt.status).toBe("verified");
    expect(isVerifiedActionCombatProof(receipt, project, project.startMapId)).toBe(true);
    expect(isVerifiedActionCombatProof(structuredClone(receipt), project, project.startMapId)).toBe(false);
    expect(isVerifiedActionCombatProof(receipt, project, "other-map")).toBe(false);
    project.maps[project.startMapId]!.name += " changed";
    expect(isVerifiedActionCombatProof(receipt, project, project.startMapId)).toBe(false);
    expect(Object.isFrozen(receipt)).toBe(true);
    expect(Object.isFrozen(receipt.observations[0])).toBe(true);
    expect(document.querySelector("iframe")).toBeNull();
    expect(revoke).toHaveBeenCalledExactlyOnceWith("blob:owned-project");
  });

  it.each(["wrong-map", "missing-outcome", "failed"])("rejects runtime %s responses", async (kind) => {
    const project = actionProject();
    playerTransport((frame, runId) => reply(frame, runId,
      kind === "wrong-map" ? "other-map" : project.startMapId,
      kind === "missing-outcome" ? { observations: [] } : kind === "failed" ? { pass: false } : {}));
    const receipt = await runActionCombatTest(project, { mapId: project.startMapId });
    expect(receipt.status).toBe("unverified");
    expect(isVerifiedActionCombatProof(receipt, project, project.startMapId)).toBe(false);
  });

  it("ignores wrong-source and stale-run messages, then cancels and cleans up", async () => {
    const project = actionProject();
    const controller = new AbortController();
    const revoke = playerTransport((frame, runId) => {
      const stranger = document.createElement("iframe");
      reply(stranger, runId, project.startMapId);
      reply(frame, "previous-run", project.startMapId);
      controller.abort();
    });
    const receipt = await runActionCombatTest(project, { mapId: project.startMapId, signal: controller.signal });
    expect(receipt.status).toBe("cancelled");
    expect(receipt.observations).toEqual([]);
    expect(document.querySelector("iframe")).toBeNull();
    expect(revoke).toHaveBeenCalledTimes(1);
  });

  it("times out with a bounded timer and releases the owned player", async () => {
    const project = actionProject();
    vi.useFakeTimers();
    const revoke = playerTransport(() => { vi.advanceTimersByTime(100); });
    const receipt = await runActionCombatTest(project, { mapId: project.startMapId, timeoutMs: 100 });
    expect(receipt.status).toBe("timeout");
    expect(receipt.pass).toBe(false);
    expect(document.querySelector("iframe")).toBeNull();
    expect(revoke).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("allows a cold exported-player deployment within the two-minute ceiling", async () => {
    const project = actionProject();
    vi.useFakeTimers();
    playerTransport((frame, runId) => {
      vi.advanceTimersByTime(90_000);
      reply(frame, runId, project.startMapId);
    });

    const receipt = await runActionCombatTest(project, { mapId: project.startMapId });

    expect(receipt.status).toBe("verified");
    expect(isVerifiedActionCombatProof(receipt, project, project.startMapId)).toBe(true);
    expect(document.querySelector("iframe")).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("does not label an in-flight project revision change as verified", async () => {
    const project = actionProject();
    playerTransport((frame, runId) => {
      project.meta.title += " edited during probe";
      reply(frame, runId, project.startMapId);
    });
    const receipt = await runActionCombatTest(project, { mapId: project.startMapId });
    expect(receipt.status).toBe("unverified");
    expect(isVerifiedActionCombatProof(receipt, project, project.startMapId)).toBe(false);
  });
});
