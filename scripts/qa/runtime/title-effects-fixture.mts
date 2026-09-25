// Runtime contract fixture for the title opening effects, authored through the same tool calls the
// editor's "AI 키아트" button applies (titleArtToolCalls → upsert_resource + set_title_screen).
// The keyart and fitted effects are the committed samples in verify-shots/title-opening/art.
// Minimal engine fixture; never shipped as demo content or persisted remotely.
import { existsSync, readFileSync } from "node:fs";
import { createBlankProject } from "../../../src/project/defaults";
import { runTool } from "../../../src/editor/tools/toolRunner";
import { deserialize, serialize } from "../../../src/project/io";
import { findTitleOpeningPreset } from "../../../src/project/titleEffects";
import { prepareTitleArtRequest } from "../../../src/editor/tools/titleArtTools";
import { titleArtToolCalls } from "../../../src/editor/titleArtGeneration";

const presetId = process.env.TITLE_FX_PRESET ?? "forestMorning";
const preset = findTitleOpeningPreset(presetId);
if (!preset) {
  console.error(`unknown preset ${presetId}`);
  process.exit(1);
}
const art = new URL(`../../../verify-shots/title-opening/art/${presetId}`, import.meta.url);
const image = readFileSync(new URL(`${art.href}.jpg`));
const fitFile = new URL(`${art.href}.effects.json`);
const fit = existsSync(fitFile) ? JSON.parse(readFileSync(fitFile, "utf8")) : undefined;

const project = createBlankProject();
project.meta.title = "Title opening effects contract";
project.startPos = { x: 4, y: 4 };

const request = prepareTitleArtRequest({ preset: presetId, title: "Oath of the Blade", logoSubtitle: "A new dawn" });
const calls = titleArtToolCalls({
  ok: true,
  request,
  resourceId: `title-art-${presetId}`,
  dataUrl: `data:image/jpeg;base64,${image.toString("base64")}`,
  effects: fit?.fitted?.length ? fit.effects : undefined,
});

const ctx = { project };
for (const call of calls) {
  const result = runTool(ctx, call.name, call.args);
  if (!result.ok) {
    console.error(`${call.name}: ${result.summary}`);
    process.exit(1);
  }
}
if (ctx.project.system.titleScreen) ctx.project.system.titleScreen.musicResourceId = "";

const json = serialize(ctx.project);
deserialize(json);
process.stdout.write(json);
