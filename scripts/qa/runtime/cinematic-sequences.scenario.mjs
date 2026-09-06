import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from "node:fs";
import { join } from "node:path";
// Build a unique, ephemeral fixture with the real serializer. No demo/DB writes.
mkdirSync(".omo/runtime-qa", { recursive: true });
const temporary = mkdtempSync(".omo/runtime-qa/cinematics-");
const fixture = join(temporary, "project.json");
process.on("exit", () => { rmSync(temporary, { recursive: true, force: true }); console.log("Cinematic fixture cleanup: removed", temporary); });
writeFileSync(fixture, execFileSync(process.execPath, ["node_modules/vite-node/vite-node.mjs", "--script", "scripts/qa/runtime/cinematic-sequences-fixture.mts"], { maxBuffer: 20 * 1024 * 1024 }));
const keyTo = (key, selector, absent = false) => ({ kind: "cinematic", action: "key", key, selector, absent });
const scene = id => `[data-testid="cinematic-sequence"][data-scene-id="${id}"]`;
const terminal = '[data-testid="checkpoint-retry"]';
export default {
  id: "cinematic-sequences", projectFixture: fixture,
  beats: [
    { id: "opening-text", note: "New Game waits before map boot; held keys and pointer cannot advance", ops: [
      { kind: "cinematic", action: "reject-autoplay" },
      keyTo("Enter", `${scene("opening-text")}[data-media-state="blocked"]`),
      { kind: "cinematic", action: "input", beforeMap: true },
      keyTo("r", `${scene("opening-text")}[data-media-state="ready"]`), { kind: "cinematic", action: "geometry" },
    ], expect: { testidPresent: ["cinematic-sequence"], testidAbsent: ["runtime-state-json", "main-menu"] }, shot: true },
    { id: "opening-image", note: "Image motion and reduced-motion override", ops: [
      keyTo("Enter", scene("opening-image")), { kind: "cinematic", action: "reduced-motion" }, { kind: "cinematic", action: "geometry" },
    ], expect: { testidPresent: ["cinematic-sequence"] }, shot: true },
    { id: "opening-video", note: "Uploaded video with separate narration before map boot", ops: [
      keyTo("Space", scene("opening-video")),
    ], expect: { testidPresent: ["cinematic-sequence"] }, shot: true },
    { id: "map-after-opening", note: "Native video ended enters the map once and releases video/narration", ops: [
      { kind: "cinematic", action: "video-end" },
    ], expect: { mapId: "map_blank_start", x: 4, y: 4, testidAbsent: ["cinematic-sequence", "main-menu"] } },
    { id: "game-over-text", note: "Checkpoint and killPlayer use shared playback before terminal", ops: [
      { kind: "face", dir: "right" }, keyTo("Enter", scene("defeat-text")), { kind: "cinematic", action: "input" },
    ], expect: { testidAbsent: ["checkpoint-retry"], testidPresent: ["game-over-screen"] }, shot: true },
    { id: "game-over-video-error", note: "Even unskippable broken media has a keyboard continuation", ops: [
      keyTo("Enter", scene("defeat-video")), { kind: "cinematic", action: "video-error" },
    ], expect: { testidAbsent: ["checkpoint-retry"] }, shot: true },
    { id: "terminal", note: "Configured labels/background and event-supplied message; no confirm fallthrough", ops: [keyTo("Enter", terminal), { kind: "cinematic", action: "geometry" }],
      expect: { visibleText: { "game-over-screen": "Event message wins", "checkpoint-retry": "Checkpoint retry", "return-title": "Return to title" }, x: 4, y: 4 }, shot: true },
    { id: "checkpoint-retry", note: "Checkpoint restore resumes map without replaying opening", ops: [keyTo("Enter", '[data-testid="game-over-screen"]', true)],
      expect: { mapId: "map_blank_start", x: 4, y: 4, testidAbsent: ["cinematic-sequence", "game-over-screen"] } },
    { id: "repeated-game-over", note: "A second defeat has exactly the same usable lifecycle", ops: [
      { kind: "face", dir: "right" }, keyTo("Enter", scene("defeat-text")), keyTo("Enter", scene("defeat-video")),
      { kind: "cinematic", action: "video-error" }, keyTo("Enter", terminal), keyTo("Escape", '[data-testid="title-screen"]'),
    ], expect: { testidPresent: ["title-screen"], testidAbsent: ["cinematic-sequence", "game-over-screen"] }, shot: true },
    { id: "opening-skip", note: "New Game again, Escape skips the entire opening and does not open menu", ops: [
      keyTo("Enter", scene("opening-text")), keyTo("Escape", '[data-testid="runtime-state-json"]'),
    ], expect: { mapId: "map_blank_start", testidAbsent: ["cinematic-sequence", "main-menu"] } },
    { id: "host-teardown", note: "Removing the live game-over host releases media sources and playback", ops: [
      { kind: "face", dir: "right" }, keyTo("Enter", scene("defeat-text")), keyTo("Enter", scene("defeat-video")), { kind: "cinematic", action: "detach" },
    ], expect: { testidAbsent: ["cinematic-sequence", "game-over-screen"] } },
  ],
};
