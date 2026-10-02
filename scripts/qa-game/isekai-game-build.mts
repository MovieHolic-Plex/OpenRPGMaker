// 「트럭에 치여 포켓몬풍 세계로」 데모를 도구 사슬로 짓는다(모델 없이, 그림 생성기만 부분 대체).
//   QA_IMAGE_PROVIDER=codex bun scripts/qa-game/isekai-game-build.mts <그림폴더> <출력폴더>
// 그림폴더: backdrop.png · vehicle.png · fox_magenta.png (마젠타 배경). 불꽃은 실제 이미지 모델로 만든다.
// 출력: project.json · preview-truck.png · preview-field.png · tool-results.json
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createScarloxyPokemonDemoProject } from "../../src/project/defaults/defaultProject";
import { serialize } from "../../src/project/io";
import { runTool } from "../../src/editor/tools/toolRunner";
import { prepareTool } from "../../src/editor/tools/asyncToolRunner";
import { setCutsceneArtGenerator } from "../../src/editor/tools/cutsceneArtTools";
import { setCutsceneAssetFetcher } from "../../src/editor/cutsceneArt/charsetFrames";
import { headlessFetchAsset, headlessGenerateImage } from "./lib/headlessImage.mts";
import { cutscenePreviewImages } from "../../src/editor/tools/cutscenePreviewTools";

const [inDir, outDir] = process.argv.slice(2);
if (!inDir || !outDir) throw new Error("usage: isekai-game-build.mts <inDir> <outDir>");
mkdirSync(outDir, { recursive: true });
const FILES: Record<string, string> = { XBACKDROPX: "backdrop.png", XTRUCKX: "vehicle.png", XFOXX: "fox_magenta.png" };
setCutsceneArtGenerator(async (request) => {
  const tag = Object.keys(FILES).find((key) => request.prompt.includes(key));
  if (!tag) return headlessGenerateImage(request);
  return { dataUrl: `data:image/png;base64,${readFileSync(join(inDir, FILES[tag]!)).toString("base64")}`, mimeType: "image/png", model: "file", provider: "file" };
});
setCutsceneAssetFetcher(headlessFetchAsset);

const ctx = { project: createScarloxyPokemonDemoProject() };
const log: unknown[] = [];
async function call(name: string, args: Record<string, unknown>): Promise<Record<string, any>> {
  await prepareTool(name, args);
  const result = runTool(ctx, name, args, { dryRun: false });
  log.push({ name, ok: result.ok, summary: result.summary, warnings: result.warnings, data: result.data });
  if (!result.ok) throw new Error(`${name}: ${result.summary} ${JSON.stringify(result.issues ?? [])}`);
  return result.data as Record<string, any>;
}

// 소리
const SE = {
  horn: "cc0-se-kjg-steel-jingles-jingles-steel03",
  whoosh: "easyrpg-sound-wind8",
  hit: "cc0-se-kis-impactpunch-heavy-000",
  boom: "cc0-se-osx-explosion",
  fall: "easyrpg-sound-fall1",
  step: "cc0-se-kra-footstep00",
  teleport: "easyrpg-sound-teleport2",
  grass: "cc0-se-kis-footstep-grass-000",
  roar: "cc0-se-ors-creature-roar-01",
  fireInhale: "cc0-se-ors-spell-fire-01",
  fireBurst: "easyrpg-sound-fire3",
  burn: "cc0-se-kis-impactpunch-heavy-002",
};
const BGM = { street: "cc0-bgm-rtp-crx-001", field: "cc0-bgm-rtp-flt-001", danger: "cc0-bgm-battle" };

// 타이틀·시작
ctx.project.meta = { ...ctx.project.meta, title: "트럭에 치였더니 몬스터 세계" };
if (ctx.project.system.titleScreen) ctx.project.system.titleScreen = { ...ctx.project.system.titleScreen, title: "트럭에 치였더니 몬스터 세계", subtitle: "이세계 오프닝 데모" } as typeof ctx.project.system.titleScreen;
ctx.project.system.opening = { enabled: false, skippable: true, scenes: [] };

const ROUTE = "map_pkmn_route";
const route = ctx.project.maps[ROUTE]!;
// 도착 칸 — 주인공이 화면 한가운데 오지 않을 수 있어 카메라 한계를 계산해 화면 속 위치를 구한다.
const HERO_TILE = { x: 8, y: 7 };
const T = 16, VW = 320, VH = 240;
const camX = Math.max(0, Math.min(route.width * T - VW, HERO_TILE.x * T + T / 2 - VW / 2));
const camY = Math.max(0, Math.min(route.height * T - VH, HERO_TILE.y * T + T / 2 - VH / 2));
const heroScreen = { x: Math.round(HERO_TILE.x * T + T / 2 - camX), y: Math.round((HERO_TILE.y + 1) * T - camY) };

// ① 횡단보도 장면(맵 + 그림)
// 컷신 전용 무대 — 그림이 화면을 덮으므로 바닥은 통행 가능하기만 하면 된다(초원 맵 사본에서 이벤트를 걷어 낸다).
const crossMapId = "map_isekai_crosswalk";
ctx.project.maps[crossMapId] = { ...structuredClone(route), id: crossMapId, name: "퇴근길 횡단보도", events: [] } as typeof route;
ctx.project.mapTree = { ...ctx.project.mapTree, children: [...(ctx.project.mapTree.children ?? []), { mapId: crossMapId, children: [] }] } as typeof ctx.project.mapTree;
ctx.project.startMapId = crossMapId;
ctx.project.startPos = { x: 10, y: 8 };
const backdrop = await call("generate_cutscene_art", { role: "backdrop", prompt: "XBACKDROPX empty city street at dusk with crosswalk", name: "횡단보도 거리" });
const truck = await call("generate_cutscene_art", { role: "sprite", prompt: "XTRUCKX white box delivery truck facing left", name: "트럭", tiles: 6 });
const HERO = { resourceId: "scarloxy-charset-people1", characterIndex: 0 };
const truckCut = await call("script_cutscene_staged", {
  mapId: crossMapId, backdropResourceId: backdrop.resourceId, eventId: "ev_isekai_truck",
  actors: [
    { name: "인물", character: HERO, at: { fx: 0.14, fy: 0.68 } },
    { name: "트럭", resourceId: truck.resourceId, facing: "left" },
  ],
  steps: [
    { do: "bgm", resourceId: BGM.street },
    { do: "say", speaker: "", text: "신제품 아이스크림 나왔다고? 퇴근길에 사 가야지.", context: "thought" },
    { do: "move", actor: "인물", to: { fx: 0.5, fy: 0.68 }, ms: 1900, anim: "walk" },
    { do: "se", resourceId: SE.step, withPrevious: true },
    { do: "wait", ms: 500 },
    { do: "se", resourceId: SE.horn },
    { do: "wait", ms: 450 },
    { do: "se", resourceId: SE.whoosh },
    { do: "enter", actor: "트럭", from: "right", to: { touch: "인물", overlap: 0.35, dy: 6 }, ms: 520, withPrevious: true },
    { do: "expect", touching: ["트럭", "인물"] },
    { do: "se", resourceId: SE.hit },
    { do: "se", resourceId: SE.boom, withPrevious: true },
    { do: "flash", withPrevious: true }, { do: "shake", withPrevious: true },
    { do: "fling", actor: "인물", dir: "left", withPrevious: true },
    { do: "exit", actor: "트럭", exitTo: "left", ms: 700, withPrevious: true },
    { do: "wait", ms: 500 },
    { do: "se", resourceId: SE.fall },
    { do: "whiteout", ms: 1100 },
    { do: "say", speaker: "", text: "……쿵.", context: "narration" },
    { do: "say", speaker: "", text: "눈을 떴을 때, 세상은 새하얗게 비어 있었다.", context: "narration" },
    { do: "clear" },
    { do: "transfer", mapId: ROUTE, x: HERO_TILE.x, y: HERO_TILE.y, faceDir: "down", fadeColor: "white" },
  ],
});
const truckPreview = await cutscenePreviewImages(ctx.project, { mapId: crossMapId, eventId: truckCut.eventId });
if (truckPreview[0]) writeFileSync(join(outDir, "preview-truck.png"), Buffer.from(truckPreview[0].dataUrl.split(",")[1]!, "base64"));

// ② 새 세계 — 어리둥절, 그리고 불여우
const fox = await call("generate_cutscene_art", { role: "sprite", prompt: "XFOXX orange fox monster with a flame tail", name: "엠버킷", tiles: 4 });
const fireball = await call("generate_cutscene_art", { role: "sprite", style: "game", prompt: "a single round orange fireball with a short flame trail pointing right, bright yellow core, red-orange outer flame, facing left toward the target, compact shape", name: "불꽃", tiles: 2 });
const fieldCut = await call("script_cutscene_staged", {
  mapId: ROUTE, eventId: "ev_isekai_ember", x: HERO_TILE.x, y: HERO_TILE.y + 2,
  actors: [
    { name: "인물", ghost: true, at: { x: heroScreen.x, y: heroScreen.y } },
    { name: "엠버킷", resourceId: fox.resourceId, facing: "left" },
    { name: "불꽃", resourceId: fireball.resourceId, facing: "left" },
  ],
  steps: [
    { do: "whiteout", ms: 0 },
    { do: "bgm", resourceId: BGM.field },
    { do: "se", resourceId: SE.teleport },
    { do: "dewhite", ms: 1800 },
    { do: "say", speaker: "", text: "……으윽. 머리가…… 트럭은…… 어떻게 된 거지?", context: "thought" },
    { do: "se", resourceId: SE.grass },
    { do: "wait", ms: 400 },
    { do: "say", speaker: "", text: "하늘이 너무 파랗다. 풀 냄새도 진짜 같아. 저 나무들은…… 게임에서 본 것 같은데?", context: "thought" },
    { do: "say", speaker: "", text: "여긴 어디야? 분명 횡단보도였는데!", context: "speech" },
    { do: "se", resourceId: SE.whoosh },
    { do: "shake", intensity: 3, ms: 700 },
    { do: "say", speaker: "", text: "……방금 풀숲에서 소리가 났나?", context: "thought" },
    { do: "bgm", resourceId: BGM.danger },
    { do: "se", resourceId: SE.roar },
    { do: "enter", actor: "엠버킷", from: "right", to: { at: "인물", side: "right", gap: 36 }, ms: 420, ease: "out" },
    { do: "shake", intensity: 5, ms: 400, withPrevious: true },
    { do: "say", speaker: "", text: "여, 여우?! 꼬리에 불이 붙어 있어!", context: "shout" },
    { do: "se", resourceId: SE.fireInhale },
    { do: "wait", ms: 700 },
    { do: "show", actor: "불꽃", to: { at: "엠버킷", side: "left", gap: 0 } },
    { do: "se", resourceId: SE.fireBurst },
    { do: "move", actor: "불꽃", to: { touch: "인물", overlap: 0.4, dy: -6 }, ms: 380, ease: "in" },
    { do: "expect", touching: ["불꽃", "인물"] },
    { do: "hide", actor: "불꽃" },
    { do: "se", resourceId: SE.boom },
    { do: "se", resourceId: SE.burn, withPrevious: true },
    { do: "flash", color: "red", ms: 700, withPrevious: true },
    { do: "shake", intensity: 14, ms: 900, withPrevious: true },
    { do: "say", speaker: "", text: "으아아악——!!", context: "shout" },
    { do: "fade", direction: "out", ms: 900 },
    { do: "hide", actor: "엠버킷" },
    { do: "say", speaker: "", text: "트럭 다음은 불여우라니. 이세계, 너무 거칠다.", context: "narration" },
    { do: "fade", direction: "in", ms: 700 },
  ],
});
const fieldPreview = await cutscenePreviewImages(ctx.project, { mapId: ROUTE, eventId: fieldCut.eventId });
if (fieldPreview[0]) writeFileSync(join(outDir, "preview-field.png"), Buffer.from(fieldPreview[0].dataUrl.split(",")[1]!, "base64"));

writeFileSync(join(outDir, "project.json"), serialize(ctx.project));
writeFileSync(join(outDir, "tool-results.json"), JSON.stringify({ heroScreen, log }, null, 2));
console.log(JSON.stringify({ truck: truckCut.eventId, field: fieldCut.eventId, heroScreen, calls: log.length }));
process.exit(0);
