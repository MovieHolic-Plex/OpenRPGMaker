// test/surfaceGateSupport.ts
//
// 표면 스냅샷 게이트 4축(폼 / M2 / 셸 / 커밋 프로브 / 조건)의 공통 계약.
//
// 왜 공용 헬퍼가 필요한가 — 실측된 두 함정을 축마다 따로 막으면 반드시 하나가 빠진다:
//
//  1) 조용한 갱신: `*_SURFACE_UPDATE=1` 이면 기준선을 쓰고 즉시 return 하는 구조였다. 실측으로
//     밟았다 — 기준선 mtime 20:54:49~57, "9 tests 통과" 확인은 20:55:00. 즉 몇 초 전 내가
//     재생성한 파일에 대한 자기 확인이었다. 누가 testid 200종을 날린 상태로 갱신해 커밋하면
//     이후 영구히 초록이고 잃은 것의 기록도 남지 않는다(.omo CSS 예산 게이트의
//     `--save-baseline` 함정과 같은 모양).
//     → 대책: 갱신 모드에서도 diff 를 stdout 에 찍고 `expect.soft` 로 **반드시 빨강**을 만든다.
//        갱신은 "통과"가 아니라 "리뷰 요청"이다.
//
//  2) 하한선 없음: 기준선은 갱신되면 무엇이든 정답이 된다. 그래서 기준선과 별개로
//     `test/fixtures/*.floor.json` 에 축별·항목별 최소 수치를 두고, **갱신 모드에서도** 하한선
//     미달은 무조건 실패시킨다. 하한선 갱신은 SURFACE_FLOOR_UPDATE=1 로 별도 커밋을 강제한다.
//
// CI 에서는 갱신 환경변수 자체가 금지다(CI 가 기준선을 다시 쓰면 래칫이 사라진다).
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { expect } from "vitest";

/** 하한선 지표: 항목(kind/commandId/page) → 지표명 → 최소값. */
export type FloorMetrics = Record<string, number>;

const UPDATE_ENVS = [
  "FORM_SURFACE_UPDATE",
  "M2_SURFACE_UPDATE",
  "SHELL_SURFACE_UPDATE",
  "COMMIT_PROBE_UPDATE",
  "CONDITION_SURFACE_UPDATE",
  "PORTAL_SURFACE_UPDATE",
  "INTERACTION_SURFACE_UPDATE",
  // 스냅샷 기준선이 아니라 **래칫 목록**을 다시 쓰는 환경변수. 기준선보다 위험하다 —
  // 래칫은 "이건 원래 이렇다"고 선언하는 파일이라, CI 가 다시 쓰면 결함이 정상으로 굳는다.
  "INTERACTION_ALLOWLIST_UPDATE",
];

/** CI 에서 갱신 모드가 켜져 있으면 즉시 실패 — 래칫을 지우는 경로를 원천 차단한다. */
export function assertNoUpdateEnvInCI(): void {
  if (!process.env.CI) return;
  const on = UPDATE_ENVS.filter((k) => process.env[k] === "1");
  if (on.length) {
    throw new Error(
      `CI 에서 기준선 갱신 모드가 켜져 있다: ${on.join(", ")} — CI 는 기준선을 쓰지 않는다(래칫 무력화).`
    );
  }
}

type Floor = Record<string, FloorMetrics>;

/**
 * 하한선 검사 결과. 둘 다 실행을 빨갛게 만들지만 **기준선을 쓸 자격**이 다르다:
 *  - `violations`: 미달/소실/쓰기 거부. 기준선 갱신을 **차단**한다(열화를 승인할 수 없다).
 *  - `notices`: 하한선 파일을 방금 만들었다/갱신했다. 리뷰 요청이지 열화 증거는 아니므로
 *    기준선 갱신은 그대로 진행시킨다(안 그러면 새 축 부트스트랩이 3회 실행이 된다).
 */
type FloorResult = { violations: string[]; notices: string[] };

function readJson<T>(path: string, fallback: T): T {
  return existsSync(path) ? (JSON.parse(readFileSync(path, "utf8")) as T) : fallback;
}

/** 모든 항목·모든 지표의 합. 열화한 하한선을 쓰지 않기 위한 건강 지표다. */
function metricTotal(metrics: Record<string, FloorMetrics>): number {
  let total = 0;
  for (const item of Object.values(metrics)) for (const v of Object.values(item)) total += v;
  return total;
}

/**
 * 하한선 검사. 기준선과 무관하게 항상 돈다(갱신 모드 포함).
 * 하한선 파일이 없으면 현재값으로 만들되, 그 실행은 실패시킨다 — "하한선이 방금 생겼다"는
 * 사실이 조용히 통과하면 첫 실행의 열화가 그대로 하한선이 된다.
 *
 * ── 열화한 하한선을 쓰지 않는다 (실측된 경로) ─────────────────────────────────────
 * 셸 축에서 실제로 밟았다: 기준선이 구 스키마라 diff 가 TypeError 로 죽은 실행에서, 그보다
 * **먼저** 하한선 파일이 생성됐다. 그때는 수확값이 정상이라 문제가 없었지만, 렌더가 크래시한
 * 상태라면 모든 카운트가 0인 하한선이 굳고 그 뒤로는 무엇을 잃어도 하한선을 통과한다.
 * 그래서 두 경우에는 파일을 **쓰지 않고** 실패시킨다:
 *   1) 지표 총합이 0 — 축 전체가 크래시했다는 뜻이다. 개별 0(예: breakLoop 의 controlCount)은
 *      정상이지만 모든 항목의 모든 지표가 0인 건 정상일 수 없다.
 *   2) 기존 하한선 총합의 10% 미만으로 떨어졌다 — 대량 열화다. 의도한 축소라면 기존 파일을
 *      직접 지우고 다시 만들어라(그 삭제가 리뷰에 남는다).
 */
function checkFloor(floorPath: string, metrics: Record<string, FloorMetrics>): FloorResult {
  const update = process.env.SURFACE_FLOOR_UPDATE === "1";
  if (update || !existsSync(floorPath)) {
    const had = existsSync(floorPath);
    const now = metricTotal(metrics);
    if (now === 0) {
      return {
        violations: [
          `하한선을 쓰지 않았다: 지표 총합이 0이다 (${floorPath}) — 축 전체가 크래시한 상태로 보인다. ` +
            `렌더 오류를 먼저 고쳐라. 0 하한선이 굳으면 그 뒤로는 무엇을 잃어도 통과한다.`,
        ],
        notices: [],
      };
    }
    if (had) {
      const before = metricTotal(readJson<Floor>(floorPath, {}));
      if (before > 0 && now < before * 0.1) {
        return {
          violations: [
            `하한선을 쓰지 않았다: 지표 총합이 ${before} → ${now} (10% 미만)으로 떨어졌다 (${floorPath}) — ` +
              `대량 열화다. 의도한 축소면 하한선 파일을 직접 삭제하고 다시 만들어라.`,
          ],
          notices: [],
        };
      }
    }
    writeFileSync(floorPath, `${JSON.stringify(metrics, null, 1)}\n`);
    return {
      violations: [],
      notices: [
        `하한선 파일을 ${had ? "갱신" : "생성"}했다: ${floorPath} — ` +
          `별도 커밋으로 리뷰하라(이 실행은 의도적으로 실패한다).`,
      ],
    };
  }
  const floor = readJson<Floor>(floorPath, {});
  const violations: string[] = [];
  for (const [key, wanted] of Object.entries(floor)) {
    const now = metrics[key];
    if (!now) {
      violations.push(`하한선 항목 소실: ${key} — 축에서 통째로 사라졌다`);
      continue;
    }
    for (const [metric, min] of Object.entries(wanted)) {
      const value = now[metric] ?? 0;
      if (value < min) violations.push(`하한선 미달: ${key}.${metric} ${value} < ${min}`);
    }
  }
  return { violations, notices: [] };
}

/**
 * 단정 라벨에 위반 내용을 **직접 박는다**.
 *
 * 왜 — vitest 는 `expect(arr, "라벨").toEqual([])` 의 실패 메시지를
 * `라벨: expected [ Array(72) ] to deeply equal []` 로 접는다(실측). 즉 커스텀 라벨은 보이지만
 * 무엇이 위반인지는 안 보인다. 게이트의 가치는 "무엇을 잃었는지 한 줄로 지목하는 것"이라
 * 이유가 메시지에 없으면 사람은 기준선을 갱신해서 넘긴다. 그래서 줄들을 라벨에 넣는다.
 */
function labelWith(head: string, lines: string[], cap = 40): string {
  if (!lines.length) return head;
  const shown = lines.slice(0, cap).map((line) => `  ${line}`);
  const more = lines.length > cap ? [`  … 외 ${lines.length - cap}건`] : [];
  return [head, ...shown, ...more].join("\n");
}

/**
 * 하한선 위반 메시지에 **기준선 diff 도 함께** 싣는다.
 *
 * 왜 (실측): 하한선 단정이 기준선 diff 단정보다 먼저 던지기 때문에, 하한선이 걸리면 사람은
 * `하한선 미달: commandPickerFavorites.classCount 30 < 31` 만 본다. 무엇이 30으로 줄었는지는
 * diff 쪽에만 있는데 그 단정에는 도달하지 못한다.
 * 실제 소스 변이 감사에서 이 상태가 "빨갛지만 무엇을 잃었는지 안 말한다"로 잡혔다 —
 * `is-favorite` 클래스를 지웠는데 출력에 그 이름이 한 번도 안 나왔다.
 *
 * 하한선은 거친 backstop(개수)이고 진단은 diff(이름)다. 둘을 갈라 놓으면 게이트가 빨개도
 * 사람이 원인을 못 찾아 기준선을 갱신해서 넘긴다.
 */
function floorLabel(head: string, violations: string[], report: string[]): string {
  const base = labelWith(head, violations);
  if (!report.length) return base;
  return `${base}\n${labelWith(`  ── 함께 관측된 표면 변화 ${report.length}건 (원인은 여기 있다) ──`, report, 20)}`;
}

/**
 * 기준선 대조 + 갱신 래칫 + 하한선을 한 번에 수행한다.
 *
 * @param axis        보고서에 찍히는 축 이름
 * @param baselinePath 기준선 JSON 경로
 * @param floorPath   하한선 JSON 경로
 * @param updateEnv   이 축의 갱신 환경변수 이름(예: "FORM_SURFACE_UPDATE")
 * @param actual      항목 → 표면 객체
 * @param diff        항목별 차이를 사람이 읽는 줄로 바꾼다(같으면 빈 배열)
 * @param metrics     하한선용 지표 추출기
 */
export function assertSurfaceGate<T>(opts: {
  axis: string;
  baselinePath: string;
  floorPath: string;
  updateEnv: string;
  actual: Record<string, T>;
  diff: (key: string, before: T, after: T) => string[];
  metrics: (surface: T) => FloorMetrics;
}): void {
  const { axis, baselinePath, floorPath, updateEnv, actual, diff, metrics } = opts;
  assertNoUpdateEnvInCI();

  const floor = checkFloor(
    floorPath,
    Object.fromEntries(Object.entries(actual).map(([k, v]) => [k, metrics(v)]))
  );

  const updating = process.env[updateEnv] === "1";
  const hadBaseline = existsSync(baselinePath);
  const expected = readJson<Record<string, T>>(baselinePath, {});

  // 갱신 모드든 아니든 diff 는 똑같이 계산한다 — 갱신이 무엇을 지웠는지 보여주기 위해서다.
  //
  // diff 는 항목마다 try 로 감싼다(실측): 기준선이 구 스키마이면 diff 가 TypeError 로 죽고,
  // 그러면 아래 하한선 단정(expect(floorViolations))에 **도달하지 못한 채** 테스트가 예외로
  // 끝난다. 즉 "하한선을 방금 만들었다 / 하한선 위반이다" 라는 신호가 무관한 크래시 메시지에
  // 묻힌다. 예외를 리포트 줄로 바꿔서 하한선 단정이 항상 실행되게 한다.
  const report: string[] = [];
  if (hadBaseline) {
    for (const key of Object.keys(expected)) {
      if (!(key in actual)) {
        report.push(`${key}: 항목이 축에서 사라졌다`);
        continue;
      }
      try {
        const lines = diff(key, expected[key], actual[key]);
        if (lines.length) report.push(`${key}: ${lines.join(" | ")}`);
      } catch (error) {
        report.push(
          `${key}: diff 계산이 예외로 죽었다 — ${(error as Error)?.message ?? String(error)} ` +
            `(기준선 스키마가 낡았을 수 있다: ${updateEnv}=1 로 다시 만들어라)`
        );
      }
    }
    for (const key of Object.keys(actual)) {
      if (!(key in expected)) report.push(`${key}: 축에 새로 생겼다`);
    }
  }

  if (updating) {
    // 하한선 위반이면 기준선을 **쓰지 않는다**.
    //
    // 실측된 순서 결함: 예전에는 writeFileSync 가 이 단정보다 먼저 있었다. 테스트는 빨갛지만
    // 디스크의 기준선은 이미 열화된 표면으로 갈려 있었다 — 실패 메시지를 안 읽고
    // "기준선 갱신" 커밋을 올리면 그 열화가 영구히 승인된다. 갱신 모드를 쓰는 상황 자체가
    // "빨간 걸 통과시키려는" 상황이므로, 여기서 파일을 안 쓰는 것이 유일한 방어다.
    if (floor.violations.length) {
      console.log(`[${axis}] 하한선 위반으로 기준선을 쓰지 않았다:`);
      for (const line of floor.violations) console.log(`  ${line}`);
      expect(
        floor.violations,
        floorLabel(
          `[${axis}] 하한선 위반은 기준선 갱신으로 덮을 수 없다 — 기준선 파일은 그대로 뒀다`,
          floor.violations,
          report
        )
      ).toEqual([]);
    }

    writeFileSync(baselinePath, `${JSON.stringify(actual, null, 1)}\n`);
    const head = hadBaseline
      ? `[${axis}] 기준선을 갱신했다 — 아래 ${report.length}건이 이 갱신으로 승인된다.`
      : `[${axis}] 기준선을 새로 만들었다(이전 기준선 없음).`;
    console.log(head);
    for (const line of report.slice(0, 60)) console.log(`  ${line}`);
    if (report.length > 60) console.log(`  … 외 ${report.length - 60}건`);
    expect(floor.notices, labelWith(`[${axis}] 하한선 파일이 방금 만들어졌다`, floor.notices)).toEqual(
      []
    );
    // 갱신은 통과가 아니라 리뷰 요청이다 — soft 로 빨강을 남긴다.
    expect.soft(
      [],
      `[${axis}] 기준선 갱신 모드: 위 diff 를 리뷰하고 기준선 파일을 커밋에 포함하라. ` +
        `갱신 실행은 의도적으로 실패한다(${updateEnv} 없이 다시 돌려 초록을 확인하라).`
    ).toEqual([`${axis} 기준선 갱신됨 (${report.length}건 승인)`]);
    return;
  }

  expect(
    floor.violations,
    floorLabel(`[${axis}] 하한선 위반`, floor.violations, report)
  ).toEqual([]);
  expect(floor.notices, labelWith(`[${axis}] 하한선 파일이 방금 만들어졌다`, floor.notices)).toEqual(
    []
  );
  expect(hadBaseline, `[${axis}] 기준선 없음: ${baselinePath} (${updateEnv}=1 로 생성)`).toBe(true);
  expect(
    report,
    labelWith(`[${axis}] 표면이 기준선과 다르다 (${report.length}건)`, report)
  ).toEqual([]);
}
