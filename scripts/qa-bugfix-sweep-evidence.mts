import { store } from "../src/project/store.ts";
import { createBlankProject } from "../src/project/defaults.ts";
import {
  getMapEditHistoryState,
  recordProjectSnapshot,
  resetMapEditHistory,
  undoMapEdit,
} from "../src/editor/mapEditHistory.ts";
import { deleteSwitch } from "../src/editor/actions.ts";
import { findUnused } from "../src/editor/tools/refactorTools.ts";
import {
  _resetEventDraftVaultForTest,
  eventDraftVaultStorageKey,
  persistEventDraftVaultNow,
  rememberEventDraftVaultEntry,
} from "../src/project/eventDraftVault.ts";
import type { Project } from "../src/project/types.ts";

export type EvidenceRow = {
  readonly id: string;
  readonly asked: string;
  readonly observed: string;
  readonly verdict: "PASS" | "FAIL";
};

const firstMapId = (project: Project = store.getCurrent()): string => Object.keys(project.maps)[0]!;
const currentMapName = (): string => store.getCurrent().maps[firstMapId()]!.name;

function projectWithMapNamed(mapName: string): Project {
  const project = createBlankProject();
  project.maps[firstMapId(project)]!.name = mapName;
  return project;
}

function undoAcrossProjectSwitch(): EvidenceRow {
  store.replace(projectWithMapNamed("이전 프로젝트 맵"));
  resetMapEditHistory();
  recordProjectSnapshot("맵 이름 변경");
  store.update((draft) => {
    draft.maps[firstMapId(draft)]!.name = "수정된 이전 맵";
  });
  const canUndoBefore = getMapEditHistoryState().canUndo;
  store.replaceProject(projectWithMapNamed("새 프로젝트 맵"));
  const canUndoAfter = getMapEditHistoryState().canUndo;
  const undoReturned = undoMapEdit();
  const nameAfterUndo = currentMapName();
  return {
    id: "A. Ctrl+Z 교차 오염",
    asked: "프로젝트를 갈아탄 뒤 Ctrl+Z 가 이전 프로젝트의 맵을 되살리면 안 된다",
    observed: `교체 전 canUndo=${canUndoBefore} / 교체 후 canUndo=${canUndoAfter} / undoMapEdit()=${undoReturned} / 되돌린 뒤 맵 이름="${nameAfterUndo}"`,
    verdict: canUndoBefore && !canUndoAfter && !undoReturned && nameAfterUndo === "새 프로젝트 맵" ? "PASS" : "FAIL",
  };
}

function deleteGuardSeesGroupCondition(): EvidenceRow {
  store.replace(createBlankProject());
  store.update((project) => {
    project.switches = [{ id: "sw_only_in_group", name: "묶음 안 스위치" }];
    const map = project.maps[firstMapId(project)]!;
    map.events = [...map.events, {
      id: "ev_group_gate",
      x: 4,
      y: 4,
      trigger: { kind: "action" },
      commands: [],
      pages: [{
        id: "p_group",
        name: "묶음 조건 페이지",
        conditions: [{ kind: "all", conditions: [{ kind: "switch", switchId: "sw_only_in_group", value: true }] }],
        graphic: {},
        trigger: { kind: "action" },
        priority: "same",
        movement: { type: "fixed", speed: 3, frequency: 3 },
        commands: [],
      }],
    } as never];
  });
  const result = deleteSwitch("sw_only_in_group");
  const survived = store.getCurrent().switches.some((entry) => entry.id === "sw_only_in_group");
  return {
    id: "B. 삭제 가드 (묶음 조건)",
    asked: "AND 그룹 안에서만 쓰이는 스위치는 안내와 함께 삭제가 막혀야 한다",
    observed: `deleteSwitch()=${JSON.stringify(result)} / 스위치 생존=${survived}`,
    verdict: result.ok === false && survived ? "PASS" : "FAIL",
  };
}

function pruneKeepsInputNumberVariable(): EvidenceRow {
  const project = createBlankProject();
  project.variables = [{ id: "var_only_input", name: "입력 전용 변수" }];
  const map = project.maps[firstMapId(project)]!;
  map.events = [...map.events, {
    id: "ev_input",
    x: 5,
    y: 5,
    trigger: { kind: "action" },
    commands: [{ kind: "inputNumber", variableId: "var_only_input", digits: 2 }],
    pages: [],
  } as never];
  const unused = findUnused(project);
  return {
    id: "C. prune_unused 참조 수집",
    asked: "숫자 입력 명령만 쓰는 변수는 미사용으로 보고되면 안 된다",
    observed: `findUnused().variables=${JSON.stringify(unused.variables)}`,
    verdict: unused.variables.includes("var_only_input") ? "FAIL" : "PASS",
  };
}

async function explicitPersistLeavesNoDuplicateWrite(vaultWrites: string[]): Promise<EvidenceRow> {
  _resetEventDraftVaultForTest();
  vaultWrites.length = 0;
  const key = eventDraftVaultStorageKey();
  rememberEventDraftVaultEntry(firstMapId(), {
    id: "draft-event",
    x: 1,
    y: 1,
    trigger: { kind: "action" },
    commands: [],
    pages: [],
    draft: { kind: "new" },
  } as never);
  persistEventDraftVaultNow();
  const immediate = vaultWrites.filter((entry) => entry === key).length;
  await new Promise<void>((resolve) => setTimeout(resolve, 420));
  const afterDebounceWindow = vaultWrites.filter((entry) => entry === key).length;
  return {
    id: "D. 초안 보관함 중복 쓰기",
    asked: "명시적 저장 뒤 250ms 디바운스가 같은 내용을 다시 쓰면 안 된다",
    observed: `즉시 저장 직후 쓰기=${immediate}회 / 디바운스 창(420ms) 경과 후=${afterDebounceWindow}회`,
    verdict: immediate === 1 && afterDebounceWindow === 1 ? "PASS" : "FAIL",
  };
}

export async function collectEvidence({ vaultWrites }: { readonly vaultWrites: string[] }): Promise<EvidenceRow[]> {
  return [
    undoAcrossProjectSwitch(),
    deleteGuardSeesGroupCondition(),
    pruneKeepsInputNumberVariable(),
    await explicitPersistLeavesNoDuplicateWrite(vaultWrites),
  ];
}
