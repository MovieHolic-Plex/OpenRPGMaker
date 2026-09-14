// Runtime contract fixture authored through the real AI tool, not by assigning system.opening.
// Minimal engine fixture; never shipped as demo content or persisted remotely.
import { readFileSync } from "node:fs";
import { createBlankProject } from "../../../src/project/defaults";
import { runTool } from "../../../src/editor/tools/toolRunner";
import { deserialize, serialize } from "../../../src/project/io";

const project = createBlankProject();
project.meta.title = "AI opening runtime contract";
project.startPos = { x: 4, y: 4 };
if (project.system.titleScreen) project.system.titleScreen.musicResourceId = "";

const movie = readFileSync(new URL("../../../test/fixtures/cinematics/contract.webm", import.meta.url));
const voice = Buffer.alloc(44 + 16000);
voice.write("RIFF"); voice.writeUInt32LE(voice.length - 8, 4); voice.write("WAVEfmt ", 8);
voice.writeUInt32LE(16, 16); voice.writeUInt16LE(1, 20); voice.writeUInt16LE(1, 22);
voice.writeUInt32LE(8000, 24); voice.writeUInt32LE(16000, 28); voice.writeUInt16LE(2, 32);
voice.writeUInt16LE(16, 34); voice.write("data", 36); voice.writeUInt32LE(16000, 40);
project.assets.uploaded["ai-opening-picture"] = {
  id: "ai-opening-picture",
  name: "AI opening still",
  kind: "picture",
  dataUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  meta: { width: 1, height: 1 },
};
project.assets.uploaded["ai-opening-video"] = {
  id: "ai-opening-video",
  name: "AI opening clip",
  kind: "movie",
  dataUrl: `data:video/webm;base64,${movie.toString("base64")}`,
  meta: { width: 32, height: 24 },
};
project.assets.uploaded["ai-opening-voice"] = {
  id: "ai-opening-voice",
  name: "AI opening narration",
  kind: "sound",
  dataUrl: `data:audio/wav;base64,${voice.toString("base64")}`,
  meta: { width: 0, height: 0 },
};

const ctx = { project };
const authored = runTool(ctx, "set_opening", {
  enabled: true,
  skippable: true,
  scenes: [
    { id: "ai-opening-text", kind: "text", narration: "AI가 지은 첫 장면\n커스텀 오프닝 계약", durationMs: 0, narrationAudioResourceId: "ai-opening-voice" },
    { id: "ai-opening-image", kind: "image", resourceId: "ai-opening-picture", narration: "AI가 고른 그림", durationMs: 0, motion: "pan" },
    { id: "ai-opening-video", kind: "video", resourceId: "ai-opening-video", narration: "AI가 고른 영상", durationMs: 0 },
  ],
});
if (!authored.ok) {
  console.error(authored.summary);
  process.exit(1);
}

const json = serialize(ctx.project);
deserialize(json);
process.stdout.write(json);
