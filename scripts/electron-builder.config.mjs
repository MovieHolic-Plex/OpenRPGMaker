// electron-builder 설정 — 앱 id·제품명을 src/brand.ts 상수에서 만든다(설계서 7.5).
//
// 왜 파일을 손으로 안 쓰는가: 제품명과 식별자가 두 곳에 적히면 이름을 바꿀 때 한쪽만 고친다.
// node 24 는 .ts 를 그대로 import 할 수 있어(vite-node 불필요) brand.ts 하나만 정본으로 둔다.
import { PRODUCT_BRAND, PRODUCT_SLUG } from "../src/brand.ts";

// 메인·preload 는 esbuild 번들이라 런타임 node_modules 가 필요 없고, 렌더러는 vite 번들이다.
// 기본값은 production 의존성을 asar 에 넣어 439MB 를 만들었다(실측) — 명시적으로 뺀다.
// node:sqlite 는 내장이고 electron 은 패키저가 넣는다.
const APP_FILES = ["dist/**", "dist-electron/**", "package.json", "scripts/oh-my-pi-worker.ts", "scripts/lib/**", "!node_modules/**"];

/** @type {import('electron-builder').Configuration} */
export default {
  appId: `com.${PRODUCT_SLUG}.studio`,
  productName: PRODUCT_BRAND,
  directories: { output: "dist-packages" },
  // files 는 최상위에 두지 않는다. 최상위와 플랫폼 files 는 별개 매처로 합집합이 돼서, 플랫폼 쪽
  // 제외 패턴이 최상위의 dist-electron/** 를 못 이긴다(실측 2026-09-27: 두 OS 패키지 모두 워커 4개).
  // 각 OS 가 자기 전체 목록을 갖는다.
  // AI 워커는 실행 파일이라 asar 밖에 있어야 하고, 워커가 require 하는 pi_natives 애드온은 로더가
  // 워커 옆 폴더에서 찾는다(scripts/build-electron.mjs). 둘 다 풀어 둔다.
  asarUnpack: ["scripts/**", "dist-electron/oh-my-pi-worker", "dist-electron/oh-my-pi-worker.exe", "dist-electron/pi_natives.*.node"],
  extraMetadata: { main: "dist-electron/main.cjs" },
  asar: true,
  // 앱 아이콘 원본(1024px, 투명 배경). 빌더가 여기서 윈도우 ico·리눅스 png 를 만든다.
  // directories.buildResources 를 기본값(build/)에 기대지 않고 못박는다 — output 을 바꾼 설정이라
  // 어느 폴더를 보는지 읽는 사람이 헷갈린다. 원본을 바꾸려면 scripts/assets/build-app-icons.py.
  icon: "build/icon.png",
  // 맥을 먼저 낸다(설계서 7.5). 리눅스는 서명이 필요 없는 AppImage 로 도그푸딩한다.
  // 맥은 판을 깐 icon-mac.png 를 쓴다. macOS 26 은 투명 아이콘을 회색 판에 줄여 넣는다.
  mac: { target: ["dmg", "zip"], category: "public.app-category.developer-tools", icon: "build/icon-mac.png", files: APP_FILES },
  // 다른 OS 의 워커·애드온(각 약 150~200MB)을 뺀다. 제외 패턴만 주면 빌더가 «무엇이든 포함»(`**/*`)으로
  // 읽어 저장소 전체를 싣는다(실측: app.asar 4.9GB, AppImage 3.5GB) — 그래서 APP_FILES 를 펼친다.
  linux: {
    target: ["AppImage"],
    category: "Development",
    files: [...APP_FILES, "!dist-electron/oh-my-pi-worker.exe", "!dist-electron/pi_natives.win32-*.node"],
  },
  // zip 은 압축만 하고, NSIS exe(portable)는 electron-builder 가 내려받은 makensis 를 직접 돌려
  // 리눅스에서도 만든다 — 실측 2026-10-10: wine 없이 nsis-3.0.4.1/nsis-resources-3.4.1 만 내려받아 생성됨.
  // 사용자는 zip 안의 폴더를 풀지 않고 단일 exe 하나만 받아 실행할 수 있다(첫 실행은 자동 해제로 느리다).
  win: {
    target: ["zip", "portable"],
    files: [...APP_FILES, "!dist-electron/oh-my-pi-worker", "!dist-electron/pi_natives.linux-*.node"],
  },
  // 자동 업데이트는 범위 밖이다(설계서 2절 비목표) — 게시하지 않는다.
  publish: null,
};
