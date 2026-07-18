import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { giveMonster, moveMonster } from "@/project/monsterCollection";
import { startSession } from "@/project/session";
import {
  addFollowerToSession,
  removeFollowerFromSession,
  syncMonsterPartyFollowers,
} from "@/player/followers";
import { applySaveSnapshot, createSaveSnapshot } from "@/player/saveSlots";
import type { Project } from "@/project/types";

function monsterProject(): Project {
  const project = createBlankProject();
  project.system.monsterCollection = true;
  return project;
}

describe("monster party overworld train followers (G001)", () => {
  it("giveMonster adds monster followers matching party size and order", () => {
    const project = monsterProject();
    const session = startSession(project, 1);

    const first = giveMonster(project, session, {
      speciesId: "species_wild_slime",
      level: 3,
      nickname: "방울",
    });
    const second = giveMonster(project, session, {
      speciesId: "species_leafling",
      level: 2,
    });
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);

    const monsters = session.followers.filter((entry) => entry.kind === "monster");
    expect(monsters).toHaveLength(2);
    expect(monsters.map((entry) => entry.monsterInstanceId)).toEqual(session.monsterParty);
    expect(monsters[0]?.name).toBe("방울");
    expect(monsters[0]?.graphic.sprite?.id).toBe("tex_easyrpg_charset_monster1");
    expect(session.followerTrail.length).toBeGreaterThan(0);
  });

  it("actor followers come before monster train in trail order", () => {
    const project = monsterProject();
    const session = startSession(project, 2);
    addFollowerToSession(project, session, { actorId: "actor_hero", name: "가리" });
    giveMonster(project, session, { speciesId: "species_wild_slime", level: 4, nickname: "슬라" });
    giveMonster(project, session, { speciesId: "species_sparkit", level: 4 });

    expect(session.followers.map((entry) => entry.kind ?? "actor")).toEqual(["actor", "monster", "monster"]);
    expect(session.followers[0]?.name).toBe("가리");
    expect(session.followers.slice(1).map((entry) => entry.monsterInstanceId)).toEqual(session.monsterParty);
  });

  it("moveMonster party->box reduces monster followers when project is provided", () => {
    const project = monsterProject();
    const session = startSession(project, 3);
    const gift = giveMonster(project, session, { speciesId: "species_wild_slime", level: 5 });
    expect(gift.ok).toBe(true);
    if (!gift.ok) return;

    const moved = moveMonster(session, gift.instance.instanceId, "box", project);
    expect(moved.ok).toBe(true);
    expect(session.monsterParty).toHaveLength(0);
    expect(session.followers.filter((entry) => entry.kind === "monster")).toHaveLength(0);
  });

  it("reordering monsterParty changes monster follower order on sync", () => {
    const project = monsterProject();
    const session = startSession(project, 4);
    giveMonster(project, session, { speciesId: "species_wild_slime", level: 3, nickname: "A" });
    giveMonster(project, session, { speciesId: "species_leafling", level: 3, nickname: "B" });
    expect(session.monsterParty).toHaveLength(2);

    const [first, second] = session.monsterParty;
    session.monsterParty = [second!, first!];
    syncMonsterPartyFollowers(project, session);

    expect(session.followers.filter((entry) => entry.kind === "monster").map((entry) => entry.name)).toEqual([
      "B",
      "A",
    ]);
  });

  it("save/load resync restores monster train from monsterParty", () => {
    const project = monsterProject();
    const session = startSession(project, 5);
    giveMonster(project, session, { speciesId: "species_wild_slime", level: 3, nickname: "방울" });
    addFollowerToSession(project, session, { actorId: "actor_hero", name: "가리" });

    const restored = applySaveSnapshot(project, createSaveSnapshot(project, session));
    const monsters = restored.followers.filter((entry) => entry.kind === "monster");
    expect(monsters).toHaveLength(1);
    expect(monsters[0]?.monsterInstanceId).toBe(restored.monsterParty[0]);
    expect(monsters[0]?.name).toBe("방울");
    expect(restored.followers.some((entry) => entry.kind !== "monster" && entry.name === "가리")).toBe(true);
  });

  it("removeFollower all keeps monster train entries", () => {
    const project = monsterProject();
    const session = startSession(project, 6);
    addFollowerToSession(project, session, { actorId: "actor_hero", name: "가리" });
    giveMonster(project, session, { speciesId: "species_wild_slime", level: 2, nickname: "슬라" });

    const removed = removeFollowerFromSession(session, { all: true });
    expect(removed).toBe(1);
    expect(session.followers).toHaveLength(1);
    expect(session.followers[0]?.kind).toBe("monster");
    expect(session.followers[0]?.name).toBe("슬라");
  });

  it("uses species fieldCharsetId when authored", () => {
    const project = monsterProject();
    const species = project.database.monsterSpecies?.find((record) => record.id === "species_wild_slime");
    if (!species) throw new Error("missing slime");
    species.graphic = {
      ...species.graphic,
      fieldCharsetId: "tex_easyrpg_charset_monster2",
    };
    const session = startSession(project, 7);
    giveMonster(project, session, { speciesId: "species_wild_slime", level: 1 });
    expect(session.followers[0]?.graphic.sprite?.id).toBe("tex_easyrpg_charset_monster2");
  });

  it("actor addFollower still tags kind actor", () => {
    const project = monsterProject();
    const session = startSession(project, 8);
    const follower = addFollowerToSession(project, session, { actorId: "actor_hero", name: "가리" });
    expect(follower?.kind).toBe("actor");
    expect(session.followers).toHaveLength(1);
    expect(session.followers[0]?.kind).toBe("actor");
  });
});
