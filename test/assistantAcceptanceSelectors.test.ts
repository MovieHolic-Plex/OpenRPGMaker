import { describe, expect, it } from "vitest";
import { AssistantAcceptanceLedger } from "@/ai/assistantAcceptanceLedger";
import { parseAcceptanceCriteria } from "@/ai/assistantAcceptance";
import { createBlankProject } from "@/project/defaults";

function fixture(raw: unknown) {
  const project = createBlankProject();
  const criteria = parseAcceptanceCriteria(raw);
  expect(criteria).not.toBeNull();
  const ledger = new AssistantAcceptanceLedger("a", "selected facts", project);
  ledger.adopt([{ id: "selected", title: "selected", criteria }]);
  return { project, ledger };
}

describe("C3-generic-applied-selectors", () => {
  it("C2-volume-promises-are-additive-and-applied", () => {
    const project = createBlankProject();
    const ledger = new AssistantAcceptanceLedger("a", "volume", project);
    ledger.requireVolume("r", { authoredMaps: 2, multiPageNpcs: 0, shops: 0, quests: 0 }, project);
    ledger.requireVolume("r", { authoredMaps: 1, multiPageNpcs: 0, shops: 0, quests: 0 }, project);
    expect(ledger.evaluate(project).status).not.toBe("verified");
    expect(ledger.getVolumeGaps(project)).toHaveLength(1);
  });
  it("C2-preserve-selected-name-while-changing-price", () => {
    const project = createBlankProject();
    const item = project.database.items[0]!;
    const criteria = parseAcceptanceCriteria([{ kind: "entityPreserve", subject: { kind: "database", collection: "items", id: item.id }, path: ["name"] }]);
    expect(criteria).not.toBeNull();
    const ledger = new AssistantAcceptanceLedger("a", "Change price; preserve name", project);
    ledger.adopt([{ id: "name", title: "Preserve name", criteria }]);
    item.price += 1;
    expect(ledger.evaluate(project).status).toBe("verified");
    item.name = "Changed";
    expect(ledger.evaluate(project).status).not.toBe("verified");
  });
  it("verifies selected title only after actual apply and revokes on undo", () => {
    const { project, ledger } = fixture([{ kind: "valueEquals", subject: { kind: "project" }, path: ["meta", "title"], value: "Final" }]);
    const draft = structuredClone(project); draft.meta.title = "Final";
    expect(ledger.evaluate(project, draft).items[0]?.status).toBe("verifying");
    expect(ledger.evaluate(draft).status).toBe("verified");
    expect(ledger.evaluate(project).status).not.toBe("verified");
  });
  it("requires real unique DB/event/asset identities, never undefined equality", () => {
    for (const subject of [{ kind: "database", collection: "items", id: "missing" }, { kind: "event", mapId: "map_blank_start", eventId: "missing" }, { kind: "asset", category: "uploaded", id: "missing" }]) {
      const { project, ledger } = fixture([{ kind: "entityPreserve", subject }]);
      expect(ledger.evaluate(project).status).not.toBe("verified");
    }
  });
  it("counts selected identities and preserves membership against original baseline", () => {
    const { project, ledger } = fixture([
      { kind: "entityCount", collection: { kind: "database", collection: "items" }, selector: { ids: ["new"] }, count: 1, comparison: "eq", basis: "requestDelta" },
      { kind: "membershipPreserve", collection: { kind: "events", mapId: "map_blank_start" }, selector: { all: true } },
    ]);
    expect(ledger.evaluate(project).status).not.toBe("verified");
    const item = createBlankProject().database.items[0];
    if (!item) throw new Error("Blank project needs an item template");
    project.database.items.push({ ...item, id: "new" });
    expect(ledger.evaluate(project).status).toBe("verified");
    project.maps[project.startMapId]!.events.push({ id: "extra", x: 0, y: 0, trigger: { kind: "action" }, commands: [] });
    expect(ledger.evaluate(project).status).not.toBe("verified");
  });
  it.each([["session"], ["meta", "__proto__"], ["system", "constructor"], ["meta", "title", "toString"]].map(path => ({ path })))("rejects unsafe project paths $path", ({ path }) => {
    expect(parseAcceptanceCriteria([{ kind: "valueEquals", subject: { kind: "project" }, path, value: null }])).toBeNull();
  });
  it("rejects executable selectors and unknown fields", () => {
    expect(parseAcceptanceCriteria([{ kind: "entityCount", collection: { kind: "database", collection: "items" }, selector: { predicate: "return true" }, count: 1, comparison: "eq", basis: "current" }])).toBeNull();
  });
});
