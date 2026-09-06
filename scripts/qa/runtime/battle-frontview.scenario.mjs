import { battleScenario } from "./battle.scenario.mjs";

// The fixture has four allies. Default front-view must omit every battlefield
// actor while retaining the party HUD and keyboard target selection.
const absentActors = [
  "battle-actor-actor_hero",
  "battle-actor-actor_guardian",
  "battle-actor-actor_mage",
  "battle-actor-actor_scout",
];

/** @type {import("../../lib/runtimeQa.d.mts").RuntimeQaScenario} */
export default {
  id: "battle-frontview",
  beats: [
    ...battleScenario.beats.slice(0, 3),
    {
      ...battleScenario.beats[3],
      note: "Default front-view: enemies on the field, allies only in the party HUD",
      expect: {
        testidPresent: ["battle-scene", "battle-party", "actor-command-attack"],
        testidAbsent: absentActors,
        visibleText: { "battle-party": "HP" },
        battlerGeometry: { minEnemies: 3 },
      },
    },
    {
      id: "attack-target",
      note: "Keyboard attack opens target selection without restoring ally sprites",
      ops: [
        { kind: "key", key: "z" },
        { kind: "waitFor", testid: "battle-target-cancel", state: "present" },
      ],
      expect: {
        testidPresent: ["battle-scene", "battle-target-cancel", "battle-party"],
        testidAbsent: absentActors,
        visibleText: { "battle-party": "MP" },
      },
      shot: true,
    },
    {
      id: "attack-confirm",
      note: "Confirm the enemy target; the battle continues with no ally sprites",
      ops: [
        { kind: "key", key: "z" },
        { kind: "waitFor", testid: "battle-target-cancel", state: "absent" },
      ],
      expect: {
        testidPresent: ["battle-scene", "battle-party"],
        testidAbsent: absentActors,
      },
      shot: true,
    },
  ],
};
