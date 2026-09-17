// Bakes the tree-chop runtime QA fixture from the ORDINARY authorable starter.
// Provenance matters: the fixture is whatever createFarmingDemoProject() authors, so
// the scenario proves the shipped starter path rather than a hand-written project.
//
//   npx vite-node --script scripts/qa/runtime/life-tree-chop-fixture.mts
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createFarmingDemoProject } from "@/project/defaults/defaultProject";
import { serialize } from "@/project/io";
import { validateProjectReferences } from "@/project/io/references";

const project = createFarmingDemoProject();
validateProjectReferences(project);

const trees = Object.values(project.session.placeables ?? {}).filter((object) => object.kind === "tree");
if (trees.length === 0) throw new Error("starter authored no tree — fixture would prove nothing");

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, "../../../test/fixtures/life-tree-chop.project.json");
writeFileSync(out, `${serialize(project)}\n`, "utf8");
console.log(`wrote ${out} with ${trees.length} tree(s) at ${trees.map((t) => `${t.x},${t.y}`).join(" ")}`);
