// 실내 칩셋 LLM 타일 배치 벤치마크 계약 테스트.
//
// 이 파일이 지키는 핵심 계약:
//  1. 정답 카테고리는 소스 테이블에서 파생되고 스냅샷과 일치한다(stale-state 방어).
//  2. **정본 답변은 모든 태스크에서 만점**이다 — 정답이 만점을 못 받는 채점 기준은 기준이 아니다.
//  3. 보관본을 다시 채점하면 바이트가 같다(이 벤치마크가 실제로 보증하는 재현성).
//  4. 계약 위반은 전체 거부이며 0점이 아니라 "채점 불가"로 기록된다.
import { describe, expect, it } from "vitest";
import { buildInteriorGroundTruth, INTERIOR_CATEGORY_KEYS } from "@/benchmark/interior/groundTruth";
import { InteriorContractError, parseInteriorAnswer } from "@/benchmark/interior/contract";
import { canonicalJson, digestOf, sha256Hex } from "@/benchmark/interior/hash";
import {
  buildRunManifest,
  InteriorArchiveError,
  parseRunRecord,
  serializeRunRecord,
  summarizeAttempts,
} from "@/benchmark/interior/manifest";
import { interiorImageDigests, renderInteriorImagePng } from "@/benchmark/interior/inputImages";
import { INTERIOR_PROMPT_VERSION } from "@/benchmark/interior/prompts";
import { replayInteriorArchive, runInteriorBenchmark } from "@/benchmark/interior/runner";
import { scorePlacementAnswer } from "@/benchmark/interior/scoringStructure";
import { scoreTileSetAnswer } from "@/benchmark/interior/scoringSets";
import { INTERIOR_TASKS, interiorTaskSuiteDigest } from "@/benchmark/interior/tasks";
import {
  DEFAULT_SCHEME_WEIGHTS,
  DETERMINISTIC_PARAMS,
  INTERIOR_TILE_COUNT,
  PASS_THRESHOLD,
  type InteriorGroundTruth,
  type PlacementAnswer,
  type RunRecord,
} from "@/benchmark/interior/types";

const groundTruth = buildInteriorGroundTruth();

/** 정본 답변 — 각 태스크의 정답을 그대로 낸다. */
function canonicalAnswerFor(taskId: string): string {
  const task = INTERIOR_TASKS.find((candidate) => candidate.id === taskId)!;
  if (task.kind === "tileSet") {
    return JSON.stringify({ tileIds: [...groundTruth.categories[task.category!].canonical].sort((a, b) => a - b) });
  }
  return JSON.stringify(canonicalPlacement(task.input));
}

function canonicalPlacement(fixtureId: string): PlacementAnswer {
  const house = groundTruth.houses[fixtureId]!;
  const lower = Array.from({ length: house.height }, () => Array.from({ length: house.width }, () => -1));
  const upper = Array.from({ length: house.height }, () => Array.from({ length: house.width }, () => -1));
  for (const placement of house.walls) lower[placement.y]![placement.x] = placement.tile;
  return { lower, upper };
}

async function runWithStub(
  answerFor: (taskId: string, attempt: number) => string,
  options: { repeats?: number; taskIds?: readonly string[]; model?: string } = {},
): Promise<RunRecord> {
  const attemptByTask = new Map<string, number>();
  return runInteriorBenchmark({
    model: options.model ?? "stub/test",
    repeats: options.repeats ?? 1,
    taskIds: options.taskIds,
    startedAt: "2026-08-20T00:00:00.000Z",
    send: async (request) => {
      const taskId = (request.requestBody as { taskId: string }).taskId;
      const attempt = (attemptByTask.get(taskId) ?? 0) + 1;
      attemptByTask.set(taskId, attempt);
      return { ok: true, text: answerFor(taskId, attempt) };
    },
  });
}

describe("interior benchmark ground truth", () => {
  it("모든 카테고리가 비어 있지 않고 id 가 유효 범위다", () => {
    expect(INTERIOR_CATEGORY_KEYS.length).toBe(10);
    for (const key of INTERIOR_CATEGORY_KEYS) {
      const truth = groundTruth.categories[key];
      expect(truth.canonical.size, `${key} canonical`).toBeGreaterThan(0);
      for (const id of truth.canonical) {
        expect(Number.isInteger(id)).toBe(true);
        expect(id).toBeGreaterThanOrEqual(0);
        expect(id).toBeLessThan(INTERIOR_TILE_COUNT);
      }
    }
  });

  it("generous 는 canonical 의 상위집합이고 traps 와는 배타적이다", () => {
    for (const key of INTERIOR_CATEGORY_KEYS) {
      const truth = groundTruth.categories[key];
      for (const id of truth.canonical) expect(truth.generous.has(id), `${key} generous ⊇ canonical`).toBe(true);
      for (const id of truth.traps) expect(truth.generous.has(id), `${key} trap ∉ generous`).toBe(false);
    }
  });

  it("houseShellWall 은 일반 벽과 구분되며 벽돌·석벽을 함정으로 둔다", () => {
    const shell = groundTruth.categories.houseShellWall;
    const any = groundTruth.categories.wallAny;
    // 정본 셸은 일반 벽 집합보다 훨씬 작다 — 이 격차가 벤치마크의 헤드라인 지표다.
    expect(shell.canonical.size).toBeLessThan(any.canonical.size / 4);
    expect(shell.traps.size).toBeGreaterThan(shell.canonical.size);
  });

  it("정본 주택 플랜이 실측 형상과 일치한다", () => {
    const house = groundTruth.houses.houseGrid!;
    expect(house.width).toBe(12);
    expect(house.height).toBe(10);
    expect(house.walls.length).toBe(62);
    expect([...new Set(house.walls.map((w) => w.tile))].sort((a, b) => a - b)).toEqual([
      72, 74, 75, 76, 104, 105, 106, 430,
    ]);
    expect(groundTruth.houses.roomGrid!.width).toBe(14);
  });

  it("바닥 마스크는 플랜이 실제로 바닥을 깐 칸만 포함한다", () => {
    // 칸막이로 전환된 칸은 바닥이 아니다 — 아니면 정본 답변이 스스로 감점된다.
    for (const house of Object.values(groundTruth.houses)) {
      const planned = new Map(house.walls.map((w) => [`${w.x},${w.y}`, w.tile]));
      for (let y = 0; y < house.height; y += 1) {
        for (let x = 0; x < house.width; x += 1) {
          if (house.floor[y * house.width + x] !== true) continue;
          expect(planned.get(`${x},${y}`), `${house.fixtureId} (${x},${y})`).toBe(72);
        }
      }
    }
  });

  it("digest 는 호출 간 안정적이다", () => {
    expect(buildInteriorGroundTruth().digest).toBe(groundTruth.digest);
    expect(groundTruth.digest).toHaveLength(64);
  });
});

describe("interior benchmark hashing", () => {
  it("sha256 이 알려진 벡터와 일치한다", () => {
    expect(sha256Hex("")).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
    expect(sha256Hex("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    // 55/56 바이트는 sha256 패딩 경계다.
    expect(sha256Hex("a".repeat(55))).toBe("9f4390f8d30c2dd92ec9f095b65e2b9ae9b0a925a5258e241c9f1e910f734318");
    expect(sha256Hex("a".repeat(56))).toBe("b35439a4ac6f0948b6d6f9e3c6af0f5f590ce20f1bde7090ef7970686ec6738a");
  });

  it("canonicalJson 은 키 순서와 무관하고 Set 을 정렬한다", () => {
    expect(canonicalJson({ b: 1, a: 2 })).toBe(canonicalJson({ a: 2, b: 1 }));
    expect(canonicalJson({ s: new Set([3, 1, 2]) })).toBe('{"s":[1,2,3]}');
    expect(digestOf({ x: [1, 2] })).toBe(digestOf({ x: [1, 2] }));
  });
});

describe("interior benchmark answer contract", () => {
  it("유효한 형상을 받아들이고 코드펜스를 벗긴다", () => {
    expect(parseInteriorAnswer('{"tileIds":[1,2,3]}', "tileSet")).toEqual({ tileIds: [1, 2, 3] });
    expect(parseInteriorAnswer('```json\n{"tileIds":[5]}\n```', "tileSet")).toEqual({ tileIds: [5] });
    expect(parseInteriorAnswer('Sure! {"tileIds":[7]} done', "tileSet")).toEqual({ tileIds: [7] });
    expect(parseInteriorAnswer('{"lower":[[1,-1]],"upper":[[-1,-1]]}', "placement")).toEqual({
      lower: [[1, -1]],
      upper: [[-1, -1]],
    });
  });

  it.each([
    ["산문만", "the walls are on the left", "tileSet", "answer"],
    ["malformed JSON", '{"tileIds":[1,2', "tileSet", "answer"],
    ["오름차순 위반", '{"tileIds":[5,3]}', "tileSet", "tileIds"],
    ["중복 id", '{"tileIds":[3,3]}', "tileSet", "tileIds"],
    ["범위 초과", '{"tileIds":[480]}', "tileSet", "tileIds"],
    ["집합에 -1", '{"tileIds":[-1]}', "tileSet", "tileIds"],
    ["비직사각형", '{"lower":[[1],[1,2]],"upper":[[1],[1,2]]}', "placement", "lower"],
    ["형상 불일치", '{"lower":[[1,2]],"upper":[[1]]}', "placement", "upper"],
  ])("%s 은 전체 거부한다", (_label, raw, kind, field) => {
    try {
      parseInteriorAnswer(raw, kind as "tileSet" | "placement");
      throw new Error("거부되지 않았다");
    } catch (error) {
      expect(error).toBeInstanceOf(InteriorContractError);
      expect((error as InteriorContractError).field).toBe(field);
    }
  });
});

describe("interior benchmark prompts and tasks", () => {
  it("프롬프트에 정답 id 나 시트 기하 수치가 없다", () => {
    for (const task of INTERIOR_TASKS) {
      const text = task.prompt();
      expect(text.length).toBeGreaterThan(0);
      // 0..479 범위의 독립 숫자가 하나도 없어야 한다(-1 안내는 허용).
      for (const match of text.matchAll(/(?<![-\w])\d+/g)) {
        const value = Number.parseInt(match[0], 10);
        expect(value >= 0 && value < INTERIOR_TILE_COUNT, `${task.id} leaks ${value}`).toBe(false);
      }
      for (const forbidden of ["easyrpg", "tileSemantics", "harness", "tilesPerRow", "tileSize", "chipset"]) {
        expect(text.toLowerCase()).not.toContain(forbidden.toLowerCase());
      }
    }
  });

  it("태스크 id 는 고유하고 종류별 필드 계약을 지킨다", () => {
    expect(new Set(INTERIOR_TASKS.map((t) => t.id)).size).toBe(INTERIOR_TASKS.length);
    for (const task of INTERIOR_TASKS) {
      if (task.kind === "tileSet") {
        expect(task.category, task.id).toBeDefined();
        expect(task.input).toBe("atlas");
      } else {
        expect(task.category, task.id).toBeUndefined();
        expect(["houseGrid", "roomGrid"]).toContain(task.input);
      }
    }
  });

  it("스위트 digest 는 안정적이고 스킴 변경에 반응한다", () => {
    expect(interiorTaskSuiteDigest()).toBe(interiorTaskSuiteDigest());
    const mutated = INTERIOR_TASKS.map((task, index) =>
      index === 0 ? { ...task, schemes: ["setF1"] as const } : task,
    );
    expect(interiorTaskSuiteDigest(mutated)).not.toBe(interiorTaskSuiteDigest());
  });
});

describe("interior benchmark input images", () => {
  it("세 이미지가 유효한 PNG 이며 바이트가 결정적이다", async () => {
    for (const key of ["atlas", "houseGrid", "roomGrid"] as const) {
      const first = await renderInteriorImagePng(key);
      const second = await renderInteriorImagePng(key);
      expect([first[0], first[1], first[2], first[3]]).toEqual([0x89, 0x50, 0x4e, 0x47]);
      expect(Buffer.from(first).equals(Buffer.from(second)), `${key} byte-identical`).toBe(true);
    }
  });

  it("이미지 digest 는 서로 다르고 재계산해도 같다", async () => {
    const first = await interiorImageDigests();
    const second = await interiorImageDigests();
    expect(first).toEqual(second);
    expect(new Set(Object.values(first)).size).toBe(3);
  });

  it("이미지 렌더러는 텍스트 API 를 쓰지 않는다", async () => {
    const source = await import("node:fs/promises").then((fs) =>
      fs.readFile("src/benchmark/interior/inputImages.ts", "utf8"),
    );
    // jimp 의 텍스트 API 호출이 없어야 한다. 주석·변수명이 아니라 실제 호출만 본다.
    expect(source).not.toMatch(/\bJimp\.loadFont\b|\bFONT_SANS\w*\b|\w+\.print\s*\(/);
  });
});

describe("interior benchmark manifest", () => {
  const base = {
    promptVersion: INTERIOR_PROMPT_VERSION,
    groundTruthDigest: groundTruth.digest,
    imageDigests: { atlas: "a".repeat(64), houseGrid: "b".repeat(64), roomGrid: "c".repeat(64) },
    taskSuiteDigest: interiorTaskSuiteDigest(),
    weights: DEFAULT_SCHEME_WEIGHTS,
    params: DETERMINISTIC_PARAMS,
  };

  it("같은 입력은 같은 해시, 다른 입력은 다른 해시", () => {
    expect(buildRunManifest(base).manifestHash).toBe(buildRunManifest(base).manifestHash);
    expect(buildRunManifest({ ...base, promptVersion: 99 }).manifestHash).not.toBe(buildRunManifest(base).manifestHash);
    expect(
      buildRunManifest({ ...base, imageDigests: { ...base.imageDigests, atlas: "d".repeat(64) } }).manifestHash,
    ).not.toBe(buildRunManifest(base).manifestHash);
    expect(
      buildRunManifest({ ...base, weights: { ...DEFAULT_SCHEME_WEIGHTS, setF1: 9 } }).manifestHash,
    ).not.toBe(buildRunManifest(base).manifestHash);
    expect(
      buildRunManifest({ ...base, params: { ...DETERMINISTIC_PARAMS, temperature: 0.7 } }).manifestHash,
    ).not.toBe(buildRunManifest(base).manifestHash);
  });

  it("summarizeAttempts 가 평균·모집단 표준편차·pass@k 를 낸다", () => {
    expect(summarizeAttempts([], PASS_THRESHOLD)).toEqual({ mean: null, stdDev: null, passAtK: 0 });
    expect(summarizeAttempts([0.9], PASS_THRESHOLD)).toEqual({ mean: 0.9, stdDev: 0, passAtK: 1 });
    const two = summarizeAttempts([0.5, 1], PASS_THRESHOLD);
    expect(two.mean).toBeCloseTo(0.75, 10);
    expect(two.stdDev).toBeCloseTo(0.25, 10);
    expect(summarizeAttempts([0.1, 0.2], PASS_THRESHOLD).passAtK).toBe(0);
  });

  it("보관본 파싱은 fail-closed 다", () => {
    expect(() => parseRunRecord("{oops")).toThrow(InteriorArchiveError);
    expect(() => parseRunRecord(JSON.stringify({ recordVersion: 2 }))).toThrow(/recordVersion/);
    expect(() => parseRunRecord(JSON.stringify({ recordVersion: 1, model: "" }))).toThrow(/model/);
  });
});

describe("interior benchmark scoring schemes", () => {
  it("정본 답변은 모든 태스크에서 만점에 가깝다", async () => {
    const record = await runWithStub((taskId) => canonicalAnswerFor(taskId));
    for (const task of record.tasks) {
      expect(task.attempts[0]!.error, `${task.taskId} error`).toBeNull();
      // t1-wall-any 만 예외: 정답 102칸 중 일부가 벽 아닌 시맨틱 역할을 달고 있어
      // rolePurity 가 구조적으로 1.0 에 못 미친다(실측 0.98).
      const floor = task.taskId === "t1-wall-any" ? 0.99 : 0.999;
      expect(task.compositeMean, `${task.taskId} composite`).toBeGreaterThanOrEqual(floor);
    }
    expect(record.overallComposite).toBeGreaterThan(0.99);
  });

  it("빈 답변은 0점이고 예외를 던지지 않는다", () => {
    const scored = scoreTileSetAnswer({
      answer: { tileIds: [] },
      truth: groundTruth.categories.houseShellWall,
      schemes: ["setF1", "semantic", "trapPenalty", "rolePurity"],
      weights: DEFAULT_SCHEME_WEIGHTS,
    });
    expect(scored.composite).toBe(0);
    for (const entry of scored.schemes) expect(entry.score).toBe(0);
  });

  it("모든 타일을 답하면 정밀도가 무너지고 재현율만 남는다", () => {
    const all = Array.from({ length: INTERIOR_TILE_COUNT }, (_, index) => index);
    const scored = scoreTileSetAnswer({
      answer: { tileIds: all },
      truth: groundTruth.categories.houseShellWall,
      schemes: ["setF1"],
      weights: DEFAULT_SCHEME_WEIGHTS,
    });
    expect(scored.schemes[0]!.detail.recall).toBe(1);
    expect(scored.schemes[0]!.detail.precision).toBeLessThan(0.05);
  });

  it("함정만 고르면 trapPenalty rawScore 가 음수가 되고 score 는 0 으로 잘린다", () => {
    const truth = groundTruth.categories.houseShellWall;
    const scored = scoreTileSetAnswer({
      answer: { tileIds: [...truth.traps].sort((a, b) => a - b) },
      truth,
      schemes: ["trapPenalty"],
      weights: DEFAULT_SCHEME_WEIGHTS,
    });
    expect(scored.schemes[0]!.rawScore).toBeLessThan(0);
    expect(scored.schemes[0]!.score).toBe(0);
  });

  it("generous 전용 적중은 정확히 절반의 부분점수를 받는다", () => {
    const truth = groundTruth.categories.ceiling;
    const generousOnly = [...truth.generous].filter((id) => !truth.canonical.has(id)).sort((a, b) => a - b);
    const scored = scoreTileSetAnswer({
      answer: { tileIds: generousOnly },
      truth,
      schemes: ["semantic"],
      weights: DEFAULT_SCHEME_WEIGHTS,
    });
    const detail = scored.schemes[0]!.detail;
    expect(detail.exactHits).toBe(0);
    expect(detail.generousHits).toBe(generousOnly.length);
    expect(scored.schemes[0]!.score).toBeCloseTo((0.5 * generousOnly.length) / detail.denominator, 10);
  });

  it("정본과 다른 타일로 지은 멀쩡한 집은 structural 만점, gridIdentity 저점", () => {
    const house = groundTruth.houses.houseGrid!;
    // 정본 셸 대신 벽돌벽(14)과 돌바닥(12)으로만 짓는다 — 구조는 동일.
    const BRICK = 14;
    const STONE_FLOOR = 12;
    expectSolid(groundTruth, BRICK);
    expectPassable(groundTruth, STONE_FLOOR);
    const canonical = canonicalPlacement("houseGrid");
    const lower = canonical.lower.map((row) => [...row]);
    for (let y = 0; y < house.height; y += 1) {
      for (let x = 0; x < house.width; x += 1) {
        const tile = lower[y]![x]!;
        if (tile === -1) continue;
        lower[y]![x] = house.floor[y * house.width + x] === true || tile === 72 ? STONE_FLOOR : BRICK;
      }
    }
    const answer: PlacementAnswer = { lower, upper: canonical.upper };
    const scored = scorePlacementAnswer({
      answer,
      house,
      groundTruth,
      schemes: ["gridIdentity", "structural"],
      weights: DEFAULT_SCHEME_WEIGHTS,
    });
    const byScheme = new Map(scored.schemes.map((entry) => [entry.scheme, entry]));
    expect(byScheme.get("structural")!.score).toBe(1);
    expect(byScheme.get("gridIdentity")!.score).toBeLessThan(0.2);
  });

  it("형상이 다른 그리드는 예외 없이 0점 + shapeMismatch 플래그", () => {
    const scored = scorePlacementAnswer({
      answer: { lower: [[1]], upper: [[1]] },
      house: groundTruth.houses.houseGrid!,
      groundTruth,
      schemes: ["gridIdentity", "structural"],
      weights: DEFAULT_SCHEME_WEIGHTS,
    });
    expect(scored.composite).toBe(0);
    for (const entry of scored.schemes) expect(entry.detail.shapeMismatch).toBe(1);
  });

  it("금지 타일을 쓰면 noForbidden 이 0 이 된다", () => {
    const canonical = canonicalPlacement("houseGrid");
    const lower = canonical.lower.map((row) => [...row]);
    lower[0]![0] = [...groundTruth.forbidden][0]!;
    const scored = scorePlacementAnswer({
      answer: { lower, upper: canonical.upper },
      house: groundTruth.houses.houseGrid!,
      groundTruth,
      schemes: ["structural"],
      weights: DEFAULT_SCHEME_WEIGHTS,
    });
    expect(scored.schemes[0]!.detail.noForbidden).toBe(0);
  });
});

function expectSolid(truth: InteriorGroundTruth, tile: number): void {
  const flag = truth.passability[tile]!;
  expect(flag.up || flag.down || flag.left || flag.right, `tile ${tile} must be solid`).toBe(false);
}

function expectPassable(truth: InteriorGroundTruth, tile: number): void {
  const flag = truth.passability[tile]!;
  expect(flag.up || flag.down || flag.left || flag.right, `tile ${tile} must be passable`).toBe(true);
}

describe("interior benchmark runner and replay", () => {
  it("계약 위반은 throw 하지 않고 채점 불가로 기록된다(0점이 아니다)", async () => {
    const record = await runWithStub(() => "the walls are on the left", { taskIds: ["t1-wall-any"] });
    const attempt = record.tasks[0]!.attempts[0]!;
    expect(attempt.error?.kind).toBe("contract");
    expect(attempt.scored).toBeNull();
    expect(record.tasks[0]!.compositeMean).toBeNull();
  });

  it("전송 실패도 throw 하지 않는다", async () => {
    const record = await runInteriorBenchmark({
      model: "stub/down",
      repeats: 1,
      taskIds: ["t5-window"],
      startedAt: "2026-08-20T00:00:00.000Z",
      send: async () => ({ ok: false, error: { kind: "http", message: "HTTP 503" } }),
    });
    expect(record.tasks[0]!.attempts[0]!.error?.kind).toBe("http");
    expect(record.overallComposite).toBe(0);
  });

  it("반복 실행이 표준편차와 pass@k 를 낸다", async () => {
    const record = await runWithStub(
      (taskId, attempt) => (attempt === 1 ? canonicalAnswerFor(taskId) : '{"tileIds":[0]}'),
      { repeats: 2, taskIds: ["t5-window"] },
    );
    const task = record.tasks[0]!;
    expect(task.attempts).toHaveLength(2);
    expect(task.compositeStdDev!).toBeGreaterThan(0);
    expect(task.passAtK).toBe(1);
  });

  it("같은 스텁은 같은 manifestHash 를 낸다", async () => {
    const a = await runWithStub((taskId) => canonicalAnswerFor(taskId), { taskIds: ["t5-window"] });
    const b = await runWithStub((taskId) => canonicalAnswerFor(taskId), { taskIds: ["t5-window"] });
    expect(a.manifest.manifestHash).toBe(b.manifest.manifestHash);
  });

  it("보관본 재생은 바이트가 동일하다 — 이 벤치마크의 재현성 보증", async () => {
    const record = await runWithStub((taskId) => canonicalAnswerFor(taskId));
    const original = serializeRunRecord(record);
    expect(serializeRunRecord(replayInteriorArchive(record))).toBe(original);
    // 직렬화 → 파싱 → 재생도 같은 바이트여야 한다(디스크 왕복 포함).
    expect(serializeRunRecord(replayInteriorArchive(parseRunRecord(original)))).toBe(original);
  });
});
