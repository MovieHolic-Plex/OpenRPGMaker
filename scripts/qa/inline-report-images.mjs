#!/usr/bin/env node
// 보고서 HTML 의 상대 경로 그림을 data URI 로 넣어, 파일 하나만으로 바깥에서 열리게 한다.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "../..");
const REPORT = process.argv[2]
  ?? join(ROOT, "docs/proposals/2026-09-02-concept-studio-report.html");

const htmlPath = resolve(REPORT);
const html = readFileSync(htmlPath, "utf8");
const dir = dirname(htmlPath);
const mime = new Map([
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".gif", "image/gif"],
  [".webp", "image/webp"],
  [".svg", "image/svg+xml"],
]);

let inlined = 0;
const next = html.replace(
  /\bsrc="((?:assets|\.\/assets)\/[^"]+\.(?:png|jpe?g|gif|webp|svg))"/g,
  (_all, rel) => {
    const file = join(dir, rel);
    const ext = rel.slice(rel.lastIndexOf(".")).toLowerCase();
    const type = mime.get(ext);
    if (!type) throw new Error(`unknown image type: ${rel}`);
    const data = readFileSync(file).toString("base64");
    inlined += 1;
    return `src="data:${type};base64,${data}"`;
  },
);

if (inlined === 0) {
  if (/src="data:image\//.test(html)) {
    console.log(`already inlined -> ${htmlPath}`);
    process.exit(0);
  }
  throw new Error(`no relative image src found in ${htmlPath}`);
}

writeFileSync(htmlPath, next);
console.log(`inlined ${inlined} images -> ${htmlPath} (${(next.length / 1024).toFixed(0)} KB)`);
