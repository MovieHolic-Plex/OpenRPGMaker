import { store } from "@/project/store";
import type { ActivityEntry } from "@/ai/activityTrace";

/** Observe the save of this exact applied generation; never initiate a write for logging. */
export function observeActivitySave(note: (name: string, summary: string, status: ActivityEntry["status"], data: unknown) => void): void {
  const identity = store.getProjectIdentity().id;
  const version = store.getVersionToken();
  let finished = false;
  let unsubscribe = () => {};
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const finish = () => { finished = true; unsubscribe(); if (timeout !== undefined) clearTimeout(timeout); };
  const inspect = () => {
    if (finished) return;
    const current = store.getVersionToken();
    if (store.getProjectIdentity().id !== identity || current.lineage !== version.lineage) { finish(); return; }
    if (current.generation !== version.generation) {
      note("save.superseded", "후속 변경이 있어 이 실행의 저장 완료를 별도로 확인하지 못했어요.", "info", version); finish(); return;
    }
    const state = store.getAutoSaveState();
    if (state.kind === "saved" && !store.hasUnsavedChanges()) {
      note("save.accepted", "저장 완료 응답을 확인했어요.", "ok", { generation: version.generation, at: state.at, projectId: identity }); finish();
    } else if (state.kind === "error") {
      note("save.error", "변경은 적용됐지만 저장 완료를 확인하지 못했어요.", "error", state); finish();
    }
  };
  note("save.wait", "적용 완료 · 저장 응답 확인 중", "info", { generation: version.generation });
  unsubscribe = store.subscribeAutoSave(inspect);
  timeout = setTimeout(() => { if (!finished) { note("save.unconfirmed", "아직 저장 완료 응답을 확인하지 못했어요.", "info", version); finish(); } }, 60_000);
  inspect();
}
