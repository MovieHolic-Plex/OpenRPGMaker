import { bundledTilesetById } from "./defaults/defaultAssets";
import { sharedContentSnapshot } from "./sharedContent";
import { registerReferenceDocumentOwners } from "./referenceOwnership";
import type { TilesetDef } from "./types";

/**
 * 편집기 부팅이 한 번 부른다 — 프로젝트 저장·전송에서 번들·공용 참고문서를 빼고 로드에서 되돌리는 기능을 켠다(referenceOwnership.ts).
 * 헤드리스 도구·테스트·플레이어·Electron main 은 부르지 않으므로 예전 그대로 문서를 통째로 저장한다.
 */

// 번들 판본: 새 프로젝트가 얻는 그대로의 참고문서. 타일셋 id 마다 처음 물을 때 그 타일셋 하나만 만든다.
// 왜(2026-10-15 실측, 웜 부팅): 예전에는 첫 질문에 번들 타일셋 44개를 전부 만들고 ensure 까지 돌려 1.1s 를 첫 화면 앞에서 치렀다.
// 로드가 묻는 것은 표지가 붙은 타일셋뿐이고 문서만 필요하다. 타일셋 하나만 만든 문서는 전부 만들고 ensure 를 돈 문서와
// 44개 모두 JSON 동일하다(실측). 없는 id 는 만들지 않고 undefined 다(`bundledTilesetById`).
const bundledDocs = new Map<string, TilesetDef["referenceDocuments"] | undefined>();
function bundledDocsFor(id: string): TilesetDef["referenceDocuments"] | undefined {
  if (!bundledDocs.has(id)) bundledDocs.set(id, bundledTilesetById(id)?.referenceDocuments);
  return bundledDocs.get(id);
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
      return bundledDocsFor(id);
    },
  });
}
