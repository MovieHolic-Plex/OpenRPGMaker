// @vitest-environment happy-dom
// test/eventEditorFormSurface.baseline.test.ts
//
// 77 kind 전량 폼 표면 스냅샷 게이트 + 게이트 자체의 단위 테스트.
// 기준선: test/fixtures/eventEditorFormSurface.baseline.json (git 추적)
// 하한선: test/fixtures/eventEditorFormSurface.floor.json (git 추적, 별도 커밋으로만 갱신)
// 갱신: FORM_SURFACE_UPDATE=1 npx vitest run test/eventEditorFormSurface.baseline.test.ts
//       (갱신 실행은 assertSurfaceGate 가 의도적으로 빨갛게 만든다 — 갱신은 통과가 아니라 리뷰 요청이다)
import { describe, expect, it } from "vitest";
import { resolve } from "node:path";
import { COMMAND_KINDS, type CommandKind } from "@/project/commandKindRegistry";
import { MINIMAL_COMMANDS } from "./fixtures/minimalCommands";
import {
  captureAllFormSurfaces,
  diffFormSurface,
  formSurfaceMetrics,
  harvestSurface,
  renderCommandSurfaceRoot,
  type FormSurface,
} from "./eventEditorFormSurface";
import { assertSurfaceGate } from "./surfaceGateSupport";

const BASELINE = resolve(process.cwd(), "test/fixtures/eventEditorFormSurface.baseline.json");
const FLOOR = resolve(process.cwd(), "test/fixtures/eventEditorFormSurface.floor.json");

/**
 * 편집할 게 원래 없는 kind — 컨트롤 0개가 정상이다.
 * 전부 `commandBody.ts` 의 terminalFallbackBody / 전용 안내 문구로 렌더된다.
 */
const NO_FIELD_KINDS: readonly CommandKind[] = [
  "breakLoop",
  "gameOver",
  "openSaveMenu",
  "returnToTitle",
  "sleepUntilMorning",
  "stopAudio",
];

/**
 * 알려진 제품 결함 래칫 — 편집할 필드가 분명히 있는데 컨트롤이 0개다.
 *
 *  despawnFieldEnemy  : spawnId 를 편집할 수단이 없다.
 *
 * spawnFieldEnemy and changeLifeSkillExp now expose validated recovery fields.
 * 게이트가 영구히 빨갛지 않도록 명시적 래칫으로 격리한다 — 대신 "고쳐지면 실패"시켜서
 * 고친 사실이 반드시 커밋에 남게 한다(래칫이 조용히 녹지 않게 하는 유일한 방법이다).
 */
const ZERO_CONTROL_DEFECT_RATCHET: readonly CommandKind[] = [
  "despawnFieldEnemy",
];

function sorted(list: readonly string[]): string[] {
  return [...list].sort();
}

function clone(surface: FormSurface): FormSurface {
  return JSON.parse(JSON.stringify(surface)) as FormSurface;
}

describe("이벤트에디터 폼 표면 스냅샷", () => {
  const actual = captureAllFormSurfaces();

  it("모든 kind 가 예외 없이 렌더된다", () => {
    const errors = Object.entries(actual)
      .filter(([, s]) => s.error)
      .map(([k, s]) => `${k}: ${s.error}`);
    expect(errors).toEqual([]);
  });

  it("kind 집합이 COMMAND_KINDS 와 일치한다", () => {
    expect(Object.keys(actual).sort()).toEqual([...COMMAND_KINDS].sort());
  });

  // ── A-7. 컨트롤 0 kind 분리 ────────────────────────────────────────────────────
  it("컨트롤 0 kind 집합은 무필드 화이트리스트 + 결함 래칫과 정확히 같다", () => {
    const zero = sorted(Object.entries(actual).filter(([, s]) => s.controlCount === 0).map(([k]) => k));
    const allowed = sorted([...NO_FIELD_KINDS, ...ZERO_CONTROL_DEFECT_RATCHET]);
    // 새로 0 이 된 kind = 폼이 죽었다. 목록에서 빠진 kind = 고쳐졌다(래칫에서 빼라).
    expect(
      zero,
      "컨트롤 0 kind 가 바뀌었다. 새로 생긴 항목은 폼이 죽은 것이니 고쳐라. " +
        "결함 래칫에 있던 kind 가 목록에서 빠졌다면 고쳐진 것이니 ZERO_CONTROL_DEFECT_RATCHET 에서 제거하라."
    ).toEqual(allowed);
  });

  it("무필드 화이트리스트와 결함 래칫은 겹치지 않는다", () => {
    const overlap = NO_FIELD_KINDS.filter((k) => (ZERO_CONTROL_DEFECT_RATCHET as readonly string[]).includes(k));
    expect(overlap).toEqual([]);
  });

  // ── A-3. stableKey 래퍼 삽입 불변성 ────────────────────────────────────────────
  //
  // 왜 이 테스트가 안전망의 핵심인가: 이전 stableKey 는 조상 testid + tag 경로였고, 리팩터가
  // 레이아웃용 div 를 하나 감싸면 24개 selectOptions 키가 전부 바뀌어 거짓 빨강이 났다.
  // 안전망이 잡음을 내면 사람은 무조건 FORM_SURFACE_UPDATE=1 로 갱신하고, 그 diff 안에 있던
  // 진짜 컨트롤 소실까지 같이 승인된다. 그래서 "잡음을 안 낸다"는 성질도 테스트로 못 박는다.
  it("컨트롤을 div 로 한 겹 더 감싸도 stableKey 집합이 불변이다", () => {
    // ordinal 형태 키(`testid>tag#n`)를 실제로 갖는 kind 들. 자기 testid 가 있는 컨트롤만
    // 있는 폼으로는 아무것도 증명되지 않는다.
    const kinds: CommandKind[] = ["setVariable", "transfer", "shop", "setEventGraphicPattern", "showPicture"];
    for (const kind of kinds) {
      const plain = harvestSurface(renderCommandSurfaceRoot(MINIMAL_COMMANDS[kind]));

      const root = renderCommandSurfaceRoot(MINIMAL_COMMANDS[kind]);
      const controls = Array.from(root.querySelectorAll("input, select, textarea, button"));
      expect(controls.length, `${kind}: 컨트롤이 없어 불변성을 증명할 수 없다`).toBeGreaterThan(0);
      for (const node of controls) {
        const parent = node.parentElement;
        if (!parent) continue;
        // 리팩터가 흔히 넣는 "의미 없는 레이아웃 div" 를 컨트롤과 부모 사이에 끼운다.
        const wrapper = root.ownerDocument.createElement("div");
        parent.insertBefore(wrapper, node);
        wrapper.appendChild(node);
      }
      const wrapped = harvestSurface(root);

      expect(Object.keys(wrapped.controls), `${kind}: 래퍼 삽입으로 controls 키가 바뀌었다`).toEqual(
        Object.keys(plain.controls)
      );
      expect(Object.keys(wrapped.selectOptions), `${kind}: 래퍼 삽입으로 selectOptions 키가 바뀌었다`).toEqual(
        Object.keys(plain.selectOptions)
      );
      // 값도 그대로여야 한다 — 키만 같고 값이 흔들리면 결국 같은 잡음이다.
      expect(wrapped.controls, `${kind}: 래퍼 삽입으로 controls 값이 바뀌었다`).toEqual(plain.controls);
      expect(wrapped.selectOptions).toEqual(plain.selectOptions);
      // 반대로 태그 히스토그램은 늘어야 한다 — 변형이 실제로 적용됐다는 증거.
      expect(wrapped.tags.div ?? 0, `${kind}: 래퍼가 실제로 삽입되지 않았다`).toBeGreaterThan(plain.tags.div ?? 0);
    }
  });

  // ── A-10.5. 게이트 자체의 단위 테스트 ─────────────────────────────────────────
  //
  // src 는 읽기 전용이라 프로덕션 변이를 넣을 수 없다. 대신 실제 표면을 깊은 복사해 변이를 주고
  // diff() 가 반드시 보고 줄을 내는지 확인한다. 이게 없으면 "게이트가 초록이다"와
  // "게이트가 아무것도 안 본다"를 구별할 수 없다(이전 판이 정확히 그 상태였다).
  it("합성 변이를 diff 가 전부 잡는다", () => {
    const withDetails = Object.entries(actual).find(([, s]) =>
      Object.values(s.tagByTestid).includes("details")
    );
    const withHidden = Object.entries(actual).find(([, s]) =>
      Object.values(s.controls).some((v) => v.includes("hidden"))
    );
    const withTexts = Object.entries(actual).find(([, s]) => Object.keys(s.texts).length > 0);
    const withSelect = Object.entries(actual).find(([, s]) => Object.keys(s.selectOptions).length > 0);
    const withLabels = Object.entries(actual).find(([, s]) => s.labels.length > 0);
    expect(
      [withDetails, withHidden, withTexts, withSelect, withLabels].map(Boolean),
      "변이 대상 표면을 축 전체에서 찾지 못했다 — 축이 비었거나 수확이 죽었다"
    ).toEqual([true, true, true, true, true]);

    const mutations: { name: string; kind: string; mutate: (s: FormSurface) => void }[] = [
      {
        name: "testid 하나 제거",
        kind: withSelect![0],
        mutate: (s) => {
          const id = s.testids[0];
          (s as { testids: string[] }).testids = s.testids.filter((t) => t !== id);
        },
      },
      {
        name: "details → div 태그 교체(testid 유지)",
        kind: withDetails![0],
        mutate: (s) => {
          for (const [id, tag] of Object.entries(s.tagByTestid)) {
            if (tag === "details") (s.tagByTestid as Record<string, string>)[id] = "div";
          }
        },
      },
      {
        name: "controls 값에서 hidden 플래그 제거(가시성 동기화 소실)",
        kind: withHidden![0],
        mutate: (s) => {
          for (const [key, value] of Object.entries(s.controls)) {
            if (value.includes("hidden")) {
              (s.controls as Record<string, string>)[key] = value
                .replace(/hidden,/, "")
                .replace(/,hidden/, "")
                .replace(/\{hidden\}/, "{}");
            }
          }
        },
      },
      {
        name: "texts 항목 하나 삭제(검증 문구 소실)",
        kind: withTexts![0],
        mutate: (s) => {
          delete (s.texts as Record<string, string>)[Object.keys(s.texts)[0]];
        },
      },
      {
        name: "컨트롤 키 하나를 다른 이름으로 교체(개수는 그대로)",
        kind: withSelect![0],
        mutate: (s) => {
          const keys = Object.keys(s.controls);
          const value = s.controls[keys[0]];
          delete (s.controls as Record<string, string>)[keys[0]];
          (s.controls as Record<string, string>)[`${keys[0]}-renamed`] = value;
        },
      },
      {
        name: "select 선택지 절반 유실",
        kind: withSelect![0],
        mutate: (s) => {
          const key = Object.keys(s.selectOptions)[0];
          (s.selectOptions as Record<string, string[]>)[key] = s.selectOptions[key].slice(0, 1);
        },
      },
      {
        name: "라벨 하나 소실",
        kind: withLabels![0],
        mutate: (s) => {
          (s as { labels: string[] }).labels = s.labels.slice(1);
        },
      },
      {
        name: "클래스 하나 소실",
        kind: withSelect![0],
        mutate: (s) => {
          (s as { classes: string[] }).classes = s.classes.slice(1);
        },
      },
      {
        name: "태그 히스토그램 변경",
        kind: withDetails![0],
        mutate: (s) => {
          (s.tags as Record<string, number>).details = 0;
        },
      },
      {
        name: "렌더 오류 발생",
        kind: withSelect![0],
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
        return diffFormSurface(kind, before, after).length === 0;
      })
      .map((m) => m.name);
    expect(undetected, `diff 가 놓친 합성 변이 ${undetected.length}종`).toEqual([]);

    // 변이가 없으면 반드시 조용해야 한다 — 잡음을 내는 게이트는 갱신 습관을 만든다.
    const noisy = Object.keys(actual).filter((k) => diffFormSurface(k, actual[k], clone(actual[k])).length > 0);
    expect(noisy, "변이 없이도 diff 가 보고 줄을 냈다(비결정 수확 의심)").toEqual([]);
  });

  it("기준선과 일치한다", () => {
    assertSurfaceGate<FormSurface>({
      axis: "폼(kind)",
      baselinePath: BASELINE,
      floorPath: FLOOR,
      updateEnv: "FORM_SURFACE_UPDATE",
      actual,
      diff: diffFormSurface,
      metrics: formSurfaceMetrics,
    });
  });
});
