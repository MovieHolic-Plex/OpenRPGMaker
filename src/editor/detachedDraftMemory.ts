// Editor-only memory attached to Project object identities.
// Values in this store are never serialized with authored project data. Draft clones must
// explicitly transfer memory so approval previews can keep harness sessions without adding
// project/runtime schema fields.
const memoryByDraft = new WeakMap<object, Map<string, unknown>>();

function memoryFor(draft: object, create: boolean): Map<string, unknown> | undefined {
  let memory = memoryByDraft.get(draft);
  if (!memory && create) {
    memory = new Map<string, unknown>();
    memoryByDraft.set(draft, memory);
  }
  return memory;
}

export function getDetachedDraftMemory<T>(draft: object, key: string): T | undefined {
  return memoryFor(draft, false)?.get(key) as T | undefined;
}

export function setDetachedDraftMemory<T>(draft: object, key: string, value: T): void {
  memoryFor(draft, true)!.set(key, value);
}

/** Clone project JSON and independently clone editor-only memory. */
export function cloneDetachedDraft<T extends object>(draft: T): T {
  const clone = structuredClone(draft);
  transferDetachedDraftMemory(draft, clone);
  return clone;
}

/** Transfer all detached namespaces without sharing mutable session objects. */
export function transferDetachedDraftMemory(from: object, to: object): void {
  const source = memoryFor(from, false);
  if (!source) return;
  const target = new Map<string, unknown>();
  for (const [key, value] of source) target.set(key, structuredClone(value));
  memoryByDraft.set(to, target);
}
