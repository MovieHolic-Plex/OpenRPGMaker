import { describe, expect, it } from "vitest";
import { cssMixBlendMode, normalizeBlendMode, phaserBlendMode } from "@/project/blendMode";
import { PICTURE_BLEND_OPTIONS } from "@/project/eventCommands/easingOptions";
import { compileCutscene } from "@/editor/cutscene";
import { letterboxPercentFromValue, nextSpriteLook, normalizeSpriteLook, spriteLookKey } from "@/project/eventCommands/cinematicStaging";
import { planScreenEffect } from "@/player/interpreter/screenEffectPlan";
import { SCREEN_EFFECT_OPTIONS } from "@/project/eventCommands/m2ModernCatalog";
import { m2CommandById, M2_COMMAND_CATALOG } from "@/project/eventCommands/m2Catalog";
import { runTool } from "@/editor/tools";
import { createBlankProject } from "@/project/defaults/blankProject";
import type { Command, EventPage } from "@/project/types";
import { M2_PERSISTED_BEHAVIOR_IDS, M2_PARTIAL_EFFECT_DECLARATIONS, M2RuntimeClassificationError, catalogRowRuntimeSupport, m2CommandRuntimeClassification, m2CommandRuntimeSupport, runtimeSupportBadge } from "@/project/eventCommands/runtimeSupport";
import { M2_MAP_COMMON_FULL_IDS, M2_TROOP_FULL_IDS } from "@/project/eventCommands/m2RuntimeClassificationData";
import { projectLint } from "@/project/lint/projectLint";
import { interpolateScreenDistortion, isNeutralScreenDistortion, NEUTRAL_SCREEN_DISTORTION, nextScreenDistortion, normalizeScreenDistortion, SCREEN_DISTORTION_DEFAULTS } from "@/project/eventCommands/screenDistortion";
import { checkSmallTaskScope } from "@/ai/smallTaskScope";
import { FORK_ELSE_BRANCH_INDEX, FORK_THEN_BRANCH_INDEX, LOOP_BODY_BRANCH_INDEX } from "@/editor/eventCommandPaths";
import { runToolAsync } from "@/editor/tools/asyncToolRunner";
import { getTool } from "@/editor/tools/toolRegistry";
import type { ToolContext } from "@/editor/tools/types";
import { deleteEventCommand, eventCommandHash, insertEventCommand, updateEventCommand } from "@/project/eventCommands/singleCommandOps";
import { isolateTimers } from "./mergedTeardown";

describe("blendMode", () => {
  isolateTimers();
  describe("겹치기 이름", () => {
    it("보통·모르는 값은 저장하지 않는다(옛 JSON 바이트 유지)", () => {
      expect(normalizeBlendMode("normal")).toBeUndefined();
      expect(normalizeBlendMode("overlay")).toBeUndefined();
      expect(normalizeBlendMode(undefined)).toBeUndefined();
      expect(normalizeBlendMode("add")).toBe("add");
    });

    it("Phaser·CSS 값으로 옮긴다", () => {
      expect([undefined, "normal", "add", "multiply", "screen"].map((name) => phaserBlendMode(name as never))).toEqual([0, 0, 1, 2, 3]);
      expect(cssMixBlendMode("add")).toBe("plus-lighter");
      expect(cssMixBlendMode("multiply")).toBe("multiply");
      expect(cssMixBlendMode(undefined)).toBe("normal");
    });

    it("그림 이동의 기본 선택지는 「그대로」 — 이동이 빛기둥을 보통으로 되돌리지 않는다", () => {
      expect(PICTURE_BLEND_OPTIONS[0]?.value).toBe("keep");
    });
  });
  describe("컷신 picture 비트의 겹치기", () => {
    it("show 는 showPicture.blendMode 로, 정리 단계는 마지막 겹치기를 다시 건다", () => {
      const commands = compileCutscene([
        { kind: "picture", action: "show", pictureId: "beam", resourceId: "img", blendMode: "add" },
        { kind: "picture", action: "move", pictureId: "beam", x: 40, durationMs: 300 },
        { kind: "say", speaker: "A", text: "빛이다" },
      ]);
      const shows = commands.filter((command) => command.kind === "showPicture");
      expect(shows[0]).toMatchObject({ pictureId: "beam", blendMode: "add" });
      // 이동은 겹치기를 생략했으므로 정리 단계의 재표시도 add 를 잇는다.
      expect(shows[shows.length - 1]).toMatchObject({ pictureId: "beam", blendMode: "add", durationMs: 0 });
    });

    it("normal 은 명령에 싣지 않는다", () => {
      const commands = compileCutscene([{ kind: "picture", action: "show", pictureId: "p", resourceId: "img", blendMode: "normal" }]);
      const show = commands.find((command) => command.kind === "showPicture");
      expect(show && "blendMode" in show).toBe(false);
    });
  });
});

describe("fieldStaging", () => {
  isolateTimers();
  type M2 = Extract<Command, { kind: "m2Command" }>;
  const m2Of = (commands: readonly Command[], commandId: string): M2[] =>
    commands.filter((command): command is M2 => command.kind === "m2Command" && command.commandId === commandId);
  describe("모습 효과 모델", () => {
    it("준 칸만 바꾸고 나머지는 앞 모습을 잇는다", () => {
      const red = nextSpriteLook(undefined, { tint: "red", pose: "keep", flip: "keep" });
      expect(red).toEqual({ tint: "#ff6060" });
      const fallen = nextSpriteLook(red, { pose: "fallen", flip: "on" });
      expect(fallen).toEqual({ tint: "#ff6060", pose: "fallen", flip: true });
      expect(nextSpriteLook(fallen, { reset: true })).toEqual({});
      expect(nextSpriteLook(fallen, { reset: true, tint: "blue" })).toEqual({ tint: "#6080ff" });
    });

    it("직접 색이 선택지보다 앞서고, 흰색 곱하기는 효과가 아니다", () => {
      expect(nextSpriteLook(undefined, { tint: "red", tintHex: "#00FF88" })).toEqual({ tint: "#00ff88" });
      expect(normalizeSpriteLook({ tint: "#ffffff" })).toEqual({});
      expect(normalizeSpriteLook({ tint: "white", tintFill: true })).toEqual({ tint: "#ffffff", tintFill: true });
    });

    it("불투명도는 % 로 받아 0~1 로 저장하고, 1 이면 지운다", () => {
      expect(nextSpriteLook(undefined, { opacity: "60" })).toEqual({ alpha: 0.6 });
      expect(nextSpriteLook({ alpha: 0.6 }, { opacity: "100" })).toEqual({});
    });

    it("저장 키는 주인공 하나, 이벤트는 맵마다 따로", () => {
      expect(spriteLookKey({ kind: "player" })).toBe("player");
      expect(spriteLookKey({ kind: "event", mapId: "m1", eventId: "ev" })).toBe("m1/ev");
    });
  });
  describe("레터박스", () => {
    it("빈 값은 기본 두께, 범위 밖은 자른다, 걷기는 0", () => {
      expect(letterboxPercentFromValue("")).toBe(12);
      expect(letterboxPercentFromValue("40")).toBe(25);
      expect(planScreenEffect("letterbox", "8", 300)).toEqual({ kind: "letterbox", percent: 8, durationMs: 300 });
      expect(planScreenEffect("clearLetterbox", "", 300)).toEqual({ kind: "letterbox", percent: 0, durationMs: 300 });
    });

    it("화면 효과 선택지 전부에 렌더 경로가 있다 — 조용한 실패 없음", () => {
      // 문 열기·닫기(#3375)는 값에 문 칸(x,y,너비,높이,방식,방향)이 있어야 렌더 경로가 생긴다 — 빈 값은 unsupported 로 기록된다.
      const doorValue = "2,3,2,2,slide,left";
      for (const option of SCREEN_EFFECT_OPTIONS) {
        const value = option.value === "doorOpen" || option.value === "doorClose" ? doorValue : "";
        expect(planScreenEffect(option.value, value, 300).kind, option.value).not.toBe("unsupported");
      }
    });
  });
  describe("새 명령 카탈로그", () => {
    it("파티클·모습 효과가 카탈로그에 있고 흔들기에 방향 칸이 있다", () => {
      expect(m2CommandById("m2-224-particle-effect")?.title).toBe("Particle Effect");
      expect(m2CommandById("m2-225-sprite-look")?.title).toBe("Sprite Look");
      expect(m2CommandById("m2-048-shake-screen")?.fields.some((field) => field.key === "direction")).toBe(true);
    });
  });
  describe("컷신 연출 비트", () => {
    it("letterbox 는 정리 단계가 자동으로 걷고, keep 이면 남긴다", () => {
      const auto = compileCutscene([{ kind: "letterbox" }, { kind: "say", speaker: "A", text: "…" }]);
      const effects = m2Of(auto, "m2-202-screen-effect").map((command) => command.fields.effect);
      expect(effects).toEqual(["letterbox", "clearLetterbox"]);
      const kept = compileCutscene([{ kind: "letterbox", size: 10, keep: true }]);
      expect(m2Of(kept, "m2-202-screen-effect").map((command) => command.fields.effect)).toEqual(["letterbox", "letterbox"]);
    });

    it("look 은 대상·포즈·색을 명령 필드로 옮기고 #rrggbb 는 직접 색 칸으로 보낸다", () => {
      const commands = compileCutscene([
        { kind: "look", target: "ev_guard", pose: "fallen", tint: "#123456" },
        { kind: "look", target: "player", afterimage: true, alpha: 0.5 },
      ]);
      const looks = m2Of(commands, "m2-225-sprite-look");
      expect(looks[0]?.fields).toMatchObject({ target: "event", eventId: "ev_guard", pose: "fallen", tintHex: "#123456" });
      expect(looks[1]?.fields).toMatchObject({ target: "player", afterimage: "on", opacity: "50" });
      // 정리 단계가 같은 명령을 순서대로 다시 건다(건너뛰어도 끝 모습이 같다).
      expect(looks).toHaveLength(4);
    });

    it("particles 는 x,y 만 주면 칸 대상, emote·weather·shake axis 는 해당 명령으로", () => {
      const commands = compileCutscene([
        { kind: "particles", preset: "explosion", x: 4, y: 5 },
        { kind: "emote", target: "player", emote: "exclamation" },
        { kind: "weather", weather: "rain", intensity: 0.7 },
        { kind: "shake", intensity: 6, axis: "vertical" },
      ]);
      expect(m2Of(commands, "m2-224-particle-effect")[0]?.fields).toMatchObject({ preset: "explosion", target: "tile", x: 4, y: 5 });
      expect(commands).toContainEqual(expect.objectContaining({ kind: "showEmote", target: "player", emote: "exclamation" }));
      expect(commands).toContainEqual(expect.objectContaining({ kind: "setWeather", weather: "rain", intensity: 0.7 }));
      expect(m2Of(commands, "m2-048-shake-screen")[0]?.fields).toMatchObject({ direction: "vertical", intensity: "6" });
    });

    it("틀린 어휘는 조용히 기본값이 되지 않고 거부된다", () => {
      expect(() => compileCutscene([{ kind: "particles", preset: "confetti" as never }])).toThrow(/파티클 종류/);
      expect(() => compileCutscene([{ kind: "look", pose: "dance" as never }])).toThrow(/자세/);
    });

    it("script_cutscene 이 새 비트를 명령 형식 오류 없이 저장한다", () => {
      const ctx = { project: createBlankProject() };
      const result = runTool(ctx, "script_cutscene", {
        mapId: ctx.project.startMapId, x: 3, y: 3, trigger: "auto", once: true,
        beats: [
          { kind: "letterbox", size: 12 },
          { kind: "emote", target: "player", emote: "exclamation", wait: true },
          { kind: "parallel", beats: [
            { kind: "particles", preset: "explosion", x: 5, y: 5 },
            { kind: "shake", intensity: 6, axis: "both" },
            { kind: "flash", color: "white" },
          ] },
          { kind: "look", target: "player", pose: "fallen", tint: "gray" },
          { kind: "say", speaker: "나", text: "…" },
          { kind: "look", target: "player", reset: true },
        ],
      });
      expect(result.ok, JSON.stringify(result.issues)).toBe(true);
    });

    it("kind 를 빠뜨린 비트는 칸으로 종류를 짐작해 채우고 경고한다", () => {
      const ctx = { project: createBlankProject() };
      const result = runTool(ctx, "script_cutscene", {
        mapId: ctx.project.startMapId, x: 3, y: 3,
        beats: [
          { speaker: "레아", text: "스승님!" },
          { target: "player", moves: [{ kind: "turn", dir: "up" }] },
          { look: "player", pose: "fallen" },
          { preset: "sparkle", target: "player" },
        ],
      });
      expect(result.ok, JSON.stringify(result.issues)).toBe(true);
      // 쓰기 도구의 경고는 실행기가 diff.warnings 로 옮긴다(toolRunner).
      expect(JSON.stringify(result.diff?.warnings ?? result.warnings)).toContain("kind 가 빠진 비트 4개");
    });

    it("연출 지침 도구가 등록돼 있다", () => {
      const result = runTool({ project: createBlankProject() }, "read_directing_guide", {});
      expect(result.ok).toBe(true);
      expect(JSON.stringify(result)).toContain("letterbox");
    });
  });
});

describe("m2RuntimeSupportCompleteness", () => {
  isolateTimers();
  describe("M2 persisted runtime classification completeness", () => {
    it("covers every catalog ID exactly once", () => {
      // Given: the independent editor catalog and the persisted-behavior classes.
      const catalogIds = M2_COMMAND_CATALOG.map((entry) => entry.id);
      const classifiedIds = Object.values(M2_PERSISTED_BEHAVIOR_IDS).flat();

      // When: membership is counted across the four mutually exclusive classes.
      const membershipCounts = countMemberships(classifiedIds);

      // Then: the union is exactly the 126 catalog IDs, with no duplicate membership.
      expect(new Set(classifiedIds)).toEqual(new Set(catalogIds));
      // 135: + m2-226 Lift Ride (#3509), m2-227 Journal Line (#3546).
      expect(classifiedIds).toHaveLength(135);
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
      // Player-verified commands join the map/common full set (2026-09-27: m2-069 먼 배경 변경 — 그림 교체·흐름 배율).
      const demotedIds = M2_PERSISTED_BEHAVIOR_IDS.full.filter(
        (commandId) => !M2_MAP_COMMON_FULL_IDS.some((fullId) => fullId === commandId)
      );
      // 54: m2-218 move-enemy(전투 전용) 가 들어와 55 가 됐고, m2-069(먼 배경) 승격으로 다시 54(2026-09-27).
      // 53: 화면 효과(m2-202) 승격(2026-10-02). 파티클·모습 효과(m2-224·225)는 처음부터 map/common full.
      expect(demotedIds).toHaveLength(53);

      for (const commandId of demotedIds) {
        // When: 피커/리스트가 카탈로그 행을 map 컨텍스트로 판정한다.
        // Then: runtime-full 이 아니라 runtime-partial 이다 (기존 버그: 컨텍스트 무시 → full).
        expect(catalogRowRuntimeSupport(commandId, undefined, "map"), commandId).toBe("runtime-partial");
        expect(catalogRowRuntimeSupport(commandId, undefined, "common"), commandId).toBe("runtime-partial");
        // 컨텍스트를 모르는 호출부는 보수 판정(최저 지원)이어야 한다.
        expect(catalogRowRuntimeSupport(commandId, undefined), commandId).toBe("runtime-partial");
      }

      // 31 + m2-069(맵 배경 흐름) + 명작 공백 미니게임 키트·순간이동 메뉴(m2-219~223).
      // + 화면 효과 m2-202 + 파티클·모습 효과 m2-224·225 (2026-10-02).
      // + Lift Ride m2-226 (#3509), Journal Line m2-227 (#3546).
      expect(M2_MAP_COMMON_FULL_IDS).toHaveLength(42);
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
});

describe("screenDistortion", () => {
  isolateTimers();
  describe("화면 왜곡 모델", () => {
    it("빈 값은 기본 세기, 숫자는 그 세기, 0 은 그 축만 끈다", () => {
      expect(nextScreenDistortion(undefined, "wave", "")).toEqual({ ...NEUTRAL_SCREEN_DISTORTION, wave: SCREEN_DISTORTION_DEFAULTS.wave });
      const both = nextScreenDistortion(nextScreenDistortion(undefined, "wave", "6"), "mosaic", "8");
      expect(both).toEqual({ wave: 6, mosaic: 8, rotate: 0 });
      expect(nextScreenDistortion(both, "wave", "0")).toEqual({ wave: 0, mosaic: 8, rotate: 0 });
      expect(nextScreenDistortion(both, "clearDistortion", "")).toEqual(NEUTRAL_SCREEN_DISTORTION);
    });

    it("범위 밖 값은 클램프하고 숫자가 아니면 0", () => {
      expect(normalizeScreenDistortion({ wave: 99, mosaic: -3, rotate: "400" })).toEqual({ wave: 16, mosaic: 0, rotate: 180 });
      expect(normalizeScreenDistortion({ wave: "abc" })).toEqual(NEUTRAL_SCREEN_DISTORTION);
    });

    it("모자이크 1 이하는 꺼짐으로 본다", () => {
      expect(isNeutralScreenDistortion({ wave: 0, mosaic: 1, rotate: 0 })).toBe(true);
      expect(isNeutralScreenDistortion({ wave: 0, mosaic: 2, rotate: 0 })).toBe(false);
      expect(isNeutralScreenDistortion(undefined)).toBe(true);
    });

    it("전환은 끝점을 정확히 지나고 중간은 반쯤이다", () => {
      const from = NEUTRAL_SCREEN_DISTORTION;
      const to = { wave: 8, mosaic: 16, rotate: -10 };
      expect(interpolateScreenDistortion(from, to, 0)).toEqual(from);
      expect(interpolateScreenDistortion(from, to, 1)).toEqual(to);
      expect(interpolateScreenDistortion(from, to, 0.5).wave).toBeCloseTo(4, 10);
    });
  });
  describe("화면 효과 명령 → 왜곡", () => {
    it("새 옵션 넷은 전부 렌더 경로(distortion)가 있다 — 조용한 실패 없음", () => {
      for (const effect of ["wave", "mosaic", "rotate", "clearDistortion"]) {
        expect(SCREEN_EFFECT_OPTIONS.some((option) => option.value === effect)).toBe(true);
        expect(planScreenEffect(effect, "", 300).kind).toBe("distortion");
      }
    });
  });
  describe("컷신 distort 비트", () => {
    it("화면 효과 명령으로 컴파일되고, 정리 단계가 마지막 상태를 다시 건다", () => {
      const commands = compileCutscene([
        { kind: "distort", effect: "wave", amount: 5, durationMs: 400 },
        { kind: "say", speaker: "A", text: "물속이다" },
      ]);
      const effects = commands.filter((command) => command.kind === "m2Command" && command.fields.effect === "wave");
      expect(effects.length).toBeGreaterThanOrEqual(2);
      expect(effects[0]).toMatchObject({ fields: { effect: "wave", value: "5", durationMs: 400 } });
      expect(effects[effects.length - 1]).toMatchObject({ fields: { effect: "wave", value: "5", durationMs: 0 } });
    });
  });
});

describe("singleEventCommandOps", () => {
  isolateTimers();
  const text: Command = { kind: "text", body: "문을 열까?", speaker: "문지기" };
  const wait: Command = { kind: "wait", ms: 100 };
  function page(...commands: Command[]): EventPage {
    return { id: "page1", name: "입구", conditions: [], trigger: { kind: "action" }, priority: "below", graphic: {}, movement: { type: "fixed", speed: 3, frequency: 3 }, commands };
  }
  describe("이벤트 명령 한 줄", () => {
    it("처음과 끝에서 끼워 넣고 수정하고 지운다. 원본 페이지와 입력은 보존한다", () => {
      const original = page(wait);
      const first = insertEventCommand(original, 0, text);
      const last = insertEventCommand(first, 2, text);
      const updated = updateEventCommand(last, 2, { body: "문을 열자." }, eventCommandHash(text));
      expect(updated.commands).toEqual([text, wait, { ...text, body: "문을 열자." }]);
      expect(deleteEventCommand(updated, 0, eventCommandHash(text))).toEqual(page(wait, { ...text, body: "문을 열자." }));
      expect(deleteEventCommand(updated, 2, eventCommandHash(updated.commands[2]!))).toEqual(first);
      expect(insertEventCommand(page(), 0, text).commands).toEqual([text]);
      expect(deleteEventCommand(page(text), 0, eventCommandHash(text)).commands).toEqual([]);
      expect(original.commands).toEqual([wait]);
      expect(first.commands[0]).not.toBe(text);
    });

    it("줄이 바뀌면 이전 해시를 거절하고 키 순서만 다른 해시는 받는다", () => {
      const original = page(text);
      const reordered = { speaker: "문지기", body: "문을 열까?", kind: "text" } as const;
      expect(eventCommandHash(reordered)).toBe(eventCommandHash(text));
      const changed = updateEventCommand(original, 0, { body: "수정" }, eventCommandHash(reordered));
      for (const operation of [
        () => updateEventCommand(changed, 0, { speaker: "상인" }, eventCommandHash(text)),
        () => deleteEventCommand(changed, 0, eventCommandHash(text)),
      ]) expect(operation).toThrow("내용이 바뀌었습니다");
      expect(() => insertEventCommand(original, -1, wait)).toThrow();
      expect(() => insertEventCommand(original, 2, wait)).toThrow();
      expect(() => deleteEventCommand(original, 1, eventCommandHash(text))).toThrow();
      expect(() => updateEventCommand(original, 0, { kind: "wait" }, eventCommandHash(text))).toThrow("명령 종류");
    });

    it("조건·반복·선택지 안의 한 줄을 수정하면서 분기 구조를 보존한다", () => {
      const choices: Command = { kind: "choices", options: [{ text: "첫 선택", branch: [text] }], cancelBranch: [wait] };
      const fork: Command = { kind: "fork", condition: { kind: "selfSwitch", key: "A", value: true }, then: [
        { kind: "loop", body: [choices, { kind: "breakLoop" }] },
      ], else: [wait] };
      const original = page(fork);
      const nested = [0, FORK_THEN_BRANCH_INDEX, 0, LOOP_BODY_BRANCH_INDEX, 0, 0];
      const edited = insertEventCommand(original, [...nested, 1], wait);
      const updated = updateEventCommand(edited, [...nested, 0], { body: "분기 안의 대사" }, eventCommandHash(text));
      const deleted = deleteEventCommand(updated, [...nested, 1], eventCommandHash(wait));
      expect(deleted.commands).toEqual([{ ...fork, then: [{ kind: "loop", body: [
        { ...choices, options: [{ text: "첫 선택", branch: [{ ...text, body: "분기 안의 대사" }] }] }, { kind: "breakLoop" },
      ] }] }]);
      expect(original.commands).toEqual([fork]);
      expect(updateEventCommand(page(choices), 0, { optionLabels: ["새 문구"] }, eventCommandHash(choices)).commands).toEqual([
        { ...choices, options: [{ text: "새 문구", branch: [text] }] },
      ]);
      expect(() => deleteEventCommand(original, 0, eventCommandHash(fork))).toThrow("분기 안에 명령");
      expect(() => deleteEventCommand(page(choices), 0, eventCommandHash(choices))).toThrow("분기 안에 명령");
      expect(() => updateEventCommand(original, 0, { then: [] }, eventCommandHash(fork))).toThrow("분기 안의 명령");
      expect(() => updateEventCommand(page(choices), 0, { options: [] }, eventCommandHash(choices))).toThrow("분기 안의 명령");
      expect(() => insertEventCommand(original, [0, 99, 0], text)).toThrow();
      expect(() => insertEventCommand(original, [0, FORK_THEN_BRANCH_INDEX], text)).toThrow();
      expect(() => insertEventCommand(original, 1, { kind: "breakLoop" })).toThrow("반복 안에만");
      expect(() => insertEventCommand(original, 1, { kind: "text" } as Command)).toThrow("문구가 필요");
    });

    it("없는 조건 분기는 삽입할 때 만들고 수정과 삭제는 거절한다", () => {
      const fork: Command = { kind: "fork", condition: { kind: "selfSwitch", key: "A", value: true }, then: [wait] };
      const original = page(fork);
      const path = [0, FORK_ELSE_BRANCH_INDEX, 0];
      expect(() => updateEventCommand(original, path, { body: "분기 안의 대사" }, eventCommandHash(text))).toThrow("명령 줄을 찾을 수 없습니다.");
      expect(() => deleteEventCommand(original, path, eventCommandHash(text))).toThrow("명령 줄을 찾을 수 없습니다.");
      expect(insertEventCommand(original, path, text).commands).toEqual([{ ...fork, else: [text] }]);
      expect(original.commands[0]).not.toHaveProperty("else");
    });

    it("등록된 쓰기 도구와 get_event 해시로 실제 도구 실행 경계를 왕복한다", async () => {
      const project = createBlankProject();
      const mapId = project.startMapId;
      const map = project.maps[mapId]!;
      project.tilesets = { [map.tilesetId]: project.tilesets[map.tilesetId]! };
      map.events.push({
        id: "gate", name: "문지기", x: 2, y: 2, trigger: { kind: "action" }, commands: [],
        pages: [page({ kind: "choices", options: [{ text: "연다", branch: [text] }] }), { ...page(wait), id: "page2" }],
      });
      const ctx: ToolContext = { project, assistantRun: true };
      const target = { mapId, eventId: "gate", pageId: "page1" };
      const getHashes = async () => {
        const read = await runToolAsync(ctx, "get_event", { mapId, eventId: "gate", includeCommandHashes: true });
        expect(read.ok, read.summary).toBe(true);
        return (read.data as { commandHashes: { commands: { index: number; branchPath: number[]; hash: string }[] }[] }).commandHashes;
      };
      for (const name of ["insert_event_command", "update_event_command", "delete_event_command"]) {
        expect(getTool(name)?.mode).toBe("write");
      }
      const initialHashes = await getHashes();
      const leaf = initialHashes[0]!.commands[1]!;
      const row = { ...target, index: leaf.index, branchPath: leaf.branchPath };
      const updated = await runToolAsync(ctx, "update_event_command", { ...row, patch: { body: "지금은 닫혔다." }, expectedHash: leaf.hash });
      expect(updated.ok, updated.summary).toBe(true);
      expect(updated.summary).toContain("『문지기』");
      const staleProject = ctx.project;
      const stale = await runToolAsync(ctx, "delete_event_command", { ...row, expectedHash: leaf.hash });
      expect(stale).toMatchObject({ ok: false, issues: [{ code: "stale-event-command" }] });
      expect(ctx.project).toBe(staleProject);
      const newLeaf = (await getHashes())[0]!.commands[1]!;
      const deleted = await runToolAsync(ctx, "delete_event_command", { ...row, expectedHash: newLeaf.hash });
      expect(deleted.ok, deleted.summary).toBe(true);
      const inserted = await runToolAsync(ctx, "insert_event_command", { ...row, command: { kind: "text", speaker: "문지기", body: "다음에 오세요." } });
      expect(inserted.ok, inserted.summary).toBe(true);
      expect(checkSmallTaskScope(project, ctx.project, { ...target, kind: "dialogue" }).ok).toBe(true);
      expect(checkSmallTaskScope(project, ctx.project, { ...target, kind: "eventPage" }).ok).toBe(true);

      const loop = { kind: "loop", body: [{ kind: "breakLoop" }] };
      const insertedLoop = await runToolAsync(ctx, "insert_event_command", { ...target, index: 1, command: loop });
      expect(insertedLoop.ok, insertedLoop.summary).toBe(true);
      expect(ctx.project.maps[mapId]?.events.at(-1)?.pages?.[0]?.commands[1]).toEqual(loop);
    }, 60_000);
  });
});
