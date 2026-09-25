import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from "node:fs";
import { join } from "node:path";
// The fixture applies the editor's own title-art tool calls (upsert_resource + set_title_screen with
// the vision-fitted effects), so this scenario proves the authored opening reaches player.html.
// TITLE_FX_PRESET=moonlitCastle|snowyVillage|mistyRuins picks another committed sample keyart.
const preset = process.env.TITLE_FX_PRESET ?? "forestMorning";
mkdirSync(".omo/runtime-qa", { recursive: true });
const temporary = mkdtempSync(".omo/runtime-qa/title-effects-");
const fixture = join(temporary, "project.json");
process.on("exit", () => { rmSync(temporary, { recursive: true, force: true }); });
writeFileSync(fixture, execFileSync(process.execPath, ["node_modules/vite-node/vite-node.mjs", "--script", "scripts/qa/runtime/title-effects-fixture.mts"], {
  maxBuffer: 40 * 1024 * 1024,
  env: { ...process.env, TITLE_FX_PRESET: preset },
}));

const effects = { kind: "waitForAttr", testid: "title-effects", attr: "data-title-effects-renderer", value: "webgl", timeoutMs: 30_000 };

export default {
  id: preset === "forestMorning" ? "title-effects" : `title-effects-${preset}`,
  projectFixture: fixture,
  beats: [
    { id: "title-effects-layer", note: `${preset}: keyart background with the WebGL effects layer, metal logo and menu`, ops: [effects], expect: {
      testidPresent: ["title-screen", "title-effects", "title-text", "title-logo-subtitle"],
      visibleText: { "title-text": "Oath of the Blade" },
    }, shot: true },
    { id: "title-effects-animating", note: "The layer keeps animating (rays sway, glint travels) — a second frame for comparison", ops: [
      { kind: "waitForAttr", testid: "title-effects", attr: "data-title-effects-animated", value: "true" },
    ], expect: { testidPresent: ["title-effects"] }, shot: true },
  ],
};
