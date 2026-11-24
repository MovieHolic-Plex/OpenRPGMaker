// NSIS 설치판의 «언인스톨러 꺼내기» 단계를 wine 없이 한다.
//
// 왜(2026-11-24 실측): electron-builder 26.18 의 NsisTarget 은 언인스톨러를 만들려고 BUILD_UNINSTALLER 로 중간 설치기를 굽고,
// 그 exe 를 wine 으로 실행해 `<출력 폴더>/<설치기 이름에서 exe 를 뗀 것>__uninstaller.exe` 를 쓰게 한다. mdc2 러너에는 wine 이 없어
// `spawn wine ENOENT` 로 실패했고, electron-builder 가 받는 Wine 11 묶음(toolsets.wine 1.0.1)은 이 박스에서 ntdll 로드에 실패했다.
// app-builder-lib 은 같은 일을 순수 JS 로 하는 UninstallerReader 를 갖고 있다(macOS Catalina 이상에서 쓰는 길). 그것을 부른다.
// 출력 경로 규칙은 NsisTarget.js 의 `path.join(this.outDir, `${path.basename(installerPath, "exe")}__uninstaller.exe`)` 와 같다.
"use strict";
const path = require("node:path");

const installer = process.argv[2];
if (!installer || !installer.endsWith(".exe")) {
  console.error(`nsis-wine-shim: 설치기 exe 경로가 아니다: ${installer ?? "(없음)"}`);
  process.exit(2);
}
const appBuilderLib = path.dirname(require.resolve("app-builder-lib/package.json", { paths: [process.cwd(), __dirname] }));
const { UninstallerReader } = require(path.join(appBuilderLib, "out/targets/nsis/nsisUtil"));
const out = path.join(path.dirname(installer), `${path.basename(installer, "exe")}__uninstaller.exe`);
UninstallerReader.exec(installer, out).then(
  () => process.exit(0),
  (error) => {
    console.error(error);
    process.exit(1);
  },
);
