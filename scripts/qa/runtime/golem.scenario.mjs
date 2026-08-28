// 2x2 배율 2 골렘 발자국 — 네 면에서 통행 차단 + 대화를 브라우저로 증명한다.
//
// 픽스처는 같은 디렉터리의 golem-fixture.mjs 가 만든다. `--project` 로 갈아끼우고,
// 어느 면을 볼지는 GOLEM_FACE 환경변수로 고른다(runtime-qa.mjs 에 면 인자가 없다):
//   node scripts/qa/runtime/golem-fixture.mjs --out /tmp/golem-up.json --start 15,16
//   GOLEM_FACE=up node scripts/runtime-qa.mjs --scenario golem --project /tmp/golem-up.json --out ...
//
// 골렘 앵커 (15,18). footprintBounds(15,18,{2,2}) = left15 right16 top17 bottom18
// → 발자국 (15,17) (16,17) (15,18) (16,18). 앵커는 **좌하단** 칸이다.
//
// ⚠ 판별력: 앵커 칸을 겨냥하는 프로브는 발자국이 1x1 이어도 똑같이 막히고 똑같이 말이
// 걸린다 — 즉 발자국에 대해 아무것도 증명하지 않는다. 앵커가 (15,18) 이므로
//   left  (14,18)→(15,18) = 앵커      → 판별력 없음
//   down  (15,19)→(15,18) = 앵커      → 판별력 없음
//   right (17,18)→(16,18) = 앵커 아님 → 판별력 있음
//   up    (15,16)→(15,17) = 앵커 아님 → 판별력 있음
// left/down 의 판별력을 복원한 변형을 둘 추가했다(left-alt, down-alt).
//
// ⚠ 이동 입력은 `key` 가 아니라 `dir`(injectDirection) 이어야 한다. src/player/input.ts:357
// 주석대로 headless 에서는 window keydown 이 Phaser 키보드 매니저까지 도달하지 않아
// page.keyboard.press("ArrowDown") 로는 플레이어가 애초에 움직이지 않는다 — 그러면
// "안 움직였다 = 막혔다" 단정이 헛통과한다. `dir` 은 update() 의 downSet 에 병합된다.
//
// 그 헛통과를 구조적으로 배제하려고 골렘 없는 **대조군**(GOLEM_FACE=control-up 등)을 같은
// 입력으로 돌린다. 대조군에서 플레이어가 실제로 걸어 들어가면 입력이 살아 있음이
// 증명되고, 같은 입력에 골렘 런이 제자리면 막은 주체는 발자국이다.

const HOLD_MS = 1500;
const SETTLE_MS = 500;
const MAP_ID = "map_lantern_village";

/** 방향을 HOLD_MS 동안 눌렀다 뗀다. 막혀 있으면 제자리, 열려 있으면 여러 칸 걷는다. */
function walk(dir) {
  return [
    { kind: "dir", dir },
    { kind: "wait", ms: HOLD_MS },
    { kind: "dir", dir: null },
    { kind: "wait", ms: SETTLE_MS },
  ];
}

/** 각 면의 시작칸 · 밀 방향 · 겨냥하는 발자국 칸 · 그 칸이 앵커인지. */
const FACES = {
  // 정정문서 §4 가 지정한 네 면.
  left: { start: { x: 14, y: 18 }, dir: "right", target: { x: 15, y: 18 }, anchor: true },
  right: { start: { x: 17, y: 18 }, dir: "left", target: { x: 16, y: 18 }, anchor: false },
  up: { start: { x: 15, y: 16 }, dir: "down", target: { x: 15, y: 17 }, anchor: false },
  down: { start: { x: 15, y: 19 }, dir: "up", target: { x: 15, y: 18 }, anchor: true },
  // 판별력 복원 변형(추가). 같은 면에서 앵커가 아닌 발자국 칸을 겨냥한다.
  "left-alt": { start: { x: 14, y: 17 }, dir: "right", target: { x: 15, y: 17 }, anchor: false },
  "down-alt": { start: { x: 16, y: 19 }, dir: "up", target: { x: 16, y: 18 }, anchor: false },
};

function startBeat(spec, note) {
  return {
    id: "field-start",
    note,
    ops: [{ kind: "key", key: "Enter" }, { kind: "wait", ms: 3000 }, { kind: "seed", seed: 1 }],
    expect: {
      mapId: MAP_ID,
      x: spec.start.x,
      y: spec.start.y,
      playerSpriteTextureLoaded: true,
      testidAbsent: ["title-screen", "dialogue-box"],
    },
    shot: true,
  };
}

/** 골렘 있는 런: 막히고, 말이 걸리고, 닫힌다. */
function blockedScenario(faceId, spec) {
  const { start, dir, target, anchor } = spec;
  const targetLabel = `(${target.x},${target.y})`;
  return {
    id: `golem-${faceId}`,
    beats: [
      startBeat(spec, `새 게임 → (${start.x},${start.y}). 골렘은 앵커 (15,18) 의 2x2 배율 2`),
      {
        id: "blocked",
        note:
          `${dir} 로 ${HOLD_MS}ms 밀어도 제자리 — 대상 ${targetLabel} 은 발자국 `
          + (anchor
            ? "앵커 칸이다(1x1 이어도 막히므로 판별력 없음)"
            : "비앵커 칸이다(발자국 없으면 빈 칸이므로 판별력 있음)"),
        ops: walk(dir),
        // dialogue-box 부재를 같이 본다: 대사창이 떠 있으면 모달이 이동을 막아
        // 좌표가 그대로여도 "발자국이 막았다" 는 근거가 되지 못한다.
        expect: { mapId: MAP_ID, x: start.x, y: start.y, testidAbsent: ["dialogue-box"] },
        shot: true,
      },
      {
        id: "talk",
        note: `${targetLabel} 을 보고 조사 → "그르릉..." 대사창`,
        ops: [
          { kind: "face", dir },
          { kind: "action" },
          { kind: "waitFor", testid: "dialogue-box", state: "present" },
          // 타이프라이터가 끝나길 기다린다. 단정에는 영향이 없고 샷만 읽기 좋아진다.
          { kind: "wait", ms: 1200 },
        ],
        expect: { testidPresent: ["dialogue-box"], mapId: MAP_ID, x: start.x, y: start.y },
        shot: true,
      },
      {
        id: "dismiss",
        // 고정 횟수로 누르면 대사가 닫힌 뒤 남은 입력이 이벤트를 재발동시킨다(실측).
        note: "결정 키로 대사 소진 → 대사창이 닫힌다",
        ops: [{ kind: "pressUntil", key: "Enter", testid: "dialogue-box", state: "absent" }],
        expect: { testidAbsent: ["dialogue-box"] },
      },
    ],
  };
}

/** 대조군: 골렘 없는 픽스처. 같은 입력으로 실제로 걷는지 본다(위치는 기록만). */
function controlScenario(faceId, spec) {
  return {
    id: `golem-control-${faceId}`,
    beats: [
      startBeat(spec, `대조군(골렘 없음) 시작 (${spec.start.x},${spec.start.y})`),
      {
        id: "walks-through",
        note: `골렘이 없으면 ${spec.dir} 로 실제로 걸어 들어간다 — 좌표는 기록만 한다`,
        ops: walk(spec.dir),
        expect: { mapId: MAP_ID, testidAbsent: ["dialogue-box"] },
        shot: true,
      },
    ],
  };
}

function build() {
  const face = process.env.GOLEM_FACE ?? "left";
  const isControl = face.startsWith("control-");
  const faceId = isControl ? face.slice("control-".length) : face;
  const spec = FACES[faceId];
  if (!spec) throw new Error(`알 수 없는 면: ${face} (가능: ${Object.keys(FACES).join(", ")})`);
  return isControl ? controlScenario(faceId, spec) : blockedScenario(faceId, spec);
}

export const golemScenario = build();
export default golemScenario;
