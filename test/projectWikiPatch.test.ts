import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { applyProjectWikiPatch, parseProjectWikiPatch, reconcileProjectWiki } from "@/project/world/wiki";
import type { ProjectWikiUpsert, ProjectWorld, WikiSource, WorldEntity } from "@/project/world/types";

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
