// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AssistantSession, type SessionEvent } from "@/ai/assistantSession";
import type { AcceptanceSnapshot } from "@/ai/assistantAcceptance";
import { buildAiActivityLogRecord, recordAiActivity } from "@/ai/activityLog";
import { clearConversations, conversationScopeKey, loadConversation, saveConversation } from "@/ai/conversationStore";
import { closeAiConversationHistoryModal, whenAiConversationHistoryModalSettled } from "@/editor/panels/aiConversationHistoryModal";
import { renderAiChatPanel, teardownAiChatPanel, whenAiChatPanelSettled } from "@/editor/panels/aiChatPanel";
import { editorState } from "@/editor/editorState";
import { store } from "@/project/store";
import { createBlankProject } from "@/project/defaults";
import { createAiStickyChecklist } from "@/editor/panels/aiStickyChecklist";
import { subscribeEditorCameraFocus } from "@/editor/editorCameraFocus";
import { shouldIgnoreEditorShortcut } from "@/editor/hotkeys";

const notes: ReturnType<typeof createAiStickyChecklist>[] = [];
function mountNote(value = snapshot()) {
  const note = createAiStickyChecklist(); notes.push(note); note.update(value); return note;
}
function expandNote() {
  const toggle = node<HTMLButtonElement>("ai-sticky-toggle");
  if (toggle.getAttribute("aria-expanded") !== "true") toggle.click();
}
function verifiedGroup(): HTMLDetailsElement {
  const group = document.querySelector<HTMLDetailsElement>(".ai-sticky-done-group");
  if (!group) throw new Error("Missing rendered verified group");
  return group;
}
function assertVisibilityApi(note: ReturnType<typeof createAiStickyChecklist>): asserts note is ReturnType<typeof createAiStickyChecklist> & {
  hide(): void; show(): void; hasSnapshot(): boolean;
} {
  expect(note).toEqual(expect.objectContaining({ hide: expect.any(Function), show: expect.any(Function), hasSnapshot: expect.any(Function) }));
}

vi.mock("@/ai/activityLog", async (original) => ({
  ...await original<typeof import("@/ai/activityLog")>(), recordAiActivity: vi.fn(async () => ({})),
}));
vi.mock("@/editor/ui/aiGateModal", () => ({ showAiGateNotice: vi.fn() }));
vi.mock("@/ai/preferenceSignals", () => ({ observeTurn: () => ({}), shouldDistillPreferences: () => false }));

function signal() {
  let resolve = () => {};
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}
async function bounded<T>(promise: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([promise, new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("Missing acceptance lifecycle signal")), 5000);
    })]);
  } finally { clearTimeout(timer); }
}
function node<T extends HTMLElement>(testid: string): T {
  const found = document.querySelector<T>(`[data-testid='${testid}']`);
  if (!found) throw new Error(`Missing rendered ${testid}`);
  return found;
}
function snapshot(status: AcceptanceSnapshot["status"] = "working"): AcceptanceSnapshot {
  return { id: "acceptance-fixture", goal: "한국어로 된 아주 긴 목표를 안전하게 표시합니다 <img src=x>", status,
    items: [{ id: "item-a", title: "입구와 마을을 연결하기", status, reason: "검증 근거",
      evidence: [{ expected: "expected-fixture", observed: "observed-fixture", passed: status === "verified" }] }] };
}
beforeEach(async () => {
  vi.stubEnv("VITE_LLM_API_URL", ""); vi.stubEnv("VITE_LLM_API_KEY", "");
  localStorage.clear(); await clearConversations();
  store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
  store.replace(createBlankProject());
  editorState.set({ currentMapId: store.getCurrent().startMapId, selection: null });
});
afterEach(async () => {
  closeAiConversationHistoryModal(); await bounded(whenAiConversationHistoryModalSettled());
  notes.forEach(note => note.dispose()); notes.length = 0;
  teardownAiChatPanel(); await bounded(whenAiChatPanelSettled()); await clearConversations();
  document.body.replaceChildren(); localStorage.clear(); vi.restoreAllMocks(); vi.unstubAllEnvs();
});

it("renders acceptance outside chat and retains verified evidence after the turn", async () => {
  // Given a real panel with a held transport turn.
  const held = signal(); const release = signal(); const terminal = signal();
  vi.mocked(recordAiActivity).mockImplementation(async (record) => {
    if (record.result && record.result.pending !== true) terminal.resolve();
    return buildAiActivityLogRecord(record);
  });
  vi.spyOn(AssistantSession.prototype, "sendUserMessage").mockImplementation(async function (this: AssistantSession, _text, onEvent) {
    Object.defineProperty(this, "getAcceptanceSnapshot", { value: () => snapshot("verified"), configurable: true });
    onEvent?.({ type: "acceptance", snapshot: snapshot() }); held.resolve();
    await release.promise;
    onEvent?.({ type: "acceptance", snapshot: snapshot("verified") });
    return { assistantText: "", proposedCalls: [], stoppedReason: "final" };
  });
  const panel = renderAiChatPanel(); document.body.append(panel); await bounded(whenAiChatPanelSettled());
  // When the transport publishes an acceptance snapshot.
  node<HTMLTextAreaElement>("ai-input").value = "ACCEPTANCE_FIXTURE";
  node("ai-send").click();
  try {
    await bounded(held.promise);
    expect(document.querySelector("[data-testid='ai-sticky-checklist']"), "acceptance must have a separate sticky surface").not.toBeNull();
    expect(panel.contains(node("ai-sticky-checklist"))).toBe(false);
    expect(node("ai-sticky-item").dataset.status).toBe("working");
    expect(node("ai-sticky-checklist").querySelector("img")).toBeNull();
  } finally { release.resolve(); await bounded(terminal.promise); }
  // Then the terminal snapshot stays inspectable without the ephemeral work plan.
  expect(node("ai-sticky-item").dataset.status).toBe("verified");
  expect(node("ai-sticky-count").textContent).toBe("1/1");
  expect(panel.querySelector("[data-testid='ai-work-plan-checklist']")).toBeNull();
  node("ai-new-chat").click();
  expect(document.querySelector("[data-testid='ai-sticky-checklist']")).toBeNull();
});

it("preserves disclosure and focused navigation while backend status and evidence change", () => {
  // Given an open, focused disclosure in a mounted note.
  const note = createAiStickyChecklist();
  const initial = snapshot();
  const item = { ...initial.items[0], id: "item-a", title: "fixture", status: "working", evidence: [], mapId: store.getCurrent().startMapId } as const;
  note.update({ ...initial, items: [item] });
  expandNote();
  const details = node<HTMLDetailsElement>("ai-sticky-item"); details.open = true;
  const navigate = node<HTMLButtonElement>("ai-sticky-navigate"); navigate.focus();
  // When the same item receives verified evidence.
  note.update({ ...initial, status: "verified", items: [{ ...item, status: "verified", evidence: [{ expected: "EXPECTED", observed: "OBSERVED", passed: true }] }] });
  // Then native interaction identity and backend evidence are preserved.
  expect(node("ai-sticky-item")).toBe(details);
  expect(details.open).toBe(true); expect(document.activeElement).toBe(navigate);
  expect(verifiedGroup().open).toBe(true);
  expect(node("ai-sticky-evidence").querySelector("dd")?.textContent).toBe("EXPECTED");
  expect(node("ai-sticky-count").textContent).toBe("1/1");
  note.dispose();
});

it.each(["pending", "working", "verifying", "verified", "blocked"] as const)("projects %s without a mutable checkbox", (status) => {
  // Given a frozen backend snapshot.
  const note = createAiStickyChecklist(); const value = snapshot(status); Object.freeze(value);
  // When it reaches the note.
  note.update(value);
  // Then status is exposed, and only verification contributes to the count.
  expect(node("ai-sticky-item").dataset.status).toBe(status);
  expect(node("ai-sticky-count").textContent).toBe(status === "verified" ? "1/1" : "0/1");
  expect(note.root.querySelector("input, [role='checkbox']")).toBeNull();
  note.dispose();
});

it.each([false, true])("defaults to compact with compact media match=%s", (matches) => {
  const query = window.matchMedia("(max-width: 1100px), (max-height: 700px)");
  vi.spyOn(window, "matchMedia").mockReturnValue(query);
  vi.spyOn(query, "matches", "get").mockReturnValue(matches);
  mountNote();
  expect(node("ai-sticky-toggle").getAttribute("aria-expanded")).toBe("false");
  expect(node("ai-sticky-checklist").dataset.expanded).toBe("false");
});

it("preserves a manual expansion through tight viewport changes and clears on disposal", () => {
  // Given the tight-viewport default.
  const query = window.matchMedia("(max-width: 1100px), (max-height: 700px)");
  vi.spyOn(window, "matchMedia").mockReturnValue(query);
  vi.spyOn(query, "matches", "get").mockReturnValue(true);
  const note = createAiStickyChecklist(); note.update(snapshot());
  expect(node("ai-sticky-toggle").getAttribute("aria-expanded")).toBe("false");
  // When the author manually opens the note, then the viewport changes.
  node("ai-sticky-toggle").click(); query.dispatchEvent(new Event("change"));
  // Then the author's expansion choice wins.
  expect(node("ai-sticky-toggle").getAttribute("aria-expanded")).toBe("true");
  note.dispose(); query.dispatchEvent(new Event("change")); note.update(snapshot());
  expect(document.querySelector("[data-testid='ai-sticky-checklist']")).toBeNull();
});

it("navigates through the actual map and camera event seam", async () => {
  // Given a real project map and a subscribed camera signal.
  const note = createAiStickyChecklist(); const initial = snapshot();
  const mapId = store.getCurrent().startMapId;
  note.update({ ...initial, items: [{ id: "place", title: "place", status: "verified", evidence: [], mapId, region: { x: 2, y: 3, w: 4, h: 2 } }] });
  const received = signal();
  const focus = vi.fn(() => received.resolve()); const unsubscribe = subscribeEditorCameraFocus(focus);
  try {
    // When the author navigates from the evidence disclosure.
    node<HTMLDetailsElement>("ai-sticky-item").open = true; node("ai-sticky-navigate").click(); await bounded(received.promise);
    // Then the shared editor camera receives the real region.
    expect(focus).toHaveBeenCalledWith(expect.objectContaining({ mapId, bounds: { x: 2, y: 3, width: 4, height: 2 } }));
  } finally { unsubscribe(); note.dispose(); }
});

it("disables navigation for a deleted map without inventing a destination", () => {
  // Given evidence that references a missing map.
  const note = createAiStickyChecklist();
  // When that snapshot is displayed.
  note.update({ ...snapshot(), items: [{ id: "missing", title: "missing", status: "blocked", evidence: [], mapId: "no-such-map" }] });
  // Then navigation is explicitly unavailable.
  expect(node<HTMLButtonElement>("ai-sticky-navigate").disabled).toBe(true);
  note.dispose();
});

it("ignores late acceptance events after the real new-chat boundary", async () => {
  // Given an old turn held by its transport.
  const held = signal(); const release = signal(); const lateSent = signal();
  vi.spyOn(AssistantSession.prototype, "sendUserMessage").mockImplementation(async function (this: AssistantSession, _text, onEvent) {
    Object.defineProperty(this, "getAcceptanceSnapshot", { value: () => snapshot("verified"), configurable: true });
    onEvent?.({ type: "acceptance", snapshot: snapshot() }); held.resolve(); await release.promise;
    onEvent?.({ type: "acceptance", snapshot: snapshot("verified") }); lateSent.resolve();
    return { assistantText: "", proposedCalls: [], stoppedReason: "final" };
  });
  document.body.append(renderAiChatPanel()); await bounded(whenAiChatPanelSettled());
  node<HTMLTextAreaElement>("ai-input").value = "OWNERSHIP_FIXTURE"; node("ai-send").click(); await bounded(held.promise);
  // When new chat retires that owner before its late event.
  node("ai-new-chat").click(); release.resolve(); await bounded(lateSent.promise);
  // Then neither the reset nor late event can leave the old note visible.
  expect(document.querySelector("[data-testid='ai-sticky-checklist']")).toBeNull();
});

it("refreshes backend acceptance on a store mutation without manufacturing verification", async () => {
  // Given a real panel with a retained snapshot; only the not-yet-integrated backend boundary is mocked.
  const held = signal(); const release = signal(); const refreshed = signal();
  const refresh = vi.fn((_project: ReturnType<typeof store.getCurrent>, onEvent?: (event: SessionEvent) => void) => {
    onEvent?.({ type: "acceptance", snapshot: snapshot("blocked") }); refreshed.resolve();
  });
  vi.spyOn(AssistantSession.prototype, "sendUserMessage").mockImplementation(async function (this: AssistantSession, _text, onEvent) {
    Object.defineProperty(this, "refreshAcceptance", { value: refresh, configurable: true });
    Object.defineProperty(this, "getAcceptanceSnapshot", { value: () => snapshot("blocked"), configurable: true });
    onEvent?.({ type: "acceptance", snapshot: snapshot("verified") }); held.resolve(); await release.promise;
    return { assistantText: "", proposedCalls: [], stoppedReason: "final" };
  });
  document.body.append(renderAiChatPanel()); await bounded(whenAiChatPanelSettled());
  node<HTMLTextAreaElement>("ai-input").value = "REFRESH_FIXTURE"; node("ai-send").click(); await bounded(held.promise);
  try {
    // When a human edit changes the store (undo uses the same store notification seam).
    store.update((project) => { project.meta.title = "MUTATION_FIXTURE"; }, { scope: "project", label: "acceptance test" });
    await bounded(refreshed.promise);
    // Then the backend, not the UI, supplies the downgraded result.
    expect(refresh).toHaveBeenCalledWith(store.getCurrent(), expect.any(Function));
    expect(node("ai-sticky-item").dataset.status).toBe("blocked");
    expect(node("ai-sticky-count").textContent).toBe("0/1");
  } finally { release.resolve(); }
});

it("retains the backend blocked snapshot when the actual abort button ends a held turn", async () => {
  // Given a held transport that settles its backend snapshot on abort.
  const held = signal(); const terminal = signal();
  vi.mocked(recordAiActivity).mockImplementation(async (record) => {
    if (record.result && record.result.pending !== true) terminal.resolve();
    return buildAiActivityLogRecord(record);
  });
  vi.spyOn(AssistantSession.prototype, "sendUserMessage").mockImplementation(async function (this: AssistantSession, _text, onEvent, abort) {
    Object.defineProperty(this, "getAcceptanceSnapshot", { value: () => snapshot("blocked"), configurable: true });
    const aborted = new Promise<void>((resolve) => abort?.addEventListener("abort", () => resolve(), { once: true }));
    onEvent?.({ type: "acceptance", snapshot: snapshot() }); held.resolve(); await aborted;
    onEvent?.({ type: "acceptance", snapshot: snapshot("blocked") });
    return { assistantText: "", proposedCalls: [], stoppedReason: "aborted" };
  });
  document.body.append(renderAiChatPanel()); await bounded(whenAiChatPanelSettled());
  node<HTMLTextAreaElement>("ai-input").value = "ABORT_FIXTURE"; node("ai-send").click(); await bounded(held.promise);
  // When the author stops the actual panel turn.
  node("ai-abort").click(); await bounded(terminal.promise);
  // Then terminal publication retains backend evidence without accepting late live events.
  expect(node("ai-sticky-item").dataset.status).toBe("blocked");
  expect(node("ai-sticky-count").textContent).toBe("0/1");
});

it("hides without discarding live updates and reopens the latest backend evidence", () => {
  const note = mountNote(); assertVisibilityApi(note);
  expect(note.hasSnapshot()).toBe(true);
  expandNote();
  const row = node<HTMLDetailsElement>("ai-sticky-item"); row.open = true;
  note.hide();
  expect(note.root.isConnected && !note.root.hidden).toBe(false);
  const next = snapshot("blocked"); note.update(next);
  expect(note.hasSnapshot()).toBe(true);
  expect(note.root.isConnected && !note.root.hidden).toBe(false);
  note.show();
  expect(note.root.isConnected && !note.root.hidden).toBe(true);
  expect(node("ai-sticky-item")).toBe(row);
  expect(row.open).toBe(true);
  expect(row.dataset.status).toBe("blocked");
  expect(node("ai-sticky-evidence").querySelector("[data-passed='false']")).not.toBeNull();
  expect(document.activeElement).toBe(node("ai-sticky-toggle"));
  expect(next).toEqual(snapshot("blocked"));
});

it.each(["clear", "dispose"] as const)("does not reopen retired acceptance after %s", boundary => {
  const note = mountNote(); assertVisibilityApi(note); note.hide();
  if (boundary === "clear") note.update(null); else note.dispose();
  expect(note.hasSnapshot()).toBe(false);
  note.show();
  expect(note.root.isConnected).toBe(false);
  if (boundary === "dispose") {
    note.update(snapshot()); note.show();
    expect(note.hasSnapshot()).toBe(false);
    expect(note.root.isConnected).toBe(false);
  } else {
    note.update({ ...snapshot(), id: "NEXT_OWNER" });
    expect(note.root.isConnected && !note.root.hidden).toBe(true);
    expect(node("ai-sticky-toggle").getAttribute("aria-expanded")).toBe("false");
  }
});

it("exposes a blocked reason with item details closed and keeps source and evidence inside", () => {
  const value: AcceptanceSnapshot = { ...snapshot("blocked"), items: [{ id: "blocked", title: "BLOCKED_ITEM", status: "blocked",
    reason: "BLOCKED_REASON_SENTINEL", source: { requestId: "REQUEST", text: "SOURCE_SENTINEL", scope: null },
    evidence: [{ expected: "EXPECTED_SENTINEL", observed: "OBSERVED_SENTINEL", passed: false }] }] };
  const note = mountNote(value); expandNote();
  const row = node<HTMLDetailsElement>("ai-sticky-item");
  expect(row.open).toBe(false);
  const reason = note.root.querySelector<HTMLElement>(".ai-sticky-block-reason");
  if (!reason) throw new Error("Missing rendered blocked reason");
  expect(reason.hidden).toBe(false);
  expect(reason.textContent).toContain(value.items[0]!.reason);
  // A summary descendant remains exposed when its own details is closed.
  expect(!row.contains(reason) || row.querySelector("summary")!.contains(reason)).toBe(true);
  expect(row.querySelector("summary")!.textContent).not.toContain("SOURCE_SENTINEL");
  expect(row.querySelector("summary")!.textContent).not.toContain("OBSERVED_SENTINEL");
  expect(row.contains(node("ai-sticky-evidence"))).toBe(true);
  note.update({ ...value, status: "working", items: [{ ...value.items[0]!, status: "working", reason: undefined }] });
  expect(note.root.querySelector<HTMLElement>(".ai-sticky-block-reason")?.hidden ?? true).toBe(true);
});

it("folds verified rows separately and retains disclosure and focus when a row becomes active again", () => {
  const mapId = store.getCurrent().startMapId;
  const value: AcceptanceSnapshot = { ...snapshot(), items: [
    { id: "active", title: "ACTIVE", status: "working", evidence: [] },
    { id: "done", title: "DONE", status: "verified", evidence: [], mapId },
  ] };
  const note = mountNote(value); expandNote();
  const group = verifiedGroup();
  const row = note.root.querySelector<HTMLDetailsElement>("[data-item-id='done']")!;
  expect(group.open).toBe(false);
  expect(group.contains(row)).toBe(true);
  expect(group.contains(note.root.querySelector("[data-item-id='active']"))).toBe(false);
  group.open = true; row.open = true;
  const navigate = row.querySelector<HTMLButtonElement>("[data-testid='ai-sticky-navigate']")!; navigate.focus();
  note.update({ ...value, items: [value.items[0]!, { ...value.items[1]!, evidence: [{ expected: "EXPECTED", observed: "CURRENT", passed: true }] }] });
  expect(verifiedGroup()).toBe(group);
  expect(group.open).toBe(true); expect(row.open).toBe(true); expect(document.activeElement).toBe(navigate);
  note.update({ ...value, status: "blocked", items: [value.items[0]!, { ...value.items[1]!, status: "blocked", reason: "INVALIDATED" }] });
  expect(note.root.querySelector("[data-item-id='done']")).toBe(row);
  expect(group.contains(row)).toBe(false);
  expect(row.open).toBe(true); expect(document.activeElement).toBe(navigate);
  expect(row.dataset.status).toBe("blocked");
});

it("returns collapsed detail focus to the toggle without stealing native navigation keys", () => {
  const note = mountNote({ ...snapshot(), items: [{ id: "map", title: "MAP", status: "working", evidence: [], mapId: store.getCurrent().startMapId }] });
  expandNote(); node<HTMLDetailsElement>("ai-sticky-item").open = true;
  const navigate = node<HTMLButtonElement>("ai-sticky-navigate"); navigate.focus();
  for (const key of ["ArrowDown", "Home", "End", " "]) {
    const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }); navigate.dispatchEvent(event);
    expect(shouldIgnoreEditorShortcut(event)).toBe(true); expect(event.defaultPrevented).toBe(false);
  }
  node("ai-sticky-toggle").click();
  expect(document.activeElement).toBe(node("ai-sticky-toggle"));
  expect(node("ai-sticky-toggle").getAttribute("aria-expanded")).toBe("false");
  expect(note.root.querySelector("input, [role='checkbox']")).toBeNull();
});

it.each(["pointercancel", "lostpointercapture", "hide", "clear", "dispose"] as const)("ends captured checklist drag on %s", boundary => {
  const note = mountNote();
  const handle = node("ai-sticky-drag");
  const captured = new Set<number>();
  handle.setPointerCapture = vi.fn(id => { captured.add(id); });
  handle.hasPointerCapture = id => captured.has(id);
  handle.releasePointerCapture = vi.fn(id => { captured.delete(id); });
  vi.spyOn(note.root, "getBoundingClientRect").mockReturnValue(new DOMRect(100, 100, 280, 80));
  const pointer = (type: string, x: number) => handle.dispatchEvent(new PointerEvent(type, {
    bubbles: true, cancelable: true, pointerId: 7, button: 0, clientX: x, clientY: 120,
  }));
  const initial = note.root.style.cssText;
  pointer("pointerdown", 120); expect(handle.hasPointerCapture(7)).toBe(true);
  pointer("pointermove", 170); expect(note.root.style.cssText).not.toBe(initial);
  if (boundary === "hide") { assertVisibilityApi(note); note.hide(); }
  else if (boundary === "clear") note.update(null);
  else if (boundary === "dispose") note.dispose();
  else {
    if (boundary === "lostpointercapture") captured.delete(7);
    pointer(boundary, 170);
  }
  expect(handle.hasPointerCapture(7)).toBe(false);
  const stopped = note.root.style.cssText;
  pointer("pointermove", 230); pointer("pointerup", 230);
  expect(note.root.style.cssText).toBe(stopped);
});

it.each(["header", "composer"] as const)("reopens hidden fresh acceptance through the actual %s AI menu", async variant => {
  const held = signal(); const release = signal(); const terminal = signal();
  let current = snapshot("verified");
  const refresh = vi.fn((_project: ReturnType<typeof store.getCurrent>, onEvent?: (event: SessionEvent) => void) => {
    current = snapshot("blocked"); onEvent?.({ type: "acceptance", snapshot: current });
  });
  vi.mocked(recordAiActivity).mockImplementation(async record => {
    if (record.result && record.result.pending !== true) terminal.resolve();
    return buildAiActivityLogRecord(record);
  });
  vi.spyOn(AssistantSession.prototype, "sendUserMessage").mockImplementation(async function (this: AssistantSession, _text, onEvent) {
    Object.defineProperty(this, "getAcceptanceSnapshot", { value: () => current, configurable: true });
    Object.defineProperty(this, "refreshAcceptance", { value: refresh, configurable: true });
    onEvent?.({ type: "acceptance", snapshot: current }); held.resolve(); await release.promise;
    return { assistantText: "", proposedCalls: [], stoppedReason: "final" };
  });
  document.body.append(renderAiChatPanel()); await bounded(whenAiChatPanelSettled());
  for (const id of ["ai-more-acceptance-show", "ai-command-menu-acceptance-show"]) {
    expect(node<HTMLButtonElement>(id).hidden).toBe(true);
    expect(node<HTMLButtonElement>(id).disabled).toBe(true);
  }
  node<HTMLTextAreaElement>("ai-input").value = "REOPEN_FIXTURE"; node("ai-send").click();
  try {
    await bounded(held.promise);
    const root = node("ai-sticky-checklist");
    for (const id of ["ai-more-acceptance-show", "ai-command-menu-acceptance-show"]) {
      expect(node<HTMLButtonElement>(id).hidden).toBe(false);
      expect(node<HTMLButtonElement>(id).disabled).toBe(true);
    }
    node("ai-sticky-hide").click();
    expect(root.isConnected).toBe(true);
    expect(root.isConnected && !root.hidden).toBe(false);
    expect(document.activeElement).toBe(node("ai-input"));
    expect(root.contains(document.activeElement)).toBe(false);
    store.update(project => { project.meta.title = "HIDDEN_MUTATION"; }, { scope: "project", label: "acceptance hidden refresh test" });
    expect(refresh).toHaveBeenCalledWith(store.getCurrent(), expect.any(Function));
    expect(root.isConnected && !root.hidden).toBe(false);
    const prefix = variant === "header" ? "ai-more" : "ai-command-menu";
    if (variant === "header") {
      node("ai-more-menu-toggle").click(); node<HTMLDetailsElement>("ai-more-actions").open = true;
    } else node("ai-command-menu-toggle").click();
    const reopen = node<HTMLButtonElement>(`${prefix}-acceptance-show`);
    expect(reopen.disabled).toBe(false); expect(reopen.hidden).toBe(false); reopen.click();
    expect(root.isConnected && !root.hidden).toBe(true);
    expect(node("ai-sticky-item").dataset.status).toBe("blocked");
    expect(node("ai-sticky-count").textContent).toBe("0/1");
    expect(document.activeElement).toBe(node("ai-sticky-toggle"));
    expect(reopen.disabled).toBe(true);
    node("ai-new-chat").click(); reopen.click();
    expect(reopen.hidden).toBe(true); expect(reopen.disabled).toBe(true);
    expect(document.querySelector("[data-testid='ai-sticky-checklist']")).toBeNull();
  } finally { release.resolve(); await bounded(terminal.promise); }
});

it("orders active required work first and keeps compact activity live even while hidden", () => {
  const value: AcceptanceSnapshot = { ...snapshot(), items: [
    { id: "optional", title: "OPTIONAL_SENTINEL", required: false, status: "working", evidence: [] },
    { id: "pending", title: "PENDING_SENTINEL", status: "pending", evidence: [] },
    { id: "verifying", title: "VERIFYING_SENTINEL", status: "verifying", evidence: [] },
    { id: "blocked", title: "BLOCKED_SENTINEL", status: "blocked", evidence: [] },
    { id: "working", title: "WORKING_SENTINEL", status: "working", evidence: [] },
  ] };
  const note = mountNote(value);
  expect([...note.root.querySelectorAll<HTMLElement>(".ai-sticky-list > [data-item-id]")].map(row => row.dataset.itemId))
    .toEqual(["blocked", "working", "verifying", "pending"]);
  const inline = note.root.querySelector<HTMLElement>(".ai-sticky-activity-inline")!;
  expect(inline.textContent).not.toContain("OPTIONAL_SENTINEL");
  expect(inline.textContent).toContain("VERIFYING_SENTINEL");
  note.setActivity("ACTIVITY_SENTINEL"); expect(inline.textContent).toBe("ACTIVITY_SENTINEL");
  note.hide(); note.setActivity("HIDDEN_ACTIVITY_SENTINEL");
  expect(note.root.hidden).toBe(true); expect(note.root.isConnected).toBe(true);
  note.show(); expect(inline.textContent).toBe("HIDDEN_ACTIVITY_SENTINEL");
  expect(node("ai-sticky-toggle").getAttribute("aria-expanded")).toBe("false");
});

it("clamps a primary captured drag and resets position, disclosure and hiding on new acceptance", () => {
  const note = mountNote(); expandNote(); node<HTMLDetailsElement>("ai-sticky-item").open = true;
  const handle = node("ai-sticky-drag"); const captured = new Set<number>();
  handle.setPointerCapture = id => { captured.add(id); };
  handle.hasPointerCapture = id => captured.has(id);
  handle.releasePointerCapture = id => { captured.delete(id); };
  vi.spyOn(note.root, "getBoundingClientRect").mockReturnValue(new DOMRect(100, 100, 280, 80));
  note.root.style.setProperty("--editor-left-safe", "40px");
  note.root.style.setProperty("--space-3", "12px");
  note.root.style.setProperty("--ai-sticky-toolbar-bottom", "90px");
  const pointer = (type: string, id: number, x: number, y: number, button = 0) => handle.dispatchEvent(new PointerEvent(type, {
    bubbles: true, cancelable: true, pointerId: id, button, clientX: x, clientY: y,
  }));
  pointer("pointerdown", 7, 120, 120, 2); expect(captured.size).toBe(0);
  pointer("pointerdown", 7, 120, 120);
  pointer("pointermove", 8, 9999, 9999); expect(note.root.style.left).toBe("");
  pointer("pointermove", 7, -9999, -9999);
  expect(note.root.style.left).toBe("52px"); expect(note.root.style.top).toBe("102px");
  pointer("pointermove", 7, 9999, 9999);
  expect(parseFloat(note.root.style.left)).toBe(window.innerWidth - 280 - 12);
  expect(parseFloat(note.root.style.top)).toBe(window.innerHeight - 80 - 12);
  pointer("pointerup", 7, 9999, 9999); expect(captured.size).toBe(0);
  const retained = node("ai-sticky-item"); note.hide();
  note.update({ ...snapshot(), id: "NEW_ACCEPTANCE" });
  expect(note.root.hidden).toBe(false); expect(note.root.dataset.hiddenByUser).toBe("false");
  expect(note.root.style.left).toBe(""); expect(note.root.style.top).toBe("");
  expect(node("ai-sticky-toggle").getAttribute("aria-expanded")).toBe("false");
  expect(node("ai-sticky-item")).not.toBe(retained); expect(node<HTMLDetailsElement>("ai-sticky-item").open).toBe(false);
});

it.each(["live", "terminal"] as const)("manual saved-history adoption retires outgoing %s acceptance through real controls", async publication => {
  // clearConversations tombstones prior records; each case owns its saved ID.
  const savedConversationId = `saved-history-target-${publication}`;
  const held = signal(); const release = signal(); const outgoingTerminal = signal(); const restoredTerminal = signal();
  const outgoing = { ...snapshot("verified"), id: "OUTGOING_OWNER", goal: "OUTGOING_OWNER" };
  let publish: ((event: SessionEvent) => void) | undefined;
  let outgoingSignal: AbortSignal | undefined;
  const sent: string[] = [];
  vi.mocked(recordAiActivity).mockImplementation(async record => {
    if (record.result && record.result.pending !== true) {
      if (record.instruction === "OUTGOING_REQUEST") outgoingTerminal.resolve();
      if (record.instruction === "RESTORED_REQUEST") restoredTerminal.resolve();
    }
    return buildAiActivityLogRecord(record);
  });
  vi.spyOn(AssistantSession.prototype, "sendUserMessage").mockImplementation(async function (this: AssistantSession, text, onEvent, abort) {
    const request = text.split("\n")[0]!;
    sent.push(request);
    if (request === "OUTGOING_REQUEST") {
      publish = onEvent; outgoingSignal = abort;
      Object.defineProperty(this, "getAcceptanceSnapshot", { value: () => outgoing, configurable: true });
      onEvent?.({ type: "acceptance", snapshot: { ...outgoing, status: "working" } });
      held.resolve(); await release.promise;
      return { assistantText: "OUTGOING_TERMINAL", proposedCalls: [], stoppedReason: "final" };
    }
    return { assistantText: "RESTORED_RESPONSE", proposedCalls: [], stoppedReason: "final" };
  });
  document.body.append(renderAiChatPanel()); await bounded(whenAiChatPanelSettled());
  expect((await saveConversation({ id: savedConversationId, title: "HISTORY_TARGET", model: "fixture", savedAt: 1,
    projectContextKey: conversationScopeKey(store.getProjectIdentity(), store.getCurrent()),
    entries: [{ kind: "user", text: "SAVED_REQUEST" }, { kind: "assistant", text: "SAVED_RESPONSE" }],
  })).ok).toBe(true);
  node<HTMLTextAreaElement>("ai-input").value = "OUTGOING_REQUEST"; node("ai-send").click();
  try {
    await bounded(held.promise);
    node<HTMLTextAreaElement>("ai-input").value = "QUEUED_OUTGOING_REQUEST";
    node("ai-input").dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
    node("ai-open-conversations").click(); await bounded(whenAiConversationHistoryModalSettled());
    // This saved fixture has no map attribution; explicitly browse the whole project.
    node("ai-history-filter-all").click(); await bounded(whenAiConversationHistoryModalSettled());
    const search = node<HTMLInputElement>("ai-history-search"); search.value = "HISTORY_TARGET";
    search.dispatchEvent(new Event("input", { bubbles: true })); await bounded(whenAiConversationHistoryModalSettled());
    node("ai-history-open").click(); await bounded(whenAiConversationHistoryModalSettled());
    expect(document.querySelector("[data-testid='ai-sticky-checklist']")).toBeNull();
    expect(node("ai-chat-log").textContent).toContain("SAVED_RESPONSE");
    if (publication === "live") publish?.({ type: "acceptance", snapshot: outgoing });
    else { release.resolve(); await bounded(outgoingTerminal.promise); }
    expect(document.querySelector("[data-testid='ai-sticky-checklist']")).toBeNull();
    expect(outgoingSignal?.aborted).toBe(true);
    expect(node<HTMLButtonElement>("ai-abort").hidden).toBe(true);
    expect(node<HTMLButtonElement>("ai-send").disabled).toBe(false);
    node<HTMLTextAreaElement>("ai-input").value = "RESTORED_REQUEST"; node("ai-send").click();
    await bounded(restoredTerminal.promise);
    expect(node("ai-chat-log").textContent).toContain("RESTORED_RESPONSE");
  } finally { release.resolve(); await bounded(outgoingTerminal.promise); }
  await bounded(whenAiChatPanelSettled());
  expect(sent).toEqual(["OUTGOING_REQUEST", "RESTORED_REQUEST"]);
  expect(document.querySelector("[data-testid='ai-sticky-checklist']")).toBeNull();
  expect(node("ai-chat-log").textContent).not.toContain("OUTGOING_TERMINAL");
  const restored = await loadConversation(savedConversationId);
  expect(restored?.entries.some(entry => entry.kind === "assistant" && entry.text === "SAVED_RESPONSE")).toBe(true);
  expect(restored?.entries.some(entry => entry.kind === "assistant" && entry.text === "OUTGOING_TERMINAL")).toBe(false);
});

it.each(["project", "dispose"] as const)("rejects old live and terminal acceptance immediately after %s retirement", async boundary => {
  const held = signal(); const release = signal(); const terminal = signal();
  let publish: ((event: SessionEvent) => void) | undefined;
  vi.mocked(recordAiActivity).mockImplementation(async record => {
    if (record.result && record.result.pending !== true) terminal.resolve();
    return buildAiActivityLogRecord(record);
  });
  vi.spyOn(AssistantSession.prototype, "sendUserMessage").mockImplementation(async function (this: AssistantSession, _text, onEvent) {
    publish = onEvent;
    Object.defineProperty(this, "getAcceptanceSnapshot", { value: () => snapshot("verified"), configurable: true });
    onEvent?.({ type: "acceptance", snapshot: snapshot() }); held.resolve(); await release.promise;
    onEvent?.({ type: "acceptance", snapshot: snapshot("verified") });
    return { assistantText: "", proposedCalls: [], stoppedReason: "final" };
  });
  document.body.append(renderAiChatPanel()); await bounded(whenAiChatPanelSettled());
  node<HTMLTextAreaElement>("ai-input").value = "RETIREMENT_FIXTURE"; node("ai-send").click();
  try {
    await bounded(held.promise);
    if (boundary === "project") store.replaceProject(createBlankProject()); else teardownAiChatPanel();
    expect(document.querySelector("[data-testid='ai-sticky-checklist']")).toBeNull();
    publish?.({ type: "acceptance", snapshot: snapshot("verified") });
    expect(document.querySelector("[data-testid='ai-sticky-checklist']")).toBeNull();
  } finally { release.resolve(); await bounded(terminal.promise); }
  await bounded(whenAiChatPanelSettled());
  expect(document.querySelector("[data-testid='ai-sticky-checklist']")).toBeNull();
});
