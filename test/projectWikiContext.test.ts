import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { projectWikiContext, resolveWikiCombatMode } from "@/ai/projectWikiContext";
import type { WorldEntity } from "@/project/world/types";

function doc(id: string, overrides: Partial<WorldEntity> = {}): WorldEntity {
  return { id, type: "guideline", name: "Battles", summary: "Contact battles", origin: "ai", wiki: { kind: "declaration", basis: "explicit", sources: [{ id: "s-" + id, kind: "user", text: "Contact battles", at: 1 }], combatMode: "contact" }, ...overrides };
}

describe("bounded wiki retrieval", () => {
  it("keeps explicit project decisions and excludes matching work history", () => {
    const project = createBlankProject();
    project.world = { entities: [
      doc("w_core"),
      ...Array.from({ length: 12 }, (_, i) => doc(`w_progress_${i}`, {
        name: "monster placement", summary: "monster",
        wiki: { kind: "progress", basis: "observed",
          sources: [{ id: `a${i}`, kind: "application", text: "Applied", at: i + 2 }] },
      })),
    ], relations: [] };

    const result = projectWikiContext(project, { query: "monster placement" });

    expect(result.selectedIds[0]).toBe("w_core");
    expect(result.selectedIds).toEqual(["w_core"]);
  });
  it("selects relevant lore without combat keywords and excludes unrelated maps", () => {
    const project = createBlankProject();
    project.world = { entities: [doc("w_moon", { name: "Glass moon", summary: "The moon is glass", wiki: { kind: "knowledge", basis: "explicit", sources: [{ id: "moon", kind: "user", text: "Glass moon", at: 1 }] } }), doc("w_other", { refs: [{ kind: "map", id: "other-map" }] })], relations: [] };
    const result = projectWikiContext(project, { query: "moon", mapId: project.startMapId });
    expect(result.selectedIds).toEqual(["w_moon"]);
  });
  it("bounds output and selected document count even for huge documents", () => {
    const project = createBlankProject();
    project.world = { entities: Array.from({ length: 100 }, (_, i) => doc(`w_${i}`, { body: "x".repeat(20_000), summary: "battle".repeat(4_000) })), relations: [] };
    const result = projectWikiContext(project, { query: "battle" });
    expect(result.text.length).toBeLessThanOrEqual(6000);
    expect(result.selectedIds.length).toBeLessThanOrEqual(8);
    expect(result.selectedIds.length).toBeGreaterThan(0);
  });
  it("omits superseded history from retrieval", () => {
    const project = createBlankProject();
    project.world = { entities: [doc("w_old"), doc("w_new", { wiki: { kind: "declaration", basis: "explicit", sources: [{ id: "new", kind: "user", text: "Action now", at: 2 }], combatMode: "action", supersedes: ["w_old"] } })], relations: [] };
    const result = projectWikiContext(project, { query: "battles" });
    expect(result.selectedIds).toEqual(["w_new"]);
  });
  it("returns no entries for an unrelated query rather than arbitrary knowledge", () => {
    const project = createBlankProject();
    project.world = { entities: [doc("w_moon", { name: "Moon", summary: "Silver", wiki: { kind: "knowledge", basis: "explicit", sources: [{ id: "moon", kind: "user", text: "Silver moon", at: 1 }] } })], relations: [] };
    expect(projectWikiContext(project, { query: "fishing" })).toEqual({ text: "", selectedIds: [] });
  });
});

describe("wiki combat route", () => {
  it("prefers a map explicit decision over the global explicit decision", () => {
    const project = createBlankProject();
    project.world = { entities: [doc("w_global"), doc("w_local", { refs: [{ kind: "map", id: project.startMapId }], wiki: { kind: "declaration", basis: "explicit", sources: [{ id: "local", kind: "user", text: "Random battles here", at: 2 }], combatMode: "random" } })], relations: [] };
    expect(resolveWikiCombatMode(project, project.startMapId)).toEqual({ mode: "random", sourceId: "local" });
    expect(resolveWikiCombatMode(project, "other")).toEqual({ mode: "contact", sourceId: "s-w_global" });
  });
  it("does not promote inferred JRPG defaults to an explicit machine route", () => {
    const project = createBlankProject();
    project.world = { entities: [doc("w_guess", { wiki: { kind: "declaration", basis: "inferred", sources: [{ id: "jrpg", kind: "user", text: "Make a JRPG", at: 1 }], combatMode: "contact" } })], relations: [] };
    expect(resolveWikiCombatMode(project)).toBeUndefined();
  });
  it("keeps an explicit decision ahead of a newer inferred default", () => {
    const project = createBlankProject();
    project.world = { entities: [doc("w_explicit"), doc("w_guess", { wiki: { kind: "declaration", basis: "inferred", sources: [{ id: "guess", kind: "user", text: "JRPG", at: 20 }], combatMode: "random" } })], relations: [] };
    expect(resolveWikiCombatMode(project)).toEqual({ mode: "contact", sourceId: "s-w_explicit" });
  });
});
