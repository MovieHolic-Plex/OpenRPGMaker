import { openPersistenceRecovery, persistenceRecoveryCopy } from "@/editor/persistenceRecoveryUi";
import { SpatialPersistenceError } from "@/project/spatial/persistenceTypes";
import { ProjectRoutingError } from "@/project/spatial/saveRouting";
import { projectRepository } from "@/project/persistence/repository";
import { store } from "@/project/store";
import { dismissToastsByKey, toast } from "@/util/toast";

const recoveryToastKey = Symbol("persistence-recovery");
// 「저장 중...」은 결과 토스트가 뜨면 걷는다 — 둘이 함께 남아 상태가 모순돼 보였다.
const saveProgressToastKey = Symbol("save-progress");

// 저장 결과 토스트는 한 번에 하나 — Ctrl+S 를 빨리 두 번 누르거나(키 반복 포함) 진행 중에 또 누르면
// 「저장 완료」「이미 최신 상태입니다」가 겹쳐 쌓였다(2026-10-23 적대 UX 검수). 진행 중 저장은 같은 약속을 돌려주고,
// 결과 토스트는 같은 키로 앞의 것을 걷어 낸다.
const saveResultToastKey = Symbol("save-result");
let saveInFlight: Promise<boolean> | null = null;

/** 임시 세션을 파일로 내보낸 시각. 배너가 「방금 내보냄」을 말하는 근거다. */
export const TEMPORARY_SESSION_EXPORTED_EVENT = "oprn:temporary-session-exported";
let temporarySessionExportedAt: number | null = null;

export function lastTemporarySessionExportAt(): number | null {
  return temporarySessionExportedAt;
}

/**
 * 임시 세션의 「보존」 경로 — 프로젝트 파일(.oprn)로 내려받는다. 성공했을 때만 시각을 남기고 배너에 알린다
 * (실패는 오류 토스트로 끝난다).
 */
export async function exportTemporarySession(): Promise<boolean> {
  try {
    const [{ createProjectPackage, projectPackageFileName, projectWithInlineUploadedMedia }, { projectWithoutEventDrafts }, { downloadBlob }] = await Promise.all([
      import("@/project/package"),
      import("@/project/eventDrafts"),
      import("@/util/downloadBlob"),
    ]);
    const project = await projectWithInlineUploadedMedia(projectWithoutEventDrafts(store.getCurrent()));
    const fileName = projectPackageFileName(project);
    downloadBlob(createProjectPackage(project), fileName);
    temporarySessionExportedAt = Date.now();
    saveToast(`「${fileName}」로 내보냈어요. 다운로드 폴더에 있어요. 이 파일을 다시 열면 이어서 작업할 수 있어요.`, "ok");
    if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(TEMPORARY_SESSION_EXPORTED_EVENT));
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    saveToast(`내보내기 실패: ${message}`, "error");
    return false;
  }
}

function saveToast(message: string, kind: "ok" | "info" | "error"): void {
  dismissToastsByKey(saveResultToastKey);
  toast(message, { kind, key: saveResultToastKey });
}

export function saveProjectNow(): Promise<boolean> {
  if (saveInFlight) return saveInFlight;
  saveInFlight = saveProjectOnce().finally(() => { saveInFlight = null; });
  return saveInFlight;
}

async function saveProjectOnce(): Promise<boolean> {
  // 공용 데모 세션에서 저장은 "편집용 사본 만들기"로 연결한다 — 원본은 절대 못 바꾼다.
  if (store.isSharedDemoSession()) {
    const { presentSharedDemoSaveHint } = await import("@/editor/sharedDemoIntro");
    presentSharedDemoSaveHint();
    return false;
  }
  if (store.isLoaded() && !store.hasUnsavedChanges() && store.getAutoSaveState().kind !== "error"
    && store.getPersistenceRecovery().kind !== "blocked") {
    saveToast("이미 최신 상태입니다", "ok");
    return true;
  }
  dismissToastsByKey(saveResultToastKey);
  toast("저장 중...", { kind: "info", key: saveProgressToastKey });
  try {
    const result = await store.flush();
    dismissToastsByKey(saveProgressToastKey);
    switch (result.kind) {
      case "saved": {
        const recovery = store.getPersistenceRecovery();
        if (recovery.kind === "ready" && recovery.mirror?.status === "warning") {
          saveToast("저장 완료. 미리보기 동기화는 경고입니다.", "info");
        } else {
          saveToast("저장 완료", "ok");
        }
        return true;
      }
      case "saved-local":
        if (result.written === false) {
          // fresh/blank 같은 임시 세션은 기록을 건너뛴다. 「저장 완료」라고 하면 거짓이다.
          // 호출자(새 프로젝트 만들기 등)는 막지 않는다 — 임시 세션은 원래 저장할 곳이 없다.
          // 저장할 곳이 없다는 말로 끝내지 않고, 그 자리에서 보존하는 길(내보내기)을 준다.
          dismissToastsByKey(saveResultToastKey);
          toast("임시 세션이라 저장할 곳이 없어요. 파일로 내보내 보존하세요.", {
            kind: "info",
            key: saveResultToastKey,
            action: { label: "내보내기", testid: "save-temporary-export", onClick: () => void exportTemporarySession() },
          });
          return false;
        }
        saveToast("저장 완료 (브라우저)", "ok");
        return true;
      case "not-loaded":
        saveToast("아직 프로젝트를 불러오는 중입니다.", "error");
        return false;
      case "conflict":
        saveToast(`저장 충돌: ${conflictMapNames(result.conflicts)} 맵이 다른 세션에서 먼저 바뀌었습니다.`, "error");
        return false;
      case "disabled":
        saveToast("이 화면에서는 온라인 저장을 사용할 수 없습니다.", "error");
        return false;
      case "not-configured":
        saveToast("온라인 저장 연결이 필요합니다. 상태바의 ‘온라인 저장’을 확인하세요.", "error");
        return false;
    }
  } catch (error) {
    dismissToastsByKey(saveProgressToastKey);
    if (error instanceof SpatialPersistenceError || error instanceof ProjectRoutingError) {
      toast(persistenceRecoveryCopy(error).title, { kind: "error", key: recoveryToastKey });
      openPersistenceRecovery();
      return false;
    }
    if (error instanceof Error) {
      saveToast(`저장 실패: ${error.message}`, "error");
      return false;
    }
    throw error;
  }
}

/** 온라인 저장본을 다시 읽어 맵/이벤트를 즉시 반영한다. */
export async function reloadProjectFromDbNow(options: {
  readonly force?: boolean;
  readonly expectedProjectId?: string | null;
} = {}): Promise<boolean> {
  if (!store.isLoaded()) {
    toast("아직 프로젝트를 불러오는 중입니다.", "error");
    return false;
  }
  if (options.expectedProjectId !== undefined) {
    // 대상을 저장소에 묻는다 — project storage 설정을 직접 보면 로컬 폴더 정본에서 남의 id 를 비교한다.
    const liveId = projectRepository().currentTarget()?.projectId ?? null;
    if (liveId !== options.expectedProjectId) {
      toast("복구 대상이 바뀌어 불러오기를 취소했습니다.", "error");
      return false;
    }
  }
  // 공용 데모에는 "저장본 다시 불러오기" 가 없다 — 원본은 항상 지금 보이는 그대로다.
  if (store.isSharedDemoSession()) {
    toast("공용 예제는 항상 원본 그대로입니다. 편집하려면 내 사본을 만드세요.", "info");
    return false;
  }
  if (!options.force && store.hasUnsavedChanges()) {
    // 호출자가 confirm 한 뒤 force 로 다시 부를 수 있게 cancelled 는 false.
    toast("저장되지 않은 변경이 있습니다. 확인 후 다시 시도하세요.", "info");
    return false;
  }
  toast("온라인 저장본을 불러오는 중...", "info");
  const result = await store.reloadFromRemote({ force: options.force === true || !store.hasUnsavedChanges() });
  switch (result.kind) {
    case "reloaded": {
      const { editorState } = await import("@/editor/editorState");
      const { focusProjectStartMap } = await import("@/editor/mapSelection");
      const project = store.getCurrent();
      const currentId = editorState.get().currentMapId;
      // 맵 id 가 사라졌으면 start 로. 있으면 같은 맵을 다시 선택해 EditScene 전체 재그리기를 강제한다.
      if (!currentId || !project.maps[currentId]) {
        focusProjectStartMap();
      } else {
        editorState.set({ currentMapId: currentId });
      }
      dismissToastsByKey(recoveryToastKey);
      toast(`온라인 저장본을 불러왔습니다${result.title ? ` — ${result.title}` : ""}`, "ok");
      return true;
    }
    case "not-configured":
      toast("온라인 저장 연결이 없어 저장본을 불러올 수 없습니다.", "error");
      return false;
    case "disabled":
      toast("이 화면에서는 온라인 저장본을 불러올 수 없습니다.", "error");
      return false;
    case "cancelled":
      toast("저장되지 않은 변경이 있어 새로고침을 취소했습니다", "info");
      return false;
    case "failed":
      toast(`온라인 저장본을 불러오지 못했습니다: ${result.message}`, "error");
      return false;
  }
}

function conflictMapNames(conflicts: readonly { readonly name: string }[]): string {
  return conflicts.map((conflict) => conflict.name).join(", ") || "현재";
}
