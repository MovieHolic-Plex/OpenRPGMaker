// 맵 배경(패럴랙스) 렌더 QA 픽스처.
//
// 시작 맵(`map_lantern_village`) 위쪽 `SKY_ROWS` 행을 비워 하늘 띠를 만들고, 시작 지점을 그
// 경계 바로 아래로 옮긴다. 배경 그림은 옵션으로 건다 — **같은 타일 배치에 배경만 뺀
// 대조군**(`--no-background`)과 비교해야 "하늘색 픽셀이 배경 그림에서 왔다" 가 증명된다.
// 런타임 QA 는 저장된 프로젝트 JSON 을 그대로 로드하므로 픽스처를 여기서 굽는다.
//
// 사용:
//   node scripts/qa/runtime/map-background-fixture.mjs --out /tmp/map-bg.json
//   node scripts/qa/runtime/map-background-fixture.mjs --out /tmp/map-bg-control.json --no-background
//   node scripts/qa/runtime/map-background-fixture.mjs --out /tmp/map-bg-zoom.json --zoom 0.5
//
// 그다음:
//   node scripts/runtime-qa.mjs --scenario map-background --project /tmp/map-bg.json \
//     --out verify-shots/runtime-qa/map-background
import { readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";

const SOURCE = "test/fixtures/projects/editor-authored-demo-v3.json";
const MAP_ID = "map_lantern_village";
/** 배경 그림이 없을 때 비어 있는 칸이 그려내는 것은 플레이 카메라의 검은 배경뿐이다. */
export const DEFAULT_BACKGROUND = { imageId: "easyrpg-backdrop-sky1", scrollX: 2, scrollY: 0 };

/**
 * 하늘 띠를 만들 시작 맵의 행 수. 6 이면 320×240 뷰포트(16px 타일 → 15행)의 위쪽
 * 40% 가 비고, 카메라가 시작 지점을 중앙에 두었을 때 띠가 전부 화면 안에 들어온다.
 */
export const SKY_ROWS = 6;
/** 하늘 띠 바로 아래 칸 — 주인공이 서고 카메라가 따라가는 자리다. */
export const START = { x: 14, y: SKY_ROWS + 2 };

/** 주인공이 선 칸에서 곧바로 도는 auto 이벤트 하나. 명령 하나를 얹는다. */
function autoCommandEvent({ id, name, command }) {
  return {
    id,
    name,
    x: START.x,
    y: START.y,
    trigger: { kind: "auto" },
    commands: [],
    pages: [
      {
        id: `${id}-page`,
        name,
        conditions: [],
        trigger: { kind: "auto" },
        graphic: { transparent: true },
        movement: { type: "fixed", speed: 3, frequency: 3 },
        priority: "same",
        overlapForbidden: false,
        commands: [command],
      },
    ],
  };
}

/**
 * 카메라 배율을 바꾸는 이벤트. 화면 고정 배경이 배율에서도 뷰포트를 덮는지 보려면
 * 배율을 1 이 아닌 값으로 만들어야 한다 — 배율 > 1 은 보정이 없어도 배경이 화면보다 커서
 * 가려지므로, **배율 < 1**(배경이 화면보다 작아지는 쪽)이 판정을 가른다.
 */
function cameraZoomEvent(zoom) {
  return autoCommandEvent({
    id: "ev_qa_camera_zoom",
    name: "QA 카메라 줌",
    command: {
      kind: "m2Command",
      commandId: "m2-201-camera-control",
      fields: { mode: "zoom", target: "player", zoom, durationMs: 0 },
    },
  });
}

/** 이벤트 명령 「먼 배경 변경」(m2-069). 맵 저작(`map.background`)과 별개로 도는 경로다. */
function parallaxCommandEvent(resourceId) {
  return autoCommandEvent({
    id: "ev_qa_parallax",
    name: "QA 먼 배경 변경",
    command: { kind: "m2Command", commandId: "m2-069-change-parallax-back", fields: { resourceId } },
  });
}

export function buildMapBackgroundFixture({ background = DEFAULT_BACKGROUND, zoom, parallaxOverride } = {}) {
  const project = JSON.parse(readFileSync(SOURCE, "utf8"));
  const map = project.maps[MAP_ID];
  if (!map) throw new Error(`픽스처에 ${MAP_ID} 가 없습니다`);
  for (let y = 0; y < SKY_ROWS; y += 1) {
    for (let x = 0; x < map.width; x += 1) {
      const index = y * map.width + x;
      map.lowerTiles[index] = -1;
      map.upperTiles[index] = -1;
    }
  }
  project.startMapId = MAP_ID;
  project.startPos = { ...START };
  if (background) map.background = { ...background };
  else delete map.background;
  if (zoom !== undefined) {
    map.events = [...map.events.filter((event) => event.id !== "ev_qa_camera_zoom"), cameraZoomEvent(zoom)];
  }
  if (parallaxOverride !== undefined) {
    map.events = [...map.events.filter((event) => event.id !== "ev_qa_parallax"), parallaxCommandEvent(parallaxOverride)];
  }
  return project;
}

function parseArgs(argv) {
  const args = { out: null, background: { ...DEFAULT_BACKGROUND }, zoom: undefined, parallaxOverride: undefined };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--out") args.out = argv[++i];
    else if (arg === "--no-background") args.background = null;
    else if (arg === "--background-id") args.background = { ...(args.background ?? {}), imageId: argv[++i] };
    else if (arg === "--scroll-x") args.background = { ...(args.background ?? {}), scrollX: Number(argv[++i]) };
    else if (arg === "--scroll-y") args.background = { ...(args.background ?? {}), scrollY: Number(argv[++i]) };
    else if (arg === "--zoom") args.zoom = Number(argv[++i]);
    else if (arg === "--override-id") args.parallaxOverride = argv[++i];
    else throw new Error(`알 수 없는 인자: ${arg}`);
  }
  if (!args.out) throw new Error("--out 이 필요합니다");
  return args;
}

/** 시나리오가 픽스처를 스스로 굽는다 — `--project` 없이도 `--scenario map-background` 가 돈다. */
export function writeMapBackgroundFixture({ background = DEFAULT_BACKGROUND, zoom, parallaxOverride } = {}) {
  const suffix = `${background ? "on" : "off"}${zoom === undefined ? "" : `-zoom${zoom}`}`
    + `${parallaxOverride === undefined ? "" : "-command"}`;
  const out = `${tmpdir()}/rpg-zzu-map-background-${suffix}.json`;
  writeFileSync(out, JSON.stringify(buildMapBackgroundFixture({ background, zoom, parallaxOverride }), null, 2));
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = parseArgs(process.argv.slice(2));
  writeFileSync(
    args.out,
    JSON.stringify(
      buildMapBackgroundFixture({
        background: args.background,
        zoom: args.zoom,
        parallaxOverride: args.parallaxOverride,
      }),
      null,
      2,
    ),
  );
  console.log(args.out);
}
