import { beforeEach, expect, it, vi } from "vitest";
import { prepareProjectInterviewStartup } from "@/editor/projectInterviewStartup";
import { store } from "@/project/store";
import { setPendingAiBootIntent } from "@/editor/aiBootIntent";
import { isAssistantEndpointReady } from "@/ai/assistantEndpoint";
import { interviewBrief } from "./helpers/gameDesignBrief";
import type { Project } from "@/project/types";

vi.mock("@/project/store", () => ({ store: { getCurrent: vi.fn(), getProjectIdentity: vi.fn(), update: vi.fn(), flush: vi.fn() } }));
vi.mock("@/editor/aiBootIntent", () => ({ setPendingAiBootIntent: vi.fn() }));
vi.mock("@/util/toast", () => ({ toast: vi.fn() }));
vi.mock("@/ai/assistantEndpoint", () => ({ resolveSurfaceAiConfig: vi.fn(() => ({})), isAssistantEndpointReady: vi.fn(() => true) }));
vi.mock("@/editor/panels/aiConnectionStatus", () => ({ getAiConnectionStatus: vi.fn(() => ({})) }));

let project: Project;
beforeEach(() => {
  vi.clearAllMocks();
  project = { gameDesignBrief: { ...interviewBrief(), generationPending: true } } as Project;
  vi.mocked(store.getCurrent).mockImplementation(() => project);
  vi.mocked(store.getProjectIdentity).mockReturnValue({ kind: "remote", id: "new-folder" });
  vi.mocked(store.update).mockImplementation(mutator => { mutator(project); });
  vi.mocked(store.flush).mockResolvedValue({ kind: "saved" });
  vi.mocked(isAssistantEndpointReady).mockReturnValue(true);
});

it("publishes the saved new folder's confirmed brief only after its pending claim is durable", async () => {
  let finish!: (value: { kind: "saved" }) => void;
  vi.mocked(store.flush).mockReturnValue(new Promise(resolve => { finish = resolve; }));
  const preparing = prepareProjectInterviewStartup();
  expect(setPendingAiBootIntent).not.toHaveBeenCalled();
  finish({ kind: "saved" }); await preparing;
  expect(setPendingAiBootIntent).toHaveBeenCalledWith(expect.stringContaining(JSON.stringify(project.gameDesignBrief!.summary)), { autoSend: true });
  expect(project.gameDesignBrief!.generationPending).toBeUndefined();
  await prepareProjectInterviewStartup();
  expect(setPendingAiBootIntent).toHaveBeenCalledOnce();
});

it("does not send on save failure and leaves the brief resumable", async () => {
  vi.mocked(store.flush).mockResolvedValue({ kind: "disabled" });
  await prepareProjectInterviewStartup();
  expect(setPendingAiBootIntent).not.toHaveBeenCalled();
  expect(project.gameDesignBrief!.generationPending).toBe(true);
});

it("does not send to a different project opened while saving", async () => {
  let finish!: (value: { kind: "saved" }) => void;
  vi.mocked(store.flush).mockReturnValue(new Promise(resolve => { finish = resolve; }));
  const pending = prepareProjectInterviewStartup();
  vi.mocked(store.getProjectIdentity).mockReturnValue({ kind: "remote", id: "different-folder" });
  finish({ kind: "saved" }); await pending;
  expect(setPendingAiBootIntent).not.toHaveBeenCalled();
});

it("prefills instead of launching a disconnected AI and preserves the same confirmed design", async () => {
  vi.mocked(isAssistantEndpointReady).mockReturnValue(false);
  await prepareProjectInterviewStartup();
  expect(setPendingAiBootIntent).toHaveBeenCalledWith(expect.stringContaining("공포"), { autoSend: false });
});
