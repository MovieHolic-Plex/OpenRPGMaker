// util/appStorage.ts
// localStorage 키 접두사와 구 접두사 마이그레이션.
//
// 왜 이 파일이 있나 —
// 2026-08-21 전면 개명에서 저장 키 접두사를 `rpg-zzu` → `oprn`(PRODUCT_SLUG) 으로
// 옮겼다. 그냥 바꾸면 **사용자가 쌓아둔 설정이 전부 날아간다** — 편집기 모드, 좌패널
// 폭, AI 대화, 세이브 슬롯, 데이터베이스 탭 위치 등 48개 키다.
//
// 접근 방식: 호출부는 그대로 `localStorage.getItem("oprn:...")` 를 쓰고(간단·검증 쉬움),
// 부팅 시 **한 번** 전체 키를 훑어 구 접두사를 새 접두사로 옮긴다. 키마다 폴백 분기를
// 심는 방식은 호출부 48곳을 다 고쳐야 하고 빠뜨리기 쉽다.
//
// 구 접두사는 두 형태였다 — `rpg-zzu:` (대부분) 와 `rpg-zzu.` (데이터베이스·AI 위치 등).
// 새 접두사는 `oprn:` 하나로 정규화한다.

import { PRODUCT_SLUG } from "@/brand";

/** 새 접두사. 키 리터럴은 호출부에 그대로 적혀 있고, 이 값과 일치하는지 테스트가 지킨다. */
export const STORAGE_PREFIX = `${PRODUCT_SLUG}:`;

/**
 * 구 접두사. 세 형태가 있었다 — 콜론(대부분), 점(데이터베이스·AI 위치), 하이픈(세션 id).
 * 하이픈 형태는 실측에서 발견했다: 부팅 후 `rpg-zzu-editor-session-id` 만 남아 있었다.
 *
 * ⚠ 순서 주의: `rpg-zzu-` 가 마지막이어야 한다. 만약 먼저 오면 `rpg-zzu-editor-...` 를
 * 잡기 전에 다른 형태를 가로챌 일은 없지만, 접두사가 서로의 부분집합이 되는 경우를
 * 대비해 더 구체적인(구분자가 명확한) 것부터 검사한다.
 */
const LEGACY_PREFIXES = ["rpg-zzu:", "rpg-zzu.", "rpg-zzu-"] as const;

/** 마이그레이션을 이미 돌렸는지 표시 — 매 부팅마다 전체 키를 훑지 않는다. */
const MIGRATION_DONE_KEY = `${STORAGE_PREFIX}storage-migrated`;

export type StorageMigrationResult = {
  readonly moved: number;
  readonly skipped: number;
  readonly alreadyDone: boolean;
};

function legacySuffix(key: string): string | null {
  for (const prefix of LEGACY_PREFIXES) {
    if (key.startsWith(prefix)) return key.slice(prefix.length);
  }
  return null;
}

/**
 * 구 접두사 키를 새 접두사로 옮긴다. 부팅 시 한 번 호출한다(main.ts).
 *
 * - 새 키가 **이미 있으면** 덮지 않고 구 키만 버린다 (새 값이 최신이라고 본다).
 * - 실패(quota/private mode)는 조용히 넘긴다 — 저장 못 하는 환경에서 부팅을 막을 이유가 없다.
 */
export function migrateLegacyStorageKeys(storage?: Storage | null): StorageMigrationResult {
  const store = resolveStorage(storage);
  if (!store) return { moved: 0, skipped: 0, alreadyDone: false };
  try {
    if (store.getItem(MIGRATION_DONE_KEY) === "1") {
      return { moved: 0, skipped: 0, alreadyDone: true };
    }
    // 순회 중 삭제하면 인덱스가 밀린다 — 키 목록을 먼저 뜬다.
    const keys: string[] = [];
    for (let index = 0; index < store.length; index += 1) {
      const key = store.key(index);
      if (key !== null) keys.push(key);
    }
    let moved = 0;
    let skipped = 0;
    for (const key of keys) {
      const suffix = legacySuffix(key);
      if (suffix === null) continue;
      const nextKey = `${STORAGE_PREFIX}${suffix}`;
      const value = store.getItem(key);
      if (value === null) {
        store.removeItem(key);
        continue;
      }
      if (store.getItem(nextKey) !== null) {
        store.removeItem(key);
        skipped += 1;
        continue;
      }
      store.setItem(nextKey, value);
      store.removeItem(key);
      moved += 1;
    }
    store.setItem(MIGRATION_DONE_KEY, "1");
    return { moved, skipped, alreadyDone: false };
  } catch {
    return { moved: 0, skipped: 0, alreadyDone: false };
  }
}

function resolveStorage(storage?: Storage | null): Storage | null {
  if (storage !== undefined) return storage;
  try {
    if (typeof localStorage === "undefined") return null;
    return localStorage;
  } catch {
    return null;
  }
}

/** 테스트 헬퍼 — 마이그레이션 완료 표시를 지워 다시 돌릴 수 있게 한다. */
export function resetStorageMigrationFlagForTests(storage?: Storage | null): void {
  const store = resolveStorage(storage);
  try {
    store?.removeItem(MIGRATION_DONE_KEY);
  } catch {
    /* ignore */
  }
}
