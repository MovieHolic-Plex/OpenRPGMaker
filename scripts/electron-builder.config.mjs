// electron-builder 설정 — 앱 id·제품명을 src/brand.ts 상수에서 만든다(설계서 7.5).
//
// 왜 파일을 손으로 안 쓰는가: 제품명과 식별자가 두 곳에 적히면 이름을 바꿀 때 한쪽만 고친다.
// node 24 는 .ts 를 그대로 import 할 수 있어(vite-node 불필요) brand.ts 하나만 정본으로 둔다.
import { PRODUCT_BRAND, PRODUCT_SLUG } from "../src/brand.ts";

/** @type {import('electron-builder').Configuration} */
export default {
  appId: `com.${PRODUCT_SLUG}.studio`,
  productName: PRODUCT_BRAND,
  directories: { output: "dist-packages" },
  // 메인·preload 는 esbuild 번들이라 런타임 node_modules 가 필요 없고, 렌더러는 vite 번들이다.
  // 기본값은 production 의존성을 asar 에 넣어 439MB 를 만들었다(실측) — 명시적으로 뺀다.
  // node:sqlite 는 내장이고 electron 은 패키저가 넣는다.
  files: ["dist/**", "dist-electron/**", "package.json", "!node_modules/**"],
  extraMetadata: { main: "dist-electron/main.cjs" },
  asar: true,
  // 맥을 먼저 낸다(설계서 7.5). 리눅스는 서명이 필요 없는 AppImage 로 도그푸딩한다.
  mac: { target: ["dmg", "zip"], category: "public.app-category.developer-tools" },
  linux: { target: ["AppImage"], category: "Development" },
  // 자동 업데이트는 범위 밖이다(설계서 2절 비목표) — 게시하지 않는다.
  publish: null,
};
