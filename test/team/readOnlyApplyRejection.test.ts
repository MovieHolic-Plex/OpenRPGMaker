import { afterEach, describe, expect, it, vi } from "vitest";

import { AuthoredProjectBaseline } from "@/project/authoredProjectBaseline";
import { applyProposedProject, captureProposalBase } from "@/editor/tools/applyChangesetToStore";
import { getMapEditHistoryEntries, resetMapEditHistory } from "@/editor/mapEditHistory";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { setTeamRole, TEAM_READ_ONLY_WRITE_MESSAGE } from "@/project/teamAccess";

/**
 * 보기 전용 팀 프로젝트에서 AI 적용이 **거짓 성공을 내지 않는지** 고정한다.
 *
 * 배경: `store.replace` 는 보기 전용(viewer) 팀 멤버에게 조용히 no-op 이다(store.ts 의
 * canWriteTeamProject 가드). 그래서 적용 경로가 거절하지 않으면 호출자는 ok:true 를 받고
 * 「적용했어요」를 띄운다 — 화면과 저장소가 갈라진다. 게이트는
 * applyChangesetToStore.ts 의 applyProposedProject 첫 검사다(2026-09-24, 86c7ebaee).
 */
afterEach(() => {
  setTeamRole(null);
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("보기 전용 팀 프로젝트의 AI 적용", () => {
  it("commit-rejected 로 거절하고 저장소·되돌리기 기록을 건드리지 않는다", async () => {
    // Given: 팀 브리지가 있고 역할이 viewer 인 편집기.
    store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
    resetMapEditHistory();
    const base = createBlankProject();
    store.replace(base);
    const proposalBase = captureProposalBase(store.getCurrent());
    const proposed = structuredClone(base);
    proposed.meta = { ...(proposed.meta ?? {}), title: "보기 전용에서는 적용되면 안 되는 제목" };
    const before = store.getCurrent();
    vi.stubGlobal("window", { oprn: { team: {} } });
    setTeamRole("viewer");

    // When: AI 적용 경로를 그대로 탄다.
    const result = await applyProposedProject(proposed, {
      base: proposalBase,
      baseline: new AuthoredProjectBaseline(base),
      source: "agent-milestone",
      summary: "보기 전용 적용 시도",
      toolNames: ["set_title_screen"],
    });

    // Then: 거절 사유가 표면 문구와 같은 한 줄이어야 한다(패널이 그대로 싣는다).
    expect(result).toEqual({
      ok: false,
      reason: "commit-rejected",
      issue: TEAM_READ_ONLY_WRITE_MESSAGE,
      issues: [TEAM_READ_ONLY_WRITE_MESSAGE],
    });
    expect(store.getCurrent()).toBe(before);
    expect(store.getCurrent().meta?.title).not.toBe("보기 전용에서는 적용되면 안 되는 제목");
    expect(getMapEditHistoryEntries()).toHaveLength(0);
  });
});
