// 비전머신(HM) 필드 기술 end-to-end 런타임 QA — 출하 플레이어(player.html, export shim)로
// 새 게임 → 스타터 → 비전서 상자 → 가방에서 몬스터에게 가르치기 → 장애물(바위: 배지 게이트·메뉴 사용 / 덩굴: 조사 「쓸까?」) →
// 길 열림 → 저장 → 새로고침·불러오기 → 열린 길 유지 를 실제 입력으로 간다.
//
//   bun scripts/qa/runtime/monster-hm-fixture.mts /tmp/hm.json
//   unshare -rn sh -c "ip link set lo up && node scripts/qa/runtime/monster-hm.mjs /tmp/hm.json [outDir]"
//
// 디버그 쓰기(SUMMARY 에 적는다): 맵 사이 이동(teleport), 체육관을 건너뛰는 배지 스위치 mx_badge_1.
import { chromium } from "@playwright/test";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { startPlayerQaServer } from "../../lib/runtimeQaRun.mjs";

const [projectArg, outArg] = process.argv.slice(2);
if (!projectArg) throw new Error("usage: monster-hm.mjs <project.json> [outDir]");
const projectJson = await readFile(resolve(projectArg), "utf8");
const project = JSON.parse(projectJson);
const out = resolve(outArg ?? "verify-shots/runtime-qa/monster-hm");
await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });

const report = { project: projectArg, steps: [], errors: [], debugWrites: [] };
const server = await startPlayerQaServer();
const browser = await chromium.launch({ args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu"] });
const context = await browser.newContext({ viewport: { width: 960, height: 720 } });
const page = await context.newPage();
page.on("pageerror", (error) => report.errors.push(String(error?.message ?? error)));
page.on("console", (message) => { if (message.type() === "error") report.errors.push(`console: ${message.text()}`); });
const NAMESPACE = "runtime-qa:monster-hm";
let clearStorage = true;
await page.addInitScript(([ns]) => {
  if (sessionStorage.getItem("__hmQaBooted") !== "1") { try { localStorage.clear(); } catch { /* ignore */ } sessionStorage.setItem("__hmQaBooted", "1"); }
  window.__OPENRPG_BOOT__ = { projectUrl: "/__runtime-qa/project.json", saveNamespace: ns, qaInstrumentation: true };
}, [NAMESPACE]);
await page.route("**/__runtime-qa/project.json", (route) => route.fulfill({ status: 200, contentType: "application/json", body: projectJson }));

const state = () => page.evaluate(() => window.__oprnDebug.readState());
const live = () => page.evaluate(() => {
  const s = window.__oprnHooksScene.session;
  return { map: s.currentMapId, x: s.x, y: s.y, party: (s.monsterParty ?? []).map((id) => ({ id, ...s.monsterInstances[id] })), switches: s.switches, inventory: s.inventory, overrides: Object.keys(s.mapOverrides ?? {}).length };
});
const step = (id, ok, detail, image) => { report.steps.push({ id, ok, detail, image }); console.log(ok ? "✓" : "✗", id, detail); };
// 공유 머신이 바쁠 때 스크린샷이 30초를 넘길 수 있다 — 길게 기다리고 한 번 다시 시도한다.
const shot = async (name) => {
  for (let attempt = 0; attempt < 2; attempt++) {
    try { await page.screenshot({ path: join(out, `${name}.png`), timeout: 120000 }); break; } catch (error) { if (attempt) throw error; }
  }
  return `${name}.png`;
};
const present = (testid) => page.locator(`[data-testid="${testid}"]`).count().then((n) => n > 0);
const testids = () => page.evaluate(() => [...document.querySelectorAll("[data-testid]")].filter((n) => n.getClientRects().length).map((n) => n.dataset.testid));
const settled = async (done) => { for (let k = 0; k < 4; k++) { if (!(await done())) return false; await page.waitForTimeout(250); } return true; };
const pressEnterUntil = async (done, max = 40) => { for (let i = 0; i < max; i++) { if (await settled(done)) return true; await page.keyboard.press("Enter"); await page.waitForTimeout(250); } return settled(done); };
const teleport = async (mapId, x, y) => {
  report.debugWrites.push(`teleport ${mapId} (${x},${y})`);
  await page.evaluate(([m, tx, ty]) => window.__oprnDebug.teleport(m, tx, ty), [mapId, x, y]);
  await page.waitForFunction(([m, tx, ty]) => { const s = window.__oprnDebug.readLive(); return s.currentMapId === m && s.x === tx && s.y === ty; }, [mapId, x, y], { timeout: 15000 });
  await page.waitForTimeout(600);
};
const face = (dir) => page.evaluate((d) => window.__oprnInput.face(d), dir);
const talk = async (dir) => {
  for (let attempt = 0; attempt < 6; attempt++) {
    await face(dir); await page.evaluate(() => window.__oprnInput.action());
    await page.waitForTimeout(700);
    if (await present("dialogue-box") || await present("battle-scene")) return true;
  }
  return false;
};
const eventOf = (mapId, eventId) => project.maps[mapId].events.find((event) => event.id === eventId);
/** 한 칸 걷기(방향 입력을 짧게 눌렀다 뗀다) — 끝날 때까지 기다린다. */
const stepDir = async (dir) => {
  await page.evaluate((d) => window.__oprnInput.dir(d), dir);
  await page.waitForTimeout(90);
  await page.evaluate(() => window.__oprnInput.dir(null));
  for (let t = 0, last = ""; t < 10; t++) {
    await page.waitForTimeout(120);
    const now = await page.evaluate(() => window.__oprnDebug.readLive());
    const key = `${now.currentMapId}:${now.x},${now.y}`;
    if (key === last) break;
    last = key;
  }
};
/** 대사창 본문을 끝까지 읽는다 — 타자기가 끝나 완료 표지(■; 타이핑 중에는 ▼)가 붙을 때까지 기다린다. 키를 누르지 않는다(눌러 닫히면 다음 선택지를 건너뛴다). */
const readDialogue = async () => {
  await page.waitForSelector('[data-testid="dialogue-box"]', { timeout: 20000 });
  let text = "";
  for (let i = 0; i < 80; i++) {
    text = (await page.locator('[data-testid="dialogue-box"]').innerText().catch(() => "")).replace(/\s+/g, " ").trim();
    if (/■$/.test(text)) break;
    await page.waitForTimeout(150);
  }
  return text;
};
const hereNow = () => page.evaluate(() => window.__oprnDebug.readLive());
const openMenu = async () => { await page.keyboard.press("Escape"); await page.waitForSelector('[data-testid="main-menu"]', { timeout: 8000 }); await page.waitForTimeout(300); };
const closeMenu = async () => { for (let i = 0; i < 6 && await present("main-menu"); i++) { await page.keyboard.press("Escape"); await page.waitForTimeout(250); } };
const selectCommand = async (id) => {
  for (let i = 0; i < 24; i++) {
    const cls = await page.locator(`[data-testid="status-menu-command-${id}"]`).getAttribute("class").catch(() => null);
    if (cls === null) throw new Error(`메뉴 명령 ${id} 가 없다 — 보이는 testid: ${(await testids()).filter((t) => t.startsWith("status-menu-command-")).join(", ")}`);
    if (cls.includes("selected")) break;
    await page.keyboard.press("ArrowDown"); await page.waitForTimeout(80);
  }
  await page.keyboard.press("Enter"); await page.waitForTimeout(400);
};


try {
  await page.goto(`${server.url}/player.html`, { waitUntil: "domcontentloaded", timeout: 180000 });
  await page.waitForSelector("[data-testid='title-screen']", { timeout: 120000 });
  await page.waitForTimeout(1500);
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => window.__oprnDebug?.readState?.()?.currentMapId, undefined, { timeout: 120000 });
  await pressEnterUntil(async () => !(await present("cinematic-sequence")) && !(await present("dialogue-box")) && !(await present("title-screen")), 80);

  // 스타터 — 연구소 교수에게(디버그: 연구소로 순간이동).
  const lab = Object.values(project.maps).find((map) => map.events.some((event) => /professor/.test(event.id)));
  const professor = lab.events.find((event) => /professor/.test(event.id));
  await teleport(lab.id, professor.x, professor.y + 1);
  await talk("up");
  await pressEnterUntil(async () => (await live()).party.length > 0 && !(await present("dialogue-box")), 80);
  const afterStarter = await live();
  step("starter", afterStarter.party.length === 1, afterStarter.party.map((m) => `${m.speciesId} Lv${m.level} 기술 ${m.skillIds?.length ?? "?"}`).join(", "), await shot("01-starter-field"));

  // 비전서 상자 둘 — 1번길 남쪽.
  const chestOf = (id) => eventOf("mx_map_meadow", id);
  for (const [n, id] of [["02", "ev_hm_tree_1_giver"], ["03", "ev_hm_rock_1_giver"]]) {
    const chest = chestOf(id);
    await teleport("mx_map_meadow", chest.x, chest.y + 1);
    await talk("up");
    await shot(`${n}-chest-${id}`);
    await pressEnterUntil(async () => !(await present("dialogue-box")), 40);
  }
  const bag = (await live()).inventory;
  step("chests", (bag.item_hm_cut ?? 0) >= 1 && (bag.item_hm_shove ?? 0) >= 1, `item_hm_cut=${bag.item_hm_cut} item_hm_shove=${bag.item_hm_shove}`, await shot("04-after-chests"));

  // 가방 — 비전서.
  await openMenu();
  await shot("05-menu-open");
  report.menuCommands = (await testids()).filter((t) => t.startsWith("status-menu-command-"));
  console.log("menu commands", report.menuCommands.join(" "));
  await selectCommand("items");
  await page.waitForSelector('[data-testid="status-menu-item-item_hm_cut"]', { timeout: 8000 });
  await shot("06-bag-list");
  console.log("bag testids", (await testids()).filter((t) => /item|monster|target/.test(t)).join(" "));
  // 비전서 「덩굴 가르기」 선택 → 사용 → 대상 몬스터(스타터) → 가르치기.
  const moveCursorTo = async (testid) => {
    for (let i = 0; i < 20; i++) {
      const cls = await page.locator(`[data-testid="${testid}"]`).getAttribute("class").catch(() => "");
      if ((cls ?? "").includes("selected")) return true;
      await page.keyboard.press("ArrowDown"); await page.waitForTimeout(80);
    }
    return false;
  };
  await moveCursorTo("status-menu-item-item_hm_cut");
  await page.keyboard.press("Enter"); await page.waitForTimeout(500);
  await shot("07-hm-use");
  await page.keyboard.press("Enter"); await page.waitForTimeout(500);
  await shot("08-hm-target");
  console.log("target testids", (await testids()).filter((t) => /monster|target|confirm|forget/.test(t)).join(" "));
  await page.keyboard.press("Enter"); await page.waitForTimeout(700);
  await shot("09-hm-taught");
  const taught = await live();
  const lead = taught.party[0];
  step("teach-hm", (lead.skillIds ?? []).includes("skill_field_cut") && (taught.inventory.item_hm_cut ?? 0) >= 1, `기술 ${JSON.stringify(lead.skillIds)} · 비전서 보유 ${taught.inventory.item_hm_cut}(사라지지 않는 HM)`, "09-hm-taught.png");
  await closeMenu();
  await page.waitForTimeout(300);

  // ── 바위 게이트(13,20): 배지 1 이 있어야 말을 듣는다. 걸어서 간다(디버그 없음).
  const wild = async () => { // 우연히 야생이 나오면 도망간다 — 게이트 검증과 무관한 방해.
    if (!(await present("battle-scene"))) return false;
    await page.waitForFunction(() => document.querySelector('[data-testid="battle-scene"]')?.dataset.battleDirectorStep === "command", undefined, { timeout: 30000 }).catch(() => {});
    await page.locator('[data-testid="actor-command-run"]').focus().catch(() => {}); await page.keyboard.press("Enter");
    await pressEnterUntil(async () => !(await present("battle-scene")), 30);
    return true;
  };
  const walkPath = async (dirs) => { for (const d of dirs) { await stepDir(d); await wild(); } };
  /** 목표 칸까지 위치를 읽으며 걷는다(가로 먼저) — 야생이 끼어들거나 한 칸 밀려도 다시 맞춘다. */
  const walkTo = async (tx, ty, max = 30) => {
    for (let n = 0; n < max; n++) {
      const here = await hereNow();
      if (here.x === tx && here.y === ty) return true;
      const d = here.x !== tx ? (tx < here.x ? "left" : "right") : (ty < here.y ? "up" : "down"); // 가로 먼저 — 길 중간의 턱은 길 틈에서만 오른다
      await stepDir(d); await wild();
    }
    return false;
  };
  await teleport("mx_map_meadow", 13, 23);
  await walkTo(13, 21);
  let at = await hereNow();
  step("walk-to-rock", at.x === 13 && at.y === 21, `(${at.x},${at.y})`, await shot("10-before-rock"));

  // 1) 아직 바위 밀치기를 모른다 → 막힘 안내.
  await talk("up");
  const unknownText = await readDialogue();
  await shot("11-rock-blocked-unknown");
  await pressEnterUntil(async () => !(await present("dialogue-box")), 40);
  step("rock-unknown", /막고 있다|막고/.test(unknownText), unknownText.replace(/\s+/g, " ").slice(0, 80), "11-rock-blocked-unknown.png");

  // 2) 가방에서 비전서 「바위 밀치기」를 가르친다.
  const teach = async (itemId, shotName) => {
    await openMenu(); await selectCommand("items");
    await page.waitForSelector(`[data-testid="status-menu-item-${itemId}"]`, { timeout: 8000 });
    await moveCursorTo(`status-menu-item-${itemId}`);
    await page.keyboard.press("Enter"); await page.waitForTimeout(400);
    await page.keyboard.press("Enter"); await page.waitForTimeout(400);
    await page.keyboard.press("Enter"); await page.waitForTimeout(700);
    await shot(shotName);
    await closeMenu(); await page.waitForTimeout(300);
  };
  await teach("item_hm_shove", "12-taught-shove");
  const afterShove = await live();
  step("teach-shove", (afterShove.party[0].skillIds ?? []).includes("skill_field_shove"), JSON.stringify(afterShove.party[0].skillIds), "12-taught-shove.png");

  // 3) 기술은 알지만 배지가 없다 → 조사 안내.
  await talk("up");
  const lackingText = await readDialogue();
  await shot("13-rock-lacking-badge-talk");
  await pressEnterUntil(async () => !(await present("dialogue-box")), 40);
  step("rock-badge-talk", /배지/.test(lackingText), lackingText.replace(/\s+/g, " ").slice(0, 100), "13-rock-lacking-badge-talk.png");

  // 4) 메뉴(동료 → 새싹토 → 필드에서 사용)로 써도 배지가 없으면 열리지 않는다.
  const useFromMenu = async (skillId, name) => {
    await face("up");
    await openMenu(); await selectCommand("monsters");
    await page.waitForSelector('[data-testid^="status-menu-monster-monster_"]', { timeout: 8000 });
    await page.keyboard.press("Enter"); await page.waitForTimeout(500);
    await shot(`${name}-party-detail`);
    const skill = `[data-testid^="status-menu-monster-known-skill-"][data-testid$="-${skillId}"]`;
    await page.waitForSelector(skill, { timeout: 8000 });
    for (let i = 0; i < 12; i++) {
      const cls = await page.locator(skill).first().getAttribute("class");
      if ((cls ?? "").includes("selected")) break;
      await page.keyboard.press("ArrowDown"); await page.waitForTimeout(80);
    }
    await shot(`${name}-skill-list`);
    await page.keyboard.press("Enter"); await page.waitForTimeout(700);
  };
  await useFromMenu("skill_field_shove", "14-rock-menu-nobadge");
  const menuLacking = await readDialogue();
  await shot("15-rock-menu-nobadge-result");
  await pressEnterUntil(async () => !(await present("dialogue-box")), 40);
  const stillBlocked = !(await live()).switches.sw_ev_hm_rock_1_open;
  step("rock-menu-no-badge", /배지/.test(menuLacking) && stillBlocked, `${menuLacking.replace(/\s+/g, " ").slice(0, 100)} · 열림 스위치 ${!stillBlocked}`, "15-rock-menu-nobadge-result.png");

  // 5) 배지 1 을 얻은 뒤(디버그: 체육관 건너뜀) 메뉴로 쓰면 바위가 열리고 길이 이어진다.
  report.debugWrites.push("setSwitch mx_badge_1 (체육관 승리 대신)");
  await page.evaluate(() => window.__oprnDebug.setSwitch("mx_badge_1", true));
  await useFromMenu("skill_field_shove", "16-rock-menu-badge");
  await readDialogue();
  await shot("17-rock-menu-badge-text");
  await pressEnterUntil(async () => !(await present("dialogue-box")), 40);
  await page.waitForTimeout(900);
  await shot("18-rock-opened");
  await walkTo(13, 19);
  at = await hereNow();
  step("rock-opened-walk", at.y <= 19, `바위 자리(13,20)를 지나 (${at.x},${at.y})`, await shot("19-rock-passed"));

  // ── 덩굴 게이트(15,16): 조사 → 「쓸까?」 선택.
  await walkTo(15, 17);
  at = await hereNow();
  step("walk-to-tree", at.x === 15 && at.y === 17, `(${at.x},${at.y})`, await shot("20-before-tree"));
  await talk("up");
  const treeText = await readDialogue();
  await shot("21-tree-know-text");
  await page.keyboard.press("Enter"); // 문장 닫기 → 선택지
  await page.waitForSelector('[data-testid="runtime-choices"]', { timeout: 20000 });
  await page.waitForTimeout(300);
  const choiceLabels = await page.locator('[data-testid^="runtime-choice-"]').allInnerTexts();
  await shot("22-tree-ask-use");
  step("tree-ask", /덩굴 가르기/.test(treeText) && choiceLabels.length === 2, `${treeText} · 선택지 ${JSON.stringify(choiceLabels)}`, "22-tree-ask-use.png");
  // 「그만둔다」 를 먼저 골라 아무 일도 안 일어남을 본다 → 다시 조사해 「쓴다」.
  await page.keyboard.press("ArrowDown"); await page.waitForTimeout(250); await shot("22b-tree-ask-second"); await page.keyboard.press("Enter");
  // 결정 키를 더 누르면 바라보는 장애물을 다시 조사한다 — 키 대신 창이 닫히길 기다린다.
  await page.waitForFunction(() => !document.querySelector('[data-testid="runtime-choices"]') && !document.querySelector('[data-testid="dialogue-box"]'), undefined, { timeout: 10000 });
  await page.waitForTimeout(700);
  const stillClosed = !(await live()).switches.sw_ev_hm_tree_1_open;
  step("tree-decline", stillClosed, `그만둔다 → 열림 스위치 ${!stillClosed}`, await shot("23-tree-declined"));
  await talk("up"); await readDialogue(); await page.keyboard.press("Enter");
  await page.waitForSelector('[data-testid="runtime-choices"]', { timeout: 20000 });
  await page.keyboard.press("Enter");
  await readDialogue();
  await shot("24-tree-use-text");
  await pressEnterUntil(async () => !(await present("dialogue-box")), 20);
  await page.waitForTimeout(900);
  await shot("25-tree-opened");
  await walkTo(15, 15);
  at = await hereNow();
  step("tree-opened-walk", at.y <= 15, `덩굴 자리(15,16)를 지나 (${at.x},${at.y})`, await shot("26-tree-passed"));

  // 저장 → 새로고침 → 불러오기: 열린 길이 남는다.
  await openMenu(); await selectCommand("save");
  await page.waitForTimeout(500);
  await shot("27-save-menu");
  await page.keyboard.press("Enter"); await page.waitForTimeout(700);
  await shot("28-save-confirm");
  await page.keyboard.press("Enter"); await page.waitForTimeout(900);
  await pressEnterUntil(async () => !(await present("dialogue-box")), 6).catch(() => {});
  await closeMenu();
  const savedState = await state();
  const savedSlots = await page.evaluate(() => Object.keys(localStorage).filter((k) => /save-slot/.test(k)));
  step("saved", savedSlots.length > 0, `localStorage 슬롯: ${savedSlots.join(", ")} · 열린 칸 오버라이드 ${(await live()).overrides}`, "28-save-confirm.png");

  // 새로고침 → 타이틀 → 불러오기 → 열린 길이 그대로.
  await page.reload({ waitUntil: "domcontentloaded", timeout: 180000 });
  await page.waitForSelector("[data-testid='title-screen']", { timeout: 120000 });
  await page.waitForTimeout(1500);
  for (let i = 0; i < 10; i++) {
    if ((await page.getByTestId("title-load-game").getAttribute("aria-selected")) === "true") break;
    await page.keyboard.press("ArrowDown"); await page.waitForTimeout(100);
  }
  await page.keyboard.press("Enter");
  await page.getByTestId("save-slot-1").waitFor({ timeout: 20000 });
  await shot("29-load-menu");
  await page.getByTestId("save-slot-1").focus(); await page.keyboard.press("Enter");
  await page.waitForFunction(() => window.__oprnDebug?.readState?.()?.currentMapId, undefined, { timeout: 120000 });
  await page.getByTestId("play-loading-overlay").waitFor({ state: "detached", timeout: 120000 }).catch(() => {});
  await page.waitForTimeout(800);
  const loaded = await live();
  step("loaded", loaded.map === "mx_map_meadow" && loaded.x === savedState.x && loaded.y === savedState.y && loaded.party[0]?.skillIds?.includes("skill_field_cut"),
    `${loaded.map} (${loaded.x},${loaded.y}) · 기술 ${JSON.stringify(loaded.party[0]?.skillIds)} · 열림 스위치 tree=${loaded.switches.sw_ev_hm_tree_1_open} rock=${loaded.switches.sw_ev_hm_rock_1_open}`, await shot("30-after-load"));
  // 열린 틈을 다시 걸어 지난다(막는 타일이 되돌아오지 않았다).
  await walkTo(15, 17);
  await shot("31-after-load-gap-south");
  await walkTo(15, 15);
  at = await hereNow();
  step("gap-stays-open", at.x === 15 && at.y === 15, `불러온 뒤 덩굴 틈(15,16)을 남→북으로 통과 (${at.x},${at.y})`, await shot("32-after-load-gap-north"));
  await walkTo(13, 21); await walkTo(13, 19);
  at = await hereNow();
  step("rock-gap-stays-open", at.y === 19, `불러온 뒤 바위 틈(13,20)을 남→북으로 통과 (${at.x},${at.y})`, await shot("33-after-load-rock-gap"));
} catch (error) {
  report.failure = String(error?.stack ?? error);
  await shot("failure").catch(() => {});
  console.error(report.failure);
} finally {
  const failed = report.steps.filter((s) => !s.ok);
  report.ok = !report.failure && failed.length === 0 && report.errors.length === 0;
  await writeFile(join(out, "report.json"), JSON.stringify(report, null, 2));
  await writeFile(join(out, "SUMMARY.md"), [
    `# monster-hm — ${report.ok ? "통과" : "실패"}`, "",
    ...report.steps.map((s) => `- ${s.ok ? "✓" : "✗"} ${s.id}: ${s.detail}${s.image ? ` (${s.image})` : ""}`), "",
    `디버그 쓰기: ${report.debugWrites.join(" · ")}`, "",
    report.failure ? `예외: ${report.failure}` : "", ...report.errors.slice(0, 15).map((e) => `- 오류: ${e}`),
  ].join("\n"));
  await context.close();
  await browser.close();
  await server.close();
}
process.exit(report.ok ? 0 : 1);
