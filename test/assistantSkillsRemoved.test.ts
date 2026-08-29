// 조수 "스킬" 기능(서랍·슬래시·팔레트 섹션·프롬프트 배관) 제거 회귀 테스트.
// 기계가 소비하는 값만 본다: 모듈 존재 여부, 팔레트 항목 kind, localStorage 키.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { EditorCommand } from "@/editor/commandRegistry";
import { buildPaletteEntries } from "@/editor/panels/commandPalette";
import { renderAiChatPanel } from "@/editor/panels/aiChatPanel";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { FakeElement, findByTestId, installFakeDom, renderWithFakeDom } from "./fakeDom";

const SKILL_STORAGE_KEYS = ["oprn:user-skills", "oprn:skill-recent"] as const;

let restoreDom: (() => void) | null = null;
let writtenKeys: string[] = [];

function installRecordingLocalStorage(): void {
  const storage = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    writable: true,
    value: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        writtenKeys.push(key);
        storage.set(key, String(value));
      },
      removeItem: (key: string) => void storage.delete(key),
      clear: () => storage.clear(),
    },
  });
}

function cmd(id: string, label: string): EditorCommand {
  return { id, label, category: "도구", keywords: [label], run: () => {} };
}

beforeEach(() => {
  store.replace(createBlankProject());
  restoreDom = installFakeDom();
  writtenKeys = [];
  installRecordingLocalStorage();
});

afterEach(() => {
  restoreDom?.();
  restoreDom = null;
  Reflect.deleteProperty(globalThis, "localStorage");
});

function renderPanel(): FakeElement {
  return renderWithFakeDom(() => renderAiChatPanel());
}

function expandPanel(panel: FakeElement): void {
  if (!panel.classList.contains("is-collapsed")) return;
  findByTestId(panel, "ai-collapsed-restore")?.click();
}

describe("조수 스킬 기능 제거", () => {
  it("@/ai/skills 모듈이 더 이상 존재하지 않는다", async () => {
    await expect(import("@/ai/skills")).rejects.toThrow();
  });

  it("커맨드 팔레트 항목 kind 에 skill 이 없다", () => {
    const entries = buildPaletteEntries("", {
      commands: Array.from({ length: 10 }, (_, i) => cmd(`c${i}`, `명령${i}`)),
      maps: Array.from({ length: 10 }, (_, i) => cmd(`m${i}`, `맵${i}`)),
    });
    expect(entries.length).toBeGreaterThan(0);
    expect([...new Set(entries.map((entry) => entry.kind))].sort()).toEqual(["command", "map"]);
  });

  it("입력창의 선행 / 는 일반 텍스트다 — 슬래시 팝오버가 없고 스킬 저장 키도 쓰지 않는다", () => {
    const panel = renderPanel();
    expandPanel(panel);
    const input = findByTestId(panel, "ai-input");
    if (!input) throw new Error("input missing");

    input.value = "/검증";
    input.dispatchEvent(new Event("input"));

    expect(findByTestId(panel, "ai-slash-list")).toBeNull();
    expect(findByTestId(panel, "ai-slash-host")).toBeNull();
    expect(findByTestId(panel, "ai-skill-drawer")).toBeNull();
    expect(findByTestId(panel, "ai-skill-slash-toggle")).toBeNull();
    expect(input.value).toBe("/검증");
    expect(writtenKeys.filter((key) => SKILL_STORAGE_KEYS.includes(key as (typeof SKILL_STORAGE_KEYS)[number]))).toEqual([]);
  });
});
