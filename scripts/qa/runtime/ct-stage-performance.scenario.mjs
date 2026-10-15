import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from "node:fs";
import { join } from "node:path";
// Stage performance in the shipped player, authored only through author_stage_performance (ct-stage-performance-fixture.mts):
// the show starts by itself, lyric subtitles and a two-voice chorus appear as corner lines without blocking the cutscene, then the curtain closes.
mkdirSync(".omo/runtime-qa", { recursive: true });
const temporary = mkdtempSync(".omo/runtime-qa/ct-stage-performance-");
const fixture = join(temporary, "project.json");
process.on("exit", () => { rmSync(temporary, { recursive: true, force: true }); });
writeFileSync(fixture, execFileSync(process.execPath, ["node_modules/vite-node/dist/cli.mjs", "--script", "scripts/qa/runtime/ct-stage-performance-fixture.mts"], {
  maxBuffer: 200 * 1024 * 1024,
}));

export default {
  id: "ct-stage-performance",
  projectFixture: fixture,
  beats: [
    { id: "start-show", note: "New game: the auto performance starts and locks input", ops: [
      { kind: "key", key: "Enter" },
      { kind: "waitFor", testid: "title-screen", state: "absent" },
      { kind: "waitForRuntime" },
      { kind: "seed", seed: 1 },
      { kind: "waitFor", testid: "dialogue-corner" },
    ], expect: {}, shot: true },
    { id: "chorus-overlap", note: "Chorus: two voices stack as corner lines at the same time", ops: [
      { kind: "hold", ms: 4400 },
      { kind: "waitFor", testid: "dialogue-corner" },
      { kind: "hold", ms: 1200 },
    ], expect: {}, shot: true },
    { id: "after-show", note: "The cutscene ends by itself, the screen tint is cleared (no black screen left) and the player has control again", ops: [
      { kind: "hold", ms: 6500 },
    ], expect: {}, shot: true },
  ],
};
