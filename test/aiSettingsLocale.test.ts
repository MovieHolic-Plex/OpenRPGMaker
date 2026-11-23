/** @vitest-environment happy-dom */
import { afterEach, expect, it, vi } from "vitest";
import { setLocale } from "@/i18n";
import { openAiSettingsModal, closeAiSettingsModal } from "@/editor/panels/aiSettingsModal";
import { openSettingsDialog } from "@/start/settings/settingsDialog";

vi.mock("@/editor/panels/aiRoleMatrixSettings", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/editor/panels/aiRoleMatrixSettings")>()),
  fetchConnectedRoutes: async () => [],
}));

let closeStart: (() => void) | undefined;

afterEach(async () => {
  closeStart?.();
  closeStart = undefined;
  closeAiSettingsModal();
  await setLocale("ko");
  localStorage.clear();
  vi.unstubAllGlobals();
});

const HANGUL = /[\uAC00-\uD7A3\u3131-\u318E]/;
const attributes = ["aria-label", "title", "placeholder"] as const;

function byId<T extends HTMLElement = HTMLElement>(root: HTMLElement, id: string): T {
  const element = root.querySelector<T>(`[data-testid="${id}"]`);
  if (!element) throw new Error(`Missing ${id}`);
  return element;
}

function expectEnglish(root: HTMLElement): void {
  const untranslated: string[] = [];
  const text = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  while (text.nextNode()) {
    const value = text.currentNode.textContent ?? "";
    if (HANGUL.test(value)) untranslated.push(value.trim());
  }
  for (const element of [root, ...root.querySelectorAll("[aria-label], [title], [placeholder]")]) {
    for (const attribute of attributes) {
      const value = element.getAttribute(attribute);
      if (value && HANGUL.test(value)) untranslated.push(`${attribute}="${value}"`);
    }
  }
  expect(untranslated).toEqual([]);
  expect(root.textContent).not.toMatch(HANGUL);
}

it("localizes both AI settings surfaces, including their disclosures and Advanced sheet", async () => {
  const account = { connected: true, authKind: "oauth", accountEmail: "builder@example.invalid" };
  vi.stubGlobal("fetch", async (input: string) => {
    const url = new URL(input, "http://oprn.invalid");
    if (url.pathname === "/v1/local-agents") return Response.json({ clis: [] });
    if (url.pathname === "/auth/status" && url.searchParams.get("provider") === "openai-codex") return Response.json(account);
    return Response.json({ connected: false, endpoints: [] });
  });
  localStorage.setItem("oprn:ai-config", JSON.stringify({ providerId: "openai-codex", model: "gpt-6.2-sol" }));
  await setLocale("en");

  closeStart = openSettingsDialog().close;
  const start = byId(document.body, "start-settings");
  await inspect(start);
  byId(start, "start-settings-tab-about").click();
  await vi.waitFor(() => expectEnglish(start));
  closeStart();

  const editor = openAiSettingsModal();
  await inspect(editor);

  async function inspect(root: HTMLElement): Promise<void> {
    const otherWays = byId(root, "ai-settings-other-ways").closest("details")!;
    otherWays.open = true;
    const localPrograms = byId<HTMLDetailsElement>(root, "ai-settings-local-programs");
    localPrograms.open = true;
    localPrograms.dispatchEvent(new Event("toggle"));
    await vi.waitFor(() => expect(byId(root, "ai-settings-chatgpt-account").hidden).toBe(false));
    await vi.waitFor(() => expectEnglish(root));

    for (const pane of ["model", "work", "display", "usage", "account"]) {
      byId(root, `ai-settings-tab-${pane}`).click();
      expect(byId(root, `ai-settings-pane-${pane}`).hidden).toBe(false);
      await vi.waitFor(() => expectEnglish(root));
    }
  }
});
