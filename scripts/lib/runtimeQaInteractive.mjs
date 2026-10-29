// 대화형 플레이 — 출하 플레이어를 한 번 띄워 둔 채, 바깥(사람·다른 에이전트)이 한 걸음씩 조작하고 화면을 본다.
//
// 체크포인트 비트에 { kind: "interactive", dir? } op 을 두면(dir 생략 = QA_INTERACTIVE_DIR) 러너가 그 폴더를 지켜본다:
//   <dir>/cmd-<n>.json  ← 바깥이 쓴다: { ops: [...], quit?: true }
//   <dir>/shot-<n>.png, <dir>/res-<n>.json  ← 러너가 쓴다: 실행 결과·화면·상태(맵·좌표·대화·선택지·전투·HP)
// 한 판을 다시 부팅하지 않고 이어서 하므로(부팅 수 분) 처음부터 끝까지 사람처럼 플레이해 보는 독립 판정에 쓴다.
// 순간이동·스위치 조작처럼 「플레이어가 할 수 없는 것」은 받지 않는다 — 판정이 실제 플레이만 보게.
// 바깥 쪽 도구: scripts/qa/play-step.mjs
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { pauseRuntimeFrames, resumeRuntimeFrames } from "./runtimeQaFrames.mjs";

/** 실제 플레이어가 할 수 있는 조작만. battle = 「공격」을 골라 끝까지(자동 전투 단축). */
const PLAYER_OPS = new Set(["key", "hold", "move", "face", "action", "dir", "waitFor", "waitForVisible", "waitForText", "waitForMap", "repeatUntil", "pressUntil", "battle", "attack", "skill"]);

function checkOps(ops) {
  for (const op of ops ?? []) {
    if (!op || typeof op !== "object" || !PLAYER_OPS.has(op.kind)) throw new Error(`대화형 플레이에서 받지 않는 op: ${JSON.stringify(op)} — 받는 것: ${[...PLAYER_OPS].join(", ")}`);
    if (op.kind === "repeatUntil") checkOps(op.ops);
  }
}

async function readState(page) {
  return page.evaluate(() => {
    const text = (id) => document.querySelector(`[data-testid="${id}"]`)?.innerText?.trim() || null;
    let runtime = null;
    try { runtime = window.__oprnDebug?.readState?.() ?? null; } catch { /* 장면 전환 중 */ }
    const party = Array.isArray(runtime?.partyActorIds) ? runtime.partyActorIds : null;
    return {
      mapId: runtime?.currentMapId ?? null, x: runtime?.x ?? null, y: runtime?.y ?? null, gold: runtime?.gold ?? null,
      dialogue: text("dialogue-box"), choices: text("dialogue-choice-frame"),
      battle: Boolean(document.querySelector('[data-testid="battle-scene"]')), battleText: text("battle-scene")?.slice(0, 600) ?? null,
      menu: Boolean(document.querySelector('[data-testid="main-menu"]')), title: Boolean(document.querySelector('[data-testid="title-screen"]')),
      gameOver: Boolean(document.querySelector('[data-testid="game-over"]')),
      party,
    };
  });
}

/**
 * 명령 사이에는 게임 시간을 멈춘다(QA_INTERACTIVE_PAUSE=0 이면 끈다). 판정 모델은 한 걸음에 10~30초를 생각하는데
 * 그동안 순찰이 계속 돌면, 화면을 보고 내린 판단이 이미 낡은 판이 된다 — 사람은 실시간으로 반응한다.
 * (2026-10-27 폴른 막사: 멈춤 없이 DeepSeek 판정이 순찰에 열 번 넘게 붙잡혔다.) 조작을 실행하는 동안에는 실시간이다.
 */
const PAUSE_BETWEEN = process.env.QA_INTERACTIVE_PAUSE !== "0";
async function freeze(page, on) {
  if (!PAUSE_BETWEEN) return;
  try { await (on ? pauseRuntimeFrames(page) : resumeRuntimeFrames(page)); } catch { /* 장면 전환 중·이미 그 상태 */ }
}

export async function interactiveQaOp(page, op, runState, applyOp) {
  const dir = op.dir ?? process.env.QA_INTERACTIVE_DIR;
  if (!dir) throw new Error("interactive op 에 dir 도 QA_INTERACTIVE_DIR 도 없다");
  const idleMs = Number(op.idleMs ?? process.env.QA_INTERACTIVE_IDLE_MS ?? 30 * 60_000);
  await mkdir(dir, { recursive: true });
  const ready = await readState(page);
  await page.screenshot({ path: join(dir, "shot-0.png") });
  await writeFile(join(dir, "res-0.json"), JSON.stringify({ n: 0, ready: true, state: ready, shot: join(dir, "shot-0.png") }, null, 1));
  await freeze(page, true);
  for (let n = 1; ; n += 1) {
    const cmdPath = join(dir, `cmd-${n}.json`);
    const deadline = Date.now() + idleMs;
    while (!existsSync(cmdPath)) {
      if (Date.now() > deadline) return; // 바깥이 떠났다 — 비트를 끝낸다
      await new Promise((r) => setTimeout(r, 300));
    }
    let cmd;
    try { cmd = JSON.parse(await readFile(cmdPath, "utf8")); } catch (error) { cmd = { ops: [], parseError: String(error) }; }
    const errors = [];
    if (cmd.parseError) errors.push(cmd.parseError);
    await freeze(page, false);
    if (!cmd.quit) {
      try { checkOps(cmd.ops); } catch (error) { errors.push(String(error?.message ?? error)); cmd.ops = []; }
      for (const step of cmd.ops ?? []) {
        try { await applyOp(page, step, runState); } catch (error) { errors.push(`${step.kind}: ${String(error?.message ?? error).slice(0, 300)}`); break; }
      }
    }
    const shot = join(dir, `shot-${n}.png`);
    await page.screenshot({ path: shot }).catch(() => {});
    const state = await readState(page).catch((error) => ({ error: String(error) }));
    const tmp = join(dir, `.res-${n}.tmp`);
    await writeFile(tmp, JSON.stringify({ n, errors, state, shot }, null, 1));
    if (cmd.quit) { await rename(tmp, join(dir, `res-${n}.json`)); return; }
    await freeze(page, true);
    await rename(tmp, join(dir, `res-${n}.json`));
  }
}
