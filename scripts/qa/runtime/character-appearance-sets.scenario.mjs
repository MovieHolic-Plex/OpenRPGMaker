import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { rmSync } from "node:fs";
import { join, resolve } from "node:path";

// A minimal test-only project; never written to the authored project database.
// The uploaded charset is an unmodified copy of existing manual art.
const project = JSON.parse(await readFile(new URL("../../../test/fixtures/projects/event-pages-v3.json", import.meta.url), "utf8"));
const charset = await readFile(new URL("../../../public/assets/easyrpg/charset/Actor1.png", import.meta.url));
const bust = await readFile(new URL("../../../public/assets/generated/faces/actor1-bust.png", import.meta.url));
project.meta.title = "Character appearance sets runtime QA";
project.assets.uploaded = {
  "qa-manual-charset": {
    id: "qa-manual-charset", name: "Manual Actor1 copy", kind: "charset",
    dataUrl: `data:image/png;base64,${charset.toString("base64")}`,
    meta: { width: 288, height: 256, frameWidth: 24, frameHeight: 32 },
  },
  "qa-standing-art": {
    id: "qa-standing-art", name: "Optional bust", kind: "picture",
    dataUrl: `data:image/png;base64,${bust.toString("base64")}`, meta: {},
  },
};
project.database.characterAppearances = [
  { id: "qa-guide", name: "Guide", description: "Manual slot five", charset: { resourceId: "qa-manual-charset", characterIndex: 5 }, face: { resourceId: "easyrpg-faceset-actor1-03" }, bust: { resourceId: "qa-standing-art" } },
  { id: "qa-face-only", name: "Face only", description: "", face: { resourceId: "easyrpg-faceset-actor2-04" } },
  { id: "qa-empty", name: "Empty set", description: "" },
];
project.database.actors[0].appearanceId = "qa-guide";
project.system.systemResourceId = undefined;
project.system.battleSystemResourceId = undefined;
project.system.titleResourceId = undefined;
project.startPos = { x: 8, y: 7 };
const map = project.maps[project.startMapId];
map.width = 20;
map.height = 15;
map.lowerTiles = Array(300).fill(0);
map.upperTiles = Array(300).fill(-1);
const portrait = (appearanceId, presentation) => ({ kind: "changeFace", resourceId: "", appearanceId, presentation, position: "left", flipHorizontally: false });
const text = (body) => ({ kind: "text", body });
const basePage = {
  id: "qa-page", name: "Guide", conditions: [],
  graphic: { appearanceId: "qa-guide", direction: "left", pattern: 1 },
  trigger: { kind: "action" }, priority: "same", overlapForbidden: true,
  movement: { type: "fixed", speed: 3, frequency: 3 },
  commands: [
    text("Automatic default portrait."),
    { kind: "changeFace", resourceId: "", position: "left", flipHorizontally: false },
    text("Explicit clear."),
    portrait("qa-guide", "bust"),
    text("Explicit bust from a resource without a bust filename."),
    portrait("qa-face-only", "bust"),
    text("Missing bust falls back to face."),
    { kind: "setSwitch", switchId: "sw_page", value: true },
  ],
};
map.events = [{
  id: "qa-guide-event", x: 9, y: 7, trigger: { kind: "action" }, commands: [],
  pages: [basePage, {
    ...basePage, id: "qa-empty-page", name: "Empty portrait",
    conditions: [{ kind: "switch", switchId: "sw_page", value: true }],
    graphic: { ...basePage.graphic, appearanceId: "qa-empty", sprite: { type: "bundled", id: "tex_easyrpg_charset_people1" } },
    commands: [text("New event interaction has no inherited portrait.")],
  }],
}];
// Unique, worktree-local output prevents parallel QA runs sharing a fixture.
const directory = await mkdtemp(resolve(".appearance-runtime-qa-"));
export function cleanupCharacterAppearanceFixture() {
  rmSync(directory, { recursive: true, force: true });
  process.off("exit", cleanupCharacterAppearanceFixture);
}
process.once("exit", cleanupCharacterAppearanceFixture);
const projectFixture = join(directory, "project.json");
await writeFile(projectFixture, JSON.stringify(project));

const face = { kind: "waitFor", testid: "dialogue-face", state: "present" };
const advance = (state) => ({ kind: "pressUntil", key: "Enter", testid: "dialogue-face", state });

/** @type {import("../../lib/runtimeQa.d.mts").RuntimeQaScenario} */
export const characterAppearanceSetsScenario = {
  id: "character-appearance-sets",
  projectFixture,
  beats: [
    {
      id: "manual-uploaded-slot",
      note: "Player: uploaded charset slot 5, idle down frame 76. NPC: slot 5 left frame 88. Both use original Actor1 pixels.",
      ops: [{ kind: "key", key: "Enter" }, { kind: "waitForRuntime" }],
      expect: { x: 8, y: 7, playerSpriteTextureLoaded: true, playerSpriteResourceNonEmpty: true },
      shot: true,
    },
    {
      id: "automatic-page-face",
      ops: [{ kind: "face", dir: "right" }, { kind: "action" }, face, { kind: "waitForAttr", testid: "dialogue-face", attr: "data-face-mode", value: "face" }],
      expect: { testidPresent: ["dialogue-face"] },
      shot: true,
    },
    {
      id: "explicit-clear",
      ops: [advance("absent")],
      expect: { testidPresent: ["dialogue-box"], testidAbsent: ["dialogue-face"] },
      shot: true,
    },
    {
      id: "explicit-bust",
      ops: [advance("present"), { kind: "waitForAttr", testid: "dialogue-face", attr: "data-face-mode", value: "bust" }],
      expect: { testidPresent: ["dialogue-face"] },
      shot: true,
    },
    {
      id: "bust-fallback-face",
      ops: [{ kind: "pressUntil", key: "Enter", testid: "dialogue-face", attr: "data-face-mode", value: "face", state: "present" }],
      expect: { testidPresent: ["dialogue-face"] },
      shot: true,
    },
    {
      id: "next-page-empty-default",
      ops: [
        { kind: "pressUntil", key: "Enter", testid: "dialogue-box", state: "absent" },
        { kind: "action" },
        { kind: "waitFor", testid: "dialogue-box", state: "present" },
      ],
      expect: { testidPresent: ["dialogue-box"], testidAbsent: ["dialogue-face"] },
      shot: true,
    },
  ],
};

export default characterAppearanceSetsScenario;
