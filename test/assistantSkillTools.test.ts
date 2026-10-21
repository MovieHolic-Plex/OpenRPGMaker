// 조수 스킬 읽기(list_assistant_skills · read_assistant_skill)와 장면 다듬기 연결.
// 원본은 assistant-skills/<id>/SKILL.md 하나 — 번들(src/assets/assistantSkills.json)이 어긋나면 조수가 옛 교훈을 읽는다.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { ASSISTANT_SKILLS } from "../src/editor/tools/assistantSkillTools";
import { getTool, runTool } from "../src/editor/tools";
import { createBlankProject } from "../src/project/defaults";
import { buildPiAgentSystemPrompt } from "../src/ai/piAgent/systemPrompt";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

function bodyOf(file: string): string {
  const text = readFileSync(file, "utf8");
  const m = text.match(/^---\n[\s\S]*?\n---\n?/);
  return (m ? text.slice(m[0].length) : text).trimStart();
}

describe("조수 스킬 번들", () => {
  it("assistant-skills/*/SKILL.md 와 번들이 같다 (다르면 npm run assistant-skills:bundle)", () => {
    const dirs = readdirSync(join(ROOT, "assistant-skills")).filter((d) => existsSync(join(ROOT, "assistant-skills", d, "SKILL.md")));
    expect(ASSISTANT_SKILLS.map((s) => s.id).sort()).toEqual([...dirs].sort());
    for (const dir of dirs) {
      const skill = ASSISTANT_SKILLS.find((s) => s.id === dir)!;
      expect(skill.body, dir).toBe(bodyOf(join(ROOT, "assistant-skills", dir, "SKILL.md")));
    }
  });

  it("read_assistant_skill 이 장면 다듬기 스킬을 쪽으로 돌려준다", () => {
    expect(getTool("read_assistant_skill")?.mode).toBe("read");
    expect(getTool("list_assistant_skills")?.mode).toBe("read");
    const ctx = { project: createBlankProject() };
    const list = runTool(ctx, "list_assistant_skills", {});
    expect(list.ok, list.summary).toBe(true);
    expect(JSON.stringify(list.data)).toContain("game-scene-polish");
    const first = runTool(ctx, "read_assistant_skill", { id: "game-scene-polish" });
    expect(first.ok, first.summary).toBe(true);
    const data = first.data as { content: string; nextOffset: number | null; totalCharacters: number };
    let text = data.content;
    let next = data.nextOffset;
    while (next !== null) {
      const page = runTool(ctx, "read_assistant_skill", { id: "game-scene-polish", offset: next }).data as { content: string; nextOffset: number | null };
      text += page.content;
      next = page.nextOffset;
    }
    expect(text.length).toBe(data.totalCharacters);
    expect(text).toContain("scene-transfer-off-door");
    expect(runTool(ctx, "read_assistant_skill", { id: "없는-스킬" }).ok).toBe(false);
  });

  it("Pi 시스템 프롬프트가 장면 작업 전에 스킬을 읽으라고 한다", () => {
    const project = createBlankProject();
    const prompt = buildPiAgentSystemPrompt(project, Object.keys(project.maps)).join("\n");
    expect(prompt).toContain("read_assistant_skill({id:'game-scene-polish'})");
  });
});

describe("build_hand_interior_room — 맵 이름이 준 평면을 갈아끼우지 않는다", () => {
  it("이름이 「승강장」이어도 준 plan 크기대로 짓고, 표준 구성은 알리기만 한다", () => {
    const ctx = { project: createBlankProject() };
    const plan = ["############", "#..........#", "#..........#", "#..........#", "#..........#", "#####.######"];
    const result = runTool(ctx, "build_hand_interior_room", { tileset: "jp_city", name: "지하철 승강장", plan, floor: "flooring", wall: "cloth" });
    expect(result.ok, result.summary).toBe(true);
    const map = ctx.project.maps[(result.data as { mapId: string }).mapId]!;
    expect(map.width).toBeLessThan(28);
    expect(JSON.stringify(result)).toContain("표준 구성과 맞는다");
  });
});
