// 폴른 스타 전투 체감 프로브 — 출하 player.html 에서 전투 속도(ms)·무기 특성 타격·약점 표시를 잰다/찍는다.
//   node scripts/qa/runtime/fallen-battle-fixture.mjs <구운 play.json> <fixture.json>
//   node scripts/qa/runtime/fallen-combat-feel.probe.mjs <fixture.json> <out 폴더> [pace|weapon|weakness ...]
// 산출: <out>/<장면>.png, <out>/timing.json (명령 사이·적 행동·아군 행동 ms 중앙값과 원자료).
// 정본 프로젝트는 건드리지 않는다. 체크포인트로 숲 어귀에서 qa_fight_* 이벤트를 띄워 바로 전투에 들어간다.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";
import { startPlayerQaServer } from "../../lib/runtimeQaRun.mjs";

const [fixturePath, outArg, ...only] = process.argv.slice(2);
if (!fixturePath || !outArg) throw new Error("usage: fallen-combat-feel.probe.mjs <fixture.json> <out> [scenes]");
const out = resolve(outArg);
await mkdir(out, { recursive: true });
const body = await readFile(fixturePath, "utf8");
const VIEWPORT = { width: 1440, height: 900 };
const scenes = only.length ? only : ["pace", "weapon", "weakness"];

const browser = await chromium.launch({ args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu"] });
const server = await startPlayerQaServer();
const report = { fixture: fixturePath, viewport: VIEWPORT, scenes: {}, errors: [] };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function boot(checkpoint) {
  const page = await browser.newPage({ viewport: VIEWPORT });
  page.on("pageerror", (e) => report.errors.push(String(e?.message ?? e)));
  await page.route("**/__fs_feel/project.json", (r) => r.fulfill({ contentType: "application/json", body }));
  await page.addInitScript((cp) => {
    try { localStorage.clear(); } catch {}
    window.__OPENRPG_BOOT__ = { projectUrl: "/__fs_feel/project.json", saveNamespace: `fs-feel-${Math.random()}`, qaInstrumentation: true, qaCheckpoint: cp };
    // 시퀀스 busy 구간·숫자 팝업·명령 클릭 시각을 페이지 시계로 남긴다.
    window.__feel = { busy: [], popups: [], clicks: [], lines: [] };
    const t = () => Math.round(performance.now());
    let open = null;
    new MutationObserver((records) => {
      const scene = document.querySelector('[data-testid="battle-scene"]');
      const busy = scene?.dataset.battleSequenceBusy === "true";
      if (busy && !open) open = { start: t(), line: "" };
      if (!busy && open) { open.end = t(); window.__feel.busy.push(open); open = null; }
      const line = document.querySelector('[data-testid="battle-message-window"]')?.textContent?.trim().replace(/^>\s*/, "") ?? "";
      if (open && line && !open.line) open.line = line;
      if (line && window.__feel.lines.at(-1)?.text !== line) window.__feel.lines.push({ t: t(), text: line });
      for (const record of records) for (const node of record.addedNodes) {
        if (node instanceof HTMLElement && node.classList.contains("battle-damage-popup")) {
          window.__feel.popups.push({ t: t(), text: node.textContent, target: node.dataset.targetId ?? null, tags: node.querySelector(".battle-damage-popup-tag")?.dataset.tags ?? null });
        }
      }
    }).observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ["data-battle-sequence-busy"], characterData: true });
  }, checkpoint);
  await page.goto(`${server.url}/player.html`, { waitUntil: "domcontentloaded", timeout: 180_000 });
  try {
    await page.waitForSelector('[data-testid="battle-scene"]', { timeout: 300_000 });
  } catch (error) {
    await page.screenshot({ path: resolve(out, `boot-fail-${checkpoint.id}.png`) }).catch(() => {});
    report.bootFail = await page.evaluate(() => ({ ids: [...document.querySelectorAll("[data-testid]")].map((n) => n.dataset.testid).slice(0, 40), map: window.__oprnDebug?.readState?.().currentMapId ?? null })).catch(() => null);
    throw error;
  }
  return page;
}

const ui = (page) => page.evaluate(() => {
  const scene = document.querySelector('[data-testid="battle-scene"]');
  const visible = (n) => !n.disabled && n.offsetParent !== null;
  return {
    scene: Boolean(scene),
    busy: scene?.dataset.battleSequenceBusy === "true",
    root: [...document.querySelectorAll('button[data-testid^="actor-command-"]')].filter(visible).map((n) => n.dataset.testid),
    targets: [...document.querySelectorAll('button[data-testid^="battle-target-"]')].filter((n) => !n.disabled && n.dataset.testid !== "battle-target-cancel").map((n) => n.dataset.testid),
    active: document.querySelector(".battle-actor-status.is-active-actor")?.getAttribute("data-record-id") ?? null,
    result: Boolean(document.querySelector('[data-testid="battle-result-confirm"]')),
  };
});
const press = (page, id) => page.evaluate((testid) => {
  const n = document.querySelector(`[data-testid="${testid}"]`);
  if (!n || n.disabled) return false;
  window.__feel.clicks.push({ t: Math.round(performance.now()), id: testid });
  n.click();
  return true;
}, id);

/** 명령 카드가 뜰 때까지 기다린다(연출·적 행동이 끝날 때까지). */
async function waitReady(page, timeoutMs = 60_000) {
  const t0 = Date.now();
  for (;;) {
    const s = await ui(page);
    if (!s.scene || s.result) return s;
    if (!s.busy && s.root.length > 0) return s;
    if (Date.now() - t0 > timeoutMs) throw new Error("명령 카드가 안 뜬다");
    await sleep(60);
  }
}

/** 지금 차례 배우에게 attack(대상 index) 을 낸다. 대상 고르기 화면이 뜨면 onTarget 을 먼저 부른다. */
async function attack(page, targetIndex = 0, onTarget) {
  if (!(await press(page, "actor-command-attack"))) throw new Error("공격 단추가 없다");
  for (let i = 0; i < 40; i++) {
    const s = await ui(page);
    if (s.targets.length) {
      if (onTarget) await onTarget();
      await press(page, s.targets[Math.min(targetIndex, s.targets.length - 1)]);
      return;
    }
    await sleep(80);
  }
  throw new Error("대상 고르기가 안 뜬다");
}

const median = (xs) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : null; };

function checkpoint(id, troop, party, patch) {
  return {
    id, mapId: "fs_forest_edge", x: 14, y: 22, facing: "up",
    switches: { sw_fs_main_started: true, sw_fs_valen_marched: true },
    party, startEventId: `qa_fight_${troop}`, ...(patch ? { sessionPatch: patch } : {}),
  };
}
const duo = [{ actorId: "actor_hero", level: 6 }, { actorId: "actor_fs_elena", level: 6 }];

try {
  if (scenes.includes("pace")) {
    // 숲늑대 둘 + 이끼 슬라임. 둘 다 통상 공격만 — 명령 사이 시간과 적 행동 길이를 잰다. 첫 적 행동 도중 한 장.
    const page = await boot(checkpoint("pace", "wolves", duo));
    let shotTaken = false;
    const commandGaps = [];
    let lastReady = null;
    for (let n = 0; n < 8; n++) {
      const s = await waitReady(page);
      if (!s.scene || s.result) break;
      const now = await page.evaluate(() => Math.round(performance.now()));
      if (lastReady !== null) commandGaps.push(now - lastReady);
      await attack(page, 0);
      lastReady = await page.evaluate(() => Math.round(performance.now()));
      if (!shotTaken && n >= 1) {
        // 두 번째 명령 뒤 연출 한가운데(0.45초)를 찍는다.
        await page.waitForFunction(() => document.querySelector('[data-testid="battle-scene"]')?.dataset.battleSequenceBusy === "true", null, { timeout: 10_000 });
        await sleep(450);
        await page.screenshot({ path: resolve(out, "combat-midturn.png") });
        shotTaken = true;
      }
    }
    const feel = await page.evaluate(() => window.__feel);
    const spans = feel.busy.filter((b) => b.end).map((b) => ({ start: b.start, ms: b.end - b.start, line: b.line.slice(0, 40) }));
    // 행동 하나 = 「X의 공격!」·「X이/가 …을 사용했다!」 줄이 뜨고 다음 행동 줄 또는 다음 명령 질문 줄까지.
    const actorNames = ["카엘", "엘레나"];
    const starts = feel.lines.filter((l) => /^(.+?)(의 공격!|[이가] .+ 사용했다!)$/.test(l.text));
    const prompts = feel.lines.filter((l) => /무엇을 할까\?$/.test(l.text)).map((l) => l.t);
    const actions = [];
    starts.forEach((s, i) => {
      const end = Math.min(starts[i + 1]?.t ?? Infinity, prompts.find((t) => t > s.t) ?? Infinity);
      if (end === Infinity) return;
      const who = s.text.match(/^(.+?)(의 |이 |가 )/)?.[1] ?? "?";
      actions.push({ who, kind: actorNames.includes(who) ? "actor" : "enemy", ms: end - s.t });
    });
    report.scenes.pace = {
      enemyActionMsMedian: median(actions.filter((s) => s.kind === "enemy").map((s) => s.ms)),
      actorActionMsMedian: median(actions.filter((s) => s.kind === "actor").map((s) => s.ms)),
      introMs: spans[0]?.ms ?? null,
      commandToCommandMsMedian: median(commandGaps),
      commandGaps, actions, spans, lines: feel.lines,
    };
    await page.close();
  }

  if (scenes.includes("weapon")) {
    // 카엘이 창(푸른 불꽃 창)을 들고 엄니멧돼지 무리를 친다 — 무기 특성이 붙은 타격의 숫자·상태 팝업.
    const patch = { actorEquipment: { actor_hero: { weapon: "equip_fs_spear_pike", shield: "equip_oak_shield", armor: "equip_leather_armor", helmet: "equip_traveler_hat", accessory: "equip_focus_charm" } } };
    const page = await boot(checkpoint("weapon", "edge_boar", duo, patch));
    let shot = 0;
    for (let n = 0; n < 10 && shot < 2; n++) {
      const s = await waitReady(page);
      if (!s.scene || s.result) break;
      const before = await page.evaluate(() => window.__feel.popups.length);
      await attack(page, 0);
      if (s.active !== "actor_hero") continue;
      // 카엘의 첫 숫자 팝업이 뜨면 바로, 이어 상태 글자 팝업이 뜨면 한 장 더.
      const got = await page.waitForFunction((b) => window.__feel.popups.length > b, before, { timeout: 15_000 }).then(() => true, () => false);
      if (!got) continue;
      if (shot === 0) { await sleep(60); await page.screenshot({ path: resolve(out, "combat-weapon-hit.png") }); shot = 1; }
      const label = await page.waitForFunction((b) => window.__feel.popups.slice(b).some((p) => !/^\d/.test(p.text ?? "")), before, { timeout: 2500 }).then(() => true, () => false);
      if (label) { await sleep(60); await page.screenshot({ path: resolve(out, "combat-weapon-trait.png") }); shot = 2; }
    }
    report.scenes.weapon = await page.evaluate(() => ({ popups: window.__feel.popups, lines: window.__feel.lines.map((l) => l.text) }));
    await page.close();
  }

  if (scenes.includes("weakness")) {
    // 카엘의 검으로 숲늑대를 친다 → 「약점 발견!」 → 다음 차례 대상 고르기에서 약점 표시가 뜨는가.
    const page = await boot(checkpoint("weakness", "wolves", duo));
    let discovered = false;
    let targetShot = false;
    for (let n = 0; n < 10 && !targetShot; n++) {
      const s = await waitReady(page);
      if (!s.scene || s.result) break;
      if (s.active === "actor_hero" && discovered) {
        await attack(page, 0, async () => {
          await sleep(250);
          report.targetChips = await page.evaluate(() => [...document.querySelectorAll(".battle-weakness-reveal, .battle-weakness-row")].map((n) => n.textContent));
          await page.screenshot({ path: resolve(out, "combat-weakness-target.png") });
          targetShot = true;
        });
        break;
      }
      const before = await page.evaluate(() => window.__feel.popups.length);
      await attack(page, 0);
      if (s.active === "actor_hero") {
        const ok = await page.waitForFunction((b) => window.__feel.popups.slice(b).some((p) => (p.tags ?? "").includes("weak")), before, { timeout: 15_000 }).then(() => true, () => false);
        if (ok) { await sleep(60); await page.screenshot({ path: resolve(out, "combat-weakness-discovered.png") }); discovered = true; }
      }
    }
    report.scenes.weakness = await page.evaluate(() => ({
      chips: [...document.querySelectorAll(".battle-weakness-reveal, .battle-weakness-row")].map((n) => n.textContent),
      popups: window.__feel.popups,
    }));
    await page.close();
  }
} catch (error) {
  report.errors.push(String(error?.stack ?? error));
} finally {
  await writeFile(resolve(out, "timing.json"), JSON.stringify(report, null, 1));
  await browser.close();
  await server.close();
}
console.log(JSON.stringify({ out, pace: report.scenes.pace && { enemy: report.scenes.pace.enemyActionMsMedian, actor: report.scenes.pace.actorActionMsMedian, gap: report.scenes.pace.commandToCommandMsMedian }, errors: report.errors.length }));
