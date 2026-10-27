import { beforeEach, expect, it, vi } from "vitest";
import { prepareProjectInterviewStartup } from "@/editor/projectInterviewStartup";
import { store } from "@/project/store";
import { peekAiAssistantDraft, setPendingAiBootIntent } from "@/editor/aiBootIntent";
import { configureProjectInterviewBootPreparation } from "@/editor/projectInterviewBootPreparation";
import { isAssistantEndpointReady } from "@/ai/assistantEndpoint";
import { interviewBrief } from "./helpers/gameDesignBrief";
import type { Project } from "@/project/types";

// subscribe: mapEditHistory 가 불러오는 순간 store.subscribe 로 프로젝트 전환 초기화를 건다(가져오기 그래프에 들어옴).
// replace/applyPendingAiBootIntent/peekAiAssistantDraft/refreshAiConnectionStatus/playableSegment: 시작 경로가 뼈대·미리 채우기·연결 확인을
// 거치게 된 뒤(공개 기준선·8df789f9ad) 모의 객체가 그 이름을 내놓지 않아 try 안에서 바로 던졌다. test/projectInterviewStartup.test.ts 와 같은 모의.
vi.mock("@/project/store", () => ({ store: { getCurrent: vi.fn(), getProjectIdentity: vi.fn(), update: vi.fn(), replace: vi.fn(), flush: vi.fn(), subscribe: vi.fn(() => () => undefined) } }));
vi.mock("@/editor/aiBootIntent", () => ({ setPendingAiBootIntent: vi.fn(), applyPendingAiBootIntent: vi.fn(), peekAiAssistantDraft: vi.fn() }));
vi.mock("@/project/playableSegment", () => ({ preparePlayableSegmentAssets: vi.fn(async () => undefined), withVerifiedPlayableSegment: vi.fn(() => null) }));
vi.mock("@/util/toast", () => ({ toast: vi.fn() }));
vi.mock("@/ai/assistantEndpoint", () => ({ resolveSurfaceAiConfig: vi.fn(() => ({})), isAssistantEndpointReady: vi.fn(() => true) }));
vi.mock("@/editor/panels/aiConnectionStatus", () => ({ getAiConnectionStatus: vi.fn(() => ({})), refreshAiConnectionStatus: vi.fn(async () => {}), AI_CONNECTION_STATUS_CHANGED_EVENT: "oprn:ai-connection-status-changed" }));

let project: Project;
// 모듈이 마지막으로 넘긴 기획(queuedKey)을 기억하므로 테스트마다 다른 새 폴더로 연다.
let folder = 0;
beforeEach(() => {
  vi.clearAllMocks();
  // 사람이 쓴 초안이 있으면 저장 전 미리 채우기를 건너뛴다 — 이 파일은 저장 뒤 전달만 본다(미리 채우기는 projectInterviewStartup.test.ts).
  vi.mocked(peekAiAssistantDraft).mockReturnValue("existing user draft");
  configureProjectInterviewBootPreparation(async () => {});
  project = { system: {}, gameDesignBrief: { ...interviewBrief(), generationPending: true } } as Project;
  vi.mocked(store.getCurrent).mockImplementation(() => project);
  vi.mocked(store.getProjectIdentity).mockReturnValue({ kind: "remote", id: `new-folder-${++folder}` });
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
  // 프리셋 첫 생성은 이 한 턴만 팀으로 돈다(2026-09-27) — 사용자 팀 설정은 건드리지 않는다.
  expect(setPendingAiBootIntent).toHaveBeenCalledWith(expect.stringContaining(JSON.stringify(project.gameDesignBrief!.summary)), expect.objectContaining({ autoSend: true, team: true }));
  // 재시도 표지는 실행 경로가 요청을 받을 때 지운다(projectInterviewExecutionClaim.ts) — 전달 준비는 남겨 둔다.
  expect(project.gameDesignBrief!.generationPending).toBe(true);
  await prepareProjectInterviewStartup();
  expect(setPendingAiBootIntent).toHaveBeenCalledOnce();
});

it("does not send on save failure and leaves the brief resumable", async () => {
  vi.mocked(store.flush).mockResolvedValue({ kind: "disabled" });
  await prepareProjectInterviewStartup();
  expect(setPendingAiBootIntent).not.toHaveBeenCalled();
  expect(project.gameDesignBrief!.generationPending).toBe(true);
});

// 「claim mutation 거절 시 보내지 않는다」는 은퇴: 시작 단계의 claim(generationPending 지우기)이 실행 경로
// projectInterviewExecutionClaim.ts 로 옮겨졌다(공개 기준선). 거절 동작은 test/projectInterviewExecutionClaim.test.ts 가 본다.

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
  expect(setPendingAiBootIntent).toHaveBeenCalledWith(expect.stringContaining("공포"), expect.objectContaining({ autoSend: false, team: true }));
});
