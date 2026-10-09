// 맵 배경 시차(깊이) + 흐름 배율 명령 — 회상 파노라마 연출을 출하 플레이어(player.html)로 찍어 GIF 로 만든다.
//
// 픽스처: 등불 마을 맵의 맨 아래 1행만 땅으로 남기고 전부 비운다(비운 칸 = 배경이 보이는 창). 배경은 CraftPix
// 구름 언덕 7장 세트이고, 층마다 편집기 「레이어 세트」 와 같은 기본 깊이(하늘 0 → 앞 구름 0.7)를 준다.
// 주인공이 오른쪽으로 걸으면 카메라가 따라가고, 층마다 다른 거리를 움직인다. 중간의 밟는 이벤트가
// 화면을 세피아로 물들이고 「먼 배경 변경」 흐름 배율 0% / 2.5초 를 건다 — 구름이 서서히 멈춘다.
//
// 사용: node scripts/qa/runtime/map-parallax.capture.mjs [--out <dir>] [--project <project.json>] [--walk <shots>]
//   --project 를 주면 픽스처 대신 그 프로젝트(예: 조수가 만든 것)의 시작 맵·시작 칸에서 오른쪽으로 걷는다.
// 결과: <dir>/frames/*.png, <dir>/map-parallax.gif, <dir>/receipt.json
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { chromium } from "@playwright/test";
import { craftpixDefaultLayers } from "../../../src/assets/ogaCraftpixBackgrounds.ts";
import { defaultLayerCameraFollow } from "../../../src/project/mapBackground.ts";
import { COMBINED_TOWN_PANORAMA_WINDOW_TILES } from "../../../src/project/defaults/generatedChipsetTransparency.ts";
import { performObservedFrames, pauseRuntimeFrames, startPlayerQaServer } from "../../lib/runtimeQaRun.mjs";

const outArg = process.argv.indexOf("--out");
const OUT = resolve(outArg > 0 ? process.argv[outArg + 1] : "verify-shots/map-parallax");
const FRAMES_DIR = join(OUT, "frames");
const SOURCE = "test/fixtures/projects/editor-authored-demo-v3.json";
const MAP_ID = "map_lantern_village";
const GROUND_ROWS = 1;
const GRASS = 240;
/** 파노라마 창 타일 — RM2K 방식이라 빈 칸은 검게 가려지고, 이 칸에서만 배경이 비친다. */
const WINDOW = COMBINED_TOWN_PANORAMA_WINDOW_TILES[0];
/** 카메라가 충분히 흐르도록 맵을 넓힌다(뷰포트 20칸 → 40칸 이동). */
const WIDTH = 60;
const TRIGGER_X = 30;
const SET_ID = "oga-craftpix-hills";

function buildFixture() {
  return readFile(SOURCE, "utf8").then((text) => {
    const project = JSON.parse(text);
    const map = project.maps[MAP_ID];
    const walkY = map.height - 1;
    map.width = WIDTH;
    map.lowerTiles = [];
    map.upperTiles = [];
    for (let y = 0; y < map.height; y += 1) {
      for (let x = 0; x < map.width; x += 1) {
        const ground = y >= map.height - GROUND_ROWS;
        map.lowerTiles.push(ground ? GRASS : WINDOW);
        map.upperTiles.push(-1);
      }
    }
    const layers = craftpixDefaultLayers(SET_ID);
    map.background = {
      imageId: layers[0].id,
      fit: "cover",
      layers: layers.slice(1).map((layer, index) => {
        const follow = defaultLayerCameraFollow(index + 1, layers.length);
        // 구름 층만 자동으로 흐른다 — 흐름 배율 명령이 멈추게 할 대상.
        const drifting = layer.id.includes("clouds") || layer.id.includes("birds");
        return {
          imageId: layer.id,
          fit: "cover",
          ...(follow > 0 ? { cameraFollow: follow } : {}),
          ...(drifting ? { scrollX: 0.6 } : {}),
        };
      }),
    };
    const page = (commands) => ({
      id: "ev_flashback-page",
      name: "회상 시작",
      conditions: [],
      trigger: { kind: "playerTouch" },
      graphic: { transparent: true },
      movement: { type: "fixed", speed: 3, frequency: 3 },
      priority: "below",
      overlapForbidden: false,
      commands,
    });
    map.events = [
      {
        id: "ev_flashback",
        name: "회상 시작",
        x: TRIGGER_X,
        y: walkY,
        trigger: { kind: "playerTouch" },
        commands: [],
        pages: [
          page([
            { kind: "m2Command", commandId: "m2-046-tint-screen", fields: { color: "neutral", value: "160,120,70,0.28", durationMs: 1500 } },
            {
              kind: "m2Command",
              commandId: "m2-069-change-parallax-back",
              fields: { resourceId: "", flowPercent: 0, flowDurationMs: 2500 },
            },
          ]),
        ],
      },
    ];
    project.startMapId = MAP_ID;
    project.startPos = { x: 3, y: walkY };
    return { project, walkY };
  });
}

const argValue = (name) => {
  const index = process.argv.indexOf(name);
  return index > 0 ? process.argv[index + 1] : undefined;
};
const externalProject = argValue("--project");
const WALK_SHOTS = Number(argValue("--walk") ?? 175);
const { project, walkY } = externalProject
  ? await readFile(externalProject, "utf8").then((text) => {
    const loaded = JSON.parse(text);
    return { project: loaded, walkY: loaded.startPos?.y };
  })
  : await buildFixture();
await rm(OUT, { recursive: true, force: true });
await mkdir(FRAMES_DIR, { recursive: true });
const server = await startPlayerQaServer();
let browser;
const errors = [];
const samples = [];
try {
  browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu"] });
  const pageHandle = await browser.newPage({ viewport: { width: 640, height: 480 } });
  pageHandle.on("pageerror", (error) => errors.push(error.message));
  pageHandle.on("console", (message) => {
    if (message.type() === "warning" || message.type() === "error") errors.push(`${message.type()}: ${message.text()}`);
  });
  await pageHandle.addInitScript(() => {
    window.__OPENRPG_BOOT__ = { projectUrl: "/__parallax/project.json", saveNamespace: "parallax-qa", qaInstrumentation: true };
  });
  await pageHandle.route("**/__parallax/project.json", (route) =>
    route.fulfill({ contentType: "application/json", body: JSON.stringify(project) }));
  await pageHandle.goto(`${server.url}/player.html`, { waitUntil: "domcontentloaded" });
  await pageHandle.waitForSelector('[data-testid="title-screen"]', { timeout: 60_000 });
  await pageHandle.keyboard.press("Enter");
  await pageHandle.waitForFunction(() => window.__oprnDebug?.readState?.().currentMapId, null, { timeout: 60_000 });
  await pageHandle.evaluate(() => window.__oprnDebug.setSeed(1));
  // 배경 텍스처가 붙을 때까지 벽시계로 돌린다(로더는 실제 시간에 묶여 있다).
  await pageHandle.waitForTimeout(1500);
  await pauseRuntimeFrames(pageHandle);
  if (process.env.PARALLAX_PROBE) {
    console.log(JSON.stringify(await pageHandle.evaluate(() => {
      const scene = window.__oprnHooksScene;
      return {
        background: scene?.map?.background,
        camera: { w: scene?.cameras?.main?.width, h: scene?.cameras?.main?.height, zoom: scene?.cameras?.main?.zoom, sx: scene?.cameras?.main?.scrollX },
        sprites: (scene?.mapBackgroundSprites ?? []).map((sprite) => ({
          key: sprite.texture.key, w: sprite.width, h: sprite.height, tsx: sprite.tileScaleX, tpx: sprite.tilePositionX, visible: sprite.visible,
          src: (() => { const image = scene.textures.get(sprite.texture.key).getSourceImage(); return [image.width, image.height]; })(),
        })),
      };
    }), null, 1));
    process.exit(0);
  }

  let shot = 0;
  const capture = async () => {
    await pageHandle.screenshot({ path: join(FRAMES_DIR, `${String(shot).padStart(3, "0")}.png`) });
    shot += 1;
  };
  const sample = async (label) => {
    samples.push({ label, ...(await pageHandle.evaluate(() => {
      const state = window.__oprnDebug.readState();
      return { x: state.x, y: state.y };
    })) });
  };
  // 1) 제자리 — 구름만 흐른다.
  for (let i = 0; i < 12; i += 1) {
    await performObservedFrames(pageHandle, { frames: 4, deltaMs: 16 });
    await capture();
  }
  await sample("start");
  // 2) 오른쪽으로 걷는다 — 카메라를 따라 층마다 다른 거리를 간다. 도중에 회상 이벤트를 밟는다.
  await pageHandle.evaluate(() => window.__oprnInput.dir("right"));
  for (let i = 0; i < WALK_SHOTS; i += 1) {
    await performObservedFrames(pageHandle, { frames: 4, deltaMs: 16 });
    await capture();
  }
  await pageHandle.evaluate(() => window.__oprnInput.dir(null));
  await sample("walked");
  // 3) 멈춰 선 채 — 흐름이 0 으로 가라앉는 것을 본다.
  for (let i = 0; i < 40; i += 1) {
    await performObservedFrames(pageHandle, { frames: 4, deltaMs: 16 });
    await capture();
  }
  await sample("settled");
  const flow = await pageHandle.evaluate(() => {
    const record = window.__oprnDebug.readState();
    return record.m2Runtime?.map?.parallax_flow ?? null;
  }).catch(() => null);
  await writeFile(join(OUT, "receipt.json"), JSON.stringify({ frames: shot, frameMs: 64, walkY, samples, flow, errors }, null, 2));
} finally {
  await browser?.close();
  await server.close();
}

const gif = join(OUT, "map-parallax.gif");
const ffmpeg = spawnSync("ffmpeg", [
  "-y", "-loglevel", "error", "-framerate", "15", "-i", join(FRAMES_DIR, "%03d.png"),
  "-vf", "split[a][b];[a]palettegen=max_colors=192[p];[b][p]paletteuse=dither=bayer:bayer_scale=4",
  "-loop", "0", gif,
], { stdio: "inherit" });
if (ffmpeg.status !== 0) throw new Error("GIF encoding failed");
console.log(JSON.stringify({ gif, samples, errors }, null, 2));
