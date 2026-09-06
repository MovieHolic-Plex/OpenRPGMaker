import { describe, expect, it } from "vitest";
import { AssistantAcceptanceLedger } from "@/ai/assistantAcceptanceLedger";
import { createBlankProject } from "@/project/defaults";
import { runTool } from "@/editor/tools";

function fixture() {
  const project = createBlankProject();
  const ledger = new AssistantAcceptanceLedger("review-scope", "Review edited map", project);
  ledger.adopt([{ id: "review", title: "Review", criteria: [{
    kind: "imageReviewed", target: { mapId: project.startMapId }, region: { x: 0, y: 0, w: 1, h: 1 },
  }] }]);
  return { project, ledger, map: project.maps[project.startMapId] };
}

function deliver(input: ReturnType<typeof fixture>, region: { x: number; y: number; w: number; h: number }) {
  const result = runTool({ project: input.project }, "show_map_region", { mapId: input.map.id, ...region });
  expect(result.ok).toBe(true);
  const receipt = input.ledger.captureImage(input.project, result.data);
  if (!receipt) throw new Error("Expected actual returned image bounds");
  input.ledger.deliverImages([receipt]);
}

describe("image review covers actual edited scope", () => {
  it.each(["tile", "event"] as const)("does not hide a distant %s change behind a tiny declared crop", (kind) => {
    const input = fixture();
    if (kind === "tile") input.map.lowerTiles[10 * input.map.width + 17] = 360;
    else input.map.events.push({ id: "changed-event", x: 17, y: 10, trigger: { kind: "action" }, commands: [] });
    deliver(input, { x: 0, y: 0, w: 1, h: 1 });
    expect(input.ledger.review("review", "Inspected crop", input.project, "pass")).toBe(false);
    const evidence = input.ledger.evaluate(input.project).items[0]?.evidence[0];
    expect(evidence?.passed).toBe(false);
    expect(JSON.parse(evidence?.expected ?? "{}").region).toEqual({ x: 0, y: 0, w: 18, h: 11 });
    deliver(input, { x: 0, y: 0, w: 18, h: 11 });
    expect(input.ledger.review("review", "Inspected changed scope", input.project, "pass")).toBe(true);
    expect(input.ledger.evaluate(input.project).status).toBe("verified");
  });

  it("requires the whole map after resizing rather than trusting the declared crop", () => {
    const input = fixture();
    input.map.width = 40;
    input.map.lowerTiles = Array(40 * 15).fill(240);
    input.map.upperTiles = Array(40 * 15).fill(-1);
    deliver(input, { x: 0, y: 0, w: 1, h: 1 });
    expect(input.ledger.review("review", "Tiny crop", input.project, "pass")).toBe(false);
    deliver(input, { x: 0, y: 0, w: 24, h: 15 });
    deliver(input, { x: 24, y: 0, w: 16, h: 15 });
    expect(input.ledger.review("review", "Whole resized map", input.project, "pass")).toBe(true);
  });

  it("keeps an unchanged local inspection local", () => {
    const input = fixture();
    deliver(input, { x: 0, y: 0, w: 1, h: 1 });
    expect(input.ledger.review("review", "Read-only local inspection", input.project, "pass")).toBe(true);
  });
});
