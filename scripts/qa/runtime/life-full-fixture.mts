// Bakes the task17 life-full fixture to JSON for the task18 runtime QA scenario.
//   npx vite-node --script scripts/qa/runtime/life-full-fixture.mts
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { serialize } from "@/project/io";
import { validateProjectReferences } from "@/project/io/references";
import { createLifeFullFixture } from "../../../test/fixtures/life-full/lifeFullProject";

const project = createLifeFullFixture();
validateProjectReferences(project);
const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, "../../../test/fixtures/life-full.project.json");
writeFileSync(out, `${serialize(project)}\n`, "utf8");
const trees = Object.values(project.session.placeables ?? {}).filter((o) => o.kind === "tree");
console.log(`wrote ${out}; trees=${trees.length}; crops=${(project.database.crops ?? []).length}; startPos=${project.startPos.x},${project.startPos.y}`);
