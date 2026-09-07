import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { after, before, test } from "node:test";
import ts from "typescript";
import { build } from "esbuild";
import { chromium } from "@playwright/test";
import * as qa from "../scripts/lib/exportPlayability.mjs";

let browser;
before(async () => { browser = await chromium.launch({ args: ["--no-sandbox"] }); });
after(async () => { await browser?.close(); });

test("the actual private QA preparation selects the renderer contract for four sideview actors", async () => {
  const source = ts.createSourceFile("qa-export-playability.mts",
    await readFile(new URL("../scripts/qa-export-playability.mts", import.meta.url), "utf8"), ts.ScriptTarget.Latest, true);
  const statements = source.statements.find(ts.isTryStatement).tryBlock.statements;
  const declarationIndex = (name) => statements.findIndex((node) => ts.isVariableStatement(node)
    && node.declarationList.declarations.some((declaration) => declaration.name.getText(source) === name));
  const start = declarationIndex("project");
  const end = declarationIndex("fixturePath");
  assert.ok(start >= 0 && end > start);
  // Execute the actual in-memory preparation statements before serialization,
  // not a duplicate style assignment or a match against a comment.
  const prepare = Function("project", statements.slice(start + 1, end).map((node) => node.getText(source)).join("\n"));
  const project = JSON.parse(await readFile(new URL("fixtures/projects/editor-authored-demo-v3.json", import.meta.url), "utf8"));
  prepare(project);
  assert.equal(project.system.battleUiStyle, "rm2003");
  const bundle = await build({
    stdin: { contents: 'export { getBattleSkin } from "./src/battle/skins/registry.ts"; export { BATTLER_PLACEMENTS } from "./src/battle/battlerPlacements.ts";', resolveDir: process.cwd() },
    bundle: true, write: false, platform: "node", format: "esm",
  });
  const { getBattleSkin, BATTLER_PLACEMENTS } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString("base64")}`);
  const skin = getBattleSkin(project.system.battleUiStyle);
  assert.equal(skin.layout, "sideview");
  assert.equal(skin.showAllySprites, true);
  const placement = BATTLER_PLACEMENTS[skin.id];
  assert.equal(placement.partyFacing, "front");
  assert.equal(placement.partyMax ?? 4, 4);
});

for (const delivery of ["embedded", "nested-web"]) {
  for (const style of ["rm2003", "rm2000", undefined]) {
    test(`upfront gameplay style check: ${delivery}, ${style ?? "omitted"}`, { timeout: 15000 }, async (t) => {
      const page = await browser.newPage();
      t.after(() => page.close());
      const project = { system: { battleUiStyle: style } };
      let projectRequests = 0;
      await page.route("http://fixture-qa.test/**", (route) => {
        if (route.request().url().endsWith("/project.json")) {
          projectRequests += 1;
          return route.fulfill({ json: project });
        }
        return route.fulfill({ contentType: "text/html", body: delivery === "embedded"
          ? `<script id="oprn-standalone-project" type="application/json">${JSON.stringify(project)}</script>` : "<!doctype html>" });
      });
      await page.goto("http://fixture-qa.test/releases/selected/player.html");
      if (style === "rm2003") assert.equal(await qa.verifyExportBattleStyle(page), style);
      else await assert.rejects(qa.verifyExportBattleStyle(page), { code: "ERR_ASSERTION", actual: style, expected: "rm2003" });
      assert.equal(projectRequests, delivery === "embedded" ? 0 : 1);
    });
  }
}
