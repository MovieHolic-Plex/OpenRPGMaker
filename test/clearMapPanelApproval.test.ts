import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createProposalHost } from "@/editor/panels/aiProposalCard";
import { installFakeDom } from "./fakeDom";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import type { ProposedCall } from "@/ai/assistantSession";

/**
 * 허가 모달 **배선** 계약 — `clear_map` 이 들어온 배치만 사용자에게 물어본다.
 *
 * 경계는 모달 하나뿐이다(@/editor/ui/modal). 그 안쪽(무엇을 물어보는가)은
 * `mapDestructionConfirmRequest` 가, 바깥쪽(승인 없이 적용되는가)은
 * `applyProposedProject` 게이트가 각각 자기 테스트로 지킨다. 여기서 고정하는 것은
 * 그 둘 사이 — 패널이 순서를 지키는가다:
 *  1. 취소하면 적용 자체를 호출하지 않는다(되돌리기가 아니라 무변경).
 *  2. 취소는 시도 기록을 오염시키지 않는다(같은 배치로 다시 눌러도 모달이 다시 뜬다).
 *  3. 확인하면 `mapDestructionApproved: true` 로 적용을 통과시킨다.
 *  4. 맵 규모 파괴가 아닌 배치는 묻지 않고 종전 계약(즉시 적용) 그대로다.
 */

const mocks = vi.hoisted(() => ({
  showConfirm: vi.fn(async (_options: unknown): Promise<boolean> => true),
  apply: vi.fn(async (_project: unknown, _options: unknown): Promise<unknown> => ({ ok: true })),
}));

vi.mock("@/editor/ui/modal", () => ({ showConfirm: mocks.showConfirm }));
vi.mock("@/editor/tools/applyChangesetToStore", () => ({ applyProposedProject: mocks.apply }));
vi.mock("@/project/lint/layoutPlacementValidate", () => ({ validateLayoutPlacement: () => [], formatLayoutValidationSummary: () => "" }));
vi.mock("@/editor/teamWorkflowUi", () => ({ ensureGuestIdentityForAiSurface: () => undefined }));
vi.mock("@/editor/agentGhostPreview", () => ({
  clearAgentGhostPreview: () => undefined,
  setAgentGhostDraftMapProvider: () => undefined,
  setAgentGhostRunningTool: () => undefined,
  clearAgentGhostRunningTool: () => undefined,
}));

let restoreDom: (() => void) | null = null;

beforeEach(() => {
  restoreDom = installFakeDom();
  mocks.showConfirm.mockReset();
  mocks.showConfirm.mockResolvedValue(true);
  mocks.apply.mockReset();
  mocks.apply.mockResolvedValue({ ok: true, applied: createBlankProject(), commit: {} });
  store.replace(createBlankProject());
});

afterEach(() => {
  restoreDom?.();
  restoreDom = null;
});

function clearMapCall(name = "clear_map"): ProposedCall {
  const mapId = store.getCurrent().startMapId;
  return {
    name,
    args: { mapId, confirmDestroy: true },
    summary: "빈 맵 전체 청소",
    result: {
      ok: true,
      summary: "빈 맵 전체 청소",
      data: { mapId, mapName: "빈 맵", fill: "grass", events: "keep", cells: 300, total: 300 },
    },
    destructive: true,
    requiresApproval: true,
  };
}

/** run operation 은 **안정 참조**여야 한다 — 매번 새 객체면 소유권 검사가 전부 실패한다. */
function sessionStub() {
  const operation = { signal: { aborted: false } };
  const project = createBlankProject();
  return {
    isDraftReviewApproved: () => true,
    getRunOperation: () => operation,
    getAuditEntries: () => [],
    getProposalBase: () => ({ capturedAt: 0, content: "base", projectId: null }),
    getProposedProject: () => project,
    getDraftBaseline: () => ({ matches: () => true }),
    prepareCheckpointApply: async () => undefined,
    recordAppliedMutation: () => undefined,
    recordApplyRejected: () => undefined,
    recordAppliedProject: () => undefined,
    refreshAcceptance: () => undefined,
    rebaseProject: () => undefined,
  };
}

function host(): { apply: (calls: readonly ProposedCall[]) => Promise<string>; bubbles: string[] } {
  const bubbles: string[] = [];
  const api = createProposalHost({
    proposalNoticeHost: document.createElement("div") as unknown as HTMLElement,
    controller: { session: sessionStub() as never, auditHistory: [], statusTimeline: [] },
    appendBubble: (role, text) => {
      bubbles.push(`${role}: ${text}`);
      return document.createElement("div") as unknown as HTMLElement;
    },
    setStatus: () => undefined,
  });
  return { apply: (calls) => api.applyProposal(calls), bubbles };
}

describe("clear_map 허가 모달 배선", () => {
  it("취소하면 적용을 호출하지 않고 무변경으로 끝난다", async () => {
    mocks.showConfirm.mockResolvedValue(false);
    const ui = host();

    const outcome = await ui.apply([clearMapCall()]);

    expect(outcome).toBe("rejected");
    expect(mocks.apply).not.toHaveBeenCalled();
    expect(mocks.showConfirm).toHaveBeenCalledTimes(1);
    expect(ui.bubbles.join(" ")).toContain("취소했습니다");
  });

  it("취소한 배치는 다시 눌러도 모달이 다시 뜬다", async () => {
    mocks.showConfirm.mockResolvedValue(false);
    const ui = host();
    const calls = [clearMapCall()];
    await ui.apply(calls);
    mocks.showConfirm.mockClear();
    mocks.showConfirm.mockResolvedValue(true);

    const outcome = await ui.apply(calls);

    expect(mocks.showConfirm).toHaveBeenCalledTimes(1);
    expect(outcome).toBe("applied");
  });

  it("확인하면 파괴성 모달 문안으로 물어보고 승인 플래그를 넘긴다", async () => {
    const ui = host();

    const outcome = await ui.apply([clearMapCall()]);

    expect(outcome).toBe("applied");
    expect(mocks.showConfirm).toHaveBeenCalledTimes(1);
    expect(mocks.showConfirm.mock.calls[0]?.[0]).toMatchObject({
      title: "맵 전체 청소 확인",
      confirmLabel: "맵 비우기",
      danger: true,
    });
    expect(mocks.apply.mock.calls[0]?.[1]).toMatchObject({ mapDestructionApproved: true });
  });

  it("맵 규모 파괴가 아닌 배치는 묻지 않는다", async () => {
    const ui = host();

    await ui.apply([clearMapCall("clear_region")]);

    expect(mocks.showConfirm).not.toHaveBeenCalled();
    expect(mocks.apply.mock.calls[0]?.[1]).toMatchObject({ mapDestructionApproved: false });
  });
});
