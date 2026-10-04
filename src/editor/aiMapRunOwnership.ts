import { store } from "@/project/store";

/** Persistence identity is shared across tabs; an unsaved fixture has a session identity. */
export function aiProjectRunKey(): string {
  const status = store.getDbPersistenceStatus();
  // Use canonical identity, so localhost/domain aliases of one host cannot split a lock.
  if (status.kind === "ready" && status.projectId.trim()) return JSON.stringify(["project", status.projectId]);
  return JSON.stringify(store.getProjectIdentity());
}
