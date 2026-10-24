// 런타임 QA 전투 조작 op — 턴제 전투 DOM(명령 카드·스킬/아이템 목록·대상 고르기)을 계획대로 누른다.
//
//   { "kind": "battle",
//     "plan": { "actor_fs_elena": ["skill_mage_blizzard"], "actor_hero": ["attack", "skill_hero_cross_slash"] },
//     "fallback": "attack",          // 계획이 빈 배우의 명령(attack · defend · skill_<id> · item:<itemId>)
//     "commands": 2,                 // 이만큼 명령을 내린 뒤, 연출이 끝나고 다음 명령 카드가 뜰 때까지 기다리고 돌아온다
//     "untilEnd": false,             // true 면 결과 창까지 누르고 닫는다
//     "target": 0 | "last" | "enemy-2",
//     "timeoutMs": 90000 }
// 배우별 큐는 앞에서부터 하나씩 쓰고, 마지막 하나는 계속 되풀이한다.
// 버튼은 DOM click 으로 누른다(느린 상자에서 키 반복이 씹히는 것을 피한다 — fallen-battle-items.probe 와 같은 이유).

import { appendFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";

/** op.logPath(저장소 기준) 에 이 op 의 전투 기록 한 줄(JSON)을 덧붙인다. */
async function dumpLog(page, op, issued) {
  if (!op.logPath) return;
  const path = resolve(process.cwd(), op.logPath);
  await mkdir(dirname(path), { recursive: true });
  await appendFile(path, `${JSON.stringify({ label: op.label ?? null, issued, log: await readBattleLog(page) })}\n`);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function readBattleUi(page) {
  return page.evaluate(() => {
    const scene = document.querySelector('[data-testid="battle-scene"]');
    const buttons = [...document.querySelectorAll("button.battle-command")]
      .filter((n) => !n.disabled && n.dataset.previewOnly !== "true" && n.offsetParent !== null);
    return {
      scene: Boolean(scene),
      busy: scene?.dataset.battleSequenceBusy === "true",
      targetPrompt: Boolean(document.querySelector('[data-testid="battle-target-prompt"]')),
      menu: buttons.map((n) => n.dataset.testid ?? ""),
      active: document.querySelector(".battle-actor-status.is-active-actor")?.getAttribute("data-record-id") ?? null,
      resultConfirm: Boolean(document.querySelector('[data-testid="battle-result-confirm"]')),
      dialogue: Boolean(document.querySelector('[data-testid="dialogue-box"]')),
    };
  });
}

async function press(page, testid) {
  return page.evaluate((id) => {
    const button = document.querySelector(`[data-testid="${id}"]`);
    if (!button || button.disabled) return false;
    button.click();
    return true;
  }, testid);
}

/** 숫자 팝업·메시지 줄이 화면에 붙은 시각(ms)을 남긴다 — 광역기가 「동시에」 맞는지 숫자로 본다. */
async function installBattleLog(page) {
  await page.evaluate(() => {
    if (window.__qaBattleLog) return;
    const log = (window.__qaBattleLog = []);
    const t0 = performance.now();
    new MutationObserver((records) => {
      for (const record of records) for (const node of record.addedNodes) {
        if (!(node instanceof HTMLElement)) continue;
        if (node.classList.contains("battle-damage-popup")) {
          log.push({ t: Math.round(performance.now() - t0), popup: node.textContent, target: node.dataset.targetId, tag: node.dataset.effectiveness ?? null, critical: node.classList.contains("battle-damage-popup-critical") });
        }
      }
      const line = document.querySelector('[data-testid="battle-message-window"]')?.textContent?.trim();
      if (line && log.at(-1)?.line !== line && !log.some((row) => row.line === line && performance.now() - t0 - row.t < 400)) log.push({ t: Math.round(performance.now() - t0), line });
    }).observe(document.body, { subtree: true, childList: true, characterData: true });
  });
}

/** 지금까지 쌓인 전투 기록을 꺼낸다(QA 스크립트·영상 캡션용). */
export async function readBattleLog(page) {
  return page.evaluate(() => window.__qaBattleLog ?? []);
}

export async function battleQaOp(page, op) {
  const deadline = Date.now() + (op.timeoutMs ?? 90_000);
  const queues = new Map(Object.entries(op.plan ?? {}).map(([actor, value]) => [actor, Array.isArray(value) ? [...value] : [value]]));
  const fallback = op.fallback ?? "attack";
  const maxCommands = op.commands ?? Number.POSITIVE_INFINITY;
  let issued = 0;
  let wanted = null;
  await page.waitForSelector('[data-testid="battle-scene"]', { timeout: op.sceneTimeoutMs ?? 60_000 });
  await installBattleLog(page);
  const nextFor = (actor) => {
    const queue = queues.get(actor ?? "") ?? [];
    if (queue.length === 0) return fallback;
    return queue.length > 1 ? queue.shift() : queue[0];
  };
  while (Date.now() < deadline) {
    const ui = await readBattleUi(page);
    if (!ui.scene) {
      await dumpLog(page, op, issued);
      return { issued, ended: true };
    }
    if (ui.resultConfirm) {
      if (!op.untilEnd) {
        await dumpLog(page, op, issued);
        return { issued, ended: true };
      }
      await press(page, "battle-result-confirm") || await page.keyboard.press("Enter");
      await sleep(500);
      continue;
    }
    if (ui.busy) { await sleep(120); continue; }
    if (ui.targetPrompt) {
      const targets = ui.menu.filter((id) => id.startsWith("battle-target-") && id !== "battle-target-cancel");
      const pick = typeof op.target === "number" ? targets[op.target] ?? targets[0]
        : op.target === "last" ? targets.at(-1)
          : typeof op.target === "string" ? targets.find((id) => id.endsWith(op.target)) ?? targets[0]
            : targets[0];
      if (pick) await press(page, pick);
      else await page.keyboard.press("Enter");
      await sleep(300);
      continue;
    }
    const submenu = ui.menu.filter((id) => id.startsWith("actor-skill-") || id.startsWith("actor-item-"));
    if (submenu.length > 0 && wanted) {
      const id = wanted.startsWith("item:") ? `actor-item-${wanted.slice(5)}` : `actor-skill-${wanted}`;
      if (!(await press(page, id))) throw new Error(`battle op: ${id} 를 고를 수 없다 (보이는 것: ${submenu.join(", ")})`);
      wanted = null;
      await sleep(300);
      continue;
    }
    const root = ui.menu.filter((id) => id.startsWith("actor-command-"));
    if (root.length > 0) {
      if (issued >= maxCommands) {
        await dumpLog(page, op, issued);
        return { issued, ended: false };
      }
      const choice = nextFor(ui.active);
      let ok = false;
      if (choice === "attack") ok = await press(page, "actor-command-attack");
      else if (choice === "defend") ok = await press(page, "actor-command-defend");
      else if (choice.startsWith("item:")) { wanted = choice; ok = await press(page, "actor-command-item"); }
      else if (root.includes(`actor-command-skill-${choice}`)) ok = await press(page, `actor-command-skill-${choice}`);
      else { wanted = choice; ok = await press(page, "actor-command-skill"); }
      if (!ok) throw new Error(`battle op: ${ui.active} 의 명령 ${choice} 를 누를 수 없다 (보이는 것: ${root.join(", ")})`);
      issued += 1;
      await sleep(300);
      continue;
    }
    if (ui.dialogue) { await page.keyboard.press("Enter"); await sleep(300); continue; }
    await sleep(150);
  }
  throw new Error(`battle op: ${op.timeoutMs ?? 90_000}ms 안에 끝나지 않았다 (명령 ${issued}개)`);
}
