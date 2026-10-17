// perf-ai-lag 결과 두 개(전/후)를 표로 비교한다.  node scripts/qa/perf-ai-report.mjs <전 라벨> <후 라벨>
import { readFileSync } from "node:fs";
const [a, b] = process.argv.slice(2);
const load = (l) => JSON.parse(readFileSync(`verify-shots/perf-ai-lag/${l}.json`, "utf8"));
const A = load(a), B = load(b);
const row = (name, f) => { const x = f(A), y = f(B); return `| ${name} | ${x ?? "-"} | ${y ?? "-"} |`; };
const lines = [`| 지표 | ${a} | ${b} |`, "|---|---|---|"];
for (const sc of ["idle", "panel", "stream", "team"]) {
  const s = (R) => R.scenarios[sc];
  if (!s(A) || !s(B)) continue;
  const w = (R) => s(R).whole ?? s(R).idle;
  lines.push(row(`${sc} 프레임 gap p95 (ms)`, (R) => w(R)?.frames.gapP95));
  lines.push(row(`${sc} 프레임 gap 최대 (ms)`, (R) => w(R)?.frames.gapMax));
  lines.push(row(`${sc} 100ms 넘는 프레임 수`, (R) => w(R)?.frames.over100));
  lines.push(row(`${sc} Long Task 합/최대 (ms)`, (R) => `${w(R)?.longTask.totalMs}/${w(R)?.longTask.maxMs}`));
  if (s(A).acks) lines.push(row(`${sc} 체크포인트 ACK 중앙값 (ms)`, (R) => { const m = [...(s(R).acks?.ms ?? [])].sort((p, q) => p - q); return m[Math.floor(m.length / 2)]; }));
  for (const ph of ["paint", "pan", "zoom"]) lines.push(row(`${sc} ${ph} 입력 지연 p95/최대 (ms)`, (R) => { const p = s(R).phases?.[ph]; return p ? `${p.inputP95}/${p.inputMax}` : "-"; }));
  for (const ph of ["paint", "pan", "zoom"]) lines.push(row(`${sc} ${ph} Long Task 합 (ms)`, (R) => s(R).phases?.[ph]?.longSumMs));
}
console.log(lines.join("\n"));
