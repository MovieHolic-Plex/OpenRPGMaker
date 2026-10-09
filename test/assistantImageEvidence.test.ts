import { describe, expect, it } from "vitest";
import { AssistantAcceptanceLedger } from "@/ai/assistantAcceptanceLedger";
import { AssistantImageEvidence } from "@/ai/assistantImageEvidence";
import type { Project } from "@/project/types";
import { createBlankProject } from "@/project/defaults";

it("retains reviewed draft images until their exact content is applied", () => {
  // Given an image review for a changed draft, not the old applied map.
  const applied = createBlankProject(), draft = structuredClone(applied);
  draft.maps[draft.startMapId].lowerTiles[0] = 1;
  const ledger = new AssistantAcceptanceLedger("goal", "Review draft", applied);
  ledger.adopt([{ id: "image", title: "Image", criteria: [{ kind: "imageReviewed", target: { mapId: draft.startMapId } }] }]);
  const receipt = ledger.captureImage(draft, { mapId: draft.startMapId, x: 0, y: 0, w: 20, h: 15 });
  if (!receipt) throw new Error("Missing capture");
  ledger.deliverImages([receipt]);
  expect(ledger.review("image", "Inspected", draft, "pass")).toBe(true);
  expect(ledger.evaluate(applied, draft).status).toBe("verifying");
  // When that exact draft is applied, then its already-delivered review remains valid.
  expect(ledger.evaluate(draft).status).toBe("verified");
});

const mutations: readonly { readonly name: string; readonly change: (project: Project) => void; readonly affected: number }[] = [
  { name: "lower tile", change: p => { p.maps[p.startMapId].lowerTiles[0] = 1; }, affected: 1 },
  { name: "upper tile", change: p => { p.maps[p.startMapId].upperTiles[0] = 1; }, affected: 1 },
  { name: "sparse stack", change: p => { p.maps[p.startMapId].upperTileStacks = { 0: [1, 2] }; }, affected: 1 },
  { name: "event", change: p => { p.maps[p.startMapId].events.push({ id: "event", x: 0, y: 0, trigger: { kind: "action" }, commands: [] }); }, affected: 1 },
  { name: "tileset image", change: p => { p.tilesets[p.maps[p.startMapId].tilesetId].image = { type: "uploaded", id: "replacement" }; }, affected: 1 },
  { name: "shared assets", change: p => { p.assets.uploaded.replacement = { id: "replacement", name: "Image", kind: "tileset", dataUrl: "data:image/png;base64,AA==", meta: {} }; }, affected: 2 },
];

describe("render-input currentness", () => {
  it.each(mutations)("retires $name evidence for applicable maps without undo revival", ({ change, affected }) => {
    // Given separately tiled maps with delivered passing reviews.
    const project = createBlankProject(), first = project.maps[project.startMapId];
    project.tilesets.second = { ...structuredClone(project.tilesets[first.tilesetId]), id: "second" };
    project.maps.second = { ...structuredClone(first), id: "second", tilesetId: "second" };
    const evidence = new AssistantImageEvidence();
    const ledger = new AssistantAcceptanceLedger("goal", "Both maps", project, evidence);
    for (const map of Object.values(project.maps)) {
      ledger.adopt([{ id: map.id, title: map.id, criteria: [{ kind: "imageReviewed", target: { mapId: map.id } }] }]);
      const receipt = evidence.capture(project, { mapId: map.id, x: 0, y: 0, w: 20, h: 15 });
      if (!receipt) throw new Error("Missing capture");
      evidence.deliver([receipt]);
      expect(ledger.review(map.id, "Inspected", project, "pass")).toBe(true);
    }
    expect(ledger.evaluate(project).status).toBe("verified");
    const before = structuredClone(project);
    // When a render input changes and is subsequently undone.
    change(project);
    expect(ledger.evaluate(project).items.filter(item => item.status !== "verified")).toHaveLength(affected);
    // Then only unaffected maps retain receipts, even after the undo.
    expect(evidence.current(project)).toHaveLength(2 - affected);
    expect(ledger.evaluate(before).items.filter(item => item.status !== "verified")).toHaveLength(affected);
    expect(evidence.current(before)).toHaveLength(2 - affected);
  });

  it("retires a pending capture if content changes and is undone before image delivery", () => {
    // Given a captured image not yet inserted into model input.
    const project = createBlankProject(), before = structuredClone(project);
    const evidence = new AssistantImageEvidence();
    const receipt = evidence.capture(project, { mapId: project.startMapId, x: 0, y: 0, w: 20, h: 15 });
    if (!receipt) throw new Error("Missing capture");
    // When a write and undo occur before delivery.
    project.maps[project.startMapId].lowerTiles[0] = 1;
    evidence.current(project); evidence.current(before);
    evidence.deliver([receipt]);
    // Then the pending old capture cannot be credited after undo.
    expect(evidence.current(before)).toEqual([]);
  });
});
