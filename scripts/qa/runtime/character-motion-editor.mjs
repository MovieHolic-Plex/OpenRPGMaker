import { chromium } from "@playwright/test";
import { mkdir, writeFile, readFile } from "node:fs/promises";
const out = "verify-shots/character-motion/editor";
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ args: ["--no-sandbox"] });
try {
  const page = await browser.newPage({
      viewport: { width: 1500, height: 1000 },
    }),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(
    (process.env.EDITOR_QA_URL ?? "http://127.0.0.1:9835") + "/?freshProject=1",
  );
  try {
    await page.getByTestId("toolbar-database").waitFor({ timeout: 45000 });
  } catch {
    await page.reload();
    await page.getByTestId("toolbar-database").waitFor({ timeout: 90000 });
  }
  await page.getByTestId("toolbar-database").click();
  await page
    .getByTestId("db-tab-retro-choreographies")
    .evaluate((n) => n.click());
  await page.getByTestId("db-retro-choreo-row-chor_builtin_dash").click();
  const actors = JSON.parse(
    await readFile("verify-shots/character-motion/coverage.json", "utf8"),
  ).rows;
  const rows = [];
  for (const actor of actors) {
    await page.getByTestId("db-skill-preview-actor").selectOption(actor.id);
    const row = await page.evaluate(() => {
      const stage = document.querySelector(
        '[data-testid="db-skill-retro-stage"]',
      );
      const select = stage.parentElement.querySelector(
        'select[aria-label="명중 결과"]',
      );
      select.value = "hit";
      select.dispatchEvent(new Event("change"));
      const caster = stage.querySelector('[data-role="caster"]');
      return {
        actor: stage.dataset.actor,
        style: stage.closest("[data-motion-style]").dataset.motionStyle,
        cell: caster.style.backgroundPosition,
        sheet: caster.style.backgroundImage,
        left: caster.style.left,
        top: caster.style.top,
        time: stage.parentElement.querySelector(
          '[data-testid="db-skill-retro-time"]',
        ).textContent,
      };
    });
    if (row.actor !== actor.id || !row.sheet || row.sheet === "none")
      throw Error("Preview actor mismatch " + JSON.stringify(row));
    rows.push(row);
    if (
      [
        "actor_guardian",
        "actor_thief",
        "actor_valkyrie",
        "actor_monk",
        "actor_mage",
        "actor_dog",
        "actor_tank",
        "actor_ghost_pal",
        "actor_slime_pal",
      ].includes(actor.id)
    )
      await page
        .getByTestId("db-skill-retro-stage")
        .screenshot({ path: out + "/" + actor.id + ".png" });
  }
  const persistence = await page.evaluate(async () => {
    const [
      { store },
      { serialize, deserialize },
      { updateDatabaseRecord },
      { battleCharacterMotion, setBattleMotionContext },
      { battlePanel },
    ] = await Promise.all([
      import("/src/project/store.ts"),
      import("/src/project/io.ts"),
      import("/src/editor/databaseActions.ts"),
      import("/src/player/battleMotionContext.ts"),
      import("/src/editor/panels/actorRecordBattlePanels.ts"),
    ]);
    const actor = store
      .getCurrent()
      .database.actors.find((a) => a.id === "actor_guardian");
    const host = document.createElement("div");
    host.id = "actor-motion-qa";
    host.append(
      battlePanel(
        actor,
        () => {},
        () => {},
      ),
    );
    document.body.append(host);
    const input = host.querySelector('[data-testid="db-actor-motion-style"]');
    if (!input) throw Error("Actor style control missing");
    input.value = "agile";
    input.dispatchEvent(new Event("change", { bubbles: true }));
    const after = store
      .getCurrent()
      .database.actors.find((a) => a.id === actor.id);
    if (after.battleMotion?.style !== "agile")
      throw Error("UI did not save actor style");
    const field = document.createElement("div"),
      snapshot = {
        actors: [{ id: "instance-guardian", recordId: actor.id }],
        eventState: {
          actorEquipment: { [actor.id]: {} },
          classOverrides: { [actor.id]: "class_valkyrie" },
        },
      };
    setBattleMotionContext(field, snapshot);
    if (battleCharacterMotion(field, "instance-guardian").style !== "agile")
      throw Error("Explicit actor override precedence");
    updateDatabaseRecord("actors", actor.id, { battleMotion: undefined });
    if (battleCharacterMotion(field, "instance-guardian").style !== "lancer")
      throw Error("Runtime class override ignored");
    const sword = store
      .getCurrent()
      .database.equipment.find((e) => e.slot === "weapon");
    updateDatabaseRecord("equipment", sword.id, {
      battleMotionStyle: "martial",
    });
    snapshot.eventState.actorEquipment[actor.id] = { weapon: sword.id };
    if (battleCharacterMotion(field, "instance-guardian").style !== "martial")
      throw Error("Runtime equipment ignored");
    snapshot.eventState.actorEquipment[actor.id] = {};
    if (battleCharacterMotion(field, "instance-guardian").style !== "lancer")
      throw Error("Explicit unequip ignored");
    updateDatabaseRecord("actors", actor.id, {
      battleMotion: { style: "heavy", reach: 9, recovery: 1.4 },
    });
    const loaded = deserialize(serialize(store.getCurrent()));
    const saved = loaded.database.actors.find(
      (a) => a.id === actor.id,
    ).battleMotion;
    if (saved.style !== "heavy" || saved.reach !== 9 || saved.recovery !== 1.4)
      throw Error("Project serialization lost character motion");
    if (
      loaded.database.equipment.find((e) => e.id === sword.id)
        .battleMotionStyle !== "martial"
    )
      throw Error("Project serialization lost weapon motion");
    host.remove();
    return {
      saved,
      actorUi: true,
      instanceId: true,
      classOverride: true,
      equipmentChange: true,
      explicitUnequip: true,
      canonicalSave: false,
    };
  });
  await writeFile(
    out + "/report.json",
    JSON.stringify(
      { actors: rows.length, rows, persistence, errors },
      null,
      2,
    ) + "\n",
  );
  console.log(JSON.stringify({ actors: rows.length, persistence, errors }));
  if (errors.length) process.exitCode = 1;
} catch (e) {
  const p = browser.contexts()[0]?.pages()[0];
  await p?.screenshot({ path: out + "/failure.png" });
  throw e;
} finally {
  await browser.close();
}
