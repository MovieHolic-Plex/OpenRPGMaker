import type { SmallTaskScope } from "@/ai/smallTaskScope";
import { PrimitiveError } from "../errors";
import type { PrimitiveContext, SmallTaskPrimitive } from "../types";

/** Bind scopes returned by units to the host's selection before applying the operation. */
export function primitiveScope(
  ctx: PrimitiveContext, primitive: SmallTaskPrimitive, args: Record<string, unknown>,
): SmallTaskScope {
  const scope = primitive.scope(ctx, args);
  const { target } = ctx;
  if (scope.kind === "dbEntries" || scope.kind === "dbRemove") {
    const rows = scope.kind === "dbRemove" ? [scope] : scope.entries;
    if (target.kind !== "dbEntry" || rows.some(row => row.collection !== target.collection || row.id !== target.id)) {
      throw new PrimitiveError("범위 밖: 선택한 자료집 항목만 바꿀 수 있어요.");
    }
    if (scope.kind === "dbRemove" || scope.remove) {
      return { kind: "dbRemove", collection: target.collection, id: target.id };
    }
  }
  return scope;
}
