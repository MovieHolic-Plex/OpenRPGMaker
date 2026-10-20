#!/usr/bin/env node
// jp_city 칸 번호 핀(tiledata/jp-city/pins.json)은 덧붙이기 전용이다: 기준 커밋에 있던 자리 키는 같은 번호로 남아야 한다.
// 2026-10-14~18 에 낡은 pins.json 으로 구운 PR 들이 머지되며 번호가 밀려(#2899 에서 11,329칸) 게시한 장소·사용자 맵이 엉뚱한 칸을 그렸다.
//   node scripts/content/jp-city/check-pins.mjs [--base <rev>]   (기본 HEAD~1 — ci-fast 가 main 푸시마다 부른다)
import { execFileSync } from "node:child_process";
import fs from "node:fs";
const i = process.argv.indexOf("--base");
const base = i > 0 ? process.argv[i + 1] : "HEAD~1";
const PATH = "tiledata/jp-city/pins.json";
let old;
try { old = JSON.parse(execFileSync("git", ["show", `${base}:${PATH}`], { encoding: "utf8", maxBuffer: 1 << 30 })).cells; }
catch { console.log(`기준 ${base} 에 ${PATH} 가 없다 — 건너뜀`); process.exit(0); }
const now = JSON.parse(fs.readFileSync(PATH, "utf8")).cells;
const owner = new Map(Object.entries(now).map(([k, v]) => [v, k]));
const bad = [];
for (const [k, v] of Object.entries(old)) {
  if (now[k] !== v) bad.push(`${k}: ${v} → ${now[k] ?? "없음"}`);
  else if (owner.get(v) !== k) bad.push(`${v}번: ${k} → ${owner.get(v)}`);
}
if (bad.length) {
  console.error(`jp_city 칸 번호가 밀렸다 (${bad.length}개, 기준 ${base}). 낡은 pins.json 으로 구운 것이다 — origin/main 에 rebase 하고 pins.json 을 origin/main 것으로 둔 뒤 다시 구워라.`);
  for (const b of bad.slice(0, 20)) console.error("  " + b);
  process.exit(1);
}
console.log(`jp_city 핀 불변: 기준 ${base} 의 ${Object.keys(old).length}칸 그대로, 새 칸 ${Object.keys(now).length - Object.keys(old).length}개`);
