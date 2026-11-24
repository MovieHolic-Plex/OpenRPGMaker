// project/databasePresetRecords.ts — 자료집 레코드가 엔진 기본 프리셋 그대로인가.
//
// 새 프로젝트는 주인공 136·직업 136·스킬 1,243·아이템 1,000… 기본 프리셋 2,714개를 싣고 태어난다. AI 초안이 만든 것과
// 작가가 고친 것은 그 사이에 묻혀 보이지 않았다(ideal-flow-draft 4번, 오너 2026-11-24). 기준은 빈 프로젝트 자체다:
// 같은 id 의 기본 레코드와 값까지 같으면 프리셋, id 가 없거나 값이 하나라도 다르면 「이 게임 것」.
import { createBlankProject } from "./defaults";
import { applyDefaultElementAffinities } from "./defaults/defaultElementAffinities";
import { createStarterBlankProject } from "./defaults/slimStarter";

let factoryIndex: Map<string, Map<string, Set<string>>> | undefined;
const verdicts = new WeakMap<object, boolean>();

// 새 프로젝트가 태어나는 세 갈래(전체 기본 DB · 슬림 스타터 · 장르 팩 = 전체 + 예시 상성)가 다듬은 레코드도 엔진 것이다.
function factoryDatabases(): readonly Record<string, unknown>[] {
  const full = createBlankProject();
  const genre = createBlankProject();
  applyDefaultElementAffinities(genre.database.enemies, genre.database.elements ?? []);
  return [full, createStarterBlankProject(), genre].map((project) => project.database as unknown as Record<string, unknown>);
}

function index(): Map<string, Map<string, Set<string>>> {
  if (factoryIndex) return factoryIndex;
  factoryIndex = new Map();
  for (const database of factoryDatabases()) {
    for (const [collection, list] of Object.entries(database)) {
      if (!Array.isArray(list)) continue;
      const byId = factoryIndex.get(collection) ?? new Map<string, Set<string>>();
      for (const record of list) {
        const id = typeof record === "object" && record !== null ? (record as { readonly id?: unknown }).id : undefined;
        if (typeof id !== "string") continue;
        const variants = byId.get(id) ?? new Set<string>();
        variants.add(JSON.stringify(record));
        byId.set(id, variants);
      }
      factoryIndex.set(collection, byId);
    }
  }
  return factoryIndex;
}

export function isPresetDatabaseRecord(collection: string, record: { readonly id: string }): boolean {
  const cached = verdicts.get(record);
  if (cached !== undefined) return cached;
  const preset = index().get(collection)?.get(record.id)?.has(JSON.stringify(record)) ?? false;
  verdicts.set(record, preset);
  return preset;
}

/** 이 컬렉션에서 프리셋이 아닌 레코드 수 — 0 이면 「이 게임 것만」 거르기는 아무것도 남기지 않으므로 꺼 둔다. */
export function countGameDatabaseRecords(collection: string, records: readonly { readonly id: string }[]): number {
  return records.filter((record) => !isPresetDatabaseRecord(collection, record)).length;
}
