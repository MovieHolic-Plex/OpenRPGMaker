// 게임 짓기 규칙의 단일 소스(src/ai/agentRules.ts)가 조수 쪽 글·에이전트 모드 전달물로 갈라지지 않는지 잡는다 —
// 조수 소스가 같은 문자열 리터럴을 다시 담으면 실패하고, 스킬·번들·시스템 지시가 렌더 결과와 같아야 통과한다.
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import {
  AGENT_RULES_SECTIONS,
  AGENT_RULES_SKILL_ID,
  DEFINE_ENDING_DESCRIPTION,
  MARK_ENTRANCES_RULE,
  NEW_PLAYER_PLAYTEST_RULE,
  OBJECTIVE_HUD_HIDDEN_MESSAGE,
  OBJECTIVE_MISSING_MESSAGE,
  OBJECTIVE_NOT_AT_START_MESSAGE,
  PRE_FINISH_STRUCTURE_CHECK,
  RUN_SCENE_TEST_DESCRIPTION,
  SET_OBJECTIVE_DESCRIPTION,
  TODO_LOOP_LINE,
  EXAMINE_FEEDBACK_RULE,
  ACTION_FEEDBACK_RULE,
  CLIMAX_STAGING_RULE,
  OBJECTIVE_MATCHES_PICTURE_RULE,
  OPENING_AND_LENGTH_RULE,
  PLAY_LOOP_RULE,
  PROGRESSION_RULE,
  REWARD_LOOP_RULE,
  agentRulesPromptLines,
  renderAgentRulesSkill,
} from "@/ai/agentRules";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const read = (path: string) => readFileSync(join(ROOT, path), "utf8");
const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });

describe("게임 짓기 규칙 — 단일 소스", () => {
  it("커밋된 스킬 파일이 렌더 결과와 같다 (다르면 npm run agent-rules:skill)", () => {
    const file = `assistant-skills/${AGENT_RULES_SKILL_ID}/SKILL.md`;
    expect(existsSync(join(ROOT, file)), `${file} 가 없다 — npm run agent-rules:skill`).toBe(true);
    expect(read(file)).toBe(renderAgentRulesSkill());
  });

  it("조수 스킬 번들이 같은 본문을 싣는다 — 편집기 조수가 읽는 글도 같은 원문", async () => {
    const bundle = (await import("@/assets/assistantSkills.json")).default as { skills: { id: string; body: string }[] };
    const skill = bundle.skills.find((entry) => entry.id === AGENT_RULES_SKILL_ID);
    expect(skill, "번들에 규칙 스킬이 없다 — node scripts/content/bundle-assistant-skills.mjs").toBeDefined();
    const front = renderAgentRulesSkill().replace(/^---\n[\s\S]*?\n---\n/, "");
    expect(skill!.body).toBe(front.trimStart());
  });

  it("조수 소스는 원문을 복사하지 않고 상수를 읽는다", () => {
    const sources: readonly [string, string, string][] = [
      ["src/ai/v2/prompt.ts", "TODO_LOOP_LINE", TODO_LOOP_LINE],
      ["src/ai/v2/verbs.ts", "SET_OBJECTIVE_DESCRIPTION", SET_OBJECTIVE_DESCRIPTION],
      ["src/ai/v2/discoverability.ts", "OBJECTIVE_MISSING_MESSAGE", OBJECTIVE_MISSING_MESSAGE],
      ["src/ai/v2/discoverability.ts", "OBJECTIVE_NOT_AT_START_MESSAGE", OBJECTIVE_NOT_AT_START_MESSAGE],
      ["src/ai/v2/discoverability.ts", "OBJECTIVE_HUD_HIDDEN_MESSAGE", OBJECTIVE_HUD_HIDDEN_MESSAGE],
      ["src/ai/adventureCompletion.ts", "PRE_FINISH_STRUCTURE_CHECK", PRE_FINISH_STRUCTURE_CHECK],
      ["src/ai/v2/toolTextEn.ts", "RUN_SCENE_TEST_DESCRIPTION", RUN_SCENE_TEST_DESCRIPTION],
      ["src/ai/v2/toolTextEn.ts", "DEFINE_ENDING_DESCRIPTION", DEFINE_ENDING_DESCRIPTION],
    ];
    for (const [path, constant, text] of sources) {
      const source = read(path);
      expect(source, `${path} 가 @/ai/agentRules 의 ${constant} 를 쓰지 않는다`).toContain(constant);
      expect(source, `${path} 에 원문이 다시 적혀 있다 — 상수를 import 해야 한다`).not.toContain(text);
    }
  });

  it("스킬 본문이 원문과 새 지침을 모두 싣는다", () => {
    const skill = renderAgentRulesSkill();
    for (const constant of [TODO_LOOP_LINE, SET_OBJECTIVE_DESCRIPTION, PRE_FINISH_STRUCTURE_CHECK, RUN_SCENE_TEST_DESCRIPTION, DEFINE_ENDING_DESCRIPTION]) {
      expect(skill).toContain(constant);
    }
    for (const rule of [MARK_ENTRANCES_RULE, EXAMINE_FEEDBACK_RULE, NEW_PLAYER_PLAYTEST_RULE]) expect(skill).toContain(rule);
    for (const rule of [PLAY_LOOP_RULE, ACTION_FEEDBACK_RULE, CLIMAX_STAGING_RULE, OBJECTIVE_MATCHES_PICTURE_RULE]) expect(skill).toContain(rule);
    for (const rule of [REWARD_LOOP_RULE, PROGRESSION_RULE]) expect(skill).toContain(rule);
    // 2026-11-08 실험 2b: 채점이 두 번 가리킨 «첫 1분 목표·10분 분량» 하한도 같은 원문에서 나간다.
    expect(skill).toContain(OPENING_AND_LENGTH_RULE);
    expect(skill.startsWith(`---\nname: ${AGENT_RULES_SKILL_ID}\n`)).toBe(true);
    expect(AGENT_RULES_SECTIONS.length).toBe(8);
  });

  it("에이전트 모드 시스템 지시가 규칙을 싣고, 작업 폴더 파일도 같은 글이다", async () => {
    const host = await import("../electron/main/agentHost");
    const prompt = host.AGENT_SYSTEM_APPEND;
    for (const line of agentRulesPromptLines()) expect(prompt).toContain(line);
    for (const rule of [MARK_ENTRANCES_RULE, NEW_PLAYER_PLAYTEST_RULE]) expect(prompt).toContain(rule);

    const workDir = mkdtempSync(join(tmpdir(), "oprn-agent-rules-"));
    roots.push(workDir);
    const files = host.writeAgentRulesFiles(workDir);
    expect(files.length).toBe(4);
    for (const file of files) expect(readFileSync(file, "utf8")).toBe(renderAgentRulesSkill());
    expect(files.some((file) => file.endsWith(join(".claude", "skills", AGENT_RULES_SKILL_ID, "SKILL.md")))).toBe(true);
    expect(files.some((file) => file.endsWith("AGENTS.md"))).toBe(true);
  });
});
