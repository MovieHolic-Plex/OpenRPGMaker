import { readFile, writeFile, mkdir } from "node:fs/promises";
import { feature16WorldFixture } from "../../../test/fixtures/feature16-world/build.mjs";
const fixtureUrl = new URL("../../../test/fixtures/feature16-world/generated.json", import.meta.url);
export async function prepareFeature16WorldFixture(kind = "melee") {
  const base = JSON.parse(await readFile(new URL("../../../test/fixtures/projects/editor-authored-demo-v3.json", import.meta.url), "utf8"));
  const project = feature16WorldFixture(base, kind);
  await mkdir(new URL(".", fixtureUrl), { recursive: true });
  await writeFile(fixtureUrl, JSON.stringify(project));
  return project;
}
await prepareFeature16WorldFixture();
export default {
  id: "feature16-world",
  projectFixture: "test/fixtures/feature16-world/generated.json",
  beats: [
    { id: "title", expect: { testidPresent: ["title-screen"] } },
    { id: "field", ops: [{ kind: "key", key: "Enter" }, { kind: "waitForRuntime" }],
      expect: { mapId: "map_lantern_village", x: 2, y: 3, testidPresent: ["action-hud"] }, shot: true },
  ],
};
