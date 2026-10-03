import { beforeEach, expect, it, vi } from "vitest";
import { runStartScreenPresetInterview, type StartScreenHandoff } from "@/editor/startScreenHandoff";
import { store } from "@/project/store";
import { interviewBrief } from "./helpers/gameDesignBrief";
import type { Project } from "@/project/types";

vi.mock("@/project/store", () => ({ store: { getCurrent: vi.fn(), getProjectIdentity: vi.fn(), update: vi.fn(), flush: vi.fn(), replaceProject: vi.fn() } }));
vi.mock("@/editor/mapSelection", () => ({ focusProjectStartMap: vi.fn() }));

let project: Project;
const handoff = (presetId: StartScreenHandoff["presetId"], intent = "풀숲 마을"): StartScreenHandoff => ({
  intent: { version: 1, projectDir: "/games/새 게임", title: "새 게임", choiceId: presetId, intent, createdAt: 0 },
  presetId,
  prompt: intent ? "사용자 의도: " + intent : null,
  displayText: intent || null,
  autoSend: true,
});

beforeEach(() => {
  vi.clearAllMocks();
  project = {} as Project;
  vi.mocked(store.getProjectIdentity).mockReturnValue({ kind: "remote", id: "new-folder" });
  vi.mocked(store.update).mockImplementation(mutator => { mutator(project); });
});

it("시작 화면 프리셋은 관문을 지나 인터뷰를 열고, 확정한 기획을 팀 첫 생성 대기로 심는다", async () => {
  const brief = interviewBrief();
  const interview = vi.fn(async () => brief);
  const ensureAiConnected = vi.fn(async () => true);
  const outcome = await runStartScreenPresetInterview(handoff(brief.presetId), { ensureAiConnected, interview });
  expect(outcome).toBe("brief");
  // 한 문장은 첫 질문의 입력칸에 담긴다 — 사용자가 확인해야 답이 된다.
  expect(interview).toHaveBeenCalledWith(brief.presetId, "풀숲 마을");
  expect(project.gameDesignBrief).toMatchObject({ summary: brief.summary, generationPending: true });
});

it("관문에서 「나중에」 면 인터뷰도 기획도 없다", async () => {
  const interview = vi.fn();
  const outcome = await runStartScreenPresetInterview(handoff("monster-collect"), { ensureAiConnected: async () => false, interview });
  expect(outcome).toBe("declined");
  expect(interview).not.toHaveBeenCalled();
  expect(store.update).not.toHaveBeenCalled();
});

it("인터뷰를 취소하거나 그 사이 다른 프로젝트가 열리면 아무것도 바꾸지 않는다", async () => {
  const deps = { ensureAiConnected: async () => true, interview: async () => null };
  expect(await runStartScreenPresetInterview(handoff("monster-collect"), deps)).toBe("declined");
  const brief = interviewBrief();
  const switching = {
    ensureAiConnected: async () => true,
    interview: async () => {
      vi.mocked(store.getProjectIdentity).mockReturnValue({ kind: "remote", id: "other-folder" });
      return brief;
    },
  };
  expect(await runStartScreenPresetInterview(handoff(brief.presetId), switching)).toBe("declined");
  expect(store.update).not.toHaveBeenCalled();
});

it("빈 프로젝트는 인터뷰를 열지 않는다", async () => {
  const interview = vi.fn();
  expect(await runStartScreenPresetInterview(handoff(null), { ensureAiConnected: async () => true, interview })).toBe("declined");
  expect(interview).not.toHaveBeenCalled();
});

it("an interview genre change replaces fresh system defaults and preserves the folder's map and resolution", async () => {
  const { createNewProjectSeed } = await import("@/editor/genrePacks");
  project = createNewProjectSeed("monster-collect", "우리 이야기");
  project.system.playResolution = { width: 640, height: 360 };
  const maps = project.maps;
  const brief = interviewBrief("story-cutscene");
  expect(await runStartScreenPresetInterview(handoff("monster-collect"), { ensureAiConnected: async () => true, interview: async () => brief })).toBe("brief");
  expect(project.system.genre).toBe("story-cutscene");
  expect(project.system.monsterCollection).not.toBe(true);
  expect(project.system.playResolution).toEqual({ width: 640, height: 360 });
  expect(project.maps).toBe(maps);
  expect(project.meta.title).toBe("우리 이야기");
  expect(project.gameDesignBrief?.generationPending).toBe(true);
});
