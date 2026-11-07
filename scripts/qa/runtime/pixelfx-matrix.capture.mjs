
// pixelfx 효과 하나씩을 출하 플레이어에서 실제로 튼다 — 0.3.0 전/후 비교용 매트릭스 캡처.
//
//   node scripts/qa/runtime/pixelfx-matrix.capture.mjs --out DIR [--effects a,b,c] [--shots 8] [--gap 160] [--mode field|battle]
//
// field : 새솔마을(examples/saesol-red)에서 주인공 발밑에 showAnimation 한 번, 정해진 간격으로 화면을 찍는다.
// battle: editor-authored-demo-v3 도트 측면에서 그 효과를 기술로 걸고, 기술을 쏜 뒤 같은 방식으로 찍는다.
// 효과마다 shots 장 PNG + <효과>.json(잉크 화소가 가장 많은 장, 시간) 을 남긴다.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import { join, resolve } from "node:path";
import { chromium } from "playwright";
import { startPlayerQaServer } from "../../lib/runtimeQaRun.mjs";

const REPO_ROOT = resolve(import.meta.dirname, "../../..");
const PROJECT_URL = "/__runtime-qa/project.json";
const PROJECT_ROUTE = "**/__runtime-qa/project.json";

function arg(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : fallback;
}
const outDir = resolve(arg("out", "/tmp/pixelfx-matrix"));
const shotCount = Number(arg("shots", "8"));
const gapMs = Number(arg("gap", "160"));
const viewport = arg("viewport", "960x720");
const [viewW, viewH] = viewport.split("x").map(Number);
const defaultEffects = [
  "fire/fireball", "melee/sword-slash", "holy/heal", "explosions/small-explosion",
  "holy/blessing", "fire/torch", "weather/rain", "ice/frost-nova",
  "lightning/chain-lightning", "impacts/hit-flash",
];
const effects = (arg("effects") || defaultEffects.join(",")).split(",").filter(Boolean);

const pfx = (effectId) => ({
  id: `anim_pfx_${effectId.replace(/[/-]/g, "_")}`, name: `pixelfx ${effectId}`, scope: "singleTarget", position: "feet",
  pixelFx: { effectId },
});

async function fieldProject(effectId) {
  const project = JSON.parse(gunzipSync(await readFile(join(REPO_ROOT, "examples/saesol-red/project.json.gz"))).toString("utf8"));
  const db = project.database;
  const record = pfx(effectId);
  db.battleAnimations.push(record);
  const map = project.maps[project.startMapId];
  // 같은 칸에 상시 효과를 깔지 않는다 — 한 번 효과만 재서 회귀를 단순하게 둔다.
  map.events = (map.events ?? []).filter((event) => !String(event.id).startsWith("ev_pfx_matrix"));
  const { x, y } = project.startPos;
  map.events.push({
    id: "ev_pfx_matrix", name: "matrix", x, y: y + 1, trigger: { kind: "parallel" }, commands: [],
    pages: [{
      id: "ev_pfx_matrix_page", name: "효과", conditions: [], trigger: { kind: "parallel" }, graphic: { transparent: true },
      movement: { type: "fixed", speed: 3, frequency: 3 }, priority: "below", overlapForbidden: false,
      commands: [
        { kind: "wait", ms: 400 },
        { kind: "showAnimation", target: "player", animationId: record.id, wait: false },
        { kind: "wait", ms: 600000 },
      ],
    }],
  });
  return JSON.stringify(project);
}

async function battleProject(effectId) {
  const project = JSON.parse(await readFile(join(REPO_ROOT, "test/fixtures/projects/editor-authored-demo-v3.json"), "utf8"));
  project.system.battleUiStyle = "retro2003";
  const db = project.database;
  const record = pfx(effectId);
  db.battleAnimations.push(record);
  const base = structuredClone(db.skills.find((skill) => skill.scope && skill.effect) ?? db.skills[0]);
  const skillId = "skill_pfx_matrix";
  db.skills.push({ ...base, id: skillId, name: "매트릭스", animationId: record.id, mpCost: 0, tpCost: 0, scope: "allEnemies", retroChoreographyId: undefined });
  for (const actor of db.actors) actor.learnedSkills = [{ level: 1, skillId }, ...(actor.learnedSkills ?? [])];
  for (const cls of db.classes) {
    cls.skillIds = [skillId, ...(cls.skillIds ?? [])];
    cls.learnedSkills = [{ level: 1, skillId }, ...(cls.learnedSkills ?? [])];
    cls.animationId = record.id;
  }
  for (const enemy of db.enemies) enemy.stats = { ...enemy.stats, maxHp: 9999 };
  const map = project.maps[project.startMapId];
  map.events = (map.events ?? []).filter((event) => !String(event.id).startsWith("ev_pfx_matrix"));
  map.events.push({
    id: "ev_pfx_matrix", name: "battle", x: project.startPos.x + 1, y: project.startPos.y, trigger: { kind: "auto" }, commands: [],
    pages: [{
      id: "ev_pfx_matrix_page", name: "battle", conditions: [], trigger: { kind: "auto" }, graphic: { transparent: true },
      movement: { type: "fixed", speed: 3, frequency: 3 }, priority: "below", overlapForbidden: false,
      commands: [{ kind: "battleProcessing", troopId: "troop_forest_hornets", canEscape: false, canLose: true }, { kind: "wait", ms: 600000 }],
    }],
  });
  return JSON.stringify(project);
}

const server = await startPlayerQaServer();
const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu", "--disable-background-networking", "--disable-features=NetworkChangeNotifier"],
});
const report = { mode: arg("mode", "field"), effects: [], errors: [] };
await mkdir(outDir, { recursive: true });
try {
  for (const effectId of effects) {
    const name = effectId.replace(/[/]/g, "__");
    const context = await browser.newContext({ viewport: { width: viewW, height: viewH } });
    const page = await context.newPage();
    page.on("pageerror", (error) => report.errors.push(`${effectId}: ${String(error?.message ?? error)}`));
    page.on("console", (message) => { if (message.type() === "error") report.errors.push(`${effectId} console.error: ${message.text()}`); });
    const projectJson = report.mode === "battle" ? await battleProject(effectId) : await fieldProject(effectId);
    await page.addInitScript(([projectUrl, ns]) => {
      try { localStorage.clear(); } catch { /* 그대로 */ }
      window.__OPENRPG_BOOT__ = { projectUrl, saveNamespace: ns, qaInstrumentation: true };
    }, [PROJECT_URL, `pixelfx-matrix-${name}`]);
    await page.route(PROJECT_ROUTE, (route) => route.fulfill({ status: 200, contentType: "application/json", body: projectJson }));
    await page.goto(`${server.url}/player.html`, { waitUntil: "domcontentloaded" });
    const shots = [];
    try {
      await page.waitForSelector("[data-testid='title-screen'], [data-testid='runtime-state-json']", { timeout: 180_000 });
      if (await page.locator("[data-testid='title-screen']").count()) await page.keyboard.press("Enter");
      if (report.mode === "battle") {
        // pixelfx.capture.mjs 의 검증된 순서 그대로: 메뉴 대기 → 스킬 칸 DOM 클릭 → 목록에서 기술 클릭 → z 확정 → 연출 노드 대기.
        for (let tries = 0; tries < 80; tries += 1) {
          if (await page.locator("[data-testid='actor-command-attack']").count()) break;
          await page.waitForTimeout(500);
          if (tries % 4 === 3) await page.keyboard.press("z");
        }
        await page.waitForSelector("[data-testid='actor-command-attack']", { timeout: 30_000 });
        await page.evaluate(() => document.querySelector("[data-testid='actor-command-skill']")?.click());
        await page.waitForTimeout(500);
        report.skillList = await page.evaluate(() => [...document.querySelectorAll("button, [role='option'], li")]
          .map((n) => n.textContent?.trim()).filter((t) => t && t.length < 40).slice(0, 30));
        const clickedSkill = await page.evaluate(() => {
          const hit = [...document.querySelectorAll("button, [role='option'], li, [data-testid]")]
            .find((n) => n.textContent?.includes("매트릭스") && n.children.length < 6);
          if (!hit) return false;
          hit.click();
          return true;
        });
        await page.waitForTimeout(300);
        if (!clickedSkill) await page.keyboard.press("z");
        await page.waitForTimeout(300);
        await page.keyboard.press("z");
        const appeared = await page.waitForSelector(".battle-animation[data-pixel-fx]", { timeout: 20_000, state: "attached" })
          .then(() => true, () => false);
        report.appeared = appeared;
        await page.waitForTimeout(60);
      } else {
        // 맵 시작 대사(오프닝 안내)를 넘긴다 — 대사창이 떠 있으면 효과가 가린다.
        for (let i = 0; i < 8; i += 1) {
          await page.keyboard.press("z");
          await page.waitForTimeout(220);
        }
        await page.waitForTimeout(600);
      }
      const startedAt = Date.now();
      for (let i = 0; i < shotCount; i += 1) {
        const file = `${name}-${i}.png`;
        const path = join(outDir, file);
        await page.screenshot({ path });
        const size = (await readFile(path)).length;
        shots.push({ file, atMs: Date.now() - startedAt, bytes: size });
        await page.waitForTimeout(gapMs);
      }
    } catch (error) {
      report.errors.push(`${effectId}: capture failed — ${String(error?.message ?? error)}`);
      await page.screenshot({ path: join(outDir, `${name}-fail.png`) }).catch(() => {});
    }
    report.effects.push({ id: effectId, shots });
    await context.close();
  }
} finally {
  await browser.close();
  await server.close();
  await writeFile(join(outDir, "report.json"), JSON.stringify(report, null, 2));
}
const total = report.effects.reduce((sum, e) => sum + e.shots.length, 0);
console.log(JSON.stringify({ mode: report.mode, effects: report.effects.length, shots: total, errors: report.errors.slice(0, 5) }));
