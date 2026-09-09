import { expect, it } from "vitest";
import { AssistantAcceptanceLedger } from "@/ai/assistantAcceptanceLedger";
import { ToolVerificationEvidence } from "@/ai/toolVerificationEvidence";
import { createBlankProject } from "@/project/defaults";
import "@/editor/tools";

const json = <T>(value: T): T => JSON.parse(JSON.stringify(value));
const clean = { ok: true, data: { counts: { errors: 0 }, issues: [] } };

it("retains the original per-request baseline, declarations and withdrawal across JSON recovery", () => {
  const baseline = createBlankProject();
  const source = { requestId: "original", text: "retain the map", scope: null };
  const ledger = new AssistantAcceptanceLedger("acceptance", "original", baseline);
  ledger.adopt([{ id: "map", title: "Keep map", criteria: [{ kind: "preserve", target: { mapId: baseline.startMapId } }] },
    { id: "optional", title: "Title", criteria: [{ kind: "gameTitle", title: "original" }] }], baseline, source);
  ledger.withdraw({ acceptanceId: "acceptance", requirementId: "optional", reason: "user removed title" });
  const saved = json(ledger.exportRecovery());
  const restored = AssistantAcceptanceLedger.restoreRecovery(saved);
  const changed = structuredClone(baseline);
  const changedMap = changed.maps[baseline.startMapId];
  if (!changedMap) throw new Error("Missing baseline map");
  changedMap.name = "new human edit";
  const result = restored.evaluate(changed);
  expect(result.items.find(item => item.id === "map")?.status).not.toBe("verified");
  expect(result.items.find(item => item.id === "map")?.source).toEqual(source);
  expect(result.items.find(item => item.id === "optional")?.withdrawal?.source).toBe("user");
  restored.adopt([{ id: "map", title: "Replacement", criteria: [{ kind: "mapCount", targets: [], count: 0 }] }], changed);
  expect(restored.exportRecovery()).toEqual(saved);
});

it("invalidates declared and exploratory passes but retains exact declarations and original lint baseline", () => {
  const evidence = new ToolVerificationEvidence();
  evidence.captureLintBaseline(clean);
  evidence.adopt({ checkId: "lint", ownerId: "item", name: "run_lint", args: {} });
  evidence.observe("run_lint", {}, clean);
  expect(evidence.passed("run_lint")).toBe(true);
  const saved = json(evidence.exportRecovery());
  const restored = new ToolVerificationEvidence();
  restored.restoreRecovery(saved);
  expect(restored.hasLintBaseline()).toBe(true);
  expect(restored.passed("run_lint")).toBe(false);
  expect(restored.snapshot().requirements[0]?.status).toBe("stale");
  expect(restored.exportRecovery().requirements).toEqual(saved.requirements);
  expect(restored.snapshot().attempts).toEqual(saved.attempts);
  restored.observe("run_lint", {}, clean);
  expect(restored.passed("run_lint")).toBe(true);
  const exploratory = new ToolVerificationEvidence();
  exploratory.observe("run_lint", {}, clean);
  restored.restoreRecovery(json(exploratory.exportRecovery()));
  expect(restored.passed("run_lint")).toBe(false);
});
