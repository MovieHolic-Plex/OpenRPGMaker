// 『폴른 스타』 제1막 통짜 플레이: 타이틀 → 오프닝 건너뛰기 → 포고 → 하넬 의뢰 → 숲(풀숲 조우·브람) →
// 은빛 관 세 단계(한 번 틀리고 다시) → 이리스 합류 → 천문대 서고 계단 → 화로 순서(한 번 틀리고 다시) → 지하 → 발렌 결전 → 보고 → 엔딩.
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
// 대사 타자 효과가 다 찍힌 뒤에 찍는다 — 바로 찍으면 「석판: 「」「불길이」처럼 한두 글자만 보였다(가혹 검수 r3).
// 대화 칸 두 칸 아래에서 걸어 올라와 선다 — 순간이동만 하면 동료가 직전 방향(옆)으로 깔려 기둥 위·대화창 아래에 섰다.
// 실제 플레이어처럼 다가오면 동료는 지나온 칸(뒤)에 선다(가혹 검수 r10 z46·z53).
/** 옆(동쪽 두 칸)에서 걸어 들어와 (x, y)에 선다 — 천문대 서재처럼 아래가 벽이라 approachUp 이 쓸 수 없는 곳. */
const approachFromEast = (mapId, x, y) => [
  { kind: "teleport", mapId, x: x + 2, y }, { kind: "hold", dir: null, ms: 400 },
  { kind: "evalToFile", fn: `() => { window.__oprnDebug.playerRoute([{ kind: "move", dir: "left" }, { kind: "move", dir: "left" }]); return true; }`, out: "/tmp/fs-audit-approach2.json" },
  { kind: "hold", dir: null, ms: 1200 },
];
const approachUp = (mapId, x, y) => [
  { kind: "face", dir: "up" }, { kind: "teleport", mapId, x, y: y + 2 }, { kind: "hold", dir: null, ms: 400 },
  { kind: "evalToFile", fn: `() => { window.__oprnDebug.playerRoute([{ kind: "move", dir: "up" }, { kind: "move", dir: "up" }]); return true; }`, out: "/tmp/fs-audit-approach.json" },
  { kind: "hold", dir: null, ms: 1200 },
];
/** 지하 렌즈 성소: 홀 북쪽 통로로 걸어 들어가면 발렌이 북서 돌 계단에서 걸어 나온다(chronoBell valenWalksIn). */
const valenWalksIn = [
  { kind: "face", dir: "up" }, { kind: "teleport", mapId: "fs_vault", x: 15, y: 15 }, { kind: "hold", dir: null, ms: 500 },
  { kind: "evalToFile", fn: `() => { window.__oprnDebug.playerRoute([{ kind: "move", dir: "up" }, { kind: "move", dir: "up" }]); return true; }`, out: "/tmp/fs-walkin.json" },
  { kind: "waitFor", testid: "dialogue-box", state: "present", timeoutMs: 10000 },
  { kind: "hold", dir: null, ms: 1200 },
];
/** 발렌이 등불 앞에 다 설 때까지(장면이 도는 동안 말을 걸면 입력이 씹힌다). */
const untilValenArrived = { kind: "evalToFile", out: "/tmp/fs-valen-arrived.json",
  fn: `async () => { for (let i = 0; i < 160; i++) { if (window.__oprnDebug.readState().switches.sw_fs_valen_arrived) return true; await new Promise((r) => setTimeout(r, 250)); } return false; }` };
const talk = (dir) => [{ kind: "face", dir }, { kind: "action" }, { kind: "waitFor", testid: "dialogue-box", state: "present", timeoutMs: 8000 }, { kind: "hold", dir: null, ms: 1800 }];
/** 출입구 칸 바로 앞에 서서 그쪽으로 걸어 밟는다. */
const stepInto = (mapId, x, y, dir) => [
  { kind: "teleport", mapId, x, y },
  { kind: "hold", dir: null, ms: 500 },
  { kind: "hold", dir, ms: 700 },
  { kind: "hold", dir: null, ms: 1500 },
];
/**
 * 결전 한 수 — 보스는 공격만으로는 거의 못 이긴다(심판의 빛). 화면의 전투 명령 단추를 직접 누른다:
 * 명령 창이면 「스킬」, 스킬 목록이면 쓸 수 있는 첫 기술(없으면 뒤로 → 다음 수는 공격), 대상 창이면 첫 대상, 결과 창이면 확인.
 */
const BOSS_STEP_FN = `() => { const log = (window.__fsLog ??= []); const act = ((() => {
  const q = (t) => document.querySelector('[data-testid="' + t + '"]');
  const confirm = q("battle-result-confirm"); if (confirm) { confirm.click(); return "confirm"; }
  const ratio = (text) => { const m = /(\\d+)\\s*\\/\\s*(\\d+)/.exec(text || ""); return m ? Number(m[1]) / Math.max(1, Number(m[2])) : 1; };
  const low = [...document.querySelectorAll(".battle-party .battle-actor-status")].some((n) => ratio(n.textContent) < 0.55);
  const all = [...document.querySelectorAll("button.battle-command")].filter((n) => n.dataset.previewOnly !== "true");
  const live = all.filter((n) => !n.disabled);
  const ids = live.map((n) => n.dataset.testid || "");
  const click = (id) => { const b = live.find((n) => n.dataset.testid === id); if (!b) return null; b.click(); return id; };
  if (ids.includes("actor-command-attack")) {
    if (window.__fsNoSkill || !ids.includes("actor-command-skill")) { window.__fsNoSkill = false; return click("actor-command-attack"); }
    return click("actor-command-skill");
  }
  if (all.some((n) => (n.dataset.testid || "").startsWith("actor-skill-"))) {
    const skills = ids.filter((id) => id.startsWith("actor-skill-"));
    if (low && skills.includes("actor-skill-skill_heal")) { window.__fsHeal = true; return click("actor-skill-skill_heal"); }
    const strong = ["skill_mage_blizzard", "skill_gunner_snipe", "skill_hero_rising_blade", "skill_hero_flame_sword"].map((id) => "actor-skill-" + id);
    const skill = strong.find((id) => skills.includes(id)) ?? skills.find((id) => id !== "actor-skill-skill_attack" && id !== "actor-skill-skill_heal") ?? skills[0];
    if (skill) return click(skill);
    window.__fsNoSkill = true; return click("actor-command-back");
  }
  const targets = live.filter((n) => (n.dataset.testid || "").startsWith("battle-target-") && n.dataset.testid !== "battle-target-cancel");
  if (!targets.length) return null;
  const pick = window.__fsHeal ? targets.reduce((a, b) => (ratio(b.textContent) < ratio(a.textContent) ? b : a)) : targets[0];
  window.__fsHeal = false; pick.click(); return "target:" + pick.dataset.testid;
})());
  const hp = (sel) => [...document.querySelectorAll(sel)].map((n) => (n.textContent || "").replace(/\\s+/g, " ").trim().slice(0, 40));
  const msg = (document.querySelector('[data-testid="battle-message-window"]')?.textContent || "").trim().slice(0, 60);
  if (act) log.push({ t: Date.now(), act, party: hp(".battle-party .battle-actor-status"), enemies: hp(".battle-enemy-list-hp, [data-testid^=battle-enemy-list-hp]"), msg });
  return log;
}`;
const bossStep = [{ kind: "evalToFile", fn: BOSS_STEP_FN, out: "/tmp/fs-audit-boss-step.json" }, { kind: "hold", dir: null, ms: 450 }];
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
      // 포고 뒤 행렬이 성문으로 행진하고 화면이 따라간다 — 발렌(맨 뒤)이 통로로 사라질 때까지 기다린 뒤 엘레나의 대사를 닫는다.
      { kind: "evalToFile", out: "/tmp/fs-marched.json",
        fn: `async () => { for (let i = 0; i < 240; i++) { if (window.__oprnDebug.readState().switches.sw_fs_valen_marched) return true; await new Promise((r) => setTimeout(r, 250)); } return false; }` },
      { kind: "hold", dir: null, ms: 1500 },
      ...closeDialogue(20),
    ], shot: true },
    { id: "to-observatory", note: "천문대 문을 밟는다", ops: [...stepInto("fs_hub", 24, 21, "up")], shot: true },
    { id: "hanel-ask", note: "하넬의 부탁 → 선택지", ops: [
      ...approachFromEast("fs_observatory", 24, 21),
      ...talk("up"),
      { kind: "pressUntil", key: "Enter", testid: "runtime-choices", state: "present", maxPresses: 20, timeoutMs: 900 },
    ], shot: true },
    { id: "hanel-accept", note: "수락", ops: [{ kind: "key", key: "Enter" }, { kind: "hold", dir: null, ms: 400 }], shot: true },
    { id: "hanel-accept-close", note: "", ops: [...closeDialogue(), dumpState("quest")], shot: false },
    { id: "scope", note: "큰 망원경", ops: [{ kind: "teleport", mapId: "fs_observatory", x: 13, y: 12 }, { kind: "hold", dir: null, ms: 400 }, ...talk("up")], shot: true },
    { id: "scope-close", note: "", ops: [...closeDialogue()], shot: false },
    { id: "out-to-hub", note: "천문대 문 → 광장", ops: [...stepInto("fs_observatory", 15, 21, "down")], shot: true },
    { id: "gate-guard", note: "동문 문지기", ops: [{ kind: "teleport", mapId: "fs_hub", x: 50, y: 17 }, { kind: "hold", dir: null, ms: 400 }, ...talk("up")], shot: true },
    { id: "gate-guard-close", note: "", ops: [...closeDialogue()], shot: false },
    { id: "to-forest", note: "동문(성문 통로) → 숲", ops: [...stepInto("fs_hub", 48, 16, "up")], shot: true },
    { id: "forest-walk", note: "숲길을 걷는다(풀숲 조우)", ops: [
      ...walkFighting("up", 2200), ...walkFighting("up", 2200), ...walkFighting("up", 2200),
      dumpState("forest-walk"),
    ], shot: true },
    { id: "bram", note: "숲지기 브람", ops: [{ kind: "teleport", mapId: "fs_forest", x: 14, y: 19 }, { kind: "hold", dir: null, ms: 400 }, ...talk("up")], shot: true },
    { id: "bram-close", note: "", ops: [...closeDialogue()], shot: false },
    { id: "pod-intro", note: "은빛 관 — 첫 선택지", ops: [
      { kind: "teleport", mapId: "fs_forest", x: 14, y: 8 }, { kind: "hold", dir: null, ms: 400 },
      ...talk("up"),
      { kind: "pressUntil", key: "Enter", testid: "runtime-choices", state: "present", maxPresses: 20, timeoutMs: 900 },
    ], shot: true },
    { id: "pod-wrong", note: "일부러 틀린다(별)", ops: [{ kind: "key", key: "Enter" }, { kind: "hold", dir: null, ms: 500 }], shot: true },
    // 틀리면 그 단계 선택지로만 돌아간다(단계별 재시도) — 대사를 넘기면 같은 선택지가 다시 뜬다.
    { id: "pod-retry1", note: "1단계 선택지가 다시 뜬다", ops: [{ kind: "pressUntil", key: "Enter", testid: "runtime-choices", state: "present", maxPresses: 20, timeoutMs: 900 }, { kind: "hold", dir: null, ms: 300 }], shot: true },
    { id: "pod-stage1", note: "다시 — 해", ops: [...choose(1)], shot: true },
    { id: "pod-stage2-wrong", note: "2단계에서 일부러 틀린다(칼끝)", ops: [...choose(0)], shot: true },
    { id: "pod-retry2", note: "2단계 선택지만 다시", ops: [{ kind: "pressUntil", key: "Enter", testid: "runtime-choices", state: "present", maxPresses: 20, timeoutMs: 900 }, { kind: "hold", dir: null, ms: 300 }], shot: true },
    { id: "pod-stage2", note: "맨손", ops: [{ kind: "key", key: "ArrowDown", times: 2, holdMs: 80 }, { kind: "key", key: "Enter" }, { kind: "hold", dir: null, ms: 400 }], shot: true },
    { id: "pod-stage3", note: "괜찮아, 지켜 줄게", ops: [...choose(1)], shot: true },
    { id: "iris-wakes", note: "이리스 깨어남", ops: [{ kind: "pressUntilText", key: "Enter", testid: "dialogue-box", text: "하늘을 건너는 배", maxPresses: 30 }], shot: true },
    { id: "iris-key", note: "열쇠", ops: [{ kind: "pressUntilText", key: "Enter", testid: "dialogue-box", text: "별빛 열쇠", maxPresses: 30 }], shot: true },
    { id: "iris-joined", note: "합류", ops: [...closeDialogue(), dumpState("iris")], shot: true },
    { id: "back-to-hub", note: "숲 어귀 → 광장", ops: [...stepInto("fs_forest_edge", 14, 24, "down")], shot: true },
    { id: "plaza-after", note: "광장 — 발렌 일행이 떠났는가", ops: [{ kind: "teleport", mapId: "fs_hub", x: 36, y: 27 }, { kind: "hold", dir: null, ms: 1200 }], shot: true },
    { id: "back-to-obs", note: "천문대", ops: [...stepInto("fs_hub", 24, 21, "up")], shot: false },
    { id: "hanel-hint", note: "하넬 — 다음 갈 곳", ops: [...approachFromEast("fs_observatory", 24, 21), ...talk("up")], shot: true },
    { id: "hanel-hint-close", note: "", ops: [...closeDialogue()], shot: false },
    { id: "hatch", note: "서고 계단 → 화로의 방", ops: [...stepInto("fs_observatory", 3, 21, "up"), ...closeDialogue(10), { kind: "hold", dir: null, ms: 1200 }], shot: true },
    { id: "tablet", note: "단서 석판", ops: [{ kind: "teleport", mapId: "fs_vault_gate", x: 15, y: 10 }, { kind: "hold", dir: null, ms: 400 }, ...talk("up")], shot: true },
    { id: "tablet-close", note: "", ops: [...closeDialogue()], shot: false },
    { id: "brazier-wrong", note: "북동부터 — 틀린다", ops: [{ kind: "teleport", mapId: "fs_vault_gate", x: 19, y: 9 }, { kind: "hold", dir: null, ms: 400 }, ...talk("up")], shot: true },
    { id: "brazier-wrong-close", note: "", ops: [...closeDialogue()], shot: false },
    ...[["se", 19, 12], ["nw", 12, 9], ["ne", 19, 9], ["sw", 12, 12]].map(([name, x, y]) => ({
      id: `brazier-${name}`, note: `화로 ${name}`, ops: [{ kind: "teleport", mapId: "fs_vault_gate", x, y }, { kind: "hold", dir: null, ms: 400 }, ...talk("up"), ...closeDialogue()], shot: name === "sw",
    })),
    { id: "gate-open", note: "쇠창살이 올라간 문", ops: [{ kind: "hold", dir: null, ms: 1500 }, ...closeDialogue(), { kind: "hold", dir: null, ms: 1500 }, ...closeDialogue(),{ kind: "teleport", mapId: "fs_vault_gate", x: 15, y: 4 }, { kind: "hold", dir: null, ms: 800 }], shot: true },
    { id: "to-vault", note: "지하로", ops: [{ kind: "hold", dir: "up", ms: 1200 }, { kind: "hold", dir: null, ms: 1500 }, dumpState("vault")], shot: true },
    { id: "save-crystal", note: "세이브 결정", ops: [{ kind: "teleport", mapId: "fs_vault", x: 11, y: 16 }, { kind: "hold", dir: null, ms: 400 }, ...talk("left")], shot: true },
    { id: "save-crystal-close", note: "", ops: [...closeDialogue()], shot: false },
    { id: "valen-enters", note: "발렌이 북서 돌 계단에서 걸어 나온다", ops: [...closeDialogue(), ...valenWalksIn, ...closeDialogue(10), { kind: "hold", dir: null, ms: 1800 }], shot: true },
    { id: "valen", note: "발렌", ops: [untilValenArrived, { kind: "hold", dir: null, ms: 800 }, ...closeDialogue(), ...approachUp("fs_vault", 15, 9), ...talk("up")], shot: true },
    { id: "battle", note: "결전 시작", ops: [
      { kind: "pressUntil", key: "Enter", testid: "battle-scene", state: "present", maxPresses: 20, timeoutMs: 900 },
      { kind: "hold", dir: null, ms: 2500 },
    ], shot: true },
    // 전투 한가운데 한 장 — 예전엔 「Enter 25번 안에 끝나야」 하는 조각 여섯 개라 끝나지 않은 조각이 실패로 찍혔다.
    { id: "battle-mid", note: "전투 중간(기술 위주 12수)", ops: Array.from({ length: 12 }, () => bossStep).flat(), shot: true },

    { id: "battle-end", note: "전투 끝", ops: [
      { kind: "repeatUntil", testid: "battle-scene", state: "absent", maxRounds: 400, ops: bossStep },
      { kind: "hold", dir: null, ms: 1000 }, dumpState("boss"),
    ], shot: true },
    { id: "signal", note: "렌즈 신호", ops: [{ kind: "pressUntilText", key: "Enter", testid: "dialogue-box", text: "답이 왔어요", maxPresses: 20 }], shot: true },
    { id: "signal-close", note: "", ops: [...closeDialogue()], shot: false },
    { id: "vault-out", note: "지하 → 화로의 방 → 천문대", ops: [
      ...stepInto("fs_vault", 15, 25, "down"),
      ...stepInto("fs_vault_gate", 26, 4, "up"),
    ], shot: true },
    { id: "report", note: "하넬에게 보고", ops: [...closeDialogue(), ...approachFromEast("fs_observatory", 24, 21), ...talk("up")], shot: true },
    { id: "ending", note: "엔딩까지", ops: [
      { kind: "repeatUntil", testid: "ending-screen", state: "present", maxRounds: 40, ops: [{ kind: "key", key: "Enter" }, { kind: "hold", dir: null, ms: 400 }] },
      { kind: "hold", dir: null, ms: 2500 },
    ], shot: true },
    { id: "ending-2", note: "크레딧", ops: [{ kind: "key", key: "Enter", times: 2, holdMs: 80 }, { kind: "hold", dir: null, ms: 4000 }], shot: true },
    { id: "ending-3", note: "마지막 카드", ops: [{ kind: "key", key: "Enter" }, { kind: "hold", dir: null, ms: 2500 }], shot: true },
  ],
};
