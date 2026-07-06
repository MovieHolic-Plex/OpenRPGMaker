#!/usr/bin/env node
// scripts/generateToolCatalog.mjs
// 툴 카탈로그 문서(docs/tool-catalog.md)를 레지스트리에서 재생성한다.
// TS/경로 별칭(@/*)은 vitest 러너로 해석하므로, 재생성은 vitest 경유로 수행한다.
//   node scripts/generateToolCatalog.mjs
// 내부적으로 UPDATE_CATALOG=1 로 test/toolCatalog.test.ts를 실행해 파일을 기록한다.

import { spawnSync } from "node:child_process";

const result = spawnSync(
  "npx",
  ["vitest", "run", "test/toolCatalog.test.ts"],
  { stdio: "inherit", env: { ...process.env, UPDATE_CATALOG: "1" } }
);
process.exit(result.status ?? 1);
