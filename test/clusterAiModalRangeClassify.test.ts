// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import { locks } from "node:worker_threads";
import { AI_CONFIG_STORAGE_KEY } from "@/ai/llmClient";
import { editorState } from "@/editor/editorState";
import { openClusterAiModal } from "@/editor/panels/clusterAiModal";
import { createBlankProject } from "@/project/defaults";
import { DEFAULT_TILESET_ID } from "@/project/defaults/constants";
import { store } from "@/project/store";
import { installAdmitClient, PNG_1x1, whenDom } from "./aiJobAdmitSupport";

let harness: ReturnType<typeof installAdmitClient>;

beforeEach(async () => {
  vi.stubGlobal("indexedDB", new IDBFactory());
  vi.stubGlobal("navigator", { locks });
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
  await store.loadFallbackProject(createBlankProject());
  editorState.set({ currentMapId: store.getCurrent().startMapId, selection: null });
  harness = installAdmitClient();
});

afterEach(() => {
  document.querySelector<HTMLButtonElement>('[data-testid="cluster-ai-modal-close"]')?.click();
  document.body.replaceChildren();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("cluster AI range-classify modal", () => {
  it("opens range classify mode and sends the range-classify kickoff", async () => {
    const pending = harness.nextAdmitted();
    openClusterAiModal({
      kind: "range-classify",
      rect: { x: 2, y: 3, w: 4, h: 2 },
      tileIds: [10, 11, 12, 13, 14, 15, 16, 17],
      tilesetId: DEFAULT_TILESET_ID,
    });
    const admitted = await pending;
    const modal = requireTestId(document, "cluster-ai-modal");
    const input = requireTestId(modal, "cluster-ai-input");
    expect(modal.textContent).toContain("범위 분류 — 8개 타일");
    expect(input.getAttribute("rows")).toBe("3");
    expect(admitted.input.family).toBe("tileset");
    expect(admitted.input.payload.operation).toBe("range-classify");
    const kickoff = String(admitted.input.payload.instruction);
    expect(kickoff).toContain("suggest_group_from_range");
    expect(kickoff).toContain("render_group_sample");
    expect(kickoff).toContain("upsert_tile_group");
    expect(kickoff).toContain("이 분류로 저장");
    expect(kickoff).toContain("\"w\": 4");
  });

  it("enters suggest/image/one-tap flow and accepts the upsert proposal", async () => {
    const pending = harness.nextAdmitted();
    openClusterAiModal({
      kind: "range-classify",
      rect: { x: 5, y: 6, w: 2, h: 2 },
      tileIds: [20, 21, 22, 23],
      tilesetId: DEFAULT_TILESET_ID,
    });
    await pending;
    const generated = structuredClone(store.getCurrent());
    generated.meta.title = "Range Classified";
    generated.tilesets[DEFAULT_TILESET_ID].tileGroups = [
      ...(generated.tilesets[DEFAULT_TILESET_ID].tileGroups ?? []),
      {
        defaultLayer: "lower",
        description: "성벽",
        id: "wall-range",
        name: "성벽",
        placementRules: "",
        role: "wall",
        tileIds: [20, 21, 22, 23],
      },
    ];
    const previewRef = await harness.putBytes(PNG_1x1, "image/png");
    const stage = requireTestId(document, "cluster-ai-stage");
    const shown = whenDom(stage, () => stage.querySelectorAll("img").length === 1);
    await harness.complete({
      assistantText: "성벽 묶음으로 보입니다. [선택지] 이 분류로 저장 | 이름 바꿔 | 역할 바꿔 | 다시",
      proposedCalls: [{
        args: {
          name: "성벽",
          role: "wall",
          sourceRect: { height: 2, width: 2, x: 5, y: 6 },
          tileIds: [20, 21, 22, 23],
          tilesetId: DEFAULT_TILESET_ID,
        },
        destructive: false,
        name: "upsert_tile_group",
        result: { ok: true, summary: "성벽 그룹 생성" },
        summary: "성벽 그룹 생성",
      }],
      previews: [{ index: 0, status: "ready", images: [{ ref: previewRef, label: "범위 미리보기" }] }],
    }, undefined, generated);
    await shown;
    expect(stage.querySelectorAll("img")).toHaveLength(1);
    const choices = testIdElements(document, "cluster-ai-choice");
    expect(choices.map((choice) => choice.textContent)).toEqual(["이 분류로 저장", "이름 바꿔", "역할 바꿔", "다시"]);

    const follow = harness.nextAdmitted();
    choices[0]?.click();
    const second = await follow;
    expect(String(second.input.payload.instruction)).toContain("이 분류로 저장");

    await harness.complete({
      assistantText: "저장 제안입니다.",
      proposedCalls: [{
        args: { name: "성벽", role: "wall", tileIds: [20, 21, 22, 23], tilesetId: DEFAULT_TILESET_ID },
        destructive: false,
        name: "upsert_tile_group",
        result: { ok: true, summary: "성벽 그룹 생성" },
        summary: "성벽 그룹 생성",
      }],
    }, undefined, generated);

    const applied = new Promise<void>((resolve, reject) => {
      const off = store.subscribe(() => {
        if (store.getCurrent().tilesets[DEFAULT_TILESET_ID].tileGroups?.some((group) => group.name === "성벽")) {
          off();
          resolve();
        }
      });
      setTimeout(() => { off(); reject(new Error("cluster apply did not land")); }, 5000);
    });
    requireTestId(document, "cluster-ai-accept").click();
    await applied;
  });

  it("keeps the textarea sized for multi-line input", async () => {
    const pending = harness.nextAdmitted();
    openClusterAiModal({
      kind: "range-classify",
      rect: { x: 1, y: 1, w: 1, h: 1 },
      tileIds: [1],
      tilesetId: DEFAULT_TILESET_ID,
    });
    await pending;
    const input = requireTestId(document, "cluster-ai-input");
    expect(input.getAttribute("rows")).toBe("3");
    expect(input.className).toContain("cluster-ai-input");
  });
});

function requireTestId(root: ParentNode, testId: string): HTMLElement {
  const element = root.querySelector(`[data-testid="${testId}"]`);
  if (!(element instanceof HTMLElement)) throw new Error(`Missing ${testId}`);
  return element;
}

function testIdElements(root: ParentNode, testId: string): HTMLElement[] {
  return Array.from(root.querySelectorAll(`[data-testid="${testId}"]`))
    .filter((node): node is HTMLElement => node instanceof HTMLElement);
}
