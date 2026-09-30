import { defaultTilesets, ensureBundledTilesets } from "./defaults/defaultAssets";
import { sharedContentSnapshot } from "./sharedContent";
import { registerReferenceDocumentOwners } from "./referenceOwnership";
import type { TilesetDef } from "./types";

/**
 * 편집기 부팅이 한 번 부른다 — 프로젝트 저장·전송에서 번들·공용 참고문서를 빼고 로드에서 되돌리는 기능을 켠다(referenceOwnership.ts).
 * 헤드리스 도구·테스트·플레이어·Electron main 은 부르지 않으므로 예전 그대로 문서를 통째로 저장한다.
 */

// 번들 판본: 새 프로젝트가 얻는 그대로. 처음 필요할 때 한 번만 만든다(실측 약 0.4초, 11개 타일셋 6.9MB).
let bundled: Record<string, TilesetDef> | null = null;
function bundledTilesets(): Record<string, TilesetDef> {
  if (!bundled) {
    const fresh = defaultTilesets();
    ensureBundledTilesets({ tilesets: fresh });
    bundled = fresh;
  }
  return bundled;
}

export function installReferenceDocumentOwners(): void {
  registerReferenceDocumentOwners({
    // ensureSharedContent 가 프로젝트에 설치하는 것은 projectDefaults 라이브러리뿐이다. 그 밖의 라이브러리(장소·지역 카탈로그)는
    // 부팅 때 아직 없으므로 소유자로 삼으면 로드에서 되돌릴 수 없다.
    shared(id) {
      for (const lib of Object.values(sharedContentSnapshot().libraries)) {
        if (lib.projectDefaults && Object.hasOwn(lib.tilesets, id)) return lib.tilesets[id].referenceDocuments;
      }
      return undefined;
    },
    bundle(id) {
      return bundledTilesets()[id]?.referenceDocuments;
    },
  });
}
