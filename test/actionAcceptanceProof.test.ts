/** @vitest-environment happy-dom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { AssistantAcceptanceLedger } from "@/ai/assistantAcceptanceLedger";
import { createBlankProject } from "@/project/defaults";
import {
  ACTION_COMBAT_OUTCOMES, isVerifiedActionCombatProof, runActionCombatTest,
} from "@/testing/actionCombatProof";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

/** Preserve the private player transport and issuer; replace only browser I/O. */
function playerTransport(pass = true) {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(
    '<html><head><script type="module" src="player.js"></script></head><body></body></html>',
  )));
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:action-acceptance-test");
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  const append = document.body.append.bind(document.body);
  vi.spyOn(document.body, "append").mockImplementation((...nodes) => {
    append(...nodes);
    const frame = nodes.find((node): node is HTMLIFrameElement => node instanceof HTMLIFrameElement);
    if (!frame) return;
    const bootText = frame.srcdoc.match(/window\.__OPENRPG_BOOT__=(.*);/)?.[1];
    if (!bootText) throw new Error("Player boot contract missing");
    const boot: unknown = JSON.parse(bootText);
    if (!boot || typeof boot !== "object" || !("actionCombatProbe" in boot)) throw new Error("Probe missing");
    const probe = boot.actionCombatProbe;
    if (!probe || typeof probe !== "object" || !("runId" in probe) || !("mapId" in probe)) throw new Error("Probe binding missing");
    window.dispatchEvent(new MessageEvent("message", {
      source: frame.contentWindow, origin: location.origin,
      data: {
        type: "oprn:combat-proof", runId: probe.runId, mapId: probe.mapId, pass,
        observations: ACTION_COMBAT_OUTCOMES.map((outcome, sequence) => ({
          outcome, sequence, mapId: probe.mapId, before: 10, after: 5,
        })),
      },
    }));
  });
}

function actionProject() {
  const project = createBlankProject();
  project.system.actionCombat = { enabled: true };
  project.maps[project.startMapId].actionCombat = true;
  return project;
}

describe("action acceptance receipt lifecycle", () => {
  it("accepts only the authentic current-map receipt and rejects serialized copies", async () => {
    playerTransport();
    const project = actionProject();
    const ledger = new AssistantAcceptanceLedger("goal", "Action", project);
    ledger.requireActionCombat([{ mapId: project.startMapId }]);
    const receipt = await runActionCombatTest(project, { mapId: project.startMapId });
    expect(receipt.status).toBe("verified");
    expect(isVerifiedActionCombatProof(receipt, project, project.startMapId)).toBe(true);
    expect(ledger.captureActionProof(structuredClone(receipt), project)).toBe(false);
    expect(ledger.evaluate(project).status).not.toBe("verified");
    expect(ledger.captureActionProof(receipt, project, "other-map")).toBe(false);
    expect(ledger.captureActionProof(receipt, project)).toBe(true);
    expect(ledger.evaluate(project).status).toBe("verified");
    expect(document.querySelector("iframe")).toBeNull();
  });

  it("retires proof after content changes even if undo restores the exact content", async () => {
    playerTransport();
    const project = actionProject();
    const ledger = new AssistantAcceptanceLedger("goal", "Action", project);
    ledger.requireActionCombat([{ mapId: project.startMapId }]);
    const receipt = await runActionCombatTest(project, { mapId: project.startMapId });
    ledger.captureActionProof(receipt, project);
    expect(ledger.evaluate(project).status).toBe("verified");
    const original = structuredClone(project);
    project.meta.title += " changed";
    expect(ledger.evaluate(project).status).not.toBe("verified");
    expect(ledger.evaluate(original).status).not.toBe("verified");
  });

  it("revokes a passing map proof when its later harness run fails", async () => {
    playerTransport();
    const project = actionProject();
    const ledger = new AssistantAcceptanceLedger("goal", "Action", project);
    ledger.requireActionCombat([{ mapId: project.startMapId }]);
    ledger.captureActionProof(await runActionCombatTest(project, { mapId: project.startMapId }), project);
    expect(ledger.evaluate(project).status).toBe("verified");
    vi.restoreAllMocks();
    playerTransport(false);
    const failed = await runActionCombatTest(project, { mapId: project.startMapId });
    expect(failed.status).toBe("unverified");
    expect(ledger.captureActionProof(failed, project, project.startMapId)).toBe(false);
    expect(ledger.evaluate(project).status).not.toBe("verified");
  });
});
