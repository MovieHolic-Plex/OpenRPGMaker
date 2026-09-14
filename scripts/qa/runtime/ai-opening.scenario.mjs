import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from "node:fs";
import { join } from "node:path";
// The fixture is produced by the real set_opening tool, so this scenario proves the
// authored record reaches player.html instead of a hand-written system.opening.
mkdirSync(".omo/runtime-qa", { recursive: true });
const temporary = mkdtempSync(".omo/runtime-qa/ai-opening-");
const fixture = join(temporary, "project.json");
process.on("exit", () => { rmSync(temporary, { recursive: true, force: true }); console.log("AI opening fixture cleanup: removed", temporary); });
writeFileSync(fixture, execFileSync(process.execPath, ["node_modules/vite-node/vite-node.mjs", "--script", "scripts/qa/runtime/ai-opening-fixture.mts"], { maxBuffer: 20 * 1024 * 1024 }));

const scene = id => `[data-testid="cinematic-sequence"][data-scene-id="${id}"]`;
const keyTo = (key, selector, absent = false) => ({ kind: "cinematic", action: "key", key, selector, absent });

export default {
  id: "ai-opening", projectFixture: fixture,
  beats: [
    { id: "ai-opening-text", note: "New Game plays the AI-authored text scene before map boot", ops: [
      keyTo("Enter", scene("ai-opening-text")),
    ], expect: { testidPresent: ["cinematic-sequence"], testidAbsent: ["runtime-state-json", "main-menu"], visibleText: { "cinematic-sequence": "커스텀 오프닝 계약" } }, shot: true },
    { id: "ai-opening-image", note: "Second AI-authored scene is an uploaded picture with pan motion", ops: [
      keyTo("Enter", scene("ai-opening-image")),
    ], expect: { testidPresent: ["cinematic-sequence"], visibleText: { "cinematic-sequence": "AI가 고른 그림" } }, shot: true },
    { id: "ai-opening-video", note: "Third AI-authored scene is an uploaded video", ops: [
      keyTo("Enter", scene("ai-opening-video")),
    ], expect: { testidPresent: ["cinematic-sequence"] }, shot: true },
    { id: "ai-opening-enters-map", note: "After the last scene the map boots at the authored start position", ops: [
      { kind: "cinematic", action: "video-end" },
    ], expect: { mapId: "map_blank_start", x: 4, y: 4, testidAbsent: ["cinematic-sequence", "main-menu"] } },
  ],
};
