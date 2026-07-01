#!/usr/bin/env node
// capture-db-ui.mjs
// RM2003 Database UI 증거 수집 하네스 — 변경 후 브라우저에서 DB 탭 스크린샷을 캡처한다.
//
// 실행: node .omo/evidence/rm2003-database-plan/capture-db-ui.mjs
//
// Vite 파일 왓처가 .omo 디렉토리를 무시하도록(VITE_WATCH_GUARD) vite.config.ts의
// watch.ignored 패턴이 **/.omo/** 를 포함해야 한다. 이 하네스가 생성하는 산출물은
// 모두 .omo/ 아래에 놓이므로 개발 서버 재시작을 유발하지 않는다.

import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const OUTPUT_DIR = resolve(".omo/evidence/rm2003-database-plan/screenshots");

// 캡처 대상 — DB 모달의 각 탭을 열어 증거 이미지를 남긴다.
const CAPTURE_TARGETS = [
  { tab: "actors", screenshot: "post-db-actors.png" },
  { tab: "classes", screenshot: "post-db-classes.png" },
  { tab: "skills", screenshot: "post-db-skills.png" },
  { tab: "items", screenshot: "post-db-items.png" },
  { tab: "enemies", screenshot: "post-db-enemies.png" },
  { tab: "troops", screenshot: "post-db-troops.png" },
  { tab: "states", screenshot: "post-db-states.png" },
  { tab: "animations", screenshot: "post-db-animations.png" },
  { tab: "system", screenshot: "post-db-system.png" },
];

// 모바일 뷰포트 증거 — 좁은 화면에서 DB 탭이 깨지지 않는지 확인.
const MOBILE_TARGETS = [{ tab: "database-tabs", screenshot: "post-mobile-db-tabs.png" }];

function ensureDir(path) {
  mkdirSync(path, { recursive: true });
}

function writeManifest(targets) {
  const manifest = targets.map((target) => ({
    tab: target.tab,
    screenshot: target.screenshot,
    captured: false,
  }));
  writeFileSync(resolve(OUTPUT_DIR, "manifest.json"), JSON.stringify(manifest, null, 2));
}

function main() {
  // VITE_WATCH_GUARD: 이 스크립트의 산출물은 .omo/ 아래에 있으므로
  // vite.config.ts의 watch.ignored("**/.omo/**")에 의해 왓처에서 제외된다.
  ensureDir(OUTPUT_DIR);
  writeManifest([...CAPTURE_TARGETS, ...MOBILE_TARGETS]);
  console.log(`[capture-db-ui] ${CAPTURE_TARGETS.length + MOBILE_TARGETS.length}개 캡처 대상 준비 완료`);
  console.log("[capture-db-ui] 브라우저에서 에디터를 열고 DB 모달을 띄운 뒤 Playwright로 실행하세요.");
}

main();
