#!/usr/bin/env node
// scripts/app-version.mjs
// 지금 트리의 빌드 라벨을 출력한다 — 릴리스 노트·아티팩트 이름·CI 가 쓴다.
//
//   node scripts/app-version.mjs           0.1.0-dev.184+gddc7a88
//   node scripts/app-version.mjs --json    전체 메타
//
// 브라우저가 보는 값과 **같은 계산**이다(scripts/lib/appVersion.mjs) — 다르면 버그 리포트의
// 버전과 빌드의 버전이 갈라진다.

import { readAppVersion } from "./lib/appVersion.mjs";

const args = process.argv.slice(2);
if (args.includes("--help") || args.includes("-h")) {
  console.log("사용: node scripts/app-version.mjs [--json]");
  process.exit(0);
}

const info = readAppVersion(process.cwd());
if (args.includes("--json")) {
  console.log(JSON.stringify(info, null, 2));
} else {
  console.log(info.label);
}