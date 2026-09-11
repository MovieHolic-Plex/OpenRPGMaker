// 카탈로그 HTML 을 그림 base64 인라인 단일 파일로 굽는다 — 파일 하나만 있으면 열린다.
// 사용: npx tsx scripts/inline-house-catalog-html.mts
import fs from "node:fs";
import path from "node:path";

const DIR = path.resolve("output/evidence/house-full-catalog");
const src = fs.readFileSync(path.join(DIR, "catalog.html"), "utf8");

let inlined = 0;
const out = src.replace(/src="([a-z0-9-]+\.png)"/g, (_match, file: string) => {
  const buffer = fs.readFileSync(path.join(DIR, file));
  inlined += 1;
  return `src="data:image/png;base64,${buffer.toString("base64")}"`;
});

const target = path.join(DIR, "house-catalog-standalone.html");
fs.writeFileSync(target, out);
console.log(`inlined ${inlined} images ->`, target, `${(out.length / 1024 / 1024).toFixed(1)}MB`);
