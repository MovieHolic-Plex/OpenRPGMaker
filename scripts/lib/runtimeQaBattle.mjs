// 런타임 QA 전투 조작 op — 턴제 전투 DOM(명령 카드·스킬/아이템 목록·대상 고르기)을 계획대로 누른다.
//
//   { "kind": "battle",
//     "plan": { "actor_fs_elena": ["skill_mage_blizzard"], "actor_hero": ["attack", "skill_hero_cross_slash"] },
//     "fallback": "attack",          // 계획이 빈 배우의 명령(attack · defend · escape · skill:first · skill_<id> · item:<itemId> · capture:<itemId>)
//     "commands": 2,                 // 이만큼 명령을 내린 뒤, 연출이 끝나고 다음 명령 카드가 뜰 때까지 기다리고 돌아온다
//     "untilEnd": false,             // true 면 결과 창까지 누르고 닫는다
//     "target": 0 | "last" | "enemy-2",
//     "stopAfter": "skill",          // 기술 명령을 낸 뒤 연출이 시작되면 바로 돌아온다(연출 도중 스크린샷용)
//     "timeoutMs": 90000 }
// 배우별 큐는 앞에서부터 하나씩 쓰고, 마지막 하나는 계속 되풀이한다.
// 명령 뒤에 「@대상」을 붙이면 그 명령만 대상을 따로 고른다: "item:item_ether@1"(두 번째 아군), "skill_x@enemy-2", "attack@last".
// 고른 기술·아이템이 막혀 있으면(MP 부족·다 씀) 하위 목록을 닫고 fallback 명령으로 바꾼다.
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

/** 포켓몬 스킨(「싸운다」→ 기술 목록)에서 attack 은 쓸 수 있는 첫 기술이다. */
const FIRST_MOVE = "\u0000first-move";

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
      // 아군 대상 단추는 레트로 스킨에서 화면 밖(커서로 고름)이라 보이지 않아도 센다.
      targets: [...document.querySelectorAll('button[data-testid^="battle-target-"]')]
        .filter((n) => !n.disabled && n.dataset.testid !== "battle-target-cancel").map((n) => n.dataset.testid),
      active: document.querySelector(".battle-actor-status.is-active-actor")?.getAttribute("data-record-id") ?? null,
      resultConfirm: Boolean(document.querySelector('[data-testid="battle-result-confirm"]')),
      // 전투 중 이벤트 대사(발렌의 소환 외침 등)는 .dialogue-box 로 뜨고, 그동안 장면은 busy 다.
      dialogue: [...document.querySelectorAll('.dialogue-box, [data-testid="dialogue-box"]')].some((n) => n.offsetParent !== null),
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
  let pendingTarget;
  let forceFallback = false;
  let skillIssued = false;
  await page.waitForSelector('[data-testid="battle-scene"]', { timeout: op.sceneTimeoutMs ?? 60_000 });
  await installBattleLog(page);
  const nextFor = (actor) => {
    const queue = queues.get(actor ?? "") ?? [];
    if (queue.length === 0) return fallback;
    return queue.length > 1 ? queue.shift() : queue[0];
  };
  while (Date.now() < deadline) {
    const ui = await readBattleUi(page);
    // stopAfter:"skill" — 기술 명령을 낸 뒤 연출이 시작되면(busy) 바로 돌아온다(연출 도중 한 장을 찍을 때).
    if (op.stopAfter === "skill" && skillIssued && ui.busy) {
      await dumpLog(page, op, issued);
      return { issued, ended: false };
    }
    if (!ui.scene) {
      await dumpLog(page, op, issued);
      return { issued, ended: true };
    }
    if (ui.resultConfirm) {
      if (!op.untilEnd) {
        await dumpLog(page, op, issued);
        return { issued, ended: true };
      }
      // 결과 창(전리품·레벨 업)은 영상에서 읽히게 잠깐 둔다(op.resultHoldMs, 기본 2200ms).
      await sleep(op.resultHoldMs ?? 2200);
      await press(page, "battle-result-confirm") || await page.keyboard.press("Enter");
      await sleep(500);
      continue;
    }
    if (ui.dialogue && ui.menu.length === 0) {
      // 영상에서 읽히게 잠깐 둔 뒤 넘긴다(op.dialogueHoldMs, 기본 1600ms).
      await sleep(op.dialogueHoldMs ?? 1600);
      await page.keyboard.press("Enter");
      await sleep(400);
      continue;
    }
    if (ui.busy) { await sleep(120); continue; }
    if (ui.targetPrompt) {
      const targets = ui.targets;
      const want = pendingTarget ?? op.target;
      pendingTarget = undefined;
      const pick = typeof want === "number" ? targets[want] ?? targets[0]
        : want === "last" ? targets.at(-1)
          : typeof want === "string" ? targets.find((id) => id.endsWith(want)) ?? targets[0]
            : targets[0];
      await page.evaluate((row) => window.__qaBattleLog?.push(row), { t: -1, pick: pick ?? null, want: want ?? null, targets });
      if (pick) await press(page, pick);
      else await page.keyboard.press("Enter");
      await sleep(300);
      continue;
    }
    // 몬스터 파티의 리더가 쓰러지면 「다음은 누구를 내보낼까?」 교체 목록(actor-switch-*)만 뜬다 — 첫 후보를 내보낸다.
    // 이것 없이는 관측탑 보스전(2026-10-29 standin monster)이 교체 화면에서 5분을 기다리다 끝났다.
    const forcedSwitch = ui.menu.filter((id) => id.startsWith("actor-switch-"));
    if (forcedSwitch.length > 0 && !ui.menu.some((id) => id.startsWith("actor-command-") && id !== "actor-command-back")) {
      await press(page, forcedSwitch[0]);
      await sleep(300);
      continue;
    }
    const submenu = ui.menu.filter((id) => id.startsWith("actor-skill-") || id.startsWith("actor-item-") || id.startsWith("actor-capture-"));
    if (submenu.length > 0 && wanted === FIRST_MOVE) {
      // 포켓몬 스킨 「싸운다」: 기술 목록에서 쓸 수 있는 첫 기술(보이는 단추는 이미 disabled 를 걸러 냈다).
      const move = submenu.find((id) => id.startsWith("actor-skill-"));
      wanted = null;
      if (move) await press(page, move);
      else await page.keyboard.press("Escape");
      await sleep(300);
      continue;
    }
    if (submenu.length > 0 && wanted) {
      const id = wanted.startsWith("item:") ? `actor-item-${wanted.slice(5)}`
        : wanted.startsWith("capture:") ? `actor-capture-${wanted.slice(8)}`
          : `actor-skill-${wanted}`;
      if (!(await press(page, id))) {
        if (!submenu.includes(id) && !(await page.$(`[data-testid="${id}"]`))) throw new Error(`battle op: ${id} 를 고를 수 없다 (보이는 것: ${submenu.join(", ")})`);
        // 막힌 칸(MP 부족 등) — 목록을 닫고 다음 바퀴에서 fallback 으로 다시 고른다.
        await page.keyboard.press("Escape");
        wanted = null;
        forceFallback = true;
        issued -= 1;
        await sleep(300);
        continue;
      }
      wanted = null;
      await sleep(300);
      continue;
    }
    // 하위 목록이 열렸는데 고를 칸이 하나도 없다(MP 가 바닥이라 기술이 전부 막힘) — 닫고 fallback 으로.
    if (wanted && submenu.length === 0 && ui.menu.includes("actor-command-back") && !ui.menu.includes("actor-command-attack")) {
      await press(page, "actor-command-back") || await page.keyboard.press("Escape");
      wanted = null;
      forceFallback = true;
      issued -= 1;
      await sleep(300);
      continue;
    }
    const root = ui.menu.filter((id) => id.startsWith("actor-command-") && id !== "actor-command-back");
    if (root.length > 0) {
      if (issued >= maxCommands) {
        await dumpLog(page, op, issued);
        return { issued, ended: false };
      }
      const raw = forceFallback ? fallback : nextFor(ui.active);
      forceFallback = false;
      const at = raw.lastIndexOf("@");
      const choice = at > 0 ? raw.slice(0, at) : raw;
      if (at > 0) { const t = raw.slice(at + 1); pendingTarget = /^\d+$/.test(t) ? Number(t) : t; }
      let ok = false;
      if (choice === "attack" && !root.includes("actor-command-attack") && root.includes("actor-command-fight")) { wanted = FIRST_MOVE; ok = await press(page, "actor-command-fight"); }
      // 도주: 레트로 「도주」(escape) · 포켓몬 「도망간다」(run).
      else if (choice === "escape") ok = await press(page, root.includes("actor-command-run") ? "actor-command-run" : "actor-command-escape");
      // 기술 목록의 첫 기술(어떤 기술이 있는지 모르는 실물 게임용).
      else if (choice === "skill:first") { wanted = FIRST_MOVE; ok = await press(page, "actor-command-skill"); }
      // 포획 구슬: 포획 명령이 있으면 그쪽, 없으면(포켓몬 스킨) 가방.
      else if (choice.startsWith("capture:")) { wanted = choice; ok = await press(page, root.includes("actor-command-capture") ? "actor-command-capture" : "actor-command-item"); }
      else if (choice === "attack") ok = await press(page, "actor-command-attack");
      else if (choice === "defend") ok = await press(page, "actor-command-defend");
      else if (choice.startsWith("item:")) { wanted = choice; ok = await press(page, "actor-command-item"); }
      // 연계기는 「연계」 명령의 목록에 있다(combo:<skillId>). 연계 명령이 없으면(옛 화면) 기술 목록에서 찾는다.
      else if (choice.startsWith("combo:")) { wanted = choice.slice(6); ok = await press(page, root.includes("actor-command-combo") ? "actor-command-combo" : "actor-command-skill"); }
      else if (root.includes(`actor-command-skill-${choice}`)) ok = await press(page, `actor-command-skill-${choice}`);
      else { wanted = choice; ok = await press(page, "actor-command-skill"); }
      if (!ok) throw new Error(`battle op: ${ui.active} 의 명령 ${choice} 를 누를 수 없다 (보이는 것: ${root.join(", ")})`);
      if (!["attack", "defend", "escape"].includes(choice) && !choice.startsWith("item:") && !choice.startsWith("capture:")) skillIssued = true;
      issued += 1;
      await sleep(300);
      continue;
    }
    if (ui.dialogue) { await page.keyboard.press("Enter"); await sleep(300); continue; }
    await sleep(150);
  }
  throw new Error(`battle op: ${op.timeoutMs ?? 90_000}ms 안에 끝나지 않았다 (명령 ${issued}개)`);
}
