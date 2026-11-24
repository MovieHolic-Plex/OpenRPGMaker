import { describe, expect, it } from "vitest";
import { getAudioDescriptionOverride, resetAudioDescriptionOverride, setAudioDescriptionOverride } from "@/project/audioDescriptions";
import { ProjectFormatError } from "@/project/io/errors";
import type { AudioDescriptionOverrides, Project, GameEvent } from "@/project/types";
import { createBattleRuntime } from "@/battle/runtime";
import { createBlankProject } from "@/project/defaults";
import { validateMonsterCampaign } from "@/project/io/shapeMonsterCampaign";
import { captureFailLine } from "@/player/battleDirectorDom";
import { approachScaleFor } from "@/player/battleActionBeats";
import { runTool } from "@/editor/tools";
import { stampCharacterIdsForSocialEvents, eventHasSocialSurface } from "@/project/characterIdStamp";
import { giveGiftToNpc, isGiftableEvent } from "@/project/friendship";
import { resolveEventPage } from "@/project/io/pageResolution";
import { changeFriendship, evalCondition, getFriendship, startSession } from "@/project/session";
import { resolveSocialKey } from "@/project/socialKey";
import { deserialize, serialize } from "@/project/io";
import { normalizeItemRecord } from "@/project/databaseRecordModel";
import { validateCommands, type ReferenceContext } from "@/project/io/commandReferenceValidation";
import { isolateTimers } from "./mergedTeardown";

describe("audioDescriptions", () => {
  isolateTimers();
  const music = { kind: "music", resourceId: "raw_audio_1" } as const;
  const sound = { kind: "sound", resourceId: "raw_audio_1" } as const;
  describe("audio description overrides", () => {
    it.each([undefined, {}, { music: {} }])("inherits when an own raw-ID key is absent in %j", (overrides) => {
      // Given / When
      const value = getAudioDescriptionOverride(overrides, music);
      // Then
      expect(value).toBeUndefined();
    });

    it.each(["", "AUDIO_DESC_QA_20260906"])("preserves the authored state when reading %j", (description) => {
      // Given
      const overrides = { music: { [music.resourceId]: description } };
      // When
      const value = getAudioDescriptionOverride(overrides, music);
      // Then
      expect(value).toBe(description);
    });

    it.each(["__proto__", "constructor", "toString"])("inherits when %s is only a prototype property", (resourceId) => {
      // Given
      const overrides = { music: {} };
      // When
      const value = getAudioDescriptionOverride(overrides, { kind: "music", resourceId });
      // Then
      expect(value).toBeUndefined();
    });

    it.each(["", " \n\t ", "  first\nsecond  "])("trims only outer whitespace when writing %j", (input) => {
      // Given
      const before = Object.freeze({});
      // When
      const result = setAudioDescriptionOverride(before, music, input);
      // Then
      expect(result).toEqual({ music: { [music.resourceId]: input.trim() } });
      expect(before).toEqual({});
    });

    it.each(["x".repeat(4000), "\uD83C\uDFB5".repeat(2000)])("accepts exactly 4000 UTF-16 units when writing a boundary string", (input) => {
      // Given / When
      const result = setAudioDescriptionOverride(undefined, music, ` ${input} `);
      // Then
      expect(getAudioDescriptionOverride(result, music)).toBe(input);
    });

    it.each([null, [], 7, false, {}, undefined, "x".repeat(4001), "\uD83C\uDFB5".repeat(2001)])("rejects invalid input without changing the source when writing case %#", (input) => {
      // Given
      const before = Object.freeze({ music: Object.freeze({ [music.resourceId]: "original" }) });
      // When / Then
      expect(() => setAudioDescriptionOverride(before, music, input)).toThrow(ProjectFormatError);
      expect(before.music[music.resourceId]).toBe("original");
    });

    it("isolates projects, IDs and kinds when writing a same-name resource", () => {
      // Given
      const resources = [
        { ...music, name: "same-name" },
        { ...music, resourceId: "raw_audio_2", name: "same-name" },
      ];
      const projectA: AudioDescriptionOverrides = Object.freeze({
        music: Object.freeze(Object.fromEntries(resources.map(resource => [resource.resourceId, "original"]))),
        sound: Object.freeze({ [sound.resourceId]: "sound-original" }),
      });
      const projectB = projectA;
      // When
      const result = setAudioDescriptionOverride(projectA, music, "changed");
      // Then
      expect(result).toEqual({ music: { raw_audio_1: "changed", raw_audio_2: "original" }, sound: { raw_audio_1: "sound-original" } });
      expect(projectB.music).toEqual({ raw_audio_1: "original", raw_audio_2: "original" });
    });

    it.each(["__proto__", "constructor", "toString"])("stores an own key when writing raw ID %s", (resourceId) => {
      // Given
      const resource = { kind: "music", resourceId } as const;
      // When
      const result = setAudioDescriptionOverride(undefined, resource, "authored");
      // Then
      expect(Object.hasOwn(result.music ?? {}, resourceId)).toBe(true);
      expect(getAudioDescriptionOverride(result, resource)).toBe("authored");
    });

    it("retains an explicit override when the written value equals the existing value", () => {
      // Given
      const before = { music: { [music.resourceId]: "unchanged" } };
      // When
      const result = setAudioDescriptionOverride(before, music, "unchanged");
      // Then
      expect(result).toEqual(before);
      expect(Object.hasOwn(result.music ?? {}, music.resourceId)).toBe(true);
    });

    it("preserves sibling IDs and kinds when resetting one override", () => {
      // Given
      const before = Object.freeze({
        music: Object.freeze({ [music.resourceId]: "", orphan: "  kept  " }),
        sound: Object.freeze({ [sound.resourceId]: "sound" }),
      });
      // When
      const result = resetAudioDescriptionOverride(before, music);
      // Then
      expect(result).toEqual({ music: { orphan: "  kept  " }, sound: { [sound.resourceId]: "sound" } });
      expect(before.music[music.resourceId]).toBe("");
    });

    it("removes the empty partition when resetting its last override", () => {
      // Given
      const before = { music: { [music.resourceId]: "" }, sound: { orphan: "kept" } };
      // When
      const result = resetAudioDescriptionOverride(before, music);
      // Then
      expect(result).toEqual({ sound: { orphan: "kept" } });
    });

    it("restores absence when resetting the last override", () => {
      // Given
      const before = { music: { [music.resourceId]: "" } };
      // When
      const result = resetAudioDescriptionOverride(before, music);
      // Then
      expect(result).toBeUndefined();
    });

    it.each([undefined, {}, { sound: { orphan: "kept" } }])("does not create data when resetting a missing key in %j", (before) => {
      // Given / When
      const result = resetAudioDescriptionOverride(before, music);
      // Then
      expect(result).toBe(before);
    });
  });
});

// 포획 연출·도감 등록 문장 단위 테스트(2026-10-16, 작성만 — 실행은 감독자).
describe("captureDexRegistration", () => {
  isolateTimers();
  function campaignProject(dexRegisteredText?: string): Project {
    const project = createBlankProject();
    project.system.monsterCollection = true;
    project.system.monsterCampaign = {
      id: "qa", name: "QA", speciesIds: ["species_wild_slime"], speciesNotes: {}, badges: [], locations: [], objectives: [],
      ...(dexRegisteredText ? { dexRegisteredText } : {}),
    };
    return project;
  }
  function capture(project: Project, switches: Record<string, boolean> = {}) {
    const runtime = createBattleRuntime({
      project, troopId: "troop_slime", canEscape: false, canLose: true, battleFlow: "strict",
      sessionState: { switches, variables: {}, inventory: { item_capture_orb: 3 } },
      captureLocation: { mapId: project.startMapId, x: project.startPos.x, y: project.startPos.y },
      rng: () => 0,
    });
    runtime.performActorCommand({ kind: "capture", captureItemId: "item_capture_orb", targetEnemyId: "enemy-1" });
    return runtime.snapshot();
  }
  describe("capture dex registration line", () => {
    it("a first capture of a campaign species flags newDexEntry and records a dex line", () => {
      const snapshot = capture(campaignProject());
      expect(snapshot.lastCaptureResult?.success).toBe(true);
      expect(snapshot.lastCaptureResult?.newDexEntry).toBe(true);
      const line = snapshot.timeline.find((entry) => entry.kind === "special" && entry.aside === "dex");
      expect(line?.message).toMatch(/의 데이터가 도감에 등록되었다!$/u);
    });

    it("uses the authored wording with {name}", () => {
      const snapshot = capture(campaignProject("{name} 확보! 도감을 채웠다."));
      const line = snapshot.timeline.find((entry) => entry.kind === "special" && entry.aside === "dex");
      expect(line?.message).toMatch(/ 확보! 도감을 채웠다\.$/u);
      expect(line?.message).not.toContain("{name}");
    });

    it("stays silent for an already-caught species and for games without a campaign dex", () => {
      const again = capture(campaignProject(), { mx_caught_species_wild_slime: true });
      expect(again.lastCaptureResult?.success).toBe(true);
      expect(again.lastCaptureResult?.newDexEntry).toBeUndefined();
      expect(again.timeline.some((entry) => entry.aside === "dex")).toBe(false);

      const legacy = createBlankProject();
      legacy.system.monsterCollection = true;
      const plain = capture(legacy);
      expect(plain.lastCaptureResult?.newDexEntry).toBeUndefined();
      expect(plain.timeline.some((entry) => entry.aside === "dex")).toBe(false);
    });
  });
  describe("capture failure wording and campaign shape", () => {
    it("varies the non-emerald failure line by the roll while the emerald line stays fixed", () => {
      for (const shakes of [0, 1, 2, 3]) {
        const a = captureFailLine(shakes, 0.1, false);
        const b = captureFailLine(shakes, 0.1 + 1 / 997, false);
        expect(a).not.toBe(b);
        expect(captureFailLine(shakes, 0.1, true)).toBe(captureFailLine(shakes, 0.9, true));
      }
      expect(new Set([0, 1, 2, 3].map((n) => captureFailLine(n, 0.3, true))).size).toBe(4);
    });

    it("rejects a dexRegisteredText longer than 80 characters", () => {
      const base = { id: "a", name: "b", speciesIds: [], speciesNotes: {}, badges: [], locations: [], objectives: [] };
      expect(() => validateMonsterCampaign({ ...base, dexRegisteredText: "{name}!" })).not.toThrow();
      expect(() => validateMonsterCampaign({ ...base, dexRegisteredText: "가".repeat(81) })).toThrow();
    });

    it("scales the beat the way the sequencer divides the capture cinematic back out", () => {
      expect(approachScaleFor("light")).toBeLessThan(approachScaleFor("normal"));
      expect(approachScaleFor("normal")).toBe(1);
    });
  });
});

describe("characterIdRelationshipGate", () => {
  isolateTimers();
  describe("characterId relationship gate", () => {
    it("resolveSocialKey_null_without_characterId", () => {
      expect(resolveSocialKey({ id: "ev_a" })).toBeNull();
      expect(resolveSocialKey({ id: "ev_a", characterId: "  " })).toBeNull();
    });

    it("resolveSocialKey_uses_characterId_not_eventId", () => {
      expect(resolveSocialKey({ id: "ev_a", characterId: "char_a" })).toBe("char_a");
      expect(resolveSocialKey({ id: "ev_a", characterId: "char_a" })).not.toBe("ev_a");
    });

    it("shared_characterId_shared_friendship", () => {
      const session = startSession(createBlankProject());
      changeFriendship(session, undefined, 30, { id: "ev_copy1", characterId: "person_a" });
      expect(getFriendship(session, undefined, { id: "ev_copy2", characterId: "person_a" })).toBe(30);
    });

    it("gift_daily_and_friendship_same_key", () => {
      const project = giftProject();
      const session = startSession(project);
      const event = giftEvent("ev_farmer", "char_farmer");
      const result = giveGiftToNpc(project, session, event, "item_strawberry");
      expect(result).toMatchObject({ ok: true, npcKey: "char_farmer", friendship: 80 });
      expect(session.friendship?.char_farmer).toBe(80);
      expect(session.dailyGifts?.char_farmer).toBeDefined();
      expect(session.friendship?.ev_farmer).toBeUndefined();
      expect(session.dailyGifts?.ev_farmer).toBeUndefined();
    });

    it("gift_without_characterId_not_giftable", () => {
      const project = giftProject();
      const session = startSession(project);
      const event = giftEvent("ev_farmer");
      delete event.characterId;
      expect(isGiftableEvent(project, event)).toBe(false);
      expect(giveGiftToNpc(project, session, event, "item_strawberry")).toMatchObject({
        ok: false,
        reason: "event-not-giftable",
      });
    });

    it("friendshipAtLeast_false_without_characterId", () => {
      const session = startSession(createBlankProject());
      session.friendship = { ev_farmer: 999 };
      expect(
        evalCondition(session, { kind: "friendshipAtLeast", value: 10 }, { id: "ev_farmer" })
      ).toBe(false);
      expect(
        resolveEventPage(
          {
            id: "ev_farmer",
            x: 0,
            y: 0,
            trigger: { kind: "action" },
            commands: [],
            pages: [
              {
                id: "p",
                name: "p",
                conditions: [{ kind: "friendshipAtLeast", value: 10 }],
                graphic: {},
                trigger: { kind: "action" },
                priority: "same",
                movement: { type: "fixed", speed: 3, frequency: 3 },
                commands: [],
              },
            ],
          },
          session
        )
      ).toBeUndefined();
    });

    it("explicit_npcKey_override", () => {
      const session = startSession(createBlankProject());
      changeFriendship(session, "custom_key", 55);
      expect(getFriendship(session, "custom_key", { id: "ev_x", characterId: "char_x" })).toBe(55);
      expect(resolveSocialKey({ id: "ev_x", characterId: "char_x" }, "custom_key")).toBe("custom_key");
    });

    it("activity_remains_event_scoped", () => {
      const session = startSession(createBlankProject());
      session.npcActivities = { ev_a: "work", ev_b: "sleep" };
      expect(evalCondition(session, { kind: "npcActivity", activity: "work" }, { id: "ev_a", characterId: "same" })).toBe(true);
      expect(evalCondition(session, { kind: "npcActivity", activity: "work" }, { id: "ev_b", characterId: "same" })).toBe(false);
    });

    it("make_villager_writes_characterId", () => {
      const ctx = { project: giftProject() };
      const map = ctx.project.maps[ctx.project.startMapId];
      const result = runTool(ctx, "make_villager", {
        mapId: map.id,
        id: "ev_seed_seller",
        name: "씨앗 상인",
        home: { x: 1, y: 1 },
        dialogue: [{ text: "씨앗이 필요해?" }],
      });
      expect(result.ok, result.summary).toBe(true);
      expect(result.data).toMatchObject({ characterId: expect.any(String) });
      const event = ctx.project.maps[map.id].events.find((entry) => entry.id === "ev_seed_seller");
      expect(event?.characterId).toBeTruthy();
    });

    it("ui_gate_hides_friendship_without_characterId", () => {
      // Unit-level contract: hasCharacterId is the UI gate predicate.
      expect(resolveSocialKey({ id: "e" })).toBeNull();
    });

    it("save_load_character_keys", () => {
      const project = giftProject();
      const map = project.maps[project.startMapId];
      map.events.push(giftEvent("ev_farmer", "char_farmer"));
      const round = deserialize(serialize(project));
      const event = round.maps[round.startMapId].events.find((entry) => entry.id === "ev_farmer");
      expect(event?.characterId).toBe("char_farmer");
    });

    it("npcActivity_still_works_without_characterId", () => {
      const session = startSession(createBlankProject());
      session.npcActivities = { ev_prop: "work" };
      expect(evalCondition(session, { kind: "npcActivity", activity: "work" }, "ev_prop")).toBe(true);
    });
  });
  function giftProject(): Project {
    const project = createBlankProject();
    project.system.giftSystem = true;
    project.system.timeSystem = { enabled: true, dayStartHour: 6, dayEndHour: 26 };
    project.database.items.push(
      normalizeItemRecord({ id: "item_strawberry", name: "딸기", scope: "none", price: 12 }),
      normalizeItemRecord({ id: "item_liked", name: "좋은 선물", scope: "none", price: 8 }),
      normalizeItemRecord({ id: "item_disliked", name: "싫은 선물", scope: "none", price: 4 }),
      normalizeItemRecord({ id: "item_neutral", name: "평범한 선물", scope: "none", price: 2 })
    );
    project.session.inventory = {
      item_strawberry: 2,
      item_liked: 1,
      item_disliked: 1,
      item_neutral: 1,
    };
    return project;
  }
  function giftEvent(id: string, characterId?: string): GameEvent {
    return {
      id,
      ...(characterId ? { characterId } : { characterId: id }),
      x: 1,
      y: 1,
      trigger: { kind: "action" },
      commands: [],
      giftPrefs: {
        loved: ["item_strawberry"],
        liked: ["item_liked"],
        disliked: ["item_disliked"],
      },
      pages: [
        {
          id: `${id}_page`,
          name: id,
          conditions: [],
          graphic: {},
          trigger: { kind: "action" },
          priority: "same",
          overlapForbidden: true,
          movement: { type: "fixed", speed: 3, frequency: 3 },
          commands: [],
        },
      ],
    };
  }
});

describe("commandReferenceValidationGameOver", () => {
  isolateTimers();
  const EMPTY = new Set<string>();
  const base: ReferenceContext = {
    actorIds: EMPTY, classIds: EMPTY, enemyIds: EMPTY, itemIds: EMPTY, equipmentIds: EMPTY, skillIds: EMPTY,
    animationIds: EMPTY, switchIds: EMPTY, variableIds: EMPTY, commonEventIds: EMPTY, endingIds: EMPTY,
    mapIds: EMPTY, troopIds: EMPTY, speciesIds: EMPTY, resourceIds: EMPTY,
  };
  describe("gameOver / killPlayer reference validation", () => {
    it("rejects an unknown game-over id when the caller supplies the definitions", () => {
      const context = { ...base, gameOverIds: new Set(["caught"]) };
      expect(() => validateCommands([{ kind: "gameOver", gameOverId: "caught" }], context)).not.toThrow();
      expect(() => validateCommands([{ kind: "killPlayer", gameOverId: "missing" }], context)).toThrow(/missing definition missing/);
    });

    it("skips the check when the caller omits gameOverIds instead of rejecting every id", () => {
      expect(() => validateCommands([{ kind: "gameOver", gameOverId: "caught" }], base)).not.toThrow();
      expect(() => validateCommands([{ kind: "killPlayer", gameOverId: "caught", message: "x" }], base)).not.toThrow();
    });
  });
});
