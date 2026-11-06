/** @vitest-environment happy-dom */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { firstPromptImages, parseUserImageDataUrls } from "@/ai/piAgent/userImages";
import { takeStartScreenIntent, writeStartScreenIntent } from "@/start/startIntent";
import {
  applyPendingAiBootIntent,
  clearPendingAiBootIntent,
  peekPendingAiBootReferenceImages,
  registerAiBootIntentTarget,
  setPendingAiBootIntent,
  setPendingAiBootReferenceImages,
} from "@/editor/aiBootIntent";
import { runPiTeam } from "../scripts/lib/piTeamRuntime";
import { defaultTeamSpec } from "@/ai/piAgent/teamSpec";
import { createBlankProject } from "@/project/defaults";
import type { PiAgentDoneEvent, PiAgentRequest } from "@/ai/piAgent/protocol";

const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jZ1kAAAAASUVORK5CYII=";
const JPEG = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2w==";

function memoryStorage(): Pick<Storage, "getItem" | "setItem" | "removeItem"> {
  const map = new Map<string, string>();
  return { getItem: (key) => map.get(key) ?? null, setItem: (key, value) => { map.set(key, value); }, removeItem: (key) => { map.delete(key); } };
}

beforeEach(() => {
  clearPendingAiBootIntent();
  registerAiBootIntentTarget(null);
});

describe("첫 화면 참고 그림", () => {
  it("그림 data URL 만 최대 2장 남긴다", () => {
    expect(parseUserImageDataUrls([PNG, "https://example.com/a.png", 3, "data:text/plain;base64,QQ==", JPEG, PNG])).toEqual([PNG, JPEG]);
    expect(parseUserImageDataUrls("nope")).toEqual([]);
  });

  it("그림을 받는 모델이면 첫 차례에 그림 파트를 싣고, 못 받는 엔진이면 글만 보낸다", () => {
    const vision = firstPromptImages({ urls: [PNG, JPEG], localCli: undefined, modelInput: ["text", "image"] });
    expect(vision.dropped).toBe(0);
    expect(vision.images).toEqual([
      { type: "image", mimeType: "image/png", data: PNG.split(",")[1], detail: "high" },
      { type: "image", mimeType: "image/jpeg", data: JPEG.split(",")[1], detail: "high" },
    ]);
    expect(firstPromptImages({ urls: [PNG], localCli: undefined, modelInput: ["text"] })).toEqual({ images: [], dropped: 1 });
    expect(firstPromptImages({ urls: [PNG], localCli: "gemini", modelInput: undefined })).toEqual({ images: [], dropped: 1 });
    expect(firstPromptImages({ urls: undefined, localCli: undefined, modelInput: ["text"] })).toEqual({ images: [], dropped: 0 });
  });

  it("로컬 Claude Code·Codex 엔진은 첫 차례에 그림을 싣는다(구독 경로에서 도안이 버려지던 결함)", () => {
    for (const cli of ["claude", "codex"] as const) {
      const local = firstPromptImages({ urls: [PNG], localCli: cli, modelInput: ["text"] });
      expect(local).toEqual({ images: [{ type: "image", mimeType: "image/png", data: PNG.split(",")[1], detail: "high" }], dropped: 0 });
    }
  });

  it("시작 화면 인계는 틀린 그림만 버리고 인계 자체는 살린다", () => {
    const storage = memoryStorage();
    const base = { projectDir: "/games/새 게임", title: "새 게임", choiceId: null, intent: "등대 마을" };
    writeStartScreenIntent(storage, { ...base, referenceImages: [PNG, "javascript:alert(1)", JPEG] }, 1_000);
    expect(takeStartScreenIntent(storage, base.projectDir, 2_000)?.referenceImages).toEqual([PNG, JPEG]);
    writeStartScreenIntent(storage, { ...base, referenceImages: ["bad"] }, 1_000);
    const kept = takeStartScreenIntent(storage, base.projectDir, 2_000);
    expect(kept).toMatchObject(base);
    expect(kept && "referenceImages" in kept).toBe(false);
  });

  it("미리 담기 동안 그림을 들고 있다가 실제로 보낼 때 send 옵션으로 넘기고 비운다", () => {
    const prefill = vi.fn();
    const send = vi.fn();
    registerAiBootIntentTarget({ open: vi.fn(), prefill, send });
    setPendingAiBootReferenceImages([PNG]);
    setPendingAiBootIntent("장르 프리셋: 모험", { autoSend: false, displayText: "모험", team: true });
    applyPendingAiBootIntent();
    expect(prefill).toHaveBeenCalledWith("장르 프리셋: 모험", "모험", { team: true, images: [PNG] });
    expect(peekPendingAiBootReferenceImages()).toEqual([PNG]);
    setPendingAiBootIntent("장르 프리셋: 모험", { autoSend: true, displayText: "모험", team: true });
    applyPendingAiBootIntent();
    expect(send).toHaveBeenCalledWith("장르 프리셋: 모험", "모험", { team: true, images: [PNG] });
    expect(peekPendingAiBootReferenceImages()).toEqual([]);
  });

  it("팀 실행은 처음 도는 실행 하나에만 그림을 넘긴다", async () => {
    const calls: PiAgentRequest[] = [];
    const project = createBlankProject();
    await runPiTeam({ mode: "team", provider: "test", task: "등대 마을을 지어라", project, mapIds: [], userImages: [PNG], team: { ...defaultTeamSpec(), reviewAfterWork: false } }, {
      runAgent: async (request): Promise<PiAgentDoneEvent> => {
        calls.push(request);
        return { type: "done", project: request.project, stats: { ms: 1, turns: 1, toolCalls: 0, toolErrors: 0 }, changedKeys: [] };
      },
    }).catch(() => undefined);
    expect(calls.length).toBeGreaterThan(0);
    expect(calls[0]!.userImages).toEqual([PNG]);
    expect(calls.slice(1).every((request) => request.userImages === undefined)).toBe(true);
  });
});
