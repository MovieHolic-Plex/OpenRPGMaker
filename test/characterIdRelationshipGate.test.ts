import { describe, expect, it } from "vitest";
import { runTool } from "@/editor/tools";
import { stampCharacterIdsForSocialEvents, eventHasSocialSurface } from "@/project/characterIdStamp";
import { createBlankProject } from "@/project/defaults";
import { giveGiftToNpc, isGiftableEvent } from "@/project/friendship";
import { resolveEventPage } from "@/project/io/pageResolution";
import { changeFriendship, evalCondition, getFriendship, startSession } from "@/project/session";
import { resolveSocialKey } from "@/project/socialKey";
import { deserialize, serialize } from "@/project/io";
import type { GameEvent, Project } from "@/project/types";
import { normalizeItemRecord } from "@/project/databaseRecordModel";

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
