import { chromium } from "@playwright/test";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { startPlayerQaServer } from "../../../../../../../scripts/lib/runtimeQaRun.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const PROJECT_URL = "/__runtime-qa/project.json";
const PROJECT_ROUTE = "**/__runtime-qa/project.json";
const SAVE_NS = "task12-ui-native-r3";
process.env.PLAYWRIGHT_BROWSERS_PATH = process.env.PLAYWRIGHT_BROWSERS_PATH || "/home/main/.cache/ms-playwright";

const cleanup = [];
const evidence = { steps: [], screenshots: [], errors: [], pageErrors: [], requestFailures: [], scenarioErrors: [] };
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

function nodeSelected(node) {
  return Boolean(node && (node.classList.contains("selected") || node.classList.contains("active") || node.getAttribute("aria-selected") === "true"));
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
  for (let i = 0; i < 16; i += 1) {
    if (await stepToward(page, testid, "ArrowDown")) return;
  }
  for (let i = 0; i < 16; i += 1) {
    if (await stepToward(page, testid, "ArrowUp")) return;
  }
  throw new Error(`could not select ${testid}; last=${await currentSelected(page)}`);
}

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
    const node = document.querySelector("[data-testid='runtime-state-json']");
    if (!node?.textContent) throw new Error("runtime-state-json missing before move");
    const start = JSON.parse(node.textContent);
    if (!start.player) throw new Error("snapshot.player missing before move");
    let cancel;
    const promise = new Promise((resolve, reject) => {
      const finish = (value, error) => {
        observer.disconnect();
        clearTimeout(deadline);
        if (error) reject(error);
        else resolve(value);
      };
      const observer = new MutationObserver(() => {
        if (!node.textContent) return;
        const now = JSON.parse(node.textContent);
        if (!now.player) return;
        if (now.player.x !== start.player.x || now.player.y !== start.player.y) {
          finish({ from: start.player, to: now.player, gold: now.gold, farmPlots: now.farmPlots ?? null });
        }
      });
      const deadline = setTimeout(() => finish(undefined, new Error(`no player move from ${start.player.x},${start.player.y}`)), timeoutMs);
      cancel = () => finish(undefined, new Error("cancelled player move"));
      observer.observe(node, { characterData: true, childList: true, subtree: true });
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

async function subscribeNpcOverlapCandidate(page, timeoutMs = 20_000) {
  const handle = await page.evaluateHandle((timeoutMs) => {
    const node = document.querySelector("[data-testid='runtime-state-json']");
    if (!node) throw new Error("runtime-state-json missing before npc wait");
    let cancel;
    const promise = new Promise((resolve, reject) => {
      const finish = (value, error) => {
        observer.disconnect();
        clearTimeout(deadline);
        if (error) reject(error);
        else resolve(value);
      };
      const consider = () => {
        if (!node.textContent) return;
        const state = JSON.parse(node.textContent);
        const move = state.movers?.npc_walker?.activeMove;
        const logical = state.events?.npc_walker;
        const sprites = window.__oprnCharacterSprites?.();
        const npc = sprites?.events?.npc_walker;
        if (!move || !logical || (move.fromX === move.toX && move.fromY === move.toY)) return;
        const originOverlaps = move.fromY === 5 && move.toY === 6;
        if (!originOverlaps) return;
        finish({
          move,
          logical: { x: logical.x, y: logical.y, bodyRect: logical.bodyRect, passRect: logical.passRect },
          sprite: npc ? { x: npc.x, y: npc.y } : null,
          fractional: npc ? (!Number.isInteger(npc.x) || !Number.isInteger(npc.y)) : null,
          player: state.player,
          eventLocations: state.eventLocations?.npc_walker ?? null,
        });
      };
      const observer = new MutationObserver(consider);
      const deadline = setTimeout(() => finish(undefined, new Error("npc origin-vs-destination overlap candidate not observed")), timeoutMs);
      cancel = () => finish(undefined, new Error("cancelled npc overlap wait"));
      observer.observe(node, { characterData: true, childList: true, subtree: true });
      consider();
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

async function subscribeNpcAnyMove(page, timeoutMs = 12_000) {
  const handle = await page.evaluateHandle((timeoutMs) => {
    const node = document.querySelector("[data-testid='runtime-state-json']");
    if (!node) throw new Error("runtime-state-json missing before npc wait");
    let cancel;
    const promise = new Promise((resolve, reject) => {
      const finish = (value, error) => {
        observer.disconnect();
        clearTimeout(deadline);
        if (error) reject(error);
        else resolve(value);
      };
      const consider = () => {
        if (!node.textContent) return;
        const state = JSON.parse(node.textContent);
        const move = state.movers?.npc_walker?.activeMove;
        const sprites = window.__oprnCharacterSprites?.();
        const npc = sprites?.events?.npc_walker;
        if (move && (move.fromX !== move.toX || move.fromY !== move.toY)) {
          finish({
            move,
            sprite: npc ? { x: npc.x, y: npc.y } : null,
            fractional: npc ? (!Number.isInteger(npc.x) || !Number.isInteger(npc.y)) : null,
            eventLocations: state.eventLocations?.npc_walker ?? null,
            player: state.player,
            logical: state.events?.npc_walker ?? null,
          });
        }
      };
      const observer = new MutationObserver(consider);
      const deadline = setTimeout(() => finish(undefined, new Error("npc interpolation not observed")), timeoutMs);
      cancel = () => finish(undefined, new Error("cancelled npc interpolation"));
      observer.observe(node, { characterData: true, childList: true, subtree: true });
      consider();
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

async function capture(page, name, width) {
  await page.setViewportSize({ width, height: 900 });
  const file = join(HERE, `${name}-${width}.png`);
  await page.screenshot({ path: file, fullPage: true });
  evidence.screenshots.push({ name, width, file });
  return file;
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
      const deadline = setTimeout(() => finish(undefined, new Error(`timeout status-menu-message after activate, still ${JSON.stringify(before)}`)), 8_000);
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

async function walkTo(page, x, y) {
  for (let guard = 0; guard < 40; guard += 1) {
    const now = (await readMirror(page)).player;
    if (now.x === x && now.y === y) return now;
    if (await menuOpen(page)) throw new Error("menu open during walk");
    const key = now.x < x ? "ArrowRight" : now.x > x ? "ArrowLeft" : now.y < y ? "ArrowDown" : "ArrowUp";
    const moved = await holdUntilMove(page, key);
    note("walk-step", { want: { x, y }, ...moved });
  }
  const last = (await readMirror(page)).player;
  throw new Error(`walkTo ${x},${y} stopped at ${last.x},${last.y}`);
}

async function menuDebug(page) {
  return page.evaluate(() => ({
    debug: document.querySelector("[data-testid='status-menu-debug-json']")?.textContent ?? null,
    selected: [...document.querySelectorAll("[data-testid].selected")].map((node) => node.getAttribute("data-testid")),
    tabs: [...document.querySelectorAll("[data-testid^='life-ledger-tab-']")].map((node) => node.getAttribute("data-testid")),
    group: [...document.querySelectorAll("[data-testid^='status-menu-group-command-']")].map((node) => node.getAttribute("data-testid")),
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

async function openSaveMenu(page) {
  await closeMenu(page);
  await keyUntilTestid(page, "x", "main-menu");
  await railToSystem(page);
  await keyUntilTestid(page, "z", "status-menu-group-command-save");
  await keyUntilTestid(page, "z", "save-slot-1");
}

async function openLoadMenu(page) {
  await closeMenu(page);
  await keyUntilTestid(page, "x", "main-menu");
  await railToSystem(page);
  await keyUntilTestid(page, "z", "status-menu-group-command-save");
  await keyUntilSelected(page, "ArrowDown", "status-menu-group-command-load");
  await keyUntilTestid(page, "z", "load-slot-1");
}

async function waitMenuClosedAndIdle(page) {
  await closeMenu(page);
  if (await menuOpen(page)) throw new Error("menu still open");
  const snap = await readMirror(page);
  if (snap.running) throw new Error("scene still running after menu close");
  note("menu-closed-idle", { player: snap.player });
}

async function readRawSlot(page) {
  return page.evaluate((ns) => {
    const key = `${ns}:save-slot:v5:1`;
    return { key, value: window.localStorage.getItem(key) };
  }, SAVE_NS);
}

async function equipHoe(page) {
  const label = await page.evaluate(() => document.querySelector("[data-testid='hand-slot-label']")?.textContent ?? "");
  if (label.includes("괭이")) return label;
  for (const digit of ["1", "2", "3", "4", "5"]) {
    const wait = await page.evaluateHandle((timeoutMs) => {
      const node = document.querySelector("[data-testid='hand-slot-label']");
      const before = node?.textContent ?? "";
      let cancel;
      const promise = new Promise((resolve, reject) => {
        const finish = (value, error) => {
          observer.disconnect();
          clearTimeout(deadline);
          if (error) reject(error);
          else resolve(value);
        };
        const observer = new MutationObserver(() => {
          const text = node?.textContent ?? "";
          if (text !== before) finish({ text });
        });
        const deadline = setTimeout(() => finish(undefined, new Error(`hand-slot-label unchanged from ${JSON.stringify(before)}`)), timeoutMs);
        cancel = () => finish(undefined, new Error("cancelled hoe equip"));
        observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
      });
      return { promise, cancel: () => cancel?.() };
    }, 4_000);
    try {
      await page.keyboard.press(digit);
      const changed = await wait.evaluate((entry) => entry.promise).catch(() => null);
      const text = changed?.text ?? await page.evaluate(() => document.querySelector("[data-testid='hand-slot-label']")?.textContent ?? "");
      note("hand-slot", { digit, text });
      if (text.includes("괭이")) return text;
    } finally {
      await wait.evaluate((entry) => entry.cancel()).catch(() => undefined);
      await wait.dispose();
    }
  }
  throw new Error("could not equip hoe");
}

async function tillFacing(page) {
  const before = await readMirror(page);
  const wait = await page.evaluateHandle((timeoutMs) => {
    const node = document.querySelector("[data-testid='runtime-state-json']");
    if (!node?.textContent) throw new Error("runtime-state-json missing before till");
    const start = JSON.parse(node.textContent);
    let cancel;
    const promise = new Promise((resolve, reject) => {
      const finish = (value, error) => {
        observer.disconnect();
        clearTimeout(deadline);
        if (error) reject(error);
        else resolve(value);
      };
      const observer = new MutationObserver(() => {
        if (!node.textContent) return;
        const now = JSON.parse(node.textContent);
        const plots = JSON.stringify(now.farmPlots ?? {});
        const prev = JSON.stringify(start.farmPlots ?? {});
        if (plots !== prev) finish({ farmPlots: now.farmPlots, player: now.player, actionReceipt: now.actionReceipt ?? null });
      });
      const deadline = setTimeout(() => finish(undefined, new Error("farmPlots did not change after till")), timeoutMs);
      cancel = () => finish(undefined, new Error("cancelled till"));
      observer.observe(node, { characterData: true, childList: true, subtree: true });
    });
    return { promise, cancel: () => cancel?.() };
  }, 8_000);
  try {
    await page.keyboard.press("z");
    const result = await wait.evaluate((entry) => entry.promise);
    note("till", { before: before.player, ...result });
    return result;
  } finally {
    await wait.evaluate((entry) => entry.cancel()).catch(() => undefined);
    await wait.dispose();
  }
}

function firstBuilding(snapshot) {
  const entries = Object.entries(snapshot.farmBuildingPlacements ?? {});
  return entries[0] ? { id: entries[0][0], ...entries[0][1] } : null;
}

function decorationIdsFromDom(page) {
  return page.evaluate(() => [...document.querySelectorAll("[data-testid^='life-ledger-space-decoration-']")]
    .map((node) => node.getAttribute("data-testid"))
    .filter(Boolean));
}

const projectJson = await readFile(join(HERE, "fixture.json"), "utf8");
const fixture = JSON.parse(projectJson);
if (fixture.system?.playerFootprint?.width !== 3 || fixture.system?.playerFootprint?.height !== 3) {
  throw new Error(`fixture playerFootprint not 3x3: ${JSON.stringify(fixture.system?.playerFootprint ?? null)}`);
}
if (fixture.system?.playerPassRows !== 1) {
  throw new Error(`fixture playerPassRows not 1: ${JSON.stringify(fixture.system?.playerPassRows ?? null)}`);
}
await mkdir(HERE, { recursive: true });

const scratch = process.env.TASK12_R3_SCRATCH;
if (!scratch) throw new Error("TASK12_R3_SCRATCH is required");

try {
  const server = await startPlayerQaServer({ logLevel: "error" });
  cleanup.push(() => server.close());
  note("server", { url: server.url, port: server.port });

  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu"],
  });
  cleanup.push(() => browser.close());
  const context = await browser.newContext({
    viewport: { width: 1024, height: 900 },
  });
  cleanup.push(() => context.close());
  const page = await context.newPage();
  note("browser", { scratch });
  page.setDefaultTimeout(30_000);
  page.on("pageerror", (error) => evidence.pageErrors.push(String(error?.message ?? error)));
  page.on("requestfailed", (request) => {
    evidence.requestFailures.push({ url: request.url(), failure: request.failure()?.errorText ?? "unknown" });
  });
  page.on("console", (message) => {
    if (message.type() === "error") evidence.errors.push(`console: ${message.text()}`);
  });

  await page.addInitScript(([projectUrl, saveNamespace]) => {
    try { localStorage.clear(); } catch { /* ignore */ }
    window.__OPENRPG_BOOT__ = { projectUrl, saveNamespace, qaInstrumentation: true };
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
  }, [PROJECT_URL, SAVE_NS]);
  await page.route(PROJECT_ROUTE, (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: projectJson }),
  );

  note("goto", { url: `${server.url}/player.html` });
  const nav = page.goto(`${server.url}/player.html`, { waitUntil: "domcontentloaded", timeout: 30_000 });
  await nav;
  const title = await page.evaluate(() => window.__qaTitleReady);
  if (!title) throw new Error("title init hook did not resolve");
  const titlePresent = await page.evaluate(() => Boolean(document.querySelector("[data-testid='title-screen']")));
  if (!titlePresent) throw new Error(`title-screen missing after goto url=${page.url()}`);
  note("title", { url: page.url() });

  const runtimeWait = await subscribeTestid(page, "runtime-state-json", "present", 60_000);
  await page.keyboard.press("Enter");
  await runtimeWait.wait();
  await runtimeWait.dispose();
  const boot = await readMirror(page);
  note("runtime", { mapId: boot.mapId, player: boot.player, gold: boot.gold, farmPlots: boot.farmPlots ?? {} });
  if (boot.player.x !== 8 || boot.player.y !== 8) {
    throw new Error(`expected start 8,8 got ${boot.player.x},${boot.player.y}`);
  }
  if (JSON.stringify(boot.farmPlots ?? {}) !== "{}") {
    throw new Error(`new game farmPlots not empty: ${JSON.stringify(boot.farmPlots)}`);
  }

  const npcWait = await subscribeNpcAnyMove(page);
  const moving = await npcWait.wait();
  await npcWait.dispose();
  note("npc-interpolation", moving);

  await openSpaces(page);
  const placeLabel = await page.getByTestId("life-ledger-space-building-place-shed").textContent();
  note("spaces", { placeLabel, selected: await currentSelected(page) });
  if (placeLabel?.includes("(8, 8)")) throw new Error(`foot-tile target leaked into UI: ${placeLabel}`);
  if (!placeLabel?.includes("(7, 9)")) {
    throw new Error(`expected 3x3 adjacent target (7, 9), got ${placeLabel}`);
  }
  await capture(page, "spaces-before-place", 1024);
  await capture(page, "spaces-before-place", 1440);

  const goldBefore = (await readMirror(page)).gold;
  const placedMsg = await activateByTestid(page, "life-ledger-space-building-place-shed");
  const afterPlace = await readMirror(page);
  const placed = firstBuilding(afterPlace);
  note("place-building", { placedMsg, placed, gold: afterPlace.gold, player: afterPlace.player });
  if (!placed) throw new Error(`building was not placed: ${JSON.stringify(placedMsg)}`);
  if (placed.x === afterPlace.player.x && placed.y === afterPlace.player.y) throw new Error("placed on foot tile");
  if (placed.x !== 7 || placed.y !== 9) throw new Error(`expected adjacent 7,9 got ${placed.x},${placed.y}`);
  if (afterPlace.gold !== goldBefore - 10) throw new Error(`gold ${goldBefore} -> ${afterPlace.gold}`);
  if (await page.locator(".runtime-missing-resource").count() > 0) throw new Error("missing resource overlay present");
  await capture(page, "after-place", 1024);

  const overlapMsg = await activateByTestid(page, "life-ledger-space-building-place-shed");
  const afterOverlap = await readMirror(page);
  note("overlap-refuse", { overlapMsg, gold: afterOverlap.gold, count: Object.keys(afterOverlap.farmBuildingPlacements ?? {}).length });
  if (afterOverlap.gold !== afterPlace.gold) throw new Error("overlap spent gold");
  if (Object.keys(afterOverlap.farmBuildingPlacements ?? {}).length !== 1) throw new Error("overlap placed another building");
  if (!String(overlapMsg.text ?? "").includes("blocked")) throw new Error(`overlap message ${JSON.stringify(overlapMsg)}`);

  const buildingId = placed.id;
  const upgradeMsg = await activateByTestid(page, `life-ledger-space-building-upgrade-${buildingId}`);
  const afterUpgrade = await readMirror(page);
  note("upgrade", { upgradeMsg, gold: afterUpgrade.gold, placement: afterUpgrade.farmBuildingPlacements?.[buildingId] });
  if (afterUpgrade.farmBuildingPlacements?.[buildingId]?.level !== 2) throw new Error("upgrade did not reach level 2");
  if (afterUpgrade.gold !== afterPlace.gold - 20) throw new Error(`upgrade gold ${afterUpgrade.gold}`);
  const upgraded = afterUpgrade.farmBuildingPlacements?.[buildingId];
  if (upgraded?.x !== 7 || upgraded?.y !== 9) throw new Error("upgrade moved stored coordinates");

  await waitMenuClosedAndIdle(page);
  const walkedRight = await holdUntilMove(page, "ArrowRight");
  note("walk-right-before-move", walkedRight);
  await openSpaces(page);
  const moveMsg = await activateByTestid(page, `life-ledger-space-building-move-${buildingId}`);
  const afterMove = await readMirror(page);
  const movedB = afterMove.farmBuildingPlacements?.[buildingId];
  note("move-building", { moveMsg, placement: movedB, player: afterMove.player });
  if (!movedB) throw new Error("building missing after move");
  if (movedB.x === 7 && movedB.y === 9) throw new Error(`move stayed at 7,9: ${JSON.stringify(movedB)}`);
  if (movedB.level !== 2) throw new Error("move changed level");

  await waitMenuClosedAndIdle(page);
  await walkTo(page, 4, 4);
  await openSpaces(page);
  const rugPlace = await activateByTestid(page, "life-ledger-space-decoration-place-rug");
  let afterRug = await readMirror(page);
  note("place-rug", { rugPlace, gold: afterRug.gold, decorationTestids: await decorationIdsFromDom(page) });
  const rugIds = (await decorationIdsFromDom(page)).filter((id) => id.includes("-move-") || id.includes("-rotate-") || id.includes("-remove-"));
  const rugMoveId = rugIds.find((id) => id.includes("-move-"));
  const rugRotateId = rugIds.find((id) => id.includes("-rotate-"));
  if (!rugMoveId) throw new Error(`rug was not placed: ${JSON.stringify(rugPlace)} ${JSON.stringify(await decorationIdsFromDom(page))}`);
  const rugInstance = rugMoveId.replace("life-ledger-space-decoration-move-", "");
  await waitMenuClosedAndIdle(page);
  await walkTo(page, 2, 2);
  await openSpaces(page);
  const rugMove = await activateByTestid(page, rugMoveId);
  note("move-rug", { rugMove, testids: await decorationIdsFromDom(page) });
  const rugRotate = await activateByTestid(page, rugRotateId ?? `life-ledger-space-decoration-rotate-${rugInstance}`);
  note("rotate-rug", { rugRotate });

  await waitMenuClosedAndIdle(page);
  const rawBeforeWalk = await decorationIdsFromDom(page).catch(() => []);
  note("decorations-before-rug-walk", { rawBeforeWalk });
  // Walk onto the nonblocking rug from (2,2) toward likely rug cell.
  const ontoRug = await holdUntilMove(page, "ArrowDown").catch(async (error) => {
    note("rug-walk-down-failed", { error: String(error?.message ?? error) });
    return holdUntilMove(page, "ArrowRight");
  });
  note("walk-onto-rug", ontoRug);

  await waitMenuClosedAndIdle(page);
  await walkTo(page, 7, 7);
  await walkTo(page, 7, 8);
  await equipHoe(page);
  const tillResult = await tillFacing(page);
  const plotKeys = Object.keys(tillResult.farmPlots?.[boot.mapId] ?? tillResult.farmPlots?.map_blank_start ?? {});
  note("tilled-keys", { plotKeys, farmPlots: tillResult.farmPlots });
  if (plotKeys.length === 0) throw new Error("tilling did not create a plot");
  if (!plotKeys.includes("7,9")) throw new Error(`tilled ${JSON.stringify(plotKeys)}, expected 7,9`);
  await walkTo(page, 8, 7);
  await walkTo(page, 8, 8);
  await openSpaces(page);
  const goldBeforePlot = (await readMirror(page)).gold;
  const plotMsg = await activateByTestid(page, "life-ledger-space-building-place-shed");
  const afterPlot = await readMirror(page);
  note("plot-refuse", { plotMsg, gold: afterPlot.gold, buildings: afterPlot.farmBuildingPlacements, farmPlots: afterPlot.farmPlots });
  const buildingCount = Object.keys(afterPlot.farmBuildingPlacements ?? {}).length;
  if (afterPlot.gold !== goldBeforePlot) throw new Error("plot refuse spent gold");
  if (buildingCount !== 1) throw new Error(`plot refuse changed buildings ${buildingCount}`);
  if (!String(plotMsg.text ?? "").includes("blocked")) throw new Error(`plot message ${JSON.stringify(plotMsg)}`);

  await waitMenuClosedAndIdle(page);
  await walkTo(page, 1, 8);
  await openSpaces(page);
  const edgeMsg = await activateByTestid(page, "life-ledger-space-building-place-shed");
  const afterEdge = await readMirror(page);
  note("edge-refuse", { edgeMsg, gold: afterEdge.gold, player: afterEdge.player, buildings: afterEdge.farmBuildingPlacements });
  if (afterEdge.gold !== goldBeforePlot) throw new Error("edge refuse spent gold");
  if (Object.keys(afterEdge.farmBuildingPlacements ?? {}).length !== 1) throw new Error("edge refuse placed");
  if (!String(edgeMsg.text ?? "").includes("blocked")) throw new Error(`edge message ${JSON.stringify(edgeMsg)}`);

  await waitMenuClosedAndIdle(page);
  await walkTo(page, 1, 1);
  await walkTo(page, 1, 2);
  await openSpaces(page);
  const lastExitPlace = await activateByTestid(page, "life-ledger-space-building-place-shed");
  note("last-exit-setup-place", { lastExitPlace, buildings: (await readMirror(page)).farmBuildingPlacements });
  await waitMenuClosedAndIdle(page);
  const faceRight = await holdUntilMove(page, "ArrowRight").catch((error) => {
    note("last-exit-face-right", { error: String(error?.message ?? error) });
    return null;
  });
  note("last-exit-moved", faceRight);
  await openSpaces(page);
  const goldBeforeExit = (await readMirror(page)).gold;
  const buildingsBeforeExit = Object.keys((await readMirror(page)).farmBuildingPlacements ?? {}).length;
  const lastExitMsg = await activateByTestid(page, "life-ledger-space-building-place-shed");
  const afterExit = await readMirror(page);
  note("last-exit-refuse", { lastExitMsg, gold: afterExit.gold, buildings: afterExit.farmBuildingPlacements });
  const lastExitBlocked = String(lastExitMsg.text ?? "").includes("blocked")
    && afterExit.gold === goldBeforeExit
    && Object.keys(afterExit.farmBuildingPlacements ?? {}).length === buildingsBeforeExit;
  note("last-exit-verdict", { lastExitBlocked, goldBeforeExit, gold: afterExit.gold, buildingsBeforeExit });

  await waitMenuClosedAndIdle(page);
  await walkTo(page, 8, 2);
  await walkTo(page, 16, 1);
  await walkTo(page, 16, 2);
  const overlapWait = await subscribeNpcOverlapCandidate(page);
  const overlapNpc = await overlapWait.wait();
  await overlapWait.dispose();
  note("npc-overlap-candidate", overlapNpc);
  await keyUntilTestid(page, "x", "main-menu");
  await openSpaces(page);
  const goldBeforeNpc = (await readMirror(page)).gold;
  const npcPlace = await activateByTestid(page, "life-ledger-space-building-place-shed");
  const afterNpc = await readMirror(page);
  note("npc-overlap-refuse", { npcPlace, gold: afterNpc.gold, player: afterNpc.player, buildings: afterNpc.farmBuildingPlacements, logical: overlapNpc.logical, move: overlapNpc.move });
  if (afterNpc.gold !== goldBeforeNpc) throw new Error("npc overlap spent gold");
  if (!String(npcPlace.text ?? "").includes("blocked")) throw new Error(`npc overlap message ${JSON.stringify(npcPlace)}`);
  await capture(page, "npc-overlap-menu", 1024);
  await capture(page, "npc-overlap-menu", 1440);

  await openSaveMenu(page);
  const saveMsg = await activateByTestid(page, "save-slot-1");
  note("save-slot", { saveMsg });
  const rawSlot = await readRawSlot(page);
  await writeFile(join(HERE, "raw-slot-1.json"), `${rawSlot.value ?? "null"}\n`);
  note("raw-slot", { key: rawSlot.key, bytes: rawSlot.value?.length ?? 0 });
  if (!rawSlot.value) throw new Error("save slot 1 was empty");
  const parsed = JSON.parse(rawSlot.value);
  const slotBuildings = parsed.session?.farmBuildingPlacements ?? parsed.farmBuildingPlacements ?? null;
  const slotDecorations = parsed.session?.homeDecorationPlacements ?? parsed.homeDecorationPlacements ?? null;
  await writeFile(join(HERE, "raw-slot-1.parsed.json"), `${JSON.stringify({
    buildings: slotBuildings,
    decorations: slotDecorations,
    x: parsed.session?.x ?? parsed.x ?? null,
    y: parsed.session?.y ?? parsed.y ?? null,
    farmPlots: parsed.session?.farmPlots ?? parsed.farmPlots ?? null,
  }, null, 2)}\n`);
  if (!slotBuildings || Object.keys(slotBuildings).length === 0) throw new Error("raw slot missing buildings");
  if (!slotDecorations || Object.keys(slotDecorations).length === 0) throw new Error("raw slot missing decorations");

  await openLoadMenu(page);
  const loadMsg = await activateByTestid(page, "load-slot-1");
  note("load-slot", { loadMsg, player: (await readMirror(page)).player });
  await waitMenuClosedAndIdle(page);
  await openSpaces(page);
  const loadedTestids = await decorationIdsFromDom(page);
  const loadedBuildings = (await readMirror(page)).farmBuildingPlacements;
  note("load-restored", { loadedTestids, loadedBuildings, gold: (await readMirror(page)).gold });
  if (!loadedTestids.some((id) => id.includes("rug"))) throw new Error(`load did not restore rug UI ${JSON.stringify(loadedTestids)}`);
  if (!loadedBuildings || Object.keys(loadedBuildings).length === 0) throw new Error("load did not restore buildings");

  await waitMenuClosedAndIdle(page);
  await capture(page, "field-after-load", 1024);
  await capture(page, "field-after-load", 1440);
  failed = false;
  note("ok", { scratch });
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
