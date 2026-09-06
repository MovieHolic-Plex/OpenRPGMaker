import { expect, it } from "vitest";
import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { resolvePlayerSpriteResource } from "@/player/playerSpriteResources";
import { startSession } from "@/project/session";
import { asset, buildFixture } from "../U07.fixture";
import { insertAsset } from "./editorFixture";

it("G2-F9 renders a registered uploaded charset when the lead actor has that live override", () => {
  // Given: a real dimensioned PNG registered through the project asset/profile structures.
  const project = buildFixture(); const resource = asset("charset", "new"); insertAsset(project, resource);
  expect(resolveAssetResourceUrl(resource.id, { project })).toBe(resource.dataUrl);
  const session = startSession(project); session.actorCharacterResourceIds = { actor_hero: resource.id };
  // When: the same resolver used by PlayScene.refreshRuntimeSurfaces executes.
  const sprite = resolvePlayerSpriteResource(project, session);
  // Then: the authored uploaded resource, not the default actor, is selected.
  expect(sprite.resourceId).toBe(resource.id);
  expect(sprite.texture).toBe(resource.id);
  expect(sprite.idleFrameFor("down")).toBe(25);
  expect([0, 1, 2, 3].map(frame => sprite.walkFrameFor("down", frame))).toEqual([24, 25, 26, 25]);
});

it("G2-F9 preserves a valid bundled override when the lead actor uses the existing catalog", () => {
  // Given: a distinct, valid non-default bundled character.
  const project = buildFixture(); const session = startSession(project);
  session.actorCharacterResourceIds = { actor_hero: "easyrpg-charset-actor2" };
  // When
  const sprite = resolvePlayerSpriteResource(project, session);
  // Then
  expect(sprite.resourceId).toBe("easyrpg-charset-actor2");
});

it.each(["picture", "faceset", "backdrop", "monster", "sprite"] as const)("G2-F9 retains the fallback when an uploaded %s is not a charset", kind => {
  // Given: a valid PNG and even a charset profile cannot override the actual upload kind.
  const project = buildFixture(); const charset = asset("charset", "new"); insertAsset(project, charset);
  project.assets.uploaded[charset.id] = { ...charset, kind };
  const session = startSession(project); session.actorCharacterResourceIds = { actor_hero: charset.id };
  // When
  const sprite = resolvePlayerSpriteResource(project, session);
  // Then
  expect(sprite.resourceId).toBe("easyrpg-charset-actor1");
});

it.each(["u07-missing-charset", ""])("G2-F9 retains the fallback when the uploaded override is missing '%s'", id => {
  // Given
  const project = buildFixture(); const session = startSession(project);
  session.actorCharacterResourceIds = { actor_hero: id };
  // When
  const sprite = resolvePlayerSpriteResource(project, session);
  // Then
  expect(sprite.texture).toBe("tex_easyrpg_charset_actor1");
});

it("G2-F9 preserves a bundled texture-key alias when it is selected", () => {
  // Given
  const project = buildFixture(); const session = startSession(project);
  session.actorCharacterResourceIds = { actor_hero: "tex_easyrpg_charset_actor2" };
  // When
  const sprite = resolvePlayerSpriteResource(project, session);
  // Then
  expect({ resourceId: sprite.resourceId, texture: sprite.texture }).toEqual({ resourceId: "easyrpg-charset-actor2", texture: "tex_easyrpg_charset_actor2" });
});
