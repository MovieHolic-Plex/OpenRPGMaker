import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  aiActivityActionLabel,
  aiActivityFamilySource,
  narrateAiActivity,
} from "@/editor/aiActivityNarration";
import { allTools } from "@/editor/tools";

const INTERNAL_TOOL_NAME = /\b[a-z][a-z0-9]*(?:_[a-z0-9]+)+\b/u;
const EXPLICIT_FALLBACK_FAMILY = new Set([
  "advance_dungeon_room_build",
  "advance_interior_room_build",
  "configure_collections",
  "configure_fishing",
  "configure_game_systems",
  "configure_life_economy",
  "configure_monster_system",
  "configure_museum",
  "configure_seasonal_forage",
  "configure_time_system",
  "delete_test_preset",
  "manage_flag_slot",
  "prune_unused",
  "rename_switch",
  "rename_variable",
  "reset_project",
  "run_dungeon_room_pipeline",
  "run_interior_room_pipeline",
  "set_cluster_rule",
  "set_group_layout",
  "set_lighting_volume",
  "set_project_genre",
  "set_project_settings",
  "set_scene_mood",
  "set_session_farm_state",
  "start_dungeon_room_session",
  "start_interior_room_session",
  "upsert_test_preset",
]);
const EXPLICIT_GENERIC_FAMILY = new Set([
  "advance_dungeon_room_build",
  "advance_interior_room_build",
  "run_dungeon_room_pipeline",
  "run_interior_room_pipeline",
  "start_dungeon_room_session",
  "start_interior_room_session",
]);

function registeredToolNames(): string[] {
  const toolsRoot = new URL("../src/editor/tools/", import.meta.url);
  const names = new Set<string>();
  const visit = (directory: URL): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        visit(new URL(`${entry.name}/`, directory));
      } else if (entry.name.endsWith(".ts")) {
        const source = readFileSync(join(directory.pathname, entry.name), "utf8");
        for (const match of source.matchAll(/\bname:\s*["']([a-z][a-z0-9_]*_[a-z0-9_]+)["']/gu)) {
          names.add(match[1]);
        }
      }
    }
  };
  visit(toolsRoot);
  return [...names].sort();
}

describe("AI 도구 활동 문장", () => {
  it.each([
    ["get_audio_resource", "read-only"],
    ["set_audio_description", "mapped"],
  ] as const)("classifies audio tool %s explicitly", (name, expected) => {
    expect(aiActivityFamilySource(name)).toBe(expected);
  });

  it("실행 중인 길 그리기를 맵과 영역이 포함된 한 문장으로 설명한다", () => {
    expect(narrateAiActivity({
      toolName: "paint_road",
      args: { mapName: "샘물마을", x: 12, y: 8, w: 6, h: 4 },
    })).toEqual({
      action: "길을 그리는 중",
      target: "샘물마을 (12,8) 6×4",
      line: "길을 그리는 중 — 샘물마을 (12,8) 6×4",
    });
  });

  it("완료 문구는 같은 도구의 실행 중 문구와 다르다", () => {
    const running = aiActivityActionLabel("paint_road");
    const done = aiActivityActionLabel("paint_road", true);

    expect(running).toBe("길을 그리는 중");
    expect(done).toBe("길을 그렸어요");
    expect(done).not.toBe(running);
  });

  it("읽기 전용 도구는 시공이 아니라 살펴보기로 설명한다", () => {
    const narration = narrateAiActivity({
      toolName: "get_map_region",
      args: { region: { x: 3, y: 4, width: 8, height: 5 } },
      mapName: "샘물마을",
    });

    expect(narration.action).toBe("맵을 살펴보는 중");
    expect(narration.line).toBe("맵을 살펴보는 중 — 샘물마을 (3,4) 8×5");
    expect(narration.action).not.toContain("만드");
  });

  it("실패와 도구 요약을 사람에게 읽히게 표현한다", () => {
    expect(narrateAiActivity({ toolName: "paint_road", done: true, ok: false }).action)
      .toBe("길 그리기를 실패했어요");
    expect(narrateAiActivity({ toolName: "paint_road", done: true, summary: "샘물마을의 길을 이었어요" }).action)
      .toBe("샘물마을의 길을 이었어요");
  });

  it("레지스트리에 등록된 모든 도구에서 내부 이름을 노출하지 않는다", () => {
    const registeredNames = registeredToolNames();
    const registryNames = allTools().map((tool) => tool.name).sort();
    // 두 수집 경로가 동시에 무너져도 통과하는 것을 막는 바닥값. 실제 등록 도구는 224개다.
    expect(registryNames.length).toBeGreaterThanOrEqual(200);
    expect(registeredNames).toEqual(registryNames);

    for (const toolName of registeredNames) {
      const { line } = narrateAiActivity({ toolName });
      expect(line, `${toolName} 활동 문구에 내부 도구 이름이 노출됨`).not.toMatch(INTERNAL_TOOL_NAME);
      const source = aiActivityFamilySource(toolName);
      expect(
        source === "read-only" || source === "mapped" || EXPLICIT_FALLBACK_FAMILY.has(toolName),
        `${toolName} 도구의 활동 문구 패밀리를 명시적으로 결정해야 함`,
      ).toBe(true);
    }
    expect(registeredNames.filter((name) => {
      const source = aiActivityFamilySource(name);
      return source === "fallback" || source === "generic";
    })).toEqual([...EXPLICIT_FALLBACK_FAMILY].sort());
    expect(registeredNames.filter((name) => aiActivityFamilySource(name) === "generic")).toEqual(
      [...EXPLICIT_GENERIC_FAMILY].sort(),
    );
  });

  it("내레이션 모듈은 DOM과 Phaser 양쪽에서 안전하게 쓰도록 import가 없다", () => {
    const source = readFileSync(new URL("../src/editor/aiActivityNarration.ts", import.meta.url), "utf8");
    expect(source).not.toMatch(/^import\s/mu);
  });

  it("알 수 없는 도구도 내부 이름 대신 사람용 기본 문구를 쓴다", () => {
    const { line } = narrateAiActivity({ toolName: "totally_unknown_tool" });

    expect(line).toBe("작업을 진행하는 중");
    expect(line).not.toMatch(INTERNAL_TOOL_NAME);
  });
});
