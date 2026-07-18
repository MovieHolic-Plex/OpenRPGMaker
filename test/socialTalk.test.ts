import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import {
  giveGiftToNpc,
  isTalkFriendshipEnabled,
  trySocialTalk,
} from "@/project/friendship";
import { getFriendship, startSession } from "@/project/session";
import { applySaveSnapshot, createSaveSnapshot } from "@/player/saveSlots";
import { normalizeItemRecord } from "@/project/databaseRecordModel";
import type { GameEvent, Project } from "@/project/types";

describe("social talk channel", () => {
  it("grants default +10 once per day and rejects same-day re-talk", () => {
    const project = createBlankProject();
    const session = startSession(project);
    const event = talkEvent("ev_npc", "char_npc", true);

    expect(isTalkFriendshipEnabled(event)).toBe(true);
    expect(trySocialTalk(session, event)).toMatchObject({
      ok: true,
      npcKey: "char_npc",
      delta: 10,
      friendship: 10,
    });
    expect(session.dailyTalks?.char_npc).toBeDefined();
    expect(getFriendship(session, "char_npc")).toBe(10);

    expect(trySocialTalk(session, event)).toMatchObject({
      ok: false,
      reason: "already-talked",
      npcKey: "char_npc",
    });
    expect(getFriendship(session, "char_npc")).toBe(10);

    session.gameTime = { minute: 0, hour: 6, day: 2, season: "spring", year: 1 };
    expect(trySocialTalk(session, event)).toMatchObject({
      ok: true,
      delta: 10,
      friendship: 20,
    });
  });

  it("uses custom delta from talkFriendship object", () => {
    const project = createBlankProject();
    const session = startSession(project);
    const event = talkEvent("ev_npc", "char_npc", { delta: 25 });

    expect(trySocialTalk(session, event)).toMatchObject({
      ok: true,
      delta: 25,
      friendship: 25,
    });
  });

  it("fails closed without characterId", () => {
    const project = createBlankProject();
    const session = startSession(project);
    const event = talkEvent("ev_npc", undefined, true);
    delete event.characterId;

    expect(isTalkFriendshipEnabled(event)).toBe(false);
    expect(trySocialTalk(session, event)).toMatchObject({ ok: false, reason: "not-enabled" });
    expect(session.dailyTalks).toEqual({});
    expect(session.friendship).toEqual({});
  });

  it("fails when talkFriendship is not enabled", () => {
    const project = createBlankProject();
    const session = startSession(project);
    const event = talkEvent("ev_npc", "char_npc", undefined);

    expect(isTalkFriendshipEnabled(event)).toBe(false);
    expect(trySocialTalk(session, event)).toMatchObject({ ok: false, reason: "not-enabled" });
  });

  it("is independent of dailyGifts", () => {
    const project = giftTalkProject();
    const session = startSession(project);
    const event = talkEvent("ev_farmer", "char_farmer", true);
    event.giftPrefs = { loved: ["item_strawberry"] };
    event.giftResponses = { loved: "thanks" };

    expect(trySocialTalk(session, event)).toMatchObject({ ok: true, delta: 10, friendship: 10 });
    expect(session.dailyTalks?.char_farmer).toBeDefined();
    expect(session.dailyGifts?.char_farmer).toBeUndefined();

    expect(giveGiftToNpc(project, session, event, "item_strawberry")).toMatchObject({
      ok: true,
      delta: 80,
      friendship: 90,
    });
    expect(session.dailyGifts?.char_farmer).toBeDefined();
    expect(session.dailyTalks?.char_farmer).toBeDefined();

    // Gift already used today, talk already used today — independent reasons.
    expect(giveGiftToNpc(project, session, event, "item_strawberry")).toMatchObject({
      ok: false,
      reason: "already-gifted",
    });
    expect(trySocialTalk(session, event)).toMatchObject({
      ok: false,
      reason: "already-talked",
    });
  });

  it("uses resolveSocialKey characterId, never event.id", () => {
    const project = createBlankProject();
    const session = startSession(project);
    const event = talkEvent("ev_map_copy", "char_shared", true);

    expect(trySocialTalk(session, event)).toMatchObject({ ok: true, npcKey: "char_shared" });
    expect(session.friendship?.char_shared).toBe(10);
    expect(session.friendship?.ev_map_copy).toBeUndefined();
    expect(session.dailyTalks?.char_shared).toBeDefined();
    expect(session.dailyTalks?.ev_map_copy).toBeUndefined();
  });

  it("round-trips dailyTalks through save/load", () => {
    const project = createBlankProject();
    const session = startSession(project);
    const event = talkEvent("ev_npc", "char_npc", true);
    expect(trySocialTalk(session, event)).toMatchObject({ ok: true, friendship: 10 });

    const restored = applySaveSnapshot(project, createSaveSnapshot(project, session));
    expect(restored.dailyTalks).toEqual(session.dailyTalks);
    expect(restored.friendship).toEqual({ char_npc: 10 });
    expect(trySocialTalk(restored, event)).toMatchObject({
      ok: false,
      reason: "already-talked",
    });
  });
});

function talkEvent(
  id: string,
  characterId: string | undefined,
  talkFriendship: GameEvent["talkFriendship"]
): GameEvent {
  return {
    id,
    ...(characterId ? { characterId } : {}),
    x: 1,
    y: 1,
    trigger: { kind: "action" },
    commands: [],
    ...(talkFriendship !== undefined ? { talkFriendship } : {}),
  };
}

function giftTalkProject(): Project {
  const project = createBlankProject();
  project.system.giftSystem = true;
  project.system.timeSystem = { enabled: true, dayStartHour: 6, dayEndHour: 26 };
  project.database.items.push(
    normalizeItemRecord({ id: "item_strawberry", name: "딸기", scope: "none", price: 12 })
  );
  project.session.inventory = { item_strawberry: 2 };
  return project;
}
