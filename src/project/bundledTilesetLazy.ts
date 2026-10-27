// 아직 되돌리지 않은(지연) 번들 타일셋 표지. 의존이 없는 작은 모듈이라 io/shape.ts 같은 검사 계층도 순환 없이 읽는다.
// 만드는 쪽과 계약은 bundledTilesetDiff.ts 「지연 되돌리기」.

const pending = new WeakSet<object>();
const materialized: string[] = [];

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
