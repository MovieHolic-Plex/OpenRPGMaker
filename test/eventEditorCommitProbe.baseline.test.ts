// test/eventEditorCommitProbe.baseline.test.ts
//
// **커밋 프로브 축의 게이트.** 4개를 담는다.
//
//   (1) 스냅샷: kind 별로 "어떤 컨트롤을 조작하면 어떤 커맨드가 저장되는가"를 기준선과 대조.
//       특히 `... → no-commit` 퇴화는 배선 삭제의 시그니처라 따로 강조해 보고한다.
//   (2) 분기 보존 하드 계약: 기준선 갱신으로 절대 덮을 수 없다. 컨트롤을 조작했을 때
//       분기(자식 명령 배열)가 온전히 남는지 본다. 합성 변이로 이 계약이 실제로 잡는지 증명한다.
//   (3) no-commit 래칫: 지금 무커밋인 컨트롤 집합을 파일로 고정한다. 새로 생기면(=배선이 죽으면)
//       실패, 사라지면(=고쳐지면) 실패해 개선이 기록에 남는다.
//   (4) 렌더 예외 없음: 전 kind 가 예외 없이 프로브를 완주한다.
//
// 왜 이 축이 필요한가는 test/eventEditorCommitProbe.ts 머리 주석에 실측과 함께 있다.
// 요약: 표면 축은 "컨트롤이 있는가"만 봐서 배선 삭제 · 분기 소실 · x↔y 결선 교환 3개 변이를
// 전부 초록으로 통과시켰다.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { assertSurfaceGate, type FloorMetrics } from "./surfaceGateSupport";
import {
  captureAllCommitRuns,
  checkBranchContent,
  checkBranchStructure,
  classifyBranchEditors,
  collectBranchArrays,
  collectMarkers,
  mutateDropBranches,
  mutateSwapChildKind,
  mutateTruncateBranches,
  probeMany,
  stableKeyOf,
  type CommitSurface,
  type ProbeResult,
} from "./eventEditorCommitProbe";
import { FakeElement, installFakeDom } from "./fakeDom";
import {
  BRANCH_FIXTURES,
  DECLARED_BRANCH_SLOTS,
  EXPECTED_BRANCH_ARRAYS,
  EXPECTED_BRANCH_MARKERS,
} from "./fixtures/branchFixtures";
import type { Command } from "@/project/types";

const BASELINE = "test/fixtures/eventEditorCommitProbe.baseline.json";
const FLOOR = "test/fixtures/eventEditorCommitProbe.floor.json";
const ALLOWLIST = "test/fixtures/commitProbeNoCommitAllowlist.json";

type NoCommitAllowlist = {
  readonly _doc?: unknown;
  readonly intentional: Record<string, readonly string[]>;
  readonly UNTRIAGED: Record<string, readonly string[]>;
};

// 축 전체를 한 번만 실행해 4개 테스트가 공유한다(렌더 300여 회, 0.5초 미만).
const run = captureAllCommitRuns();
const surfaces: Record<string, CommitSurface> = run.surfaces;

function diffProbes(kind: string, before: CommitSurface, after: CommitSurface): string[] {
  const lines: string[] = [];
  const dead: string[] = [];
  const beforeProbes = before.probes ?? {};
  const afterProbes = after.probes ?? {};
  for (const [key, was] of Object.entries(beforeProbes)) {
    if (!(key in afterProbes)) {
      lines.push(`컨트롤 소실 ${key}`);
      continue;
    }
    const now = afterProbes[key] ?? "";
    if (now === was) continue;
    // 배선 삭제의 시그니처: 커밋하던 컨트롤이 무커밋으로 내려앉음.
    if (now === "no-commit" && was !== "no-commit") dead.push(key);
    else lines.push(`값 변경 ${key}: ${was} → ${now}`);
  }
  for (const key of Object.keys(afterProbes)) {
    if (!(key in beforeProbes)) lines.push(`컨트롤 신규 ${key}`);
  }
  if (dead.length) {
    lines.unshift(
      `★ 커밋 배선이 죽었다(${dead.length}건, ${kind}): ${dead.join(", ")} — ` +
        `컨트롤은 남아 있고 조작해도 아무 액션도 불리지 않는다`
    );
  }
  if (before.error !== after.error) lines.push(`렌더 예외 변경: ${before.error ?? "없음"} → ${after.error ?? "없음"}`);
  return lines;
}

function metricsOf(surface: CommitSurface): FloorMetrics {
  // noCommitCount 는 담지 않는다 — 적을수록 좋은 지표라 "최소값" 계약이 거꾸로다.
  return { probeCount: surface.probeCount, commitCount: surface.commitCount };
}

describe("이벤트 편집기 커밋 프로브 축", () => {
  it("(1) 컨트롤 조작 → 저장 커맨드 스냅샷이 기준선과 같다", () => {
    assertSurfaceGate<CommitSurface>({
      axis: "커밋 프로브",
      baselinePath: BASELINE,
      floorPath: FLOOR,
      updateEnv: "COMMIT_PROBE_UPDATE",
      actual: surfaces,
      diff: diffProbes,
      metrics: metricsOf,
    });
  });

  it("(4) 전 kind 가 렌더 예외 없이 프로브를 완주한다", () => {
    const broken = Object.entries(surfaces)
      .filter(([, surface]) => surface.error)
      .map(([kind, surface]) => `${kind}: ${surface.error}`);
    const perControl = Object.entries(run.surfaces).flatMap(([kind, surface]) =>
      Object.entries(surface.probes)
        .filter(([, value]) => value.startsWith("error"))
        .map(([key, value]) => `${kind} :: ${key} → ${value}`)
    );
    expect([...broken, ...perControl], "프로브 중 예외가 났다(kind :: stableKey → 스택 앞 4프레임)").toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// (2) 분기 보존 하드 계약 — 두 층. 기준선 갱신으로 절대 덮을 수 없다.
//
//   1층 구조 보존: **모든 컨트롤에 무조건** 적용. 분기 배열의 경로·길이·자식 kind 시퀀스가
//     커밋 전후로 같아야 한다(중첩 분기도 재귀적으로). 실측된 최악의 사각인
//     readOptionsFromDom 의 `branch: []` 는 길이가 0이 되어 여기서 즉시 잡힌다.
//     loop 의 인라인 본문 편집기는 자식의 텍스트만 바꾸므로 이 계약을 깨지 않는다.
//
//   2층 내용 보존: **분기 편집기가 아닌 컨트롤에만** 적용. 어떤 컨트롤이 분기 편집기인지는
//     손으로 만든 예외 목록이 아니라 **측정으로** 판정한다 — 같은 컨트롤에 서로 다른 마커
//     A, B 를 넣고 두 번 돌려, 분기 내용이 그에 따라 달라지면 편집기(정상), A/B 와 무관하게
//     바뀌면 결함이다. 예외 목록을 손으로 관리하지 않으므로 새 폼도 자동으로 옳게 분류된다.
//
// 왜 굳이 측정인가: `event-loop-body-text-<i>` 는 그 분기 자식 자체의 텍스트 편집기다
// (commandBodyLoop.ts:96-102 가 working[i] 를 새 text 명령으로 치환한다). 거기서 마커가
// 바뀌는 건 정상 동작이다. 그렇다고 loop 를 예외 목록에 박거나 마커 검사를 끄면 이 축의
// 존재 이유(분기 소실 감지)가 사라진다. 측정은 정상과 결함을 구분하면서 감지력을 유지한다.
//
// 버튼은 프로브 대상이 아니다 — 클릭이 모달/레코드 픽커를 열어 document.body 를 오염시키는
// 게 실측됐다(피커 testid 1,928개 누출). 그래서 commandBodyLoop.ts:113-119 의 삭제 버튼처럼
// 분기 길이를 정당하게 줄이는 조작은 이 계약의 대상이 아니다.
// ---------------------------------------------------------------------------

describe("분기 보존 하드 계약", () => {
  const branchEntries = Object.entries(BRANCH_FIXTURES) as (readonly [string, Command])[];
  // 정규 실행 + 서로 다른 마커를 쓰는 측정 실행 2개. salt 가 마커 값에 섞여 A/B 가 달라진다.
  const runA = probeMany(branchEntries, { markerSalt: "probeA::" });
  const runB = probeMany(branchEntries, { markerSalt: "probeB::" });

  type Paired = {
    readonly kind: string;
    readonly before: Command;
    readonly key: string;
    readonly a: ProbeResult;
    readonly b: ProbeResult;
  };

  /** 두 측정 실행에서 같은 stableKey 를 짝지은 목록. */
  const paired: Paired[] = [];
  for (const [kind, before] of branchEntries) {
    const resultsB = new Map((runB.runs[kind]?.results ?? []).map((result) => [result.key, result]));
    for (const a of runA.runs[kind]?.results ?? []) {
      const b = resultsB.get(a.key);
      if (b) paired.push({ kind, before, key: a.key, a, b });
    }
  }

  it("픽스처가 실측된 분기 슬롯을 전부 덮는다", () => {
    let arrays = 0;
    let markers = 0;
    for (const [, cmd] of branchEntries) {
      arrays += collectBranchArrays(cmd).size;
      markers += collectMarkers(cmd).length;
    }
    expect(branchEntries.length, "분기를 가진 kind 수").toBe(8);
    expect(arrays, `분기 배열 수(선언 슬롯 ${DECLARED_BRANCH_SLOTS}개 + choices 옵션 2개째)`).toBe(
      EXPECTED_BRANCH_ARRAYS
    );
    expect(markers, "분기 마커 총수").toBe(EXPECTED_BRANCH_MARKERS);
  });

  it("1층: 어떤 컨트롤을 조작해도 분기 구조(길이·kind 시퀀스)가 그대로다", () => {
    const violations: string[] = [];
    let checked = 0;
    for (const { kind, before, key, a, b } of paired) {
      for (const [label, result] of [
        ["A", a],
        ["B", b],
      ] as const) {
        // 커밋이 없으면 분기가 변할 수 없다 — 무커밋은 별도 래칫이 본다.
        if (result.committed === null) continue;
        checked += 1;
        for (const problem of checkBranchStructure(before, result.committed)) {
          violations.push(`${kind} :: ${key} :: [값${label}] ${problem}`);
        }
      }
    }
    console.log(`[커밋 프로브] 1층 구조 계약 검사 대상 ${checked}건(커밋 발생 컨트롤 × 측정 실행 2회).`);
    expect(checked, "분기 픽스처에서 커밋이 발생한 컨트롤이 하나도 없다 — 계약이 헛돌고 있다").toBeGreaterThan(40);
    expect(violations, `분기 구조가 깨진 커밋 ${violations.length}건`).toEqual([]);
  });

  it("2층: 분기 편집기가 아닌 컨트롤은 분기 내용을 바꾸지 않는다", () => {
    const violations: string[] = [];
    const editors: string[] = [];
    const undecidable: string[] = [];
    let checked = 0;

    for (const { kind, before, key, a, b } of paired) {
      if (a.committed === null || b.committed === null) {
        // 두 실행 중 한쪽만 커밋했다면 값에 따라 커밋 여부가 갈린다는 뜻 — 내용 판정 불가.
        if (a.committed !== b.committed) undecidable.push(`${kind} :: ${key} (한쪽만 커밋)`);
        continue;
      }
      const verdict = classifyBranchEditors(before, a.committed, b.committed, a.applied, b.applied);
      for (const path of verdict.editablePaths) editors.push(`${kind} :: ${key} → ${path}`);
      for (const path of verdict.undecidablePaths) undecidable.push(`${kind} :: ${key} → ${path} (값 구분 불가)`);
      checked += 1;
      for (const problem of checkBranchContent(before, a.committed, verdict.editablePaths)) {
        violations.push(`${kind} :: ${key} :: ${problem}`);
      }
      for (const problem of checkBranchContent(before, b.committed, verdict.editablePaths)) {
        violations.push(`${kind} :: ${key} :: ${problem}`);
      }
      for (const path of verdict.corruptedPaths) {
        violations.push(
          `${kind} :: ${key} :: 서로 다른 값 A/B 를 넣었는데 분기 ${path} 가 같은 값으로 변형됐다 — 입력과 무관한 파괴다`
        );
      }
    }

    // 조용히 넘기지 않는다 — 무엇이 편집기로 분류됐고 몇 건이 판정 불가인지 매 실행 찍는다.
    console.log(
      `[커밋 프로브] 2층 내용 계약 검사 대상 ${checked}건. ` +
        `측정으로 '분기 편집기'로 분류된 컨트롤×경로 ${editors.length}건: ${editors.join(", ") || "없음"}. ` +
        `판정 불가 ${undecidable.length}건${undecidable.length ? `: ${undecidable.join(", ")}` : ""} ` +
        `— 판정 불가 항목에는 1층 구조 계약만 적용된다.`
    );
    expect(checked, "2층 계약이 검사할 짝이 없다 — 측정 실행이 헛돌고 있다").toBeGreaterThan(20);
    expect(violations, `분기 편집기가 아닌데 분기를 바꾼 커밋 ${violations.length}건`).toEqual([]);
  });

  // 합성 증명: src/ 를 고칠 수 없으니 프로덕션 변이를 넣는 대신, 커밋 결과를 가로채
  // 분기를 파괴한 뒤 같은 검사 함수에 넣어 **반드시 보고 줄이 나오는지** 확인한다.
  // 이게 없으면 위 두 계약이 항상 빈 배열을 반환하는 껍데기여도 초록이다.
  it("합성 증명 (a): 분기를 [] 로 만들면 1층이 잡는다", () => {
    for (const [kind, cmd] of branchEntries) {
      const problems = checkBranchStructure(cmd, mutateDropBranches(cmd));
      expect(problems.length, `${kind}: 분기를 비웠는데 1층이 조용하다`).toBeGreaterThan(0);
      expect(problems.join(" | "), `${kind}: 1층이 길이 변경을 지적하지 않는다`).toContain("분기 길이 변경");
    }
  });

  it("합성 증명 (a'): 분기 마지막 원소만 잘라도 1층이 잡는다(부분 소실)", () => {
    for (const [kind, cmd] of branchEntries) {
      const problems = checkBranchStructure(cmd, mutateTruncateBranches(cmd));
      expect(problems.length, `${kind}: 분기를 절단했는데 1층이 조용하다`).toBeGreaterThan(0);
      expect(problems.join(" | "), `${kind}: 1층이 길이 변경을 지적하지 않는다`).toContain("분기 길이 변경");
    }
  });

  it("합성 증명 (b): 길이는 유지하고 자식 하나의 kind 만 바꿔도 1층이 잡는다", () => {
    for (const [kind, cmd] of branchEntries) {
      const mutated = mutateSwapChildKind(cmd);
      // 길이는 그대로임을 먼저 못박는다 — 길이 검사에 얹혀 통과하는 게 아님을 보인다.
      const beforeLengths = [...collectBranchArrays(cmd)].map(([path, arr]) => `${path}=${arr.length}`);
      const afterLengths = [...collectBranchArrays(mutated)].map(([path, arr]) => `${path}=${arr.length}`);
      expect(afterLengths, `${kind}: 변이가 길이를 바꿨다 — kind 시퀀스 증명이 무의미해진다`).toEqual(
        beforeLengths
      );
      const problems = checkBranchStructure(cmd, mutated);
      expect(problems.length, `${kind}: 자식 kind 를 바꿨는데 1층이 조용하다`).toBeGreaterThan(0);
      expect(problems.join(" | "), `${kind}: 1층이 kind 시퀀스 변경을 지적하지 않는다`).toContain(
        "분기 kind 시퀀스 변경"
      );
    }
  });

  it("합성 증명 (c): 분기 편집기가 아닌 컨트롤이 분기 문자열을 지우면 2층이 잡는다", () => {
    // 길이도 kind 시퀀스도 그대로 두고 마커 문자열만 삼킨다 → 1층은 통과, 2층이 잡아야 한다.
    const swallow = (value: unknown): unknown => {
      if (Array.isArray(value)) return value.map(swallow);
      if (value && typeof value === "object") {
        const source = value as Record<string, unknown>;
        if (typeof source.body === "string" && source.body.startsWith("__BRANCH_MARK_")) {
          return { ...source, body: "" };
        }
        const out: Record<string, unknown> = {};
        for (const [key, child] of Object.entries(source)) out[key] = swallow(child);
        return out;
      }
      return value;
    };
    for (const [kind, cmd] of branchEntries) {
      const swallowed = swallow(cmd) as Command;
      expect(checkBranchStructure(cmd, swallowed), `${kind}: 이 변이는 1층을 통과해야 한다`).toEqual([]);
      const problems = checkBranchContent(cmd, swallowed, []);
      expect(problems.length, `${kind}: 분기 문자열이 지워졌는데 2층이 조용하다`).toBeGreaterThan(0);
      expect(problems.join(" | "), `${kind}: 2층이 '편집기가 아닌데 내용이 변했다'를 말하지 않는다`).toContain(
        "이 컨트롤은 분기 편집기가 아닌데 분기 내용이 변했다"
      );
    }
  });

  it("합성 증명 (d): 측정 판정이 편집기와 파괴를 실제로 구분한다", () => {
    const cmd = BRANCH_FIXTURES.loop as Command;
    const asText = (body: string): Command =>
      ({ kind: "loop", body: [{ kind: "text", body }, { kind: "text", body: "__BRANCH_MARK_LOOP_BODY_2__" }, { kind: "breakLoop" }] }) as Command;

    // 편집기: 넣은 값 A/B 에 따라 body[0] 이 달라진다 → editablePaths 에 body 가 들어가고
    // 그 면제 아래에서 2층이 조용해야 한다.
    const editor = classifyBranchEditors(cmd, asText("valueA"), asText("valueB"), "valueA", "valueB");
    expect(editor.editablePaths, "값에 따라 달라지는 분기를 편집기로 인정하지 않는다").toEqual(["body"]);
    expect(editor.corruptedPaths).toEqual([]);
    expect(checkBranchContent(cmd, asText("valueA"), editor.editablePaths)).toEqual([]);

    // 파괴: A/B 를 다르게 넣었는데도 결과가 같고 원본과 다르다 → corrupted 로 잡혀야 한다.
    const wiped = asText("");
    const broken = classifyBranchEditors(cmd, wiped, wiped, "valueA", "valueB");
    expect(broken.editablePaths, "입력과 무관한 변형을 편집기로 오인한다").toEqual([]);
    expect(broken.corruptedPaths, "입력과 무관한 분기 파괴를 잡지 못한다").toEqual(["body"]);

    // 값 구분 불가(체크박스 토글처럼 한 종류만 넣을 수 있는 컨트롤)는 결함으로 몰지 않고
    // 판정 불가로 남긴다 — 1층 구조 계약만 적용된다.
    const same = classifyBranchEditors(cmd, wiped, wiped, "checked", "checked");
    expect(same.corruptedPaths, "값을 구분할 수 없는 컨트롤을 결함으로 단정한다").toEqual([]);
    expect(same.undecidablePaths).toEqual(["body"]);
  });

  it("합성 증명 (e): 정상 커밋(분기 무변경)에는 두 층 모두 조용하다 — 거짓 양성 방지", () => {
    for (const [kind, cmd] of branchEntries) {
      // 분기와 무관한 필드만 바꾼 커밋을 흉내낸다.
      const touched = { ...(cmd as unknown as Record<string, unknown>), __probeOnly: "x" } as unknown as Command;
      expect(checkBranchStructure(cmd, touched), `${kind}: 1층 거짓 양성`).toEqual([]);
      expect(checkBranchContent(cmd, touched, []), `${kind}: 2층 거짓 양성`).toEqual([]);
    }
  });
});


// ---------------------------------------------------------------------------
// (3) no-commit 래칫
// ---------------------------------------------------------------------------

describe("no-commit 래칫", () => {
  it("무커밋 컨트롤 집합이 허용 목록과 정확히 일치한다", () => {
    const actual = new Set<string>();
    for (const [kind, surface] of Object.entries(surfaces)) {
      for (const [key, value] of Object.entries(surface.probes)) {
        if (value === "no-commit") actual.add(`${kind} :: ${key}`);
      }
    }

    if (!existsSync(ALLOWLIST)) {
      const grouped: Record<string, string[]> = {};
      for (const entry of [...actual].sort()) {
        const [kind = "", key = ""] = entry.split(" :: ");
        (grouped[kind] ??= []).push(key);
      }
      writeFileSync(
        ALLOWLIST,
        `${JSON.stringify(
          {
            _doc:
              "조작해도 커밋이 발생하지 않는 컨트롤 목록. 새 항목이 생기면(=배선이 죽으면) 게이트가 실패한다. " +
              "항목이 사라지면(=배선이 생기면) 목록에서 지우고 커밋하라 — 개선이 기록에 남아야 한다.",
            intentional: {},
            UNTRIAGED: grouped,
          },
          null,
          1
        )}\n`
      );
      expect.soft(
        [],
        `허용 목록을 새로 만들었다: ${ALLOWLIST} — 전부 UNTRIAGED 다. ` +
          `리뷰해서 정상인 것은 intentional 로 옮기고 커밋하라(이 실행은 의도적으로 실패한다).`
      ).toEqual(["created"]);
      return;
    }

    const list = JSON.parse(readFileSync(ALLOWLIST, "utf8")) as NoCommitAllowlist;
    const flatten = (group: Record<string, readonly string[]>): string[] =>
      Object.entries(group).flatMap(([kind, keys]) => keys.map((key) => `${kind} :: ${key}`));
    const intentional = flatten(list.intentional ?? {});
    const untriaged = flatten(list.UNTRIAGED ?? {});
    const allowed = new Set([...intentional, ...untriaged]);

    const overlap = intentional.filter((entry) => untriaged.includes(entry));
    expect(overlap, "intentional 과 UNTRIAGED 에 같은 항목이 중복 등재됐다").toEqual([]);

    const appeared = [...actual].filter((entry) => !allowed.has(entry)).sort();
    const disappeared = [...allowed].filter((entry) => !actual.has(entry)).sort();

    // 아직 몇 건이 미분류인지 매 실행 가시화한다 — 조용히 쌓이면 전수 UNTRIAGED 가 정답이 된다.
    console.log(
      `[커밋 프로브] no-commit ${actual.size}건 = intentional ${intentional.length} + UNTRIAGED ${untriaged.length}. ` +
        `아직 ${untriaged.length}건이 미분류다(${ALLOWLIST} 의 UNTRIAGED).`
    );

    expect(
      appeared,
      "무커밋 컨트롤이 새로 생겼다 — 커밋 배선이 죽었는지 확인하고, 의도적이면 " +
        `${ALLOWLIST} 의 intentional 에 근거와 함께 추가하라`
    ).toEqual([]);
    expect(
      disappeared,
      "무커밋이던 컨트롤이 커밋을 시작했다(고쳐진 것을 축하한다) — " +
        `${ALLOWLIST} 에서 해당 항목을 제거해 커밋하라(개선이 기록에 남아야 한다)`
    ).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// stableKey 불변성 — 래퍼 div 를 하나 더 감싸도 키가 변하지 않아야 한다
// ---------------------------------------------------------------------------

describe("stableKey 불변성", () => {
  it("래퍼 div 를 하나 끼워도 키가 그대로다", () => {
    const restore = installFakeDom();
    try {
      const build = (wrap: boolean): { root: FakeElement; probes: FakeElement[] } => {
        const root = new FakeElement("div");
        const anchored = new FakeElement("div");
        anchored.dataset.testid = "anchor";
        const first = new FakeElement("input");
        const second = new FakeElement("input");
        const named = new FakeElement("input");
        named.dataset.testid = "named-input";
        const bare = new FakeElement("select");
        if (wrap) {
          const w1 = new FakeElement("div");
          const w2 = new FakeElement("div");
          w1.append(first);
          w2.append(second, named);
          anchored.append(w1, w2);
          const w3 = new FakeElement("div");
          w3.append(bare);
          root.append(anchored, w3);
        } else {
          anchored.append(first, second, named);
          root.append(anchored, bare);
        }
        return { root, probes: [first, second, named, bare] };
      };
      const plain = build(false);
      const wrapped = build(true);
      const keysOf = (built: { root: FakeElement; probes: FakeElement[] }): string[] =>
        built.probes.map((node) => stableKeyOf(built.root, node));

      expect(keysOf(plain)).toEqual(["anchor>input#0", "anchor>input#1", "named-input", ":root>select#0"]);
      expect(keysOf(wrapped), "래퍼 div 가 키를 바꿨다 — 키 규칙이 DOM 구조에 결합돼 있다").toEqual(
        keysOf(plain)
      );
    } finally {
      restore();
    }
  });
});
