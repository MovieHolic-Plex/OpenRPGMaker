// Clicks EVERY top-menubar entry and EVERY left-sidebar control in the editor,
// across beginner/standard/expert, and records whether the click produced any
// observable effect. Output: machine-readable inventory with a works/dead verdict
// per control plus a cross-surface duplicate report.
//
// Isolation: one fresh page load per click, so no click can contaminate the next.
// Settle: MutationObserver + effect-signal subscription with a bounded budget --
// never a blind fixed sleep.
//
// Usage: node scripts/audit-editor-menu-surface.mjs [base-url] [--modes=a,b]
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";

const BASE = process.argv.find((a) => a.startsWith("http")) ?? "http://127.0.0.1:9806";
const modeArg = process.argv.find((a) => a.startsWith("--modes="));
const MODES = modeArg ? modeArg.slice("--modes=".length).split(",") : ["beginner", "standard", "expert"];
const OUT_DIR = ".omo/evidence/menu-ia";
const SETTLE_BUDGET_MS = 900;

// Content grids are data, not menu controls -- the audit targets chrome.
const NOISE = /^(chipset-tile-|basic-tile-|structure-kit-|map-toggle-map_|map-context-trigger-map_|tile-meta-)/;

/** Installed before app scripts: records dispatched CustomEvents + toast mounts. */
function installProbe() {
  const w = /** @type {any} */ (window);
  w.__audit = { events: [], errors: [] };
  const origDispatch = EventTarget.prototype.dispatchEvent;
  EventTarget.prototype.dispatchEvent = function (event) {
    try {
      if (typeof event?.type === "string" && /^oprn:/.test(event.type)) {
        // Record the detail kind too: several controls dispatch the same event type with a
        // different payload (plain test play vs random battle), and type alone makes them look
        // like duplicates of each other.
        const kind = event.detail && typeof event.detail === "object" ? event.detail.kind : undefined;
        w.__audit.events.push(kind ? `${event.type}#${String(kind)}` : event.type);
      }
    } catch {}
    return origDispatch.call(this, event);
  };
  window.addEventListener("error", (e) => w.__audit.errors.push(String(e.message)));
  window.addEventListener("unhandledrejection", (e) => w.__audit.errors.push(`rejection: ${String(e.reason)}`));
}

/** Structural fingerprint of everything a click could plausibly change. */
function snapshot() {
  const w = /** @type {any} */ (window);
  const dialogSel = "[role=dialog],.modal,.modal-backdrop,.oprn-modal,.modal-shell,[data-testid$='-modal'],dialog[open]";
  const dialogs = [...document.querySelectorAll(dialogSel)]
    .filter((n) => n.getBoundingClientRect().width > 0)
    .map((n) => n.dataset?.testid || n.className?.toString?.().slice(0, 40) || n.tagName)
    .sort();
  const toasts = [...document.querySelectorAll(".toast,.toast-item,[data-testid^='toast']")].map((n) =>
    (n.textContent || "").trim().slice(0, 80)
  );
  const pressed = [...document.querySelectorAll("[aria-pressed=true],[aria-selected=true],.is-active,.active")]
    .map((n) => n.dataset?.testid)
    .filter(Boolean)
    .sort();
  const expanded = [...document.querySelectorAll("[aria-expanded=true]")].map((n) => n.dataset?.testid).filter(Boolean).sort();
  let ls = "";
  try {
    ls = Object.keys(localStorage)
      .sort()
      .map((k) => `${k}=${localStorage.getItem(k)}`)
      .join("|");
  } catch {}
  // Which menu popup is open. Without this a popup SWAP (parent menu -> submenu) nets a ~zero
  // DOM delta and reads as a dead control, which is exactly what happened to menu-project-samples.
  const openPopup = [...document.querySelectorAll(".oprn-menu-popup")]
    .filter((n) => n.getBoundingClientRect().width > 0)
    .map((n) => n.dataset?.testid || "(unnamed-popup)")
    .sort();
  return {
    dialogs,
    toasts,
    pressed,
    expanded,
    ls,
    openPopup,
    // Focus is the observable effect of clicking a text input; without this a search field
    // reads as a dead control because typing, not clicking, is what changes its state.
    activeTestId: document.activeElement instanceof HTMLElement ? (document.activeElement.dataset?.testid ?? null) : null,
    bodyClass: document.body.className,
    testidCount: document.querySelectorAll("[data-testid]").length,
    domSize: document.body.getElementsByTagName("*").length,
    events: [...(w.__audit?.events ?? [])],
    errors: [...(w.__audit?.errors ?? [])],
  };
}

/** Resolve as soon as the DOM stops changing, or when the budget expires. */
function waitSettle(budget) {
  return new Promise((resolve) => {
    let quiet;
    const done = () => {
      obs.disconnect();
      clearTimeout(cap);
      resolve(undefined);
    };
    const obs = new MutationObserver(() => {
      clearTimeout(quiet);
      quiet = setTimeout(done, 140);
    });
    obs.observe(document.documentElement, { subtree: true, childList: true, attributes: true });
    quiet = setTimeout(done, 260);
    const cap = setTimeout(done, budget);
  });
}

function diff(before, after) {
  const changes = [];
  const addedDialogs = after.dialogs.filter((d) => !before.dialogs.includes(d));
  const addedToasts = after.toasts.filter((t) => !before.toasts.includes(t));
  const newEvents = after.events.slice(before.events.length);
  const newErrors = after.errors.slice(before.errors.length);
  if (addedDialogs.length) changes.push(`dialog:${addedDialogs.join(",")}`);
  if (addedToasts.length) changes.push(`toast:${addedToasts.join(" / ")}`);
  if (newEvents.length) changes.push(`event:${[...new Set(newEvents)].join(",")}`);
  if ((after.openPopup ?? []).join() !== (before.openPopup ?? []).join()) changes.push(`popup:${(after.openPopup ?? []).join(",") || "(closed)"}`);
  if (after.pressed.join() !== before.pressed.join()) changes.push("pressedState");
  if (after.expanded.join() !== before.expanded.join()) changes.push("expandedState");
  if (after.ls !== before.ls) changes.push("localStorage");
  if (after.bodyClass !== before.bodyClass) changes.push("bodyClass");
  if (Math.abs(after.domSize - before.domSize) > 2) changes.push(`domSize:${after.domSize - before.domSize}`);
  else if (after.testidCount !== before.testidCount) changes.push(`testidCount:${after.testidCount - before.testidCount}`);
  return { changes, addedDialogs, addedToasts, newEvents, newErrors, popupOpened: (after.openPopup ?? []).join() !== (before.openPopup ?? []).join() };
}

/** Fingerprint used to detect two controls that do the same thing. */
function fingerprint(d, after) {
  const parts = [];
  if (d.addedDialogs.length) parts.push(`dlg=${d.addedDialogs.join(",")}`);
  if (d.newEvents.length) parts.push(`evt=${[...new Set(d.newEvents)].sort().join(",")}`);
  if (d.addedToasts.length) parts.push(`toast=${d.addedToasts.map((t) => t.slice(0, 40)).join(",")}`);
  // Only an OPENING popup identifies an action. Every menu item closes its own menu, so treating
  // a close as part of the fingerprint made all eleven panel-menu items look like one duplicate group.
  if (d.popupOpened && (after.openPopup ?? []).length) parts.push(`popup=${(after.openPopup ?? []).join(",")}`);
  return parts.join(";") || "(no-fingerprint)";
}

const browser = await chromium.launch();

async function auditMode(mode) {
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 }, acceptDownloads: true });
  await context.addInitScript(installProbe);
  // Runs before app scripts on EVERY navigation: a pristine store per click. Without this a
  // single panel-toggle click persists "tiles panel off" and every later boot loses the whole
  // left rail, which reads as dozens of phantom dead controls.
  // The welcome/coachmark keys are seeded so a cleared store is not also a FIRST visit -- the
  // first-visit overlay intercepts pointer events and gets misattributed to the click under test.
  await context.addInitScript((m) => {
    try {
      localStorage.clear();
      localStorage.setItem("oprn:editor-ui-mode", m);
      localStorage.setItem("oprn:editor-welcome-dismissed", "1");
      localStorage.setItem("oprn:standard-welcome-seen", "1");
      localStorage.setItem("oprn:coachmarks-basic-v1", "1");
    } catch {}
  }, mode);

  const page = await context.newPage();
  const boot = async () => {
    // domcontentloaded + an explicit element wait is faster AND stricter than networkidle:
    // the dev server keeps HMR sockets open, so networkidle never settles cheaply.
    await page.goto(`${BASE}/?blankProject=1`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.locator(".oprn-menu-bar").waitFor({ state: "visible", timeout: 30_000 });
    // The left dock mounts AFTER the menubar. Without waiting for it the enumeration races the
    // sidebar and silently audits only the top region -- which is how a whole run once reported
    // zero leftSidebar targets.
    await page
      .locator("[data-testid='left-palette-root'], .basic-left-rail")
      .first()
      .waitFor({ state: "visible", timeout: 20_000 })
      .catch(() => {});
  };
  // Downloads and native file pickers are observable effects, not hangs.
  const sideChannel = { download: null, filechooser: false };
  page.on("download", (d) => {
    sideChannel.download = d.suggestedFilename();
    d.cancel().catch(() => {});
  });
  page.on("filechooser", (fc) => {
    sideChannel.filechooser = true;
    fc.setFiles([]).catch(() => {});
  });

  await boot();

  // ---- Enumerate the target set (testid + how to reach it) ----
  const topLevel = await page.evaluate(({ noiseSrc }) => {
    const noise = new RegExp(noiseSrc);
    const grab = (sel, surface) =>
      [...document.querySelectorAll(sel)]
        // Only genuinely interactive nodes. Container divs that merely carry a testid are
        // layout, not controls, and would report as permanently invisible.
        .filter((n) => n.matches("button,[role=menuitem],[role=menuitemradio],[role=menuitemcheckbox],[role=tab],input,select,a[href]"))
        .map((n) => ({
          testid: n.dataset?.testid ?? null,
          label: (n.getAttribute("aria-label") || n.textContent || n.title || "").trim().slice(0, 60),
          surface,
          disabled: n.disabled === true,
          tag: n.tagName,
        }))
        .filter((x) => x.testid && !noise.test(x.testid));
    return [
      ...grab(".oprn-menu-bar > .oprn-menu-item, .oprn-menu-bar .editor-topbar-trailing button, .oprn-menu-bar .oprn-window-control", "topbar"),
      // The authoring-task launcher is always-visible chrome; the ▤ panels menu and the ⋯ menu are
      // popovers whose children are enumerated through their parent in the nested pass below.
      ...grab(".oprn-menu-bar .authoring-task-launcher button, .oprn-menu-bar .workspace-command-chip", "topbar"),
      ...grab(".oprn-toolbar button", "classicToolbar"),
      ...grab(".left-panel button, .left-panel input, .left-panel [role=tab]", "leftSidebar"),
    ];
  }, { noiseSrc: NOISE.source });

  const menuTriggers = topLevel.filter((c) => /^menu-(project|map|tools|game|help)$/.test(c.testid));
  // Coverage guard: the sidebar is the whole point of this audit, so refuse to report a run that
  // enumerated none of it.
  const sidebarFound = topLevel.filter((c) => c.surface === "leftSidebar").length;
  if (sidebarFound === 0) throw new Error(`[${mode}] enumeration found 0 leftSidebar controls -- the left dock did not mount`);
  console.log(`[${mode}] enumerated ${topLevel.length} top-level controls (${sidebarFound} in the left sidebar)`);
  const popupChildren = [];
  for (const t of menuTriggers) {
    await page.click(`[data-testid="${t.testid}"]`);
    const popup = `[data-testid="menu-popup-${t.testid.replace(/^menu-/, "")}"]`;
    if (await page.locator(popup).count()) {
      const kids = await page.evaluate((sel) => {
        const host = document.querySelector(sel);
        return [...host.querySelectorAll("button")].map((n) => ({
          testid: n.dataset?.testid ?? null,
          label: (n.textContent || "").trim().slice(0, 60),
          disabled: n.disabled === true,
        }));
      }, popup);
      for (const k of kids) if (k.testid) popupChildren.push({ ...k, surface: "topMenuPopup", via: t.testid });
    }
    await page.keyboard.press("Escape");
  }

  // Flyout / overflow children that only exist after opening their parent.
  const nestedParents = [
    { parent: "standard-more-tools", scope: "[data-testid='standard-more-tools-menu']" },
    { parent: "workspace-panels-button", scope: ".workspace-panels-popover, [data-testid^='workspace-panel'], [data-testid^='workspace-layout'], [data-testid^='workspace-density']" },
    { parent: "basic-rail-toggle-tiles", scope: ".basic-flyout-content" },
    { parent: "basic-rail-toggle-maps", scope: ".basic-flyout-content" },
    { parent: "oprn-tool-overflow", scope: ".tile-toolbar-overflow-menu, .toolbar-overflow-menu" },
    { parent: "toolbar-overflow-toggle", scope: ".toolbar-overflow-menu" },
  ];
  for (const np of nestedParents) {
    if (!(await page.locator(`[data-testid="${np.parent}"]`).count())) continue;
    await boot();
    await page.click(`[data-testid="${np.parent}"]`).catch(() => {});
    await page.evaluate(waitSettle, SETTLE_BUDGET_MS);
    const kids = await page.evaluate(
      ({ scope, noiseSrc }) => {
        const noise = new RegExp(noiseSrc);
        const out = [];
        for (const host of document.querySelectorAll(scope)) {
          for (const n of host.querySelectorAll("button,[role=menuitem]")) {
            const id = n.dataset?.testid;
            if (!id || noise.test(id)) continue;
            out.push({ testid: id, label: (n.textContent || n.getAttribute("aria-label") || "").trim().slice(0, 60), disabled: n.disabled === true });
          }
        }
        return out;
      },
      { scope: np.scope, noiseSrc: NOISE.source }
    );
    for (const k of kids) popupChildren.push({ ...k, surface: "nested", via: np.parent });
  }

  // Dedupe the target list; a control reached two ways is recorded once per route.
  const seen = new Set();
  const targets = [];
  for (const c of [...topLevel, ...popupChildren]) {
    const key = `${c.surface}|${c.via ?? ""}|${c.testid}`;
    if (seen.has(key)) continue;
    seen.add(key);
    targets.push(c);
  }

  // ---- Click every target in isolation ----
  const results = [];
  let index = 0;
  for (const t of targets) {
    index += 1;
    sideChannel.download = null;
    sideChannel.filechooser = false;
    await boot();

    // Re-open the parent surface when the control lives behind one.
    let reachable = true;
    if (t.via) {
      await page.click(`[data-testid="${t.via}"]`).catch(() => {
        reachable = false;
      });
      await page.evaluate(waitSettle, SETTLE_BUDGET_MS);
      // renderTopbar can rebuild the menubar right after boot, which detaches a popover that
      // was just opened. Re-open once so a rebuild does not read as a dead child control.
      if (reachable && !(await page.locator(`[data-testid="${t.testid}"]`).first().isVisible().catch(() => false))) {
        await page.click(`[data-testid="${t.via}"]`).catch(() => {});
        await page.evaluate(waitSettle, SETTLE_BUDGET_MS);
      }
    }
    const loc = page.locator(`[data-testid="${t.testid}"]`).first();
    if (!reachable || (await loc.count()) === 0) {
      results.push({ ...t, verdict: "unreachable", changes: [], fingerprint: "(unreachable)" });
      console.log(`[${mode} ${index}/${targets.length}] ${t.testid} => unreachable`);
      continue;
    }
    // Playwright's own visibility check is the framework guarantee here: it accounts for
    // display:none ancestors, zero boxes and visibility:hidden. A control the user cannot
    // see is unusable even when force-clicking still fires its handler.
    const userVisible = await loc.isVisible();
    const isDisabled = await loc.evaluate((n) => n.disabled === true || n.getAttribute("aria-disabled") === "true");
    // A control that is ALREADY the selected tool / layer / facet legitimately does nothing when
    // clicked again. That is a no-op, not a dead control, so record it separately.
    const wasActive = await loc.evaluate(
      (n) =>
        n.getAttribute("aria-pressed") === "true" ||
        n.getAttribute("aria-checked") === "true" ||
        n.getAttribute("aria-selected") === "true" ||
        n.classList.contains("active") ||
        n.classList.contains("is-active")
    );
    const hiddenBy = userVisible
      ? null
      : await loc.evaluate((n) => {
          for (let p = n.parentElement; p; p = p.parentElement) {
            const s = getComputedStyle(p);
            if (s.display === "none" || s.visibility === "hidden" || p.hidden) {
              return p.dataset?.testid || p.className?.toString?.().slice(0, 40) || p.tagName;
            }
          }
          return "(self)";
        });
    // Focus counts as the observable effect ONLY for a text field, where typing (not clicking) is
    // the real interaction. Counting it for buttons would make every button "work" just by taking
    // focus, which destroys the audit's ability to spot a dead button.
    const isTextField = await loc.evaluate((n) => ["INPUT", "TEXTAREA", "SELECT"].includes(n.tagName));
    const before = await page.evaluate(snapshot);
    let clickError = null;
    try {
      await loc.click({ timeout: 5000, force: true });
    } catch (e) {
      clickError = String(e.message).split("\n")[0].slice(0, 160);
    }
    // Some actions navigate or reload, which destroys the execution context. That IS an
    // observable effect, so record it per-control instead of letting it abort the whole run.
    let after = before;
    let navigated = false;
    try {
      await page.evaluate(waitSettle, SETTLE_BUDGET_MS);
      after = await page.evaluate(snapshot);
    } catch (e) {
      if (/Execution context was destroyed|Target closed|Navigation/i.test(String(e.message))) {
        navigated = true;
        await page.locator(".oprn-menu-bar").waitFor({ state: "visible", timeout: 30_000 }).catch(() => {});
      } else {
        clickError = clickError ?? String(e.message).split("\n")[0].slice(0, 160);
      }
    }
    const d = diff(before, after);
    if (navigated) d.changes.push("navigation");
    if (isTextField && after.activeTestId === t.testid && before.activeTestId !== t.testid) {
      d.changes.push(`focus:${t.testid}`);
    }
    if (sideChannel.download) d.changes.push(`download:${sideChannel.download}`);
    if (sideChannel.filechooser) d.changes.push("filechooser");

    // A control the user cannot see is unusable even when force-clicking still fires it.
    const verdict = clickError
      ? "click-failed"
      : d.newErrors.length
        ? "error"
        : !userVisible
          ? "invisible"
          : d.changes.length
            ? "works"
            : isDisabled
              ? "disabled-inert"
              : wasActive
                ? "already-active"
                : "dead";
    results.push({
      ...t,
      disabled: isDisabled,
      wasActive,
      visible: userVisible,
      hiddenAncestor: hiddenBy,
      verdict,
      changes: d.changes,
      fingerprint: fingerprint(d, after) + (sideChannel.download ? `;dl=${sideChannel.download}` : "") + (sideChannel.filechooser ? ";filechooser" : ""),
      pageErrors: d.newErrors,
      clickError,
    });
    console.log(
      `[${mode} ${index}/${targets.length}] ${t.surface}${t.via ? `<${t.via}` : ""} ${t.testid} => ${verdict}${d.changes.length ? ` {${d.changes.join(" ")}}` : ""}`
    );
  }

  await context.close();
  return { mode, targetCount: targets.length, results };
}

const modes = [];
for (const m of MODES) {
  console.log(`\n>>>>>>>> ENUMERATING MODE ${m}`);
  modes.push(await auditMode(m));
}
await browser.close();

// ---- Duplicate analysis: same fingerprint reached from different surfaces ----
const report = { base: BASE, ranAt: new Date().toISOString(), modes: {}, duplicates: [], dead: [], errors: [] };
for (const m of modes) {
  report.modes[m.mode] = { targetCount: m.targetCount, results: m.results };
  const byFp = new Map();
  for (const r of m.results) {
    if (r.verdict !== "works" || r.fingerprint === "(no-fingerprint)") continue;
    if (!byFp.has(r.fingerprint)) byFp.set(r.fingerprint, []);
    byFp.get(r.fingerprint).push(r);
  }
  for (const [fp, group] of byFp) {
    const surfaces = new Set(group.map((g) => (g.surface === "leftSidebar" ? "left" : "top")));
    if (group.length > 1 && surfaces.size > 1) {
      report.duplicates.push({ mode: m.mode, fingerprint: fp, controls: group.map((g) => ({ testid: g.testid, label: g.label, surface: g.surface, via: g.via ?? null })) });
    } else if (group.length > 1) {
      report.duplicates.push({ mode: m.mode, fingerprint: fp, sameSurface: true, controls: group.map((g) => ({ testid: g.testid, label: g.label, surface: g.surface, via: g.via ?? null })) });
    }
  }
  for (const r of m.results) {
    if (r.verdict === "dead" || r.verdict === "click-failed" || r.verdict === "unreachable" || r.verdict === "invisible")
      report.dead.push({ mode: m.mode, ...r });
    if (r.verdict === "error") report.errors.push({ mode: m.mode, ...r });
  }
}

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(`${OUT_DIR}/menu-audit.json`, JSON.stringify(report, null, 2));

console.log("\n================ AUDIT SUMMARY ================");
for (const m of modes) {
  const tally = {};
  for (const r of m.results) tally[r.verdict] = (tally[r.verdict] ?? 0) + 1;
  console.log(`MODE=${m.mode} targets=${m.targetCount} ${JSON.stringify(tally)}`);
}
console.log(`\n--- DEAD / BROKEN (${report.dead.length}) ---`);
for (const d of report.dead)
  console.log(
    `  [${d.mode}/${d.surface}${d.via ? `<${d.via}` : ""}] ${d.testid} :: ${d.label} => ${d.verdict}${d.hiddenAncestor ? ` (hidden by ${d.hiddenAncestor})` : ""}${d.clickError ? ` (${d.clickError})` : ""}`
  );
console.log(`\n--- PAGE ERRORS (${report.errors.length}) ---`);
for (const e of report.errors) console.log(`  [${e.mode}] ${e.testid} :: ${e.pageErrors.join(" | ")}`);
console.log(`\n--- DUPLICATE ACTIONS (${report.duplicates.length}) ---`);
for (const g of report.duplicates) {
  console.log(`  [${g.mode}]${g.sameSurface ? " (same surface)" : " CROSS-SURFACE"} ${g.fingerprint}`);
  for (const c of g.controls) console.log(`      ${c.surface}${c.via ? `<${c.via}` : ""} ${c.testid} :: ${c.label}`);
}
console.log(`\nAUDIT_SAVED=${OUT_DIR}/menu-audit.json`);
console.log(`DEAD_COUNT=${report.dead.length}`);
console.log(`DUP_COUNT=${report.duplicates.length}`);
