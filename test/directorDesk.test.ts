import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { briefingDeficit, directorStartPrompts, readAgentBrief } from "@/editor/panels/aiAgentBrief";
import {
  DIRECTOR_MODE_LABEL,
  buildPlanSteps,
  canApplyWrites,
  sendGateForMode,
} from "@/editor/panels/aiDirectorMode";
import { buildWorkStripModel } from "@/editor/panels/aiWorkStrip";
import {
  SELECTION_MINIBAR_ACTIONS,
  installSelectionMinibar,
  selectionMinibarLabel,
} from "@/editor/selectionMinibar";
import { editorState } from "@/editor/editorState";
import { resetEditorUiModeForTests } from "@/editor/editorUiMode";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { renderAiChatPanel } from "@/editor/panels/aiChatPanel";
import { toolbarButton } from "@/editor/panels/menuToolbar";
import { installFakeDom, findByTestId, renderWithFakeDom } from "./fakeDom";

const STUDIO_TOKENS = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../src/styles/shell/studio-tokens.css"),
  "utf8",
);
const STUDIO_LAYOUT = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../src/styles/shell/studio-layout.css"),
  "utf8",
);
const RUNTIME_TOKENS = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../src/styles/dialogue.css"),
  "utf8",
);

describe("Unity-toned studio tokens", () => {
  it("editor-ui remap is dark and no longer fills chrome with beige", () => {
    expect(STUDIO_TOKENS).toContain("--studio-chrome: #191919");
    expect(STUDIO_TOKENS).toContain("--studio-chrome-2: #383838");
    expect(STUDIO_TOKENS).toContain("--studio-inset: #2a2a2a");
    expect(STUDIO_TOKENS).toContain("--studio-command: #4c7eff");
    expect(STUDIO_TOKENS).not.toMatch(/body\.editor-ui-[\w|,\s-]+\{[^}]*--studio-chrome:\s*#d4d0c8/u);
    expect(STUDIO_TOKENS).not.toContain("#ece7da");
    expect(STUDIO_TOKENS).not.toContain("#d4d0c8");
  });

  it("does not rewrite the runtime token sheet", () => {
    expect(RUNTIME_TOKENS).toMatch(/--runtime-/);
  });

  it("side dock is a 3-column rail: AI, left drawer, canvas", () => {
    expect(STUDIO_LAYOUT).toMatch(
      /grid-template-columns:\s*var\(--ai-chat-side-width,\s*420px\)\s+var\(--left-drawer-width,\s*220px\)\s+var\(--left-resizer-width,\s*6px\)\s+minmax\(0,\s*1fr\)/,
    );
    expect(STUDIO_LAYOUT).toContain(".classic-toolbar-stub");
    expect(STUDIO_LAYOUT).toContain("display: none !important");
    expect(STUDIO_LAYOUT).toContain(".db-required-panel.db-required-hero");
    expect(STUDIO_LAYOUT).toContain("database-modal-header");
    expect(STUDIO_LAYOUT).toContain("0 12px 28px rgba(0, 0, 0, 0.42)");
    expect(STUDIO_LAYOUT).toContain("border-radius: 10px");
  });
});

describe("director briefing and modes", () => {
  beforeEach(() => {
    store.replace(createBlankProject());
    resetEditorUiModeForTests("standard");
    editorState.set({
      currentMapId: store.getCurrent().startMapId,
      layer: "lower",
      tool: "paint",
      selection: null,
    });
  });

  afterEach(() => {
    resetEditorUiModeForTests("standard");
  });

  it("briefing names the map and lists empty-map deficits", () => {
    const brief = readAgentBrief();
    expect(brief.mapName).toBe("빈 맵");
    expect(brief.deficit).toContain("입구 없음");
    expect(brief.deficit).toContain("길 없음");
    expect(brief.deficit).toContain("사람 0");
    expect(briefingDeficit({ hasPath: false, hasEntrance: false, eventCount: 0 })).toContain("사람 0");
  });

  it("start prompts are at most three next moves", () => {
    const prompts = directorStartPrompts(readAgentBrief());
    expect(prompts.length).toBeLessThanOrEqual(3);
    expect(prompts.length).toBeGreaterThan(0);
  });

  it("selection updates the brief string to include 선택", () => {
    const mapId = store.getCurrent().startMapId;
    editorState.set({
      selection: { mapId, x: 2, y: 1, width: 4, height: 3 },
    });
    expect(readAgentBrief().line).toContain("선택 4×3");
    expect(selectionMinibarLabel(editorState.get().selection!)).toBe("선택 4×3");
  });

  it("지시 writes, 질문 never writes, 계획 writes only after confirm", () => {
    expect(DIRECTOR_MODE_LABEL.instruct).toBe("지시");
    expect(DIRECTOR_MODE_LABEL.ask).toBe("질문");
    expect(DIRECTOR_MODE_LABEL.plan).toBe("계획");
    expect(sendGateForMode("instruct")).toBe("write");
    expect(sendGateForMode("ask")).toBe("read-only");
    expect(sendGateForMode("plan")).toBe("confirm-before-write");
    expect(canApplyWrites("instruct", false)).toBe(true);
    expect(canApplyWrites("ask", true)).toBe(false);
    expect(canApplyWrites("plan", false)).toBe(false);
    expect(canApplyWrites("plan", true)).toBe(true);
    expect(buildPlanSteps("길 깔기. 집 한 채").length).toBe(2);
  });
});

describe("work strip and selection minibar", () => {
  let restoreDom: (() => void) | null = null;

  beforeEach(() => {
    restoreDom = installFakeDom();
    const storage = new Map<string, string>();
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
    store.replace(createBlankProject());
    editorState.set({
      currentMapId: store.getCurrent().startMapId,
      selection: null,
    });
  });

  afterEach(() => {
    restoreDom?.();
    restoreDom = null;
    Reflect.deleteProperty(globalThis, "localStorage");
  });

  it("builds a confirm-before-write plan strip", () => {
    const model = buildWorkStripModel({
      busy: false,
      pendingProposal: false,
      planSteps: ["길", "집"],
      planConfirmed: false,
    });
    expect(model?.title).toContain("계획");
    expect(model?.steps).toHaveLength(2);
    expect(model?.steps.every((step) => !step.done)).toBe(true);
  });

  it("mounts a minibar when the live selection is set", () => {
    const host = document.createElement("div");
    const picked: string[] = [];
    const stop = installSelectionMinibar(host, (instruction) => picked.push(instruction));
    expect(host.querySelector("[data-testid='selection-minibar']")).toBeNull();
    const mapId = store.getCurrent().startMapId;
    editorState.set({
      selection: { mapId, x: 0, y: 0, width: 3, height: 2 },
    });
    const bar = findByTestId(host as never, "selection-minibar");
    expect(bar).toBeTruthy();
    expect(bar?.textContent).toContain("선택 3×2");
    findByTestId(host as never, "selection-minibar-path")?.click();
    expect(picked[0]).toContain("오솔길");
    expect(SELECTION_MINIBAR_ACTIONS).toHaveLength(3);
    stop();
  });

  it("패널에서 계획 모드 전송은 확인 전에는 쓰지 않고 스트립을 연다", () => {
    const panel = renderWithFakeDom(() => renderAiChatPanel());
    findByTestId(panel, "ai-director-mode-plan")?.click();
    const input = findByTestId(panel, "ai-input") as unknown as { value: string };
    input.value = "광장 만들고 집 한 채";
    findByTestId(panel, "ai-send")?.click();
    expect(findByTestId(panel, "ai-work-strip")?.textContent).toContain("계획");
    expect(findByTestId(panel, "ai-plan-confirm")).toBeTruthy();
    expect(findByTestId(panel, "ai-bubble-user")).toBeNull();
  });

  it("empty start title is the map briefing, not a SaaS prompt catalog", () => {
    const panel = renderWithFakeDom(() => renderAiChatPanel());
    expect(findByTestId(panel, "ai-start-empty-hint")?.textContent).toBe("지금 이 맵");
    expect(panel.textContent ?? "").not.toContain("무엇을 만들까요?");
  });

  it("classic toolbar stubs keep their testid and extra class", () => {
    const button = toolbarButton({
      extraClass: "classic-toolbar-stub",
      icon: "disabled-diamond",
      label: "새 프로젝트",
      onClick: () => undefined,
      testId: "toolbar-new",
      title: "새 프로젝트",
      disabled: true,
    });
    expect(button.classList.contains("classic-toolbar-stub")).toBe(true);
    expect(button.dataset.testid).toBe("toolbar-new");
  });
});
