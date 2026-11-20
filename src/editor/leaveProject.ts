import { store } from "@/project/store";
import { showConfirm } from "@/editor/ui/modal";
import { saveProjectNow } from "@/editor/saveActions";

/** 확인만 한다. 폴더 선택을 취소하거나 새 폴더를 열지 못하면 현재 편집은 계속된다. */
export async function confirmDiscardToLeave(action: string): Promise<boolean> {
  if (!store.hasUnsavedChanges()) return true;
  return showConfirm({
    title: action,
    message: "현재 프로젝트에서 저장하지 않은 변경 사항은 사라집니다. 계속할까요?",
    confirmLabel: "변경 버리기",
    cancelLabel: "계속 편집",
    danger: true,
  });
}

export async function saveBeforeLeaving(): Promise<boolean> {
  if (!store.hasUnsavedChanges()) return true;
  if (store.isSharedDemoSession() || store.getAutoSaveState().kind === "error") return false;
  return await saveProjectNow() && !store.hasUnsavedChanges();
}

export async function saveOrConfirmLeave(action: string): Promise<boolean> {
  return await saveBeforeLeaving() || confirmDiscardToLeave(action);
}
