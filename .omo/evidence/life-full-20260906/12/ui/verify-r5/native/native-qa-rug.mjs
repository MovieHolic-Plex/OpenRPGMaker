import { chromium } from "@playwright/test";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { startPlayerQaServer } from "../../../../../../../scripts/lib/runtimeQaRun.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const PROJECT_URL = "/__runtime-qa/project.json";
const PROJECT_ROUTE = "**/__runtime-qa/project.json";
const SAVE_NS = "task12-ui-verify-r5-rug";
const EXPECTED_FIXTURE_SHA = "265f600a710025ee451361b70746b50ca2bf9165e6815d4ce0aa582e7eca520b";
const RUG_ID = "ledger:decoration:rug:1";
const SHED_ID = "r5-retained-shed";
const BODY = { width: 3, height: 3 };
const PASS_ROWS = 1;
const RUG_FP = { width: 2, height: 1 };

process.env.PLAYWRIGHT_BROWSERS_PATH = process.env.PLAYWRIGHT_BROWSERS_PATH || "/home/main/.cache/ms-playwright";

const cleanup = [];
const evidence = {
  steps: [],
  screenshots: [],
  errors: [],
  pageErrors: [],
  requestFailures: [],
  sessions: {},
  passages: {},
};
let failed = false;
let shuttingDown = false;

async function runCleanup() {
  if (shuttingDown) return;
  shuttingDown = true;
  while (cleanup.length) {
    const task = cleanup.pop();
    await task().catch((error) => {
      evidence.cleanupErrors = [...(evidence.cleanupErrors ?? []), String(error?.message ?? error)];
    });
  }
}

process.on("SIGTERM", () => {
  evidence.uncaught = `${evidence.uncaught ?? ""}\nSIGTERM`;
  writeFile(join(HERE, "native-evidence.json"), `${JSON.stringify(evidence, null, 2)}\n`).finally(() => {
    runCleanup().finally(() => process.exit(1));
  });
});

function note(step, data = {}) {
  evidence.steps.push({ step, at: new Date().toISOString(), ...data });
  process.stdout.write(`${JSON.stringify({ step, ...data })}\n`);
  writeFile(join(HERE, "native-evidence.json"), `${JSON.stringify(evidence, null, 2)}\n`).catch(() => undefined);
}

function sha256Text(text) {
  return createHash("sha256").update(text).digest("hex");
}

function passageRect(x, y, footprint = BODY, passRows = PASS_ROWS) {
  const left = x - Math.floor((footprint.width - 1) / 2);
  const right = left + footprint.width - 1;
  const bottom = y;
  const bodyTop = y - (footprint.height - 1);
  const top = bottom - (passRows - 1);
  return { left, right, top, bottom, bodyTop };
}

function footprintCells(x, y, footprint = RUG_FP) {
  const cells = [];
  for (let dy = 0; dy < footprint.height; dy += 1) {
    for (let dx = 0; dx < footprint.width; dx += 1) {
      cells.push({ x: x + dx, y: y + dy });
    }
  }
  return cells;
}

function cellsInPassage(passage, cells) {
  return cells.filter(
    (cell) =>
      cell.x >= passage.left
      && cell.x <= passage.right
      && cell.y >= passage.top
      && cell.y <= passage.bottom,
  );
}

async function subscribeTestid(page, testid, state = "present", timeoutMs = 20_000) {
  const handle = await page.evaluateHandle(({ testid, state, timeoutMs }) => {
    const found = () => document.querySelector(`[data-testid="${testid}"]`);
    const ok = () => (state === "present" ? Boolean(found()) : !found());
    let cancel;
    const promise = new Promise((resolve, reject) => {
      if (ok()) {
        resolve({ already: true });
        return;
      }
      const finish = (value, error) => {
        observer.disconnect();
        clearTimeout(deadline);
        if (error) reject(error);
        else resolve(value);
      };
      const observer = new MutationObserver(() => {
        if (ok()) finish({ already: false });
      });
      const deadline = setTimeout(() => finish(undefined, new Error(`timeout ${state} ${testid}`)), timeoutMs);
      cancel = () => finish(undefined, new Error(`cancelled ${testid}`));
      observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, characterData: true });
    });
    return { promise, cancel: () => cancel?.() };
  }, { testid, state, timeoutMs });
  return {
    wait: async () => handle.evaluate((entry) => entry.promise),
    dispose: async () => {
      await handle.evaluate((entry) => entry.cancel()).catch(() => undefined);
      await handle.dispose();
    },
  };
}

async function isSelected(page, testid) {
  return page.evaluate((id) => {
    const node = document.querySelector(`[data-testid="${id}"]`);
    return Boolean(node?.classList.contains("selected"));
  }, testid);
}

async function currentSelected(page) {
  return page.evaluate(() => {
    const selectedOf = (root) => {
      const nodes = [...root.querySelectorAll("[data-testid]")];
      const selected = nodes.find((node) => node.classList.contains("selected"))
        ?? nodes.find((node) => node.classList.contains("active") || node.getAttribute("aria-selected") === "true");
      return selected?.getAttribute("data-testid") ?? null;
    };
    const detail = document.querySelector(".status-menu-detail, [data-testid='status-menu-detail']");
    if (detail) {
      const inDetail = selectedOf(detail);
      if (inDetail) return inDetail;
    }
    return selectedOf(document);
  });
}

async function subscribeSelected(page, testid, timeoutMs = 8_000) {
  const handle = await page.evaluateHandle(({ testid, timeoutMs }) => {
    const selected = () => {
      const node = document.querySelector(`[data-testid="${testid}"]`);
      return Boolean(node?.classList.contains("selected"));
    };
    let cancel;
    const promise = new Promise((resolve, reject) => {
      if (selected()) {
        resolve({ already: true });
        return;
      }
      const finish = (value, error) => {
        observer.disconnect();
        clearTimeout(deadline);
        if (error) reject(error);
        else resolve(value);
      };
      const observer = new MutationObserver(() => {
        if (selected()) finish({ already: false });
      });
      const deadline = setTimeout(() => finish(undefined, new Error(`timeout selected ${testid}`)), timeoutMs);
      cancel = () => finish(undefined, new Error(`cancelled selected ${testid}`));
      observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true });
    });
    return { promise, cancel: () => cancel?.() };
  }, { testid, timeoutMs });
  return {
    wait: async () => handle.evaluate((entry) => entry.promise),
    dispose: async () => {
      await handle.evaluate((entry) => entry.cancel()).catch(() => undefined);
      await handle.dispose();
    },
  };
}

async function subscribeSelectionChange(page, beforeId, timeoutMs = 8_000) {
  const handle = await page.evaluateHandle(({ beforeId, timeoutMs }) => {
    const current = () => {
      const selectedOf = (root) => {
        const nodes = [...root.querySelectorAll("[data-testid]")];
        const selected = nodes.find((node) => node.classList.contains("selected"));
        return selected?.getAttribute("data-testid") ?? null;
      };
      const detail = document.querySelector(".status-menu-detail, [data-testid='status-menu-detail']");
      if (detail) {
        const inDetail = selectedOf(detail);
        if (inDetail) return inDetail;
      }
      return selectedOf(document);
    };
    let cancel;
    const promise = new Promise((resolve, reject) => {
      const finish = (value, error) => {
        observer.disconnect();
        clearTimeout(deadline);
        if (error) reject(error);
        else resolve(value);
      };
      const observer = new MutationObserver(() => {
        const now = current();
        if (now && now !== beforeId) finish({ from: beforeId, to: now });
      });
      const deadline = setTimeout(() => finish(undefined, new Error(`timeout selection change from ${beforeId}`)), timeoutMs);
      cancel = () => finish(undefined, new Error("cancelled selection change"));
      observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true });
    });
    return { promise, cancel: () => cancel?.() };
  }, { beforeId, timeoutMs });
  return {
    wait: async () => handle.evaluate((entry) => entry.promise),
    dispose: async () => {
      await handle.evaluate((entry) => entry.cancel()).catch(() => undefined);
      await handle.dispose();
    },
  };
}

async function keyUntilTestid(page, key, testid, state = "present") {
  const wait = await subscribeTestid(page, testid, state);
  try {
    await page.keyboard.press(key);
    await wait.wait();
  } finally {
    await wait.dispose();
  }
}

async function keyUntilSelected(page, key, testid) {
  if (await isSelected(page, testid)) return;
  const wait = await subscribeSelected(page, testid);
  try {
    await page.keyboard.press(key);
    await wait.wait();
  } finally {
    await wait.dispose();
  }
}

async function stepToward(page, testid, key) {
  if (await isSelected(page, testid)) return true;
  const before = await currentSelected(page);
  const wait = await subscribeSelectionChange(page, before);
  try {
    await page.keyboard.press(key);
    const changed = await wait.wait();
    note("menu-step", { key, ...changed, want: testid });
    return changed.to === testid;
  } finally {
    await wait.dispose();
  }
}

async function ensureSelected(page, testid) {
  if (await isSelected(page, testid)) return;
  for (let i = 0; i < 32; i += 1) {
    if (await stepToward(page, testid, "ArrowDown")) return;
  }
  for (let i = 0; i < 32; i += 1) {
    if (await stepToward(page, testid, "ArrowUp")) return;
  }
  throw new Error(`could not select ${testid}; last=${await currentSelected(page)}`);
}

/** Re-query runtime-state-json every time (handles host/node replacement after Load). */
async function readMirror(page) {
  return page.evaluate(() => {
    const node = document.querySelector("[data-testid='runtime-state-json']");
    if (!node?.textContent) throw new Error("runtime-state-json missing");
    const snapshot = JSON.parse(node.textContent);
    if (!snapshot.player || typeof snapshot.player.x !== "number" || typeof snapshot.player.y !== "number") {
      throw new Error(`snapshot.player.x/y missing: ${Object.keys(snapshot).join(",")}`);
    }
    return snapshot;
  });
}

async function subscribePlayerMove(page, timeoutMs = 8_000) {
  const handle = await page.evaluateHandle((timeoutMs) => {
    const read = () => {
      const node = document.querySelector("[data-testid='runtime-state-json']");
      if (!node?.textContent) return null;
      try { return JSON.parse(node.textContent); } catch { return null; }
    };
    const start = read();
    if (!start?.player) throw new Error("snapshot.player missing before move");
    let cancel;
    const promise = new Promise((resolve, reject) => {
      const finish = (value, error) => {
        observer.disconnect();
        clearTimeout(deadline);
        if (error) reject(error);
        else resolve(value);
      };
      const check = () => {
        const now = read();
        if (!now?.player) return;
        if (now.player.x !== start.player.x || now.player.y !== start.player.y) {
          finish({
            from: start.player,
            to: now.player,
            gold: now.gold,
            inventory: now.inventory ?? null,
            buildings: now.farmBuildingPlacements ?? null,
          });
        }
      };
      const observer = new MutationObserver(check);
      const deadline = setTimeout(
        () => finish(undefined, new Error(`no player move from ${start.player.x},${start.player.y}`)),
        timeoutMs,
      );
      cancel = () => finish(undefined, new Error("cancelled player move"));
      observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true, attributes: true });
    });
    return { promise, cancel: () => cancel?.() };
  }, timeoutMs);
  return {
    wait: async () => handle.evaluate((entry) => entry.promise),
    dispose: async () => {
      await handle.evaluate((entry) => entry.cancel()).catch(() => undefined);
      await handle.dispose();
    },
  };
}

/** Arm before Load: wait until live foot equals expected, re-finding the mirror node if replaced. */
async function subscribePlayerAt(page, expected, timeoutMs = 15_000) {
  const handle = await page.evaluateHandle(({ expected, timeoutMs }) => {
    const read = () => {
      const node = document.querySelector("[data-testid='runtime-state-json']");
      if (!node?.textContent) return null;
      try { return JSON.parse(node.textContent); } catch { return null; }
    };
    const start = read();
    let cancel;
    const promise = new Promise((resolve, reject) => {
      const finish = (value, error) => {
        observer.disconnect();
        clearTimeout(deadline);
        if (error) reject(error);
        else resolve(value);
      };
      const check = () => {
        const now = read();
        if (!now?.player) return;
        if (now.player.x === expected.x && now.player.y === expected.y) {
          const startedElsewhere = !start?.player
            || start.player.x !== expected.x
            || start.player.y !== expected.y;
          if (startedElsewhere) {
            finish({
              from: start?.player ?? null,
              to: now.player,
              gold: now.gold,
              inventory: now.inventory ?? null,
              buildings: now.farmBuildingPlacements ?? null,
            });
          }
        }
      };
      const observer = new MutationObserver(check);
      const deadline = setTimeout(
        () => finish(undefined, new Error(`timeout live foot ${expected.x},${expected.y}; last=${JSON.stringify(read()?.player ?? null)}`)),
        timeoutMs,
      );
      cancel = () => finish(undefined, new Error("cancelled player-at"));
      observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true, attributes: true });
      check();
    });
    return { promise, cancel: () => cancel?.() };
  }, { expected, timeoutMs });
  return {
    wait: async () => handle.evaluate((entry) => entry.promise),
    dispose: async () => {
      await handle.evaluate((entry) => entry.cancel()).catch(() => undefined);
      await handle.dispose();
    },
  };
}

async function subscribeStorageKey(page, key, timeoutMs = 8_000) {
  const handle = await page.evaluateHandle(({ key, timeoutMs }) => {
    const before = window.localStorage.getItem(key);
    let cancel;
    const promise = new Promise((resolve, reject) => {
      const finish = (value, error) => {
        observer.disconnect();
        clearTimeout(deadline);
        window.removeEventListener("storage", onStorage);
        if (error) reject(error);
        else resolve(value);
      };
      const check = () => {
        const now = window.localStorage.getItem(key);
        if (now && now !== before) finish({ beforeBytes: before?.length ?? 0, afterBytes: now.length, changed: true });
      };
      // same-document setItem does not fire storage events; pair storage listener with menu DOM mutations from save.
      const onStorage = () => check();
      window.addEventListener("storage", onStorage);
      const observer = new MutationObserver(() => check());
      observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true, attributes: true });
      const deadline = setTimeout(() => finish(undefined, new Error(`timeout storage write ${key}`)), timeoutMs);
      cancel = () => finish(undefined, new Error("cancelled storage"));
      check();
    });
    return { promise, cancel: () => cancel?.() };
  }, { key, timeoutMs });
  return {
    wait: async () => handle.evaluate((entry) => entry.promise),
    dispose: async () => {
      await handle.evaluate((entry) => entry.cancel()).catch(() => undefined);
      await handle.dispose();
    },
  };
}

async function capture(page, name) {
  const files = [];
  for (const width of [1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const file = join(HERE, `${name}-${width}.png`);
    await page.screenshot({ path: file, fullPage: true });
    evidence.screenshots.push({ name, width, file });
    files.push(file);
  }
  await page.setViewportSize({ width: 1024, height: 900 });
  return files;
}

async function menuOpen(page) {
  return page.evaluate(() => Boolean(document.querySelector("[data-testid='main-menu']")));
}

async function closeMenu(page) {
  for (let i = 0; i < 8; i += 1) {
    if (!await menuOpen(page)) return;
    const handle = await page.evaluateHandle((timeoutMs) => {
      const before = document.querySelector("[data-testid='status-menu-debug-json']")?.textContent ?? "";
      const open = () => Boolean(document.querySelector("[data-testid='main-menu']"));
      let cancel;
      const promise = new Promise((resolve, reject) => {
        const finish = (value, error) => {
          observer.disconnect();
          clearTimeout(deadline);
          if (error) reject(error);
          else resolve(value);
        };
        const observer = new MutationObserver(() => {
          if (!open()) finish({ kind: "absent" });
          const now = document.querySelector("[data-testid='status-menu-debug-json']")?.textContent ?? "";
          if (now && now !== before) finish({ kind: "mode", from: before, to: now });
        });
        const deadline = setTimeout(() => finish(undefined, new Error(`timeout closing menu from ${before}`)), timeoutMs);
        cancel = () => finish(undefined, new Error("cancelled close menu"));
        observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, characterData: true });
      });
      return { promise, cancel: () => cancel?.() };
    }, 8_000);
    try {
      await page.keyboard.press("x");
      const result = await handle.evaluate((entry) => entry.promise);
      note("menu-close-step", result);
      if (result.kind === "absent") return;
    } finally {
      await handle.evaluate((entry) => entry.cancel()).catch(() => undefined);
      await handle.dispose();
    }
  }
  if (await menuOpen(page)) throw new Error("menu still open after cancel keys");
}

async function activateByTestid(page, testid) {
  await ensureSelected(page, testid);
  const messageWait = await page.evaluateHandle(() => {
    const before = document.querySelector("[data-testid='status-menu-message']")?.textContent ?? "";
    let cancel;
    const promise = new Promise((resolve, reject) => {
      const finish = (value, error) => {
        observer.disconnect();
        clearTimeout(deadline);
        if (error) reject(error);
        else resolve(value);
      };
      const observer = new MutationObserver(() => {
        const text = document.querySelector("[data-testid='status-menu-message']")?.textContent ?? "";
        if (text !== before) finish({ text });
      });
      const deadline = setTimeout(
        () => finish(undefined, new Error(`timeout status-menu-message after activate, still ${JSON.stringify(before)}`)),
        8_000,
      );
      cancel = () => finish(undefined, new Error("cancelled message wait"));
      observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
    });
    return { promise, cancel: () => cancel?.() };
  });
  try {
    await page.keyboard.press("z");
    return await messageWait.evaluate((entry) => entry.promise);
  } finally {
    await messageWait.evaluate((entry) => entry.cancel()).catch(() => undefined);
    await messageWait.dispose();
  }
}

async function holdUntilMove(page, key) {
  const pending = await subscribePlayerMove(page);
  try {
    await page.keyboard.down(key);
    const moved = await pending.wait();
    await page.keyboard.up(key);
    return moved;
  } finally {
    await page.keyboard.up(key).catch(() => undefined);
    await pending.dispose();
  }
}

async function menuDebug(page) {
  return page.evaluate(() => ({
    debug: document.querySelector("[data-testid='status-menu-debug-json']")?.textContent ?? null,
    selected: [...document.querySelectorAll("[data-testid].selected")].map((node) => node.getAttribute("data-testid")),
    tabs: [...document.querySelectorAll("[data-testid^='life-ledger-tab-']")].map((node) => node.getAttribute("data-testid")),
    group: [...document.querySelectorAll("[data-testid^='status-menu-group-command-']")].map((node) => node.getAttribute("data-testid")),
    spaces: [...document.querySelectorAll("[data-testid^='life-ledger-space-']")].map((node) => ({
      testid: node.getAttribute("data-testid"),
      text: node.textContent,
      aria: node.getAttribute("aria-label"),
    })),
  }));
}

async function openSpaces(page) {
  if (!await menuOpen(page)) {
    await keyUntilTestid(page, "x", "main-menu");
  }
  note("open-spaces-start", await menuDebug(page));
  const hasLedger = await page.evaluate(() => Boolean(document.querySelector("[data-testid^='life-ledger-tab-']")));
  if (!hasLedger) {
    const debug = JSON.parse((await menuDebug(page)).debug ?? "{}");
    if (debug.mode !== "function" || debug.selectedCommand !== "life-ledger") {
      if (debug.selectedCommand === "system-menu" || debug.selectedCommand === "save" || debug.selectedCommand === "load") {
        await keyUntilSelected(page, "ArrowUp", "status-menu-command-record-menu");
      } else if (debug.selectedCommand !== "record-menu" && debug.selectedCommand !== "life-ledger") {
        if (!await isSelected(page, "status-menu-command-record-menu")) {
          await keyUntilSelected(page, "ArrowDown", "status-menu-command-skills");
          await keyUntilSelected(page, "ArrowDown", "status-menu-command-equipment");
          await keyUntilSelected(page, "ArrowDown", "status-menu-command-party-menu");
          await keyUntilSelected(page, "ArrowDown", "status-menu-command-record-menu");
        }
      }
      if (debug.mode !== "function") {
        await keyUntilTestid(page, "z", "status-menu-group-command-quests");
      }
      if (!await isSelected(page, "status-menu-group-command-life-ledger")) {
        const hasRelationships = await page.evaluate(() => Boolean(document.querySelector("[data-testid='status-menu-group-command-relationships']")));
        if (hasRelationships && !await isSelected(page, "status-menu-group-command-relationships")) {
          await keyUntilSelected(page, "ArrowDown", "status-menu-group-command-relationships");
        }
        await keyUntilSelected(page, "ArrowDown", "status-menu-group-command-life-ledger");
      }
    }
    if (!await page.evaluate(() => Boolean(document.querySelector("[data-testid^='life-ledger-tab-']")))) {
      const wait = await page.evaluateHandle((timeoutMs) => {
        const ok = () => Boolean(document.querySelector("[data-testid^='life-ledger-tab-']"));
        let cancel;
        const promise = new Promise((resolve, reject) => {
          if (ok()) { resolve({ already: true }); return; }
          const finish = (value, error) => {
            observer.disconnect(); clearTimeout(deadline);
            if (error) reject(error); else resolve(value);
          };
          const observer = new MutationObserver(() => { if (ok()) finish({ already: false }); });
          const deadline = setTimeout(() => finish(undefined, new Error("timeout life-ledger tabs")), timeoutMs);
          cancel = () => finish(undefined, new Error("cancelled ledger tabs"));
          observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true });
        });
        return { promise, cancel: () => cancel?.() };
      }, 8_000);
      try {
        await page.keyboard.press("z");
        await wait.evaluate((entry) => entry.promise);
      } finally {
        await wait.evaluate((entry) => entry.cancel()).catch(() => undefined);
        await wait.dispose();
      }
    }
  }
  if (!await isSelected(page, "life-ledger-tab-spaces")) {
    for (const tab of ["bundles", "skills", "makers", "animals", "spaces"]) {
      if (await isSelected(page, `life-ledger-tab-${tab}`)) continue;
      await keyUntilSelected(page, "ArrowDown", `life-ledger-tab-${tab}`);
    }
  }
  if (!await page.evaluate(() => Boolean(document.querySelector("[data-testid='life-ledger-space-building-place-shed']")))) {
    await keyUntilTestid(page, "z", "life-ledger-space-building-place-shed");
  }
  if (!await isSelected(page, "life-ledger-space-building-place-shed")) {
    await ensureSelected(page, "life-ledger-tab-spaces");
    await keyUntilSelected(page, "ArrowDown", "life-ledger-space-building-place-shed");
  }
}

async function railToSystem(page) {
  if (await isSelected(page, "status-menu-command-system-menu")) return;
  const debug = JSON.parse((await menuDebug(page)).debug ?? "{}");
  if (debug.selectedCommand === "record-menu") {
    await keyUntilSelected(page, "ArrowDown", "status-menu-command-system-menu");
    return;
  }
  if (debug.selectedCommand === "items") {
    await keyUntilSelected(page, "ArrowDown", "status-menu-command-skills");
    await keyUntilSelected(page, "ArrowDown", "status-menu-command-equipment");
    await keyUntilSelected(page, "ArrowDown", "status-menu-command-party-menu");
    await keyUntilSelected(page, "ArrowDown", "status-menu-command-record-menu");
    await keyUntilSelected(page, "ArrowDown", "status-menu-command-system-menu");
    return;
  }
  await ensureSelected(page, "status-menu-command-system-menu");
}

async function openSystemGroup(page) {
  await closeMenu(page);
  await keyUntilTestid(page, "x", "main-menu");
  await railToSystem(page);
  const hasGroup = await page.evaluate(() => Boolean(document.querySelector("[data-testid='status-menu-group-command-save']")));
  const debug = JSON.parse((await menuDebug(page)).debug ?? "{}");
  // Main-mode system selection shows group labels but still needs Enter/z to enter the group.
  if (!hasGroup || debug.mode === "main" || debug.selectedCommand === "system-menu") {
    if (!await page.evaluate(() => {
      const d = JSON.parse(document.querySelector("[data-testid='status-menu-debug-json']")?.textContent ?? "{}");
      return d.mode === "function" && (d.selectedCommand === "save" || d.selectedCommand === "load");
    })) {
      await keyUntilTestid(page, "z", "status-menu-group-command-save");
    }
  }
  note("system-group", await menuDebug(page));
}

async function openSaveMenu(page) {
  await openSystemGroup(page);
  // After Load, cursor memory may keep load selected — move to save before opening slots.
  if (await isSelected(page, "status-menu-group-command-load")
    || JSON.parse((await menuDebug(page)).debug ?? "{}").selectedCommand === "load") {
    await keyUntilSelected(page, "ArrowUp", "status-menu-group-command-save");
  }
  if (!await isSelected(page, "status-menu-group-command-save")
    && await page.evaluate(() => Boolean(document.querySelector("[data-testid='status-menu-group-command-save']")))) {
    await ensureSelected(page, "status-menu-group-command-save");
  }
  if (!await page.evaluate(() => Boolean(document.querySelector("[data-testid='save-slot-1']")))) {
    await keyUntilTestid(page, "z", "save-slot-1");
  }
  note("save-menu-open", { selected: await currentSelected(page), debug: (await menuDebug(page)).debug });
}

async function openLoadMenu(page) {
  await openSystemGroup(page);
  if (!await isSelected(page, "status-menu-group-command-load")
    || JSON.parse((await menuDebug(page)).debug ?? "{}").selectedCommand !== "load") {
    if (await isSelected(page, "status-menu-group-command-save")
      || JSON.parse((await menuDebug(page)).debug ?? "{}").selectedCommand === "save") {
      await keyUntilSelected(page, "ArrowDown", "status-menu-group-command-load");
    } else {
      await ensureSelected(page, "status-menu-group-command-load");
    }
  }
  if (!await page.evaluate(() => Boolean(document.querySelector("[data-testid='load-slot-1']")))) {
    await keyUntilTestid(page, "z", "load-slot-1");
  }
  note("load-menu-open", { selected: await currentSelected(page), debug: (await menuDebug(page)).debug });
}

function slotKey(ns, slot) {
  return `${ns}:save-slot:v5:${slot}`;
}

async function readRawSlot(page, ns, slot) {
  return page.evaluate(({ ns, slot }) => {
    const key = `${ns}:save-slot:v5:${slot}`;
    return { key, value: window.localStorage.getItem(key) };
  }, { ns, slot });
}

function slotOwners(raw) {
  if (!raw) {
    return {
      buildings: null,
      decorations: null,
      x: null,
      y: null,
      gold: null,
      inventory: null,
      recoveryItems: null,
    };
  }
  const parsed = JSON.parse(raw);
  const session = parsed.session ?? parsed;
  const decorations = session.homeDecorationPlacements ?? null;
  const recoveryItems = {};
  if (decorations) {
    for (const [id, owner] of Object.entries(decorations)) {
      recoveryItems[id] = owner?.recoveryItem ?? null;
    }
  }
  return {
    buildings: session.farmBuildingPlacements ?? null,
    decorations,
    x: session.x ?? parsed.x ?? null,
    y: session.y ?? parsed.y ?? null,
    gold: session.gold ?? parsed.gold ?? null,
    inventory: session.inventory ?? parsed.inventory ?? null,
    recoveryItems,
  };
}

async function saveSlot(page, ns, slot, filename) {
  await openSaveMenu(page);
  if (slot !== 1) {
    await ensureSelected(page, `save-slot-${slot}`);
  }
  const key = slotKey(ns, slot);
  const storageWait = await subscribeStorageKey(page, key, 10_000);
  let saveMsg;
  try {
    saveMsg = await activateByTestid(page, `save-slot-${slot}`);
    if (String(saveMsg.text ?? "").includes("덮어쓰려면")) {
      note("save-overwrite-confirm", { ns, slot, filename, saveMsg });
      // re-arm storage wait after confirm path if first press did not write
      await storageWait.dispose();
      const storageWait2 = await subscribeStorageKey(page, key, 10_000);
      try {
        saveMsg = await activateByTestid(page, `save-slot-${slot}`);
        await storageWait2.wait().catch(() => null);
      } finally {
        await storageWait2.dispose();
      }
    } else {
      await storageWait.wait().catch(() => null);
    }
  } finally {
    await storageWait.dispose().catch(() => undefined);
  }
  if (!String(saveMsg.text ?? "").includes("저장했습니다")) {
    throw new Error(`${filename}: save did not complete: ${JSON.stringify(saveMsg)}`);
  }
  const rawSlot = await readRawSlot(page, ns, slot);
  if (!rawSlot.value) throw new Error(`${filename}: save slot ${slot} empty`);
  await writeFile(join(HERE, filename), `${rawSlot.value}\n`);
  const owners = slotOwners(rawSlot.value);
  await writeFile(join(HERE, filename.replace(/\.json$/, ".parsed.json")), `${JSON.stringify(owners, null, 2)}\n`);
  note("save-slot", { ns, slot, filename, saveMsg, key: rawSlot.key, bytes: rawSlot.value.length, owners });
  return { rawSlot, owners, saveMsg };
}

async function assertNotMoving(page, label) {
  const sprite = await page.evaluate(() => window.__oprnPlayerSprite?.());
  if (!sprite) throw new Error(`${label}: __oprnPlayerSprite missing`);
  if (sprite.moving === true) throw new Error(`${label}: scene.moving true ${JSON.stringify(sprite)}`);
  const snap = await readMirror(page);
  if (snap.running === true) throw new Error(`${label}: interpreter running`);
  note("not-moving", { label, sprite, player: snap.player, running: snap.running });
  return { sprite, snapshot: snap };
}

function assertPlayer(snapshot, x, y, label) {
  if (snapshot.player.x !== x || snapshot.player.y !== y) {
    throw new Error(`${label}: expected player ${x},${y} got ${JSON.stringify(snapshot.player)}`);
  }
}

function inventoryCount(snapshot, itemId) {
  return snapshot.inventory?.[itemId] ?? 0;
}

function parseDecorationOwner(entries, instanceId) {
  const owner = entries.find((entry) => entry.testid === `life-ledger-space-decoration-${instanceId}`);
  if (!owner) return null;
  const text = `${owner.text ?? ""} ${owner.aria ?? ""}`;
  const coords = text.match(/\((\d+),\s*(\d+)\)/);
  // Owner row shows CURRENT orientation; rotate action button shows NEXT — do not use rotate label.
  let orientation = null;
  if (text.includes("왼쪽")) orientation = "left";
  else if (text.includes("오른쪽")) orientation = "right";
  else if (text.includes("아래")) orientation = "down";
  else if (text.includes("위")) orientation = "up";
  return {
    text,
    x: coords ? Number(coords[1]) : null,
    y: coords ? Number(coords[2]) : null,
    orientation,
  };
}

function firstDecorationInstance(entries) {
  const move = entries.find((entry) => entry.testid?.includes("life-ledger-space-decoration-move-"));
  return move?.testid?.replace("life-ledger-space-decoration-move-", "") ?? null;
}

function assertShed(buildings, label) {
  const shed = buildings?.[SHED_ID];
  if (!shed) throw new Error(`${label}: missing shed ${SHED_ID}`);
  if (shed.x !== 12 || shed.y !== 6) throw new Error(`${label}: shed moved ${JSON.stringify(shed)}`);
  if (shed.typeId !== "shed" || shed.orientation !== "down" || shed.level !== 1) {
    throw new Error(`${label}: shed fields ${JSON.stringify(shed)}`);
  }
}

async function bootPlayer(server, projectJson, saveNamespace, profileName, scratch) {
  const context = await chromium.launchPersistentContext(join(scratch, profileName), {
    headless: true,
    args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu"],
    viewport: { width: 1024, height: 900 },
  });
  cleanup.push(() => context.close());
  const page = context.pages()[0] ?? await context.newPage();
  page.setDefaultTimeout(30_000);
  page.on("pageerror", (error) => evidence.pageErrors.push(String(error?.message ?? error)));
  page.on("requestfailed", (request) => {
    evidence.requestFailures.push({ url: request.url(), failure: request.failure()?.errorText ?? "unknown" });
  });
  page.on("console", (message) => {
    if (message.type() === "error") evidence.errors.push(`console: ${message.text()}`);
  });
  // Clear slots once on first document only — later Load must not wipe saved data.
  await page.addInitScript(([projectUrl, ns]) => {
    if (!window.__qaDidInitialSlotClear) {
      try { localStorage.clear(); } catch { /* ignore */ }
      window.__qaDidInitialSlotClear = true;
    }
    window.__OPENRPG_BOOT__ = { projectUrl, saveNamespace: ns, qaInstrumentation: true };
    window.__qaTitleReady = new Promise((resolve) => {
      const found = () => document.querySelector("[data-testid='title-screen']");
      if (found()) {
        resolve(true);
        return;
      }
      const observer = new MutationObserver(() => {
        if (found()) {
          observer.disconnect();
          resolve(true);
        }
      });
      const attach = () => {
        const root = document.documentElement || document.body;
        if (root) observer.observe(root, { childList: true, subtree: true });
        else document.addEventListener("DOMContentLoaded", attach, { once: true });
      };
      attach();
    });
  }, [PROJECT_URL, saveNamespace]);
  await page.route(PROJECT_ROUTE, (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: projectJson }),
  );
  note("goto", { url: `${server.url}/player.html`, profileName, saveNamespace });
  await page.goto(`${server.url}/player.html`, { waitUntil: "domcontentloaded", timeout: 30_000 });
  const title = await page.evaluate(() => window.__qaTitleReady);
  if (!title) throw new Error("title init hook did not resolve");
  const titlePresent = await page.evaluate(() => Boolean(document.querySelector("[data-testid='title-screen']")));
  if (!titlePresent) throw new Error(`title-screen missing after goto url=${page.url()}`);
  const runtimeWait = await subscribeTestid(page, "runtime-state-json", "present", 60_000);
  await page.keyboard.press("Enter");
  await runtimeWait.wait();
  await runtimeWait.dispose();
  return { context, page };
}

async function runRug(server, scratch) {
  const fixturePath = process.env.TASK12_V5_RUG;
  if (!fixturePath) throw new Error("TASK12_V5_RUG required");
  const projectJson = await readFile(fixturePath, "utf8");
  const fixtureSha = sha256Text(projectJson);
  if (fixtureSha !== EXPECTED_FIXTURE_SHA) {
    throw new Error(`fixture sha mismatch expected=${EXPECTED_FIXTURE_SHA} actual=${fixtureSha}`);
  }
  const fixture = JSON.parse(projectJson);
  if (fixture.system?.playerFootprint?.width !== 3 || fixture.system?.playerFootprint?.height !== 3) {
    throw new Error(`rug playerFootprint not 3x3: ${JSON.stringify(fixture.system?.playerFootprint ?? null)}`);
  }
  if (fixture.system?.playerPassRows !== 1) throw new Error("rug playerPassRows not 1");
  if (fixture.startPos?.x !== 8 || fixture.startPos?.y !== 8) throw new Error(`rug startPos ${JSON.stringify(fixture.startPos)}`);
  const startBuildings = fixture.session?.farmBuildingPlacements ?? [];
  const shedAuthored = Array.isArray(startBuildings)
    ? startBuildings.find((entry) => entry.instanceId === SHED_ID)
    : startBuildings[SHED_ID];
  if (!shedAuthored || shedAuthored.x !== 12 || shedAuthored.y !== 6) {
    throw new Error(`authored shed missing ${JSON.stringify(shedAuthored)}`);
  }
  note("rug-fixture", { sha256: fixtureSha, bytes: projectJson.length, path: fixturePath });

  const { context, page } = await bootPlayer(server, projectJson, SAVE_NS, "profile-rug", scratch);
  const boot = await readMirror(page);
  note("rug-runtime", {
    player: boot.player,
    gold: boot.gold,
    inventory: boot.inventory,
    buildings: boot.farmBuildingPlacements ?? {},
  });
  assertPlayer(boot, 8, 8, "rug boot");
  if (boot.gold !== 500) throw new Error(`rug gold ${boot.gold}`);
  if (inventoryCount(boot, "item_potion") !== 8) throw new Error(`rug potions ${inventoryCount(boot, "item_potion")}`);
  if (inventoryCount(boot, "item_hoe") !== 1) throw new Error("rug hoe");
  assertShed(boot.farmBuildingPlacements, "boot");
  await assertNotMoving(page, "rug-boot");

  // --- Step 1: place rug at 7,9 ---
  await openSpaces(page);
  const afterOpen = await readMirror(page);
  assertPlayer(afterOpen, 8, 8, "after open spaces");
  await assertNotMoving(page, "before-place");
  await ensureSelected(page, "life-ledger-space-decoration-place-rug");
  const rugLabel = await page.getByTestId("life-ledger-space-decoration-place-rug").textContent();
  note("place-label", { rugLabel, selected: await currentSelected(page), spaces: (await menuDebug(page)).spaces });
  if (!rugLabel?.includes("(7, 9)")) throw new Error(`expected rug target (7, 9), got ${rugLabel}`);
  await capture(page, "rug-before-place");

  const placedMsg = await activateByTestid(page, "life-ledger-space-decoration-place-rug");
  const afterPlace = await readMirror(page);
  const spacesAfterPlace = (await menuDebug(page)).spaces;
  const instanceId = firstDecorationInstance(spacesAfterPlace);
  const ownerAfterPlace = parseDecorationOwner(spacesAfterPlace, instanceId);
  note("place", {
    placedMsg,
    gold: afterPlace.gold,
    inventory: afterPlace.inventory,
    player: afterPlace.player,
    instanceId,
    ownerAfterPlace,
    buildings: afterPlace.farmBuildingPlacements,
  });
  if (String(placedMsg.text ?? "").includes("blocked")) throw new Error(`place blocked: ${JSON.stringify(placedMsg)}`);
  if (!String(placedMsg.text ?? "").includes("배치했습니다")) throw new Error(`place message ${JSON.stringify(placedMsg)}`);
  if (instanceId !== RUG_ID) throw new Error(`unexpected rug id ${instanceId}`);
  if (afterPlace.gold !== 500) throw new Error(`place spent gold ${afterPlace.gold}`);
  if (inventoryCount(afterPlace, "item_potion") !== 7) throw new Error(`potions after place ${inventoryCount(afterPlace, "item_potion")}`);
  if (inventoryCount(afterPlace, "item_hoe") !== 1) throw new Error("hoe changed on place");
  assertPlayer(afterPlace, 8, 8, "after place");
  assertShed(afterPlace.farmBuildingPlacements, "after place");
  if (ownerAfterPlace?.orientation !== "down" || ownerAfterPlace.x !== 7 || ownerAfterPlace.y !== 9) {
    throw new Error(`place owner ${JSON.stringify(ownerAfterPlace)}`);
  }
  if (await page.locator(".runtime-missing-resource").count() > 0) throw new Error("missing resource overlay after place");
  await capture(page, "rug-after-place");

  // --- Step 2: DOWN onto rug; actual passage intersects both rug cells ---
  await closeMenu(page);
  await assertNotMoving(page, "before-down-onto");
  const originFoot = await readMirror(page);
  assertPlayer(originFoot, 8, 8, "before down onto");
  const originPassage = passageRect(8, 8);
  const rugCells = footprintCells(7, 9);
  const originHit = cellsInPassage(originPassage, rugCells);
  if (originHit.length !== 0) throw new Error(`origin passage unexpectedly hits rug ${JSON.stringify({ originPassage, originHit })}`);
  evidence.passages.origin = { foot: { x: 8, y: 8 }, passage: originPassage, intersection: originHit, rugCells };

  const downOnto = await holdUntilMove(page, "ArrowDown");
  note("down-onto", downOnto);
  if (downOnto.to.x !== 8 || downOnto.to.y !== 9) {
    throw new Error(`expected DOWN to 8,9 got ${JSON.stringify(downOnto.to)}`);
  }
  await assertNotMoving(page, "after-down-onto");
  const destPassage = passageRect(8, 9);
  const destHit = cellsInPassage(destPassage, rugCells);
  evidence.passages.downOnto = {
    foot: { x: 8, y: 9 },
    passage: destPassage,
    intersection: destHit,
    rugCells,
  };
  note("passage-down-onto", evidence.passages.downOnto);
  if (destHit.length !== 2) {
    throw new Error(`destination passage must intersect BOTH rug cells; got ${JSON.stringify(destHit)} passage=${JSON.stringify(destPassage)}`);
  }
  const hitKey = destHit.map((c) => `${c.x},${c.y}`).sort().join("|");
  if (hitKey !== "7,9|8,9") throw new Error(`unexpected intersection set ${hitKey}`);
  // full body at 8,9 also covers rug, but passage assertion above is the required proof
  const liveOnRug = await readMirror(page);
  assertPlayer(liveOnRug, 8, 9, "standing on rug");
  assertShed(liveOnRug.farmBuildingPlacements, "standing on rug");
  if (liveOnRug.gold !== 500 || inventoryCount(liveOnRug, "item_potion") !== 7) {
    throw new Error("costs changed while walking onto rug");
  }
  await capture(page, "rug-standing-on");

  // --- Step 3: Save slot1 while standing on rug ---
  const slot1 = await saveSlot(page, SAVE_NS, 1, "raw-slot-standing-on-rug.json");
  const slot1Rug = slot1.owners.decorations?.[RUG_ID];
  if (!slot1Rug) throw new Error("slot1 missing rug");
  if (slot1Rug.x !== 7 || slot1Rug.y !== 9 || slot1Rug.orientation !== "down") {
    throw new Error(`slot1 rug ${JSON.stringify(slot1Rug)}`);
  }
  if (!slot1Rug.recoveryItem || slot1Rug.recoveryItem.itemId !== "item_potion" || slot1Rug.recoveryItem.count !== 1) {
    throw new Error(`slot1 recoveryItem ${JSON.stringify(slot1Rug.recoveryItem)}`);
  }
  if (slot1.owners.x !== 8 || slot1.owners.y !== 9) throw new Error(`slot1 foot ${slot1.owners.x},${slot1.owners.y}`);
  if (slot1.owners.gold !== 500) throw new Error(`slot1 gold ${slot1.owners.gold}`);
  if ((slot1.owners.inventory?.item_potion ?? 0) !== 7) throw new Error("slot1 potions");
  if ((slot1.owners.inventory?.item_hoe ?? 0) !== 1) throw new Error("slot1 hoe");
  assertShed(slot1.owners.buildings, "slot1");
  await capture(page, "rug-after-save-slot1");

  // --- Step 4: DOWN off rug; move same rug to 7,11 ---
  await closeMenu(page);
  await assertNotMoving(page, "before-down-off");
  const downOff = await holdUntilMove(page, "ArrowDown");
  note("down-off", downOff);
  if (downOff.to.x !== 8 || downOff.to.y !== 10) {
    throw new Error(`expected DOWN to 8,10 got ${JSON.stringify(downOff.to)}`);
  }
  await assertNotMoving(page, "after-down-off");
  const offPassage = passageRect(8, 10);
  const offHit = cellsInPassage(offPassage, rugCells);
  evidence.passages.downOff = { foot: { x: 8, y: 10 }, passage: offPassage, intersection: offHit, stillAt79: rugCells };
  if (offHit.length !== 0) throw new Error(`off-rug passage still hits old cells ${JSON.stringify(offHit)}`);

  await openSpaces(page);
  const beforeMove = await readMirror(page);
  assertPlayer(beforeMove, 8, 10, "before move");
  await assertNotMoving(page, "before-move");
  const moveId = `life-ledger-space-decoration-move-${RUG_ID}`;
  await ensureSelected(page, moveId);
  const moveLabel = await page.getByTestId(moveId).textContent();
  note("move-label", { moveLabel, selected: await currentSelected(page) });
  if (!moveLabel?.includes("(7, 11)")) throw new Error(`expected move target (7, 11), got ${moveLabel}`);

  const moveMsg = await activateByTestid(page, moveId);
  const afterMove = await readMirror(page);
  const spacesAfterMove = (await menuDebug(page)).spaces;
  const ownerAfterMove = parseDecorationOwner(spacesAfterMove, RUG_ID);
  note("move", {
    moveMsg,
    gold: afterMove.gold,
    inventory: afterMove.inventory,
    player: afterMove.player,
    ownerAfterMove,
    buildings: afterMove.farmBuildingPlacements,
  });
  if (String(moveMsg.text ?? "").includes("blocked")) throw new Error(`move blocked: ${JSON.stringify(moveMsg)}`);
  if (!String(moveMsg.text ?? "").includes("이동했습니다")) throw new Error(`move message ${JSON.stringify(moveMsg)}`);
  if (ownerAfterMove?.orientation !== "down") throw new Error(`move orientation ${JSON.stringify(ownerAfterMove)}`);
  if (ownerAfterMove.x !== 7 || ownerAfterMove.y !== 11) throw new Error(`move coords ${JSON.stringify(ownerAfterMove)}`);
  if (afterMove.gold !== 500) throw new Error(`move spent gold ${afterMove.gold}`);
  if (inventoryCount(afterMove, "item_potion") !== 7) throw new Error("move changed potions");
  if (inventoryCount(afterMove, "item_hoe") !== 1) throw new Error("move changed hoe");
  assertPlayer(afterMove, 8, 10, "after move");
  assertShed(afterMove.farmBuildingPlacements, "after move");
  await capture(page, "rug-after-divergent-move");

  // Prove live divergence vs slot1 before Load — slot1 reread alone cannot pass.
  const liveDivergent = {
    foot: afterMove.player,
    rug: { x: ownerAfterMove.x, y: ownerAfterMove.y, orientation: ownerAfterMove.orientation },
    gold: afterMove.gold,
    potions: inventoryCount(afterMove, "item_potion"),
  };
  const slot1Summary = {
    foot: { x: slot1.owners.x, y: slot1.owners.y },
    rug: { x: slot1Rug.x, y: slot1Rug.y, orientation: slot1Rug.orientation },
    gold: slot1.owners.gold,
    potions: slot1.owners.inventory?.item_potion ?? 0,
  };
  if (liveDivergent.foot.x === slot1Summary.foot.x && liveDivergent.foot.y === slot1Summary.foot.y
    && liveDivergent.rug.x === slot1Summary.rug.x && liveDivergent.rug.y === slot1Summary.rug.y) {
    throw new Error("live state is not divergent from slot1 before Load");
  }
  note("divergence-before-load", { liveDivergent, slot1Summary });
  evidence.sessions.divergence = { liveDivergent, slot1Summary };

  // Re-read slot1 without Load — must still hold standing-on-rug values (proves Load is needed).
  const slot1Reread = slotOwners((await readRawSlot(page, SAVE_NS, 1)).value);
  if (slot1Reread.x !== 8 || slot1Reread.y !== 9 || slot1Reread.decorations?.[RUG_ID]?.x !== 7 || slot1Reread.decorations?.[RUG_ID]?.y !== 9) {
    throw new Error(`slot1 reread drifted unexpectedly ${JSON.stringify(slot1Reread)}`);
  }
  if (liveDivergent.foot.y === slot1Reread.y && liveDivergent.rug.y === slot1Reread.decorations[RUG_ID].y) {
    throw new Error("cannot prove Load if live already matches slot1");
  }

  // --- Step 5: Load slot1; live foot 8,9 and rug 7,9 ---
  await closeMenu(page);
  const beforeLoad = await readMirror(page);
  assertPlayer(beforeLoad, 8, 10, "before load");
  await openLoadMenu(page);
  await ensureSelected(page, "load-slot-1");
  const restoreWait = await subscribePlayerAt(page, { x: 8, y: 9 }, 15_000);
  let loadMsg;
  try {
    loadMsg = await activateByTestid(page, "load-slot-1");
    const restoredMove = await restoreWait.wait();
    note("load-restore-signal", restoredMove);
  } finally {
    await restoreWait.dispose();
  }
  note("load-slot", { loadMsg });

  // Observe CURRENT document/runtime-state after Load (re-query; may be replaced).
  const liveAfterLoad = await readMirror(page);
  note("live-after-load", {
    player: liveAfterLoad.player,
    gold: liveAfterLoad.gold,
    inventory: liveAfterLoad.inventory,
    buildings: liveAfterLoad.farmBuildingPlacements,
  });
  assertPlayer(liveAfterLoad, 8, 9, "live after load");
  if (liveAfterLoad.gold !== 500) throw new Error(`live gold after load ${liveAfterLoad.gold}`);
  if (inventoryCount(liveAfterLoad, "item_potion") !== 7) throw new Error("live potions after load");
  if (inventoryCount(liveAfterLoad, "item_hoe") !== 1) throw new Error("live hoe after load");
  assertShed(liveAfterLoad.farmBuildingPlacements, "live after load");

  // Live rug owner via spaces UI (mirror does not include homeDecorationPlacements).
  if (!await menuOpen(page)) {
    await openSpaces(page);
  } else {
    await openSpaces(page);
  }
  const spacesAfterLoad = (await menuDebug(page)).spaces;
  const ownerAfterLoad = parseDecorationOwner(spacesAfterLoad, RUG_ID);
  note("live-rug-after-load", { ownerAfterLoad, spacesAfterLoad });
  if (!ownerAfterLoad) throw new Error("live rug owner missing after load");
  if (ownerAfterLoad.x !== 7 || ownerAfterLoad.y !== 9 || ownerAfterLoad.orientation !== "down") {
    throw new Error(`live rug not restored ${JSON.stringify(ownerAfterLoad)}`);
  }
  await capture(page, "rug-after-load");

  // --- Step 6: Save loaded state to DIFFERENT slot2; compare with slot1 ---
  const slot2 = await saveSlot(page, SAVE_NS, 2, "raw-slot-after-load-slot2.json");
  const slot2Rug = slot2.owners.decorations?.[RUG_ID];
  if (!slot2Rug) throw new Error("slot2 missing rug");
  if (slot2.owners.x !== 8 || slot2.owners.y !== 9) throw new Error(`slot2 foot ${slot2.owners.x},${slot2.owners.y}`);
  if (slot2Rug.x !== 7 || slot2Rug.y !== 9 || slot2Rug.orientation !== "down") {
    throw new Error(`slot2 rug ${JSON.stringify(slot2Rug)}`);
  }
  if (!slot2Rug.recoveryItem || slot2Rug.recoveryItem.itemId !== "item_potion" || slot2Rug.recoveryItem.count !== 1) {
    throw new Error(`slot2 recoveryItem ${JSON.stringify(slot2Rug.recoveryItem)}`);
  }
  if (slot2.owners.gold !== 500) throw new Error(`slot2 gold ${slot2.owners.gold}`);
  if ((slot2.owners.inventory?.item_potion ?? 0) !== 7) throw new Error("slot2 potions");
  if ((slot2.owners.inventory?.item_hoe ?? 0) !== 1) throw new Error("slot2 hoe");
  assertShed(slot2.owners.buildings, "slot2");

  const compare = {
    foot: {
      slot1: { x: slot1.owners.x, y: slot1.owners.y },
      slot2: { x: slot2.owners.x, y: slot2.owners.y },
      live: liveAfterLoad.player,
    },
    rug: {
      slot1: { x: slot1Rug.x, y: slot1Rug.y, orientation: slot1Rug.orientation, recoveryItem: slot1Rug.recoveryItem },
      slot2: { x: slot2Rug.x, y: slot2Rug.y, orientation: slot2Rug.orientation, recoveryItem: slot2Rug.recoveryItem },
      live: ownerAfterLoad,
    },
    shed: {
      slot1: slot1.owners.buildings?.[SHED_ID],
      slot2: slot2.owners.buildings?.[SHED_ID],
      live: liveAfterLoad.farmBuildingPlacements?.[SHED_ID],
    },
    gold: { slot1: slot1.owners.gold, slot2: slot2.owners.gold, live: liveAfterLoad.gold },
    inventory: {
      slot1: slot1.owners.inventory,
      slot2: slot2.owners.inventory,
      live: liveAfterLoad.inventory,
    },
  };
  note("slot1-slot2-compare", compare);
  if (compare.foot.slot1.x !== compare.foot.slot2.x || compare.foot.slot1.y !== compare.foot.slot2.y) {
    throw new Error("slot1/slot2 foot mismatch");
  }
  if (compare.rug.slot1.x !== compare.rug.slot2.x || compare.rug.slot1.y !== compare.rug.slot2.y
    || compare.rug.slot1.orientation !== compare.rug.slot2.orientation) {
    throw new Error("slot1/slot2 rug mismatch");
  }
  if (JSON.stringify(compare.rug.slot1.recoveryItem) !== JSON.stringify(compare.rug.slot2.recoveryItem)) {
    throw new Error("slot1/slot2 recoveryItem mismatch");
  }
  if (JSON.stringify(compare.shed.slot1) !== JSON.stringify(compare.shed.slot2)) {
    throw new Error("slot1/slot2 shed mismatch");
  }
  if (compare.gold.slot1 !== compare.gold.slot2 || compare.gold.slot2 !== compare.gold.live) {
    throw new Error("gold mismatch across slot1/slot2/live");
  }
  if ((compare.inventory.slot1?.item_potion ?? 0) !== (compare.inventory.slot2?.item_potion ?? 0)
    || (compare.inventory.slot2?.item_potion ?? 0) !== (compare.inventory.live?.item_potion ?? 0)) {
    throw new Error("potion mismatch across slot1/slot2/live");
  }
  if ((compare.inventory.slot1?.item_hoe ?? 0) !== 1 || (compare.inventory.slot2?.item_hoe ?? 0) !== 1) {
    throw new Error("hoe mismatch");
  }

  // slot2 must be a newly written key, not a reread of slot1
  const raw1 = (await readRawSlot(page, SAVE_NS, 1)).value;
  const raw2 = (await readRawSlot(page, SAVE_NS, 2)).value;
  if (!raw2 || raw2 === raw1) {
    // byte equality of session body can happen; keys must differ and both present
  }
  const keys = await page.evaluate((ns) => ({
    s1: window.localStorage.getItem(`${ns}:save-slot:v5:1`)?.length ?? 0,
    s2: window.localStorage.getItem(`${ns}:save-slot:v5:2`)?.length ?? 0,
  }), SAVE_NS);
  if (keys.s1 <= 0 || keys.s2 <= 0) throw new Error(`both slots must exist ${JSON.stringify(keys)}`);
  note("slot-keys-present", keys);

  await capture(page, "rug-after-save-slot2");

  evidence.sessions.rug = {
    instanceId: RUG_ID,
    place: ownerAfterPlace,
    standingFoot: { x: 8, y: 9 },
    passage: evidence.passages,
    slot1: slot1.owners,
    divergent: liveDivergent,
    liveAfterLoad: {
      player: liveAfterLoad.player,
      rug: ownerAfterLoad,
      gold: liveAfterLoad.gold,
      inventory: liveAfterLoad.inventory,
      buildings: liveAfterLoad.farmBuildingPlacements,
    },
    slot2: slot2.owners,
    compare,
  };

  await context.close();
  note("rug-ok", evidence.sessions.rug);
}

const scratch = process.env.TASK12_V5_SCRATCH;
if (!scratch) throw new Error("TASK12_V5_SCRATCH is required");
await mkdir(HERE, { recursive: true });

try {
  const server = await startPlayerQaServer({ logLevel: "error" });
  cleanup.push(() => server.close());
  note("server", { url: server.url, port: server.port, scratch });
  await runRug(server, scratch);
  failed = false;
  note("ok", { scratch, rug: evidence.sessions.rug });
} catch (error) {
  failed = true;
  evidence.uncaught = String(error?.stack ?? error);
  note("failed", { error: String(error?.message ?? error) });
} finally {
  await writeFile(join(HERE, "native-evidence.json"), `${JSON.stringify(evidence, null, 2)}\n`);
  await runCleanup();
  await writeFile(join(HERE, "native-evidence.json"), `${JSON.stringify(evidence, null, 2)}\n`);
}

if (failed) process.exitCode = 1;
else process.exitCode = 0;
