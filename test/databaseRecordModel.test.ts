import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { normalizeDatabaseRecords, normalizeSystemRecords, normalizeSkillRecord, normalizeItemRecord } from "@/project/databaseRecordModel";
import { deserialize, serialize } from "@/project/io";
import type { ProjectDatabaseRecords, GameEvent, Project } from "@/project/types";
import { syncBattleModelAttribute } from "@/app/mode";
import { installFakeDom } from "./fakeDom";
import { normalizeSkillWeather, weatherDamagePercent, weatherResidualDamage, weatherResidualLine } from "@/battle/weather";
import { captureConditionLabel, captureConditionLine, captureConditionMultiplier, normalizeCaptureCondition } from "@/battle/captureBalls";
import { getCharacterProfile, resolveBirthday, resolveGiftPrefs, resolveGiftResponses } from "@/project/characterProfiles";
import { giveGiftToNpc, isGiftableEvent } from "@/project/friendship";
import { startSession } from "@/project/session";
import { isolateTimers } from "./mergedTeardown";

describe("animationSchema", () => {
  isolateTimers();
  describe("RPG2003 animation schema", () => {
    it("ships effect animations with sheet frames cells timings and display flags", () => {
      // Given: the blank project owns the canonical starter animation database.
      const project = createBlankProject();

      // When: an effect animation is read by editor/runtime surfaces.
      const hit = project.database.battleAnimations.find((animation) => animation.id === "anim_hit");

      // Then: it is not a shallow id/name/resource record.
      // The starter hit uses the generated tackle-impact sheet since the scarloxy battle sheets left the starter records (public baseline 0d4f13e7c8).
      expect(hit).toMatchObject({
        id: "anim_hit",
        resourceId: "generated-battle-anim-tackle-impact",
        sheet: { frameWidth: 384, frameHeight: 384, columns: 8 },
        scope: "singleTarget",
        position: "center",
        large: false,
      });
      expect(hit?.frames?.[0]?.cells[0]).toMatchObject({
        pattern: 0,
        x: 0,
        y: -8,
        zoom: 100,
        opacity: 255,
        visible: true,
      });
      expect(hit?.timings?.[0]).toMatchObject({
        frameIndex: 3,
        flash: { target: "target", color: { red: 220, green: 232, blue: 245, gray: 0 }, durationFrames: 4 },
      });
    });

    it("normalizes legacy shallow battle animations into runtime-safe effect records", () => {
      // Given: an existing save only has legacy battle animation fields.
      const legacyDatabase: ProjectDatabaseRecords = {
        actors: [],
        classes: [],
        skills: [],
        items: [],
        equipment: [],
        enemies: [],
        troops: [],
        states: [],
        battleAnimations: [{ id: "anim_legacy", name: "Legacy", resourceId: "scarloxy-battle-anim-scratch" }],
      };

      // When: the database passes through runtime normalization.
      const normalized = normalizeDatabaseRecords(legacyDatabase);

      // Then: the effect animation gains safe playback fields.
      expect(normalized.battleAnimations[0]).toMatchObject({
        id: "anim_legacy",
        name: "Legacy",
        resourceId: "scarloxy-battle-anim-scratch",
        sheet: { frameWidth: 96, frameHeight: 96, columns: 5 },
        frames: [{ cells: [{ pattern: 0, visible: true }] }],
        timings: [],
      });
    });

    it("round-trips default effect animation records through project IO", () => {
      // Given: the starter project includes expanded animation records.
      const project = createBlankProject();

      // When: the project is serialized and deserialized through the real IO layer.
      const restored = deserialize(serialize(project));

      // Then: the animation collection survives validation.
      expect(restored.database.battleAnimations[0]?.frames?.length).toBeGreaterThan(0);
    });
  });
});

// test/battleModelSelector.test.ts
// system.battleModel 선택자("rm2k3" | "gen1")의 스키마/마이그레이션/정규화/DOM 속성 검증.
// 기본(rm2k3)은 기존 RM2k3 전투 동작을 100% 유지하며, gen1 만 별도 보존한다.
describe("battleModelSelector", () => {
  isolateTimers();
  describe("system.battleModel — 기본값/마이그레이션", () => {
    it("새 프로젝트는 기본 rm2k3 이다(필드 생략)", () => {
      const project = createBlankProject();
      expect(project.system.battleModel).toBeUndefined();
      expect(project.system.battleModel ?? "rm2k3").toBe("rm2k3");
      // 기본 프로젝트 JSON 에는 battleModel 키가 없다(레거시와 동일한 바이트).
      expect(serialize(project)).not.toContain("battleModel");
    });

    it("레거시 프로젝트(battleModel 필드 없음)는 rm2k3 로 로드된다", () => {
      const project = createBlankProject();
      const raw = serialize(project);
      const restored = deserialize(raw);
      expect(restored.system.battleModel).toBeUndefined();
      expect(restored.system.battleModel ?? "rm2k3").toBe("rm2k3");
    });

    it("gen1 명시적으로 설정한 프로젝트에서 rm2k3 로 되돌리면 키가 생략된다", () => {
      const project = createBlankProject();
      project.system.battleModel = "gen1";
      const obj = JSON.parse(serialize(project));
      expect(obj.system.battleModel).toBe("gen1");
      // gen1 -> rm2k3 전환 후 직렬화하면 키가 사라진다(기본값 미저장 계약).
      obj.system.battleModel = "rm2k3";
      const restored = deserialize(JSON.stringify(obj));
      expect(restored.system.battleModel).toBeUndefined();
      expect(restored.system.battleModel ?? "rm2k3").toBe("rm2k3");
    });
  });
  describe("system.battleModel — 직렬화 왕복", () => {
    it("gen1 설정은 serialize/deserialize 왕복을 보존한다", () => {
      const project = createBlankProject();
      project.system.battleModel = "gen1";
      const wire = serialize(project);
      expect(wire).toContain('"battleModel":"gen1"');
      const restored = deserialize(wire);
      expect(restored.system.battleModel).toBe("gen1");
    });

    it("rm2k3(기본)은 왕복해도 JSON 에 키를 만들지 않는다", () => {
      const project = createBlankProject();
      project.system.battleModel = "rm2k3";
      const restored = deserialize(serialize(project));
      expect(restored.system.battleModel).toBeUndefined();
      expect(serialize(restored)).not.toContain("battleModel");
    });
  });
  describe("system.battleModel — 정규화", () => {
    it("gen1 은 normalizeSystemRecords 후 보존된다", () => {
      const base = createBlankProject();
      const out = normalizeSystemRecords({ ...base.system, battleModel: "gen1" });
      expect(out.battleModel).toBe("gen1");
    });

    it("rm2k3 은 normalizeSystemRecords 후 생략된다", () => {
      const base = createBlankProject();
      const out = normalizeSystemRecords({ ...base.system, battleModel: "rm2k3" });
      expect(out.battleModel).toBeUndefined();
    });

    it("무효값은 역직렬화 경로에서 rm2k3 로 정규화된다", () => {
      const project = createBlankProject();
      const obj = JSON.parse(serialize(project));
      obj.system.battleModel = "gen5"; // 무효값
      const restored = deserialize(JSON.stringify(obj));
      expect(restored.system.battleModel).toBeUndefined();
      expect(restored.system.battleModel ?? "rm2k3").toBe("rm2k3");
    });
  });
  describe("data-battle-model DOM 속성", () => {
    let restoreDom: () => void;

    beforeEach(() => {
      restoreDom = installFakeDom();
    });
    afterEach(() => {
      restoreDom();
    });

    it("기본 프로젝트는 data-battle-model=rm2k3", () => {
      syncBattleModelAttribute(createBlankProject());
      expect(document.body.getAttribute("data-battle-model")).toBe("rm2k3");
    });

    it("gen1 프로젝트는 data-battle-model=gen1", () => {
      const project = createBlankProject();
      project.system.battleModel = "gen1";
      syncBattleModelAttribute(project);
      expect(document.body.getAttribute("data-battle-model")).toBe("gen1");
    });

    it("전환 시 속성 값이 최신값으로 갱신된다", () => {
      const project = createBlankProject();
      syncBattleModelAttribute(project);
      expect(document.body.getAttribute("data-battle-model")).toBe("rm2k3");
      project.system.battleModel = "gen1";
      syncBattleModelAttribute(project);
      expect(document.body.getAttribute("data-battle-model")).toBe("gen1");
      project.system.battleModel = undefined;
      syncBattleModelAttribute(project);
      expect(document.body.getAttribute("data-battle-model")).toBe("rm2k3");
    });
  });
});

// poke-depth PR5: 날씨. 작성만 했고 실행하지 않았다(워크트리 규칙).
describe("battleWeather", () => {
  isolateTimers();
  describe("normalizeSkillWeather", () => {
    it("drops unknown kinds and non-objects", () => {
      expect(normalizeSkillWeather(undefined)).toBeUndefined();
      expect(normalizeSkillWeather("rain")).toBeUndefined();
      expect(normalizeSkillWeather({ kind: "fog" })).toBeUndefined();
    });
    it("clamps turns to 3..8 and omits the default 5", () => {
      expect(normalizeSkillWeather({ kind: "rain" })).toEqual({ kind: "rain" });
      expect(normalizeSkillWeather({ kind: "rain", turns: 5 })).toEqual({ kind: "rain" });
      expect(normalizeSkillWeather({ kind: "hail", turns: 1 })).toEqual({ kind: "hail", turns: 3 });
      expect(normalizeSkillWeather({ kind: "sun", turns: 99 })).toEqual({ kind: "sun", turns: 8 });
    });
    it("is omitted from skill records that do not set it (unchanged bytes)", () => {
      expect("weather" in normalizeSkillRecord({ id: "s", name: "s" })).toBe(false);
      expect(normalizeSkillRecord({ id: "s", name: "s", weather: { kind: "sandstorm", turns: 3 } }).weather).toEqual({ kind: "sandstorm", turns: 3 });
    });
  });
  describe("weather effects", () => {
    it("sun and rain swap fire and water", () => {
      expect(weatherDamagePercent("sun", "fire")).toBe(150);
      expect(weatherDamagePercent("sun", "water")).toBe(50);
      expect(weatherDamagePercent("rain", "water")).toBe(150);
      expect(weatherDamagePercent("rain", "fire")).toBe(50);
      expect(weatherDamagePercent("rain", "grass")).toBe(100);
      expect(weatherDamagePercent("sandstorm", "fire")).toBe(100);
      expect(weatherDamagePercent(undefined, "fire")).toBe(100);
      expect(weatherDamagePercent("sun", undefined)).toBe(100);
    });
    it("sandstorm and hail deal 1/16 (min 1) except to immune types", () => {
      expect(weatherResidualDamage("sandstorm", 160, ["normal"])).toBe(10);
      expect(weatherResidualDamage("sandstorm", 5, ["normal"])).toBe(1);
      expect(weatherResidualDamage("sandstorm", 160, ["rock", "water"])).toBe(0);
      expect(weatherResidualDamage("sandstorm", 160, ["ground"])).toBe(0);
      expect(weatherResidualDamage("hail", 160, ["ice"])).toBe(0);
      expect(weatherResidualDamage("hail", 160, ["rock"])).toBe(10);
      expect(weatherResidualDamage("rain", 160, ["normal"])).toBe(0);
      expect(weatherResidualDamage(undefined, 160, ["normal"])).toBe(0);
    });
    it("uses the right josa in the residual line", () => {
      expect(weatherResidualLine("sandstorm", "파이린")).toBe("파이린은 모래바람에 휩싸였다!");
      expect(weatherResidualLine("hail", "피오르")).toBe("피오르는 싸라기눈에 맞았다!");
    });
  });
});

// poke-depth PR6: 조건부 볼. 작성만 했고 실행하지 않았다(워크트리 규칙).
describe("captureBalls", () => {
  isolateTimers();
  const ctx = (over: Partial<{ turn: number; targetTypes: string[]; speciesCaught: boolean }> = {}) => ({ turn: 0, targetTypes: ["normal"], speciesCaught: false, ...over });
  describe("normalizeCaptureCondition", () => {
    it("drops unknown kinds and type conditions without types", () => {
      expect(normalizeCaptureCondition(undefined)).toBeUndefined();
      expect(normalizeCaptureCondition({ kind: "bogus", multiplier: 3 })).toBeUndefined();
      expect(normalizeCaptureCondition({ kind: "type", multiplier: 3 })).toBeUndefined();
      expect(normalizeCaptureCondition({ kind: "type", types: [], multiplier: 3 })).toBeUndefined();
    });
    it("clamps multipliers to 1.1..8 and fills per-kind defaults", () => {
      expect(normalizeCaptureCondition({ kind: "firstTurn" })).toEqual({ kind: "firstTurn", multiplier: 5 });
      expect(normalizeCaptureCondition({ kind: "repeat", multiplier: 99 })).toEqual({ kind: "repeat", multiplier: 8 });
      expect(normalizeCaptureCondition({ kind: "repeat", multiplier: 0.2 })).toEqual({ kind: "repeat", multiplier: 1.1 });
      expect(normalizeCaptureCondition({ kind: "type", types: ["water", "water", "bug"] })).toEqual({ kind: "type", types: ["water", "bug"], multiplier: 3.5 });
      expect(normalizeCaptureCondition({ kind: "turns", step: 99 })).toEqual({ kind: "turns", multiplier: 4, step: 2 });
    });
    it("is omitted from capture profiles that do not set it (unchanged bytes)", () => {
      expect("condition" in (normalizeItemRecord({ id: "b", name: "b", captureProfile: { multiplier: 1, ballClass: "poke" } }).captureProfile ?? {})).toBe(false);
      expect(normalizeItemRecord({ id: "b", name: "b", captureProfile: { multiplier: 1, condition: { kind: "firstTurn", multiplier: 5 } } }).captureProfile?.condition).toEqual({ kind: "firstTurn", multiplier: 5 });
    });
  });
  describe("captureConditionMultiplier", () => {
    it("type matches any listed type", () => {
      const net = normalizeCaptureCondition({ kind: "type", types: ["water", "bug"], multiplier: 3.5 });
      expect(captureConditionMultiplier(net, ctx({ targetTypes: ["normal", "bug"] }))).toBe(3.5);
      expect(captureConditionMultiplier(net, ctx({ targetTypes: ["fire"] }))).toBe(1);
    });
    it("firstTurn applies only before any round has finished", () => {
      const quick = normalizeCaptureCondition({ kind: "firstTurn", multiplier: 5 });
      expect(captureConditionMultiplier(quick, ctx({ turn: 0 }))).toBe(5);
      expect(captureConditionMultiplier(quick, ctx({ turn: 1 }))).toBe(1);
    });
    it("turns grows by step per round and caps at the multiplier", () => {
      const timer = normalizeCaptureCondition({ kind: "turns", multiplier: 4, step: 0.5 });
      expect(captureConditionMultiplier(timer, ctx({ turn: 0 }))).toBe(1);
      expect(captureConditionMultiplier(timer, ctx({ turn: 2 }))).toBe(2);
      expect(captureConditionMultiplier(timer, ctx({ turn: 50 }))).toBe(4);
    });
    it("repeat needs the species in the dex; no condition means 1", () => {
      const repeat = normalizeCaptureCondition({ kind: "repeat", multiplier: 3.5 });
      expect(captureConditionMultiplier(repeat, ctx({ speciesCaught: true }))).toBe(3.5);
      expect(captureConditionMultiplier(repeat, ctx({ speciesCaught: false }))).toBe(1);
      expect(captureConditionMultiplier(undefined, ctx())).toBe(1);
    });
  });
  describe("captureCondition text", () => {
    it("labels each kind and uses the right josa", () => {
      expect(captureConditionLabel({ kind: "firstTurn", multiplier: 5 })).toBe("첫 차례 ×5");
      expect(captureConditionLabel({ kind: "type", types: ["water", "bug"], multiplier: 3.5 }, (id) => ({ water: "물", bug: "벌레" } as Record<string, string>)[id] ?? id)).toBe("물·벌레 타입 ×3.5");
      expect(captureConditionLine({ kind: "firstTurn", multiplier: 5 }, "신속 구슬")).toBe("신속 구슬이 첫 차례라서 힘을 발휘한다!");
      expect(captureConditionLine({ kind: "repeat", multiplier: 3.5 }, "재회 볼")).toBe("재회 볼이 낯익은 종에게 잘 듣는 것 같다!");
    });
  });
});

describe("characterProfiles", () => {
  isolateTimers();
  describe("character profile helpers", () => {
    it("event giftPrefs/responses fully override profile defaults", () => {
      const project = profileProject();
      const event: GameEvent = {
        id: "ev_farmer",
        x: 1,
        y: 1,
        trigger: { kind: "action" },
        commands: [],
        characterId: "char_farmer",
        giftPrefs: { loved: ["item_event_loved"] },
        giftResponses: { loved: "이벤트 응답" },
      };

      expect(resolveGiftPrefs(project, event)).toEqual({ loved: ["item_event_loved"] });
      expect(resolveGiftResponses(project, event)).toEqual({ loved: "이벤트 응답" });
      expect(getCharacterProfile(project, "char_farmer")?.giftPrefs).toEqual({ loved: ["item_strawberry"] });
    });

    it("falls back to profile giftPrefs/responses when event fields are absent", () => {
      const project = profileProject();
      const event: GameEvent = {
        id: "ev_farmer",
        x: 1,
        y: 1,
        trigger: { kind: "action" },
        commands: [],
        characterId: "char_farmer",
      };

      expect(resolveGiftPrefs(project, event)).toEqual({ loved: ["item_strawberry"] });
      expect(resolveGiftResponses(project, event)).toEqual({ loved: "프로필 고마워!" });
      expect(isGiftableEvent(project, event)).toBe(true);
    });

    it("uses profile birthday when event has no socialCalendar", () => {
      const project = profileProject();
      const event: GameEvent = {
        id: "ev_farmer",
        x: 1,
        y: 1,
        trigger: { kind: "action" },
        commands: [],
        characterId: "char_farmer",
        giftPrefs: { loved: ["item_strawberry"] },
      };

      expect(resolveBirthday(project, event)).toEqual({ season: "summer", day: 14 });

      const session = startSession(project);
      session.gameTime = { minute: 0, hour: 9, day: 14, season: "summer", year: 1 };
      expect(giveGiftToNpc(project, session, event, "item_strawberry")).toMatchObject({
        ok: true,
        rank: "loved",
        delta: 160,
        friendship: 160,
      });
    });

    it("event socialCalendar.birthday overrides profile birthday", () => {
      const project = profileProject();
      const event: GameEvent = {
        id: "ev_farmer",
        x: 1,
        y: 1,
        trigger: { kind: "action" },
        commands: [],
        characterId: "char_farmer",
        giftPrefs: { loved: ["item_strawberry"] },
        socialCalendar: { birthday: { season: "winter", day: 3 } },
      };

      expect(resolveBirthday(project, event)).toEqual({ season: "winter", day: 3 });

      const profileDay = startSession(project);
      profileDay.gameTime = { minute: 0, hour: 9, day: 14, season: "summer", year: 1 };
      expect(giveGiftToNpc(project, profileDay, event, "item_strawberry")).toMatchObject({
        ok: true,
        delta: 80,
      });

      const eventDay = startSession(project);
      eventDay.gameTime = { minute: 0, hour: 9, day: 3, season: "winter", year: 1 };
      expect(giveGiftToNpc(project, eventDay, event, "item_strawberry")).toMatchObject({
        ok: true,
        delta: 160,
      });
    });

    it("load/save serializes project.characters", () => {
      const project = profileProject();
      const restored = deserialize(serialize(project));
      expect(restored.characters).toEqual(project.characters);
      expect(restored.characters?.char_farmer?.displayName).toBe("농부 민수");
      expect(restored.characters?.char_farmer?.birthday).toEqual({ season: "summer", day: 14 });
    });
  });
  function profileProject(): Project {
    const project = createBlankProject();
    project.system.giftSystem = true;
    project.system.timeSystem = { enabled: true, dayStartHour: 6 };
    project.database.items.push(
      normalizeItemRecord({ id: "item_strawberry", name: "딸기", scope: "none", price: 10 }),
      normalizeItemRecord({ id: "item_event_loved", name: "이벤트 선물", scope: "none", price: 10 })
    );
    project.session.inventory = {
      ...project.session.inventory,
      item_strawberry: 2,
      item_event_loved: 1,
    };
    project.characters = {
      char_farmer: {
        displayName: "농부 민수",
        birthday: { season: "summer", day: 14 },
        giftPrefs: { loved: ["item_strawberry"] },
        giftResponses: { loved: "프로필 고마워!" },
      },
    };
    return project;
  }
});
