// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { defaultAiConfig } from "@/ai/llmClient";
import { openDatabaseAiGenerateDialog } from "@/editor/panels/databaseAiGenerateDialog";
import { resetModalStackForTest } from "@/editor/ui/modalStack";

afterEach(() => { resetModalStackForTest(); document.body.replaceChildren(); });

describe("database image provider notice", () => {
  it.each([
    { providerId: "google-antigravity", imageProviderId: "openai-codex", expected: ["openai-codex", "google-antigravity"] },
    // da29a9f402: 저장된 그림 제공자가 없으면 기본은 ChatGPT(openai-codex)다 — 대화가 Google 이면 그 차이를 적는다.
    { providerId: "google-antigravity", imageProviderId: undefined, expected: ["openai-codex", "google-antigravity"] },
    { providerId: "openai-codex", imageProviderId: "google-antigravity", expected: ["google-antigravity", "openai-codex"] },
  ])("renders selected image provider before chat provider: $providerId / $imageProviderId", ({ providerId, imageProviderId, expected }) => {
    const overlay = openDatabaseAiGenerateDialog({
      kind: "item", rerender: () => undefined,
      deps: { loadConfig: () => ({ ...defaultAiConfig(), providerId, imageProviderId }) },
    });
    const notice = overlay.querySelector('[data-testid="db-ai-generate-provider-notice"]');
    expect(notice?.textContent?.match(/google-antigravity|openai-codex/g)).toEqual(expected);
  });

  it("omits the notice when no image provider is stored and chat already uses the default ChatGPT route", () => {
    const overlay = openDatabaseAiGenerateDialog({
      kind: "item", rerender: () => undefined,
      deps: { loadConfig: () => ({ ...defaultAiConfig(), providerId: "openai-codex", imageProviderId: undefined }) },
    });
    expect(overlay.querySelector('[data-testid="db-ai-generate-provider-notice"]')).toBeNull();
  });

  it("omits the other-provider notice when the selected providers agree", () => {
    const overlay = openDatabaseAiGenerateDialog({
      kind: "item", rerender: () => undefined,
      deps: { loadConfig: () => ({ ...defaultAiConfig(), providerId: "openai-codex", imageProviderId: "openai-codex" }) },
    });
    expect(overlay.querySelector('[data-testid="db-ai-generate-provider-notice"]')).toBeNull();
  });
});
