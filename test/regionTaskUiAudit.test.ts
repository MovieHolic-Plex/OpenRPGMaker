// test/regionTaskUiAudit.test.ts
// 2026-08-30 영역 작업 UI 감사에서 고친 것들의 회귀 가드.
// 각 테스트는 "예전에 화면에서 무엇이 잘못 읽혔는지"를 주석에 남긴다 — 되돌아가면 여기서 잡힌다.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { closeRegionTaskModal, openRegionTaskModal } from "@/editor/panels/regionTaskModal";
import { __clearPendingRegionApplyForTest, setPendingRegionApply } from "@/editor/regionTask/pendingRegionApply";
import type { RegionTaskResult } from "@/editor/regionTask/runRegionTask";
import { type FakeElement, findByTestId, installFakeDom } from "./fakeDom";
import type { RegionRect } from "@/editor/regionTask/clipToRegion";
import type { Project } from "@/project/types";

const REGION: RegionRect = { x: 0, y: 0, width: 3, height: 3 };

function openModal(options: Parameters<typeof openRegionTaskModal>[0]): FakeElement {
  return openRegionTaskModal(options) as unknown as FakeElement;
}

function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function stubProject(lower: number[] = []): Project {
  const w = 10, h = 10;
  const lowerTiles = new Array(w * h).fill(0);
  const upperTiles = new Array(w * h).fill(-1);
  for (let i = 0; i < lower.length && i < w * h; i += 1) lowerTiles[i] = lower[i]!;
  return {
    maps: {
      m1: { id: "m1", name: "맵", width: w, height: h, tileSize: 16, lowerTiles, upperTiles, events: [] },
    },
    tilesets: {},
  } as unknown as Project;
}

let restoreDom: (() => void) | null = null;

afterEach(() => {
  closeRegionTaskModal();
  restoreDom?.();
  restoreDom = null;
});

describe("진입 화면의 컨트롤 수", () => {
  beforeEach(() => { restoreDom = installFakeDom(); });

  // 여기 있던 세 테스트(「모두 보기」 시트가 접혀 있다 / 눌러 펼친다 / 시트 칩을 누르면
  // 입력창이 채워진다)는 **시트 자체가 없어져서** 지켜야 할 대상이 사라졌다.
  // 진입 화면에서 스물두 개를 펼쳐 보여 주면 고르는 일이 읽는 일이 된다(스펙 §2).
  // 전체 목록은 `/` 자동완성이 같은 코퍼스로 그대로 낸다 — 아래 describe 가 지킨다.

  it("추천 칩은 3개고, 그 밖에 고를 것을 진입 화면에 두지 않는다", () => {
    const root = openModal({ mapId: "m1", region: REGION, run: vi.fn(), projectForContext: () => stubProject() });
    const row = findByTestId(root, "region-task-suggestions");
    expect(row?.querySelectorAll("button").length).toBe(3);
    expect(findByTestId(root, "region-task-browse-all")).toBeNull();
    expect(findByTestId(root, "region-task-categories")).toBeNull();
    expect(findByTestId(root, "region-task-mode-switch")).toBeNull();
  });

  it("추천이 전부가 아니라는 사실은 입력창 안내가 말한다 — 「(+N)」 칩을 대신한다", () => {
    const root = openModal({ mapId: "m1", region: REGION, run: vi.fn(), projectForContext: () => stubProject() });
    const input = findByTestId(root, "region-task-input");
    expect(input?.getAttribute("placeholder") ?? "").toMatch(/\/ 로 전체 \d+개/);
  });

  it("실행 버튼 하나가 「다듬기」와 「실행」을 겸한다", () => {
    const root = openModal({ mapId: "m1", region: REGION, run: vi.fn(), projectForContext: () => stubProject() });
    const run = findByTestId(root, "region-task-run");
    expect(findByTestId(root, "region-task-polish")).toBeNull();
    expect(run?.textContent).toContain("다듬기");
    const input = findByTestId(root, "region-task-input") as unknown as HTMLTextAreaElement;
    input.value = "울창한 숲";
    input.dispatchEvent(new Event("input"));
    expect(run?.textContent).toBe("실행");
  });

  it("생성기 설정·실내 프리셋은 「조절…」 안으로 물러난다 — 진입 화면엔 없다", () => {
    const root = openModal({ mapId: "m1", region: REGION, run: vi.fn(), projectForContext: () => stubProject() });
    const adjust = findByTestId(root, "region-task-adjust");
    expect(adjust).not.toBeNull();
    // 진입 화면에 남아 있던 별도 진입점들이 사라졌는지 — 요소가 「조절…」의 자손이어야 한다.
    for (const id of ["region-task-operator-panel", "region-task-direct-preset", "region-task-direct-room"]) {
      const node = findByTestId(root, id);
      expect(node, id).not.toBeNull();
      expect(adjust?.contains?.(node as unknown as Node) ?? true, id).toBe(true);
    }
    expect(findByTestId(root, "region-task-direct-disclosure")).toBeNull();
    expect(findByTestId(root, "region-task-operator-reseed")).toBeNull();
    expect(findByTestId(root, "region-task-operator-intent-run")).toBeNull();
  });
});

describe("`/` 자동완성", () => {
  beforeEach(() => { restoreDom = installFakeDom(); });

  it("`/` 목록은 전체 명령을 보여 준다 — 숨은 카테고리 상태에 좁혀지지 않는다", () => {
    // 예전에는 켜져 있는 카테고리 칩이 이 목록의 범위를 몰래 좁혔다. 그 결합은 "칩 필터와
    // `/` 목록이 서로 다른 상태를 보고 있다"를 막기 위한 것이었는데, 카테고리 필터 상태가
    // 사라졌으므로 좁힐 근거도 없다. 이제 `/` 는 언제나 같은 것을 보여 준다.
    const root = openModal({ mapId: "m1", region: REGION, run: vi.fn(), projectForContext: () => stubProject() });
    const input = findByTestId(root, "region-task-input") as unknown as HTMLTextAreaElement | null;
    expect(input).not.toBeNull();
    if (input) input.value = "/";
    input?.dispatchEvent(new Event("input", { bubbles: true }));
    const list = findByTestId(root, "region-task-autocomplete");
    expect(list?.classList.contains("hidden")).toBe(false);
    const labels = Array.from(list?.querySelectorAll("button") ?? []).map((item) => item.textContent ?? "");
    expect(labels.length).toBeGreaterThan(0);
    // 계열을 가로질러 나온다 — 다듬기 계열만 남던 시절엔 「상인」이 목록에 없었다.
    expect(labels.join("|")).toContain("상인");
  });
});

describe("AI 없이 실내 초안 경로", () => {
  beforeEach(() => { restoreDom = installFakeDom(); });

  // 예전에는 이 경로의 진입점이 진입 화면의 접이식 줄(select 2개 + 버튼)이었고, 그래서
  // "섹션 제목과 버튼이 같은 말을 두 번 하지 않는다"가 지킬 계약이었다. 이제 진입점은
  // **문장**이다 — 접이식 줄이 없으므로 그 계약도 없다. 대신 문장이 이 경로로 가는지를 지킨다.
  it("실내 낱말이 있는 문장은 실내 초안 경로로 간다", async () => {
    const runDirectRoomDraft = vi.fn(async () => ({ assistantText: "ok" }));
    const root = openModal({
      mapId: "m1",
      region: REGION,
      run: vi.fn(),
      projectForContext: () => stubProject(),
      runDirectRoomDraft: runDirectRoomDraft as never,
    });
    const input = findByTestId(root, "region-task-input") as unknown as HTMLTextAreaElement;
    input.value = "여관 실내를 방으로 나눠줘";
    (findByTestId(root, "region-task-run") as unknown as HTMLElement).click();
    await Promise.resolve();
    await Promise.resolve();
    expect(runDirectRoomDraft).toHaveBeenCalledTimes(1);
    expect(runDirectRoomDraft.mock.calls[0]![0]).toMatchObject({ preset: "inn" });
  });
});

describe("검토 화면", () => {
  beforeEach(() => {
    __clearPendingRegionApplyForTest();
    restoreDom = installFakeDom();
  });

  // clean=true 는 "아무 문제 없음" 검토 — 경고 지표도 이슈도 없다.
  async function openReview(options?: { readonly clean?: boolean }): Promise<FakeElement> {
    const clean = options?.clean === true;
    const base = stubProject([0, 0, 0, 0, 0, 0, 0, 0, 0]);
    const clipped = stubProject([120, 120, 120, 0, 0, 0, 0, 0, 0]);
    const pending = setPendingRegionApply({
      baseProject: base,
      clippedProject: clipped,
      mapId: "m1",
      region: REGION,
      changedCells: 3,
      changedEvents: 0,
      instruction: "물 채우기",
      getCurrentProject: () => base,
      report: {
        issues: clean ? [] : [{ code: "schedule", severity: "warning", message: "NPC 일정 확인" }],
        metrics: clean
          ? {
            changedCells: 3, changedEvents: 0, passableChangedCells: 3, isolatedChangedCells: 0,
            scheduledNpcs: 0, scheduleEntries: 0, timeSystemEnabled: true, roomSessions: 0,
            roomScoreAverage: null, unreachableObjectives: 0,
          }
          : {
            changedCells: 3, changedEvents: 0, passableChangedCells: 3, isolatedChangedCells: 0,
            scheduledNpcs: 1, scheduleEntries: 1, timeSystemEnabled: false, roomSessions: 0,
            roomScoreAverage: null, unreachableObjectives: 2,
          },
      },
      onApply: () => {},
      onDiscard: () => {},
      onSettle: () => {},
    });
    const result: RegionTaskResult = {
      ok: true, applied: false, changedCells: 3, changedEvents: 0, clippedCells: 0,
      proposedCalls: 1, assistantText: "", pending,
    };
    const root = openModal({
      mapId: "m1",
      region: REGION,
      initialInstruction: "물 채우기",
      autoRun: true,
      run: async () => result,
      renderSnapshot: async () => document.createElement("div"),
      projectForContext: () => base,
    });
    await flush();
    return root;
  }

  it("부분 적용은 「고급」 밖, 검토 본문에 있다", async () => {
    // 예전에는 「고급(로그·부분 적용·스탬프)」 안이라, 검토의 핵심 결정을 하려면 접힌 섹션을
    // 열고 로그를 지나쳐 내려가야 했다.
    const root = await openReview();
    const compare = findByTestId(root, "region-task-compare-actions");
    expect(compare).not.toBeNull();
    const partial = findByTestId(root, "region-task-partial-host");
    expect(partial).not.toBeNull();
    // 부분 적용 호스트가 고급 본문(advanced-body) 안에 있지 않다.
    let node: FakeElement | null = partial as FakeElement | null;
    let insideAdvanced = false;
    while (node) {
      if (node.classList?.contains?.("region-task-advanced-body")) insideAdvanced = true;
      node = (node.parentNode as FakeElement | null) ?? null;
    }
    expect(insideAdvanced).toBe(false);
  });

  it("검사 통과·차단 표시는 화면에 없다", async () => {
    // 예전에는 체크포인트 6개가 초록 체크로 깔렸고, 그 뒤에는 "막힌 검사"만 남겼다.
    // 이제 통과/차단이라는 판정 자체가 없다(검증게이트 배제) — 두 UI 모두 사라졌다.
    const root = await openReview();
    expect(findByTestId(root, "region-task-checkpoint-timeline")).toBeNull();
    expect(findByTestId(root, "region-task-blockers")).toBeNull();
    expect(root.textContent ?? "").not.toContain("적용 차단");
  });

  it("지표는 손봐야 하는 값만 남긴다", async () => {
    // 예전에는 한 줄 문자열("변경 3칸 · 이벤트 0 · 통행 3칸 · 조합 100점 …") 이었고,
    // 그다음엔 칩 8개였다. 개수는 변경 목록이 이미 말한다.
    const root = await openReview();
    const metrics = findByTestId(root, "region-task-review-metrics");
    const chips = Array.from(metrics?.querySelectorAll(".region-task-metric") ?? []);
    expect(chips.length).toBe(2);
    expect(chips.every((chip) => chip.className.includes("is-warn"))).toBe(true);
    const text = metrics?.textContent ?? "";
    expect(text).toContain("못 가는 목표 2개");
    expect(text).toContain("시간 시스템 꺼짐");
    // 변경 목록이 하는 말을 되풀이하지 않는다.
    expect(text).not.toContain("바뀐 칸");
    expect(text).not.toContain("타일 조합");
  });

  it("문제가 없으면 진단 줄 자체가 없다", async () => {
    // "검사 통과 · 검사 상세" 는 눌러도 초록 체크와 "막는 문제·주의 없음" 만 나오는 줄이었다.
    const root = await openReview({ clean: true });
    expect(findByTestId(root, "region-task-diagnostics")).toBeNull();
    expect(findByTestId(root, "region-task-verdict")).toBeNull();
  });

  it("문제가 있으면 판정 줄은 건수만 말한다", async () => {
    const root = await openReview();
    expect(findByTestId(root, "region-task-verdict")?.textContent).toBe("주의 1건");
  });

  it("검토 요약 줄은 변경 목록과 같은 말을 하지 않는다", async () => {
    // 예전: "제안 준비 — 3칸 타일 · 적용 여부를 선택하세요" + 변경 목록 "타일 3칸" + 지표
    // "바뀐 칸 3칸" — 같은 숫자를 세 번 읽혔다.
    const root = await openReview();
    // 요약 줄은 비어 있고(변경 목록·미리보기가 말한다), 진행 칩도 남지 않는다.
    expect((findByTestId(root, "region-task-summary")?.textContent ?? "").trim()).toBe("");
    // 진행 타임라인은 삭제됐다 — 헤더의 단계 세그먼트(지시·생성·검토)와 요약 한 줄이
    // 같은 것을 말하고 있었다(스펙 §10).
    expect(findByTestId(root, "region-task-live-progress")).toBeNull();
  });

  it("미리보기 비교는 문장이 아니라 동작으로 알린다", async () => {
    const root = await openReview();
    expect(findByTestId(root, "region-task-preview-hint")).toBeNull();
    expect(findByTestId(root, "region-task-preview-ab-before")?.getAttribute?.("title")).toContain("비교");
  });
});
