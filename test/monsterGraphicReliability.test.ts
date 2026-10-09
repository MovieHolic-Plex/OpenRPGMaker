import { describe, expect, it } from "vitest";
import { searchResources } from "@/assets/resourceSearch";
import { runTool } from "@/editor/tools/toolRunner";
import type { ToolContext } from "@/editor/tools/types";
import { createBlankProject } from "@/project/defaults";

type GraphicInput = { monsterResourceId?: string; transparent?: boolean };
const writers = [
  {
    tool: "upsert_enemy",
    args: (id: string, name: string | undefined, graphic: GraphicInput = {}) => ({ enemy: { id, ...(name !== undefined ? { name } : {}), ...graphic } }),
    read: (ctx: ToolContext, id: string) => ctx.project.database.enemies.find((entry) => entry.id === id),
  },
  {
    tool: "define_monster_species",
    args: (id: string, name: string | undefined, graphic: GraphicInput = {}) => ({ species: { id, ...(name !== undefined ? { name } : {}), ...(Object.keys(graphic).length ? { graphic } : {}) } }),
    read: (ctx: ToolContext, id: string) => ctx.project.database.monsterSpecies?.find((entry) => entry.id === id)?.graphic,
  },
  {
    tool: "make_action_enemy",
    args: (id: string, name: string | undefined, graphic: GraphicInput = {}) => ({ enemyId: id, ...(name !== undefined ? { name } : {}), ...graphic, actionProfile: { contactDamage: 3 } }),
    read: (ctx: ToolContext, id: string) => ctx.project.database.enemies.find((entry) => entry.id === id),
  },
];

describe.each(writers)("$tool reliable graphics", ({ tool, args, read }) => {
  it("never repeats the leaf-fox -> skeleton hash assignment", () => {
    const ctx: ToolContext = { project: createBlankProject() };
    const result = runTool(ctx, tool, args("enemy_leaf_fox", "풀잎여우"));
    expect(result.ok, result.summary).toBe(true);
    expect(read(ctx, "enemy_leaf_fox")?.monsterResourceId).toBe("generated-enemy-leaf-fox");
  });

  it.each([
    ["풀잎 여우", "generated-enemy-leaf-fox"],
    ["leaf fox", "generated-enemy-leaf-fox"],
    ["불꽃강아지", "generated-enemy-fire-pup"],
    ["불씨 강아지", "generated-enemy-fire-pup"],
  ])("matches dedicated identity %s without changing species", (name, resourceId) => {
    const ctx: ToolContext = { project: createBlankProject() };
    const result = runTool(ctx, tool, args("enemy_dedicated", name));
    expect(result.ok, result.summary).toBe(true);
    expect(read(ctx, "enemy_dedicated")?.monsterResourceId).toBe(resourceId);
  });

  it.each(["정체불명", "leaf fox quux", "슬라임 quux", "*", "all", "전체", "monster", "enemy"])(
    "rejects unreliable name %s atomically", (name) => {
      const ctx: ToolContext = { project: createBlankProject() };
      const before = ctx.project;
      const result = runTool(ctx, tool, args("enemy_unreliable", name));
      expect(result.ok).toBe(false);
      expect(result.issues?.[0]?.code).toBe("monster-graphic-required");
      expect(ctx.project).toBe(before);
      expect(read(ctx, "enemy_unreliable")).toBeUndefined();
    },
  );

  it.each(["leaf fox quux", "슬라임 quux", "*", "all", "전체", "generated-enemy-unregistered-quux"])(
    "rejects unreliable explicit query %s even with a known name", (monsterResourceId) => {
      const ctx: ToolContext = { project: createBlankProject() };
      const before = ctx.project;
      const result = runTool(ctx, tool, args("enemy_bad_query", "해골 궁수", { monsterResourceId }));
      expect(result.ok).toBe(false);
      expect(result.issues?.[0]?.code).toBe("invalid-args");
      expect(ctx.project).toBe(before);
    },
  );

  it.each(["해골 궁수", "skeleton archer", " Skeleton   Archer ", "skeleton_archer"])("matches all terms in %s", (name) => {
    const ctx: ToolContext = { project: createBlankProject() };
    const result = runTool(ctx, tool, args("enemy_archer", name));
    expect(result.ok, result.summary).toBe(true);
    expect(read(ctx, "enemy_archer")?.monsterResourceId).toBe("generated-enemy-skeleton-archer");
  });

  it("accepts reliable explicit queries and preserves explicit art on partial edits", () => {
    const ctx: ToolContext = { project: createBlankProject() };
    const id = "enemy_explicit_art";
    const resolved = runTool(ctx, tool, args(id, "정체불명", { monsterResourceId: "해골 궁수" }));
    expect(resolved.ok, resolved.summary).toBe(true);
    expect(read(ctx, id)?.monsterResourceId).toBe("generated-enemy-skeleton-archer");
    const explicit = runTool(ctx, tool, args(id, "정체불명", { monsterResourceId: "generated-enemy-dragon-red" }));
    expect(explicit.ok, explicit.summary).toBe(true);
    const updated = runTool(ctx, tool, args(id, undefined));
    expect(updated.ok, updated.summary).toBe(true);
    expect(read(ctx, id)?.monsterResourceId).toBe("generated-enemy-dragon-red");
    const graphicEdit = runTool(ctx, tool, args(id, undefined, { transparent: true }));
    expect(graphicEdit.ok, graphicEdit.summary).toBe(true);
    expect(read(ctx, id)).toMatchObject({ monsterResourceId: "generated-enemy-dragon-red", transparent: true });
  });

  it("preserves intentional transparency including later partial edits", () => {
    const ctx: ToolContext = { project: createBlankProject() };
    const id = "enemy_intentionally_hidden";
    const created = runTool(ctx, tool, args(id, "정체불명", { transparent: true }));
    expect(created.ok, created.summary).toBe(true);
    expect(read(ctx, id)).toMatchObject({ transparent: true });
    expect(read(ctx, id)?.monsterResourceId).toBeUndefined();
    const updated = runTool(ctx, tool, args(id, undefined));
    expect(updated.ok, updated.summary).toBe(true);
    expect(read(ctx, id)).toMatchObject({ transparent: true });
    expect(read(ctx, id)?.monsterResourceId).toBeUndefined();
    const before = ctx.project;
    const visible = runTool(ctx, tool, args(id, undefined, { transparent: false }));
    expect(visible.ok).toBe(false);
    expect(visible.issues?.[0]?.code).toBe("monster-graphic-required");
    expect(ctx.project).toBe(before);
  });
});

it("partial and wildcard matches remain available for browsing only", () => {
  expect(searchResources("monster", "leaf fox quux").length).toBeGreaterThan(0);
  expect(searchResources("monster", "*").length).toBeGreaterThan(0);
});

it("make_action_enemy rejects an existing visible enemy without reliable art", () => {
  const ctx: ToolContext = { project: createBlankProject() };
  const enemy = ctx.project.database.enemies[0];
  enemy.name = "정체불명";
  delete enemy.monsterResourceId;
  const before = ctx.project;
  const result = runTool(ctx, "make_action_enemy", { enemyId: enemy.id, actionProfile: { contactDamage: 3 } });
  expect(result.ok).toBe(false);
  expect(result.issues?.[0]?.code).toBe("monster-graphic-required");
  expect(ctx.project).toBe(before);
});

it("leaf-fox Korean identity never tags leafling or mantis assets", () => {
  const hits = searchResources("monster", "풀잎여우");
  expect(hits.map((hit) => hit.id)).toEqual(["generated-enemy-leaf-fox"]);
  expect(searchResources("monster", "풀잎").some((hit) => /leafling|mantis|cleaf/.test(hit.id))).toBe(false);
});

// 2026-09-24 헤드리스 r0735: 「서리 슬라임」+ appearanceTags ["슬라임","약함","젤리"] 가 「서리」 한 단어 때문에
// 거부됐고 이어진 upsert_troop 도 없는 적으로 실패했다.
describe("name + appearanceTags corroborated identity", () => {
  it("resolves when the name and appearanceTags both name a specific identity, and warns", () => {
    const ctx: ToolContext = { project: createBlankProject() };
    const result = runTool(ctx, "upsert_enemy", { enemy: { id: "enemy_frost_slime", name: "서리 슬라임" }, appearanceTags: ["슬라임", "약함", "젤리"] });
    expect(result.ok, result.summary).toBe(true);
    const id = ctx.project.database.enemies.find((entry) => entry.id === "enemy_frost_slime")?.monsterResourceId ?? "";
    expect(searchResources("monster", "*").find((hit) => hit.id === id)?.tags).toContain("슬라임");
    expect(JSON.stringify(result)).toContain("서리");
  });

  it("still rejects when appearanceTags do not corroborate a word of the name", () => {
    const ctx: ToolContext = { project: createBlankProject() };
    const result = runTool(ctx, "upsert_enemy", { enemy: { id: "enemy_frost_slime", name: "서리 슬라임" }, appearanceTags: ["젤리"] });
    expect(result.ok).toBe(false);
    expect(result.issues?.[0]?.code).toBe("monster-graphic-required");
    expect(result.issues?.[0]?.message).toMatch(/slime/);
  });
});
