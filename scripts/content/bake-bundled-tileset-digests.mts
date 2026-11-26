// 번들 타일셋 정의의 내용 요약을 굽는다(src/project/bundledTilesetDigests.ts 머리말).
// 실행: node_modules/.bin/vite-node --script scripts/content/bake-bundled-tileset-digests.mts
import { writeFileSync } from "node:fs";
import { createBlankProject } from "@/project/defaults";
import { bundledTilesetById } from "@/project/defaults/defaultAssets";
import { jsonContentDigest } from "@/project/persistence/core/contentDigest";

const out: Record<string, { digest: string; count: number }> = {};
for (const id of Object.keys(createBlankProject().tilesets).sort()) {
  const definition = bundledTilesetById(id);
  if (!definition) continue;
  out[id] = { digest: jsonContentDigest(definition)!, count: definition.count };
}
writeFileSync("src/assets/bundledTilesetDigests.json", `${JSON.stringify(out, null, 2)}\n`);
console.log(`baked ${Object.keys(out).length} bundled tileset digests`);
