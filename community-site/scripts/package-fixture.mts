import { readFile, writeFile } from "node:fs/promises";
import { deserialize, serializePretty } from "@/project/io";
import { createProjectPackage } from "@/project/package";

const [fixture, out] = [process.argv[2], process.argv[3]];
const project = deserialize(await readFile(fixture, "utf8"));
const blob = createProjectPackage(project);
await writeFile(out, Buffer.from(await blob.arrayBuffer()));
console.log("packaged:", project.meta.title, "maps:", Object.keys(project.maps).length, "uploaded:", Object.keys(project.assets.uploaded).length);
