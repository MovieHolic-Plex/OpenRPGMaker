// 번들 타일셋 정의의 내용 요약을 굽는다(src/project/bundledTilesetDigests.ts 머리말).
// 굽기:  node_modules/.bin/vite-node --script scripts/content/bake-bundled-tileset-digests.mts
// 검사:  node_modules/.bin/vite-node --script scripts/content/bake-bundled-tileset-digests.mts --check
//   커밋된 표가 지금 정의와 다르면 exit 1 — ci-fast 의 fast-static 이 돈다(낡은 굽기는 조수 적용을 «기준 프로젝트가 변경되었습니다»로 막았다,
//   ci-full 45844823105). 관련 시험 선택(import 그래프 상한)에 기대지 않는다.
import { readFileSync, writeFileSync } from "node:fs";
import { BUNDLED_EASYRPG_CHIPSET_ASSETS } from "@/assets/bundled";
import { DEFAULT_TILESET_ID } from "@/project/defaults/constants";
import { bundledTilesetById, bundledTilesetIdForAssetForTest } from "@/project/defaults/defaultAssets";
import { jsonContentDigest } from "@/project/persistence/core/contentDigest";

const FILE = "src/assets/bundledTilesetDigests.json";
const ids = [...new Set([DEFAULT_TILESET_ID, ...BUNDLED_EASYRPG_CHIPSET_ASSETS.map(bundledTilesetIdForAssetForTest)])].sort();
const out: Record<string, { digest: string; count: number }> = {};
for (const id of ids) {
  const definition = bundledTilesetById(id);
  if (!definition) continue;
  out[id] = { digest: jsonContentDigest(definition)!, count: definition.count };
}
const text = `${JSON.stringify(out, null, 2)}\n`;
if (process.argv.includes("--check")) {
  const committed = JSON.parse(readFileSync(FILE, "utf8")) as Record<string, { digest: string; count: number }>;
  const stale = [...new Set([...Object.keys(out), ...Object.keys(committed)])].filter((id) => JSON.stringify(out[id]) !== JSON.stringify(committed[id]));
  if (stale.length > 0) {
    console.error(`::error title=구운 타일셋 요약이 낡았다::${stale.join(", ")} — 번들 타일셋 정의가 바뀌었다. 다시 굽고 커밋한다: node_modules/.bin/vite-node --script scripts/content/bake-bundled-tileset-digests.mts`);
    process.exit(1);
  }
  console.log(`구운 타일셋 요약: ${Object.keys(out).length}개 모두 지금 정의와 같다`);
} else {
  writeFileSync(FILE, text);
  console.log(`baked ${Object.keys(out).length} bundled tileset digests`);
}
