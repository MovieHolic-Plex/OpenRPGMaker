// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AI_CONFIG_STORAGE_KEY } from "@/ai/llmClient";
import { editorState } from "@/editor/editorState";
import { openClusterAiModal } from "@/editor/panels/clusterAiModal";
import { createBlankProject } from "@/project/defaults";
import { DEFAULT_TILESET_ID } from "@/project/defaults/constants";
import { store } from "@/project/store";
import type { TileGroupMetadata } from "@/project/types";
import { installAdmitClient, PNG_1x1, whenDom } from "./aiJobAdmitSupport";

let jobs: ReturnType<typeof installAdmitClient>;

beforeEach(async () => {
  const storage = new Map<string, string>();
  storage.set(AI_CONFIG_STORAGE_KEY, JSON.stringify({
    authMode: "apiKey",
    apiKey: "test-key",
    baseUrl: "https://example.test",
    maxTokens: 1024,
    model: "test-model",
    reasoningEffort: "medium",
  }));
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => void storage.set(key, String(value)),
      removeItem: (key: string) => void storage.delete(key),
      clear: () => storage.clear(),
    },
  });
  store._setPersistenceStateForTest({ loaded: true, remotePersistenceEnabled: false, disabledReason: "load-failed" });
  const project = createBlankProject();
  project.tilesets[DEFAULT_TILESET_ID].tileGroups = [makeFenceGroup()];
  await store.loadFallbackProject(project);
  editorState.set({ currentMapId: store.getCurrent().startMapId, selection: null });
  jobs = installAdmitClient();
});

afterEach(() => {
  document.querySelector<HTMLButtonElement>('[data-testid="cluster-ai-modal-close"]')?.click();
  document.body.replaceChildren();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("cluster AI image-first modal", () => {
  it("renders two captured preview refs as before-after stage cards", async () => {
    const pending = jobs.nextAdmitted();
    openClusterAiModal({ kind: "cluster-edit", tilesetId: DEFAULT_TILESET_ID, groupId: "fence-main" });
    await pending;
    const ref = await jobs.putBytes(PNG_1x1, "image/png");
    const stage = requireTestId(document, "cluster-ai-stage");
    const shown = whenDom(stage, () => Boolean(stage.querySelector("[data-testid='cluster-ai-beforeafter']")));
    await jobs.complete({
      assistantText: "비교 미리보기",
      proposedCalls: [],
      previews: [{
        index: 0,
        status: "ready",
        images: [
          { ref, label: "수정 전" },
          { ref, label: "수정 후" },
        ],
      }],
    });
    await shown;
    const beforeAfter = requireTestId(stage, "cluster-ai-beforeafter");
    expect(beforeAfter.querySelectorAll("img")).toHaveLength(2);
    expect(beforeAfter.textContent).toContain("수정 전");
    expect(beforeAfter.textContent).toContain("수정 후");
  });

  it("maps internal preview labels to user-facing captions", async () => {
    const pending = jobs.nextAdmitted();
    openClusterAiModal({ kind: "cluster-edit", tilesetId: DEFAULT_TILESET_ID, groupId: "fence-main" });
    await pending;
    const ref = await jobs.putBytes(PNG_1x1, "image/png");
    const stage = requireTestId(document, "cluster-ai-stage");
    const shown = whenDom(stage, () => (stage.textContent ?? "").includes("현재 모습"));
    await jobs.complete({
      assistantText: "샘플 렌더",
      proposedCalls: [],
      previews: [{ index: 0, status: "ready", images: [{ ref, label: "render_group_sample" }] }],
    });
    await shown;
    expect(stage.textContent).toContain("현재 모습");
    expect(stage.textContent).not.toContain("render_group_sample");
  });

  it("renders one captured preview as a single large stage image", async () => {
    const pending = jobs.nextAdmitted();
    openClusterAiModal({ kind: "cluster-edit", tilesetId: DEFAULT_TILESET_ID, groupId: "fence-main" });
    await pending;
    const ref = await jobs.putBytes(PNG_1x1, "image/png");
    const stage = requireTestId(document, "cluster-ai-stage");
    const shown = whenDom(stage, () => stage.querySelectorAll("img").length === 1);
    await jobs.complete({
      assistantText: "타일 보기",
      proposedCalls: [],
      previews: [{ index: 0, status: "ready", images: [{ ref, label: "타일 보기" }] }],
    });
    await shown;
    expect(stage.querySelectorAll("img")).toHaveLength(1);
    expect(stage.querySelector("[data-testid='cluster-ai-beforeafter']")).toBeNull();
    expect(stage.textContent).toContain("타일 보기");
  });

  it("renders assistant choices and sends a clicked one as the next message", async () => {
    const pending = jobs.nextAdmitted();
    openClusterAiModal({ kind: "cluster-edit", tilesetId: DEFAULT_TILESET_ID, groupId: "fence-main" });
    await pending;
    const shown = whenDom(document.body, () => testIdElements(document, "cluster-ai-choice").length === 2);
    await jobs.complete({
      assistantText: "어떻게 할까요? [선택지] 적용 | 다시 보기",
      proposedCalls: [],
    });
    await shown;
    const choices = testIdElements(document, "cluster-ai-choice");
    expect(choices).toHaveLength(2);
    const follow = jobs.nextAdmitted();
    choices[0]?.click();
    const next = await follow;
    expect(String(next.input.payload.instruction)).toContain("적용");
  });

  it("keeps long assistant prose as a single caption line", async () => {
    const longText = `첫 줄입니다.\n${"아주 긴 설명 ".repeat(40)}끝`;
    const pending = jobs.nextAdmitted();
    openClusterAiModal({ kind: "cluster-edit", tilesetId: DEFAULT_TILESET_ID, groupId: "fence-main" });
    await pending;
    const shown = whenDom(document.body, () => assistantBubbles().length > 0);
    await jobs.complete({ assistantText: longText, proposedCalls: [] });
    await shown;
    const assistantBubble = assistantBubbles()[0];
    expect(assistantBubble?.textContent).not.toContain("\n");
    expect((assistantBubble?.textContent ?? "").length).toBeLessThan(longText.length);
    expect(assistantBubble?.textContent).toContain("...");
  });

  it("delayed preview bytes after close do not allocate stage URLs", async () => {
    const pending = jobs.nextAdmitted();
    openClusterAiModal({ kind: "cluster-edit", tilesetId: DEFAULT_TILESET_ID, groupId: "fence-main" });
    await pending;
    const ref = await jobs.putBytes(PNG_1x1, "image/png");
    const gate = jobs.holdArtifact(ref.sha256);
    const created: string[] = [];
    const original = URL.createObjectURL.bind(URL);
    vi.spyOn(URL, "createObjectURL").mockImplementation((blob) => {
      const url = original(blob);
      created.push(url);
      return url;
    });
    await jobs.complete({
      assistantText: "A",
      proposedCalls: [],
      previews: [{ index: 0, status: "ready", images: [{ ref, label: "A 미리보기" }] }],
    });
    await gate.started;
    document.querySelector<HTMLButtonElement>('[data-testid="cluster-ai-modal-close"]')?.click();
    expect(document.querySelector('[data-testid="cluster-ai-modal"]')).toBeNull();
    gate.release();
    await gate.idle;
    expect(created).toEqual([]);
    expect(document.querySelector('[data-testid="cluster-ai-stage"]')).toBeNull();
  });

  it("delayed A preview does not replace B stage after B is current", async () => {
    const first = jobs.nextAdmitted();
    openClusterAiModal({ kind: "cluster-edit", tilesetId: DEFAULT_TILESET_ID, groupId: "fence-main" });
    await first;
    const refA = await jobs.putBytes(PNG_1x1, "image/png");
    const gateA = jobs.holdArtifact(refA.sha256);
    await jobs.complete({
      assistantText: "A",
      proposedCalls: [],
      previews: [{ index: 0, status: "ready", images: [{ ref: refA, label: "A 미리보기" }] }],
    });
    await gateA.started;
    const input = requireTestId(document, "cluster-ai-input");
    const send = requireTestId(document, "cluster-ai-send");
    input.value = "다시";
    const second = jobs.nextAdmitted();
    send.click();
    await second;
    const refB = await jobs.putBytes(Uint8Array.from([...PNG_1x1, 1]), "image/png");
    const stage = requireTestId(document, "cluster-ai-stage");
    const shownB = whenDom(stage, () => (stage.textContent ?? "").includes("B 미리보기"));
    await jobs.complete({
      assistantText: "B",
      proposedCalls: [],
      previews: [{ index: 0, status: "ready", images: [{ ref: refB, label: "B 미리보기" }] }],
    });
    await shownB;
    gateA.release();
    await gateA.idle;
    expect(stage.textContent).toContain("B 미리보기");
    expect(stage.textContent).not.toContain("A 미리보기");
  });

  it("revokes the first preview URL if a later verifiedArtifact read fails", async () => {
    const pending = jobs.nextAdmitted();
    openClusterAiModal({ kind: "cluster-edit", tilesetId: DEFAULT_TILESET_ID, groupId: "fence-main" });
    await pending;
    const refA = await jobs.putBytes(PNG_1x1, "image/png");
    const refB = await jobs.putBytes(Uint8Array.from([...PNG_1x1, 2]), "image/png");
    jobs.failArtifact(refB.sha256);
    const created: string[] = [];
    const revoked: string[] = [];
    const originalCreate = URL.createObjectURL.bind(URL);
    const originalRevoke = URL.revokeObjectURL.bind(URL);
    vi.spyOn(URL, "createObjectURL").mockImplementation((blob) => {
      const url = originalCreate(blob);
      created.push(url);
      return url;
    });
    vi.spyOn(URL, "revokeObjectURL").mockImplementation((url) => {
      revoked.push(String(url));
      originalRevoke(url);
    });
    const failed = whenDom(document.body, () => (document.querySelector('[data-testid="cluster-ai-status"]')?.textContent ?? "") === "실패");
    await jobs.complete({
      assistantText: "A",
      proposedCalls: [],
      previews: [{
        index: 0,
        status: "ready",
        images: [
          { ref: refA, label: "A 미리보기" },
          { ref: refB, label: "B 미리보기" },
        ],
      }],
    });
    await failed;
    expect(created.length).toBeGreaterThan(0);
    expect(revoked).toEqual(created);
    expect(requireTestId(document, "cluster-ai-stage").textContent ?? "").not.toContain("A 미리보기");
  });
});

function makeFenceGroup(): TileGroupMetadata {
  return {
    defaultLayer: "lower",
    description: "나무 울타리",
    id: "fence-main",
    name: "울타리",
    placementRules: "경계선에 배치",
    role: "fence",
    tileIds: [1, 2, 3],
  };
}

function assistantBubbles(): HTMLElement[] {
  return Array.from(document.querySelectorAll(".cluster-ai-bubble"))
    .filter((node): node is HTMLElement => node instanceof HTMLElement && node.className.includes("assistant"));
}

function requireTestId(root: ParentNode, testId: string): HTMLElement {
  const element = root.querySelector(`[data-testid="${testId}"]`);
  if (!(element instanceof HTMLElement)) throw new Error(`Missing ${testId}`);
  return element;
}

function testIdElements(root: ParentNode, testId: string): HTMLElement[] {
  return Array.from(root.querySelectorAll(`[data-testid="${testId}"]`))
    .filter((node): node is HTMLElement => node instanceof HTMLElement);
}
