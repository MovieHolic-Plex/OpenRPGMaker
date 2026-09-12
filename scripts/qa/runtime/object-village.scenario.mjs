import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
const flag = process.argv.indexOf("--project");
const projectFixture = flag >= 0 ? process.argv[flag + 1] : "output/evidence/object-village/reloaded-project.json";
const project = JSON.parse(readFileSync(projectFixture, "utf8"));
const proof = JSON.parse(readFileSync(join(dirname(projectFixture), "walkthroughs.json"), "utf8"));
assert.equal(createHash("sha256").update(JSON.stringify(project.maps[proof.mapId])).digest("hex"), proof.mapSHA256);
const beats = [
  { id: "title", expect: { testidPresent: ["title-screen"] } },
  { id: "start", ops: [{ kind: "key", key: "Enter" }, { kind: "waitForRuntime" }],
    expect: { mapId: proof.mapId, playerSpriteTextureLoaded: true } },
];
for (const walk of proof.walks) {
  beats.push({ id: `${walk.id}-approach`, ops: [
    { kind: "teleport", mapId: proof.mapId, ...walk.start },
    { kind: "waitForPosition", mapId: proof.mapId, ...walk.start },
  ], expect: { mapId: proof.mapId, ...walk.start } });
  beats.push({ id: `${walk.id}-walk`, shot: true, note: `저장 후 재로드한 ${walk.id} 접근로를 실제 ${walk.moves.length}걸음 이동`, ops: [
    { kind: "playerRoute", moves: walk.moves },
    { kind: "waitForPosition", mapId: proof.mapId, ...walk.end },
  ], expect: { mapId: proof.mapId, ...walk.end, playerSpriteTextureLoaded: true } });
}
export default { id: proof.mapId.includes("compact") ? "compact-village" : "object-village", projectFixture, beats };
