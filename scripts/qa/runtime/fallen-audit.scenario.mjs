// 『폴른 스타』 제1막 통짜 플레이: 타이틀 → 오프닝 건너뛰기 → 포고 → 하넬 의뢰 → 숲(풀숲 조우·브람) →
// 은빛 관 세 단계(한 번 틀리고 다시) → 이리스 합류 → 천문대 뚜껑문 → 화로 순서(한 번 틀리고 다시) → 지하 → 발렌 결전 → 보고 → 엔딩.
// 맵 사이는 실제 출입구를 밟아 넘어간다. 같은 맵 안의 긴 이동만 순간이동으로 줄인다(걸어서 닿는지는 .omo/fs/reach.mts 가 따로 본다).
// 픽스처: RES_WHICH=fallen res480-fixture.mts. 창 크기 RES_VP(기본 480x270).
const [vw, vh] = (process.env.RES_VP ?? "480x270").split("x").map(Number);
const STATE_OUT = process.env.FS_STATE_OUT ?? "/tmp/fs-audit-state";

const closeDialogue = (max = 30) => [
  { kind: "pressUntil", key: "Enter", testid: "dialogue-box", state: "absent", maxPresses: max, timeoutMs: 900 },
  { kind: "hold", dir: null, ms: 500 },
];
/** 대사를 넘겨 선택지가 뜨면 index 번째를 고른다. */
const choose = (index) => [
  { kind: "pressUntil", key: "Enter", testid: "runtime-choices", state: "present", maxPresses: 20, timeoutMs: 900 },
  { kind: "hold", dir: null, ms: 300 },
  ...(index > 0 ? [{ kind: "key", key: "ArrowDown", times: index, holdMs: 80 }] : []),
  { kind: "key", key: "Enter" },
  { kind: "hold", dir: null, ms: 400 },
];
const talk = (dir) => [{ kind: "face", dir }, { kind: "action" }, { kind: "waitFor", testid: "dialogue-box", state: "present", timeoutMs: 8000 }];
/** 출입구 칸 바로 앞에 서서 그쪽으로 걸어 밟는다. */
const stepInto = (mapId, x, y, dir) => [
  { kind: "teleport", mapId, x, y },
  { kind: "hold", dir: null, ms: 500 },
  { kind: "hold", dir, ms: 700 },
  { kind: "hold", dir: null, ms: 1500 },
];
/** 걷다가 풀숲 조우가 나면 끝까지 싸운다(Enter = 공격). */
const walkFighting = (dir, ms) => [
  { kind: "hold", dir, ms },
  { kind: "repeatUntil", testid: "battle-scene", state: "absent", maxRounds: 120, ops: [{ kind: "key", key: "Enter" }, { kind: "hold", dir: null, ms: 300 }] },
  ...closeDialogue(10),
];
const dumpState = (name) => ({
  kind: "evalToFile",
  out: `${STATE_OUT}-${name}.json`,
  fn: "() => { const s = window.__oprnDebug.readState(); return { map: s.currentMapId, x: s.x, y: s.y, party: s.partyActorIds, gold: s.gold, items: s.inventory, switches: Object.fromEntries(Object.entries(s.switches).filter(([k]) => k.startsWith('sw_fs'))), battleResult: s.battleResult }; }",
});

export default {
  id: "fallen-audit",
  projectFixture: process.env.RES_FIXTURE ?? ".omo/fs/v18.json",
  viewport: { width: vw, height: vh },
  beats: [
    { id: "title", note: "타이틀", ops: [
      { kind: "waitFor", testid: "title-screen", state: "present", timeoutMs: 60000 },
      // 입장 연출(로고·메뉴가 차례로 뜬다)이 끝난 뒤 찍는다 — 연출 중에 찍어 로고 없는 타이틀로 보였다(감사 VQA).
      { kind: "waitForAttr", testid: "title-screen", attr: "data-seq-state", value: "done", timeoutMs: 30000 },
    ], shot: true },
    { id: "boot", note: "새 게임 → 오프닝 건너뛰기", ops: [
      // 타이틀 입장 연출 중의 첫 Enter 는 연출만 건너뛴다 — 오프닝이 뜰 때까지 누른다.
      { kind: "pressUntil", key: "Enter", testid: "cinematic-sequence", state: "present", maxPresses: 4, timeoutMs: 12000 },
      { kind: "hold", dir: null, ms: 600 },
      { kind: "pressUntil", key: "Escape", testid: "cinematic-sequence", state: "absent", maxPresses: 6 },
      { kind: "waitForRuntime", timeoutMs: 120000 },
      { kind: "hold", dir: null, ms: 1500 },
    ], shot: true },
    { id: "proclamation", note: "심문관의 포고", ops: [
      ...[0, 1, 2, 3].flatMap(() => closeDialogue(20)),
    ], shot: true },
    { id: "to-observatory", note: "천문대 문을 밟는다", ops: [...stepInto("fs_hub", 26, 21, "up")], shot: true },
    { id: "hanel-ask", note: "하넬의 부탁 → 선택지", ops: [
      { kind: "teleport", mapId: "fs_observatory", x: 11, y: 14 }, { kind: "hold", dir: null, ms: 400 },
      ...talk("up"),
      { kind: "pressUntil", key: "Enter", testid: "runtime-choices", state: "present", maxPresses: 20, timeoutMs: 900 },
    ], shot: true },
    { id: "hanel-accept", note: "수락", ops: [{ kind: "key", key: "Enter" }, { kind: "hold", dir: null, ms: 400 }], shot: true },
    { id: "hanel-accept-close", note: "", ops: [...closeDialogue(), dumpState("quest")], shot: false },
    { id: "scope", note: "큰 망원경", ops: [{ kind: "teleport", mapId: "fs_observatory", x: 6, y: 7 }, { kind: "hold", dir: null, ms: 400 }, ...talk("up")], shot: true },
    { id: "scope-close", note: "", ops: [...closeDialogue()], shot: false },
    { id: "out-to-hub", note: "천문대 문 → 광장", ops: [...stepInto("fs_observatory", 5, 17, "down")], shot: true },
    { id: "gate-guard", note: "동문 문지기", ops: [{ kind: "teleport", mapId: "fs_hub", x: 53, y: 21 }, { kind: "hold", dir: null, ms: 400 }, ...talk("up")], shot: true },
    { id: "gate-guard-close", note: "", ops: [...closeDialogue()], shot: false },
    { id: "to-forest", note: "동문 → 숲", ops: [...stepInto("fs_hub", 54, 21, "right")], shot: true },
    { id: "forest-walk", note: "숲길을 걷는다(풀숲 조우)", ops: [
      ...walkFighting("up", 2200), ...walkFighting("up", 2200), ...walkFighting("up", 2200),
      dumpState("forest-walk"),
    ], shot: true },
    { id: "bram", note: "숲지기 브람", ops: [{ kind: "teleport", mapId: "fs_forest", x: 14, y: 19 }, { kind: "hold", dir: null, ms: 400 }, ...talk("up")], shot: true },
    { id: "bram-close", note: "", ops: [...closeDialogue()], shot: false },
    { id: "pod-intro", note: "은빛 관 — 첫 선택지", ops: [
      { kind: "teleport", mapId: "fs_forest", x: 14, y: 6 }, { kind: "hold", dir: null, ms: 400 },
      ...talk("up"),
      { kind: "pressUntil", key: "Enter", testid: "runtime-choices", state: "present", maxPresses: 20, timeoutMs: 900 },
    ], shot: true },
    { id: "pod-wrong", note: "일부러 틀린다(별)", ops: [{ kind: "key", key: "Enter" }, { kind: "hold", dir: null, ms: 500 }], shot: true },
    { id: "pod-wrong-close", note: "", ops: [...closeDialogue()], shot: false },
    { id: "pod-stage1", note: "다시 — 해", ops: [...talk("up"), ...choose(1)], shot: true },
    { id: "pod-stage2", note: "맨손", ops: [...choose(2)], shot: true },
    { id: "pod-stage3", note: "괜찮아, 지켜 줄게", ops: [...choose(1)], shot: true },
    { id: "iris-wakes", note: "이리스 깨어남", ops: [{ kind: "pressUntilText", key: "Enter", testid: "dialogue-box", text: "하늘을 건너는 배", maxPresses: 30 }], shot: true },
    { id: "iris-key", note: "열쇠", ops: [{ kind: "pressUntilText", key: "Enter", testid: "dialogue-box", text: "별빛 열쇠", maxPresses: 30 }], shot: true },
    { id: "iris-joined", note: "합류", ops: [...closeDialogue(), dumpState("iris")], shot: true },
    { id: "back-to-hub", note: "숲 → 광장", ops: [...stepInto("fs_forest", 15, 38, "down")], shot: true },
    { id: "plaza-after", note: "광장 — 발렌 일행이 떠났는가", ops: [{ kind: "teleport", mapId: "fs_hub", x: 36, y: 27 }, { kind: "hold", dir: null, ms: 1200 }], shot: true },
    { id: "back-to-obs", note: "천문대", ops: [...stepInto("fs_hub", 26, 21, "up")], shot: false },
    { id: "hanel-hint", note: "하넬 — 다음 갈 곳", ops: [{ kind: "teleport", mapId: "fs_observatory", x: 11, y: 14 }, { kind: "hold", dir: null, ms: 400 }, ...talk("up")], shot: true },
    { id: "hanel-hint-close", note: "", ops: [...closeDialogue()], shot: false },
    { id: "hatch", note: "바닥 뚜껑문 → 화로의 방", ops: [...stepInto("fs_observatory", 13, 17, "up"), ...closeDialogue(10), { kind: "hold", dir: null, ms: 1200 }], shot: true },
    { id: "tablet", note: "단서 석판", ops: [{ kind: "teleport", mapId: "fs_vault_gate", x: 10, y: 10 }, { kind: "hold", dir: null, ms: 400 }, ...talk("up")], shot: true },
    { id: "tablet-close", note: "", ops: [...closeDialogue()], shot: false },
    { id: "brazier-wrong", note: "북동부터 — 틀린다", ops: [{ kind: "teleport", mapId: "fs_vault_gate", x: 13, y: 8 }, { kind: "hold", dir: null, ms: 400 }, ...talk("up")], shot: true },
    { id: "brazier-wrong-close", note: "", ops: [...closeDialogue()], shot: false },
    ...[["se", 13, 12], ["nw", 6, 8], ["ne", 13, 8], ["sw", 6, 12]].map(([name, x, y]) => ({
      id: `brazier-${name}`, note: `화로 ${name}`, ops: [{ kind: "teleport", mapId: "fs_vault_gate", x, y }, { kind: "hold", dir: null, ms: 400 }, ...talk("up"), ...closeDialogue()], shot: name === "sw",
    })),
    { id: "gate-open", note: "창살이 녹은 문", ops: [{ kind: "hold", dir: null, ms: 1500 }, ...closeDialogue(), { kind: "hold", dir: null, ms: 1500 }, ...closeDialogue(),{ kind: "teleport", mapId: "fs_vault_gate", x: 10, y: 5 }, { kind: "hold", dir: null, ms: 800 }], shot: true },
    { id: "to-vault", note: "지하로", ops: [{ kind: "hold", dir: "up", ms: 1200 }, { kind: "hold", dir: null, ms: 1500 }, dumpState("vault")], shot: true },
    { id: "save-crystal", note: "세이브 결정", ops: [{ kind: "teleport", mapId: "fs_vault", x: 32, y: 23 }, { kind: "hold", dir: null, ms: 400 }, ...talk("up")], shot: true },
    { id: "save-crystal-close", note: "", ops: [...closeDialogue()], shot: false },
    { id: "valen", note: "발렌", ops: [...closeDialogue(),{ kind: "teleport", mapId: "fs_vault", x: 25, y: 25 }, { kind: "hold", dir: null, ms: 600 }, ...talk("up")], shot: true },
    { id: "battle", note: "결전 시작", ops: [
      { kind: "pressUntil", key: "Enter", testid: "battle-scene", state: "present", maxPresses: 20, timeoutMs: 900 },
      { kind: "hold", dir: null, ms: 2500 },
    ], shot: true },
    // 전투 한가운데 한 장 — 예전엔 「Enter 25번 안에 끝나야」 하는 조각 여섯 개라 끝나지 않은 조각이 실패로 찍혔다.
    { id: "battle-mid", note: "전투 중간(Enter 12번, 공격만)", ops: Array.from({ length: 12 }, () => [{ kind: "key", key: "Enter" }, { kind: "hold", dir: null, ms: 350 }]).flat(), shot: true },

    { id: "battle-end", note: "전투 끝", ops: [
      { kind: "repeatUntil", testid: "battle-scene", state: "absent", maxRounds: 260, ops: [{ kind: "key", key: "Enter" }, { kind: "hold", dir: null, ms: 350 }] },
      { kind: "hold", dir: null, ms: 1000 }, dumpState("boss"),
    ], shot: true },
    { id: "signal", note: "렌즈 신호", ops: [{ kind: "pressUntilText", key: "Enter", testid: "dialogue-box", text: "답이 왔어요", maxPresses: 20 }], shot: true },
    { id: "signal-close", note: "", ops: [...closeDialogue()], shot: false },
    { id: "vault-out", note: "지하 → 화로의 방 → 천문대", ops: [
      ...stepInto("fs_vault", 30, 57, "up"),
      ...stepInto("fs_vault_gate", 10, 13, "down"),
    ], shot: true },
    { id: "report", note: "하넬에게 보고", ops: [...closeDialogue(),{ kind: "teleport", mapId: "fs_observatory", x: 11, y: 14 }, { kind: "hold", dir: null, ms: 400 }, ...talk("up")], shot: true },
    { id: "ending", note: "엔딩까지", ops: [
      { kind: "repeatUntil", testid: "ending-screen", state: "present", maxRounds: 40, ops: [{ kind: "key", key: "Enter" }, { kind: "hold", dir: null, ms: 400 }] },
      { kind: "hold", dir: null, ms: 2500 },
    ], shot: true },
    { id: "ending-2", note: "엔딩 진행", ops: [{ kind: "key", key: "Enter", times: 2, holdMs: 80 }, { kind: "hold", dir: null, ms: 2500 }], shot: true },
  ],
};
