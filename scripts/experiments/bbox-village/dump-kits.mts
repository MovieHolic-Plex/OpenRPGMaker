// dump beodeul_city kits (id, name, w, h, entrance, tags) → JSON
import { writeFileSync } from "node:fs";
import { ensureBundledTilesets } from "../../../src/project/defaults/defaultAssets.ts";
import { createBlankProject } from "../../../src/project/defaults.ts";
const p = createBlankProject() as any; ensureBundledTilesets(p);
const ts = p.tilesets.beodeul_city;
const out = (ts.structureKits ?? []).map((k: any) => ({ id: k.id, name: k.name, w: k.width, h: k.height, tags: k.tags, door: (k.parts ?? []).find((q: any) => q.kind === "entrance") ?? null }));
writeFileSync(process.argv[2]!, JSON.stringify(out));
console.log(out.length);
