/** @vitest-environment happy-dom */
import { afterEach, expect, it, vi } from "vitest";
import { mountAgentModeDock } from "@/editor/agentMode/agentModeDock";
import { refreshAiConnectionStatus, resetAiConnectionStatusCache } from "@/editor/panels/aiConnectionStatus";

let dispose: (() => void) | undefined;

afterEach(() => {
  dispose?.();
  dispose = undefined;
  resetAiConnectionStatusCache();
  document.body.replaceChildren();
  localStorage.clear();
  vi.unstubAllGlobals();
});

it("uses the editor's companion composer when ChatGPT is ready and none of the local agents are installed", async () => {
  const detect = vi.fn(async () => ({
    agents: ["codex", "claude", "opencode"].map(id => ({
      id, label: id, cliFound: false, adapterFound: false, ready: false, installHint: "", loginHint: "",
    })),
    state: { running: false, busy: false, seq: 0 },
  }));
  const start = vi.fn();
  vi.stubGlobal("oprn", { agent: { detect, start, poll: () => new Promise(() => {}) } });
  vi.stubGlobal("fetch", async () => Response.json({ connected: true, authKind: "oauth" }));
  localStorage.setItem("oprn:ai-config", JSON.stringify({ providerId: "openai-codex", model: "gpt-6.2-sol" }));

  const host = document.createElement("div");
  document.body.append(host);
  dispose = mountAgentModeDock(host);
  await vi.waitFor(() => expect(detect).toHaveBeenCalled());
  const tab = host.querySelector<HTMLButtonElement>("[data-testid='agent-mode-tab-agent']")!;
  tab.click();
  await refreshAiConnectionStatus();
  expect(tab.getAttribute("aria-selected")).toBe("true");
  expect(tab.querySelector<HTMLElement>(".agent-mode-tab-setup")?.hidden).toBe(true);
  expect(tab.title).toBe("");
  expect(host.querySelector<HTMLElement>("[data-testid='agent-mode-chatgpt-ready']")?.hidden).toBe(false);
  expect(host.classList.contains("is-agent-mode")).toBe(false);
  expect(start).not.toHaveBeenCalled();

  const switchRoute = host.querySelector<HTMLButtonElement>("[data-testid='agent-mode-switch-route']")!;
  switchRoute.click();
  expect(host.classList.contains("is-agent-mode")).toBe(true);
  switchRoute.click();
  expect(host.classList.contains("is-agent-mode")).toBe(false);
});
