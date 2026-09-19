import { getMapEditHistoryMarker, truncateMapEditHistoryFromMarker } from "@/editor/mapEditHistory";
import { serialize } from "@/project/io";
import { store } from "@/project/store";
import type { Project } from "@/project/types";

export type DatabaseModalDirtySession = {
  readonly discard: () => void;
  readonly isDirty: () => boolean;
  readonly markClean: () => void;
};

/**
 * DB 모달의 「열 때 상태로 되돌리고 닫기」 세션.
 *
 * **범위는 맵을 뺀 프로젝트다.** 예전에는 스냅샷·서명·복원이 전부 프로젝트 전체여서, 도크
 * 모드로 맵을 칠한 뒤 DB 를 되돌리면 **맵 편집까지 통째로 사라졌다**(2026-09-19 리뷰 P0-7).
 * 도크는 `dock.css` 의 포인터 통과로 맵 병행 편집을 정식 허용하므로 그건 예외가 아니라
 * 정상 흐름이었다. 프롬프트가 약속하는 것도 "이 모달을 연 시점의 **DB 상태**로 복구"다 —
 * 구현을 문구에 맞춘다.
 *
 * 히스토리 절단은 **유지한다.** 「버린 편집이 Ctrl+Z 로 부활하지 않는다」는 의도된 불변식이고
 * (test/databaseModalDirtySession.test.ts 가 MAX_HISTORY 포화 회귀까지 포함해 잠가 둔다),
 * 스냅샷이 프로젝트 전체 단위라 DB 엔트리만 골라 자를 수 없다.
 * 남는 한계: 세션 중 도크로 칠한 맵은 **살아남지만** 그 되돌리기 엔트리는 함께 버려진다.
 * 편집 소실보다 훨씬 작은 손해라 여기서 멈춘다 — 스코프별 히스토리는 별도 과제.
 */
export function createDatabaseModalDirtySession(): DatabaseModalDirtySession {
  let snapshot = cloneCurrentProject();
  let cleanSignature = projectSignature(snapshot);
  // 세션이 열릴 때의 히스토리 마커 — discard 시 이 마커 이후에 생성된 엔트리만 전부
  // 폐기한다(폐기한 변경이 Ctrl+Z 로 되살아나는 것을 방지). 마커는 단조 증가 시퀀스라
  // MAX_HISTORY 포화로 배열 길이가 shift 로 상쇄돼도 정확히 세션 이전/이후를 가른다.
  const historyMarkerAtOpen = getMapEditHistoryMarker();

  return {
    discard: () => {
      const current = store.getCurrent();
      // 맵은 이 세션의 소유가 아니다 — 현재 값을 그대로 넘겨 살린다.
      store.replace({ ...structuredClone(snapshot), maps: current.maps, mapTree: current.mapTree });
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

/**
 * 맵을 뺀 서명. 맵을 넣으면 도크 중 타일 한 칸만 칠해도 dirty 가 되어, 되돌리지도 않을
 * 변경을 두고 「저장할까요?」를 묻게 된다.
 */
function projectSignature(project: Project): string {
  const { maps: _maps, mapTree: _mapTree, ...withoutMaps } = project;
  return serialize(withoutMaps as Project);
}
