// golem.scenario.mjs 가 쓰는 픽스처 생성기 — 2x2 배율 2 골렘을 심는다.
//
// 편집 UI 가 EventPage.footprint 를 아직 못 쓰기 때문에(2차 계획) 다중 타일 이벤트를
// 저작할 방법이 픽스처 직접 편집밖에 없다. 그래서 이 스크립트가 필요하다.
//
// 대상 픽스처는 editor-authored-demo-v3.json 이다(oprn-sample-v3 가 아니다):
//   - 시작맵 map_lantern_village 가 30x30 이라 2x2 의 네 면이 다 열린다.
//     oprn 의 map_town 은 6x4 에 y=1 행이 이벤트로 꽉 차 최대 두 면만 열린다.
//   - 이 픽스처만 플레이어 캐릭셋이 정상 렌더된다(oprn 은 __MISSING).
//
// 골렘 앵커는 (15,18) 하드코딩이다. footprintBounds(15,18,{2,2}) 는
//   left=15 right=16 top=17 bottom=18 → 발자국 (15,17) (16,17) (15,18) (16,18).
// 네 칸 전부 통행 가능이고 기존 이벤트 8개와 겹치지 않는다(타일셋 passability 로 실측).
//
// 전체 검증을 재현하는 법 — 면 하나당 픽스처 하나:
//   node scripts/qa/runtime/golem-fixture.mjs --out /tmp/golem-up.json --start 15,16
//   GOLEM_FACE=up node scripts/runtime-qa.mjs --scenario golem \
//     --project /tmp/golem-up.json --out verify-shots/big-character-golem/up
//
// 면 목록과 각 면의 --start 좌표는 golem.scenario.mjs 의 FACES 에 있다.
// 대조군(입력이 실제로 먹는지 증명)은 --no-golem 에 GOLEM_FACE=control-<면>.

import { readFileSync, writeFileSync } from "node:fs";

const SOURCE = "test/fixtures/projects/editor-authored-demo-v3.json";
const GOLEM_X = 15;
const GOLEM_Y = 18;

function parseArgs(argv) {
  const args = { out: null, start: null, noGolem: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--out") args.out = argv[++i];
    // 대조군: 골렘을 심지 않는다. 같은 입력으로 플레이어가 실제로 걷는지 증명해
    // "막혔다" 단정이 입력 미작동으로 인한 헛통과가 아님을 보인다.
    else if (arg === "--no-golem") args.noGolem = true;
    else if (arg === "--start") {
      const [x, y] = String(argv[++i]).split(",").map((value) => Number.parseInt(value, 10));
      if (!Number.isInteger(x) || !Number.isInteger(y)) throw new Error(`--start 형식은 x,y 다`);
      args.start = { x, y };
    } else throw new Error(`알 수 없는 인자: ${arg}`);
  }
  if (!args.out) throw new Error("--out <path> 가 필요하다");
  return args;
}

const args = parseArgs(process.argv.slice(2));
const project = JSON.parse(readFileSync(SOURCE, "utf8"));
const map = project.maps[project.startMapId];
if (!map) throw new Error(`시작 맵을 못 찾았다: ${project.startMapId}`);

// 발자국은 앵커에서 위·오른쪽으로 자란다(캐릭터 규약: (x,y) 가 발밑 칸).
const footprint = [
  [GOLEM_X, GOLEM_Y - 1],
  [GOLEM_X + 1, GOLEM_Y - 1],
  [GOLEM_X, GOLEM_Y],
  [GOLEM_X + 1, GOLEM_Y],
];

const collisions = (map.events ?? []).filter((event) =>
  footprint.some(([x, y]) => event.x === x && event.y === y),
);
if (collisions.length > 0) {
  throw new Error(`발자국이 기존 이벤트와 겹친다: ${collisions.map((e) => e.id).join(", ")}`);
}

map.events = [
  ...map.events.filter((event) => event.id !== "ev_golem_demo"),
  ...(args.noGolem ? [] : [{
    id: "ev_golem_demo",
    x: GOLEM_X,
    y: GOLEM_Y,
    trigger: { kind: "action" },
    commands: [],
    pages: [{
      id: "p1",
      name: "골렘",
      conditions: [],
      graphic: {
        sprite: { type: "bundled", id: "tex_easyrpg_charset_monster1" },
        direction: "down",
        pattern: 1,
        scale: 2,
      },
      footprint: { width: 2, height: 2 },
      trigger: { kind: "action" },
      priority: "same",
      overlapForbidden: true,
      movement: { type: "fixed", speed: 3, frequency: 3 },
      commands: [{ kind: "text", body: "그르릉..." }],
    }],
  }]),
];

if (args.start) {
  if (args.start.x < 0 || args.start.y < 0 || args.start.x >= map.width || args.start.y >= map.height) {
    throw new Error(`--start 가 맵(${map.width}x${map.height}) 밖이다`);
  }
  project.startPos = { x: args.start.x, y: args.start.y };
}

writeFileSync(args.out, JSON.stringify(project, null, 2));

const start = project.startPos;
const anchorCell = `(${GOLEM_X},${GOLEM_Y})`;
console.log(
  args.noGolem
    ? `골렘을 심지 않았다(대조군) → ${args.out}`
    : `골렘을 ${anchorCell} 에 심었다 → ${args.out}`,
);
if (!args.noGolem) {
  console.log(`  발자국: ${footprint.map(([x, y]) => `(${x},${y})`).join(" ")}   (앵커 = ${anchorCell})`);
}
console.log(`  startPos: (${start.x},${start.y})${args.start ? " [덮어씀]" : " [픽스처 기본값]"}`);
