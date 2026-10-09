// 생성기 경로 계약 — 문장 라우팅·파라미터 검증·승인 게이트 재사용을 고정한다.
// 핵심 불변식: 생성기는 조수 경로를 부르지 않고, 맵에 즉시 쓰지 않으며(승인 대기),
// **경로를 정할 때 LLM 을 부르지 않는다**(키워드 라우터, 스펙 §5.1).
//
// 「조수 | 생성기」 모드 스위치는 없어졌다. 사용자가 두 경로의 차이를 결과를 보기 전에
// 판단해야 했고, 그건 답할 수 없는 질문이었다 — 이제 문장이 경로를 정하고, 오라우팅은
// 결과 화면의 「반대 경로로 다시」로 복구한다.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clampOperatorParams,
  defaultOperatorParams,
  type OperatorDef,
} from "@/editor/operators/operatorTypes";
import { getOperator, listOperators, resolveOperatorParams } from "@/editor/operators/operatorRegistry";
import { __clearPendingRegionApplyForTest } from "@/editor/regionTask/pendingRegionApply";
import { runOperatorTask } from "@/editor/regionTask/runOperatorTask";
import { closeRegionTaskModal, openRegionTaskModal } from "@/editor/panels/regionTaskModal";
import { createBlankProject } from "@/project/defaults";
import type { Project } from "@/project/types";
import { type FakeElement, findByTestId, installFakeDom } from "./fakeDom";

const REGION = { x: 2, y: 2, width: 12, height: 10 };

function forestDef(): OperatorDef {
  const def = getOperator("forest");
  if (!def) throw new Error("forest 오퍼레이터가 등록되어 있어야 한다");
  return def;
}

/** 잔디로 덮인 편집 가능한 맵 — 오퍼레이터가 실제로 칠할 도화지. */
function grassProject(): { project: Project; mapId: string } {
  const project = createBlankProject();
  const mapId = project.startMapId;
  const map = project.maps[mapId]!;
  map.lowerTiles.fill(240);
  map.upperTiles.fill(-1);
  return { project, mapId };
}

describe("operator registry", () => {
  it("숲 오퍼레이터가 등록되어 있고 파라미터 스펙을 노출한다", () => {
    expect(listOperators().length).toBeGreaterThan(0);
    const ids = forestDef().params.map((spec) => spec.id);
    expect(ids).toEqual(expect.arrayContaining(["density", "deadRatio", "underbrush", "clearings", "path"]));
  });

  it("기본값은 스펙에서 나온다", () => {
    const def = forestDef();
    const defaults = defaultOperatorParams(def);
    for (const spec of def.params) expect(defaults[spec.id]).toBe(spec.defaultValue);
  });

  it("범위 밖·타입 불일치·모르는 키를 걸러낸다", () => {
    const def = forestDef();
    const clamped = clampOperatorParams(def, {
      density: 9,             // max 초과 → 1
      deadRatio: -3,          // min 미만 → 0
      clearings: 2.7,         // 정수 step → 반올림
      path: "yes" as unknown as boolean, // 타입 불일치 → 기본값 유지
      nonsense: 1,            // 스펙 밖 → 버림
    });
    expect(clamped.density).toBe(1);
    expect(clamped.deadRatio).toBe(0);
    expect(clamped.clearings).toBe(3);
    expect(clamped.path).toBe(true);
    expect(clamped).not.toHaveProperty("nonsense");
  });

  it("모르는 오퍼레이터 id 는 undefined 로 떨어진다", () => {
    expect(resolveOperatorParams("nope")).toBeUndefined();
    expect(resolveOperatorParams("forest")).toMatchObject({ density: expect.any(Number) });
  });
});

describe("runOperatorTask", () => {
  let restoreDom: (() => void) | undefined;
  beforeEach(() => {
    __clearPendingRegionApplyForTest();
    restoreDom = installFakeDom();
  });
  afterEach(() => {
    restoreDom?.();
    __clearPendingRegionApplyForTest();
  });

  it("맵을 즉시 바꾸지 않고 승인 대기 초안을 만든다", () => {
    const { project, mapId } = grassProject();
    const before = JSON.stringify(project);
    const applyProject = vi.fn();
    const result = runOperatorTask(
      { mapId, region: REGION, operatorId: "forest", params: { density: 0.9 }, seed: 7 },
      { getProject: () => project, applyProject },
    );
    expect(result.ok).toBe(true);
    expect(result.applied).toBe(false);
    expect(result.changedCells).toBeGreaterThan(0);
    expect(result.pending).toBeDefined();
    expect(applyProject).not.toHaveBeenCalled();
    expect(JSON.stringify(project)).toBe(before);
  });

  it("승인해야 적용된다 — 기존 승인 게이트를 그대로 탄다", () => {
    const { project, mapId } = grassProject();
    const applyProject = vi.fn();
    const result = runOperatorTask(
      { mapId, region: REGION, operatorId: "forest", seed: 11 },
      { getProject: () => project, applyProject },
    );
    result.pending?.apply();
    expect(applyProject).toHaveBeenCalledTimes(1);
    const [applied, label] = applyProject.mock.calls[0]!;
    expect(label).toContain("숲");
    const map = (applied as Project).maps[mapId]!;
    expect(map.lowerTiles.some((tile, index) => tile !== project.maps[mapId]!.lowerTiles[index])).toBe(true);
  });

  it("같은 시드는 같은 결과, 다른 시드는 다른 결과", () => {
    const a = grassProject();
    const b = grassProject();
    const c = grassProject();
    const run = (fixture: ReturnType<typeof grassProject>, seed: number) => {
      const result = runOperatorTask(
        { mapId: fixture.mapId, region: REGION, operatorId: "forest", seed },
        { getProject: () => fixture.project, applyProject: () => undefined },
      );
      const applied = result.pending;
      let snapshot = "";
      applied?.apply();
      snapshot = JSON.stringify(fixture.project.maps[fixture.mapId]!.lowerTiles);
      return { seed: result.seed, snapshot };
    };
    // apply 는 주입된 applyProject 가 아무것도 안 하므로 project 는 그대로다 — 대신 seed 를 본다.
    const first = run(a, 42);
    const second = run(b, 42);
    const third = run(c, 43);
    expect(first.seed).toBe(42);
    expect(second.seed).toBe(42);
    expect(third.seed).toBe(43);
    expect(first.snapshot).toBe(second.snapshot);
  });

  it("변경은 선택 영역 안에만 생긴다", () => {
    const { project, mapId } = grassProject();
    const applyProject = vi.fn();
    const result = runOperatorTask(
      { mapId, region: REGION, operatorId: "forest", params: { density: 1 }, seed: 3 },
      { getProject: () => project, applyProject },
    );
    result.pending?.apply();
    const next = applyProject.mock.calls[0]![0] as Project;
    const base = project.maps[mapId]!;
    const draft = next.maps[mapId]!;
    for (let y = 0; y < base.height; y += 1) {
      for (let x = 0; x < base.width; x += 1) {
        const inside = x >= REGION.x && x < REGION.x + REGION.width
          && y >= REGION.y && y < REGION.y + REGION.height;
        if (inside) continue;
        const index = y * base.width + x;
        expect(draft.lowerTiles[index]).toBe(base.lowerTiles[index]);
        expect(draft.upperTiles[index]).toBe(base.upperTiles[index]);
      }
    }
  });

  it("모르는 생성기·없는 맵·빈 영역은 오류로 끝나고 아무것도 남기지 않는다", () => {
    const { project, mapId } = grassProject();
    const deps = { getProject: () => project, applyProject: vi.fn() };
    expect(runOperatorTask({ mapId, region: REGION, operatorId: "nope" }, deps).ok).toBe(false);
    expect(runOperatorTask({ mapId: "missing", region: REGION, operatorId: "forest" }, deps).ok).toBe(false);
    expect(runOperatorTask({ mapId, region: { ...REGION, width: 0 }, operatorId: "forest" }, deps).ok).toBe(false);
    expect(deps.applyProject).not.toHaveBeenCalled();
  });
});

describe("모달의 경로 라우팅", () => {
  const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));
  let restoreDom: (() => void) | undefined;
  beforeEach(() => {
    __clearPendingRegionApplyForTest();
    restoreDom = installFakeDom();
  });
  afterEach(() => {
    closeRegionTaskModal();
    restoreDom?.();
    __clearPendingRegionApplyForTest();
  });

  const open = (extra: Partial<Parameters<typeof openRegionTaskModal>[0]> = {}): FakeElement => {
    const { project, mapId } = grassProject();
    return openRegionTaskModal({
      mapId,
      region: REGION,
      run: vi.fn(async () => { throw new Error("조수 경로가 불려서는 안 된다"); }),
      renderSnapshot: async () => document.createElement("div"),
      projectForContext: () => project,
      ...extra,
    }) as unknown as FakeElement;
  };

  it("모드 스위치가 없고, 생성기 설정은 「조절…」 안에 산다", () => {
    const root = open();
    expect(findByTestId(root, "region-task-mode-switch")).toBeNull();
    expect(findByTestId(root, "region-task-mode-assistant")).toBeNull();
    const adjust = findByTestId(root, "region-task-adjust");
    const panel = findByTestId(root, "region-task-operator-panel");
    expect(adjust).not.toBeNull();
    expect(panel).not.toBeNull();
    expect(adjust?.contains?.(panel as unknown as Node) ?? true).toBe(true);
    // 조수 입력부는 그대로 살아 있다.
    expect(findByTestId(root, "region-task-input")).not.toBeNull();
    expect(findByTestId(root, "region-task-run")).not.toBeNull();
  });

  it("「조절…」 안에 파라미터 위젯이 스펙대로 뜬다", () => {
    const root = open();
    for (const spec of forestDef().params) {
      expect(findByTestId(root, `region-task-operator-param-${spec.id}`)).not.toBeNull();
    }
  });

  it("생성기 키워드 문장은 조수 러너를 부르지 않고 생성기로 간다 — LLM 0콜", async () => {
    const aiRun = vi.fn(async () => { throw new Error("조수 경로가 불려서는 안 된다"); });
    const resolveIntent = vi.fn(async () => ({ error: "불려서는 안 된다" }));
    const { project, mapId } = grassProject();
    const runOperator = vi.fn((opts: { operatorId: string; params?: Record<string, unknown> }) => runOperatorTask(
      { mapId, region: REGION, operatorId: opts.operatorId, seed: 5 },
      { getProject: () => project, applyProject: () => undefined },
    ));
    const root = openRegionTaskModal({
      mapId,
      region: REGION,
      run: aiRun,
      runOperator,
      resolveIntent,
      renderSnapshot: async () => document.createElement("div"),
      projectForContext: () => project,
    }) as unknown as FakeElement;

    (findByTestId(root, "region-task-input") as unknown as { value: string }).value = "울창한 숲에 오솔길 하나";
    findByTestId(root, "region-task-run")?.click();
    await flush();
    await flush();

    expect(aiRun).not.toHaveBeenCalled();
    // 라우팅에 모델을 쓰지 않는다는 것이 이 경로의 값이다.
    expect(resolveIntent).not.toHaveBeenCalled();
    expect(runOperator).toHaveBeenCalledTimes(1);
    expect(runOperator.mock.calls[0]![0]).toMatchObject({ operatorId: "forest" });
    expect(runOperator.mock.results[0]!.value).toMatchObject({ ok: true, applied: false });
  });

  it("문장의 형용사가 파라미터로 옮겨진다 — 문장을 버리지 않는다", async () => {
    const { project, mapId } = grassProject();
    const runOperator = vi.fn((opts: { params?: Record<string, unknown> }) => runOperatorTask(
      { mapId, region: REGION, operatorId: "forest", seed: 1 },
      { getProject: () => project, applyProject: () => undefined },
    ));
    const root = openRegionTaskModal({
      mapId,
      region: REGION,
      run: vi.fn(),
      runOperator,
      renderSnapshot: async () => document.createElement("div"),
      projectForContext: () => project,
    }) as unknown as FakeElement;

    (findByTestId(root, "region-task-input") as unknown as { value: string }).value = "울창한 숲, 길은 빼줘";
    findByTestId(root, "region-task-run")?.click();
    await flush();
    await flush();

    expect(runOperator).toHaveBeenCalledTimes(1);
    expect(runOperator.mock.calls[0]![0]!.params).toMatchObject({ density: 0.9, path: false });
    // 위젯도 같은 값을 보여 준다 — 「조절…」을 열면 무엇으로 읽었는지 보인다.
    const density = findByTestId(root, "region-task-operator-param-density") as unknown as { value: string };
    expect(density.value).toBe("0.9");
  });

  it("키워드로 못 잡은 문장은 조수로 가고, 「생성기로 다시」가 그때 모델에게 묻는다", async () => {
    const { project, mapId } = grassProject();
    const aiRun = vi.fn(async () => ({ assistantText: "했습니다" }));
    const runOperator = vi.fn(() => runOperatorTask(
      { mapId, region: REGION, operatorId: "forest", seed: 3 },
      { getProject: () => project, applyProject: () => undefined },
    ));
    const resolveIntent = vi.fn(async () => ({
      operatorId: "forest",
      params: { density: 0.95, path: false },
      source: "llm" as const,
      note: "숲 · 밀도 0.95 · 오솔길 끔",
    }));
    const root = openRegionTaskModal({
      mapId,
      region: REGION,
      run: aiRun as never,
      runOperator,
      resolveIntent,
      renderSnapshot: async () => document.createElement("div"),
      projectForContext: () => project,
    }) as unknown as FakeElement;

    (findByTestId(root, "region-task-input") as unknown as { value: string }).value = "여기를 멋있게";
    findByTestId(root, "region-task-run")?.click();
    await flush();
    await flush();
    expect(aiRun).toHaveBeenCalledTimes(1);
    expect(resolveIntent).not.toHaveBeenCalled();

    // 결과를 보고 "생성기로 해라" 고 말한 뒤에야 모델에게 묻는다.
    expect(findByTestId(root, "region-task-reroute")?.textContent).toBe("생성기로 다시");
    findByTestId(root, "region-task-reroute")?.click();
    await flush();
    await flush();
    expect(resolveIntent).toHaveBeenCalledWith("여기를 멋있게");
    expect(runOperator).toHaveBeenCalledTimes(1);
  });

  it("반대 경로 해석이 실패하면 그 사실을 말하고 아무것도 만들지 않는다", async () => {
    const { project, mapId } = grassProject();
    const runOperator = vi.fn();
    const root = openRegionTaskModal({
      mapId,
      region: REGION,
      run: vi.fn(async () => ({ assistantText: "했습니다" })) as never,
      runOperator,
      resolveIntent: async () => ({ error: "문장에서 생성기를 알아내지 못했습니다" }),
      renderSnapshot: async () => document.createElement("div"),
      projectForContext: () => project,
    }) as unknown as FakeElement;

    (findByTestId(root, "region-task-input") as unknown as { value: string }).value = "멋있게";
    findByTestId(root, "region-task-run")?.click();
    await flush();
    await flush();
    findByTestId(root, "region-task-reroute")?.click();
    await flush();
    await flush();

    expect(runOperator).not.toHaveBeenCalled();
    expect(findByTestId(root, "region-task-summary")?.textContent).toContain("알아내지 못했습니다");
  });

  it("생성기 결과에서 「다시 만들기」는 같은 설정·다른 시드다 — 「새 시드」 버튼을 흡수했다", async () => {
    const { project, mapId } = grassProject();
    const seeds: (number | undefined)[] = [];
    const runOperator = vi.fn((opts: { seed?: number }) => {
      seeds.push(opts.seed);
      return runOperatorTask(
        { mapId, region: REGION, operatorId: "forest", seed: opts.seed ?? 1 },
        { getProject: () => project, applyProject: () => undefined },
      );
    });
    const root = openRegionTaskModal({
      mapId,
      region: REGION,
      run: vi.fn(),
      runOperator,
      renderSnapshot: async () => document.createElement("div"),
      projectForContext: () => project,
    }) as unknown as FakeElement;

    (findByTestId(root, "region-task-input") as unknown as { value: string }).value = "울창한 숲";
    findByTestId(root, "region-task-run")?.click();
    await flush();
    await flush();
    expect(findByTestId(root, "region-task-operator-reseed")).toBeNull();

    findByTestId(root, "region-task-retry")?.click();
    await flush();
    await flush();

    expect(seeds).toHaveLength(2);
    expect(seeds[0]).not.toBe(seeds[1]);
  });
});
