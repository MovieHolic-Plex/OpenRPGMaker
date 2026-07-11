import { getMapEditHistoryMarker, truncateMapEditHistoryFromMarker } from "@/editor/mapEditHistory";
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
  // 세션이 열릴 때의 히스토리 마커 — discard 시 이 마커 이후에 생성된 엔트리만 전부
  // 폐기한다(폐기한 변경이 Ctrl+Z 로 되살아나는 것을 방지). 마커는 단조 증가 시퀀스라
  // MAX_HISTORY 포화로 배열 길이가 shift 로 상쇄돼도 정확히 세션 이전/이후를 가른다.
  const historyMarkerAtOpen = getMapEditHistoryMarker();

  return {
    discard: () => {
      store.replace(structuredClone(snapshot));
      truncateMapEditHistoryFromMarker(historyMarkerAtOpen);
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
