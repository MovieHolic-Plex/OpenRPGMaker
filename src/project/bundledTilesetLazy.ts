// 아직 되돌리지 않은(지연) 번들 타일셋 표지. 의존이 없는 작은 모듈이라 io/shape.ts 같은 검사 계층도 순환 없이 읽는다.
// 만드는 쪽과 계약은 bundledTilesetDiff.ts 「지연 되돌리기」.

const pending = new WeakSet<object>();
const materialized: string[] = [];
const fresh = new WeakSet<object>();

/**
 * 이 빌드가 구운 «정규화한 새 번들 타일셋» 보기(bundledTilesetFreshViews.json)에서 만든 타일셋 항목인가.
 * 그 값은 이미 부팅 정규화를 거친 모양이라(구울 때 같은 정규화기를 돌렸다) 정규화기는 건너뛴다 — 지연 항목을 되돌리지 않는다.
 * 스토어는 타일셋 항목을 제자리에서 고치지 않으므로(projectClone 계약) 표지는 객체가 사는 동안 맞다. 만드는 쪽은 freshStarter.ts.
 */
export function isFreshBundledTileset(value: unknown): boolean {
  return typeof value === "object" && value !== null && fresh.has(value);
}

export function markFreshBundledTileset(value: object): void {
  fresh.add(value);
}

/** 이 객체가 아직 번들 정의를 읽지 않은 지연 타일셋인가(무거운 필드를 읽으면 그때 되돌린다). */
export function isPendingLazyTileset(value: unknown): boolean {
  return typeof value === "object" && value !== null && pending.has(value);
}

export function markPendingLazyTileset(value: object): void {
  pending.add(value);
}

export function markLazyTilesetMaterialized(value: object, id: string): void {
  pending.delete(value);
  materialized.push(id);
  // 계측: 무엇이 되돌렸는지 보려면 콘솔에서 globalThis.__oprnLazyTraceStacks = [] 를 먼저 둔다.
  const stacks = (globalThis as { __oprnLazyTraceStacks?: string[] }).__oprnLazyTraceStacks;
  if (Array.isArray(stacks)) stacks.push(`${id}\n${new Error().stack ?? ""}`);
}

/** 계측용: 이 세션에서 지연 타일셋이 되돌려진 순서(id). */
export function lazyTilesetMaterializations(): readonly string[] {
  return materialized;
}

if (typeof globalThis !== "undefined") {
  (globalThis as { __oprnLazyTilesets?: () => readonly string[] }).__oprnLazyTilesets = lazyTilesetMaterializations;
}
