// CSS 번들 **엔트리**의 단일 정의. check-css-graph / check-css-winners 가 공유한다.
//
// 엔트리는 하드코딩하지 않고 `src/**/*.ts` 의 `import "….css"` 로 발견한다 — 엔트리가
// 늘거나 옮겨져도 게이트가 따라가야 하기 때문이다. 스캔이 0건이면 폴백을 쓴다.
//
// 왜 공유 모듈인가: 두 게이트가 각자 엔트리 목록을 들고 있으면 한쪽에만 새 번들이 생겨도
// 아무도 모른다. `@import` 파서를 하나로 합친 것과 같은 이유다(scripts/lib/css-import-re.mjs).
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

// TS 가 붙이는 CSS 엔트리. 부수효과 import 만 본다 — `import x from "./a.css"` 는 CSS 모듈이라 다른 얘기다.
export const TS_CSS_IMPORT_RE = /(?:^|\n)\s*import\s+(?:"([^"]+\.css)"|'([^']+\.css)')\s*;?/g;

// 스캔이 0건일 때만 쓰는 폴백. 각 줄의 주석은 실제로 이 시트를 붙이는 TS 파일이다.
export const FALLBACK_ENTRIES = [
  "src/styles/index.css", // src/main.ts
  "src/styles/event/index.css", // src/editor/panels/eventEditor/modal.ts
  "src/styles/database/index.css", // src/editor/panels/databaseModal.ts
  "src/player/player.css", // src/player/exportEntry.ts
];

export function walk(dir, filter, files = []) {
  if (!existsSync(dir)) return files;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, filter, files);
    else if (filter(full)) files.push(full);
  }
  return files;
}

// `@/x` 는 src 별칭. 원격 URL 은 그래프 밖이라 null. 확장자가 없으면 .css 를 붙인다.
export function resolveSpecifier(spec, fromFile, srcDir) {
  const clean = spec.split("?")[0].split("#")[0].trim();
  if (!clean) return null;
  if (/^[a-z]+:\/\//i.test(clean)) return null;
  const abs = clean.startsWith("@/") ? join(srcDir, clean.slice(2)) : resolve(dirname(fromFile), clean);
  return abs.endsWith(".css") ? abs : `${abs}.css`;
}

// → { entries: Map<절대경로, 들여온 TS 파일 상대경로[]>, discovery: "scan" | "fallback" }
export function discoverEntries(root) {
  const srcDir = join(root, "src");
  const toRel = (abs) => relative(root, abs).split("\\").join("/");
  const entries = new Map();
  for (const ts of walk(srcDir, (f) => /\.(ts|tsx|mts)$/.test(f))) {
    const source = readFileSync(ts, "utf8");
    for (const match of source.matchAll(TS_CSS_IMPORT_RE)) {
      const target = resolveSpecifier(match[1] ?? match[2], ts, srcDir);
      if (!target || !existsSync(target)) continue;
      if (!entries.has(target)) entries.set(target, []);
      entries.get(target).push(toRel(ts));
    }
  }
  if (entries.size > 0) return { entries, discovery: "scan" };
  for (const rel of FALLBACK_ENTRIES) {
    const abs = join(root, rel);
    if (existsSync(abs)) entries.set(abs, ["(fallback)"]);
  }
  return { entries, discovery: "fallback" };
}
