import { store } from "@/project/store";

/** Claim before Pi captures its base; restore only when the worker never started. */
export async function claimProjectInterviewExecution(): Promise<{ restore(): Promise<void> } | null> {
  const scope = JSON.stringify(store.getProjectIdentity());
  const brief = store.getCurrent().gameDesignBrief;
  const pending = brief?.generationPending === true;
  const summary = brief?.summary;
  const current = (): boolean => JSON.stringify(store.getProjectIdentity()) === scope
    && store.getCurrent().gameDesignBrief?.summary === summary;
  const restore = async (): Promise<void> => {
    if (!pending || !current()) return;
    store.update(project => {
      if (project.gameDesignBrief) project.gameDesignBrief.generationPending = true;
    }, { scope: "project", label: "첫 제작 전달 대기 복구", origin: "system" });
    await store.flush();
  };
  if (pending) {
    store.update(project => {
      if (project.gameDesignBrief) delete project.gameDesignBrief.generationPending;
    }, { scope: "project", label: "조수 첫 제작 시작", origin: "system" });
  }
  try {
    if (pending && store.getCurrent().gameDesignBrief?.generationPending) throw new Error("제작 시작 상태를 변경하지 못했습니다.");
    if ((await store.flush()).kind !== "saved") throw new Error("게임 기획 저장 실패");
    if (!current()) return null;
    return { restore };
  } catch {
    await restore().catch(() => undefined);
    return null;
  }
}
