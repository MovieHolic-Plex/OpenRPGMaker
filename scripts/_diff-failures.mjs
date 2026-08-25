// 임시 도구: baseline(HEAD) 대비 현재 실패 테스트 파일 차집합.
// HEAD 자체가 82파일 빨강이라 절대 개수는 의미가 없다 — 차집합만 본다.
import { readFileSync, writeFileSync } from "node:fs";

const norm = (name) => name.replace(/\\/g, "/").replace(/^.*?\/(test|src)\//, "$1/");

function failedFiles(jsonPath) {
  const report = JSON.parse(readFileSync(jsonPath, "utf8"));
  return new Set(
    report.testResults.filter((entry) => entry.status === "failed").map((entry) => norm(entry.name)),
  );
}

const before = failedFiles(process.argv[2]);
const after = failedFiles(process.argv[3]);

const newlyFailing = [...after].filter((file) => !before.has(file)).sort();
const nowFixed = [...before].filter((file) => !after.has(file)).sort();

console.log(`baseline 실패: ${before.size}파일 · 현재 실패: ${after.size}파일`);
console.log(`\n신규 실패(내 변경이 깬 것) ${newlyFailing.length}건:`);
for (const file of newlyFailing) console.log(`  ✗ ${file}`);
console.log(`\n베이스라인에 있었는데 지금 통과 ${nowFixed.length}건:`);
for (const file of nowFixed.slice(0, 20)) console.log(`  ✓ ${file}`);

writeFileSync("/tmp/newly-failing.txt", newlyFailing.join("\n"), "utf8");
if (newlyFailing.length > 0) process.exitCode = 1;
