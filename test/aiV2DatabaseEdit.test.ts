import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { runTool } from "@/editor/tools/toolRunner";
import { getTool } from "@/editor/tools";
import { createPiToolset } from "@/ai/piAgent/toolAdapter";
import { englishToolCopy } from "@/ai/v2/tools/toolExposure";
import { V2_TOOL_EN } from "@/ai/v2/tools/toolTextEn";
import { v2ToolPool } from "@/ai/v2/request/toolGroups";
import { preCheck } from "@/ai/v2/loop/argGuard";
import { databaseChangeReport } from "@/ai/v2/judge/sideEffectChecks";
import type { ToolContext } from "@/editor/tools/types";
import type { Project } from "@/project/types";

// 2026-11-16 자료집 적대 리뷰(assistant-fable-runs/db-review A·B)의 1단계 고침 — 조수가 자료집 전체를 고칠 수 있게.
// 에이전트 세션 규칙으로 작성 시점에는 실행하지 않았다(CI 에서 돈다).

const HANGUL = /[가-힣]/u;
const fresh = (): ToolContext => ({ project: createBlankProject(), assistantRun: true });
const run = (ctx: ToolContext, name: string, args: Record<string, unknown>) => runTool(ctx, name, args, { dryRun: false });
const warningsOf = (result: ReturnType<typeof runTool>): string[] => [...((result.diff as { warnings?: string[] } | undefined)?.warnings ?? []), ...(((result as { warnings?: string[] }).warnings) ?? [])];

describe("reach: database tools are in the v2 pool with English text", () => {
  const NEW = ["delete_database_record", "duplicate_database_record", "prune_unused", "upsert_database_utility", "upsert_battle_animation", "upsert_equipment_slot", "define_promotion", "set_type_chart", "configure_game_systems", "upsert_life_skill", "configure_life_economy", "get_game_over", "read_game_systems", "upsert_skill", "upsert_class", "upsert_state", "upsert_common_event", "set_project_settings"];
  it("every database tool is loadable", () => {
    const pool = new Set(v2ToolPool());
    for (const name of NEW) expect(pool.has(name), name).toBe(true);
  });
  it("the loaded copy of each new tool has an English description and no Korean parameter text", () => {
    const ctx = fresh();
    for (const name of NEW) {
      const en = V2_TOOL_EN[name];
      if (!en?.en) continue;
      // 몬스터 잠금이 숨기는 도구(set_type_chart 등)는 이 프로젝트에서 안 실린다.
      const tool = createPiToolset(ctx, { toolNames: [name] }).find((t) => t.name === name);
      if (!tool) continue;
      const copy = englishToolCopy(tool, false);
      expect(HANGUL.test(copy.description), `${name} description`).toBe(false);
      expect(HANGUL.test(JSON.stringify(copy.parameters)), `${name} parameters`).toBe(false);
    }
  });
});

describe("delete / duplicate / prune", () => {
  it("refuses a used record with every place listed, then deletes with clearReferences", () => {
    const ctx = fresh();
    const refused = run(ctx, "delete_database_record", { collection: "skills", id: "skill_fire" });
    expect(refused.ok).toBe(false);
    expect(refused.issues?.[0]?.code).toBe("database-record-in-use");
    expect(refused.issues?.[0]?.message).toMatch(/still used in \d+ place/u);
    expect(refused.issues?.[0]?.message).toContain("item_fire_bomb");
    expect(HANGUL.test(refused.issues![0]!.message.replace(/«[^»]*»/gu, ""))).toBe(false);
    const done = run(ctx, "delete_database_record", { collection: "skills", id: "skill_fire", clearReferences: true });
    expect(done.ok, done.summary).toBe(true);
    expect(ctx.project.database.skills.some((s) => s.id === "skill_fire")).toBe(false);
    expect(JSON.stringify(ctx.project.database)).not.toContain("\"skill_fire\"");
    expect(warningsOf(done).join(" ")).toContain("Removed references");
  });
  it("finds a record by name and by list number; a near-miss id names the nearest", () => {
    const ctx = fresh();
    const second = ctx.project.database.items[1]!;
    const byNumber = run(ctx, "duplicate_database_record", { collection: "items", id: "2" });
    expect(byNumber.ok, byNumber.summary).toBe(true);
    expect(ctx.project.database.items.some((i) => i.id.startsWith(`${second.id}_`))).toBe(true);
    const byName = run(ctx, "duplicate_database_record", { collection: "items", id: ctx.project.database.items[0]!.name });
    expect(byName.ok, byName.summary).toBe(true);
    const miss = run(ctx, "delete_database_record", { collection: "skills", id: "skil_ice" });
    expect(miss.ok).toBe(false);
    expect(miss.issues?.[0]?.message).toContain("Nearest: skill_ice");
  });
  it("duplicates and deletes a common event", () => {
    const ctx = fresh();
    const made = run(ctx, "upsert_common_event", { id: "ce_test_bell", name: "Bell", commands: [] });
    expect(made.ok, made.summary).toBe(true);
    const dup = run(ctx, "duplicate_database_record", { collection: "commonEvents", id: "ce_test_bell", newId: "ce_test_bell_2" });
    expect(dup.ok, dup.summary).toBe(true);
    expect(ctx.project.commonEvents.some((e) => e.id === "ce_test_bell_2")).toBe(true);
    const del = run(ctx, "delete_database_record", { collection: "commonEvents", id: "ce_test_bell_2" });
    expect(del.ok, del.summary).toBe(true);
    expect(ctx.project.commonEvents.some((e) => e.id === "ce_test_bell_2")).toBe(false);
  });
  it("refuses to clear a required reference (actor classId) and leaves the project intact", () => {
    const ctx = fresh();
    const before = JSON.stringify(ctx.project.database);
    const out = run(ctx, "delete_database_record", { collection: "classes", id: "class_hero", clearReferences: true });
    expect(out.ok).toBe(false);
    expect(JSON.stringify(ctx.project.database)).toBe(before);
  });
  it("prune_unused reports unused records per collection and deletes them on apply", () => {
    const ctx = fresh();
    const report = run(ctx, "prune_unused", { collections: ["skills"] });
    expect(report.ok).toBe(true);
    const count = Number(/Found (\d+) unused/u.exec(report.summary)?.[1]);
    expect(count).toBeGreaterThan(0);
    const before = ctx.project.database.skills.length;
    const applied = run(ctx, "prune_unused", { collections: ["skills"], apply: true });
    expect(applied.ok, applied.summary).toBe(true);
    expect(ctx.project.database.skills.length).toBe(before - count);
  });
});

describe("argument guard: real clears on existing records are applied, filler is not", () => {
  const p = createBlankProject() as Project;
  const actor = p.database.actors[0]!;
  it("an empty list that clears a stored list is applied and says so", () => {
    const out = preCheck("upsert_actor", getTool("upsert_actor")!.parameters, { actor: { id: actor.id, learnedSkills: [] } }, p);
    expect(out.kind).toBe("ok");
    expect((out as { args: { actor: Record<string, unknown> } }).args.actor.learnedSkills).toEqual([]);
    expect((out as { notes: string[] }).notes.join(" ")).toContain("applied as sent");
  });
  it("auto battle off (false) is applied", () => {
    const out = preCheck("set_project_settings", getTool("set_project_settings")!.parameters, { battle: { allowAutoBattle: false } }, p) as { args: { battle: Record<string, unknown> } };
    expect(out.args.battle.allowAutoBattle).toBe(false);
  });
  it("filler on a new record and in a many-field call is dropped with a NOT APPLIED note", () => {
    const fresh1 = preCheck("upsert_enemy", getTool("upsert_enemy")!.parameters, { enemy: { id: "enemy_brand_new", name: "x", rewards: { drops: [], exp: 0 } } }, p) as { args: { enemy: Record<string, unknown> }; notes: string[] };
    expect(fresh1.args.enemy.rewards).toBeUndefined();
    expect(fresh1.notes.join(" ")).toMatch(/^NOT APPLIED/mu);
    const filler = preCheck("upsert_actor", getTool("upsert_actor")!.parameters, { actor: { id: actor.id, name: "a", nickname: "", learnedSkills: [], battleCommandIds: [] } }, p) as { args: { actor: Record<string, unknown> }; notes: string[] };
    expect(filler.args.actor.learnedSkills).toBeUndefined();
    expect(filler.notes.join(" ")).toContain("send it alone");
  });
});

describe("list ops, shrink note, unknown fields, created vs modified", () => {
  it("listOps adds and removes one entry without resending the list", () => {
    const ctx = fresh();
    const n = ctx.project.database.classes.find((c) => c.id === "class_hero")!.learnedSkills.length;
    const add = run(ctx, "upsert_class", { class: { id: "class_hero" }, listOps: { add: { learnedSkills: [{ level: 5, skillId: "skill_thunder" }] } } });
    expect(add.ok, add.summary).toBe(true);
    const cls = () => ctx.project.database.classes.find((c) => c.id === "class_hero")!;
    expect(cls().learnedSkills.length).toBe(n + 1);
    const rm = run(ctx, "upsert_class", { class: { id: "class_hero" }, listOps: { remove: { learnedSkills: ["skill_thunder"] } } });
    expect(rm.ok, rm.summary).toBe(true);
    expect(cls().learnedSkills.length).toBe(n);
  });
  it("a sent list that shrinks the stored one says «learnedSkills N → 1»", () => {
    const ctx = fresh();
    const n = ctx.project.database.classes.find((c) => c.id === "class_hero")!.learnedSkills.length;
    const out = run(ctx, "upsert_class", { class: { id: "class_hero", learnedSkills: [{ level: 1, skillId: "skill_ice" }] } });
    expect(out.ok).toBe(true);
    expect(warningsOf(out).join(" ")).toContain(`learnedSkills ${n} → 1`);
  });
  it("an unknown field is dropped with a NOT SAVED note and the rest is saved, for every kind", () => {
    const ctx = fresh();
    const cls = run(ctx, "upsert_class", { class: { id: "class_hero", name: "용사", madeUpField: "x" } });
    expect(cls.ok, cls.summary).toBe(true);
    expect(ctx.project.database.classes.find((c) => c.id === "class_hero")!.name).toBe("용사");
    expect(warningsOf(cls).join(" ")).toContain("NOT SAVED — classes records have no field «madeUpField»");
    const enemy = run(ctx, "upsert_enemy", { enemy: { id: ctx.project.database.enemies[0]!.id, madeUpField: 1 } });
    expect(warningsOf(enemy).join(" ")).toContain("NOT SAVED — enemies records have no field «madeUpField»");
  });
  it("the result says created new vs modified existing (used by N), and names the nearest id", () => {
    const ctx = fresh();
    const mod = run(ctx, "upsert_skill", { skill: { id: "skill_fire", name: "업화" } });
    expect(mod.summary).toMatch(/^Modified existing skills record skill_fire «업화» \(used by \d+ other/u);
    const made = run(ctx, "upsert_skill", { skill: { id: "skill_fier", name: "네온" } });
    expect(made.summary).toMatch(/^Created new skills record skill_fier/u);
    expect(warningsOf(made).join(" ")).toContain("skill_fire");
  });
  it("schema examples do not use live default ids", () => {
    const p = createBlankProject() as Project;
    const live = new Set(Object.values(p.database).flatMap((list) => (Array.isArray(list) ? list.map((r) => (r as { id?: string }).id) : [])));
    for (const name of ["upsert_item", "upsert_enemy", "upsert_actor", "upsert_skill", "upsert_equipment", "upsert_class", "upsert_state", "upsert_troop"]) {
      const example = /허용 예시: (\{.*\})$/su.exec(String(getTool(name)!.parameters.description ?? ""))?.[1];
      const id = example ? (Object.values(JSON.parse(example))[0] as { id?: string }).id : undefined;
      expect(id && live.has(id), `${name} example id ${id}`).toBe(false);
    }
  });
});

describe("get_database_records reading", () => {
  const ctx = fresh();
  it("an unknown collection is refused with the list of collections", () => {
    const out = run(ctx, "get_database_records", { collection: "skils" });
    expect(out.ok).toBe(false);
    expect(out.issues?.[0]?.message).toContain("skills");
  });
  it("the default page fits the 12,000-char result cap and keeps the cursor first", () => {
    const out = run(ctx, "get_database_records", { collection: "skills" });
    expect(out.ok).toBe(true);
    expect(JSON.stringify(out.data).length).toBeLessThan(12_000);
    expect(Object.keys(out.data as object).slice(0, 4)).toEqual(["collection", "total", "offset", "nextOffset"]);
    expect((out.data as { nextOffset: number | null }).nextOffset).toBeGreaterThan(0);
    expect(HANGUL.test(out.summary)).toBe(false);
  });
  it("finds by name query and by list number («#2»)", () => {
    const q = run(ctx, "get_database_records", { collection: "items", query: ctx.project.database.items[0]!.name });
    expect((q.data as { records: { id: string }[] }).records.some((r) => r.id === ctx.project.database.items[0]!.id)).toBe(true);
    const pos = run(ctx, "get_database_records", { collection: "items", query: "#2" });
    expect((pos.data as { records: { id: string; position: number }[] }).records[0]).toMatchObject({ id: ctx.project.database.items[1]!.id, position: 2 });
  });
  it("system settings and terms are readable", () => {
    expect(run(ctx, "get_database_records", { collection: "terms" }).ok).toBe(true);
    expect(run(ctx, "get_database_records", { collection: "system" }).ok).toBe(true);
  });
});

describe("database change report (replaces the blocking «unasked change» check)", () => {
  it("covers terms, equipment, states, troops and common events", () => {
    const before = createBlankProject() as Project;
    const after = structuredClone(before);
    after.meta.terms = { ...after.meta.terms, hp: "체력" } as never;
    after.database.equipment[0]!.name = "새 검";
    after.database.states[0]!.name = "새 상태";
    after.database.troops.pop();
    after.commonEvents.push({ ...(structuredClone(after.commonEvents[0] ?? { id: "x", name: "x", trigger: "none", commands: [] }) as never), id: "ce_report_new", name: "새 공용" } as never);
    const lines = databaseChangeReport(before, after).join("\n");
    expect(lines).toContain("용어: hp");
    expect(lines).toMatch(/^equipment: 고침/mu);
    expect(lines).toMatch(/^states: 고침/mu);
    expect(lines).toMatch(/^troops: 지움 1/mu);
    expect(lines).toMatch(/^commonEvents: 만듦 1/mu);
  });
});
