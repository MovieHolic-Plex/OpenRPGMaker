// combined_town 칩셋 9문항 타일 배치 벤치마크 계약 테스트.
//
// 이 파일이 지키는 핵심 계약:
//  1. **정본 답변은 9축 전부 만점**이다 — 정답이 만점을 못 받는 채점 기준은 기준이 아니다.
//  2. 아무것도 하지 않은 답은 0점이다 — 감점 항목만 만점을 받아 빈 답이 0.667 을
//     받던 허점(2026-08-21)이 되살아나지 않게 못 박는다.
//  3. 정답표는 살아있는 엔진에서 파생된다(오토타일 11역할 분포·집 스탬프 기하).
//  4. 프롬프트에 정답이 새지 않는다 — 정수는 팔레트/프로브 집합과 정확히 같다.
//  5. 보관본을 다시 채점하면 바이트가 같다(이 벤치마크가 실제로 보증하는 재현성).
//  6. 계약 위반은 전체 거부이며 0점이 아니라 "채점 불가"로 기록된다.
import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { parseTownAnswer, TownContractError } from "@/benchmark/town/contract";
import { buildTownGroundTruth } from "@/benchmark/town/groundTruth";
import {
  AUTOTILE_EXPECTED_ROLE_COUNTS,
  LAYER_PROBE_TILES,
  PASSABILITY_PROBE_TILES,
  WALL_PROBE_TILES,
} from "@/benchmark/town/fixtures";
import { renderTownImagePng, townImageDigests, TOWN_IMAGE_KEYS } from "@/benchmark/town/inputImages";
import {
  buildTownRunManifest,
  parseTownRecord,
  serializeTownRecord,
  summarizeAttempts,
  TownArchiveError,
} from "@/benchmark/town/manifest";
import { paletteFor, TOWN_PALETTES } from "@/benchmark/town/palettes";
import { TOWN_PROMPT_VERSION } from "@/benchmark/town/prompts";
import { aggregateAxisScores, replayTownArchive, runTownBenchmark } from "@/benchmark/town/runner";
import { scoreTownAutotile } from "@/benchmark/town/scoringGrid";
import { scoreTownProbe } from "@/benchmark/town/scoringSets";
import { scoreTownPlacement } from "@/benchmark/town/scoringStructure";
import { TOWN_TASKS, townTaskById, townTaskSuiteDigest } from "@/benchmark/town/tasks";
import {
  EMPTY_CELL,
  PASS_THRESHOLD,
  TOWN_AXIS_ORDER,
  TOWN_DETERMINISTIC_PARAMS,
  TOWN_TILE_COUNT,
  type TownPlacementKey,
} from "@/benchmark/town/types";

const groundTruth = buildTownGroundTruth();

/** grid 답변이 어느 레이어를 뜻하는지 — 채점기와 같은 규약을 테스트도 쓴다. */
const GRID_LAYER: Readonly<Record<string, "lower" | "upper">> = {
  roadGrid: "lower",
  doorGrid: "lower",
  fenceGrid: "upper",
};

function rows(flat: readonly number[], width: number): number[][] {
  const out: number[][] = [];
  for (let y = 0; y * width < flat.length; y += 1) out.push([...flat.slice(y * width, (y + 1) * width)]);
  return out;
}

function filled(width: number, height: number, value: number): number[][] {
  return Array.from({ length: height }, () => new Array<number>(width).fill(value));
}

/** 정본 답변 — 각 태스크의 정답을 그대로 낸다. */
function canonicalAnswerFor(taskId: string): string {
  const task = townTaskById(taskId);
  if (task.kind === "tileSet") {
    const probe = groundTruth[task.probe!];
    return JSON.stringify({ tileIds: [...probe.positives].sort((a, b) => a - b) });
  }
  if (task.axis === "autotile") {
    const reference = groundTruth.autotile;
    const grid = filled(reference.width, reference.height, EMPTY_CELL);
    for (const cell of reference.cells) grid[cell.y]![cell.x] = cell.tile;
    return JSON.stringify({ grid });
  }
  const reference = groundTruth.placements[task.placement!];
  const layer = GRID_LAYER[reference.key];
  if (layer) {
    return JSON.stringify({ grid: rows(layer === "lower" ? reference.lower : reference.upper, reference.width) });
  }
  return JSON.stringify({
    lower: rows(reference.lower, reference.width),
    upper: rows(reference.upper, reference.width),
  });
}

function scoreCanonical(taskId: string): number {
  const task = townTaskById(taskId);
  const answer = parseTownAnswer(canonicalAnswerFor(taskId), task.kind);
  if (task.kind === "tileSet") {
    return scoreTownProbe({ answer: answer as { tileIds: number[] }, probe: groundTruth[task.probe!], axis: task.axis }).score;
  }
  if (task.axis === "autotile") {
    return scoreTownAutotile({ answer: answer as { grid: number[][] }, reference: groundTruth.autotile }).score;
  }
  return scoreTownPlacement({ answer, reference: groundTruth.placements[task.placement!], groundTruth }).score;
}

describe("정본 답변은 모든 태스크에서 만점", () => {
  for (const task of TOWN_TASKS) {
    it(`${task.id} (${task.titleKo}) = 1.0`, () => {
      expect(scoreCanonical(task.id)).toBeCloseTo(1, 6);
    });
  }

  it("9축 집계도 전부 만점이고 종합이 1.0", async () => {
    const record = await runTownBenchmark({
      model: "reference",
      repeats: 2,
      startedAt: "1970-01-01T00:00:00.000Z",
      send: async (request) => ({
        ok: true,
        text: canonicalAnswerFor((request.requestBody as { taskId: string }).taskId),
      }),
    });
    for (const axis of TOWN_AXIS_ORDER) expect(record.axisScores[axis]).toBeCloseTo(1, 6);
    expect(record.overall).toBeCloseTo(1, 6);
    // 같은 답을 두 번 내면 재현성 축은 1.0 이다.
    expect(record.axisScores.reproducibility).toBeCloseTo(1, 6);
  });
});

describe("아무것도 하지 않은 답과 도배한 답은 0점", () => {
  for (const key of Object.keys(groundTruth.placements) as TownPlacementKey[]) {
    it(`${key}: 빈 답 = 0, 한 타일 도배 = 0`, () => {
      const reference = groundTruth.placements[key];
      const layer = GRID_LAYER[key];
      const make = (value: number) =>
        layer
          ? { grid: filled(reference.width, reference.height, value) }
          : {
              lower: filled(reference.width, reference.height, value),
              upper: filled(reference.width, reference.height, value),
            };
      expect(scoreTownPlacement({ answer: make(EMPTY_CELL), reference, groundTruth }).score).toBe(0);
      // 306 = 일반 벽 타일. 어떤 문항의 정답도 "전면 도배"가 아니다.
      expect(scoreTownPlacement({ answer: make(306), reference, groundTruth }).score).toBeLessThan(0.35);
    });
  }

  it("오토타일: 몸통 타일로만 칠하면 크게 깎인다", () => {
    const reference = groundTruth.autotile;
    const grid = filled(reference.width, reference.height, EMPTY_CELL);
    for (const cell of reference.cells) grid[cell.y]![cell.x] = reference.block.body;
    const score = scoreTownAutotile({ answer: { grid }, reference }).score;
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThan
      (0.1);
  });

  it("프로브: 전부 예/전부 아니오는 0.5 를 넘지 못한다", () => {
    for (const key of ["wall", "passability", "layer"] as const) {
      const probe = groundTruth[key];
      const all = scoreTownProbe({ answer: { tileIds: [...probe.probes].sort((a, b) => a - b) }, probe, axis: "layer" });
      const none = scoreTownProbe({ answer: { tileIds: [] }, probe, axis: "layer" });
      expect(all.score).toBeLessThanOrEqual(0.5);
      expect(none.score).toBeLessThanOrEqual(0.5);
    }
  });
});

describe("정답표는 엔진에서 파생된다", () => {
  it("오토타일 도형이 11역할을 전부 만든다", () => {
    const counts: Record<string, number> = {};
    for (const cell of groundTruth.autotile.cells) counts[cell.role] = (counts[cell.role] ?? 0) + 1;
    expect(counts).toEqual(AUTOTILE_EXPECTED_ROLE_COUNTS);
    expect(groundTruth.autotile.cells).toHaveLength(21);
  });

  it("배치 정본은 전부 그리드 크기와 길이가 맞고 비어 있지 않다", () => {
    for (const reference of Object.values(groundTruth.placements)) {
      const size = reference.width * reference.height;
      for (const grid of [reference.lower, reference.upper, reference.baseLower, reference.baseUpper]) {
        expect(grid).toHaveLength(size);
      }
      const placed = [...reference.lower, ...reference.upper].filter((tile) => tile !== EMPTY_CELL).length;
      expect(placed).toBeGreaterThan(0);
    }
  });

  it("프로브 정답은 한쪽으로 쏠려 있지 않다", () => {
    for (const [probe, tiles] of [
      [groundTruth.wall, WALL_PROBE_TILES],
      [groundTruth.passability, PASSABILITY_PROBE_TILES],
      [groundTruth.layer, LAYER_PROBE_TILES],
    ] as const) {
      expect(probe.probes).toEqual([...tiles]);
      expect(probe.positives.size).toBeGreaterThan(0);
      expect(probe.positives.size).toBeLessThan(tiles.length);
    }
  });

  it("정답표 digest 는 같은 입력에 대해 같다", () => {
    expect(buildTownGroundTruth().digest).toBe(groundTruth.digest);
    expect(groundTruth.digest).toHaveLength(64);
  });
});

describe("프롬프트는 정답을 흘리지 않는다", () => {
  const FORBIDDEN = [/easyrpg/i, /combined\s*town/i, /tileSemantics/i, /harness/i, /chipset/i];

  for (const task of TOWN_TASKS) {
    it(`${task.id}: 정수는 팔레트/프로브 집합과 정확히 같다`, () => {
      const prompt = task.prompt();
      // -1 은 "빈 칸" 표기이므로 허용한다. 그 외 정수는 어휘여야만 한다.
      const integers = [...prompt.matchAll(/-?\d+/g)]
        .map((match) => Number.parseInt(match[0], 10))
        .filter((value) => value !== -1);
      const expected = task.kind === "tileSet" ? groundTruth[task.probe!].probes : paletteFor(task.input);
      expect([...new Set(integers)].sort((a, b) => a - b)).toEqual([...expected].sort((a, b) => a - b));
    });

    it(`${task.id}: 금지어가 없고 답변 형상을 명시한다`, () => {
      const prompt = task.prompt();
      for (const pattern of FORBIDDEN) expect(prompt).not.toMatch(pattern);
      const shapeKey = task.kind === "tileSet" ? "tileIds" : task.kind === "grid" ? '"grid"' : '"lower"';
      expect(prompt).toContain(shapeKey);
    });
  }

  it("프로브 프롬프트는 정답 부분집합을 싣지 않는다", () => {
    for (const task of TOWN_TASKS.filter((candidate) => candidate.kind === "tileSet")) {
      const prompt = task.prompt();
      const probe = groundTruth[task.probe!];
      // 정답만 모아 놓은 연속 문자열이 프롬프트에 들어가면 즉시 유출이다.
      const positives = [...probe.positives].sort((a, b) => a - b).join(", ");
      expect(prompt).not.toContain(positives);
    }
  });

  it("팔레트는 오름차순·중복 없음이며 타일 범위를 벗어나지 않는다", () => {
    for (const palette of Object.values(TOWN_PALETTES)) {
      expect(palette).toBeDefined();
      const ids = [...palette!];
      expect(ids).toEqual([...new Set(ids)].sort((a, b) => a - b));
      for (const id of ids) {
        expect(Number.isInteger(id)).toBe(true);
        expect(id).toBeGreaterThanOrEqual(0);
        expect(id).toBeLessThan(TOWN_TILE_COUNT);
      }
    }
  });
});

describe("입력 이미지", () => {
  it("소스에 글자 렌더 API 가 없다(타일 번호를 그려 주지 않는다)", () => {
    // 호출 문법만 본다 — 이 규칙을 설명하는 주석 자체에 API 이름이 나오기 때문이다.
    const source = fs.readFileSync("src/benchmark/town/inputImages.ts", "utf8");
    expect(source).not.toMatch(/\.print\s*\(/);
    expect(source).not.toMatch(/loadFont\s*\(/);
    expect(source).not.toMatch(/FONT_SANS/);
  });

  it("11장이 모두 렌더되고 바이트가 결정적이다", async () => {
    const first = await townImageDigests();
    const second = await townImageDigests();
    expect(Object.keys(first).sort()).toEqual([...TOWN_IMAGE_KEYS].sort());
    expect(first).toEqual(second);
    for (const digest of Object.values(first)) expect(digest).toHaveLength(64);
  });

  it("태스크마다 대응하는 이미지가 있다", async () => {
    for (const task of TOWN_TASKS) {
      expect(TOWN_IMAGE_KEYS).toContain(task.input);
      const png = await renderTownImagePng(task.input);
      expect(png.length).toBeGreaterThan(200);
    }
  });
});

describe("계약 위반은 전체 거부", () => {
  it("산문·빈 문자열은 not-json 으로 거부한다", () => {
    expect(() => parseTownAnswer("여기 답이 있습니다", "grid")).toThrow(TownContractError);
    expect(() => parseTownAnswer("", "tileSet")).toThrow(TownContractError);
  });

  it("범위를 벗어난 id·비정수·비직사각은 거부한다", () => {
    expect(() => parseTownAnswer('{"tileIds":[480]}', "tileSet")).toThrow(/id-out-of-range/);
    expect(() => parseTownAnswer('{"tileIds":[5,5]}', "tileSet")).toThrow(/duplicate-id/);
    expect(() => parseTownAnswer('{"tileIds":[9,2]}', "tileSet")).toThrow(/not-ascending/);
    expect(() => parseTownAnswer('{"grid":[[1,2],[3]]}', "grid")).toThrow(/non-rectangular/);
    expect(() => parseTownAnswer('{"grid":[[1.5]]}', "grid")).toThrow(/non-integer-id/);
    expect(() => parseTownAnswer('{"lower":[[1]],"upper":[[1],[1]]}', "layered")).toThrow(/shape-mismatch/);
  });

  it("코드펜스로 감싼 JSON 은 받아 준다", () => {
    expect(parseTownAnswer('```json\n{"tileIds":[1,2]}\n```', "tileSet")).toEqual({ tileIds: [1, 2] });
  });

  it("형상이 다른 그리드는 throw 없이 0점 + shapeMismatch 플래그", () => {
    const reference = groundTruth.placements.villageGrid;
    const scored = scoreTownPlacement({ answer: { lower: [[1]], upper: [[1]] }, reference, groundTruth });
    expect(scored.score).toBe(0);
    expect(scored.detail.shapeMismatch).toBe(1);
  });

  it("계약 위반 시도는 0점이 아니라 채점 불가로 기록된다", async () => {
    const record = await runTownBenchmark({
      model: "prose-only",
      repeats: 1,
      taskIds: ["t1-autotile-path"],
      startedAt: "1970-01-01T00:00:00.000Z",
      send: async () => ({ ok: true, text: "제가 대신 설명해 드리겠습니다." }),
    });
    const task = record.tasks[0]!;
    expect(task.attempts[0]!.error?.kind).toBe("contract");
    expect(task.attempts[0]!.scored).toBeNull();
    expect(task.meanScore).toBeNull();
  });

  it("전송 실패도 throw 하지 않고 기록으로 남는다", async () => {
    const record = await runTownBenchmark({
      model: "offline",
      repeats: 1,
      taskIds: ["t9-door"],
      startedAt: "1970-01-01T00:00:00.000Z",
      send: async () => ({ ok: false, error: { kind: "network", message: "boom" } }),
    });
    expect(record.tasks[0]!.attempts[0]!.error?.kind).toBe("network");
    expect(record.tasks[0]!.meanScore).toBeNull();
    expect(record.tasks[0]!.stability).toBeNull();
  });
});

describe("재현성 척추", () => {
  it("매니페스트 해시는 내용에만 의존한다", async () => {
    const base = {
      promptVersion: TOWN_PROMPT_VERSION,
      groundTruthDigest: groundTruth.digest,
      imageDigests: await townImageDigests(),
      taskSuiteDigest: townTaskSuiteDigest(),
      params: TOWN_DETERMINISTIC_PARAMS,
    };
    expect(buildTownRunManifest(base).manifestHash).toBe(buildTownRunManifest(base).manifestHash);
    const bumped = buildTownRunManifest({ ...base, promptVersion: TOWN_PROMPT_VERSION + 1 });
    expect(bumped.manifestHash).not.toBe(buildTownRunManifest(base).manifestHash);
  });

  it("태스크 스위트 digest 는 프롬프트가 바뀌면 바뀐다", () => {
    const mutated = TOWN_TASKS.map((task, index) =>
      index === 0 ? { ...task, prompt: () => `${task.prompt()} extra` } : task,
    );
    expect(townTaskSuiteDigest(mutated)).not.toBe(townTaskSuiteDigest());
  });

  it("보관본을 다시 채점하면 바이트가 같다", async () => {
    const record = await runTownBenchmark({
      model: "reference",
      repeats: 2,
      startedAt: "1970-01-01T00:00:00.000Z",
      send: async (request) => ({
        ok: true,
        text: canonicalAnswerFor((request.requestBody as { taskId: string }).taskId),
      }),
    });
    const serialized = serializeTownRecord(record);
    expect(serializeTownRecord(replayTownArchive(record))).toBe(serialized);
    expect(serializeTownRecord(parseTownRecord(serialized))).toBe(serialized);
  });

  it("망가진 보관본은 필드를 지목하며 거부한다", () => {
    expect(() => parseTownRecord("{")).toThrow(TownArchiveError);
    expect(() => parseTownRecord('{"recordVersion":2}')).toThrow(/recordVersion/);
  });

  it("반복 요약은 모집단 표준편차를 쓴다", () => {
    expect(summarizeAttempts([], PASS_THRESHOLD)).toEqual({ mean: null, stdDev: null, passAtK: 0 });
    const summary = summarizeAttempts([0.5, 1], PASS_THRESHOLD);
    expect(summary.mean).toBeCloseTo(0.75, 6);
    expect(summary.stdDev).toBeCloseTo(0.25, 6);
    expect(summary.passAtK).toBe(1);
  });

  it("답이 흔들리면 재현성 축이 내려간다", async () => {
    let call = 0;
    const record = await runTownBenchmark({
      model: "flaky",
      repeats: 2,
      taskIds: ["t2-layer-probe"],
      startedAt: "1970-01-01T00:00:00.000Z",
      send: async () => {
        call += 1;
        return { ok: true, text: call === 1 ? '{"tileIds":[260]}' : '{"tileIds":[374]}' };
      },
    });
    expect(record.tasks[0]!.stability).toBe(0);
    expect(record.axisScores.reproducibility).toBe(0);
  });

  it("측정된 태스크가 없는 축은 0 이 아니라 null 이다", () => {
    const scores = aggregateAxisScores([]);
    for (const axis of TOWN_AXIS_ORDER) expect(scores[axis]).toBeNull();
  });
});
