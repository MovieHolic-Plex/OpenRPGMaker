// 버들항 킷 목록(id · 크기) — build.py 가 종류 표의 킷 id 를 맞춰 볼 때 읽는다.
import { createBlankProject } from "../../../src/project/defaults.ts";
import { ensureBundledTilesets } from "../../../src/project/defaults/defaultAssets.ts";
const p = createBlankProject(); ensureBundledTilesets(p);
for (const k of p.tilesets["beodeul_city"]!.structureKits ?? []) console.log(`${k.id}\t${k.width}x${k.height}`);
