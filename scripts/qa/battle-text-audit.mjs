// 전투 글자 가시성 전수 감사 — 12개 스킨 × 전투 국면 × 텍스트 노드.
//
// 왜 별도 스크립트인가: 기존 런타임 QA 하네스(scripts/runtime-qa.mjs)는 "맵을 걸어
// 무엇이 보이는지"를 보는 시나리오 러너다. 이 감사는 **같은 출하 경로(player.html)** 를
// 쓰지만 국면 전이가 전투 전용(커맨드→서브메뉴→대상→행동→결과)이고, 스킨마다 페이지를
// 새로 부팅해야 해서(스킨은 프로젝트 데이터라 부팅 시 결정) 시나리오 op 로 표현하면
// op 이 전투 전용으로 오염된다. 판정 로직은 scripts/lib/battleTextAudit.mjs 가 소유한다.
//
// 사용:
//   node scripts/qa/battle-text-audit.mjs                     # 12스킨 전부, 기본 뷰포트
//   node scripts/qa/battle-text-audit.mjs --skins rm2003
//   node scripts/qa/battle-text-audit.mjs --long-labels       # 최장 한글 라벨 스트레스
//   node scripts/qa/battle-text-audit.mjs --viewport 800x600 --headed
//   node scripts/qa/battle-text-audit.mjs --out verify-shots/battle-text/red
//
// 결과는 <out>/SUMMARY.md 를 **먼저** 읽어라. 위반이 0 이면 종료 코드 0.
import { chromium } from "@playwright/test";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { startPlayerQaServer } from "../lib/runtimeQaRun.mjs";
import {
  auditBattleText,
  MAX_CLIPPED_AREA_RATIO,
  MIN_EFFECTIVE_ALPHA,
  MIN_INK_HEIGHT_PX,
  renderAuditSummary,
  summarizeAudit,
} from "../lib/battleTextAudit.mjs";

const REPO_ROOT = fileURLToPath(new URL("../../", import.meta.url));
const FIXTURE = "test/fixtures/projects/editor-authored-demo-v3.json";
const PROJECT_URL = "/__runtime-qa/project.json";
const PROJECT_ROUTE = "**/__runtime-qa/project.json";

/** 프로젝트에 저장되는 스킨 id 12종 (src/battle/skins/registry.ts). */
const ALL_SKINS = [
  "rm2003", "rm2000", "pokemon", "mother", "ff", "chrono",
  "dragonquest", "goldensun", "octopath", "bravely", "mv", "vxace",
];

/** 긴 한글 라벨 스트레스용 — 실제 저작에서 나올 수 있는 길이의 상한을 잡는다. */
const LONG = {
  skill: "천공뇌격참열파동베기",
  item: "아주아주비싼최상급회복물약",
  enemy: "심연에서기어나온끈적한슬라임",
  actor: "라벤더숲의방랑기사단장",
};

function parseArgs(argv) {
  const args = { skins: ALL_SKINS, out: null, headed: false, viewport: { width: 1280, height: 900 }, longLabels: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--headed") args.headed = true;
    else if (arg === "--long-labels") args.longLabels = true;
    else if (arg === "--skins") args.skins = argv[++i] === "all" ? ALL_SKINS : argv[i].split(",");
    else if (arg === "--out") args.out = argv[++i];
    else if (arg === "--viewport") {
      const [w, h] = argv[++i].split("x").map(Number);
      args.viewport = { width: w, height: h };
    } else throw new Error(`알 수 없는 인자: ${arg}`);
  }
  return args;
}

/**
 * 픽스처를 감사용으로 고친다.
 *  - `system.battleUiStyle` 로 스킨을 지정한다(부팅 시 결정되므로 스킨마다 재부팅).
 *  - 시작 맵에 **auto 트리거** 전투 이벤트를 넣는다. 같은 맵 안 teleport 는 스프라이트를
 *    옮기지 않아(playSceneTestHooks) 이벤트에 걸어 걷는 방식은 좌표 가정이 깨진다.
 *  - 파티 전원에게 스킬·아이템을 얹어 서브메뉴가 실제로 여러 행을 갖게 한다.
 */
function patchProject(raw, { skin, longLabels }) {
  const project = structuredClone(raw);
  project.system = { ...project.system, battleUiStyle: skin };

  const skills = project.database.skills.filter((skill) => (skill.mpCost?.flat ?? 0) === 0 || skill.id === "skill_fire");
  const skillIds = (skills.length >= 3 ? skills : project.database.skills).slice(0, 6).map((skill) => skill.id);
  for (const actor of project.database.actors) actor.learnedSkills = skillIds.map((id) => ({ skillId: id, level: 1 }));

  const inventory = { ...(project.session?.inventory ?? {}) };
  for (const item of project.database.items.slice(0, 6)) inventory[item.id] = 3;
  project.session = { ...project.session, inventory };

  if (longLabels) {
    for (const [index, skill] of project.database.skills.entries()) {
      if (skillIds.includes(skill.id)) skill.name = `${LONG.skill}${index}`;
    }
    for (const item of project.database.items.slice(0, 6)) item.name = LONG.item;
    for (const enemy of project.database.enemies) enemy.name = LONG.enemy;
    for (const actor of project.database.actors) actor.name = LONG.actor;
  }

  const startMap = project.maps[project.startMapId];
  if (!startMap) throw new Error("픽스처에 시작 맵이 없다");
  startMap.events = startMap.events.filter((event) => event.id !== "ev_battle_audit");
  const page = {
    id: "page_1",
    name: "감사 전투",
    conditions: [],
    graphic: { transparent: true },
    trigger: { kind: "auto" },
    priority: "below",
    overlapForbidden: false,
    movement: { type: "fixed", speed: 3, frequency: 3 },
    commands: [{ kind: "battleProcessing", troopId: "troop_slime_pair", canEscape: true, canLose: true }],
  };
  startMap.events.push({
    id: "ev_battle_audit",
    x: startMap.startX ?? 1,
    y: startMap.startY ?? 1,
    trigger: { kind: "auto" },
    commands: page.commands,
    pages: [page],
  });
  return project;
}

const auditOptions = {
  minInkHeight: MIN_INK_HEIGHT_PX,
  maxClippedAreaRatio: MAX_CLIPPED_AREA_RATIO,
  minAlpha: MIN_EFFECTIVE_ALPHA,
};

async function measure(page, skin, phase, outDir, runs, shots) {
  const result = await page.evaluate(auditBattleText, auditOptions);
  runs.push({ skin, phase, mounted: result.mounted, nodes: result.nodes });
  const shot = `${skin}-${phase}.png`;
  // 요소 스코프 screenshot 은 "요소가 안정될 때까지" 기다리는데, 전투 씬은 메시지 커서
  // 점멸·인트로 릴 같은 무한 애니메이션을 항상 돌린다(실측: locator.screenshot 28.9s 타임아웃).
  // 그래서 씬의 박스를 읽어 page.screenshot 의 clip 으로 잘라낸다 — 안정 대기가 없다.
  const scene = page.locator("[data-testid='battle-scene']");
  const box = (await scene.count()) > 0 ? await scene.boundingBox() : null;
  await page.screenshot({ path: join(outDir, shot), ...(box ? { clip: box } : {}) });
  if (result.nodes.length > 0) shots.push(shot);
  return result;
}

/** 전투 씬이 뜨고 첫 커맨드 국면에 도달할 때까지 실제 상태 변화를 기다린다(고정 sleep 금지). */
async function waitForBattle(page) {
  await page.waitForSelector("[data-testid='battle-scene']", { timeout: 60_000 });
}

async function pressAndSettle(page, key) {
  await page.keyboard.press(key);
  await page.waitForFunction(() => {
    const scene = document.querySelector("[data-testid='battle-scene']");
    if (!scene) return false;
    return scene.getAnimations({ subtree: true }).every((animation) => animation.playState !== "running");
  }, undefined, { timeout: 15_000 }).catch(() => undefined);
}

async function auditSkin(browser, serverUrl, projectJson, skin, viewport, outDir, runs, shots) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error?.message ?? error)));
  await page.addInitScript(
    ([projectUrl, saveNamespace]) => {
      try { localStorage.clear(); } catch { /* 접근 불가 환경이면 그대로 진행 */ }
      window.__OPENRPG_BOOT__ = { projectUrl, saveNamespace };
    },
    [PROJECT_URL, `battle-text-audit:${skin}`],
  );
  await page.route(PROJECT_ROUTE, (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: projectJson }),
  );
  try {
    await page.goto(`${serverUrl}/player.html`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("[data-testid='title-screen']", { timeout: 120_000 });
    await page.keyboard.press("Enter");
    await waitForBattle(page);

    // intro: 커맨드 호스트가 뜨기 전 인트로 배너 국면. 드러내기 에니모이션이 마지리까지 도달한
    // 상태를 재야 한다 — 진행 중인 한 함을 재면 opacity 0 이 잡힐다(실측).
    await page.waitForFunction(() => {
      const scene = document.querySelector("[data-testid='battle-scene']");
      return scene ? scene.getAnimations({ subtree: true }).every((a) => a.playState !== "running") : false;
    }, undefined, { timeout: 20_000 }).catch(() => undefined);
    await measure(page, skin, "intro", outDir, runs, shots);

    // root: 액터 커맨드 루트 메뉴.
    await page.waitForSelector("[data-testid='battle-command-grid'] button", { timeout: 60_000 });
    await page.waitForFunction(() => {
      const scene = document.querySelector("[data-testid='battle-scene']");
      return scene ? scene.getAnimations({ subtree: true }).every((a) => a.playState !== "running") : false;
    }, undefined, { timeout: 20_000 }).catch(() => undefined);
    await measure(page, skin, "root", outDir, runs, shots);

    // skill 서브메뉴: 기술 계열 커맨드를 눌러 진입한다.
    const skillButton = page.locator(
      "[data-testid='battle-command-grid'] [data-testid^='actor-command-skill'], [data-testid='battle-command-grid'] [data-testid='actor-command-fight']",
    ).first();
    if ((await skillButton.count()) > 0) {
      await skillButton.evaluate((node) => node.click());
      await page.waitForTimeout(120);
      await measure(page, skin, "skill-submenu", outDir, runs, shots);
      await pressAndSettle(page, "Escape");
    }

    // item 서브메뉴.
    const itemButton = page.locator("[data-testid='battle-command-grid'] [data-testid='actor-command-item']").first();
    if ((await itemButton.count()) > 0) {
      await itemButton.evaluate((node) => node.click());
      await page.waitForTimeout(120);
      await measure(page, skin, "item-submenu", outDir, runs, shots);
      await pressAndSettle(page, "Escape");
    }

    // target 선택: 공격 커맨드 → 대상 국면.
    const attackButton = page.locator("[data-testid='battle-command-grid'] [data-testid='actor-command-attack']").first();
    if ((await attackButton.count()) > 0) {
      await attackButton.evaluate((node) => node.click());
      await page.waitForTimeout(200);
      await measure(page, skin, "target", outDir, runs, shots);
    }

    // acting: 대상 확정 후 행동 연출(메시지 창 + 데미지 팝업).
    await pressAndSettle(page, "Enter");
    await page.waitForTimeout(400);
    await measure(page, skin, "acting", outDir, runs, shots);

    // result: 승리 패널이 뜨는 것을 보려면 전투를 실제로 이길 수 있어야 하고, 그러려면
    // 메뉴를 **탭으로** 몰아야 한다. 키보드 Enter 는 이 경로에서 전투를 전혀 진행시키지
    // 못한다(실측: scripts/qa/probe-battle-result.mjs 기록 — Enter 140회에 phase 가
    // actorCommand 에서 고정되고 적 HP 가 24/24 에서 하나도 안 줄었다). 서버러우를 굴리는
    // 경로는 이밌 이 드라이버가 서본러우에서 사용하는 node.click() 말고는 없다.
    for (let i = 0; i < 120; i += 1) {
      if ((await page.locator("[data-testid='battle-result-panel']").count()) > 0) break;
      const state = await page.evaluate(() => {
        const scene = document.querySelector("[data-testid='battle-scene']");
        return scene ? scene.dataset.battlePhase ?? null : null;
      });
      if (state === null) break;
      if (state === "actorCommand") {
        const attack = page.locator("[data-testid='battle-command-grid'] [data-testid='actor-command-attack']").first();
        if ((await attack.count()) > 0) await attack.evaluate((node) => node.click()).catch(() => undefined);
      } else if (state === "targetSelect") {
        const target = page.locator("[data-testid^='battle-target-enemy']").first();
        if ((await target.count()) > 0) await target.evaluate((node) => node.click()).catch(() => undefined);
      }
      await page.waitForTimeout(200);
    }
    const resultPanel = page.locator("[data-testid='battle-result-panel']");
    await resultPanel.waitFor({ state: "attached", timeout: 10_000 }).catch(() => undefined);
    if ((await resultPanel.count()) > 0) {
      await measure(page, skin, "result", outDir, runs, shots);
    } else {
      runs.push({ skin, phase: "result", mounted: false, nodes: [] });
    }
  } finally {
    await context.close();
  }
  return errors;
}

const args = parseArgs(process.argv.slice(2));
const outDir = args.out ? join(REPO_ROOT, args.out) : join(REPO_ROOT, "verify-shots/battle-text-audit");
const raw = JSON.parse(await readFile(join(REPO_ROOT, FIXTURE), "utf8"));

await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });

const server = await startPlayerQaServer();
const browser = await chromium.launch({
  headless: !args.headed,
  args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu"],
});
const runs = [];
const shots = [];
const pageErrors = [];
try {
  for (const skin of args.skins) {
    const projectJson = JSON.stringify(patchProject(raw, { skin, longLabels: args.longLabels }));
    const errors = await auditSkin(browser, server.url, projectJson, skin, args.viewport, outDir, runs, shots);
    pageErrors.push(...errors.map((error) => `${skin}: ${error}`));
    process.stdout.write(`[audit] ${skin} 완료 — 위반 ${runs.filter((r) => r.skin === skin).reduce((sum, r) => sum + r.nodes.length, 0)}건\n`);
  }
} finally {
  await browser.close();
  await server.close();
}

const summary = summarizeAudit(runs);
const tree = (() => {
  try { return execFileSync("git", ["rev-parse", "--short", "HEAD^{tree}"], { cwd: REPO_ROOT, encoding: "utf8" }).trim(); }
  catch { return null; }
})();
const report = {
  ...summary,
  tree,
  viewport: args.viewport,
  skins: args.skins,
  phases: [...new Set(runs.map((run) => run.phase))],
  longLabels: args.longLabels,
  pageErrors,
  shots,
  runs,
};
await writeFile(join(outDir, "manifest.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
await writeFile(join(outDir, "SUMMARY.md"), renderAuditSummary(report), "utf8");
process.stdout.write(`\n[audit] 위반 ${report.total}건 — ${relative(REPO_ROOT, join(outDir, "SUMMARY.md"))}\n`);
process.exit(report.pass ? 0 : 1);
