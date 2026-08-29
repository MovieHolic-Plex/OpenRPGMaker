// @vitest-environment happy-dom
// test/eventEditorConditionSurface.baseline.test.ts
//
// 조건 편집기 전 종류 + 조건 그룹(중첩) + 열거값 변형의 표면 스냅샷 게이트.
// 기준선: test/fixtures/eventEditorConditionSurface.baseline.json (git 추적)
// 하한선: test/fixtures/eventEditorConditionSurface.floor.json (git 추적, 별도 커밋으로만 갱신)
// 갱신: CONDITION_SURFACE_UPDATE=1 npx vitest run test/eventEditorConditionSurface.baseline.test.ts
import { describe, expect, it } from "vitest";
import { resolve } from "node:path";
import { CONDITION_KINDS } from "@/project/commandKindRegistry";
import type { Command } from "@/project/types";
import {
  CONDITION_FIXTURES,
  CONDITION_GROUP_FIXTURES,
  ENUM_VARIANT_FIXTURES,
  RUN_QUERY_FIXTURES,
  forkWith,
} from "./fixtures/conditionFixtures";
import {
  captureCommandSurface,
  diffFormSurface,
  formSurfaceMetrics,
  type FormSurface,
} from "./eventEditorFormSurface";
import { assertSurfaceGate } from "./surfaceGateSupport";

const BASELINE = resolve(process.cwd(), "test/fixtures/eventEditorConditionSurface.baseline.json");
const FLOOR = resolve(process.cwd(), "test/fixtures/eventEditorConditionSurface.floor.json");

// ── 축 수확 ──────────────────────────────────────────────────────────────────────
// 세 묶음을 따로 만들고 마지막에 하나로 합친다. 계약(키 집합 = CONDITION_KINDS 등)이
// 묶음별로 다르기 때문이다.

/** `fork:<conditionKind>` — 조건 종류 전량. */
const conditionSurfaces: Record<string, FormSurface> = Object.fromEntries(
  CONDITION_KINDS.map((kind) => [`fork:${kind}`, captureCommandSurface(forkWith(CONDITION_FIXTURES[kind]))])
);

/** `fork:group-*` — 자식 2개 이상 / 중첩 깊이 2. */
const groupSurfaces: Record<string, FormSurface> = Object.fromEntries(
  Object.entries(CONDITION_GROUP_FIXTURES).map(([key, condition]) => [
    `fork:${key}`,
    captureCommandSurface(forkWith(condition)),
  ])
);

/** `fork:run.query=*` — 조건 kind 하나 안에서 폼이 갈리는 유일한 사례. */
const runQuerySurfaces: Record<string, FormSurface> = Object.fromEntries(
  Object.entries(RUN_QUERY_FIXTURES).map(([key, condition]) => [
    `fork:${key}`,
    captureCommandSurface(forkWith(condition)),
  ])
);

/** `<kind>:<field>=<value>` — 커맨드의 열거값 변형. */
const enumSurfaces: Record<string, FormSurface> = Object.fromEntries(
  Object.entries(ENUM_VARIANT_FIXTURES).map(([key, cmd]) => [key, captureCommandSurface(cmd)])
);

const actual: Record<string, FormSurface> = {
  ...conditionSurfaces,
  ...groupSurfaces,
  ...runQuerySurfaces,
  ...enumSurfaces,
};

function clone(surface: FormSurface): FormSurface {
  return JSON.parse(JSON.stringify(surface)) as FormSurface;
}

/** 같은 kind 의 변형끼리 묶는다 — `changeGold:amount=number` → `changeGold:amount`. */
function variantFamily(key: string): string {
  return key.replace(/=[^=]*$/, "");
}

describe("이벤트에디터 조건/열거값 표면 스냅샷", () => {
  // ── E-1. 조건 종류 전량 계약 ──────────────────────────────────────────────────
  // 스냅샷 밖에서 직접 expect 한다 — 기준선 갱신으로 덮이면 계약이 아니다.
  it("조건 종류 키 집합이 CONDITION_KINDS 와 정확히 일치한다", () => {
    expect(
      Object.keys(conditionSurfaces).sort(),
      "조건 종류가 추가/삭제됐다. CONDITION_FIXTURES 에 최소 유효 조건을 넣어라."
    ).toEqual([...CONDITION_KINDS].map((k) => `fork:${k}`).sort());
  });

  it("모든 항목이 예외 없이 렌더된다", () => {
    const errors = Object.entries(actual)
      .filter(([, s]) => s.error)
      .map(([k, s]) => `${k}: ${s.error}`);
    expect(errors).toEqual([]);
  });

  it("모든 항목의 컨트롤 수가 0 이 아니다", () => {
    const zero = Object.entries(actual)
      .filter(([, s]) => s.controlCount === 0)
      .map(([k]) => k)
      .sort();
    expect(zero, "컨트롤 0 항목 = 그 편집기가 죽었다").toEqual([]);
  });

  /**
   * controlCount>0 만으로는 조건 편집기의 죽음을 못 잡는다 — 실측: 16종 전부 controlCount≥3 이고,
   * 그중 2개(`event-condition-mode` select + `event-fork-else-enabled` 체크박스)는 조건 종류와
   * 무관하게 항상 그려지는 껍데기다. 즉 `switch (cond.kind)` 의 분기 하나를 지워 리프 편집기가
   * 아무 컨트롤도 안 내도 controlCount 는 2 로 남아 ">0" 을 통과한다.
   *
   * 그래서 "16종 전부에 공통으로 있는 컨트롤 키"를 껍데기로 정의하고, 각 종류가 그 밖의
   * 컨트롤을 최소 1개 낸다고 요구한다. 껍데기 집합을 하드코딩하지 않고 교집합으로 구하므로
   * 껍데기가 늘거나 줄어도 이 계약은 계속 정확하다.
   *
   * 화이트리스트(자기 컨트롤이 원래 없는 조건)는 **없다** — 16종 모두 편집할 필드가 있다.
   * 결함 래칫도 비어 있다.
   */
  it("각 조건 종류가 공용 껍데기 밖의 자기 컨트롤을 낸다", () => {
    const keySets = Object.values(conditionSurfaces).map((s) => new Set(Object.keys(s.controls)));
    const shell = [...keySets[0]].filter((k) => keySets.every((set) => set.has(k)));
    // 껍데기가 사라지면 이 계약이 무의미하게 통과한다 — 껍데기 자체도 못 박는다.
    expect(shell.sort(), "조건 폼의 공용 껍데기 컨트롤이 바뀌었다").toEqual([
      "event-condition-mode",
      "event-fork-else-enabled",
    ]);

    const ownControlCount = Object.fromEntries(
      Object.entries(conditionSurfaces).map(([key, s]) => [
        key,
        Object.keys(s.controls).filter((k) => !shell.includes(k)).length,
      ])
    );
    const dead = Object.entries(ownControlCount)
      .filter(([, n]) => n === 0)
      .map(([k]) => k)
      .sort();
    expect(
      dead,
      "이 조건 종류가 공용 껍데기 외에 아무 컨트롤도 내지 않는다 = 리프 편집기가 죽었다. " +
        "원래 편집할 필드가 없는 종류라면 근거와 함께 화이트리스트를 새로 만들어라."
    ).toEqual([]);
  });

  /**
   * 조건 kind 해석이 죽으면(예: `switch (cond.kind)` 가 지워지면) 16종이 전부 같은 폼을
   * 그린다. 기준선은 그때도 "일관되게" 갱신될 수 있으므로 스냅샷으로는 못 잡는다.
   * testid 집합의 동일성으로 직접 잡는다.
   *
   * 정상적으로 동일할 수 있는 쌍은 없다 — conditionForm 은 kind 마다 다른 testid 접두사를
   * 쓰고, 힌트 문구(`event-condition-hint`)까지 kind 로 갈린다.
   */
  it("조건 종류마다 testid 집합이 서로 다르다", () => {
    const dupes: string[] = [];
    const keys = Object.keys(conditionSurfaces);
    for (let i = 0; i < keys.length; i += 1) {
      for (let j = i + 1; j < keys.length; j += 1) {
        const a = conditionSurfaces[keys[i]];
        const b = conditionSurfaces[keys[j]];
        if (JSON.stringify(a.testids) === JSON.stringify(b.testids)) {
          dupes.push(`${keys[i]} ≡ ${keys[j]}`);
        }
      }
    }
    expect(
      dupes,
      "두 조건 종류가 같은 testid 집합을 냈다 — 조건 kind 해석이 죽어 항상 같은 폼을 그린다"
    ).toEqual([]);
  });

  // ── E-2. 조건 그룹(중첩) ─────────────────────────────────────────────────────
  it("그룹 항목이 자식 수/중첩 깊이만큼 더 큰 표면을 낸다", () => {
    // all 자식 1개(최소형) < all 자식 2개 < all(switch, any(...)) 중첩
    const one = conditionSurfaces["fork:all"];
    const two = groupSurfaces["fork:group-all-two"];
    const nested = groupSurfaces["fork:group-all-nested"];
    expect(two.controlCount, "자식 2개 그룹이 자식 1개보다 크지 않다").toBeGreaterThan(one.controlCount);
    expect(nested.controlCount, "중첩 그룹이 평면 그룹보다 크지 않다").toBeGreaterThan(two.controlCount);
    // 중첩 깊이 2 의 증거: 내부 any 그룹의 testid 가 실제로 나온다.
    expect(nested.testids, "중첩된 any 그룹이 렌더되지 않았다").toContain("event-condition-group-any");
    expect(groupSurfaces["fork:group-not-nested"].testids).toContain("event-condition-group-all");
  });

  // ── E-3. 열거값 변형 ─────────────────────────────────────────────────────────
  /**
   * 같은 kind 의 서로 다른 열거값이 같은 표면을 내면 그 값 분기가 렌더에 반영되지 않는다는
   * 뜻이다. 그런 변형을 축에 두면 기준선만 커지고 보증은 늘지 않으므로, 여기서 실패시켜
   * 기각(픽스처에서 제거) 또는 결함 보고를 강제한다.
   */
  it("같은 kind 의 열거값 변형끼리 표면이 서로 다르다", () => {
    const families = new Map<string, string[]>();
    for (const key of [...Object.keys(enumSurfaces), ...Object.keys(runQuerySurfaces)]) {
      const family = variantFamily(key);
      families.set(family, [...(families.get(family) ?? []), key]);
    }
    // `fork:run` 이 곧 query=active 다(중복 항목을 만들지 않으려 RUN_QUERY_FIXTURES 에서 뺐다).
    // 비교에서는 active 대표로 끌어와 run.query 4종을 전부 대조한다.
    families.set("fork:run.query", [...(families.get("fork:run.query") ?? []), "fork:run"]);
    const identical: string[] = [];
    for (const [family, keys] of families) {
      expect(keys.length, `${family}: 변형이 1개뿐이라 분기를 증명하지 못한다`).toBeGreaterThan(1);
      for (let i = 0; i < keys.length; i += 1) {
        for (let j = i + 1; j < keys.length; j += 1) {
          const before = actual[keys[i]];
          const after = actual[keys[j]];
          if (diffFormSurface(family, before, after).length === 0) {
            identical.push(`${keys[i]} ≡ ${keys[j]}`);
          }
        }
      }
    }
    expect(
      identical,
      "열거값 변형이 같은 표면을 냈다 — 그 값 분기가 렌더에 반영되지 않는다. " +
        "픽스처에서 빼고 근거를 적거나 제품 결함으로 보고하라."
    ).toEqual([]);
  });

  /**
   * 축 전체에 완전히 같은 표면이 두 번 박히면 기준선만 커지고 보증은 늘지 않는다.
   * 실측으로 두 쌍을 잡았다 — `fork:run` ≡ `fork:run.query=active`(같은 조건),
   * `transfer:fade=black` ≡ `transfer:direction=retain`(둘 다 기본값 조합).
   * 둘 다 픽스처에서 제거했고, 이 계약이 재발을 막는다.
   */
  it("축에 완전히 같은 표면이 중복 등재되지 않는다", () => {
    const seen = new Map<string, string>();
    const dupes: string[] = [];
    for (const [key, surface] of Object.entries(actual)) {
      const digest = JSON.stringify(surface);
      const prev = seen.get(digest);
      if (prev) dupes.push(`${prev} ≡ ${key}`);
      else seen.set(digest, key);
    }
    expect(dupes, "같은 표면이 두 번 등재됐다 — 픽스처 하나를 빼거나 값을 갈라라").toEqual([]);
  });

  // ── E-5.5. 합성 변이 증명 ────────────────────────────────────────────────────
  //
  // src 는 읽기 전용이라 프로덕션 변이를 넣을 수 없다. 실제 표면을 깊은 복사해 변이를 주고
  // diffFormSurface 가 반드시 보고 줄을 내는지 확인한다. 이게 없으면 "게이트가 초록이다"와
  // "게이트가 아무것도 안 본다"를 구별할 수 없다.
  it("합성 변이를 diff 가 전부 잡는다", () => {
    const withSelect = Object.keys(actual).find((k) => Object.keys(actual[k].selectOptions).length > 0);
    const withTexts = Object.keys(actual).find((k) => Object.keys(actual[k].texts).length > 0);
    const withFlags = Object.keys(actual).find((k) =>
      Object.values(actual[k].controls).some((v) => v !== "{}" && /\{[a-z]/.test(v))
    );
    expect(
      [withSelect, withTexts, withFlags].map(Boolean),
      "변이 대상 표면을 축에서 찾지 못했다 — 축이 비었거나 수확이 죽었다"
    ).toEqual([true, true, true]);

    const mutations: { name: string; key: string; mutate: (s: FormSurface) => void }[] = [
      {
        // (a) 조건 종류 하나의 testid 제거
        name: "조건 종류의 testid 하나 제거",
        key: "fork:variable",
        mutate: (s) => {
          (s as { testids: string[] }).testids = s.testids.filter(
            (t) => t !== "event-condition-variable-op"
          );
        },
      },
      {
        // (b) select 선택지 절단
        name: "select 선택지 절단",
        key: withSelect!,
        mutate: (s) => {
          const key = Object.keys(s.selectOptions)[0];
          (s.selectOptions as Record<string, string[]>)[key] = s.selectOptions[key].slice(0, 1);
        },
      },
      {
        // (c) controls 값에서 상태 플래그 제거 (가시성 동기화 소실)
        name: "controls 값에서 상태 플래그 제거",
        key: withFlags!,
        mutate: (s) => {
          for (const [k, v] of Object.entries(s.controls)) {
            (s.controls as Record<string, string>)[k] = v.replace(/\{[^}]*\}/, "{}");
          }
        },
      },
      {
        // (d) texts 항목 삭제 (검증/힌트 문구 소실)
        name: "texts 항목 삭제",
        key: withTexts!,
        mutate: (s) => {
          delete (s.texts as Record<string, string>)[Object.keys(s.texts)[0]];
        },
      },
      {
        name: "조건 힌트 문구 교체",
        key: "fork:season",
        mutate: (s) => {
          (s.texts as Record<string, string>)["event-condition-hint"] = "다른 문구";
        },
      },
      {
        name: "조건 종류 select 를 통째로 제거",
        key: "fork:switch",
        mutate: (s) => {
          delete (s.controls as Record<string, string>)["event-condition-mode"];
          delete (s.selectOptions as Record<string, string[]>)["event-condition-mode"];
        },
      },
      {
        name: "클래스 하나 소실",
        key: "fork:all",
        mutate: (s) => {
          (s as { classes: string[] }).classes = s.classes.slice(1);
        },
      },
      {
        name: "라벨 하나 소실",
        key: "fork:timer",
        mutate: (s) => {
          (s as { labels: string[] }).labels = s.labels.slice(1);
        },
      },
      {
        name: "태그 교체(testid 유지)",
        key: "fork:item",
        mutate: (s) => {
          const id = Object.keys(s.tagByTestid)[0];
          (s.tagByTestid as Record<string, string>)[id] = "marquee";
        },
      },
      {
        name: "렌더 오류 발생",
        key: "fork:not",
        mutate: (s) => {
          (s as { error?: string }).error = "TypeError: boom";
        },
      },
    ];

    const undetected = mutations
      .filter(({ key, mutate }) => {
        const before = actual[key];
        expect(before, `변이 대상 항목이 축에 없다: ${key}`).toBeDefined();
        const after = clone(before);
        mutate(after);
        return diffFormSurface(key, before, after).length === 0;
      })
      .map((m) => m.name);
    expect(undetected, `diff 가 놓친 합성 변이 ${undetected.length}종`).toEqual([]);

    // 역방향 — 변이가 없으면 전부 조용해야 한다. 잡음을 내는 게이트는 갱신 습관을 만든다.
    const noisy = Object.keys(actual).filter((k) => diffFormSurface(k, actual[k], clone(actual[k])).length > 0);
    expect(noisy, "변이 없이도 diff 가 보고 줄을 냈다(비결정 수확 의심)").toEqual([]);
  });

  it("기준선과 일치한다", () => {
    assertSurfaceGate<FormSurface>({
      axis: "조건/열거값",
      baselinePath: BASELINE,
      floorPath: FLOOR,
      updateEnv: "CONDITION_SURFACE_UPDATE",
      actual,
      diff: diffFormSurface,
      metrics: formSurfaceMetrics,
    });
  });

  /**
   * 기각된 열거값 후보 — 렌더해 비교했더니 폼이 **전혀 갈리지 않았다**. 축에 넣으면 기준선만
   * 커지고 보증은 늘지 않으므로 제외한다. 여기서 "여전히 갈리지 않는다"를 계속 확인해,
   * 나중에 이 필드로 폼이 갈리게 바뀌면 축에 넣으라고 알려 준다.
   *
   *  timer.action(set/start/stop) : timerBody 는 action·timerId·seconds 세 컨트롤을 항상 그리고
   *                                action 값으로 아무것도 감추거나 바꾸지 않는다. 즉 "타이머 시작"을
   *                                골라도 「몇 초」 입력이 그대로 남는다 — 제품 결함 후보이지만
   *                                표면 축의 일은 아니다(보고서에 적었다).
   *  advanceTime(minutes/hours/days) : 세 입력을 항상 함께 그린다. 단위 개념 자체가 없다.
   */
  const REJECTED_ENUM_CANDIDATES: Record<string, readonly Command[]> = {
    "timer:action": [
      { kind: "timer", action: "set", seconds: 5, timerId: "timer1" },
      { kind: "timer", action: "start", timerId: "timer1" },
      { kind: "timer", action: "stop", timerId: "timer1" },
    ],
    "advanceTime:unit": [
      { kind: "advanceTime", minutes: 30 },
      { kind: "advanceTime", days: 2 },
    ],
  };

  it("기각한 열거값 후보는 여전히 폼이 갈리지 않는다", () => {
    const nowBranching: string[] = [];
    for (const [family, cmds] of Object.entries(REJECTED_ENUM_CANDIDATES)) {
      const surfaces = cmds.map((cmd) => captureCommandSurface(cmd));
      for (let i = 1; i < surfaces.length; i += 1) {
        const lines = diffFormSurface(family, surfaces[0], surfaces[i]);
        if (lines.length) nowBranching.push(`${family}[0] vs [${i}]: ${lines.join(" | ")}`);
      }
    }
    expect(
      nowBranching,
      "기각했던 후보가 이제 폼을 갈라 놓는다 — ENUM_VARIANT_FIXTURES 에 넣어 축을 늘려라."
    ).toEqual([]);
  });
});
