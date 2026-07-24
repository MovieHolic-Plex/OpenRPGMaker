import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { startSession } from "@/project/session";
import { resolveActorName, resolveActorNickname, resolveActorFaceResourceId, resolveActorFaceIndex } from "@/project/sessionActorCommands";
import { createPlayerStatusMenuSnapshot } from "@/player/playerStatusMenuModel";
import type { PlaySession } from "@/project/session";

describe("T6 actor parity — name/nickname/faceset session overrides", () => {
  it("changeActorName propagates to status menu row name", () => {
    const project = createBlankProject();
    const session = startSession(project);
    const actorId = project.database.actors[0].id;
    const originalName = project.database.actors[0].name;

    session.actorNames = { [actorId]: "테스트이름" };
    const snapshot = createPlayerStatusMenuSnapshot(project, session as PlaySession);
    const row = snapshot.partyRows.find((r) => r.actorId === actorId);
    expect(row?.name).toBe("테스트이름");
    expect(row?.name).not.toBe(originalName);
  });

  it("changeActorFaceset propagates to status menu row faceResourceId", () => {
    const project = createBlankProject();
    const session = startSession(project);
    const actorId = project.database.actors[0].id;

    session.actorFaceResourceIds = { [actorId]: "custom-faceset-123" };
    const snapshot = createPlayerStatusMenuSnapshot(project, session as PlaySession);
    const row = snapshot.partyRows.find((r) => r.actorId === actorId);
    expect(row?.faceResourceId).toBe("custom-faceset-123");
  });

  it("resolveActorNickname returns session override when set", () => {
    const project = createBlankProject();
    const actor = project.database.actors[0];
    expect(resolveActorNickname({}, actor)).toBe(actor.nickname);
    expect(resolveActorNickname({ actorNicknames: { [actor.id]: "별명테스트" } }, actor)).toBe("별명테스트");
  });

  it("resolveActorFaceIndex returns session override when set", () => {
    const project = createBlankProject();
    const actor = project.database.actors[0];
    expect(resolveActorFaceIndex({}, actor)).toBe(actor.faceIndex ?? 0);
    expect(resolveActorFaceIndex({ actorFaceIndices: { [actor.id]: 7 } }, actor)).toBe(7);
  });
});
