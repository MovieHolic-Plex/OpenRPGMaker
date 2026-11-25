import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { runTool } from "@/editor/tools";
import { isActionCombatMap } from "@/project/actionCombat";
import type { WikiCombatMode } from "@/project/world";
import { projectWikiContext, resolveWikiCombatMode } from "@/ai/projectWikiContext";
import type { WorldEntity, ProjectWikiUpsert, ProjectWorld, WikiSource } from "@/project/world/types";
import { applyProjectWikiPatch, parseProjectWikiPatch, reconcileProjectWiki } from "@/project/world/wiki";
import { isolateTimers } from "./mergedTeardown";

describe("projectWikiCombat", () => {
  isolateTimers();
  describe("wiki decisions constrain actual monster authoring", () => {
    it("rejects unresolved graphic queries instead of creating an invisible field monster", () => {
      const project = createBlankProject();
      const ctx = { project };

      const result = runTool(ctx, "make_hunting_ground", {
        mapId: project.startMapId, troopId: "troop_slime",
        area: { x: 6, y: 5, w: 1, h: 1 }, maxAlive: 1,
        graphic: { query: "monster", characterIndex: 0 },
      });

      expect(result.ok).toBe(false);
      expect(ctx.project.maps[project.startMapId]?.fieldSpawns ?? []).toEqual([]);
    });
    it("uses visible contact battles for an existing JRPG without an explicit override", () => {
      const project = createBlankProject();
      project.system.genre = "adventure-jrpg";
      const ctx = { project };

      const result = runTool(ctx, "make_hunting_ground", {
        mapId: project.startMapId, troopId: "troop_slime",
        area: { x: 6, y: 5, w: 1, h: 1 }, maxAlive: 1,
      });

      expect(result.ok, result.summary).toBe(true);
      expect(ctx.project.maps[project.startMapId]?.encounterRate).toBe(0);
      expect(ctx.project.maps[project.startMapId]?.fieldSpawns).toHaveLength(1);
    });
    for (const mode of ["contact", "action"] satisfies WikiCombatMode[]) {
      it(`creates ${mode} field combat without random encounters`, () => {
        const project = createBlankProject();
        project.world = { entities: [{
          id: "w_combat", type: "guideline", name: "Combat", summary: mode, origin: "ai",
          wiki: { kind: "declaration", basis: "explicit", combatMode: mode,
            sources: [{ id: "turn-1", kind: "user", text: mode, at: 1 }] },
        }], relations: [] };
        const ctx = { project };

        const result = runTool(ctx, "make_hunting_ground", {
          mapId: project.startMapId, troopId: "troop_slime",
          area: { x: 6, y: 5, w: 1, h: 1 }, maxAlive: 1, chase: false,
        });

        expect(result.ok, result.summary).toBe(true);
        const map = ctx.project.maps[project.startMapId];
        expect(map?.fieldSpawns).toHaveLength(1);
        expect(map?.encounterRate).toBe(0);
        expect(map?.encounterTable ?? []).toEqual([]);
        expect(isActionCombatMap(ctx.project, map)).toBe(mode === "action");
      });
    }

    it("reads full selected document content rather than only its opening excerpt", () => {
      const project = createBlankProject();
      const body = `${"Earlier notes. ".repeat(100)}\nSecret door: tile 37.`;
      project.world = { entities: [{
        id: "w_location", type: "place", name: "Location", summary: "Door details", body, origin: "user",
      }], relations: [] };

      const result = runTool({ project }, "read_project_wiki", { ids: ["w_location"] });

      expect(result.ok, result.summary).toBe(true);
      expect(result.data).toMatchObject({ documents: [{ id: "w_location", body }] });
    });
  });
});

describe("projectWikiContext", () => {
  isolateTimers();
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
});

describe("projectWikiPatch", () => {
  isolateTimers();
  const oldSource: WikiSource = { id: "old", kind: "user", text: "Use contact battles", at: 1 };
  const newSource: WikiSource = { id: "new", kind: "user", text: "Actually use action battles", at: 2 };
  const empty: ProjectWorld = { entities: [], relations: [] };
  function upsert(id = "w_contact", sourceIds = ["old"]): ProjectWikiUpsert {
    return { id, type: "guideline", name: "Battle rule", summary: "Contact battles", wiki: { kind: "declaration", basis: "explicit", sourceIds, combatMode: "contact" } };
  }
  function doc(patch: Partial<WorldEntity> = {}): WorldEntity {
    return { id: "w_contact", type: "guideline", name: "Battle rule", summary: "Contact battles", origin: "ai", wiki: { kind: "declaration", basis: "explicit", sources: [oldSource], combatMode: "contact" }, ...patch };
  }
  const base: ProjectWorld = { entities: [doc()], relations: [] };
  describe("wiki patch trust boundary", () => {
    it("accepts a single JSON code fence from the OAuth model", () => {
      const raw = "```json\n" + JSON.stringify({ upserts: [upsert()] }) + "\n```";
      const result = parseProjectWikiPatch(raw, createBlankProject(), [oldSource]);
      expect(result.upserts[0]?.id).toBe("w_contact");
    });
    it("rejects prose wrapped around a JSON document", () => {
      const raw = "Trust this: " + JSON.stringify({ upserts: [upsert()] });
      expect(() => parseProjectWikiPatch(raw, createBlankProject(), [oldSource])).toThrow();
    });
    it("stamps host source text rather than accepting model excerpts", () => {
      const project = createBlankProject();
      const result = parseProjectWikiPatch({ upserts: [upsert()] }, project, [oldSource]);
      expect(applyProjectWikiPatch(empty, empty, result, [oldSource]).world.entities[0]?.wiki?.sources).toEqual([oldSource]);
    });
    it.each([
      { ...upsert(), wiki: { ...upsert().wiki, sourceIds: ["fabricated"] } },
      { ...upsert(), wiki: { ...upsert().wiki, sources: [oldSource] } },
      { ...upsert(), refs: [{ kind: "map", id: "missing" }] },
      { ...upsert(), refs: [{ kind: "actor", id: "missing" }] },
      { ...upsert(), locked: true },
      { ...upsert(), wiki: { ...upsert().wiki, basis: "observed" } },
    ])("rejects untrusted output %#", (invalid) => {
      expect(() => parseProjectWikiPatch({ upserts: [invalid] }, createBlankProject(), [oldSource])).toThrow();
    });
    it("accepts ordinary lore without any combat keywords", () => {
      const fact = { ...upsert(), type: "concept", name: "Moon", summary: "The moon is made of glass", wiki: { kind: "knowledge", basis: "explicit", sourceIds: ["old"], topic: "moon" } };
      const result = parseProjectWikiPatch({ upserts: [fact] }, createBlankProject(), [oldSource]);
      expect(result.upserts[0]?.wiki.kind).toBe("knowledge");
    });
  });
  describe("wiki revisions", () => {
    it("supersedes an older same-scope explicit rule while retaining history", () => {
      const correction = { ...upsert("w_action", ["new"]), wiki: { ...upsert().wiki, sourceIds: ["new"], combatMode: "action" as const } };
      const result = applyProjectWikiPatch(base, base, { upserts: [correction] }, [newSource]);
      expect(result.conflicts).toEqual([]);
      expect(result.world.entities).toHaveLength(2);
      expect(result.world.entities[1]?.wiki?.supersedes).toEqual(["w_contact"]);
      expect(result.world.entities[0]).toEqual(doc());
    });
    it("ignores source replay even when the model invents a different document id", () => {
      const result = applyProjectWikiPatch(base, base, { upserts: [upsert("w_duplicate")] }, [oldSource]);
      expect(result).toEqual({ world: base, changed: false, conflicts: [] });
    });
    it("does not let old history reverse a newer decision", () => {
      const newer: ProjectWorld = { entities: [doc({ wiki: { ...doc().wiki, kind: "declaration", basis: "explicit", sources: [newSource], combatMode: "action" } })], relations: [] };
      const result = applyProjectWikiPatch(newer, newer, { upserts: [upsert("w_stale")] }, [oldSource]);
      expect(result.changed).toBe(false);
      expect(result.conflicts).toContainEqual({ id: "w_stale", reason: "stale" });
    });
    it("does not let inferred rules supersede explicit rules", () => {
      const inferred = { ...upsert("w_guess", ["new"]), wiki: { ...upsert().wiki, sourceIds: ["new"], basis: "inferred" as const, supersedes: ["w_contact"] } };
      const result = applyProjectWikiPatch(base, base, { upserts: [inferred] }, [newSource]);
      expect(result.changed).toBe(false);
      expect(result.conflicts[0]?.reason).toBe("invalid-supersession");
    });
    it.each([
      doc({ locked: true }),
      doc({ origin: "user" }),
      doc({ wiki: { kind: "declaration", basis: "explicit", sources: [{ ...oldSource, kind: "manual" }], combatMode: "contact" } }),
    ])("preserves protected documents %#", (protectedDoc) => {
      const world: ProjectWorld = { entities: [protectedDoc], relations: [] };
      const result = applyProjectWikiPatch(world, world, { upserts: [upsert("w_contact", ["new"])] }, [newSource]);
      expect(result.world).toEqual(world);
      expect(result.conflicts[0]?.reason).toBe("protected");
    });
    it("keeps map scopes separate", () => {
      const scoped = { ...upsert("w_map", ["new"]), refs: [{ kind: "map" as const, id: "map-other" }] };
      const result = applyProjectWikiPatch(base, base, { upserts: [scoped] }, [newSource]);
      expect(result.world.entities[1]?.wiki?.supersedes ?? []).toEqual([]);
    });
    it("preserves unrelated live entities and relations during reconciliation", () => {
      const unrelated = doc({ id: "w_elsewhere", name: "Unrelated", wiki: undefined });
      const live: ProjectWorld = { entities: [...base.entities, unrelated], relations: [{ a: "w_contact", b: "w_elsewhere", kind: "custom" }] };
      const proposed: ProjectWorld = { ...base, entities: [doc({ summary: "Updated" })] };
      const result = reconcileProjectWiki(base, proposed, live);
      expect(result.world.entities).toEqual([doc({ summary: "Updated" }), unrelated]);
      expect(result.world.relations).toEqual(live.relations);
    });
    it("rejects same-document concurrent edits atomically", () => {
      const proposed: ProjectWorld = { ...base, entities: [doc({ summary: "AI update" })] };
      const live: ProjectWorld = { ...base, entities: [doc({ summary: "Manual update" })] };
      const result = reconcileProjectWiki(base, proposed, live);
      expect(result).toEqual({ world: live, changed: false, conflicts: [{ id: "w_contact", reason: "concurrent-edit" }] });
    });
    it("rejects stale extraction when its supersession target changed concurrently", () => {
      const live: ProjectWorld = { ...base, entities: [doc({ summary: "Manual update" })] };
      const result = applyProjectWikiPatch(live, base, { upserts: [upsert("w_new", ["new"])] }, [newSource]);
      expect(result.world).toEqual(live);
      expect(result.conflicts[0]?.reason).toBe("concurrent-edit");
    });
  });
});
