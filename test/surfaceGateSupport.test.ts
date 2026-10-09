// test/surfaceGateSupport.test.ts
//
// 표면 게이트의 **공용 계약 자체**를 검증한다. 축(폼/M2/셸/커밋/조건/포털/상호작용)이 전부
// 이 파일 하나에 의존하므로, 여기의 안전장치가 조용히 죽으면 축 전부가 동시에 초록 거짓말을
// 하게 된다. 그리고 그 죽음은 축 테스트로는 안 보인다 — 축은 "기준선과 같다"만 확인하고,
// 안전장치는 "기준선이 부당하게 갱신되는 경로"를 막는 코드라서 정상 실행에서는 한 줄도 안 돈다.
//
// 검증 대상 4가지 (전부 실측된 함정에 대응):
//   1. CI 에서 갱신 환경변수 금지 — 켜져 있으면 즉시 throw.
//   2. 하한선 파일 생성은 통과가 아니다 — 만들되 실패시킨다.
//   3. 열화한 하한선을 쓰지 않는다 — 총합 0(축 크래시) / 기존의 10% 미만(대량 열화)이면
//      파일을 **쓰지 않고** 실패시킨다. 셸 축에서 실제로 하한선이 크래시한 실행 중에 생겼다.
//   4. diff 예외가 하한선 단정을 넘어 던져지지 않는다 — 구 스키마 기준선에서 diff 가 TypeError 로
//      죽으면 하한선 신호가 무관한 크래시에 묻힌다(실측).
import { afterEach, describe, expect, it } from "vitest";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { assertNoUpdateEnvInCI, assertSurfaceGate, type FloorMetrics } from "./surfaceGateSupport";

/** 이 테스트가 만드는 임시 디렉터리들 — afterEach 에서 전부 지운다. */
const tempDirs: string[] = [];

/** it.fails 테스트에서 빼낸 디스크 상태. 다음 테스트가 단정한다(soft 실패는 잡을 수 없다). */
let updateModeDisk: { baseline: unknown; floorExists: boolean } | null = null;

function tempPaths(): { baseline: string; floor: string } {
  const dir = mkdtempSync(join(tmpdir(), "surface-gate-support-"));
  tempDirs.push(dir);
  return { baseline: join(dir, "baseline.json"), floor: join(dir, "floor.json") };
}

/**
 * 환경변수를 세팅하고 콜백을 돌린 뒤 무조건 원복한다.
 * `undefined` 를 주면 삭제한다(CI 를 지워야 하는 케이스가 있다).
 */
function withEnv<T>(vars: Record<string, string | undefined>, run: () => T): T {
  const saved = new Map<string, string | undefined>();
  for (const [key, value] of Object.entries(vars)) {
    saved.set(key, process.env[key]);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    return run();
  } finally {
    for (const [key, value] of saved) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

/** 단정 실패 메시지를 문자열로 회수한다. 통과하면 그것 자체가 테스트 실패다. */
function failureMessage(run: () => void): string {
  try {
    run();
  } catch (error) {
    return (error as Error)?.message ?? String(error);
  }
  throw new Error("실패해야 하는 호출이 통과했다 — 안전장치가 죽었다");
}

type Surface = { count: number };

const metrics = (surface: Surface): FloorMetrics => ({ count: surface.count });
const diffCount = (_key: string, before: Surface, after: Surface): string[] =>
  before.count === after.count ? [] : [`count ${before.count} → ${after.count}`];

afterEach(() => {
  while (tempDirs.length) rmSync(tempDirs.pop()!, { recursive: true, force: true });
});

describe("표면 게이트 공용 계약", () => {
  it("CI 에서 갱신 환경변수가 켜져 있으면 즉시 실패한다", () => {
    // CI 가 기준선을 다시 쓰면 래칫이 사라진다 — 그 경로를 원천 차단하는 가드.
    const message = withEnv({ CI: "1", FORM_SURFACE_UPDATE: "1" }, () =>
      failureMessage(() => assertNoUpdateEnvInCI())
    );
    expect(message).toContain("FORM_SURFACE_UPDATE");

    // 반대 방향: CI 가 아니면 갱신 모드는 정상 경로다(가드가 과잉 차단하지 않는다).
    withEnv({ CI: undefined, FORM_SURFACE_UPDATE: "1" }, () => {
      expect(() => assertNoUpdateEnvInCI()).not.toThrow();
    });
  });

  it("하한선 파일 생성은 통과가 아니다 — 만들고 나서 실패시킨다", () => {
    const { baseline, floor } = tempPaths();
    const message = withEnv({ CI: undefined, TEST_AXIS_UPDATE: undefined }, () =>
      failureMessage(() =>
        assertSurfaceGate({
          axis: "테스트축",
          baselinePath: baseline,
          floorPath: floor,
          updateEnv: "TEST_AXIS_UPDATE",
          actual: { alpha: { count: 7 } },
          diff: diffCount,
          metrics,
        })
      )
    );
    expect(message).toContain("하한선 파일을 생성했다");
    // 파일은 실제로 생겼고(다음 실행의 하한선이 된다), 이번 실행은 빨갛다.
    expect(JSON.parse(readFileSync(floor, "utf8"))).toEqual({ alpha: { count: 7 } });
  });

  it("지표 총합이 0이면 하한선을 쓰지 않는다 — 축 크래시를 하한선으로 굳히지 않는다", () => {
    const { baseline, floor } = tempPaths();
    const message = withEnv({ CI: undefined, TEST_AXIS_UPDATE: undefined }, () =>
      failureMessage(() =>
        assertSurfaceGate({
          axis: "테스트축",
          baselinePath: baseline,
          floorPath: floor,
          updateEnv: "TEST_AXIS_UPDATE",
          actual: { alpha: { count: 0 }, beta: { count: 0 } },
          diff: diffCount,
          metrics,
        })
      )
    );
    expect(message).toContain("지표 총합이 0이다");
    // 핵심: 0 하한선이 파일로 굳지 않았다. 굳었다면 그 뒤로는 무엇을 잃어도 통과한다.
    expect(existsSync(floor)).toBe(false);
  });

  it("개별 0 은 정상이다 — 다른 항목이 살아 있으면 하한선을 쓴다", () => {
    // breakLoop 처럼 controlCount 가 0인 kind 는 실재한다. 총합 0 만 크래시로 본다.
    const { baseline, floor } = tempPaths();
    withEnv({ CI: undefined, TEST_AXIS_UPDATE: undefined }, () =>
      failureMessage(() =>
        assertSurfaceGate({
          axis: "테스트축",
          baselinePath: baseline,
          floorPath: floor,
          updateEnv: "TEST_AXIS_UPDATE",
          actual: { alpha: { count: 0 }, beta: { count: 4 } },
          diff: diffCount,
          metrics,
        })
      )
    );
    expect(JSON.parse(readFileSync(floor, "utf8"))).toEqual({ alpha: { count: 0 }, beta: { count: 4 } });
  });

  it("기존 하한선의 10% 미만으로 떨어지면 갱신 모드에서도 덮어쓰지 않는다", () => {
    const { baseline, floor } = tempPaths();
    const before = { alpha: { count: 100 } };
    writeFileSync(floor, `${JSON.stringify(before)}\n`);

    // SURFACE_FLOOR_UPDATE=1 은 CI 금지 대상이므로 CI 를 지워야 이 경로에 도달한다.
    const message = withEnv(
      { CI: undefined, SURFACE_FLOOR_UPDATE: "1", TEST_AXIS_UPDATE: undefined },
      () =>
        failureMessage(() =>
          assertSurfaceGate({
            axis: "테스트축",
            baselinePath: baseline,
            floorPath: floor,
            updateEnv: "TEST_AXIS_UPDATE",
            actual: { alpha: { count: 5 } },
            diff: diffCount,
            metrics,
          })
        )
    );
    expect(message).toContain("100 → 5");
    // 기존 하한선이 그대로 남아 있다 — 대량 열화가 하한선을 삼키지 못했다.
    expect(JSON.parse(readFileSync(floor, "utf8"))).toEqual(before);
  });

  // ── 개별 하한선 하락 차단 (실측된 구멍) ─────────────────────────────────────────────
  // 갱신 모드는 항목별 비교보다 먼저 쓰기 분기를 타서 가드가 "총합 0"과 "총합 10% 미만"
  // 둘뿐이었다. 지표 하나가 1 → 0 으로 내려가는 것은 두 가드를 모두 통과한다.
  // 실제로 커밋 프로브 축에서 commitCount 가 4종에서 1 → 0, playMovie 에서 3 → 2 로 조용히
  // 낮아졌고, 그 4종이 바로 그때 결함을 잡고 있던 항목이었다.
  it("갱신 모드가 개별 하한선을 1 → 0 으로 낮추지 못한다 — 총합 가드를 통과하는 소규모 열화", () => {
    const { baseline, floor } = tempPaths();
    // 총합 101 → 100: 0도 아니고 10% 미만도 아니다. 예전 가드는 여기서 파일을 썼다.
    const before = { alpha: { commitCount: 1, probeCount: 100 } };
    writeFileSync(floor, `${JSON.stringify(before)}\n`);

    const message = withEnv(
      { CI: undefined, SURFACE_FLOOR_UPDATE: "1", TEST_AXIS_UPDATE: undefined },
      () =>
        failureMessage(() =>
          assertSurfaceGate({
            axis: "테스트축",
            baselinePath: baseline,
            floorPath: floor,
            updateEnv: "TEST_AXIS_UPDATE",
            actual: { alpha: { commitCount: 0, probeCount: 100 } },
            diff: () => [],
            metrics: (surface: { commitCount: number; probeCount: number }) => ({ ...surface }),
          })
        )
    );
    expect(message, "무엇이 내려가는지 지목하지 않는다").toContain("하한선 하락: alpha.commitCount 1 → 0");
    expect(message).toContain("개별 하한선 1건이 내려간다");
    // 핵심: 하한선 파일이 그대로다. 갈렸다면 그 뒤로는 commitCount 0 이 영구 합법이 된다.
    expect(JSON.parse(readFileSync(floor, "utf8"))).toEqual(before);
  });

  it("내려가는 지표를 항목·지표 단위로 **전부** 열거한다 — 하나만 말하고 끝내지 않는다", () => {
    const { baseline, floor } = tempPaths();
    writeFileSync(
      floor,
      `${JSON.stringify({
        alpha: { commitCount: 1, probeCount: 1 },
        beta: { commitCount: 3 },
        gamma: { commitCount: 5 },
      })}\n`
    );
    const message = withEnv(
      { CI: undefined, SURFACE_FLOOR_UPDATE: "1", TEST_AXIS_UPDATE: undefined },
      () =>
        failureMessage(() =>
          assertSurfaceGate({
            axis: "테스트축",
            baselinePath: baseline,
            floorPath: floor,
            updateEnv: "TEST_AXIS_UPDATE",
            // alpha.commitCount 하락 + beta 하락 + gamma 는 상승(보고에 없어야 한다).
            actual: {
              alpha: { commitCount: 0, probeCount: 1 },
              beta: { commitCount: 2 },
              gamma: { commitCount: 9 },
            },
            diff: () => [],
            metrics: (surface: Record<string, number>) => ({ ...surface }),
          })
        )
    );
    expect(message).toContain("하한선 하락: alpha.commitCount 1 → 0");
    expect(message).toContain("하한선 하락: beta.commitCount 3 → 2");
    expect(message, "오르는 지표를 하락으로 오보한다").not.toContain("gamma");
    expect(message).toContain("개별 하한선 2건이 내려간다");
  });

  it("항목이 통째로 사라지는 갱신도 거부한다 — 그 항목의 하한선 전부가 지워진다", () => {
    const { baseline, floor } = tempPaths();
    const before = { alpha: { count: 4 }, beta: { count: 4 } };
    writeFileSync(floor, `${JSON.stringify(before)}\n`);
    const message = withEnv(
      { CI: undefined, SURFACE_FLOOR_UPDATE: "1", TEST_AXIS_UPDATE: undefined },
      () =>
        failureMessage(() =>
          assertSurfaceGate({
            axis: "테스트축",
            baselinePath: baseline,
            floorPath: floor,
            updateEnv: "TEST_AXIS_UPDATE",
            actual: { alpha: { count: 4 } },
            diff: diffCount,
            metrics,
          })
        )
    );
    expect(message).toContain("beta — 항목이 축에서 사라져 하한선이 통째로 지워진다 (count=4)");
    expect(JSON.parse(readFileSync(floor, "utf8"))).toEqual(before);
  });

  it("전부 오르거나 같으면 갱신을 그대로 통과시킨다 — 하락 가드가 상승을 막지 않는다", () => {
    // 과잉 차단 검증. 이게 없으면 "하락 차단"이 하한선 인상 자체를 막는지 알 수 없다.
    const { baseline, floor } = tempPaths();
    writeFileSync(floor, `${JSON.stringify({ alpha: { count: 4 }, beta: { count: 4 } })}\n`);
    const message = withEnv(
      { CI: undefined, SURFACE_FLOOR_UPDATE: "1", TEST_AXIS_UPDATE: undefined },
      () =>
        failureMessage(() =>
          assertSurfaceGate({
            axis: "테스트축",
            baselinePath: baseline,
            floorPath: floor,
            updateEnv: "TEST_AXIS_UPDATE",
            // 하나는 오르고 하나는 그대로 + 새 항목까지. 전부 허용이다.
            actual: { alpha: { count: 9 }, beta: { count: 4 }, gamma: { count: 1 } },
            diff: diffCount,
            metrics,
          })
        )
    );
    // 갱신 자체는 설계상 "리뷰 요청"이라 빨갛지만, 하한선 파일은 실제로 갈려 있어야 한다.
    expect(message).toContain("하한선 파일을 갱신했다");
    expect(JSON.parse(readFileSync(floor, "utf8"))).toEqual({
      alpha: { count: 9 },
      beta: { count: 4 },
      gamma: { count: 1 },
    });
  });

  it("하한선 파일이 없으면 하락 판정 대상이 없다 — 첫 생성은 개별 0 을 허용한다", () => {
    // 부트스트랩 경로를 하락 가드가 삼키면 새 축을 만들 수 없다(비교할 이전 값이 없다).
    const { baseline, floor } = tempPaths();
    withEnv({ CI: undefined, SURFACE_FLOOR_UPDATE: "1", TEST_AXIS_UPDATE: undefined }, () =>
      failureMessage(() =>
        assertSurfaceGate({
          axis: "테스트축",
          baselinePath: baseline,
          floorPath: floor,
          updateEnv: "TEST_AXIS_UPDATE",
          actual: { alpha: { count: 0 }, beta: { count: 7 } },
          diff: diffCount,
          metrics,
        })
      )
    );
    expect(JSON.parse(readFileSync(floor, "utf8"))).toEqual({ alpha: { count: 0 }, beta: { count: 7 } });
  });

  it("하한선 위반 메시지가 기준선 diff 도 함께 싣는다 — 개수만 말하고 끝내지 않는다", () => {
    // 실측된 결함: 하한선 단정이 먼저 던져서 사람이 «classCount 30 < 31» 만 보고 무엇이
    // 줄었는지는 못 봤다(소스 변이 감사에서 "빨갛지만 무언"으로 잡혔다).
    const { baseline, floor } = tempPaths();
    writeFileSync(floor, `${JSON.stringify({ alpha: { count: 10 } })}\n`);
    writeFileSync(baseline, `${JSON.stringify({ alpha: { count: 10 } })}\n`);
    const message = withEnv({ CI: undefined, TEST_AXIS_UPDATE: undefined }, () =>
      failureMessage(() =>
        assertSurfaceGate({
          axis: "테스트축",
          baselinePath: baseline,
          floorPath: floor,
          updateEnv: "TEST_AXIS_UPDATE",
          actual: { alpha: { count: 2 } },
          diff: diffCount,
          metrics,
        })
      )
    );
    expect(message).toContain("하한선 미달: alpha.count 2 < 10");
    expect(message, "표면 변화(원인)가 메시지에 없다").toContain("count 10 → 2");
    expect(message).toContain("함께 관측된 표면 변화");
  });

  it("diff 가 예외로 죽어도 하한선 단정에 도달한다 — 신호가 크래시에 묻히지 않는다", () => {
    const { baseline, floor } = tempPaths();
    // 하한선은 만족시켜 두고(위반 0), diff 만 터뜨려서 어디서 멈추는지 본다.
    writeFileSync(floor, `${JSON.stringify({ alpha: { count: 1 } })}\n`);
    writeFileSync(baseline, `${JSON.stringify({ alpha: { count: 3 } })}\n`);

    const message = withEnv({ CI: undefined, TEST_AXIS_UPDATE: undefined }, () =>
      failureMessage(() =>
        assertSurfaceGate({
          axis: "테스트축",
          baselinePath: baseline,
          floorPath: floor,
          updateEnv: "TEST_AXIS_UPDATE",
          actual: { alpha: { count: 3 } },
          diff: () => {
            throw new TypeError("Cannot read properties of undefined (reading 'testids')");
          },
          metrics,
        })
      )
    );
    // 원시 TypeError 가 아니라 축 리포트로 잡혔다.
    expect(message).toContain("diff 계산이 예외로 죽었다");
    expect(message).toContain("TEST_AXIS_UPDATE=1");
    expect(message).toContain("표면이 기준선과 다르다");
  });

  it("하한선 위반이면 갱신 모드가 기준선 파일을 건드리지 않는다", () => {
    // 실측된 순서 결함의 회귀 테스트: 예전에는 기준선을 먼저 쓰고 하한선을 단정했다.
    // 테스트는 빨갰지만 디스크의 기준선은 이미 열화 표면으로 갈려 있었다.
    const { baseline, floor } = tempPaths();
    writeFileSync(floor, `${JSON.stringify({ alpha: { count: 10 } })}\n`);
    writeFileSync(baseline, `${JSON.stringify({ alpha: { count: 10 } })}\n`);

    const message = withEnv({ CI: undefined, TEST_AXIS_UPDATE: "1" }, () =>
      failureMessage(() =>
        assertSurfaceGate({
          axis: "테스트축",
          baselinePath: baseline,
          floorPath: floor,
          updateEnv: "TEST_AXIS_UPDATE",
          actual: { alpha: { count: 2 } },
          diff: diffCount,
          metrics,
        })
      )
    );
    expect(message).toContain("하한선 위반은 기준선 갱신으로 덮을 수 없다");
    expect(message).toContain("하한선 미달: alpha.count 2 < 10");
    expect(JSON.parse(readFileSync(baseline, "utf8"))).toEqual({ alpha: { count: 10 } });
  });

  // 갱신 모드의 정상 경로는 **설계상 실패**한다(soft 빨강 = 리뷰 요청). soft 실패는 try/catch 로
  // 잡을 수 없어서 it.fails 로 감싸고, 디스크 상태는 모듈 변수로 빼내 다음 테스트에서 단정한다.
  // 그렇게 하지 않으면 "위반 차단"이 정상 갱신까지 막는지(과잉 차단) 증명할 수 없다.
  it.fails("갱신 모드는 하한선이 건강하면 기준선을 쓰고, 그래도 실패한다", () => {
    const { baseline, floor } = tempPaths();
    writeFileSync(floor, `${JSON.stringify({ alpha: { count: 1 } })}\n`);
    writeFileSync(baseline, `${JSON.stringify({ alpha: { count: 3 } })}\n`);
    withEnv({ CI: undefined, TEST_AXIS_UPDATE: "1" }, () => {
      assertSurfaceGate({
        axis: "테스트축",
        baselinePath: baseline,
        floorPath: floor,
        updateEnv: "TEST_AXIS_UPDATE",
        actual: { alpha: { count: 5 } },
        diff: diffCount,
        metrics,
      });
    });
    updateModeDisk = {
      baseline: JSON.parse(readFileSync(baseline, "utf8")),
      floorExists: existsSync(floor),
    };
  });

  it("직전 갱신 실행이 기준선을 실제로 갈아 놓았다 — 위반 차단이 정상 갱신을 막지 않는다", () => {
    expect(updateModeDisk, "갱신 모드 테스트가 디스크 상태를 남기지 못했다").not.toBeNull();
    expect(updateModeDisk!.baseline).toEqual({ alpha: { count: 5 } });
    expect(updateModeDisk!.floorExists).toBe(true);
  });

  it("하한선 파일 생성 통지는 기준선 갱신을 막지 않는다 — 새 축은 1회 실행으로 부트스트랩된다", () => {
    // 통지(notice)와 위반(violation)을 구분하지 않으면 새 축이 3회 실행을 요구한다:
    // 1회 하한선 생성 → 기준선 미기록 → 2회 "기준선 없음" → 3회 기준선 생성.
    const { baseline, floor } = tempPaths();
    const message = withEnv({ CI: undefined, TEST_AXIS_UPDATE: "1" }, () =>
      failureMessage(() =>
        assertSurfaceGate({
          axis: "테스트축",
          baselinePath: baseline,
          floorPath: floor,
          updateEnv: "TEST_AXIS_UPDATE",
          actual: { alpha: { count: 5 } },
          diff: diffCount,
          metrics,
        })
      )
    );
    expect(message).toContain("하한선 파일이 방금 만들어졌다");
    // 두 파일이 다 생겼다 — 다음 실행(갱신 없이)은 초록이어야 한다.
    expect(JSON.parse(readFileSync(baseline, "utf8"))).toEqual({ alpha: { count: 5 } });
    expect(JSON.parse(readFileSync(floor, "utf8"))).toEqual({ alpha: { count: 5 } });
    withEnv({ CI: undefined, TEST_AXIS_UPDATE: undefined }, () => {
      expect(() =>
        assertSurfaceGate({
          axis: "테스트축",
          baselinePath: baseline,
          floorPath: floor,
          updateEnv: "TEST_AXIS_UPDATE",
          actual: { alpha: { count: 5 } },
          diff: diffCount,
          metrics,
        })
      ).not.toThrow();
    });
  });

  it("기준선과 같으면 통과한다 — 게이트가 항상 빨갛지는 않다", () => {
    const { baseline, floor } = tempPaths();
    writeFileSync(floor, `${JSON.stringify({ alpha: { count: 1 } })}\n`);
    writeFileSync(baseline, `${JSON.stringify({ alpha: { count: 3 } })}\n`);
    withEnv({ CI: undefined, TEST_AXIS_UPDATE: undefined }, () => {
      expect(() =>
        assertSurfaceGate({
          axis: "테스트축",
          baselinePath: baseline,
          floorPath: floor,
          updateEnv: "TEST_AXIS_UPDATE",
          actual: { alpha: { count: 3 } },
          diff: diffCount,
          metrics,
        })
      ).not.toThrow();
    });
  });

  it("항목 소실과 신규 항목을 각각 지목한다", () => {
    const { baseline, floor } = tempPaths();
    writeFileSync(floor, `${JSON.stringify({ alpha: { count: 1 } })}\n`);
    writeFileSync(baseline, `${JSON.stringify({ alpha: { count: 3 } })}\n`);
    // 하한선 항목 alpha 가 사라졌으므로 하한선 단정이 먼저 잡는다 — 그것도 계약이다.
    const message = withEnv({ CI: undefined, TEST_AXIS_UPDATE: undefined }, () =>
      failureMessage(() =>
        assertSurfaceGate({
          axis: "테스트축",
          baselinePath: baseline,
          floorPath: floor,
          updateEnv: "TEST_AXIS_UPDATE",
          actual: { gamma: { count: 3 } },
          diff: diffCount,
          metrics,
        })
      )
    );
    expect(message).toContain("하한선 항목 소실: alpha");
  });
});
