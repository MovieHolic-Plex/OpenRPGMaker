// @vitest-environment happy-dom
// test/eventEditorInteractionSurface.baseline.test.ts
//
// **상호작용 후 폼** 축 게이트. 컨트롤을 하나 조작한 뒤의 폼 표면을 기준선과 대조한다.
// 기준선: test/fixtures/eventEditorInteractionSurface.baseline.json (git 추적)
// 하한선: test/fixtures/eventEditorInteractionSurface.floor.json (git 추적, 별도 커밋으로만 갱신)
// 반응 래칫: test/fixtures/interactionNoChangeAllowlist.json (git 추적)
//
// 갱신:
//   INTERACTION_SURFACE_UPDATE=1   npx vitest run test/eventEditorInteractionSurface.baseline.test.ts
//   INTERACTION_ALLOWLIST_UPDATE=1 npx vitest run test/eventEditorInteractionSurface.baseline.test.ts
// 두 갱신 실행 모두 **의도적으로 빨갛다** — 갱신은 통과가 아니라 리뷰 요청이다.
//
// ⚠ 로그(`console.log`)를 보려면 `--silent=false` 를 붙여라. vitest.config.ts 가 silent:true 다.
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { COMMAND_KINDS } from "@/project/commandKindRegistry";
import {
  captureAllInteractionSurfaces,
  collectReactingKeys,
  diffInteractionSurface,
  interactionErrorStacks,
  interactionSurfaceMetrics,
  isReactionValue,
  type InteractionSurface,
} from "./eventEditorInteractionSurface";
import { assertSurfaceGate } from "./surfaceGateSupport";

const BASELINE = resolve(process.cwd(), "test/fixtures/eventEditorInteractionSurface.baseline.json");
const FLOOR = resolve(process.cwd(), "test/fixtures/eventEditorInteractionSurface.floor.json");
const ALLOWLIST = resolve(process.cwd(), "test/fixtures/interactionNoChangeAllowlist.json");

const ALLOWLIST_UPDATE_ENV = "INTERACTION_ALLOWLIST_UPDATE";

// surfaceGateSupport.assertNoUpdateEnvInCI() 의 UPDATE_ENVS 배열에 이 축의 이름이 아직 없다.
// 그 파일은 이 패키지의 소유가 아니라 수정할 수 없으므로, 같은 방어를 여기서 직접 한다.
// (배선 담당이 UPDATE_ENVS 에 "INTERACTION_SURFACE_UPDATE" 를 추가하면 이 줄은 이중 방어가 된다.)
if (process.env.CI && process.env.INTERACTION_SURFACE_UPDATE === "1") {
  throw new Error(
    "CI 에서 INTERACTION_SURFACE_UPDATE=1 이다 — CI 는 기준선을 쓰지 않는다(래칫 무력화). " +
      "surfaceGateSupport.ts 의 UPDATE_ENVS 에 이 이름이 아직 없어 여기서 직접 막는다."
  );
}
if (process.env.CI && process.env[ALLOWLIST_UPDATE_ENV] === "1") {
  throw new Error(`CI 에서 ${ALLOWLIST_UPDATE_ENV}=1 이다 — 반응 래칫을 CI 가 다시 쓰면 래칫이 사라진다.`);
}

type Allowlist = {
  _doc?: string;
  reacting: Record<string, string[]>;
};

const ALLOWLIST_DOC =
  "조작하면 표면이 바뀌는(=조건부 표시 로직이 걸린) 컨트롤 목록. " +
  "여기 있던 항목이 no-change / self-only 로 퇴화하면 조건부 표시 로직이 죽은 것이다. " +
  `측정으로 생성한다: ${ALLOWLIST_UPDATE_ENV}=1 npx vitest run test/eventEditorInteractionSurface.baseline.test.ts`;

/**
 * 실패 라벨에 위반 줄을 직접 박는다 — vitest 는 `expect(arr, "라벨").toEqual([])` 의 배열을
 * `Array(72)` 로 접어서(실측) 무엇이 위반인지 안 보인다. 이유가 안 보이면 사람은 갱신으로 넘긴다.
 */
function labelWith(head: string, lines: readonly string[], cap = 30): string {
  if (!lines.length) return head;
  const shown = lines.slice(0, cap).map((line) => `  ${line}`);
  const more = lines.length > cap ? [`  … 외 ${lines.length - cap}건`] : [];
  return [head, ...shown, ...more].join("\n");
}

function clone(surface: InteractionSurface): InteractionSurface {
  return JSON.parse(JSON.stringify(surface)) as InteractionSurface;
}

function countValues(actual: Record<string, InteractionSurface>, pred: (v: string) => boolean): number {
  return Object.values(actual).reduce(
    (sum, s) => sum + Object.values(s.reactions).filter(pred).length,
    0
  );
}

describe("이벤트에디터 상호작용 후 폼 표면 스냅샷", () => {
  const started = Date.now();
  const actual = captureAllInteractionSurfaces();
  const elapsedMs = Date.now() - started;

  const probeTotal = Object.values(actual).reduce((s, v) => s + v.probeCount, 0);
  const reactingTotal = Object.values(actual).reduce((s, v) => s + v.reactingCount, 0);
  const noChangeTotal = countValues(actual, (v) => v === "no-change" || v.endsWith("no-change"));
  const selfOnlyTotal = countValues(actual, (v) => v.startsWith("self-only"));
  const blockedTotal = probeTotal - reactingTotal - noChangeTotal - selfOnlyTotal;

  // 규모를 로그로 남긴다 — "반응 컨트롤 수"가 이 축의 유일한 존재 이유라 숫자가 보여야 한다.
  console.log(
    `[상호작용 후 폼] kind ${Object.keys(actual).length} / 프로브 ${probeTotal} / ` +
      `반응 ${reactingTotal} / no-change ${noChangeTotal} / self-only ${selfOnlyTotal} / ` +
      `조작불가 ${blockedTotal} / 수확 ${(elapsedMs / 1000).toFixed(1)}s`
  );

  it("kind 집합이 COMMAND_KINDS 와 일치한다 (조용한 절단 금지)", () => {
    // 성능을 이유로 kind 를 빼면 여기서 반드시 빨개진다. 절단은 조용히 "다 봤다"로 읽힌다.
    expect(Object.keys(actual).sort()).toEqual([...COMMAND_KINDS].sort());
  });

  it("모든 kind 가 오류 없이 프로브를 완주한다", () => {
    const stacks = interactionErrorStacks();
    const failures = Object.entries(actual)
      .filter(([, s]) => s.error)
      .map(([kind, s]) => {
        const stack = stacks[kind] ?? Object.entries(stacks).find(([k]) => k.startsWith(`${kind}/`))?.[1];
        return `${kind}: ${s.error}\n${stack ?? "(스택 없음)"}`;
      });
    expect(failures, `프로브 오류 ${failures.length}건`).toEqual([]);
  });

  // ── 재렌더 생존 계약 ──────────────────────────────────────────────────────────────
  //
  // 조작 후 표면이 비면(testidCount 0) 수확이 공허해진 것이다 — 폼이 루트를 교체했는데
  // 우리가 교체 전 노드를 훑고 있다는 뜻이고, 그 상태로 기준선을 만들면 "전부 no-change"
  // 라는 거짓 초록이 영구히 박힌다. 컨테이너 수확(harvester 의 함정 3 대책)이 실제로
  // 작동함을 이 계약이 증명한다.
  it("조작 후에도 표면이 비지 않는다 (루트 교체 대처가 작동한다)", () => {
    const collapsed = Object.entries(actual).flatMap(([kind, s]) =>
      Object.entries(s.reactions)
        .filter(([, v]) => v.startsWith("collapsed:"))
        .map(([key, v]) => `${kind} / ${key}: ${v}`)
    );
    expect(
      collapsed,
      labelWith(
        `조작 후 표면이 빈 프로브 ${collapsed.length}개 — 컨테이너 대신 교체된 루트를 훑고 있다`,
        collapsed
      )
    ).toEqual([]);
  });

  it("초기 표면이 비어 있지 않은 kind 가 대다수다 (수확 자체가 죽지 않았다)", () => {
    const empty = Object.entries(actual)
      .filter(([, s]) => s.initial.testidCount === 0)
      .map(([kind]) => kind);
    // 무필드 kind 가 소수 존재하는 건 정상이다. 절반이 비면 수확이 죽은 것이다.
    expect(empty.length, `초기 표면이 빈 kind ${empty.length}종 [${empty.join(", ")}]`).toBeLessThan(
      Object.keys(actual).length / 2
    );
  });

  // ── H-2. 반응 여부 래칫 (하드 계약 — 기준선 갱신으로 덮을 수 없다) ────────────────
  //
  // 왜 "변화 없음"을 실패로 볼 수 없는가: 숫자 하나 고쳐도 레이아웃이 그대로인 컨트롤이
  // 대다수고, 그게 정상이다. 그래서 반대 방향을 래칫한다 — **한 번 반응했던 컨트롤은
  // 계속 반응해야 한다.** 이 검사는 assertSurfaceGate 밖에 있어서
  // INTERACTION_SURFACE_UPDATE=1 로도 통과되지 않는다.
  it("반응하던 컨트롤이 no-change 로 퇴화하지 않는다", () => {
    const measured = collectReactingKeys(actual);
    const measuredTotal = Object.values(measured).reduce((s, v) => s + v.length, 0);
    console.log(`[상호작용 후 폼] 반응 컨트롤 ${measuredTotal}개 / 반응하는 kind ${Object.keys(measured).length}종`);

    if (process.env[ALLOWLIST_UPDATE_ENV] === "1" || !existsSync(ALLOWLIST)) {
      writeFileSync(
        ALLOWLIST,
        `${JSON.stringify({ _doc: ALLOWLIST_DOC, reacting: measured }, null, 1)}\n`
      );
      expect.soft(
        [],
        `반응 래칫을 ${existsSync(ALLOWLIST) ? "갱신" : "생성"}했다: ${ALLOWLIST} ` +
          `(${measuredTotal}개 / ${Object.keys(measured).length} kind) — 별도 커밋으로 리뷰하라. ` +
          `이 실행은 의도적으로 실패한다(${ALLOWLIST_UPDATE_ENV} 없이 다시 돌려 초록을 확인하라).`
      ).toEqual(["반응 래칫 갱신됨"]);
      return;
    }

    const allowlist = JSON.parse(readFileSync(ALLOWLIST, "utf8")) as Allowlist;
    const expectedReacting = allowlist.reacting ?? {};

    const regressions: string[] = [];
    for (const [kind, keys] of Object.entries(expectedReacting)) {
      const surface = actual[kind];
      if (!surface) {
        regressions.push(`${kind}: kind 가 축에서 사라졌다`);
        continue;
      }
      for (const key of keys) {
        const value = surface.reactions[key];
        if (value === undefined) {
          regressions.push(`${kind} / ${key}: 컨트롤이 사라져 프로브 대상이 아니다`);
          continue;
        }
        if (!isReactionValue(value)) {
          regressions.push(`${kind} / ${key}: 반응이 죽었다 → "${value}"`);
        }
      }
    }
    expect(
      regressions,
      labelWith(
        `반응 퇴화 ${regressions.length}건 — 조건부 표시/재렌더 로직이 죽었는지 확인하라 ` +
          `(change 핸들러 안의 syncVisibility 계열 호출, 조건부 렌더 분기가 살아 있는지). ` +
          `컨트롤을 의도적으로 없앴다면 ${ALLOWLIST} 에서 해당 항목을 지우고 별도 커밋으로 리뷰하라.`,
        regressions
      )
    ).toEqual([]);

    // 새로 반응하는 컨트롤은 실패시킨다 — 조건부 로직이 늘어난 사실도 커밋에 남아야 한다.
    const novel: string[] = [];
    for (const [kind, keys] of Object.entries(measured)) {
      const known = new Set(expectedReacting[kind] ?? []);
      for (const key of keys) if (!known.has(key)) novel.push(`${kind} / ${key}`);
    }
    expect(
      novel,
      labelWith(
        `새로 반응하는 컨트롤 ${novel.length}개 — 조건부 표시 로직이 늘어났다. ` +
          `${ALLOWLIST_UPDATE_ENV}=1 로 목록을 갱신하고 별도 커밋으로 리뷰하라.`,
        novel
      )
    ).toEqual([]);
  });

  // ── 합성 변이 증명 ────────────────────────────────────────────────────────────────
  //
  // src 는 읽기 전용이라 프로덕션 변이를 넣을 수 없다. 실제 수확 결과를 깊은 복사해
  // 변이를 주고 diff 가 반드시 보고 줄을 내는지 확인한다. 이게 없으면 "게이트가 초록이다"와
  // "게이트가 아무것도 안 본다"를 구별할 수 없다.
  it("합성 변이를 diff 가 전부 잡는다", () => {
    const withReaction = Object.entries(actual).find(([, s]) => s.reactingCount > 0);
    const withClasses = Object.entries(actual).find(([, s]) => s.classes.length > 0);
    const withTestids = Object.entries(actual).find(([, s]) => s.initial.testids.length > 0);
    expect(
      [withReaction, withClasses, withTestids].map(Boolean),
      "변이 대상 표면을 찾지 못했다 — 축이 비었거나 수확이 죽었다"
    ).toEqual([true, true, true]);

    const reactingKind = withReaction![0];
    const reactingKey = Object.entries(actual[reactingKind].reactions).find(([, v]) =>
      isReactionValue(v)
    )![0];

    const mutations: { name: string; kind: string; mutate: (s: InteractionSurface) => void }[] = [
      {
        name: "반응 하나를 no-change 로 퇴화",
        kind: reactingKind,
        mutate: (s) => {
          (s.reactions as Record<string, string>)[reactingKey] = "no-change";
        },
      },
      {
        name: "반응 하나를 self-only 로 퇴화",
        kind: reactingKind,
        mutate: (s) => {
          (s.reactions as Record<string, string>)[reactingKey] = "self-only 컨트롤 값 변경 1개";
        },
      },
      {
        name: "reactions 키 하나 제거(컨트롤 소실)",
        kind: reactingKind,
        mutate: (s) => {
          delete (s.reactions as Record<string, string>)[reactingKey];
          (s as { probeCount: number }).probeCount -= 1;
        },
      },
      {
        name: "조작후 클래스 하나 제거",
        kind: withClasses![0],
        mutate: (s) => {
          (s as { classes: string[] }).classes = s.classes.slice(1);
        },
      },
      {
        name: "초기 표면 testid 하나 제거",
        kind: withTestids![0],
        mutate: (s) => {
          (s.initial as { testids: string[] }).testids = s.initial.testids.slice(1);
        },
      },
      {
        name: "프로브 오류 발생",
        kind: reactingKind,
        mutate: (s) => {
          (s as { error?: string }).error = "TypeError: boom";
        },
      },
    ];

    const undetected = mutations
      .filter(({ kind, mutate }) => {
        const before = actual[kind];
        const after = clone(before);
        mutate(after);
        return diffInteractionSurface(kind, before, after).length === 0;
      })
      .map((m) => m.name);
    expect(undetected, `diff 가 놓친 합성 변이 ${undetected.length}종`).toEqual([]);

    // 퇴화는 전용 보고 줄로 강조돼야 한다 — 다른 잡음에 섞이면 리뷰에서 놓친다.
    const degradedReport = diffInteractionSurface(
      reactingKind,
      actual[reactingKind],
      (() => {
        const after = clone(actual[reactingKind]);
        (after.reactions as Record<string, string>)[reactingKey] = "no-change";
        return after;
      })()
    );
    expect(degradedReport.some((line) => line.includes("반응 퇴화"))).toBe(true);

    // 변이가 없으면 반드시 조용해야 한다 — 잡음을 내는 게이트는 갱신 습관을 만든다.
    const noisy = Object.keys(actual).filter(
      (k) => diffInteractionSurface(k, actual[k], clone(actual[k])).length > 0
    );
    expect(noisy, "변이 없이도 diff 가 보고 줄을 냈다(비결정 수확 의심)").toEqual([]);
  });

  it("기준선과 일치한다", () => {
    assertSurfaceGate<InteractionSurface>({
      axis: "상호작용 후 폼",
      baselinePath: BASELINE,
      floorPath: FLOOR,
      updateEnv: "INTERACTION_SURFACE_UPDATE",
      actual,
      diff: diffInteractionSurface,
      metrics: interactionSurfaceMetrics,
    });
  });
});
