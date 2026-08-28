import { describe, expect, it } from "vitest";
import {
  normalizeScenario,
  renderSummary,
  shotFileName,
  shouldCaptureShot,
} from "../scripts/lib/runtimeQa.mjs";
import type { RuntimeQaOp, RuntimeQaReport } from "../scripts/lib/runtimeQa.d.mts";

const minimal = { id: "smoke", beats: [{ id: "start" }] };

describe("normalizeScenario", () => {
  it("생략된 값에 기본값을 채운다", () => {
    const normalized = normalizeScenario(minimal);

    expect(normalized.seed).toBe(1);
    expect(normalized.viewport).toEqual({ width: 1024, height: 768 });
    // 기본 픽스처는 캐릭셋 텍스처가 실제로 로드되는 것이어야 한다.
    // oprn-sample-v3 는 같은 resourceId 로도 __MISSING 이 나와(실측) 시각 검증을 오염시킨다.
    expect(normalized.projectFixture).toBe("test/fixtures/projects/editor-authored-demo-v3.json");
    expect(normalized.beats[0].shot).toBe(false);
  });

  it("명시한 값은 보존한다", () => {
    const normalized = normalizeScenario({
      ...minimal,
      seed: 42,
      viewport: { width: 640, height: 480 },
      projectFixture: "custom.json",
      beats: [{ id: "start", shot: true }],
    });

    expect(normalized.seed).toBe(42);
    expect(normalized.viewport).toEqual({ width: 640, height: 480 });
    expect(normalized.projectFixture).toBe("custom.json");
    expect(normalized.beats[0].shot).toBe(true);
  });

  it("비트가 없으면 거부한다", () => {
    expect(() => normalizeScenario({ id: "empty", beats: [] })).toThrow(/비트가 하나도 없다/);
  });

  it("비트 ID 가 중복되면 거부한다 — 샷 파일이 덮어써진다", () => {
    expect(() =>
      normalizeScenario({ id: "dup", beats: [{ id: "a" }, { id: "a" }] }),
    ).toThrow(/중복된 비트 ID: a/);
  });

  it("비트 ID 가 kebab-case 가 아니면 거부한다 — 파일명에 쓰인다", () => {
    expect(() => normalizeScenario({ id: "bad", beats: [{ id: "Start Beat" }] })).toThrow(
      /비트 ID 는 kebab-case: Start Beat/,
    );
  });

  it("조건 대기 op 을 받아들인다 — 고정 sleep 은 flaky 의 근원이다", () => {
    const normalized = normalizeScenario({
      id: "waits",
      beats: [
        {
          id: "a",
          ops: [
            { kind: "waitFor", testid: "dialogue-box", state: "absent" },
            { kind: "pressUntil", key: "Enter", testid: "dialogue-box", state: "absent" },
          ],
        },
      ],
    });

    expect(normalized.beats[0].ops).toHaveLength(2);
  });

  it("모르는 op 종류는 거부한다 — 조용히 무시하면 게이트가 거짓말한다", () => {
    // 타입에 없는 op 을 일부러 넣는다. 시나리오는 런타임에 .mjs 로도 작성되므로
    // 타입 검사만으로는 막히지 않는다 — 정규화 단계의 런타임 거부가 필요하다.
    const rogue = { kind: "levitate" } as unknown as RuntimeQaOp;

    expect(() => normalizeScenario({ id: "x", beats: [{ id: "a", ops: [rogue] }] })).toThrow(
      /알 수 없는 op: levitate/,
    );
  });
});

describe("shouldCaptureShot", () => {
  it("옵트인한 비트는 샷을 남긴다", () => {
    expect(shouldCaptureShot({ shot: true }, [])).toBe(true);
  });

  it("옵트인 안 한 통과 비트는 샷을 남기지 않는다", () => {
    expect(shouldCaptureShot({ shot: false }, [])).toBe(false);
  });

  it("실패한 비트는 옵트인 안 했어도 샷을 남긴다 — 비전이 볼 것이 없으면 안 된다", () => {
    expect(shouldCaptureShot({ shot: false }, ["testid 잔존: dialogue-box"])).toBe(true);
  });
});

describe("shotFileName", () => {
  it("1-based 2자리 접두사를 붙인다", () => {
    expect(shotFileName(0, "title")).toBe("01-title.png");
    expect(shotFileName(11, "after-battle")).toBe("12-after-battle.png");
  });
});

describe("renderSummary", () => {
  const state = { currentMapId: "map_town", x: 0, y: 1, gold: 0 };
  const report: RuntimeQaReport = {
    scenarioId: "smoke",
    projectPath: "test/fixtures/projects/oprn-sample-v3.json",
    seed: 1,
    viewport: { width: 1024, height: 768 },
    errors: [],
    beats: [
      { index: 0, id: "title", note: "타이틀 진입", shot: "01-title.png", failures: [], state: null },
      { index: 1, id: "walk", note: "우로 이동", shot: null, failures: [], state },
      {
        index: 2,
        id: "shop",
        note: "상점 창",
        shot: "03-shop.png",
        failures: ["testid 누락: shop-window"],
        state,
      },
    ],
  };

  it("먼저 텍스트를 읽으라는 규칙을 맨 위에 박는다", () => {
    expect(renderSummary(report)).toMatch(/이 파일을 먼저 읽어라/);
  });

  it("게이트 실패를 헤드라인에 낸다", () => {
    const summary = renderSummary(report);

    expect(summary).toMatch(/게이트: 실패/);
    expect(summary).toMatch(/열어야 할 샷: 1개/);
  });

  it("실패한 비트의 샷만 즉시 확인 대상으로 표시한다", () => {
    const summary = renderSummary(report);

    expect(summary).toMatch(/03-shop\.png.*게이트 실패 — 즉시 확인/);
    expect(summary).toMatch(/01-title\.png.*시각 확인 대기/);
  });

  it("샷이 없는 비트는 볼 이유를 비운다", () => {
    expect(renderSummary(report)).toMatch(/\| walk \|[^\n]*\| — \| — \|/);
  });

  it("전부 통과하면 게이트 통과로 낸다", () => {
    const summary = renderSummary({
      ...report,
      beats: [
        { index: 0, id: "title", note: "타이틀", shot: "01-title.png", failures: [], state: null },
      ],
    });

    expect(summary).toMatch(/게이트: 통과/);
    expect(summary).toMatch(/열어야 할 샷: 0개/);
  });

  it("런타임 에러는 별도로 드러낸다", () => {
    const summary = renderSummary({ ...report, errors: ["TypeError: x is not a function"] });

    expect(summary).toMatch(/런타임 에러 1건/);
    expect(summary).toMatch(/TypeError: x is not a function/);
  });
});
