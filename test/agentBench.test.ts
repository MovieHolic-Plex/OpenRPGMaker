// 코딩 에이전트 벤치마크 계약 테스트.
//
// 이 파일이 지키는 핵심 계약:
//  1. **하네스 정본은 quality 1.000 / scale 1.000** — 기준점이 거짓이면 나머지 숫자가 다 거짓이다.
//  2. 지시서는 도구 이름을 흘리지 않는다 — 저장소를 뒤져 하네스를 찾아내는 것까지가 실력이다.
//  3. 아무것도 안 한 답과 "들어갈 수 없는 건물"은 0점이다(분모 0 을 만점으로 두는 허점 방어).
//  4. 제출물 파서는 fail-closed 다.
import { describe, expect, it } from "vitest";
import { processMetrics } from "@/benchmark/agent/claudeResult";
import { detectVillage } from "@/benchmark/agent/detect";
import { scaleBaseline, scoreAgentMap } from "@/benchmark/agent/scoring";
import { AGENT_SPEC_VERSION, SUBMISSION_PATH, buildAgentInstruction, parseSubmission } from "@/benchmark/agent/spec";
import { buildTownGroundTruth } from "@/benchmark/town/groundTruth";
import { EMPTY_CELL } from "@/benchmark/town/types";

const groundTruth = buildTownGroundTruth();
const reference = groundTruth.placements.villageGrid;
const referenceMap = {
  width: reference.width,
  height: reference.height,
  lower: reference.lower,
  upper: reference.upper,
};

function blank(): number[] {
  return new Array<number>(reference.width * reference.height).fill(EMPTY_CELL);
}

function score(lower: readonly number[], upper: readonly number[]) {
  return scoreAgentMap({ map: { width: reference.width, height: reference.height, lower, upper }, groundTruth });
}

describe("하네스 정본이 기준점 1.000 / 1.000", () => {
  it("정본 마을은 quality 1.000, scale 1.000", () => {
    const scored = score(reference.lower, reference.upper);
    expect(scored.quality).toBeCloseTo(1, 6);
    expect(scored.scale).toBeCloseTo(1, 6);
  });

  it("규모 기준선은 손으로 적지 않고 정본 탐지에서 뽑는다", () => {
    const baseline = scaleBaseline(groundTruth);
    const detection = detectVillage(referenceMap);
    expect(baseline.houses).toBe(detection.houses.length);
    expect(baseline.roadCells).toBe(detection.roadCells.size);
    expect(baseline.area).toBe(reference.width * reference.height);
  });

  it("탐지기가 정본에서 집 3채·문 3개·단일 도로망을 찾는다", () => {
    const detection = detectVillage(referenceMap);
    expect(detection.buildings).toHaveLength(3);
    expect(detection.houses).toHaveLength(3);
    expect(detection.doors).toHaveLength(3);
    expect(detection.doors.every((door) => door.sameFamily)).toBe(true);
    expect(detection.roadComponents).toBe(1);
    expect(detection.brokenTrees).toBe(0);
  });
});

describe("아무것도 안 한 답과 들어갈 수 없는 마을은 0점", () => {
  it("빈 맵은 0", () => {
    const scored = score(blank(), blank());
    expect(scored.quality).toBe(0);
    expect(scored.scale).toBe(0);
  });

  it("한 타일로 도배하면 0", () => {
    const flooded = new Array<number>(reference.width * reference.height).fill(306);
    expect(score(flooded, blank()).quality).toBe(0);
  });

  it("문 없는 집만 세운 답은 크게 깎인다 — 분모 0 을 만점으로 두면 안 된다", () => {
    // 문 두 칸만 지운 정본. 나머지는 전부 그대로다.
    const noDoors = reference.lower.map((tile) => (tile === 116 || tile === 146 ? EMPTY_CELL : tile));
    const scored = score(noDoors, reference.upper);
    expect(scored.detail.doors).toBe(0);
    // 문 관련 항목 3개가 0 이 되므로 절반을 넘길 수 없다 — 들어갈 수 없는 마을이다.
    expect(scored.quality).toBeLessThanOrEqual(0.5);
  });

  it("지붕 타일로 채운 블록은 집이 아니다 — 벽 위에 지붕 검사", () => {
    // 2026-08-21 실측: haiku 가 지붕 타일 블록 3개에 문만 달아 0.699 를 받았다.
    // 감사 항목이 전부 "기계적으로는" 참이었기 때문이다.
    const lower = blank();
    const W = reference.width;
    // 5x4 지붕 타일 덩어리 + 아래에 문 두 칸 (벽은 하나도 없다)
    for (let y = 1; y <= 4; y += 1) for (let x = 2; x <= 6; x += 1) lower[y * W + x] = 374;
    lower[5 * W + 4] = 116;
    lower[6 * W + 4] = 146;
    const scored = score(lower, blank());
    expect(scored.detail.buildingGrammar).toBe(0);
    expect(scored.quality).toBeLessThan(0.6);
  });

  it("정본은 벽 위에 지붕 검사를 통과한다(계열이 겹쳐도)", () => {
    // 404/405 는 라벨이 "지붕-벽 경계"라 벽 파생에도 들어간다. 계열을 겹친 채로
    // 판정하면 정본조차 실패한다(실측: 기준선 0.917).
    expect(score(reference.lower, reference.upper).detail.buildingGrammar).toBe(1);
  });

  it("금지 타일을 쓰면 0 (감점 배수)", () => {
    const banned = [...reference.lower];
    banned[0] = 441; // 바위(사용 금지) — 감독이 전역 밴한 타일
    expect(score(banned, reference.upper).quality).toBe(0);
  });

  it("길을 몸통 타일로만 깔면 오토타일 합법성이 떨어진다", () => {
    const bodyOnly = reference.lower.map((tile) =>
      [391, 451, 420, 422, 390, 392, 450, 452, 360, 362].includes(tile) ? 421 : tile,
    );
    const scored = score(bodyOnly, reference.upper);
    expect(scored.detail.roadAutotileLegality as number).toBeLessThan(0.6);
    expect(scored.quality).toBeLessThan(1);
  });
});

describe("지시서는 생짜다 — 도구 이름을 흘리지 않는다", () => {
  const instruction = buildAgentInstruction();

  it("하네스·도구·엔진 이름이 들어 있지 않다", () => {
    // 이 이름들을 알려주면 "저장소를 뒤져 하네스를 찾아내는 실력"을 측정할 수 없다.
    for (const leak of [
      "build_village",
      "stampRectHouseKit",
      "placeHouseLotFences",
      "autotile",
      "오토타일",
      "harness",
      "하네스",
      "tile_query",
      "houseKit",
      "village",
    ]) {
      expect(instruction.toLowerCase()).not.toContain(leak.toLowerCase());
    }
  });

  it("크기·집 수를 지정하지 않는다(얼마나 만드는지가 측정 대상이다)", () => {
    // 제출 형식의 -1 을 빼면 지시서에 숫자가 없어야 한다.
    const numbers = [...instruction.matchAll(/-?\d+/g)].map((match) => match[0]).filter((value) => value !== "-1");
    expect(numbers).toEqual([]);
  });

  it("제출 경로와 형식은 명시한다(그게 없으면 채점이 성립하지 않는다)", () => {
    expect(instruction).toContain(SUBMISSION_PATH);
    expect(instruction).toContain("lowerTiles");
    expect(instruction).toContain("upperTiles");
    expect(AGENT_SPEC_VERSION).toBeGreaterThan(0);
  });
});

describe("제출물 파서는 fail-closed", () => {
  it("정상 제출을 받는다", () => {
    const parsed = parseSubmission(
      JSON.stringify({ width: 2, height: 2, lowerTiles: [240, 240, 240, 240], upperTiles: [-1, -1, -1, -1] }),
    );
    expect(parsed.ok).toBe(true);
  });

  it("2차원 배열로 낸 것도 받는다(형식을 두 번 말하지 않았으므로)", () => {
    const parsed = parseSubmission(JSON.stringify({ lower: [[240, 240]], upper: [[-1, -1]] }));
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.map.width).toBe(2);
      expect(parsed.map.height).toBe(1);
    }
  });

  it("길이 불일치·범위 초과·비정수·비JSON 은 거부한다", () => {
    const cases: readonly [string, RegExp][] = [
      [JSON.stringify({ width: 3, height: 1, lowerTiles: [1, 2], upperTiles: [-1, -1, -1] }), /길이/],
      [JSON.stringify({ width: 1, height: 1, lowerTiles: [480], upperTiles: [-1] }), /허용 범위/],
      [JSON.stringify({ width: 1, height: 1, lowerTiles: [1.5], upperTiles: [-1] }), /정수/],
      ["{", /JSON 파싱 실패/],
      ["[]", /객체가 아니다/],
      [JSON.stringify({ width: 1, height: 1, upperTiles: [-1] }), /lowerTiles/],
    ];
    for (const [text, pattern] of cases) {
      const parsed = parseSubmission(text);
      expect(parsed.ok).toBe(false);
      if (!parsed.ok) expect(parsed.reason).toMatch(pattern);
    }
  });
});

describe("과정 지표 파싱", () => {
  it("stderr 경고가 JSON 뒤에 붙어도 턴·비용을 읽는다", () => {
    // 2026-08-21 실측 회귀: lastIndexOf("{") 로 찾으면 JSON 내부 중첩 객체를 집어
    // turns/cost 가 전부 null 이 됐다.
    const stdout = [
      '{"is_error":false,"num_turns":20,"total_cost_usd":0.353,"usage":{"output_tokens":10693},"stop_reason":"end_turn"}',
      "⚠ claude.ai connectors are disabled because ANTHROPIC_API_KEY ...",
      "",
    ].join("\n");
    const metrics = processMetrics(stdout);
    expect(metrics.turns).toBe(20);
    expect(metrics.costUsd).toBeCloseTo(0.353, 6);
    expect(metrics.outputTokens).toBe(10693);
    expect(metrics.isError).toBe(false);
    expect(metrics.stopReason).toBe("end_turn");
  });

  it("별칭이 해석된 실제 모델 id 를 기록한다", () => {
    // --model opus 같은 별칭은 시간이 지나면 다른 버전을 가리킨다. 별칭만 적어 둔
    // 기록으로는 "그때 무엇을 쟀는가"에 답할 수 없다.
    const stdout = '{"num_turns":3,"modelUsage":{"claude-haiku-4-5-20251001":{"outputTokens":10}}}';
    expect(processMetrics(stdout).resolvedModels).toEqual(["claude-haiku-4-5-20251001"]);
    expect(processMetrics("{}").resolvedModels).toEqual([]);
  });

  it("인프라 실패와 모델 실패를 구분한다", () => {
    // 2026-08-21 실측: opus 첫 실행이 게이트웨이 503 으로 죽었고 비용은 $0 이었다.
    // 이유를 적어 두지 않으면 리더보드가 인프라 장애를 모델 실력으로 기록한다.
    const failed = processMetrics(
      '{"is_error":true,"num_turns":1,"total_cost_usd":0,"api_error_status":503,' +
        '"result":"API Error: 503 Live Team Swap routing is unavailable.","modelUsage":{}}',
    );
    expect(failed.isError).toBe(true);
    expect(failed.apiErrorStatus).toBe(503);
    expect(failed.resultMessage).toMatch(/503/);
    expect(failed.resolvedModels).toEqual([]);

    const succeeded = processMetrics('{"is_error":false,"num_turns":20,"result":"done","modelUsage":{"claude-haiku-4-5-20251001":{}}}');
    expect(succeeded.apiErrorStatus).toBeNull();
    expect(succeeded.resultMessage).toBeNull();
  });

  it("종료 사유를 인프라·예산·정상 세 갈래로 나눈다", () => {
    // 2026-08-21 실측: opus 는 503(인프라)으로 한 번, max_turns(예산)로 한 번 죽었다.
    // 둘을 같은 칸에 적으면 리더보드가 인프라 장애를 모델 실력으로 기록한다.
    expect(processMetrics('{"api_error_status":503,"is_error":true}').terminal).toBe("infra-error");
    expect(processMetrics('{"is_error":true,"subtype":"error_max_turns","num_turns":31}').terminal).toBe("budget-exhausted");
    expect(processMetrics('{"is_error":true,"terminal_reason":"max_turns"}').terminal).toBe("budget-exhausted");
    expect(processMetrics('{"is_error":false,"num_turns":20}').terminal).toBe("completed");
  });

  it("JSON 이 없으면 전부 null 이고 throw 하지 않는다", () => {
    const metrics = processMetrics("경고만 있고 결과가 없다");
    expect(metrics.turns).toBeNull();
    expect(metrics.costUsd).toBeNull();
    expect(metrics.isError).toBe(false);
  });
});
