// Minimal engine contract fixture; never shipped as demo content or persisted remotely.
import { readFileSync } from "node:fs";
import { createBlankProject } from "../../../src/project/defaults";
import { DEFAULT_EASYRPG_CHARSET_ID } from "../../../src/project/defaults/constants";
import { deserialize, serialize } from "../../../src/project/io";
import type { Command } from "../../../src/project/types";
const project = createBlankProject();
project.meta.title = "Cinematic runtime contract";
project.startPos = { x: 4, y: 4 };
if (project.system.titleScreen) project.system.titleScreen.musicResourceId = "";
const movie = readFileSync(new URL("../../../test/fixtures/cinematics/contract.webm", import.meta.url));
// A valid quiet PCM WAV, kept generated so no narration/content asset is authored.
const voice = Buffer.alloc(44 + 16000);
voice.write("RIFF"); voice.writeUInt32LE(voice.length - 8, 4); voice.write("WAVEfmt ", 8);
voice.writeUInt32LE(16, 16); voice.writeUInt16LE(1, 20); voice.writeUInt16LE(1, 22);
voice.writeUInt32LE(8000, 24); voice.writeUInt32LE(16000, 28); voice.writeUInt16LE(2, 32);
voice.writeUInt16LE(16, 34); voice.write("data", 36); voice.writeUInt32LE(16000, 40);
project.assets.uploaded["cinematic-video"] = { id: "cinematic-video", name: "Contract video", kind: "movie", dataUrl: `data:video/webm;base64,${movie.toString("base64")}`, meta: { width: 32, height: 24 } };
project.assets.uploaded["cinematic-voice"] = { id: "cinematic-voice", name: "Contract voice", kind: "sound", dataUrl: `data:audio/wav;base64,${voice.toString("base64")}`, meta: { width: 0, height: 0 } };
project.system.opening = { enabled: true, skippable: true, scenes: [
  { id: "opening-text", kind: "text", narration: "Opening contract\nKeyboard-only playback", durationMs: 0, narrationAudioResourceId: "cinematic-voice" },
  { id: "opening-image", kind: "image", resourceId: "oprn-title-field", narration: "Image and motion contract", durationMs: 0, motion: "pan" },
  { id: "opening-video", kind: "video", resourceId: "cinematic-video", narration: "Video contract", durationMs: 0, narrationAudioResourceId: "cinematic-voice" },
] };
project.system.gameOver = {
  sequence: { enabled: true, skippable: false, scenes: [
    { id: "defeat-text", kind: "text", narration: "Game-over contract", durationMs: 0 },
    { id: "defeat-video", kind: "video", resourceId: "cinematic-video", narration: "Unskippable video contract", durationMs: 0 },
  ] },
  title: "Terminal contract", message: "Configured fallback", retryLabel: "Checkpoint retry", titleLabel: "Return to title", backgroundResourceId: "oprn-title-field",
};
const commands: Command[] = [{ kind: "checkpointSave" }, { kind: "killPlayer", message: "Event message wins" }];
project.maps[project.startMapId].events = [{ id: "contract-defeat", x: 5, y: 4,
  trigger: { kind: "action" }, commands, pages: [{ id: "contract-page", name: "Contract", conditions: [],
    graphic: { sprite: { type: "bundled", id: DEFAULT_EASYRPG_CHARSET_ID }, direction: "down", pattern: 0 },
    trigger: { kind: "action" }, priority: "same", movement: { type: "fixed", speed: 3, frequency: 3 }, commands,
  }],
}];
const json = serialize(project);
deserialize(json); // Fail at fixture generation, not after a browser boot timeout.
process.stdout.write(json);
