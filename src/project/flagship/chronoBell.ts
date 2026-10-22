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
      sprite: { type: "bundled", id: texture },
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
type Step = "up" | "down" | "left" | "right";
/** from → to 걸음(통행 칸·다른 이벤트 칸을 피하는 BFS). 못 가면 null. */
function walkPath(project: Project, map: GameMap, from: { x: number; y: number }, to: { x: number; y: number }, selfId: string): Step[] | null {
  const occupied = new Set(map.events.filter((e) => e.id !== selfId && !String(e.id).startsWith("ev_gate_")).map((e) => `${e.x},${e.y}`));
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
        if (occupied.has(key) || !isPassable(project, map, x, y)) continue;
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
 * 포고가 끝나면 발렌과 기사가 동문으로 걸어 나간다 — 예전에는 이리스 합류 때 제자리에서 페이지 전환으로 사라졌다
 * (가혹 검수 r12 major 「NPC 가 문까지 걷지 않는다」). 대사가 이어지는 동안(기다리지 않음) 걷고, 문 앞에 닿으면
 * 루트 끝의 스위치로 지운다(떠남 페이지).
 */
function marchOffAfterProclamation(project: Project, hub: GameMap): void {
  const gate = hub.events.find((e) => String(e.id).startsWith("ev_gate_") && e.x >= hub.width - 2);
  const proclamation = hub.events.find((e) => e.id === `ev_${FS_PREFIX}_event`);
  const list = proclamation?.pages?.[0]?.commands;
  const after = list?.findIndex((c) => c.kind === "text" && String((c as { body?: string }).body).includes("교단보다 먼저"));
  if (!gate || !list || after === undefined || after < 0) throw new Error("[fallen-star] 포고·동문을 찾지 못했다");
  const exit = { x: gate.x - 1, y: gate.y };
  // 동문 앞이 한 칸 통로인 방 배치에서는 떠돌이 주민(꼬마 등)이 그 길목에 서 있으면 기사가 못 지나간다
  // (rooms 개편 뒤 ev_fs_kid 가 (52,22) 에서 길을 막아 데모 빌드가 통째로 실패했다) — 길목의 주민은 비켜 세운다.
  const marchers = new Set([`ev_${FS_PREFIX}_knight`, `ev_${FS_PREFIX}_valen`]);
  const keep = (e: { id: string }): boolean => marchers.has(e.id) || String(e.id).startsWith("ev_gate_") || e.id === `ev_${FS_PREFIX}_event` || e.id === `ev_${FS_PREFIX}_gate`;
  const taken = new Set(hub.events.map((e) => `${e.x},${e.y}`));
  for (const blocker of hub.events.filter((e) => !keep(e) && Math.abs(e.x - exit.x) <= 2 && Math.abs(e.y - exit.y) <= 2)) {
    let moved = false;
    for (let radius = 3; radius <= 8 && !moved; radius += 1) {
      for (let dy = -radius; dy <= radius && !moved; dy += 1) {
        for (let dx = -radius; dx <= radius && !moved; dx += 1) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue;
          const x = exit.x + dx, y = exit.y + dy;
          if (x < 0 || y < 0 || x >= hub.width || y >= hub.height || taken.has(`${x},${y}`) || !isPassable(project, hub, x, y)) continue;
          taken.delete(`${blocker.x},${blocker.y}`);
          blocker.x = x; blocker.y = y;
          taken.add(`${x},${y}`);
          moved = true;
        }
      }
    }
  }
  const marches: Command[] = [];
  for (const [id, delay] of [[`ev_${FS_PREFIX}_knight`, 0], [`ev_${FS_PREFIX}_valen`, 1]] as const) {
    const npc = hub.events.find((e) => e.id === id);
    if (!npc) continue;
    const path = walkPath(project, hub, { x: npc.x, y: npc.y }, exit, id);
    if (!path) throw new Error(`[fallen-star] ${id} 가 동문까지 걸어갈 길이 없다`);
    const moves = [
      ...Array.from({ length: delay }, () => ({ kind: "wait" })),
      ...path.map((dir) => ({ kind: "move", dir })),
      { kind: "changeOpacity", delta: -255 },
      // 사라진 뒤에도 칸을 막으면 뒤따르던 발렌이 마지막 걸음에서 멈췄다 — 지나갈 수 있게 한다.
      { kind: "setThrough", enabled: true },
      ...(id.endsWith("valen") ? [{ kind: "setSwitch", switchId: SW_VALEN_MARCHED, value: true }] : []),
    ];
    marches.push({ kind: "moveEvent", eventId: id, route: { moves, repeat: false, wait: false, skippable: true } } as unknown as Command);
  }
  if (!project.switches.some((s) => s.id === SW_VALEN_MARCHED)) project.switches.push({ id: SW_VALEN_MARCHED, name: "발렌 일행 동문으로 떠남" });
  list.splice(after + 1, 0, ...marches);
  vanishWhen(hub, `ev_${FS_PREFIX}_valen`, SW_VALEN_MARCHED);
  vanishWhen(hub, `ev_${FS_PREFIX}_knight`, SW_VALEN_MARCHED);
}

export const SW_VALEN_ARRIVED = "sw_fs_valen_arrived";
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
  vault.events.push({
    id: walkerId, name: "걸어 들어오는 발렌", x: start.x, y: start.y, trigger: { kind: "action" }, commands: [],
    pages: [
      { id: `${walkerId}_on`, name: "통로", conditions: [], graphic: { ...visible, direction: "down" }, movement: { type: "fixed", speed: 3, frequency: 3 },
        priority: "same", trigger: { kind: "action" }, commands: [] },
      { id: `${walkerId}_gone`, name: "섰다", conditions: [arrived], graphic: { transparent: true }, movement: { type: "fixed", speed: 3, frequency: 3 },
        priority: "below", trigger: { kind: "action" }, commands: [] },
    ],
  } as unknown as GameEvent);
  const cue: Command[] = [
    { kind: "cutsceneControl", mode: "begin", skippable: true },
    narrate("어둠 저편에서 발소리가 내려온다."),
    { kind: "showEmote", target: "player", emote: "exclamation", durationMs: 700 },
    // 화면이 북쪽 통로를 비추게 들어 올린다 — 일행 자리에서는 통로가 화면 밖이라 걸어 내려오는 모습이 안 보였다.
    { kind: "m2Command", commandId: "m2-049-scroll-map", fields: { direction: "up", distance: "4", durationMs: "700", wait: "true" } },
    { kind: "moveEvent", eventId: walkerId, route: { moves: [...path.map((dir) => ({ kind: "move", dir })), { kind: "turn", dir: "down" }], repeat: false, wait: true, skippable: true } },
    { kind: "label", name: "cutscene_end" },
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
  setEventChip(M(ids.hub), `ev_${FS_PREFIX}_valen`, "tex_easyrpg_charset_actor1", 4);
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

  // 동문 문지기는 숲으로 나가는 출입구 곁에 세운다.
  const forestGate = M(ids.hub).events.find((e) => JSON.stringify(e).includes(`"mapId":"${M(ids.forest).id}"`));
  const guard = M(ids.hub).events.find((e) => e.id === `ev_${FS_PREFIX}_gate`);
  if (forestGate && guard) {
    const spot = nearFree(project, M(ids.hub), { x: forestGate.x - 2, y: forestGate.y - 1 }, 4, guard.id);
    if (spot) { guard.x = spot.x; guard.y = spot.y; }
  }

  // 추락지 — 금속 알 둘레를 그을린 흙(농장 흙길 오토타일)으로 타원형으로 칠하고, 가장자리에 불씨 자국·쓰러진 나무·그루터기를 둔다.
  // 민무늬 풀 칸만 칠한다(알 그림·길은 건드리지 않는다). 알 앞 조사 칸과 숲길은 비운다.
  const pod = M(ids.forest).events.find((e) => e.id === `ev_${FS_PREFIX}_main_inspect1`);
  if (pod) {
    const fm = M(ids.forest);
    const cx = pod.x, cy = pod.y - 1, rx = 3.9, ry = 2.7;
    const pit = new Set<number>();
    for (let y = Math.max(1, Math.floor(cy - ry)); y <= Math.min(fm.height - 2, Math.ceil(cy + ry)); y += 1) {
      for (let x = Math.max(1, Math.floor(cx - rx)); x <= Math.min(fm.width - 2, Math.ceil(cx + rx)); x += 1) {
        // 칸마다 흔든다 — 고른 타원은 공터 네모 판으로 보였다(감사 3차 「흙 마당」).
        const wob = (((x * 73856093) ^ (y * 19349663)) >>> 0) % 7 * 0.1 - 0.25;
        const inside = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1 - wob
          && fm.lowerTiles[y * fm.width + x] === 737
          // 관 그림 밑 칸도 칠한다 — 남겨 두면 관 둘레에 풀 테두리가 섰다.
          && ((fm.upperTiles[y * fm.width + x] ?? -1) < 0 || (x === pod.x && y >= pod.y - 2 && y <= pod.y - 1));
        if (inside) pit.add(y * fm.width + x);
      }
    }
    // 가로·세로 이웃이 둘 미만인 삐죽 칸은 뺀다 — 둑 덧그림에 그런 모양이 없어 네모 흙 한 칸이 튀어나왔다.
    for (let changed = true; changed;) {
      changed = false;
      for (const c of [...pit]) {
        const n = [c - fm.width, c + fm.width, c - 1, c + 1].filter((k) => pit.has(k)).length;
        if (n < 2) { pit.delete(c); changed = true; }
      }
    }
    for (const c of [...pit].sort((p, q) => p - q)) {
      if (pit.has(c - 1)) continue;
      let end = c; while (pit.has(end + 1) && Math.floor((end + 1) / fm.width) === Math.floor(c / fm.width)) end += 1;
      execTool(project, "fill_region", { mapId: fm.id, x: c % fm.width, y: Math.floor(c / fm.width), w: end - c + 1, h: 1, layer: "lower", material: "버들항 모랫길" });
    }
    const debris: Array<[string, number, number]> = [
      ["bd-pick-volcano-cave-ember-a", -2, -2], ["bd-pick-volcano-cave-ember-a", 2, 1], ["bd-pick-volcano-cave-ember-a", -3, 0],
      ["bd-pick-deep-forest-path-log-fallen", -7, 1], ["bd-pick-deep-forest-path-log-fallen", 5, 2],
      ["bd-pick-deep-forest-path-stump", -6, -3], ["bd-pick-deep-forest-path-stump", 6, -2], ["bd-pick-deep-forest-path-stump", -7, -1],
      ["bd-pick-volcano-cave-ember-a", 1, -2], ["bd-pick-deep-forest-path-log-fallen", 4, -4],
      // 그을린 구덩이 — 숯 더미를 구덩이 안쪽에 흩어 맨 흙 타원으로 읽히지 않게 한다(감사 2차).
      ["bd-pick-volcano-cave-coal-pile", -2, 0], ["bd-pick-volcano-cave-coal-pile", 2, -1],
      // 그을린 자리 바깥 풀밭 — 꺾인 덤불이 흩어져 공터 경계를 흐린다.
      ["bd-pick-deep-forest-path-heath-a", -5, 2], ["bd-pick-deep-forest-path-heath-b", 5, -1], ["bd-pick-deep-forest-path-fern-c", -5, -2],
      ["bd-pick-deep-forest-path-heath-c", 4, 3], ["bd-pick-deep-forest-path-fern-c", -4, 3], ["bd-pick-deep-forest-path-heath-b", 6, 1],
    ];
    // 흙길 오토타일이 오목한 모서리 칸을 스스로 채운다 — 실제로 바뀐 칸을 다시 모아 둑을 얹는다.
    const live = M(ids.forest);
    for (let c = 0; c < live.lowerTiles.length; c += 1) if (live.lowerTiles[c] !== fm.lowerTiles[c] && fm.lowerTiles[c] === 737) pit.add(c);
    rimPit(project, live, pit, "bankLava"); // fill_region 이 맵 객체를 바꿔 끼우므로 fm 이 아니라 지금 맵에 얹는다.
    for (const [kit, dx, dy] of debris) tryStamp(project, M(ids.forest), `kit:beodeul_city/${kit}`, pod.x + dx, pod.y + dy);
  }
  // 선포하는 발렌이 광장 가장자리 수정 기둥에 겹쳐 서 몸이 가렸다(감사 VQA) — 광장 포석 쪽 빈 칸으로 옮긴다.
  const herald = M(ids.hub).events.find((e) => e.id === `ev_${FS_PREFIX}_valen`);
  if (herald) {
    const spot = nearFree(project, M(ids.hub), { x: herald.x + 2, y: herald.y }, 3, herald.id);
    if (spot) { herald.x = spot.x; herald.y = spot.y; }
  }
  // 천문대 입구가 재단사 가게집(가위 간판·차양)이라 천문대로 읽히지 않았다(감사 VQA) — 간판·차양 칸을 같은 집의 민벽·창으로 바꾸고
  // 집 곁에 놋쇠 혼천의를 세운다. 그림 칸 번호는 버들항 집 키트 bd-house-h123_1(재단사)과 민가 행(같은 지붕·벽)에서 가져왔다.
  const obsDoor = M(ids.hub).events.find((e) => JSON.stringify(e).includes(`"mapId":"${M(ids.observatory).id}"`));
  if (obsDoor) {
    const hub: GameMap = M(ids.hub);
    const swap: Record<number, number> = { 10287: 2652, 6046: 6041, 10596: 757, 10597: 2493, 10711: 5742, 10712: 2656 };
    const ox: number = obsDoor.x, oy: number = obsDoor.y;
    for (let y: number = oy - 4; y <= oy - 1; y += 1) for (let x: number = ox - 3; x <= ox + 3; x += 1) {
      if (x < 0 || y < 0 || x >= hub.width || y >= hub.height) continue;
      const i: number = y * hub.width + x;
      const t: number = hub.upperTiles[i] ?? -1;
      if (swap[t] !== undefined) hub.upperTiles[i] = swap[t]!;
    }
    for (const [dx, dy] of [[3, -3], [-4, -3], [3, 1], [-3, 1]] as const) {
      if (tryStamp(project, hub, "kit:beodeul_city/bd-pick-wizard-tower-armillary", obsDoor.x + dx, obsDoor.y + dy)) break;
    }
  }
  // 풀숲 가장자리에 풀 둑 덧그림을 얹던 마감은 걷어 냈다 — 흙 입술(진흙 못 가장자리)로 읽혔다(감사 라운드 2).
  // 맵 마감(감사 3차) — 주인 없는 그림자, 화로의 방 긴 화덕 띠.
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
    land(forest, hub, "left", "left");

    // 보이지 않는 터치 칸이던 두 출구에 문 그림을 세운다(VQA r12). 터치 칸과 도착 칸은 비워 둔다(발자국이 겹쳐도 통행 칸은 그림에 안 막힌다).
    const stampKit = (map: GameMap, kitId: string, x: number, y: number): void => {
      try { execTool(project, "stamp_object", { objectId: `kit:beodeul_city/${kitId}`, mapId: map.id, x, y }); } catch { /* 문 그림은 장식이라 실패해도 통행은 그대로 */ }
    };
    // 숲 남쪽 입구: 길 양옆에 이정표를 세운다(마을 문 kit 는 숲 지도에서 거절된다 — settlement-prop-on-route).
    const forestDoor = transfersTo(forest, hub.id)[0]?.event;
    if (forestDoor) {
      stampKit(M(ids.forest), "bd-pick-mountain-pass-brazier", forestDoor.x - 2, forestDoor.y - 2);
      stampKit(M(ids.forest), "bd-pick-mountain-pass-brazier", forestDoor.x + 2, forestDoor.y - 2);
      stampKit(M(ids.forest), "bd-pick-mountain-pass-wayside-cross", forestDoor.x - 2, forestDoor.y - 4);
    }
    const hubDoor = transfersTo(hub, forest.id)[0]?.event;
    if (hubDoor) {
      stampKit(M(ids.hub), "bd-pick-coast-cliff-road-milestone", hubDoor.x - 1, hubDoor.y - 2);
      stampKit(M(ids.hub), "bd-pick-coast-cliff-road-milestone", hubDoor.x - 1, hubDoor.y + 1);
      stampKit(M(ids.hub), "bd-mpart-lamp-post", hubDoor.x, hubDoor.y - 3);
    }
  }
  // 숲지기 곁 모닥불.
  const bram = M(ids.forest).events.find((e) => e.id === `ev_${FS_PREFIX}_bram`);
  // 숲지기는 길 한가운데(14,18) 곁에 선다 — 길 계획(rng)이 바뀌어도 QA 대본·대화 접근 칸(14,19)이 같다.
  if (bram && !M(ids.forest).events.some((e) => e !== bram && e.x === 14 && e.y === 18) && isPassable(project, M(ids.forest), 14, 18) && isPassable(project, M(ids.forest), 14, 19)) { bram.x = 14; bram.y = 18; }
  if (bram) for (const [dx, dy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]] as const) if (tryStamp(project, M(ids.forest), "kit:beodeul_city/bd-pick-deep-forest-path-campfire", bram.x + dx, bram.y + dy)) break;

  // 숲길 밀도(VQA r7 맵) — 흙길 둘레 풀밭에 덤불·고사리·돌·버섯을 성기게 흩는다. 길(흙 칸)과 이벤트 곁 3칸은 건드리지 않는다.
  {
    const fm = M(ids.forest);
    const kits = ["heath-a", "fern-a", "stones-a", "fern-b", "heath-b", "toadstools-a", "wild-a", "heath-c", "stones-b", "fern-c", "wild-b", "toadstools-b"];
    const placed: Array<[number, number]> = [];
    for (let y = 3; y < fm.height - 3; y += 1) for (let x = 2; x < fm.width - 2; x += 1) {
      if (fm.lowerTiles[y * fm.width + x] === 737) continue;
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
  // 키아트는 생성 그림(타이틀 후보 3, by: supervisor)을 화면 1배 64색 도트로 누른 것. 효과 좌표는 그 그림의 비율 좌표다 —
  // 별똥별 꼬리를 따라 흐르는 반사광, 별 머리·탑 등불·다리 등불의 빛, 운하 물결, 하늘의 빛 알갱이.
  execTool(project, "set_title_screen", {
    title: "폴른 스타",
    backgroundResourceId: FALLEN_STAR_TITLE_BACKGROUND,
    logoStyle: "gold",
    openingPreset: "moonlitCastle",
    effects: [
      { kind: "camera", intensity: 0.5 },
      { kind: "glint", line: [[0.2, 0.03], [0.596, 0.263]], color: "#e8f4ff" },
      { kind: "glow", source: [0.596, 0.263], spread: 0.06, color: "#d8f4ff" },
      { kind: "glow", source: [0.883, 0.546], spread: 0.03, speed: 1.3 },
      { kind: "glow", source: [0.352, 0.726], spread: 0.025, speed: 0.9 },
      { kind: "glow", source: [0.538, 0.726], spread: 0.025, speed: 1.1 },
      { kind: "water", region: [[0.29, 0.62], [0.58, 0.62], [0.62, 1], [0.27, 1]], color: "#cfe0ff" },
      { kind: "motes", region: [[0, 0], [1, 0], [1, 0.36], [0, 0.36]], count: 24, color: "#e6eeff", intensity: 0.4, speed: 0.3 },
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
  // 길은 모든 소품·표지를 찍은 뒤에 잰다 — 앞에서 재면 뒤에 선 표지·자리 옮김이 길을 막았다.
  marchOffAfterProclamation(project, M(ids.hub));
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
