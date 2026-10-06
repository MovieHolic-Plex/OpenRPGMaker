#!/usr/bin/env node
// tsc 는 공용 모듈의 type import 를 따라 편집기 전체까지 읽는다. 편집기 쪽 오류는 루트 typecheck:app 몫이므로
// 이 패키지(src/·test/)의 오류만 보고 그것으로 종료 코드를 정한다.
import { spawnSync } from "node:child_process";
const run = spawnSync(process.execPath, ["node_modules/typescript/bin/tsc", "-p", "tsconfig.json"], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
const own = (run.stdout + run.stderr).split("\n").filter((line) => /^(src|test|scripts)\//.test(line));
for (const line of own) console.log(line);
console.log(`[store typecheck] 이 패키지 오류 ${own.length}건`);
process.exit(own.length > 0 ? 1 : 0);
