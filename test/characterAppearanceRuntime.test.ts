import { describe, expect, it, vi } from "vitest";
import { loadBundledAssets } from "@/assets/bundled";
import { charsetFrameIndex } from "@/assets/easyrpgRtp";
import { createInterpreter } from "@/player/interpreter";
import { resolvePlayerSpriteResource } from "@/player/playerSpriteResources";
import { runtimeEventViewsForMap } from "@/project/runtimeEventState";
import { startSession } from "@/project/session";
import { resolveActorFaceResourceId } from "@/project/sessionActorCommands";
import { eventSpriteFrameForDirection, resolveEventSpriteTexture } from "@/player/eventSpriteResources";
import { characterAppearanceProject } from "./fixtures/characterAppearanceProject";

describe("character appearance runtime", () => {
  it("queues uploaded charset bytes when the real player preloader runs", () => {
    // Given the same loader seam used by PlayScene.preload.
    const project = characterAppearanceProject();
    const image = vi.fn();
    // When assets are queued.
    loadBundledAssets({ load: { image, on: vi.fn() } }, project);
    // Then the uploaded bytes, not a bundled substitute, reach the loader.
    expect(image).toHaveBeenCalledWith("uploaded-walk", project.assets.uploaded["uploaded-walk"].dataUrl);
  });

  it("keeps the uploaded NPC slot when runtime direction changes", () => {
    // Given cell 5 facing left (RTP row 7, column 4 = frame 88).
    const project = characterAppearanceProject();
    const texture = resolveEventSpriteTexture(project, "uploaded-walk", 88);
    // When runtime direction becomes up.
    const frame = eventSpriteFrameForDirection(texture, "up");
    // Then cell 5, up, idle is RTP row 4 column 4 = 52.
    expect(frame).toBe(52);
  });

  it("uses set faces through the shared actor resolver without defeating overrides", () => {
    // Given an actor link and a session with no explicit face override.
    const project = characterAppearanceProject();
    const actor = project.database.actors[0];
    const session = startSession(project);
    // When menu/shop/battle resolve the actor face.
    const face = resolveActorFaceResourceId(session, actor, project);
    // Then the linked portrait beats the legacy actor face.
    expect(face).toBe("easyrpg-faceset-actor1-03");
  });
  it("uses uploaded charset and chosen slot when the leading actor is linked", () => {
    // Given a linked actor whose legacy graphic differs from the set.
    const project = characterAppearanceProject();
    // When the real player resource resolver runs.
    const resource = resolvePlayerSpriteResource(project, startSession(project));
    // Then both upload identity and nonzero cell drive animation.
    expect(resource.texture).toBe("uploaded-walk");
    expect(resource.idleFrameFor("left")).toBe(88);
    expect(resource.walkFrameFor("up", 2)).toBe(53);
  });

  it("supplies the active page portrait when dialogue has no explicit portrait command", () => {
    // Given a page link and no changeFace.
    const project = characterAppearanceProject();
    const page = project.maps[project.startMapId].events[0].pages?.[0];
    if (!page) throw new Error("fixture page missing");
    // When the real interpreter starts the event.
    const result = createInterpreter(page.commands, startSession(project), project, { currentEventId: "guide" }).start();
    // Then the portrait comes from the page, not speaker-name inference.
    expect(result).toMatchObject({ kind: "text", face: { resourceId: "easyrpg-faceset-actor1-03", presentation: "face" } });
  });

  it("projects the active page charset without overwriting authored page fields", () => {
    // Given a page-local appearance and no direct sprite.
    const project = characterAppearanceProject();
    const map = project.maps[project.startMapId];
    // When runtime views are materialized for rendering and movement.
    const view = runtimeEventViewsForMap(project, map, startSession(project), {})[0];
    // Then the selected slot is visible to all runtime consumers.
    expect(view.sprite).toEqual({ type: "uploaded", id: "uploaded-walk" });
    expect(view.page?.graphic.pattern).toBe(charsetFrameIndex({ characterIndex: 5, direction: "left", pattern: 1 }));
    expect(map.events[0].pages?.[0].graphic.sprite).toBeUndefined();
  });

  it("resolves requested bust to face when that appearance has no bust", () => {
    // Given an extended changeFace command using no legacy resource.
    const project = characterAppearanceProject();
    // When the interpreter executes the command.
    const result = createInterpreter([
      { kind: "changeFace", resourceId: "", appearanceId: "look", presentation: "bust", position: "right", flipHorizontally: true },
      { kind: "text", body: "Fallback." },
    ], startSession(project), project).start();
    // Then fallback retains explicit placement and actual face presentation.
    expect(result).toMatchObject({ kind: "text", face: { resourceId: "easyrpg-faceset-actor1-03", presentation: "face", position: "right", flipHorizontally: true } });
  });

  it.each(["", "easyrpg-faceset-actor2-04"])("preserves explicit portrait %s over the page default", (resourceId) => {
    // Given an explicit portrait command, including explicit clear.
    const project = characterAppearanceProject();
    // When it runs before dialogue on a linked page.
    const result = createInterpreter([
      { kind: "changeFace", resourceId, position: "right", flipHorizontally: false },
      { kind: "text", body: "Explicit." },
    ], startSession(project), project, { currentEventId: "guide" }).start();
    // Then no default is reapplied after an explicit command.
    if (result.kind !== "text") throw new Error("text step expected");
    expect(result.face?.resourceId).toBe(resourceId || undefined);
  });

  it("clears the previous portrait when an explicit bound set has no portrait", () => {
    // Given a prior speaker portrait.
    const project = characterAppearanceProject();
    // When the next command selects an incomplete set.
    const result = createInterpreter([
      { kind: "changeFace", resourceId: "easyrpg-faceset-actor2-04", position: "left", flipHorizontally: false },
      { kind: "changeFace", resourceId: "", appearanceId: "empty", presentation: "bust", position: "left", flipHorizontally: false },
      { kind: "text", body: "No portrait." },
    ], startSession(project), project).start();
    // Then the prior speaker cannot leak.
    expect(result).toMatchObject({ kind: "text", face: undefined });
  });

  it("resets dialogue defaults when a later event start selects an empty active page", () => {
    // Given the previous event interaction used a portrait.
    const project = characterAppearanceProject();
    const session = startSession(project);
    const event = project.maps[project.startMapId].events[0];
    const page = event.pages?.[0];
    if (!page) throw new Error("fixture page missing");
    createInterpreter(page.commands, session, project, { currentEventId: event.id }).start();
    event.pages?.push({ ...page, id: "page-empty", conditions: [], graphic: { appearanceId: "empty" } });
    // When a new interpreter starts on the now-active empty page.
    const result = createInterpreter(page.commands, session, project, { currentEventId: event.id }).start();
    // Then it does not inherit the previous interpreter's default.
    expect(result).toMatchObject({ kind: "text", face: undefined });
  });

  it("retains session charset and face overrides over a linked set", () => {
    // Given explicit runtime overrides different from both the set and legacy defaults.
    const project = characterAppearanceProject();
    const actor = project.database.actors[0];
    const session = startSession(project);
    session.actorCharacterResourceIds = { [actor.id]: "easyrpg-charset-actor2" };
    session.actorFaceResourceIds = { [actor.id]: "easyrpg-faceset-actor2-04" };
    // When effective runtime resources are resolved.
    const sprite = resolvePlayerSpriteResource(project, session);
    const face = resolveActorFaceResourceId(session, actor, project);
    // Then the session overrides win with legacy override cell zero.
    expect([sprite.resourceId, sprite.idleFrameFor("up"), face]).toEqual(["easyrpg-charset-actor2", 1, "easyrpg-faceset-actor2-04"]);
  });
});
