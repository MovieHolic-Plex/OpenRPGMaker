import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { runTool } from "@/editor/tools/toolRunner";
import { v2ToolPool } from "@/ai/v2/request/toolGroups";
import { V2_TOOL_EN } from "@/ai/v2/tools/toolTextEn";
import { createPiToolset } from "@/ai/piAgent/toolAdapter";
import { englishToolCopy } from "@/ai/v2/tools/toolExposure";
import { databaseChangeReport } from "@/ai/v2/judge/sideEffectChecks";
import { battleCommandsForActor } from "@/battle/battleCommands";
import { ENGINE_STATE_RULES } from "@/battle/battleStates";
import { pruneCollections } from "@/editor/tools/refactorTools";
import type { ToolContext } from "@/editor/tools/types";

// 2026-11-16 자료집 적대 리뷰 2단계 — 한꺼번에 고치기, 쓰는 도구가 없던 칸, 순서, 글 바꾸기, 용어를 따르는 엔진 꼬리표, 엔진이 id 로 아는 상태.
const fresh = (): ToolContext => ({ project: createBlankProject(), assistantRun: true });
const run = (ctx: ToolContext, name: string, args: Record<string, unknown>) => runTool(ctx, name, args);
const warningsOf = (out: ReturnType<typeof runTool>): string => (out.diff?.warnings ?? []).join(" ");
const HANGUL = /[ㄱ-힝]/u;
const NEW = ["bulk_edit_database", "reorder_database_records", "set_difficulties", "set_monster_fusions", "set_game_over_library", "set_play_settings", "upsert_skill_tree"];

describe("reach", () => {
  it("the new tools are in the v2 pool with English text", () => {
    const pool = new Set(v2ToolPool());
    const ctx = fresh();
    for (const name of NEW) {
      expect(pool.has(name), name).toBe(true);
      expect(V2_TOOL_EN[name]?.en, name).toBe(true);
      const tool = createPiToolset(ctx, { toolNames: [name] }).find((t) => t.name === name)!;
      const copy = englishToolCopy(tool, false);
      expect(HANGUL.test(copy.description) || HANGUL.test(JSON.stringify(copy.parameters)), name).toBe(false);
    }
  });
});

describe("bulk_edit_database", () => {
  it("one op call changes every enemy on the default database and the summary says how many of how many", () => {
    const ctx = fresh();
    const before = ctx.project.database.enemies.map((e) => e.stats.maxHp);
    const out = run(ctx, "bulk_edit_database", { collection: "enemies", op: { field: "stats.maxHp", multiply: 1.5 } });
    expect(out.ok, out.summary).toBe(true);
    const after = ctx.project.database.enemies.map((e) => e.stats.maxHp);
    expect(after.every((hp, i) => hp === Math.round(before[i]! * 1.5))).toBe(true);
    expect(out.summary).toContain(`Changed ${before.length} of ${before.length} enemies`);
    expect(HANGUL.test(out.summary)).toBe(false);
  });
  it("patches apply per record, report failures by id, and leave the rest", () => {
    const ctx = fresh();
    const out = run(ctx, "bulk_edit_database", { collection: "skills", patches: [{ id: "skill_sword_slash", name: "데이터 베기" }, { id: "skill_does_not_exist" }] });
    expect(out.ok).toBe(true);
    expect(ctx.project.database.skills.find((s) => s.id === "skill_sword_slash")!.name).toBe("데이터 베기");
    expect(out.summary).toMatch(/NOT CHANGED 1: skill_does_not_exist \(no record with this id/u);
  });
  it("over the per-call cap the result says NOT FINISHED with the count left and the next offset", () => {
    const ctx = fresh();
    const out = run(ctx, "bulk_edit_database", { collection: "skills", op: { field: "power", add: 1 } });
    expect(out.ok, out.summary).toBe(true);
    const left = Number(/NOT FINISHED: (\d+) more/u.exec(out.summary)?.[1]);
    expect(left).toBeGreaterThan(0);
    const next = Number(/offset:(\d+)/u.exec(out.summary)?.[1]);
    expect(next).toBe(300);
    // 같은 인자 + offset 으로 이어 간다(op 는 저장값에서 다시 고르므로 앞 300개는 다시 세지 않게 offset 이 건너뛴다).
    const again = run(ctx, "bulk_edit_database", { collection: "skills", op: { field: "power", add: 1 }, offset: next });
    expect(again.ok, again.summary).toBe(true);
    expect(again.summary).toMatch(/Changed 300 of 1243/u);
  });
  it("dryRun changes nothing", () => {
    const ctx = fresh();
    const hp = ctx.project.database.enemies[0]!.stats.maxHp;
    const out = run(ctx, "bulk_edit_database", { collection: "enemies", op: { field: "stats.maxHp", set: 1 }, dryRun: true });
    expect(out.summary).toMatch(/^\(dry run/u);
    expect(ctx.project.database.enemies[0]!.stats.maxHp).toBe(hp);
  });
  it("after a broad edit the change report names the collections left untouched with their sizes", () => {
    const ctx = fresh();
    const before = structuredClone(ctx.project);
    run(ctx, "bulk_edit_database", { collection: "enemies", op: { field: "stats.maxHp", multiply: 2 } });
    const lines = databaseChangeReport(before, ctx.project);
    expect(lines.some((l) => /^enemies: 고침 106\/106/u.test(l))).toBe(true);
    expect(lines.some((l) => l.startsWith("손대지 않은 묶음") && l.includes("skills 1243"))).toBe(true);
  });
});

describe("writers that had no tool", () => {
  it("difficulty, fusions, game-over list, play settings, skill tree", () => {
    const ctx = fresh();
    expect(run(ctx, "set_difficulties", { difficulties: [{ id: "easy", name: "쉬움", enemyHpRate: 0.7 }, { id: "hard", name: "어려움", enemyHpRate: 1.5 }], defaultDifficultyId: "easy" }).ok).toBe(true);
    expect(ctx.project.system.difficulties?.map((d) => d.id)).toEqual(["easy", "hard"]);
    expect(ctx.project.system.defaultDifficultyId).toBe("easy");
    expect(run(ctx, "set_monster_fusions", { fusions: [{ speciesA: "nope", speciesB: "x", resultSpeciesId: "y" }] }).ok).toBe(false);
    expect(run(ctx, "set_game_over_library", { gameOvers: [{ id: "go_boss", name: "보스", settings: { presentation: "classic", title: "끝" } }], defaultGameOverId: "go_boss" }).ok).toBe(true);
    expect(ctx.project.system.gameOvers?.[0]?.id).toBe("go_boss");
    expect(run(ctx, "set_play_settings", { pointerMovement: true, playSurfaceScale: "fit", gallery: { enabled: true, label: "추억" }, menuUiStyle: "classic" }).ok).toBe(true);
    expect(ctx.project.system).toMatchObject({ pointerMovement: true, playSurfaceScale: "fit", gallery: { enabled: true, label: "추억" }, menuUiStyle: "classic" });
    const tree = { id: "tree_war", name: "전사", description: "", classIds: [], allowReset: true, nodes: [{ id: "n1", name: "힘", description: "", x: 0, y: 0, cost: 1, maxRank: 3, level: 1, prerequisites: [], effect: { kind: "parameter", parameter: "attack", amount: 2 } }] };
    expect(run(ctx, "upsert_skill_tree", { tree, points: { pointsPerLevel: 2 } }).ok).toBe(true);
    expect(ctx.project.growth?.skillTrees.map((t) => t.id)).toEqual(["tree_war"]);
    expect(run(ctx, "upsert_skill_tree", { tree: { id: "tree_war" }, delete: true }).ok).toBe(true);
    expect(ctx.project.growth?.skillTrees).toEqual([]);
  });
  it("record fields: enemy flying, equipment actionWeapon, skill moveMotion, troop afterBattle (validated commands); graphicHue stays dropped (battle does not read it)", () => {
    const ctx = fresh();
    const out = run(ctx, "upsert_enemy", { enemy: { id: "enemy_slime", graphicHue: 120, flying: true } });
    expect(out.ok).toBe(true);
    expect(ctx.project.database.enemies.find((e) => e.id === "enemy_slime")).toMatchObject({ graphicHue: 0, flying: true });
    const eq = ctx.project.database.equipment[0]!.id;
    expect(run(ctx, "upsert_equipment", { equipment: { id: eq, actionWeapon: { swingRange: 2 } } }).ok).toBe(true);
    expect(ctx.project.database.equipment[0]!.actionWeapon).toEqual({ swingRange: 2 });
    const sk = ctx.project.database.skills[1]!.id;
    expect(run(ctx, "upsert_skill", { skill: { id: sk, moveMotion: "contact" } }).ok).toBe(true);
    expect(ctx.project.database.skills[1]!.moveMotion).toBe("contact");
    const troop = ctx.project.database.troops[0]!.id;
    expect(run(ctx, "upsert_troop", { troop: { id: troop, afterBattle: { victory: [{ kind: "showText", text: "x" }] } } }).ok).toBe(false);
    expect(run(ctx, "upsert_troop", { troop: { id: troop, afterBattle: { victory: [{ kind: "text", body: "이겼다!" }] } } }).ok).toBe(true);
    expect(ctx.project.database.troops[0]!.afterBattle?.victory).toEqual([{ kind: "text", body: "이겼다!" }]);
  });
  it("reorder: the hero's battle menu follows its class battleCommands, and the collection order can change too", () => {
    const ctx = fresh();
    // runTool 은 고친 초안으로 ctx.project 를 바꾼다 — 매번 ctx.project 를 읽는다.
    const hero = ctx.project.system.startActorIds![0]!;
    const cls = ctx.project.database.actors.find((a) => a.id === hero)!.classId;
    const out = run(ctx, "reorder_database_records", { collection: "classes", recordId: cls, field: "battleCommands", order: ["cmd_item"] });
    expect(out.ok, out.summary).toBe(true);
    expect(battleCommandsForActor(ctx.project, hero)[0]!.kind).toBe("item");
    const all = run(ctx, "reorder_database_records", { collection: "classes", field: "battleCommands", allRecords: true, move: { id: "cmd_attack", to: 1 } });
    expect(all.ok, all.summary).toBe(true);
    expect(battleCommandsForActor(ctx.project, hero)[0]!.kind).toBe("attack");
    expect(run(ctx, "reorder_database_records", { collection: "battleCommands", order: ["cmd_item"] }).ok).toBe(true);
    expect(ctx.project.database.battleCommands.map((c) => c.id)).toEqual(["cmd_item", "cmd_attack", "cmd_skill", "cmd_defend"]);
  });
});

describe("replace_text_in_project", () => {
  it("does not double-apply when the new text contains the old one, and says it was already replaced", () => {
    const ctx = fresh();
    const first = run(ctx, "replace_text_in_project", { find: "슬라임", replace: "젤리 슬라임" });
    expect(first.ok).toBe(true);
    expect(first.summary).toMatch(/hit\(s\) in \d+ place\(s\): .*enemies enemy_slime ×1/u);
    const second = run(ctx, "replace_text_in_project", { find: "슬라임", replace: "젤리 슬라임" });
    expect(second.summary).toMatch(/already replaced/u);
    expect(ctx.project.database.enemies.find((e) => e.id === "enemy_slime")!.name).toBe("젤리 슬라임");
  });
  it("match:'exact' renames only fields that are exactly the name", () => {
    const ctx = fresh();
    const potion = ctx.project.database.items.find((i) => i.id === "item_potion")!;
    const longer = ctx.project.database.items.find((i) => i.id !== potion.id && i.name.includes(potion.name));
    const out = run(ctx, "replace_text_in_project", { find: potion.name, replace: "나노 회복제", match: "exact" });
    expect(out.ok).toBe(true);
    expect(ctx.project.database.items.find((i) => i.id === "item_potion")!.name).toBe("나노 회복제");
    if (longer) expect(ctx.project.database.items.find((i) => i.id === longer.id)!.name).toBe(longer.name);
  });
});

describe("engine labels follow terms", () => {
  it("battle menu commands use the project's terms; the battle HUD's HP/MP labels too", async () => {
    const { battleCommandKindLabel } = await import("@/player/battleCommandDom");
    const { resolveTerms } = await import("@/project/terms");
    const p = createBlankProject();
    p.meta.terms = { ...(p.meta.terms ?? {}), attack: "해킹", mp: "기력" };
    const labels = battleCommandsForActor(p, p.database.actors[0]!.id).map((c) => battleCommandKindLabel(c, resolveTerms(p)));
    expect(labels[0]).toBe("해킹");
    expect(resolveTerms(p).mp).toBe("기력");
  });
});

describe("engine-known states and prune cap (review A, B)", () => {
  it("deleting or copying a state the engine keys by id says the rule does not follow a new id", () => {
    const ctx = fresh();
    expect(Object.keys(ENGINE_STATE_RULES)).toContain("state_sleep");
    const dup = run(ctx, "duplicate_database_record", { collection: "states", id: "state_sleep", newId: "state_deep_sleep" });
    expect(dup.ok).toBe(true);
    expect(warningsOf(dup)).toMatch(/engine gives state_sleep its rule .* by id/u);
    const del = run(ctx, "delete_database_record", { collection: "states", id: "state_sleep", clearReferences: true });
    expect(del.ok, del.summary).toBe(true);
    expect(warningsOf(del)).toMatch(/re-created under another id will not have that rule/u);
  });
  it("prune_unused that hits its pass cap says NOT FINISHED with the count still unused", () => {
    const p = createBlankProject();
    const out = pruneCollections(p, ["skills", "items"], true, 1);
    expect(out.summary).toMatch(/NOT FINISHED: stopped after 1 passes and these are still unused — /u);
  });
});
