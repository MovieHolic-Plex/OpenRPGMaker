// Local engine-regression fixtures only. No store, remote reads, or remote writes.
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { createBlankProject } from "../src/project/defaults";
import { deserialize, serialize } from "../src/project/io";
import { runTool } from "../src/editor/tools/toolRunner";
import { isPassable } from "../src/project/collision";
import { runWalkthrough, type WalkthroughStep } from "../src/testing/walkthroughRunner";

const out = "output/evidence/pr618-fixtures";
mkdirSync(out, { recursive: true });
const manifest = [];
for (const id of ["inn", "hearth-unlit", "hearth-lit"]) {
  const context = { project: createBlankProject() };
  const mapId = `qa_${id.replaceAll("-", "_")}`;
  const result = runTool(context, "place_concept", {
    query: id === "inn" ? "inn" : "hearth QA", mapId, seed: 7,
    ...(id === "inn" ? {} : { plan: {
      places: [{ id: "hall", role: "entrance", size: "l" }],
      things: [{ id: "hearth", objectId: `stone_${id.replaceAll("-", "_")}`, placeIds: ["hall"], chips: ["block", "event"], required: true }],
    } }),
  }, { dryRun: false });
  assert.ok(result.ok, result.summary);
  assert.deepEqual([...(result.warnings ?? []), ...(result.diff?.warnings ?? [])], []);
  const map = context.project.maps[mapId];
  assert.ok(map);
  const entrance = map.events.find(event => event.id === `ev_entrance_${mapId}`);
  assert.ok(entrance);
  context.project.startMapId = mapId;
  context.project.startPos = { x: entrance.x, y: entrance.y - 1 };
  const project = deserialize(serialize(context.project));
  assert.ok(isPassable(project, project.maps[mapId]!, entrance.x, entrance.y - 1));
  const steps: WalkthroughStep[] = [];
  if (id === "inn") {
    let from = mapId;
    for (const to of [`${mapId}_2f`, `${mapId}_3f`, `${mapId}_2f`, mapId]) {
      const event = project.maps[from]!.events.find(event => event.pages?.some(page =>
        page.commands.some(command => command.kind === "transfer" && command.mapId === to)));
      assert.ok(event, `${from} -> ${to}`);
      steps.push({ expect: "mapId", mapId: from },
        { do: "moveTo", mapId: from, x: event.x, y: event.y + 1 },
        { do: "interact", eventId: event.id }, { expect: "mapId", mapId: to });
      from = to;
    }
    const walkthrough = runWalkthrough(project, steps, { seed: 7 });
    assert.ok(walkthrough.ok, walkthrough.failureReason);
  } else {
    assert.ok(map.lowerTiles.includes(id === "hearth-lit" ? 124 : 463));
  }
  const file = `${out}/${id}.json`;
  writeFileSync(file, serialize(project));
  manifest.push({ id, file, mapId, start: project.startPos, steps });
}
writeFileSync(`${out}/manifest.json`, JSON.stringify(manifest, null, 2));
console.log(JSON.stringify({ out, fixtures: manifest.map(({ id, file }) => ({ id, file })), remoteAccess: false }));
