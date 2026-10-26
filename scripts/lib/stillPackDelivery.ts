// 오프닝 스틸 팩 설치 여부를 편집기 번들에 주입한다(src/assets/installedStillPack.ts 의 빌드타임 시드).
// audioDelivery.ts 의 __OPRN_INSTALLED_BGM_FILES__ 와 같은 방식 — 설치 뒤에는 dev 서버를 다시 띄워야 목록이 갱신된다.
import { readdirSync } from "node:fs";
import { resolve } from "node:path";
import type { Plugin } from "vite";

export const STILL_PACK_RELATIVE_DIR = "assets/stills/pack";

/** 디렉터리에 실제로 있는 팩 그림 파일명. 폴더가 없으면 빈 목록. */
export function listInstalledStillPackFiles(directory: string): string[] {
  try {
    return readdirSync(directory, { withFileTypes: true })
      .filter((entry) => entry.isFile() && /\.(?:jpe?g|png|webp)$/iu.test(entry.name))
      .map((entry) => entry.name)
      .sort();
  } catch {
    // 없거나 못 읽는 폴더는 «설치 안 됨» — 편집기 설정·워커 시작을 막지 않는다.
    return [];
  }
}

export function stillPackDeliveryPlugin(): Plugin {
  return {
    name: "still-pack-delivery",
    config(config) {
      const root = resolve(config.root ?? process.cwd());
      const directory = resolve(root, typeof config.publicDir === "string" ? config.publicDir : "public", STILL_PACK_RELATIVE_DIR);
      const files = config.publicDir === false ? [] : listInstalledStillPackFiles(directory);
      return { define: { __OPRN_INSTALLED_STILL_FILES__: JSON.stringify(files) } };
    },
  };
}
