// 관찰 결과 요약 — 파싱 성공률과 점검 항목 분포.
import fs from "node:fs";
const file = process.argv[2] ?? "/root/qa-pipeline/runs/fs139-broad/observations.jsonl";
const rows = fs.readFileSync(file, "utf8").split("\n").filter(Boolean).map((line) => JSON.parse(line));
const ok = rows.filter((row) => row.ok);
const by = {};
for (const row of ok) for (const issue of row.issues) by[issue.check] = (by[issue.check] ?? 0) + 1;
console.log(JSON.stringify({
  rows: rows.length,
  ok: ok.length,
  parseRate: Number(((ok.length / rows.length) * 100).toFixed(1)),
  unparsed: rows.filter((row) => row.error === "unparsed").length,
  failed: rows.filter((row) => row.error && row.error !== "unparsed").length,
  issues: ok.reduce((sum, row) => sum + row.issues.length, 0),
  byCheck: by,
}, null, 1));
