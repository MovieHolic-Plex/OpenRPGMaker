/**
 * 대표 데모 1 『폴른 스타』(데모 id chrono-bell / fallen-star) — 제1막.
 *
 * 2026-10-20 다시 지었다. 이전 판은 크로노·FF6풍 장 7개를 지은 뒤 글자만 치환했고(SF 월면 기지가 「마법숲」이었다),
 * 시작 칸 옆 NPC 메뉴에서 최종 보스로 바로 갈 수 있어 타이틀부터 엔딩까지 2분이었다.
 * 지금은 이야기 사양 하나(fallenStarStory.ts)를 장 구성기에 넘겨 버들항 한 계열로 짓는다:
 *   왕도 아스텔 → 별빛 천문대(의뢰) → 속삭이는 숲(숲지기 → 떨어진 별 퍼즐 → 이리스 합류)
 *   → 천문대 지하(별빛 열쇠로 열림, 화로 퍼즐, 발렌과 수호상 결전) → 천문대 보고 → 엔딩.
 */
import { charsetFrameIndex } from "@/assets/easyrpgRtp";
import { isPassable } from "@/project/collision";
import { JRPG_CLASSIC_FIELD_HUD } from "@/project/fieldHud";
import { createBlankProject } from "@/project/defaults";
import { DEFAULT_ACTOR_ID } from "@/project/defaults/constants";
import { deserialize, serialize } from "@/project/io";
import type { ActorRecord as Actor, Command, EnemyRecord as Enemy, EventPage, GameEvent, GameMap, Project, TroopRecord as Troop } from "@/project/types";
import { runTool } from "@/editor/tools/toolRunner";
import "@/editor/tools/toolRegistry";
import { buildJrpgChapter } from "@/editor/tools/jrpgChapterTools";
import { pickSpot, placeRoamer } from "@/editor/tools/jrpgVolumeTools";
import { FLAGSHIP_BEAT_MANIFESTS } from "./beats";
import { buildFallenStarOpening, FALLEN_STAR_TITLE_BACKGROUND } from "./fallenStarOpening";
import { clearOrphanShadows, rimPit } from "./fallenStarMapPolish";
import { FS_VALEN_START, FS_VAULT_LENS, rebuildFallenRooms } from "./fallenStarRooms";
import { FALLEN_STAR_ACT1, FS_NAMES, FS_PREFIX, FS_STAR_KEY_ITEM } from "./fallenStarStory";
import { reworkFallenTown } from "./fallenTown";
import { FS_VALEN_CHARSET_ID, FS_VALEN_CHARSET_INDEX, ensureFallenValenChip } from "./fallenValenChip";
import { buildFallenTownInteriors } from "./fallenTownInteriors";
import { placeFallenStarVessel } from "./fallenStarVessel";
import { dressObservatoryHall } from "./fallenObservatoryHall";
import { isFallenRoomRebuilt } from "./fallenRoomOwnership";
import handInteriorSpec from "@/assets/handInteriorSpec.json";
import type { FlagshipDemoBuildResult } from "./types";

const ENDING_ID = "end_fs_act1";
const SW_IRIS_JOINED = "sw_fs_iris_joined";
const SW_IRIS_AWAKE = "sw_fs_iris_awake";
const ELENA_ID = "actor_fs_elena";
const IRIS_ID = "actor_fs_iris";

/**
 * 도구 실행 — 도구는 초안 사본에 쓰고 그 결과를 project 에 덮는다. 그래서 도구를 부른 뒤에는 맵·이벤트 참조가 낡는다.
 * 맵은 늘 maps() 로 다시 꺼내 쓴다(낡은 참조에 쓴 변경은 조용히 사라진다 — 2026-10-20 문지기 위치·엔딩 명령 유실).
 */
function execTool(project: Project, name: string, args: Record<string, unknown>): void {
  const ctx = { project, assistantRun: false };
  const res = runTool(ctx, name, args, { dryRun: false });
  if (!res.ok) {
    throw new Error(`[fallen-star] ${name} failed: ${res.summary} ${JSON.stringify(res.issues ?? [])}`);
  }
  Object.assign(project, ctx.project);
}

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

// ── 배우 ────────────────────────────────────────────────────────────────

function setupCast(project: Project): void {
  const actors = project.database.actors;
  const hero = actors.find((a) => a.id === DEFAULT_ACTOR_ID) ?? actors[0]!;
  hero.name = "카엘";
  hero.nickname = "견습 별지기";
  hero.characterResourceId = "easyrpg-charset-actor1";
  hero.characterIndex = 0;
  hero.battleCharacterResourceId = "charset-battler-actor1-0";
  hero.initialLevel = 6;

  const make = (id: string, templateId: string, patch: Partial<Actor>): void => {
    const template = actors.find((a) => a.id === templateId) ?? hero;
    const actor = { ...clone(template), ...patch, id } as Actor;
    const at = actors.findIndex((a) => a.id === id);
    if (at >= 0) actors[at] = actor; else actors.push(actor);
  };
  make(ELENA_ID, "actor_mage", {
    name: "엘레나", nickname: "천문대의 마도학자",
    characterResourceId: "easyrpg-charset-actor1", characterIndex: 7,
    battleCharacterResourceId: "charset-battler-actor1-7", faceResourceId: "easyrpg-faceset-actor1-07", initialLevel: 6,
  });
  make(IRIS_ID, "actor_gunner", {
    name: "이리스", nickname: "별에서 온 기계 소녀",
    // 감사 3차 감독 선택(2026-10-20): Actor4 #7 칩과 그 짝 얼굴 Actor2 #15 — 창백한 은청색 머리·붉은 눈이
    // 「사람을 닮게 만든 기계」와 맞는다. 예전 Actor4 #3 칩의 짝 얼굴(Actor2 #11)은 굳은 남성 얼굴로 읽혔다.
    characterResourceId: "easyrpg-charset-actor4", characterIndex: 7,
    battleCharacterResourceId: "charset-battler-actor4-7", faceResourceId: "easyrpg-faceset-actor2-15", initialLevel: 6,
  });
  // 경험치 곡선 — 견본 곡선(extra 677)은 Lv6 에서 다음 레벨까지 1만이 넘어 한 막 내내 레벨이 오르지 않았다(가혹 검수 r1).
  // 숲 전투 몇 판이면 한 번, 결전 보상으로 한 번 더 오르게 줄인다.
  const partyCurve = { base: 30, extra: 60, acceleration: 20 };
  for (const actor of actors) if (actor.id === hero.id || actor.id === ELENA_ID || actor.id === IRIS_ID) actor.expCurve = { ...partyCurve };
  // 레벨 업 계산이 직업 곡선을 읽는 경로도 있어 세 직업도 같이 맞춘다(가혹 검수 r3: 결과 창 「다음 Lv까지 12,298」).
  for (const actor of actors) {
    if (actor.id !== hero.id && actor.id !== ELENA_ID && actor.id !== IRIS_ID) continue;
    const cls = project.database.classes.find((c) => c.id === actor.classId);
    if (cls && "expCurve" in cls) (cls as { expCurve: typeof partyCurve }).expCurve = { ...partyCurve };
  }
  project.system.startActorIds = [hero.id, ELENA_ID];
  // 런타임은 새 게임 파티를 session.partyActorIds 에서 읽는다 — 둘 다 맞춘다(감사 2차: 엘레나가 대사에만 있고 파티에 없었다).
  project.session.partyActorIds = [hero.id, ELENA_ID];
  // 동료는 맵에서도 뒤따라 걷는다 — 대사에만 있고 화면에 없는 동료가 없게.
  // 좁은 방·장면 진입에서 설 칸이 없는 동료를 숨기지 않고 가까운 빈 칸에 세운다(가혹 검수 r8·r9 「동료가 사라짐·겹침」).
  project.system.companions = { ...project.system.companions, fromParty: true, spreadWhenBlocked: true, fanOutInScenes: true };
  // 턴제 파티 RPG — 필드에 액션 전투용 하트 HUD 를 띄우지 않는다(감사 2차: 지도 왼쪽 위를 늘 가렸다).
  project.system.fieldHud = JRPG_CLASSIC_FIELD_HUD;
  // 보스전에서 남은 체력이 보이게 — 도트 측면 스킨은 적 체력을 숨긴다(가혹 검수 r1: 「적 HP 표시가 전혀 없음」).
  project.system.battleLook = { ...project.system.battleLook, enemyHp: true, enemyNames: true };
}

// ── 적 ──────────────────────────────────────────────────────────────────

function makeEnemy(project: Project, id: string, name: string, monster: string, stats: Enemy["stats"], exp: number, gold: number): void {
  const enemies = project.database.enemies;
  const template = enemies.find((e) => e.monsterResourceId === `generated-enemy-${monster}`) ?? enemies.find((e) => e.id === "enemy_slime")!;
  const enemy = { ...clone(template), id, name, monsterResourceId: `generated-enemy-${monster}`, stats } as Enemy;
  enemy.rewards = { ...enemy.rewards, exp, gold };
  const at = enemies.findIndex((e) => e.id === id);
  if (at >= 0) enemies[at] = enemy; else enemies.push(enemy);
}

function makeTroop(project: Project, id: string, name: string, enemyIds: readonly string[]): void {
  const troop: Troop = {
    id, name, enemyIds: [...enemyIds],
    // 수호상은 발이 이름표에 가리지 않게 한 줄 위에 선다(가혹 검수 r13: attack-b-mid).
    members: enemyIds.map((enemyId, i) => ({ enemyId, x: 80 + i * 56, y: enemyId === "enemy_fs_guardian" ? 84 : 96, hidden: false })),
    autoAlign: true, uncapturable: false, battleEventPages: [],
  } as Troop;
  const troops = project.database.troops;
  const at = troops.findIndex((t) => t.id === id);
  if (at >= 0) troops[at] = troop; else troops.push(troop);
}

function setupFoes(project: Project): { field: string[]; boss: string } {
  makeEnemy(project, "enemy_fs_wolf", "숲늑대", "wolf-grey", { maxHp: 150, maxMp: 0, attack: 58, defense: 18, mind: 30, agility: 40 }, 40, 12);
  makeEnemy(project, "enemy_fs_spider", "덤불거미", "spider-cave", { maxHp: 130, maxMp: 0, attack: 55, defense: 16, mind: 30, agility: 34 }, 36, 10);
  makeEnemy(project, "enemy_fs_wisp", "길 잃은 도깨비불", "wisp-blue", { maxHp: 110, maxMp: 20, attack: 60, defense: 12, mind: 60, agility: 46 }, 38, 14);
  makeEnemy(project, "enemy_fs_valen", "심문관 발렌", "mage-rogue", { maxHp: 1100, maxMp: 120, attack: 84, defense: 80, mind: 90, agility: 44 }, 400, 300);
  makeEnemy(project, "enemy_fs_guardian", "별지기의 수호상", "golem-crystal", { maxHp: 900, maxMp: 0, attack: 92, defense: 90, mind: 40, agility: 22 }, 300, 0);
  // 발렌은 필드와 같은 걷기 칩의 전투 시트로 싸운다(감사 3차: 필드는 망토 마법사, 전투는 보라 후드 — 다른 사람처럼 보였다).
  const valen = project.database.enemies.find((e) => e.id === "enemy_fs_valen");
  if (valen) valen.monsterResourceId = "charset-battler-actor1-4";
  // 보스 압박(가혹 검수 r1: 「공격 연타만으로 이긴다」) — 발렌은 둘째 차례부터 세 차례마다 「심판의 기도」로 예고하고 다음 차례에
  // 파티 전체에 「심판의 빛」을 쏟는다. 수호상은 둘째 차례부터 격 차례로 「수호의 철퇴」. 둘 다 방어가 두꺼워 통상 공격이 덜 박힌다.
  // 가혹 검수 r3·r4: 발렌의 자기 치유(체력 30% 아래, 한 차례에 두 번까지)가 싸움을 끝나지 않게 했다 — 치유를 뺐다.
  // 엔진 그대로 돌린 헤드리스 판(.omo/fs/naive.mts, 60판, Lv6): 공격만 27% 승 · 공격 반·아무 기술 반 90% ·
  // 공격 반·센 기술 반 100%(결정 19) · 센 기술 100%(결정 12). 방어가 두꺼워 통상 공격보다 기술 배율이 크게 먹힌다.
  // 가혹 검수 r5: 「한 판 결정 수가 길다」 — 체력을 700/480 으로 줄였다.
  const skills = project.database.skills;
  const cloneSkill = (fromId: string, id: string, patch: Record<string, unknown>): void => {
    const base = skills.find((s) => s.id === fromId);
    if (!base) throw new Error(`[fallen-star] 스킬 견본 ${fromId} 이 없다`);
    const next = { ...clone(base), ...patch, id } as typeof base;
    const at = skills.findIndex((s) => s.id === id);
    if (at >= 0) skills[at] = next; else skills.push(next);
  };
  const noMp = { flat: 0, percentMax: 0 };
  cloneSkill("skill_focus", "skill_fs_prayer", { name: "심판의 기도", mpCost: noMp, description: "빛을 모은다. 다음 차례에 큰 빛이 쏟아진다." });
  cloneSkill("skill_mage_blizzard", "skill_fs_judgment", { name: "심판의 빛", power: 150, mpCost: noMp, description: "모은 빛을 파티 전체에 쏟아붓는다." });
  cloneSkill("skill_sword_slash", "skill_fs_maul", { name: "수호의 철퇴", power: 120, description: "돌 팔을 크게 내리친다." });
  const act = (skillId: string, priority: number, condition: Enemy["actions"][number]["condition"] = { kind: "always" }) =>
    ({ skillId, priority, condition, switchOnAfterAction: { enabled: false }, switchOffAfterAction: { enabled: false } });
  const guardian = project.database.enemies.find((e) => e.id === "enemy_fs_guardian");
  if (valen) {
    valen.actions = [
      act("skill_fs_prayer", 10, { kind: "turn", start: 2, interval: 3 }),
      act("skill_fs_judgment", 10, { kind: "turn", start: 3, interval: 3 }),
      act("skill_sword_slash", 6), act("skill_weaken", 4),
    ];
    // r6 탐침: 스킬 섞어 이겼지만 부하 머신에서 11분 — 체력을 20% 줄여 스킬 섞기 결정 ~15번(헤드리스 100%), 공격만도 98% 이긴다.
    valen.stats = { ...valen.stats, maxHp: 560 };
  }
  if (guardian) {
    guardian.actions = [act("skill_fs_maul", 9, { kind: "turn", start: 2, interval: 2 }), act("skill_earth", 7), act("skill_attack", 6)];
    guardian.stats = { ...guardian.stats, maxHp: 380 };
  }
  // 표시 레벨 — 견본 몬스터에서 복제한 레벨(발렌 33·수호상 27)이 Lv6 파티 앞에 그대로 떠 이야기와 어긋났다(감사 VQA).
  // 보상은 위에서 직접 정했으므로 레벨은 표시와 레벨 차 경험치 보정에만 쓰인다.
  const levels: Record<string, number> = { enemy_fs_wolf: 5, enemy_fs_spider: 4, enemy_fs_wisp: 6, enemy_fs_valen: 9, enemy_fs_guardian: 8 };
  for (const enemy of project.database.enemies) if (levels[enemy.id] !== undefined) enemy.level = levels[enemy.id];
  makeTroop(project, "troop_fs_wolves", "숲늑대 무리", ["enemy_fs_wolf", "enemy_fs_wolf"]);
  makeTroop(project, "troop_fs_spiders", "덤불거미", ["enemy_fs_spider", "enemy_fs_spider"]);
  makeTroop(project, "troop_fs_wisps", "도깨비불", ["enemy_fs_wisp", "enemy_fs_wisp", "enemy_fs_wisp"]);
  // 장 구성기가 의뢰 적으로 troop_fs_boss·enemy_fs_boss 를 따로 만든다 — 같은 id 를 쓰면 덮여 발렌 혼자 남았다(감사 2차).
  makeTroop(project, "troop_fs_finale", "심문관 발렌과 수호상", ["enemy_fs_valen", "enemy_fs_guardian"]);
  // 옛 별지기의 방 — 동굴 배경만으로는 종유석 굴처럼 보였다(감사 VQA 2차). 천장 렌즈에서 내려오는 빛줄기와 별빛 겹을 얹는다.
  const finale = project.database.troops.find((t) => t.id === "troop_fs_finale");
  // 가혹 검수 r5: 「배경이 평평하다」 — 안개 층을 하나 더 깔아 깊이를 준다.
  // 가혹 검수 r10: 「배경이 어둡고 단조롭다」 — 렌즈 빛에 떠오르는 별가루(눈 겹을 위로 천천히 띄움)를 하나 더 얹는다.
  // 가혹 검수 r11: 「발렌과 수호상 이름판이 붙는다」 — 자동 진형(대각 50칸)은 이름판 폭(~70)보다 좁다. 수동 배치로 가로를 구역 끝까지 벌린다.
  if (finale) {
    finale.autoAlign = false;
    finale.members = [{ enemyId: "enemy_fs_valen", x: 0, y: 0, hidden: false }, { enemyId: "enemy_fs_guardian", x: 200, y: 40, hidden: false }] as typeof finale.members;
  }
  if (finale) finale.backdropLayers = [{ preset: "glow", opacity: 75 }, { preset: "lightRays", opacity: 50 }, { preset: "stars", opacity: 60 }, { preset: "snow", opacity: 32, scrollX: 6, scrollY: -18, blendMode: "screen" }];
  // 가혹 검수 r5: 「전투 스프라이트가 화면 대비 작다」 — 수호상을 1.5배로 세운다.
  // 발렌은 걷기 칩 전투 시트(사람 적)라 맞춤 대신 칸 그림을 발밑 기준으로 키운다(27-retro-motion.css) — 2.6배(2배는 수호상 옆에서 아직 작았다, r10).
  for (const [id, scale] of [["enemy_fs_guardian", 150], ["enemy_fs_valen", 260]] as const) {
    const enemy = project.database.enemies.find((e) => e.id === id);
    if (enemy) enemy.battleScalePercent = scale;
  }
  return { field: ["troop_fs_wolves", "troop_fs_spiders", "troop_fs_wisps"], boss: "troop_fs_finale" };
}

// ── 명령 나무 훑기 ────────────────────────────────────────────────────────

type CommandList = Command[];

/** 이벤트 명령 나무의 모든 명령 배열을 돈다(선택지 갈래·조건 분기·전투 결과 안쪽까지). */
function forEachCommandList(commands: CommandList, visit: (list: CommandList) => void): void {
  visit(commands);
  for (const cmd of commands) {
    const rec = cmd as unknown as Record<string, unknown>;
    for (const value of Object.values(rec)) {
      if (Array.isArray(value) && value.length && typeof value[0] === "object" && value[0] && "kind" in (value[0] as object)) {
        forEachCommandList(value as CommandList, visit);
      } else if (Array.isArray(value)) {
        for (const opt of value) {
          if (opt && typeof opt === "object" && Array.isArray((opt as { branch?: unknown }).branch)) {
            forEachCommandList((opt as { branch: CommandList }).branch, visit);
          }
        }
      }
    }
  }
}

function eventCommandLists(event: GameEvent): CommandList[] {
  const out: CommandList[] = [];
  forEachCommandList(event.commands, (l) => out.push(l));
  for (const page of event.pages ?? []) forEachCommandList(page.commands, (l) => out.push(l));
  return out;
}

const SPEAKER_LINE = /^([^\s:：「」『』()…—][^:：「」『』()]{0,9})[:：]\s*(.+)$/su;

const GENERIC_GIVER = "의뢰인";

/**
 * 「이름: 말」 로 쓴 대사를 화자 칸으로 옮긴다. 줄바꿈으로 여러 화자를 이은 대사(의뢰·보고)는 여러 창으로 나눈다.
 * 화자 없는 서술 줄은 그대로 둔다.
 */
function applySpeakerPrefixes(project: Project): void {
  for (const map of Object.values(project.maps)) {
    for (const event of map.events) {
      for (const list of eventCommandLists(event)) {
        for (let i = 0; i < list.length; i += 1) {
          const cmd = list[i] as Command & { kind: string; body?: string; speaker?: string };
          // 장 구성기가 의뢰 대사에 붙이는 기본 화자 「의뢰인」은 비어 있는 것으로 본다(본문의 「이름: 말」이 이긴다).
          if (cmd.kind !== "text" || typeof cmd.body !== "string" || (cmd.speaker && cmd.speaker !== GENERIC_GIVER)) continue;
          const parts = cmd.body.split("\n").map((s) => s.trim()).filter(Boolean);
          const parsed = parts.map((line) => {
            const m = SPEAKER_LINE.exec(line);
            return m ? { speaker: m[1]!.trim(), body: m[2]!.trim() } : { body: line };
          });
          if (!parsed.some((p) => "speaker" in p)) continue;
          // 같은 화자가 이어지는 줄은 한 창에 모은다.
          const merged: Array<{ speaker?: string; body: string }> = [];
          for (const p of parsed) {
            const last = merged[merged.length - 1];
            if (last && last.speaker === (p as { speaker?: string }).speaker) last.body += `\n${p.body}`;
            else merged.push({ ...p });
          }
          const replacement = merged.map((p) => {
            const { speaker: _old, ...rest } = cmd;
            return { ...rest, body: p.body, ...(p.speaker ? { speaker: p.speaker } : {}) } as Command;
          });
          list.splice(i, 1, ...replacement);
          i += replacement.length - 1;
        }
      }
    }
  }
}

function findTextList(map: GameMap, needle: string): { list: CommandList; index: number } | undefined {
  for (const event of map.events) {
    for (const list of eventCommandLists(event)) {
      const index = list.findIndex((c) => c.kind === "text" && typeof (c as { body?: string }).body === "string" && (c as { body: string }).body.includes(needle));
      if (index >= 0) return { list, index };
    }
  }
  return undefined;
}

const say = (speaker: string, body: string): Command => ({ kind: "text", speaker, body } as Command);
const narrate = (body: string): Command => ({ kind: "text", body } as Command);

/** 이벤트의 모든 페이지에서 본문이 정확히 같은 대사를 찾아 바꾼다. 못 찾으면 짓기를 멈춘다(문구가 바뀌면 여기도 고친다). */
function replaceLine(map: GameMap, eventId: string, body: string, next: Command[]): void {
  const event = map.events.find((e) => e.id === eventId);
  for (const list of event ? eventCommandLists(event) : []) {
    const at = list.findIndex((c) => c.kind === "text" && (c as { body?: string }).body === body);
    if (at >= 0) { list.splice(at, 1, ...next); return; }
  }
  throw new Error(`[fallen-star] ${eventId} 에서 「${body}」 대사를 찾지 못했다`);
}

function replaceLineAnywhere(map: GameMap, body: string, next: Command[]): void {
  const hit = map.events.find((e) => eventCommandLists(e).some((l) => l.some((c) => c.kind === "text" && (c as { body?: string }).body === body)));
  if (!hit) throw new Error(`[fallen-star] ${map.id} 에서 「${body}」 대사를 찾지 못했다`);
  replaceLine(map, hit.id, body, next);
}

type ForkCommand = Command & { kind: "fork"; then?: Command[]; else?: Command[] };
type ChoicesCommand = Command & { kind: "choices"; prompt?: string; options: { text: string; branch: Command[] }[] };

/**
 * 장 구성기가 넣는 기본 문구(「의뢰인」 화자, 「아직 할 일이 남은 것 같군」, 「고맙네」, 「확인을 마쳤다」, 기본 상자 물건)를
 * 이 게임 인물의 말로 바꾼다. 문구가 바뀌어 못 찾으면 짓기를 멈춘다.
 */
function polishLines(observatory: GameMap, forest: GameMap, vault: GameMap): void {
  const H = `천문대장 ${FS_NAMES.master}`;
  const hanel = observatory.events.find((e) => e.id === `ev_${FS_PREFIX}_hanel`);
  const [askPage, progressPage] = hanel?.pages ?? [];
  if (!askPage || !progressPage) throw new Error("[fallen-star] 하넬 의뢰 페이지가 없다");

  // 의뢰: 요약 한 줄(「의뢰인」) 대신 하넬의 부탁을 먼저 말하고, 수락하면 짧게 배웅한다.
  const ask = askPage.commands;
  const summaryAt = ask.findIndex((c) => c.kind === "text" && (c as { body?: string }).body === FALLEN_STAR_ACT1.quest.summary);
  const choices = ask.find((c) => c.kind === "choices") as ChoicesCommand | undefined;
  if (summaryAt < 0 || !choices || choices.options.length < 2) throw new Error("[fallen-star] 하넬 의뢰 대사 구조가 바뀌었다");
  const accept = choices.options[0]!.branch;
  const askLines = accept.filter((c) => c.kind === "text");
  choices.options[0]!.branch = [...accept.filter((c) => c.kind !== "text"), say(H, "동문을 나서면 바로 숲이다. 조심하거라."), say("엘레나", "동문 밖이 숲이야. 숲지기 브람 아저씨부터 찾자.")];
  ask.splice(summaryAt, 1, ...askLines);
  choices.prompt = "지금 숲으로 갈까?";
  choices.options[0]!.text = "지금 가겠습니다";
  choices.options[1]!.text = "준비하고 오겠습니다";
  replaceLine(observatory, hanel!.id, "마음이 바뀌면 다시 오게.", [say(H, "너무 늦지 말거라. 심문관이 먼저 닿을지도 모른다.")]);

  // 진행 중: 어디까지 왔는지에 따라 다음 갈 곳을 알려 준다(브람 → 공터 → 지하 철문).
  const hints = [
    "동문 밖이 숲이다. 숲에 들면 숲지기 브람부터 찾거라.",
    "브람이 말한 북쪽 끝 공터로 가 보거라.",
    "그 별 무늬 열쇠, 서고 바닥 봉인석 사이 돌뚜껑 홈에 맞을 게다. 조심해 내려가거라.",
  ];
  let fork = progressPage.commands.find((c) => c.kind === "fork") as ForkCommand | undefined;
  for (const hint of hints) {
    if (!fork) throw new Error("[fallen-star] 하넬 진행 대사 분기가 모자라다");
    fork.else = [say(H, hint)];
    fork = (fork.then ?? []).find((c) => c.kind === "fork") as ForkCommand | undefined;
  }
  replaceLine(observatory, hanel!.id, "자네 덕분에 살았어. 정말 고맙네.", [say(H, "북쪽 하늘탑으로 가거라. 이리스를 부탁한다.")]);

  replaceLine(forest, `ev_${FS_PREFIX}_bram`, "고맙네.", [say("숲지기 브람", "북쪽 끝 공터다. 길만 따라가라. 풀숲에선 늑대를 조심하고.")]);
  replaceLine(forest, `ev_${FS_PREFIX}_main_inspect1`, "확인을 마쳤다.", [narrate("은빛 관은 텅 비었다. 안쪽에 아직 온기가 남아 있다.")]);

  // 지하 상자 — 기본 표의 「기본 새우」 대신 상급 회복약.
  const chest = vault.events.find((e) => e.id === `ev_${FS_PREFIX}_vault_chest1`);
  for (const list of chest ? eventCommandLists(chest) : []) for (const c of list) {
    const rec = c as unknown as Record<string, unknown>;
    if (rec.kind === "changeItem" && rec.itemId === "item_shared_fishing_shrimp-1") rec.itemId = "item_hi_potion";
  }
  replaceLine(vault, `ev_${FS_PREFIX}_vault_chest1`, "보물상자를 열었다! 기본 새우를 손에 넣었다.", [narrate("보물상자를 열었다! 상급 회복약을 손에 넣었다.")]);

  // 보기 셋 선택지는 질문과 함께 띄운다 — 480×270 에서 셋째 보기가 잘리던 것은 엔진이 고쳤다(#3128, 선택 창이 보기 수만큼 자란다).

  // 남은 기본 화자 「의뢰인」은 하넬이다(이 장의 의뢰인은 하넬 하나).
  for (const map of [observatory, forest, vault]) for (const event of map.events) for (const list of eventCommandLists(event)) for (const c of list) {
    const rec = c as { kind: string; speaker?: string };
    if (rec.kind === "text" && rec.speaker === GENERIC_GIVER) rec.speaker = H;
  }
}

/** 얼굴 그림을 칩과 같은 인물로 맞추거나(faceId) 뺀다(undefined — 맞는 얼굴이 없는 칩). */
function setEventFace(map: GameMap, eventId: string, faceId: string | undefined): void {
  const event = map.events.find((e) => e.id === eventId);
  for (const list of event ? eventCommandLists(event) : []) {
    for (let i = list.length - 1; i >= 0; i -= 1) {
      const cmd = list[i] as Command & { resourceId?: string };
      if (cmd.kind !== "changeFace") continue;
      if (faceId) cmd.resourceId = faceId; else list.splice(i, 1);
    }
  }
}

/**
 * 말을 거는 장면을 세운다 — 24×32 칩을 16px 칸에 세우면 마주 붙어 선 두 사람은 앞사람 발이 뒷사람 머리를 덮어
 * 「한 칸에 겹쳐 선」 것처럼 보였다(발렌·카엘, 하넬·카엘 — 가혹 검수 r5~r8 major). 대사 전에 주인공이 바라보는
 * 방향을 유지한 채 한 칸 물러서 상대와 빈 칸 하나를 둔다. 막혀 있으면 건너뛴다(skippable).
 * 동료는 주인공이 지나온 칸(궤적)을 따르고 몸 길이(2칸)만큼 서로·주인공과 떨어져 서므로(followers.ts followerPositions)
 * 물러선 뒤에도 주인공 칸·서로의 칸을 나누지 않는다.
 */
const BACK_STEP: Readonly<Record<"up" | "down" | "left" | "right", "up" | "down" | "left" | "right">> = { up: "down", down: "up", left: "right", right: "left" };
function stageTalk(event: GameEvent | undefined): void {
  if (!event) return;
  const stepBack = (["up", "down", "left", "right"] as const).reduceRight<Command[]>((rest, facing) => [{
    kind: "fork",
    condition: { kind: "facing", subject: "player", dir: facing },
    then: [{
      kind: "moveEvent", eventId: "@player",
      // 주인공 루트는 방향 고정을 모른다 — 물러선 뒤 다시 상대 쪽으로 돈다.
      route: { moves: [{ kind: "move", dir: BACK_STEP[facing] }, { kind: "turn", dir: facing }], repeat: false, wait: true, skippable: true },
    }],
    else: rest,
  } as unknown as Command], []);
  for (const page of event.pages ?? []) {
    if (page.trigger?.kind !== "action" || !JSON.stringify(page.commands).includes('"kind":"text"')) continue;
    page.commands.unshift(...stepBack);
  }
}

/**
 * 대사 종류를 단다 — 서술·안내·석판·외침이 모두 같은 창이라 누가 말하는지 읽기 어려웠다(가혹 검수 r6 「대사」 6.5).
 * 서술은 내레이션 창, 얻음·동료 합류·화로 진행은 시스템 안내, 석판은 표지판, 정해 둔 외침 두 줄은 외침.
 */
const SYSTEM_LINE = /(얻었다|받았다|손에 넣었다|동료가 되었다|\(\d\/\d\)|상자는 비어 있다)/u;
function tagLineContext(cmd: Command): void {
  const line = cmd as Command & { speaker?: string; body?: string; context?: string };
  if (line.kind !== "text" || typeof line.body !== "string") return;
  // 가혹 검수 r12: 외침(굵은 붉은 테두리·이름판이 상자 밖)과 내레이션(테두리 없는 검정 띠)만 다른 창이라 한 게임에 창이 셋이었다.
  // 서술·외침도 같은 패널에 싣는다 — 서술은 이름·얼굴이 없는 것으로 구별된다.
  if (line.context === "narration" || line.context === "shout") delete line.context;
  if (line.context) return;
  const speaker = line.speaker?.trim();
  if (speaker === "석판") line.context = "sign";
  else if (!speaker && SYSTEM_LINE.test(line.body)) line.context = "system";
}

/**
 * 대사 한 줄마다 그 화자의 얼굴을 건다 — 얼굴은 바꿀 때까지 남아서, 하넬의 얼굴을 건 채 엘레나가 말하면 하넬 얼굴이
 * 엘레나 이름표 옆에 떴다. 주인공 셋·발렌·브람 대사는 대부분 얼굴이 없었다(가혹 검수 r6 「인물·초상」 6.5).
 * 얼굴 표에 없는 화자와 서술 줄은 얼굴을 내린다. 표는 칩과 같은 인물의 검토된 짝만 쓴다.
 */
function applySpeakerFaces(project: Project, faces: Readonly<Record<string, string>>): void {
  const faceOf = (cmd: Command): string => {
    const speaker = (cmd as { speaker?: string }).speaker?.trim();
    return speaker ? faces[speaker] ?? "" : "";
  };
  for (const map of Object.values(project.maps)) {
    for (const event of map.events) {
      for (const list of eventCommandLists(event)) {
        for (let i = 0; i < list.length; i += 1) {
          const cmd = list[i]!;
          if (cmd.kind !== "text") continue;
          tagLineContext(cmd);
          const want = faceOf(cmd);
          const prev = list[i - 1] as (Command & { resourceId?: string }) | undefined;
          if (prev?.kind === "changeFace") {
            if ((prev.resourceId ?? "") === want) continue;
            if (!(prev as { appearanceId?: string }).appearanceId) { list[i - 1] = { ...prev, resourceId: want } as Command; continue; }
          }
          list.splice(i, 0, { kind: "changeFace", resourceId: want, position: "left", flipHorizontally: false } as Command);
          i += 1;
        }
      }
    }
  }
}

// ── 그림 ────────────────────────────────────────────────────────────────

function setEventChip(map: GameMap | undefined, eventId: string, texture: string, characterIndex: number): void {
  const event = map?.events.find((e) => e.id === eventId);
  if (!event) return;
  for (const page of event.pages ?? []) {
    if (!page.graphic?.sprite) continue;
    const direction = page.graphic.direction ?? "down";
    page.graphic = {
      ...page.graphic,
      sprite: { type: texture === FS_VALEN_CHARSET_ID ? "uploaded" : "bundled", id: texture },
      direction,
      pattern: charsetFrameIndex({ characterIndex, direction, pattern: 1 }),
    };
  }
}

/** 조건을 만족하면 이벤트가 맵에서 사라지는 마지막 페이지(나중 페이지가 이긴다). */
function vanishWhen(map: GameMap | undefined, eventId: string, switchId: string): void {
  const event = map?.events.find((e) => e.id === eventId);
  if (!event?.pages) return;
  event.pages.push({
    id: `${eventId}_gone`,
    name: "떠남",
    conditions: [{ kind: "switch", switchId, value: true }],
    graphic: { transparent: true },
    movement: { type: "fixed", speed: 3, frequency: 3 },
    priority: "below",
    trigger: { kind: "action" },
    commands: [],
  } as EventPage);
}

const SW_VALEN_MARCHED = "sw_fs_valen_marched";
/** 기사는 발렌보다 먼저 성문 통로에 닿는다 — 자기 스위치로 바로 지워야 투명한 채 통로 칸을 막지 않는다. */
const SW_KNIGHT_MARCHED = "sw_fs_knight_marched";
type Step = "up" | "down" | "left" | "right";
/** from → to 걸음(통행 칸·다른 이벤트 칸을 피하는 BFS). 못 가면 null. */
function walkPath(
  project: Project, map: GameMap, from: { x: number; y: number }, to: { x: number; y: number }, selfId: string,
  opt: { allow?: (x: number, y: number) => boolean; ignore?: ReadonlySet<string> } = {},
): Step[] | null {
  const occupied = new Set(map.events.filter((e) => e.id !== selfId && !opt.ignore?.has(e.id) && !String(e.id).startsWith("ev_gate_")).map((e) => `${e.x},${e.y}`));
  const prev = new Map<string, { key: string; dir: Step }>();
  const start = `${from.x},${from.y}`, goal = `${to.x},${to.y}`;
  const seen = new Set([start]);
  let frontier = [from];
  const steps: Record<Step, [number, number]> = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  while (frontier.length && !seen.has(goal)) {
    const next: { x: number; y: number }[] = [];
    for (const cell of frontier) {
      for (const dir of ["right", "up", "down", "left"] as const) {
        const x = cell.x + steps[dir][0], y = cell.y + steps[dir][1], key = `${x},${y}`;
        if (seen.has(key) || x < 0 || y < 0 || x >= map.width || y >= map.height) continue;
        if (occupied.has(key) || !isPassable(project, map, x, y) || (opt.allow && key !== goal && !opt.allow(x, y))) continue;
        seen.add(key); prev.set(key, { key: `${cell.x},${cell.y}`, dir }); next.push({ x, y });
      }
    }
    frontier = next;
  }
  if (!seen.has(goal)) return null;
  const path: Step[] = [];
  for (let key = goal; key !== start;) { const p = prev.get(key)!; path.unshift(p.dir); key = p.key; }
  return path;
}

/**
 * 포고가 끝나면 교단 행렬(발렌·기사·호위 둘)이 큰길을 따라 동문으로 걸어 나간다 — 예전에는 이리스 합류 때 제자리에서
 * 페이지 전환으로 사라졌다(가혹 검수 r12 major 「NPC 가 문까지 걷지 않는다」). 오프닝 아침 컷의 행렬처럼 셋 이상이 줄지어
 * 걷고(적대 VQA r2: 혼자 풀밭을 가로질렀다), 길은 포석(큰길·광장)만 밟는다. 대사가 이어지는 동안(기다리지 않음) 걷고,
 * 성문 통로에 닿으면 루트 끝의 각자 스위치로 지운다(떠남 페이지).
 */
/**
 * 행진 길을 막고 선 떠도는 주민(movement random)을 길 밖 빈 칸으로 비켜 세운다. 마을 배치는 버들항 구성기(seed)가 정하고
 * 동문 곁 이정표가 문 앞을 한 칸 목으로 좁힌다 — #3240 이후 seed 7 마을에서는 꼬마 토비가 그 목에 서서 기사·발렌의
 * 동문 길이 없어졌다(#3253). 떠도는 주민은 어차피 움직이므로 처음 자리만 옮긴다(고정 NPC·문·조사 칸은 건드리지 않는다).
 */
function clearMarchRoute(project: Project, hub: GameMap, exit: { x: number; y: number }, marcherIds: readonly string[]): void {
  const marcherSet = new Set(marcherIds);
  const roamers = hub.events.filter((e) => !marcherSet.has(e.id) && (e.pages ?? []).some((p) => p.movement?.type === "random"));
  const roamerIds = new Set(roamers.map((e) => e.id));
  for (const id of marcherIds) {
    const npc = hub.events.find((e) => e.id === id);
    if (!npc || walkPath(project, hub, npc, exit, id, { ignore: marcherSet })) continue;
    const through = walkPath(project, hub, npc, exit, id, { ignore: new Set([...marcherSet, ...roamerIds]) });
    if (!through) continue;
    const onPath = new Set<string>([`${npc.x},${npc.y}`]);
    let x = npc.x, y = npc.y;
    for (const dir of through) { x += dir === "right" ? 1 : dir === "left" ? -1 : 0; y += dir === "down" ? 1 : dir === "up" ? -1 : 0; onPath.add(`${x},${y}`); }
    for (const roamer of roamers) {
      if (!onPath.has(`${roamer.x},${roamer.y}`)) continue;
      const others = hub.events.filter((e) => e !== roamer);
      let spot: { x: number; y: number } | undefined;
      for (let r = 2; r <= 10 && !spot; r += 1) for (let dy = -r; dy <= r && !spot; dy += 1) for (let dx = -r; dx <= r && !spot; dx += 1) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const cx = roamer.x + dx, cy = roamer.y + dy;
        if (cx < 1 || cy < 1 || cx >= hub.width - 1 || cy >= hub.height - 1 || !isPassable(project, hub, cx, cy)) continue;
        if (onPath.has(`${cx},${cy}`) || others.some((e) => Math.abs(e.x - cx) + Math.abs(e.y - cy) <= 1)) continue;
        // 옮긴 자리에서 마을 본체로 이어져야 한다(나무 사이 섬에 갇히지 않게).
        if (!walkPath(project, hub, { x: cx, y: cy }, exit, roamer.id, { ignore: new Set([...marcherIds, ...roamerIds]) })) continue;
        spot = { x: cx, y: cy };
      }
      if (spot) { roamer.x = spot.x; roamer.y = spot.y; }
    }
  }
}

function marchOffAfterProclamation(project: Project, hub: GameMap): void {
  // 동문 = 숲으로 나가는 성문 통로 가운데 칸(reworkFallenTown). 일행은 통로 안까지 걸어 들어가 사라진다.
  const gate = hub.events.find((e) => String(e.id).startsWith("ev_gate_") && JSON.stringify(e).includes('"mapId":"fs_forest"'));
  const proclamation = hub.events.find((e) => e.id === `ev_${FS_PREFIX}_event`);
  const list = proclamation?.pages?.[0]?.commands;
  const after = list?.findIndex((c) => c.kind === "text" && String((c as { body?: string }).body).includes("교단보다 먼저"));
  if (!gate || !list || after === undefined || after < 0) throw new Error("[fallen-star] 포고·동문을 찾지 못했다");
  const exit = { x: gate.x, y: gate.y };
  const knight = hub.events.find((e) => e.id === `ev_${FS_PREFIX}_knight`);
  const valen = hub.events.find((e) => e.id === `ev_${FS_PREFIX}_valen`);
  if (!knight || !valen) throw new Error("[fallen-star] 발렌·기사가 없다");

  // 호위 여덟 — 기사 이벤트를 그대로 본떠 RTP 칩만 바꾼다(기사 넷 · 흰 두건 사제 넷). 오프닝 아침 그림은 흰 옷 행렬이
  // 두 줄로 성문을 지난다 — 셋·넷으로는 행렬이 아니라 일행으로 읽혔다(VQA r3).
  const escorts: [string, string, number, string][] = [
    // 흰 머리 사제·민머리 칩은 행렬 속 「백성」으로 읽혔다(VQA r12·r13 — 백성이 호위보다 먼저 성문을 나간다) — 여덟 모두 갑옷 기사.
    ["a", "tex_easyrpg_charset_actor1", 3, "심문회 기사"], ["b", "tex_easyrpg_charset_actor1", 2, "심문회 기사"],
    ["c", "tex_easyrpg_charset_actor1", 3, "심문회 기사"], ["d", "tex_easyrpg_charset_actor1", 2, "심문회 기사"],
    ["e", "tex_easyrpg_charset_actor1", 3, "심문회 기사"], ["f", "tex_easyrpg_charset_actor1", 2, "심문회 기사"],
    ["g", "tex_easyrpg_charset_actor1", 3, "심문회 기사"], ["h", "tex_easyrpg_charset_actor1", 2, "심문회 기사"],
  ].map(([k, tex, index, name]) => [`ev_${FS_PREFIX}_escort_${k}`, tex as string, index as number, name as string]);
  hub.events = hub.events.filter((e) => !escorts.some(([id]) => id === e.id));
  for (const [id, tex, index, name] of escorts) {
    const clone = JSON.parse(JSON.stringify(knight)) as GameEvent;
    clone.id = id; clone.name = name;
    for (const page of clone.pages ?? []) page.id = `${page.id}__${id.slice(-1)}`;
    hub.events.push(clone);
    setEventChip(hub, id, tex, index);
  }

  // 무대 — 천문대 문 앞 큰길 두 줄(문 바로 아래 줄부터). 주인공(시작 칸) 동쪽에 발렌이 앞장서 서쪽을 보고,
  // 뒤로 기사·호위가 두 줄로 선다. 행렬은 앞(동쪽)부터 걷는다.
  const door = hub.events.find((e) => String(e.id).startsWith("ev_gate_") && JSON.stringify(e).includes('"mapId":"fs_observatory"'));
  const roadTop = (door?.y ?? 20);
  const lead = { x: (project.startPos?.x ?? 24) + 3, y: roadTop + 1 };
  const byId = (id: string): GameEvent => hub.events.find((e) => e.id === id)!;
  // 발렌이 주인공 쪽에 홀로 서고, 그 뒤(동쪽)로 두 줄(큰길 두 줄)이 늘어선다 — 걸을 때는 동쪽 끝부터 성문으로 간다.
  const formation: [GameEvent, number, number, string, number][] = [
    [valen, 0, 0, FS_VALEN_CHARSET_ID, FS_VALEN_CHARSET_INDEX], [knight, 1, -1, "tex_easyrpg_charset_actor1", 2],
    // 두 줄 엇갈림(체크무늬) — 같은 줄 이웃은 두 칸, 앞뒤 줄은 대각선. 한 칸씩 붙여 세우면 24px 칩이 겹쳐 덩어리로 읽혔다(VQA r5).
    ...escorts.map(([id, tex, index], k): [GameEvent, number, number, string, number] => [byId(id), k + 2, (k + 2) % 2 === 0 ? 0 : -1, tex, index]),
  ];
  const marchers = new Set(formation.map(([e]) => e.id));
  // 뒷줄이 집 벽 맨 아랫줄·문 칸에 서던 것(VQA r6 major) — 걸을 수 있고 문·다른 사람이 없는 칸만 쓴다. 위 줄이 막히면 아래 줄로.
  const doorCells = new Set(hub.events.filter((e) => String(e.id).startsWith("ev_gate_")).map((e) => `${e.x},${e.y}`));
  const standing = new Set<string>();
  const free = (x: number, y: number): boolean => isPassable(project, hub, x, y) && !doorCells.has(`${x},${y}`) && !standing.has(`${x},${y}`)
    && !hub.events.some((e) => !marchers.has(e.id) && e.x === x && e.y === y);
  for (const slot of formation) {
    const [, dx, dy] = slot;
    const tries = [dy, dy === 0 ? -1 : 1, dy === 0 ? 1 : 0].map((d) => lead.y + d);
    const y = tries.find((ty) => free(lead.x + dx, ty)) ?? lead.y + dy;
    slot[2] = y - lead.y;
    standing.add(`${lead.x + dx},${y}`);
  }
  for (const [event, dx, dy, tex, index] of formation) {
    event.x = lead.x + dx; event.y = lead.y + dy;
    // 포고는 남쪽(길 아래 풀밭)에 모인 백성에게 한다 — 발렌과 호위 모두 남쪽을 보고 선다. 서쪽(일행 쪽)을 보던 옆모습은
    // 백성 쪽이 아니라 카메라를 보는 것처럼 읽혔다(VQA r8 major).
    // r10·r12: 모두 남쪽(카메라)을 보면 말하는 이와 듣는 이가 나란히 선 줄 세우기로 읽혔다(VQA r12 major) — 발렌은 동쪽 행렬·백성을,
    // 행렬은 서쪽 발렌을 본다(서로 마주 보는 연설). 풀밭 백성은 아래에서 발렌을 본다.
    for (const page of event.pages ?? []) if (page.graphic?.sprite) page.graphic.direction = "down";
    setEventChip(hub, event.id, tex, index); // 방향이 바뀌면 칩 프레임 번호도 다시 고른다
  }

  // 발렌은 호위 줄보다 한 걸음 앞(남쪽, 백성 쪽)에 홀로 선다 — 호위와 같은 줄에 서면 누가 말하는지 안 읽히고, 호위 줄이
  // 카메라를 보는 백성으로 읽혔다(VQA r10 major).
  // 발렌은 기사 두 줄 한가운데 앞(남쪽)에 서서 남쪽 백성을 본다 — 줄 서쪽 끝 곁길에 서면 연설의 중심이 안 읽혔다(VQA r13).
  {
    const xs = formation.filter(([e]) => e !== valen).map(([, dx]) => lead.x + dx);
    const mid = Math.round((Math.min(...xs) + Math.max(...xs)) / 2);
    const front = Math.max(...formation.filter(([e]) => e !== valen).map(([, , dy]) => lead.y + dy)) + 1;
    const slot = formation.find(([e]) => e === valen)!;
    for (const tx of [mid, mid - 1, mid + 1, mid - 2, mid + 2]) {
      if (!isPassable(project, hub, tx, front) || doorCells.has(`${tx},${front}`) || standing.has(`${tx},${front}`)
        || hub.events.some((e) => !marchers.has(e.id) && e.x === tx && e.y === front)) continue;
      standing.delete(`${valen.x},${valen.y}`); valen.x = tx; valen.y = front; standing.add(`${tx},${front}`);
      // 행진은 동쪽(앞)부터 — 발렌은 행렬 한가운데(기사 앞 다섯 뒤 넷 사이)에서 걷는다. 맨 뒤에 두면 기사가 다 떠난 뒤 홀로
      // 6~10칸 뒤처져 걸어 「호위」로 읽히지 않았다(VQA r22). 맨 앞은 그 길을 피하느라 기사 모두가 수십 걸음 늦게 떠났다.
      slot[1] = Math.max(...formation.filter(([e]) => e !== valen).map(([, dx]) => dx)) / 2 + 0.5;
      break;
    }
  }

  // 포고를 듣는 백성 — 발렌이 「백성은 들어라」 하는데 듣는 사람이 일행뿐이라 누구에게 말하는지 읽히지 않았다(VQA r7 major).
  // 발렌 서·남쪽 빈 칸에 넷이 서서 발렌을 본다. 주인공이 천문대 문으로 가는 세로 길(시작 칸 좌우 한 칸)과 문 앞은 비운다.
  const start = { x: project.startPos?.x ?? 24, y: project.startPos?.y ?? 23 };
  const crowd: [string, string, number, string, string][] = [
    ["a", "tex_easyrpg_charset_people4", 0, "광장의 농부", "별이 떨어진 게 이단이라니… 우리 밭에도 불똥이 튀었는데."],
    ["b", "tex_easyrpg_charset_people5", 1, "광장의 아낙", "심문관님이 직접 오셨어. 저 숲엔 얼씬도 말아야겠어."],
    ["c", "tex_easyrpg_charset_people4", 2, "광장의 상인", "포고 때문에 동문 길이 막히면 장사는 다 했네."],
    ["d", "tex_easyrpg_charset_people1", 6, "광장의 노인", "하늘에서 온 것을 함부로 부르면 화를 입는 법이야."],
    // 오프닝 아침 그림은 길가에 백성이 늘어서 있다 — 넷은 적었다(VQA r17).
    ["e", "tex_easyrpg_charset_people5", 3, "광장의 처녀", "기사님들 갑옷 좀 봐… 숲에 정말 뭐가 떨어졌나 봐."],
    ["f", "tex_easyrpg_charset_people1", 1, "광장의 청년", "이단이라니. 별을 보고 소원 빈 것도 죄가 되나?"],
  ];
  const hubMeta = (project.tilesets[hub.tilesetId] as unknown as { tileMeta?: ({ label?: string } | null)[] }).tileMeta ?? [];
  const near = (x: number, y: number, r: number, c: { x: number; y: number }) => Math.abs(x - c.x) <= r && Math.abs(y - c.y) <= r;
  const spots: { x: number; y: number }[] = [];
  const candidates: { x: number; y: number; d: number }[] = [];
  // 백성은 발렌 남쪽(길 아래 풀밭)에 모여 위를 본다.
  for (let y = valen.y + 2; y <= valen.y + 5; y += 1) for (let x = valen.x - 5; x <= valen.x + 4; x += 1) {
    if (Math.abs(x - start.x) <= 1 || near(x, y, 1, valen) || !free(x, y)) continue;
    // 엘레나 대사 때 주인공이 옆으로 두 걸음 비켜선다 — 그 두 칸 바로 아래에 서면 몸이 겹쳐 그려졌다(QA fs49).
    if (Math.abs(x - start.x) <= 2 && y <= start.y + 1) continue;
    // 길(포석·흙길) 칸은 비운다 — 외길에 둘이 줄지어 서서 길을 막고 아무것도 안 보는 것처럼 읽혔다(VQA r9).
    if (!/풀밭/.test(hubMeta[hub.lowerTiles[y * hub.width + x]!]?.label ?? "")) continue;
    // 바로 위 칸에 가로등·간판 같은 소품이 있으면 머리에서 기둥이 솟은 것처럼 그려졌다(VQA r14 minor).
    { const t = hub.upperTiles[(y - 1) * hub.width + x] ?? -1; if (t >= 0 && !/풀|꽃|잔돌|자갈|버섯|고사리|덤불|그림자/.test(hubMeta[t]?.label ?? "")) continue; }
    if ([...doorCells].some((k) => { const [dx, dy] = k.split(",").map(Number); return Math.abs(x - dx!) <= 2 && Math.abs(y - dy!) <= 2; })) continue;
    candidates.push({ x, y, d: Math.hypot(x - valen.x, y - (valen.y + 2)) }); // 발렌 바로 앞(두 칸 아래)부터 — 멀면 빈 길을 보는 것처럼 읽혔다(VQA r10)
  }
  candidates.sort((p, q) => p.d - q.d);
  for (const c of candidates) {
    if (spots.length >= crowd.length) break;
    if (spots.some((s) => near(c.x, c.y, 1, s) || (s.x === c.x && Math.abs(s.y - c.y) <= 2))) continue;
    spots.push({ x: c.x, y: c.y }); standing.add(`${c.x},${c.y}`);
  }
  hub.events = hub.events.filter((e) => !String(e.id).startsWith(`ev_${FS_PREFIX}_crowd_`));
  const face = (from: { x: number; y: number }, to: { x: number; y: number }): Step => {
    const dx = to.x - from.x, dy = to.y - from.y;
    return Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? "right" : "left") : (dy > 0 ? "down" : "up");
  };
  const chat = (spot: { x: number; y: number }): Step => {
    const others = spots.filter((o) => o !== spot).sort((p, q) => Math.hypot(p.x - spot.x, p.y - spot.y) - Math.hypot(q.x - spot.x, q.y - spot.y));
    return others[0] ? face(spot, others[0]) : "down";
  };
  spots.forEach((spot, k) => {
    const [key, tex, index, name, line] = crowd[k]!;
    const dx = valen.x - spot.x, dy = valen.y - spot.y;
    // 발렌이 위(북)에 서면 백성은 위를 본다 — 옆모습(좌·우)은 1배에서 카메라를 보는 것처럼 읽혔다(VQA r22). 옆으로 많이 비켜 선 사람만 옆을 본다.
    const direction = dy < 0 && Math.abs(dx) <= 2 * Math.abs(dy) ? "up" : Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? "right" : "left") : (dy > 0 ? "down" : "up");
    const id = `ev_${FS_PREFIX}_crowd_${key}`;
    hub.events.push({
      id, name, x: spot.x, y: spot.y, trigger: { kind: "action" }, commands: [], placementRole: "npc",
      pages: [{
        id: `${id}_p0`, name: `${name} · 기본`, conditions: [],
        graphic: { sprite: { type: "bundled", id: tex }, direction, pattern: charsetFrameIndex({ characterIndex: index, direction, pattern: 1 }) },
        trigger: { kind: "action" }, priority: "same", overlapForbidden: true, movement: { type: "fixed", speed: 3, frequency: 3 },
        commands: [{ kind: "text", speaker: name, body: line }],
      }, {
        // 발렌이 떠난 뒤에도 빈 자리를 보고 서 있었다(VQA r20 minor) — 행렬이 사라지면 가까운 이웃과 마주 보고 수군댄다.
        id: `${id}_p1`, name: `${name} · 행렬 뒤`, conditions: [{ kind: "switch", switchId: SW_VALEN_MARCHED, value: true }],
        graphic: { sprite: { type: "bundled", id: tex }, direction: chat(spot), pattern: charsetFrameIndex({ characterIndex: index, direction: chat(spot), pattern: 1 }) },
        trigger: { kind: "action" }, priority: "same", overlapForbidden: true, movement: { type: "fixed", speed: 3, frequency: 3 },
        commands: [{ kind: "text", speaker: name, body: line }],
      }],
    } as unknown as GameEvent);
  });

  const ts = project.tilesets[hub.tilesetId] as unknown as { autotileGroups?: { id: string; memberTileIds: number[] }[]; tileGroups?: { id: string; tileIds: number[] }[] };
  const pavedIds = new Set<number>([
    ...(ts.autotileGroups?.find((g) => g.id === "beodeul_road_autotile")?.memberTileIds ?? []),
    ...(ts.tileGroups?.find((g) => g.id === "beodeul:plaza")?.tileIds ?? []),
  ]);
  const allow = (x: number, y: number): boolean => pavedIds.has(hub.lowerTiles[y * hub.width + x]!) || (Math.abs(x - exit.x) <= 1 && y <= exit.y + 1);

  const switches: Record<string, string> = { [valen.id]: SW_VALEN_MARCHED, [knight.id]: SW_KNIGHT_MARCHED };
  for (const [id] of escorts) switches[id] = `sw_${id.slice(3)}_marched`;
  const order = [...formation].sort((a, b) => b[1] - a[1]); // 동쪽(앞)부터
  const marches: Command[] = [];
  // 모두 같은 걸음으로 걷는다 — 걸음마다 자리를 미리 셈해, 앞사람과 같은 칸·같은 줄 바로 옆 칸에 서게 되면 출발을 한 걸음씩 늦춘다.
  // (통과 켬이라 겹쳐도 막히지 않아 성문 앞에서 행렬이 한 칸에 포개졌다 — VQA r5.)
  const DIRS: Record<string, [number, number]> = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  const tracks: { x: number; y: number }[][] = [];
  const delays: number[] = [];
  const paths: Step[][] = [];
  const arrivals: number[] = [];
  // 뒤에 출발할 사람의 제자리는 막힌 칸으로 친다 — 한가운데 발렌이 바로 위 기사 칸을 지나가는 길을 고르면 그 기사는
  // 몇 걸음을 기다려도 겹침이 풀리지 않아 뒤 다섯이 60걸음 상한에 걸렸다. 앞서 떠난 사람 칸만 비었다고 본다.
  clearMarchRoute(project, hub, exit, order.map(([npc]) => npc.id));
  const departed = new Set<string>();
  for (const [npc] of order) {
    const path = walkPath(project, hub, { x: npc.x, y: npc.y }, exit, npc.id, { allow, ignore: departed })
      ?? walkPath(project, hub, { x: npc.x, y: npc.y }, exit, npc.id, { ignore: departed })
      ?? walkPath(project, hub, { x: npc.x, y: npc.y }, exit, npc.id, { allow, ignore: marchers })
      ?? walkPath(project, hub, { x: npc.x, y: npc.y }, exit, npc.id, { ignore: marchers });
    departed.add(npc.id);
    if (!path) throw new Error(`[fallen-star] ${npc.id} 가 동문까지 걸어갈 길이 없다`);
    const cells = [{ x: npc.x, y: npc.y }];
    for (const dir of path) { const [dx, dy] = DIRS[dir as string]!; const last = cells[cells.length - 1]!; cells.push({ x: last.x + dx, y: last.y + dy }); }
    // 마지막 한 걸음 동안 옅어져 끝 칸(성문 통로)에 닿자마자 사라진다 — 끝 칸에 머물지 않으므로 뒷사람은 한 칸만 띄우고 따른다.
    const posAt = (track: { x: number; y: number }[], delay: number, t: number) => (t - delay >= track.length ? undefined : track[Math.max(0, t - delay)]);
    // 한 줄 행렬 — 앞사람보다 꼭 두 걸음 뒤에 성문에 닿게 출발을 맞춘다(한 칸 띄운 세로 줄). 겹침이 없을 때까지만 더 늦춘다.
    // 겹침만 피해 가장 이른 출발을 고르면 간격이 1~5칸으로 들쭉날쭉해 발렌이 홀로 앞서 걸었다(VQA r25).
    const arriveAt = arrivals.length ? arrivals[arrivals.length - 1]! + 2 : path.length;
    let delay = Math.max(0, arriveAt - path.length);
    const clash = (d: number): boolean => tracks.some((other, j) => {
      for (let t = 0; t < cells.length + d + 2; t += 1) {
        const a = posAt(cells, d, t), b = posAt(other, delays[j]!, t);
        if (!a || !b) continue;
        // 둘 다 아직 제자리(출발 전)면 처음 대열 그대로다 — 이것까지 겹침으로 치면 대열 앞줄에 선 발렌이 바로 위 기사와
        // 「세로로 붙음」이 끝나지 않아 60걸음을 기다리다 홀로 남았다(VQA r14 major). 내가 제자리일 땐 같은 칸만 본다.
        const aWaiting = t < d, bWaiting = t < delays[j]!;
        if (aWaiting && bWaiting) continue;
        if (a.x === b.x && a.y === b.y) return true;
        if (aWaiting) continue;
        if (a.y === b.y && Math.abs(a.x - b.x) <= 1) return true;
        if (a.x === b.x && Math.abs(a.y - b.y) <= 1 && t > 0) return true;
      }
      return false;
    });
    while (clash(delay) && delay < 60) delay += 1;
    if (process.env.MARCH_DEBUG) console.error("march", npc.id, npc.x, npc.y, "delay", delay, "steps", path.length);
    tracks.push(cells); delays.push(delay); paths.push(path); arrivals.push(delay + path.length);
  }
  order.forEach(([npc], rank) => {
    const path = paths[rank]!;
    const moves = [
      // 처음부터 지나갈 수 있게: 주인공이 성문 통로 앞에 서 있으면 행렬이 막혀 스위치가 안 켜지고, 그동안 투명한 기사가
      // 통로 칸을 막아 숲으로 못 나갔다(QA fallen-town to-forest). 길은 걸을 수 있는 칸으로만 짜였으니 건물은 안 뚫는다.
      { kind: "setThrough", enabled: true },
      // 행진 걸음 — 기본(느림·드묾)으로는 30칸 길에 30초가 넘게 걸려 대사가 끝난 뒤에도 광장에 남았다.
      // 속도 4 = 한 칸 240ms(characterMotion), 빈도 6 = 기다림 한 번 80ms. 명령 경로는 걸음 사이에 쉬지 않으므로 한 걸음 = 기다림 셋이다.
      // 속도 5(200ms)에 기다림 넷(320ms)으로 늦추면 출발 지연이 걸음의 1.6배로 늘어 셈한 대열이 어긋났다 — 발렌이 홀로 앞서고
      // 뒤 기사가 같은 세로 줄에서 발렌 위에 겹쳐 그려졌다(VQA r25 major).
      { kind: "changeSpeed", delta: 1 }, { kind: "changeFrequency", delta: 3 },
      ...Array.from({ length: delays[rank]! * 3 }, () => ({ kind: "wait" })),
      ...path.slice(0, -1).map((dir) => ({ kind: "move", dir })),
      // 성문 통로로 드는 마지막 걸음 동안 세 번에 걸쳐 옅어진다 — 한 프레임에 사라지지 않고(VQA r25 minor), 끝 칸에 머물지도 않는다.
      { kind: "changeOpacity", delta: -85 },
      ...path.slice(-1).map((dir) => ({ kind: "move", dir })),
      { kind: "changeOpacity", delta: -85 }, { kind: "wait" },
      { kind: "changeOpacity", delta: -85 },
      { kind: "setSwitch", switchId: switches[npc.id]!, value: true },
    ];
    marches.push({ kind: "moveEvent", eventId: npc.id, route: { moves, repeat: false, wait: false, skippable: true } } as unknown as Command);
  });
  const names: Record<string, string> = { [SW_VALEN_MARCHED]: "발렌 일행 동문으로 떠남", [SW_KNIGHT_MARCHED]: "심문회 기사 동문으로 떠남" };
  for (const [id, sw] of Object.entries(switches)) {
    if (!project.switches.some((s) => s.id === sw)) project.switches.push({ id: sw, name: names[sw] ?? `${hub.events.find((e) => e.id === id)?.name ?? id} 동문으로 떠남` });
    vanishWhen(hub, id, sw);
  }
  // 화면이 행렬을 따라간다 — 주인공 자리에 머물면 행렬이 곧 화면 동쪽 밖으로 나가 셋·넷만 스쳐 보였다(VQA r3).
  // 행렬 가운데 사람을 따라 성문 통로까지 비추다가, 행렬이 통로로 사라지면 주인공에게 돌아온다.
  const camera = (fields: Record<string, string>): Command => ({ kind: "m2Command", commandId: "m2-201-camera-control", fields } as unknown as Command);
  const middle = order[Math.floor(order.length / 2) + 1]![0].id; // 가운데보다 한 오 뒤 — 앞줄이 통로에 들어설 때 성문루가 화면에 든다
  const follow: Command[] = [
    { kind: "wait", ms: 400 } as Command,
    camera({ mode: "follow", targetEventId: middle, durationMs: "900", wait: "true" }),
    // 따라가는 사람이 성문 통로로 사라질 때까지(벽시계 대기는 느린 기기에서 행렬보다 먼저 끝났다).
    { kind: "loop", body: [
      // 맨 뒤 발렌까지 성문으로 사라진 뒤에 돌아온다 — 가운데 사람 기준이면 발렌이 홀로 남은 채 엘레나 대사가 시작됐다(VQA r14 major).
      { kind: "fork", condition: { kind: "switch", switchId: switches[order[order.length - 1]![0].id]!, value: true }, then: [{ kind: "breakLoop" }] },
      { kind: "wait", ms: 250 },
    ] } as unknown as Command,
    { kind: "wait", ms: 500 } as Command,
    camera({ mode: "return", durationMs: "1000", wait: "true" }),
  ];
  // 행렬이 떠나면 백성은 성문 쪽으로 고개를 돌려 배웅한다 — 빈 연설 자리를 보고 서 있었다(VQA r20 minor).
  const watch: Command[] = spots.map((spot, k) => ({ kind: "moveEvent", eventId: `ev_${FS_PREFIX}_crowd_${crowd[k]![0]}`,
    route: { moves: [{ kind: "turn", dir: face(spot, exit) }], repeat: false, wait: false, skippable: true } } as unknown as Command));
  list.splice(after + 1, 0, ...marches, ...watch, ...follow);
  // 포고 동안 주인공(과 동료)은 발렌 쪽을 본다 — 화면만 보고 서 있었다(VQA r6 major).
  const begin = list.findIndex((c) => c.kind === "cutsceneControl");
  const towardValen: Step = valen.x > (project.startPos?.x ?? 0) ? "right" : "left";
  // 발렌의 포고 넉 줄은 남쪽 백성에게 하는 말이다 — 대사 자동 돌아보기가 그를 서쪽 주인공 쪽으로 돌려 백성에게 옆모습을 보였다.
  for (const c of list.slice(0, after + 1)) if (c.kind === "text" && /발렌/.test(String((c as { speaker?: string }).speaker ?? ""))) (c as { autoFace?: boolean }).autoFace = false;
  // 광장 둘레 붙박이 주민(할머니 등)도 포고 동안 발렌을 본다 — 카메라를 보고 서 있었다(VQA r22).
  const listeners: Command[] = hub.events.filter((e) => !marchers.has(e.id) && !String(e.id).startsWith("ev_gate_") && !String(e.id).startsWith(`ev_${FS_PREFIX}_crowd_`)
    && Math.abs(e.x - valen.x) <= 7 && Math.abs(e.y - valen.y) <= 5 && (e.pages?.[0]?.graphic as { sprite?: unknown } | undefined)?.sprite
    && (e.pages?.[0]?.movement?.type ?? "fixed") === "fixed")
    .map((e) => {
      const ddx = valen.x - e.x, ddy = valen.y - e.y;
      const dir: Step = ddy < 0 && Math.abs(ddx) <= 2 * Math.abs(ddy) ? "up" : Math.abs(ddx) >= Math.abs(ddy) ? (ddx > 0 ? "right" : "left") : (ddy > 0 ? "down" : "up");
      return { kind: "moveEvent", eventId: e.id, route: { moves: [{ kind: "turn", dir }], repeat: false, wait: false, skippable: true } } as unknown as Command;
    });
  list.splice(begin + 1, 0, { kind: "moveEvent", eventId: "@player", route: { moves: [{ kind: "turn", dir: towardValen }], repeat: false, wait: true, skippable: true } } as unknown as Command, ...listeners);
  // 엘레나가 말할 때 주인공이 화면(아래)을 보고 있었다(VQA r5) — 엘레나 쪽(위)으로 돌아선다.
  const elenaLine = list.findIndex((c) => c.kind === "text" && String((c as { body?: string }).body).includes("들었지, 카엘"));
  // 위를 보면 RTP 주인공 칩 뒷모습(머리 뒤 흰 띠)이 얼굴처럼 읽혀 엘레나에게 등을 돌린 것으로 보였다(VQA r10 major) —
  // 주인공이 옆으로 두 걸음 비켜서면 뒤따르던 엘레나가 곁(같은 줄)으로 와 서로 옆모습으로 마주 본다.
  const startX = project.startPos?.x ?? 24, startY = project.startPos?.y ?? 23;
  // 비켜설 두 칸에 묘목·풀 포기 같은 덧그림이 있으면 그 위에 선 것처럼 그려졌다(VQA r22) — 덧그림 없는 칸만.
  // 시작 칸과 비켜설 줄의 낮은 풀 덧그림(헤더·고사리·풀 포기)은 걷는다 — 주인공이 헤더 덤불 위에 서서 시작하고, 비켜선 칸의 고사리에
  // 발이 묻혔다(VQA r22·r23). 나무·덤불(묘목)은 그대로 두고, 그런 칸으로는 비켜서지 않는다.
  {
    const metaH = (project.tilesets[hub.tilesetId] as unknown as { tileMeta?: ({ label?: string } | null)[] }).tileMeta ?? [];
    for (let dx = -2; dx <= 2; dx += 1) for (const layer of [hub.upperTiles, hub.upperOverlayTiles]) {
      const i = startY * hub.width + startX + dx, t = layer?.[i] ?? -1;
      if (t >= 0 && /헤더|고사리|풀 포기|들꽃|버섯|잔돌/.test(metaH[t]?.label ?? "")) layer![i] = -1;
    }
  }
  const bareCell = (x: number, y: number): boolean => [hub.lowerOverlayTiles, hub.upperTiles, hub.upperOverlayTiles].every((l) => (l?.[y * hub.width + x] ?? -1) < 0);
  const sideOpen = (dx: number): boolean => [1, 2].every((k) => isPassable(project, hub, startX + dx * k, startY) && bareCell(startX + dx * k, startY)
    && !hub.events.some((e) => e.x === startX + dx * k && e.y === startY && !marchers.has(e.id)));
  const side: Step | undefined = sideOpen(-1) ? "left" : sideOpen(1) ? "right" : undefined;
  const faceElena: unknown[] = side ? [{ kind: "move", dir: side }, { kind: "move", dir: side }, { kind: "turn", dir: side === "left" ? "right" : "left" }] : [{ kind: "turn", dir: "up" }];
  if (elenaLine >= 0) list.splice(elenaLine, 0, { kind: "moveEvent", eventId: "@player", route: { moves: faceElena, repeat: false, wait: true, skippable: true } } as unknown as Command);
  // 포고 넉 줄 동안 화면을 발렌과 그 아래 백성 쪽으로 옮긴다 — 주인공을 따라가는 화면에선 발렌 몸 아래가 대화 상자에 묻히고
  // 듣는 백성(발렌 두~다섯 줄 아래)은 상자 밑이라 안 보였다(VQA r27). 상자 위 열 줄 안에 호위·발렌·가까운 백성이 함께 든다.
  {
    // 발렌 두 줄 아래가 화면 가운데 — 호위 두 줄이 화면 위 끝에 잘리지 않고, 가까운 백성 줄이 상자 위에 든다.
    const cy = valen.y + 2;
    const cx = Math.round((startX + valen.x) / 2) + 1;
    const box = list.findIndex((c) => c.kind === "m2Command" && (c as { commandId?: string }).commandId === "m2-202-screen-effect");
    if (box >= 0) list.splice(box + 1, 0, camera({ mode: "panTo", target: "screen", x: String(cx), y: String(cy), durationMs: "700", wait: "true" }));
  }
}

/**
 * 문 둘레(체비쇼프 2칸)에 선 붙박이 NPC 를 떨어진 빈 칸으로 옮긴다 — 가게에서 나오면 동료가 문 옆 NPC 바로 아래 칸에 서
 * 모자가 NPC 몸을 덮어 한 덩이로 그려졌다(VQA r7 major, 약방 앞 할머니).
 */
function clearDoorFronts(project: Project, map: GameMap | undefined): void {
  if (!map) return;
  const doors = map.events.filter((e) => String(e.id).startsWith("ev_gate_"));
  const nearDoor = (x: number, y: number, r: number): boolean => doors.some((d) => Math.abs(d.x - x) <= r && Math.abs(d.y - y) <= r);
  for (const npc of map.events) {
    // 성문 문지기·포고 행렬은 문 곁이 제자리다.
    // 바로 위 칸에 큰 소품(물레방아 등)이 있으면 그 밑에 끼어 선 것처럼 보였다(VQA r8 minor, 빵집 아주머니) — 그때도 옮긴다.
    const metaD = (project.tilesets[map.tilesetId] as unknown as { tileMeta?: ({ label?: string } | null)[] }).tileMeta ?? [];
    const underProp = (x: number, y: number): boolean => {
      const t = map.upperTiles[(y - 1) * map.width + x] ?? -1;
      return t >= 0 && !/풀|꽃|잔돌|자갈|버섯|고사리|덤불|그림자/.test(metaD[t]?.label ?? "");
    };
    if (String(npc.id).startsWith("ev_gate_") || /_(escort_|valen|knight|crowd_)|_gate$/.test(String(npc.id)) || (!nearDoor(npc.x, npc.y, 2) && !underProp(npc.x, npc.y))) continue;
    const page = npc.pages?.[0];
    // 돌아다니는 사람도 처음 선 칸이 소품 밑이면 옮긴다(빵집 아주머니가 물레방아 밑에서 시작했다 — VQA r8·r15).
    if (!page?.graphic?.sprite || ((page.movement?.type ?? "fixed") !== "fixed" && !underProp(npc.x, npc.y))) continue;
    let best: { x: number; y: number; d: number } | undefined;
    for (let y = npc.y - 6; y <= npc.y + 6; y += 1) for (let x = npc.x - 6; x <= npc.x + 6; x += 1) {
      if (x < 1 || y < 1 || x >= map.width - 1 || y >= map.height - 1 || nearDoor(x, y, 3) || underProp(x, y)) continue;
      if (!isPassable(project, map, x, y) || map.events.some((e) => e !== npc && Math.abs(e.x - x) <= 1 && Math.abs(e.y - y) <= 1)) continue;
      const d = Math.abs(x - npc.x) + Math.abs(y - npc.y);
      if (!best || d < best.d) best = { x, y, d };
    }
    if (best) { npc.x = best.x; npc.y = best.y; }
  }
}

/** 손 도트 실내(atlas_biome_interior): 천장(default 2~33·rock 34~65) → 천장(dark 66~97), 가장자리에서 이어진 바위벽 메움 → 공허(1). */
/**
 * 화로의 방 바닥 — 퍼즐 견본이 깐 「그을린 흙」 세로 띠 셋이 감옥 돌바닥 사이에서 밝은 띠(렌더 오류처럼)로 보였다(VQA r3).
 * 같은 칸 이웃 번호를 지키려고 띠 칸을 그 방의 감옥 돌바닥 칸으로 바꾸고, 창살이 열릴 때 띠를 다시 칠하는 칸 바꾸기도 같이 바꾼다.
 */
function unifyPuzzleFloor(project: Project, map: GameMap | undefined): void {
  if (!map) return;
  const meta = (project.tilesets[map.tilesetId] as unknown as { tileMeta?: ({ label?: string } | null)[] }).tileMeta ?? [];
  const label = (t: number): string => (t >= 0 ? meta[t]?.label ?? "" : "");
  const stone = [...new Set(map.lowerTiles.filter((t) => label(t).startsWith("바닥 · 감옥 돌바닥")))];
  if (!stone.length) return;
  const swap = (t: number, x: number, y: number): number => label(t).startsWith("바닥 · 그을린 흙") ? stone[(((x * 73856093) ^ (y * 19349663)) >>> 0) % stone.length]! : t;
  map.lowerTiles.forEach((t, i) => { map.lowerTiles[i] = swap(t, i % map.width, Math.floor(i / map.width)); });
  for (const event of map.events) for (const list of eventCommandLists(event)) for (const cmd of list) {
    const rec = cmd as unknown as { kind?: string; layer?: string; tile?: number; x?: number; y?: number };
    if (rec.kind === "changeTile" && rec.layer === "lower" && typeof rec.tile === "number") rec.tile = swap(rec.tile, rec.x ?? 0, rec.y ?? 0);
  }
}

/**
 * 숲 오솔길이 네 토막이었다(VQA r3) — 사이의 짙은 풀숲 칸을 걷어 내며 끊긴 자리를 잇는다. 토막마다 가장 가까운 다른 토막까지
 * 걸을 수 있는 칸으로 최단 길을 찾아 두 칸 폭 모랫길로 칠한다.
 */
function joinForestTrail(project: Project, forestId: string): void {
  for (let round = 0; round < 8; round += 1) {
    const map = project.maps[forestId];
    if (!map) return;
    const W = map.width, H = map.height;
    const meta = (project.tilesets[map.tilesetId] as unknown as { tileMeta?: ({ label?: string } | null)[] }).tileMeta ?? [];
    const isTrail = (i: number): boolean => (meta[map.lowerTiles[i]!]?.label ?? "").startsWith("버들항 · 모랫길");
    const comp = new Int32Array(W * H).fill(-1);
    let count = 0;
    for (let i = 0; i < W * H; i += 1) {
      if (!isTrail(i) || comp[i]! >= 0) continue;
      const stack = [i]; comp[i] = count;
      while (stack.length) {
        const c = stack.pop()!;
        for (const n of [c - 1, c + 1, c - W, c + W]) {
          if (n < 0 || n >= W * H || (Math.abs((n % W) - (c % W)) > 1) || comp[n]! >= 0 || !isTrail(n)) continue;
          comp[n] = count; stack.push(n);
        }
      }
      count += 1;
    }
    if (count <= 1) return;
    // 0번 토막에서 다른 토막까지 BFS.
    const prev = new Int32Array(W * H).fill(-2);
    const queue: number[] = [];
    for (let i = 0; i < W * H; i += 1) if (comp[i] === 0) { prev[i] = -1; queue.push(i); }
    let hit = -1;
    for (let q = 0; q < queue.length && hit < 0; q += 1) {
      const c = queue[q]!;
      for (const n of [c - 1, c + 1, c - W, c + W]) {
        if (n < 0 || n >= W * H || Math.abs((n % W) - (c % W)) > 1 || prev[n]! !== -2) continue;
        const x = n % W, y = Math.floor(n / W);
        if (comp[n]! > 0) { prev[n] = c; hit = n; break; }
        if (x < 1 || y < 1 || x >= W - 1 || y >= H - 1 || !isPassable(project, map, x, y)) continue;
        prev[n] = c; queue.push(n);
      }
    }
    if (hit < 0) return;
    const cells: number[] = [];
    for (let c = prev[hit]!; c >= 0 && comp[c] !== 0; c = prev[c]!) cells.push(c);
    // 두 칸 폭 — 길이 세로로 가면 오른쪽, 가로로 가면 아래 칸을 더한다(걸을 수 있을 때만).
    const paint = new Set<number>(cells);
    cells.forEach((c, k) => {
      const next = cells[k + 1] ?? prev[c]!;
      const vertical = next >= 0 && Math.abs(next - c) === W;
      const side = vertical ? c + 1 : c + W;
      if (side >= 0 && side < W * H && isPassable(project, map, side % W, Math.floor(side / W))) paint.add(side);
    });
    for (const c of paint) {
      const live = project.maps[forestId]!; // fill_region 은 맵 객체를 바꿔 끼운다
      if ((live.upperTiles[c] ?? -1) >= 0 && isPassable(project, live, c % W, Math.floor(c / W))) live.upperTiles[c] = -1;
      execTool(project, "fill_region", { mapId: forestId, x: c % W, y: Math.floor(c / W), w: 1, h: 1, layer: "lower", material: "버들항 모랫길" });
    }
  }
}

/**
 * 벽 걸이(액자·별자리표·거미줄·문틀…)가 걸을 수 있는 바닥 칸에 걸쳐 있으면 깃발처럼 홀로 선다(scene-hang-on-floor) —
 * 그 걸이 한 덩이(같은 키트 칸이 이어진 것)를 통째로 걷는다. 벽면에만 걸린 걸이는 그대로 둔다.
 */
function dropFloorHangs(project: Project, map: GameMap): void {
  const hangIds = new Set(Object.entries((handInteriorSpec as { objects: Record<string, { kind?: string }> }).objects).filter(([, o]) => o.kind === "hang").map(([id]) => id));
  const kits = (project.tilesets[map.tilesetId] as unknown as { structureKits?: { id: string; rows?: { upperTiles?: number[] }[] }[] }).structureKits ?? [];
  const kitOf = new Map<number, string>();
  for (const kit of kits) if (kit.id.startsWith("hand-interior:") && hangIds.has(kit.id.slice(14))) for (const row of kit.rows ?? []) for (const t of row.upperTiles ?? []) if (t >= 0) kitOf.set(t, kit.id);
  const W = map.width;
  for (const layer of [map.upperTiles, map.upperOverlayTiles]) {
    if (!layer) continue;
    for (let i = 0; i < layer.length; i += 1) {
      const kit = kitOf.get(layer[i]!);
      if (!kit || !isPassable(project, map, i % W, Math.floor(i / W))) continue;
      const stack = [i];
      while (stack.length) {
        const c = stack.pop()!;
        if (kitOf.get(layer[c]!) !== kit) continue;
        layer[c] = -1;
        if (c % W > 0) stack.push(c - 1);
        if (c % W < W - 1) stack.push(c + 1);
        if (c >= W) stack.push(c - W);
        if (c + W < layer.length) stack.push(c + W);
      }
    }
  }
}

function darkenInteriorMargins(map: GameMap): void {
  const W = map.width, H = map.height;
  const layers = [map.lowerTiles, map.lowerOverlayTiles, map.upperTiles, map.upperOverlayTiles].filter((l): l is number[] => !!l);
  for (const layer of layers) for (let i = 0; i < layer.length; i += 1) {
    const t = layer[i]!;
    if (t >= 2 && t <= 33) layer[i] = t + 64;
    else if (t >= 34 && t <= 65) layer[i] = t + 32;
  }
  const ROCK = new Set([3132, 3134, 3166, 3168, 3170, 3172, 3174, 3176]);
  const VOID = 1;
  const fill = (i: number): boolean => ROCK.has(map.lowerTiles[i]!) || map.lowerTiles[i] === VOID;
  const seen = new Set<number>();
  const queue: number[] = [];
  for (let x = 0; x < W; x += 1) for (const y of [0, H - 1]) { const i = y * W + x; if (fill(i) && !seen.has(i)) { seen.add(i); queue.push(i); } }
  for (let y = 0; y < H; y += 1) for (const x of [0, W - 1]) { const i = y * W + x; if (fill(i) && !seen.has(i)) { seen.add(i); queue.push(i); } }
  while (queue.length) {
    const i = queue.shift()!, x = i % W, y = Math.floor(i / W);
    if (ROCK.has(map.lowerTiles[i]!)) { map.lowerTiles[i] = VOID; for (const layer of layers.slice(1)) layer[i] = -1; }
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = x + dx, ny = y + dy, n = ny * W + nx;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H || seen.has(n) || !fill(n)) continue;
      seen.add(n); queue.push(n);
    }
  }
}


export const SW_VALEN_ARRIVED = "sw_fs_valen_arrived";
const SW_VALEN_WALKING = "sw_fs_valen_walking";
/**
 * 지하의 발렌은 처음부터 등불 앞에 서 있지 않고, 일행이 방에 들어서면 북쪽 통로에서 걸어 내려와 선다(가혹 검수 r12
 * 「발렌 보스 등장도 입구에서 걸어 들어오게」). 걷는 그림은 따로 둔 이벤트가 맡고, 닿는 순간 스위치로 진짜 보스 이벤트와
 * 바꿔 세운다 — 보스 이벤트의 칸이 고정이라 불러오기·재도전·지도 재진입에서도 자리가 어긋나지 않는다.
 * 남쪽 통로 한 줄(보스 아래 5칸)에 밟는 칸을 깔고, 스위치가 켜지면 그 칸들은 사라진다.
 */
function valenWalksIn(project: Project, vault: GameMap, bossId: string, from?: { x: number; y: number }): void {
  const boss = vault.events.find((e) => e.id === bossId);
  if (!boss?.pages?.length) return;
  if (!project.switches.some((s) => s.id === SW_VALEN_ARRIVED)) project.switches.push({ id: SW_VALEN_ARRIVED, name: "발렌이 등불 앞에 섰다" });
  const arrived = { kind: "switch", switchId: SW_VALEN_ARRIVED, value: true } as const;
  // 보스의 모든 페이지는 도착 뒤에만. 그 전에는 맨 앞의 빈 페이지(조건 없음)가 남는다 — 나중 페이지가 이긴다.
  for (const page of boss.pages) page.conditions = [...(page.conditions ?? []), arrived];
  boss.pages.unshift({
    id: `${bossId}_unseen`, name: "아직 오지 않음", conditions: [], graphic: { transparent: true },
    movement: { type: "fixed", speed: 3, frequency: 3 }, priority: "below", trigger: { kind: "action" }, commands: [],
  } as EventPage);
  // 금고의 발렌도 마을의 발렌과 같은 칩(흉상에 맞춘 긴 푸른 머리·머리띠).
  ensureFallenValenChip(project);
  setEventChip(vault, bossId, FS_VALEN_CHARSET_ID, FS_VALEN_CHARSET_INDEX);
  const visible = boss.pages.find((p) => p.graphic?.sprite)?.graphic;
  // 북쪽 통로에서 출발: 보스 위로 6~8칸, 좌우 2칸 안의 걸을 수 있는 칸 중 보스까지 길이 가장 긴(가장 깊은) 곳.
  let start: { x: number; y: number } | undefined;
  let path: Step[] | null = null;
  // 출발 칸을 정해 주면(옛 별지기의 방: 성소 북서 돌 계단 발치) 그 칸에서 보스까지 걷는다.
  if (from && isPassable(project, vault, from.x, from.y)) {
    path = walkPath(project, vault, from, { x: boss.x, y: boss.y }, bossId);
    if (path) start = { ...from };
  }
  for (let dy = 8; dy >= 6 && !path; dy -= 1) {
    for (const dx of [0, 1, -1, 2, -2]) {
      const cell = { x: boss.x + dx, y: boss.y - dy };
      // 머리 칸(바로 위)도 걸을 수 있어야 한다 — 쇠창살 문 바로 아래 칸에 세우면 창살 그림(위층)이 머리를 덮었다(VQA r2).
      if (cell.y < 1 || !isPassable(project, vault, cell.x, cell.y) || !isPassable(project, vault, cell.x, cell.y - 1)) continue;
      const found = walkPath(project, vault, cell, { x: boss.x, y: boss.y }, bossId);
      if (found) { start = cell; path = found; break; }
    }
  }
  if (!start || !path) throw new Error("[fallen-star] 발렌이 걸어 들어올 길을 찾지 못했다");
  const walkerId = `ev_${FS_PREFIX}_valen_walk_in`;
  vault.events = vault.events.filter((e) => e.id !== walkerId && !String(e.id).startsWith(`ev_${FS_PREFIX}_valen_cue_`));
  if (!project.switches.some((s) => s.id === SW_VALEN_WALKING)) project.switches.push({ id: SW_VALEN_WALKING, name: "발렌이 통로를 내려온다" });
  boss.pages.splice(1, 0, {
    id: `${bossId}_walking`, name: "통로를 내려온다", conditions: [{ kind: "switch", switchId: SW_VALEN_WALKING, value: true }],
    graphic: { ...visible, direction: "down" }, movement: { type: "fixed", speed: 3, frequency: 3 },
    priority: "same", trigger: { kind: "action" }, commands: [],
  } as EventPage);
  const placeBoss = (at: { x: number; y: number }): Command =>
    ({ kind: "m2Command", commandId: "m2-040-set-event-location", fields: { target: bossId, mapId: vault.id, x: at.x, y: at.y } } as unknown as Command);
  const cue: Command[] = [
    { kind: "cutsceneControl", mode: "begin", skippable: true },
    narrate("어둠 저편에서 발소리가 내려온다."),
    { kind: "showEmote", target: "player", emote: "exclamation", durationMs: 700 },
    // 화면이 북쪽 통로를 비추게 들어 올린다 — 일행 자리에서는 통로가 화면 밖이라 걸어 내려오는 모습이 안 보였다.
    { kind: "m2Command", commandId: "m2-049-scroll-map", fields: { direction: "up", distance: "4", durationMs: "700", wait: "true" } },
    placeBoss(start),
    { kind: "setSwitch", switchId: SW_VALEN_WALKING, value: true },
    { kind: "moveEvent", eventId: bossId, route: { moves: [...path.map((dir) => ({ kind: "move", dir })), { kind: "turn", dir: "down" }], repeat: false, wait: true, skippable: true } },
    { kind: "label", name: "cutscene_end" },
    // 건너뛰면 걷다 만 자리에 선다 — 등불 앞 제자리로 붙인다.
    placeBoss({ x: boss.x, y: boss.y }),
    { kind: "m2Command", commandId: "m2-049-scroll-map", fields: { mode: "return", durationMs: "500", wait: "true" } },
    { kind: "setSwitch", switchId: SW_VALEN_ARRIVED, value: true },
    { kind: "cutsceneControl", mode: "end" },
  ] as unknown as Command[];
  const row = boss.y + 5;
  for (let x = boss.x - 3; x <= boss.x + 3; x += 1) {
    if (!isPassable(project, vault, x, row)) continue;
    vault.events.push({
      id: `ev_${FS_PREFIX}_valen_cue_${x}`, name: "발렌 등장", x, y: row, trigger: { kind: "playerTouch" }, commands: [],
      pages: [
        { id: `ev_${FS_PREFIX}_valen_cue_${x}_on`, name: "밟으면", conditions: [{ kind: "switch", switchId: SW_VALEN_ARRIVED, value: false }],
          graphic: { transparent: true }, movement: { type: "fixed", speed: 3, frequency: 3 }, priority: "below", trigger: { kind: "playerTouch" }, commands: clone(cue) },
        { id: `ev_${FS_PREFIX}_valen_cue_${x}_off`, name: "지남", conditions: [arrived],
          graphic: { transparent: true }, movement: { type: "fixed", speed: 3, frequency: 3 }, priority: "below", trigger: { kind: "action" }, commands: [] },
      ],
    } as unknown as GameEvent);
  }
}

/**
 * 사운드트랙(사용자 검토 2026-10-21 「기본 곡처럼 들린다」). 광장 fld-003·전투 btl-001·타이틀 ttl-001 은 새 프로젝트 기본곡이었다.
 * 곡 설명만으로 고른 1차 배치는 귀 검수에서 절반이 「싸구려 MIDI」였다 — 장면마다 후보 3~10곡을 Gemini 4 Argon 에 소리째 붙여
 * (30초 발췌, 3회 평균) 「장면 적합·제작 품질」을 매겨 가장 높은 곡을 쓴다. 점수표: 아래 각 줄 (적합/품질).
 * 일반 전투에 맞는 곡은 카탈로그에 없다(btl-002 4.0/6.3 이 최고 — 무겁다). 보스와 같은 곡을 쓰는 임시 배치다.
 */
const FS_MUSIC = {
  title: "cc0-bgm-rtp-flt-016",        // 구름 사이의 첫 항로 7.0/6.0
  opening: "cc0-bgm-rtp-flt-002",      // 첫빛이 머무는 표지 5.0/7.7
  hub: "cc0-bgm-rtp-fld-001",          // 초원 길드 광장 8.0/6.7
  observatory: "cc0-bgm-rtp-hlc-004",  // 고지대 학문 도시 — 하프 변주 6.0/6.7
  forest: "cc0-bgm-rtp-fld-002",       // 바람길 숲 8.0/7.0
  vaultGate: "cc0-bgm-rtp-rui-001",    // 가라앉은 천문대 8.0/7.0
  vault: "cc0-bgm-rtp-dng-001",        // 이끼빛 회랑 8.0/7.0
  battle: "cc0-bgm-rtp-btl-002",       // 재의 왕관 4.0/6.3 — 맞는 일반 전투곡 없음
  boss: "cc0-bgm-rtp-btl-002",         // 재의 왕관 8.7/7.0
  ending: "cc0-bgm-rtp-flt-023",       // 말이 멎은 뒤의 별 8.0/7.0
} as const;
function applyFallenSoundtrack(project: Project, maps: { hub: GameMap; observatory: GameMap; forest: GameMap; vault: GameMap }, bossId: string | undefined): void {
  const bgm = (resourceId: string) => ({ mode: "custom", resourceId }) as GameMap["bgm"];
  maps.hub.bgm = bgm(FS_MUSIC.hub);
  maps.observatory.bgm = bgm(FS_MUSIC.observatory);
  maps.forest.bgm = bgm(FS_MUSIC.forest);
  maps.vault.bgm = bgm(FS_MUSIC.vault);
  const gate = project.maps["fs_vault_gate"];
  if (gate) gate.bgm = bgm(FS_MUSIC.vaultGate);
  project.system.battleBgmResourceId = FS_MUSIC.battle;
  if (project.system.titleScreen) project.system.titleScreen.musicResourceId = FS_MUSIC.title;
  if (project.system.opening) project.system.opening.musicResourceId = FS_MUSIC.opening;
  for (const ending of project.endings ?? []) ending.presentation = { ...ending.presentation, musicResourceId: FS_MUSIC.ending };
  // 결전만 보스 변주로 — 전투 직전 시스템 전투곡을 바꾸고, 끝나면(이기든 지든) 되돌린다.
  const boss = bossId ? maps.vault.events.find((e) => e.id === bossId) : undefined;
  const systemBgm = (fields: Record<string, string>) => ({ kind: "m2Command", commandId: "m2-027-change-system-bgm", fields: { cue: "battle", ...fields } }) as unknown as Command;
  for (const list of boss ? eventCommandLists(boss) : []) {
    for (let i = list.length - 1; i >= 0; i -= 1) {
      if (list[i]!.kind !== "battleProcessing") continue;
      list.splice(i + 1, 0, systemBgm({ operation: "reset" }));
      list.splice(i, 0, systemBgm({ operation: "set", resourceId: FS_MUSIC.boss, volume: "100" }));
    }
  }
}

/** origin 에서 가장 가까운, 걸을 수 있고 다른 이벤트와 붙지 않은 빈 칸. */
/**
 * 결전 승리 뒤 흐름(감사 2차): 장 구성기는 승리 즉시 단계 스위치를 켜 발렌이 「연기 속으로」 대사 전에 사라졌고,
 * 렌즈가 빛을 쏘아 올린다는 줄에서도 화면이 그대로였다. 스위치는 발렌의 퇴장 대사 뒤로 미루고(연기와 함께),
 * 렌즈 자리에 빛 효과와 화면 섬광을 넣는다.
 */
function stageBossVictory(vault: GameMap, lens: { x: number; y: number }): void {
  const hit = findTextList(vault, "발렌은 연기 속으로");
  if (!hit) throw new Error("[fallen-star] 결전 승리 대사를 찾지 못했다");
  const list = hit.list;
  const firstText = list.findIndex((c) => c.kind === "text");
  const progress = list.slice(0, firstText).filter((c) => c.kind === "setSwitch" || c.kind === "setVariable");
  for (const c of progress) list.splice(list.indexOf(c), 1);
  const exitAt = list.findIndex((c) => c.kind === "text" && String((c as { body?: string }).body).includes("발렌은 연기 속으로"));
  const fx = (commandId: string, fields: Record<string, unknown>) => ({ kind: "m2Command", commandId, fields } as unknown as Command);
  list.splice(exitAt, 0, fx("m2-224-particle-effect", { preset: "smoke", target: "tile", x: lens.x, y: lens.y + 3, durationMs: 900, wait: false }));
  list.splice(exitAt + 2, 0, ...progress);
  const beamAt = list.findIndex((c) => c.kind === "text" && String((c as { body?: string }).body).includes("렌즈가 빛을 모아"));
  list.splice(beamAt, 0,
    fx("m2-224-particle-effect", { preset: "sparkle", target: "tile", x: lens.x, y: lens.y, durationMs: 1600, wait: false }),
    fx("m2-047-flash-screen", { color: "white", value: "flash", durationMs: 400 }),
    { kind: "playAudio", resourceId: "easyrpg-sound-chime2", loop: false, channel: "se" } as unknown as Command,
  );
}

function nearFree(project: Project, map: GameMap, origin: { x: number; y: number }, maxR: number, selfId?: string): { x: number; y: number } | undefined {
  const others = map.events.filter((e) => e.id !== selfId);
  for (let r = 0; r <= maxR; r += 1) {
    for (let dy = -r; dy <= r; dy += 1) for (let dx = -r; dx <= r; dx += 1) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
      const x = origin.x + dx, y = origin.y + dy;
      if (x < 1 || y < 1 || x >= map.width - 1 || y >= map.height - 1 || !isPassable(project, map, x, y)) continue;
      if (others.some((e) => Math.abs(e.x - x) + Math.abs(e.y - y) <= 1)) continue;
      return { x, y };
    }
  }
  return undefined;
}

/** 소품 발자국이 모두 걸을 수 있는 빈 바닥이고 이벤트와 붙지 않을 때만 찍는다(길·조사 칸을 막지 않는다). */
/** 숲 맵의 맨 풀밭에 밟을 수 있는 바닥 덮개(고사리·히스·들풀·잔돌)를 덩이지게 깐다. 길 바로 곁·이벤트 곁은 비운다. */
function fillForestUnderstory(project: Project, mapId: string): void {
  const map0 = project.maps[mapId];
  if (!map0) return;
  const W = map0.width, H = map0.height;
  const meta = (project.tilesets[map0.tilesetId] as unknown as { tileMeta?: ({ label?: string } | null)[] }).tileMeta ?? [];
  const isOpen = (m: GameMap, i: number): boolean => {
    const x = i % W, y = Math.floor(i / W);
    if (x < 1 || y < 1 || x >= W - 1 || y >= H - 1 || !isPassable(project, m, x, y)) return false;
    if ([m.lowerOverlayTiles, m.upperTiles, m.upperOverlayTiles].some((l) => (l?.[i] ?? -1) >= 0)) return false;
    if (/모랫길|바닥 흙|절벽/.test(meta[m.lowerTiles[i]!]?.label ?? "")) return false;
    return !m.events.some((e) => Math.abs(e.x - x) + Math.abs(e.y - y) <= 1);
  };
  const m0 = project.maps[mapId]!;
  // 열린 정도 = 가장 가까운 「열리지 않은 칸」까지의 체스판 거리.
  const dist = new Int16Array(W * H).fill(-1);
  const q: number[] = [];
  for (let i = 0; i < W * H; i += 1) if (!isOpen(m0, i)) { dist[i] = 0; q.push(i); }
  for (let k = 0; k < q.length; k += 1) {
    const i = q[k]!, x = i % W, y = Math.floor(i / W);
    for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) {
      const nx = x + dx, ny = y + dy, j = ny * W + nx;
      if ((dx || dy) && nx >= 0 && ny >= 0 && nx < W && ny < H && dist[j]! < 0) { dist[j] = dist[i]! + 1; q.push(j); }
    }
  }
  const covers = ["fern-a", "fern-b", "fern-c", "heath-a", "heath-b", "heath-c", "wild-a", "wild-b", "wild-c", "fern-b", "heath-a", "stones-a", "toadstools-b"];
  const hash = (x: number, y: number, k: number): number => (Math.imul(x + 31 * k, 73856093) ^ Math.imul(y + 17 * k, 19349663)) >>> 0;
  // 덩이: 칸마다 근처 「씨앗」 칸과의 거리로 정한다 — 고르게 흩지 않는다.
  const seeds: { x: number; y: number }[] = [];
  for (let y = 1; y < H - 1; y += 3) for (let x = 1; x < W - 1; x += 3) if (hash(x, y, 1) % 100 < 55) seeds.push({ x: x + (hash(x, y, 2) % 3), y: y + (hash(x, y, 3) % 3) });
  const pathAt = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < W && y < H && /모랫길|바닥 흙/.test(meta[m0.lowerTiles[y * W + x]!]?.label ?? "");
  for (let i = 0; i < W * H; i += 1) {
    if (dist[i]! < 1) continue;
    const x = i % W, y = Math.floor(i / W);
    // 길 바로 곁(상하좌우 한 칸)은 덩이 씨앗 곁일 때만 — 길섶이 한 줄로 고르게 덮이면 심은 화단처럼 읽힌다.
    const verge = pathAt(x - 1, y) || pathAt(x + 1, y) || pathAt(x, y - 1) || pathAt(x, y + 1);
    const near = seeds.some((sd) => Math.max(Math.abs(sd.x - x), Math.abs(sd.y - y)) <= 1);
    if (!near && hash(x, y, 4) % 100 >= 12) continue;
    if (verge && hash(x, y, 6) % 100 >= 45) continue;
    const before = project.maps[mapId]!;
    if (!isOpen(before, i)) continue;
    const snap = { up: [...before.upperTiles], uo: before.upperOverlayTiles ? [...before.upperOverlayTiles] : undefined, lo: before.lowerOverlayTiles ? [...before.lowerOverlayTiles] : undefined };
    const kit = covers[hash(Math.floor(x / 2), Math.floor(y / 2), 5) % covers.length]!;
    if (!tryStamp(project, before, `kit:beodeul_city/bd-pick-deep-forest-path-${kit}`, x, y)) continue;
    const after = project.maps[mapId]!;
    if (!isPassable(project, after, x, y)) {
      after.upperTiles.splice(0, after.upperTiles.length, ...snap.up);
      if (snap.uo && after.upperOverlayTiles) after.upperOverlayTiles.splice(0, after.upperOverlayTiles.length, ...snap.uo);
      if (snap.lo && after.lowerOverlayTiles) after.lowerOverlayTiles.splice(0, after.lowerOverlayTiles.length, ...snap.lo);
    }
  }
}

function tryStamp(project: Project, map: GameMap, objectId: string, x: number, y: number): boolean {
  const m = /^kit:([^/]+)\/(.+)$/u.exec(objectId);
  const kit = m ? project.tilesets[m[1]!]?.structureKits?.find((k) => k.id === m[2]) : undefined;
  if (!kit) return false;
  for (let dy = 0; dy < kit.height; dy += 1) for (let dx = 0; dx < kit.width; dx += 1) {
    const cx = x + dx, cy = y + dy;
    if (cx < 1 || cy < 1 || cx >= map.width - 1 || cy >= map.height - 1 || !isPassable(project, map, cx, cy)) return false;
    if (map.events.some((e) => Math.abs(e.x - cx) + Math.abs(e.y - cy) <= 1)) return false;
  }
  try {
    execTool(project, "stamp_object", { objectId, mapId: map.id, x, y });
    return true;
  } catch {
    return false;
  }
}

// ── 짓기 ────────────────────────────────────────────────────────────────

export function createChronoBellFlagshipDemo(): FlagshipDemoBuildResult {
  const project = createBlankProject();
  const initialBlankMapIds = Object.keys(project.maps);

  project.meta.title = "폴른 스타";
  project.meta.author = "OPRN Flagship Studio";
  // 480×270 · 배율 1 = 30×17칸(2026-10-20 사용자 결정). 배율 1 은 생략이 기본값이다.
  project.system.playResolution = { width: 480, height: 270 };
  delete project.system.cameraZoom;
  project.system.dialogueStyle = "pixel-cinematic";

  setupCast(project);
  const troops = setupFoes(project);
  if (!project.switches.some((s) => s.id === SW_IRIS_JOINED)) project.switches.push({ id: SW_IRIS_JOINED, name: "이리스 합류" });

  const built = buildJrpgChapter(project, FALLEN_STAR_ACT1, { chapterId: "fallen_star_act1", prefix: FS_PREFIX, seed: 7, troops });
  if (typeof process !== "undefined" && process.env?.FS_DEBUG) console.error("[fallen-star] chapter:", built.summary, JSON.stringify(built.warnings ?? [], null, 1));
  const data = built.data as { hubMapId: string; maps: Array<{ key: string; mapId: string }> };
  const mapIdOf = (key: string): string => data.maps.find((m) => m.key === key)!.mapId;
  const ids = { hub: data.hubMapId, observatory: mapIdOf("observatory"), forest: mapIdOf("forest"), vault: mapIdOf("vault") };
  for (const id of Object.values(ids)) if (!project.maps[id]) throw new Error(`[fallen-star] 맵이 덜 지어졌다: ${id} ${JSON.stringify(built.warnings ?? [])}`);
  // 도구를 부를 때마다 맵 객체가 바뀐다 — 늘 새로 꺼낸다.
  const M = (id: string): GameMap => project.maps[id]!;

  applySpeakerPrefixes(project);

  // 인물 칩 — 검색어로 고른 그림 대신 정해 둔 배우를 쓴다(같은 인물이 맵마다 다른 그림이면 안 된다).
  ensureFallenValenChip(project);
  setEventChip(M(ids.hub), `ev_${FS_PREFIX}_valen`, FS_VALEN_CHARSET_ID, FS_VALEN_CHARSET_INDEX);
  setEventChip(M(ids.hub), `ev_${FS_PREFIX}_knight`, "tex_easyrpg_charset_actor1", 2);
  // 하넬 — 오프닝 그림의 백발 학자와 맞게 People3 #4(흰 머리·흰 수염·회색 옷)와 그 짝 얼굴 People2 #4.
  // 예전 People1 #6 칩은 대머리·녹색 옷이라 오프닝·초상화와 다른 사람으로 읽혔다(감사 VQA 2차).
  setEventChip(M(ids.observatory), `ev_${FS_PREFIX}_hanel`, "tex_easyrpg_charset_people3", 4);
  setEventChip(M(ids.forest), `ev_${FS_PREFIX}_bram`, "tex_easyrpg_charset_actor2", 2);
  setEventChip(M(ids.hub), `ev_${FS_PREFIX}_elder`, "tex_easyrpg_charset_people1", 7);
  // 얼굴은 칩과 같은 인물만(People1 은 칩·얼굴 번호가 같다). 맞는 얼굴이 없는 칩은 얼굴을 뺀다.
  setEventFace(M(ids.observatory), `ev_${FS_PREFIX}_hanel`, "easyrpg-faceset-people2-04");
  setEventFace(M(ids.hub), `ev_${FS_PREFIX}_elder`, "easyrpg-faceset-people1-07");
  setEventFace(M(ids.hub), `ev_${FS_PREFIX}_gate`, undefined);
  setEventFace(M(ids.forest), `ev_${FS_PREFIX}_bram`, undefined);
  polishLines(M(ids.observatory), M(ids.forest), M(ids.vault));
  // 왕도를 오프닝 그림과 같은 곳으로 — 운하·아치 돌다리·둥근 돌 천문대 탑·성벽 동문·성문 광장(fallenTown.ts).
  // 문지기는 성문 곁에 세운다. 문·출구 좌표는 여기서 정해지고, 뒤 단계(도착 칸·포고 행진)가 이 자리를 쓴다.
  // 성벽 고리의 남 성벽(위 통로 + 앞면 두 줄)이 들어갈 자리 — 마을 남쪽 거리 밑으로 세 줄 늘린다.
  execTool(project, "resize_map", { mapId: ids.hub, width: M(ids.hub).width, height: M(ids.hub).height + 3 });
  reworkFallenTown(project, ids.hub, { observatory: ids.observatory, forest: ids.forest });
  // 장 구성기의 「기억의 세이브 결정」은 시스템 말투다 — 세계 안의 이름과 문장으로(감사 3차).
  for (const event of M(ids.vault).events) if (event.name === "기억의 세이브 결정") {
    event.name = "푸른 별빛 결정";
    for (const page of event.pages ?? []) page.name = "푸른 별빛 결정";
  }
  replaceLineAnywhere(M(ids.vault), "푸른 기억의 결정이 은은하게 공명하며 파티 전원의 체력과 마력을 완전히 회복시켰다!", [narrate("푸른 결정에 손을 대자, 지친 몸에 힘이 차올랐다.")]);
  const bossEvent = M(ids.vault).events.find((e) => (e.pages ?? []).some((p) => JSON.stringify(p.commands).includes("battleProcessing")) && e.id.includes("kill"));
  if (bossEvent) {
    setEventChip(M(ids.vault), bossEvent.id, "tex_easyrpg_charset_actor1", 4);
    // 결전 자리는 별 렌즈 바로 앞(rebuildFallenRooms 가 세운다) — 별빛·연기는 렌즈 칸 기준이다.
    stageBossVictory(M(ids.vault), FS_VAULT_LENS);
  }

  // 떨어진 별을 열면 이리스가 깨어나 동료가 된다. 별빛 열쇠는 알 안에 있다 — 뚜껑이 열린 뒤 이리스가 건넨다.
  // 장 구성기 기본값인 「풀이 칸 바닥을 풀숲으로 바꾸기」(changeTile)는 그을린 흙 위에 풀 한 칸을 남겨 뺀다.
  const podOpened = findTextList(M(ids.forest), "치익— 뚜껑이 열리고");
  if (!podOpened) throw new Error("[fallen-star] 떨어진 별 조사 대사를 찾지 못했다");
  const podList = podOpened.list;
  const keyAt = podList.findIndex((c) => c.kind === "changeItem" && (c as { itemId?: string }).itemId === FS_STAR_KEY_ITEM);
  const keyGain = keyAt >= 0 ? podList.splice(keyAt, 2)[0]! : ({ kind: "changeItem", itemId: FS_STAR_KEY_ITEM, op: "+=", amount: 1 } as Command);
  for (let i = podList.length - 1; i >= 0; i -= 1) if (podList[i]!.kind === "changeTile") podList.splice(i, 1);
  const opened = podList.findIndex((c) => c.kind === "text" && String((c as { body?: string }).body).includes("치익— 뚜껑이 열리고"));
  podList.splice(opened + 1, 0,
    say("이리스", "…여기는, 어디죠? 몸이… 아직 무거워요."),
    say("카엘", "괜찮아? 너… 저 별 안에 있었던 거야?"),
    say("이리스", "별이 아니에요. 하늘을 건너는 배예요. 저는 이리스, 기계예요."),
    say("엘레나", "기계? 말도 하고, 숨도 쉬는데…"),
    say("이리스", "숨은 흉내예요. 사람들이 덜 무서워하라고요."),
    say("이리스", "…혹시, 제가 무서우세요?"),
    say("카엘", "아니. 조금 놀랐을 뿐이야."),
    say("이리스", "집에 신호를 보내야 해요. 높은 곳, 큰 렌즈가 있는 곳에서요."),
    say("엘레나", "렌즈라면… 천문대에 있어."),
    say("이리스", "이것도 드릴게요. 배 안에 박혀 있던 거예요."),
    keyGain,
    narrate("「별빛 열쇠」를 얻었다."),
    say("엘레나", "이 별 무늬… 천문대 서고 바닥 돌뚜껑의 홈이랑 똑같아!"),
    say("카엘", "천문대로 돌아가자. 심문관이 여길 찾기 전에."),
    { kind: "changeParty", actorId: IRIS_ID, action: "add" } as Command,
    { kind: "setSwitch", switchId: SW_IRIS_JOINED, value: true } as Command,
    narrate("이리스가 동료가 되었다."),
  );
  // 뚜껑이 열리면 이리스가 관 곁에 선다 — 대사만 오가고 화면에 아무도 없었다(감사 VQA). 합류하면 일행 뒤로 들어가 사라진다.
  if (!project.switches.some((s) => s.id === SW_IRIS_AWAKE)) project.switches.push({ id: SW_IRIS_AWAKE, name: "이리스 깨어남" });
  podList.splice(opened + 1, 0, { kind: "setSwitch", switchId: SW_IRIS_AWAKE, value: true } as Command);
  const podSpot = M(ids.forest).events.find((e) => e.id === `ev_${FS_PREFIX}_main_inspect1`)!;
  // 단계별 재시도(가혹 검수 r1: 「어느 단계에서 틀려도 1단계로 되돌아간다」) — 틀리면 그 단계 선택지로만 돌아간다.
  // 선택지를 닫으면 관에서 물러선다(다시 조사하면 처음부터). gotoLabel 은 바깥 프레임까지 거슬러 찾는다.
  {
    const podPage = podSpot.pages![0]!;
    const WRONG = "이 단계만 다시 해 보자.";
    const isWrong = (branch: Command[]): boolean => branch.some((c) => c.kind === "text" && (c as { body?: string }).body === WRONG);
    const stageLabels: string[] = [];
    const wire = (list: Command[]): void => {
      const at = list.findIndex((c) => c.kind === "choices");
      if (at < 0) return;
      const ask = list[at] as ChoicesCommand & { cancelBehavior?: string; cancelBranch?: Command[] };
      const label = `fs_pod_stage${stageLabels.length + 1}`;
      stageLabels.push(label);
      list.splice(at, 0, { kind: "label", name: label } as Command);
      ask.cancelBehavior = "branch";
      ask.cancelBranch = [narrate("관에서 한 걸음 물러섰다."), { kind: "gotoLabel", name: "fs_pod_leave" } as Command];
      for (const option of ask.options) {
        if (isWrong(option.branch)) option.branch.push({ kind: "gotoLabel", name: label } as Command);
        else wire(option.branch);
      }
    };
    wire(podPage.commands);
    if (stageLabels.length !== 3) throw new Error(`[fallen-star] 관 퍼즐 단계가 ${stageLabels.length}개다(3개여야 한다)`);
    podPage.commands.push({ kind: "label", name: "fs_pod_leave" } as Command);
    // 해제 연출의 섬광에 value 가 빠져 실행기가 「missing field: value」를 냈다.
    const fixFlash = (list: Command[]): void => {
      for (const c of list as (Command & { kind: string; commandId?: string; fields?: Record<string, unknown>; options?: { branch: Command[] }[] })[]) {
        if (c.kind === "m2Command" && c.commandId === "m2-047-flash-screen" && c.fields && c.fields.value === undefined) c.fields.value = "flash";
        for (const option of c.options ?? []) fixFlash(option.branch);
      }
    };
    fixFlash(podPage.commands);
  }
  // 대사·선택지 상자는 늘 아래에 둔다 — 「주인공 가리지 않기」가 주인공이 아래 절반에 서면 상자를 위로 올려
  // 천문대 위층·지도 위쪽을 덮었다(가혹 검수 r7 「선택지 상자가 화면 위를 덮음」). 첫 자동 이벤트(포고) 맨 앞에서 한 번 정한다.
  {
    const opening = M(ids.hub).events.find((e) => e.id === `ev_${FS_PREFIX}_event`);
    const page = opening?.pages?.[0];
    if (!page) throw new Error("[fallen-star] 포고 이벤트를 찾지 못했다");
    page.commands.unshift({ kind: "displayTextSettings", format: "normal", position: "bottom", preventObscuringPlayer: false, allowEventMovementDuringWait: false } as Command);
  }
  // 위 한 번만으로는 포고를 거치지 않는 진입(QA 체크포인트·옛 저장)이 기본값(가리지 않기 켜짐)을 그대로 들고 와,
  // 앞 대사 없이 뜨는 선택지(숲 문양·손바닥·떨리는 목소리)가 주인공 위치에 따라 화면 위로 올라갔다(r12 「선택지 창 위치」).
  // 선택지마다 바로 앞에서 상자 설정을 다시 박아 어느 길로 들어와도 같은 곳(아래, 대사 상자 밑)에 붙인다.
  {
    const dock = (): Command => ({ kind: "displayTextSettings", format: "normal", position: "bottom", preventObscuringPlayer: false, allowEventMovementDuringWait: false } as Command);
    const dockChoices = (list: Command[]): void => {
      for (let i = 0; i < list.length; i += 1) {
        const c = list[i] as Command & { kind: string; options?: { branch: Command[] }[]; cancelBranch?: Command[] };
        for (const option of c.options ?? []) dockChoices(option.branch);
        if (c.cancelBranch) dockChoices(c.cancelBranch);
        if (c.kind === "choices" && (list[i - 1] as { kind?: string } | undefined)?.kind !== "displayTextSettings") {
          list.splice(i, 0, dock());
          i += 1;
        }
      }
    };
    for (const mapId of Object.values(ids)) {
      for (const event of M(mapId).events) for (const pg of event.pages ?? []) dockChoices(pg.commands);
    }
  }
  // 처음엔 소지품이 비어 첫 전투에서 「아이템」이 쓸모없었다(가혹 검수 r1) — 포고 뒤 엘레나가 회복약 셋을 건넨다.
  {
    const herald = findTextList(M(ids.hub), "선생님이 천문대에서 기다리셔");
    if (!herald) throw new Error("[fallen-star] 포고 끝 대사를 찾지 못했다");
    herald.list.splice(herald.index + 1, 0,
      say("엘레나", "아, 이것도 챙겨. 숲에 짐승이 많대."),
      { kind: "changeItem", itemId: "item_potion", op: "+=", amount: 3 } as Command,
      narrate("「회복약」 3개를 받았다."),
    );
  }
  // 관 옆 두 칸 — 한 칸 옆이면 관 앞에 선 카엘과 대각선으로 붙어 24×32 몸이 겹쳐 보였다(가혹 검수 r9 장면 배치).
  const irisAt = [{ x: podSpot.x + 2, y: podSpot.y }, { x: podSpot.x - 2, y: podSpot.y }, { x: podSpot.x + 1, y: podSpot.y }, { x: podSpot.x - 1, y: podSpot.y }]
    .find((p) => isPassable(project, M(ids.forest), p.x, p.y) && !M(ids.forest).events.some((e) => e.x === p.x && e.y === p.y));
  if (irisAt) {
    const chip = (direction: "left" | "right" | "down") => ({
      sprite: { type: "bundled", id: "tex_easyrpg_charset_actor4" }, direction,
      pattern: charsetFrameIndex({ characterIndex: 7, direction, pattern: 1 }),
    });
    const facing = irisAt.x > podSpot.x ? "left" : "right";
    M(ids.forest).events.push({
      id: `ev_${FS_PREFIX}_iris_field`, name: "이리스", x: irisAt.x, y: irisAt.y, trigger: { kind: "action" }, commands: [],
      pages: [
        { id: `ev_${FS_PREFIX}_iris_field_up`, name: "깨어남", conditions: [{ kind: "switch", switchId: SW_IRIS_AWAKE, value: true }],
          graphic: chip(facing), trigger: { kind: "action" }, priority: "same", overlapForbidden: false,
          movement: { type: "fixed", speed: 3, frequency: 3 }, commands: [] },
        { id: `ev_${FS_PREFIX}_iris_field_gone`, name: "합류", conditions: [{ kind: "switch", switchId: SW_IRIS_JOINED, value: true }],
          graphic: { transparent: true }, trigger: { kind: "action" }, priority: "below", overlapForbidden: false,
          movement: { type: "fixed", speed: 3, frequency: 3 }, commands: [] },
      ],
    } as unknown as GameEvent);
  }
  // 이리스가 합류하면 광장의 발렌 일행은 숲으로 떠난다(지하에서 다시 만난다).
  vanishWhen(M(ids.hub), `ev_${FS_PREFIX}_valen`, SW_IRIS_JOINED);
  vanishWhen(M(ids.hub), `ev_${FS_PREFIX}_knight`, SW_IRIS_JOINED);

  // 보스 — 발렌 혼자가 아니라 깨운 수호상과 함께. 지면 엔딩 대신 숨을 고르고 다시 도전한다.
  if (bossEvent) {
    for (const list of eventCommandLists(bossEvent)) {
      for (const cmd of list) {
        const rec = cmd as unknown as Record<string, unknown>;
        if (rec.kind === "battleProcessing") { rec.troopId = troops.boss; rec.canLose = true; rec.canEscape = false; }
        if (rec.kind === "fork" && (rec.condition as { kind?: string } | undefined)?.kind === "battleResult") {
          rec.else = [
            { kind: "recoverAll" },
            say("엘레나", "일단 물러서! 숨 고르고 다시 붙자."),
          ];
        }
      }
    }
  }
  // 장 구성기가 만든 단독 보스(troop_fs_boss·enemy_fs_boss)는 이제 아무도 부르지 않는다 — 지운다.
  if (!JSON.stringify(project.maps).includes('"troop_fs_boss"')) {
    project.database.troops = project.database.troops.filter((t) => t.id !== "troop_fs_boss");
    if (!project.database.troops.some((t) => t.enemyIds?.includes("enemy_fs_boss"))) project.database.enemies = project.database.enemies.filter((e) => e.id !== "enemy_fs_boss");
  }

  // 엔딩 — 하넬에게 보고하면 제1막이 끝난다.
  execTool(project, "define_ending", {
    id: ENDING_ID,
    name: "제1막 · 떨어진 별",
    conditions: [],
    epilogue: [
      { kind: "say", speaker: "이리스", text: "북쪽 하늘에서 아직 대답이 들려요. 아주 작게." },
      { kind: "say", speaker: "카엘", text: "그럼 거기까지 가 보자. 같이." },
    ],
    // 가혹 검수 r5: 끝 화면이 두 줄뿐이라 여운이 약했다 — 짧은 크레딧 두루마리와 「다음 막」 예고를 단다.
    presentation: {
      kicker: "제1막 끝",
      credits: [
        // 첫 카드가 이미 제목·막 이름을 말한다 — 크레딧은 인물부터(가혹 검수 r10 「54·55 거의 같은 반복」).
        "카엘 — 견습 별지기", "엘레나 — 천문대의 마도학자", "이리스 — 별에서 온 기계 소녀", "",
        "천문대장 하넬", "숲지기 브람", "심문관 발렌", "",
        "그날 밤 동쪽 숲에 떨어진 것은 별이 아니었다.", "이리스의 배가 남은 곳, 북쪽 하늘탑으로.", "",
        "OPRN Studio 공식 데모", "",
        "제2막에서 계속됩니다.",
      ].join("\n"),
    },
  });
  const reported = findTextList(M(ids.observatory), "이리스를 집에 데려다주거라");
  if (!reported) throw new Error("[fallen-star] 보고 대사를 찾지 못했다");
  reported.list.push({ kind: "triggerEnding", endingId: ENDING_ID } as Command);

  // 숲길 — 보이는 적 셋(부딪히면 전투). 입구에서 공터까지 고르게 둔다.
  const forestEntry = M(ids.forest).events.find((e) => JSON.stringify(e).includes(`"mapId":"${M(ids.hub).id}"`));
  const origin = forestEntry ? { x: forestEntry.x, y: forestEntry.y } : { x: Math.floor(M(ids.forest).width / 2), y: M(ids.forest).height - 2 };
  const taken = new Set<string>();
  [0.25, 0.45, 0.62].forEach((rank, i) => {
    const at = pickSpot(project, M(ids.forest), origin, taken, rank, 3);
    if (at && at.y < 13) return; // 추락지 공터에는 짐승을 두지 않는다.
    if (!at) return;
    taken.add(`${at.x},${at.y}`);
    placeRoamer(project, { mapId: M(ids.forest).id, x: at.x, y: at.y, troopId: troops.field[i % troops.field.length], behavior: "patrol", id: `ev_${M(ids.forest).id}_foe${i + 1}` }, i % 2 === 0);
  });

  // 천문대 지하 첫 방 — 화로 순서 퍼즐(품질 프리셋은 20×15 빈 방 전체를 짓는다). 천문대 뚜껑문 → 이 방 → 풀면 북쪽 창살 → 옛 별지기의 방.
  const PUZZLE_ROOM = "fs_vault_gate";
  execTool(project, "create_map", { id: PUZZLE_ROOM, name: "천문대 지하 · 네 화로의 방", width: 20, height: 15, tilesetId: "atlas_biome_interior" });
  execTool(project, "author_map_puzzle", { mapId: PUZZLE_ROOM, presetId: "brazier_ignition_order", puzzleId: "fs_braziers", title: "네 화로의 방" });
  replaceLineAnywhere(M(PUZZLE_ROOM), "퍼즐 해독 보상! 「태양의 불씨 보관함」과(와) 250G를 획득했다!", [narrate("철컥— 북쪽 쇠창살이 끌려 올라갔다."), narrate("화로 사이 바닥 홈에서 「태양의 불씨 보관함」과 250G가 나왔다.")]);
  // 석판의 「동쪽 화로」는 동쪽에 화로가 둘(북동·남동)이라 어느 쪽인지 헷갈렸다 — 둘 중 하나임을 밝혀 추론 문제로 남긴다.
  // 가혹 검수 r3: 석판 글이 「석판: 「…」」 한 상자에 몰려 이름표가 없고 길었다 — 이름표 「석판」으로 세 줄에 나눈다.
  // 틀렸을 때도 한 줄로 끝나 무엇을 다시 볼지 몰랐다 — 석판을 떠올리게 하는 둘째 줄을 붙인다.
  for (const event of M(PUZZLE_ROOM).events) for (const list of eventCommandLists(event)) {
    for (let i = list.length - 1; i >= 0; i -= 1) {
      const rec = list[i] as { kind: string; body?: string };
      if (rec.kind !== "text" || !rec.body) continue;
      if (rec.body.startsWith("석판: 「")) {
        list.splice(i, 1,
          say("석판", "네 화로에 차례로 불을 옮겨라. 틀리면 불은 모두 꺼진다."),
          say("석판", "첫 불은 동쪽의 두 화로 가운데 하나에 붙인다."),
          say("석판", "북서는 남서보다, 그리고 북동보다 먼저 탄다. 남서는 셋째가 아니다."),
        );
      } else if (rec.body.startsWith("불길이 역류해 모든 화로가 꺼졌다")) {
        list.splice(i + 1, 0, say("엘레나", "석판을 다시 떠올려 봐. 첫 불은 동쪽이었고, 북서는 남서와 북동보다 먼저야."));
      }
    }
  }
  // 천문대 세 방(천문대 · 네 화로의 방 · 옛 별지기의 방)을 손 도트 실내로 다시 짓고 이벤트 자리·이동을 맞춘다(fallenStarRooms.ts).
  rebuildFallenRooms(project, execTool, { hub: ids.hub, observatory: ids.observatory, gate: PUZZLE_ROOM, vault: ids.vault });

  // 동문 문지기는 성문 곁(reworkFallenTown 이 세운 자리)에 그대로 선다.

  // 추락지 — 금속 알 둘레를 그을린 흙(농장 흙길 오토타일)으로 타원형으로 칠하고, 가장자리에 불씨 자국·쓰러진 나무·그루터기를 둔다.
  // 민무늬 풀 칸만 칠한다(알 그림·길은 건드리지 않는다). 알 앞 조사 칸과 숲길은 비운다.
  const pod = M(ids.forest).events.find((e) => e.id === `ev_${FS_PREFIX}_main_inspect1`);
  if (pod) {
    const fm = M(ids.forest);
    let hadCoffin = false;
    // 빈터 바닥 — 옛 풀(737)·「풀밭」 이름표에 더해, main 의 숲 바닥 재색칠(#3223/#3229)이 깐 이름표 없는 접목 풀 칸(30336 등)도 바닥으로 친다.
    // 737 만 보면 구덩이가 빈 집합이 되어 관만 덩그러니 남았다.
    const metaG = (project.tilesets[fm.tilesetId] as unknown as { tileMeta?: ({ label?: string } | null)[]; passability?: ({ up?: boolean } | null)[] });
    const grassish = (i: number): boolean => {
      const t = fm.lowerTiles[i] ?? -1;
      if (t < 0) return false;
      const label = metaG.tileMeta?.[t]?.label ?? "";
      if (t === 737 || /풀밭/.test(label)) return true;
      return !label && metaG.passability?.[t]?.up !== false && (fm.upperTiles[i] ?? -1) < 0 && (fm.upperOverlayTiles?.[i] ?? -1) < 0;
    };
    // 구덩이 고르기는 바닥 칸만 본다 — main 숲 마감이 빈터에 흩뿌린 잔돌·풀 포기·꽃(위 겹)이 구덩이를 T자로 쪼갰다. 나무는 따로 뺀다.
    const grassFloor = (i: number): boolean => {
      const t = fm.lowerTiles[i] ?? -1;
      if (t < 0) return false;
      const label = metaG.tileMeta?.[t]?.label ?? "";
      return t === 737 || /풀밭/.test(label) || (!label && metaG.passability?.[t]?.up !== false);
    };
    // 진짜 나무 = 「나무·덤불/전나무」 덧그림이 여섯 칸 이상 이어진 덩이. main 숲 마감은 빈터에 한두 칸짜리 덤불 포기를 흩뿌려
    // 덤불 이름표만 보면 빈터 전체가 「나무 곁」이 되어 구덩이가 좁은 띠로 줄었다.
    const bigTree = new Set<number>();
    {
      const isTree = (i: number): boolean => [fm.upperTiles, fm.upperOverlayTiles].some((layer) => {
        const t = layer?.[i] ?? -1;
        return t >= 0 && /^버들항 · (나무·덤불|전나무)/.test(metaG.tileMeta?.[t]?.label ?? "");
      });
      const seen = new Set<number>();
      for (let i = 0; i < fm.lowerTiles.length; i += 1) {
        if (seen.has(i) || !isTree(i)) continue;
        const comp: number[] = [i]; seen.add(i);
        for (let k = 0; k < comp.length; k += 1) {
          const c = comp[k]!, cx0 = c % fm.width;
          for (const n of [c - fm.width, c + fm.width, cx0 > 0 ? c - 1 : -1, cx0 < fm.width - 1 ? c + 1 : -1]) {
            if (n < 0 || n >= fm.lowerTiles.length || seen.has(n) || !isTree(n)) continue;
            seen.add(n); comp.push(n);
          }
        }
        if (comp.length >= 6) for (const c of comp) bigTree.add(c);
      }
    }
    const treeAt = (i: number): boolean => bigTree.has(i);
    // 빈터에서 가장 흔한 바닥 칸 — 모랫길을 풀로 되돌릴 때 옛 풀(737)이 아니라 지금 숲 바닥 색으로 되돌린다.
    const groundTile = (() => {
      const count = new Map<number, number>();
      for (let y = Math.max(0, pod.y - 6); y <= Math.min(fm.height - 1, pod.y + 8); y += 1) for (let x = Math.max(0, pod.x - 8); x <= Math.min(fm.width - 1, pod.x + 8); x += 1) {
        const i = y * fm.width + x;
        if (grassish(i)) count.set(fm.lowerTiles[i]!, (count.get(fm.lowerTiles[i]!) ?? 0) + 1);
      }
      return [...count.entries()].sort((p, q) => q[1] - p[1])[0]?.[0] ?? 737;
    })();
    // 관을 빈터 가운데로 두 칸 내린다 — 관이 빈터 북쪽 나무 줄 바로 밑에 붙어 구덩이 북쪽 테가 잘리고, 관이 구덩이 가운데가 아니라
    // 북쪽 테 위에 얹힌 것으로 보였다(VQA r10 major). 조사 칸·이리스 자리도 같이 내린다.
    {
      const metaS = (project.tilesets[fm.tilesetId] as unknown as { tileMeta?: ({ label?: string } | null)[] }).tileMeta ?? [];
      const ground = (x: number, y: number): boolean => {
        const t = fm.lowerTiles[y * fm.width + x]!;
        return grassish(y * fm.width + x) || (metaS[t]?.label ?? "").startsWith("버들항 · 모랫길");
      };
      // 옛 돌 관(하수도 관 2×2)은 구덩이 계산 전에 걷는다 — 남겨 두면 옛 관 자리가 「덧그림 있는 칸」으로 빠져 구덩이 북쪽에 풀 구멍이 났다.
      fm.upperTiles.forEach((t, i) => { if (t >= 26599 && t <= 26602) { fm.upperTiles[i] = -1; hadCoffin = true; } });
      // 맵 위 끝에 붙은 구덩이는 1배 화면 위 테두리에 뒷벽이 잘려 「빈터에 판 밭」으로 읽혔다(VQA r21 major) — 빈터가 허락하는
      // 만큼(최대 네 칸) 내려 구덩이 뒤로 숲이 보이게 한다. 잔돌·풀 포기 덧그림은 막지 않는다(큰 나무만 막는다).
      const open = (x: number, y: number): boolean => ground(x, y) || ((grassFloor(y * fm.width + x) || (metaS[fm.lowerTiles[y * fm.width + x]!]?.label ?? "").startsWith("버들항 · 모랫길")) && !treeAt(y * fm.width + x));
      const SHIFT = [4, 3, 2].find((d) => {
        if (pod.y + d >= fm.height - 4) return false;
        for (let y = pod.y; y <= pod.y + d; y += 1) for (let x = pod.x - 1; x <= pod.x + 1; x += 1) if (!open(x, y)) return false;
        return true;
      }) ?? 0;
      const ok = SHIFT > 0;
      if (ok) {
        pod.y += SHIFT;
        const iris = fm.events.find((e) => e.id === `ev_${FS_PREFIX}_iris_field`);
        if (iris && open(iris.x, iris.y + SHIFT)) iris.y += SHIFT;
      }
    }
    // 관(별의 배) 가운데 — 관은 pod 바로 위 두 칸 너비. 구덩이는 관을 품고 사방으로 그을린 자국이 뻗는 불규칙한 모양이다:
    // 고른 타원(작은 칸 수)은 네모 흙 마당 + 검은 테두리로 읽혔다(VQA r6 major 「방·무덤 같다」). 각도마다 반지름을 흔들고
    // 일곱 갈래로 그을음 줄기를 뻗는다.
    // 구덩이가 빈터(풀 칸) 끝까지 닿으면 빈터 네모 모양을 그대로 따라 네모 흙 마당으로 읽혔다(VQA r7 major) — 빈터보다 작은
    // 타원으로 줄이고 가운데를 반 칸 내려 위쪽 나무 줄에 잘리지 않게 한다. 그을음은 구덩이 밖 풀 위의 불씨·숯 줄기로 뻗는다.
    const cx = pod.x + 0.5, cy = pod.y - 1, rx = 5.2, ry = 3.4; // 관(조사 칸 위 두 줄) 한가운데
    const pit = new Set<number>();
    const metaPit = (project.tilesets[fm.tilesetId] as unknown as { tileMeta?: ({ label?: string } | null)[] }).tileMeta ?? [];
    const isSand = (i: number): boolean => (metaPit[fm.lowerTiles[i]!]?.label ?? "").startsWith("버들항 · 모랫길");
    for (let y = Math.max(1, Math.floor(cy - ry * 1.6)); y <= Math.min(fm.height - 2, Math.ceil(cy + ry * 1.6)); y += 1) {
      for (let x = Math.max(1, Math.floor(cx - rx * 1.6)); x <= Math.min(fm.width - 2, Math.ceil(cx + rx * 1.6)); x += 1) {
        const ex = (x + 0.5 - cx) / rx, ey = (y + 0.5 - cy) / ry, theta = Math.atan2(ey, ex) + Math.PI;
        // 갈래는 구덩이를 늘리지 않는다 — 남쪽 갈래가 숲길과 이어져 「구덩이에서 길로 판 도랑」으로 읽혔다(VQA r19 major).
        const ray = 1;
        const wob = ((((x * 73856093) ^ (y * 19349663)) >>> 0) % 5) * 0.05 - 0.1;
        const reach = (1 + 0.2 * Math.sin(3 * theta + 0.7) + 0.12 * Math.sin(5 * theta + 2.1) + wob) * ray;
        const inside = Math.hypot(ex, ey) <= reach
          && (grassFloor(y * fm.width + x) || isSand(y * fm.width + x) || (Math.abs(x - pod.x) <= 1 && y >= pod.y - 2 && y <= pod.y - 1))
          // 관 그림 밑 칸도 칠한다 — 남겨 두면 관 둘레에 풀 테두리가 섰다. 나무가 선 칸만 뺀다(잔돌·풀 포기는 아래에서 걷는다).
          && !treeAt(y * fm.width + x);
        // 나무(덧그림) 바로 곁 칸은 비운다 — 구덩이 테가 빈터 가장자리(네모)를 그대로 따라가지 않고 풀 한 줄을 두고 둥글게 닫힌다.
        const treeSide = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]].some(([dx, dy]) => {
          const nx = x + dx!, ny = y + dy!;
          if (Math.abs(nx - pod.x) <= 1 && ny >= pod.y - 2 && ny <= pod.y - 1) return false;
          // 숲 나무는 위 겹(upperOverlay)에도 그려진다 — 큰 덩이(진짜 나무)만 본다.
          return treeAt(ny * fm.width + nx);
        });
        if (inside && !treeSide) pit.add(y * fm.width + x);
      }
    }
    // 가로·세로 이웃이 둘 미만인 삐죽 칸은 뺀다 — 둑 덧그림에 그런 모양이 없어 네모 흙 한 칸이 튀어나왔다.
    for (let changed = true; changed;) {
      changed = false;
      for (const c of [...pit]) {
        const [u, d, l, r] = [c - fm.width, c + fm.width, c - 1, c + 1].map((k) => pit.has(k));
        // 한 칸 폭 기둥·띠도 뺀다 — 둑 덧그림이 양쪽에서 붙어 검은 네모 한 칸으로 그려졌다(VQA r7).
        if ([u, d, l, r].filter(Boolean).length < 2 || (!l && !r) || (!u && !d)) { pit.delete(c); changed = true; }
      }
    }
    // 바깥 모서리 한 번 깎기 — 계단처럼 꺾인 직각 모서리가 네모 구덩이로 읽혔다(VQA r17). 한 번만 깎고 다시 삐죽 칸을 고른다.
    {
      const corners = [...pit].filter((c) => {
        const [u, d, l, r] = [c - fm.width, c + fm.width, c - 1, c + 1].map((k) => pit.has(k));
        return (!u && !l) || (!u && !r) || (!d && !l) || (!d && !r);
      });
      for (const c of corners) if (Math.abs((c % fm.width) - pod.x) > 2 || Math.abs(Math.floor(c / fm.width) - (pod.y - 1)) > 1) pit.delete(c);
      for (let changed = true; changed;) {
        changed = false;
        for (const c of [...pit]) {
          const [u, d, l, r] = [c - fm.width, c + fm.width, c - 1, c + 1].map((k) => pit.has(k));
          if ([u, d, l, r].filter(Boolean).length < 2 || (!l && !r) || (!u && !d)) { pit.delete(c); changed = true; }
        }
      }
    }
    // 북쪽 맨 윗줄을 가운데 다섯 칸으로 좁힌다 — 윗줄이 구덩이 폭 그대로면 흙벽이 곧은 한 줄(네모 밭의 뒷담)로 읽혔다(VQA r21 major).
    // 좁히면 양 끝은 한 줄 아래에서 벽이 되어 뒷벽이 둥글게 휜 사발로 그려진다.
    {
      const topY = pit.size ? Math.min(...[...pit].map((c) => Math.floor(c / fm.width))) : 0;
      const row = [...pit].filter((c) => Math.floor(c / fm.width) === topY);
      if (row.length > 5) for (const c of row) if (Math.abs((c % fm.width) + 0.5 - cx) > 2.6) pit.delete(c);
      for (let changed = true; changed;) {
        changed = false;
        for (const c of [...pit]) {
          const [u, d, l, r] = [c - fm.width, c + fm.width, c - 1, c + 1].map((k) => pit.has(k));
          if ([u, d, l, r].filter(Boolean).length < 2 || (!l && !r) || (!u && !d)) { pit.delete(c); changed = true; }
        }
      }
    }
    // 구덩이 칸의 잔돌·풀 포기·꽃 덧그림은 걷는다(관은 아직 안 놓였다) — 갓 파인 흙 위에 풀숲 장식이 남으면 안 된다.
    for (const c of pit) for (const layer of [fm.lowerOverlayTiles, fm.upperTiles, fm.upperOverlayTiles]) if (layer && (layer[c] ?? -1) >= 0 && !treeAt(c)) layer[c] = -1;
    // 빈터에 먼저 깔려 있던 네모 모랫길 마당(숲길 끝)이 구덩이와 합쳐져 네모 흙 마당으로 보였다(VQA r7 major) — 구덩이 아래쪽
    // 가운데 줄보다 위에 있는, 구덩이 밖 모랫길 칸(덧그림 없는 칸)은 풀로 되돌린다. 남쪽에서 올라오는 숲길은 그대로 둔다.
    const reverted: number[] = [];
    for (let y = 0; y <= Math.floor(cy + ry * 0.6); y += 1) for (let x = Math.max(0, Math.floor(cx - rx * 2)); x <= Math.min(fm.width - 1, Math.ceil(cx + rx * 2)); x += 1) {
      const i = y * fm.width + x;
      if (pit.has(i) || !isSand(i) || (fm.upperTiles[i] ?? -1) >= 0) continue;
      fm.lowerTiles[i] = groundTile; reverted.push(i);
      if (fm.lowerOverlayTiles) fm.lowerOverlayTiles[i] = -1; // 옛 구덩이 둑 덧그림도 걷는다(풀 위에 검은 테 조각이 남았다)
    }
    // 흙은 오토타일 칠하기 도구 대신 「몸통」 칸으로 바로 깐다 — 도구가 오목한 모서리 칸을 스스로 채워 둥근 구덩이가 다시
    // 네모 마당으로 부풀었다(VQA r7). 가장자리 모양은 아래 둑 덧그림(rimPit)이 그린다.
    const body = metaPit.findIndex((m) => m?.label === "버들항 · 모랫길 오토타일 · 사방 이어짐(몸통)");
    for (const c of pit) fm.lowerTiles[c] = body >= 0 ? body : 23175;
    // 3/4 깊이: 북쪽 테 바로 아래 줄은 흙 절벽면(윗변 그늘) — 구덩이가 파여 들어간 안쪽 벽으로 읽힌다(VQA r9 major
    // 「평평한 네모 흙 마당」). 둑은 진흙 둑(바깥 그을린 풀 테 + 안쪽 짙은 선)으로 — 흑요석 둑은 네 변 같은 검은 테였다.
    // 바닥은 모랫길(밝은 모래)이 아니라 짙은 갈아엎인 흙(바닥 흙 26809~26811) — 밝은 모래 바닥은 숲길이 넓어진 흙 마당으로 읽혔다(VQA r10).
    for (const c of pit) {
      const x = c % fm.width, y = Math.floor(c / fm.width);
      // (밝은 모랫길 고리는 숲길이 구덩이 밖으로 번진 것처럼 읽혀 걷었다 — 바닥은 한 가지 그을린 흙.)
      if (!pit.has(c - fm.width)) fm.lowerTiles[c] = 11646 + ((x + y) % 5);
      else fm.lowerTiles[c] = 26809 + ((((x * 73856093) ^ (y * 19349663)) >>> 0) % 3);
    }
    // 구덩이 안: 불씨 자국·숯 더미(관 곁). 구덩이 밖: 쓰러진 나무·그루터기·꺾인 덤불을 둘레 바깥으로 빙 둘러 — 오프닝 crash 컷처럼
    // 충격에 넘어간 나무가 구덩이를 에워싼다. 예전 고정 좌표는 구덩이를 키우자 덤불이 구덩이 안에 섰다(VQA r6).
    const inside: Array<[string, number, number]> = [
      ["bd-pick-volcano-cave-ember-a", -3, -1], ["bd-pick-volcano-cave-ember-a", 3, 0], ["bd-pick-volcano-cave-ember-a", -4, 1],
      ["bd-pick-volcano-cave-ember-a", 2, -3], ["bd-pick-volcano-cave-coal-pile", -2, 1], ["bd-pick-volcano-cave-coal-pile", 3, -2],
      // 관이 부딪히며 쪼갠 나무 — 쪼개진 판자 더미.
      ["bd-pick-shipwreck-reef-plank-pile", 2, 1], ["bd-pick-shipwreck-reef-plank-pile", -4, -1],
    ];
    const around: Array<[string, number]> = [
      // 둘레 통나무 셋은 갈래 끝 통나무와 합쳐 여섯이 같은 가로줄로 늘어서 의자처럼 읽혔다(VQA r19) — 둘레엔 그루터기·덤불만.
      // 고른 각도로 그루터기·덤불을 두르면 격자처럼 늘어선 벌목지로 읽혔다(VQA r21) — 덤불 셋만 남기고, 꺾인 나무는 아래에서 둑에 붙여 둔다.
      ["bd-pick-deep-forest-path-heath-a", 1.6], ["bd-pick-deep-forest-path-fern-c", 5.4], ["bd-pick-deep-forest-path-heath-c", 2.6],
      // (통나무를 고르게 더 둘렀더니 목재 야적장처럼 읽혔다 — VQA r13. 쓰러진 나무는 위 셋과 갈래 끝 그루터기로 충분하다.)
    ];
    // 흙길 오토타일이 오목한 모서리 칸을 스스로 채운다 — 실제로 바뀐 칸을 다시 모아 둑을 얹는다.
    const live = M(ids.forest);
    for (let c = 0; c < live.lowerTiles.length; c += 1) if (live.lowerTiles[c] !== fm.lowerTiles[c] && fm.lowerTiles[c] === 737) pit.add(c);
    // 남쪽에서 이어지는 숲길 칸도 「안쪽」으로 쳐서 구덩이와 숲길 사이에 둑이 가로막지 않게 한다(숲길 자기 둑이 있는 칸은 rimPit 이 건너뛴다).
    const rimCells = new Set(pit);
    for (const c of pit) for (const k of [c - 1, c + 1, c - live.width, c + live.width]) {
      if (!pit.has(k) && (metaPit[live.lowerTiles[k]!]?.label ?? "").startsWith("버들항 · 모랫길")) rimCells.add(k);
    }
    // 구덩이에 닿는 숲길 칸은 몸통 흙으로 — 숲길 오토타일 가장자리 칸이 제 윗변에 풀 띠를 그려 구덩이 바닥을 가로질렀다(VQA r8).
    for (const k of rimCells) if (!pit.has(k)) live.lowerTiles[k] = body >= 0 ? body : 23175;
    // 앞선 마감이 남긴 둑 덧그림(이름표 없는 덧붙임 칸)을 구덩이 안·윗단에서 걷는다 — 안쪽에 남으면 흙 위에 검은 테 조각이,
    // 되돌린 풀 위에 남으면 풀밭 한가운데 네모 테가 보였다. 구덩이에 닿는 숲길 칸의 풀 둑도 걷는다 — 들머리에 풀 띠가 구덩이 바닥을
    // 가로질렀다(VQA r8). 그 밖의 남쪽 숲길 둑은 그대로 둔다.
    if (live.lowerOverlayTiles) {
      const metaL = (project.tilesets[live.tilesetId] as unknown as { tileMeta?: ({ label?: string } | null)[] }).tileMeta ?? [];
      const yTop = Math.floor(cy + ry * 0.6);
      for (let i = 0; i < live.lowerOverlayTiles.length; i += 1) {
        const t = live.lowerOverlayTiles[i]!, x = i % live.width, y = Math.floor(i / live.width);
        if (t < 0 || metaL[t]?.label) continue;
        if (rimCells.has(i) || (y <= yTop && Math.abs(x - cx) <= rx * 2)) live.lowerOverlayTiles[i] = -1;
      }
    }
    rimPit(project, live, rimCells, "bankMud"); // fill_region 이 맵 객체를 바꿔 끼우므로 fm 이 아니라 지금 맵에 얹는다.
    // 평평한 돌 관(버들항 하수도 관 2×2)을 걷고, 오프닝 crash 컷의 누운 은빛 관(손 도트 3×2, 동서로 누움)을 조사 칸 바로 위에 눕힌다.
    {
      const coffin = new Set([26599, 26600, 26601, 26602]);
      let x0 = Infinity, y1 = -Infinity;
      live.upperTiles.forEach((t, i) => { if (coffin.has(t)) { x0 = Math.min(x0, i % live.width); y1 = Math.max(y1, Math.floor(i / live.width)); live.upperTiles[i] = -1; } });
      if (hadCoffin || (Number.isFinite(x0) && Number.isFinite(y1))) placeFallenStarVessel(project, live, pod.x - 1, pod.y - 2);
      // 오프닝 crash 컷처럼 관 위로 연기 몇 가닥이 피어오른다 — 이리스가 깨어나기 전까지(병렬 이벤트, 투명·아래 층).
      const smoke = (x: number, y: number, ms: number) => ({ kind: "m2Command", commandId: "m2-224-particle-effect", fields: { preset: "smoke", target: "tile", x, y, durationMs: ms, wait: false } } as unknown as Command);
      live.events = live.events.filter((e) => e.id !== `ev_${FS_PREFIX}_crash_smoke`);
      live.events.push({
        // 이벤트 칸은 구덩이 안(관 발치) — 둑 밖 풀에 두면 둑 곁 마른 고목이 그 곁을 피해 못 섰다(연기는 좌표로 따로 피운다).
        id: `ev_${FS_PREFIX}_crash_smoke`, name: "추락지 연기", x: pod.x, y: pod.y + 1, trigger: { kind: "parallel" }, commands: [],
        pages: [{
          id: `ev_${FS_PREFIX}_crash_smoke_page`, name: "연기", conditions: [], graphic: { transparent: true },
          movement: { type: "fixed", speed: 3, frequency: 3 }, priority: "below", trigger: { kind: "parallel" },
          // 관 발치의 금에서 희미한 별빛이 새고(반짝임), 둘레 불씨에서 불티가 오른다.
          // 연기 기둥 셋(관 양 끝·가운데)이 쉬지 않고 오른다 — 한두 가닥은 희미해 갓 떨어진 자리로 읽히지 않았다(VQA r10).
          commands: [smoke(pod.x - 1, pod.y - 2, 1600), smoke(pod.x + 1, pod.y - 3, 1600), { kind: "wait", ms: 500 }, smoke(pod.x, pod.y - 2, 1600),
            { kind: "wait", ms: 500 }, smoke(pod.x + 1, pod.y - 2, 1400), smoke(pod.x - 1, pod.y - 3, 1400),
            { ...smoke(pod.x + 1, pod.y - 2, 900), fields: { preset: "sparkle", target: "tile", x: pod.x + 1, y: pod.y - 2, durationMs: 900, wait: false } },
            { kind: "wait", ms: 900 }, smoke(pod.x, pod.y - 3, 1200),
            { ...smoke(pod.x - 2, pod.y, 800), fields: { preset: "fire", target: "tile", x: pod.x - 2, y: pod.y, durationMs: 800, wait: false } },
            { kind: "wait", ms: 1100 }] as unknown as Command[],
        }, {
          id: `ev_${FS_PREFIX}_crash_smoke_done`, name: "연기 걷힘", conditions: [{ kind: "switch", switchId: SW_IRIS_JOINED, value: true }], graphic: { transparent: true },
          movement: { type: "fixed", speed: 3, frequency: 3 }, priority: "below", trigger: { kind: "action" }, commands: [],
        }],
      } as unknown as GameEvent);
    }
    // 갓 생긴 그을린 구덩이 안에 독버섯·고사리·들꽃이 그대로 서 있었다 — 구덩이 칸의 풀숲 덧그림은 걷는다.
    {
      const fz = M(ids.forest);
      for (const c of pit) for (const layer of [fz.lowerOverlayTiles, fz.upperTiles, fz.upperOverlayTiles]) {
        const t = layer?.[c] ?? -1;
        if (t >= 0 && /버섯|고사리|들꽃|헤더|징검돌|풀 포기|풀덩이/.test(metaPit[t]?.label ?? "")) layer![c] = -1;
      }
    }
    for (const [kit, dx, dy] of inside) if (pit.has((pod.y + dy) * live.width + pod.x + dx)) tryStamp(project, M(ids.forest), `kit:beodeul_city/${kit}`, pod.x + dx, pod.y + dy);
    for (const [kit, angle] of around) {
      for (let r = 1; r < 10; r += 0.25) {
        const x = Math.round(cx + Math.cos(angle) * rx * r * 0.75), y = Math.round(cy + Math.sin(angle) * ry * r * 0.75);
        if (pit.has(y * live.width + x) || pit.has(y * live.width + x + 1)) continue;
        // 숲길(흙 칸) 위에는 통나무·덤불을 두지 않는다 — 길을 막았다.
        if (live.lowerTiles[y * live.width + x] !== fm.lowerTiles[y * live.width + x] || !grassish(y * live.width + x) || !grassish(y * live.width + x + 1)) continue;
        if (tryStamp(project, M(ids.forest), `kit:beodeul_city/${kit}`, x, y)) break;
        if (r > 3.2) break;
      }
    }
    // 충격에 꺾인 나무 — 둑 바로 밖에 밑동(그루터기)이 남고 줄기는 바깥으로 쓰러져 그 곁에 눕는다(서쪽·동쪽, 서로 다른 줄).
    // 북쪽 둑 너머엔 불에 그을린 마른 고목 둘. 갈래 끝마다 통나무·그루터기를 고르게 두면 벌목지·긴 의자로 읽혔다(VQA r19~r21).
    {
      const lv = M(ids.forest);
      const rowsOf = (y: number): number[] => [...pit].filter((c) => Math.floor(c / lv.width) === y).map((c) => c % lv.width);
      const snapped = (y: number, side: -1 | 1): boolean => {
        const xs = rowsOf(y);
        if (!xs.length) return false;
        const edge = side < 0 ? Math.min(...xs) : Math.max(...xs);
        const stumpX = edge + side, logX = side < 0 ? edge - 3 : edge + 2;
        if (!grassish(y * lv.width + stumpX) || !grassish(y * lv.width + logX) || !grassish(y * lv.width + logX + 1)) return false;
        if (!tryStamp(project, M(ids.forest), "kit:beodeul_city/bd-pick-deep-forest-path-stump", stumpX, y)) return false;
        tryStamp(project, M(ids.forest), "kit:beodeul_city/bd-pick-deep-forest-path-log-fallen", logX, y);
        return true;
      };
      const mid = Math.round(cy);
      // 서·동 꺾인 나무는 서로 다른 줄에 — 같은 줄이면 마주 놓인 긴 의자 한 쌍으로 읽혔다.
      const westRow = [mid, mid - 1, mid + 1].find((y) => snapped(y, -1));
      for (const y of [mid + 1, mid - 1, mid + 2, mid - 2]) if (y !== westRow && snapped(y, 1)) break;
      const top = pit.size ? Math.min(...[...pit].map((c) => Math.floor(c / lv.width))) : 0;
      // 마른 고목(3×4, 밑동은 맨 아래 줄 왼쪽 두 칸) — 북서·북동 둑 바로 바깥 풀 위(구덩이 위쪽 절반 높이).
      for (const side of [-1, 1] as const) {
        let done = false;
        for (let by = top + (side > 0 ? 2 : 0); by <= mid + 1 && !done; by += 1) { // 동쪽 고목은 두 줄 아래 — 좌우 대칭이면 문 기둥처럼 읽힌다
          const xs = rowsOf(by);
          if (!xs.length) continue;
          for (const gap of [1, 2]) {
            const bx = side < 0 ? Math.min(...xs) - gap - 1 : Math.max(...xs) + gap;
            const base = by * lv.width + bx;
            // 빈터 가장자리 바닥은 나무 그늘(「나무·덤불」 이름표 바닥)이라 풀밭 판정에 안 걸렸다 — 걸을 수 있고 덧그림 없는 칸이면 된다.
            const cur = M(ids.forest);
            const bare = (i: number): boolean => isPassable(project, cur, i % cur.width, Math.floor(i / cur.width)) && (cur.upperTiles[i] ?? -1) < 0 && (cur.upperOverlayTiles?.[i] ?? -1) < 0;
            if (by - 3 < 1 || pit.has(base) || pit.has(base + 1) || !bare(base) || !bare(base + 1)) continue;
            // 키트 그림 칸(왼쪽 두 열 · 아래 세 줄)만 직접 얹는다 — 빈 윗줄·오른쪽 열까지 통행 검사하는 찍기 도구는 빈터 가장자리
            // 나무 그늘 칸에 막혀 한 번도 서지 못했다. 칸 번호는 번들 키트 그대로(새 그림 없음).
            const kit = (project.tilesets[lv.tilesetId] as unknown as { structureKits?: { id: string; rows: { upperTiles?: number[] }[] }[] }).structureKits?.find((k) => k.id === "bd-pick-swamp-stilt-snag");
            if (!kit) break;
            const cells: [number, number][] = [];
            kit.rows.forEach((r, ry) => (r.upperTiles ?? []).forEach((t, rx) => { if (t >= 0) cells.push([(by - 3 + ry) * lv.width + bx + rx, t]); }));
            // 찍기 도구가 맵 객체를 바꿔 끼우므로(위 통나무) 지금 맵에 쓴다.
            const now = M(ids.forest);
            if (cells.some(([i]) => (now.upperTiles[i] ?? -1) >= 0 || (now.upperOverlayTiles?.[i] ?? -1) >= 0 || pit.has(i))) continue;
            for (const [i, t] of cells) now.upperTiles[i] = t;
            done = true; break;
          }
        }
      }
    }
    // 구덩이 북쪽 위로 맵 끝까지 붙은 모랫길 토막 둘은 아무 데로도 안 갔다(VQA r6 m13) — 풀로 되돌린다.
    {
      const fz = M(ids.forest);
      // 구덩이가 비면 Math.min() 이 Infinity 라 아래 줄 돌기가 끝나지 않았다(main 숲 바닥 재색칠 뒤 fixture 무한 루프).
      const top = pit.size ? Math.min(...[...pit].map((c) => Math.floor(c / fz.width))) : 0;
      const metaF = (project.tilesets[fz.tilesetId] as unknown as { tileMeta?: ({ label?: string } | null)[] }).tileMeta ?? [];
      for (let y = 0; y < top; y += 1) for (let x = Math.floor(cx - rx * 1.6); x <= Math.ceil(cx + rx * 1.6); x += 1) {
        const i = y * fz.width + x;
        if (x >= 0 && x < fz.width && (metaF[fz.lowerTiles[i]!]?.label ?? "").startsWith("버들항 · 모랫길")) fz.lowerTiles[i] = groundTile;
      }
    }
  }
  // 선포하는 발렌이 광장 가장자리 수정 기둥에 겹쳐 서 몸이 가렸다(감사 VQA) — 광장 포석 쪽 빈 칸으로 옮긴다.
  const herald = M(ids.hub).events.find((e) => e.id === `ev_${FS_PREFIX}_valen`);
  if (herald) {
    const spot = nearFree(project, M(ids.hub), { x: herald.x + 2, y: herald.y }, 3, herald.id);
    if (spot) { herald.x = spot.x; herald.y = spot.y; }
  }
  // 천문대 입구는 reworkFallenTown 이 둥근 돌 탑(마법사의 탑 키트)과 곁의 놋쇠 망원경으로 바꿨다 — 예전 재단사 집 간판 바꾸기·혼천의는 걷었다.
  // 풀숲 가장자리에 풀 둑 덧그림을 얹던 마감은 걷어 냈다 — 흙 입술(진흙 못 가장자리)로 읽혔다(감사 라운드 2).
  // 맵 마감(감사 3차) — 주인 없는 그림자, 화로의 방 긴 화덕 띠.
  // 숲 들머리·추락지 둘레의 맨 풀밭(화면 4분의 1)이 잔디밭처럼 비어 보였다(VQA r26) — 길 바로 곁을 뺀
  // 빈 풀 칸에 고사리·히스·들풀·잔돌을 덩이지게 깐다. 밟고 지나가는 바닥 덮개만 쓰고, 통행이 바뀌면 되돌린다(장면 경로를 막지 않게).
  fillForestUnderstory(project, ids.forest);
  for (const map of [M(ids.hub), M(ids.forest)]) clearOrphanShadows(project, map);
  // 모든 이동은 맞은편 문 바로 앞 칸에 내리고, 문을 등진 방향(direction)을 명시한다(VQA r12).
  // 패딩이 끝난 최종 좌표 기준이라 여기서 한 번에 맞춘다.
  {
    type Dir = "up" | "down" | "left" | "right";
    const transfersTo = (map: GameMap, target: string): { event: GameEvent; rec: Record<string, unknown> }[] => {
      const out: { event: GameEvent; rec: Record<string, unknown> }[] = [];
      for (const event of map.events) for (const list of eventCommandLists(event)) for (const cmd of list) {
        const rec = cmd as unknown as Record<string, unknown>;
        if (rec.kind === "transfer" && rec.mapId === target) out.push({ event, rec });
      }
      return out;
    };
    const land = (from: GameMap, to: GameMap, front: Dir, dir: Dir, pick: "first" | "last" = "first"): void => {
      const doors = transfersTo(to, from.id);
      const door = (pick === "first" ? doors[0] : doors[doors.length - 1])?.event;
      if (!door) return;
      const d = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[front];
      for (const { rec } of transfersTo(from, to.id)) { rec.x = door.x + d[0]; rec.y = door.y + d[1]; rec.direction = dir; }
    };
    const hub = M(ids.hub), obs = M(ids.observatory), forest = M(ids.forest);
    land(hub, obs, "up", "up");
    land(obs, hub, "down", "down");
    land(hub, forest, "up", "up");
    land(forest, hub, "down", "down"); // 성문 통로(북쪽) 앞 광장에 내려 성문을 등진다

    // 보이지 않는 터치 칸이던 두 출구에 문 그림을 세운다(VQA r12). 터치 칸과 도착 칸은 비워 둔다(발자국이 겹쳐도 통행 칸은 그림에 안 막힌다).
    const stampKit = (map: GameMap, kitId: string, x: number, y: number): void => {
      try { execTool(project, "stamp_object", { objectId: `kit:beodeul_city/${kitId}`, mapId: map.id, x, y }); } catch { /* 문 그림은 장식이라 실패해도 통행은 그대로 */ }
    };
    // 숲 남쪽 입구: 길 양옆에 이정표를 세운다(마을 문 kit 는 숲 지도에서 거절된다 — settlement-prop-on-route).
    const forestDoor = transfersTo(forest, hub.id)[0]?.event;
    if (forestDoor) {
      // 화로는 길에서 세 칸 — 두 칸이면 숲에 들어선 동료가 화로 바로 아래 칸에 서 모자가 화로 받침을 덮었다(VQA r7).
      stampKit(M(ids.forest), "bd-pick-mountain-pass-brazier", forestDoor.x - 3, forestDoor.y - 2);
      stampKit(M(ids.forest), "bd-pick-mountain-pass-brazier", forestDoor.x + 3, forestDoor.y - 2);
      stampKit(M(ids.forest), "bd-pick-mountain-pass-wayside-cross", forestDoor.x - 2, forestDoor.y - 4);
    }
    // 마을 쪽 숲 출구는 성벽 성문 통로다(성문루·깃발·통행세 초소가 이미 문으로 읽힌다) — 이정표를 따로 세우지 않는다.
  }
  // 숲지기 곁 모닥불.
  const bram = M(ids.forest).events.find((e) => e.id === `ev_${FS_PREFIX}_bram`);
  // 숲지기는 길 한가운데(14,18) 곁에 선다 — 길 계획(rng)이 바뀌어도 QA 대본·대화 접근 칸(14,19)이 같다.
  if (bram && !M(ids.forest).events.some((e) => e !== bram && e.x === 14 && e.y === 18) && isPassable(project, M(ids.forest), 14, 18) && isPassable(project, M(ids.forest), 14, 19)) { bram.x = 14; bram.y = 18; }
  if (bram) for (const [dx, dy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]] as const) if (tryStamp(project, M(ids.forest), "kit:beodeul_city/bd-pick-deep-forest-path-campfire", bram.x + dx, bram.y + dy)) break;

  // 숲길 밀도(VQA r7 맵) — 흙길 둘레 풀밭에 덤불·고사리·돌·버섯을 성기게 흩는다. 길(흙 칸)과 이벤트 곁 3칸은 건드리지 않는다.
  {
    const fm = M(ids.forest);
    // 헤더 덤불(꽃 핀 둥근 덤불)·네모 고사리 덤불(fern-a·b)은 촘촘히 모이면 몬스터 게임의 풀숲 판처럼 읽혔다(사용자 지적) — 낮은 고사리·들꽃·버섯·돌만.
    const kits = ["fern-c", "stones-a", "toadstools-a", "wild-a", "stones-b", "fern-c", "wild-b", "toadstools-b", "wild-c", "stones-c"];
    const placed: Array<[number, number]> = [];
    for (let y = 3; y < fm.height - 3; y += 1) for (let x = 2; x < fm.width - 2; x += 1) {
      if (fm.lowerTiles[y * fm.width + x] === 737) continue;
      // 추락 구덩이(몸통 흙 칸) 안에는 버섯·들꽃을 두지 않는다 — 갓 그을린 구덩이에 독버섯이 섰다(VQA r7).
      { const t = fm.lowerTiles[y * fm.width + x]!; if (t === 23175 || (t >= 11646 && t <= 11650) || (t >= 26809 && t <= 26811)) continue; }
      let nearPath = false;
      for (let dy = -2; dy <= 2 && !nearPath; dy += 1) for (let dx = -2; dx <= 2; dx += 1) {
        if (fm.lowerTiles[(y + dy) * fm.width + (x + dx)] === 737) { nearPath = true; break; }
      }
      if (!nearPath) continue;
      const h = (((x * 73856093) ^ (y * 19349663) ^ 0x51ed) >>> 0) % 100;
      if (h >= 22) continue;
      if (fm.events.some((e) => Math.abs(e.x - x) + Math.abs(e.y - y) <= 3)) continue;
      if (placed.some(([px, py]) => Math.abs(px - x) <= 1 && Math.abs(py - y) <= 1)) continue;
      if (tryStamp(project, M(ids.forest), `kit:beodeul_city/bd-pick-deep-forest-path-${kits[(x * 7 + y * 3) % kits.length]}`, x, y)) placed.push([x, y]);
    }
  }
  // 시작 — 광장, 천문대 문이 보이는 곳.
  const observatoryDoor = M(ids.hub).events.find((e) => JSON.stringify(e).includes(`"mapId":"${M(ids.observatory).id}"`));
  let start = observatoryDoor ? { x: observatoryDoor.x, y: observatoryDoor.y + 3 } : { x: Math.floor(M(ids.hub).width / 2), y: Math.floor(M(ids.hub).height / 2) };
  if (!isPassable(project, M(ids.hub), start.x, start.y) || M(ids.hub).events.some((e) => e.x === start.x && e.y === start.y)) {
    start = pickSpot(project, M(ids.hub), start, new Set(), 0.02, 0) ?? start;
  }
  project.startMapId = M(ids.hub).id;
  project.startPos = start;

  // 빈 시작 맵 정리 + 맵 나무.
  for (const blankId of initialBlankMapIds) {
    if (blankId !== M(ids.hub).id) delete project.maps[blankId];
  }
  project.mapTree = {
    mapId: M(ids.hub).id,
    children: [
      { mapId: M(ids.observatory).id, children: [{ mapId: PUZZLE_ROOM, children: [{ mapId: M(ids.vault).id, children: [] }] }] },
      { mapId: M(ids.forest).id, children: [] },
    ],
  };

  // 타이틀·오프닝 — 게임 안 맵을 1:1 로 구운 그림 위에 같은 배우 칩을 1배로 세운다(fallenStarOpening.ts).
  // 키아트는 생성 그림(새 왕도 렌더를 참고로 다시 뽑은 후보 2, by: supervisor)을 화면 1배 64색 도트로 누른 것. 효과 좌표는 그 그림의 비율 좌표다 —
  // 별똥별 꼬리를 따라 흐르는 반사광, 별 머리·탑 등불·다리 등불의 빛, 운하 물결, 하늘의 빛 알갱이.
  execTool(project, "set_title_screen", {
    title: "폴른 스타",
    backgroundResourceId: FALLEN_STAR_TITLE_BACKGROUND,
    logoStyle: "gold",
    openingPreset: "moonlitCastle",
    effects: [
      { kind: "camera", intensity: 0.5 },
      { kind: "glint", line: [[0.90, 0.04], [0.73, 0.167]], color: "#e8f4ff" },
      { kind: "glow", source: [0.73, 0.167], spread: 0.06, color: "#d8f4ff" },
      { kind: "glow", source: [0.683, 0.574], spread: 0.03, speed: 1.3 },
      { kind: "glow", source: [0.125, 0.685], spread: 0.025, speed: 0.9 },
      { kind: "glow", source: [0.658, 0.86], spread: 0.025, speed: 1.1 },
      { kind: "water", region: [[0.38, 0.40], [0.48, 0.40], [0.48, 1], [0.38, 1]], color: "#cfe0ff" },
      { kind: "motes", region: [[0, 0], [1, 0], [1, 0.3], [0, 0.3]], count: 24, color: "#e6eeff", intensity: 0.4, speed: 0.3 },
    ],
  });
  if (project.system.titleScreen) {
    project.system.titleScreen.logoSubtitle = "제1막 · 떨어진 별";
    project.system.titleScreen.logoStyle = "gold";
    // 가혹 검수 r12: 메뉴 글자가 480 폭에서 작다 — 18px.
    project.system.titleScreen.menuFontPx = 18;
    // 키아트는 화면 1배(480×270) 도트 — 늘리지 않고 도트 그대로 보인다.
    project.system.titleScreen.backgroundFit = "cover";
    project.system.titleScreen.backgroundRendering = "pixelated";
  }
  buildFallenStarOpening(project);
  // 얼굴은 모든 대사 편집이 끝난 뒤 한 번에 건다(위 단계들이 대사를 찾아 바꾸고 덧붙인다).
  const actorFace = (id: string): string => project.database.actors.find((a) => a.id === id)?.faceResourceId ?? "";
  // 이야기 장면(하넬·브람·지하의 발렌)은 말을 걸면 한 칸 물러서 마주 선다.
  stageTalk(M(ids.observatory).events.find((e) => e.id === `ev_${FS_PREFIX}_hanel`));
  stageTalk(M(ids.forest).events.find((e) => e.id === `ev_${FS_PREFIX}_bram`));
  // bossEvent 는 앞에서 잡은 옛 맵 객체일 수 있다(도구를 부를 때마다 맵이 새로 만들어진다) — id 로 다시 찾는다.
  stageTalk(bossEvent ? M(ids.vault).events.find((e) => e.id === bossEvent.id) : undefined);
  if (bossEvent) valenWalksIn(project, M(ids.vault), bossEvent.id, FS_VALEN_START);
  applyFallenSoundtrack(project, { hub: M(ids.hub), observatory: M(ids.observatory), forest: M(ids.forest), vault: M(ids.vault) }, bossEvent?.id);
  // 마을 집 안 — 여관·약방·집 셋을 손 도트 실내로 짓고 부딪힘 문으로 잇는다. 나머지 집 문은 잠겼다고 말한다(사용자 「집에 들어갈 수 없다」).
  // 행렬보다 먼저 짓는다 — 행렬(열 명)이 큰길 두 줄에 서면 리사네 문 앞이 막혀 문 잇기가 거절됐다.
  buildFallenTownInteriors(project, ids.hub, { irisJoined: SW_IRIS_JOINED, valenMarched: SW_VALEN_MARCHED });
  // 길은 모든 소품·표지를 찍은 뒤에 잰다 — 앞에서 재면 뒤에 선 표지·자리 옮김이 길을 막았다.
  marchOffAfterProclamation(project, M(ids.hub));
  clearDoorFronts(project, M(ids.hub));
  // 실내 맵의 방 밖은 전부 어둠(game-scene-polish 3-7·11-6, 사용자 지적 「방 사이가 회색 바닥 띠로 읽힌다」) — 회색 디더·바위 천장은
  // 같은 이웃 번호의 어두운 천장으로, 여백을 메운 바위벽 조각은 공허 칸으로.
  // 천문대 윗 홀 — 오프닝 컷처럼 둥근 단 위 큰 망원경·혼천의·태양계의·별 지도 탁자(VQA r3 「집처럼 보인다」).
  const roomsOwned = (id: string): boolean => isFallenRoomRebuilt(project, M(id)?.id ?? id);
  if (!roomsOwned(ids.observatory)) dressObservatoryHall(project, M(ids.observatory), "ev_fs_scope");
  if (!roomsOwned("fs_vault_gate")) unifyPuzzleFloor(project, M("fs_vault_gate"));
  joinForestTrail(project, ids.forest);
  for (const map of Object.values(project.maps)) if (map.tilesetId === "atlas_biome_interior" && !isFallenRoomRebuilt(project, map.id)) { darkenInteriorMargins(map); dropFloorHangs(project, map); }
  // 둘레를 덧댄 실내(천문대·화로의 방)는 남쪽 출구가 맵 가장자리가 아니라 벽 틈 맨바닥이었다(scene-transfer-off-door) —
  // 틈에 열린 쇠창살 문틀 윗칸(상인방)을 세워(아랫칸 기둥은 바깥 천장 칸이라 얹지 않는다) 출구로 읽히게 한다.
  for (const [mapId, target] of [[ids.observatory, ids.hub], ["fs_vault_gate", ids.observatory]] as const) {
    const map = M(mapId);
    if (isFallenRoomRebuilt(project, map.id)) continue;
    const exit = map.events.find((e) => eventCommandLists(e).some((l) => l.some((c) => c.kind === "transfer" && (c as { mapId?: string }).mapId === target)));
    if (!exit) continue;
    const i = exit.y * map.width + exit.x;
    map.upperTiles[i] = 6423;
  }
  // 천문대 문 — 탑 문 그림 칸(문 앞 큰길 한 칸 위)에서 부딪혀 들어가고, 나오면 그 문 바로 앞에 문을 등지고 선다(scene-transfer-off-door·pair).
  {
    const hub = M(ids.hub);
    const door = hub.events.find((e) => String(e.id).startsWith("ev_gate_") && JSON.stringify(e).includes(`"mapId":"${ids.observatory}"`));
    if (door) {
      const front = { x: door.x, y: door.y };
      door.y -= 1;
      for (const page of door.pages ?? []) { page.priority = "same"; (page as { overlapForbidden?: boolean }).overlapForbidden = true; }
      for (const event of M(ids.observatory).events) for (const list of eventCommandLists(event)) for (const cmd of list) {
        const rec = cmd as unknown as Record<string, unknown>;
        if (rec.kind === "transfer" && rec.mapId === ids.hub) { rec.x = front.x; rec.y = front.y; rec.direction = "down"; }
      }
    }
  }
  applySpeakerFaces(project, {
    [FS_NAMES.hero]: actorFace(DEFAULT_ACTOR_ID),
    엘레나: actorFace("actor_fs_elena"),
    이리스: actorFace("actor_fs_iris"),
    "천문대장 하넬": "easyrpg-faceset-people2-04",
    "심문관 발렌": "easyrpg-faceset-actor1-04",
    "심문회 기사": "easyrpg-faceset-actor1-02",
    "숲지기 브람": "easyrpg-faceset-actor1-10",
    "광장의 할머니": "easyrpg-faceset-people1-07",
    "꼬마 토비": "easyrpg-faceset-people1-00",
    "빵집 아주머니": "easyrpg-faceset-people1-03",
  });

  const serialized = serialize(project);
  const reloaded = deserialize(serialized);
  const manifest = {
    ...FLAGSHIP_BEAT_MANIFESTS["chrono-bell"],
    mapCount: Object.keys(reloaded.maps).length,
    endingCount: reloaded.endings?.length ?? 0,
  };
  return { id: "chrono-bell", manifest, project: reloaded, serialized };
}
