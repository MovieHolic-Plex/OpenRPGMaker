import fs from "node:fs";
import { deserialize, serialize } from "../src/project/io";
import { registerInteriorLifeCatalog } from "./lib/interiorLifeCatalog.mts";
const p = registerInteriorLifeCatalog(
  deserialize(
    fs.readFileSync("output/evidence/interior-life/before.json", "utf8"),
  ),
);
fs.writeFileSync("output/evidence/interior-life/candidate.json", serialize(p));
console.log("built");
