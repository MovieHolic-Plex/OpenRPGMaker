// 모델 없이 충돌 컷신 도구 사슬을 끝까지 돌린다(그림 생성기는 로컬 파일로 대체). 사용:
//   bun scripts/qa-game/cutscene-impact-offline.mts <입력그림폴더> <출력폴더>
// 입력: backdrop.png · vehicle.png(마젠타 배경, 왼쪽을 봄) · victim.png(마젠타 배경). 출력: project.json · preview.png · tool-results.json
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createBlankProject } from "../../src/project/defaults";
import { serialize } from "../../src/project/io";
import { runTool } from "../../src/editor/tools/toolRunner";
import { prepareTool } from "../../src/editor/tools/asyncToolRunner";
import { setCutsceneArtGenerator } from "../../src/editor/tools/cutsceneArtTools";
import { setCutsceneAssetFetcher } from "../../src/editor/cutsceneArt/charsetFrames";
import { headlessFetchAsset } from "./lib/headlessImage.mts";
import { cutscenePreviewImages } from "../../src/editor/tools/cutscenePreviewTools";

const [inDir, outDir] = process.argv.slice(2);
if (!inDir || !outDir) throw new Error("usage: cutscene-impact-offline.mts <inDir> <outDir>");
mkdirSync(outDir, { recursive: true });
const files: Record<string, string> = { backdrop: "backdrop.png", truck: "vehicle.png" };
setCutsceneArtGenerator(async (request) => {
  const key = request.prompt.includes("background") ? "backdrop" : "truck";
  return { dataUrl: `data:image/png;base64,${readFileSync(join(inDir, files[key]!)).toString("base64")}`, mimeType: "image/png", model: "offline", provider: "offline" };
});
setCutsceneAssetFetcher(headlessFetchAsset);
const ctx = { project: createBlankProject() };
const log: unknown[] = [];
async function call(name: string, args: Record<string, unknown>): Promise<Record<string, any>> {
  await prepareTool(name, args);
  const result = runTool(ctx, name, args, { dryRun: false });
  log.push({ name, args: JSON.stringify(args).slice(0, 200), ok: result.ok, summary: result.summary, warnings: result.warnings, data: result.data });
  if (!result.ok) throw new Error(`${name}: ${result.summary} ${JSON.stringify(result.issues ?? [])}`);
  return result.data as Record<string, any>;
}
const backdrop = await call("generate_cutscene_art", { role: "backdrop", prompt: "empty city street at dusk background with crosswalk", name: "거리" });
const truck = await call("generate_cutscene_art", { role: "sprite", prompt: "white box delivery truck, side-on with roof visible, facing left", name: "트럭", tiles: 6 });
const mapId = ctx.project.startMapId;
const staged = await call("script_cutscene_staged", {
  mapId, backdropResourceId: backdrop.resourceId,
  actors: [
    { name: "인물", character: { resourceId: "tex_easyrpg_charset_actor1", characterIndex: 0 }, at: { fx: 0.18, fy: 0.68 } },
    { name: "트럭", resourceId: truck.resourceId, facing: "left" },
  ],
  steps: [
    { do: "say", speaker: "", text: "신제품 아이스크림 나왔다고? 퇴근길에 사 가야지.", context: "thought" },
    { do: "move", actor: "인물", to: { fx: 0.5, fy: 0.68 }, ms: 1800, anim: "walk" },
    { do: "enter", actor: "트럭", from: "right", to: { touch: "인물", overlap: 0.35, dy: 6 }, ms: 520 },
    { do: "expect", touching: ["트럭", "인물"] },
    { do: "flash", withPrevious: true }, { do: "shake", withPrevious: true },
    { do: "fling", actor: "인물", dir: "left", withPrevious: true },
    { do: "exit", actor: "트럭", exitTo: "left", ms: 700, withPrevious: true },
    { do: "whiteout", ms: 900 },
    { do: "say", speaker: "", text: "눈을 떴을 때, 세상은 새하얗게 비어 있었다.", context: "narration" },
  ],
});
const impact = staged;
const preview = await call("preview_cutscene", { mapId, eventId: impact.eventId });
const images = await cutscenePreviewImages(ctx.project, { mapId, eventId: impact.eventId });
if (images[0]) writeFileSync(join(outDir, "preview.png"), Buffer.from(images[0].dataUrl.split(",")[1]!, "base64"));
ctx.project.system.opening = { enabled: false, skippable: true, scenes: [] };
writeFileSync(join(outDir, "project.json"), serialize(ctx.project));
writeFileSync(join(outDir, "tool-results.json"), JSON.stringify({ log, preview }, null, 2));
console.log(JSON.stringify({ layout: impact.layout, previewWarnings: log.at(-1) && (log.at(-1) as any).warnings, frames: preview.frameTimesMs, overlap: preview.impactOverlap }, null, 1));
