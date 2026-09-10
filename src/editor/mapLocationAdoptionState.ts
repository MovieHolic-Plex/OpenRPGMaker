// editor/mapLocationAdoptionState.ts
// 「설계 영역 이관 도구」의 상태와 행위. DOM 을 만들지 않는다 — 창(mapLocationAdoptionPanel.ts)이
// 이 상태기계를 구독한다. 순수 규칙은 `project/mapLocationAdoption.ts` 가 갖는다.
//
// 계약(이 파일이 지키는 것):
//  - **열기는 읽기 전용이다.** `openAdoptionWorkbench()` 는 조사만 한다. store 를 만지지 않는다.
//  - **선택은 명시적이다.** 아무 맵도 안 골랐으면 실행 버튼이 아무 일도 하지 않는다.
//    "프로젝트 전체 자동 적용" 진입점은 존재하지 않는다.
//  - **되돌림은 한 덩어리다.** 여러 맵을 골라도 스냅샷 1건 + `store.update` 1회다.
//    (`recordProjectSnapshot` 을 맵마다 부르면 Ctrl+Z 를 맵 수만큼 눌러야 한다 — 그건 저작 사고다.)

import { store } from "@/project/store";
import { canEditMap, mapEditLockNotice } from "@/editor/mapEditLocks";
import { recordProjectSnapshot } from "@/editor/mapEditHistory";
import {
  DEFAULT_ADOPTION_ROLES,
  adoptLayoutRegionsForMaps,
  adoptionOutcomeIsNoop,
  describeAdoptionOutcome,
  surveyProjectAdoption,
  type AdoptionCollisionPolicy,
  type AdoptionOutcome,
  type ProjectAdoptionSurvey,
} from "@/project/mapLocationAdoption";

export const ADOPTION_HISTORY_LABEL = "설계 영역 이관";

export type AdoptionWorkbenchState = {
  readonly open: boolean;
  /** 선택된 맵 ID. 빈 집합 = 아무 일도 하지 않는다(기본값이 그렇다 — 열자마자 전체 선택은 함정이다). */
  readonly selectedMapIds: ReadonlySet<string>;
  readonly roles: readonly string[];
  readonly collisionPolicy: AdoptionCollisionPolicy;
  /** 마지막 실행 결과. 두 번째 실행이 멱등이라는 사실을 화면에 남기는 자리. */
  readonly lastOutcome: AdoptionOutcome | null;
  readonly lastError: string | null;
};

type Listener = (state: AdoptionWorkbenchState) => void;

let state: AdoptionWorkbenchState = {
  open: false,
  selectedMapIds: new Set(),
  roles: [...DEFAULT_ADOPTION_ROLES],
  collisionPolicy: "suffix",
  lastOutcome: null,
  lastError: null,
};
const listeners = new Set<Listener>();

export function adoptionWorkbenchState(): AdoptionWorkbenchState {
  return state;
}

export function subscribeAdoptionWorkbench(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function set(patch: Partial<AdoptionWorkbenchState>): void {
  state = { ...state, ...patch };
  for (const listener of listeners) listener(state);
}

/** 현재 필터로 본 프로젝트 조사. **읽기 전용** — 호출해도 프로젝트는 바뀌지 않는다. */
export function currentAdoptionSurvey(): ProjectAdoptionSurvey {
  return surveyProjectAdoption(store.getCurrent(), { roles: state.roles });
}

/** 창 열기. 조사만 한다(자동 승격 없음). */
export function openAdoptionWorkbench(): void {
  set({ open: true, lastOutcome: null, lastError: null });
}

export function closeAdoptionWorkbench(): void {
  set({ open: false });
}

export function toggleAdoptionMap(mapId: string, selected?: boolean): void {
  const next = new Set(state.selectedMapIds);
  const want = selected ?? !next.has(mapId);
  if (want) next.add(mapId);
  else next.delete(mapId);
  set({ selectedMapIds: next, lastError: null });
}

/** 조사에 보이는 맵 전부 선택/해제. 명시적 사용자 클릭이므로 "조용한 전체 적용"이 아니다. */
export function setAdoptionMapSelection(mapIds: readonly string[]): void {
  set({ selectedMapIds: new Set(mapIds), lastError: null });
}

export function toggleAdoptionRole(role: string, selected?: boolean): void {
  const has = state.roles.includes(role);
  const want = selected ?? !has;
  if (want === has) return;
  const next = want ? [...state.roles, role] : state.roles.filter((entry) => entry !== role);
  set({ roles: next, lastOutcome: null, lastError: null });
}

export function resetAdoptionRoles(): void {
  set({ roles: [...DEFAULT_ADOPTION_ROLES], lastOutcome: null, lastError: null });
}

export function setAdoptionCollisionPolicy(policy: AdoptionCollisionPolicy): void {
  set({ collisionPolicy: policy, lastOutcome: null, lastError: null });
}

export type AdoptionRunResult =
  | { readonly ok: true; readonly outcome: AdoptionOutcome; readonly message: string }
  | { readonly ok: false; readonly error: string };

/**
 * 선택된 맵에 대해 승격을 실행한다.
 *
 * 스냅샷 1건 + `store.update` 1회 = **Ctrl+Z 한 번으로 전부 되돌아간다.** 여러 맵을 골랐어도
 * 저작자에게는 한 번의 결정이었으므로 되돌림도 한 번이어야 한다.
 */
export function runAdoption(): AdoptionRunResult {
  const mapIds = [...state.selectedMapIds];
  if (mapIds.length === 0) {
    const error = "이관할 맵을 먼저 고르세요. 고르지 않으면 아무것도 바꾸지 않습니다.";
    set({ lastError: error, lastOutcome: null });
    return { ok: false, error };
  }
  if (state.roles.length === 0) {
    const error = "역할을 최소 하나 고르세요. 지금 선택으로는 가져올 영역이 없습니다.";
    set({ lastError: error, lastOutcome: null });
    return { ok: false, error };
  }
  const locked = mapIds.find((mapId) => !canEditMap(mapId));
  if (locked) {
    const error = mapEditLockNotice(locked);
    set({ lastError: error, lastOutcome: null });
    return { ok: false, error };
  }

  recordProjectSnapshot(ADOPTION_HISTORY_LABEL);
  let outcome: AdoptionOutcome | null = null;
  store.update(
    (project) => {
      outcome = adoptLayoutRegionsForMaps(project, {
        mapIds,
        roles: state.roles,
        collisionPolicy: state.collisionPolicy,
      });
    },
    { scope: "project", label: ADOPTION_HISTORY_LABEL },
  );
  const result: AdoptionOutcome = outcome ?? {
    adopted: [],
    skippedAlreadyAdopted: [],
    skippedNameCollision: [],
    rebound: [],
  };
  const message = describeAdoptionOutcome(result);
  set({ lastOutcome: result, lastError: adoptionOutcomeIsNoop(result) ? message : null });
  return { ok: true, outcome: result, message };
}

/** 테스트·모드 전환용 초기화. 저장된 사용자 선택을 버린다. */
export function resetAdoptionWorkbench(): void {
  state = {
    open: false,
    selectedMapIds: new Set(),
    roles: [...DEFAULT_ADOPTION_ROLES],
    collisionPolicy: "suffix",
    lastOutcome: null,
    lastError: null,
  };
  for (const listener of listeners) listener(state);
}
