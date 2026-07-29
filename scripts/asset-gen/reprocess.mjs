// .omo/asset-gen-tmp 에 보관한 원본(JPEG)에서 스프라이트를 다시 만든다.
// 후처리 규칙을 고쳤을 때 **재생성(쿼터 소모) 없이** 전부 갱신하는 용도.
//
// 사용: node scripts/asset-gen/reprocess.mjs [--kind=item|monster]
import { existsSync, mkdirSync } from "node:fs";
import { resolve, join } from "node:path";
import { TARGETS } from "./manifest.mjs";
import { processSprite } from "./spriteProcess.mjs";

const TMP = ".omo/asset-gen-tmp";

function arg(name, fallback) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
}

const only = arg("kind");
const kinds = only ? [only] : Object.keys(TARGETS);
let ok = 0;
const failed = [];

for (const kind of kinds) {
  const target = TARGETS[kind];
  if (!target) {
    console.error(`알 수 없는 kind: ${kind}`);
    process.exit(2);
  }
  mkdirSync(target.outDir, { recursive: true });
  for (const entry of target.entries) {
    const raw = join(TMP, `${kind}-${entry.slug}.jpg`);
    if (!existsSync(raw)) continue;
    const out = resolve(target.outDir, target.fileName(entry.slug));
    try {
      await processSprite(raw, out, target.size);
      ok += 1;
    } catch (error) {
      failed.push(`${kind}/${entry.slug}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

console.log(`[reprocess] 성공 ${ok}, 실패 ${failed.length}`);
for (const line of failed) console.log(`  - ${line}`);
