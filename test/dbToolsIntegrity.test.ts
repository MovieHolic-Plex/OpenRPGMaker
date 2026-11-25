import { describe, expect, it } from "vitest";
import { freshBlankProject as createBlankProject } from "./support/blankProject";
import { runTool } from "@/editor/tools/toolRunner";
import type { ToolContext } from "@/editor/tools/types";
import { blueprintEndingId } from "@/project/gameBlueprint";
import type { GameMap, Project } from "@/project/types";
import { isolateTimers } from "./mergedTeardown";

describe("dbIconResourceIdResolve", () => {
  isolateTimers();
  describe("upsert_item/upsert_equipment iconResourceId", () => {
    it("아이템 id 를 그림 id 로 보내면 그 아이템의 그림으로 바꿔 저장한다", () => {
      const ctx: ToolContext = { project: createBlankProject() };
      const potionIcon = ctx.project.database.items.find((item) => item.id === "item_potion")?.iconResourceId;
      expect(potionIcon).toBeTruthy();
      const result = runTool(ctx, "upsert_item", { item: { id: "item_dream_drop", name: "꿈 방울", iconResourceId: "item_potion" } }, { dryRun: false });
      expect(result.ok, result.summary).toBe(true);
      expect(ctx.project.database.items.find((item) => item.id === "item_dream_drop")?.iconResourceId).toBe(potionIcon);
      expect(result.diff?.warnings?.join("\n")).toContain("레코드 id");
    });

    it("없는 그림 id 는 비우고 레코드는 저장한다", () => {
      const ctx: ToolContext = { project: createBlankProject() };
      const item = runTool(ctx, "upsert_item", { item: { id: "item_dream_bell", name: "꿈 종", iconResourceId: "nope_bell_icon" } }, { dryRun: false });
      expect(item.ok, item.summary).toBe(true);
      expect(ctx.project.database.items.find((entry) => entry.id === "item_dream_bell")?.iconResourceId).toBeUndefined();
      expect(item.diff?.warnings?.join("\n")).toContain("없는 그림");
      const equip = runTool(ctx, "upsert_equipment", { equipment: { id: "equip_dream_pen", name: "꿈 펜", slot: "weapon", iconResourceId: "item_quill_missing" } }, { dryRun: false });
      expect(equip.ok, equip.summary).toBe(true);
      expect(ctx.project.database.equipment.find((entry) => entry.id === "equip_dream_pen")).toBeDefined();
    });
  });
});

describe("dbToolsIntegrity", () => {
  isolateTimers();
  describe("DB write tools", () => {
    it("patches follower scale without replacing its sprite or battle species data", () => {
      const ctx: ToolContext = { project: createBlankProject() };
      const species = ctx.project.database.monsterSpecies[0];
      species.graphic.fieldGraphic = {
        sprite: { type: "bundled", id: "easyrpg-charset-actor1" },
        direction: "left", pattern: 4,
      };
      const before = structuredClone(species);
      const result = runTool(ctx, "define_monster_species", {
        species: { id: species.id, graphic: { fieldGraphic: { scale: 0.5 } } },
      }, { dryRun: false });
      expect(result.ok, JSON.stringify(result.issues)).toBe(true);
      const after = ctx.project.database.monsterSpecies.find((entry) => entry.id === species.id)!;
      expect(after.graphic.fieldGraphic).toEqual({ ...before.graphic.fieldGraphic, scale: 0.5 });
      expect(after.graphic.monsterResourceId).toBe(before.graphic.monsterResourceId);
      expect(after.graphic.backResourceId).toBe(before.graphic.backResourceId);
      expect(after.baseStats).toEqual(before.baseStats);
      expect(after.skillsByLevel).toEqual(before.skillsByLevel);
      expect(after.captureRate).toBe(before.captureRate);
    });

    it("replaces inherited members on an enemyIds-only troop patch and preserves unrelated fields", () => {
      const ctx: ToolContext = { project: createBlankProject() };
      const troop = ctx.project.database.troops[0];
      const enemyId = ctx.project.database.enemies[0].id;
      const originalPages = structuredClone(troop.battleEventPages);
      troop.members = [{ enemyId, x: 120, y: 96, hidden: true }];
      troop.autoAlign = false;
      const renamed = runTool(ctx, "upsert_troop", { troop: { id: troop.id, name: "Patched" } }, { dryRun: false });
      expect(renamed.ok, JSON.stringify(renamed.issues)).toBe(true);
      expect(ctx.project.database.troops.find((entry) => entry.id === troop.id)!.members).toEqual(troop.members);
      const result = runTool(ctx, "upsert_troop", {
        troop: { id: troop.id, enemyIds: [enemyId, enemyId] },
      }, { dryRun: false });
      expect(result.ok, JSON.stringify(result.issues)).toBe(true);
      const after = ctx.project.database.troops.find((entry) => entry.id === troop.id)!;
      expect(after.enemyIds).toEqual([enemyId, enemyId]);
      expect(after.members?.map((member) => member.enemyId)).toEqual(after.enemyIds);
      expect(after.battleEventPages).toEqual(originalPages);
      expect(after.autoAlign).toBe(false);
      expect(result.data).toEqual(after);
    });

    it("upsert_item 부분 수정은 기존 필드를 보존하고 최종 레코드 전체를 반환한다", () => {
      const ctx: ToolContext = { project: createBlankProject() };
      const before = structuredClone(ctx.project.database.items.find((item) => item.id === "item_potion"));
      expect(before).toBeDefined();

      const result = runTool(ctx, "upsert_item", { item: { id: "item_potion", price: 120 } }, { dryRun: false });

      expect(result.ok, JSON.stringify(result.issues)).toBe(true);
      const after = ctx.project.database.items.find((item) => item.id === "item_potion");
      expect(after?.price).toBe(120);
      expect(after?.name).toBe(before?.name);
      expect(after?.description).toBe(before?.description);
      expect(after?.skillId).toBe(before?.skillId);
      expect(after?.hpRecovery).toEqual(before?.hpRecovery);
      expect(result.data).toEqual(after);
    });

    it("upsert_equipment은 전투 축과 중첩 statBonuses를 반영하고 알 수 없는 필드를 거부한다", () => {
      const ctx: ToolContext = { project: createBlankProject() };
      const created = runTool(ctx, "upsert_equipment", {
        equipment: {
          id: "equip_test_sword",
          name: "시험검",
          slot: "weapon",
          accuracy: 83,
          criticalRate: 17,
          statBonuses: { attack: 12 },
        },
      }, { dryRun: false });
      expect(created.ok, JSON.stringify(created.issues)).toBe(true);
      expect(ctx.project.database.equipment.find((entry) => entry.id === "equip_test_sword")).toMatchObject({
        accuracy: 83,
        criticalRate: 17,
        statBonuses: { attack: 12 },
      });

      const rejected = runTool(ctx, "upsert_equipment", {
        equipment: { id: "equip_test_sword", statBonuses: { attackPower: 99 } },
      }, { dryRun: false });
      expect(rejected.ok).toBe(false);
      expect(rejected.issues?.[0]?.code).toBe("unknown-db-field");
      expect(rejected.issues?.[0]?.message).toContain("허용 필드");
    });

    it("upsert_actor 신규 기본 maxLevel은 99다", () => {
      const ctx: ToolContext = { project: createBlankProject() };
      const klass = ctx.project.database.classes[0];
      const result = runTool(ctx, "upsert_actor", { actor: { id: "actor_new", name: "새 동료", classId: klass.id } }, { dryRun: false });
      expect(result.ok, JSON.stringify(result.issues)).toBe(true);
      expect(ctx.project.database.actors.find((actor) => actor.id === "actor_new")?.maxLevel).toBe(99);
    });

    it("upsert_actor can select a shared appearance and charset slot", () => {
      const ctx: ToolContext = { project: createBlankProject() };
      ctx.project.database.characterAppearances = [{
        id: "appearance_may",
        name: "메이 외형",
        description: "",
        charset: { resourceId: "easyrpg-charset-actor2", characterIndex: 3 },
        face: { resourceId: "easyrpg-faceset-actor2-00" },
      }];
      const actor = runTool(ctx, "upsert_actor", {
        actor: {
          id: ctx.project.database.actors[0]!.id,
          appearanceId: "appearance_may",
          characterIndex: 3,
        },
      }, { dryRun: false });
      expect(actor.ok, JSON.stringify(actor.issues)).toBe(true);
      expect(ctx.project.database.actors[0]).toMatchObject({ appearanceId: "appearance_may", characterIndex: 3 });

      const rejected = runTool(ctx, "upsert_actor", {
        actor: { id: ctx.project.database.actors[0]!.id, appearanceId: "missing" },
      }, { dryRun: false });
      expect(rejected.ok).toBe(false);
      expect(rejected.issues?.[0]?.code).toBe("appearance-not-found");
    });

    it("set_party separates authoritative start party from current session party", () => {
      const ctx: ToolContext = { project: createBlankProject() };
      const ids = ctx.project.database.actors.slice(0, 2).map((actor) => actor.id);
      const start = runTool(ctx, "set_party", { scope: "start", actorIds: ids }, { dryRun: false });
      expect(start.ok, JSON.stringify(start.issues)).toBe(true);
      expect(ctx.project.system.startActorIds).toEqual(ids);
      expect(ctx.project.session.partyActorIds).toEqual(ids);

      const session = runTool(ctx, "set_party", { scope: "session", actorIds: [ids[0]] }, { dryRun: false });
      expect(session.ok, JSON.stringify(session.issues)).toBe(true);
      expect(ctx.project.system.startActorIds).toEqual(ids);
      expect(ctx.project.session.partyActorIds).toEqual([ids[0]]);

      const duplicate = runTool(ctx, "set_party", { scope: "session", actorIds: [ids[0], ids[0]] }, { dryRun: false });
      expect(duplicate.ok).toBe(false);
      expect(duplicate.issues?.[0]?.code).toBe("duplicate-actor");
    });

    it("monsterResourceId는 DB 툴 실행 시점에 검색어를 리소스로 해석하거나 invalid-args로 거부한다", () => {
      const ctx: ToolContext = { project: createBlankProject() };
      const enemy = runTool(ctx, "upsert_enemy", {
        enemy: { id: "enemy_query_slime", name: "검색 슬라임", monsterResourceId: "slime" },
      }, { dryRun: false });
      expect(enemy.ok, JSON.stringify(enemy.issues)).toBe(true);
      expect(ctx.project.database.enemies.find((record) => record.id === "enemy_query_slime")?.monsterResourceId).toBe("generated-enemy-slime-01");
      expect(enemy.diff?.warnings.some((warning) => warning.includes("enemy.monsterResourceId 자동 해석"))).toBe(true);

      const species = runTool(ctx, "define_monster_species", {
        species: { id: "species_query_dragon", name: "검색 드래곤", graphic: { monsterResourceId: "dragon" } },
      }, { dryRun: false });
      expect(species.ok, JSON.stringify(species.issues)).toBe(true);
      expect(ctx.project.database.monsterSpecies?.find((record) => record.id === "species_query_dragon")?.graphic.monsterResourceId).toBe("generated-enemy-dragon-01");

      const missing = runTool(ctx, "define_monster_species", {
        species: { id: "species_missing_graphic", name: "없는 그래픽", graphic: { monsterResourceId: "definitely_missing_monster_graphic" } },
      });
      expect(missing.ok).toBe(false);
      expect(missing.issues?.[0]?.code).toBe("invalid-args");
      expect(missing.issues?.[0]?.message).toContain("사용 가능한 monster 리소스 예시");
      expect(missing.issues?.[0]?.message).toContain("generated-enemy");
    });

    it("upsert_state는 raw spread로 임의 필드를 저장하지 않는다", () => {
      const ctx: ToolContext = { project: createBlankProject() };
      const result = runTool(ctx, "upsert_state", { state: { id: "state_x", name: "X", rawInjected: true } }, { dryRun: false });
      expect(result.ok).toBe(false);
      expect(ctx.project.database.states.some((state) => state.id === "state_x")).toBe(false);
    });

    // 추리 도그푸딩 gen: 지어낸 배경 id 가 커밋 게이트에서 변경 전체(제목·음악 포함)를 되돌렸다 — 호출 시점에 짚는다.
    it("set_title_screen rejects an unknown background id at call time with real candidates", () => {
      // EasyRPG 타이틀 그림(easyrpg-title-*)은 2026-10-07 저작권 정리로 지웠다 — 지금 번들 타이틀(oprn-title-*)로 잰다.
      const ctx: ToolContext = { project: createBlankProject() };
      const bad = runTool(ctx, "set_title_screen", { title: "안개 저택", backgroundResourceId: "oprn-title-nope-1" }, { dryRun: false });
      expect(bad.ok).toBe(false);
      const message = JSON.stringify(bad.issues);
      expect(message).toContain("없는 리소스");
      expect(message).toContain("list_resources");
      expect(message).toMatch(/비슷한 실제 id: oprn-title-(?!nope)/u);
      expect(runTool(ctx, "set_title_screen", { title: "안개 저택", backgroundResourceId: "oprn-title-blue" }, { dryRun: false }).ok).toBe(true);
    });

    it("set_title_screen creates titleScreen when missing and nested-merges sounds/titleGraphic", () => {
      const ctx: ToolContext = { project: createBlankProject() };
      delete ctx.project.system.titleScreen;

      const created = runTool(ctx, "set_title_screen", {
        title: "신규 타이틀",
        menuLabels: { quit: "닫기" },
        sounds: { confirmSeResourceId: "easyrpg-sound-decision1" },
        titleGraphic: { mode: "both", resourceId: "oprn-title-bright", x: 40, y: 20 },
      }, { dryRun: false });
      expect(created.ok, JSON.stringify(created.issues)).toBe(true);
      expect(ctx.project.system.titleScreen?.title).toBe("신규 타이틀");
      expect(ctx.project.system.titleScreen?.menuLabels.quit).toBe("닫기");
      expect(ctx.project.system.titleScreen?.menuLabels.newGame).toBeTruthy();
      expect(ctx.project.system.titleScreen?.sounds).toEqual({ confirmSeResourceId: "easyrpg-sound-decision1" });
      expect(ctx.project.system.titleScreen?.titleGraphic).toEqual({
        mode: "both",
        resourceId: "oprn-title-bright",
        x: 40,
        y: 20,
      });

      const merged = runTool(ctx, "set_title_screen", {
        title: "신규 타이틀",
        sounds: { cursorSeResourceId: "easyrpg-sound-cursor1" },
        titleGraphic: { y: 88 },
        backgroundResourceId: "oprn-title-blue",
      }, { dryRun: false });
      expect(merged.ok, JSON.stringify(merged.issues)).toBe(true);
      expect(ctx.project.system.titleScreen?.sounds).toEqual({
        confirmSeResourceId: "easyrpg-sound-decision1",
        cursorSeResourceId: "easyrpg-sound-cursor1",
      });
      expect(ctx.project.system.titleScreen?.titleGraphic).toEqual({
        mode: "both",
        resourceId: "oprn-title-bright",
        x: 40,
        y: 88,
      });
      expect(ctx.project.system.titleScreen?.backgroundResourceId).toBe("oprn-title-blue");
      // background must not clear system.titleResourceId
      expect(ctx.project.system.titleResourceId).toBeDefined();
    });

    it("set_type_chart는 제거된 타입을 가리키는 기존 전투 참조를 경고와 함께 정리한다", () => {
      const ctx: ToolContext = { project: createBlankProject() };
      // "grass" 는 이제 기본 DB 속성(defaultElementRecords, #2603)이라 정리 대상이 아니다 — 차트에만 있던 타입은 DB 에 없는 id 로 잰다.
      ctx.project.system.typeChart = { types: ["moss"], multipliers: { moss: { moss: 1 } } };
      const skill = ctx.project.database.skills[0]!;
      const item = ctx.project.database.items[0]!;
      const equipment = ctx.project.database.equipment[0]!;
      skill.elementId = "moss";
      item.equipmentProfile.attackElementIds = ["moss"];
      equipment.elementalDefenseIds = ["moss"];

      const result = runTool(ctx, "set_type_chart", {
        types: ["fire", "ice", "lightning"],
        multipliers: {
          fire: { fire: 1, ice: 2, lightning: 0.5 },
          ice: { fire: 0.5, ice: 1, lightning: 2 },
          lightning: { fire: 2, ice: 0.5, lightning: 1 },
        },
      }, { dryRun: false });

      expect(result.ok, JSON.stringify(result.issues)).toBe(true);
      expect(skill.id).toBe(ctx.project.database.skills[0]?.id);
      expect(ctx.project.database.skills[0]?.elementId).toBeUndefined();
      expect(ctx.project.database.items[0]?.equipmentProfile.attackElementIds).toEqual([]);
      expect(ctx.project.database.equipment[0]?.elementalDefenseIds).toEqual([]);
      const warnings = result.diff?.warnings.join("\n") ?? "";
      expect(warnings).toMatch(/기존 속성 참조 \d+건/);
      expect(warnings).toContain(`skill ${skill.id}.elementId=moss`);
      expect(warnings).toContain(`item ${item.id}.attackElementIds=moss`);
      expect(warnings).toContain(`equipment ${equipment.id}.elementalDefenseIds=moss`);
    });

    // 2026-09-03 실측(DB AI 바 턴): 모델이 조회 없이 skill_0001·item_0001 자리표시 id 를 넣자 일반 무결성
    // 게이트가 쓰기 전체를 `'upsert_enemy' 커밋 거부(무결성 오류)` 한 줄로 반려했다 — 스탯·보상까지
    // 함께 버려지고 사유는 issues 에만 있었다.
    it("upsert_enemy 는 이 호출이 새로 가리키는 스킬·드롭 아이템·스위치가 없으면 사유와 허용 예시를 함께 거부한다", () => {
      const ctx: ToolContext = { project: createBlankProject() };
      const enemy = ctx.project.database.enemies[0]!;
      const before = structuredClone(enemy);

      const result = runTool(ctx, "upsert_enemy", {
        enemy: {
          id: enemy.id,
          stats: { maxHp: 380 },
          actions: [
            { skillId: "skill_0001", priority: 50 },
            { skillId: "skill_0002", priority: 10, switchOnAfterAction: { enabled: true, switchId: "sw_nope" } },
          ],
          rewards: { exp: 85, dropItemId: "item_0001" },
        },
      }, { dryRun: false });

      expect(result.ok).toBe(false);
      expect(result.issues?.[0]?.code).toBe("enemy-reference-not-found");
      // 요약(200자 클립)에는 위반 목록이 먼저 온다 — 세 종류가 다 들어간다.
      expect(result.summary).toContain("skillId: skill_0001, skill_0002");
      expect(result.summary).toContain("rewards.dropItemId: item_0001");
      expect(result.summary).toContain("action switchId: sw_nope");
      expect(result.summary).not.toContain("무결성 오류");
      // 모델이 받는 issues 전문에는 허용 예시와 조회 안내가 있다.
      const message = result.issues?.[0]?.message ?? "";
      expect(message).toContain("허용 예시");
      expect(message).toContain("get_database_records");
      // 원자성 — 스탯도 그대로다.
      expect(ctx.project.database.enemies[0]).toEqual(before);
    });

    it("upsert_enemy 는 기존 레코드의 선재 깨진 참조를 이 호출이 넘기지 않으면 스탯 수정을 막지 않는다", () => {
      const ctx: ToolContext = { project: createBlankProject() };
      const enemy = ctx.project.database.enemies[0]!;
      enemy.actions = [{
        skillId: "skill_already_gone",
        priority: 5,
        condition: { kind: "always" },
        switchOnAfterAction: { enabled: false },
        switchOffAfterAction: { enabled: false },
      }];

      const result = runTool(ctx, "upsert_enemy", { enemy: { id: enemy.id, stats: { maxHp: 999 } } }, { dryRun: false });

      expect(result.ok, result.summary).toBe(true);
      expect(ctx.project.database.enemies[0]?.stats.maxHp).toBe(999);
    });

    it("upsert_enemy 는 실제로 있는 스킬·아이템 참조는 그대로 통과시킨다", () => {
      const ctx: ToolContext = { project: createBlankProject() };
      const enemy = ctx.project.database.enemies[0]!;
      const skill = ctx.project.database.skills[0]!;
      const item = ctx.project.database.items[0]!;

      const result = runTool(ctx, "upsert_enemy", {
        enemy: { id: enemy.id, actions: [{ skillId: skill.id, priority: 7 }], rewards: { dropItemId: item.id, dropRatePercent: 30 } },
      }, { dryRun: false });

      expect(result.ok, result.summary).toBe(true);
      expect(ctx.project.database.enemies[0]?.actions[0]?.skillId).toBe(skill.id);
      expect(ctx.project.database.enemies[0]?.rewards.dropItemId).toBe(item.id);
    });

    // 일반 무결성 게이트에 걸리는 다른 툴은 요약에 첫 위반 사유를 싣는다 — 예전엔 어느 lint 든 한 줄로 고정.
    it("일반 커밋 거부 요약은 첫 위반 사유와 나머지 건수를 싣는다", () => {
      const ctx: ToolContext = { project: createBlankProject() };
      const result = runTool(ctx, "upsert_item", { item: { id: "item_test_ref", name: "시험", skillId: "skill_nope" } }, { dryRun: false });

      expect(result.ok).toBe(false);
      expect(result.summary).toMatch(/^'upsert_item' 커밋 거부\(무결성 오류\) — /u);
      expect(result.summary).toContain("skillId does not exist");
      expect(result.issues?.some((issue) => issue.code === "reference-validation")).toBe(true);
    });

    it("upsert_enemy accepts a record copied from an existing enemy (legacy graphicHue/flying dropped with a note)", () => {
      const ctx: ToolContext = { project: createBlankProject() };
      const src = ctx.project.database.enemies[0]!;
      const copy = { ...structuredClone(src), id: "enemy_copy_test", name: "복사본" };
      const result = runTool(ctx, "upsert_enemy", { enemy: copy }, { dryRun: false });
      expect(result.ok, JSON.stringify(result.issues)).toBe(true);
      expect(ctx.project.database.enemies.some((entry) => entry.id === "enemy_copy_test")).toBe(true);
      // 쓰기 도구의 비차단 경고는 diff.warnings 로 나온다(toolRunner: diff.warnings.push(...exec.warnings)).
      expect(JSON.stringify([...(result.diff?.warnings ?? []), ...(result.warnings ?? []), ...(result.issues ?? [])])).toMatch(/graphicHue/);
    });
  });
});

describe("defineEndingAdoptsBlueprintEnding", () => {
  isolateTimers();
  // 2026-11-16 pf4 은행 r5a-river: build_blueprint_path 가 먼저 청사진 엔딩(ending_xbbs3u)을 만들고, 모델의 define_ending 이 같은 이름의 ending_mill 을 더해
  // 보스의 두 페이지가 서로 다른 엔딩을 불렀다. 같은 맺음이면 경로가 만든 엔딩을 그 자리에서 고쳐 쓴다.
  describe("define_ending 은 청사진 경로가 만든 같은 맺음의 엔딩을 고쳐 쓴다", () => {
    const boss = (endingId: string) => ({ id: "ev_boss", name: "두꺼비", x: 3, y: 3, trigger: { kind: "action" }, commands: [], pages: [{ id: "p0", trigger: { kind: "action" }, priority: "same", graphic: {}, movement: { type: "fixed", speed: 3, frequency: 3 }, conditions: [], commands: [{ kind: "triggerEnding", endingId }] }] });

    it("경로 먼저 · define_ending 나중(r5a-river 순서) — 엔딩은 하나, 이미 부르던 곳은 새 id 를 부른다", () => {
      const ctx: ToolContext = { project: createBlankProject() };
      const made = blueprintEndingId("다시 도는 물레방아");
      expect(runTool(ctx, "define_ending", { id: made, name: "다시 도는 물레방아", conditions: [], epilogue: [{ kind: "say", text: "물길이 열렸다." }], presentation: { finalTitle: "다시 도는 물레방아", credits: "물레방아가 멈춘 날" } }).ok).toBe(true);
      ctx.project.maps[ctx.project.startMapId]!.events.push(boss(made) as never);
      const result = runTool(ctx, "define_ending", { id: "ending_mill", name: "다시 도는 물레방아", conditions: [], epilogue: [{ kind: "say", text: "두꺼비가 사라지자 물길이 다시 열렸다." }] });
      expect(result.ok).toBe(true);
      expect(result.summary).toContain(`replaced the ending ${made}`);
      const endings = ctx.project.endings ?? [];
      expect(endings.map((e) => e.id)).toEqual(["ending_mill"]);
      // 모델이 보낸 칸은 모델 것, 안 보낸 칸(크레딧)은 경로가 지은 것.
      expect(JSON.stringify(endings[0]!.epilogue)).toContain("두꺼비가 사라지자");
      expect(endings[0]!.presentation?.credits).toBe("물레방아가 멈춘 날");
      const calls = JSON.stringify(ctx.project.maps[ctx.project.startMapId]!.events.find((e) => e.id === "ev_boss")!.pages);
      expect(calls).toContain('"endingId":"ending_mill"');
      expect(calls).not.toContain(made);
    });

    it("이름이 다른 엔딩은 따로 더한다", () => {
      const ctx: ToolContext = { project: createBlankProject() };
      runTool(ctx, "define_ending", { id: blueprintEndingId("다시 도는 물레방아"), name: "다시 도는 물레방아", conditions: [] });
      runTool(ctx, "define_ending", { id: "ending_bad", name: "물에 잠긴 마을", conditions: [] });
      expect((ctx.project.endings ?? []).map((e) => e.id).sort()).toEqual([blueprintEndingId("다시 도는 물레방아"), "ending_bad"].sort());
    });
  });
});

describe("encounterRateGuarantee", () => {
  isolateTimers();
  // 라이브 QA 사고: AI가 인카운터 테이블·사냥터까지 다 깔았는데 맵 encounterRate 가 0으로 남아
  // playSceneMovement 의 `rate <= 0` 게이트에 막혀 "몬스터가 나와야함" 요구가 조용히 실패했다.
  // 테이블을 세우는 툴은 발생률까지 같이 보장해야 한다.

  function mapOf(project: Project, mapId: string): GameMap {
    const map = project.maps[mapId];
    if (map === undefined) throw new Error(`Missing test map: ${mapId}`);
    return map;
  }
  function preparedProject(): { readonly project: Project; readonly mapId: string } {
    const project = createBlankProject();
    const mapId = project.startMapId;
    mapOf(project, mapId).encounterRate = 0;
    return { project, mapId };
  }
  const ENTRY = { troopId: "troop_slime", weight: 1 };
  describe("set_encounter_table keeps the table alive", () => {
    it("lifts a zero encounter rate so the table can actually fire", () => {
      const { project, mapId } = preparedProject();
      const ctx = { project };

      const result = runTool(ctx, "set_encounter_table", { mapId, entries: [ENTRY] });

      expect(result.ok, `${result.summary} ${JSON.stringify(result.issues ?? [])}`).toBe(true);
      const map = mapOf(ctx.project, mapId);
      expect(map.encounterTable).toHaveLength(1);
      expect(map.encounterRate ?? 0).toBeGreaterThan(0);
      expect(result.summary).toMatch(/인카운터율/);
    });

    it("keeps an author-chosen rate instead of overwriting it", () => {
      const { project, mapId } = preparedProject();
      mapOf(project, mapId).encounterRate = 7;
      const ctx = { project };

      expect(runTool(ctx, "set_encounter_table", { mapId, entries: [ENTRY] }).ok).toBe(true);

      expect(mapOf(ctx.project, mapId).encounterRate).toBe(7);
    });

    it("honors an explicit rate, including an explicit zero", () => {
      const { project, mapId } = preparedProject();
      const ctx = { project };

      expect(runTool(ctx, "set_encounter_table", { mapId, entries: [ENTRY], encounterRate: 40 }).ok).toBe(true);
      expect(mapOf(ctx.project, mapId).encounterRate).toBe(40);

      expect(runTool(ctx, "set_encounter_table", { mapId, entries: [ENTRY], encounterRate: 0 }).ok).toBe(true);
      expect(mapOf(ctx.project, mapId).encounterRate).toBe(0);

      const rejected = runTool(ctx, "set_encounter_table", { mapId, entries: [ENTRY], encounterRate: -3 });
      expect(rejected.ok).toBe(false);
    });

    it("leaves the rate alone when the table is cleared", () => {
      const { project, mapId } = preparedProject();
      const ctx = { project };

      expect(runTool(ctx, "set_encounter_table", { mapId, entries: [] }).ok).toBe(true);

      const map = mapOf(ctx.project, mapId);
      expect(map.encounterTable).toBeUndefined();
      expect(map.encounterRate ?? 0).toBe(0);
    });
  });
  describe("make_hunting_ground keeps the table alive", () => {
    it("lifts a zero encounter rate alongside the field spawn", () => {
      const { project, mapId } = preparedProject();
      const ctx = { project };

      const result = runTool(ctx, "make_hunting_ground", {
        mapId,
        area: { x: 2, y: 2, w: 6, h: 6 },
        troopId: "troop_slime",
      });

      expect(result.ok, `${result.summary} ${JSON.stringify(result.issues ?? [])}`).toBe(true);
      const map = mapOf(ctx.project, mapId);
      expect(map.fieldSpawns ?? []).toHaveLength(1);
      expect(map.encounterTable ?? []).toHaveLength(1);
      expect(map.encounterRate ?? 0).toBeGreaterThan(0);
    });
  });
});
