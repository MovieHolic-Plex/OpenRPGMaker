import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  aiActivityActionLabel,
  narrateAiActivity,
} from "@/editor/aiActivityNarration";

const INTERNAL_TOOL_NAME = /\b[a-z][a-z0-9]*(?:_[a-z0-9]+)+\b/u;

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
  it("실행 중인 길 그리기를 맵과 영역이 포함된 한 문장으로 설명한다", () => {
    expect(narrateAiActivity({
      toolName: "paint_road",
      args: { mapName: "샘물마을", x: 12, y: 8, w: 6, h: 4 },
      elapsedMs: 12_800,
    })).toEqual({
      action: "길을 그리는 중",
      target: "샘물마을 (12,8) 6×4",
      line: "길을 그리는 중 — 샘물마을 (12,8) 6×4",
      elapsedLabel: "12초",
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

  it("실패, 도구 요약, 경과 시간 경계를 사람에게 읽히게 표현한다", () => {
    expect(narrateAiActivity({ toolName: "paint_road", done: true, ok: false }).action)
      .toBe("길 그리기를 실패했어요");
    expect(narrateAiActivity({ toolName: "paint_road", done: true, summary: "샘물마을의 길을 이었어요" }).action)
      .toBe("샘물마을의 길을 이었어요");
    expect(narrateAiActivity({ toolName: "paint_road", elapsedMs: 999 }).elapsedLabel).toBe("");
    expect(narrateAiActivity({ toolName: "paint_road", elapsedMs: 1_999 }).elapsedLabel).toBe("1초");
  });

  it("레지스트리에 등록된 모든 도구에서 내부 이름을 노출하지 않는다", () => {
    const registeredNames = registeredToolNames();
    expect(registeredNames.length).toBeGreaterThan(0);

    for (const toolName of registeredNames) {
      const { line } = narrateAiActivity({ toolName });
      expect(line, `${toolName} 활동 문구에 내부 도구 이름이 노출됨`).not.toMatch(INTERNAL_TOOL_NAME);
    }
  });

  it("알 수 없는 도구도 내부 이름 대신 사람용 기본 문구를 쓴다", () => {
    const { line } = narrateAiActivity({ toolName: "totally_unknown_tool" });

    expect(line).toBe("작업을 진행하는 중");
    expect(line).not.toMatch(INTERNAL_TOOL_NAME);
  });
});
