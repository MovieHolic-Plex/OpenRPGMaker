// 내보낸 게임에 실리는 런타임 JS 머리에 라이선스 고지를 붙인다.
// MIT 는 "모든 사본에 고지를 포함" 이 조건이라, 게임과 함께 나가는 청크마다 전문을 싣는다.
// - OPRN 런타임: LICENSE-RUNTIME.md 의 "MIT License" 줄부터 끝까지가 정본이다 — 여기에 문구를 다시 적지 않는다.
// - Phaser(MIT): 런타임에 실리는 유일한 외부 패키지다(scripts/oss/runtime-graph.mjs 로 확인).
//   플레이어 빌드는 phaser.min.js 를 자산으로 복사하고, 단일 HTML 빌드는 청크 안에 묶는다 — 두 경우 모두 붙인다.
// generateBundle 은 압축(renderChunk) 뒤에 돌므로 압축기가 주석을 지우지 못한다.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

const asComment = (title, text) => {
  if (text.includes("*/")) throw new Error(`${title} 고지에 */ 가 있으면 주석이 깨진다`);
  return `/*! ${title}\n${text.trim()}\n*/\n`;
};

export function readRuntimeLicenseNotice(licensePath) {
  const text = readFileSync(licensePath, "utf8");
  const start = text.indexOf("MIT License");
  if (start < 0) throw new Error(`${licensePath} 에 "MIT License" 절이 없다`);
  return text.slice(start).trim();
}

const PHASER_MODULE = /[\\/]node_modules[\\/]phaser[\\/]/;
const PHASER_ASSET = /(^|\/)phaser(\.min)?-[^/]*\.js$/;

export function runtimeLicenseBannerPlugin(licensePath) {
  const oprn = asComment("OPRN runtime — LICENSE-RUNTIME.md", readRuntimeLicenseNotice(licensePath));
  const phaser = asComment("Phaser — https://phaser.io", readFileSync(require.resolve("phaser/LICENSE.md"), "utf8"));
  return {
    name: "oprn-runtime-license-banner",
    apply: "build",
    generateBundle(_options, bundle) {
      for (const file of Object.values(bundle)) {
        if (file.type === "chunk") {
          const bundlesPhaser = file.moduleIds.some((id) => PHASER_MODULE.test(id));
          file.code = oprn + (bundlesPhaser ? phaser : "") + file.code;
        } else if (PHASER_ASSET.test(file.fileName) && typeof file.source === "string") {
          file.source = phaser + file.source;
        } else if (PHASER_ASSET.test(file.fileName)) {
          file.source = Buffer.concat([Buffer.from(phaser), Buffer.from(file.source)]);
        }
      }
    },
  };
}
