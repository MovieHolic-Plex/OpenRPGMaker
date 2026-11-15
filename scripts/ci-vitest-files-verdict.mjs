#!/usr/bin/env node
// scripts/ci-vitest-files-verdict.mjs — ci-vitest-files 의 «결과» 스텝이 부른다. 끝줄 넷을 표준 출력에 찍는다:
//   NEW-FAIL: … / KNOWN-FAIL: … / NOW-PASSING(기준선에서 뺄 것): … / VERDICT: CLEAN | NEW-FAIL n files | UNKNOWN (까닭)
// 판정은 scripts/lib/vitestFilesVerdict.mjs 에 있다(왜 필요한지도 거기). 이 파일은 읽어 오기만 한다.
//
//   node scripts/ci-vitest-files-verdict.mjs --outcome <success|failure|…> [--report <vitest json>] [--failed-list <파일>]
//        [--baseline .omo/gates-baseline.json] [-- <입력 files …>]
//   --failed-list  한 줄에 하나 — 워크플로가 로그에서 읽은 실패 파일(`RESULT:` 줄과 같은 목록). 리포트의 것과 합친다.
//   -- 뒤의 입력   리포트가 없을 때만 쓴다: 실제로 있는 파일인 것만 «돈 파일» 로 본다(필터·--shard 는 셀 수 없다).
// 늘 0 으로 끝난다 — 실행 결론은 이 스크립트가 정하지 않는다.
import { existsSync, readFileSync } from "node:fs";
import { readVitestReport, vitestFilesVerdict } from "./lib/vitestFilesVerdict.mjs";

const argv = process.argv.slice(2);
const split = argv.indexOf("--");
const options = split >= 0 ? argv.slice(0, split) : argv;
const inputs = split >= 0 ? argv.slice(split + 1) : [];
const option = (name) => { const index = options.indexOf(name); return index >= 0 ? options[index + 1] : undefined; };
const readJson = (file) => { try { return JSON.parse(readFileSync(file, "utf8")); } catch { return null; } };

const report = option("--report") ? readVitestReport(readJson(option("--report"))) : null;
let fromLog = [];
try { fromLog = readFileSync(option("--failed-list") ?? "", "utf8").split("\n").map((line) => line.trim()).filter(Boolean); } catch { /* 목록이 없다 */ }
const baseline = readJson(option("--baseline") ?? ".omo/gates-baseline.json");

// 리포트가 없으면 입력으로 가늠한다. 입력에 파일이 아닌 것(필터·--shard)이 하나라도 있으면 무엇이 돌았는지 모른다.
const inputFiles = inputs.filter((file) => !file.startsWith("-") && existsSync(file));
const { lines } = vitestFilesVerdict({
  outcome: option("--outcome") ?? "",
  failedFiles: [...(report?.failed ?? []), ...fromLog],
  ranFiles: report ? report.ran : inputFiles.length === inputs.length ? inputFiles : null,
  baselineTests: baseline && typeof baseline === "object" ? baseline.tests ?? null : null,
});
console.log(lines.join("\n"));
