import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { runTool } from "../src/editor/tools";
import { createBlankProject } from "../src/project/defaults";
import { TILE } from "../src/project/defaults/constants";
import { projectLint } from "../src/project/lint/projectLint";
import type { GameEvent } from "../src/project/types";

function fixture(size: number, count: number) {
  const project = createBlankProject(), map = project.maps[project.startMapId];
  project.startPos = { x: 1, y: 1 };
  map.width = size; map.height = size;
  map.lowerTiles = Array(size * size).fill(TILE.GRASS);
  map.upperTiles = Array(size * size).fill(TILE.EMPTY);
  map.events = Array.from({ length: count }, (_, i): GameEvent => ({
    id: `npc${i}`, x: 5 + i % 10 * 5, y: 5 + Math.floor(i / 10) * 5,
    trigger: { kind: "action" }, commands: [], pages: [{
      id: `npc${i}_page`, name: "Guard", conditions: [],
      graphic: { sprite: { type: "bundled", id: "tex_easyrpg_charset_people1" } },
      trigger: { kind: "action" }, priority: "same", movement: { type: "fixed", speed: 3, frequency: 3 },
      commands: [{ kind: "setSwitch", switchId: project.switches[0].id, value: true }],
    }],
  }));
  return { project };
}

if (process.argv.includes("--benchmark")) {
  // Identical fixtures and a warmed lint path before each measured invocation.
  for (const [size, count] of [[100, 20], [256, 60]]) {
    const { project } = fixture(size, count), map = project.maps[project.startMapId];
    for (const event of map.events) map.lowerTiles[event.y * size + event.x] = TILE.WALL;
    projectLint(project);
    const start = performance.now();
    const issues = projectLint(project);
    console.log(JSON.stringify({ size, count, ms: Math.round(performance.now() - start), blocked: issues.filter(i => i.code === "event-character-impassable").length }));
  }
} else {
  const context = fixture(16, 1), mapId = context.project.startMapId;
  // Mutation probe: remove the real authored effect, not the assertion or result.
  if (process.argv.includes("--without-switch-command")) context.project.maps[mapId].events[0].pages![0].commands = [];
  const before = structuredClone(context.project.maps[mapId].events[0]);
  const paint = runTool(context, "paint_tiles", { mapId, layer: "lower", mode: "cells", tile: TILE.WALL,
    cells: [{ x: 4, y: 5 }, { x: 6, y: 5 }, { x: 5, y: 4 }, { x: 5, y: 6 }] });
  assert.equal(paint.ok, true, paint.summary);
  const lint = runTool(context, "run_lint", {});
  const candidate = lint.issues?.find(i => i.eventId === before.id)?.relocation?.candidates[0];
  assert.ok(candidate, "ordinary lint must offer recovery for enclosed floor NPC");
  const move = runTool(context, candidate.name, candidate.args);
  assert.equal(move.ok, true, move.summary);
  assert.deepEqual(context.project.maps[mapId].events[0], { ...before, x: candidate.args.x, y: candidate.args.y });
  const scene = runTool(context, "run_scene_test", { mapId, start: { x: candidate.args.x, y: candidate.args.y - 1 },
    steps: [{ kind: "interact" }, { kind: "expect", switchOn: context.project.switches[0].id }] });
  assert.equal(scene.ok, true, scene.summary);
  const verdict = scene.data;
  assert.ok(verdict && typeof verdict === "object" && "ok" in verdict && "finalState" in verdict, "missing scene verdict");
  assert.equal(verdict.ok, true, JSON.stringify(verdict));
  const finalState = verdict.finalState;
  assert.ok(finalState && typeof finalState === "object" && "switchesOn" in finalState && Array.isArray(finalState.switchesOn), "missing scene switch state");
  assert.ok(finalState.switchesOn.includes(context.project.switches[0].id), "authored switch command did not execute");
  console.log(JSON.stringify({ paint: paint.ok, lint: lint.ok, candidate, move: move.ok, scene: scene.data }));
}
