import { serialize } from "@/project/io";
import { store } from "@/project/store";
import type { Project } from "@/project/types";

export type DatabaseModalDirtySession = {
  readonly discard: () => void;
  readonly isDirty: () => boolean;
  readonly markClean: () => void;
};

export function createDatabaseModalDirtySession(): DatabaseModalDirtySession {
  let snapshot = cloneCurrentProject();
  let cleanSignature = projectSignature(snapshot);

  return {
    discard: () => {
      store.replace(structuredClone(snapshot));
    },
    isDirty: () => projectSignature(store.getCurrent()) !== cleanSignature,
    markClean: () => {
      snapshot = cloneCurrentProject();
      cleanSignature = projectSignature(snapshot);
    },
  };
}

function cloneCurrentProject(): Project {
  return structuredClone(store.getCurrent());
}

function projectSignature(project: Project): string {
  return serialize(project);
}
