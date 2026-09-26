import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from "node:fs";
import { join } from "node:path";
// improve_title_screen through the shipped player. TITLE_STAGE=0 is the untouched baseline, 3 adds effects.
const stage = Number(process.env.TITLE_STAGE ?? "3");
mkdirSync(".omo/runtime-qa", { recursive: true });
const temporary = mkdtempSync(".omo/runtime-qa/title-improve-");
const fixture = join(temporary, "project.json");
process.on("exit", () => { rmSync(temporary, { recursive: true, force: true }); });
writeFileSync(fixture, execFileSync(process.execPath, ["node_modules/vite-node/vite-node.mjs", "--script", "scripts/qa/runtime/title-improve-fixture.mts"], {
  maxBuffer: 40 * 1024 * 1024,
  env: { ...process.env, TITLE_STAGE: String(stage) },
}));

const effectsBeat = stage >= 3
  ? [{ id: "title-improve-effects", note: "stage 3: WebGL effects layer animates over the title", ops: [
      { kind: "waitForAttr", testid: "title-effects", attr: "data-title-effects-renderer", value: "webgl", timeoutMs: 30_000 },
      { kind: "waitForAttr", testid: "title-effects", attr: "data-title-effects-animated", value: "true" },
    ], expect: { testidPresent: ["title-screen", "title-effects", "title-text"] }, shot: true }]
  : [];

export default {
  id: `title-improve-stage${stage}`,
  projectFixture: fixture,
  beats: [
    { id: "title-improve-title", note: `stage ${stage}: title screen`, expect: {
      testidPresent: ["title-screen", "title-text"],
      ...(stage < 3 ? { testidAbsent: ["title-effects"] } : {}),
      visibleText: { "title-text": "별빛 기사단" },
    }, shot: true },
    ...effectsBeat,
  ],
};
