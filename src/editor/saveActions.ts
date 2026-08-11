import { store } from "@/project/store";
import { toast } from "@/util/toast";

export async function saveProjectNow(): Promise<boolean> {
  if (store.isLoaded() && !store.hasUnsavedChanges() && store.getAutoSaveState().kind !== "error") {
    toast("이미 최신 상태입니다", "ok");
    return true;
  }
  toast("저장 중...", "info");
  try {
    const result = await store.flush();
    switch (result.kind) {
      case "saved":
        toast("저장 완료", "ok");
        return true;
      case "saved-local":
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
    if (error instanceof Error) {
      toast(`저장 실패: ${error.message}`, "error");
      return false;
    }
    throw error;
  }
}

/** 온라인 저장본을 다시 읽어 맵/이벤트를 즉시 반영한다. */
export async function reloadProjectFromDbNow(options: { readonly force?: boolean } = {}): Promise<boolean> {
  if (!store.isLoaded()) {
    toast("아직 프로젝트를 불러오는 중입니다.", "error");
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
