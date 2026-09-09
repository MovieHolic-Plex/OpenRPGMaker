import type { LegacySpatialImportReceipt } from "./types";

/** Compatibility-only inspection for converter previews and AI adapters, not space geometry. */
export type LegacySpatialConstraintInspection = {
  readonly kind: "legacy-compatibility-constraints";
} & Pick<LegacySpatialImportReceipt, "roomKinds">;

export function inspectLegacySpatialConstraints(receipt: LegacySpatialImportReceipt): LegacySpatialConstraintInspection {
  return {
    kind: "legacy-compatibility-constraints",
    ...(receipt.roomKinds === undefined ? {} : { roomKinds: receipt.roomKinds }),
  };
}
