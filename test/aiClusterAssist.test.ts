import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AI_CONFIG_STORAGE_KEY, defaultAiConfig } from "@/ai/llmClient";
import { buildClusterEditKickoff, buildUnclassifiedAnalysisKickoff, type ClusterGroupSnapshot } from "@/ai/clusterAssistPrompt";
import { renderAiChatPanel } from "@/editor/panels/aiChatPanel";
import { runTool } from "@/editor/tools/toolRunner";
import type { ToolContext } from "@/editor/tools/types";
import { createBlankProject } from "@/project/defaults";
import { DEFAULT_TILESET_ID } from "@/project/defaults/constants";
import { store } from "@/project/store";
import { applyCombinedTownHarness, COMBINED_TOWN_HARNESS_GROUPS } from "@/project/tilesetHarness";
import type { TileGroupMetadata } from "@/project/types";
import { findByTestId, installFakeDom, renderWithFakeDom, type FakeElement } from "./fakeDom";

const assistantMock = vi.hoisted(() => {
  const sentMessages: string[] = [];

  class MockAssistantSession {
    constructor(_project: unknown, _options: unknown) {}

    async sendUserMessage(text: string, _onEvent: (event: unknown) => void): Promise<{
      assistantText: string;
      proposedCalls: [];
      stoppedReason: "final";
    }> {
      sentMessages.push(text);
      return { assistantText: "준비됐습니다.", proposedCalls: [], stoppedReason: "final" };
    }

    getAuditEntries(): [] {
      return [];
    }

    getActiveSpec(): null {
      return null;
    }

    getCompletionSpecs(): [] {
      return [];
    }


    // 패널은 턴마다 미완료 계획을 이어받으려 세션의 계획을 읽는다 — 더블은 계획 없음.

    getWorkPlan(): null {

      return null;

    }

    // 패널이 새 턴 직전 저장소 기준 동기화를 부른다 — 더블은 제안 없음(false)으로 답한다.
    syncBaselineFromStoreIfClean(_project: unknown): boolean {
      return false;
    }

    updateConfig(_config: unknown): void {}
  }

  return { MockAssistantSession, sentMessages };
});

vi.mock("@/ai/assistantSession", () => ({
  AssistantSession: assistantMock.MockAssistantSession,
  AGENT_RUN_MAX_TOTAL_STEPS: 48,
  METADATA_ONLY_TOOLS: new Set(["set_tile_metadata", "set_tile_rules", "upsert_tile_group"]),
}));

/** 킥오프 프롬프트에 실릴 그룹 스냅샷(구 skills.ts 의 clusterGroupSnapshot 로컬 픽스처). */
function groupSnapshot(tilesetId: string, groupId: string): ClusterGroupSnapshot | null {
  const group = store.getCurrent().tilesets[tilesetId]?.tileGroups?.find((entry) => entry.id === groupId);
  if (!group) return null;
  return {
    id: group.id,
    name: group.name,
    role: group.role,
    defaultLayer: group.defaultLayer,
    tileIds: [...group.tileIds],
    description: group.description,
    placementRules: group.placementRules,
    patternGrammar: group.patternGrammar ? { kind: group.patternGrammar.kind } : null,
  };
}

let restoreDom: (() => void) | null = null;
let restoreWindow: (() => void) | null = null;
let storage: Map<string, string>;

function installFakeLocalStorage(): void {
  storage = new Map();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    writable: true,
    value: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => void storage.set(key, String(value)),
      removeItem: (key: string) => void storage.delete(key),
      clear: () => storage.clear(),
    },
  });
}

function installFakeWindow(): () => void {
  const previous = globalThis.window;
  const listeners = new Map<string, Set<EventListener>>();
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    writable: true,
    value: {
      location: { search: "aiBridge=0" },
      addEventListener: (type: string, listener: EventListener) => {
        const bucket = listeners.get(type) ?? new Set<EventListener>();
        bucket.add(listener);
        listeners.set(type, bucket);
      },
      removeEventListener: (type: string, listener: EventListener) => {
        listeners.get(type)?.delete(listener);
      },
      dispatchEvent: (event: Event): boolean => {
        for (const listener of listeners.get(event.type) ?? []) listener(event);
        return true;
      },
      clearTimeout: globalThis.clearTimeout,
      setTimeout: globalThis.setTimeout,
    },
  });
  return () => {
    if (previous === undefined) {
      Reflect.deleteProperty(globalThis, "window");
      return;
    }
    Object.defineProperty(globalThis, "window", { configurable: true, writable: true, value: previous });
  };
}

beforeEach(() => {
  restoreDom = installFakeDom();
  restoreWindow = installFakeWindow();
  installFakeLocalStorage();
  assistantMock.sentMessages.length = 0;
  store.replace(projectWithGroup());
});

afterEach(() => {
  restoreWindow?.();
  restoreWindow = null;
  restoreDom?.();
  restoreDom = null;
  Reflect.deleteProperty(globalThis, "localStorage");
});

describe("클러스터 AI 킥오프", () => {
  it("클러스터 수정/미분류 분석 킥오프에 그룹 JSON과 첫 배치가 들어간다", () => {
    const clusterPrompt = buildClusterEditKickoff({
      tilesetId: DEFAULT_TILESET_ID,
      groupId: "wall_group",
      group: groupSnapshot(DEFAULT_TILESET_ID, "wall_group"),
    });
    expect(clusterPrompt).toContain("render_group_sample");
    expect(clusterPrompt).toContain("delete_tile_group");
    expect(clusterPrompt).toContain("\"name\": \"담장\"");
    expect(clusterPrompt).toContain("\"kind\": \"horizontal_expandable\"");
    expect(clusterPrompt).toContain("[선택지] 이름 변경 | 역할 변경 | 타일 추가·제거 | 구조 규칙 저작 | 그룹 해체");
    expect(clusterPrompt).toContain("junction");
    expect(clusterPrompt).toContain("overlay");
    expect(clusterPrompt).toContain("전/후 이미지");
    expect(clusterPrompt).toContain("set_group_junction");
    expect(clusterPrompt).toContain("set_group_overlay");

    const analysisPrompt = buildUnclassifiedAnalysisKickoff({
      tilesetId: DEFAULT_TILESET_ID,
      sampleTiles: [3, 4, 5],
      total: 12,
    });
    expect(analysisPrompt).toContain("render_group_sample");
    expect(analysisPrompt).toContain("list_unclassified_tiles");
    expect(analysisPrompt).toContain("\"sampleTiles\": [");
    expect(analysisPrompt).toContain("3");
    expect(analysisPrompt).toContain("\"total\": 12");
  });
});

describe("AI 패널 브리지", () => {
  it("cluster-edit 이벤트가 접힌 패널을 펼치고 클러스터 킥오프를 전송 경로로 보낸다", async () => {
    storage.set("oprn:ai-map-first-collapse-v1", "1");
    storage.set("oprn:ai-panel-collapsed", "1");
    storage.set(AI_CONFIG_STORAGE_KEY, JSON.stringify({ ...defaultAiConfig(), apiKey: "sk-or-test" }));
    const panel = renderWithFakeDom(() => renderAiChatPanel({ getChatDock: () => "side" })) as FakeElement;
    expect(panel.classList.contains("is-collapsed")).toBe(true);

    window.dispatchEvent(new CustomEvent("oprn:ai-assist", {
      detail: { kind: "cluster-edit", tilesetId: DEFAULT_TILESET_ID, groupId: "wall_group" },
    }));
    await flushMicrotasks();

    expect(panel.classList.contains("is-collapsed")).toBe(false);
    // 자동 펼침은 사용자의 저장된 접힘 선택("1")을 덮어쓰지 않는다.
    expect(storage.get("oprn:ai-panel-collapsed")).toBe("1");
    expect(assistantMock.sentMessages).toHaveLength(1);
    expect(assistantMock.sentMessages[0]).toContain("클러스터 수정");
    expect(assistantMock.sentMessages[0]).toContain("\"id\": \"wall_group\"");
    expect(findByTestId(panel, "ai-command-row-user")?.textContent).toContain("클러스터 수정");
  });
});

describe("list_unclassified_tiles", () => {
  it("라벨 있거나 그룹에 속한 타일을 제외하고 offset/limit 페이지와 total을 반환한다", () => {
    const context = unclassifiedCtx();
    const result = runTool(context, "list_unclassified_tiles", { tilesetId: DEFAULT_TILESET_ID, offset: 1, limit: 2 });

    expect(result.ok, result.summary).toBe(true);
    expect(result.data).toEqual({
      tilesetId: DEFAULT_TILESET_ID,
      limit: 2,
      offset: 1,
      total: 4,
      tiles: [4, 5],
    });
  });
});

describe("delete_tile_group", () => {
  it("그룹을 삭제하고 없는 groupId는 에러로 돌려준다", () => {
    const context = ctx();
    const deleted = runTool(context, "delete_tile_group", { tilesetId: DEFAULT_TILESET_ID, groupId: "wall_group" });
    expect(deleted.ok, deleted.summary).toBe(true);
    expect(context.project.tilesets[DEFAULT_TILESET_ID].tileGroups?.some((group) => group.id === "wall_group")).toBe(false);

    const missing = runTool(context, "delete_tile_group", { tilesetId: DEFAULT_TILESET_ID, groupId: "wall_group" });
    expect(missing.ok).toBe(false);
    expect(missing.issues?.[0]?.code).toBe("group-not-found");
  });

  it("기본 Combined Town 하네스 그룹 삭제는 tombstone을 남겨 재시드를 막는다", () => {
    const context = { project: createBlankProject() };
    const groupId = COMBINED_TOWN_HARNESS_GROUPS.find((group) => group.id.endsWith("conifer-tree"))?.id;
    if (!groupId) throw new Error("missing conifer harness group");

    const deleted = runTool(context, "delete_tile_group", { tilesetId: DEFAULT_TILESET_ID, groupId });
    expect(deleted.ok, deleted.summary).toBe(true);

    const tileset = context.project.tilesets[DEFAULT_TILESET_ID];
    expect(tileset.suppressedHarnessGroupIds).toContain(groupId);
    applyCombinedTownHarness(tileset);
    expect(tileset.tileGroups?.some((group) => group.id === groupId)).toBe(false);
  });
});

function ctx(): ToolContext {
  return { project: projectWithGroup() };
}

function unclassifiedCtx(): ToolContext {
  return { project: projectWithSmallTileset() };
}

function projectWithGroup(): ReturnType<typeof createBlankProject> {
  const project = createBlankProject();
  const tileset = project.tilesets[DEFAULT_TILESET_ID];
  tileset.tileGroups = [group()];
  return project;
}

function projectWithSmallTileset(): ReturnType<typeof createBlankProject> {
  const project = createBlankProject();
  const tileset = project.tilesets[DEFAULT_TILESET_ID];
  tileset.count = 8;
  tileset.tileMeta = Array.from({ length: tileset.count }, () => ({ label: "", description: "" }));
  tileset.tileMeta[1].label = "창문";
  tileset.tileGroups = [group()];
  return project;
}

function group(): TileGroupMetadata {
  return {
    defaultLayer: "upper",
    description: "담장 모서리와 몸통 타일",
    id: "wall_group",
    name: "담장",
    patternGrammar: {
      kind: "horizontal_expandable",
      parts: [{ role: "repeatBody", tileIds: [0, 2, 7] }],
      preserveCaps: true,
      repeat: "body",
    },
    placementRules: "길 가장자리에 가로로 반복",
    role: "wall",
    tileIds: [0, 2, 7],
  };
}

async function flushMicrotasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}
