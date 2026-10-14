import base from "./field-enemy.scenario.mjs";
export default {
  id: "field-enemy-probe",
  projectFixture: "/tmp/fe-skip.json",
  beats: [
    { ...base.beats[0], expect: { mapId: base.beats[0].expect.mapId } },
    { id: "move", ops: [{ kind: "hold", dir: "left", ms: 300 }, { kind: "hold", dir: null, ms: 200 }], expect: { x: 9 }, shot: true },
  ],
};
