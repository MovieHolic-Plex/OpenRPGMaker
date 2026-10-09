// 내보낸 게임의 세이브 네임스페이스 접두사 — 플레이어(src/player)와 커뮤니티 사이트(community-site/lib)가
// 같은 값을 써야 하므로 의존이 없는 이 파일에 둔다. 커뮤니티 사이트는 `@/` 별칭 없이 상대 경로로
// src 를 가져오므로 여기서도 상대 경로만 쓴다.
import { PRODUCT_SLUG } from "../brand";

/** 뒤에 프로젝트 id 나 커뮤니티 slug 가 붙어 `oprn-export:<id>` 가 된다. */
export const EXPORT_SAVE_NAMESPACE_PREFIX = `${PRODUCT_SLUG}-export:` as const;

/**
 * 2026-09 제품명 스윕 전 접두사 — **입양 전용**. 플레이어 브라우저의 localStorage 에 이 접두사로 저장된
 * 세이브가 남아 있으므로, 첫 부팅에서 같은 게임의 키를 새 접두사로 복사할 때만 쓴다(saveSlots.adoptLegacyExportSaves).
 * 새로 쓰는 키에는 절대 쓰지 않는다.
 */
export const LEGACY_EXPORT_SAVE_NAMESPACE_PREFIX = "rpgzzu-export:";

/** 새 네임스페이스에 대응하는 옛 네임스페이스. 접두사가 다르면(호스트가 주입한 임의 값) 대응이 없다. */
export function legacyExportSaveNamespace(namespace: string): string | undefined {
  if (!namespace.startsWith(EXPORT_SAVE_NAMESPACE_PREFIX)) return undefined;
  return `${LEGACY_EXPORT_SAVE_NAMESPACE_PREFIX}${namespace.slice(EXPORT_SAVE_NAMESPACE_PREFIX.length)}`;
}
