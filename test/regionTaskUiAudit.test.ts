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

describe("「모두 보기」 명령 시트", () => {
  beforeEach(() => { restoreDom = installFakeDom(); });

  // 여기 있던 두 테스트(「전체 추천」 복귀 칩, "어느 카테고리를 골라도 칩 2개 이상")는
  // **카테고리 필터 자체가 없어져서** 지켜야 할 대상이 사라졌다. 추천 줄은 이제 무엇을
  // 눌러도 갈아치워지지 않으므로 비어 보일 일도, 돌아갈 길을 찾을 일도 없다.
  // 그 자리를 대신하는 계약은 "전체 명령이 계열별로 한 번에 펼쳐진다"다.

  it("추천 줄은 문맥 추천 4개 + 「모두 보기」 칩이고, 시트는 접혀 있다", () => {
    const root = openModal({ mapId: "m1", region: REGION, run: vi.fn(), projectForContext: () => stubProject() });
    const row = findByTestId(root, "region-task-suggestions");
    expect(row?.querySelectorAll("button").length).toBe(5);
    const browse = findByTestId(root, "region-task-browse-all");
    expect(browse).not.toBeNull();
    // 「(+N)」이 전체 명령 수를 말한다 — 추천 4개가 전부라는 오해를 막는 유일한 표시다.
    expect(browse?.textContent).toContain("모두 보기");
    expect(browse?.textContent).toMatch(/\+\d+/);
    expect(findByTestId(root, "region-task-categories")?.classList.contains("hidden")).toBe(true);
  });

  it("「모두 보기」를 누르면 모든 계열의 명령이 한 번에 펼쳐진다", () => {
    const root = openModal({ mapId: "m1", region: REGION, run: vi.fn(), projectForContext: () => stubProject() });
    const browse = findByTestId(root, "region-task-browse-all") as unknown as HTMLElement | null;
    browse?.click();
    const sheet = findByTestId(root, "region-task-categories");
    expect(sheet?.classList.contains("hidden")).toBe(false);
    expect(browse?.getAttribute("aria-expanded")).toBe("true");
    // 계열마다 소제목 + 명령 칩 2개 이상. 필터를 거치지 않고 바로 고를 수 있어야 한다.
    let groups = 0;
    for (const id of ["tiles", "structures", "polish", "npc", "interaction", "combat", "mood", "composite"]) {
      const group = findByTestId(root, `region-category-${id}`);
      if (!group) continue;
      groups += 1;
      expect(group.querySelector(".region-task-category-group-title")).not.toBeNull();
      const chips = group.querySelectorAll(".region-task-suggest-chip");
      expect(chips.length, `${id} 계열`).toBeGreaterThanOrEqual(2);
    }
    expect(groups).toBeGreaterThanOrEqual(5);
    // 다시 누르면 접힌다 — 여는 문과 닫는 문이 같은 칩이다.
    browse?.click();
    expect(sheet?.classList.contains("hidden")).toBe(true);
    expect(browse?.getAttribute("aria-expanded")).toBe("false");
  });

  it("시트의 명령 칩을 누르면 지시 입력창이 채워진다", () => {
    const root = openModal({ mapId: "m1", region: REGION, run: vi.fn(), projectForContext: () => stubProject() });
    (findByTestId(root, "region-task-browse-all") as unknown as HTMLElement | null)?.click();
    const group = findByTestId(root, "region-category-polish");
    const chip = group?.querySelector(".region-task-suggest-chip") as unknown as HTMLElement | null;
    expect(chip).not.toBeNull();
    chip?.click();
    const input = findByTestId(root, "region-task-input") as unknown as HTMLTextAreaElement | null;
    expect(input?.value ?? "").not.toBe("");
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

describe("AI 없이 실내 초안 줄", () => {
  beforeEach(() => { restoreDom = installFakeDom(); });

  it("섹션 제목과 버튼이 같은 문구를 두 번 말하지 않는다", () => {
    const root = openModal({ mapId: "m1", region: REGION, run: vi.fn(), projectForContext: () => stubProject() });
    const button = findByTestId(root, "region-task-direct-room");
    expect(button?.textContent).toBe("초안 만들기");
    const disclosure = findByTestId(root, "region-task-direct-disclosure");
    expect(disclosure?.textContent).toContain("AI 없이 실내 초안 만들기");
    // 같은 문구가 두 번 나오지 않는다(제목 1회).
    const occurrences = (disclosure?.textContent ?? "").split("AI 없이 실내 초안").length - 1;
    expect(occurrences).toBe(1);
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
    expect((findByTestId(root, "region-task-live-progress")?.textContent ?? "").trim()).toBe("");
  });

  it("미리보기 비교는 문장이 아니라 동작으로 알린다", async () => {
    const root = await openReview();
    expect(findByTestId(root, "region-task-preview-hint")).toBeNull();
    expect(findByTestId(root, "region-task-preview-ab-before")?.getAttribute?.("title")).toContain("비교");
  });
});
