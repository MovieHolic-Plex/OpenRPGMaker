// electron-builder 설정 — 앱 id·제품명을 src/brand.ts 상수에서 만든다(설계서 7.5).
//
// 왜 파일을 손으로 안 쓰는가: 제품명과 식별자가 두 곳에 적히면 이름을 바꿀 때 한쪽만 고친다.
// node 24 는 .ts 를 그대로 import 할 수 있어(vite-node 불필요) brand.ts 하나만 정본으로 둔다.
import { PRODUCT_BRAND, PRODUCT_SLUG } from "../src/brand.ts";

// 메인·preload 는 esbuild 번들이라 런타임 node_modules 가 필요 없고, 렌더러는 vite 번들이다.
// 기본값은 production 의존성을 asar 에 넣어 439MB 를 만들었다(실측) — 명시적으로 뺀다.
// node:sqlite 는 내장이고 electron 은 패키저가 넣는다.
// 윈도 코드 서명(기본 꺼짐, 2026-11-24 app-auto-update 조사). Azure Artifact Signing 은 개인이면 미국·캐나다만,
// 조직은 한국 법인도 가입된다. OPRN_WIN_SIGN=azure 와 아래 값·AZURE_TENANT_ID/CLIENT_ID/CLIENT_SECRET 비밀값이 있을 때만 켜진다.
// 켜면 app-update.yml 에 publisherName 이 들어가 자동 업데이트가 서명 게시자를 확인한다(무서명 판은 확인을 건너뛴다).
const AZURE_SIGN = process.env.OPRN_WIN_SIGN === "azure"
  ? {
      publisherName: process.env.OPRN_WIN_PUBLISHER ?? "",
      endpoint: process.env.OPRN_AZURE_SIGN_ENDPOINT ?? "",
      certificateProfileName: process.env.OPRN_AZURE_SIGN_PROFILE ?? "",
      codeSigningAccountName: process.env.OPRN_AZURE_SIGN_ACCOUNT ?? "",
    }
  : null;
if (AZURE_SIGN && Object.values(AZURE_SIGN).some((value) => !value)) {
  throw new Error("OPRN_WIN_SIGN=azure 인데 OPRN_WIN_PUBLISHER·OPRN_AZURE_SIGN_ENDPOINT·OPRN_AZURE_SIGN_PROFILE·OPRN_AZURE_SIGN_ACCOUNT 중 빈 값이 있다");
}

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
  asarUnpack: ["scripts/**", "dist-electron/oprn-agent-mode-mcp.mjs", "dist-electron/agent-npm/**", "dist-electron/oh-my-pi-worker", "dist-electron/oh-my-pi-worker.exe", "dist-electron/pi_natives.*.node"],
  extraMetadata: { main: "dist-electron/main.cjs" },
  asar: true,
  // 스토어 웹사이트의 「에디터에서 열기」(oprn://store/install?…). macOS Info.plist·Linux .desktop MimeType 에 들어간다.
  // Windows 는 앱이 처음 켜질 때 app.setAsDefaultProtocolClient 로 등록한다(electron/main/main.ts).
  protocols: [{ name: "OPRN Store link", schemes: ["oprn"] }],
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
    // 띄어쓰기 없는 이름. 기본값 「OPRN Studio-<판>.AppImage」 는 gh 가 올릴 때 「OPRN.Studio-…」 로 바꿔서
    // latest-linux.yml 의 path 와 릴리스 자산 이름이 어긋난다(자동 업데이트가 404). 릴리스의 옛 이름과 같다.
    artifactName: "OPRN.Studio-${version}.${ext}",
    files: [...APP_FILES, "!dist-electron/oh-my-pi-worker.exe", "!dist-electron/pi_natives.win32-*.node"],
  },
  // NSIS exe(portable)는 electron-builder 가 내려받은 makensis 를 직접 돌려 리눅스에서도 만든다
  // — 실측 2026-10-10: wine 없이 nsis-3.0.4.1/nsis-resources-3.4.1 만 내려받아 생성됨.
  // 사용자는 단일 exe 하나만 받아 실행한다(첫 실행은 자동 해제로 느리다).
  // zip 은 2026-11-23 에 버렸다 — exe 와 같은 무설치 실행본을 1GB 더 올리던 중복이다.
  //
  // 기본 다운로드는 NSIS 설치판이다(2026-11-24, qa1124 항목 1). portable 은 실행할 때마다 770MB 솔리드 LZMA2 를 1.89GB·2,225개
  // 파일로 풀고(리눈스 서버 코어에서만 33초) 끝나면 지운다 — 그동안 화면이 없었다. 설치판은 설치 때 한 번만 푼다.
  // oneClick·perMachine false: 사용자 폴더(%LOCALAPPDATA%\Programs)에 관리자 권한 없이 설치하고 끝나면 바로 띄운다.
  // portable 은 보조로 남기고, 푸는 동안 스플래시 그림을 보인다(splashImage 가 없으면 템플릿이 SetSilent 로 창을 숨긴다).
  // 설정·프로젝트 폴더는 appId 기준이라 둘이 같은 것을 쓴다.
  win: {
    target: ["nsis", "portable"],
    ...(AZURE_SIGN ? { azureSignOptions: AZURE_SIGN } : {}),
    files: [...APP_FILES, "!dist-electron/oh-my-pi-worker", "!dist-electron/pi_natives.linux-*.node"],
  },
  nsis: {
    oneClick: true,
    perMachine: false,
    runAfterFinish: true,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    // 버전 없는 고정 이름(OPRN.Studio-windows-setup.exe)은 릴리스 워크플로가 붙인다. 띄어쓰기 없는 이름이라 업로드 때 바뀌지 않는다.
    artifactName: "OPRN.Studio-Setup-${version}.${ext}",
  },
  portable: {
    splashImage: "build/portable-splash.bmp",
  },
  // 자동 업데이트 공급자(2026-11-24, electron/main/appUpdate.ts). 패키지 안 app-update.yml 과 dist-packages 의
  // latest.yml·latest-linux.yml·*.blockmap 을 이 설정으로 만든다. 올리기는 릴리스 워크플로가 gh 로 한다 —
  // electron-builder 는 늘 --publish never 로 부른다(태그 빌드에서 스스로 올리지 않게).
  publish: { provider: "github", owner: "MovieHolic-Plex", repo: "OpenRPGMaker", releaseType: "release" },
};
