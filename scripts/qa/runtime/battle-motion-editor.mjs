// Editor inspection uses the editor dev server. Runtime QA's export-store shim cannot author records.
import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
const out = "verify-shots/battle-motion";
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ args: ["--no-sandbox"] });
try {
  const page = await browser.newPage({
    viewport: { width: 1600, height: 1000 },
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(() =>
    localStorage.setItem("oprn:editor-ui-mode", "expert"),
  );
  await page.goto(
    (process.env.EDITOR_QA_URL ?? "http://127.0.0.1:9835") + "/?freshProject=1",
  );
  await page.getByTestId("edit-canvas").waitFor({ timeout: 90000 });
  await page.getByTestId("toolbar-database").click();
  await page.getByTestId("database-modal").waitFor();
  await page
    .getByTestId("db-tab-retro-choreographies")
    .evaluate((n) => n.click());
  await page.getByTestId("db-retro-choreo-row-chor_builtin_dash").click();
  await page.getByTestId("db-retro-choreo-clone").click();
  const accel = page.getByTestId("db-motion-acceleration");
  await accel.fill("2");
  await accel.dispatchEvent("input");
  await page.getByRole("button", { name: "배우별 경로 직접 편집" }).click();
  const y = page.getByTestId("db-motion-0-1-y");
  const x = page.getByTestId("db-motion-0-1-x");
  await x.fill("21");
  await x.dispatchEvent("input");
  await y.fill("-40");
  await y.dispatchEvent("input");
  const saved = await page.evaluate(async () => {
    const raw = window.__oprnEditorStore
      .getCurrent()
      .database.skillChoreographies.at(-1);
    const { normalizeSkillChoreographyRecord } = await import(
      "/src/project/skillChoreographyRecords.ts"
    );
    return normalizeSkillChoreographyRecord(JSON.parse(JSON.stringify(raw)));
  });
  if (
    saved?.movement?.tracks?.[0]?.points?.[1]?.y !== -40 ||
    saved?.movement?.tracks?.[0]?.points?.[1]?.x !== 21 ||
    saved.movement.acceleration !== 2
  )
    throw new Error("Edited program did not survive reload");
  await page.getByTestId("db-retro-choreo-movement").scrollIntoViewIfNeeded();
  await page.screenshot({ path: out + "/editor-motion.png" });
  const result = await page.evaluate(async () => {
    const { RETRO_CHOREOGRAPHY_TOOLS } = await import(
      "/src/editor/tools/retroChoreographyTools.ts"
    );
    const draft = structuredClone(window.__oprnEditorStore.getCurrent()),
      record = draft.database.skillChoreographies.at(-1);
    const tool = RETRO_CHOREOGRAPHY_TOOLS.find(
      (t) => t.name === "upsert_choreography",
    );
    await tool.run(draft, {
      id: record.id,
      movement: { ...record.movement, acceleration: 1.5 },
    });
    return {
      aiTool:
        draft.database.skillChoreographies.at(-1).movement.acceleration === 1.5,
    };
  });
  if (!result.aiTool)
    throw new Error("AI authoring route did not retain program");
  await page.getByLabel("명중 결과").selectOption("miss");
  const monsterPreview = await page.evaluate(async () => {
    const [{renderMonsterSkillStage}, {resolveSkillChoreography}, {defaultBattleMotionSkills}] = await Promise.all([
      import("/src/editor/panels/databaseMonsterSkillStage.ts"),
      import("/src/assets/retroSkillCatalog.ts"),
      import("/src/assets/battleMotionCatalog.ts"),
    ]);
    const record = defaultBattleMotionSkills().find(s => s.id === "skill_motion_sky-crush");
    const resolved = resolveSkillChoreography(record, undefined, "monster");
    const stage = renderMonsterSkillStage(resolved.skill, record.name, resolved.record, record.hitSequence?.length);
    const host = document.createElement("div");
    host.id = "monster-preview-audit";
    Object.assign(host.style, {position:"absolute",top:"100px",left:"600px",width:"700px",zIndex:"20000",background:"var(--surface, white)"});
    host.append(stage.element);document.body.append(host);
    return {program:resolved.record.movement.pattern, caster:stage.element.querySelector(".db-skill-mon-caster").dataset.enemy};
  });
  if (monsterPreview.caster !== "generated-enemy-slime-01") throw new Error("Common monster motion has no native preview caster");
  await page.locator("#monster-preview-audit [data-testid=db-skill-mon-play]").click();
  await page.waitForTimeout(700);
  await page.locator("#monster-preview-audit").screenshot({path:out+"/monster-motion.png"});
  await page.locator("#monster-preview-audit select[aria-label='명중 결과']").selectOption("miss");
  await writeFile(
    out + "/editor-audit.json",
    JSON.stringify(
      {
        customPathReload: true,
        acceleration: saved.movement.acceleration,
        ...result,
        monsterPreview,
        errors,
        canonicalSave: false,
      },
      null,
      2,
    ),
  );
  if (errors.length) throw new Error(errors.join("\n"));
  console.log(
    "Actual editor clone, path authoring, reload, AI tool and conditional preview inspected",
  );
} finally {
  await browser.close();
}
