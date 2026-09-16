import { mkdirSync, writeFileSync } from "node:fs";
import { spaceCompilerFixture } from "../test/support/spatialSpaceCompilerFixture";

const target = process.argv[2] ?? "/tmp/pi-spatial-live.json";
mkdirSync(target.slice(0, target.lastIndexOf("/")) || "/tmp", { recursive: true });
const project = spaceCompilerFixture();
const json = JSON.stringify(project);
writeFileSync(target, json);
console.log(JSON.stringify({
  target,
  canonical: project.spatialAuthoring !== undefined,
  startMapId: project.startMapId,
  bytes: json.length,
}));
