// golem.scenario.mjs 가 쓰는 픽스처 생성기 — 다중 타일 골렘을 심는다.
//
// 편집창은 이제 몸 크기·통행 행을 저작할 수 있지만(2차 Task 4), 브라우저 QA 는 저장된
// 프로젝트 JSON 을 그대로 로드하므로 여기서 픽스처를 굽는 편이 재현 가능하다.
//
// 대상 픽스처는 editor-authored-demo-v3.json 이다(oprn-sample-v3 가 아니다):
//   - 시작맵 map_lantern_village 가 30x30 이라 3x3 의 네 면이 다 열린다.
//     oprn 의 map_town 은 6x4 에 y=1 행이 이벤트로 꽉 차 최대 두 면만 열린다.
//   - 이 픽스처만 플레이어 캐릭셋이 정상 렌더된다(oprn 은 __MISSING).
//
// 골렘 앵커는 (15,18) 하드코딩이고 몸 크기는 `--body W,H` 로 고른다(기본 2,2).
//   2x2 → x 15..16, y 17..18
//   3x3 → x 14..16, y 16..18   (짝수 폭은 앵커가 왼쪽 열, 홀수 폭은 가운데다)
// `--pass-rows N` 을 주면 통행 차단이 **발밑 N행**으로 줄어 상체가 열린다.
//
// 전체 검증을 재현하는 법 — 면 하나당 픽스처 하나:
//   node scripts/qa/runtime/golem-fixture.mjs --out /tmp/golem-up.json --start 15,16
//   GOLEM_FACE=up node scripts/runtime-qa.mjs --scenario golem \
//     --project /tmp/golem-up.json --out verify-shots/big-character-golem/up
//
//   node scripts/qa/runtime/golem-fixture.mjs --out /tmp/golem-3x3.json \
//     --body 3,3 --pass-rows 1 --start 13,17
//   GOLEM_FACE=torso-pass node scripts/runtime-qa.mjs --scenario golem \
//     --project /tmp/golem-3x3.json --out verify-shots/big-character-golem-3x3/torso-pass
//
// 몸 칸의 **지형 통행성**은 여기서 판정하지 않는다 — passageMarkForTile(타일 접목·star 마크)
// 까지 재구현하면 프로덕션 판정과 갈라진다. 대신 생성된 파일을 프로덕션 린트로 확인한다:
//   npx vite-node scripts/qa/runtime/golem-fixture-lint.mts /tmp/golem-3x3.json
//
// 면 목록과 각 면의 --start 좌표는 golem.scenario.mjs 의 FACES 에 있다.
// 대조군(입력이 실제로 먹는지 증명)은 --no-golem 에 GOLEM_FACE=control-<면>.

import { readFileSync, writeFileSync } from "node:fs";

const SOURCE = "test/fixtures/projects/editor-authored-demo-v3.json";
const GOLEM_X = 15;
const GOLEM_Y = 18;

/** 발밑 앵커 몸 사각 — src/project/footprint.ts 의 footprintBounds 와 같은 식이다. */
function bodyRect(x, y, width, height) {
  const left = x - Math.floor((width - 1) / 2);
  return { left, right: left + width - 1, top: y - (height - 1), bottom: y };
}

function rectCells(rect) {
  const cells = [];
  for (let y = rect.top; y <= rect.bottom; y += 1) {
    for (let x = rect.left; x <= rect.right; x += 1) cells.push([x, y]);
  }
  return cells;
}

function rectsOverlap(a, b) {
  return a.left <= b.right && b.left <= a.right && a.top <= b.bottom && b.top <= a.bottom;
}

function parseArgs(argv) {
  const args = { out: null, start: null, noGolem: false, body: { width: 2, height: 2 }, passRows: null };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--out") args.out = argv[++i];
    // 대조군: 골렘을 심지 않는다. 같은 입력으로 플레이어가 실제로 걷는지 증명해
    // "막혔다" 단정이 입력 미작동으로 인한 헛통과가 아님을 보인다.
    else if (arg === "--no-golem") args.noGolem = true;
    else if (arg === "--body") {
      const [width, height] = String(argv[++i]).split(",").map((value) => Number.parseInt(value, 10));
      // 상한 8 은 CHARACTER_FOOTPRINT_AXIS_MAX 와 같다. 여기서 막지 않으면 로드 검증
      // (io/shapeEventFields.validatePageShape)이 뒤늦게 거부해 원인이 QA 실패로 위장된다.
      // 그 상수를 import 하지 못하는 이유: 이 파일은 빌드 없이 도는 순수 .mjs 다.
      if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width > 8 || height > 8) {
        throw new Error("--body 형식은 W,H (둘 다 1..8 정수) 다");
      }
      args.body = { width, height };
    } else if (arg === "--pass-rows") {
      const rows = Number.parseInt(String(argv[++i]), 10);
      if (!Number.isInteger(rows) || rows < 1) throw new Error("--pass-rows 는 1 이상 정수다");
      args.passRows = rows;
    } else if (arg === "--start") {
      const [x, y] = String(argv[++i]).split(",").map((value) => Number.parseInt(value, 10));
      if (!Number.isInteger(x) || !Number.isInteger(y)) throw new Error(`--start 형식은 x,y 다`);
      args.start = { x, y };
    } else throw new Error(`알 수 없는 인자: ${arg}`);
  }
  if (!args.out) throw new Error("--out <path> 가 필요하다");
  if (args.passRows !== null && args.passRows > args.body.height) {
    throw new Error(`--pass-rows(${args.passRows}) 가 몸 높이(${args.body.height})보다 크다`);
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
const project = JSON.parse(readFileSync(SOURCE, "utf8"));
const map = project.maps[project.startMapId];
if (!map) throw new Error(`시작 맵을 못 찾았다: ${project.startMapId}`);

// 발자국은 앵커에서 위·양옆으로 자란다(캐릭터 규약: (x,y) 가 발밑 칸).
const golemRect = bodyRect(GOLEM_X, GOLEM_Y, args.body.width, args.body.height);
const footprint = rectCells(golemRect);
if (golemRect.left < 0 || golemRect.top < 0 || golemRect.right >= map.width || golemRect.bottom >= map.height) {
  throw new Error(`몸 사각이 맵(${map.width}x${map.height}) 밖으로 나간다: ${JSON.stringify(golemRect)}`);
}

// 겹침 검사는 기존 이벤트도 **몸 사각**으로 본다. 앵커 점 비교였을 때는 이 픽스처에
// 다중 타일 이벤트를 하나만 더 심어도 겹침을 놓쳤다 — 그러면 두 이벤트가 포개진 채 QA 가
// 통과하고, 무엇을 조사한 것인지 아무도 모른다.
const collisions = (map.events ?? []).filter((event) => {
  const page = event.pages?.[0];
  const size = page?.footprint ?? { width: 1, height: 1 };
  return rectsOverlap(golemRect, bodyRect(event.x, event.y, size.width, size.height));
});
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
        // 배율은 **폭**에서 파생한다(설계 결정 D2) — 편집창 스피너와 같은 식이다.
        // 캐릭셋 한 칸이 정확히 타일 하나라 폭 = 배율이다.
        scale: args.body.width,
      },
      footprint: { width: args.body.width, height: args.body.height },
      // passRows 는 준 경우에만 싣는다. 생략이 곧 항등(통행 사각 = 몸 사각)이라, 기본 2x2
      // 출력이 1차 픽스처와 바이트까지 같게 유지된다.
      ...(args.passRows === null ? {} : { passRows: args.passRows }),
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
  const passRows = args.passRows ?? args.body.height;
  const passRect = { ...golemRect, top: golemRect.bottom - (passRows - 1) };
  console.log(`  몸 ${args.body.width}x${args.body.height}, 통행 차단 ${passRows}행 (앵커 = ${anchorCell})`);
  console.log(`  몸 사각:   ${footprint.map(([x, y]) => `(${x},${y})`).join(" ")}`);
  // 통행 사각을 찍는 이유: 시나리오가 겨냥할 칸이 바로 이것이다. 예전에는 시나리오 주석에
  // 손으로 적어야 했고, 그 계산이 어긋나면 엉뚱한 칸을 검증하고도 통과한다.
  console.log(`  통행 사각: ${rectCells(passRect).map(([x, y]) => `(${x},${y})`).join(" ")}`);
}
console.log(`  startPos: (${start.x},${start.y})${args.start ? " [덮어씀]" : " [픽스처 기본값]"}`);
