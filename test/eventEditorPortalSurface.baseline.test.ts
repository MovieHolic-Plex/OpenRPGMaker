// @vitest-environment happy-dom
// test/eventEditorPortalSurface.baseline.test.ts
//
// **포털(피커/모달) 표면 스냅샷 게이트.**
//
// 무보증이던 마지막 큰 사각 — `document.body` 로 렌더되는 피커·모달 — 을 축으로 만든다.
// 배경과 수확 절차는 test/eventEditorPortalSurface.ts 머리주석 참고.
//
// 기준선: test/fixtures/eventEditorPortalSurface.baseline.json
// 하한선: test/fixtures/eventEditorPortalSurface.floor.json
// 갱신: PORTAL_SURFACE_UPDATE=1 npx vitest run test/eventEditorPortalSurface.baseline.test.ts
//       (갱신 실행은 의도적으로 실패한다 — 갱신은 통과가 아니라 리뷰 요청이다)
//
// 이 파일이 스냅샷으로 덮을 수 없게 못 박는 계약:
//   · 모든 포털이 예외 없이 열린다(error 없음)
//   · 각 포털이 testid ≥ 1 · root ≥ 1 을 낸다 — 0 이면 "body 에 아무것도 안 붙였다" = 렌더 죽음
//   · SKIPPED 목록 크기 고정 — 조용한 절단이 "다 봤다"로 읽히는 걸 막는다
//   · 두 사각 CSS 시트의 클래스가 실제로 축에 잡힌다(교집합 > 0)
//   · 수확 순서를 뒤집어도 결과 동일(격리 증명)
//   · diff() 가 합성 변이 4종을 반드시 보고한다
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  captureAllPortalSurfaces,
  diffPortalSurface,
  harvestPortal,
  portalClassUnion,
  portalSurfaceMetrics,
  PORTAL_FAVORITE_COMMAND_IDS,
  PORTAL_KEYS,
  PORTAL_RECENT_COMMAND_IDS,
  SKIPPED_PORTALS,
  unresolvableQuickCommandIds,
  type PortalSurface,
} from "./eventEditorPortalSurface";
import { assertSurfaceGate } from "./surfaceGateSupport";

const BASELINE = resolve(process.cwd(), "test/fixtures/eventEditorPortalSurface.baseline.json");
const FLOOR = resolve(process.cwd(), "test/fixtures/eventEditorPortalSurface.floor.json");

// Independent of snapshot updates: exact control keys AND signatures, not counts.
// Source: d1d5e7e98dd0c6c5ef837db2a1456e280359be42, BASELINE above, before badge migration.
// Source file SHA256: 414e0a96afd614a544f6e76b6e5282717ea0829ec18a15bac857426fb3d53413.
// Hash UTF-8 JSON.stringify([controlKey, signature] pairs sorted lexically by key).
// df8e3734 removes 12 proven commands' obsolete badges, not their controls. Only
// badge testids/spans/labels and six testid floors migrate; other drift stays red.
// Do not regenerate these identities from the current catalog or DOM capture.
const PRE_FEATURE_PICKER_CONTROL_SHA256 = {
  commandPicker: "d7202e383d2c8ee5a92dece9d3778910cb49dda54e5dbf047f523b6af20c9bc2",
  commandPickerTab2: "a1b03238fc6d6ba727f40db05dfe3b40da8fd83655fc3746a95a825d816958a0",
  commandPickerTab3: "d0526f63dd0edb3e61650249314232e6a521be9913f7c1d44551395b6d8e6140",
  commandPickerTab4: "12e9f10bcba86a8f79db482fa54fcbdc94792ebed41764e245bacd5f2a94fc95",
  commandPickerSearch: "8ed69ecef4ef73962ab06aafa4c8a340684783e3fc833ba7f110d3170f8b1366",
  commandPickerSearchInformational: "1f94b355d4aa302c096fd5fd0c3f7d0d70abb5543bba8b752d0b20893ae5f5dc",
  commandPickerSearchEmpty: "9958c02a4288731e18cf62a97656f15b6f5bdc1a4da839ff508539b1851c587d",
  commandPickerFavorites: "df509e6cd8443f8ee61e7f401f6f03286e61655e842e7732649817594f3535af",
  commandPickerGrid: "d7202e383d2c8ee5a92dece9d3778910cb49dda54e5dbf047f523b6af20c9bc2",
} as const;

/** 이 축이 생기기 전까지 어떤 게이트도 렌더로 증명하지 못했던 두 시트(실측). */
const BLIND_SHEETS = [
  "src/styles/event/event-editor.part-3/06-event-command-picker-favorite.css",
  "src/styles/event/event-editor.p1-route.css",
] as const;

/** 테스트 환경 제약으로 뺀 포털 수. 늘어나면 실패한다(조용한 절단 금지). */
const EXPECTED_SKIP_COUNT = 6;

// 이중 방어: surfaceGateSupport 의 UPDATE_ENVS 에 PORTAL_SURFACE_UPDATE 가 등록되기 전이라도
// CI 가 기준선을 다시 쓰는 경로를 막는다(래칫이 사라지는 유일한 경로).
if (process.env.CI && process.env.PORTAL_SURFACE_UPDATE === "1") {
  throw new Error("CI 에서 PORTAL_SURFACE_UPDATE=1 은 금지다 — CI 는 기준선을 쓰지 않는다(래칫 무력화).");
}

function sheetClasses(relativePath: string): Set<string> {
  const css = readFileSync(resolve(process.cwd(), relativePath), "utf8");
  const out = new Set<string>();
  for (const match of css.matchAll(/\.(-?[_a-zA-Z][\w-]*)/gu)) {
    const token = match[1];
    if (token) out.add(token);
  }
  return out;
}

function intersect(sheet: Set<string>, union: readonly string[]): string[] {
  return union.filter((token) => sheet.has(token));
}

/** stableKey 래퍼 불변성 증명용 포레스트. wrap=true 면 컨트롤마다 의미 없는 div 를 하나 더 씌운다. */
function keyFixtureRoot(wrap: boolean): Element {
  const root = document.createElement("div");
  root.dataset.testid = "portal-key-fixture";
  const nest = (control: Element): Element => {
    if (!wrap) return control;
    const wrapper = document.createElement("div");
    wrapper.className = "extra-wrapper";
    wrapper.append(control);
    return wrapper;
  };
  const text = document.createElement("input");
  text.type = "text";
  const holder = document.createElement("div");
  holder.className = "holder";
  const check = document.createElement("input");
  check.type = "checkbox";
  check.checked = true;
  holder.append(nest(check));
  const select = document.createElement("select");
  const option = document.createElement("option");
  option.value = "a";
  select.append(option);
  const scoped = document.createElement("div");
  scoped.dataset.testid = "portal-key-fixture-inner";
  const inner = document.createElement("button");
  inner.type = "button";
  scoped.append(nest(inner));
  root.append(nest(text), holder, nest(select), scoped);
  return root;
}

function withoutFirstTestid(surface: PortalSurface): PortalSurface {
  const dropped = surface.testids[0] ?? "";
  return {
    ...surface,
    testids: surface.testids.filter((id) => id !== dropped),
    testidCount: surface.testidCount - 1,
  };
}

function withoutFirstClass(surface: PortalSurface): PortalSurface {
  const dropped = surface.classes[0] ?? "";
  return {
    ...surface,
    classes: surface.classes.filter((token) => token !== dropped),
    classCount: surface.classCount - 1,
  };
}

function withoutDisabledFlag(surface: PortalSurface): PortalSurface {
  const controls: Record<string, string> = {};
  for (const [key, value] of Object.entries(surface.controls)) {
    controls[key] = value.replace("disabled,", "").replace("{disabled}", "{}");
  }
  return { ...surface, controls };
}

function withTruncatedOptions(surface: PortalSurface): PortalSurface {
  const selectOptions: Record<string, string[]> = {};
  for (const [key, values] of Object.entries(surface.selectOptions)) {
    selectOptions[key] = values.slice(0, Math.max(0, values.length - 1));
  }
  return { ...surface, selectOptions };
}

describe("포털(피커/모달) 표면 스냅샷", () => {
  const actual = captureAllPortalSurfaces();
  const union = portalClassUnion(actual);

  it("모든 포털이 예외 없이 열린다", () => {
    const errors = Object.entries(actual)
      .filter(([, surface]) => surface.error)
      .map(([key, surface]) => `${key}: ${surface.error}`);
    expect(errors).toEqual([]);
  });

  it("항목 집합이 포털 정의와 일치한다", () => {
    expect(Object.keys(actual)).toEqual([...PORTAL_KEYS]);
  });

  // 하드 계약 — 스냅샷이 아니므로 PORTAL_SURFACE_UPDATE=1 로 덮을 수 없다.
  it("모든 포털이 body 에 실제로 무언가를 렌더한다 (testid ≥ 1, root ≥ 1)", () => {
    const dead = Object.entries(actual)
      .filter(([, surface]) => surface.testidCount === 0 || surface.rootCount === 0)
      .map(([key, surface]) => `${key}: testid ${surface.testidCount}종 / root ${surface.rootCount}개`);
    expect(dead, "포털이 body 에 아무것도 붙이지 않았다 = 렌더 죽음").toEqual([]);
  });

  it("preserves pre-feature picker control identities and signatures", () => {
    const digests = Object.fromEntries(
      Object.entries(actual)
        .filter(([key]) => key.startsWith("commandPicker"))
        .map(([key, surface]) => {
          const pairs = Object.entries(surface.controls).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0);
          return [key, createHash("sha256").update(JSON.stringify(pairs), "utf8").digest("hex")];
        })
    );
    expect(
      digests,
      "Picker controls changed from the pre-feature contract; badge removal must not remove or replace controls"
    ).toEqual(PRE_FEATURE_PICKER_CONTROL_SHA256);
  });

  it("의도적으로 제외한 포털 수가 고정 수치와 같다", () => {
    expect(
      SKIPPED_PORTALS.length,
      "포털을 축에서 빼거나 더했다 — EXPECTED_SKIP_COUNT 와 이유를 함께 고쳐 커밋하라"
    ).toBe(EXPECTED_SKIP_COUNT);
    const vague = SKIPPED_PORTALS.filter((entry) => entry.reason.trim().length < 20).map((entry) => entry.key);
    expect(vague, "제외 이유가 비었거나 너무 짧다").toEqual([]);
  });

  it("즐겨찾기·최근 상태에 쓰는 고정 commandId 가 픽커에 실재한다", () => {
    // 여기가 뚫리면 즐겨찾기 섹션이 조용히 0줄이 되고 favorite CSS 는 다시 무보증이 된다.
    expect(
      unresolvableQuickCommandIds(),
      "픽커가 해석하지 못하는 commandId — PORTAL_FAVORITE_COMMAND_IDS / PORTAL_RECENT_COMMAND_IDS 를 고쳐라"
    ).toEqual([]);
    expect(PORTAL_FAVORITE_COMMAND_IDS.length).toBeGreaterThan(0);
    expect(PORTAL_RECENT_COMMAND_IDS.length).toBeGreaterThan(0);
  });

  it("즐겨찾기 상태가 실제로 즐겨찾기 섹션을 렌더한다", () => {
    const favorites = actual.commandPickerFavorites;
    expect(favorites, "commandPickerFavorites 항목이 없다").toBeDefined();
    expect(favorites?.testids).toContain("event-command-picker-favorites");
    expect(favorites?.testids).toContain("event-command-picker-recents");
  });

  it("검색 상태가 검색 결과 표면을 렌더한다", () => {
    expect(actual.commandPickerSearch?.testids).toContain("event-command-picker-search-results");
    expect(actual.commandPickerSearch?.testids).toContain("event-command-picker-search-count");
    expect(actual.commandPickerSearchEmpty?.testids).toContain("event-command-picker-no-result");
  });

  it("검색 결과에만 나오는 정보 행(선택 불가) 표면이 축에 잡힌다", () => {
    // 탭 그리드에는 절대 안 나오는 UI다. 이 계약이 없으면 조용히 축 밖으로 빠진다.
    expect(actual.commandPickerSearchInformational?.classes).toContain("is-informational");
  });

  it("레코드 피커의 맵 스코프 섹션 헤딩이 축에 잡힌다", () => {
    // mapUsageOf(id) > 0 일 때만 렌더되는 UI — 캡처 이벤트가 첫 스위치를 참조해야 나온다.
    expect(actual.recordPickerSwitch?.classes).toContain("event-record-picker-section");
    expect(actual.recordPickerSwitch?.classes).toContain("event-record-picker-section-count");
  });

  // ── CSS 커버리지 증명 ────────────────────────────────────────────────────────
  it("이 축이 두 사각 CSS 시트의 클래스를 렌더로 증명한다", () => {
    const report = BLIND_SHEETS.map((path) => {
      const hit = intersect(sheetClasses(path), union);
      return { path, hit: hit.length };
    });
    for (const { path, hit } of report) {
      expect(hit, `${path} 의 클래스가 이 축에 하나도 안 잡힌다 — 필요한 상태를 못 만들었다`).toBeGreaterThan(0);
    }
    // 진단용(silent:true 라 실패 시에만 보인다).
    expect(report.every((entry) => entry.hit > 0)).toBe(true);
  });

  // ── 격리 증명 (이 축 특유의 위험) ────────────────────────────────────────────
  it(
    "수확 순서를 뒤집어도 결과가 같다 (document.body / localStorage 정리 누수 없음)",
    () => {
      const reversed = captureAllPortalSurfaces({ reverse: true });
      const drifted = Object.keys(actual)
        .map((key) => ({ key, lines: diffPortalSurface(key, actual[key] as PortalSurface, reversed[key] as PortalSurface) }))
        .filter((entry) => entry.lines.length > 0)
        .map((entry) => `${entry.key}: ${entry.lines.join(" | ")}`);
      expect(
        drifted,
        "수확 순서에 따라 표면이 달라진다 — 포털 정리가 새고 있고 기준선이 실행 순서에 의존한다"
      ).toEqual([]);
    },
    120_000
  );

  // ── stableKey 불변성 ────────────────────────────────────────────────────────
  it("래퍼 div 를 더 씌워도 컨트롤 stableKey 가 변하지 않는다", () => {
    const plain = harvestPortal([keyFixtureRoot(false)]);
    const wrapped = harvestPortal([keyFixtureRoot(true)]);
    expect(Object.keys(wrapped.controls)).toEqual(Object.keys(plain.controls));
    expect(wrapped.controls).toEqual(plain.controls);
    expect(Object.keys(plain.controls)).toEqual([
      "portal-key-fixture-inner>button#0",
      "portal-key-fixture>input#0",
      "portal-key-fixture>input#1",
      "portal-key-fixture>select#0",
    ]);
  });

  // ── 합성 변이 증명 ──────────────────────────────────────────────────────────
  // src/ 를 고칠 수 없으므로 수확 결과에 변이를 주어 diff 가 반드시 보고 줄을 내는지 확인한다.
  it("diff 가 합성 변이 4종을 모두 보고한다", () => {
    const base = actual.commandPicker as PortalSurface;
    const withOptions = Object.values(actual).find(
      (surface) => Object.keys(surface.selectOptions).some((key) => (surface.selectOptions[key] ?? []).length > 1)
    );
    expect(withOptions, "select 옵션을 가진 포털이 하나도 없다 — 옵션 변이를 증명할 수 없다").toBeDefined();
    const withDisabled = Object.values(actual).find((surface) =>
      Object.values(surface.controls).some((value) => value.includes("disabled"))
    );
    expect(withDisabled, "disabled 컨트롤을 가진 포털이 하나도 없다 — 플래그 변이를 증명할 수 없다").toBeDefined();

    const mutations: { readonly name: string; readonly lines: string[] }[] = [
      { name: "testid 제거", lines: diffPortalSurface("m", base, withoutFirstTestid(base)) },
      { name: "클래스 제거", lines: diffPortalSurface("m", base, withoutFirstClass(base)) },
      {
        name: "disabled 플래그 제거",
        lines: diffPortalSurface("m", withDisabled as PortalSurface, withoutDisabledFlag(withDisabled as PortalSurface)),
      },
      {
        name: "selectOptions 절단",
        lines: diffPortalSurface("m", withOptions as PortalSurface, withTruncatedOptions(withOptions as PortalSurface)),
      },
    ];
    const blind = mutations.filter((entry) => entry.lines.length === 0).map((entry) => entry.name);
    expect(blind, "diff 가 이 변이를 못 본다 — 게이트가 그만큼 뚫려 있다").toEqual([]);
    expect(mutations).toHaveLength(4);
  });

  it("변이가 없으면 diff 는 조용하다", () => {
    for (const [key, surface] of Object.entries(actual)) {
      expect(diffPortalSurface(key, surface, surface), `${key} 자기 자신과 달라진다`).toEqual([]);
    }
  });

  it("기준선과 일치한다", () => {
    assertSurfaceGate<PortalSurface>({
      axis: "포털(피커/모달)",
      baselinePath: BASELINE,
      floorPath: FLOOR,
      updateEnv: "PORTAL_SURFACE_UPDATE",
      actual,
      diff: diffPortalSurface,
      metrics: portalSurfaceMetrics,
    });
  });
});
