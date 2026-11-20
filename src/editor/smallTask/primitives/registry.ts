import type { SmallTaskTarget } from "../target";
import { PRIMITIVES } from "./index";
import type { SmallTaskPrimitive } from "./types";

export function createPrimitiveRegistry(primitives: readonly SmallTaskPrimitive[]) {
  const byId = new Map<string, SmallTaskPrimitive>();
  for (const primitive of primitives) {
    if (byId.has(primitive.id)) throw new Error(`작은 일 동작 이름이 중복되었습니다: ${primitive.id}`);
    byId.set(primitive.id, primitive);
  }

  function getPrimitive(id: string): SmallTaskPrimitive | undefined {
    const visited = new Set<string>();
    let primitive = byId.get(id);
    while (primitive?.aliasOf) {
      if (visited.has(primitive.id)) throw new Error(`작은 일 동작 별칭이 순환합니다: ${id}`);
      visited.add(primitive.id);
      primitive = byId.get(primitive.aliasOf);
    }
    return primitive;
  }

  for (const { id, aliasOf } of primitives) if (aliasOf) getPrimitive(id);

  function primitivesForTarget(target: SmallTaskTarget): SmallTaskPrimitive[] {
    return primitives.filter(primitive => {
      if (primitive.hidden || !primitive.targets.includes(target.kind)) return false;
      const resolved = getPrimitive(primitive.id);
      return resolved?.targets.includes(target.kind) &&
        (target.kind !== "dbEntry" || !resolved.covers.collections || resolved.covers.collections.includes(target.collection));
    });
  }

  return { getPrimitive, primitivesForTarget };
}

export const { getPrimitive, primitivesForTarget } = createPrimitiveRegistry(PRIMITIVES);
