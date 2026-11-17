import { expect, it } from "vitest";
import { createBuildRun } from "@/ai/v2/shared/buildRun";
import { buildPuzzleChain } from "@/ai/v2/story/puzzle";
import type { ToolContext } from "@/editor/tools/types";
import { createBlankProject } from "@/project/defaults";
import { runSceneTest } from "@/testing/sceneTestRunner";

it("a solved floor code lock remains examinable without blocking movement after its prop is removed", () => {
  const project = createBlankProject();
  const mapId = project.startMapId;
  const map = project.maps[mapId]!;
  const tileset = project.tilesets[map.tilesetId]!;
  const floor = { up: true, down: true, left: true, right: true };
  const prop = { up: false, down: false, left: false, right: false };
  project.tilesets[map.tilesetId] = {
    ...tileset,
    passability: [floor, prop],
    passageMarks: undefined,
    tileMeta: [{ label: "floor", description: "" }, { label: "crate", description: "" }],
  };
  map.lowerTiles.fill(0);
  map.upperTiles.fill(-1);
  const at = { x: 5, y: 5 };
  map.upperTiles[at.y * map.width + at.x] = 1;
  const ctx: ToolContext = { project, currentMapId: mapId, assistantRun: true };
  const built = buildPuzzleChain(createBuildRun(ctx), {
    mapId,
    name: "Warehouse lock",
    links: [
      { role: "clue", name: "Number note", at: { x: 2, y: 2 }, learn: "Read the note", lines: ["It says 4826."] },
      { role: "code", name: "Crate lock", at, needs: "Read the note", code: "4826", doneLines: ["Already open."] },
    ],
  });
  expect(built.ok).toBe(true);
  const placed = ctx.project.maps[mapId]!;
  const lock = placed.events.find((event) => event.id === built.eventIds?.[1]?.eventId)!;
  expect({ x: lock.x, y: lock.y }).toEqual(at);
  const solved = lock.pages!.at(-1)!.conditions.find((condition) => condition.kind === "switch")!;
  const start = { x: at.x, y: at.y + 1 };
  const move = { kind: "move", dir: "up" } as const;
  const setSolved = { kind: "set", switches: { [solved.switchId]: true } } as const;
  const withCrate = runSceneTest(ctx.project, { mapId, start, steps: [setSolved, move] });
  expect(withCrate.ok).toBe(false);

  // The room is relaid without the crate while retaining its events and switches.
  placed.upperTiles[at.y * placed.width + at.x] = -1;
  const locked = runSceneTest(ctx.project, { mapId, start, steps: [move] });
  expect(locked.ok).toBe(false);
  expect(locked.failureReason).toContain(lock.id);

  const unlocked = runSceneTest(ctx.project, {
    mapId, start, steps: [
      setSolved,
      move,
      { kind: "expect", playerAt: at },
      { kind: "interact", eventId: lock.id },
    ],
  });
  expect(unlocked.ok).toBe(true);
  expect(unlocked.finalState.messages).toContain("Already open.");
});
