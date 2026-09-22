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
    } else if (state.kind === "error" && state.code === "session-not-persisted") {
      // 임시 세션은 원래 저장하지 않는다 — 조수 작업의 실패가 아니다. 오류 표시 대신 보존 방법을 말한다.
      note("save.session", "임시 세션이라 저장하지 않아요. 보존하려면 내보내기를 누르세요.", "info", state); finish();
    } else if (state.kind === "error") {
      note("save.error", `변경은 적용됐지만 저장하지 못했어요 — ${state.message}`, "error", state); finish();
    }
  };
  note("save.wait", "적용 완료 · 저장 응답 확인 중", "info", { generation: version.generation });
  unsubscribe = store.subscribeAutoSave(inspect);
  timeout = setTimeout(() => { if (!finished) { note("save.unconfirmed", "아직 저장 완료 응답을 확인하지 못했어요.", "info", version); finish(); } }, 60_000);
  inspect();
}
