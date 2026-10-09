// 레트로 전투 기믹 편집 칸 증거 촬영. 사용: npm run dev:worktree (9807) 를 띄운 뒤
//   node scripts/capture-retro-editable.mjs [baseUrl]
// 결과: verify-shots/retro-editable/*.png + results.json (재열기 뒤 값 확인 포함)
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const BASE = process.argv[2] ?? "http://127.0.0.1:9807";
const OUT = path.resolve("verify-shots/retro-editable");
fs.mkdirSync(OUT, { recursive: true });
const results = {};

const browser = await chromium.launch({ args: ["--disable-background-networking", "--disable-features=NetworkChangeNotifier"] });
const p = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
await p.addInitScript(() => localStorage.setItem("oprn:editor-ui-mode", "expert"));
await p.goto(`${BASE}/?freshProject=1`);
await p.waitForSelector("[data-testid='edit-canvas']", { timeout: 90000 });
await p.waitForTimeout(2000);

const shot = (name) => p.screenshot({ path: path.join(OUT, name), timeout: 120000, animations: "disabled" });
const tid = (id) => p.locator(`[data-testid="${id}"]`);
const wait = (ms = 700) => p.waitForTimeout(ms);
const jsClick = (id) => p.evaluate((x) => document.querySelector(`[data-testid="${x}"]`).click(), id);

async function openDb() {
  await p.getByTestId("toolbar-database").click();
  await p.getByTestId("database-modal").waitFor();
  await wait(1200);
}
async function closeDb() {
  await jsClick("database-modal-close");
  await wait(600);
}
async function openTab(tab) {
  await jsClick(`db-tab-${tab}`);
  await wait(2200);
}
async function pick(recordId) {
  const box = p.locator('input[aria-label="이름 또는 ID 검색"]');
  if (await box.count()) { await box.fill(recordId, { timeout: 8000 }).catch(() => {}); await wait(800); }
  await p.locator(`[data-record-id="${recordId}"].db-list-row`).click({ timeout: 8000 });
  await wait(1200);
}
async function center(id) {
  await p.evaluate((x) => document.querySelector(`[data-testid="${x}"]`)?.scrollIntoView({ block: "center" }), id);
  await wait(400);
}
async function ensureCardOpen(cardId, probeId) {
  const visible = await tid(probeId).first().isVisible().catch(() => false);
  if (visible) return;
  await p.evaluate((x) => {
    const card = document.querySelector(`[data-testid="${x}"]`);
    const head = card?.querySelector("button, summary, header, [role='button']");
    head?.click();
  }, cardId);
  await wait(500);
}
async function setInput(id, value) {
  const loc = tid(id).first();
  await loc.fill(String(value));
  await loc.dispatchEvent("change");
  await loc.blur();
  await wait(300);
}
const readRecord = (collection, recordId) =>
  p.evaluate(async ([c, r]) => {
    const { store } = await import("/src/project/store.ts");
    return JSON.parse(JSON.stringify(store.getCurrent().database[c].find((x) => x.id === r) ?? null));
  }, [collection, recordId]);

// ── a. 로스터 스킬: 흡수·HP 대가·다단 타격·상태 부여 ─────────────────────────────
const SKILL = "skill_dark_knight_soul_eater";
await openDb();
await openTab("skills");
await pick(SKILL);
await ensureCardOpen("feature16-combat-studio", "feature16-drain");
await center("feature16-drain");
await shot("a-skill-soul-eater-before.png");
const beforeSkill = await readRecord("skills", SKILL);
await setInput("feature16-drain", 40);
await setInput("feature16-hp-cost", 15);
await setInput("feature16-hit-sequence", "1,0.5,0.5");
await center("feature16-drain");
await shot("a-skill-soul-eater-after.png");
await center("db-skill-card-states");
await shot("a-skill-soul-eater-states.png");
const afterA = await readRecord("skills", SKILL);
results.a = { before: pick_(beforeSkill), after: pick_(afterA) };
function pick_(s) {
  return { drainPercent: s?.drainPercent, hpCostPercent: s?.hpCostPercent, hitSequence: s?.hitSequence, area: s?.area, comboActorIds: s?.comboActorIds };
}

// ── b. 범위(직선)·연계 배우 ────────────────────────────────────────────────────
const actors = await p.evaluate(async () => {
  const { store } = await import("/src/project/store.ts");
  return store.getCurrent().database.actors.slice(0, 3).map((a) => ({ id: a.id, name: a.name }));
});
await ensureCardOpen("feature16-combat-studio", "skill-area-shape");
await center("skill-area-shape");
await shot("b-skill-range-combo-before.png");
await p.locator('[data-testid="skill-area-shape"]').first().selectOption("line");
await wait(400);
await setInput("skill-area-radius", 160);
for (const [i, a] of actors.entries()) {
  await p.locator(`[data-testid="skill-combo-actor-${i + 1}"]`).first().selectOption(a.id);
  await wait(300);
}
await center("skill-area-shape");
await shot("b-skill-range-combo-after.png");
results.b = { actors, after: pick_(await readRecord("skills", SKILL)) };

// 적용 → 닫기 → 다시 열기: 값이 남는지
await jsClick("database-footer-apply").catch(() => {});
await wait(500);
await closeDb();
await openDb();
await openTab("skills");
await pick(SKILL);
await ensureCardOpen("feature16-combat-studio", "skill-area-shape");
await center("skill-area-shape");
await shot("b-skill-range-combo-reopened.png");
const shapeAfterReopen = await p.locator('[data-testid="skill-area-shape"]').first().inputValue();
results.b.reopened = {
  shapeField: shapeAfterReopen,
  radiusField: await tid("skill-area-radius").first().inputValue().catch(() => null),
  combo: await Promise.all([1, 2, 3].map((n) => tid(`skill-combo-actor-${n}`).first().inputValue().catch(() => null))),
  drainField: await tid("feature16-drain").first().inputValue().catch(() => null),
  record: pick_(await readRecord("skills", SKILL)),
};

// ── e. 스킬 탭 레트로 무대 미리보기(편집한 스킬) ─────────────────────────────────
await center("db-skill-retro-stage");
await shot("e-skill-retro-stage-idle.png");
await jsClick("db-skill-retro-play");
await wait(900);
await shot("e-skill-retro-stage-playing.png");
results.e = await p.evaluate(() => {
  const s = document.querySelector('[data-testid="db-skill-retro-stage"]');
  return { running: s?.dataset.running, pose: s?.dataset.retroPose, motion: s?.dataset.motion, time: document.querySelector('[data-testid="db-skill-retro-time"]')?.textContent };
});
await wait(2500);

// ── c. 상태: 스톱·버서크·프로텍트·젖음 ───────────────────────────────────────────
await openTab("states");
for (const [id, probe, name] of [
  ["state_stop", "db-state-rt-freezes-gauge", "c-state-stop"],
  ["state_berserk", "db-state-rt-forced-attack", "c-state-berserk"],
  ["state_protect", "db-state-rt-physical-defense", "c-state-protect"],
]) {
  await pick(id);
  await center(probe);
  await shot(`${name}.png`);
  const r = await readRecord("states", id);
  results[name] = r?.runtimeEffects;
}
await pick("state_wet");
await center("db-state-rt-element-thunder");
await shot("c-state-wet-before.png");
const wetBefore = (await readRecord("states", "state_wet"))?.runtimeEffects;
await p.locator('[data-testid="db-state-rt-element-thunder"]').first().selectOption("A");
await wait(500);
await p.locator('[data-testid="db-state-rt-element-fire"]').first().selectOption("E");
await wait(500);
await setInput("db-state-rt-magic-defense", 0.75);
await center("db-state-rt-element-thunder");
await shot("c-state-wet-after.png");
results["c-state-wet"] = { before: wetBefore, after: (await readRecord("states", "state_wet"))?.runtimeEffects };
await closeDb();
await openDb();
await openTab("states");
await pick("state_wet");
await center("db-state-rt-element-thunder");
await shot("c-state-wet-reopened.png");
results["c-state-wet"].reopenedThunderField = await tid("db-state-rt-element-thunder").first().inputValue();
results["c-state-wet"].reopenedFireField = await tid("db-state-rt-element-fire").first().inputValue();
await closeDb();

// ── d. 로스터 없는 옛 프로젝트: 클래스 목록에 발키리·다크 나이트가 없다가 열면 채워진다 ──────────
const stripped = await p.evaluate(async () => {
  const { store } = await import("/src/project/store.ts");
  const db = store.getCurrent().database;
  const drop = new Set(db.classes.filter((c) => /발키리|암흑기사|사무라이|닌자|몽크|바드|드루이드|마녀/.test(c.name) || /valkyrie|dark_knight/.test(c.id)).map((c) => c.id));
  const skillDrop = new Set(db.classes.filter((c) => drop.has(c.id)).flatMap((c) => c.skillIds));
  const before = { classes: db.classes.length, actors: db.actors.length, skills: db.skills.length, states: db.states.length };
  db.classes = db.classes.filter((c) => !drop.has(c.id));
  db.actors = db.actors.filter((a) => !drop.has(a.classId));
  db.skills = db.skills.filter((s) => !skillDrop.has(s.id));
  db.states = db.states.filter((s) => !["state_blind", "state_stop", "state_protect", "state_shell", "state_berserk", "state_petrify", "state_wet", "state_oiled"].includes(s.id));
  return { before, dropped: [...drop], after: { classes: db.classes.length, actors: db.actors.length, skills: db.skills.length, states: db.states.length } };
});
await openDb();
await openTab("classes");
const search = async (q) => { const box = p.locator('input[aria-label="이름 또는 ID 검색"]'); await box.fill(q); await wait(900); };
const rows = () => p.evaluate(() => [...document.querySelectorAll(".db-list-row")].map((e) => e.textContent.trim().slice(0, 30)));
await search("발키리");
await shot("d-old-project-classes-before-ensure.png");
const namesBefore = { valkyrie: await rows() };
await search("암흑기사");
namesBefore.darkKnight = await rows();
await closeDb();
const ensured = await p.evaluate(async () => {
  const { store } = await import("/src/project/store.ts");
  const { ensureRetroRosterRecords } = await import("/src/project/defaults/defaultDatabase.ts");
  const changed = ensureRetroRosterRecords(store.getCurrent());
  const db = store.getCurrent().database;
  return { changed, again: ensureRetroRosterRecords(store.getCurrent()), counts: { classes: db.classes.length, actors: db.actors.length, skills: db.skills.length, states: db.states.length } };
});
await openDb();
await openTab("classes");
await search("발키리");
await shot("d-old-project-classes-after-ensure.png");
const namesAfter = { valkyrie: await rows() };
await search("암흑기사");
await shot("d-old-project-classes-after-ensure-darkknight.png");
namesAfter.darkKnight = await rows();
results.d = { stripped, ensured, namesBefore, namesAfter };
await closeDb();

fs.writeFileSync(path.join(OUT, "results.json"), JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
await browser.close();
