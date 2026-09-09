import { chromium } from "@playwright/test";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { startPlayerQaServer } from "../../../../../../../scripts/lib/runtimeQaRun.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const PROJECT_URL = "/__runtime-qa/project.json";
const PROJECT_ROUTE = "**/__runtime-qa/project.json";
const ARENA_NS = "task12-ui-native-r4-arena";
const LAST_EXIT_NS = "task12-ui-native-r4-last-exit";
process.env.PLAYWRIGHT_BROWSERS_PATH = process.env.PLAYWRIGHT_BROWSERS_PATH || "/home/main/.cache/ms-playwright";

const cleanup = [];
const evidence = { steps: [], screenshots: [], errors: [], pageErrors: [], requestFailures: [], sessions: {} };
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
  for (let i = 0; i < 24; i += 1) {
    if (await stepToward(page, testid, "ArrowDown")) return;
  }
  for (let i = 0; i < 24; i += 1) {
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
          finish({ from: start.player, to: now.player, gold: now.gold, inventory: now.inventory ?? null });
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

async function openSaveMenu(page) {
  await closeMenu(page);
  await keyUntilTestid(page, "x", "main-menu");
  await railToSystem(page);
  await keyUntilTestid(page, "z", "status-menu-group-command-save");
  await keyUntilTestid(page, "z", "save-slot-1");
}

async function readRawSlot(page, ns) {
  return page.evaluate((ns) => {
    const key = `${ns}:save-slot:v5:1`;
    return { key, value: window.localStorage.getItem(key) };
  }, ns);
}

function slotOwners(raw) {
  if (!raw) return { buildings: null, decorations: null, x: null, y: null, gold: null, inventory: null };
  const parsed = JSON.parse(raw);
  const session = parsed.session ?? parsed;
  return {
    buildings: session.farmBuildingPlacements ?? null,
    decorations: session.homeDecorationPlacements ?? null,
    x: session.x ?? parsed.x ?? null,
    y: session.y ?? parsed.y ?? null,
    gold: session.gold ?? parsed.gold ?? null,
    inventory: session.inventory ?? parsed.inventory ?? null,
  };
}

async function saveSlot(page, ns, filename) {
  await openSaveMenu(page);
  let saveMsg = await activateByTestid(page, "save-slot-1");
  if (String(saveMsg.text ?? "").includes("덮어쓰려면")) {
    note("save-overwrite-confirm", { ns, filename, saveMsg });
    saveMsg = await activateByTestid(page, "save-slot-1");
  }
  if (!String(saveMsg.text ?? "").includes("저장했습니다")) {
    throw new Error(`${filename}: save did not complete: ${JSON.stringify(saveMsg)}`);
  }
  const rawSlot = await readRawSlot(page, ns);
  if (!rawSlot.value) throw new Error(`${filename}: save slot 1 empty`);
  await writeFile(join(HERE, filename), `${rawSlot.value}\n`);
  const owners = slotOwners(rawSlot.value);
  await writeFile(join(HERE, filename.replace(/\.json$/, ".parsed.json")), `${JSON.stringify(owners, null, 2)}\n`);
  note("save-slot", { ns, filename, saveMsg, key: rawSlot.key, bytes: rawSlot.value.length, owners });
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
  await page.addInitScript(([projectUrl, ns]) => {
    try { localStorage.clear(); } catch { /* ignore */ }
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

async function runArena(server, scratch) {
  const fixturePath = process.env.TASK12_R4_ARENA;
  if (!fixturePath) throw new Error("TASK12_R4_ARENA required");
  const projectJson = await readFile(fixturePath, "utf8");
  const fixture = JSON.parse(projectJson);
  if (fixture.system?.playerFootprint?.width !== 3 || fixture.system?.playerFootprint?.height !== 3) {
    throw new Error(`arena playerFootprint not 3x3: ${JSON.stringify(fixture.system?.playerFootprint ?? null)}`);
  }
  if (fixture.system?.playerPassRows !== 1) throw new Error("arena playerPassRows not 1");
  if (fixture.startPos?.x !== 8 || fixture.startPos?.y !== 8) throw new Error(`arena startPos ${JSON.stringify(fixture.startPos)}`);
  note("arena-fixture", { sha256: sha256Text(projectJson), bytes: projectJson.length, path: fixturePath });

  const { context, page } = await bootPlayer(server, projectJson, ARENA_NS, "profile-arena", scratch);
  const boot = await readMirror(page);
  note("arena-runtime", { player: boot.player, gold: boot.gold, inventory: boot.inventory, farmPlots: boot.farmPlots ?? {}, buildings: boot.farmBuildingPlacements ?? {} });
  assertPlayer(boot, 8, 8, "arena boot");
  if (boot.gold !== 500) throw new Error(`arena gold ${boot.gold}`);
  if (inventoryCount(boot, "item_potion") !== 8) throw new Error(`arena potions ${inventoryCount(boot, "item_potion")}`);
  if (JSON.stringify(boot.farmPlots ?? {}) !== "{}") throw new Error("arena farmPlots not empty");
  if (Object.keys(boot.farmBuildingPlacements ?? {}).length !== 0) throw new Error("arena started with buildings");
  await assertNotMoving(page, "arena-boot");

  await openSpaces(page);
  const afterOpen = await readMirror(page);
  assertPlayer(afterOpen, 8, 8, "arena after open spaces");
  await assertNotMoving(page, "arena-before-place");
  const tableLabel = await page.getByTestId("life-ledger-space-decoration-place-table").textContent();
  note("arena-place-label", { tableLabel, selected: await currentSelected(page), spaces: (await menuDebug(page)).spaces });
  if (!tableLabel?.includes("(7, 9)")) throw new Error(`expected table target (7, 9), got ${tableLabel}`);
  await capture(page, "arena-before-place");

  const placedMsg = await activateByTestid(page, "life-ledger-space-decoration-place-table");
  const afterPlace = await readMirror(page);
  const spacesAfterPlace = (await menuDebug(page)).spaces;
  const instanceId = firstDecorationInstance(spacesAfterPlace);
  const ownerAfterPlace = parseDecorationOwner(spacesAfterPlace, instanceId);
  note("arena-place", { placedMsg, gold: afterPlace.gold, inventory: afterPlace.inventory, player: afterPlace.player, instanceId, ownerAfterPlace, spacesAfterPlace });
  if (String(placedMsg.text ?? "").includes("blocked")) throw new Error(`arena place blocked: ${JSON.stringify(placedMsg)}`);
  if (!String(placedMsg.text ?? "").includes("배치했습니다")) throw new Error(`arena place message ${JSON.stringify(placedMsg)}`);
  if (!instanceId) throw new Error("arena table instance missing after place");
  if (instanceId !== "ledger:decoration:table:1") throw new Error(`unexpected table id ${instanceId}`);
  if (afterPlace.gold !== 500) throw new Error(`arena place spent gold ${afterPlace.gold}`);
  if (inventoryCount(afterPlace, "item_potion") !== 7) throw new Error(`arena potions after place ${inventoryCount(afterPlace, "item_potion")}`);
  assertPlayer(afterPlace, 8, 8, "arena after place");
  if (ownerAfterPlace?.orientation !== "down" || ownerAfterPlace.x !== 7 || ownerAfterPlace.y !== 9) {
    throw new Error(`arena place owner ${JSON.stringify(ownerAfterPlace)}`);
  }
  if (await page.locator(".runtime-missing-resource").count() > 0) throw new Error("missing resource overlay present after place");
  await capture(page, "arena-after-place");
  await assertNotMoving(page, "arena-before-rotate");

  const rotateId = `life-ledger-space-decoration-rotate-${instanceId}`;
  const rotateMsg = await activateByTestid(page, rotateId);
  const afterRotate = await readMirror(page);
  const spacesAfterRotate = (await menuDebug(page)).spaces;
  const ownerAfterRotate = parseDecorationOwner(spacesAfterRotate, instanceId);
  note("arena-rotate", { rotateMsg, gold: afterRotate.gold, inventory: afterRotate.inventory, player: afterRotate.player, ownerAfterRotate, spacesAfterRotate });
  if (String(rotateMsg.text ?? "").includes("blocked")) throw new Error(`arena rotate blocked: ${JSON.stringify(rotateMsg)}`);
  if (!String(rotateMsg.text ?? "").includes("회전했습니다")) throw new Error(`arena rotate message ${JSON.stringify(rotateMsg)}`);
  if (ownerAfterRotate?.orientation !== "left") throw new Error(`arena rotate did not change orientation: ${JSON.stringify(ownerAfterRotate)}`);
  if (ownerAfterRotate.x !== 7 || ownerAfterRotate.y !== 9) throw new Error(`arena rotate moved coordinates: ${JSON.stringify(ownerAfterRotate)}`);
  if (afterRotate.gold !== 500) throw new Error(`arena rotate spent gold ${afterRotate.gold}`);
  if (inventoryCount(afterRotate, "item_potion") !== 7) throw new Error("arena rotate changed potions");
  assertPlayer(afterRotate, 8, 8, "arena after rotate");
  await capture(page, "arena-after-rotate");

  const rotatedSlot = await saveSlot(page, ARENA_NS, "raw-slot-arena-rotated.json");
  const rotatedDecor = rotatedSlot.owners.decorations?.[instanceId];
  if (!rotatedDecor) throw new Error("rotated slot missing table");
  if (rotatedDecor.orientation !== "left" || rotatedDecor.x !== 7 || rotatedDecor.y !== 9) {
    throw new Error(`rotated slot owner ${JSON.stringify(rotatedDecor)}`);
  }
  if (rotatedSlot.owners.gold !== 500) throw new Error(`rotated slot gold ${rotatedSlot.owners.gold}`);

  await closeMenu(page);
  const leftStep = await holdUntilMove(page, "ArrowLeft");
  note("arena-left-step", leftStep);
  if (leftStep.to.x !== 7 || leftStep.to.y !== 8) {
    throw new Error(`expected one left step to 7,8 got ${JSON.stringify(leftStep.to)}`);
  }
  await assertNotMoving(page, "arena-after-left-step");

  await openSpaces(page);
  const beforeMoveSnap = await readMirror(page);
  assertPlayer(beforeMoveSnap, 7, 8, "arena before move");
  await assertNotMoving(page, "arena-before-move");
  const moveId = `life-ledger-space-decoration-move-${instanceId}`;
  const moveLabel = await page.getByTestId(moveId).textContent();
  note("arena-move-label", { moveLabel, selected: await currentSelected(page) });
  if (!moveLabel?.includes("(5, 6)")) throw new Error(`expected move target (5, 6), got ${moveLabel}`);

  const moveMsg = await activateByTestid(page, moveId);
  const afterMove = await readMirror(page);
  const spacesAfterMove = (await menuDebug(page)).spaces;
  const ownerAfterMove = parseDecorationOwner(spacesAfterMove, instanceId);
  note("arena-move", { moveMsg, gold: afterMove.gold, inventory: afterMove.inventory, player: afterMove.player, ownerAfterMove, spacesAfterMove });
  if (String(moveMsg.text ?? "").includes("blocked")) throw new Error(`arena move blocked: ${JSON.stringify(moveMsg)}`);
  if (!String(moveMsg.text ?? "").includes("이동했습니다")) throw new Error(`arena move message ${JSON.stringify(moveMsg)}`);
  if (ownerAfterMove?.orientation !== "left") throw new Error(`arena move lost orientation ${JSON.stringify(ownerAfterMove)}`);
  if (ownerAfterMove.x !== 5 || ownerAfterMove.y !== 6) throw new Error(`arena move did not change coordinates ${JSON.stringify(ownerAfterMove)}`);
  if (afterMove.gold !== 500) throw new Error(`arena move spent gold ${afterMove.gold}`);
  if (inventoryCount(afterMove, "item_potion") !== 7) throw new Error("arena move changed potions");
  assertPlayer(afterMove, 7, 8, "arena after move");
  await capture(page, "arena-after-move");

  const movedSlot = await saveSlot(page, ARENA_NS, "raw-slot-arena-moved.json");
  const movedDecor = movedSlot.owners.decorations?.[instanceId];
  if (!movedDecor) throw new Error("moved slot missing table");
  if (movedDecor.orientation !== "left" || movedDecor.x !== 5 || movedDecor.y !== 6) {
    throw new Error(`moved slot owner ${JSON.stringify(movedDecor)}`);
  }
  if (movedDecor.typeId !== "table") throw new Error(`moved slot type ${movedDecor.typeId}`);
  if (movedSlot.owners.gold !== 500) throw new Error(`moved slot gold ${movedSlot.owners.gold}`);
  if ((movedSlot.owners.inventory?.item_potion ?? 0) !== 7) throw new Error("moved slot potions");

  evidence.sessions.arena = {
    instanceId,
    place: ownerAfterPlace,
    rotate: ownerAfterRotate,
    move: ownerAfterMove,
    rotatedSlot: rotatedDecor,
    movedSlot: movedDecor,
    gold: afterMove.gold,
    potions: inventoryCount(afterMove, "item_potion"),
    playerAfterMove: afterMove.player,
  };
  await context.close();
  const idx = cleanup.findIndex((task) => task.toString().includes("context"));
  note("arena-ok", evidence.sessions.arena);
}

async function runLastExit(server, scratch) {
  const fixturePath = process.env.TASK12_R4_LAST_EXIT;
  if (!fixturePath) throw new Error("TASK12_R4_LAST_EXIT required");
  const projectJson = await readFile(fixturePath, "utf8");
  const fixture = JSON.parse(projectJson);
  if (fixture.system?.playerFootprint?.width !== 3 || fixture.system?.playerFootprint?.height !== 3) {
    throw new Error(`last-exit playerFootprint not 3x3`);
  }
  if (fixture.system?.playerPassRows !== 1) throw new Error("last-exit playerPassRows not 1");
  if (fixture.startPos?.x !== 1 || fixture.startPos?.y !== 2) throw new Error(`last-exit startPos ${JSON.stringify(fixture.startPos)}`);
  note("last-exit-fixture", { sha256: sha256Text(projectJson), bytes: projectJson.length, path: fixturePath });

  const { context, page } = await bootPlayer(server, projectJson, LAST_EXIT_NS, "profile-last-exit", scratch);
  const boot = await readMirror(page);
  note("last-exit-runtime", { player: boot.player, gold: boot.gold, inventory: boot.inventory, buildings: boot.farmBuildingPlacements ?? {} });
  assertPlayer(boot, 1, 2, "last-exit boot");
  if (boot.gold !== 500) throw new Error(`last-exit gold ${boot.gold}`);
  if (inventoryCount(boot, "item_potion") !== 8) throw new Error("last-exit potions");
  if (inventoryCount(boot, "item_hoe") !== 1) throw new Error("last-exit hoe");
  const buildings = boot.farmBuildingPlacements ?? {};
  const buildingIds = Object.keys(buildings).sort();
  if (buildingIds.join(",") !== "r4-block-right,r4-block-up") {
    throw new Error(`last-exit buildings ${JSON.stringify(buildings)}`);
  }
  if (buildings["r4-block-up"]?.x !== 1 || buildings["r4-block-up"]?.y !== 1) throw new Error("up blocker");
  if (buildings["r4-block-right"]?.x !== 3 || buildings["r4-block-right"]?.y !== 2) throw new Error("right blocker");
  await assertNotMoving(page, "last-exit-boot");

  const playerBeforeMenu = boot.player;
  await openSpaces(page);
  const afterOpen = await readMirror(page);
  assertPlayer(afterOpen, playerBeforeMenu.x, playerBeforeMenu.y, "last-exit after open spaces");
  await assertNotMoving(page, "last-exit-before-place");
  const shedLabel = await page.getByTestId("life-ledger-space-building-place-shed").textContent();
  note("last-exit-place-label", { shedLabel, selected: await currentSelected(page), spaces: (await menuDebug(page)).spaces });
  if (!shedLabel?.includes("(0, 3)")) throw new Error(`expected last-exit target (0, 3) proving facing down, got ${shedLabel}`);
  if (afterOpen.gold !== 500 || inventoryCount(afterOpen, "item_potion") !== 8 || inventoryCount(afterOpen, "item_hoe") !== 1) {
    throw new Error("last-exit cost preconditions changed before action");
  }
  await capture(page, "last-exit-before-place");

  const refuseMsg = await activateByTestid(page, "life-ledger-space-building-place-shed");
  const afterRefuse = await readMirror(page);
  note("last-exit-refuse", {
    refuseMsg,
    gold: afterRefuse.gold,
    inventory: afterRefuse.inventory,
    player: afterRefuse.player,
    buildings: afterRefuse.farmBuildingPlacements,
  });
  if (!String(refuseMsg.text ?? "").includes("blocked")) {
    throw new Error(`last-exit did not refuse: ${JSON.stringify(refuseMsg)} buildings=${JSON.stringify(afterRefuse.farmBuildingPlacements)}`);
  }
  if (afterRefuse.gold !== 500) throw new Error(`last-exit spent gold ${afterRefuse.gold}`);
  if (inventoryCount(afterRefuse, "item_potion") !== 8) throw new Error("last-exit spent potions");
  if (inventoryCount(afterRefuse, "item_hoe") !== 1) throw new Error("last-exit changed hoe");
  assertPlayer(afterRefuse, 1, 2, "last-exit after refuse");
  const afterIds = Object.keys(afterRefuse.farmBuildingPlacements ?? {}).sort();
  if (afterIds.join(",") !== "r4-block-right,r4-block-up") {
    throw new Error(`last-exit owners changed ${JSON.stringify(afterRefuse.farmBuildingPlacements)}`);
  }
  const afterBuildings = afterRefuse.farmBuildingPlacements;
  if (JSON.stringify(afterBuildings["r4-block-up"]) !== JSON.stringify(buildings["r4-block-up"])) {
    throw new Error("up blocker mutated");
  }
  if (JSON.stringify(afterBuildings["r4-block-right"]) !== JSON.stringify(buildings["r4-block-right"])) {
    throw new Error("right blocker mutated");
  }
  await capture(page, "last-exit-after-refuse");

  const refusedSlot = await saveSlot(page, LAST_EXIT_NS, "raw-slot-last-exit.json");
  const slotBuildings = refusedSlot.owners.buildings ?? {};
  if (Object.keys(slotBuildings).sort().join(",") !== "r4-block-right,r4-block-up") {
    throw new Error(`last-exit slot owners ${JSON.stringify(slotBuildings)}`);
  }
  if (refusedSlot.owners.gold !== 500) throw new Error(`last-exit slot gold ${refusedSlot.owners.gold}`);
  if ((refusedSlot.owners.inventory?.item_potion ?? 0) !== 8) throw new Error("last-exit slot potions");
  if (Object.keys(refusedSlot.owners.decorations ?? {}).length !== 0) throw new Error("last-exit slot gained decorations");
  if (refusedSlot.owners.x !== 1 || refusedSlot.owners.y !== 2) {
    throw new Error(`last-exit slot foot ${refusedSlot.owners.x},${refusedSlot.owners.y}`);
  }

  evidence.sessions.lastExit = {
    refuseMsg,
    player: afterRefuse.player,
    gold: afterRefuse.gold,
    inventory: afterRefuse.inventory,
    buildings: afterRefuse.farmBuildingPlacements,
    slot: refusedSlot.owners,
  };
  await context.close();
  note("last-exit-ok", evidence.sessions.lastExit);
}

const scratch = process.env.TASK12_R4_SCRATCH;
if (!scratch) throw new Error("TASK12_R4_SCRATCH is required");
await mkdir(HERE, { recursive: true });

try {
  const server = await startPlayerQaServer({ logLevel: "error" });
  cleanup.push(() => server.close());
  note("server", { url: server.url, port: server.port, scratch });
  await runArena(server, scratch);
  await runLastExit(server, scratch);
  failed = false;
  note("ok", { scratch, arena: evidence.sessions.arena, lastExit: evidence.sessions.lastExit });
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
