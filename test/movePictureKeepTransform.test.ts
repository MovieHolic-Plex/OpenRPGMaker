import { afterEach, describe, expect, it, vi } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { startSession } from "@/project/session";
import { pictureTransformFromState } from "@/player/pictures/pictureTween";
import { executeM2RuntimeCommand } from "@/player/interpreter/m2Runtime";
import { m2CommandById } from "@/project/eventCommands/m2Catalog";

const MOVE_PICTURE = m2CommandById("m2-052-move-picture")!;

function move(fields: Record<string, string | number>): void {
  const project = createBlankProject();
  const session = startSession(project);
  session.pictures.pic1 = {
    pictureId: "pic1",
    resourceId: "title-still",
    x: 40,
    y: 24,
    scale: 180,
    opacity: 80,
    rotation: 30,
    blendMode: "add",
  };
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  executeM2RuntimeCommand(session, MOVE_PICTURE, { commandId: MOVE_PICTURE.id, fields }, { project });
  expect(session.pictures.pic1).toMatchObject({
    pictureId: "pic1",
    resourceId: "title-still",
    blendMode: "add",
    ...expectedCarry(fields),
  });
  expect(pictureTransformFromState(session.pictures.pic1!)).toMatchObject(expectedCarry(fields));
}

function expectedCarry(fields: Record<string, string | number>): { x: number; y: number; scale: number; opacity: number; rotation: number } {
  return {
    x: typeof fields.x === "number" ? fields.x : 40,
    y: typeof fields.y === "number" ? fields.y : 24,
    scale: typeof fields.scale === "number" ? fields.scale : typeof fields.zoom === "number" ? fields.zoom : 180,
    opacity: typeof fields.opacity === "number" ? fields.opacity : 80,
    rotation: typeof fields.rotation === "number" ? fields.rotation : typeof fields.angle === "number" ? fields.angle : 30,
  };
}

describe("Move Picture keeps the still's transform", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("a position-only move does not un-rotate, resize, or fade the picture back in", () => {
    move({ pictureId: "pic1", x: 120, y: 48, durationMs: 600 });
  });

  it("an explicit rotation replaces only the angle", () => {
    move({ pictureId: "pic1", rotation: 90, durationMs: 400 });
  });

  it("zoom and angle field names override scale and rotation", () => {
    move({ pictureId: "pic1", zoom: 50, angle: -15 });
  });

  it("a new slot still omits transform fields the command did not set", () => {
    const project = createBlankProject();
    const session = startSession(project);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    executeM2RuntimeCommand(
      session,
      MOVE_PICTURE,
      { commandId: MOVE_PICTURE.id, fields: { pictureId: "pic1", resourceId: "portrait", x: 8, y: 9 } },
      { project },
    );
    expect(session.pictures.pic1).toEqual({ pictureId: "pic1", resourceId: "portrait", x: 8, y: 9 });
  });
});
