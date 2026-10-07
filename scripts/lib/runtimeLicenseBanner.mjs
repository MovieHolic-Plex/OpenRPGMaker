// 내보낸 게임에 실리는 런타임 JS 머리에 MIT 고지를 붙인다.
// MIT 는 "모든 사본에 고지를 포함" 이 조건이라, 게임과 함께 나가는 청크마다 전문을 싣는다.
// 정본은 LICENSE-RUNTIME.md 의 "MIT License" 줄부터 끝까지다 — 여기에 문구를 다시 적지 않는다.
// generateBundle 은 압축(renderChunk) 뒤에 돌므로 압축기가 주석을 지우지 못한다.
import { readFileSync } from "node:fs";

export function readRuntimeLicenseNotice(licensePath) {
  const text = readFileSync(licensePath, "utf8");
  const start = text.indexOf("MIT License");
  if (start < 0) throw new Error(`${licensePath} 에 "MIT License" 절이 없다`);
  const notice = text.slice(start).trim();
  if (notice.includes("*/")) throw new Error("런타임 고지에 */ 가 있으면 주석이 깨진다");
  return notice;
}

export function runtimeLicenseBannerPlugin(licensePath) {
  const banner = `/*! OPRN runtime — LICENSE-RUNTIME.md\n${readRuntimeLicenseNotice(licensePath)}\n*/\n`;
  return {
    name: "oprn-runtime-license-banner",
    apply: "build",
    generateBundle(_options, bundle) {
      for (const file of Object.values(bundle)) {
        if (file.type === "chunk") file.code = banner + file.code;
      }
    },
  };
}
