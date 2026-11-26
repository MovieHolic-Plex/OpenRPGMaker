import { describe, expect, it } from "vitest";
import { deserialize, serialize } from "@/project/io";
import { markRoundtripPassed, serializeForRoundtripCheck } from "@/project/io/sharedDictionaryJson";
import { cloneDetachedDraft } from "@/editor/detachedDraftMemory";
import { assertSpatialToolAcceptance, beginSpatialToolProposal, sealSpatialToolProposal } from "@/editor/tools/spatialToolState";
import { spatialFixture, spatialWire } from "./support/spatialSchemaFixture";
import { createBattleRuntime } from "@/battle/runtime";
import { createBlankProject } from "@/project/defaults";
import { validateMonsterCampaign } from "@/project/io/shapeMonsterCampaign";
import { captureFailLine } from "@/player/battleDirectorDom";
import { approachScaleFor } from "@/player/battleActionBeats";
import type { Project, GameEvent } from "@/project/types";
import { characterIdExists, findCharacterIdEntry, listCharacterIdIndex } from "@/project/characterIdIndex";
import { runTool } from "@/editor/tools";
import { stampCharacterIdsForSocialEvents, eventHasSocialSurface } from "@/project/characterIdStamp";
import { giveGiftToNpc, isGiftableEvent } from "@/project/friendship";
import { resolveEventPage } from "@/project/io/pageResolution";
import { changeFriendship, evalCondition, getFriendship, startSession } from "@/project/session";
import { resolveSocialKey } from "@/project/socialKey";
import { normalizeItemRecord } from "@/project/databaseRecordModel";
import { isolateTimers } from "./mergedTeardown";

describe("assistantUx2SpatialRoundtrip", () => {
  isolateTimers();
  function accepted() {
    const { project, document, tilesetId } = spatialFixture();
    const value = deserialize(spatialWire(project, document));
    markRoundtripPassed(value);
    return { value, tilesetId };
  }
  describe("spatial checkpoint roundtrip reuse", () => {
    it("retains all cross-entry tileset fields after warming, including authored kit geometry and rules", () => {
      const { value, tilesetId } = accepted();
      const wire = serializeForRoundtripCheck(value);
      const projected = JSON.parse(wire).tilesets[tilesetId];
      const { referenceDocuments: _docs, structureKits, tileMeta, passability, priority, terrain, ...expected } = value.tilesets[tilesetId]!;
      expect(projected).toMatchObject(expected);
      // Per-tile arrays of a passed tileset project as same-length null arrays (PER_TILE_ARRAY_FIELDS, #2631);
      // the roundtrip only checks their length against count.
      for (const [field, original] of Object.entries({ tileMeta, passability, priority, terrain })) {
        expect(projected[field]?.length, field).toBe((original as unknown[] | undefined)?.length);
      }
      expect(projected.structureKits).toEqual(structureKits?.map(({ referenceDocuments: _kitDocs, ...kit }) => kit));
      expect(deserialize(wire).spatialAuthoring).toEqual(value.spatialAuthoring);
    });

    it("does not reuse a passed kit when its replacement removes a referenced kit", () => {
      const { value, tilesetId } = accepted();
      const candidate = { ...value, tilesets: { ...value.tilesets,
        [tilesetId]: { ...value.tilesets[tilesetId]!, structureKits: [] } } };
      expect(() => deserialize(serializeForRoundtripCheck(candidate))).toThrow(/kitId/);
    });

    it("rechecks changed spatial references even when every tileset has already passed", () => {
      const { value } = accepted();
      value.spatialAuthoring!.library.objects.desk!.graphic.kitId = "missing-kit";
      expect(() => deserialize(serializeForRoundtripCheck(value))).toThrow(/kitId/);
    });

    it.each(["geometry", "interiorMetadata", "tileGrafts"])("still refuses post-issue %s tampering after warming the projection", field => {
      const { value, tilesetId } = accepted();
      serializeForRoundtripCheck(value);
      const proposal = cloneDetachedDraft(value);
      beginSpatialToolProposal(proposal, value);
      sealSpatialToolProposal(proposal);
      expect(() => assertSpatialToolAcceptance(proposal, value)).not.toThrow();
      const source = proposal.tilesets[tilesetId]!;
      proposal.tilesets[tilesetId] = field === "geometry"
        ? { ...source, structureKits: source.structureKits!.map(kit => ({ ...kit, width: 0 })) }
        : field === "tileGrafts"
          ? { ...source, tileGrafts: [{ targetTile: source.count, sourceTile: 0, sourceChipset: "source" }] }
          : { ...source, interiorMetadata: { broken: true } } as typeof source;
      // Lint's smaller JSON is never the authority fingerprint or proposal proof.
      expect(() => assertSpatialToolAcceptance(proposal, value)).toThrow();
    });

    it("validates replacement grafts and reference documents instead of caching the old entry's pass", () => {
      const { value, tilesetId } = accepted();
      const source = value.tilesets[tilesetId]!;
      const graftCandidate = { ...value, tilesets: { ...value.tilesets, [tilesetId]: { ...source,
        tileGrafts: [{ targetTile: source.count, sourceTile: 0, sourceChipset: "source" }] } } };
      expect(() => deserialize(serializeForRoundtripCheck(graftCandidate))).toThrow(/targetTile/);
      const docsCandidate = { ...value, tilesets: { ...value.tilesets, [tilesetId]: { ...source,
        referenceDocuments: [{ id: "broken" }] as unknown as typeof source.referenceDocuments } } };
      expect(() => deserialize(serializeForRoundtripCheck(docsCandidate))).toThrow();
      const kitDocs = { ...value, tilesets: { ...value.tilesets, [tilesetId]: { ...source,
        structureKits: source.structureKits!.map(kit => ({ ...kit,
          referenceDocuments: [{ id: "broken" }] as unknown as typeof kit.referenceDocuments })) } } };
      expect(() => deserialize(serializeForRoundtripCheck(kitDocs))).toThrow();
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

describe("characterId", () => {
  isolateTimers();
  describe("characterIdIndex", () => {
    isolateTimers();
    function event(partial: Partial<GameEvent> & Pick<GameEvent, "id">): GameEvent {
      return {
        id: partial.id,
        x: partial.x ?? 1,
        y: partial.y ?? 1,
        trigger: partial.trigger ?? { kind: "action" },
        commands: partial.commands ?? [],
        pages: partial.pages ?? [{ id: "p1", conditions: [], commands: [] }],
        ...partial,
      };
    }
    function projectWith(
      events: readonly GameEvent[],
      characters?: Project["characters"]
    ): Project {
      const project = createBlankProject();
      const mapId = project.startMapId;
      project.maps[mapId] = {
        ...project.maps[mapId],
        events: [...events],
      };
      if (characters) project.characters = characters;
      return project;
    }
    describe("characterIdIndex", () => {
      it("unions project.characters keys and event characterIds", () => {
        const project = projectWith(
          [event({ id: "ev_a", characterId: "char_used" })],
          {
            char_used: { displayName: "Used" },
            char_only_profile: { displayName: "Profile Only" },
          }
        );
        project.maps["map_extra"] = {
          ...project.maps[project.startMapId],
          id: "map_extra",
          name: "Extra",
          events: [event({ id: "ev_b", characterId: "char_orphan" })],
        };

        const index = listCharacterIdIndex(project);
        const byId = Object.fromEntries(index.map((entry) => [entry.characterId, entry]));

        expect(Object.keys(byId).sort()).toEqual(["char_only_profile", "char_orphan", "char_used"]);
        expect(byId.char_used).toMatchObject({
          hasProfile: true,
          usageCount: 1,
          mapCount: 1,
          isOrphan: false,
          isUnusedProfile: false,
        });
        expect(byId.char_only_profile).toMatchObject({
          hasProfile: true,
          usageCount: 0,
          isOrphan: false,
          isUnusedProfile: true,
        });
        expect(byId.char_orphan).toMatchObject({
          hasProfile: false,
          usageCount: 1,
          isOrphan: true,
          isUnusedProfile: false,
        });
        expect(byId.char_used.hosts[0]).toMatchObject({
          mapId: project.startMapId,
          eventId: "ev_a",
        });
      });

      it("ignores blank characterIds and counts multi-map usage", () => {
        const project = projectWith([
          event({ id: "ev_blank", characterId: "   " }),
          event({ id: "ev_one", characterId: "shared" }),
        ]);
        project.maps["map_two"] = {
          ...project.maps[project.startMapId],
          id: "map_two",
          name: "Two",
          events: [event({ id: "ev_two", characterId: " shared " })],
        };

        const entry = findCharacterIdEntry(project, "shared");
        expect(entry?.usageCount).toBe(2);
        expect(entry?.mapCount).toBe(2);
        expect(characterIdExists(project, "shared")).toBe(true);
        expect(characterIdExists(project, "missing")).toBe(false);
        expect(listCharacterIdIndex(project).some((item) => item.characterId === "")).toBe(false);
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
});
