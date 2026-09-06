import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { serialize, deserialize } from "@/project/io/serialize";
import { normalizeWorld } from "@/project/world/guards";

const source = { id: "turn-1", kind: "user", text: "Use contact battles", at: 1 } as const;
const wiki = { kind: "declaration", basis: "explicit", sources: [source], combatMode: "contact" } as const;
const entity = { id: "w_battles", type: "guideline", name: "Battles", summary: "Contact battles", origin: "ai", wiki } as const;

describe("project wiki persistence", () => {
  it("preserves optional wiki metadata when normalizing existing world entities", () => {
    const result = normalizeWorld({ entities: [entity], relations: [] });
    expect(result.entities[0]).toEqual(entity);
  });

  it("preserves metadata through actual project serialization and loading", () => {
    const project = createBlankProject();
    project.world = { entities: [entity], relations: [] };
    const result = deserialize(serialize(project));
    expect(result.world?.entities[0]).toEqual(entity);
  });

  it("leaves legacy records without wiki metadata unchanged", () => {
    const legacy = { id: "w_legacy", type: "concept", name: "Moon", summary: "Silver", origin: "user", locked: true } as const;
    const result = normalizeWorld({ entities: [legacy], relations: [] });
    expect(result.entities).toEqual([legacy]);
  });

  it.each([
    { ...wiki, basis: "guessed" },
    { ...wiki, kind: "todo" },
    { ...wiki, combatMode: "jrpg" },
    { ...wiki, sources: [] },
    { ...wiki, sources: [{ ...source, at: "yesterday" }] },
    { ...wiki, sources: [{ ...source, kind: "llm" }] },
  ])("rejects malformed stored metadata %#", (invalid) => {
    expect(() => normalizeWorld({ entities: [{ ...entity, wiki: invalid }], relations: [] })).toThrow();
  });

  it("rejects dangling supersedes references", () => {
    expect(() => normalizeWorld({ entities: [{ ...entity, wiki: { ...wiki, supersedes: ["w_missing"] } }], relations: [] })).toThrow();
  });
});
