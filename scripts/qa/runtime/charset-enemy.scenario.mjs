// 사람 적이 걷기 칩 전투 시트(charset-battler-*)로 서는지 본다 — 『폴른 스타』 결전의 심문관 발렌.
// 실행(크로미움이 ERR_NETWORK_CHANGED 로 백지가 되면 netns 안에서):
//   unshare -rn bash -c 'ip link set lo up; npm run qa:runtime -- --scenario charset-enemy --out verify-shots/runtime-qa/charset-enemy'
//
// 픽스처: 폴른 스타 v9 사본(CHARSET_ENEMY_SRC, 기본 rpg-zzu-fallen-star-polish/.omo/fs/v9.json)에서
//   enemy_fs_valen.monsterResourceId = charset-battler-actor1-4(아군 actor1-4 와 같은 시트), 수호상은 빼서 발렌 혼자,
//   통상 공격만·보통 민첩·낮춘 HP·약한 공격으로 서로 몇 번 주고받은 뒤 쓰러지게 한다. 정본은 건드리지 않는다.
// 전투는 타이틀 → 새 게임 → 오프닝 건너뛰기 뒤 플레이 씬 훅(playBattle)으로 바로 연다.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

const SOURCE = process.env.CHARSET_ENEMY_SRC ?? "/home/main/z-project/rpg-zzu-fallen-star-polish/.omo/fs/v9.json";
const FIXTURE = ".omo/charset-enemy/fallen-star-valen-charset.json";
const RESOURCE = process.env.CHARSET_ENEMY_RESOURCE ?? "charset-battler-actor1-4";

if (!existsSync(FIXTURE) || process.env.CHARSET_ENEMY_REBUILD === "1") {
  const project = JSON.parse(readFileSync(SOURCE, "utf8"));
  const valen = project.database.enemies.find((enemy) => enemy.id === "enemy_fs_valen");
  const troop = project.database.troops.find((entry) => entry.id === "troop_fs_finale");
  if (!valen || !troop) throw new Error("enemy_fs_valen / troop_fs_finale 이 원본에 없다");
  valen.monsterResourceId = RESOURCE;
  valen.stats = { ...valen.stats, maxHp: 900, defense: 1, agility: 30, attack: 30 };
  valen.actions = [{ skillId: "skill_attack", priority: 5, condition: { kind: "always" } }];
  troop.enemyIds = ["enemy_fs_valen"];
  troop.members = troop.members.filter((member) => member.enemyId === "enemy_fs_valen");
  mkdirSync(".omo/charset-enemy", { recursive: true });
  writeFileSync(FIXTURE, JSON.stringify(project));
}

const VALEN = "enemy-1";
/** 발렌 노드의 이동·칸 상태를 파일로 남긴다(.omo/charset-enemy/<name>.json) — 걸음 거리·키프레임을 숫자로 확인한다. */
const dump = (name) => ({
  kind: "evalToFile",
  out: `.omo/charset-enemy/${name}.json`,
  fn: `() => { const n = document.querySelector('[data-testid="${VALEN}"]'); const cs = getComputedStyle(n); const r = n.querySelector('.battle-enemy-image').getBoundingClientRect(); const a = document.querySelector('.battle-actor .battle-actor-sprite')?.getBoundingClientRect();
    return { travel: n.style.getPropertyValue('--retro-travel'), travelY: n.style.getPropertyValue('--retro-travel-y'), translate: cs.translate, anim: cs.animationName, beat: n.dataset.retroBeat, action: n.dataset.retroAction, reach: n.dataset.retroReach, frame: n.dataset.battlePoseFrame, spriteLeft: r.left, spriteWidth: r.width, firstActorLeft: a && a.left, beatMs: n.style.getPropertyValue('--retro-beat-ms') }; }`,
});
/**
 * 맞은 칸은 히트스톱+220ms(약 0.3초)뿐이라 스크린샷 지연에 놓친다. 페이지 안에서 그 칸이 서는 프레임에 setTimeout 을 잠깐 붙들어
 * (전투 타이머가 칸을 되돌리지 못하게) 찍고, 다음 비트에서 붙든 타이머를 그대로 다시 건다. QA 전용 — 출하 코드와 무관하다.
 */
const freezeOnFrame = (frame, out) => ({
  kind: "evalToFile",
  out,
  fn: `() => new Promise((resolve) => {
    const node = document.querySelector('[data-testid="${VALEN}"]');
    const tick = () => {
      // 히트스톱(흰 실루엣) 동안은 칸이 안 보인다 — 정지가 풀린 뒤에도 같은 칸이면 그때 붙든다.
      const stopped = document.querySelector('.battle-scene.battle-hit-stop, .battle-scene.battle-hit-stop-critical');
      if (node.dataset.battlePoseFrame !== '${frame}' || stopped) { requestAnimationFrame(tick); return; }
      const held = window.__ceHeld = [];
      window.__ceSetTimeout = window.setTimeout;
      window.setTimeout = (fn, ms, ...args) => { held.push([fn, ms, args]); return 0; };
      const sprite = node.querySelector('.battle-enemy-image');
      resolve({ frame: node.dataset.battlePoseFrame, backgroundPosition: sprite.style.backgroundPosition, transform: getComputedStyle(sprite).transform });
    };
    tick();
  })`,
});
const releaseTimers = {
  kind: "evalToFile",
  out: ".omo/charset-enemy/release.json",
  fn: "() => { if (!window.__ceSetTimeout) return 0; window.setTimeout = window.__ceSetTimeout; const held = window.__ceHeld ?? []; for (const [fn, ms, args] of held) window.setTimeout(fn, ms, ...args); delete window.__ceSetTimeout; return held.length; }",
};
const [vw, vh] = (process.env.RES_VP ?? "960x540").split("x").map(Number);

export default {
  id: "charset-enemy",
  projectFixture: FIXTURE,
  viewport: { width: vw, height: vh },
  beats: [
    { id: "title", note: "타이틀", ops: [{ kind: "waitFor", testid: "title-screen", state: "present", timeoutMs: 60000 }] },
    {
      id: "boot",
      note: "새 게임 → 오프닝 건너뛰기",
      ops: [
        { kind: "key", key: "Enter" },
        { kind: "waitFor", testid: "cinematic-sequence", state: "present", timeoutMs: 30000 },
        { kind: "hold", dir: null, ms: 600 },
        { kind: "pressUntil", key: "Escape", testid: "cinematic-sequence", state: "absent", maxPresses: 6 },
        { kind: "waitForRuntime", timeoutMs: 120000 },
        { kind: "hold", dir: null, ms: 1200 },
        // 시작 맵의 포고 대사를 다 넘긴다 — 남아 있으면 전투 위에 겹치고 확인 키를 먹는다.
        ...[0, 1, 2, 3].flatMap(() => [
          { kind: "pressUntil", key: "Enter", testid: "dialogue-box", state: "absent", maxPresses: 20, timeoutMs: 900 },
          { kind: "hold", dir: null, ms: 500 },
        ]),
      ],
    },
    {
      id: "battle-idle",
      note: "발렌 결전 — 사람 적이 아군과 같은 크기의 걷기 칩 시트로, 아군 쪽(오른쪽)을 보고 선다",
      ops: [
        {
          kind: "evalToFile",
          out: ".omo/charset-enemy/start.json",
          fn: "() => { void window.__oprnHooksScene.playBattle({ kind: 'battleProcessing', troopId: 'troop_fs_finale', canEscape: false, canLose: true }); return true; }",
        },
        { kind: "waitFor", testid: "battle-scene", state: "present", timeoutMs: 30000 },
        { kind: "waitFor", testid: `battle-enemy-sprite-${VALEN}`, state: "present", timeoutMs: 30000 },
        // 아군 명령 창이 열리고 발렌이 아직 움직이지 않은(비트 없음) 대기 칸을 찍는다.
        { kind: "waitFor", testid: "actor-command-attack", state: "present", timeoutMs: 60000 },
        { kind: "waitForAttr", testid: VALEN, attr: "data-battle-pose-frame", value: "idle", timeoutMs: 30000 },
        { kind: "waitForAttr", testid: VALEN, attr: "data-retro-beat", value: null, timeoutMs: 30000 },
      ],
      expect: { testidPresent: ["battle-scene", `battle-enemy-sprite-${VALEN}`] },
      shot: true,
    },
    {
      id: "target-select",
      note: "대상 선택 — 사람 적의 이름·HP 표시가 그림 아래 제자리에 펼쳐진다",
      ops: [
        { kind: "waitFor", testid: "actor-command-attack", state: "present", timeoutMs: 60000 },
        { kind: "key", key: "z" },
        { kind: "waitFor", testid: "battle-target-prompt", state: "present", timeoutMs: 10000 },
        { kind: "hold", dir: null, ms: 300 },
      ],
      shot: true,
    },
    {
      id: "enemy-hit",
      note: "아군 공격에 맞은 칸(hit)",
      ops: [
        { kind: "key", key: "z" },
        freezeOnFrame("hit", ".omo/charset-enemy/hit.json"),
      ],
      shot: true,
    },
    {
      id: "enemy-approach",
      note: "발렌이 대상 아군 앞까지 걸어간다(걷기 칸, 오른쪽으로)",
      ops: [
        releaseTimers,
        // F = 자동 전투(현재 키 계약) — 명령 창에 멈추지 않고 차례가 돌아 발렌도 움직인다. 끝까지 켜 둔다.
        { kind: "key", key: "f" },
        { kind: "waitForAttr", testid: VALEN, attr: "data-retro-beat", value: "approach", timeoutMs: 90000 },
        dump("approach"),
      ],
      shot: true,
    },
    {
      id: "enemy-attack",
      note: "대상 앞에서 휘두른다(attack_strike 칸). 착탄(impact) 비트는 60ms 남짓이라 그 직전 칸을 찍는다",
      ops: [
        { kind: "waitForAttr", testid: VALEN, attr: "data-battle-pose-frame", value: "attack_strike", timeoutMs: 90000 },
        dump("strike"),
      ],
      shot: true,
    },
    {
      id: "enemy-defeated",
      note: "쓰러짐 — dying/dead 칸을 잠깐 보인 뒤 사라진다",
      ops: [
        { kind: "waitForClass", testid: VALEN, cls: "defeated", timeoutMs: 120000 },
        { kind: "hold", dir: null, ms: 200 },
      ],
      shot: true,
    },
  ],
};
