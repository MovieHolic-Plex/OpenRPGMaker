/**
 * 적대적 리뷰용 직접 플레이 세션 v2 — 하네스와 달리 "비트"를 고르지 않고
 * 전투 전체를 300ms 간격 연속 프레임으로 기록한다. 판정자는 사람이 프레임을 본다.
 *
 *   node scripts/adv-play2.mjs
 *
 * 산출: .omo/battle-runs/adv-play3-0802/
 *   bNN/fNNN.png + timeline.json (프레임별 state + 눌린 키 + 타임스탬프)
 *   messages.json (메시지 창 변화 타임스탬프 로그)
 */
import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const URL_ =
  "https://localhost:9999/?project=rpg-zzu-house-template-gallery"
  + "&name=Scarloxy+%EB%AA%AC%EC%8A%A4%ED%84%B0+%EC%B4%88%EC%9B%90+%EB%8D%B0%EB%AA%A8"
  + "&map=map_scarloxy_ruins";
const OUT = process.env.ADV_OUT || ".omo/battle-runs/adv-play4-0802";

const sleep = (n) => new Promise((r) => setTimeout(r, n));

const READ_STATE = () => {
  const scene = document.querySelector(".battle-scene");
  const q = (sel) => document.querySelector(sel);
  const rect = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
  };
  const panel = q(".battle-result-panel");
  const out = {
    hasScene: !!scene,
    phase: scene?.dataset.battlePhase ?? null,
    step: scene?.dataset.battleDirectorStep ?? null,
    busy: scene?.dataset.battleSequenceBusy ?? null,
    message: (q(".battle-message-window")?.textContent || "").replace(/\s+/g, " ").trim(),
    commands: Array.from(document.querySelectorAll("button.battle-command")).map((b) => ({
      label: (b.textContent || "").replace(/\s+/g, " ").trim(),
      disabled: b.disabled || b.getAttribute("aria-disabled") === "true",
      cursor: b.dataset.battleCommandCursor === "true",
      rect: rect(b),
    })),
    // 서브메뉴(기술/아이템) 항목 — 클래스명을 모르니 넓게 잡는다
    submenuItems: Array.from(document.querySelectorAll(
      ".battle-skill-item, .battle-submenu button, .battle-skill-list *, [class*='battle-skill']"
    )).slice(0, 20).map((e) => ({
      cls: e.className?.toString().slice(0, 60),
      text: (e.textContent || "").replace(/\s+/g, " ").trim().slice(0, 60),
      rect: rect(e),
    })),
    enemies: Array.from(document.querySelectorAll(".battle-enemy")).map((e) => ({
      id: e.dataset.battleTargetId,
      text: (e.textContent || "").replace(/\s+/g, " ").trim(),
      pose: e.dataset.battlePose,
      rect: rect(e),
    })),
    enemyPanel: rect(q(".battle-enemy-panel, .battle-enemy-list, [class*='enemy-panel']")),
    actors: Array.from(document.querySelectorAll(".battle-actor")).map((a) => ({
      name: (a.querySelector(".battle-actor-name")?.textContent || "").trim(),
      hp: (a.querySelector(".battle-actor-hp")?.textContent || "").replace(/\s+/g, " ").trim(),
      pose: a.dataset.battlePose,
      rect: rect(a),
    })),
    allySpriteRects: Array.from(document.querySelectorAll(".battle-actor-group .battle-actor, .battle-actor-sprite"))
      .map((e) => rect(e)),
    damagePopups: Array.from(document.querySelectorAll(".battle-damage-popup")).map((p) => ({
      text: p.textContent, targetId: p.dataset.targetId, rect: rect(p),
    })),
    animationChildren: q(".battle-animation-layer")?.childElementCount ?? -1,
    result: panel ? {
      revealStage: panel.dataset.resultRevealStage,
      hiddenRows: panel.querySelectorAll(".battle-result-reward-row[hidden]").length,
      text: (panel.textContent || "").replace(/\s+/g, " ").trim().slice(0, 200),
      rect: rect(panel),
    } : null,
    // 결과 모달(quickBattleModal 쪽) — 전투 씬이 내려간 뒤 백드롭에 남는 승리/후퇴 모달
    modal: (() => {
      const bd = q(".test-play-modal-backdrop");
      if (!bd || scene) return null;
      const t = (bd.textContent || "").replace(/\s+/g, " ").trim();
      if (!/승리|패배|후퇴|확인/.test(t)) return null;
      return { text: t.slice(0, 200) };
    })(),
    backdropOpen: !!q(".test-play-modal-backdrop"),
  };
  return out;
};

const INSTALL_LOG = () => {
  window.__msgLog = [];
  window.__t0 = performance.now();
  const push = () => {
    const el = document.querySelector(".battle-message-window");
    const t = el ? (el.textContent || "").replace(/\s+/g, " ").trim() : "(no-window)";
    const log = window.__msgLog;
    if (log.length === 0 || log[log.length - 1].t !== t) {
      log.push({ ms: Math.round(performance.now() - window.__t0), t });
    }
  };
  if (!window.__msgLogInstalled) {
    window.__msgLogInstalled = true;
    new MutationObserver(push).observe(document.body, { subtree: true, childList: true, characterData: true });
  }
  push();
};

async function playBattle(page, dir, opts) {
  await mkdir(dir, { recursive: true });
  await page.evaluate(INSTALL_LOG);
  const frames = [];
  const t0 = Date.now();
  let f = 0;
  let lastPress = 0;
  let pressed = [];
  let sceneGoneStreak = 0;

  const snap = async (note, key) => {
    const state = await page.evaluate(READ_STATE);
    const file = `f${String(f).padStart(3, "0")}.png`;
    try { await page.screenshot({ path: path.join(dir, file), timeout: 3000 }); } catch {}
    frames.push({ f, ms: Date.now() - t0, file, note, key, state });
    f += 1;
    return state;
  };

  // 인트로 연사 — 등장 연출 존재 여부
  for (let i = 0; i < 8; i++) { await snap("intro-burst"); await sleep(180); }

  // 특수 시나리오: 기술 서브메뉴 열람 (2D 내비게이션: 스킬은 공격의 오른쪽 칸)
  if (opts.openSkillMenu) {
    await page.keyboard.press("ArrowRight"); await sleep(250);
    await snap("cursor-right", "ArrowRight");
    await page.keyboard.press("Enter"); await sleep(500);
    await snap("skill-submenu-open", "Enter");
    await sleep(400); await snap("skill-submenu-settle");
    await page.keyboard.press("Escape"); await sleep(400);
    await page.keyboard.press("ArrowLeft"); await sleep(250);
    await snap("skill-submenu-closed", "Escape+Left");
  }

  // 메인 루프: busy 아닐 때만 Enter (플레이어처럼). 결과가 뜨면 입력 중단하고 관찰.
  const deadline = t0 + (opts.maxMs ?? 60000);
  let resultSeenAt = null;
  while (Date.now() < deadline) {
    const s = await snap("loop");
    if (!s.hasScene) {
      sceneGoneStreak += 1;
      if (sceneGoneStreak >= 3) break; // 씬 언마운트 확정
    } else sceneGoneStreak = 0;

    if (s.result || s.modal) {
      if (!resultSeenAt) resultSeenAt = Date.now();
      // 입력 없이 6초 관찰 → 자동 닫힘 검증
      if (Date.now() - resultSeenAt > 6000) break;
    } else if (opts.escape && s.commands.length > 0 && s.busy !== "true"
      && !pressed.some((p) => String(p).startsWith("escape-seq")) && Date.now() - lastPress > 700) {
      // 도주: 공격 → (아래×2) 도주 → 확정 (2D 내비게이션 기준, 한 번만 시도).
      // 실패하면 아래 Enter 연사 분기로 넘어가 전투를 끝까지 치른다 — 이전 판에서는
      // 실패 후 아무 키도 안 누른 채 데드라인까지 정지해 전투 모달이 열린 채 남았다.
      for (let i = 0; i < 2; i++) { await page.keyboard.press("ArrowDown"); await sleep(200); }
      await snap("cursor-on-escape");
      await page.keyboard.press("Enter");
      lastPress = Date.now();
      pressed.push("escape-seq");
    } else if (s.hasScene && s.busy !== "true" && Date.now() - lastPress > 700) {
      await page.keyboard.press("Enter");
      lastPress = Date.now();
      pressed.push(`Enter@${Date.now() - t0}`);
    }
    await sleep(300);
  }
  // 종료 후 잔상 확인 프레임
  for (let i = 0; i < 4; i++) { await snap("aftermath"); await sleep(500); }

  const messages = await page.evaluate(() => window.__msgLog || []);
  await writeFile(path.join(dir, "timeline.json"), JSON.stringify({ pressed, frames }, null, 2), "utf8");
  await writeFile(path.join(dir, "messages.json"), JSON.stringify(messages, null, 2), "utf8");
  return { frames: frames.length, pressed, lastMessages: messages.slice(-8) };
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${String(e).slice(0, 300)}`));
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    const t = m.text();
    if (t.includes("ERR_CONNECTION_REFUSED")) return;
    errors.push(t.slice(0, 300));
  });

  await page.goto(URL_, { waitUntil: "domcontentloaded", timeout: 90000 });
  await sleep(9000);

  const scenarios = [
    { name: "b1-attack", opts: { openSkillMenu: true } },
    { name: "b2-attack", opts: {} },
    { name: "b3-escape", opts: { escape: true, maxMs: 30000 } },
    { name: "b4-attack", opts: {} },
  ];
  const summary = [];
  for (const sc of scenarios) {
    await page.locator("[aria-label='랜덤 전투 테스트']").first().click({ timeout: 30000 });
    try { await page.waitForSelector(".battle-scene", { timeout: 30000 }); } catch {}
    const r = await playBattle(page, path.join(OUT, sc.name), sc.opts);
    summary.push({ name: sc.name, ...r });
    console.log(`${sc.name}: frames=${r.frames}`);
    // 남은 모달/백드롭 정리 — 결과 확인 버튼 클릭 → Enter/Escape → 헤더 X 버튼 순서로 시도
    for (let i = 0; i < 8; i++) {
      const open = await page.evaluate(() => !!document.querySelector(".test-play-modal-backdrop"));
      if (!open) break;
      const confirm = page.locator(".battle-result-confirm");
      if (await confirm.count() > 0) { await confirm.first().click({ timeout: 2000 }).catch(() => {}); }
      else if (i < 4) { await page.keyboard.press(i % 2 === 0 ? "Enter" : "Escape").catch(() => {}); }
      else {
        // 마지막 수단: 모달 헤더의 닫기(X) 버튼
        await page.locator(".test-play-modal-backdrop button").filter({ hasText: /^[xX✕]$/ }).first()
          .click({ timeout: 2000 }).catch(() => {});
      }
      await sleep(900);
    }
    await sleep(1200);
  }

  await writeFile(path.join(OUT, "manifest.json"),
    JSON.stringify({ url: URL_, summary, errors: [...new Set(errors)] }, null, 2), "utf8");
  console.log("errors:", [...new Set(errors)]);
  await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
