import { getMapEditHistoryMarker, truncateMapEditHistoryFromMarker } from "@/editor/mapEditHistory";
import { serialize } from "@/project/io";
import { cloneProjectSharingReferenceDocuments } from "@/project/projectClone";
import { store } from "@/project/store";
import type { Project } from "@/project/types";

export type DatabaseModalDirtySession = {
  readonly discard: () => void;
  readonly isDirty: () => boolean;
  readonly markClean: () => void;
  /** 창이 실제로 열리는 순간을 세션 기준으로 잡는다(미리 만들어 둔 창이 보여질 때). */
  readonly begin: () => void;
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
export function createDatabaseModalDirtySession(options: { readonly deferred?: boolean } = {}): DatabaseModalDirtySession {
  // 미리 만들어 두는 창(prewarm)은 부팅 직후에 만들어진다. 그때 복사하면 부팅이 프로젝트 사본과 서명에 약 2s 를 쓰고
  // (2026-09-26 실측), 실제로 열 때는 그 사이의 DB 편집이 빠진 부팅 시점 사본으로 되돌렸다. 열 때 잡는다.
  let snapshot: Project | null = null;
  let cleanSignature: string | null = null;
  let historyMarkerAtOpen = 0;
  const begin = (): void => {
    // store 는 변경마다 새 프로젝트 객체로 교체하고 호출자는 getCurrent() 를 제자리에서 고치지 않는다.
    // 그래서 열 때는 참조만 잡고, 복사는 실제로 되돌릴 때 한다 — 실측(2026-09-26) 열 때마다 복사하면
    // 팀 호스트 프로젝트에서 첫 클릭이 1s 더 걸렸다.
    snapshot = store.getCurrent();
    // 서명은 실제로 비교할 때 만든다. 열자마자 만들면 타일셋·자산까지 프로젝트 전체를 직렬화한다.
    cleanSignature = null;
    // 세션이 열릴 때의 히스토리 마커 — discard 시 이 마커 이후에 생성된 엔트리만 전부
    // 폐기한다(폐기한 변경이 Ctrl+Z 로 되살아나는 것을 방지). 마커는 단조 증가 시퀀스라
    // MAX_HISTORY 포화로 배열 길이가 shift 로 상쇄돼도 정확히 세션 이전/이후를 가른다.
    historyMarkerAtOpen = getMapEditHistoryMarker();
  };
  if (!options.deferred) begin();

  return {
    begin,
    discard: () => {
      if (!snapshot) return;
      const current = store.getCurrent();
      // 맵은 이 세션의 소유가 아니다 — 현재 값을 그대로 넘겨 살린다.
      store.replace({ ...cloneProjectSharingReferenceDocuments(snapshot), maps: current.maps, mapTree: current.mapTree });
      truncateMapEditHistoryFromMarker(historyMarkerAtOpen);
    },
    isDirty: () => {
      if (snapshot === null) return false;
      const current = store.getCurrent();
      // store 는 변경마다 프로젝트 객체를 교체한다 — 같은 객체면 변경이 없다.
      if (current === snapshot) return false;
      cleanSignature ??= projectSignature(snapshot);
      return projectSignature(current) !== cleanSignature;
    },
    markClean: begin,
  };
}

/**
 * 맵을 뺀 서명. 맵을 넣으면 도크 중 타일 한 칸만 칠해도 dirty 가 되어, 되돌리지도 않을
 * 변경을 두고 「저장할까요?」를 묻게 된다.
 */
function projectSignature(project: Project): string {
  const { maps: _maps, mapTree: _mapTree, ...withoutMaps } = project;
  return serialize(withoutMaps as Project);
}
