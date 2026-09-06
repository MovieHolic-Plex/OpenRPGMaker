// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearConversations, saveConversation } from "@/ai/conversationStore";
import { closeAiSettingsModal, openAiSettingsModal } from "@/editor/panels/aiSettingsModal";
import { closeAiConversationHistoryModal, openAiConversationHistoryModal, whenAiConversationHistoryModalSettled } from "@/editor/panels/aiConversationHistoryModal";
import { modalStackEntryCountForTest, registerModal } from "@/editor/ui/modalStack";

vi.mock("@/ai/chatgptOAuthClient", async (original) => ({
  ...await original<typeof import("@/ai/chatgptOAuthClient")>(),
  fetchChatGptAuthStatus: vi.fn().mockResolvedValue({ connected: false }),
}));
vi.mock("@/project/supabaseProjectSync", () => ({ recordSupabaseConversation: vi.fn(async () => undefined) }));

function control<T extends HTMLElement = HTMLElement>(id: string): T {
  const node = document.querySelector<T>(`[data-testid="${id}"]`);
  if (!node) throw new Error(`Missing control ${id}`);
  return node;
}

function key(target: HTMLElement, value: string, shiftKey = false): KeyboardEvent {
  const event = new KeyboardEvent("keydown", { key: value, shiftKey, bubbles: true, cancelable: true });
  target.dispatchEvent(event);
  return event;
}

let opener: HTMLButtonElement;
beforeEach(async () => {
  localStorage.clear();
  await clearConversations();
  opener = document.createElement("button");
  document.body.append(opener);
  opener.focus();
});
afterEach(async () => {
  closeAiSettingsModal();
  closeAiConversationHistoryModal();
  await whenAiConversationHistoryModalSettled();
  document.body.replaceChildren();
  await clearConversations();
});

async function open(kind: "settings" | "history"): Promise<HTMLElement> {
  if (kind === "settings") return openAiSettingsModal();
  const modal = openAiConversationHistoryModal({ scopeKey: "test", currentConversationId: "none", onOpen: () => undefined });
  await whenAiConversationHistoryModalSettled();
  return modal;
}

describe.each(["settings", "history"] as const)("%s modal focus", (kind) => {
  it("wraps both Tab boundaries when the first or last control is focused", async () => {
    // Given a real modal and a known enabled tail control (no browser layout mocking).
    const modal = await open(kind);
    const last = document.createElement("button");
    modal.querySelector('[role="dialog"]')?.append(last);
    const first = control(`ai-${kind}-close`);
    first.focus();
    // When reverse Tab reaches the first boundary, then it is intercepted and wraps.
    expect(key(first, "Tab", true).defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(last);
    // When forward Tab reaches the other boundary, then it wraps to close.
    expect(key(last, "Tab").defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(first);
  });

  it.each(["button", "backdrop", "escape", "api"] as const)("restores the opener when closed by %s", async (path) => {
    // Given a modal that moved focus away from its opener.
    const modal = await open(kind);
    control(`ai-${kind}-close`).focus();
    // When any supported close path executes.
    if (path === "button") control(`ai-${kind}-close`).click();
    else if (path === "backdrop") modal.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    else if (path === "escape") key(control(`ai-${kind}-close`), "Escape");
    else if (kind === "settings") closeAiSettingsModal();
    else closeAiConversationHistoryModal();
    // Then the modal and its stack entry are gone and the opener owns focus again.
    expect(modal.isConnected).toBe(false);
    expect(document.activeElement).toBe(opener);
    expect(modalStackEntryCountForTest()).toBe(0);
  });

  it("yields Tab and outside dismissal to a newer modal", async () => {
    // Given another modal above this one.
    const modal = await open(kind);
    const child = document.createElement("div");
    const childButton = document.createElement("button");
    child.append(childButton);
    document.body.append(child);
    const closeChild = registerModal(child, () => child.remove());
    childButton.focus();
    try {
      // When the lower modal receives Tab/backdrop input, then it cannot act as topmost.
      expect(key(control(`ai-${kind}-close`), "Tab", true).defaultPrevented).toBe(false);
      modal.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
      expect(modal.isConnected).toBe(true);
      expect(document.activeElement).toBe(childButton);
    } finally { closeChild(); }
  });

  it("does not steal newer modal focus when programmatically disposed", async () => {
    const modal = await open(kind);
    const child = document.createElement("div");
    const childButton = document.createElement("button");
    child.append(childButton);
    document.body.append(child);
    const closeChild = registerModal(child, () => child.remove());
    childButton.focus();
    try {
      if (kind === "settings") closeAiSettingsModal();
      else closeAiConversationHistoryModal();
      expect(modal.isConnected).toBe(false);
      expect(document.activeElement).toBe(childButton);
    } finally { closeChild(); }
  });
});

it("excludes hidden, inert, disabled and negative-tabindex controls from settings boundaries", () => {
  const tail = document.createElement("div");
  tail.innerHTML = '<button data-testid="last-enabled">Tail</button><button disabled>Disabled</button><div hidden><button>Hidden</button></div><div inert><button>Inert</button></div><button tabindex="-1">Skipped</button><div style="display:none"><button>CSS hidden</button></div><details><summary tabindex="0">Summary</summary><button>Closed details</button></details>';
  const modal = openAiSettingsModal();
  // Append after Save so this really is the boundary; Happy DOM needs the summary's native tab stop made explicit.
  modal.querySelector('[role="dialog"]')?.append(tail);
  const first = control("ai-settings-close");
  first.focus();
  key(first, "Tab", true);
  expect(document.activeElement).toBe(tail.querySelector("summary"));
});

it("closes only the nested settings select on the first Escape, then restores the opener", () => {
  const modal = openAiSettingsModal();
  const trigger = modal.querySelector<HTMLButtonElement>('[data-custom-select-for="ai-font-size"]');
  if (!trigger) throw new Error("Missing font select trigger");
  trigger.click();
  key(trigger, "Escape");
  expect(modal.isConnected).toBe(true);
  expect(trigger.getAttribute("aria-expanded")).toBe("false");
  expect(document.activeElement).toBe(trigger);
  key(trigger, "Escape");
  expect(modal.isConnected).toBe(false);
  expect(document.activeElement).toBe(opener);
});

it("uses the newly rendered history row as the Tab boundary after async listing", async () => {
  await saveConversation({ id: "saved", title: "Saved", savedAt: 1000, model: "fixture", entries: [{ kind: "user", text: "Fixture" }], projectContextKey: "test" });
  await open("history");
  const first = control("ai-history-close");
  first.focus();
  key(first, "Tab", true);
  expect(document.activeElement).toBe(control("ai-history-delete"));
});
