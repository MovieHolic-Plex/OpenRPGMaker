// 재관찰 진단 — 호출별 출력 토큰이 상한(16000)에 닿는지, 파싱이 되는지.
import fs from "node:fs";
const since = new Date(process.argv[2] ?? "2026-11-07T13:36:00Z").getTime();
const rows = fs.readFileSync("/root/qa-pipeline/runs/fs139-broad/usage.jsonl", "utf8").split("\n").filter(Boolean).map((line) => JSON.parse(line))
  .filter((row) => new Date(row.at).getTime() > since);
const capped = rows.filter((row) => (row.out ?? 0) >= 15900);
const obs = fs.readFileSync("/root/qa-pipeline/runs/fs139-broad/observations-retry.jsonl", "utf8").split("\n").filter(Boolean).map((line) => JSON.parse(line));
console.log(JSON.stringify({
  retryCalls: rows.length,
  outputCapped: capped.length,
  outputUnder: rows.length - capped.length,
  parsed: obs.filter((row) => row.ok).length,
  failed: obs.filter((row) => !row.ok).length,
  medianOut: rows.length ? rows.map((r) => r.out).sort((a, b) => a - b)[rows.length >> 1] : null,
}, null, 1));
