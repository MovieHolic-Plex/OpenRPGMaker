import type { Project, TilesetDef } from "@/project/types";

/**
 * 편집용 프로젝트 복제. 타일셋 참고문서(타일셋당 수 MB, 합계 약 20MB)는
 * 배열 참조를 공유한다. 문서는 통째로 교체만 하고 원소를 고치지 않는다.
 * 매 데이터베이스 수정마다 structuredClone 이 그 문서를 복사하면
 * parity 전투·왕복 테스트가 15초 제한을 넘긴다.
 */
export function cloneProjectSharingReferenceDocuments(project: Project): Project {
  const shared: Array<[string, NonNullable<TilesetDef["referenceDocuments"]>]> = [];
  const tilesets: Project["tilesets"] = {};
  for (const [id, tileset] of Object.entries(project.tilesets)) {
    const documents = tileset.referenceDocuments;
    if (documents === undefined) {
      tilesets[id] = tileset;
      continue;
    }
    shared.push([id, documents]);
    const { referenceDocuments: _documents, ...rest } = tileset;
    tilesets[id] = rest;
  }
  const cloned = structuredClone({ ...project, tilesets });
  for (const [id, documents] of shared) {
    const tileset = cloned.tilesets[id];
    if (tileset) tileset.referenceDocuments = documents;
  }
  return cloned;
}
