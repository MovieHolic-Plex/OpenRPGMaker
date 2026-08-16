// benchmarkPrompts.test.ts
// 벤치마크 고정 프롬프트(todo 3) 안티-게이밍 누출 스캔 — TDD: 구현 전에 먼저 작성.
// .omo/plans/tileset-vision-benchmark.md todo 3의 수용 기준을 그대로 옮긴다.
//
// 핵심 방어선: 프롬프트는 (1) ground-truth 타일 id, (2) 자산/프로젝트 이름
// (easyrpg, combined_town 계열), (3) 시트 기하 식별자/수치(tileSize, tilesPerRow,
// 480, 30, 16)를 절대 포함하지 않는다. id 목록은 groundTruth.ts에서 라이브로
// 가져와 합집합을 만든다 — 하드코딩 id 목록 금지(groundTruth가 바뀌면 이 테스트도
// 자동으로 새 id를 스캔한다; stale-state 방어).
import { describe, expect, it } from "vitest";

import type { BenchmarkTaskKind } from "@/benchmark/contract";
import {
  AUTOTILE_ANCHORS,
  AUTOTILE_GROUP_ANSWER,
  FENCE_TILES,
  FLOOR_TILES,
  ROOF_TILES,
  TRAP_TILES,
  TREE_CANOPY_TILES,
  TREE_PAIRS,
  TREE_TRUNK_TILES,
  WALL_TILES,
  WINDOW_TILES,
} from "@/benchmark/groundTruth";
import { PROMPT_VERSION } from "@/benchmark/prompts";
import { BENCHMARK_TASKS } from "@/benchmark/tasks";

// groundTruth 전체 합집합 — 하드코딩 id 목록 없음(stale-state 방어).
const GROUND_TRUTH_IDS = new Set<number>();
for (const set of [
  WALL_TILES,
  FLOOR_TILES,
  ROOF_TILES,
  WINDOW_TILES,
  TREE_TRUNK_TILES,
  TREE_CANOPY_TILES,
  FENCE_TILES,
  TRAP_TILES,
]) {
  for (const id of set) GROUND_TRUTH_IDS.add(id);
}
for (const pair of TREE_PAIRS) {
  GROUND_TRUTH_IDS.add(pair[0]);
  GROUND_TRUTH_IDS.add(pair[1]);
}
for (const entry of AUTOTILE_GROUP_ANSWER) GROUND_TRUTH_IDS.add(entry.anchor);
for (const anchor of AUTOTILE_ANCHORS) GROUND_TRUTH_IDS.add(anchor.anchor);

interface PromptCase {
  readonly id: string;
  readonly kind: BenchmarkTaskKind;
  readonly prompt: string;
}

/** 7개 태스크 프롬프트 + 모든 서브런(d1 wall/floor, d6a/d6b) 프롬프트를 모은다. */
function collectPromptCases(): PromptCase[] {
  const cases: PromptCase[] = [];
  for (const task of BENCHMARK_TASKS) {
    cases.push({ id: task.id, kind: task.kind, prompt: task.prompt() });
    for (const sub of task.subRuns ?? []) {
      cases.push({ id: `${task.id}:${sub.id}`, kind: sub.kind, prompt: sub.prompt() });
    }
  }
  return cases;
}

// 계획 todo 3이 금지한 자산/식별자/기하 토큰.
const FORBIDDEN_TOKEN_CASES: ReadonlyArray<readonly [string, RegExp]> = [
  ["easyrpg", /easyrpg/i],
  ["combined[-_ ]?town (combined_town/combined-town/combinedTown/combined town)", /combined[-_ ]?town/i],
  ["tileSize", /tileSize/i],
  ["tilesPerRow", /tilesPerRow/i],
  ["480", /480/],
  ["30", /\b30\b/],
  ["16", /\b16\b/],
];

describe("benchmark prompts (todo 3)", () => {
  it("PROMPT_VERSION === 1", () => {
    expect(PROMPT_VERSION).toBe(1);
  });

  describe("BENCHMARK_TASKS 정의", () => {
    it("정확히 7개, id는 d1..d7 중복 없음", () => {
      expect(BENCHMARK_TASKS).toHaveLength(7);
      expect(BENCHMARK_TASKS.map((task) => task.id)).toEqual(["d1", "d2", "d3", "d4", "d5", "d6", "d7"]);
    });

    it("모든 태스크/서브런이 존재하는 프롬프트 빌더를 참조한다", () => {
      for (const task of BENCHMARK_TASKS) {
        expect(typeof task.prompt, `task ${task.id}: prompt must be a builder function`).toBe("function");
        for (const sub of task.subRuns ?? []) {
          expect(
            typeof sub.prompt,
            `task ${task.id}:${sub.id}: sub-run prompt must be a builder function`,
          ).toBe("function");
        }
      }
    });

    it("d1은 wall/floor, d6은 autotileGrid/autotileCount 서브런을 번들한다", () => {
      const d1 = BENCHMARK_TASKS.find((task) => task.id === "d1");
      const d6 = BENCHMARK_TASKS.find((task) => task.id === "d6");
      expect(d1?.subRuns?.map((sub) => sub.id)).toEqual(["wall", "floor"]);
      expect(d6?.subRuns?.map((sub) => sub.id)).toEqual(["autotileGrid", "autotileCount"]);
      for (const task of BENCHMARK_TASKS) {
        if (task.id !== "d1" && task.id !== "d6") {
          expect(task.subRuns ?? [], `task ${task.id} must not have sub-runs`).toHaveLength(0);
        }
      }
    });
  });

  describe("안티-게이밍: ground-truth id 누출 없음", () => {
    it.each(collectPromptCases())("$id 프롬프트에 ground-truth 타일 id 없음", (promptCase: PromptCase) => {
      for (const id of GROUND_TRUTH_IDS) {
        expect(
          promptCase.prompt,
          `task ${promptCase.id}: prompt leaks ground-truth tile id ${id}`,
        ).not.toMatch(new RegExp(`\\b${id}\\b`));
      }
    });
  });

  describe("안티-게이밍: 자산 이름/시트 기하 토큰 없음", () => {
    it.each(collectPromptCases())("$id 프롬프트에 금지 토큰 없음", (promptCase: PromptCase) => {
      for (const [label, re] of FORBIDDEN_TOKEN_CASES) {
        expect(
          promptCase.prompt,
          `task ${promptCase.id}: prompt contains forbidden token ${label}`,
        ).not.toMatch(re);
      }
    });
  });

  describe("출력 JSON 형상 명시", () => {
    const shapeOf = (kind: BenchmarkTaskKind): RegExp[] => {
      switch (kind) {
        case "detection":
          return [/tileIds/];
        case "construction":
          return [/lower/, /upper/];
        case "autotileGrid":
          return [/grid/];
        case "autotileCount":
          return [/count/, /types/];
      }
    };

    it.each(collectPromptCases())("$id 프롬프트가 출력 JSON 형상을 명시한다", (promptCase: PromptCase) => {
      for (const re of shapeOf(promptCase.kind)) {
        expect(promptCase.prompt, `task ${promptCase.id}: prompt must mention ${re}`).toMatch(re);
      }
    });
  });
});
