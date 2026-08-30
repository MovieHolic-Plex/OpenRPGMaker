// 영역 작업이 맵에 반영된 뒤 드래그 선택이 남지 않는다는 계약.
//
// 실측 신고: 「'영역 작업'을 통해서 ai 작업을 하고 나서 여전히 드래그 한 게 남아있다」.
// 적용이 끝나면 그 사각형은 「지금 무엇을 고를지」가 아니라 「방금 무엇이 바뀌었는지」를
// 가리키는 낡은 표시가 되고, 그 위에 선택 액션 칩(복사·지우기·구조물로 저장·AI)이 계속 떠
// 있어서 다음 클릭이 새로 만들어진 내용에 대한 지시로 오인된다.
//
// 초크포인트는 `applyRegionProjectWithHistory` — 영역 작업(AI 실행)과 직접 실내 초안이
// 공유하는 단일 store 반영 경로다. 즉시 적용·승인 후 적용·부분 적용·캔버스 인라인 수락·
// 헤드리스 적용이 모두 이 함수를 지난다.
import { beforeEach, describe, expect, it } from "vitest";
import { editorState } from "@/editor/editorState";
import { resetMapEditHistory } from "@/editor/mapEditHistory";
import {
  __clearPendingRegionApplyForTest,
  setPendingRegionApply,
} from "@/editor/regionTask/pendingRegionApply";
import { applyRegionProjectWithHistory } from "@/editor/regionTask/runRegionTask";
import { createBlankProject } from "@/project/defaults";
import { _resetEventDraftVaultForTest } from "@/project/eventDraftVault";
import { store } from "@/project/store";
import type { MapId, Project } from "@/project/types";

const REGION = { x: 0, y: 0, width: 2, height: 2 } as const;
const OTHER_MAP_ID = "map-other";

function startMapId(): MapId {
  return store.getCurrent().startMapId;
}

/** 영역 안 한 칸을 바꾼 초안. 실제 적용에 값이 필요한 곳은 lowerTiles 뿐이다. */
function draftWithRegionEdit(): Project {
  const draft = structuredClone(store.getCurrent());
  const map = draft.maps[startMapId()]!;
  map.lowerTiles[0] = map.lowerTiles[0] === 1 ? 2 : 1;
  return draft;
}

function selectRegionOn(mapId: MapId): void {
  editorState.set({ selection: { mapId, ...REGION } });
}

beforeEach(() => {
  _resetEventDraftVaultForTest();
  __clearPendingRegionApplyForTest();
  const project = createBlankProject();
  const start = project.maps[project.startMapId]!;
  project.maps[OTHER_MAP_ID] = { ...structuredClone(start), id: OTHER_MAP_ID, name: "다른 맵" };
  store.replaceProject(project);
  resetMapEditHistory();
  editorState.set({ selection: null, pastePreview: null });
});

describe("영역 작업 적용 후 드래그 선택", () => {
  it("적용된 맵의 선택은 해제된다", () => {
    selectRegionOn(startMapId());

    applyRegionProjectWithHistory(draftWithRegionEdit(), "영역 작업: 테스트", startMapId());

    expect(editorState.get().selection).toBeNull();
  });

  it("승인 게이트를 지나 적용해도 해제된다", () => {
    const mapId = startMapId();
    selectRegionOn(mapId);
    const base = store.getCurrent();
    const pending = setPendingRegionApply({
      baseProject: base,
      clippedProject: draftWithRegionEdit(),
      mapId,
      region: REGION,
      changedCells: 1,
      changedEvents: 0,
      instruction: "테스트",
      getCurrentProject: () => store.getCurrent(),
      onApply: (project) => { applyRegionProjectWithHistory(project, "영역 작업: 테스트", mapId); },
      onDiscard: () => undefined,
      onSettle: () => undefined,
    });

    const outcome = pending.apply();

    expect(outcome.error ?? "", "적용이 차단되면 이 계약을 검증할 수 없다").toBe("");
    expect(outcome.applied).toBe(true);
    expect(editorState.get().selection).toBeNull();
  });

  it("버리면 선택은 남는다 — 다시 지시할 대상이 그 영역이다", () => {
    const mapId = startMapId();
    selectRegionOn(mapId);
    const pending = setPendingRegionApply({
      baseProject: store.getCurrent(),
      clippedProject: draftWithRegionEdit(),
      mapId,
      region: REGION,
      changedCells: 1,
      changedEvents: 0,
      instruction: "테스트",
      getCurrentProject: () => store.getCurrent(),
      onApply: (project) => { applyRegionProjectWithHistory(project, "영역 작업: 테스트", mapId); },
      onDiscard: () => undefined,
      onSettle: () => undefined,
    });

    pending.discard();

    expect(editorState.get().selection).toEqual({ mapId, ...REGION });
  });

  it("다른 맵에서 고른 영역은 건드리지 않는다", () => {
    selectRegionOn(OTHER_MAP_ID);

    applyRegionProjectWithHistory(draftWithRegionEdit(), "영역 작업: 테스트", startMapId());

    expect(editorState.get().selection).toEqual({ mapId: OTHER_MAP_ID, ...REGION });
  });
});
