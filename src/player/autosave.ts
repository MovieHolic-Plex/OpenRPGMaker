import { LifeReconciliationError } from "@/project/lifeRecovery";
import { isCutsceneInputLocked } from "@/player/cutsceneControl";
import {
  createSaveSnapshot,
  writeAutosave,
  type AutosaveTrigger,
  type SaveSnapshot,
} from "@/player/saveSlots";
import type { PlaySession } from "@/project/session";
import type { Project } from "@/project/types";

export type { AutosaveTrigger } from "@/player/saveSlots";

/** 오토세이브 최소 간격. 연속 전이/연전에서 localStorage 직렬화를 난사하지 않기 위한 디바운스. */
export const AUTOSAVE_DEBOUNCE_MS = 5000;

type AutosavePolicySession = Pick<PlaySession, "currentMapId" | "flags"> & {
  readonly m2Runtime?: PlaySession["m2Runtime"];
};

/**
 * 오토세이브 정책(순수 함수).
 * ① Change Save Access(m2Runtime.access.save === false) 또는 현재 맵 disableSave면 skip.
 * ② 마지막 오토세이브로부터 AUTOSAVE_DEBOUNCE_MS 미만이면 skip.
 * ③ 컷신 입력 잠금 중이면 skip — 연출 도중 어중간한 지점을 굽지 않는다.
 * trigger 는 정책상 대칭이지만 시그니처에 남겨 향후 트리거별 정책 분기를 허용한다.
 */
export function shouldAutosave(
  session: AutosavePolicySession,
  _trigger: AutosaveTrigger,
  lastAutosaveAtMs: number | null,
  nowMs: number,
  project?: Pick<Project, "maps"> & { readonly system?: Pick<Project["system"], "saveAccess"> },
): boolean {
  if (session.m2Runtime?.access?.save === false) return false;
  // 세이브 포인트에서만 저장하는 게임(system.saveAccess "savePoints")은 자동 저장도 하지 않는다.
  if (project?.system?.saveAccess === "savePoints") return false;
  if (project?.maps[session.currentMapId]?.disableSave === true) return false;
  if (isCutsceneInputLocked(session)) return false;
  if (lastAutosaveAtMs !== null && nowMs - lastAutosaveAtMs < AUTOSAVE_DEBOUNCE_MS) return false;
  return true;
}

/**
 * 스냅샷 생성 + 오토세이브 슬롯 기록. quota 초과 등 storage 실패는 무해화(경고 로그만).
 * 성공 시 기록한 스냅샷을, 실패 시 null 을 돌려준다.
 */
export function performAutosave(
  project: Project,
  session: PlaySession,
  storage: Storage,
  trigger: AutosaveTrigger,
): SaveSnapshot | null {
  let snapshot: SaveSnapshot;
  try {
    snapshot = {
      ...createSaveSnapshot(project, session),
      savedBy: "auto",
      autosaveTrigger: trigger,
    };
  } catch (error) {
    if (!(error instanceof LifeReconciliationError)) throw error;
    console.warn("[autosave] failed to reconcile life state:", error);
    return null;
  }
  try {
    writeAutosave(storage, snapshot);
    return snapshot;
  } catch (error) {
    console.warn("[autosave] failed to write autosave (ignored):", error);
    return null;
  }
}

// ---- PlayScene 훅용 상태 래퍼 -------------------------------------------------
// 디바운스 기준 시각은 모듈 상태로 유지한다(씬 재생성/맵 전이에도 살아남아야 의미가 있다).
let lastAutosaveAtMs: number | null = null;

/** 테스트/새 플레이 시작 시 디바운스 상태 초기화. */
export function resetAutosaveDebounce(): void {
  lastAutosaveAtMs = null;
}

/**
 * PlayScene 경로 전용 훅. 정책 통과 시에만 localStorage 에 굽는다.
 * 헤드리스(스토리지 없음) 환경에선 no-op — sceneTestRunner/walkthroughRunner 는
 * 이 함수를 호출하지 않지만, 이중 안전망으로 storage 부재도 조용히 건너뛴다.
 */
export function maybeAutosave(
  project: Project,
  session: PlaySession,
  trigger: AutosaveTrigger,
  nowMs: number = Date.now(),
): boolean {
  const storage = resolveLocalStorage();
  if (!storage) return false;
  if (!shouldAutosave(session, trigger, lastAutosaveAtMs, nowMs, project)) return false;
  const written = performAutosave(project, session, storage, trigger);
  if (!written) return false;
  lastAutosaveAtMs = nowMs;
  return true;
}

// ---- 전투 승리 자동 저장은 필드가 쉴 때 굽는다 --------------------------------------
// 전투를 연 이벤트는 승리 뒤에도 이어진다(「이 적을 이겼다」 스위치·보상·대사). 정산 직후에 구우면 그 뒤의
// 명령이 빠진 순간이 저장돼, 불러오면 같은 적이 다시 닿아 전투가 열렸다(2026-10-29 vm5 argon jrpg).
// 그래서 승리는 「구울 것」만 적고, 실행 중인 이벤트가 끝나 필드가 쉴 때 한 번 굽는다. 표시는 세션에 묶이므로
// 그사이 불러오기·새 게임으로 세션이 바뀌면 함께 버려진다.
const pendingAutosaves = new WeakMap<PlaySession, AutosaveTrigger>();

/** 지금 굽지 않고, 필드가 쉴 때(flushPendingAutosave) 굽도록 적어 둔다. */
export function requestAutosaveWhenIdle(session: PlaySession, trigger: AutosaveTrigger): void {
  pendingAutosaves.set(session, trigger);
}

/** 적어 둔 자동 저장이 있으면 굽는다. 이벤트가 돌지 않는 필드 프레임에서만 부른다. */
export function flushPendingAutosave(project: Project, session: PlaySession, nowMs: number = Date.now()): boolean {
  const trigger = pendingAutosaves.get(session);
  if (!trigger) return false;
  pendingAutosaves.delete(session);
  return maybeAutosave(project, session, trigger, nowMs);
}

function resolveLocalStorage(): Storage | null {
  try {
    const storage = (globalThis as { localStorage?: Storage }).localStorage;
    return storage ?? null;
  } catch {
    // 일부 임베드/프라이버시 모드에서 localStorage 접근 자체가 throw 할 수 있다.
    return null;
  }
}
