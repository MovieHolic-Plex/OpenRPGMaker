// 다중 타일 골렘 — 통행 차단 · 대화 · **몸 사각과 통행 사각의 분리**를 브라우저로 증명한다.
//
// 픽스처는 같은 디렉터리의 golem-fixture.mjs 가 만든다. `--project` 로 갈아끼우고,
// 어느 면을 볼지는 GOLEM_FACE 환경변수로 고른다(runtime-qa.mjs 에 면 인자가 없다):
//   node scripts/qa/runtime/golem-fixture.mjs --out /tmp/golem-up.json --start 15,16
//   GOLEM_FACE=up node scripts/runtime-qa.mjs --scenario golem --project /tmp/golem-up.json --out ...
//
// ── 2x2 면(1차) ── 픽스처: 기본값(--body 없음). 앵커 (15,18), 몸 = 통행 = x15..16 y17..18.
// ⚠ 판별력: 앵커 칸을 겨냥하는 프로브는 발자국이 1x1 이어도 똑같이 막히고 똑같이 말이
// 걸린다 — 즉 발자국에 대해 아무것도 증명하지 않는다. 앵커가 (15,18) 이므로
//   left  (14,18)→(15,18) = 앵커      → 판별력 없음
//   down  (15,19)→(15,18) = 앵커      → 판별력 없음
//   right (17,18)→(16,18) = 앵커 아님 → 판별력 있음
//   up    (15,16)→(15,17) = 앵커 아님 → 판별력 있음
// left/down 의 판별력을 복원한 변형을 둘 추가했다(left-alt, down-alt).
//
// ── 3x3 + passRows 1 면(2차) ── 픽스처: `--body 3,3 --pass-rows 1`.
// 앵커 (15,18) → 몸 x14..16 y16..18, **통행 사각은 y18 한 행뿐**이다.
//   torso-pass       (13,17) → 오른쪽: 상체 행이라 **지나간다**   (1차에서는 막혔던 칸)
//   legs-block       (13,18) → 오른쪽: 발밑 행이라 **막힌다**     (겨냥 칸 (14,18) 은 비앵커)
//   body-investigate (13,17) → 오른쪽 보고 조사: **대사창이 뜬다** (통행은 열렸는데 조사는 된다)
// 세 면의 시작 x 가 전부 13 이고 방향도 같다 — **행만 다르다.** y17 은 통과하고 y18 은
// 제자리라는 대비가 사각이 둘로 갈라졌다는 증거이며, 픽스처 하나 안에서 자동 판정된다.
//
// ⚠ 이동 입력은 `key` 가 아니라 `dir`(injectDirection) 이어야 한다. src/player/input.ts:357
// 주석대로 headless 에서는 window keydown 이 Phaser 키보드 매니저까지 도달하지 않아
// page.keyboard.press("ArrowDown") 로는 플레이어가 애초에 움직이지 않는다 — 그러면
// "안 움직였다 = 막혔다" 단정이 헛통과한다. `dir` 은 update() 의 downSet 에 병합된다.
//
// 그 헛통과를 배제하려고 골렘 없는 **대조군**(GOLEM_FACE=control-up 등)을 같은 입력으로
// 돌린다. 대조군에서 플레이어가 실제로 걸어 들어가면 입력이 살아 있음이 증명되고, 같은
// 입력에 골렘 런이 제자리면 막은 주체는 발자국이다.
//
// 그 배제는 이제 **자동이다.** 2차가 evaluateExpect(scripts/lib/runtimeQa.mjs)에 부등
// 기대치 `xNot`/`yNot` 를 넣어서, 대조군이 "시작칸이 아니다" = 움직였다를 단정한다.
// 1차에서는 동등 비교밖에 없어 좌표를 매니페스트에 기록하고 사람이 두 런을 대조했다.

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

/**
 * "움직였다" 기대치. 이동 축은 부등(`xNot`/`yNot`)으로, 나머지 축은 동등으로 못 박는다 —
 * 부등만 쓰면 엉뚱한 축으로 흘러간 것도 통과하기 때문이다.
 * 몇 칸 갔는지는 단정하지 않는다. 걸음 수는 호스트 속도에 달렸고, 여기서 증명할 것은
 * **한 칸이라도 들어갔는가**다(첫 칸이 곧 검증 대상 칸이므로 한 칸으로 충분하다).
 */
function movedExpect(spec) {
  const horizontal = spec.dir === "left" || spec.dir === "right";
  return horizontal
    ? { mapId: MAP_ID, y: spec.start.y, xNot: spec.start.x, testidAbsent: ["dialogue-box"] }
    : { mapId: MAP_ID, x: spec.start.x, yNot: spec.start.y, testidAbsent: ["dialogue-box"] };
}

/**
 * 3x3 + passRows 1 골렘이 **런타임 안에서** 갖고 있어야 하는 사각.
 *
 * 좌표 이동 단정과 별개로 이것을 읽는 이유: 이동은 판정의 결과라 우연히 맞을 수 있다
 * (엉뚱한 사각인데 그 칸이 마침 통행 가능이었거나, 다른 것이 막았거나). 사각을 직접 읽으면
 * 그 우연이 배제되고, 실패했을 때 원인이 사각인지 통행 판정인지 바로 갈린다.
 * 값은 golem-fixture.mjs 가 찍어 주는 "몸 사각 / 통행 사각" 과 같아야 한다.
 */
const GOLEM_3X3_RECTS = {
  ev_golem_demo: {
    footprint: { width: 3, height: 3 },
    passRows: 1,
    bodyRect: { left: 14, right: 16, top: 16, bottom: 18 },
    passRect: { left: 14, right: 16, top: 18, bottom: 18 },
  },
};

/**
 * 각 면의 시작칸 · 밀 방향 · 겨냥하는 몸 칸 · 그 칸이 앵커인지 · 기대 결과(kind).
 *
 * kind: "block"(막힌다, 기본) / "pass"(지나간다) / "investigate"(조사만 한다).
 * body 는 어느 픽스처로 돌려야 하는 면인지 적어 둔 라벨이다 — 샷과 리포트가 자기 설명적이 된다.
 * rects 가 있으면 그 면은 런타임 사각까지 단정한다(대조군에서는 골렘이 없으므로 뺀다).
 */
const FACES = {
  // 정정문서 §4 가 지정한 네 면. 2x2 는 통행 사각 = 몸 사각이므로 전부 막힌다.
  left: { body: "2x2", start: { x: 14, y: 18 }, dir: "right", target: { x: 15, y: 18 }, anchor: true },
  right: { body: "2x2", start: { x: 17, y: 18 }, dir: "left", target: { x: 16, y: 18 }, anchor: false },
  up: { body: "2x2", start: { x: 15, y: 16 }, dir: "down", target: { x: 15, y: 17 }, anchor: false },
  down: { body: "2x2", start: { x: 15, y: 19 }, dir: "up", target: { x: 15, y: 18 }, anchor: true },
  // 판별력 복원 변형(추가). 같은 면에서 앵커가 아닌 발자국 칸을 겨냥한다.
  "left-alt": { body: "2x2", start: { x: 14, y: 17 }, dir: "right", target: { x: 15, y: 17 }, anchor: false },
  "down-alt": { body: "2x2", start: { x: 16, y: 19 }, dir: "up", target: { x: 16, y: 18 }, anchor: false },

  // 3x3 + passRows 1 (--body 3,3 --pass-rows 1). 몸 x14..16 y16..18, 통행은 y18 만.
  "torso-pass": {
    body: "3x3/pass1", kind: "pass", start: { x: 13, y: 17 }, dir: "right",
    target: { x: 14, y: 17 }, anchor: false, rects: GOLEM_3X3_RECTS,
  },
  "legs-block": {
    body: "3x3/pass1", kind: "block", start: { x: 13, y: 18 }, dir: "right",
    target: { x: 14, y: 18 }, anchor: false, rects: GOLEM_3X3_RECTS,
  },
  "body-investigate": {
    body: "3x3/pass1", kind: "investigate", start: { x: 13, y: 17 }, dir: "right",
    target: { x: 14, y: 17 }, anchor: false, rects: GOLEM_3X3_RECTS,
  },
};

/**
 * 새 게임 → 필드. `rects` 를 주면 골렘의 런타임 사각까지 여기서 단정한다 — 걷기 전에 확인해야
 * 실패했을 때 "사각이 틀렸다" 와 "이동 판정이 틀렸다" 가 갈린다. 대조군은 골렘이 없으므로 뺀다.
 */
function startBeat(spec, note, rects) {
  return {
    id: "field-start",
    note: `[${spec.body}] ${note}`,
    ops: [{ kind: "key", key: "Enter" }, { kind: "wait", ms: 3000 }, { kind: "seed", seed: 1 }],
    expect: {
      mapId: MAP_ID,
      x: spec.start.x,
      y: spec.start.y,
      playerSpriteTextureLoaded: true,
      testidAbsent: ["title-screen", "dialogue-box"],
      ...(rects ? { eventRects: rects } : {}),
    },
    shot: true,
  };
}

/**
 * 겨냥 칸을 보고 조사 → 대사창 → 닫는다. 플레이어는 제자리여야 한다.
 * block 면과 investigate 면이 공유한다 — 두 면의 차이는 조사가 아니라 **그 전에 걷는가**다.
 */
function talkBeats(spec, note) {
  const { start, dir, target } = spec;
  return [
    {
      id: "talk",
      note: `(${target.x},${target.y}) 을 보고 조사 → "그르릉..." 대사창${note ? ` — ${note}` : ""}`,
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
  ];
}

/** 골렘 있는 런: 막히고, 말이 걸리고, 닫힌다. */
function blockedScenario(faceId, spec) {
  const { start, dir, target, anchor } = spec;
  const targetLabel = `(${target.x},${target.y})`;
  return {
    id: `golem-${faceId}`,
    beats: [
      startBeat(spec, `새 게임 → (${start.x},${start.y}). 골렘 앵커 (15,18)`, spec.rects),
      {
        id: "blocked",
        note:
          `${dir} 로 ${HOLD_MS}ms 밀어도 제자리 — 대상 ${targetLabel} 은 통행 사각 `
          + (anchor
            ? "앵커 칸이다(1x1 이어도 막히므로 판별력 없음)"
            : "비앵커 칸이다(발자국 없으면 빈 칸이므로 판별력 있음)"),
        ops: walk(dir),
        // dialogue-box 부재를 같이 본다: 대사창이 떠 있으면 모달이 이동을 막아
        // 좌표가 그대로여도 "발자국이 막았다" 는 근거가 되지 못한다.
        expect: { mapId: MAP_ID, x: start.x, y: start.y, testidAbsent: ["dialogue-box"] },
        shot: true,
      },
      ...talkBeats(spec),
    ],
  };
}

/**
 * 골렘 있는 런인데 **지나간다.** passRows 로 열어 둔 상체 행이 대상이다.
 * 1차(통행 사각 = 몸 사각)에서 같은 입력은 blockedScenario 였다 — 즉 이 면의 통과는
 * 사각이 둘로 갈라졌다는 사실 자체를 단정한다.
 */
function passScenario(faceId, spec) {
  const { start, dir, target } = spec;
  return {
    id: `golem-${faceId}`,
    beats: [
      startBeat(spec, `새 게임 → (${start.x},${start.y}). 골렘 앵커 (15,18), 통행은 발밑 행만`, spec.rects),
      {
        id: "torso-walk",
        note:
          `${dir} 로 ${HOLD_MS}ms — 첫 칸 (${target.x},${target.y}) 이 몸 사각 안이지만 통행 사각 `
          + "밖이라 들어간다. 몇 칸 갔는지는 단정하지 않는다(한 칸이면 이미 증명이다)",
        ops: walk(dir),
        expect: movedExpect(spec),
        shot: true,
      },
    ],
  };
}

/**
 * 통행이 열린 칸을 보고 조사하면 **말이 걸린다.** 조사는 몸 사각이 지배하기 때문이다.
 * 걷지 않는다 — 걸으면 지나가 버려서 정면 칸이 달라진다.
 */
function investigateScenario(faceId, spec) {
  return {
    id: `golem-${faceId}`,
    beats: [
      startBeat(spec, `새 게임 → (${spec.start.x},${spec.start.y}). 걷지 않고 조사만 한다`, spec.rects),
      ...talkBeats(spec, "이 칸은 통행이 열려 있는데도 조사가 걸린다 = 사각이 둘이다"),
    ],
  };
}

/**
 * 대조군: 골렘 없는 픽스처에 **같은 입력**. 입력이 살아 있음을 단정한다.
 * investigate 면의 대조군은 걷지 않고 조사한다 — 골렘이 없으니 대사창이 뜨면 안 된다.
 */
function controlScenario(faceId, spec) {
  const kind = spec.kind ?? "block";
  if (kind === "investigate") {
    return {
      id: `golem-control-${faceId}`,
      beats: [
        startBeat(spec, `대조군(골렘 없음) 시작 (${spec.start.x},${spec.start.y})`),
        {
          id: "nothing-to-talk-to",
          note: `골렘이 없으면 같은 칸을 보고 조사해도 대사창이 뜨지 않는다`,
          ops: [{ kind: "face", dir: spec.dir }, { kind: "action" }, { kind: "wait", ms: 1200 }],
          expect: { mapId: MAP_ID, x: spec.start.x, y: spec.start.y, testidAbsent: ["dialogue-box"] },
          shot: true,
        },
      ],
    };
  }
  return {
    id: `golem-control-${faceId}`,
    beats: [
      startBeat(spec, `대조군(골렘 없음) 시작 (${spec.start.x},${spec.start.y})`),
      {
        id: "walks-through",
        note: `골렘이 없으면 ${spec.dir} 로 실제로 걸어 들어간다 — 시작칸이 아님을 단정한다`,
        ops: walk(spec.dir),
        expect: movedExpect(spec),
        shot: true,
      },
    ],
  };
}

const SHAPES = { block: blockedScenario, pass: passScenario, investigate: investigateScenario };

function build() {
  const face = process.env.GOLEM_FACE ?? "left";
  const isControl = face.startsWith("control-");
  const faceId = isControl ? face.slice("control-".length) : face;
  const spec = FACES[faceId];
  if (!spec) throw new Error(`알 수 없는 면: ${face} (가능: ${Object.keys(FACES).join(", ")})`);
  if (isControl) return controlScenario(faceId, spec);
  const shape = SHAPES[spec.kind ?? "block"];
  if (!shape) throw new Error(`알 수 없는 면 종류: ${spec.kind} (${faceId})`);
  return shape(faceId, spec);
}

export const golemScenario = build();
export default golemScenario;
