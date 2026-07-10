import { getMapEditHistoryDepth, truncateMapEditHistoryToDepth } from "@/editor/mapEditHistory";
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
  // 세션이 열릴 때의 undo 스택 깊이 — discard 시 이 깊이로 되감아 세션 중 쌓인
  // 스냅샷을 폐기한다(폐기한 변경이 Ctrl+Z 로 되살아나는 것을 방지).
  const historyDepthAtOpen = getMapEditHistoryDepth();

  return {
    discard: () => {
      store.replace(structuredClone(snapshot));
      truncateMapEditHistoryToDepth(historyDepthAtOpen);
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
