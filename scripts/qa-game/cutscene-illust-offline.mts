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
import { headlessFetchAsset, headlessGenerateImage } from "./lib/headlessImage.mts";
import { cutscenePreviewImages } from "../../src/editor/tools/cutscenePreviewTools";

const [inDir, outDir] = process.argv.slice(2);
if (!inDir || !outDir) throw new Error("usage: cutscene-impact-offline.mts <inDir> <outDir>");
mkdirSync(outDir, { recursive: true });
setCutsceneArtGenerator(headlessGenerateImage);
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
const backdrop = await call("generate_cutscene_art", { role: "backdrop", style: "illustration", prompt: "a hazy childhood memory: a small stone bridge over a quiet stream at golden hour, soft watercolor illustration, dreamy faded edges, no people", name: "기억 속 다리" });
const scarf = await call("generate_cutscene_art", { role: "sprite", style: "illustration", prompt: "a single red wool scarf floating gently, soft watercolor illustration, simple clean shape", name: "붉은 목도리", tiles: 5 });
const mapId = ctx.project.startMapId;
const staged = await call("script_cutscene_staged", {
  mapId, backdropResourceId: backdrop.resourceId,
  actors: [{ name: "목도리", resourceId: scarf.resourceId, facing: "left", at: { fx: 0.5, fy: -0.2 } }],
  steps: [
    { do: "say", speaker: "", text: "다리 위에서 누군가 내 이름을 불렀다.", context: "narration" },
    { do: "move", actor: "목도리", to: { fx: 0.5, fy: 0.62 }, ms: 2400, ease: "out" },
    { do: "say", speaker: "", text: "그날의 목도리는 아직도 붉었다.", context: "narration" },
    { do: "flash" },
    { do: "exit", actor: "목도리", exitTo: "right", ms: 1400 },
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
