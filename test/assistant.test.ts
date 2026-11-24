import { describe, expect, it } from "vitest";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { ASSISTANT_SKILLS } from "../src/editor/tools/assistantSkillTools";
import { getTool, runTool } from "../src/editor/tools";
import { createBlankProject } from "../src/project/defaults";
import { buildPiAgentSystemPrompt } from "../src/ai/piAgent/systemPrompt";
import { endedOnQuestion, layStatus, neverStarted } from "@/harnesses/assistant-capability/node/turnVerdict";
import { guardLeadChat, leadForRequest, leadPlanMessages, parseLeadReview, parseSplitConfig, parseSplitRole, planForWorker, resolveSplitConfig, toolCatalog } from "../src/ai/v2/turn/split";
import { isolateTimers } from "./mergedTeardown";

// 조수 스킬 읽기(list_assistant_skills · read_assistant_skill)와 장면 다듬기 연결.
// 원본은 assistant-skills/<id>/SKILL.md 하나 — 번들(src/assets/assistantSkills.json)이 어긋나면 조수가 옛 교훈을 읽는다.
describe("assistantSkillTools", () => {
  isolateTimers();
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
});

// 턴 기록의 모델 없는 판정 — 2026-11-12 Haiku 깔기 판에서 본 두 가지:
//  - 입력이 조수에 닿지 않은 턴(모델 호출 0 · 도구 0 · done 없음)이 «아무것도 안 깔림» 으로 세어졌다(기반 오류여야 한다).
//  - ask_user 로 끝난 턴은 설계상 최종 보고가 없다 — «v2Final 없음» 이 깨진 턴으로 읽혔다.
describe("assistantTurnVerdict", () => {
  isolateTimers();
  const unsentTurn = { outcome: "settled", requests: [], toolCalls: [], done: [], v2Final: [] };
  const workedTurn = { outcome: "settled", requests: [{ model: "m" }], toolCalls: [{ name: "make_place", ok: true }], done: [{ stats: {} }], v2Final: [{ complete: false }] };
  const askedTurn = { outcome: "settled", requests: [{ model: "m" }], toolCalls: [{ name: "make_place", ok: true }, { name: "ask_user", ok: true }], done: [{ stats: {} }], v2Final: [] };
  const cutTurn = { outcome: "timeout", requests: [{ model: "m" }], toolCalls: [{ name: "make_place", ok: true }], done: [], v2Final: [] };
  describe("입력이 조수에 닿지 않은 턴은 기반 오류다", () => {
    it("모델 호출 0 · 도구 0 · done 없음 → neverStarted, 맵 깔기 판정은 infra", () => {
      expect(neverStarted([unsentTurn])).toBe(true);
      expect(layStatus({ maps: 0, turns: [unsentTurn], errors: 0, toolCalls: 0, timedOut: false })).toEqual({ status: "infra", unsent: true });
    });
    it("모델이 돌았으면 아니다 — 아무것도 안 깔았으면 nothing, 깔았으면 laid, 끊겼으면 timeout", () => {
      expect(neverStarted([workedTurn])).toBe(false);
      expect(neverStarted([])).toBe(false);
      expect(layStatus({ maps: 0, turns: [workedTurn], errors: 0, toolCalls: 1, timedOut: false }).status).toBe("nothing");
      expect(layStatus({ maps: 1, turns: [workedTurn], errors: 0, toolCalls: 1, timedOut: false }).status).toBe("laid");
      expect(layStatus({ maps: 1, turns: [cutTurn], errors: 0, toolCalls: 1, timedOut: true }).status).toBe("timeout");
      // 도구 없이 오류로 끝난 턴은 전처럼 infra.
      expect(layStatus({ maps: 0, turns: [{ ...workedTurn, toolCalls: [] }], errors: 1, toolCalls: 0, timedOut: false }).status).toBe("infra");
    });
  });
  describe("질문으로 끝난 턴", () => {
    it("ask_user 가 성공했고 최종 보고가 없으면 질문으로 끝난 것이다", () => {
      expect(endedOnQuestion([askedTurn])).toBe(true);
    });
    it("최종 보고가 있거나, 묻지 않았거나, 물음이 거절됐으면 아니다", () => {
      expect(endedOnQuestion([workedTurn])).toBe(false);
      expect(endedOnQuestion([cutTurn])).toBe(false);
      expect(endedOnQuestion([{ ...askedTurn, v2Final: [{ complete: true }] }])).toBe(false);
      expect(endedOnQuestion([{ ...askedTurn, toolCalls: [{ name: "ask_user", ok: false }] }])).toBe(false);
      expect(endedOnQuestion([])).toBe(false);
    });
  });
  describe("보정 기록의 «이어 쓴 답» 줄", () => {
    it("이어 쓴 답이 있으면 몇 장 중 몇 장인지와 어느 판인지 적는다 — 없으면 빈 글", async () => {
      const { carriedNote } = await import("@/harnesses/assistant-capability/node/mapVqa/verdict");
      expect(carriedNote({ planted: { total: 33 }, good: { total: 15 }, carried: { from: ["map-vqa-v2"], answers: 33 } })).toBe("48장 중 33장은 map-vqa-v2 의 답을 이어 씀(물음이 화소까지 같다) · 새로 물은 것 15장");
      expect(carriedNote({ planted: { total: 33 }, good: { total: 15 }, carried: { from: ["map-vqa-v2"], answers: 0 } })).toBe("");
      expect(carriedNote({ planted: { total: 33 }, good: { total: 15 } })).toBe("");
      expect(carriedNote(null)).toBe("");
    });
  });
});

describe("assistantV2Split", () => {
  isolateTimers();
  describe("assistant v2 lead/worker split", () => {
    it("reads the lead from OPRN_V2_SPLIT (local CLI and account/model forms)", () => {
      expect(parseSplitConfig("lead:claude:claude-opus-5-5:medium,worker:claude:claude-haiku-5-5:high")?.lead)
        .toEqual({ provider: "local-cli:claude", model: "claude-opus-5-5", effort: "medium" });
      expect(parseSplitConfig("lead:openai-compat:proxy8318/gemini-4-argon@medium")?.lead)
        .toEqual({ provider: "openai-compat:proxy8318", model: "gemini-4-argon", effort: "medium" });
      expect(parseSplitRole("claude:claude-haiku-5-5")).toEqual({ provider: "local-cli:claude", model: "claude-haiku-5-5" });
    });

    it("uses the request lead only without OPRN_V2_SPLIT: local CLI, custom endpoint or registry account", () => {
      const opus = { provider: "local-cli:claude", model: "claude-opus-5-5", thinkingLevel: "medium" };
      expect(resolveSplitConfig(undefined, opus)?.lead).toEqual({ provider: "local-cli:claude", model: "claude-opus-5-5", effort: "medium" });
      expect(resolveSplitConfig("", opus)?.lead.model).toBe("claude-opus-5-5");
      expect(resolveSplitConfig("off", opus)).toBeUndefined();
      expect(resolveSplitConfig("lead:openai-compat:proxy8318/gemini-4-argon@medium", opus)?.lead.model).toBe("gemini-4-argon");
      expect(resolveSplitConfig(undefined, { provider: "openai-compat:proxy8318", model: "gemini-4-argon", thinkingLevel: "high" })?.lead)
        .toEqual({ provider: "openai-compat:proxy8318", model: "gemini-4-argon", effort: "high" });
      expect(resolveSplitConfig(undefined, { provider: "anthropic", model: "claude-opus-5-5", thinkingLevel: "medium" })?.lead)
        .toEqual({ provider: "anthropic", model: "claude-opus-5-5", effort: "medium" });
      expect(resolveSplitConfig(undefined, { provider: "openrouter", model: "openai/gpt-5.5" })?.lead).toEqual({ provider: "openrouter", model: "openai/gpt-5.5" });
      expect(resolveSplitConfig("lead:claude:claude-opus-5-5", { provider: "anthropic", model: "claude-opus-5-5" })?.lead.provider).toBe("local-cli:claude");
      expect(resolveSplitConfig("off", { provider: "anthropic", model: "claude-opus-5-5" })).toBeUndefined();
      expect(resolveSplitConfig(undefined, { provider: "made-up", model: "x" })).toBeUndefined();
      expect(resolveSplitConfig(undefined, { provider: "anthropic", model: "  " })).toBeUndefined();
      expect(resolveSplitConfig(undefined, undefined)).toBeUndefined();
    });

    it("carries a request lead on another account; the engine lead only on its own engine", () => {
      const claudeLead = { provider: "anthropic", model: "claude-opus-5-5", thinkingLevel: "medium" };
      const cliLead = { provider: "local-cli:claude", model: "claude-opus-5-5", thinkingLevel: "medium" };
      const none = () => undefined;
      expect(leadForRequest({ provider: "openai-codex", lead: claudeLead }, none)).toBe(claudeLead);
      expect(leadForRequest({ provider: "local-cli:claude", assistantVersion: "v2" }, () => cliLead)).toBe(cliLead);
      expect(leadForRequest({ provider: "openai-codex", assistantVersion: "v2" }, () => cliLead)).toBeUndefined();
      expect(leadForRequest({ provider: "local-cli:claude" }, () => cliLead)).toBeUndefined();
      expect(leadForRequest({ provider: "openai-codex", lead: { provider: "made-up", model: "x", thinkingLevel: "medium" } }, none)).toBeUndefined();
    });

    it("turns the lead off for the run after one model/plan failure, so the worker continues alone", async () => {
      const replies = ["API Error: 400 unknown provider for model claude-opus-5-5", "TODO\n1. never reached"];
      let calls = 0;
      const lead = guardLeadChat(async () => replies[calls++]!);
      await expect(lead([])).rejects.toThrow(/unknown provider/u);
      await expect(lead([])).rejects.toThrow(/disabled for this run/u);
      expect(calls).toBe(1);
      const plan = "TODO\n1. Add the clue event\nSPECS\n1. the model of the lock is not found in the room yet.";
      await expect(guardLeadChat(async () => plan)([])).resolves.toBe(plan);
    });

    it("stays off without a lead", () => {
      expect(parseSplitConfig(undefined)).toBeUndefined();
      expect(parseSplitConfig("0")).toBeUndefined();
      expect(parseSplitConfig("worker:claude:claude-haiku-5-5")).toBeUndefined();
      expect(parseSplitConfig("lead:nonsense")).toBeUndefined();
    });

    it("parses the lead review; an unreadable reply never blocks the run", () => {
      expect(parseLeadReview('```json\n{"approve": false, "fixes": ["Event 자물쇠: count wrong tries"]}\n```')).toEqual({ approve: false, fixes: ["Event 자물쇠: count wrong tries"] });
      expect(parseLeadReview('{"approve": true, "fixes": ["ignored"]}')).toEqual({ approve: true, fixes: [] });
      const bad = parseLeadReview("looks fine to me");
      expect(bad.approve).toBe(true);
      expect(bad.fixes).toEqual([]);
      expect(bad.problem).toMatch(/no JSON/u);
      expect(parseLeadReview(`{"approve": false, "fixes": [${Array.from({ length: 9 }, (_, i) => `"f${i}"`).join(",")}]}`).fixes).toHaveLength(5);
    });

    it("keeps model-facing text in English and the user's request verbatim", () => {
      const messages = leadPlanMessages({ task: "「자물쇠」를 조사하면 4자리 숫자를 입력", digest: "Map m1 «서재» 10x8", tools: toolCatalog([{ name: "add_event", description: "Add or edit one event. More text." }], ["author_puzzle_chain"]) });
      expect(messages[0]!.content).toMatch(/^You are the LEAD designer/u);
      expect(messages[1]!.content).toContain("「자물쇠」를 조사하면 4자리 숫자를 입력");
      expect(messages[1]!.content).toContain("- add_event: Add or edit one event.");
      expect(messages[1]!.content).toContain("author_puzzle_chain");
      expect(planForWorker("TODO\n1. lock")).toMatch(/^\[Lead plan/u);
    });
  });
});
