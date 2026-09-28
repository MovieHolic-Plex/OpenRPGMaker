import type { Project, TilesetDef } from "@/project/types";
import { jsonEqual } from "@/util/structuralJson";

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

/** 타일셋 하나를 복제한다. 참고문서 배열은 공유하고, 키 순서는 원본과 같게 둔다(직렬화 바이트가 같아야 한다). */
export function cloneTilesetSharingReferenceDocuments(tileset: TilesetDef): TilesetDef {
  const documents = tileset.referenceDocuments;
  if (documents === undefined) return structuredClone(tileset);
  const cloned = structuredClone({ ...tileset, referenceDocuments: [] }) as TilesetDef;
  cloned.referenceDocuments = documents;
  return cloned;
}

type LazyTilesetState = {
  readonly originals: Project["tilesets"];
  /** 접근자가 만든 복제본. 같은 자리에 다른 값이 대입되면 더 이상 여기 값과 같지 않다. */
  readonly clones: Map<string, TilesetDef>;
};

const lazyTilesetStates = new WeakMap<object, LazyTilesetState>();

/**
 * 타일셋을 처음 읽힐 때만 복제하는 사전. 각 자리는 접근자 속성이라 읽기(속성 읽기·`Object.values`·펼침·
 * `JSON.stringify`·`structuredClone`)는 모두 복제본을 돌려받고, 대입·삭제는 보통 객체와 같이 동작한다.
 * 키 순서는 원본과 같다(자리를 다시 정의해도 순서는 그대로다).
 */
function lazyTilesetDictionary(originals: Project["tilesets"]): Project["tilesets"] {
  const dictionary: Project["tilesets"] = {};
  const clones = new Map<string, TilesetDef>();
  const settle = (id: string, value: TilesetDef): void => {
    Object.defineProperty(dictionary, id, { value, writable: true, enumerable: true, configurable: true });
  };
  for (const id of Object.keys(originals)) {
    Object.defineProperty(dictionary, id, {
      enumerable: true,
      configurable: true,
      get(): TilesetDef {
        const copy = cloneTilesetSharingReferenceDocuments(originals[id]!);
        clones.set(id, copy);
        settle(id, copy);
        return copy;
      },
      set(value: TilesetDef) {
        settle(id, value);
      },
    });
  }
  lazyTilesetStates.set(dictionary, { originals, clones });
  return dictionary;
}

/**
 * `store.update` 전용 복제. 타일셋 밖은 `cloneProjectSharingReferenceDocuments` 와 같이 복제하고,
 * 타일셋은 변경기가 실제로 읽는 것만 복제한다. 변경기가 끝나면 반드시 `finishProjectMutation` 을 부른다.
 *
 * 왜(2026-09-26 실측, 앱에서 82MB 문서·타일셋 354칸): 편집 하나마다 타일셋 전체를 깊은 복사했고, 그
 * 복사본이 저장 기준본과 늘 다른 객체라 저장마다 diff·커밋 요약이 타일셋 전부를 다시 보았다.
 * (상세는 verify-shots/perf-app-save/SUMMARY.md)
 *
 * 계약: 스토어가 들고 있는 타일셋 객체는 제자리에서 고치지 않는다 — 변경은 update 변경기 안의 draft 로만 한다.
 * 같은 객체를 현재본·저장 기준본·되돌리기 기록이 함께 가리키므로, 제자리 수정은 저장 diff 에서 사라진다.
 */
export function cloneProjectForMutation(project: Project): Project {
  // 키 순서를 지키려고 빈 사전을 같은 자리에 두고 복제한 뒤 갈아 끼운다(직렬화 바이트가 같아야 한다).
  const draft = structuredClone(withoutSharedDictionaries(project)) as Project;
  draft.tilesets = lazyTilesetDictionary(project.tilesets);
  shareUploadedAssets(project, draft);
  return draft;
}

/**
 * 타일셋·업로드 자산 사전을 빈 사전으로 바꾼 얕은 사본. 복제할 나머지만 남긴다(키 자리는 그대로).
 *
 * 업로드 자산(그림·소리 dataUrl)은 항목째 공유한다. 왜(2026-09-28 실측, 새 프로젝트 149MB 중 업로드 자산 66MB):
 * 편집·도구 draft 와 store.replace 마다 이 사전을 structuredClone 해서 복제만 수백 ms 였고, 새 객체라 요약 기억도
 * 맞지 않았다. 계약: 업로드 자산 항목은 제자리에서 고치지 않는다 — 항상 사전 자리에 새 객체를 대입한다
 * (facesetSheetRepair·resourceTools 가 그렇게 한다). 사전 자체는 얕게 복사하므로 대입·삭제는 안전하다.
 */
export function withoutSharedDictionaries(project: Project): Project {
  const assets = project.assets as Project["assets"] | undefined;
  return {
    ...project,
    tilesets: {},
    ...(assets && assets.uploaded ? { assets: { ...assets, uploaded: {} } } : {}),
  } as Project;
}

/** withoutSharedDictionaries 로 비운 업로드 사전을 원본 항목을 가리키는 얕은 사전으로 채운다. */
export function shareUploadedAssets(source: Project, copy: Project): void {
  const uploaded = (source.assets as Project["assets"] | undefined)?.uploaded;
  if (uploaded && copy.assets) copy.assets.uploaded = { ...uploaded };
}

/**
 * `cloneProjectForMutation` 의 사전을 보통 객체로 확정한다. 읽지 않은 타일셋은 원본 객체를, 읽었지만
 * 내용이 같은 타일셋도 원본 객체를 돌려 놓는다(후자가 있어야 `Object.values` 로 훑기만 한 변경기가
 * 모든 타일셋을 새 객체로 만들지 않는다). 바뀐 타일셋의 id 를 돌려준다. 변경기가 사전을 통째로 갈아
 * 끼웠으면 null 이다(어느 타일셋이 바뀌었는지 모른다).
 */
export function finishProjectMutation(draft: Project): ReadonlySet<string> | null {
  const dictionary = draft.tilesets;
  const state = lazyTilesetStates.get(dictionary);
  if (!state) return null;
  lazyTilesetStates.delete(dictionary);
  const settled: Project["tilesets"] = {};
  const changed = new Set<string>();
  for (const id of Object.keys(dictionary)) {
    const descriptor = Object.getOwnPropertyDescriptor(dictionary, id)!;
    const original = Object.prototype.hasOwnProperty.call(state.originals, id) ? state.originals[id] : undefined;
    if (descriptor.get) {
      settled[id] = original!;
      continue;
    }
    const value = descriptor.value as TilesetDef;
    if (value === original) {
      settled[id] = original;
      continue;
    }
    if (original !== undefined && state.clones.get(id) === value && jsonEqual(value, original)) {
      settled[id] = original;
      continue;
    }
    settled[id] = value;
    changed.add(id);
  }
  for (const id of Object.keys(state.originals)) {
    if (!Object.prototype.hasOwnProperty.call(settled, id)) changed.add(id);
  }
  draft.tilesets = settled;
  return changed;
}
