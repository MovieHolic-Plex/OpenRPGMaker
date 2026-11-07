// 관찰 처리율 계산기(VM 에서 실행) — recent-call rate + remaining ETA.
import fs from "node:fs";
const RUN = process.argv[2] ?? "/root/qa-pipeline/runs/fs139-broad";
const rows = fs.readFileSync(`${RUN}/usage.jsonl`, "utf8").split("\n").filter(Boolean).map((line) => JSON.parse(line));
const now = Date.now();
const recent = rows.filter((row) => now - new Date(row.at).getTime() < 600000);
const perMin = recent.length / 10;
const done = fs.readFileSync(`${RUN}/observations.jsonl`, "utf8").split("\n").filter(Boolean).length;
const total = 812;
const ms = recent.map((row) => row.ms).sort((a, b) => a - b);
console.log(JSON.stringify({
  calls: rows.length,
  failed: rows.filter((row) => !row.ok).length,
  last10minCalls: recent.length,
  callsPerMin: Number(perMin.toFixed(1)),
  p50ms: ms.length ? ms[ms.length >> 1] : null,
  maxms: ms.length ? ms[ms.length - 1] : null,
  observed: done,
  remaining: Math.max(0, total - done),
  etaMin: perMin > 0 ? Math.round((total - done) / perMin) : null,
}));
