// v5 example rooms holding the 2026-10-20 props 3/4 redraws (cabinets, orrery, slot machine, console, confessional).
// Fixture: bun tiledata/hand-interior/pick/work/props34/fixture.mts → output/props34-qa/project.json
import fs from "node:fs";
const projectFixture = "output/props34-qa/project.json";
const steps = JSON.parse(fs.readFileSync("output/props34-qa/steps.json", "utf8"));
export default {
  id: "props34-v5-rooms",
  projectFixture,
  beats: [
    { id: "title", expect: { testidPresent: ["title-screen"] } },
    { id: "start", ops: [{ kind: "key", key: "Enter" }, { kind: "waitForRuntime" }], expect: { playerSpriteTextureLoaded: true } },
    ...steps.map((s) => ({
      id: s.id,
      shot: true,
      ops: [{ kind: "teleport", mapId: s.id, x: s.x, y: s.y }, { kind: "waitForPosition", mapId: s.id, x: s.x, y: s.y }],
      expect: { mapId: s.id, x: s.x, y: s.y },
    })),
  ],
};
