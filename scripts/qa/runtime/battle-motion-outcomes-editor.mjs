import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
const out = "verify-shots/battle-motion/outcomes";
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ args: ["--no-sandbox"] });
try {
  const page = await browser.newPage({
      viewport: { width: 1500, height: 960 },
    }),
    errors = [];
  page.on("pageerror", (e) => {
    errors.push(e.message);
    console.error("PAGEERROR", e.message);
  });
  await page.goto(
    (process.env.EDITOR_QA_URL ?? "http://127.0.0.1:9835") + "/?freshProject=1",
  );
  await page.getByTestId("toolbar-database").waitFor({ timeout: 90000 });
  await page.getByTestId("toolbar-database").click();
  await page
    .getByTestId("db-tab-retro-choreographies")
    .evaluate((n) => n.click());
  await page.getByTestId("db-retro-choreo-row-chor_builtin_jump").click();
  const rows = [];
  for (const outcome of ["hit", "miss", "cancel"]) {
    const row = await page.evaluate(async (outcome) => {
      const select = document.querySelector('select[aria-label="명중 결과"]');
      select.value = outcome;
      select.dispatchEvent(new Event("change"));
      const stage = document.querySelector(
          '[data-testid="db-skill-retro-stage"]',
        ),
        caster = stage.querySelector('[data-role="caster"]');
      if (stage.dataset.running !== "false")
        throw Error("Changing outcome did not stop playback");
      return {
        outcome,
        left: caster.style.left,
        top: caster.style.top,
        cell: caster.style.backgroundPosition,
        fx: [...stage.querySelectorAll(".db-skill-retro-fx")]
          .filter((n) => !n.hidden)
          .map((n) => n.dataset.key),
      };
    }, outcome);
    rows.push(row);
    await page
      .getByTestId("db-skill-retro-stage")
      .screenshot({ path: `${out}/editor-jump-${outcome}.png` });
  }
  if (
    rows[0].fx.length === 0 ||
    rows[1].fx.length ||
    rows[2].fx.length ||
    rows[0].left === rows[2].left
  )
    throw Error(
      "Editor results are visually identical: " + JSON.stringify(rows),
    );
  await page.evaluate(async () => {
    const [
      { renderMonsterSkillStage },
      { defaultBattleMotionSkills },
      { resolveSkillChoreography },
    ] = await Promise.all([
      import("/src/editor/panels/databaseMonsterSkillStage.ts"),
      import("/src/assets/battleMotionCatalog.ts"),
      import("/src/assets/retroSkillCatalog.ts"),
    ]);
    const skill = defaultBattleMotionSkills().find(
        (s) => s.id === "skill_motion_air-chase",
      ),
      resolved = resolveSkillChoreography(skill, undefined, "monster");
    const stage = renderMonsterSkillStage(
        resolved.skill,
        skill.name,
        resolved.record,
        3,
      ),
      host = document.createElement("div");
    host.id = "outcome-monster";
    Object.assign(host.style, {
      position: "absolute",
      top: "80px",
      left: "500px",
      width: "600px",
      zIndex: "20000",
      background: "white",
    });
    host.append(stage.element);
    document.body.append(host);
  });
  const monster = [];
  for (const outcome of ["hit", "miss", "cancel"]) {
    monster.push(
      await page.evaluate(async (outcome) => {
        const host = document.getElementById("outcome-monster"),
          select = host.querySelector('select[aria-label="명중 결과"]');
        select.value = outcome;
        select.dispatchEvent(new Event("change"));
        return {
          outcome,
          text: host.querySelector('[data-testid="db-skill-mon-time"]')
            .textContent,
          fx: [...host.querySelectorAll(".db-skill-retro-fx")].filter(
            (n) => !n.hidden,
          ).length,
        };
      }, outcome),
    );
    await page
      .locator("#outcome-monster")
      .screenshot({ path: `${out}/monster-${outcome}.png` });
  }
  if (monster[0].fx === 0 || monster[1].fx || monster[2].fx)
    throw Error("Monster outcome FX not separated: " + JSON.stringify(monster));
  await writeFile(
    out + "/editor-review.json",
    JSON.stringify({ rows, monster, errors, canonicalSave: false }, null, 2) +
      "\n",
  );
  console.log(JSON.stringify({ rows, monster, errors }));
  if (errors.length) process.exitCode = 1;
} catch (error) {
  const page = browser.contexts()[0]?.pages()[0];
  if (page) {
    console.error((await page.locator("body").innerText()).slice(0, 2000));
    await page.screenshot({ path: out + "/editor-failure.png" });
  }
  throw error;
} finally {
  await browser.close();
}
