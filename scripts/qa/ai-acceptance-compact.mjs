/**
 * Real-editor visual/interaction QA for the compact AI acceptance note.
 * Usage: node scripts/qa/ai-acceptance-compact.mjs
 * Env: OPRN_URL (default http://127.0.0.1:9857), QA_CAPTURE=0 for image-free functional QA.
 * Publishes acceptance through aiChatPanel send → turnRunner.showAcceptance.
 * No live LLM. No remote DB writes.
 */
import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { applyLegacyEnvAliases } from "../lib/oprnEnv.mjs";

applyLegacyEnvAliases();


const BASE = process.env.OPRN_URL ?? "http://127.0.0.1:9857";
const OUT = path.resolve("output/evidence/ai-acceptance-compact");
const SHOT = path.join(OUT, "qa");
const CAPTURE = process.env.QA_CAPTURE !== "0";
const REPORT = CAPTURE ? "qa-report.json" : "qa-functional-report.json";
const assertions = [];
const shots = [];
const remainingIssues = [];

function assert(id, ok, detail) {
  assertions.push({ id, ok: !!ok, detail: detail ?? "" });
  if (!ok) console.error(`FAIL ${id}: ${detail}`);
}

function snapshot(mapId) {
  const source = (text) => ({ requestId: "req-1", text, scope: null });
  return {
    id: "acceptance-qa-live",
    goal: "마을 입구를 연결하고 상점 구매를 가능하게 만들기",
    status: "working",
    items: [
      {
        id: "item-verified-a",
        title: "월드맵 크기를 가로 스물두 칸 세로 열일곱 칸으로 정확하게 맞추기",
        status: "verified",
        reason: "맵 크기가 22×17입니다.",
        source: source("월드맵을 정확히 가로 22칸, 세로 17칸으로 변경해줘."),
        evidence: [{ expected: "width=22 height=17", observed: "width=22 height=17", passed: true }],
        mapId,
      },
      {
        id: "item-verified-b",
        title: "입구 타일을 마을 길과 연결하기",
        status: "verified",
        reason: "입구에서 광장까지 도달 가능합니다.",
        source: source("입구와 마을을 연결해줘."),
        evidence: [{ expected: "입구에서 광장까지 걷기", observed: "도달함", passed: true }],
        mapId,
      },
      {
        id: "item-working",
        title: "상점 NPC가 실제 구매를 처리하게 만들기",
        status: "working",
        reason: "상점 이벤트를 작성 중입니다.",
        source: source("상점에서 물약을 살 수 있게 해줘."),
        evidence: [{ expected: "구매 후 골드 감소와 물약 증가", observed: "상점 이벤트 없음", passed: false }],
        mapId,
      },
      {
        id: "item-blocked",
        title: "왕복 이동으로 여관에 들어가고 나오기",
        status: "blocked",
        reason: "여관 입구 타일에 이동 이벤트가 없습니다.",
        source: source("여관에 들어갔다가 나올 수 있게 해줘."),
        evidence: [{ expected: "여관 입구와 출구 왕복", observed: "입구 이벤트 없음", passed: false }],
        mapId,
      },
      {
        id: "item-optional",
        title: "선택: 안내판에 아주 긴 한국어 마을 이름을 쓰기",
        status: "verified",
        required: false,
        reason: "안내판 텍스트가 있습니다.",
        source: source("가능하면 안내판도 달아줘."),
        evidence: [{ expected: "마을 이름", observed: "봄빛 마을", passed: true }],
        mapId,
      },
      {
        id: "item-withdrawn",
        title: "광장 분수를 장식하기",
        status: "pending",
        reason: "",
        source: source("분수도 만들어줘."),
        evidence: [],
        withdrawal: {
          acceptanceId: "acceptance-qa-live",
          requirementId: "item-withdrawn",
          reason: "사용자가 완료 범위에서 이 요구를 제외함",
          source: "user",
        },
        mapId,
      },
    ],
  };
}

async function boot(page) {
  await page.route("**/rest/v1/**", (route) => route.fulfill({ json: [] }));
  await page.route("**/auth/status?*", (route) => route.fulfill({
    json: { connected: true, authKind: "oauth", expired: false, env: false },
  }));
  await page.route("**/v1/chat/completions", (route) => route.fulfill({
    json: { choices: [{ message: { role: "assistant", content: "fixture-noop" }, finish_reason: "stop" }] },
  }));
  await page.route("**/api/ai**", (route) => route.fulfill({
    json: { choices: [{ message: { role: "assistant", content: "fixture-noop" }, finish_reason: "stop" }] },
  }));
  await page.addInitScript(() => {
    localStorage.setItem("oprn:editor-ui-mode", "standard");
    localStorage.setItem("oprn:editor-welcome-dismissed", "1");
    localStorage.setItem("oprn:standard-welcome-seen", "1");
    localStorage.setItem("oprn:coachmarks-basic-v1", "1");
    localStorage.setItem("oprn:ai-config", JSON.stringify({
      configVersion: 2, agentMode: "auto", autonomyLevel: "balanced",
    }));
  });
  await page.goto(`${BASE}/?blankProject=1&aiBridge=0`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  const ready = page.getByTestId("login-guest").or(page.getByTestId("ai-input")).first();
  await ready.waitFor({ state: "visible", timeout: 45_000 });
  if (await page.getByTestId("login-guest").isVisible()) await page.getByTestId("login-guest").click();
  await page.getByTestId("edit-canvas").waitFor({ state: "visible", timeout: 60_000 });
  await page.getByTestId("ai-input").waitFor({ state: "visible", timeout: 30_000 });
}

async function installPublisher(page, mapId) {
  const value = snapshot(mapId);
  await page.evaluate(async (next) => {
    window.__qaSnapshot = next;
    const { AssistantSession } = await import("/src/ai/assistantSession.ts");
    AssistantSession.prototype.sendUserMessage = async function (_text, onEvent) {
      const current = () => window.__qaSnapshot;
      Object.defineProperty(this, "getAcceptanceSnapshot", { value: current, configurable: true });
      Object.defineProperty(this, "refreshAcceptance", {
        value: (_project, onRefresh) => {
          const snap = current();
          if (snap) onRefresh?.({ type: "acceptance", snapshot: snap });
        },
        configurable: true,
      });
      onEvent?.({ type: "acceptance", snapshot: current() });
      return { assistantText: "fixture-acceptance", proposedCalls: [], stoppedReason: "final" };
    };
  }, value);
}

// Subscribe before the action; DOM mutations and resize events, never polling, settle the signal.
async function transition(page, condition, action) {
  await page.evaluate((source) => {
    const ready = new Function(`return (${source})()`);
    let finish;
    const observer = new MutationObserver(() => { if (ready()) finish(); });
    const onResize = () => { if (ready()) finish(); };
    const promise = new Promise((resolve, reject) => {
      const timer = setTimeout(() => { cleanup(); reject(new Error(`Missing QA state: ${source}`)); }, 20_000);
      function cleanup() { clearTimeout(timer); observer.disconnect(); window.removeEventListener("resize", onResize); }
      finish = () => { cleanup(); resolve(); };
      observer.observe(document.documentElement, { attributes: true, childList: true, subtree: true, characterData: true });
      window.addEventListener("resize", onResize);
      if (ready()) finish();
    });
    // Attach a rejection observer immediately; the same rejection is awaited after the action.
    window.__qaTransition = { result: promise.then(() => ({ ok: true }), error => ({ ok: false, message: error.message })), cancel: finish };
  }, condition.toString());
  try {
    await action();
    const result = await page.evaluate(() => window.__qaTransition.result);
    if (!result.ok) throw new Error(result.message);
  } finally {
    await page.evaluate(() => { window.__qaTransition.cancel(); delete window.__qaTransition; });
  }
}

async function publishViaPanel(page) {
  const input = page.getByTestId("ai-input");
  await input.fill("ACCEPTANCE_QA_FIXTURE");
  await transition(page, () => !!document.querySelector("[data-testid=ai-sticky-checklist]")
    && document.querySelector("[data-testid=ai-send]")?.disabled === false,
  () => page.getByTestId("ai-send").click());
}

async function verifyHistoryRace(page, mapId) {
  await page.evaluate(async (outgoing) => {
    const { whenAiChatPanelSettled } = await import("/src/editor/panels/aiChatPanel.ts");
    const { saveConversation, conversationScopeKey } = await import("/src/ai/conversationStore.ts");
    const { store } = await import("/src/project/store.ts");
    const { AssistantSession } = await import("/src/ai/assistantSession.ts");
    await whenAiChatPanelSettled();
    const saved = await saveConversation({ id: "qa-history-race-target", title: "HISTORY_RACE_TARGET", model: "fixture", savedAt: 1,
      projectContextKey: conversationScopeKey(store.getProjectIdentity(), store.getCurrent()),
      entries: [{ kind: "user", text: "HISTORY_SAVED_REQUEST" }, { kind: "assistant", text: "HISTORY-SAVED-RESPONSE" }],
    });
    if (!saved.ok) throw new Error("History race fixture could not be saved");
    const deferred = () => {
      let resolve;
      const promise = new Promise(done => { resolve = done; });
      return { promise, resolve };
    };
    const bounded = (promise, label) => new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`Missing history race signal: ${label}`)), 20_000);
      promise.then(value => { clearTimeout(timer); resolve(value); }, error => { clearTimeout(timer); reject(error); });
    });
    const held = deferred(); const released = deferred(); const terminal = deferred(); const restored = deferred();
    const previousSend = AssistantSession.prototype.sendUserMessage;
    const activityDescriptor = Object.getOwnPropertyDescriptor(window, "__oprnAiActivityLog");
    let activity = window.__oprnAiActivityLog;
    // Observe the production publisher; do not substitute a transport-completion signal.
    Object.defineProperty(window, "__oprnAiActivityLog", { configurable: true, enumerable: true,
      get: () => activity,
      set: record => {
        activity = record;
        if (record?.result && record.result.pending !== true) {
          if (record.instruction === "HISTORY_OUTGOING_REQUEST") terminal.resolve(record);
          if (record.instruction === "HISTORY_RESTORED_REQUEST") restored.resolve(record);
        }
      },
    });
    const state = {
      signal: null, publish: null, requests: [],
      waitHeld: () => bounded(held.promise, "held transport"),
      waitTerminal: () => bounded(terminal.promise, "outgoing runner terminal activity"),
      waitRestored: () => bounded(restored.promise, "restored runner terminal activity"),
      release: released.resolve,
      restore: () => {
        AssistantSession.prototype.sendUserMessage = previousSend;
        Object.defineProperty(window, "__oprnAiActivityLog", { ...activityDescriptor, value: activity });
      },
    };
    window.__qaHistoryRace = state;
    AssistantSession.prototype.sendUserMessage = async function (text, onEvent, signal) {
      const request = text.split("\n")[0]; state.requests.push(request);
      if (request === "HISTORY_OUTGOING_REQUEST") {
        state.signal = signal;
        state.publish = () => onEvent?.({ type: "acceptance", snapshot: outgoing });
        Object.defineProperty(this, "getAcceptanceSnapshot", { value: () => outgoing, configurable: true });
        state.publish(); held.resolve(); await released.promise;
        state.publish();
        return { assistantText: "HISTORY_OUTGOING_TERMINAL", proposedCalls: [], stoppedReason: "final" };
      }
      return { assistantText: "HISTORY-RESTORED-RESPONSE", proposedCalls: [], stoppedReason: "final" };
    };
  }, { ...snapshot(mapId), id: "HISTORY_OUTGOING_OWNER", goal: "HISTORY_OUTGOING_OWNER" });
  try {
    await page.getByTestId("ai-input").fill("HISTORY_OUTGOING_REQUEST");
    await page.getByTestId("ai-send").click();
    await page.evaluate(() => window.__qaHistoryRace.waitHeld());
    await page.getByTestId("ai-input").fill("HISTORY_QUEUED_OUTGOING");
    await page.getByTestId("ai-input").press("Enter");
    assert("history-queued-before-adoption", await page.getByTestId("ai-pending-queue").isVisible(), "queued send missing");
    await page.getByTestId("ai-open-conversations").click();
    const target = page.getByTestId("ai-history-open").filter({ hasText: "HISTORY_RACE_TARGET" });
    await transition(page, () => !document.querySelector("[data-testid=ai-history-modal]")
      && document.querySelector("[data-testid=ai-chat-log]")?.textContent.includes("HISTORY-SAVED-RESPONSE"), () => target.click());
    const adopted = await page.evaluate(() => ({
      note: !!document.querySelector("[data-testid=ai-sticky-checklist]"),
      aborted: window.__qaHistoryRace.signal?.aborted,
      busy: document.querySelector("[data-testid=ai-send]")?.disabled,
      queued: document.querySelector("[data-testid=ai-pending-queue]")?.hidden === false,
    }));
    assert("history-adoption-retires-owner", !adopted.note && adopted.aborted === true && adopted.busy === false && !adopted.queued, JSON.stringify(adopted));
    const lateLive = await page.evaluate(() => {
      window.__qaHistoryRace.publish();
      return !!document.querySelector("[data-testid=ai-sticky-checklist]");
    });
    assert("history-late-live-rejected", lateLive === false, `note=${lateLive}`);
    await page.evaluate(() => window.__qaHistoryRace.release());
    const terminal = await page.evaluate(() => window.__qaHistoryRace.waitTerminal());
    assert("history-runner-terminal-observed", terminal.result.orphaned === true, JSON.stringify(terminal.result));
    assert("history-late-terminal-rejected", await page.getByTestId("ai-sticky-checklist").count() === 0, "outgoing checklist remounted after runner finalization");
    await page.getByTestId("ai-input").fill("HISTORY_RESTORED_REQUEST");
    await page.getByTestId("ai-send").click();
    await page.evaluate(() => window.__qaHistoryRace.waitRestored());
    const final = await page.evaluate(async () => {
      const { whenAiChatPanelSettled } = await import("/src/editor/panels/aiChatPanel.ts");
      const { loadConversation } = await import("/src/ai/conversationStore.ts");
      await whenAiChatPanelSettled();
      const record = await loadConversation("qa-history-race-target");
      return { requests: window.__qaHistoryRace.requests,
        log: document.querySelector("[data-testid=ai-chat-log]")?.textContent ?? "",
        saved: record?.entries.some(entry => entry.kind === "assistant" && entry.text === "HISTORY-SAVED-RESPONSE"),
        contaminated: record?.entries.some(entry => entry.kind === "assistant" && entry.text === "HISTORY_OUTGOING_TERMINAL"),
      };
    });
    assert("history-restored-conversation-usable", final.log.includes("HISTORY-RESTORED-RESPONSE") && final.saved === true && final.contaminated === false, JSON.stringify(final));
    assert("history-outgoing-queue-discarded", JSON.stringify(final.requests) === JSON.stringify(["HISTORY_OUTGOING_REQUEST", "HISTORY_RESTORED_REQUEST"]), JSON.stringify(final.requests));
  } finally {
    await page.evaluate(async () => {
      const state = window.__qaHistoryRace;
      state.release();
      try { await state.waitTerminal(); }
      finally { state.restore(); delete window.__qaHistoryRace; }
    });
  }
}

async function measure(page) {
  return page.evaluate(() => {
    const node = document.querySelector("[data-testid=ai-sticky-checklist]");
    if (!node) return { missing: true };
    const style = getComputedStyle(node);
    const rect = node.getBoundingClientRect();
    const count = node.querySelector("[data-testid=ai-sticky-count]");
    const activityInline = node.querySelector(".ai-sticky-activity-inline");
    const activity = node.querySelector(".ai-sticky-activity");
    const body = node.querySelector(".ai-sticky-body");
    const list = node.querySelector(".ai-sticky-list");
    const verifiedGroup = node.querySelector("[data-testid=ai-sticky-verified-group]");
    const optionalGroup = node.querySelector("[data-testid=ai-sticky-optional-group]");
    const withdrawnGroup = node.querySelector("[data-testid=ai-sticky-withdrawn-group]");
    const rows = Array.from(node.querySelectorAll("[data-testid=ai-sticky-item]")).map((row) => {
      const summary = row.querySelector("summary");
      const withdraw = row.querySelector("[data-testid=ai-requirement-withdraw]");
      const block = row.querySelector(".ai-sticky-block-reason");
      return {
        id: row.dataset.itemId,
        status: row.dataset.status,
        required: row.dataset.required,
        withdrawn: row.dataset.withdrawn,
        parent: row.parentElement?.className ?? "",
        open: row.open,
        summaryText: summary?.textContent ?? "",
        withdrawInSummary: !!(withdraw && summary?.contains(withdraw)),
        withdrawInDetail: !!(withdraw && row.querySelector(".ai-sticky-item-detail")?.contains(withdraw)),
        blockText: block?.textContent ?? "",
        blockHidden: block?.hidden ?? true,
      };
    });
    const toolbar = document.querySelector(".canvas-toolbar");
    return {
      missing: false,
      viewport: { width: window.innerWidth, height: window.innerHeight },
      hidden: node.hidden,
      hiddenByUser: node.dataset.hiddenByUser,
      expanded: node.dataset.expanded,
      status: node.dataset.status,
      box: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      left: style.left,
      top: style.top,
      connected: node.isConnected,
      countText: count?.textContent ?? "",
      countHidden: count?.hidden ?? null,
      requiredVerified: count?.dataset.requiredVerified ?? "",
      activeRequired: count?.dataset.activeRequired ?? "",
      requiredCount: count?.dataset.requiredCount ?? "",
      verifiedCount: count?.dataset.verifiedCount ?? "",
      optionalCount: count?.dataset.optionalCount ?? "",
      withdrawnCount: count?.dataset.withdrawnCount ?? "",
      activityInline: activityInline?.textContent ?? "",
      activityInlineDisplay: activityInline ? getComputedStyle(activityInline).display : null,
      activityBodyDisplay: activity ? getComputedStyle(activity).display : null,
      bodyHidden: body?.hidden ?? null,
      listIds: Array.from(list?.querySelectorAll("[data-testid=ai-sticky-item]") ?? []).map((row) => row.dataset.itemId),
      verifiedGroup: { hidden: verifiedGroup?.hidden ?? true, open: verifiedGroup?.open ?? false, text: verifiedGroup?.querySelector("summary")?.textContent ?? "", ids: Array.from(verifiedGroup?.querySelectorAll("[data-testid=ai-sticky-item]") ?? []).map((row) => row.dataset.itemId) },
      optionalGroup: { hidden: optionalGroup?.hidden ?? true, open: optionalGroup?.open ?? false, text: optionalGroup?.querySelector("summary")?.textContent ?? "", ids: Array.from(optionalGroup?.querySelectorAll("[data-testid=ai-sticky-item]") ?? []).map((row) => row.dataset.itemId) },
      withdrawnGroup: { hidden: withdrawnGroup?.hidden ?? true, open: withdrawnGroup?.open ?? false, text: withdrawnGroup?.querySelector("summary")?.textContent ?? "", ids: Array.from(withdrawnGroup?.querySelectorAll("[data-testid=ai-sticky-item]") ?? []).map((row) => row.dataset.itemId) },
      rows,
      toolbarBottom: toolbar?.getBoundingClientRect().bottom ?? null,
      editorLeftSafe: getComputedStyle(document.documentElement).getPropertyValue("--editor-left-safe"),
      workPlanPresent: !!document.querySelector("[data-testid=ai-work-plan-checklist]"),
      activeElement: document.activeElement?.getAttribute("data-testid") ?? document.activeElement?.className ?? "",
      headerMenu: {
        toggleVisible: !!document.querySelector("[data-testid=ai-more-menu-toggle]")?.getClientRects().length,
        itemHidden: document.querySelector("[data-testid=ai-more-acceptance-show]")?.hidden ?? null,
        itemDisabled: document.querySelector("[data-testid=ai-more-acceptance-show]")?.disabled ?? null,
      },
      composerMenu: {
        toggleVisible: !!document.querySelector("[data-testid=ai-command-menu-toggle]")?.getClientRects().length,
        itemHidden: document.querySelector("[data-testid=ai-command-menu-acceptance-show]")?.hidden ?? null,
        itemDisabled: document.querySelector("[data-testid=ai-command-menu-acceptance-show]")?.disabled ?? null,
      },
    };
  });
}

async function shot(page, name, selector) {
  if (!CAPTURE) return measure(page);
  const full = path.join(SHOT, `${name}.png`);
  await page.screenshot({ path: full, fullPage: false });
  shots.push(full);
  if (selector) {
    const handle = page.locator(selector).first();
    if (await handle.count()) {
      const crop = path.join(SHOT, `${name}-crop.png`);
      if (await handle.isVisible()) {
        await handle.screenshot({ path: crop });
        shots.push(crop);
      }
    }
  }
  return measure(page);
}


async function openComposerMenu(page) {
  const toggle = page.getByTestId("ai-command-menu-toggle");
  if (!(await toggle.isVisible())) return false;
  await toggle.click();
  await page.getByTestId("ai-command-menu").waitFor({ state: "visible", timeout: 5_000 });
  return true;
}

mkdirSync(OUT, { recursive: true });
if (CAPTURE) mkdirSync(SHOT, { recursive: true });
const browser = await chromium.launch({
  args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.setDefaultTimeout(30_000);
const llmHits = [];
page.on("request", (request) => {
  const url = request.url();
  if (url.includes("/v1/chat/completions") || url.includes("/api/ai")) llmHits.push(url);
});

try {
  await boot(page);
  const mapId = await page.evaluate(async () => {
    const { store } = await import("/src/project/store.ts");
    return String(store.getCurrent().startMapId);
  });
  await installPublisher(page, mapId);
  const fixture = snapshot(mapId);
  const fixtureItem = id => fixture.items.find(item => item.id === id);
  await publishViaPanel(page);

  let data = await shot(page, "01-1440-compact-default", "[data-testid=ai-sticky-checklist]");
  assert("publish-via-panel", !data.missing && data.connected, "checklist attached after real send");
  assert("compact-default-1440", data.expanded === "false", `expanded=${data.expanded}`);
  assert("count-required", data.countText === "2/4", `count=${data.countText} rv=${data.requiredVerified} ar=${data.activeRequired}`);
  assert("count-datasets", data.verifiedCount === "2" && data.requiredCount === "4", `${data.verifiedCount}/${data.requiredCount}`);
  assert("optional-excluded", data.optionalCount === "1", data.optionalCount);
  assert("withdrawn-excluded", data.withdrawnCount === "1", data.withdrawnCount);
  assert("no-zero-zero", data.countText !== "0/0", data.countText);
  assert("activity-inline-compact", data.activityInlineDisplay !== "none" && data.activityInline.includes(fixtureItem("item-working").title), data.activityInline);
  assert("work-plan-absent", data.workPlanPresent === false, "work plan mounted");
  assert("active-list-order", JSON.stringify(data.listIds) === JSON.stringify(["item-working", "item-blocked"]), JSON.stringify(data.listIds));
  const blocked = data.rows.find((row) => row.id === "item-blocked");
  assert("blocked-reason-summary", !!blocked && !blocked.blockHidden && blocked.blockText === fixtureItem("item-blocked").reason, JSON.stringify(blocked));
  assert("withdraw-not-in-summary", data.rows.every((row) => !row.withdrawInSummary), "withdraw still in summary");
  assert("no-real-llm", llmHits.length === 0, llmHits.join(","));

  await page.getByTestId("ai-sticky-toggle").click();
  data = await shot(page, "02-1440-expanded", "[data-testid=ai-sticky-checklist]");
  assert("expanded", data.expanded === "true" && data.bodyHidden === false, `expanded=${data.expanded}`);
  assert("verified-group", !data.verifiedGroup.hidden && !data.verifiedGroup.open
    && JSON.stringify(data.verifiedGroup.ids) === JSON.stringify(["item-verified-a", "item-verified-b"]), JSON.stringify(data.verifiedGroup));
  assert("optional-group", !data.optionalGroup.hidden && data.optionalGroup.ids.includes("item-optional"), JSON.stringify(data.optionalGroup));
  assert("withdrawn-group", !data.withdrawnGroup.hidden && data.withdrawnGroup.ids.includes("item-withdrawn"), JSON.stringify(data.withdrawnGroup));

  await page.locator("[data-testid=ai-sticky-verified-group] > summary").click();
  data = await shot(page, "03-1440-verified-open", "[data-testid=ai-sticky-checklist]");
  assert("verified-open", data.verifiedGroup.open === true, "verified group closed");
  await page.locator("[data-testid=ai-sticky-optional-group] > summary").click();
  data = await measure(page);
  const optionalVerified = data.rows.find((row) => row.id === "item-optional");
  assert("optional-verified-truth", optionalVerified?.status === fixtureItem("item-optional").status, JSON.stringify(optionalVerified));
  await page.locator("[data-testid=ai-sticky-withdrawn-group] > summary").click();
  await page.locator("[data-testid=ai-sticky-item][data-item-id=item-working] > summary").click();
  data = await shot(page, "04-1440-working-evidence", "[data-testid=ai-sticky-checklist]");
  const working = data.rows.find((row) => row.id === "item-working");
  assert("working-open", working?.open === true, JSON.stringify(working));
  assert("withdraw-in-detail", working?.withdrawInDetail === true, JSON.stringify(working));
  const evidence = await page.locator("[data-item-id=item-working] [data-testid=ai-sticky-evidence] dd").allTextContents();
  assert("evidence-disclosure", evidence[0] === fixtureItem("item-working").evidence[0].expected
    && evidence[1] === fixtureItem("item-working").evidence[0].observed, JSON.stringify(evidence));

  await page.locator("[data-testid=ai-sticky-item][data-item-id=item-blocked] > summary").click();
  data = await shot(page, "05-1440-blocked-open", "[data-testid=ai-sticky-checklist]");
  assert("blocked-still-in-summary", data.rows.find((row) => row.id === "item-blocked")?.blockText === fixtureItem("item-blocked").reason, "blocked reason missing after open");

  const beforeMove = await page.getByTestId("ai-sticky-checklist").evaluate((node) => {
    const rect = node.getBoundingClientRect();
    return { x: rect.x, y: rect.y };
  });
  const drag = page.getByTestId("ai-sticky-drag");
  const dragBox = await drag.boundingBox();
  assert("drag-hit", !!dragBox, "missing drag handle");
  if (dragBox) {
    await page.mouse.move(dragBox.x + dragBox.width / 2, dragBox.y + dragBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(720, 420, { steps: 8 });
    await page.mouse.up();
  }
  data = await shot(page, "06-1440-move-clamp", "[data-testid=ai-sticky-checklist]");
  const minX = (parseFloat(data.editorLeftSafe) || 288) + 12;
  const minY = (data.toolbarBottom || 112) + 12;
  assert("moved-from-origin", Math.abs(data.box.x - beforeMove.x) > 8 || Math.abs(data.box.y - beforeMove.y) > 8, `still ${JSON.stringify(beforeMove)} now=${JSON.stringify(data.box)}`);
  if (dragBox) {
    const handle = page.getByTestId("ai-sticky-drag");
    const box = await handle.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(24, 24, { steps: 8 });
    await page.mouse.up();
  }
  data = await shot(page, "06b-1440-move-min-clamp", "[data-testid=ai-sticky-checklist]");
  assert("move-clamped-x", data.box.x + 0.5 >= minX, `x=${data.box.x} minX=${minX}`);
  assert("move-clamped-y", data.box.y + 0.5 >= minY, `y=${data.box.y} minY=${minY}`);

  if (dragBox) {
    const handle = page.getByTestId("ai-sticky-drag");
    const box = await handle.boundingBox();
    await handle.evaluate(node => node.addEventListener("pointerdown", event => {
      window.__qaDragPointerId = event.pointerId;
    }, { once: true }));
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(640, 360, { steps: 6 });
    const mid = await page.getByTestId("ai-sticky-checklist").evaluate((node) => {
      const rect = node.getBoundingClientRect();
      return { x: rect.x, y: rect.y };
    });
    const pointerId = await page.evaluate(() => window.__qaDragPointerId);
    if (!Number.isInteger(pointerId)) throw new Error("Missing captured drag pointer ID");
    await handle.dispatchEvent("pointercancel", { pointerId, bubbles: true, cancelable: true, composed: true, button: 0 });
    await page.mouse.move(200, 200, { steps: 4 });
    const afterCancel = await page.getByTestId("ai-sticky-checklist").evaluate((node) => {
      const rect = node.getBoundingClientRect();
      return { x: rect.x, y: rect.y };
    });
    await page.mouse.up();
    data = await shot(page, "07-1440-move-cancel", "[data-testid=ai-sticky-checklist]");
    assert("pointercancel-stops", Math.abs(afterCancel.x - mid.x) < 3 && Math.abs(afterCancel.y - mid.y) < 3, `mid=${JSON.stringify(mid)} after=${JSON.stringify(afterCancel)}`);
  }

  await page.getByTestId("ai-sticky-hide").focus();
  const hideFocus = await page.evaluate(() => document.activeElement?.getAttribute("data-testid"));
  assert("keyboard-hide-focus", hideFocus === "ai-sticky-hide", hideFocus);
  await shot(page, "08-1440-hide-focus", "[data-testid=ai-sticky-checklist]");
  await transition(page, () => document.querySelector("[data-testid=ai-sticky-checklist]")?.hidden === true,
    () => page.keyboard.press("Enter"));
  data = await measure(page);
  const painted = await page.getByTestId("ai-sticky-checklist").isVisible();
  assert("hidden-attached", data.connected && data.hidden === true && data.hiddenByUser === "true", JSON.stringify({ hidden: data.hidden, connected: data.connected }));
  assert("hidden-not-painted", painted === false, "checklist still paints while hidden");
  await shot(page, "09-1440-hidden-canvas", "body");

  await transition(page, () => document.querySelector("[data-testid=ai-sticky-checklist]")?.hidden === true
    && document.querySelector("[data-item-id=item-working]")?.dataset.status === "verifying", () => page.evaluate(async () => {
    const next = structuredClone(window.__qaSnapshot);
    next.items = next.items.map((item) => item.id === "item-working"
      ? { ...item, status: "verifying", title: "HIDDEN_UPDATE_SENTINEL" }
      : item);
    window.__qaSnapshot = next;
    const { store } = await import("/src/project/store.ts");
    store.update((project) => { project.meta.title = "ACCEPTANCE_HIDDEN_UPDATE"; }, { scope: "project", label: "qa hidden update" });
  }));
  data = await measure(page);
  assert("hidden-live-update", data.hidden === true && data.rows.find((row) => row.id === "item-working")?.status === "verifying", JSON.stringify(data.rows.find((row) => row.id === "item-working")));
  assert("hidden-count-retained", data.countText === "2/4", data.countText);

  // aiChatPanel.ts keeps the legacy header menu inside a hidden, inert toolbar.
  // The composer menu is the current user surface; do not reveal or force-click legacy hooks.
  const composerOpened = await openComposerMenu(page);
  assert("composer-menu-visible", composerOpened, "ai-command-menu-toggle not visible");
  await shot(page, "12-1440-composer-menu", "[data-testid=ai-command-menu]");
  if (composerOpened) {
    const composerItem = page.getByTestId("ai-command-menu-acceptance-show");
    assert("composer-reopen-enabled", await composerItem.isEnabled(), "composer reopen disabled/missing");
    await transition(page, () => document.querySelector("[data-testid=ai-sticky-checklist]")?.hidden === false,
      () => composerItem.click());
    data = await shot(page, "13-1440-reopen-composer", "[data-testid=ai-sticky-checklist]");
    assert("reopen-composer", data.hidden === false, JSON.stringify({ hidden: data.hidden, focus: data.activeElement }));
    assert("reopen-focus", data.activeElement === "ai-sticky-toggle", data.activeElement);
    assert("reopen-current-activity", data.activityInline.includes("HIDDEN_UPDATE_SENTINEL"), data.activityInline);
  }

  const expandedBeforeResize = data.expanded;
  await transition(page, () => window.innerWidth === 1280,
    () => page.setViewportSize({ width: 1280, height: 800 }));
  data = await shot(page, "14-1280-compact", "[data-testid=ai-sticky-checklist]");
  assert("manual-expansion-retained-1280", data.expanded === expandedBeforeResize, `expanded=${data.expanded}`);

  if (data.expanded === "true") await page.getByTestId("ai-sticky-toggle").click();
  data = await shot(page, "15-1280-forced-compact", "[data-testid=ai-sticky-checklist]");
  assert("compact-1280-after-collapse", data.expanded === "false", data.expanded);
  assert("count-1280", data.countText === "2/4", data.countText);

  await transition(page, () => window.innerWidth === 1024,
    () => page.setViewportSize({ width: 1024, height: 768 }));
  data = await shot(page, "16-1024-compact", "[data-testid=ai-sticky-checklist]");
  assert("compact-1024", data.expanded === "false", data.expanded);
  assert("count-1024", data.countText === "2/4", data.countText);
  assert("activity-1024", data.activityInline.includes("HIDDEN_UPDATE_SENTINEL"), data.activityInline);

  await page.getByTestId("ai-sticky-toggle").click();
  data = await shot(page, "17-1024-expanded", "[data-testid=ai-sticky-checklist]");
  assert("expand-1024", data.expanded === "true", data.expanded);
  assert("no-overflow-1024", data.box.x + data.box.width <= 1024 + 1, JSON.stringify(data.box));

  await page.getByTestId("ai-sticky-toggle").focus();
  await page.keyboard.press("Enter");
  data = await measure(page);
  assert("keyboard-toggle", data.expanded === "false", data.expanded);

  const stillThere = await page.getByTestId("ai-sticky-checklist").count();
  assert("terminal-retention", stillThere === 1, `count=${stillThere}`);

  await transition(page, () => !document.querySelector("[data-testid=ai-sticky-checklist]"),
    () => page.getByTestId("ai-new-chat").click());
  assert("new-chat-clears", await page.getByTestId("ai-sticky-checklist").count() === 0, "checklist survived new chat");
  await shot(page, "18-1024-new-chat-cleared", "body");
  await verifyHistoryRace(page, mapId);
} catch (error) {
  assert("script-error", false, error instanceof Error ? error.stack ?? error.message : String(error));
  if (CAPTURE) {
    try { await page.screenshot({ path: path.join(SHOT, "zz-error.png"), fullPage: false }); }
    catch (captureError) { assert("error-capture", false, String(captureError)); }
  }
} finally {
  const failed = assertions.filter((item) => !item.ok);
  const report = {
    ok: failed.length === 0,
    model: { provider: process.env.PI_PROVIDER ?? null, model: process.env.PI_MODEL ?? null },
    base: BASE,
    command: `QA_CAPTURE=${CAPTURE ? "1" : "0"} node scripts/qa/ai-acceptance-compact.mjs`,
    capture: CAPTURE,
    menuSurface: "ai-command-menu-toggle",
    legacyHeader: "No current user surface: aiChatPanel.ts mounts it in the hidden, inert ai-chat-toolbar; both implementations have unit coverage.",
    llmHits,
    remainingIssues,
    failed: failed.map((item) => item.id),
    assertions,
    shots,
  };
  writeFileSync(path.join(OUT, REPORT), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ok: report.ok, failed: report.failed, remainingIssues, assertionCount: assertions.length, shots: shots.length }, null, 2));
  await browser.close();
  process.exit(failed.length === 0 ? 0 : 1);
}
