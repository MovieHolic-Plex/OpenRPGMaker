// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AiConfig } from "@/ai/llmClient";
import { openDatabaseAiGenerateDialog } from "@/editor/panels/databaseAiGenerateDialog";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { installAdmitClient, whenDom } from "./aiJobAdmitSupport";

function config(): AiConfig {
  return {
    authMode: "chatgpt",
    providerId: "google-antigravity",
    baseUrl: "",
    model: "gemini-3.7-flash",
    liteModel: "gemini-3.7-flash",
    apiKey: "",
    maxToolCalls: 10,
    maxTokens: 1000,
    reasoningEffort: "low",
    agentMode: "auto",
  } as AiConfig;
}

let harness: ReturnType<typeof installAdmitClient>;

beforeEach(async () => {
  store._setPersistenceStateForTest({ loaded: true, remotePersistenceEnabled: false, disabledReason: "load-failed" });
  await store.loadFallbackProject(createBlankProject());
  harness = installAdmitClient();
});

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("openDatabaseAiGenerateDialog", () => {
  it("현대 대화상자 뼈대: 제목·설명·예시 칩·그림 옵션·만들기, 열자마자 설명에 포커스", () => {
    const overlay = openDatabaseAiGenerateDialog({ kind: "enemy", rerender: () => undefined, deps: { loadConfig: config } });
    const dialog = overlay.querySelector<HTMLElement>("[role='dialog']")!;
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(dialog.querySelector("h2")?.textContent).toContain("몬스터");
    const brief = overlay.querySelector<HTMLTextAreaElement>("[data-testid='db-ai-generate-brief']")!;
    expect(document.activeElement).toBe(brief);
    expect(overlay.querySelectorAll("[data-testid^='db-ai-generate-example-']").length).toBeGreaterThanOrEqual(2);
    expect(overlay.querySelector<HTMLInputElement>("[data-testid='db-ai-generate-artwork']")?.checked).toBe(true);
    expect(overlay.querySelector("[data-testid='db-ai-generate-run']")?.textContent).toContain("만들기");
    expect(overlay.querySelector("[data-testid='db-ai-generate-close']")?.textContent).toContain("닫기");
    expect(overlay.querySelector<HTMLElement>("[data-testid='db-ai-generate-status']")?.dataset.phase).toBe("idle");
  });

  it("예시 칩은 설명을 채우기만 하고 생성은 부르지 않는다", () => {
    const overlay = openDatabaseAiGenerateDialog({ kind: "item", rerender: () => undefined, deps: { loadConfig: config } });
    overlay.querySelector<HTMLButtonElement>("[data-testid='db-ai-generate-example-0']")?.click();
    const brief = overlay.querySelector<HTMLTextAreaElement>("[data-testid='db-ai-generate-brief']")!;
    expect(brief.value.length).toBeGreaterThan(5);
    expect(harness.admits).toHaveLength(0);
  });

  it("빈 설명으로 만들기를 누르면 부르지 않고 안내만 남긴다", () => {
    const overlay = openDatabaseAiGenerateDialog({ kind: "enemy", rerender: () => undefined, deps: { loadConfig: config } });
    overlay.querySelector<HTMLButtonElement>("[data-testid='db-ai-generate-run']")?.click();
    expect(harness.admits).toHaveLength(0);
    const status = overlay.querySelector<HTMLElement>("[data-testid='db-ai-generate-status']")!;
    expect(status.dataset.phase).toBe("error");
    expect(status.textContent).toContain("설명");
  });

  it("작업함 완료 카드에 수치가 보이고 하나 더 만들기는 설명을 비운다", async () => {
    const overlay = openDatabaseAiGenerateDialog({ kind: "item", rerender: () => undefined, deps: { loadConfig: config } });
    document.body.append(overlay);
    const brief = overlay.querySelector<HTMLTextAreaElement>("[data-testid='db-ai-generate-brief']")!;
    const run = overlay.querySelector<HTMLButtonElement>("[data-testid='db-ai-generate-run']")!;
    const close = overlay.querySelector<HTMLButtonElement>("[data-testid='db-ai-generate-close']")!;
    const status = overlay.querySelector<HTMLElement>("[data-testid='db-ai-generate-status']")!;
    brief.value = "Disposable controlled potion";
    const pending = harness.nextAdmitted();
    run.click();
    const admitted = await pending;
    expect(admitted.input.family).toBe("database");
    expect(admitted.input.mode).toBe("review");
    expect(close.textContent).toContain("닫기");
    const named = whenDom(overlay, () => (overlay.querySelector(".db-ai-generate-result-name")?.textContent ?? "") === "Task8 Fixture Potion");
    await harness.complete({
      kind: "item",
      recordId: "item_task8_potion",
      name: "Task8 Fixture Potion",
      record: { id: "item_task8_potion", name: "Task8 Fixture Potion", price: 37, type: "item", occasion: "always" },
    });
    await named;
    expect(status.dataset.phase).toBe("done");
    expect(status.textContent?.startsWith("완료")).toBe(true);
    expect(overlay.textContent).toContain("37G");
    expect(overlay.querySelector("[data-testid='ai-job-origin-open']")).toBeTruthy();
    expect(run.textContent).toContain("하나 더");
    run.click();
    expect(brief.value).toBe("");
    expect(status.dataset.phase).toBe("idle");
  });

  it("실패는 상태줄에 「실패」로 남고 설명은 그대로 두어 다시 시도할 수 있다", async () => {
    harness.failNext("AI 응답에서 JSON 객체를 찾지 못했습니다.");
    const overlay = openDatabaseAiGenerateDialog({ kind: "item", rerender: () => undefined, deps: { loadConfig: config } });
    const brief = overlay.querySelector<HTMLTextAreaElement>("[data-testid='db-ai-generate-brief']")!;
    brief.value = "상급 회복약";
    const failed = harness.nextAdmitted();
    overlay.querySelector<HTMLButtonElement>("[data-testid='db-ai-generate-run']")?.click();
    await failed.catch(() => undefined);
    const status = overlay.querySelector<HTMLElement>("[data-testid='db-ai-generate-status']")!;
    await vi.waitFor(() => expect(status.dataset.phase).toBe("error"));
    expect(status.textContent?.startsWith("실패")).toBe(true);
    expect(brief.value).toBe("상급 회복약");
    expect(brief.disabled).toBe(false);
    expect(overlay.querySelector<HTMLButtonElement>("[data-testid='db-ai-generate-run']")?.disabled).toBe(false);
  });

  it("실행 중 닫기는 맡긴 작업을 취소하지 않는다", async () => {
    const overlay = openDatabaseAiGenerateDialog({ kind: "enemy", rerender: () => undefined, deps: { loadConfig: config } });
    document.body.append(overlay);
    const brief = overlay.querySelector<HTMLTextAreaElement>("[data-testid='db-ai-generate-brief']")!;
    brief.value = "늑대";
    const pending = harness.nextAdmitted();
    overlay.querySelector<HTMLButtonElement>("[data-testid='db-ai-generate-run']")?.click();
    await pending;
    overlay.querySelector<HTMLButtonElement>("[data-testid='db-ai-generate-close']")?.click();
    expect(overlay.isConnected).toBe(false);
    expect(harness.admits).toHaveLength(1);
    expect(harness.lastJob().generation).toBe("queued");
  });

  it("그림 제공자가 대화 제공자와 다르면 그 사실을 옵션 옆에 적는다", () => {
    const overlay = openDatabaseAiGenerateDialog({
      kind: "enemy",
      rerender: () => undefined,
      deps: { loadConfig: () => ({ ...config(), providerId: "openai-codex" }) },
    });
    expect(overlay.querySelector("[data-testid='db-ai-generate-provider-notice']")?.textContent).toContain("google-antigravity");
  });
});
