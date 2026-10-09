/**
 * Detached room-harness session storage. Sessions belong to an editor draft identity and are
 * deliberately absent from Project JSON, persistence, and runtime state.
 */
import { getDetachedDraftMemory, setDetachedDraftMemory } from "@/editor/detachedDraftMemory";
import type { Project } from "@/project/types";

type Bag<S> = Record<string, S>;

function bagOf<S>(project: Project, bagKey: string, create: boolean): Bag<S> | undefined {
  const key = `room-harness:${bagKey}`;
  let bag = getDetachedDraftMemory<Bag<S>>(project, key);
  if (!bag && create) {
    bag = {};
    setDetachedDraftMemory(project, key, bag);
  }
  return bag;
}

export function saveSession<S extends { id: string }>(project: Project, bagKey: string, session: S): void {
  const bag = bagOf<S>(project, bagKey, true)!;
  bag[session.id] = structuredClone(session);
}

export function loadSession<S>(project: Project, bagKey: string, id: string): S | undefined {
  const session = bagOf<S>(project, bagKey, false)?.[id];
  return session === undefined ? undefined : structuredClone(session);
}

export function listSessions<S>(project: Project, bagKey: string): readonly S[] {
  return Object.values(bagOf<S>(project, bagKey, false) ?? {}).map((session) => structuredClone(session));
}

export function sessionExists(project: Project, bagKey: string, id: string): boolean {
  return Boolean(bagOf<unknown>(project, bagKey, false)?.[id]);
}
