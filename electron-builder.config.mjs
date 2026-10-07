// electron-builder 설정. `npm run package` 가 쓴다.
//
// 왜 저장소가 이 파일을 들고 있나: 지금까지 배포물은 `dist/`(렌더러)와 `dist-electron/`(메인·
// 프리로드·브라우저 브리지)를 손으로 묶는 상태였고, 그 둘을 실제 앱 번들로 만드는 절차가
// 없었다(I5). 이 파일이 그 절차의 정본이다.
//
// asar: true — 렌더러 번들이 사용자 폴더에 풀려 있으면 사용자가 앱 코드를 고쳐 실행할 수 있고,
// 그 상태로 만든 프로젝트가 정본이 되면 재현이 불가능해진다.
const PRODUCT_SLUG = "oprn";
const PRODUCT_BRAND = "OPRN Studio";

export default {
  appId: `com.${PRODUCT_SLUG}.studio`,
  productName: PRODUCT_BRAND,
  directories: { output: "release", buildResources: "build" },
  // `main` 이 package.json 에 없으므로(개발은 playwright 가 번들을 직접 띄운다) 여기서 못박는다.
  extraMetadata: { main: "dist-electron/main.cjs" },
  files: [
    "dist/**",
    "dist-electron/**",
    "package.json",
    // 패키지 안에서 런타임에 읽는 것들. dist/ 에 이미 복사된 것은 위 줄이 담는다.
    "scripts/lib/**",
    "!**/*.d.mts",
  ],
  asar: true,
  // 조수 워커는 bun 으로 컴파일한 별도 실행 파일이라 asar 안을 읽지 못한다. 모델에게 보내는 번들 참고 그림
  // (read_tileset_reference)은 풀어 둔 사본에서 읽는다(src/project/bundledReferenceImages.ts, OPRN_RENDERER_DIR).
  // 2026-10-07 Windows 실측: 워커가 「B:\public\assets\hand-interior-references\…」를 찾다 ENOENT.
  asarUnpack: ["dist/assets/**/*.{png,jpg,jpeg,webp}"],
  mac: {
    target: [{ target: "dmg", arch: ["arm64", "x64"] }, { target: "zip", arch: ["arm64", "x64"] }],
    category: "public.app-category.developer-tools",
    // 서명 자격이 없으면 electron-builder 는 서명을 건너뛴다. 광고(ad-hoc) 서명도 하지 않는다 —
    // 서명된 것처럼 보이지만 Gatekeeper 는 어차피 막는다.
    identity: null,
  },
  linux: {
    target: [{ target: "AppImage", arch: ["x64"] }],
    category: "Development",
  },
  win: {
    target: [{ target: "zip", arch: ["x64"] }],
  },
};
