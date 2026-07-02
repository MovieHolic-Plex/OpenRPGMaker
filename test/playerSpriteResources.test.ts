import { describe, expect, it } from "vitest";
import { createBlankProject, DEFAULT_EASYRPG_CHARSET_ID } from "@/project/defaults";
import { startSession } from "@/project/session";
import { resolvePlayerSpriteResource } from "@/player/playerSpriteResources";

describe("player sprite resource resolution", () => {
  it("keeps the default hero charset when the stored actor character resource is invalid", () => {
    const project = createBlankProject();
    const hero = project.database.actors.find((actor) => actor.id === "actor_hero");
    if (!hero) throw new Error("missing default hero actor");
    hero.characterResourceId = "missing-uploaded-hero";

    const sprite = resolvePlayerSpriteResource(project, startSession(project));

    expect(sprite.kind).toBe("charset");
    expect(sprite.resourceId).toBe("easyrpg-charset-actor1");
    expect(sprite.texture).toBe("tex_easyrpg_charset_actor1");
  });

  it("falls back to EasyRPG People1 when no party actor can provide a sprite", () => {
    const project = createBlankProject();
    const session = startSession(project);
    session.partyActorIds = [];

    const sprite = resolvePlayerSpriteResource(project, session);

    expect(sprite.kind).toBe("charset");
    expect(sprite.resourceId).toBe("easyrpg-charset-people1");
    expect(sprite.texture).toBe(DEFAULT_EASYRPG_CHARSET_ID);
  });
});
