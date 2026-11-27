import { describe, expect, it } from "vitest";
import { formatActorGraphicOverride, parseActorGraphicOverride } from "@/project/actorGraphicOverride";
import { resolvePlayerSpriteResource } from "@/player/playerSpriteResources";
import { createBlankProject, DEFAULT_ANIMATION_ID, DEFAULT_CLASS_ID, DEFAULT_EQUIPMENT_ID, DEFAULT_SKILL_ID, DEFAULT_EASYRPG_CHARSET_ID } from "@/project/defaults";
import { startSession } from "@/project/session";
import { ACTOR_STATE_RATE_PERCENTAGES, createActorRecord, normalizeActorRecord, parameterValueAtLevel, stateRatePercentage, totalExpForLevel } from "@/project/actorModel";
import { createBattleRuntime } from "@/battle/runtime";
import { deserialize, serialize, createProjectBackup, migrateV1toV2, ProjectFormatError, restoreProjectBackup, serializePretty } from "@/project/io";
import type { Project, ActorAutoTactic, SkillRecord, AudioDescriptionOverrides } from "@/project/types";
import battleFixture from "./fixtures/projects/battle-v3.json";
import { actorFightsAutomatically, chooseAutoBattleCommand } from "@/battle/battleAuto";
import { isolateTimers } from "./mergedTeardown";
import { createProjectPackage, readProjectPackage } from "@/project/package";
import { getAudioDescriptionOverride, resetAudioDescriptionOverride, setAudioDescriptionOverride } from "@/project/audioDescriptions";
import eventPagesV3 from "./fixtures/projects/event-pages-v3.json";
import { makeV1 } from "./migrationFixtures";
import { battleRoundCount } from "@/project/battleReports";
import type { BattleSnapshot } from "@/battle/types";
import { AREA_LABELS, COUNTED_PROJECT_FIELDS, changedAreaLabels } from "@/project/changeAreas";
import { listCharacterFaces, listCharacterSprites, seedGraphicAttributes, updateCharacterSprite } from "@/project/characterGraphics";
import { isRecommendedCharacterFace, rankCharacterFaces } from "@/project/characterFaceCandidates";
import { reviewedCharsetFace } from "@/assets/charsetFaceMap";
import { reviewedFaceIdForCharset } from "@/assets/reviewedCharsetFaces";

// 주인공 모습 변경이 시트 안 칸(characterIndex)을 지킨다 — 2026-09-24 꿈 세계 도그푸딩(효과로 외형 바꾸기).
describe("actorGraphicOverrideIndex", () => {
  isolateTimers();
  describe("actor graphic override", () => {
    it("검색 id·#칸·맨 id 를 모두 읽는다", () => {
      expect(parseActorGraphicOverride("charset:tex_easyrpg_charset_people1:3")).toEqual({ resourceId: "tex_easyrpg_charset_people1", characterIndex: 3 });
      expect(parseActorGraphicOverride("easyrpg-charset-actor2#5")).toEqual({ resourceId: "easyrpg-charset-actor2", characterIndex: 5 });
      expect(parseActorGraphicOverride("easyrpg-charset-actor2")).toEqual({ resourceId: "easyrpg-charset-actor2", characterIndex: 0 });
      expect(formatActorGraphicOverride("x", 0)).toBe("x");
      expect(formatActorGraphicOverride("x", 4)).toBe("x#4");
    });

    it("필드 스프라이트가 오버라이드의 칸을 쓴다", () => {
      const project = createBlankProject();
      const session = startSession(project);
      const actorId = session.partyActorIds[0]!;
      session.actorCharacterResourceIds = { [actorId]: "tex_easyrpg_charset_people1#3" };
      const sprite = resolvePlayerSpriteResource(project, session);
      expect(sprite.characterIndex).toBe(3);
      session.actorCharacterResourceIds = { [actorId]: "tex_easyrpg_charset_people1" };
      expect(resolvePlayerSpriteResource(project, session).characterIndex).toBe(0);
    });
  });
});

describe("actorModel", () => {
  isolateTimers();
  describe("actorModel", () => {
    isolateTimers();
    describe("RM2K3 actor model", () => {
      it("creates full RM2K3 actor defaults when a new actor is added", () => {
        const actor = createActorRecord("actor_test", DEFAULT_CLASS_ID, {
          characterResourceId: DEFAULT_EASYRPG_CHARSET_ID,
          battleCharacterResourceId: DEFAULT_EASYRPG_CHARSET_ID,
          defaultEquipmentId: DEFAULT_EQUIPMENT_ID,
          defaultSkillId: DEFAULT_SKILL_ID,
          unarmedAnimationId: DEFAULT_ANIMATION_ID,
        });

        expect(actor.initialLevel).toBe(1);
        expect(actor.maxLevel).toBe(99);
        expect(actor.critical).toEqual({ enabled: true, chanceDenominator: 30 });
        expect(actor.learnedSkills).toEqual([{ level: 1, skillId: DEFAULT_SKILL_ID }]);
        expect(actor.initialEquipment.weapon).toBe(DEFAULT_EQUIPMENT_ID);
        expect(actor.nickname).toBe("");
        expect(actor.stateRates["state_death"]).toBe("C");
        expect(actor.elementRates.sword).toBe("C");
        expect(actor.parameterCurves.maxHp).toHaveLength(99);
        expect(parameterValueAtLevel(actor.parameterCurves.attack, 1)).toBe(45);
      });

      it("normalizes legacy actor skillIds and clamps RM2K3 numeric bounds", () => {
        const actor = normalizeActorRecord({
          id: "actor_legacy",
          name: "Legacy",
          classId: DEFAULT_CLASS_ID,
          initialLevel: -5,
          maxLevel: 500,
          skillIds: [DEFAULT_SKILL_ID],
        });

        expect(actor.initialLevel).toBe(1);
        expect(actor.maxLevel).toBe(99);
        expect(actor.nickname).toBe("");
        expect(actor.learnedSkills).toEqual([{ level: 1, skillId: DEFAULT_SKILL_ID }]);
        expect(actor.critical.chanceDenominator).toBe(30);
        expect(actor.options.dualWield).toBe(false);
      });

      it("restores the default hero charset for persisted actors missing a character resource", () => {
        const actor = normalizeActorRecord({
          id: "actor_hero",
          name: "주인공",
          classId: DEFAULT_CLASS_ID,
          initialLevel: 1,
          maxLevel: 99,
        });

        expect(actor.characterResourceId).toBe("easyrpg-charset-actor1");
        expect(actor.faceResourceId).toBe("easyrpg-faceset-actor1-00");
      });

      it("does not synthesize non-hero character resources for persisted actors", () => {
        const actor = normalizeActorRecord({
          id: "actor_cleric",
          name: "성직자",
          classId: DEFAULT_CLASS_ID,
          initialLevel: 1,
          maxLevel: 99,
        });

        expect(actor.characterResourceId).toBeUndefined();
        // 걷기 그림이 없으면 짝을 정할 근거가 없다 — 이름(actor_cleric)으로 얼굴을 지어내지 않는다.
        expect(actor.faceResourceId).toBeUndefined();
      });

      it("calculates total EXP from the actor experience curve", () => {
        const actor = createActorRecord("actor_test", DEFAULT_CLASS_ID);

        expect(totalExpForLevel(actor.expCurve, 1)).toBe(0);
        expect(totalExpForLevel(actor.expCurve, 2)).toBeGreaterThan(actor.expCurve.base);
        expect(totalExpForLevel(actor.expCurve, 99)).toBeGreaterThan(totalExpForLevel(actor.expCurve, 50));
      });

      it("maps RM2K3 state rate grades to descending manual probabilities", () => {
        expect(ACTOR_STATE_RATE_PERCENTAGES).toEqual({ A: 100, B: 80, C: 60, D: 30, E: 0 });
        expect(stateRatePercentage("A")).toBeGreaterThan(stateRatePercentage("B"));
        expect(stateRatePercentage("B")).toBeGreaterThan(stateRatePercentage("C"));
        expect(stateRatePercentage("C")).toBeGreaterThan(stateRatePercentage("D"));
        expect(stateRatePercentage("D")).toBeGreaterThan(stateRatePercentage("E"));
      });
    });
  });
  describe("battleRuntimeStates", () => {
    isolateTimers();
    function battleProject(): Project {
      return deserialize(JSON.stringify(battleFixture));
    }
    describe("battle runtime — 상태이상 연결", () => {
      it("상태 부여 스킬을 명중시키면 대상 stateIds 에 상태가 실린다", () => {
        const project = battleProject();
        // fixture 의 화염 스킬에 독 부여 효과를 붙인다(확률 100).
        const fire = project.database.skills.find((skill) => skill.id === "skill_fire");
        if (!fire) throw new Error("missing skill_fire");
        fire.stateEffects = [{ stateId: "state_burn", chance: 100, operation: "add" }];
        fire.mpCost = { flat: 0, percentMax: 0 };
        const actor = project.database.actors.find((record) => record.id === "actor_hero");
        if (actor) actor.learnedSkills = [{ level: 1, skillId: "skill_fire" }];
        const enemy = project.database.enemies.find((record) => record.id === "enemy_slime");
        if (enemy) enemy.stats = { ...enemy.stats, maxHp: 9999 };

        const runtime = createBattleRuntime({ project, troopId: "troop_slime", canEscape: true, canLose: true });
        runtime.tick(1_000);
        runtime.performActorCommand({ kind: "skill", skillId: "skill_fire", targetEnemyId: "enemy-1" });

        expect(runtime.snapshot().enemies[0]?.stateIds).toContain("state_burn");
      });

      it("승리 시 파티 정보를 주면 레벨업 미리보기를 보상 스냅샷에 담는다", () => {
        const project = battleProject();
        const hero = normalizeActorRecord(project.database.actors[0]);
        const bigExp = totalExpForLevel(hero.expCurve, 5);
        const slime = project.database.enemies.find((record) => record.id === "enemy_slime");
        if (slime) slime.stats = { ...slime.stats, maxHp: 1, defense: 0 };

        const runtime = createBattleRuntime({
          project,
          troopId: "troop_slime",
          canEscape: true,
          canLose: true,
          party: { levels: { actor_hero: 1 }, experience: { actor_hero: bigExp } },
        });
        for (let i = 0; i < 500; i += 1) {
          runtime.tick(50);
          if (runtime.snapshot().phase === "actorCommand") break;
        }
        runtime.performActorCommand({ kind: "attack", targetEnemyId: "enemy-1" });

        const snapshot = runtime.snapshot();
        expect(snapshot.result).toBe("victory");
        expect(snapshot.rewards.levelUps?.length).toBeGreaterThan(0);
        expect(snapshot.rewards.levelUps?.[0]?.toLevel).toBeGreaterThan(1);
      });

      it("파티 정보가 없으면 레벨업 미리보기를 계산하지 않는다", () => {
        const runtime = createBattleRuntime({ project: battleProject(), troopId: "troop_slime", canEscape: true, canLose: true });
        runtime.tick(1_000);
        runtime.performActorCommand({ kind: "attack", targetEnemyId: "enemy-1" });
        expect(runtime.snapshot().rewards.levelUps).toEqual([]);
      });
    });
  });
  describe("battleSessionLevel", () => {
    isolateTimers();
    function battleProject(): Project {
      return deserialize(JSON.stringify(battleFixture));
    }
    function heroMaxHpAtLevel(project: Project, level: number): number {
      return parameterValueAtLevel(normalizeActorRecord(project.database.actors[0]).parameterCurves.maxHp, level);
    }
    describe("battle runtime — 세션 레벨/바이탈 반영", () => {
      it("세션 액터 레벨이 있으면 그 레벨의 파라미터 곡선으로 능력치를 산출한다", () => {
        const project = battleProject();
        const leveled = createBattleRuntime({
          project,
          troopId: "troop_slime",
          canEscape: true,
          canLose: true,
          party: { levels: { actor_hero: 40 }, experience: {} },
        });
        const actor = leveled.snapshot().actors[0];
        expect(actor?.maxHp).toBe(heroMaxHpAtLevel(project, 40));
        // 레벨업 전(레벨1) 능력치보다 확실히 높다.
        expect(actor?.maxHp).toBeGreaterThan(heroMaxHpAtLevel(project, 1));
      });

      it("세션 레벨이 없으면 DB initialLevel(레벨1)로 폴백한다", () => {
        const project = battleProject();
        const runtime = createBattleRuntime({ project, troopId: "troop_slime", canEscape: true, canLose: true });
        // 회귀: fixture 주인공 레벨1 maxHp = 514.
        expect(runtime.snapshot().actors[0]?.maxHp).toBe(514);
        expect(runtime.snapshot().actors[0]?.maxHp).toBe(heroMaxHpAtLevel(project, 1));
      });

      it("세션 현재 바이탈(부상 상태)을 전투 진입 시 이어받되 현재 레벨 최대치로 클램프한다", () => {
        const project = battleProject();
        const runtime = createBattleRuntime({
          project,
          troopId: "troop_slime",
          canEscape: true,
          canLose: true,
          party: { levels: { actor_hero: 40 }, experience: {}, vitals: { actor_hero: { hp: 12, mp: 3 } } },
        });
        const actor = runtime.snapshot().actors[0];
        // 필드에서 이어지는 부상 HP/MP 를 그대로 유지.
        expect(actor?.hp).toBe(12);
        expect(actor?.mp).toBe(3);
        expect(actor?.maxHp).toBe(heroMaxHpAtLevel(project, 40));
      });

      it("세션 바이탈이 현재 레벨 최대치를 넘으면 최대치로 잘린다", () => {
        const project = battleProject();
        const runtime = createBattleRuntime({
          project,
          troopId: "troop_slime",
          canEscape: true,
          canLose: true,
          party: { levels: { actor_hero: 1 }, experience: {}, vitals: { actor_hero: { hp: 999_999, mp: 999_999 } } },
        });
        const actor = runtime.snapshot().actors[0];
        expect(actor?.hp).toBe(actor?.maxHp);
        expect(actor?.maxHp).toBe(514);
      });

      it("세션 파라미터 보정과 상태 이상을 전투 액터에 반영한다", () => {
        const project = battleProject();
        const runtime = createBattleRuntime({
          project,
          troopId: "troop_slime",
          canEscape: true,
          canLose: true,
          party: {
            levels: { actor_hero: 1 },
            experience: {},
            paramBonuses: { actor_hero: { maxHp: 25, attack: 7 } },
            stateIds: { actor_hero: ["state_poison"] },
          },
        });
        const actor = runtime.snapshot().actors[0];
        expect(actor?.maxHp).toBe(heroMaxHpAtLevel(project, 1) + 25);
        expect(actor?.hp).toBe(actor?.maxHp);
        expect(actor?.stateIds).toEqual(["state_poison"]);
      });
    });
  });
  describe("mgL2BflowTactics", () => {
    isolateTimers();
    function skill(id: string, name: string, patch: Partial<SkillRecord>): SkillRecord {
      return {
        id, name, scope: "enemy", power: 30, description: "", type: "normal",
        mpCost: { flat: 0, percentMax: 0 }, successRate: 100, variance: 0, hitRate: 100,
        effect: { kind: "damage", statistic: "attack", affects: "hp" },
        ...patch,
      } as SkillRecord;
    }
    /** 배우: 비싼 광역기(MP 10), 공짜 단일기(MP 0), 회복기(MP 5). HP 는 60% 로 시작. */
    function tacticsProject(tactic?: ActorAutoTactic, autoBattle = true): Project {
      const project = deserialize(JSON.stringify(battleFixture));
      project.database.skills.push(
        skill("skill_blast", "폭발", { power: 200, mpCost: { flat: 10, percentMax: 0 } }),
        skill("skill_jab", "잽", { power: 5 }),
        skill("skill_heal", "치유", { scope: "ally", power: 50, mpCost: { flat: 5, percentMax: 0 }, effect: { kind: "healing", statistic: "mind", affects: "hp" } }),
      );
      // 직업이 주는 화염도 MP 를 쓰게 해 "MP 0 기술" 은 잽 하나만 남긴다.
      project.database.skills.find((record) => record.id === "skill_fire")!.mpCost = { flat: 4, percentMax: 0 };
      const hero = project.database.actors.find((record) => record.id === "actor_hero")!;
      hero.learnedSkills = [{ level: 1, skillId: "skill_blast" }, { level: 1, skillId: "skill_jab" }, { level: 1, skillId: "skill_heal" }];
      hero.options = { ...hero.options, autoBattle, ...(tactic ? { autoTactic: tactic } : {}) };
      const slime = project.database.enemies.find((record) => record.id === "enemy_slime")!;
      slime.stats = { ...slime.stats, maxHp: 9999, attack: 1 };
      return project;
    }
    function heroMaxHp(project: Project): number {
      return createBattleRuntime({ project, troopId: "troop_slime", canEscape: true, canLose: true, rng: () => 0.5 }).snapshot().actors[0]!.maxHp;
    }
    function firstStrictCommand(tactic: ActorAutoTactic | undefined, hpRatio: number) {
      const project = tacticsProject(tactic);
      const maxHp = heroMaxHp(project);
      const runtime = createBattleRuntime({
        project, troopId: "troop_slime", canEscape: true, canLose: true, battleFlow: "strict", rng: () => 0.5,
        party: { vitals: { actor_hero: { hp: Math.floor(maxHp * hpRatio), mp: 999 } } },
      });
      // 자동 배우는 명령 메뉴 없이 첫 라운드가 해결된다.
      return runtime.snapshot().roundLogs[0]?.actions.find((action) => action.side === "actor");
    }
    describe("mg-l2-bflow #11 배우별 자동 전투 작전", () => {
      it("autoBattle 배우는 strict 에서 명령 메뉴를 열지 않고 첫 라운드를 스스로 해결한다", () => {
        const action = firstStrictCommand(undefined, 1);
        expect(action).toBeDefined();
      });

      it("수동 배우(autoBattle 꺼짐)와 followOrders 는 명령 메뉴를 연다", () => {
        for (const project of [tacticsProject(undefined, false), tacticsProject("followOrders")]) {
          const runtime = createBattleRuntime({ project, troopId: "troop_slime", canEscape: true, canLose: true, battleFlow: "strict", rng: () => 0.5 });
          expect(runtime.snapshot().phase).toBe("actorCommand");
          expect(runtime.snapshot().roundLogs).toHaveLength(0);
        }
        expect(actorFightsAutomatically(tacticsProject("followOrders"), "actor_hero", undefined)).toBe(false);
        expect(actorFightsAutomatically(tacticsProject("attackAll"), "actor_hero", undefined)).toBe(true);
      });

      it("HP 60% 에서 회복 우선은 치유, 전원 공격·균형은 공격한다", () => {
        expect(firstStrictCommand("healFirst", 0.6)?.skillName).toBe("치유");
        expect(firstStrictCommand("attackAll", 0.6)?.skillName).toBe("폭발");
        expect(firstStrictCommand(undefined, 0.6)?.skillName).toBe("폭발");
      });

      it("MP 아끼기는 MP 를 쓰는 폭발 대신 공짜 잽을 쓰고, 위급(HP 20%)할 때만 회복한다", () => {
        expect(firstStrictCommand("conserveMp", 1)?.skillName).toBe("잽");
        expect(firstStrictCommand("conserveMp", 0.2)?.skillName).toBe("치유");
        expect(firstStrictCommand("conserveMp", 0.3)?.skillName).toBe("잽");
      });

      it("gauge 에서도 자동 배우는 차례가 오자마자 행동하고 게이지를 비운다", () => {
        const runtime = createBattleRuntime({ project: tacticsProject("attackAll"), troopId: "troop_slime", canEscape: true, canLose: true, battleFlow: "gauge", rng: () => 0.5 });
        for (let index = 0; index < 40 && !runtime.snapshot().timeline.some((entry) => entry.side === "actor" && entry.kind === "damage"); index += 1) {
          runtime.tick(250);
          expect(runtime.snapshot().phase).not.toBe("actorCommand");
        }
        const hit = runtime.snapshot().timeline.find((entry) => entry.side === "actor" && entry.kind === "damage");
        expect(hit?.skillName).toBe("폭발");
      });

      it("chooseAutoBattleCommand 에 작전을 직접 넘길 수 있다(자동 버튼 경로)", () => {
        const project = tacticsProject(undefined, false);
        const runtime = createBattleRuntime({ project, troopId: "troop_slime", canEscape: true, canLose: true, battleFlow: "strict", rng: () => 0.5 });
        expect(chooseAutoBattleCommand(project, runtime.snapshot(), () => 0.5, "conserveMp")).toMatchObject({ kind: "skill", skillId: "skill_jab" });
      });

      it("autoTactic 은 정규화·저장을 지나고 알 수 없는 값은 버린다", () => {
        const project = tacticsProject("healFirst");
        expect(deserialize(serialize(project)).database.actors.find((record) => record.id === "actor_hero")?.options.autoTactic).toBe("healFirst");
        const hero = project.database.actors.find((record) => record.id === "actor_hero")!;
        const junk = normalizeActorRecord({ ...hero, options: { ...hero.options, autoTactic: "panic" as ActorAutoTactic } });
        expect(junk.options.autoTactic).toBeUndefined();
      });
    });
  });
});

describe("audioDescriptionPersistence", () => {
  isolateTimers();
  describe("audio description serialization", () => {
    it.each([
      ["v1", () => makeV1()],
      ["v2", () => migrateV1toV2(makeV1())],
      ["v3", () => eventPagesV3],
      ["v4", () => createBlankProject()],
    ] as const)("preserves absent overrides when loading legacy %s", (_version, fixture) => {
      // Given
      const raw = JSON.stringify(fixture());
      // When
      const loaded = deserialize(raw);
      const restored = deserialize(serialize(loaded));
      // Then
      expect(Object.hasOwn(loaded, "audioDescriptions")).toBe(false);
      expect(Object.hasOwn(restored, "audioDescriptions")).toBe(false);
      expect(restored.version).toBe(4);
    });

    it("preserves serialized legacy fields when loading a blank project", () => {
      // Given
      const project = createBlankProject();
      const raw = serialize(project);
      // When
      const restored = deserialize(raw);
      // Then
      expect(restored.meta).toEqual(project.meta);
      expect(restored.assets).toEqual(project.assets);
    });
  });
  describe("audio description load boundary", () => {
    const project = createBlankProject();
    it.each([
      ["null map", null],
      ["array map", []],
      ["numeric map", 7],
      ["null music", { music: null }],
      ["array music", { music: [] }],
      ["numeric music", { music: 7 }],
      ["numeric sound", { sound: 7 }],
      ["string partition", { music: "invalid" }],
      ["null sound", { sound: null }],
      ["array sound", { sound: [] }],
      ["unknown partition", { bgm: {} }],
      ["non-audio partition", { picture: {} }],
      ["null value", { music: { orphan: null } }],
      ["array value", { sound: { orphan: [] } }],
      ["numeric value", { music: { orphan: 7 } }],
      ["boolean value", { sound: { orphan: false } }],
      ["object value", { sound: { orphan: {} } }],
      ["overlong value", { music: { orphan: "x".repeat(4001) } }],
      ["overlong UTF-16 value", { sound: { orphan: "\uD83C\uDFB5".repeat(2001) } }],
      ["overlong padded value", { music: { orphan: ` ${"x".repeat(4000)} ` } }],
    ])("rejects malformed audioDescriptions when loading %s", (_label, audioDescriptions) => {
      // Given
      const raw = JSON.stringify({ ...project, audioDescriptions });
      // When / Then
      expect(() => deserialize(raw)).toThrow(ProjectFormatError);
    });
  });
  describe("authored audio description round trips", () => {
    const project = createBlankProject();
    const resource = { kind: "music", resourceId: "raw_orphan_audio" } as const;
    it.each([serialize, serializePretty])("preserves raw audio IDs matching retired field names when using %s", (write) => {
      const audioDescriptions = {
        music: { terrainTemplates: "AUDIO_DESC_RESERVED_MUSIC" },
        sound: { terrainTemplates: "" },
      };
      const source = { ...project, audioDescriptions, terrainTemplates: { legacy: true } };

      const result = deserialize(write(source));

      expect(result.audioDescriptions).toEqual(audioDescriptions);
      expect(Object.hasOwn(JSON.parse(write(source)), "terrainTemplates")).toBe(false);
    });
    const authored: AudioDescriptionOverrides = {
      music: { raw_orphan_audio: " \tAUDIO_DESC_QA_20260906\n\"quoted\"\n ", cleared: "", ["__proto__"]: "own-key" },
      sound: { raw_orphan_audio: "\uD83C\uDFB5".repeat(2000), whitespace: " \t\n " },
    };

    it.each([serialize, serializePretty])("preserves exact stored strings and orphan IDs when round-tripping with %s", (write) => {
      // Given
      const source = { ...project, audioDescriptions: authored };
      // When
      const result = deserialize(write(deserialize(write(source))));
      // Then
      expect(result.audioDescriptions).toEqual(authored);
      expect(Object.hasOwn(result.audioDescriptions?.music ?? {}, "missing")).toBe(false);
      expect(getAudioDescriptionOverride(result.audioDescriptions, resource)).toBe(authored.music?.[resource.resourceId]);
      expect(result.version).toBe(4);
    });

    it.each([{}, { music: {} }, { music: {}, sound: {} }])("preserves empty optional maps without backfill when loading %j", (audioDescriptions) => {
      // Given
      const source = { ...project, audioDescriptions };
      // When
      const result = deserialize(serialize(source));
      // Then
      expect(result.audioDescriptions).toEqual(audioDescriptions);
    });

    it.each(["", "  AUDIO_DESC_QA_20260906  "])("preserves a new written state when round-tripping %j", (input) => {
      // Given
      const source = { ...project, audioDescriptions: setAudioDescriptionOverride(undefined, resource, input) };
      // When
      const result = deserialize(serialize(deserialize(serialize(source))));
      // Then
      expect(result.audioDescriptions).toEqual({ music: { [resource.resourceId]: input.trim() } });
    });

    it("restores inherited state across serialization when resetting an explicit clear", () => {
      // Given
      const before = { music: { [resource.resourceId]: "" } };
      const overrides = resetAudioDescriptionOverride(before, resource);
      const source = { ...project, ...(overrides === undefined ? {} : { audioDescriptions: overrides }) };
      // When
      const result = deserialize(serialize(source));
      // Then
      expect(Object.hasOwn(result, "audioDescriptions")).toBe(false);
    });
  });
  describe("audio description recovery snapshots", () => {
    it.each([
      undefined,
      {
        music: { orphan: " \tBACKUP_VALUE\n ", cleared: "", ["__proto__"]: "OWN_ID" },
        sound: { orphan: "SOUND_VALUE", terrainTemplates: "" },
      },
    ])("preserves description states when restoring a backup into an editor package: %j", async (descriptions) => {
      // Given
      const source = createBlankProject();
      if (descriptions !== undefined) source.audioDescriptions = descriptions;
      const backup = createProjectBackup(source);
      source.audioDescriptions = { music: { replacement: "AFTER_BACKUP" } };
      // When
      const restored = restoreProjectBackup(backup);
      const packaged = await readProjectPackage(createProjectPackage(restored));
      // Then
      expect(restored.audioDescriptions).toEqual(descriptions);
      expect(packaged.audioDescriptions).toEqual(descriptions);
      expect(Object.hasOwn(packaged, "audioDescriptions")).toBe(descriptions !== undefined);
      expect(source.audioDescriptions).toEqual({ music: { replacement: "AFTER_BACKUP" } });
    // 빈 프로젝트를 백업·편집기 패키지로 두 번 왕복한다. ci-full 46024239707 에서 11.7~11.9초, 46034884144(4코어 2워커)에서 15.4~16.2초로
    // 15초 한도를 넘었다 — 판정은 그대로, 한도만 다른 무거운 왕복 시험처럼 60초로 둔다.
    }, 60_000);
  });
});

describe("battleReportTurnCount", () => {
  isolateTimers();
  const snapshot = (fields: Partial<BattleSnapshot>) => fields as BattleSnapshot;
  describe("battleRoundCount", () => {
    it("gauge 전투는 파티가 낸 명령 수를 센다", () => {
      expect(battleRoundCount(snapshot({ turn: 1, strictRound: 0, partyCommandRounds: 7 }))).toBe(7);
    });

    it("strict 전투는 완료한 라운드 수를 센다", () => {
      expect(battleRoundCount(snapshot({ turn: 3, strictRound: 3, partyCommandRounds: 4 }))).toBe(3);
    });

    it("명령 수를 남기지 않은 옛 스냅샷은 사이클 수로 되돌아간다", () => {
      expect(battleRoundCount(snapshot({ turn: 2, strictRound: 0 }))).toBe(2);
    });

    it("명령이 하나도 없는 전투도 0턴이 아니라 1턴이다", () => {
      expect(battleRoundCount(snapshot({ turn: 0, strictRound: 0, partyCommandRounds: 0 }))).toBe(1);
    });
  });
});

// 요약 카운터 **밖**의 변경이 사라지지 않는지 — 조수 검토 카드·영수증 카드가 읽는 어휘의 회귀.
//
// 왜 이 테스트가 있나 (실측 2026-09-14): 퀘스트·스토리 플래그·캐릭터·맵 연결·공통 이벤트처럼
// ChangeSummary 에 축이 없는 변경은 검토 카드에서 아무 흔적도 남기지 않았다 — 사용자는
// "적용/버리기" 만 있는 빈 카드로 결정해야 했다.
describe("changeAreas", () => {
  isolateTimers();
  function pair(mutate: (after: Project) => void): { before: Project; after: Project } {
    const before = createBlankProject();
    const after = structuredClone(before) as Project;
    mutate(after);
    return { before, after };
  }
  describe("changedAreaLabels", () => {
    it("카운터가 없는 영역의 변경을 사람 말로 남긴다", () => {
      const { before, after } = pair((project) => {
        project.meta = { ...project.meta, author: "다른 사람" };
        project.startPos = { x: 3, y: 4 };
        project.aiInstructions = "항상 한국어로 답한다";
      });
      // 라벨 표 순서 고정 — 사용자가 매번 같은 자리에서 같은 낱말을 읽는다.
      expect(changedAreaLabels(before, after)).toEqual(["프로젝트 정보", "AI 지시문", "시작 위치"]);
    });

    it("카운터가 이미 세는 영역은 입을 다문다 — 같은 사실을 두 번 말하지 않는다", () => {
      const { before, after } = pair((project) => {
        project.switches = [...project.switches, { id: "switch_1", name: "문 열림" }];
        project.variables = [...project.variables, { id: "var_1", name: "호감도" }];
        project.meta = { ...project.meta }; // 값이 같은 복사는 변경이 아니다.
      });
      expect(changedAreaLabels(before, after)).toEqual([]);
    });

    it("세계관은 엔티티 밖 변경만 이름으로 남긴다", () => {
      const withWorld = (relations: readonly unknown[]): Project => {
        const project = createBlankProject();
        project.world = { entities: [], relations: relations as never };
        return project;
      };
      const before = withWorld([]);

      const entitiesOnly = structuredClone(before) as Project;
      entitiesOnly.world = { entities: [{ id: "e1", name: "달" } as never], relations: [] };
      expect(changedAreaLabels(before, entitiesOnly)).toEqual([]);

      const relationsOnly = structuredClone(before) as Project;
      relationsOnly.world = { entities: [], relations: [{ id: "r1", from: "a", to: "b", kind: "ally" } as never] };
      expect(changedAreaLabels(before, relationsOnly)).toEqual(["세계관 관계"]);
    });

    it("아무것도 안 바뀌면 빈 배열", () => {
      const before = createBlankProject();
      expect(changedAreaLabels(before, structuredClone(before) as Project)).toEqual([]);
    });
  });
  describe("커버리지 — 새 필드는 조용히 사라질 수 없다", () => {
    // Project 인터페이스(src/project/types/project.ts)의 키 전량. 필드를 더하면 여기도 늘리고,
    // `COUNTED_PROJECT_FIELDS` 나 `AREA_LABELS` 중 하나에 **반드시** 넣어라. 둘 다 없으면 그 필드의
    // 변경은 검토 카드·영수증 어디에도 나타나지 않는다.
    const PROJECT_FIELDS = [
      "spatialAuthoring", "growth", "version", "meta", "assets", "resourceProfiles", "tilesets",
      "switches", "variables", "commonEvents", "database", "system", "session", "maps",
      "mapConnections", "villageInfoDocuments", "villageTemplates", "villagePresets",
      "defaultVillagePresetId", "aiDocuments", "aiInstructions", "worldCanon", "world", "worldGraph",
      "factions", "quests", "testPresets", "endings", "storyFlags", "characters", "charsetLabels",
      "audioDescriptions", "monsterMetadata", "mapTree", "startMapId", "startPos", "flags",
    ];

    it("모든 Project 키가 카운터에 있거나 라벨이 있다", () => {
      const uncovered = PROJECT_FIELDS.filter(
        (key) => COUNTED_PROJECT_FIELDS[key] !== true && AREA_LABELS[key] === undefined,
      );
      expect(uncovered).toEqual([]);
    });

    it("기본 프로젝트가 실제로 가진 키도 전부 덮인다", () => {
      const uncovered = Object.keys(createBlankProject()).filter(
        (key) => COUNTED_PROJECT_FIELDS[key] !== true && AREA_LABELS[key] === undefined,
      );
      expect(uncovered).toEqual([]);
    });

    it("라벨 표와 카운터 표는 겹치지 않는다 — 겹치면 어느 쪽도 보고하지 않는다", () => {
      const both = Object.keys(AREA_LABELS).filter((key) => COUNTED_PROJECT_FIELDS[key] === true);
      expect(both).toEqual([]);
    });
  });
});

describe("characterFaceCandidates", () => {
  isolateTimers();
  describe("character face evidence", () => {
    it("uses written semantic age and gender without saving or borrowing paired-face traits", () => {
      const project = createBlankProject();
      const before = JSON.stringify(project);
      const nun = listCharacterSprites(project).find((row) => row.textureKey === "tex_easyrpg_charset_people2" && row.characterIndex === 1)!;
      expect(nun.attributes).toMatchObject({ age: "노년", gender: "여성", role: "수녀" });
      expect(listCharacterFaces(project).find((row) => row.resourceId === "easyrpg-faceset-people1-00")?.label).toBe("갈색 단발 소년");
      expect(JSON.stringify(project)).toBe(before);
      updateCharacterSprite(project, { ...nun, attributes: {} });
      expect(listCharacterSprites(project).find((row) => row.textureKey === nun.textureKey && row.characterIndex === 1)?.attributes).toEqual({});
    });

    it("uses reviewed human correspondences without treating NPC fallback or monster indices as exact", () => {
      expect(reviewedCharsetFace("tex_easyrpg_charset_people3", 0)?.resourceId).toBe("easyrpg-faceset-people2-00");
      expect(reviewedCharsetFace("tex_easyrpg_charset_people1", 4)?.approximate).toBe(true);
      expect(reviewedCharsetFace("tex_easyrpg_charset_people2", 1)).toBeNull();
      expect(reviewedCharsetFace("tex_easyrpg_charset_monster2", 1)).toBeNull();
      expect(reviewedCharsetFace("tex_easyrpg_charset_actor1", 8)).toBeNull();
    });

    it("ranks known correspondence first and exposes contradictory written attributes", () => {
      const project = createBlankProject();
      const sprite = listCharacterSprites(project).find((row) => row.textureKey === "tex_easyrpg_charset_people1" && row.characterIndex === 0)!;
      const ranked = rankCharacterFaces(sprite, listCharacterFaces(project));
      expect(ranked[0]?.face.resourceId).toBe("easyrpg-faceset-people1-00");
      expect(ranked.find((candidate) => candidate.face.resourceId === "easyrpg-faceset-people1-07")?.conflicts).toContain("나이: 어린이 ↔ 노년");
      expect(sprite.faceResourceId).toBeNull();
    });
    it("uses both halves of each actor face sheet in editor and NPC tool paths", () => {
      const pairs = [["actor1", "actor1", 0], ["actor2", "actor1", 8], ["actor3", "actor2", 0], ["actor4", "actor2", 8]] as const;
      for (const [charset, faceset, offset] of pairs) for (let slot = 0; slot < 8; slot++) {
        // Actor3 #5(청록 머리 무도가)는 FaceSet/Actor2 에 이 인물이 없다(2026-09-28 원본 대조) — 생성 짝 얼굴을 쓴다.
        if (charset === "actor3" && slot === 5) {
          expect(reviewedCharsetFace("tex_easyrpg_charset_actor3", 5)).toBeNull();
          expect(reviewedFaceIdForCharset("easyrpg-charset-actor3", 5)).toBe("generated-faceset-missing-people-10");
          continue;
        }
        // Actor4 #5(금발 남성 갑옷 전사)는 기존 얼굴이 여성·녹색 스카프라 다른 인물이다 — 2026-10-05 재검토로 공용 대응표가 「얼굴 없음」으로 바꿨다.
        if (charset === "actor4" && slot === 5) {
          expect(reviewedFaceIdForCharset("easyrpg-charset-actor4", 5)).toBeUndefined();
          continue;
        }
        const expected = `easyrpg-faceset-${faceset}-${String(slot + offset).padStart(2, "0")}`;
        const texture = `tex_easyrpg_charset_${charset}`;
        expect(reviewedCharsetFace(texture, slot)?.resourceId).toBe(expected);
        expect(reviewedFaceIdForCharset(`easyrpg-charset-${charset}`, slot)).toBe(expected);
      }
    });

    it("does not recommend children for unknown age or claim a pair from gender alone", () => {
      const project = createBlankProject();
      const gentleman = listCharacterSprites(project).find((row) => row.textureKey === "tex_easyrpg_charset_people2" && row.characterIndex === 0)!;
      const ranked = rankCharacterFaces(gentleman, listCharacterFaces(project));
      expect(ranked.find((candidate) => candidate.face.resourceId === "easyrpg-faceset-people1-00")?.recommendation).toBe("conflict");
      expect(ranked.filter(isRecommendedCharacterFace).some((candidate) => candidate.face.attributes.age === "어린이")).toBe(false);
      const broadMatch = { resourceId: "test-face", label: "남성", attributes: { kind: "사람", gender: "남성" }, note: "" };
      expect(rankCharacterFaces(gentleman, [broadMatch])[0]?.recommendation).toBe("none");
    });

    it("vetoes reviewed-table priority when independent authored traits contradict it", () => {
      const project = createBlankProject();
      const boy = listCharacterSprites(project).find((row) => row.textureKey === "tex_easyrpg_charset_people1" && row.characterIndex === 0)!;
      const face = listCharacterFaces(project).find((row) => row.resourceId === "easyrpg-faceset-people1-00")!;
      const result = rankCharacterFaces(boy, [{ ...face, attributes: { ...face.attributes, gender: "여성" } }])[0]!;
      expect(result.recommendation).toBe("conflict");
      expect(result.score).toBeLessThan(100);
      expect(isRecommendedCharacterFace(result)).toBe(false);
    });

    it("reads face source descriptions independently and does not read a white headband as white hair", () => {
      const project = createBlankProject();
      const face = listCharacterFaces(project).find((row) => row.resourceId === "easyrpg-faceset-actor2-05")!;
      expect(face.label).toBe("청록 머리 여성");
      expect(face.attributes.gender).toBe("여성");
      const fighter = listCharacterSprites(project).find((row) => row.textureKey === "tex_easyrpg_charset_actor3" && row.characterIndex === 5)!;
      expect(rankCharacterFaces(fighter, [face])[0]?.recommendation).toBe("conflict");
      expect(seedGraphicAttributes("흰 머리띠 여성").hair).toBeUndefined();
    });

  });
});
