/** @vitest-environment happy-dom */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resolveIntentClarification } from "@/ai/intentClarify";
import { defaultAiConfig, loadAiConfig, AI_CONFIG_STORAGE_KEY } from "@/ai/llmClient";
import { applyFirstVisitEditorUiMode, EDITOR_UI_MODE_STORAGE_KEY, resetEditorUiModeForTests } from "@/editor/editorUiMode";
import { BASIC_COACH_MARKS, STANDARD_WELCOME_BODY } from "@/editor/coachMarks";
import { defaultAiVisualStartPrompts } from "@/editor/panels/aiStartScreenCards";
import { directorStartPrompts, formatComposerPlaceholder, readAgentBrief } from "@/editor/panels/aiAgentBrief";
import { isAiConfigReady } from "@/editor/panels/aiChatPanelHelpers";
import { proposalAcceptButtonLabel } from "@/editor/panels/aiProposalFusion";
import { skillCommandLine } from "@/editor/panels/aiSkillDrawer";
import { SYSTEM_SKILLS } from "@/ai/skills";
import {
  getAiConnectionStatus,
  resetAiConnectionStatusCache,
  setAiOAuthCachedStatusForTests,
} from "@/editor/panels/aiConnectionStatus";
import { editorState } from "@/editor/editorState";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();
  get length(): number {
    return this.values.size;
  }
  clear(): void {
    this.values.clear();
  }
  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }
  key(index: number): string | null {
    return Array.from(this.values.keys())[index] ?? null;
  }
  removeItem(key: string): void {
    this.values.delete(key);
  }
  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

describe("초보 첫 실행 계약", () => {
  beforeEach(() => {
    resetEditorUiModeForTests("beginner");
    store.replace(createBlankProject());
    editorState.set({
      currentMapId: store.getCurrent().startMapId,
      layer: "lower",
      tool: "paint",
      selection: null,
    });
    resetAiConnectionStatusCache();
  });

  afterEach(() => {
    resetAiConnectionStatusCache();
    resetEditorUiModeForTests("standard");
  });

  it("저장값이 없으면 초보 모드로 시작한다", () => {
    // Break: first visit used to stay on standard unless the user found the toggle.
    const storage = new MemoryStorage();
    expect(applyFirstVisitEditorUiMode(storage)).toBe("beginner");
    expect(storage.getItem(EDITOR_UI_MODE_STORAGE_KEY)).toBe("beginner");
  });

  it("표준 웰컴은 타일 칠하기가 아니라 감독에게 부탁하라고 한다", () => {
    // Break: STANDARD_WELCOME_BODY told first-time standard users to paint the chipset.
    expect(STANDARD_WELCOME_BODY).toMatch(/감독|부탁|한 줄/);
    expect(STANDARD_WELCOME_BODY).not.toMatch(/칩셋|타일 탭/);
  });

  it("초보 코치는 사라진 V 단축키와 AI 작업 버튼을 가르치지 않는다", () => {
    // Break: canvas coach still said 선택 도구(V) + ✨ AI 작업 버튼.
    const canvas = BASIC_COACH_MARKS.find((step) => step.id === "canvas");
    expect(canvas?.text).toBeTruthy();
    expect(canvas?.text).not.toMatch(/\(V\)|✨|AI 작업 버튼/);
    expect(canvas?.text).toMatch(/영역|드래그|더블클릭/);
  });

  it("장소 만들기 문장은 집/실내 되묻기를 건너뛴다", () => {
    // Break: start-card copy included 집 and resolveIntentClarification asked 외장/실내.
    const place = defaultAiVisualStartPrompts().find((prompt) => prompt.id === "place");
    expect(place?.instruction).toBeTruthy();
    expect(resolveIntentClarification(place!.instruction)).toBeNull();
    const named = directorStartPrompts(readAgentBrief()).find((prompt) => prompt.id === "place");
    expect(named?.instruction).toBeTruthy();
    expect(resolveIntentClarification(named!.instruction)).toBeNull();
    expect(resolveIntentClarification("빈 맵에 집과 길, 나무가 자연스럽게 이어지는 작은 장소를 만들어줘")).toBeNull();
    expect(resolveIntentClarification("집 하나 만들어줘")).not.toBeNull();
  });

  it("ChatGPT가 끊겨 있으면 전송 준비가 아니다", () => {
    // Break: isAiConfigReady treated authMode=chatgpt as ready without a login.
    const config = { ...defaultAiConfig(), authMode: "chatgpt" as const, model: "gpt-5.4" };
    setAiOAuthCachedStatusForTests({ connected: false });
    expect(getAiConnectionStatus(config).kind).toBe("disconnected");
    expect(isAiConfigReady(config)).toBe(false);
    setAiOAuthCachedStatusForTests({ connected: true, planType: "plus" });
    expect(isAiConfigReady(config)).toBe(true);
  });

  it("새 설정은 자율이 아니라 채팅으로 시작한다", () => {
    // Break: defaultAiConfig.agentMode and missing-field backfill were auto.
    expect(defaultAiConfig().agentMode).toBe("chat");
    const storage = new MemoryStorage();
    (globalThis as unknown as { localStorage: Storage }).localStorage = storage;
    storage.setItem(AI_CONFIG_STORAGE_KEY, JSON.stringify({ model: "gpt-5.4" }));
    expect(loadAiConfig().agentMode).toBe("chat");
    Reflect.deleteProperty(globalThis, "localStorage");
  });

  it("슬래시 목록은 한글 결과 이름을 보여 준다", () => {
    // Break: skillCommandLine returned /build-house for the visible row.
    const house = SYSTEM_SKILLS.find((skill) => skill.id === "build-house");
    expect(house).toBeTruthy();
    expect(skillCommandLine(house!)).toBe("집 짓기");
    expect(skillCommandLine(house!)).not.toContain("/build-house");
  });

  it("제안 수락 버튼은 이 맵에 넣기다", () => {
    // Break: proposalAcceptButtonLabel said 맵만 적용.
    expect(proposalAcceptButtonLabel(2, 2)).toBe("이 맵에 넣기");
    expect(proposalAcceptButtonLabel(1, 3)).toBe("선택 1건 넣기");
  });

  it("입력창 힌트는 한 줄로 읽힌다", () => {
    // Break: placeholder stuffed 지시·맵·레이어·/  into two wrapping lines.
    const text = formatComposerPlaceholder(readAgentBrief());
    expect(text).toMatch(/만들/);
    expect(text).not.toMatch(/하위|상위|\/ 스킬|이 맵에 지시/);
  });
});
