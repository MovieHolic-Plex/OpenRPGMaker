import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import {
  getCharacterProfile,
  resolveBirthday,
  resolveGiftPrefs,
  resolveGiftResponses,
} from "@/project/characterProfiles";
import { giveGiftToNpc, isGiftableEvent } from "@/project/friendship";
import { deserialize, serialize } from "@/project/io";
import { startSession } from "@/project/session";
import type { GameEvent, Project } from "@/project/types";
import { normalizeItemRecord } from "@/project/databaseRecordModel";

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
