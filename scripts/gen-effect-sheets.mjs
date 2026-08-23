// 전투 이펙트 시트 생성기.
//
//   node scripts/gen-effect-sheets.mjs                 # 전부 렌더 후 public/ 에 기록
//   node scripts/gen-effect-sheets.mjs --only=fire-burst,heal-bloom
//   node scripts/gen-effect-sheets.mjs --check         # 커밋된 PNG 와 바이트 비교(드리프트 검사)
//
// 카탈로그는 src/assets/generatedEffectSheets.json 이고 런타임 등록도 같은 파일을 읽는다.
// 새 이펙트: 카탈로그에 항목 추가 → render.mjs 의 PAINTERS 에 페인터 등록 → 이 스크립트 실행.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  effectSheetOutputPath,
  loadEffectCatalog,
  OUTPUT_DIR,
  renderEffectSheetPng,
  REPO_ROOT,
} from "./lib/effectSheet/render.mjs";

function arg(name) {
  const hit = process.argv.find((value) => value.startsWith(`--${name}=`));
  return hit === undefined ? null : hit.slice(name.length + 3);
}

const checkOnly = process.argv.includes("--check");
const only = arg("only");
const catalog = loadEffectCatalog();
const wanted = only === null ? null : new Set(only.split(",").map((value) => value.trim()));
const targets = catalog.effects.filter((effect) => wanted === null || wanted.has(effect.slug));

if (targets.length === 0) {
  console.error(`대상이 없다. --only 값을 확인하라: ${only}`);
  process.exit(1);
}

if (!checkOnly) mkdirSync(OUTPUT_DIR, { recursive: true });

let drift = 0;
for (const effect of targets) {
  const bytes = renderEffectSheetPng(effect.slug, catalog);
  const outputPath = effectSheetOutputPath(effect.slug);
  const relative = path.relative(REPO_ROOT, outputPath).replaceAll("\\", "/");
  if (checkOnly) {
    if (!existsSync(outputPath)) {
      console.error(`MISSING ${relative}`);
      drift += 1;
      continue;
    }
    if (!readFileSync(outputPath).equals(bytes)) {
      console.error(`DRIFT   ${relative}`);
      drift += 1;
      continue;
    }
    console.log(`OK      ${relative}`);
    continue;
  }
  writeFileSync(outputPath, bytes);
  console.log(`WROTE   ${relative} (${bytes.length} bytes) — ${effect.name}`);
}

if (checkOnly && drift > 0) {
  console.error(`${drift}건이 커밋된 시트와 다르다. node scripts/gen-effect-sheets.mjs 로 재생성하라.`);
  process.exit(1);
}
