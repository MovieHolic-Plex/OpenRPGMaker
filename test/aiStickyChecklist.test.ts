// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AssistantSession, type SessionEvent } from "@/ai/assistantSession";
import type { AcceptanceSnapshot } from "@/ai/assistantAcceptance";
import { buildAiActivityLogRecord, recordAiActivity } from "@/ai/activityLog";
import { clearConversations } from "@/ai/conversationStore";
import { renderAiChatPanel, teardownAiChatPanel, whenAiChatPanelSettled } from "@/editor/panels/aiChatPanel";
import { editorState } from "@/editor/editorState";
import { store } from "@/project/store";
import { createBlankProject } from "@/project/defaults";
import { createAiStickyChecklist } from "@/editor/panels/aiStickyChecklist";
import { subscribeEditorCameraFocus } from "@/editor/editorCameraFocus";

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
  const details = node<HTMLDetailsElement>("ai-sticky-item"); details.open = true;
  const navigate = node<HTMLButtonElement>("ai-sticky-navigate"); navigate.focus();
  // When the same item receives verified evidence.
  note.update({ ...initial, status: "verified", items: [{ ...item, status: "verified", evidence: [{ expected: "EXPECTED", observed: "OBSERVED", passed: true }] }] });
  // Then native interaction identity and backend evidence are preserved.
  expect(node("ai-sticky-item")).toBe(details);
  expect(details.open).toBe(true); expect(document.activeElement).toBe(navigate);
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
