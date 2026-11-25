import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { battleDataEmptied, unaskedChanges, databaseChangeReport } from "@/ai/v2/judge/sideEffectChecks";
import type { Project } from "@/project/types";
import { findingLine } from "@/ai/v2/judge/finding";
import { runTool } from "@/editor/tools/toolRunner";
import { v2ToolPool } from "@/ai/v2/request/toolGroups";
import { V2_TOOL_EN } from "@/ai/v2/tools/toolTextEn";
import { createPiToolset } from "@/ai/piAgent/toolAdapter";
import { englishToolCopy } from "@/ai/v2/tools/toolExposure";
import { battleCommandsForActor } from "@/battle/battleCommands";
import { ENGINE_STATE_RULES } from "@/battle/battleStates";
import { pruneCollections } from "@/editor/tools/refactorTools";
import type { ToolContext } from "@/editor/tools/types";
import { isStageWrite, recordStageWrites, stageWriteKey, type StageWrites } from "@/ai/v2/shared/stageWrites";
import { fitFirstLevelUp } from "@/ai/v2/story/pathBattleBudget";
import { isolateTimers } from "./mergedTeardown";

describe("aiV2BattleDataEmptied", () => {
  isolateTimers();
  // 판정은 Finding 을 낸다 — 이 시험은 보고에 실리는 줄 글을 본다.
  const unaskedLines = (...args: Parameters<typeof unaskedChanges>): string[] => unaskedChanges(...args).map(findingLine);
  // 2026-10-25 장난감 가게 고치기 4턴: 「메뉴의 스킬·장비·파티도 빼 줘」에 주인공 기술·직업 전투 데이터를 비웠고, 「파티」「스킬」 낱말 면제로 못 잡았다.
  const T4 = "엔딩 카드 본문에 「노장인 제페토:」 이름표가 그대로 붙어 나와. 이름표 없이 이야기처럼 써 줘. 선택지의 「(엔딩)」 메모와 메뉴의 스킬·장비·파티도 빼 줘. 전투 없는 이야기인데 하트 체력 514/514 가 보이니 지워 줘.";
  function emptied() {
    const before = createBlankProject() as Project;
    const after = structuredClone(before);
    const hero = after.database.actors[0]!;
    const cls = after.database.classes.find((c) => c.id === hero.classId) ?? after.database.classes[0]!;
    const beforeCls = before.database.classes.find((c) => c.id === cls.id)!;
    // 빈 프로젝트 직업에 데이터가 없을 수도 있어 앞에 채워 둔다.
    beforeCls.learnedSkills = [{ level: 1, skillId: "skill_x" } as never];
    beforeCls.battleCommands = [{ kind: "attack" } as never];
    before.database.actors[0]!.learnedSkills = [{ level: 1, skillId: "skill_y" } as never];
    hero.learnedSkills = [];
    cls.learnedSkills = [];
    cls.battleCommands = [];
    return { before, after };
  }
  // 2026-11-16 db-review B #9: 비운 전투 데이터는 이제 완료를 막지 않는다(요청 낱말로 «지우라고 했나» 를 가르던 검사가 정당한 비우기도 막았다).
  // 대신 최종 보고의 «자료집에서 바뀐 것» 에 ⚠ 줄로 실리고, 목록을 줄인 쓰기는 도구 결과가 그 자리에서 «LIST SHRANK» 로 알린다.
  describe("emptied actor/class battle data is reported, not blocked", () => {
    it("finds both emptied records in the T4 case", () => {
      const { before, after } = emptied();
      expect(battleDataEmptied(before, after, T4).length).toBe(2);
      expect(unaskedLines(before, after, T4).some((l) => l.includes("전투 데이터"))).toBe(false);
    });
    it("puts them in the database change report whatever the request says", async () => {
      const { databaseChangeReport } = await import("@/ai/v2/judge/sideEffectChecks");
      const { before, after } = emptied();
      const lines = databaseChangeReport(before, after);
      expect(lines.some((l) => l.startsWith("⚠ 비운 전투 데이터"))).toBe(true);
      expect(lines.some((l) => l.startsWith("classes:") && l.includes("줄어든 목록"))).toBe(true);
    });
    it("is quiet when nothing shrank", () => {
      const before = createBlankProject() as Project;
      expect(battleDataEmptied(before, structuredClone(before), T4)).toEqual([]);
    });
  });
  describe("advisor diff shows emptied battle data", () => {
    it("lists ⚠ 비운 데이터 lines instead of only counts", async () => {
      const { summarizeProjectDiff } = await import("@/ai/v2/judge/advisor");
      const { before, after } = emptied();
      expect(summarizeProjectDiff(before, after)).toContain("⚠ 비운 데이터");
    });
  });
});

describe("aiV2DatabaseBulk", () => {
  isolateTimers();
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
  describe("bulk_edit_database rollback", () => {
    it("a patch that fails after its upsert made the combo switch leaves no switch behind", () => {
      const ctx = fresh();
      const switches = ctx.project.switches.length;
      const out = run(ctx, "bulk_edit_database", { collection: "skills", patches: [{ id: ctx.project.database.skills[0]!.id, comboSwitchId: "sw_combo_test", area: { shape: "square" } }] });
      expect(out.ok).toBe(false);
      expect(ctx.project.switches).toHaveLength(switches);
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
      // Every database list is reached — monster species too (VM 2026-11-16: «초원 슬라임» species stayed and the model found no tool).
      expect((ctx.project.database.monsterSpecies ?? []).filter((s) => s.name.includes("슬라임")).every((s) => s.name.includes("젤리 슬라임"))).toBe(true);
    });
    it("leaves setting fields alone when find equals a schema enum value (skill scope «enemy», item occasion «always»)", () => {
      const ctx = fresh();
      const scopes = ctx.project.database.skills.map((s) => s.scope);
      const occasions = ctx.project.database.items.map((i) => i.occasion);
      expect(scopes).toContain("enemy");
      expect(occasions).toContain("always");
      run(ctx, "replace_text_in_project", { find: "enemy", replace: "foe" });
      run(ctx, "replace_text_in_project", { find: "always", replace: "forever" });
      expect(ctx.project.database.skills.map((s) => s.scope)).toEqual(scopes);
      expect(ctx.project.database.items.map((i) => i.occasion)).toEqual(occasions);
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
});

describe("aiV2StageWrites", () => {
  isolateTimers();
  // 판정은 Finding 을 낸다 — 이 시험은 보고에 실리는 줄 글을 본다.
  const unaskedLines = (...args: Parameters<typeof unaskedChanges>): string[] => unaskedChanges(...args).map(findingLine);
  // 2026-11-10 treasure 두 판(80분 측정): 끝맺음 단계가 쓴 값(경험치 곡선·주인공 이름·적 체력)을 관문이 «요청에 없는 기존 데이터를 바꿨다» 로 짚어
  // 모델이 옛 값을 몰라 13건을 «막힘» 으로 닫았다. 단계가 쓴 칸은 기록해 관문에서 빼고, 모델이 그 뒤에 다른 값으로 바꾼 칸은 다시 짚는다.
  // 에이전트 세션 규칙으로 작성 시점에는 실행하지 않았다(CI 에서 돈다).

  const TASK = "보물 퍼즐 게임을 만들어 줘";
  function pair(): { before: Project; after: Project } {
    const before = createBlankProject() as Project;
    return { before, after: structuredClone(before) };
  }
  describe("finish-stage writes are recorded and excluded from the side-effect gate", () => {
    // 2026-11-16 db-review B #9: 자료집 레코드 변경은 완료를 막지 않고 «자료집에서 바뀐 것» 보고에 실린다 — 단계가 쓴 칸은 그 보고에서도 빠진다.
    it("reports an unrecorded change to an existing actor, and does not block on it", () => {
      const { before, after } = pair();
      after.database.actors[0]!.expCurve = { base: 0, extra: 229, acceleration: 13 };
      expect(unaskedLines(before, after, TASK)).toEqual([]);
      expect(databaseChangeReport(before, after).some((line) => line.startsWith("actors:") && line.includes("expCurve"))).toBe(true);
    });

    it("leaves out a change that a recorded stage wrote", () => {
      const { before, after } = pair();
      const writes: StageWrites = new Map();
      recordStageWrites(after, writes, () => { after.database.actors[0]!.expCurve = { base: 0, extra: 229, acceleration: 13 }; });
      expect(writes.has(stageWriteKey("actors", after.database.actors[0]!.id, "expCurve"))).toBe(true);
      expect(databaseChangeReport(before, after, writes)).toEqual([]);
    });

    it("flags the key again when the model changes it to another value after the stage", () => {
      const { before, after } = pair();
      const writes: StageWrites = new Map();
      const hero = after.database.actors[0]!;
      recordStageWrites(after, writes, () => { hero.name = "도윤"; });
      hero.name = "다른 이름";
      expect(isStageWrite(writes, "actors", hero as never, "name")).toBe(false);
      expect(databaseChangeReport(before, after, writes).some((line) => line.includes("name"))).toBe(true);
    });

    it("keeps the last value when a stage writes the same key twice", () => {
      const { after } = pair();
      const writes: StageWrites = new Map();
      const hero = after.database.actors[0]!;
      recordStageWrites(after, writes, () => { hero.name = "첫째"; });
      recordStageWrites(after, writes, () => { hero.name = "둘째"; });
      expect(isStageWrite(writes, "actors", hero as never, "name")).toBe(true);
      hero.name = "첫째";
      expect(isStageWrite(writes, "actors", hero as never, "name")).toBe(false);
    });

    it("records every database field a stage changes and nothing it left alone (coverage)", () => {
      const { after } = pair();
      const writes: StageWrites = new Map();
      const actors = after.database.actors;
      const untouched = JSON.stringify(actors[1]);
      recordStageWrites(after, writes, () => {
        actors[0]!.name = "도윤";
        actors[0]!.expCurve = { base: 0, extra: 1, acceleration: 1 };
        if (after.database.enemies[0]) after.database.enemies[0].stats = { ...after.database.enemies[0].stats, maxHp: 1 };
      });
      expect([...writes.keys()].every((key) => key.startsWith("actors:") || key.startsWith("enemies:"))).toBe(true);
      expect(writes.has(stageWriteKey("actors", actors[0]!.id, "name"))).toBe(true);
      expect(writes.has(stageWriteKey("actors", actors[0]!.id, "expCurve"))).toBe(true);
      expect(JSON.stringify(actors[1])).toBe(untouched);
      expect([...writes.keys()].some((key) => key.startsWith(`actors:${String(actors[1]!.id)}:`))).toBe(false);
    });

    it("does not record rows a stage created", () => {
      const { after } = pair();
      const writes: StageWrites = new Map();
      recordStageWrites(after, writes, () => { after.database.actors.push({ ...structuredClone(after.database.actors[0]!), id: "actor_new", name: "새 인물" }); });
      expect([...writes.keys()].some((key) => key.startsWith("actors:actor_new:"))).toBe(false);
    });

    it("battleDataEmptied skips a recorded initialEquipment strip", () => {
      const { before, after } = pair();
      // 공장 기본 장비(equip_sword)는 전투 없는 빈 프로젝트에서 빼도 장르 기본값이라 짚지 않는다(J88, onlyFactoryGearRemoved) —
      // 기록 여부만 보려면 저작자가 고른 장비여야 한다.
      before.database.actors[0]!.initialEquipment = { weapon: "equip_iron_sword" } as never;
      const writes: StageWrites = new Map();
      recordStageWrites(after, writes, () => { after.database.actors[0]!.initialEquipment = {} as never; });
      expect(battleDataEmptied(before, after, TASK).length).toBeGreaterThan(0);
      expect(battleDataEmptied(before, after, TASK, writes)).toEqual([]);
    });
  });
  describe("fitFirstLevelUp touches only the starting party", () => {
    it("rewrites the curve of party actors and leaves other actors with the same curve alone", () => {
      const p = createBlankProject() as Project;
      const [hero, other] = p.database.actors;
      expect(JSON.stringify(hero!.expCurve)).toBe(JSON.stringify(other!.expCurve));
      p.system.startActorIds = [hero!.id];
      const troop = p.database.troops.find((t) => t.id === "troop_slime")!;
      const enemy = p.database.enemies.find((e) => e.id === troop.enemyIds[0])!;
      enemy.rewards = { ...enemy.rewards, exp: 40 };
      const untouched = JSON.stringify(other!.expCurve);
      const notes = fitFirstLevelUp(p, troop.id, { ids: [hero!.id], level: 1 });
      expect(notes.length).toBe(1);
      expect(JSON.stringify(hero!.expCurve)).not.toBe(untouched);
      expect(JSON.stringify(other!.expCurve)).toBe(untouched);
    });
  });
});
