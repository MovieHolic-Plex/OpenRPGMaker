import fs from "node:fs";
import path from "node:path";
const flag = process.argv.indexOf("--project");
const projectFixture =
  flag < 0
    ? "output/evidence/interior-catalog-review/reloaded-project.json"
    : process.argv[flag + 1];
const project = JSON.parse(fs.readFileSync(projectFixture));
const { steps } = JSON.parse(
  fs.readFileSync(
    path.join(path.dirname(projectFixture), "runtime-routes.json"),
  ),
);
const house = process.env.QA_INTERIOR_HOUSE ?? "inn-3f";
if (!["inn-3f", "workshop-4f"].includes(house))
  throw new Error("Unknown QA_INTERIOR_HOUSE");
// Use one fresh player session per house: debug teleport during the preceding
// exit interpreter can leave its route/input state active in the next house.
export default {
  id: `interior-catalog-${house}`,
  projectFixture,
  beats: [
    { id: "title", expect: { testidPresent: ["title-screen"] } },
    {
      id: "start",
      ops: [{ kind: "key", key: "Enter" }, { kind: "waitForRuntime" }],
      expect: { mapId: project.startMapId, playerSpriteTextureLoaded: true },
    },
    ...steps
      .filter((s) => s.id.startsWith(house))
      .map((s) => ({
        id: s.id,
        shot: true,
        ops: s.teleport
          ? [
              { kind: "teleport", ...s.teleport },
              { kind: "waitForPosition", ...s.teleport },
            ]
          : [
              { kind: "playerRoute", moves: s.moves },
              { kind: "waitForPosition", ...s.expect },
            ],
        expect: {
          ...(s.teleport ?? s.expect),
          playerSpriteTextureLoaded: true,
        },
      })),
  ],
};
