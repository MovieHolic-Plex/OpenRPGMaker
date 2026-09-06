/** @vitest-environment happy-dom */
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import * as conversationStore from "@/ai/conversationStore";
import { AI_CONFIG_STORAGE_KEY, defaultAiConfig } from "@/ai/llmClient";
import * as bootIntent from "@/editor/aiBootIntent";
import * as newProjectDialog from "@/editor/ui/newProjectDialog";
import { editorState } from "@/editor/editorState";
import { resetEditorUiModeForTests } from "@/editor/editorUiMode";
import { renderAiChatPanel, teardownAiChatPanel, whenAiChatPanelSettled } from "@/editor/panels/aiChatPanel";
import { renderTopbar } from "@/editor/panels/menu";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import type { Project } from "@/project/types";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

async function signal<T>(promise: Promise<T>): Promise<T> {
  let timeout!: ReturnType<typeof setTimeout>;
  try {
    return await Promise.race([promise, new Promise<never>((_resolve, reject) => {
      timeout = setTimeout(() => reject(new Error("Expected workflow signal")), 3000);
    })]);
  } finally {
    clearTimeout(timeout);
  }
}

function control<T extends HTMLElement = HTMLButtonElement>(testid: string): T {
  const node = document.querySelector<T>(`[data-testid="${testid}"]`);
  if (!node) throw new Error(`Missing control: ${testid}`);
  return node;
}

beforeEach(async () => {
  const values = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  });
  vi.stubEnv("VITE_LLM_API_URL", "");
  vi.stubEnv("VITE_LLM_API_KEY", "");
  // No request in this suite may reach a remote database or a real model.
  vi.stubGlobal("fetch", vi.fn(async () => new Response("{}")));
  store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
  store.replaceProject(createBlankProject());
  editorState.set({ currentMapId: store.getCurrent().startMapId, selection: null });
  resetEditorUiModeForTests("expert");
  bootIntent.clearPendingAiBootIntent();
  await conversationStore.clearConversations();
});

afterEach(async () => {
  teardownAiChatPanel();
  await signal(whenAiChatPanelSettled());
  bootIntent.clearPendingAiBootIntent();
  document.body.replaceChildren();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

it("New Project preset waits for project creation AND conversation adoption before auto-submitting once", async () => {
  localStorage.setItem(AI_CONFIG_STORAGE_KEY, JSON.stringify({
    ...defaultAiConfig(), authMode: "apiKey", baseUrl: "https://llm.invalid/v1", apiKey: "test-key", agentMode: "chat",
  }));
  const completed = deferred<void>();
  const originalRegister = bootIntent.registerAiBootIntentTarget;
  vi.spyOn(bootIntent, "registerAiBootIntentTarget").mockImplementation((target) => {
    originalRegister(target ? { ...target, send: async (text) => {
      try { await target.send?.(text); } finally { completed.resolve(); }
    } } : null);
  });
  const modelRequests: unknown[] = [];
  const requested = deferred<{ body: { messages: unknown[] }; signal: AbortSignal }>();
  vi.stubGlobal("fetch", vi.fn(async (_url: unknown, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body ?? "{}"));
    if (!Array.isArray(body.messages)) return new Response("{}");
    if (!body.response_format) {
      modelRequests.push(body);
      requested.resolve({ body, signal: init!.signal! });
    }
    return Response.json({ choices: [{ message: { role: "assistant", content: body.response_format
      ? '{"mode":"other","needsPlan":false}' : "done" }, finish_reason: "stop" }] });
  }));
  document.body.append(renderAiChatPanel());
  await signal(whenAiChatPanelSettled());

  const adoption = deferred<null>();
  const adoptionStarted = deferred<void>();
  vi.spyOn(conversationStore, "loadLatestConversationForScope").mockImplementation(() => {
    adoptionStarted.resolve();
    return adoption.promise;
  });
  const creation = deferred<void>();
  const creationStarted = deferred<Project>();
  const createProject = vi.fn(async (project: Project) => {
    creationStarted.resolve(project);
    await creation.promise;
    // Preserve the real identity-change notification that starts asynchronous chat adoption.
    store.replaceProject(project);
    return { projectId: "preset-ordering-fixture" };
  });
  // Both menu creation entry points must preserve the same adoption ordering.
  vi.spyOn(store, "loadNewRemoteProject").mockImplementation(createProject);
  vi.spyOn(store, "loadNewRemoteProjectTransactionally").mockImplementation(createProject);
  const handedOff = deferred<void>();
  const originalSend = bootIntent.sendAiBootIntent;
  const handoff = vi.spyOn(bootIntent, "sendAiBootIntent").mockImplementation((text) => {
    const accepted = originalSend(text);
    handedOff.resolve();
    return accepted;
  });
  const topbar = document.createElement("div");
  document.body.append(topbar);
  renderTopbar(topbar);
  control("menu-project").click();
  control("menu-project-new").click();
  control<HTMLInputElement>("new-project-name-input").value = "Preset ordering fixture";
  const radio = control<HTMLInputElement>("new-project-genre-option-monster-collect");
  radio.checked = true;
  radio.dispatchEvent(new Event("change", { bubbles: true }));
  control("new-project-confirm").click();

  try {
    const candidate = await signal(creationStarted.promise);
    expect(candidate.system.monsterCollection).toBe(true);
    expect(createProject).toHaveBeenCalledOnce();
    expect(handoff).not.toHaveBeenCalled();
    expect(control<HTMLTextAreaElement>("ai-input").value).toBe("");
    creation.resolve();
    await signal(adoptionStarted.promise);
    await signal(handedOff.promise);
    // The store is ready, but delayed IndexedDB adoption still owns a destructive reset.
    expect(control<HTMLTextAreaElement>("ai-input").value).toBe("");
    expect(document.querySelector('[data-testid="ai-chat-log"]')?.textContent).not.toContain(handoff.mock.calls[0]![0]);
    adoption.resolve(null);
    const request = await signal(requested.promise);
    await signal(completed.promise);
    await signal(whenAiChatPanelSettled());
    expect(modelRequests).toHaveLength(1);
    expect(request.signal.aborted).toBe(false);
    expect(request.body.messages).toEqual(expect.arrayContaining([expect.objectContaining({ role: "user", content: expect.stringContaining(handoff.mock.calls[0]![0]) })]));
    expect(handoff).toHaveBeenCalledOnce();
    expect(store.getCurrent().system.monsterCollection).toBe(true);
  } finally {
    creation.resolve();
    adoption.resolve(null);
  }
});

it("cancelling the New Project chooser neither creates a project nor hands off an AI prompt", async () => {
  const loadNew = vi.spyOn(store, "loadNewRemoteProject");
  const transactionalLoad = vi.spyOn(store, "loadNewRemoteProjectTransactionally");
  const handoff = vi.spyOn(bootIntent, "sendAiBootIntent");
  const dialog = vi.spyOn(newProjectDialog, "showNewProjectDialog");
  const topbar = document.createElement("div");
  document.body.append(topbar);
  renderTopbar(topbar);
  control("menu-project").click();
  control("menu-project-new").click();
  const selection = dialog.mock.results[0]!.value;
  control("new-project-cancel").click();
  await expect(signal(selection)).resolves.toBeNull();
  expect(loadNew).not.toHaveBeenCalled();
  expect(transactionalLoad).not.toHaveBeenCalled();
  expect(handoff).not.toHaveBeenCalled();
  expect(bootIntent.peekPendingAiBootIntent()).toBeNull();
});
