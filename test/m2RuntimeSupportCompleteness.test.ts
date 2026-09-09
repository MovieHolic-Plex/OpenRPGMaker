import { describe, expect, it } from "vitest";
import { M2_COMMAND_CATALOG, m2CommandById } from "@/project/eventCommands/m2Catalog";
import {
  M2_PERSISTED_BEHAVIOR_IDS,
  M2_PARTIAL_EFFECT_DECLARATIONS,
  M2RuntimeClassificationError,
  catalogRowRuntimeSupport,
  m2CommandRuntimeClassification,
  m2CommandRuntimeSupport,
  runtimeSupportBadge,
} from "@/project/eventCommands/runtimeSupport";
import { M2_MAP_COMMON_FULL_IDS, M2_TROOP_FULL_IDS } from "@/project/eventCommands/m2RuntimeClassificationData";
import { createBlankProject } from "@/project/defaults";
import { projectLint } from "@/project/lint/projectLint";

describe("M2 persisted runtime classification completeness", () => {
  it("covers every catalog ID exactly once", () => {
    // Given: the independent editor catalog and the persisted-behavior classes.
    const catalogIds = M2_COMMAND_CATALOG.map((entry) => entry.id);
    const classifiedIds = Object.values(M2_PERSISTED_BEHAVIOR_IDS).flat();

    // When: membership is counted across the four mutually exclusive classes.
    const membershipCounts = countMemberships(classifiedIds);

    // Then: the union is exactly the 125 catalog IDs, with no duplicate membership.
    expect(new Set(classifiedIds)).toEqual(new Set(catalogIds));
    expect(classifiedIds).toHaveLength(125);
    expect([...membershipCounts].filter(([, count]) => count > 1)).toEqual([]);
  });

  it("names synthetic duplicate and unclassified IDs", () => {
    // Given: a deliberately corrupt miniature classification table.
    const expectedIds = ["m2-synthetic-full", "m2-synthetic-missing"];
    const classifiedIds = ["m2-synthetic-full", "m2-synthetic-full"];

    // When: completeness errors are derived.
    const errors = classificationErrors(expectedIds, classifiedIds);

    // Then: both exact IDs are reported.
    expect(errors).toEqual([
      "duplicate M2 runtime classification: m2-synthetic-full",
      "unclassified M2 command: m2-synthetic-missing",
    ]);
  });

  it("returns an explicit error for an invented persisted ID", () => {
    // Given: an ID that is absent from every explicit behavior class.
    const commandId = "m2-999-invented";

    // When/Then: it never inherits partial support from a fallback.
    expect(() => m2CommandRuntimeClassification(commandId)).toThrowError(
      new M2RuntimeClassificationError(commandId)
    );
    expect(() => m2CommandRuntimeSupport(commandId)).toThrowError(commandId);
  });

  it("publishes map, common, and troop support for every persisted ID", () => {
    // Given: every catalog ID.
    for (const entry of M2_COMMAND_CATALOG) {
      // When: its persisted classification is resolved.
      const classification = m2CommandRuntimeClassification(entry.id);

      // Then: each authoring context has an explicit public support grade.
      expect(classification.commandId).toBe(entry.id);
      expect(classification.supportByContext).toEqual({
        map: m2CommandRuntimeSupport(entry.id, "map"),
        common: m2CommandRuntimeSupport(entry.id, "common"),
        troop: m2CommandRuntimeSupport(entry.id, "troop"),
      });
    }
  });

  it("declares supported and unsupported effects for every partial ID", () => {
    // Given: the explicit partial class and independently grouped effect declarations.
    const declaredIds = M2_PARTIAL_EFFECT_DECLARATIONS.flatMap((declaration) => declaration.ids);

    // When: partial effect declarations are resolved through the public classification.
    const effectCoverage = M2_PERSISTED_BEHAVIOR_IDS.partial.map(
      (commandId) => m2CommandRuntimeClassification(commandId).effectCoverage
    );

    // Then: declarations are one-to-one and every partial ID names both sides of its effect boundary.
    expect(new Set(declaredIds)).toEqual(new Set(M2_PERSISTED_BEHAVIOR_IDS.partial));
    expect(declaredIds).toHaveLength(M2_PERSISTED_BEHAVIOR_IDS.partial.length);
    expect(effectCoverage.every((coverage) => coverage.supportedEffects.length > 0)).toBe(true);
    expect(effectCoverage.every((coverage) => coverage.unsupportedEffects.length > 0)).toBe(true);
  });

  it("keeps editor-only rows visibly limited in every context", () => {
    // Given: every explicitly editor-only persisted ID.
    for (const commandId of M2_PERSISTED_BEHAVIOR_IDS.editorOnly) {
      // When: its classification and badge are resolved.
      const classification = m2CommandRuntimeClassification(commandId);
      const badge = runtimeSupportBadge(classification.supportByContext.map);

      // Then: no authoring context claims runtime execution and the badge remains visible.
      expect(classification.supportByContext).toEqual({
        map: "editor-only",
        common: "editor-only",
        troop: "editor-only",
      });
      expect(badge).toMatchObject({ support: "editor-only" });
    }
  });

  it("lints every persisted editor-only ID by its exact command ID", () => {
    // Given: one map event containing every editor-only persisted command.
    const project = createBlankProject();
    const map = project.maps[project.startMapId];
    if (!map) throw new Error("Blank project start map is missing");
    map.events.push({
      id: "event_editor_only_m2_contract",
      x: 2,
      y: 2,
      trigger: { kind: "action" },
      commands: M2_PERSISTED_BEHAVIOR_IDS.editorOnly.map((commandId) => ({
        kind: "m2Command",
        commandId,
        fields: {},
      })),
    });

    // When: project lint evaluates runtime support.
    const issueCodes = projectLint(project).map((issue) => issue.code);

    // Then: every editor-only ID has a visible, command-specific warning.
    expect(issueCodes).toEqual(
      expect.arrayContaining(
        M2_PERSISTED_BEHAVIOR_IDS.editorOnly.map((commandId) => `runtime-support:${commandId}`)
      )
    );
  });

  it("lints a persisted native alias by the default map context", () => {
    // Given: a persisted Show Text M2 payload rather than the picker's native text command.
    const project = createBlankProject();
    const map = project.maps[project.startMapId];
    if (!map) throw new Error("Blank project start map is missing");
    map.events.push({
      id: "event_persisted_m2_alias",
      x: 3,
      y: 3,
      trigger: { kind: "action" },
      commands: [{ kind: "m2Command", commandId: "m2-001-show-text", fields: {} }],
    });

    // When: project lint uses the persisted-command support API without a supplied context.
    const supportIssues = projectLint(project).filter(
      (issue) => issue.code === "runtime-support:m2-001-show-text"
    );

    // Then: the alias cannot inherit runtime-full from picker conversion.
    expect(supportIssues).toHaveLength(1);
    expect(supportIssues[0]).toMatchObject({ severity: "warning", mapId: map.id, x: 3, y: 3 });
  });

  // --- 배지 정직성 회귀(2026-08-20): catalogRowRuntimeSupport 가 컨텍스트를 반영한다 ---

  it("demotes full-class commands outside M2_MAP_COMMON_FULL_IDS to runtime-partial in the map context", () => {
    // Twelve player-verified commands now join the map/common full set.
    const demotedIds = M2_PERSISTED_BEHAVIOR_IDS.full.filter(
      (commandId) => !M2_MAP_COMMON_FULL_IDS.some((fullId) => fullId === commandId)
    );
    expect(demotedIds).toHaveLength(54);

    for (const commandId of demotedIds) {
      // When: 피커/리스트가 카탈로그 행을 map 컨텍스트로 판정한다.
      // Then: runtime-full 이 아니라 runtime-partial 이다 (기존 버그: 컨텍스트 무시 → full).
      expect(catalogRowRuntimeSupport(commandId, undefined, "map"), commandId).toBe("runtime-partial");
      expect(catalogRowRuntimeSupport(commandId, undefined, "common"), commandId).toBe("runtime-partial");
      // 컨텍스트를 모르는 호출부는 보수 판정(최저 지원)이어야 한다.
      expect(catalogRowRuntimeSupport(commandId, undefined), commandId).toBe("runtime-partial");
    }

    expect(M2_MAP_COMMON_FULL_IDS).toHaveLength(31);
    for (const commandId of M2_MAP_COMMON_FULL_IDS) {
      expect(catalogRowRuntimeSupport(commandId, undefined, "map"), commandId).toBe("runtime-full");
    }
  });

  it("keeps troop-context judgments for battle-only commands", () => {
    for (const commandId of M2_TROOP_FULL_IDS) {
      // Then: 배틀 전용 커맨드는 troop 컨텍스트에서 full 판정을 유지하고,
      // map 컨텍스트에서는 partial 로 정직하게 표시된다.
      expect(catalogRowRuntimeSupport(commandId, undefined, "troop"), commandId).toBe("runtime-full");
      expect(catalogRowRuntimeSupport(commandId, undefined, "map"), commandId).toBe("runtime-partial");
    }
    // Picker-native text is sequential in troop; its persisted M2 alias is still partial.
    const nativeAliasEntry = m2CommandById("m2-001-show-text");
    if (!nativeAliasEntry?.existingKind) throw new Error("Missing Show Text native alias entry");
    expect(catalogRowRuntimeSupport(nativeAliasEntry.id, nativeAliasEntry.existingKind, "troop")).toBe("runtime-full");
    expect(catalogRowRuntimeSupport(nativeAliasEntry.id, nativeAliasEntry.existingKind, "map")).toBe("runtime-full");
    expect(m2CommandRuntimeSupport(nativeAliasEntry.id, "troop")).toBe("runtime-partial");
  });

  it("lints a map event containing a map-partial full-class m2 command", () => {
    // Given: behaviorClass full 이지만 M2_MAP_COMMON_FULL_IDS 밖인 대표 커맨드가 든 맵 이벤트.
    const commandId = "m2-068-change-tileset";
    expect(M2_PERSISTED_BEHAVIOR_IDS.full).toContain(commandId);
    expect((M2_MAP_COMMON_FULL_IDS as readonly string[]).includes(commandId)).toBe(false);

    const project = createBlankProject();
    const map = project.maps[project.startMapId];
    if (!map) throw new Error("Blank project start map is missing");
    map.events.push({
      id: "event_map_partial_m2_contract",
      x: 4,
      y: 4,
      trigger: { kind: "action" },
      commands: [{ kind: "m2Command", commandId, fields: {} }],
    });

    // When: project lint 가 map 컨텍스트로 런타임 지원을 판정한다.
    const supportIssues = projectLint(project).filter((issue) => issue.code === `runtime-support:${commandId}`);

    // Then: 부분지원 경고가 정확히 한 건, error 가 아닌 warning 으로 나타난다.
    expect(supportIssues).toHaveLength(1);
    expect(supportIssues[0]).toMatchObject({ severity: "warning", mapId: map.id, x: 4, y: 4 });
  });

  it("does not warn for a map/common-full m2 command in a map event", () => {
    // Given: M2_MAP_COMMON_FULL_IDS 멤버(맵 런타임 완전 지원) 커맨드가 든 맵 이벤트.
    const commandId = "m2-046-tint-screen" as const;
    const project = createBlankProject();
    const map = project.maps[project.startMapId];
    if (!map) throw new Error("Blank project start map is missing");
    map.events.push({
      id: "event_map_full_m2_contract",
      x: 5,
      y: 5,
      trigger: { kind: "action" },
      commands: [{ kind: "m2Command", commandId, fields: {} }],
    });

    // When/Then: map 컨텍스트 full 이므로 경고가 없다 (보수 판정을 lint 에 쓰면 여기서 오탐이 난다).
    const supportIssues = projectLint(project).filter((issue) => issue.code === `runtime-support:${commandId}`);
    expect(supportIssues).toHaveLength(0);
  });
});

function countMemberships(ids: readonly string[]): ReadonlyMap<string, number> {
  const counts = new Map<string, number>();
  for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1);
  return counts;
}

function classificationErrors(expectedIds: readonly string[], classifiedIds: readonly string[]): readonly string[] {
  const counts = countMemberships(classifiedIds);
  const duplicateErrors = [...counts]
    .filter(([, count]) => count > 1)
    .map(([id]) => `duplicate M2 runtime classification: ${id}`);
  const missingErrors = expectedIds
    .filter((id) => !counts.has(id))
    .map((id) => `unclassified M2 command: ${id}`);
  return [...duplicateErrors, ...missingErrors];
}
