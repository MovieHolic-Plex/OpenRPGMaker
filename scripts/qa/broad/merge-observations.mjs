// 관찰 결과 병합 — 원 관찰 + 재관찰에서 성공한 행만 남긴다(같은 key 는 성공한 쪽이 이긴다).
//   node merge-observations.mjs <runDir>
import fs from "node:fs";
import path from "node:path";

const RUN = process.argv[2];
if (!RUN) throw new Error("usage: merge-observations.mjs <runDir>");
const read = (file) => (fs.existsSync(file) ? fs.readFileSync(file, "utf8").split("\n").filter(Boolean).map((line) => JSON.parse(line)) : []);
const first = read(path.join(RUN, "observations.jsonl"));
const retry = read(path.join(RUN, "observations-retry.jsonl"));
const byKey = new Map();
for (const row of first) byKey.set(row.key, row);
for (const row of retry) if (row.ok) byKey.set(row.key, row);
const merged = [...byKey.values()];
fs.writeFileSync(path.join(RUN, "observations.jsonl"), `${merged.map((row) => JSON.stringify(row)).join("\n")}\n`);
console.log(JSON.stringify({
  first: first.length,
  retry: retry.length,
  retryParsed: retry.filter((row) => row.ok).length,
  merged: merged.length,
  parsed: merged.filter((row) => row.ok).length,
  parseRate: Number(((merged.filter((row) => row.ok).length / merged.length) * 100).toFixed(1)),
  issues: merged.filter((row) => row.ok).reduce((sum, row) => sum + row.issues.length, 0),
}, null, 1));
