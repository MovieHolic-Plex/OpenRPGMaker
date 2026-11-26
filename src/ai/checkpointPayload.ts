import { SCHEMA_VERSION } from "@/project/types";
import { projectWireView } from "@/project/io/serialize";

// 빈 프로젝트의 wire 보기 하나가 약 9.7MiB 로 셈해진다(2026-11-26, 대부분 database 7.6MiB). 체크포인트는 현재 내용과 요청 기준선을
// 둘 다 싣는다 — 16MiB 에서는 새 프로젝트에서도 쓰기가 늘 «snapshot budget» 으로 실패했다(aiRunRecoveryRuntime, ci-full 매 판).
export const MAX_CHECKPOINT_BYTES = 64 * 1024 * 1024;

export type CheckpointProject = ReturnType<typeof projectWireView>;
export { projectWireView as checkpointProjectView };

export function isCheckpointProject(value: unknown): value is CheckpointProject {
  const record = (entry: unknown): entry is Record<string, unknown> =>
    entry !== null && typeof entry === "object" && !Array.isArray(entry);
  return record(value) && value.version === SCHEMA_VERSION && record(value.meta)
    && typeof value.meta.title === "string" && typeof value.meta.author === "string"
    && record(value.maps) && record(value.tilesets)
    && record(value.assets) && record(value.database);
}

/** Cap the work before cloning or hashing. Charge strings by UTF-16 length and
 * count each property. Structured clone preserves shared references. */
export function assertCheckpointData(value: unknown): void {
  let remaining = MAX_CHECKPOINT_BYTES;
  const ancestors = new Set<object>();
  const seen = new Set<object>();
  const malformed = () => new TypeError("Invalid checkpoint: malformed (dataOnly)");
  const charge = (bytes: number): void => {
    remaining -= bytes;
    if (remaining < 0) throw new RangeError(`Checkpoint exceeds the ${MAX_CHECKPOINT_BYTES / 1024 / 1024} MiB snapshot budget`);
  };
  function visit(entry: unknown, depth: number): void {
    charge(8);
    if (typeof entry === "string") { charge(2 * entry.length); return; }
    if (entry === null || entry === undefined || typeof entry === "boolean"
      || typeof entry === "number" && Number.isFinite(entry)) return;
    if (typeof entry !== "object" || depth > 100 || ancestors.has(entry)) throw malformed();
    if (seen.has(entry)) return;
    const array = Array.isArray(entry);
    const proto = Object.getPrototypeOf(entry);
    if (!array && proto !== Object.prototype && proto !== null) throw malformed();
    // A sparse array can be cheap to enumerate but costly to hash or clone.
    if (array) charge(8 * entry.length);
    ancestors.add(entry);
    for (const key of Reflect.ownKeys(entry)) {
      if (typeof key !== "string") throw malformed();
      if (array && key === "length") continue;
      charge(2 * key.length);
      const descriptor = Object.getOwnPropertyDescriptor(entry, key);
      if (!descriptor || !("value" in descriptor)) throw malformed();
      visit(descriptor.value, depth + 1);
    }
    ancestors.delete(entry);
    seen.add(entry);
  }
  visit(value, 0);
}
