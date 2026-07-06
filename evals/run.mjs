#!/usr/bin/env node
// evals/run.mjs
// 골든 태스크 evals 러너. .env.local의 OPENROUTER_API_KEY(및 BASE_URL/MODEL)를 로드해
// 실제 LLM(google/gemini-3.1-flash-lite)로 상위 N개 태스크를 구동·채점한다.
// 기존 소스(src/ai/assistantSession, src/evals) 재사용 — 채점 로직만 evals/에 둔다.
//
//   node evals/run.mjs            # 상위 4개 태스크(기본)
//   node evals/run.mjs 10         # 상위 10개(비용 주의: 1회만 권장)
//
// 결과: evals/results/<timestamp>.json + 콘솔 요약. 키/응답 원문은 저장하지 않는다.

import { spawnSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";

// .env.local을 process.env로 로드(dotenv 의존성 없이 최소 파서).
function loadEnvLocal() {
  const path = ".env.local";
  if (!existsSync(path)) return;
  for (const rawLine of readFileSync(path, "utf8").split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnvLocal();

const taskCount = process.argv[2] ?? process.env.EVAL_TASKS ?? "4";

if (!process.env.OPENROUTER_API_KEY) {
  console.error("[evals] OPENROUTER_API_KEY가 없습니다(.env.local 확인). 스위트를 건너뜁니다.");
  process.exit(0);
}

const result = spawnSync(
  "npx",
  ["vitest", "run", "--config", "evals/vitest.config.mjs"],
  { stdio: "inherit", env: { ...process.env, EVAL_TASKS: String(taskCount) } }
);
process.exit(result.status ?? 1);
