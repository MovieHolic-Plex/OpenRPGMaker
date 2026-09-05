// 정수리 이모트 시트 생성기.
//
//   node scripts/gen-emote-sheet.mjs           # public/assets/generated-emotes.png 기록
//   node scripts/gen-emote-sheet.mjs --check   # 커밋된 PNG 와 바이트 비교(드리프트 검사)
//
// 그림은 scripts/lib/emoteSheet/render.mjs 가 코드로 그린다. 이모트 어휘의 단일 소스는
// src/project/emotes.ts 의 EMOTE_KINDS 이고, 목록 ↔ 페인터 대조는 test/emoteSheet.test.ts 가 한다.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { EMOTE_SLUGS, paintedEmoteSlugs, renderEmoteSheetPng } from "./lib/emoteSheet/render.mjs";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUTPUT_PATH = path.join(REPO_ROOT, "public", "assets", "generated-emotes.png");
const checkOnly = process.argv.includes("--check");

const painted = paintedEmoteSlugs();
const missing = EMOTE_SLUGS.filter((slug) => !painted.includes(slug));
if (missing.length > 0) {
  console.error(`페인터가 없는 이모트: ${missing.join(", ")}`);
  process.exit(1);
}

const bytes = renderEmoteSheetPng();
const relative = path.relative(REPO_ROOT, OUTPUT_PATH).replaceAll("\\", "/");

if (checkOnly) {
  if (!existsSync(OUTPUT_PATH)) {
    console.error(`MISSING ${relative} — node scripts/gen-emote-sheet.mjs 를 실행하라.`);
    process.exit(1);
  }
  if (!readFileSync(OUTPUT_PATH).equals(bytes)) {
    console.error(`DRIFT ${relative} — 페인터와 커밋된 PNG 가 다르다.`);
    process.exit(1);
  }
  console.log(`OK ${relative} (${EMOTE_SLUGS.length}종)`);
  process.exit(0);
}

mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
writeFileSync(OUTPUT_PATH, bytes);
console.log(`WROTE ${relative} (${EMOTE_SLUGS.length}종, ${bytes.length}바이트)`);
