// @vitest-environment happy-dom
// test/eventEditorM2Surface.baseline.test.ts
//
// M2 카탈로그 commandId 축 폼 표면 스냅샷 + 별칭 하드 계약.
//
// ── 스냅샷 대상이 125 → 83 으로 줄었다(실측) ─────────────────────────────────────
//   카탈로그 125종 = existing 42 + generic 73 + none 10.
//   `bodyStrategy === "existing"` 인 42종은 `fields: []` 라, m2Command 로 렌더하면 42종 전부
//   동일한 껍데기가 나온다 — "카탈로그 조회 실패 폴백"과 표면이 구별되지 않는다.
//   즉 이전 기준선의 커버리지는 125 가 아니라 83 이었고, 42종은 같은 껍데기를 42번 박아
//   숫자만 부풀렸다. (과제 지시서의 38/87 은 추정치였고, 실측은 42/83 이다.)
//
//   커버리지 손실이 아닌 이유:
//     · `existing` 항목은 결국 `existingKind` 의 네이티브 폼으로 편집된다. 그 폼은 kind 축
//       (eventEditorFormSurface.baseline.test.ts)이 77종 전량 감시한다.
//     · 남는 위험은 "별칭이 없는 kind 를 가리키거나 대상 폼이 죽는 것"뿐이고, 그건 아래
//       하드 별칭 계약(test/fixtures/m2AliasCoverage.json)이 막는다. 스냅샷이 아니므로
//       M2_SURFACE_UPDATE=1 로 덮을 수 없다.
//
// 기준선: test/fixtures/eventEditorM2Surface.baseline.json
// 하한선: test/fixtures/eventEditorM2Surface.floor.json
// 갱신: M2_SURFACE_UPDATE=1 npx vitest run test/eventEditorM2Surface.baseline.test.ts
//       (갱신 실행은 의도적으로 실패한다 — 갱신은 통과가 아니라 리뷰 요청이다)
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { M2_COMMAND_CATALOG } from "@/project/eventCommands/m2Catalog";
import { createCaptureProject } from "./fixtures/captureProject";
import { COMMAND_KINDS, type CommandKind } from "@/project/commandKindRegistry";
import {
  captureFormSurface,
  diffFormSurface,
  formSurfaceMetrics,
  m2AliasEntries,
  m2CatalogSorted,
  partitionM2Surfaces,
  type FormSurface,
} from "./eventEditorFormSurface";
import { assertSurfaceGate } from "./surfaceGateSupport";

const BASELINE = resolve(process.cwd(), "test/fixtures/eventEditorM2Surface.baseline.json");
const FLOOR = resolve(process.cwd(), "test/fixtures/eventEditorM2Surface.floor.json");
const ALIAS_COVERAGE = resolve(process.cwd(), "test/fixtures/m2AliasCoverage.json");

type AliasCoverage = {
  readonly catalogCount: number;
  readonly aliasCount: number;
  readonly snapshotCount: number;
  readonly aliases: Record<string, string>;
  /** 스냅샷에서 빠지는 **빈 껍데기** 항목 id 전량. 렌더로 측정된 목록이다. */
  readonly shellAliasIds: readonly string[];
  /** `existing` 이면서도 전용 폼을 갖는 항목 id. 이들은 스냅샷에 반드시 들어와야 한다. */
  readonly aliasesWithOwnBody: readonly string[];
};

/**
 * `fields` 가 비었는데도 컨트롤을 내는 항목 — 제네릭 필드 렌더러가 아니라 손으로 쓴 전용 폼이다.
 * m2-086 은 "지울 이벤트" select 하나를 낸다(m2-erase-event-target). 나머지 4종은
 * `bodyStrategy === "existing"` 인데도 `renderPage3M2CommandBody` 가 `entry.title` 로 잡아
 * 전용 폼을 내는 항목이다(실측: 위 partitionM2Surfaces 주석).
 * 목록을 정확히 고정해, 새로 이런 항목이 생기거나 이 폼이 죽으면 실패시킨다.
 */
const HANDWRITTEN_FIELDLESS_BODIES: readonly string[] = [
  "m2-051-show-picture",
  "m2-053-erase-picture",
  "m2-067-key-input-processing",
  "m2-071-change-tile",
  "m2-086-erase-event",
];

function sorted(list: readonly string[]): string[] {
  return [...list].sort();
}

describe("M2 명령 폼 표면 스냅샷", () => {
  const { surfaces, snapshotIds, shellIds } = partitionM2Surfaces();
  const actual = Object.fromEntries(snapshotIds.map((id) => [id, surfaces[id]]));
  const byId = new Map(m2CatalogSorted().map((e) => [e.id, e]));
  const snapshotEntries = snapshotIds.map((id) => byId.get(id)!);
  const aliasEntries = m2AliasEntries();
  const coverage = JSON.parse(readFileSync(ALIAS_COVERAGE, "utf8")) as AliasCoverage;

  it("카탈로그 전량이 예외 없이 렌더된다", () => {
    // 껍데기로 판정된 항목도 렌더는 했다 — 크래시와 껍데기를 구별해야 하므로 전량을 본다.
    const errors = Object.entries(surfaces)
      .filter(([, s]) => s.error)
      .map(([id, s]) => `${id}: ${s.error}`);
    expect(errors).toEqual([]);
  });

  it("스냅샷 = 카탈로그 전량 − 빈 껍데기 별칭", () => {
    expect(sorted([...snapshotIds, ...shellIds])).toEqual(sorted(m2CatalogSorted().map((e) => e.id)));
    expect(snapshotIds.filter((id) => shellIds.includes(id)), "같은 id 가 양쪽에 있다").toEqual([]);
  });

  /**
   * 제외 목록을 정확히 못 박는다. 이것이 없으면 전용 폼이 죽었을 때(폴백으로 떨어짐) 그 항목이
   * **조용히 축에서 빠져** 기준선 diff 조차 나지 않는다 — 축이 좁아진 걸 아무도 모른다.
   * 실측: `bodyStrategy` 로 제외하던 시절 m2-067-key-input-processing 의 `.actor-m2-keycap*`
   * 7종이 CSS 실사용 정본에서 사라졌고, 표면 축은 전부 초록이었다.
   */
  it("빈 껍데기 제외 목록이 정본과 정확히 일치한다", () => {
    expect(
      sorted(shellIds),
      "스냅샷 제외 항목이 변했다 — 전용 폼이 죽어 폴백으로 떨어졌거나 새 폼이 생겼다. " +
        "의도한 변경이면 m2AliasCoverage.json 의 shellAliasIds 를 고쳐 커밋하라"
    ).toEqual(sorted(coverage.shellAliasIds));
  });

  it("existing 이면서 전용 폼을 갖는 항목은 반드시 스냅샷에 있다", () => {
    // 이들이 빠지면 전용 폼 4개가 무보증이 된다(실측된 누락의 회귀 테스트).
    const missing = coverage.aliasesWithOwnBody.filter((id) => !(id in actual));
    expect(missing, "전용 폼을 가진 별칭이 스냅샷에서 빠졌다").toEqual([]);
    // 반대 방향: 정본 목록이 실제와 어긋나면 실패한다.
    const measured = sorted(aliasEntries.filter((e) => !shellIds.includes(e.id)).map((e) => e.id));
    expect(measured, "전용 폼을 가진 별칭 목록이 변했다 — aliasesWithOwnBody 를 고쳐 커밋하라").toEqual(
      sorted(coverage.aliasesWithOwnBody)
    );
  });

  // ── A-6. 하드 별칭 계약 (스냅샷 아님 — 기준선 갱신으로 못 덮는다) ──────────────
  it("카탈로그 규모가 고정 수치와 일치한다", () => {
    expect(
      {
        catalogCount: M2_COMMAND_CATALOG.length,
        aliasCount: aliasEntries.length,
        snapshotCount: snapshotEntries.length,
      },
      "M2 카탈로그 규모가 변했다 — test/fixtures/m2AliasCoverage.json 의 수치를 고쳐 커밋하라"
    ).toEqual({
      catalogCount: coverage.catalogCount,
      aliasCount: coverage.aliasCount,
      snapshotCount: coverage.snapshotCount,
    });
    // 카탈로그 = 스냅샷 + 껍데기. 별칭 42종 중 4종은 스냅샷에 있으므로 aliasCount 로는 안 나뉜다.
    expect(coverage.catalogCount).toBe(coverage.snapshotCount + coverage.shellAliasIds.length);
    expect(coverage.aliasCount).toBe(coverage.shellAliasIds.length + coverage.aliasesWithOwnBody.length);
  });

  it("별칭 → kind 대응이 정본과 정확히 일치한다", () => {
    const map = Object.fromEntries(aliasEntries.map((e) => [e.id, String(e.existingKind)]));
    expect(
      map,
      "별칭이 가리키는 kind 가 바뀌었다 — 의도한 변경이면 m2AliasCoverage.json 을 고쳐 커밋하라"
    ).toEqual(coverage.aliases);
  });

  it("모든 별칭의 existingKind 가 COMMAND_KINDS 에 실재한다", () => {
    const missing = aliasEntries
      .filter((e) => !(COMMAND_KINDS as readonly string[]).includes(String(e.existingKind)))
      .map((e) => `${e.id} → ${String(e.existingKind)}`);
    expect(missing, "카탈로그에 없는 kind 를 가리키는 별칭").toEqual([]);
  });

  it("모든 별칭 대상 kind 가 실제로 렌더되는 폼을 갖는다", () => {
    // 별칭이 스냅샷에서 빠지는 대가로, 대상 폼이 살아 있다는 사실은 여기서 보증해야 한다.
    const broken = aliasEntries
      .map((e) => ({ id: e.id, kind: String(e.existingKind), surface: captureFormSurface(e.existingKind as CommandKind) }))
      .filter(({ surface }) => surface.error || surface.testidCount === 0)
      .map(({ id, kind, surface }) => `${id} → ${kind}: ${surface.error ?? `testid ${surface.testidCount}종`}`);
    expect(broken, "별칭 대상 kind 의 폼이 죽었다").toEqual([]);
  });

  // ── A-6. control 0 ⟺ fields 0 양방향 불변식 ───────────────────────────────────
  //
  // 이 불변식이 M2 폼이 조용히 죽는 걸 잡는다. 스냅샷은 "표면이 기준선과 같은가"만 보므로,
  // 필드가 있는 항목의 폼이 통째로 폴백으로 떨어져도 기준선을 갱신해 버리면 초록이 된다.
  it("필드가 있는 M2 항목은 반드시 컨트롤을 낸다 (control 0 ⟹ fields 0)", () => {
    const dead = snapshotEntries
      .filter((e) => actual[e.id].controlCount === 0 && e.fields.length > 0)
      .map((e) => `${e.id}: 필드 ${e.fields.length}개인데 컨트롤 0개 (${e.bodyStrategy})`);
    expect(dead, "M2 폼이 죽어 폴백으로 떨어졌다").toEqual([]);
  });

  it("필드가 없는데 컨트롤을 내는 항목은 손수 작성 폼 목록과 정확히 같다 (fields 0 ⟹ control 0)", () => {
    const fieldless = snapshotEntries.filter((e) => e.fields.length === 0).map((e) => e.id);
    const exceptions = sorted(fieldless.filter((id) => actual[id].controlCount > 0));
    expect(
      exceptions,
      "필드 없는 항목이 컨트롤을 낸다 — 전용 폼이 새로 생겼거나 기존 전용 폼이 죽었다. " +
        "HANDWRITTEN_FIELDLESS_BODIES 를 고쳐 커밋하라"
    ).toEqual(sorted(HANDWRITTEN_FIELDLESS_BODIES));
    // 목록에 적힌 항목은 반드시 스냅샷 축에 존재해야 한다(오타로 조용히 무력화되는 걸 막는다).
    const unknown = HANDWRITTEN_FIELDLESS_BODIES.filter((id) => !(id in actual));
    expect(unknown, "손수 작성 폼 목록에 스냅샷 축에 없는 id 가 있다").toEqual([]);
  });

  it.each(["m2-063-memorize-current-bgm", "m2-064-play-memorized-bgm"])("%s exposes no dead inputs and remains in the surface axis", (id) => {
    expect(snapshotIds).toContain(id);
    expect(byId.get(id)?.fields).toEqual([]);
    expect(actual[id].controls).toEqual({});
    expect(actual[id].selectOptions).toEqual({});
  });

  it.each([
    ["m2-027-change-system-bgm", ["music"], ["battle", "field"]],
    ["m2-028-change-system-se", ["sound"], ["defeat", "escape"]],
    ["m2-210-sound-layer", ["music", "sound"], ["ambient", "bgm", "bgs", "me", "se"]],
  ] as const)("%s keeps exact audio membership and supported channel/slot values", (id, kinds, destinations) => {
    const project = createCaptureProject();
    const allowed = new Set<string>(kinds);
    const expected = new Set(project.resourceProfiles.filter(profile => allowed.has(profile.kind)).map(profile => profile.assetId));
    for (const resource of Object.values(project.assets.uploaded)) if (allowed.has(resource.kind)) expected.add(resource.id);
    expect(actual[id].selectOptions["m2-command-resourceId-picker"].slice().sort()).toEqual(["", ...expected].sort());
    const field = id === "m2-210-sound-layer" ? "channel" : "slot";
    expect(actual[id].selectOptions[`m2-command-${field}-option-select`].slice().sort()).toEqual([...destinations].sort());
    if (field === "slot") expect(actual[id].controls).not.toHaveProperty("m2-command-volume-input");
    else {
      expect(actual[id].controls).toHaveProperty("m2-command-volume-input");
      expect(actual[id].controls).toHaveProperty("m2-command-fadeMs-input");
    }
  });

  it("기준선과 일치한다", () => {
    assertSurfaceGate<FormSurface>({
      axis: "M2(commandId)",
      baselinePath: BASELINE,
      floorPath: FLOOR,
      updateEnv: "M2_SURFACE_UPDATE",
      actual,
      diff: diffFormSurface,
      metrics: formSurfaceMetrics,
    });
  });
});
