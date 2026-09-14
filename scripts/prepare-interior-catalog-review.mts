import fs from "node:fs";
import { deserialize, serialize } from "../src/project/io";
import { registerReviewedInteriorCatalog } from "./lib/reviewedInteriorCatalog.mts";
const dir = "output/evidence/interior-catalog-review";
const project = registerReviewedInteriorCatalog(
  deserialize(fs.readFileSync(`${dir}/raw-before.json`, "utf8")),
);
fs.writeFileSync(`${dir}/candidate.json`, serialize(project));
