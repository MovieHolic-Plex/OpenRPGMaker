import type { Command, GameEvent, MapId, Project, TilesetDef } from "@/project/types";
import { resolveCommandListAtPath } from "@/editor/eventCommandPaths";
import { jsonEqual } from "@/util/structuralJson";
import { shareContentDigests } from "@/project/persistence/core/contentDigest";

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
 * 읽기 전용 스냅샷용 복제. 타일셋·업로드 자산 항목은 원본 객체를 가리키고(사전만 얕게 복사), 나머지는 깊게 복제한다.
 * 키 순서는 원본과 같다. 원본의 요약 기억을 넘겨 다음 비교가 처음부터 돌지 않게 한다.
 * 계약은 위 두 함수와 같다 — 스토어의 타일셋·업로드 자산 항목은 제자리에서 고치지 않는다.
 * 왜(2026-09-28 실측, 새 프로젝트 기본 자료 149MB): `structuredClone(project)` 한 번이 1.3s, 그중 타일셋·업로드 자산이 거의 전부다.
 */
export function cloneProjectSharingSharedDictionaries(project: Project): Project {
  const next = structuredClone(withoutSharedDictionaries(project)) as Project;
  next.tilesets = { ...project.tilesets };
  shareUploadedAssets(project, next);
  shareContentDigests(project, next);
  return next;
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

// ---------------------------------------------------------------------------------------------------------------------
// store.update 전용 복사-쓰기(COW) 복제. 위 `cloneProjectForMutation` 은 타일셋만 늦게 복제하고 나머지(spatialAuthoring 1.3MB,
// maps·database 등)는 편집마다 structuredClone 한다. 실측(2026-09-30, 큰 프로젝트 사본): 그 복제 52ms + 뒤이은
// removeLegacySpriteReferences 전체 순회 25~41ms 가 편집 한 번(update 1셀 121ms)의 거의 전부다.
// 여기서는 큰 뿌리 키를 접근자로 늦게 복제하고, 끝난 뒤 안 바뀐 부분은 원본 객체로 되돌린다.
// 계약(타일셋과 같다): 스토어가 들고 있는 객체는 제자리에서 고치지 않는다. 변경은 update 변경기 안의 draft 로만 한다.
// ---------------------------------------------------------------------------------------------------------------------

/** 늦게 복제할 뿌리 키와 사전 깊이(0 = 값 통째로 복제, n = 사전 n 단계 아래 항목까지 늦게 복제). */
const LAZY_PROJECT_ROOTS: Readonly<Record<string, number>> = {
  maps: 1,
  database: 1,
  spatialAuthoring: 3,
  resourceProfiles: 0,
};

type LazyRecordState = {
  readonly originals: Record<string, unknown>;
  readonly clones: Map<string, unknown>;
};

const lazyRecordStates = new WeakMap<object, LazyRecordState>();

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function isObjectLike(value: unknown): value is object {
  return value !== null && typeof value === "object";
}

function defineSettled(target: object, key: string, value: unknown): void {
  Object.defineProperty(target, key, { value, writable: true, enumerable: true, configurable: true });
}

function defineLazy(target: object, key: string, make: () => unknown, onSettle: (copy: unknown) => void): void {
  Object.defineProperty(target, key, {
    enumerable: true,
    configurable: true,
    get(): unknown {
      const copy = make();
      onSettle(copy);
      defineSettled(target, key, copy);
      return copy;
    },
    set(value: unknown) {
      defineSettled(target, key, value);
    },
  });
}

/** 사전 하나를 늦게 복제한다. 키 순서는 원본과 같고, 객체가 아닌 값은 바로 복사한다. */
function lazyRecord(originals: Record<string, unknown>, depth: number): Record<string, unknown> {
  const dictionary: Record<string, unknown> = {};
  const clones = new Map<string, unknown>();
  for (const key of Object.keys(originals)) {
    const original = originals[key];
    if (!isObjectLike(original)) {
      defineSettled(dictionary, key, original);
      continue;
    }
    defineLazy(
      dictionary,
      key,
      () => (depth > 0 && isPlainRecord(original) ? lazyRecord(original, depth - 1) : structuredClone(original)),
      (copy) => clones.set(key, copy),
    );
  }
  lazyRecordStates.set(dictionary, { originals, clones });
  return dictionary;
}

type LazyFinish = {
  /** 안 바뀐 사전이면 원본, 아니면 확정한 새 보통 객체. */
  readonly value: Record<string, unknown>;
  readonly unchanged: boolean;
  /** 바뀐 항목만 담은 투영(하위 늦은 사전은 다시 투영). 정리 검사를 바뀐 곳에만 돌리는 데 쓴다. */
  readonly projection: Record<string, unknown>;
};

/** 투영 사전 → 만들 때의 키 목록. 정리 검사가 투영에서 키를 지웠는지 알아내 실제 사전에도 지우는 데 쓴다. */
const projectionWrappers = new WeakMap<object, readonly string[]>();

function finishLazyRecord(dictionary: Record<string, unknown>): LazyFinish {
  const state = lazyRecordStates.get(dictionary)!;
  lazyRecordStates.delete(dictionary);
  const settled: Record<string, unknown> = {};
  const projection: Record<string, unknown> = {};
  let changed = 0;
  let keptOriginals = 0;
  const keys = Object.keys(dictionary);
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(dictionary, key)!;
    const hasOriginal = Object.prototype.hasOwnProperty.call(state.originals, key);
    const original = hasOriginal ? state.originals[key] : undefined;
    if (hasOriginal) keptOriginals += 1;
    if (descriptor.get) {
      defineSettled(settled, key, original);
      continue;
    }
    const value = descriptor.value as unknown;
    if (hasOriginal && value === original) {
      defineSettled(settled, key, original);
      continue;
    }
    if (hasOriginal && state.clones.get(key) === value && isObjectLike(value)) {
      if (isPlainRecord(value) && lazyRecordStates.has(value)) {
        const nested = finishLazyRecord(value);
        if (nested.unchanged) {
          defineSettled(settled, key, original);
          continue;
        }
        defineSettled(settled, key, nested.value);
        defineSettled(projection, key, nested.projection);
        changed += 1;
        continue;
      }
      if (jsonEqual(value, original)) {
        defineSettled(settled, key, original);
        continue;
      }
    }
    defineSettled(settled, key, value);
    defineSettled(projection, key, value);
    changed += 1;
  }
  const removed = keptOriginals !== Object.keys(state.originals).length;
  if (changed === 0 && !removed) return { value: state.originals, unchanged: true, projection };
  projectionWrappers.set(projection, Object.keys(projection));
  return { value: settled, unchanged: false, projection };
}

type UpdateDraftState = { readonly base: Project; readonly clones: Map<string, unknown> };
const updateDraftStates = new WeakMap<object, UpdateDraftState>();

/**
 * `store.update` 전용 복제. 타일셋은 `cloneProjectForMutation` 처럼, 큰 뿌리 키(maps·database·spatialAuthoring·
 * resourceProfiles)는 읽힐 때만(사전은 항목 단위로) 복제한다. 뿌리 키 순서는 원본과 같다(직렬화 바이트 동일).
 * 변경기가 끝나면 반드시 `finishProjectUpdate` 를 부른다.
 */
export function cloneProjectForUpdate(project: Project): Project {
  const root = project as unknown as Record<string, unknown>;
  const lazyKeys = Object.keys(LAZY_PROJECT_ROOTS).filter(
    (key) => Object.prototype.hasOwnProperty.call(root, key) && isObjectLike(root[key]),
  );
  const shell = withoutSharedDictionaries(project) as unknown as Record<string, unknown>;
  for (const key of lazyKeys) shell[key] = {};
  const draft = structuredClone(shell) as unknown as Project;
  draft.tilesets = lazyTilesetDictionary(project.tilesets);
  shareUploadedAssets(project, draft);
  const clones = new Map<string, unknown>();
  for (const key of lazyKeys) {
    const original = root[key] as object;
    const depth = LAZY_PROJECT_ROOTS[key]!;
    defineLazy(
      draft,
      key,
      () => (depth > 0 && isPlainRecord(original) ? lazyRecord(original, depth - 1) : structuredClone(original)),
      (copy) => clones.set(key, copy),
    );
  }
  updateDraftStates.set(draft, { base: project, clones });
  return draft;
}

export type ProjectUpdateSummary = {
  /** 바뀐 타일셋 id. 변경기가 사전을 통째로 갈아 끼웠으면 null. */
  readonly tilesets: ReadonlySet<string> | null;
  /** 바뀐 맵 id. `maps` 를 통째로 갈아 끼웠으면 null(어느 맵이 바뀌었는지 모른다). */
  readonly changedMapIds: ReadonlySet<string> | null;
  /**
   * removeLegacySpriteReferences 를 돌릴 대상: 뿌리 키 → 값. 늦게 복제한 뿌리는 바뀐 항목만 담은 투영이고,
   * 나머지 뿌리(타일셋 포함)는 값 그대로다. 정리 뒤 `applyCleanedProjection` 으로 결과를 돌려 쓴다.
   */
  readonly cleanupTarget: Record<string, unknown>;
};

/**
 * `cloneProjectForUpdate` 의 늦은 접근자를 보통 속성으로 확정한다. 읽지 않았거나 내용이 같은 부분은 원본 객체를
 * 되돌려 놓는다(이후 diff·요약 기억이 `===` 로 건너뛴다). 뿌리 키 순서는 그대로다.
 */
export function finishProjectUpdate(draft: Project): ProjectUpdateSummary {
  const tilesets = finishProjectMutation(draft);
  const state = updateDraftStates.get(draft);
  const root = draft as unknown as Record<string, unknown>;
  const cleanupTarget: Record<string, unknown> = {};
  let changedMapIds: ReadonlySet<string> | null = new Set<string>();
  if (state) {
    updateDraftStates.delete(draft);
    const base = state.base as unknown as Record<string, unknown>;
    for (const key of Object.keys(LAZY_PROJECT_ROOTS)) {
      const descriptor = Object.getOwnPropertyDescriptor(root, key);
      if (!descriptor || !Object.prototype.hasOwnProperty.call(base, key)) continue;
      if (descriptor.get) {
        defineSettled(root, key, base[key]);
        continue;
      }
      const value = descriptor.value as unknown;
      const original = base[key];
      if (value === original) continue;
      if (state.clones.get(key) === value && isObjectLike(value)) {
        if (isPlainRecord(value) && lazyRecordStates.has(value)) {
          const finished = finishLazyRecord(value);
          if (finished.unchanged) {
            defineSettled(root, key, original);
            continue;
          }
          defineSettled(root, key, finished.value);
          cleanupTarget[key] = finished.projection;
          if (key === "maps") changedMapIds = new Set(Object.keys(finished.projection));
          continue;
        }
        if (jsonEqual(value, original)) {
          defineSettled(root, key, original);
          continue;
        }
      }
      cleanupTarget[key] = value;
      if (key === "maps") changedMapIds = null;
    }
  }
  // 늦게 복제하지 않는 뿌리(작은 문서·타일셋·자산)는 그대로 검사 대상이다.
  for (const key of Object.keys(root)) {
    if (!(key in LAZY_PROJECT_ROOTS)) cleanupTarget[key] = root[key];
  }
  return { tilesets, changedMapIds, cleanupTarget };
}

/** 정리 검사가 투영 위에서 지우거나 바꾼 뿌리 값을 실제 draft 에 돌려 쓴다(투영 안의 실제 객체는 이미 제자리에서 고쳐졌다). */
export function applyCleanedProjection(draft: Project, target: Record<string, unknown>): void {
  applyProjection(draft as unknown as Record<string, unknown>, target);
}

function applyProjection(real: Record<string, unknown>, projected: Record<string, unknown>): void {
  const wrapperKeys = projectionWrappers.get(projected);
  if (wrapperKeys) {
    for (const key of wrapperKeys) {
      if (!Object.prototype.hasOwnProperty.call(projected, key)) delete real[key];
    }
  }
  for (const key of Object.keys(projected)) {
    const value = projected[key];
    const current = real[key];
    if (value === current) continue;
    if (isObjectLike(value) && projectionWrappers.has(value) && isPlainRecord(current)) {
      applyProjection(current, value as Record<string, unknown>);
      continue;
    }
    real[key] = value;
  }
}

/** Publish an isolated event revision. Only the map shell/events array are copied;
 * every tile grid and unrelated event keeps its identity. No shared object is
 * exposed to a general Project/GameMap mutator by this path. */
export function projectWithEventRevision(project: Project, mapId: MapId, eventId: string, event: GameEvent | null): Project {
  const map = project.maps[mapId];
  if (!map) return project;
  const index = map.events.findIndex(candidate => candidate.id === eventId);
  const events = map.events.slice();
  if (event === null) {
    if (index < 0) return project;
    events.splice(index, 1);
  } else if (index < 0) events.push(event);
  else events[index] = event;
  return { ...project, maps: { ...project.maps, [mapId]: { ...map, events } } };
}

/** Copy only the containers on existing command paths for array-only moves.
 * The caller may splice these lists, but must never edit their command objects.
 * All other event edits use a deep event clone. Branch resolution stays owned
 * by eventCommandPaths; both ordinary properties and option.branch are kept. */
export function cloneCommandContainersForMove(commands: Command[], paths: readonly (readonly number[])[]): Command[] {
  const next = commands.slice();
  for (const path of paths) {
    if (path.length % 2 !== 0) throw new Error("Invalid command container path");
    let originalList = commands;
    let draftList = next;
    for (let depth = 0; depth < path.length; depth += 2) {
      const index = path[depth]!;
      const branch = path[depth + 1]!;
      const original = originalList[index];
      if (!original) throw new Error("Missing command container");
      const originalBranch = resolveCommandListAtPath([original], [0, branch]);
      if (!originalBranch) throw new Error("Missing command branch");
      if (draftList[index] === original) draftList[index] = { ...original };
      const draft = draftList[index]!;
      const draftBranch = resolveCommandListAtPath([draft], [0, branch]);
      if (draftBranch === originalBranch) {
        const copy = originalBranch.slice();
        // A branch is either a direct command property or an option's branch.
        const record = draft as unknown as Record<string, unknown>;
        let replaced = false;
        for (const key of Object.keys(record)) {
          if (record[key] === originalBranch) { record[key] = copy; replaced = true; }
        }
        if (!replaced && (draft.kind === "choices" || draft.kind === "presentItem") && branch >= 0) {
          draft.options = draft.options.map((option, optionIndex) => optionIndex === branch ? { ...option, branch: copy } : option);
          replaced = true;
        }
        if (!replaced) throw new Error("Unrecognized command branch storage");
      }
      originalList = originalBranch;
      draftList = resolveCommandListAtPath([draft], [0, branch])!;
    }
  }
  return next;
}
