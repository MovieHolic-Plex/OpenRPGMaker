import { openPersistenceRecovery, persistenceRecoveryCopy } from "@/editor/persistenceRecoveryUi";
import { SpatialPersistenceError } from "@/project/spatial/persistenceTypes";
import { ProjectRoutingError } from "@/project/spatial/saveRouting";
import { projectRepository } from "@/project/persistence/repository";
import { store } from "@/project/store";
import { dismissToastsByKey, toast } from "@/util/toast";

const recoveryToastKey = Symbol("persistence-recovery");

export async function saveProjectNow(): Promise<boolean> {
  // 공용 데모 세션에서 저장은 "편집용 사본 만들기"로 연결한다 — 원본은 절대 못 바꾼다.
  if (store.isSharedDemoSession()) {
    const { presentSharedDemoSaveHint } = await import("@/editor/sharedDemoIntro");
    presentSharedDemoSaveHint();
    return false;
  }
  if (store.isLoaded() && !store.hasUnsavedChanges() && store.getAutoSaveState().kind !== "error"
    && store.getPersistenceRecovery().kind !== "blocked") {
    toast("이미 최신 상태입니다", "ok");
    return true;
  }
  toast("저장 중...", "info");
  try {
    const result = await store.flush();
    switch (result.kind) {
      case "saved": {
        const recovery = store.getPersistenceRecovery();
        if (recovery.kind === "ready" && recovery.mirror?.status === "warning") {
          toast("저장 완료. 미리보기 동기화는 경고입니다.", "info");
        } else {
          toast("저장 완료", "ok");
        }
        return true;
      }
      case "saved-local":
        if (result.written === false) {
          // fresh/blank 같은 임시 세션은 기록을 건너뛴다. 「저장 완료」라고 하면 거짓이다.
          // 호출자(새 프로젝트 만들기 등)는 막지 않는다 — 임시 세션은 원래 저장할 곳이 없다.
          toast("이 세션은 저장되지 않는 임시 세션입니다 — 아무것도 기록하지 않았습니다.", "info");
          return true;
        }
        toast("저장 완료 (브라우저)", "ok");
        return true;
      case "not-loaded":
        toast("아직 프로젝트를 불러오는 중입니다.", "error");
        return false;
      case "conflict":
        toast(`저장 충돌: ${conflictMapNames(result.conflicts)} 맵이 다른 세션에서 먼저 바뀌었습니다.`, "error");
        return false;
      case "disabled":
        toast("이 화면에서는 온라인 저장을 사용할 수 없습니다.", "error");
        return false;
      case "not-configured":
        toast("온라인 저장 연결이 필요합니다. 상태바의 ‘온라인 저장’을 확인하세요.", "error");
        return false;
    }
  } catch (error) {
    if (error instanceof SpatialPersistenceError || error instanceof ProjectRoutingError) {
      toast(persistenceRecoveryCopy(error).title, { kind: "error", key: recoveryToastKey });
      openPersistenceRecovery();
      return false;
    }
    if (error instanceof Error) {
      toast(`저장 실패: ${error.message}`, "error");
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
