// 관찰 실패(파싱 불가) 프레임만 다시 관찰한다. 성공한 행은 그대로 두고, 새 성공 행을 이어 붙인다.
//   node observe-retry.mjs <runDir> [--pool N]
// 왜: deepseek 이 도구 호출 봉투로 답한 프레임은 조용히 버려져 VQA 트랙 절반이 사라졌다(2026-11-07 실측 55%만 파싱).
// 고친 프롬프트(도구 금지 + 재시도)로 그 프레임만 다시 묻는다.
import fs from "node:fs";
import path from "node:path";

const RUN = process.argv[2];
if (!RUN) throw new Error("usage: observe-retry.mjs <runDir> [--pool N]");
const poolIndex = process.argv.indexOf("--pool");
const POOL = poolIndex > 0 ? Number(process.argv[poolIndex + 1]) : 24;

const observationsFile = path.join(RUN, "observations.jsonl");
const rows = fs.readFileSync(observationsFile, "utf8").split("\n").filter(Boolean).map((line) => JSON.parse(line));
const failedKeys = new Set(rows.filter((row) => !row.ok).map((row) => row.key));
const allFrames = JSON.parse(fs.readFileSync(path.join(RUN, "observe-frames.json"), "utf8"));
const retry = allFrames.filter((frame) => failedKeys.has(`${frame.jobId}/${frame.seq}`));
fs.writeFileSync(path.join(RUN, "observe-frames-retry.json"), JSON.stringify(retry, null, 1));
console.log(JSON.stringify({ observed: rows.length, failed: failedKeys.size, retryFrames: retry.length, pool: POOL }));
