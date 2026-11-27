// 빈 새 프로젝트의 «정규화한 새 번들 타일셋» 저장 보기를 굽는다(src/project/defaults/freshStarter.ts 머리말).
// 굽기:  node_modules/.bin/vite-node --script scripts/content/bake-fresh-bundled-tileset-views.mts
// 검사:  node_modules/.bin/vite-node --script scripts/content/bake-fresh-bundled-tileset-views.mts --check
//   커밋된 표가 지금 정의·정규화기 결과와 다르면 exit 1 — ci-fast 가 돈다. 낡은 표로 만든 새 프로젝트는 정규화기를 건너뛰므로
//   옛 칸 표가 그대로 남는다. 번들 타일셋 정의나 그 정규화기를 바꾸면 다시 굽는다.
import { readFileSync, writeFileSync } from "node:fs";
import { createStarterBlankProject } from "@/project/defaults";
import { ensureBundledTilesets, removeLegacySpriteReferences } from "@/project/defaults/defaultAssets";
import { externalizeBundledReferenceImages } from "@/project/bundledReferenceImages";
import { ensureSharedTileReferences } from "@/project/sharedTileReferences";
import { serialize } from "@/project/io/serialize";

const FILE = "src/assets/bundledTilesetFreshViews.json";
const project = createStarterBlankProject();
// store.normalizeCurrentProject 가 타일셋에 돌리는 정규화기, 같은 순서.
ensureBundledTilesets(project);
ensureSharedTileReferences(project);
externalizeBundledReferenceImages(project);
removeLegacySpriteReferences(project);
const views = (JSON.parse(serialize(project)) as { tilesets: Record<string, Record<string, unknown>> }).tilesets;
const notDiff = Object.keys(views).filter((id) => !Object.hasOwn(views[id]!, "bundledTilesetDiff"));
if (notDiff.length > 0) {
  console.error(`::error title=새 번들 타일셋 보기::번들 차이로 줄지 않는 타일셋 ${notDiff.join(", ")} — 새 프로젝트를 지연 타일셋으로 만들 수 없다.`);
  process.exit(1);
}
const text = `${JSON.stringify(views)}\n`;
if (process.argv.includes("--check")) {
  const committed = readFileSync(FILE, "utf8");
  if (committed !== text) {
    const old = JSON.parse(committed) as Record<string, unknown>;
    const stale = [...new Set([...Object.keys(views), ...Object.keys(old)])].filter((id) => JSON.stringify(views[id]) !== JSON.stringify(old[id]));
    console.error(`::error title=구운 새 번들 타일셋 보기가 낡았다::${stale.join(", ") || "키 순서"} — 다시 굽고 커밋한다: node_modules/.bin/vite-node --script scripts/content/bake-fresh-bundled-tileset-views.mts`);
    process.exit(1);
  }
  console.log(`구운 새 번들 타일셋 보기: ${Object.keys(views).length}개 모두 지금 정의·정규화기와 같다`);
} else {
  writeFileSync(FILE, text);
  console.log(`baked ${Object.keys(views).length} fresh bundled tileset views (${text.length} chars)`);
}
