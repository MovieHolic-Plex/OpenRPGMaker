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
import { FALLEN_STAR_ACT1, FS_NAMES, FS_PREFIX, FS_STAR_KEY_ITEM } from "./fallenStarStory";
import type { FlagshipDemoBuildResult } from "./types";

const ENDING_ID = "end_fs_act1";
const SW_IRIS_JOINED = "sw_fs_iris_joined";
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
    characterResourceId: "easyrpg-charset-actor4", characterIndex: 3,
    battleCharacterResourceId: "charset-battler-actor4-3", initialLevel: 6,
  });
  // Actor4 칩에는 짝 얼굴 그림이 없다 — 남의 얼굴을 빌리지 않는다.
  delete (actors.find((a) => a.id === IRIS_ID) as { faceResourceId?: string }).faceResourceId;
  project.system.startActorIds = [hero.id, ELENA_ID];
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
    members: enemyIds.map((enemyId, i) => ({ enemyId, x: 80 + i * 56, y: 96, hidden: false })),
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
  makeEnemy(project, "enemy_fs_valen", "심문관 발렌", "mage-rogue", { maxHp: 1100, maxMp: 120, attack: 84, defense: 30, mind: 90, agility: 44 }, 400, 300);
  makeEnemy(project, "enemy_fs_guardian", "별지기의 수호상", "golem-crystal", { maxHp: 900, maxMp: 0, attack: 92, defense: 40, mind: 40, agility: 22 }, 300, 0);
  makeTroop(project, "troop_fs_wolves", "숲늑대 무리", ["enemy_fs_wolf", "enemy_fs_wolf"]);
  makeTroop(project, "troop_fs_spiders", "덤불거미", ["enemy_fs_spider", "enemy_fs_spider"]);
  makeTroop(project, "troop_fs_wisps", "도깨비불", ["enemy_fs_wisp", "enemy_fs_wisp", "enemy_fs_wisp"]);
  makeTroop(project, "troop_fs_boss", "심문관 발렌과 수호상", ["enemy_fs_valen", "enemy_fs_guardian"]);
  return { field: ["troop_fs_wolves", "troop_fs_spiders", "troop_fs_wisps"], boss: "troop_fs_boss" };
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
  choices.options[0]!.branch = [...accept.filter((c) => c.kind !== "text"), say(H, "조심하거라. 동문으로 나가면 바로 숲이다.")];
  ask.splice(summaryAt, 1, ...askLines);
  choices.prompt = "숲으로 가 볼까?";
  choices.options[0]!.text = "가 보겠습니다";
  choices.options[1]!.text = "조금 있다가";
  replaceLine(observatory, hanel!.id, "마음이 바뀌면 다시 오게.", [say(H, "너무 늦지는 말거라. 심문관들이 먼저 닿을지도 모른다.")]);

  // 진행 중: 어디까지 왔는지에 따라 다음 갈 곳을 알려 준다(브람 → 공터 → 지하 철문).
  const hints = [
    "동문으로 나가면 숲이다. 숲길은 숲지기 브람에게 물어보거라.",
    "브람이 말한 북쪽 끝 공터로 가 보거라.",
    "바닥 철문 말이냐? 별 모양 홈이 있지. 그 열쇠가 맞을지도 모른다. 조심해서 내려가거라.",
  ];
  let fork = progressPage.commands.find((c) => c.kind === "fork") as ForkCommand | undefined;
  for (const hint of hints) {
    if (!fork) throw new Error("[fallen-star] 하넬 진행 대사 분기가 모자라다");
    fork.else = [say(H, hint)];
    fork = (fork.then ?? []).find((c) => c.kind === "fork") as ForkCommand | undefined;
  }
  replaceLine(observatory, hanel!.id, "자네 덕분에 살았어. 정말 고맙네.", [say(H, "북쪽 하늘탑으로 가거라. 이리스를 부탁한다.")]);

  replaceLine(forest, `ev_${FS_PREFIX}_bram`, "고맙네.", [say("숲지기 브람", "북쪽 끝 공터다. 길만 따라가라. 풀숲에선 늑대를 조심하고.")]);
  replaceLine(forest, `ev_${FS_PREFIX}_main_inspect1`, "확인을 마쳤다.", [narrate("금속 알은 텅 비었다. 안쪽에 아직 온기가 남아 있다.")]);

  // 지하 상자 — 기본 표의 「기본 새우」 대신 상급 회복약.
  const chest = vault.events.find((e) => e.id === `ev_${FS_PREFIX}_vault_chest1`);
  for (const list of chest ? eventCommandLists(chest) : []) for (const c of list) {
    const rec = c as unknown as Record<string, unknown>;
    if (rec.kind === "changeItem" && rec.itemId === "item_shared_fishing_shrimp-1") rec.itemId = "item_hi_potion";
  }
  replaceLine(vault, `ev_${FS_PREFIX}_vault_chest1`, "보물상자를 열었다! 기본 새우를 손에 넣었다.", [narrate("보물상자를 열었다! 상급 회복약을 손에 넣었다.")]);

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

/** origin 에서 가장 가까운, 걸을 수 있고 다른 이벤트와 붙지 않은 빈 칸. */
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
  if (process.env.FS_DEBUG) console.error("[fallen-star] chapter:", built.summary, JSON.stringify(built.warnings ?? [], null, 1));
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
  setEventChip(M(ids.observatory), `ev_${FS_PREFIX}_hanel`, "tex_easyrpg_charset_people1", 6);
  setEventChip(M(ids.forest), `ev_${FS_PREFIX}_bram`, "tex_easyrpg_charset_actor2", 2);
  setEventChip(M(ids.hub), `ev_${FS_PREFIX}_elder`, "tex_easyrpg_charset_people1", 7);
  // 얼굴은 칩과 같은 인물만(People1 은 칩·얼굴 번호가 같다). 맞는 얼굴이 없는 칩은 얼굴을 뺀다.
  setEventFace(M(ids.observatory), `ev_${FS_PREFIX}_hanel`, "easyrpg-faceset-people1-06");
  setEventFace(M(ids.hub), `ev_${FS_PREFIX}_elder`, "easyrpg-faceset-people1-07");
  setEventFace(M(ids.hub), `ev_${FS_PREFIX}_gate`, undefined);
  setEventFace(M(ids.forest), `ev_${FS_PREFIX}_bram`, undefined);
  polishLines(M(ids.observatory), M(ids.forest), M(ids.vault));
  const bossEvent = M(ids.vault).events.find((e) => (e.pages ?? []).some((p) => JSON.stringify(p.commands).includes("battleProcessing")) && e.id.includes("kill"));
  if (bossEvent) setEventChip(M(ids.vault), bossEvent.id, "tex_easyrpg_charset_actor1", 4);

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
    say("이리스", "…여기는 어디죠? 제 배는… 부서졌군요."),
    say("카엘", "괜찮아? 너… 별에서 떨어진 거야?"),
    say("이리스", "별이 아니라 배예요. 저는 이리스. 사람을 닮게 만든 기계예요."),
    say("엘레나", "기계라고? 말도 하고, 숨도 쉬는데…"),
    say("이리스", "숨은 흉내예요. 사람들이 덜 무서워하라고요."),
    say("이리스", "집에 돌아가려면 신호를 보내야 해요. 높은 곳에, 커다란 렌즈가 있는 곳이 필요해요."),
    say("엘레나", "렌즈라면… 천문대에 있어."),
    say("이리스", "그리고 이거요. 배 안쪽에 박혀 있던 거예요."),
    keyGain,
    narrate("「별빛 열쇠」를 얻었다."),
    say("엘레나", "이 별 무늬… 천문대 바닥 철문에 파인 홈이랑 똑같아."),
    say("카엘", "돌아가자. 심문관들이 여길 찾기 전에."),
    { kind: "changeParty", actorId: IRIS_ID, action: "add" } as Command,
    { kind: "setSwitch", switchId: SW_IRIS_JOINED, value: true } as Command,
    narrate("이리스가 동료가 되었다."),
  );
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
            say("엘레나", "물러서자! 숨을 고르고 다시 가."),
          ];
        }
      }
    }
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
  M(PUZZLE_ROOM).atmosphereEffects = M(ids.vault).atmosphereEffects;
  replaceLineAnywhere(M(PUZZLE_ROOM), "퍼즐 해독 보상! 「태양의 불씨 보관함」과(와) 250G를 획득했다!", [narrate("화로 사이 바닥이 열리고, 「태양의 불씨 보관함」과 250G가 나왔다.")]);
  const retarget = (map: GameMap, fromMapId: string, to: { mapId: string; x: number; y: number; facing?: string }): GameEvent | undefined => {
    const event = map.events.find((e) => eventCommandLists(e).some((l) => l.some((c) => c.kind === "transfer" && (c as { mapId?: string }).mapId === fromMapId)));
    if (!event) return undefined;
    for (const list of eventCommandLists(event)) for (const cmd of list) {
      const rec = cmd as unknown as Record<string, unknown>;
      if (rec.kind === "transfer" && rec.mapId === fromMapId) Object.assign(rec, to);
    }
    return event;
  };
  const touchTransfer = (map: GameMap, id: string, x: number, y: number, to: { mapId: string; x: number; y: number; facing: string }): void => {
    map.events.push({
      id, name: "출입구", x, y, trigger: { kind: "playerTouch" }, commands: [],
      pages: [{
        id: `${id}_p`, name: "출입구", conditions: [], graphic: { transparent: true }, trigger: { kind: "playerTouch" },
        priority: "below", overlapForbidden: false, movement: { type: "fixed", speed: 3, frequency: 3 },
        commands: [{ kind: "transfer", ...to, fade: "black" } as Command],
      }],
    } as GameEvent);
  };
  const hatch = retarget(M(ids.observatory), M(ids.vault).id, { mapId: PUZZLE_ROOM, x: 10, y: 13, facing: "up" });
  if (!hatch) throw new Error("[fallen-star] 천문대 뚜껑문을 찾지 못했다");
  // 뚜껑문이 보이게 — 투명 출입구 칸에 바닥 뚜껑문 그림을 찍는다.
  execTool(project, "stamp_object", { objectId: "kit:atlas_biome_interior/hand-interior:trapdoor", mapId: M(ids.observatory).id, x: hatch.x, y: hatch.y });
  const hatchFront = pickSpot(project, M(ids.observatory), { x: hatch.x, y: hatch.y }, new Set([`${hatch.x},${hatch.y}`]), 0.01, 1) ?? { x: hatch.x, y: hatch.y + 1 };
  touchTransfer(M(PUZZLE_ROOM), "ev_fs_vault_gate_down", 10, 14, { mapId: M(ids.observatory).id, x: hatchFront.x, y: hatchFront.y, facing: "down" });
  const vaultStairs = retarget(M(ids.vault), M(ids.observatory).id, { mapId: PUZZLE_ROOM, x: 10, y: 3, facing: "down" });
  const vaultEntry = vaultStairs ? { x: vaultStairs.x, y: vaultStairs.y + 2 } : { x: 30, y: 58 };
  for (const gx of [9, 10]) touchTransfer(M(PUZZLE_ROOM), `ev_fs_vault_gate_up${gx}`, gx, 2, { mapId: M(ids.vault).id, x: vaultEntry.x, y: vaultEntry.y, facing: "up" });

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
    const cx = pod.x, cy = pod.y - 1, rx = 5.2, ry = 3.4;
    for (let y = Math.max(1, Math.floor(cy - ry)); y <= Math.min(fm.height - 2, Math.ceil(cy + ry)); y += 1) {
      let runStart = -1;
      for (let x = Math.max(1, Math.floor(cx - rx)); x <= Math.min(fm.width - 1, Math.ceil(cx + rx) + 1); x += 1) {
        const wob = ((x * 7 + y * 13) % 5) * 0.06;
        const inside = x <= fm.width - 2 && ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1 - wob
          && fm.lowerTiles[y * fm.width + x] === 737 && (fm.upperTiles[y * fm.width + x] ?? -1) < 0;
        if (inside && runStart < 0) runStart = x;
        if (!inside && runStart >= 0) {
          execTool(project, "fill_region", { mapId: fm.id, x: runStart, y, w: x - runStart, h: 1, layer: "lower", material: "버들항 농장 흙길" });
          runStart = -1;
        }
      }
    }
    const debris: Array<[string, number, number]> = [
      ["bd-pick-volcano-cave-ember-a", -2, -2], ["bd-pick-volcano-cave-ember-a", 2, 0], ["bd-pick-volcano-cave-ember-a", -3, 0],
      ["bd-pick-deep-forest-path-log-fallen", -7, 1], ["bd-pick-deep-forest-path-log-fallen", 5, 2],
      ["bd-pick-deep-forest-path-stump", -6, -3], ["bd-pick-deep-forest-path-stump", 6, -2], ["bd-pick-deep-forest-path-stump", -7, -1],
      ["bd-pick-mining-valley-slagrock", 3, -3], ["bd-pick-sea-cave-rubble-cave", -4, 2],
    ];
    for (const [kit, dx, dy] of debris) tryStamp(project, M(ids.forest), `kit:beodeul_city/${kit}`, pod.x + dx, pod.y + dy);
  }
  // 숲지기 곁 모닥불.
  const bram = M(ids.forest).events.find((e) => e.id === `ev_${FS_PREFIX}_bram`);
  if (bram) for (const [dx, dy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]] as const) if (tryStamp(project, M(ids.forest), "kit:beodeul_city/bd-pick-deep-forest-path-campfire", bram.x + dx, bram.y + dy)) break;

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
  execTool(project, "set_title_screen", {
    title: "폴른 스타",
    backgroundResourceId: FALLEN_STAR_TITLE_BACKGROUND,
    logoStyle: "gold",
  });
  if (project.system.titleScreen) {
    project.system.titleScreen.logoSubtitle = "제1막 · 떨어진 별";
    // 배경은 게임 맵을 1배로 구운 밤 왕도 — 늘리지 않고 도트 그대로 보인다.
    project.system.titleScreen.backgroundFit = "cover";
    project.system.titleScreen.backgroundRendering = "pixelated";
  }
  buildFallenStarOpening(project);

  const serialized = serialize(project);
  const reloaded = deserialize(serialized);
  const manifest = {
    ...FLAGSHIP_BEAT_MANIFESTS["chrono-bell"],
    mapCount: Object.keys(reloaded.maps).length,
    endingCount: reloaded.endings?.length ?? 0,
  };
  return { id: "chrono-bell", manifest, project: reloaded, serialized };
}
