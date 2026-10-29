/**
 * 『전생한 마왕, 편의점 알바 시작하다』 — 현대 일본 일상 코미디 데모(약 15~25분, 엔딩 셋).
 *
 * 세계의 절반을 손에 넣은 암흑 마왕 제르바스는 용사 레온과의 최후의 결전에서 『동귀어진』에 휘말려
 * 현대 일본의 원룸에서 눈을 뜬다. 통장 잔고 0엔. 현관에 꽂힌 편의점 알바 전단지.
 * 오만한 고어체로 말하지만 편의점 매뉴얼에는 엄숙하게 굴복하는 마왕(명찰 이름 「마오」)이
 * 갸루 선배 히나·사토미 점장·단골 다나카 씨 사이에서 사흘을 일한다.
 * 저녁에는 상점가에서 옛 사천왕 리리스(지금은 찻집 알바)와 고양이가 된 용왕 가르곤을 만나고,
 * 사흘째 밤, 기억을 되찾은 용사(지금은 고등학생)가 편의점에 쳐들어온다.
 * 마왕의 힘을 해방할지, 알바 매뉴얼을 따를지 — 그 선택과 사흘 동안의 근무 평가가 결말을 가른다.
 *
 * 흐름은 변수 하나(var_mk_stage)가 쥔다:
 *   0 마왕성 결전 → 1 원룸에서 눈뜸 → 2 면접 → 3 첫째 날 근무 → 4 첫째 날 저녁
 *   → 5 둘째 날 근무 → 6 둘째 날 저녁(공원 회의) → 7 사흘째 야간 근무 → 8 결전·결말.
 * 근무 하루 = 업무 셋(var_mk_tasks 0..3). 손님 응대·업무 선택이 근무 평가(var_mk_service)를 쌓는다.
 *
 * 새 그림은 그리지 않았다 — jp_city 상점가·현대 실내(modern_city)·손 도트 실내(성)·현대 걷기 칩·공용 흉상·EasyRPG 칩/얼굴만 쓴다.
 */
import { reviewedFaceIdForCharset } from "@/assets/reviewedCharsetFaces";
import { isPassable } from "@/project/collision";
import { createBlankProject } from "@/project/defaults";
import { DEFAULT_ACTOR_ID } from "@/project/defaults/constants";
import { blankFillTileFor, createStarterMap } from "@/project/defaults/defaultMaps";
import { createJpCityTileset, JP_CITY_ID } from "@/project/defaults/jpCity";
import { deserialize, serialize } from "@/project/io";
import { applyMaouKonbiniLore } from "./maouKonbiniLore";
import type { ActorRecord as Actor, Command, EnemyRecord as Enemy, GameMap, Project, TroopRecord as Troop } from "@/project/types";
import { FLAGSHIP_BEAT_MANIFESTS } from "./beats";
import {
  approach, bgm, CAST, caption, type Cell, choices, clearTint, emote, event, execTool, exitVia, face, faceHero, fadeIn, fadeOut, flash,
  gone, ifCond, mustBlock, mustReach, mustWalk, nearestFree, note, page, panBack, panTo, playSe, say, setSw, setVar, shake, stopBgm, swOff, swOn, think, thinkAs,
  timedChoice, tint, transfer, varAtLeast, varIs, voice, wait, walk, walkTo, type Who,
} from "./maouKonbiniKit";
import { buildMaouOpening, buildMaouThrone, setupMaouTitle, stageMaouRoomWake } from "./maouKonbiniOpening";
import type { FlagshipDemoBuildResult } from "./types";

// ── 상태 ──
const V_STAGE = "var_mk_stage";
const V_TASKS = "var_mk_tasks";
const V_SERVICE = "var_mk_service";
/** 마왕력 — 마왕다운(웃긴) 선택마다 오른다. 근무 평가와 따로 쌓여, 높으면 「이상한 신입」이 동네 명물이 된다. */
const V_MAOU = "var_mk_maou";
/** 제한시간 선택지·연속 주문의 결과를 잠깐 담는 칸. */
const V_PICK = "var_mk_pick";
const SW_LOST = "sw_mk_manual_lost";
const SW_SHIFT = "sw_mk_on_shift";
const SW_TANAKA = "sw_mk_tanaka_order"; // 다나카 씨의 「늘 먹던 거」를 배웠다
const SW_LILY = "sw_mk_lily_met";
const SW_MEETING = "sw_mk_meeting_done";
/** 「이달의 우수 사원」 문턱 — 사흘 동안 고를 수 있는 모범 응대는 최대 15번. 모범 응대만으로는 11, 마왕력 8 이상이면 9(동네 명물). */
const BEST_AT = 11;
const BEST_WITH_MAOU = 9;
const MAOU_FAMOUS = 8;

const END_BEST = "end_mk_best_employee";
const END_OK = "end_mk_tomorrow_too";
const END_POWER = "end_mk_maou_returns";
const END_ART = { best: "oprn-maou-konbini-end-best", ok: "oprn-maou-konbini-end-ok", power: "oprn-maou-konbini-end-power" } as const;

// ── 맵 ──
const M = {
  throne: "map_mk_throne",
  room: "map_mk_room",
  street: "map_mk_street",
  konbini: "map_mk_konbini",
  park: "map_mk_park",
  shrine: "map_mk_shrine",
} as const;

// ── 소리 ──
const BGM_BOSS = "easyrpg-music-boss-3"; // 출하 번들에 든 곡만 쓴다(카탈로그 곡은 설치형이라 빠질 수 있다)
const BGM_ROOM = "cc0-bgm-rtp-rad-002";
const BGM_SHOP = "cc0-bgm-rtp-pon-001";
const BGM_STREET = "cc0-bgm-town";
const BGM_EVENING = "cc0-bgm-rtp-fld-003";
const BGM_SHRINE = "easyrpg-music-mystery-1";
const BGM_NIGHT = "cc0-bgm-rtp-rst-001";
const BGM_MANUAL = "cc0-bgm-rtp-btl-001";
const BGM_END = "easyrpg-music-ending-2";
const SE_CHIME = "easyrpg-sound-song"; // 편의점 자동문 입점 차임
const SE_OK = "cc0-se-orp-interface-interface3";
const SE_BEEP = "cc0-se-osx-switch-01"; // 바코드 삑
const SE_WRONG = "easyrpg-sound-buzzer1";
const SE_DARK = "easyrpg-sound-darkness3";
const SE_FLASH = "easyrpg-sound-flash1";
const SE_BOOM = "easyrpg-sound-explosion1";
const SE_PAPER = "cc0-se-osx-paper-04";
const SE_CAT = "easyrpg-sound-cat";
const SE_BELL = "cc0-se-osx-bell-01";

// ── 배우 ──
const MAOU_TRUE = "actor_mk_maou_true";
const CLASS_CLERK = "class_mk_clerk";
const CLASS_MAOU = "class_mk_maou";

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

/** 근무 한 칸을 마쳤다 — 업무 수가 HUD 에 오른다. */
const taskDone = (sw: string): Command[] => [setSw(sw), setVar(V_TASKS, "+=", 1), playSe(SE_OK), emote("player", "sparkle", 900), wait(400)];
/** 모범 응대 한 번. */
const good = (): Command[] => [setVar(V_SERVICE, "+=", 1)];
const wrong = (): Command => playSe(SE_WRONG);
/** 마왕다운 선택 한 번 — 근무 평가와 따로 쌓인다. */
const mp = (): Command[] => [setVar(V_MAOU, "+=", 1)];
/** 하루 끝의 근무 평가 메모(점장 손글씨). 근무 평가·마왕력을 각각 세 단계로 보여 준다. */
function review(day: string, serviceHi: number, serviceMid: number, maouHi: number, maouMid: number): Command[] {
  const svc = [
    { at: serviceHi, line: "손님 응대  ★★★  「매뉴얼 그대로. 완벽합니다.」" },
    { at: serviceMid, line: "손님 응대  ★★☆  「무난해요. 조금만 더 힘내요.」" },
    { at: 0, line: "손님 응대  ★☆☆  「내일은 매뉴얼부터 읽고 와요.」" },
  ];
  const mao = [
    { at: maouHi, line: "마왕력  ☠☠☠  「「그 이상한 신입」을 보러 오는 손님이 생겼어요…?」" },
    { at: maouMid, line: "마왕력  ☠☠☆  「손님들이 마오 군 말투를 따라 해요.」" },
    { at: 0, line: "마왕력  ☠☆☆  「아직은 평범한 신입.」" },
  ];
  const ladder = <T extends { at: number; line: string }>(rows: T[], v: string, leaf: (row: T) => Command[]): Command[] =>
    rows.reduceRight<Command[]>((rest, row, i) => (i === rows.length - 1 ? leaf(row) : [ifCond(varAtLeast(v, row.at), leaf(row), rest)]), []);
  return [
    playSe(SE_PAPER),
    ...ladder(svc, V_SERVICE, (a) => ladder(mao, V_MAOU, (b) => note(`「${day} 근무 평가」  점장 사토미`, a.line, b.line))),
  ];
}

// ── 데이터베이스: 배우·직업·기술·적 ──
function setupDatabase(project: Project): void {
  const db = project.database;
  const skills = db.skills;
  const cloneSkill = (fromId: string, id: string, patch: Record<string, unknown>): void => {
    const base = skills.find((s) => s.id === fromId);
    if (!base) throw new Error(`[maou-konbini] 기술 견본 ${fromId} 이 없다`);
    const next = { ...clone(base), ...patch, id } as typeof base;
    const at = skills.findIndex((s) => s.id === id);
    if (at >= 0) skills[at] = next; else skills.push(next);
  };
  const noMp = { flat: 0, percentMax: 0 };
  // 마왕(본모습) 기술
  cloneSkill("skill_dark", "skill_mk_dark_wave", { name: "암흑 파동", power: 95, mpCost: { flat: 6, percentMax: 0 }, description: "마계의 어둠을 파도처럼 밀어 보낸다." });
  cloneSkill("skill_fire", "skill_mk_hellfire", { name: "지옥의 업화", power: 130, mpCost: { flat: 14, percentMax: 0 }, description: "모든 것을 태우는 마왕의 불꽃. 도시락 데우기에는 쓰지 말 것." });
  cloneSkill("skill_weaken", "skill_mk_half_world", { name: "세계의 절반 제안", mpCost: noMp, successRate: 30, description: "세계의 절반을 줄 테니 손을 잡자고 꼬드긴다. 대개 거절당한다." });
  // 알바생 마오 기술(매뉴얼)
  // 매뉴얼 기술은 마음(mind)으로 친다 — 용사의 「마음」 방어는 약하고 몸(방어)은 단단하다. 봉투 휘두르기(공격) 연타로는 거의 못 이기고,
  // 매뉴얼 넷을 아무렇게나 섞어도 이긴다(헤드리스 40판: 연타 15% · 매뉴얼 아무렇게나 100%, tmp-maou/battle-sim.mts).
  const hearty = { effect: { kind: "damage", statistic: "mind", affects: "hp" }, elementId: "holy", variance: 10 };
  cloneSkill("skill_weaken", "skill_mk_irasshai", { ...hearty, name: "이랏샤이마세!", power: 70, mpCost: noMp, successRate: 100, description: "가게 안을 울리는 우렁찬 인사. 상대의 기세를 꺾는다(공격 하락).",
    stateEffects: [{ stateId: "state_attack_down", chance: 100, operation: "add" }] });
  cloneSkill("skill_sleep_mist", "skill_mk_point_card", { ...hearty, name: "포인트 카드 있으세요?", power: 40, mpCost: { flat: 3, percentMax: 0 }, successRate: 85, description: "들은 사람은 일단 지갑부터 뒤진다. 상대가 멈칫한다(잠듦)." });
  cloneSkill("skill_holy", "skill_mk_nikuman", { name: "따끈한 고기만두", power: 120, mpCost: { flat: 8, percentMax: 0 }, description: "갓 쪄낸 고기만두를 건넨다. 화난 손님도 일단 받아 든다." });
  cloneSkill("skill_heal", "skill_mk_smile", { name: "0엔 스마일", power: 60, mpCost: { flat: 5, percentMax: 0 }, scope: "self", description: "매뉴얼 제3조. 손님께는 언제나 미소로. 자신을 다잡는다." });
  // 용사 레온(적) 기술
  cloneSkill("skill_sword_slash", "skill_mk_holy_blade", { name: "성검 일섬", power: 85, mpCost: noMp, description: "용사의 검이 빛을 끌며 내려친다." });
  cloneSkill("skill_sword_slash", "skill_mk_umbrella", { name: "비닐우산 찌르기", power: 70, mpCost: noMp, description: "성검 대신 편의점 비닐우산(500엔)." });
  cloneSkill("skill_holy", "skill_mk_brave_shout", { name: "용사의 외침", power: 90, mpCost: noMp, description: "「너만은 용서 못 해!」 정의감이 빛이 되어 날아온다." });

  const actors = db.actors;
  const hero = actors.find((a) => a.id === DEFAULT_ACTOR_ID) ?? actors[0]!;
  const darkKnight = actors.find((a) => a.id === "actor_dark_knight") ?? hero;
  const heroClass = db.classes.find((c) => c.id === hero.classId) ?? db.classes[0]!;
  const makeClass = (id: string, name: string, skillIds: string[]): void => {
    const cls = { ...clone(heroClass), id, name, skillIds: ["skill_attack", ...skillIds], learnedSkills: [{ level: 1, skillId: "skill_attack" }, ...skillIds.map((skillId) => ({ level: 1, skillId }))] } as typeof heroClass;
    cls.battleCommands = (cls.battleCommands ?? []).filter((c) => c.kind !== "escape" && c.kind !== "switch");
    const at = db.classes.findIndex((c) => c.id === id);
    if (at >= 0) db.classes[at] = cls; else db.classes.push(cls);
  };
  makeClass(CLASS_CLERK, "알바생", ["skill_mk_irasshai", "skill_mk_point_card", "skill_mk_nikuman", "skill_mk_smile"]);
  makeClass(CLASS_MAOU, "마왕", ["skill_mk_dark_wave", "skill_mk_hellfire", "skill_mk_half_world"]);
  const attackName = (classId: string, name: string): void => {
    const cls = db.classes.find((c) => c.id === classId);
    const atk = cls?.battleCommands?.find((c) => c.kind === "attack");
    if (atk) atk.name = name;
  };
  attackName(CLASS_CLERK, "봉투 휘두르기");

  // 주인공 = 현대의 마오. 전투 시트는 검은 머리 마도사(같은 사람의 본성).
  hero.name = "마오";
  hero.nickname = "전 마왕, 현 신입 알바";
  hero.classId = CLASS_CLERK;
  hero.characterResourceId = CAST.maou.resource;
  hero.characterIndex = CAST.maou.index;
  hero.battleCharacterResourceId = "charset-battler-actor3-1";
  hero.initialLevel = 12;
  hero.learnedSkills = [];
  const face = reviewedFaceIdForCharset(CAST.maou.tex, CAST.maou.index);
  if (face) hero.faceResourceId = face; else delete hero.faceResourceId;

  const maou = { ...clone(darkKnight), id: MAOU_TRUE, name: "마왕 제르바스", nickname: "암흑 마왕", classId: CLASS_MAOU,
    characterResourceId: CAST.maouF.resource, characterIndex: CAST.maouF.index, faceResourceId: CAST.maouF.face,
    battleCharacterResourceId: "charset-battler-people2-1", initialLevel: 40, learnedSkills: [] } as Actor;
  const at = actors.findIndex((a) => a.id === MAOU_TRUE);
  if (at >= 0) actors[at] = maou; else actors.push(maou);

  // 새 게임 파티 = 마왕성의 마왕 혼자. 전생한 뒤 changeParty 로 마오와 바꾼다.
  project.system.startActorIds = [MAOU_TRUE];
  project.session.partyActorIds = [MAOU_TRUE];
  project.system.battleLook = { ...project.system.battleLook, enemyHp: true, enemyNames: true };
  // 전투 배경 = 지금 서 있는 맵(옥좌의 방·편의점). 「가게에서 싸우면 안 돼」가 화면으로 보인다.
  project.system.battleBackdrop = "field";

  // 적
  const enemies = db.enemies;
  const template = enemies.find((e) => e.id === "enemy_slime") ?? enemies[0]!;
  const act = (skillId: string, priority: number, condition: Enemy["actions"][number]["condition"] = { kind: "always" }) =>
    ({ skillId, priority, condition, switchOnAfterAction: { enabled: false }, switchOffAfterAction: { enabled: false } });
  const makeEnemy = (id: string, name: string, stats: Enemy["stats"], actions: Enemy["actions"], level: number): void => {
    const enemy = { ...clone(template), id, name, monsterResourceId: "charset-battler-actor1-0", stats, actions, level, battleScalePercent: 125,
      skillIds: actions.map((a) => a.skillId) } as Enemy;
    enemy.rewards = { ...enemy.rewards, exp: 0, gold: 0 };
    const i = enemies.findIndex((e) => e.id === id);
    if (i >= 0) enemies[i] = enemy; else enemies.push(enemy);
  };
  makeEnemy("enemy_mk_leon_castle", "용사 레온", { maxHp: 900, maxMp: 60, attack: 120, defense: 70, mind: 80, agility: 60 },
    [act("skill_mk_holy_blade", 8), act("skill_attack", 6), act("skill_mk_brave_shout", 9, { kind: "turn", start: 2, interval: 3 })], 38);
  makeEnemy("enemy_mk_leon_awake", "각성한 용사 레온", { maxHp: 1100, maxMp: 60, attack: 125, defense: 70, mind: 85, agility: 62 },
    [act("skill_mk_holy_blade", 8), act("skill_attack", 6), act("skill_mk_brave_shout", 9, { kind: "turn", start: 2, interval: 2 })], 39);
  makeEnemy("enemy_mk_leon_angry", "분노한 고교생 레온", { maxHp: 400, maxMp: 0, attack: 52, defense: 115, mind: 20, agility: 40 },
    [act("skill_mk_umbrella", 8), act("skill_attack", 6), act("skill_mk_brave_shout", 9, { kind: "turn", start: 3, interval: 3 })], 12);

  const makeTroop = (id: string, name: string, enemyId: string, background: string, layers: Troop["backdropLayers"]): void => {
    const troop = { id, name, enemyIds: [enemyId], members: [{ enemyId, x: 88, y: 96, hidden: false }], autoAlign: true, uncapturable: false,
      previewBackgroundResourceId: background, backdropLayers: layers, battleEventPages: [] } as unknown as Troop;
    const i = db.troops.findIndex((t) => t.id === id);
    if (i >= 0) db.troops[i] = troop; else db.troops.push(troop);
  };
  makeTroop("troop_mk_castle", "옥좌의 결전", "enemy_mk_leon_castle", "battle-scenery-cave",
    [{ preset: "glow", opacity: 70 }, { preset: "embers", opacity: 60 }]);
  makeTroop("troop_mk_power", "편의점의 결전 · 마왕 재림", "enemy_mk_leon_awake", "battle-scenery-cave",
    [{ preset: "glow", opacity: 60 }, { preset: "lightRays", opacity: 40 }, { preset: "embers", opacity: 50 }]);
  makeTroop("troop_mk_manual", "편의점의 결전 · 알바 매뉴얼", "enemy_mk_leon_angry", "battle-scenery-plains",
    [{ preset: "glow", opacity: 25 }]);
}

// ── 맵 짓기 ──
interface Links { konbini: { entry: Cell; exit: Cell; street: Cell }; room: { entry: Cell; exit: Cell; street: Cell } }

function buildMaps(project: Project): Links {
  project.tilesets[JP_CITY_ID] = createJpCityTileset();
  const jpMap = (id: string, name: string, w: number, h: number): void => {
    const m = createStarterMap();
    m.id = id; m.name = name; m.tilesetId = JP_CITY_ID; m.width = w; m.height = h;
    m.lowerTiles = new Array(w * h).fill(blankFillTileFor(JP_CITY_ID));
    m.upperTiles = new Array(w * h).fill(-1);
    project.maps[id] = m;
  };
  jpMap(M.street, "사쿠라자카 상점가", 40, 28);
  execTool(project, "compose_jp_city_street", { mapId: M.street, style: "shopping", seed: 3, shops: ["konbini", "apartment", "cafe", "izakaya"], replace: true });
  jpMap(M.park, "사쿠라자카 공원", 40, 28);
  execTool(project, "compose_jp_city_street", { mapId: M.park, region: "neighborhood_park", seed: 2, replace: true });
  jpMap(M.shrine, "언덕 위 신사", 40, 28);
  execTool(project, "compose_jp_city_street", { mapId: M.shrine, region: "torii_shrine_precinct", seed: 2, replace: true });
  execTool(project, "build_hand_interior_room", { mapId: M.konbini, name: "해피 마트 사쿠라자카점", tileset: "modern_city", replace: true, layout: { program: "mc_konbini_jp", seed: 1, furnish: true } });
  execTool(project, "build_hand_interior_room", { mapId: M.room, name: "마오의 원룸", tileset: "modern_city", replace: true, layout: { program: "mc_apartment", seed: 1, furnish: true } });
  execTool(project, "build_hand_interior_room", { mapId: M.throne, name: "마왕성 옥좌의 방", tileset: "atlas_biome_interior", replace: true, layout: { program: "throne", seed: 1, furnish: true } });

  // 거리 지붕·남쪽 강둑 너머는 걸어 들어가면 안 된다 — 지붕 윗면은 위층 타일이라 땅 위로 걸어 다닐 수 있었다(탐침 2026-10-29).
  // jp_city 의 투명 통행 불가 칸(851)을 맨 위 겹층(4층)에 깔아 막는다 — 통행은 위층부터 정하므로 아래 겹층은 지붕의 O 에 졌다. 세로 큰길과 다리(29~33열)는 남긴다.
  const BLOCK = 851;
  const W = project.maps[M.street]!.width;
  for (const [x1, y1, x2, y2] of [[0, 0, 28, 7], [34, 0, W - 1, 7], [0, 15, 28, 22], [34, 15, W - 1, 22]] as const) {
    execTool(project, "paint_tiles", { mapId: M.street, layer: "4", mode: "rect", tile: BLOCK, from: { x: x1, y: y1 }, to: { x: x2, y: y2 } });
  }
  // 도구는 맵 객체를 새로 만든다 — 칠한 뒤에 다시 읽는다.
  const street = project.maps[M.street]!;
  for (const c of [{ x: 2, y: 9 }, { x: 13, y: 9 }, { x: 26, y: 9 }, { x: 31, y: 1 }, { x: 31, y: 26 }, { x: 20, y: 26 }]) mustWalk(project, street, c, "거리 길");
  for (const c of [{ x: 5, y: 3 }, { x: 15, y: 5 }, { x: 10, y: 20 }]) mustBlock(project, street, c, "지붕·강둑");

  const link = (door: Cell, mapId: string) => {
    const res = execTool(project, "link_jp_city_interior", { mapId: M.street, door, interiorMapId: mapId, replace: true });
    const data = res.data as { entryLanding: Cell; exitCells: Cell[]; exitLanding: Cell };
    return { entry: data.entryLanding, exit: data.exitCells[0]!, street: data.exitLanding };
  };
  const doorAt = (kind: string): Cell => {
    const loc = (street.locations ?? []).find((l) => (l.tags ?? []).includes("jp-building") && (l.tags ?? []).includes(kind) && !(l.note ?? "").includes("닿지 않음"));
    const m = loc ? /문 \((\d+),(\d+)\)/u.exec(loc.note ?? "") : null;
    if (!m) throw new Error(`[maou-konbini] 거리에 ${kind} 문이 없다 — compose_jp_city_street 결과가 바뀌었다`);
    return { x: Number(m[1]), y: Number(m[2]) };
  };
  const links: Links = { konbini: link(doorAt("konbini"), M.konbini), room: link(doorAt("apartment"), M.room) };
  for (const id of Object.keys(project.maps)) if (!(Object.values(M) as string[]).includes(id)) delete project.maps[id];
  return links;
}

// ── 0) 마왕성 옥좌의 방 · 오프닝 · 타이틀 → maouKonbiniOpening.ts ──

// ── 1) 원룸 ──
function buildRoom(project: Project, _links: Links, konbiniArrive: Cell): Cell {
  const map = project.maps[M.room]!;
  const wake = mustWalk(project, map, { x: 3, y: 5 }, "침대 옆");
  const flyerAt = mustWalk(project, map, { x: 11, y: 10 }, "현관 앞");

  const Z = (...l: string[]) => thinkAs(CAST.zervas.name, ...l);
  const zs = (expr: "base" | "happy" | "surprised" | "sad" | "embarrassed", ...l: string[]) => say("zervas", expr, ...l);
  const wakeScene: Command[] = [
    wait(600),
    ...fadeIn(1400),
    ...Z("……."),
    ...Z("…낯선 천장이다."),
    emote("player", "question", 1200),
    ...zs("surprised", "여기는… 어디지? 소파, 작은 부엌, 낮은 천장. 평민의 집인가."),
    walk("@player", ["right", "right"]),
    face("@player", "up"),
    ...zs("surprised", "잠깐. 이 손, 이 다리. …뿔이 없다! 망토도! 어째서 이 몸이 올리브색 재킷 따위를!"),
    shake(300),
    ...caption("탁자 위에 통장 한 권과 봉투 하나가 놓여 있다."),
    walkTo("@player", { x: 11, y: 6 }), face("@player", "right"),
    playSe(SE_PAPER),
    ...note("「이세계 전생 관리국 안내문」", "귀하는 『동귀어진』 처리에 따라 일본에 전생되었습니다. 마력은 봉인되었습니다.", "생활비는 스스로 버십시오.  ※ 이 안내문은 읽은 뒤 분리수거해 주십시오."),
    ...zs("embarrassed", "…분리수거가 뭐냐."),
    playSe(SE_PAPER),
    ...note("통장 잔고", "0엔"),
    shake(500, "3"),
    ...zs("sad", "0. 마계 금화로 환산하면… 역시 0이다."),
    ...zs("sad", "세계의 절반을 가졌던 이 몸이, 잔고 0."),
    ...zs("base", "…좋다. 이 몸은 마왕이다. 어느 세계든 꼭대기에 서면 그만이다."),
    ...zs("happy", "우선은… 돈이다."),
    playSe(SE_PAPER),
    ...caption("현관 쪽에서 종이가 바스락거렸다. 문틈으로 전단지가 들어와 있다."),
    setSw("sw_mk_woke"),
  ];
  const flyer: Command[] = [
    playSe(SE_PAPER),
    ...note("【아르바이트 급구】  해피 마트 사쿠라자카점", "시급 1,150엔 · 초보 환영 · 유니폼 지급 · 폐기 도시락 있음(?)", "이 건물 바로 왼쪽입니다!"),
    ...zs("surprised", "폐기 도시락…? 무슨 뜻인지는 모르겠으나, 매혹적인 울림이다."),
    ...zs("happy", "좋다. 이 몸이 직접 가 주마. 감격하며 맞이하도록 해라."),
    setVar(V_STAGE, "=", 2),
  ];
  map.events.push(event("ev_mk_room_wake", "눈뜸", { x: 0, y: 0 }, [
    gone("ev_mk_room_wake_off", []),
    page("ev_mk_room_wake_p", [varIs(V_STAGE, 1), swOff("sw_mk_woke")], wakeScene, { trigger: "auto" }),
  ]));
  map.events.push(event("ev_mk_room_flyer", "전단지", flyerAt, [
    gone("ev_mk_room_flyer_off", []),
    page("ev_mk_room_flyer_p", [varIs(V_STAGE, 1)], flyer, { trigger: "playerTouch" }),
  ]));
  // 전단지 그림이 칩셋에 없다 — 문틈의 전단지 자리 위에 「!」 말풍선을 되풀이해 띄워 줍는 곳을 보인다.
  map.events.push(event("ev_mk_room_flyer_cue", "전단지 표시", { x: 1, y: 0 }, [
    gone("ev_mk_room_flyer_cue_off", []),
    page("ev_mk_room_flyer_cue_p", [varIs(V_STAGE, 1), swOn("sw_mk_woke")], [emote("ev_mk_room_flyer", "exclamation", 1100), wait(1500)], { trigger: "parallel" }),
  ]));
  // 침대 — 하루를 마치는 곳.
  const sleep = (next: number, day: string, extra: Command[]): Command[] => [
    ...think("…오늘도 살아남았다. 마왕은 내일을 위해 잔다."),
    ...fadeOut(900), stopBgm(), wait(700),
    setVar(V_STAGE, "=", next), setVar(V_TASKS, "=", 0),
    ...caption(day),
    ...extra,
    transfer(M.konbini, konbiniArrive, "up"),
  ];
  const bedPages = [
    page("ev_mk_bed_p0", [], [...think("…아직 잘 때가 아니다. 마왕은 낮잠 따위 자지 않는다.")], { priority: "same" }),
    page("ev_mk_bed_p4", [varIs(V_STAGE, 4)], sleep(5, "둘째 날 아침.", []), { priority: "same" }),
    page("ev_mk_bed_p6", [varIs(V_STAGE, 6)], [...think("리리가 공원에서 기다린다. 부하의 회의를 바람맞힐 수야 없지. 공원은 거리 남쪽 큰길 끝이다.")], { priority: "same" }),
    page("ev_mk_bed_p6m", [varIs(V_STAGE, 6), swOn(SW_MEETING)], sleep(7, "사흘째. 오늘은 야간 근무다.", []), { priority: "same" }),
  ];
  for (const x of [2, 3]) map.events.push(event(`ev_mk_bed_${x}`, "침대", mustBlock(project, map, { x, y: 4 }, "침대"), bedPages.map((p) => ({ ...p, id: `${p.id}_${x}` }))));
  map.events.push(event("ev_mk_fridge", "냉장고", mustBlock(project, map, { x: 11, y: 3 }, "냉장고"), [
    page("ev_mk_fridge_p", [], [...caption("냉장고를 열었다. 마요네즈 하나와 차가운 공기뿐이다."), ...think("…마요네즈. 한번 맛들이면 못 끊는다고 들었다. 아껴 두자.")], { priority: "same" }),
    page("ev_mk_fridge_p2", [varAtLeast(V_STAGE, 4)], [...caption("폐기 도시락이 하나 들어 있다. 히나 선배가 몰래 챙겨 주었다."), ...think("…선배. 이 은혜, 세계를 되찾으면 반드시 갚겠다.")], { priority: "same" }),
  ]));
  map.events.push(event("ev_mk_pc", "책상", mustBlock(project, map, { x: 1, y: 10 }, "책상"), [
    page("ev_mk_pc_p", [], [...caption("낡은 노트북. 검색창에 「암흑 마왕 제르바스」를 쳐 본다."), ...note("검색 결과 0건", "혹시 「제르바스 고양이 사료」를 찾으셨나요?"), ...think("…이 세계에서 나는 무명이다.")], { priority: "same" }),
  ]));
  map.defaultLighting = { ambient: 0.08, color: "#fff0d6", sources: [] };
  map.bgm = { mode: "custom", resourceId: BGM_ROOM } as GameMap["bgm"];
  return wake;
}

// ── 2~3·5·7) 편의점 ──
function buildKonbini(project: Project, links: Links): Cell {
  // 가게는 화면보다 낮아서(16줄) 카메라가 가운데에 고정되고, 흉상 대화창이 계산대·손님 줄(11~14줄)을 덮었다(실플레이 2026-10-29).
  // 아래로 일곱 줄을 늘려 가게 앞 보도·연석·차도를 깔면(검은 빈칸 대신 바깥 거리) 카메라가 계산대를 화면 위쪽으로 올릴 수 있다.
  // 바깥 칸은 맨 위 겹층(4층)의 투명 막힘 칸(0)으로 막는다 — 자동문으로만 나간다.
  {
    const old = project.maps[M.konbini]!;
    const oldH = old.height, W = old.width;
    execTool(project, "resize_map", { mapId: M.konbini, width: W, height: oldH + 7 });
    const paint = (layer: number, tile: number, from: Cell, to: Cell) => execTool(project, "paint_tiles", { mapId: M.konbini, layer: String(layer), mode: "rect", tile, from, to });
    const SIDEWALK = 7, CURB_ROAD_SOUTH = 9, ASPHALT = 1;
    paint(1, SIDEWALK, { x: 0, y: oldH }, { x: W - 1, y: oldH + 2 });
    paint(1, CURB_ROAD_SOUTH, { x: 0, y: oldH + 3 }, { x: W - 1, y: oldH + 3 });
    paint(1, ASPHALT, { x: 0, y: oldH + 4 }, { x: W - 1, y: oldH + 6 });
    // 백룸 아래 동쪽 바깥(남색 빈칸)도 보도로.
    paint(1, SIDEWALK, { x: 17, y: 12 }, { x: W - 1, y: oldH - 1 });
    paint(4, 0, { x: 0, y: oldH }, { x: W - 1, y: oldH + 6 });
    paint(4, 0, { x: 17, y: 12 }, { x: W - 1, y: oldH - 1 });
    const m = project.maps[M.konbini]!;
    for (let x = 0; x < W; x++) for (const y of [oldH, oldH + 6]) mustBlock(project, m, { x, y }, "가게 앞 바깥 길");
    mustBlock(project, m, { x: 19, y: 13 }, "백룸 아래 바깥");
  }
  const map = project.maps[M.konbini]!;
  const door = links.konbini.exit; // 자동문 칸
  const arrive = links.konbini.entry;
  // 계산대 이벤트는 카운터 칸 위에 둔다 — 그림 없는 이벤트는 「같은 층」이어도 막지 않아서, 빈 칸에 두면 플레이어가 올라서고
  // 정면 조사가 카운터 너머 손님에게 넘어갔다(실플레이 2026-10-29).
  const REG = mustBlock(project, map, { x: 12, y: 12 }, "계산대");
  const CLERK = mustWalk(project, map, { x: 12, y: 11 }, "점원 자리");
  const Q1 = mustWalk(project, map, { x: 12, y: 13 }, "손님 줄 1");
  const Q2 = mustWalk(project, map, { x: 12, y: 14 }, "손님 줄 2");
  const Q3 = mustWalk(project, map, { x: 11, y: 14 }, "손님 줄 3");
  const HINA = mustWalk(project, map, { x: 14, y: 10 }, "히나 자리");
  const BACK = mustWalk(project, map, { x: 19, y: 7 }, "백룸");
  const BOX = mustWalk(project, map, { x: 8, y: 7 }, "통로(상자)");
  const TRASH = mustWalk(project, map, { x: 6, y: 13 }, "분리수거함 윗칸");
  const PC = mustBlock(project, map, { x: 17, y: 9 }, "발주 단말");
  const SNACK = mustBlock(project, map, { x: 10, y: 7 }, "핫스낵 케이스");
  const WASTE = mustBlock(project, map, { x: 19, y: 6 }, "백룸 선반");
  const GATE = mustWalk(project, map, { x: door.x, y: door.y - 1 }, "자동문 앞");

  // 택배 상자 — 통로에 위층 상자 그림(백룸 상자 두 칸)을 찍어 두고, 진열하면 changeTile 로 지운다.
  const BOX_TOP = 10686, BOX_BOTTOM = 10687;
  const boxTiles = (on: boolean): Command[] => [
    { kind: "changeTile", mapId: M.konbini, layer: "upper", x: BOX.x, y: BOX.y - 1, tile: on ? BOX_TOP : -1 } as Command,
    { kind: "changeTile", mapId: M.konbini, layer: "upper", x: BOX.x, y: BOX.y, tile: on ? BOX_BOTTOM : -1 } as Command,
  ];
  map.upperTiles[(BOX.y - 1) * map.width + BOX.x] = BOX_TOP;
  map.upperTiles[BOX.y * map.width + BOX.x] = BOX_BOTTOM;

  const ev = (e: ReturnType<typeof event>) => { map.events.push(e); return e.id; };
  const clerkPos: Command[] = [walkTo("@player", CLERK), face("@player", "down")];

  // ── 면접(stage 2) ──
  const MGR_F = "ev_mk_mgr_front", MGR_B = "ev_mk_mgr_back", HINA_ID = "ev_mk_hina";
  const zs = (expr: "base" | "happy" | "surprised" | "sad" | "embarrassed", ...l: string[]) => say("zervas", expr, ...l);
  const interview: Command[] = [
    playSe(SE_CHIME),
    ...say("manager", "happy", "어서 오세요… 해피 마트입니다. …아, 그 전단지. 면접 보러 오셨죠?"),
    ...zs("base", "그렇소. 이 몸이 친히 왔소. 영광으로 아시오."),
    ...say("manager", "surprised", "(자신감이 대단하네…) 네, 네. 이쪽으로 오세요."),
    walkTo("@player", Q1), face("@player", "up"),
    ...say("manager", "base", "이력서는 가져오셨어요?"),
    ...zs("surprised", "…이력서?"),
    ...caption("제르바스는 품에서 종이 한 장을 꺼냈다. 관리국 안내문 뒷면에 밤새 쓴 이력서다."),
    playSe(SE_PAPER),
    ...say("manager", "base", "어디 보자. 이름, 암흑 마왕 제르바스. …외국 분이세요?"),
    ...zs("base", "마계 출신이오."),
    ...say("manager", "happy", "아, 마계. 시골이구나… 공기 좋겠다."),
    ...say("manager", "base", "경력… 「마왕군 총사령관 999년, 세계의 절반 정복」."),
    ...say("manager", "happy", "「관리직 경험 있음」이라고 적을게요."),
    ...say("manager", "surprised", "특기는… 「세계 정복(절반)」? 정복은 좀 곤란한데요. 다른 건요?"),
    choices([
      { text: "인간을 공포로 지배할 줄 아오", then: [...say("manager", "happy", "까다로운 손님 응대 가능… 그거 정말 귀해요."), ...mp()] },
      { text: "밤을 새워도 멀쩡하오", then: [...say("manager", "happy", "야간 가능… 살았다. 요즘 야간 할 사람이 없거든요.")] },
      { text: "…성실하게 일하겠소", then: [...say("manager", "happy", "…그게 제일 중요해요. 고마워요."), ...good()] },
    ]),
    ...say("manager", "base", "마지막으로, 지원 동기는요?"),
    choices([
      { text: "세계를 다시 손에 넣기 위함이오", then: [...say("manager", "happy", "꿈이 크시군요. 일단 이 가게 계산대부터 손에 넣어 봐요."), ...mp()] },
      { text: "통장 잔고가 0엔이오", then: [...say("manager", "sad", "…솔직해서 좋아요. 저도 월말엔 그래요."), ...good()] },
      { text: "여기 고기만두가 맛있어 보였소", then: [...say("manager", "happy", "안목 있으시네. 그거 제가 직접 발주해요.")] },
    ]),
    ...say("manager", "happy", "네, 합격. 오늘부터 바로 일해 주세요."),
    ...say("manager", "base", "그리고 이름. 제르바스는 명찰에 안 들어가서… 마오 군이라고 부를게요."),
    ...zs("surprised", "마오…? 감히 이 몸의 존함을 멋대로 줄이다니…!"),
    ...say("manager", "happy", "명찰 벌써 뽑았어요."),
    ...caption("명찰에는 큼직하게 「마오」라고 적혀 있다."),
    ...say("maou", "embarrassed", "……마오라 하오. 잘 부탁하오."),
    faceHero(HINA_ID),
    ...say("hina", "happy", "점장님, 신입이에요? …말투 뭐야. 연극부?"),
    ...say("maou", "base", "품격이라 하오."),
    ...say("hina", "happy", "설정 세네. 나 히나. 대학생, 여기 2년 차. 모르는 거 있음 물어봐."),
    ...say("maou", "base", "히나라 했나. 좋네. 자네를 이 몸의 첫 번째 부하로 임명하…"),
    ...say("hina", "base", "선배라고 불러."),
    ...say("maou", "embarrassed", "…히나 선배."),
    ...say("manager", "base", "자, 마오 군. 오늘 할 일은 계산대, 진열, 분리수거. 부탁해요."),
    ...say("manager", "happy", "막히면 히나한테 물어보세요. 전 백룸에서 서류랑 싸울게요…"),
    ...caption("편의점 매뉴얼 제1조. 「손님이 오시면 큰 소리로 인사한다.」"),
    ...say("maou", "base", "…짧군. 마왕군 군율은 서른 장이었는데. 좋소, 외웠소."),
    // 맵 이벤트는 「장소 이동」에서 끝난다 — 이동은 맨 끝에 두고(이동 자체가 암전한다), 근무 시작 자막은 근무 시작 자동 장면이 잇는다.
    setVar(V_STAGE, "=", 3), setVar(V_TASKS, "=", 0), setSw(SW_SHIFT),
    transfer(M.konbini, CLERK, "down"),
  ];
  ev(event("ev_mk_ctrl_interview", "면접", { x: 0, y: 0 }, [
    gone("ev_mk_ctrl_interview_off", []),
    page("ev_mk_ctrl_interview_p", [varIs(V_STAGE, 2)], interview, { trigger: "auto" }),
  ]));

  // ── 점장(앞: 면접·퇴근 뒤 / 뒤: 근무 중 백룸) ──
  ev(event(MGR_F, "사토미 점장", CLERK, [
    gone(`${MGR_F}_off`, []),
    page(`${MGR_F}_p2`, [varIs(V_STAGE, 2)], [], { who: "manager" }),
    page(`${MGR_F}_p4`, [varIs(V_STAGE, 4)], [faceHero(MGR_F), ...say("manager", "happy", "어라, 마오 군? 퇴근했잖아요. 푹 쉬고 내일 봐요.")], { who: "manager" }),
    page(`${MGR_F}_p6`, [varIs(V_STAGE, 6)], [faceHero(MGR_F), ...say("manager", "base", "내일은 야간이죠? 히나랑 둘이서 부탁해요. 밤에는 가끔… 이상한 손님이 와요.")], { who: "manager" }),
  ]));
  const progress: Command[] = [
    ifCond(varIs(V_TASKS, 0), [...say("manager", "base", "아직 시작 전이군요. 계산대부터 가 봐요.")]),
    ifCond(varIs(V_TASKS, 1), [...say("manager", "happy", "하나 끝냈어요? 나머지도 천천히.")]),
    ifCond(varIs(V_TASKS, 2), [...say("manager", "happy", "거의 다 왔어요. 하나만 더.")]),
  ];
  ev(event(MGR_B, "사토미 점장", BACK, [
    gone(`${MGR_B}_off`, []),
    page(`${MGR_B}_p3`, [varIs(V_STAGE, 3)], [faceHero(MGR_B), ...say("manager", "base", "오늘은 계산대, 상자 진열, 분리수거. 모르는 건 히나한테 물어요."), ...progress], { who: "manager" }),
    page(`${MGR_B}_p5`, [varIs(V_STAGE, 5)], [faceHero(MGR_B), ...say("manager", "base", "오늘은 계산대, 핫스낵, 발주. 발주 단말은 제 옆 책상."), ...progress], { who: "manager" }),
  ]));

  // ── 히나 ──
  const hinaTalk = (stage: number): Command[] => {
    const lines: Record<number, Command[]> = {
      2: [],
      3: [...say("hina", "happy", "손님 오면 계산대 앞에서 말 걸어. 「데워 드릴까요?」 그런 거."), ...say("hina", "base", "상자는 통로, 분리수거함은 입구 옆. 끝.")],
      5: [...say("hina", "base", "아침엔 다나카 씨 와. 단골. 말은 없는데 착해."), ...say("hina", "happy", "핫스낵은 오늘 네가 해. 가라아게 레드. 우리 가게 간판.")],
      7: [...say("hina", "base", "야간은 조용해서 좋아. …가끔 이상한 사람 오는 거 빼면."), ...say("hina", "happy", "택배 또 왔어. 잡지. 백룸 폐기 정리도.")],
    };
    return [faceHero(HINA_ID), ...(lines[stage] ?? [])];
  };
  ev(event(HINA_ID, "히나", HINA, [
    gone(`${HINA_ID}_off`, []),
    page(`${HINA_ID}_p2`, [varIs(V_STAGE, 2)], [], { who: "hina", dir: "left" }),
    page(`${HINA_ID}_p3`, [varIs(V_STAGE, 3)], hinaTalk(3), { who: "hina", dir: "left" }),
    page(`${HINA_ID}_p5`, [varIs(V_STAGE, 5)], hinaTalk(5), { who: "hina", dir: "left" }),
    page(`${HINA_ID}_p7`, [varIs(V_STAGE, 7)], hinaTalk(7), { who: "hina", dir: "left" }),
  ]));

  // ── 손님(하루마다 줄) ──
  type Cust = { id: string; who: Who; at: Cell; stage: number };
  const custs: Cust[] = [
    { id: "ev_mk_c1a", who: "ol", at: Q1, stage: 3 }, { id: "ev_mk_c1b", who: "student", at: Q2, stage: 3 }, { id: "ev_mk_c1c", who: "teen", at: Q3, stage: 3 },
    { id: "ev_mk_c2a", who: "tanaka", at: Q1, stage: 5 }, { id: "ev_mk_c2b", who: "leon", at: Q2, stage: 5 },
    { id: "ev_mk_c3a", who: "drunk", at: Q1, stage: 7 }, { id: "ev_mk_c3b", who: "tanaka", at: Q2, stage: 7 },
  ];
  for (const c of custs) {
    ev(event(c.id, CAST[c.who].name, c.at, [
      gone(`${c.id}_off`, []),
      page(`${c.id}_on`, [varIs(V_STAGE, c.stage)], [faceHero(c.id), ...say(c.who, "base", c.who === "tanaka" ? "……(꾸벅)" : "계산 부탁해요~")], { who: c.who, dir: c.at === Q3 ? "right" : "up" }),
      gone(`${c.id}_gone`, [varIs(V_STAGE, c.stage), swOn(`sw_${c.id}_out`)]),
    ]));
  }
  const next = (outId: string, inId?: string): Command[] => [
    exitVia(outId, door, false), wait(500), setSw(`sw_${outId}_out`),
    ...(inId ? [walkTo(inId, Q1), face(inId, "up")] : []),
  ];

  // 첫째 날 계산대
  const reg1: Command[] = [
    ...clerkPos,
    ...say("ol", "base", "이 도시락이랑 녹차요."),
    playSe(SE_BEEP), wait(200), playSe(SE_BEEP),
    ...think("(바코드라는 마법진에 빛을 쏘면 값이 나온다. 이 세계의 마법은 편리하군.)"),
    choices([
      { text: "「데워 드릴까요?」", then: [...say("ol", "happy", "네, 부탁해요."), ...good()] },
      { text: "「차갑게 드시오. 그것이 수행이오」", then: [wrong(), ...say("ol", "surprised", "…네?"), ...say("hina", "surprised", "마오. 「데워 드릴까요?」부터."), ...say("maou", "embarrassed", "…데워 드릴까요.")] },
      { text: "「지옥의 업화로 데워 드리리다」", then: [flash("red", 260), playSe(SE_DARK), shake(300), wait(300), playSe(SE_BELL),
        ...say("ol", "surprised", "…방금 전자레인지에서 불기둥 나오지 않았어요?"), ...say("hina", "surprised", "500와트, 1분 30초. 버튼. 버튼만 누르면 돼."), ...say("maou", "embarrassed", "…버튼. 알겠네."), ...mp()] },
    ]),
    ...say("maou", "base", "봉투는 필요하시오? 3엔이오."),
    ...say("ol", "happy", "아, 괜찮아요. 에코백 있어요."),
    ...say("maou", "surprised", "(스스로 봉투를 들고 다니다니. 이 세계의 백성은 준비성이 좋다.)"),
    ...say("ol", "happy", "고맙습니다~"),
    ...say("maou", "base", "…또 오시오."),
    ...say("hina", "base", "「또 오세요」."),
    ...next("ev_mk_c1a", "ev_mk_c1b"),
    // 제한시간 — 버스가 온다.
    ...say("student", "surprised", "컵라면 하나요! 아, 버스 왔다! 빨리요, 빨리!"),
    playSe(SE_BEEP),
    timedChoice("서둘러라! (4초)", ["「젓가락 드릴까요?」", "「젓가락 천 벌을 하사하노라」", "「손으로 드시오」"], 4000, V_PICK),
    ifCond(varIs(V_PICK, 1), [...say("student", "happy", "네! 하나요. 감사합니다!"), ...good()]),
    ifCond(varIs(V_PICK, 2), [wrong(), ...say("student", "surprised", "…천 벌이요? 저 혼자 먹는데요!"), ...say("hina", "happy", "한 벌. 한 벌이면 돼."), ...mp()]),
    ifCond(varIs(V_PICK, 3), [wrong(), ...say("student", "sad", "…뜨거운데요?"), ...say("hina", "surprised", "젓가락은 계산대 밑 서랍."), ...mp()]),
    ifCond(varIs(V_PICK, 0), [wrong(), ...caption("학생은 젓가락 없이 버스로 뛰어갔다."), ...say("hina", "base", "계산대는 속도야. 다음엔 바로.")]),
    ...next("ev_mk_c1b", "ev_mk_c1c"),
    ...say("teen", "base", "(캔맥주를 내려놓으며) …이거요."),
    ...think("(이 녀석, 어려 보인다. 히나 선배가 말했던 「연령 확인」인가.)"),
    choices([
      { text: "「연령 확인 버튼을 눌러 주세요」", then: [...say("teen", "embarrassed", "…아, 저 그냥 콜라로 할게요."), ...say("hina", "happy", "오. 잘했어."), ...good()] },
      { text: "「그대 영혼의 나이를 보겠소」", then: [emote("player", "exclamation", 900), tint("purple", 200), playSe(SE_DARK), wait(500), clearTint(300),
        ...say("maou", "base", "…열일곱이로군. 그리고 어제 숙제를 안 했소."),
        ...say("teen", "surprised", "히익?! 어, 어떻게 알았어요!?"), ...say("hina", "surprised", "…뭐야 방금. 아무튼 미성년자한텐 안 팔아."), ...good(), ...mp()] },
      { text: "「마왕은 인간의 법 따위 따르지 않소」", then: [wrong(), ...say("hina", "surprised", "안 돼. 진짜 안 돼. 팔면 경찰 와. 가게 문 닫아."), ...say("maou", "surprised", "…경찰. 이 세계의 기사단인가. 그건 곤란하군."), ...say("teen", "sad", "…콜라로 할게요."), ...mp()] },
    ]),
    ...next("ev_mk_c1c"),
    ...say("hina", "happy", "첫날치고 괜찮네. 손님 상대 체질인가 봐."),
    ...say("maou", "base", "백성을 다스리는 일이라면 이 몸의 본업일세."),
  ];
  // 둘째 날 계산대
  const reg2: Command[] = [
    ...clerkPos,
    ...caption("오전 8시 12분."),
    ...say("tanaka", "base", "……늘 먹던 걸로."),
    ...think("(늘 먹던 것…? 처음 보는 인간인데.)"),
    choices([
      { text: "「…늘 먹던 것이라 하면?」 (솔직하게 묻는다)", then: [...say("tanaka", "surprised", "…아, 신입이구나. 미안해요."), ...say("hina", "happy", "다나카 씨는 가라아게 레드랑 따뜻한 무가당 캔커피. 매일 아침 8시 12분."), ...good()] },
      { text: "「그대의 영혼을 읽겠소」", then: [emote("player", "exclamation", 900), tint("purple", 200), playSe(SE_DARK), wait(500), clearTint(300),
        ...say("maou", "sad", "…피로. 끝없는 피로가 보인다. 그리고… 가라아게."),
        ...say("tanaka", "sad", "…맞아요. 3년째 야근이라. 가라아게 레드에 따뜻한 무가당 캔커피요."), ...good(), ...mp()] },
      { text: "(아무거나 집는다) 「단팥빵이오」", then: [wrong(), ...say("tanaka", "sad", "……."), ...say("hina", "surprised", "아니. 가라아게 레드랑 따뜻한 무가당 캔커피.")] },
    ]),
    playSe(SE_BEEP), wait(200), playSe(SE_BEEP),
    ...say("maou", "base", "가라아게 레드, 따뜻한 무가당 캔커피. …기억해 두겠소."),
    ...say("tanaka", "happy", "…고마워요."),
    setSw(SW_TANAKA),
    ...next("ev_mk_c2a", "ev_mk_c2b"),
    // 연속 주문 — 말한 순서대로 꺼낸다.
    ...say("leon", "base", "고기만두 하나, 피자만두 하나, 콜라요. 순서대로 담아 주세요. 피자만두가 위로 가면 기름 묻거든요."),
    setVar(V_PICK, "=", 0),
    ...think("(첫째로 담을 것은…)"),
    choices([
      { text: "고기만두", then: [playSe(SE_BEEP), setVar(V_PICK, "+=", 1)] },
      { text: "피자만두", then: [wrong()] },
      { text: "콜라", then: [wrong()] },
    ]),
    ...think("(둘째는…)"),
    choices([
      { text: "콜라", then: [wrong()] },
      { text: "고기만두", then: [wrong()] },
      { text: "피자만두", then: [playSe(SE_BEEP), setVar(V_PICK, "+=", 1)] },
    ]),
    ...think("(마지막은…)"),
    choices([
      { text: "피자만두", then: [wrong()] },
      { text: "콜라", then: [playSe(SE_BEEP), setVar(V_PICK, "+=", 1)] },
      { text: "「세계의 절반」", then: [wrong(), ...say("leon", "surprised", "…네?"), ...mp()] },
    ]),
    ifCond(varIs(V_PICK, 3), [...say("leon", "surprised", "…오, 한 번에. 아저씨 기억력 좋네요."), ...good()],
      [...say("hina", "base", "고기만두, 피자만두, 콜라. 손님 말은 끝까지 들어."), ...say("maou", "embarrassed", "…금지 주문도 이렇게 길지는 않았네.")]),
    emote("player", "exclamation", 1200),
    ...think("(이 기척…! 용사!? 아니, 마력은 느껴지지 않는다. 그냥 고등학생인가…?)"),
    ...say("leon", "base", "…아저씨. 우리 어디서 본 적 있지 않아요?"),
    choices([
      { text: "「기분 탓이오」", then: [...say("leon", "base", "…그런가요.")] },
      { text: "「…전생에서 만났을지도 모르오」", then: [...say("leon", "surprised", "뭐야, 소름 돋게."), emote("ev_mk_c2b", "sweat"), ...mp()] },
      { text: "「고기만두 하나는 이 몸이 하사하겠소」", then: [...say("leon", "happy", "어, 진짜요? 럭키."), ...say("hina", "surprised", "서비스는 점장님 허락받고 해."), ...say("maou", "embarrassed", "…이 몸의 급료에서 빼게.")] },
    ]),
    playSe(SE_BEEP),
    ...say("maou", "base", "봉투는 필요하시오?"),
    ...say("leon", "base", "아뇨. …이상하네. 아저씨 얼굴 보니까 왠지 주먹이 근질근질해."),
    ...next("ev_mk_c2b"),
    ...say("hina", "base", "쟤 단골이야. 근처 고등학교. 맨날 고기만두만 사 가."),
    ...say("maou", "base", "(…용사 레온. 설마 너도 이 세계에.)"),
  ];
  // 사흘째 밤 계산대
  const reg3: Command[] = [
    ...clerkPos,
    ...caption("새벽 1시."),
    ...say("drunk", "sad", "점원 양반… 나 인생 어떡하지…? 부장이… 부장이 오늘도…"),
    choices([
      { text: "「세계의 절반을 주마」", then: [...say("drunk", "sad", "…반만 있어도 행복하겠다…"), ...say("hina", "happy", "그게 위로야?"), ...mp()] },
      { text: "「…힘내시오. 그대는 오늘도 살아남았소」", then: [...say("drunk", "surprised", "……."), ...say("drunk", "happy", "…자네, 말 잘하네. 고마워."), ...good()] },
      { text: "「인간이여, 미소시루를 마시오」", then: [...say("drunk", "base", "…맞아. 미소시루. 컵 미소시루 하나 줘."), ...mp()] },
    ]),
    // 물건 고르기 — 계산대 진열대에서 하나를 집는다.
    ...say("drunk", "sad", "그리고… 내일 아침 회의가 있어서… 숙취에 좋은 거… 아무거나…"),
    ...think("(계산대 옆 진열대. 무엇을 건넬까.)"),
    choices([
      { text: "숙취 해소 음료", then: [playSe(SE_BEEP), ...say("drunk", "happy", "…이거야, 이거. 점원 양반, 센스 있네."), ...good()] },
      { text: "에너지 드링크", then: [wrong(), ...say("hina", "surprised", "그거 마시면 밤새 못 자. 숙취 해소 음료는 계산대 옆.")] },
      { text: "「마계의 비약」이라 우기며 간장을 건넨다", then: [wrong(), ...say("drunk", "surprised", "…간장인데?"), ...say("maou", "base", "마계에서는 이것으로 숙취를 다스리오."), ...say("hina", "happy", "…진짜 그만해."), ...mp()] },
    ]),
    playSe(SE_BEEP),
    ...say("drunk", "happy", "숙취 해소 음료 두 개. 하나는 자네 거."),
    ...say("maou", "surprised", "(…인간이 마왕에게 공물을 바쳤다.)"),
    ...next("ev_mk_c3a", "ev_mk_c3b"),
    ...say("tanaka", "sad", "……(야근 끝. 말할 기운도 없다)"),
    ifCond(swOn(SW_TANAKA), [
      ...say("maou", "base", "가라아게 레드, 따뜻한 무가당 캔커피. 그리고 오늘은 고기만두도 하나. 이 몸이 사겠소."),
      emote("ev_mk_c3b", "heart"),
      ...say("tanaka", "surprised", "……."),
      ...say("tanaka", "happy", "…처음이에요. 누가 제 걸 기억해 준 거."),
      ...say("tanaka", "happy", "내일도 올게요. 8시 12분에."),
      ...good(),
    ], [
      ...say("maou", "base", "…늘 먹던 것이라 하면?"),
      ...say("tanaka", "sad", "…가라아게 레드에, 따뜻한 무가당 캔커피요."),
    ]),
    ...next("ev_mk_c3b"),
  ];
  // 흉상 대화창이 화면 아래 ⅓을 덮는다 — 계산하는 동안 카메라를 손님 줄 쪽으로 내려 계산대·손님이 창 위에 오게 한다.
  const atRegister = (body: Command[]): Command[] => [...clerkPos, panTo(Q1.x, Q2.y), ...body, panBack()];
  const regIdle: Command[] = [...think("계산대. 지금은 손님이 없다.")];
  ev(event("ev_mk_register", "계산대", REG, [
    page("ev_mk_register_p0", [swOn(SW_SHIFT)], regIdle, { priority: "same" }),
    page("ev_mk_register_p3", [varIs(V_STAGE, 3), swOff("sw_mk_t_reg1")], [...atRegister(reg1), ...taskDone("sw_mk_t_reg1")], { priority: "same" }),
    page("ev_mk_register_p5", [varIs(V_STAGE, 5), swOff("sw_mk_t_reg2")], [...atRegister(reg2), ...taskDone("sw_mk_t_reg2")], { priority: "same" }),
    page("ev_mk_register_p7", [varIs(V_STAGE, 7), swOff("sw_mk_t_reg3")], [...atRegister(reg3), ...taskDone("sw_mk_t_reg3")], { priority: "same" }),
  ]));

  // 상자 진열(첫째 날·사흘째 밤) — changeTile 로 상자를 치운다.
  const box1: Command[] = [
    ...caption("통로를 막은 택배 상자. 「컵라면 48개」."),
    ...say("hina", "base", "그거 선반에. 날짜 오래된 게 앞."),
    choices([
      { text: "오래된 것을 앞으로 (선입선출)", then: [...say("maou", "base", "먼저 온 자가 먼저 나간다. 마왕군 보급의 철칙과 같군."), ...good()] },
      { text: "마왕의 위엄으로 피라미드처럼 쌓는다", then: [playSe(SE_BOOM), shake(600, "3"), wrong(), ...say("hina", "happy", "…무너졌어. 다시."), ...say("maou", "embarrassed", "…이 세계는 중력까지 엄격하군."), ...mp()] },
      { text: "이 몸의 얼굴과 닮은 쪽을 앞으로", then: [...say("hina", "surprised", "컵라면에 얼굴이 어딨어. …아, 이 매운맛 캐릭터. 좀 닮았네."), ...mp()] },
    ]),
    ...boxTiles(false),
    ...caption("상자를 비웠다. 통로가 넓어졌다."),
  ];
  const box3: Command[] = [
    ...caption("야간 택배. 「주간지 50권」."),
    choices([
      { text: "발매일 순서대로 꽂는다", then: [...say("maou", "base", "질서다. 질서야말로 지배의 근본."), ...good()] },
      { text: "한 손으로 상자째 들어 올린다", then: [...say("hina", "surprised", "…그거 30킬로인데. 근력 뭐야."), ...say("maou", "happy", "마력은 봉인됐어도 근력은 마왕일세."), ...mp()] },
      { text: "이 몸이 표지인 잡지를 맨 앞에", then: [...say("hina", "base", "그런 잡지는 없어."), ...say("maou", "sad", "…언젠가 만들게 하겠네."), ...mp()] },
    ]),
    ...boxTiles(false),
    ...caption("주간지를 다 꽂았다."),
  ];
  ev(event("ev_mk_box", "택배 상자", BOX, [
    gone("ev_mk_box_off", []),
    page("ev_mk_box_p3", [varIs(V_STAGE, 3), swOff("sw_mk_t_box1")], [...box1, ...taskDone("sw_mk_t_box1")], { priority: "same" }),
    page("ev_mk_box_p7", [varIs(V_STAGE, 7), swOff("sw_mk_t_box3")], [...box3, ...taskDone("sw_mk_t_box3")], { priority: "same" }),
  ]));

  // 분리수거(첫째 날)
  ev(event("ev_mk_trash", "분리수거함", TRASH, [
    page("ev_mk_trash_p0", [], [...caption("타는 쓰레기, 플라스틱, 캔과 병. 문 셋이 이 몸을 시험한다.")], { priority: "same" }),
    page("ev_mk_trash_p3", [varIs(V_STAGE, 3), swOff("sw_mk_t_trash1")], [
      ...caption("분리수거함 옆에 손님이 두고 간 컵라면 용기가 있다. 국물이 남아 있다."),
      choices([
        { text: "국물은 버리고, 용기만 플라스틱으로", then: [...say("hina", "happy", "정답. 의외로 꼼꼼하네."), ...good()] },
        { text: "통째로 어둠의 차원에 봉인한다", then: [wrong(), ...say("hina", "base", "어둠의 차원은 수거 요일이 언젠데?"), ...say("maou", "sad", "…없네."), ...mp()] },
        { text: "타는 쓰레기는 이 몸이 직접 태운다", then: [wrong(), ...say("hina", "surprised", "가게에서 불 피우지 마."), ...mp()] },
      ]),
      ...say("maou", "base", "…그 안내문에 적혀 있던 「분리수거」가 이것이었군. 인간 세계, 의외로 규율이 엄하다."),
      ...taskDone("sw_mk_t_trash1"),
    ], { priority: "same" }),
  ]));
  // 핫스낵(둘째 날)
  ev(event("ev_mk_snack", "핫스낵 케이스", SNACK, [
    page("ev_mk_snack_p0", [], [...caption("핫스낵 케이스. 가라아게 레드와 고기만두가 따뜻하게 빛난다.")], { priority: "same" }),
    page("ev_mk_snack_p5", [varIs(V_STAGE, 5), swOff("sw_mk_t_snack2")], [
      ...say("hina", "base", "가라아게 레드 튀겨. 튀김기는 매뉴얼대로."),
      choices([
        { text: "매뉴얼대로 3분 30초", then: [playSe(SE_BELL), ...say("hina", "happy", "완벽. 겉은 바삭, 속은 촉촉."), ...good()] },
        { text: "암흑의 화염으로 3초 만에", then: [flash("red", 300), playSe(SE_BOOM), shake(400), wrong(), ...caption("가라아게 레드가 가라아게 블랙이 되었다."), ...say("hina", "sad", "…숯이네. 이건 내가 먹을게…"), ...mp()] },
        { text: "「맛있어져라, 맛있어져라」 주문을 건다", then: [emote("player", "music"), ...say("hina", "happy", "그건 메이드 카페 거고. …근데 진짜 맛있게 됐네?"), ...good()] },
      ]),
      ...taskDone("sw_mk_t_snack2"),
    ], { priority: "same" }),
  ]));
  // 발주(둘째 날)
  ev(event("ev_mk_order", "발주 단말", PC, [
    page("ev_mk_order_p0", [], [...caption("발주 단말. 내일 팔 물건의 수를 정하는 곳이다.")], { priority: "same" }),
    page("ev_mk_order_p5", [varIs(V_STAGE, 5), swOff("sw_mk_t_order2")], [
      ...caption("발주 단말. 「내일 최저 기온 4도, 비.」 오뎅 무, 몇 개?"),
      choices([
        { text: "40개 (추우면 오뎅이 팔린다)", then: [...say("manager", "happy", "날씨까지 봤군요. 감이 좋아요."), ...good()] },
        { text: "999개 (마계의 겨울에 대비한다)", then: [wrong(), playSe(SE_BELL), ...voice("사토미 점장(전화)", "마오 군…? 방금 본사에서 전화가 왔어요. 무 999개요…?"), ...say("maou", "embarrassed", "…마계의 겨울은 길었소."), ...caption("발주를 40개로 고쳤다."), ...mp()] },
        { text: "0개 (무는 군량이 아니다)", then: [wrong(), ...say("manager", "sad", "마오 군… 내일 오뎅 냄비가 비면 다나카 씨가 울어요."), ...caption("발주를 40개로 고쳤다.")] },
      ]),
      ...taskDone("sw_mk_t_order2"),
    ], { priority: "same" }),
  ]));
  // 폐기(사흘째 밤)
  ev(event("ev_mk_waste", "폐기 바구니", WASTE, [
    page("ev_mk_waste_p0", [], [...caption("백룸 선반.")], { priority: "same" }),
    page("ev_mk_waste_p7", [varIs(V_STAGE, 7), swOff("sw_mk_t_waste3")], [
      ...caption("유통기한이 지난 도시락 네 개. 「폐기」 스티커가 붙어 있다."),
      ...think("(이것이… 전단지에 적혀 있던 폐기 도시락.)"),
      choices([
        { text: "규칙대로 폐기한다", then: [...say("maou", "sad", "…잘 가라, 이름 모를 도시락이여. 너의 희생은 잊지 않겠다."), ...say("hina", "happy", "장례식이야? …잘했어."), ...good()] },
        { text: "…몰래 먹는다", then: [emote("player", "heart"), ...say("maou", "happy", "……맛있다. 인간의 음식, 얕볼 수 없군."), ...say("hina", "base", "거기 CCTV 있어."), ...say("maou", "surprised", "!!"), ...mp()] },
        { text: "히나 선배와 반씩 나눈다", then: [...say("hina", "happy", "공범이네. 점장님한텐 비밀."), ...say("maou", "happy", "마왕의 공범이라니. 영광으로 알게, 선배.")] },
      ]),
      ...taskDone("sw_mk_t_waste3"),
    ], { priority: "same" }),
  ]));
  // 근무 중에는 자동문으로 나가지 못한다.
  ev(event("ev_mk_gate", "자동문 앞", GATE, [
    gone("ev_mk_gate_off", []),
    ...[3, 5, 7].map((s) => page(`ev_mk_gate_p${s}`, [varIs(V_STAGE, s)], [...say("hina", "surprised", "어디 가. 아직 근무 중."), walk("@player", ["up"])], { trigger: "playerTouch" })),
  ]));

  // 하루의 시작(둘째 날·사흘째 밤 아침 브리핑)
  const morning2: Command[] = [
    ...fadeIn(700),
    playSe(SE_CHIME),
    ...say("hina", "happy", "좋은 아침. …다크서클 심하네."),
    ...say("maou", "base", "마왕의 눈매는 원래 이렇다네."),
    ...say("hina", "happy", "그래그래. 오늘은 계산대, 핫스낵, 발주."),
    setSw(SW_SHIFT), setSw("sw_mk_brief2"),
    ...clerkPos,
    ...caption("둘째 날 · 오전 8시. 근무 시작.", "오늘 할 일은 계산대, 핫스낵, 발주."),
  ];
  const night3: Command[] = [
    // 밤 — 창밖은 남색으로 가라앉고, 계산대 위 형광등만 환하다.
    { kind: "setLighting", ambient: 0.5, color: "#18204a", transitionMs: 0 } as Command,
    { kind: "addLight", source: { id: "mk_night_counter", at: { x: 12, y: 10 }, radius: 6, intensity: 0.85, color: "#fff4dc", flicker: false } } as Command,
    ...fadeIn(700),
    playSe(SE_CHIME),
    bgm(BGM_NIGHT),
    ...say("hina", "base", "왔어? 야간은 나랑 둘이야. 점장님은 집에서 주무셔."),
    ...say("hina", "happy", "택배 또 왔어. 백룸 폐기 정리도. 계산대는… 손님 오면."),
    ...boxTiles(true),
    setSw(SW_SHIFT), setSw("sw_mk_brief3"),
    ...clerkPos,
    ...caption("사흘째 · 밤 11시. 야간 근무 시작.", "오늘 할 일은 계산대, 택배 진열, 폐기 정리."),
  ];
  const day1: Command[] = [
    wait(300),
    ...clerkPos,
    ...caption("첫째 날 · 오전 10시. 근무 시작.", "오늘 할 일은 계산대, 상자 진열, 분리수거."),
    setSw("sw_mk_brief1"),
  ];
  ev(event("ev_mk_ctrl_brief", "근무 시작", { x: 0, y: 1 }, [
    gone("ev_mk_ctrl_brief_off", []),
    page("ev_mk_ctrl_brief_p3", [varIs(V_STAGE, 3), swOff("sw_mk_brief1")], day1, { trigger: "auto" }),
    page("ev_mk_ctrl_brief_p5", [varIs(V_STAGE, 5), swOff("sw_mk_brief2")], morning2, { trigger: "auto" }),
    page("ev_mk_ctrl_brief_p7", [varIs(V_STAGE, 7), swOff("sw_mk_brief3")], night3, { trigger: "auto" }),
  ]));

  // 하루의 끝
  const endDay1: Command[] = [
    wait(300),
    walkTo(MGR_B, { x: 15, y: 9 }),
    ...say("manager", "happy", "마오 군, 수고했어요. 첫날인데 다 해냈어요."),
    ifCond(varAtLeast(V_SERVICE, 4), [...say("manager", "happy", "손님 반응도 좋았어요. 「새로 온 분 목소리 좋다」고.")],
      [...say("manager", "base", "처음엔 다 그래요. 조금씩 익숙해져요.")]),
    ...say("maou", "base", "…이 몸은 오늘, 시련 셋을 넘었소."),
    ...say("hina", "happy", "시련이래. …내일 봐."),
    ...say("manager", "base", "아, 그리고 이거. 근무 평가 메모. 매일 드릴게요."),
    ...review("첫째 날", 5, 3, 4, 2),
    setSw(SW_SHIFT, false),
    setVar(V_STAGE, "=", 4), setVar(V_TASKS, "=", 0),
    transfer(M.street, links.konbini.street, "down"),
  ];
  const endDay2: Command[] = [
    wait(300),
    ...say("hina", "happy", "끝. 발주까지 했으니 반쯤 베테랑이네."),
    ...say("hina", "base", "아, 내일 야간이지. 밤 11시까지 와. 점장님 메모는 이거."),
    ...review("둘째 날", 9, 6, 7, 4),
    ...say("maou", "base", "알겠네. …그 전에 들를 곳이 있다네."),
    setSw(SW_SHIFT, false),
    setVar(V_STAGE, "=", 6), setVar(V_TASKS, "=", 0),
    transfer(M.street, links.konbini.street, "down"),
  ];
  const crisis = buildCrisis(project, map, { door, gate: GATE, clerk: CLERK, hinaId: HINA_ID });
  ev(event("ev_mk_ctrl_end", "근무 끝", { x: 1, y: 0 }, [
    gone("ev_mk_ctrl_end_off", []),
    page("ev_mk_ctrl_end_p3", [varIs(V_STAGE, 3), varAtLeast(V_TASKS, 3)], endDay1, { trigger: "auto" }),
    page("ev_mk_ctrl_end_p5", [varIs(V_STAGE, 5), varAtLeast(V_TASKS, 3)], endDay2, { trigger: "auto" }),
    page("ev_mk_ctrl_end_p7", [varIs(V_STAGE, 7), varAtLeast(V_TASKS, 3)], crisis, { trigger: "auto" }),
  ]));

  // 업무 자리마다 점원 자리에서 걸어갈 수 있어야 한다(서 있는 점장·히나·손님 칸은 막힘으로 본다).
  for (const [to, what] of [[{ x: BOX.x, y: BOX.y + 1 }, "상자 앞"], [{ x: TRASH.x, y: TRASH.y - 1 }, "분리수거함 앞"], [{ x: SNACK.x, y: SNACK.y + 1 }, "핫스낵 앞"],
    [{ x: PC.x, y: PC.y - 1 }, "발주 단말 앞"], [{ x: WASTE.x, y: WASTE.y + 1 }, "폐기 선반 앞"], [GATE, "자동문 앞"]] as const) {
    mustReach(project, map, CLERK, to, what);
  }
  map.defaultLighting = { ambient: 0, color: "#000000", sources: [] };
  map.bgm = { mode: "custom", resourceId: BGM_SHOP } as GameMap["bgm"];
  return arrive;
}

// ── 8) 사흘째 밤의 결전 ──
function buildCrisis(project: Project, map: GameMap, at: { door: Cell; gate: Cell; clerk: Cell; hinaId: string }): Command[] {
  const LEON = "ev_mk_x_leon", LILY = "ev_mk_x_lily";
  const leonStop = mustWalk(project, map, { x: 11, y: 13 }, "용사가 설 칸");
  const lilyStop = mustWalk(project, map, { x: 9, y: 13 }, "리리가 설 칸");
  map.events.push(event(LEON, "레온", at.gate, [
    gone(`${LEON}_off`, []),
    page(`${LEON}_on`, [swOn("sw_mk_x_leon")], [], { who: "leon", dir: "up" }),
    gone(`${LEON}_gone`, [swOn("sw_mk_x_over")]),
  ]));
  map.events.push(event(LILY, "리리", { x: at.gate.x + 1, y: at.gate.y }, [
    gone(`${LILY}_off`, []),
    page(`${LILY}_on`, [swOn("sw_mk_x_lily")], [], { who: "lily", dir: "up" }),
    gone(`${LILY}_gone`, [swOn("sw_mk_x_over")]),
  ]));

  const reconcile: Command[] = [
    ...say("leon", "sad", "…왜. 왜 반격을 안 하는 거야."),
    ...say("maou", "base", "매뉴얼 제3조. 「손님께는 언제나 미소로.」"),
    ...say("leon", "sad", "손님이라니… 난 너를 쓰러뜨리러 온 거라고."),
    ...say("maou", "base", "문으로 들어왔으면 손님이오. 고기만두 식소. 드시오."),
    ...caption("레온은 한참 고기만두를 내려다보다가, 한 입 베어 물었다."),
    ...say("leon", "sad", "……따뜻하다."),
    ...say("leon", "sad", "용사로 다시 태어났는데, 이 세계엔 마왕도 마물도 없어. 싸울 상대가 없으니까… 난 뭘 해야 할지 몰랐어."),
    ...say("maou", "base", "이 몸도 마찬가지였소. 잔고 0엔에서 시작했지."),
    ...say("maou", "happy", "할 일이 없으면, 일하면 된다. 마침 이 가게가 야간 알바를 구하고 있소."),
    ...say("leon", "surprised", "…나보고 여기서 일하라고? 마왕 밑에서?"),
    ...say("hina", "happy", "아니, 내 밑. 선배는 나야."),
    ...say("leon", "embarrassed", "…생각해 볼게요. 고기만두 할인 돼요?"),
    ...say("hina", "happy", "직원 할인 10%."),
    ...say("leon", "happy", "할게요."),
    ...say("lily", "sad", "마, 마왕님… 세계 정복은 어찌 되옵니까…?"),
    ...say("maou", "base", "리리스, 오늘 깨달았네. 세계를 손에 넣는 길은 여럿일세."),
    ...say("maou", "happy", "우선은 이 사쿠라자카점부터. 다음 달 매출 1위를 정복하겠네."),
    ...say("lily", "happy", "…예! 마왕님 뜻이 그러하시다면!"),
  ];
  // 엔딩 장면 — 엔딩 그림(같은 편의점 맵을 그린 그림)을 깔고 그 위에서 에필로그를 대사로 흘린 뒤 엔딩 카드로 넘어간다.
  // 엔딩 정의에는 에필로그를 두지 않는다 — 두면 대사로 한 번, 카드에 한 번, 같은 문장이 두 번 나온다(적대 검수 2026-10-29 S7).
  const PIC = "mk_end";
  const endingScene = (resourceId: string, endingId: string, body: Command[]): Command[] => [
    ...fadeOut(900),
    { kind: "showPicture", pictureId: PIC, resourceId, x: 0, y: 0, scale: 50, opacity: 255, waitForPicture: false } as Command,
    stopBgm(), bgm(BGM_END, 600),
    ...fadeIn(1000),
    ...body,
    ...fadeOut(1000),
    setSw("sw_mk_x_over"),
    { kind: "triggerEnding", endingId } as Command,
  ];
  const bestScene = endingScene(END_ART.best, END_BEST, [
    ...caption("한 달 뒤. 해피 마트 사쿠라자카점 계산대 옆에 액자 하나가 걸렸다.", "「이달의 우수 사원 마오」. 사진 속 마오는 매뉴얼 제3조대로 웃고 있다."),
    ...say("manager", "happy", "마오 군, 이번 달 매출이 지역 1위. 다음 달부터 시급 50엔 올려 드릴게요."),
    ...say("maou", "happy", "…50엔. 세계의 절반에 비하면 티끌이오. 허나 이 몸이 처음으로 「번」 돈이오."),
    ifCond(varAtLeast(V_MAOU, MAOU_FAMOUS), [...caption("「말투가 이상한 점원」을 보러 오는 손님까지 생겼다. 점장은 그것도 매출이라고 했다.")]),
    ...caption("야간에는 새 알바생 레온이 들어왔다. 고기만두를 하루에 세 개씩 먹는다."),
    ...say("hina", "happy", "마오, 레온. 둘 다 내 밑. 선배라고 불러."),
    ...caption("다나카 씨는 매일 아침 8시 12분에 온다. 마오는 리리네 찻집 단골이 되었고, 가르곤은 편의점 앞 벤치를 옥좌로 삼았다."),
    ...say("maou", "base", "세계를 손에 넣는 길은 여럿이오. 우선은 이 동네부터."),
  ]);
  const okScene = endingScene(END_ART.ok, END_OK, [
    ...caption("다음 날 아침. 마오는 평소처럼 줄무늬 조끼를 입었다."),
    ifCond(swOn(SW_LOST), [...say("hina", "base", "어제 그렇게 맞고도 웃더라. …미소는 맞으면서 짓는 거 아니야.")],
      [...say("hina", "happy", "어제 「데워 드릴까요」 또 까먹었지. 그래도 늘었어.")]),
    ...say("maou", "base", "…매뉴얼은 마왕군 군율만큼 어렵군. 허나 이 몸은 물러서지 않네."),
    ...caption("야간에는 새 알바생 레온이 들어왔다. 첫날부터 전자레인지 버튼을 잘못 눌렀다."),
    ...say("maou", "happy", "500와트로 1분 30초일세, 후배. 버튼이네, 버튼."),
    ...caption("이달의 우수 사원 액자에는 아직 히나의 사진이 걸려 있다."),
    ...say("maou", "base", "…다음 달에는, 저 액자를 정복한다."),
  ]);
  const powerScene = endingScene(END_ART.power, END_POWER, [
    ...caption("다음 날 아침. 반쯤 부서진 해피 마트 사쿠라자카점."),
    ...say("manager", "sad", "유리문, 진열대 셋, 전자레인지. 합계 380만 엔."),
    ...say("maouF", "base", "…이 몸은 마왕이다. 마왕은 변상 따위…"),
    ...say("manager", "base", "시급 1,150엔으로 계산하면… 마오 군, 약 3,300시간."),
    ...say("hina", "happy", "…마오, 평생 여기서 일하겠네."),
    ...caption("마왕은 힘을 되찾았다. 그 힘으로 손에 넣은 것은,", "줄무늬 조끼와 갚아야 할 380만 엔이었다."),
    ...say("leon", "sad", "…나도 반은 낼게. 같이 부쉈으니까."),
    ...say("maouF", "base", "…용사여. 세계의 절반 대신, 빚의 절반이라니."),
  ]);
  const powerBattle: Command[] = [
    ...say("maou", "base", "…좋다. 네가 원한다면, 보여 주마."),
    stopBgm(), playSe(SE_DARK),
    { kind: "setLighting", ambient: 0.75, color: "#2a0040", transitionMs: 900 } as Command,
    wait(900), shake(900, "6"), flash("purple", 700), playSe(SE_BOOM),
    { kind: "changeParty", actorId: MAOU_TRUE, action: "add" } as Command,
    { kind: "changeParty", actorId: MAOU_TRUE, action: "lead" } as Command,
    { kind: "changeParty", actorId: DEFAULT_ACTOR_ID, action: "remove" } as Command,
    wait(600),
    ...say("maouF", "base", "크하하하! 돌아왔다…! 이 몸이야말로 암흑 마왕 제르바스!"),
    ...say("hina", "surprised", "…………마오?? 뿔?? 피부 보라색??"),
    ...say("leon", "base", "역시 너였어, 제르바스! 이번에야말로 끝을 내 주마!"),
    { kind: "setLighting", ambient: 0.6, color: "#ffe6a0", transitionMs: 400 } as Command,
    flash("white", 500), playSe(SE_FLASH),
    ...say("leon", "base", "용사의 힘이여… 깨어나라!"),
    ...caption("레온의 몸이 빛에 휩싸였다. 기억과 함께 용사의 힘이 돌아온다."),
    bgm(BGM_BOSS, 300),
    { kind: "battleProcessing", troopId: "troop_mk_power", canEscape: false, canLose: true, branchOnResult: true,
      victoryBranch: [...say("maouF", "base", "크하하하! 용사여, 이 세계에서도 마왕을 이길 수는 없다!"), ...say("leon", "sad", "큭… 젠장…")],
      defeatBranch: [...say("leon", "base", "하아… 하아… 이겼다…!"), ...say("maouF", "base", "흥… 마력이 아직 반밖에 안 돌아왔다. 반밖에.")] } as Command,
    ...caption("그날 밤, 해피 마트 사쿠라자카점에서 유리문과 진열대 셋, 그리고 전자레인지가 사라졌다."),
    playSe(SE_BOOM), shake(800, "3"),
    { kind: "setLighting", ambient: 0.55, color: "#10182a", transitionMs: 600 } as Command,
    ...say("hina", "sad", "……가게가."),
    ...say("lily", "happy", "마왕님! 역시 마왕님이시옵니다! 이대로 세계를 다시…"),
    playSe(SE_BELL),
    ...voice("사토미 점장(전화)", "…마오 군? 방금 가게 CCTV 알림이 왔는데요."),
    ...voice("사토미 점장(전화)", "내일 아침에, 이야기 좀 해요."),
    ...say("maouF", "base", "……."),
    ...powerScene,
  ];
  const manualBattle: Command[] = [
    ...say("maou", "base", "…리리스. 이 몸은 지금 근무 중일세."),
    ...say("lily", "surprised", "예에!?"),
    ...caption("편의점 매뉴얼 제3조. 「손님께는 언제나 미소로.」"),
    ...say("maou", "happy", "이랏샤이마세. 해피 마트에 어서 오십시오, 손님."),
    ...say("leon", "surprised", "……너, 지금 웃은 거야? 날 바보 취급하는 거냐!"),
    ...think("(봉투 휘두르기로는 용사를 못 이긴다. 이 몸에게는 매뉴얼이 있다.)"),
    bgm(BGM_MANUAL, 300),
    { kind: "battleProcessing", troopId: "troop_mk_manual", canEscape: false, canLose: true, branchOnResult: true,
      victoryBranch: [...say("leon", "sad", "…하아… 하아…. 화낼 기운도 없어졌어…")],
      defeatBranch: [
        ...caption("마오는 바닥에 쓰러졌다. 미소는 그대로였다."),
        ...say("leon", "surprised", "…야, 괜찮아? 왜 웃고 있는데…"),
        ...say("hina", "surprised", "둘 다 그만. 마오, 제3조는 웃으라는 거지 맞으라는 거 아니야."),
        setSw(SW_LOST),
      ] } as Command,
    { kind: "setLighting", ambient: 0.5, color: "#18204a", transitionMs: 600 } as Command,
    ...reconcile,
    ...say("hina", "base", "…아, 그리고 점장님이 사흘치 평가 메모 남기셨어. 마오 거."),
    ...review("사흘 전체", BEST_AT, 8, MAOU_FAMOUS, 5),
    // 결말: 진 싸움은 「내일도 출근」. 모범 응대가 문턱을 넘거나, 마왕력으로 동네 명물이 된 채 응대도 괜찮으면 「우수 사원」.
    ifCond(swOn(SW_LOST), okScene, [
      ifCond(varAtLeast(V_SERVICE, BEST_AT), bestScene, [
        ifCond(varAtLeast(V_MAOU, MAOU_FAMOUS), [ifCond(varAtLeast(V_SERVICE, BEST_WITH_MAOU), bestScene, okScene)], okScene),
      ]),
    ]),
  ];
  return [
    wait(400),
    setSw(SW_SHIFT, false),
    stopBgm(),
    ...caption("새벽 2시. 손님이 끊긴 시간."),
    ...say("hina", "happy", "일 다 끝났네. 아침까지 버티기만 하면 돼."),
    walkTo("@player", at.clerk), face("@player", "down"),
    // 레온·리리가 서는 계산대 앞(11~13줄)이 흉상 대화창 위에 오도록 카메라를 내린다.
    panTo(at.clerk.x - 1, at.clerk.y + 3, 700),
    { kind: "setLighting", ambient: 0.6, color: "#0a0820", transitionMs: 500 } as Command,
    playSe(SE_DARK), wait(500),
    { kind: "setLighting", ambient: 0.5, color: "#18204a", transitionMs: 200 } as Command,
    ...say("hina", "surprised", "…방금 형광등 깜빡였지?"),
    playSe(SE_CHIME), setSw("sw_mk_x_leon"), wait(200),
    walkTo("ev_mk_x_leon", leonStop), face("ev_mk_x_leon", "up"),
    emote("player", "exclamation", 1200),
    ...say("leon", "base", "…찾았다. 마왕 제르바스."),
    ...say("maou", "surprised", "!! 용사… 레온. 기억이 돌아왔는가."),
    ...say("leon", "base", "고기만두를 먹을 때마다 꿈을 꿨다. 「세계의 절반을 주마」라 지껄이던 보라색 놈을."),
    ...say("leon", "base", "어젯밤 전부 떠올랐다. 네놈 때문에 이 세계에서 숙제나 하고 있단 말이다!"),
    ...say("hina", "surprised", "뭐야. 코스프레? 아는 사이?"),
    playSe(SE_CHIME), setSw("sw_mk_x_lily"), wait(200),
    walkTo("ev_mk_x_lily", lilyStop), face("ev_mk_x_lily", "up"),
    ...say("lily", "surprised", "마왕님! 역시 용사가 나타났사옵니다!"),
    ...say("lily", "base", "오늘은 보름달, 봉인이 가장 약해지는 밤이옵니다. 마왕님, 지금 힘을 되찾으시옵소서!"),
    ...say("leon", "base", "덤벼라, 마왕! 이번엔 끝을 보자!"),
    emote(at.hinaId, "sweat"),
    ...say("hina", "sad", "…마오. 무슨 일인진 몰라도, 가게에서 싸우면 안 돼. 알지?"),
    ...think("(마력이… 손끝에서 끓어오른다. 지금이라면 돌아간다. 마왕으로.)"),
    ...think("(…그런데 이 몸은 지금, 줄무늬 조끼를 입고 있다.)"),
    choices([
      { text: "마왕의 힘을 해방한다", then: powerBattle },
      { text: "알바 매뉴얼을 따른다", then: manualBattle },
    ]),
  ];
}

// ── 4·6) 상점가 ──
function buildStreet(project: Project, links: Links, parkArrive: Cell, shrineArrive: Cell): { fromPark: Cell; fromShrine: Cell } {
  const map = project.maps[M.street]!;
  const fromShrine = mustWalk(project, map, { x: 31, y: 1 }, "북쪽 끝");
  const fromPark = mustWalk(project, map, { x: 31, y: 26 }, "남쪽 끝");
  // 큰길 끝 = 신사(북)·공원(남). 저녁에만 간다.
  const exitPages = (to: string, at: Cell, dir: "up" | "down", back: "up" | "down", label: string) => [
    page("p0", [], [...think(`(${label} 가는 길이다. 지금은 다른 볼일이 있다.)`), walk("@player", [back])], { trigger: "playerTouch" }),
    page("p4", [varIs(V_STAGE, 4)], [transfer(to, at, dir)], { trigger: "playerTouch" }),
    page("p6", [varIs(V_STAGE, 6)], [transfer(to, at, dir)], { trigger: "playerTouch" }),
  ];
  for (const x of [30, 31, 32]) {
    map.events.push(event(`ev_mk_st_north_${x}`, "신사 가는 길", { x, y: 0 }, exitPages(M.shrine, shrineArrive, "up", "down", "언덕 위 신사").map((p) => ({ ...p, id: `ev_mk_st_n${x}_${p.id}` }))));
    map.events.push(event(`ev_mk_st_south_${x}`, "공원 가는 길", { x, y: 27 }, exitPages(M.park, parkArrive, "down", "up", "공원").map((p) => ({ ...p, id: `ev_mk_st_s${x}_${p.id}` }))));
  }
  // 첫 출근 길(stage 2) — 문을 나서면 한마디.
  map.events.push(event("ev_mk_st_morning", "첫 출근 길", { x: 0, y: 9 }, [
    gone("ev_mk_st_morning_off", []),
    page("ev_mk_st_morning_p", [varIs(V_STAGE, 2), swOff("sw_mk_st_morning")], [
      wait(300),
      ...thinkAs(CAST.zervas.name, "…이것이 인간의 거리인가. 성벽도 망루도 없이 가게들이 줄지어 있군.", "전단지의 「해피 마트」는 바로 왼쪽 건물이다."),
      setSw("sw_mk_st_morning"),
    ], { trigger: "auto" }),
  ]));
  // 찻집 — 문은 닫혀 있다(실내 없음).
  const cafeDoor = { x: 26, y: 8 };
  map.events.push(event("ev_mk_st_cafe", "찻집 코스모스", cafeDoor, [
    page("ev_mk_st_cafe_p", [], [...note("찻집 코스모스", "오늘 영업은 끝났습니다.", "내일 또 와 주세요. 리리 드림")], { priority: "same" }),
  ]));
  // 리리(첫째 날 저녁)
  const LILY = "ev_mk_st_lily";
  // 찻집 문(26,8) 옆, 아래 칸(27,10)이 비어 있어 인도를 막지 않는 자리.
  const lilyAt = mustWalk(project, map, { x: 27, y: 9 }, "찻집 앞");
  const meet: Command[] = [
    wait(400),
    { kind: "setLighting", ambient: 0.5, color: "#ff6a2a", transitionMs: 0 } as Command,
    ...think("…첫째 날이 끝났다. 손바닥이 바코드 빛으로 아직 따끔거린다."),
    emote(LILY, "exclamation", 1200),
    ...say("lily", "surprised", "…그 마력의 잔향. 설마… 설마!"),
    approach(LILY, "@player"),
    ...say("lily", "surprised", "마왕님!? 제르바스 마왕님이시옵니까!?"),
    ...say("maou", "surprised", "자네는… 그 앞치마는 뭔가. 아니, 그 목소리. 사천왕 몽마 리리스!?"),
    ...say("lily", "happy", "예! 지금은 리리라 하옵니다. 저 앞 찻집 알바이옵니다. 시급 1,200엔, 교통비 별도이옵니다!"),
    ...say("maou", "base", "…시급? 마왕군은 그런 걸 준 적이 없는데."),
    ...say("lily", "base", "그렇사옵니다. 이 세계에선 그런 곳을 「블랙 기업」이라 부르옵니다."),
    ...say("maou", "embarrassed", "……보람은 넘치는 직장이었네."),
    ...say("lily", "base", "다른 사천왕도 이 세계 어딘가에 있사옵니다. 그리고… 용사도. 이 동네에서 그 기척을 느꼈사옵니다."),
    ...say("lily", "happy", "하여! 내일 밤 공원 정자에서 「사천왕 재결성 회의」를 여옵니다. 꼭 와 주시옵소서!"),
    ...say("maou", "base", "…생각해 두지. 내일은 근무일세."),
    ...say("lily", "surprised", "근무…? 마왕님이…?"),
    setSw(SW_LILY),
    // 리리는 찻집 앞으로 돌아간다 — 다가온 자리에 서 있으면 고양이와 함께 편의점 앞 길을 막았다(실플레이 2026-10-29).
    walkTo(LILY, lilyAt, false),
    ...caption("저녁의 상점가. 큰길 위쪽 끝은 언덕 위 신사, 아래쪽 끝은 공원이다. 원룸에서 자면 하루가 끝난다."),
  ];
  map.events.push(event("ev_mk_st_meet", "리리와의 재회", { x: 0, y: 10 }, [
    gone("ev_mk_st_meet_off", []),
    page("ev_mk_st_meet_p", [varIs(V_STAGE, 4), swOff(SW_LILY)], meet, { trigger: "auto" }),
  ]));
  map.events.push(event(LILY, "리리", lilyAt, [
    gone(`${LILY}_off`, []),
    page(`${LILY}_p4`, [varIs(V_STAGE, 4)], [faceHero(LILY), ...say("lily", "happy", "내일 밤, 공원 정자이옵니다! 회비는 500엔이옵니다!"), ...say("maou", "surprised", "회비가 있는가.")], { who: "lily", dir: "down" }),
  ]));
  // 가르곤(고양이) — 첫째 날 저녁 편의점 앞 벤치.
  const CAT = "ev_mk_st_cat";
  map.events.push(event(CAT, "길고양이", mustWalk(project, map, { x: 7, y: 10 }, "고양이 자리(길 아래쪽)"), [
    gone(`${CAT}_off`, []),
    page(`${CAT}_p4`, [varIs(V_STAGE, 4)], [playSe(SE_CAT), ...voice("길고양이", "냐아."), ...think("(…이 오만한 눈빛. 어디서 본 듯한데.)"), playSe(SE_CAT), ...voice("길고양이", "…냥.")], { who: "cat", dir: "down" }),
  ]));
  // 행인 — 퇴근길 사람들.
  execTool(project, "add_street_walkers", {
    mapId: M.street,
    walkers: [
      { name: "장 보는 아주머니", graphic: { selectionId: "charset:oprn-charset-modern2:6" }, stops: [{ x: 4, y: 23 }, { x: 15, y: 23 }, { x: 15, y: 26 }, { x: 4, y: 26 }], lines: ["저 편의점 새 알바, 목소리가 엄청 우렁차더라."] },
      { name: "퇴근길 회사원", graphic: { selectionId: "charset:oprn-charset-modern3:0" }, stops: [{ x: 18, y: 23 }, { x: 27, y: 23, waitSec: 3 }], lines: ["역 앞 고로케집, 오늘도 줄이 길더라."] },
      // 학생은 두 줄 인도(10~22열)만 오간다 — 24·25열은 한 줄 목이라 마주치면 주인공과 서로 막는다(실플레이 2026-10-29).
      { name: "하굣길 학생", graphic: { selectionId: "charset:oprn-charset-modern1:6" }, stops: [{ x: 10, y: 10 }, { x: 22, y: 10 }], lines: ["해피 마트 가라아게 레드 먹어 봤어? 진짜 맛있어."] },
    ],
  });
  // 서 있는 인물(리리·고양이)이 인도를 끊지 않는다 — 편집기 문 칸에서 신사·공원·원룸까지.
  for (const [to, what] of [[fromShrine, "신사 길"], [fromPark, "공원 길"], [{ x: 13, y: 9 }, "원룸 문"]] as const) {
    mustReach(project, map, links.konbini.street, to, what);
  }
  map.defaultLighting = { ambient: 0, color: "#000000", sources: [] };
  map.bgm = { mode: "custom", resourceId: BGM_STREET } as GameMap["bgm"];
  // 저녁(4·6)은 노을빛 — 병렬 이벤트가 들어설 때 한 번 칠한다.
  map.events.push(event("ev_mk_st_dusk", "저녁빛", { x: 1, y: 9 }, [
    gone("ev_mk_st_dusk_off", []),
    page("ev_mk_st_dusk_p4", [varIs(V_STAGE, 4)], [{ kind: "setLighting", ambient: 0.5, color: "#ff6a2a", transitionMs: 0 } as Command, bgm(BGM_EVENING, 0), wait(600000)], { trigger: "parallel" }),
    page("ev_mk_st_dusk_p6", [varIs(V_STAGE, 6)], [{ kind: "setLighting", ambient: 0.68, color: "#1e2460", transitionMs: 0 } as Command, bgm(BGM_EVENING, 0), wait(600000)], { trigger: "parallel" }),
  ]));
  void links;
  return { fromPark, fromShrine };
}

// ── 6) 공원 ──
function buildPark(project: Project, backToStreet: Cell): Cell {
  const map = project.maps[M.park]!;
  const arrive = mustWalk(project, map, { x: 20, y: 9 }, "공원 입구");
  for (const x of [18, 19, 20, 21]) {
    mustWalk(project, map, { x, y: 8 }, "공원 출구");
    map.events.push(event(`ev_mk_pk_exit_${x}`, "상점가로", { x, y: 8 }, [page(`ev_mk_pk_exit_${x}_p`, [], [transfer(M.street, backToStreet, "up")], { trigger: "playerTouch" })]));
  }
  const LILY = "ev_mk_pk_lily", CAT = "ev_mk_pk_cat";
  const lilyAt = mustWalk(project, map, { x: 26, y: 14 }, "정자 앞(리리)");
  const catAt = mustWalk(project, map, { x: 28, y: 14 }, "정자 앞(고양이)");
  const meetAt = mustWalk(project, map, { x: 27, y: 15 }, "회의 자리");
  const meeting: Command[] = [
    wait(300),
    { kind: "setLighting", ambient: 0.62, color: "#141433", transitionMs: 0 } as Command,
    ...say("lily", "happy", "마왕님! 이쪽이옵니다, 정자!"),
    walkTo("@player", meetAt), face("@player", "up"),
    ...say("lily", "happy", "그럼 지금부터 제1회 사천왕 재결성 회의를 시작하겠사옵니다! 짝짝짝!"),
    ...say("maou", "base", "…참석자가 둘인데."),
    ...say("lily", "base", "셋이옵니다. 이분도 계시옵니다."),
    playSe(SE_CAT), emote(CAT, "anger"),
    ...voice("길고양이", "냐앙!"),
    ...say("lily", "base", "사천왕 제1좌, 용왕 가르곤 님이시옵니다."),
    ...say("maou", "surprised", "……가르곤!? 하늘을 뒤덮던 그 흑룡이!? 고양이가 되었단 말인가!"),
    ...voice("길고양이", "냐아. 냥, 냐앙."),
    ...say("lily", "base", "「요즘은 생선 가게 할멈이 매일 전갱이를 바친다. 나쁘지 않다」 하시옵니다."),
    ...say("maou", "sad", "…적응이 빠르군."),
    ...say("lily", "base", "제3좌 바르크 님은 홋카이도에서 소를 키우시옵니다. 엽서가 왔사옵니다. 「우유가 맛있다」."),
    ...say("lily", "base", "제4좌 노스 님은… 연락 두절이옵니다. 밤에만 일하는 직장인 듯하옵니다."),
    ...say("maou", "embarrassed", "마왕군이 뿔뿔이 흩어졌군."),
    ...say("lily", "base", "안건 1. 마왕군 재건. 안건 2. 용사 처단. 안건 3. 회비. 1인 500엔, 가르곤 님은 고양이라 면제."),
    ...say("lily", "surprised", "그리고 급보이옵니다! 용사가 이 세계에 다시 태어났사옵니다. 근처 고등학교의… 매일 고기만두를 사는 남자애."),
    ...say("maou", "surprised", "……레온."),
    ...say("lily", "base", "내일 밤은 보름달. 봉인이 가장 약해지는 밤이옵니다. 용사의 기억도, 마왕님의 힘도 돌아오옵니다."),
    ...say("lily", "happy", "그때 힘을 되찾으시면… 마왕군 재건이옵니다!"),
    choices([
      { text: "「…좋네. 마왕군을 다시 세우세」", then: [...say("lily", "happy", "와아! 마왕님 만세!"), playSe(SE_CAT), ...voice("길고양이", "냐!"), ...mp()] },
      { text: "「미안하네. 내일은 야간 근무일세」", then: [...say("lily", "surprised", "세계 정복을 두고… 근무를 고르시옵니까!?"), ...say("maou", "base", "…지각하면 히나 선배가 무섭네."), ...good()] },
      { text: "「회비 500엔은… 월급날까지 기다려 주게」", then: [...say("lily", "sad", "…마왕님, 정말로 가난하시옵니다."), playSe(SE_CAT), ...voice("길고양이", "냥…(동정)")] },
    ]),
    ...say("lily", "base", "아무튼 내일 밤, 소녀도 편의점 근처에서 대기하겠사옵니다!"),
    setSw(SW_MEETING),
    ...caption("회의가 끝났다. 원룸에서 자고 나면 사흘째 밤이다."),
  ];
  map.events.push(event("ev_mk_pk_meeting", "사천왕 재결성 회의", { x: 0, y: 0 }, [
    gone("ev_mk_pk_meeting_off", []),
    page("ev_mk_pk_meeting_p", [varIs(V_STAGE, 6), swOff(SW_MEETING)], meeting, { trigger: "auto" }),
  ]));
  map.events.push(event(LILY, "리리", lilyAt, [
    gone(`${LILY}_off`, []),
    page(`${LILY}_p6`, [varIs(V_STAGE, 6)], [faceHero(LILY), ...say("lily", "happy", "내일 밤이옵니다, 마왕님. 보름달!")], { who: "lily", dir: "down" }),
  ]));
  map.events.push(event(CAT, "길고양이", catAt, [
    gone(`${CAT}_off`, []),
    page(`${CAT}_p4`, [varIs(V_STAGE, 4)], [playSe(SE_CAT), ...voice("길고양이", "냐아."), ...think("(편의점 앞에 있던 그 고양이다. …자세가 왜 이리 거만하지.)")], { who: "cat", dir: "down" }),
    page(`${CAT}_p6`, [varIs(V_STAGE, 6)], [playSe(SE_CAT), ...voice("길고양이", "냥. (…마왕이여, 전갱이는 꼬리부터 먹게.)")], { who: "cat", dir: "down" }),
  ]));
  // 그네 곁의 아이 — 낮에 놀다 남은 아이.
  map.events.push(event("ev_mk_pk_kid", "놀던 아이", nearestFree(project, map, { x: 8, y: 18 }), [
    page("ev_mk_pk_kid_p", [], [faceHero("ev_mk_pk_kid"), ...say("student", "base", "아저씨 편의점 사람이죠? 이랏샤이마세 목소리 엄청 커서 공원까지 들려요.")], { who: "student", dir: "down" }),
  ]));
  map.defaultLighting = { ambient: 0.5, color: "#3a2a6a", sources: [
    { id: "park_lamp_1", at: { x: 15, y: 13 }, radius: 3, intensity: 0.8, color: "#ffd9a0", flicker: false },
    { id: "park_gazebo", at: { x: 27, y: 12 }, radius: 3.2, intensity: 0.9, color: "#ffc070", flicker: true },
  ] };
  map.bgm = { mode: "custom", resourceId: BGM_EVENING } as GameMap["bgm"];
  return arrive;
}

// ── 4·6) 신사 ──
function buildShrine(project: Project, backToStreet: Cell): Cell {
  const map = project.maps[M.shrine]!;
  const arrive = mustWalk(project, map, { x: 19, y: 26 }, "신사 입구");
  for (const x of [18, 19, 20, 21]) {
    if (!isPassable(project, map, x, 27)) continue;
    map.events.push(event(`ev_mk_sh_exit_${x}`, "상점가로", { x, y: 27 }, [page(`ev_mk_sh_exit_${x}_p`, [], [transfer(M.street, backToStreet, "down")], { trigger: "playerTouch" })]));
  }
  const LEON = "ev_mk_sh_leon";
  map.events.push(event(LEON, "레온", nearestFree(project, map, { x: 15, y: 7 }), [
    gone(`${LEON}_off`, []),
    page(`${LEON}_p4`, [varIs(V_STAGE, 4)], [
      faceHero(LEON),
      ...say("leon", "base", "…어, 편의점 아저씨? 이 시간에 신사엔 왜요."),
      ...say("maou", "base", "(용사…!) …산책일세. 자네야말로 여기서 뭘 하나."),
      ...say("leon", "base", "검도부요. 집에선 연습할 데가 없어서."),
      ...say("leon", "sad", "…요즘 이상한 꿈을 꿔요. 망토 두른 보라색 놈이 「세계의 절반을 주마」 이러는 꿈."),
      emote("player", "sweat", 1200),
      ...say("leon", "base", "그 꿈만 꾸면 이상하게 고기만두가 당겨요. 그래서 맨날 사러 가요."),
      ...say("maou", "embarrassed", "……그렇군. 고기만두는 맛있다네."),
      ...think("(아직 기억은 돌아오지 않았다. …돌아오면, 어찌 되려나.)"),
    ], { who: "leon", dir: "right" }),
  ]));
  // 배전 — 새전함에 5엔.
  const hall = mustBlock(project, map, { x: 29, y: 7 }, "새전함");
  mustWalk(project, map, { x: 29, y: 8 }, "배전 앞");
  map.events.push(event("ev_mk_sh_hall", "배전", hall, [
    page("ev_mk_sh_hall_p", [], [
      face("@player", "up"),
      ...caption("새전함에 5엔을 넣고 손뼉을 두 번 쳤다. 이 세계의 신에게 비는 법이라고 히나 선배가 알려 주었다."),
      choices([
        { text: "세계 정복", then: [...caption("…바람 소리만 들린다. 5엔으로는 어림없나 보다.")] },
        { text: "시급 인상", then: [...caption("방울이 딸랑, 하고 울렸다. 어쩐지 이루어질 것 같다."), playSe(SE_BELL)] },
        { text: "…내일도 무사한 하루", then: [...caption("마음이 이상하게 가벼워졌다."), ...think("(마왕이 「무사한 하루」를 빌다니. …나쁘지 않은 기분이다.)")] },
      ]),
    ], { priority: "same" }),
  ]));
  // 오미쿠지
  map.events.push(event("ev_mk_sh_kuji", "오미쿠지", mustBlock(project, map, { x: 23, y: 15 }, "오미쿠지 상자"), [
    page("ev_mk_sh_kuji_p4", [], [
      ...caption("오미쿠지를 뽑았다."),
      ...note("대흉", "직장  옛 원수와 다시 만난다 · 금전  0에서 시작했으니 오를 일만 남았다", "연애  선배를 공경하라"),
      ...think("(…이 세계의 점술, 묘하게 정확하다.)"),
    ], { priority: "same" }),
    page("ev_mk_sh_kuji_p6", [varIs(V_STAGE, 6)], [
      ...caption("오미쿠지를 한 번 더 뽑았다."),
      ...note("길", "내일 밤, 큰 선택을 하게 된다.", "웃는 얼굴을 잊지 말 것."),
      ...think("(…웃는 얼굴. 매뉴얼 제3조와 같은 말이군.)"),
    ], { priority: "same" }),
  ]));
  // 등롱 광원은 두지 않는다 — 노을 색조 속에서 광원 둘레만 원래 회색 돌바닥이 드러나 검은 얼룩처럼 보였다(적대 검수 2026-10-29).
  map.defaultLighting = { ambient: 0.5, color: "#ff8a4a", sources: [] };
  map.events.push(event("ev_mk_sh_dusk", "저녁빛", { x: 0, y: 0 }, [
    gone("ev_mk_sh_dusk_off", []),
    page("ev_mk_sh_dusk_p6", [varIs(V_STAGE, 6)], [{ kind: "setLighting", ambient: 0.6, color: "#2a2a6a", transitionMs: 0 } as Command, wait(600000)], { trigger: "parallel" }),
  ]));
  map.bgm = { mode: "custom", resourceId: BGM_SHRINE } as GameMap["bgm"];
  return arrive;
}

// ── 엔딩 ──
// 에필로그는 엔딩 장면(buildCrisis 의 endingScene)이 엔딩 그림 위에서 대사로 흘린다. 카드는 제목·크레딧만 — 같은 문장을 두 번 보이지 않는다.
function defineEndings(project: Project): void {
  const credits = [
    "『전생한 마왕, 편의점 알바 시작하다』",
    "",
    "이야기 · 연출   OPRN Flagship Studio",
    "거리 · 가게 그림   OPRN 일본 도시 타일 · 현대 도시 타일 · 손 도트 실내 타일",
    "인물   OPRN 현대 걷기 캐릭터 · 공용 흉상 · EasyRPG RTP",
    "음악 · 효과음   CC0 음원 · EasyRPG RTP",
    "",
    "만든 도구   OPRN Studio",
    "",
    "이랏샤이마세. 또 오십시오.",
  ].join("\n");
  // 배지로 세 결말을 가른다 — 비우면 둘 다 「해피 엔딩」이 붙어 최고·보통 엔딩이 같은 카드로 보였다(VQA 2026-10-29).
  const end = (id: string, name: string, priority: number, tone: "warm" | "dark", kicker: string, badge: string, backgroundResourceId: string) =>
    execTool(project, "define_ending", {
      id, name, priority, conditions: [],
      presentation: { kicker, badge, musicResourceId: BGM_END, tone, portraits: "none", credits, backgroundResourceId },
      epilogue: [],
    });
  end(END_BEST, "이달의 우수 사원", 10, "warm", "해피 마트 사쿠라자카점", "최고 엔딩", END_ART.best);
  end(END_OK, "내일도 출근합니다", 5, "warm", "해피 마트 사쿠라자카점", "보통 엔딩", END_ART.ok);
  end(END_POWER, "마왕 재림… 그리고 변상", 5, "dark", "암흑 마왕 제르바스", "마왕 엔딩", END_ART.power);
}

export function createMaouKonbiniFlagshipDemo(): FlagshipDemoBuildResult {
  const project = createBlankProject();
  project.meta.title = "전생한 마왕, 편의점 알바 시작하다";
  project.meta.author = "OPRN Flagship Studio";
  project.system.playResolution = { width: 480, height: 270 };
  delete project.system.cameraZoom;
  project.system.dialogueStyle = "glass";

  const ensureVar = (id: string, name: string): void => { if (!project.variables.some((v) => v.id === id)) project.variables.push({ id, name }); };
  const ensureSw = (id: string, name: string): void => { if (!project.switches.some((s) => s.id === id)) project.switches.push({ id, name }); };
  for (const [id, name] of [[V_STAGE, "마왕 진행 단계"], [V_TASKS, "오늘 마친 업무"], [V_SERVICE, "근무 평가"], [V_MAOU, "마왕력"], [V_PICK, "고른 번호(잠깐)"]] as const) ensureVar(id, name);
  for (const [id, name] of [[SW_SHIFT, "근무 중"], [SW_TANAKA, "다나카 씨 주문을 외움"], [SW_LILY, "리리와 재회"], [SW_MEETING, "사천왕 재결성 회의"], [SW_LOST, "매뉴얼 결전에서 짐"]] as const) ensureSw(id, name);

  setupDatabase(project);
  const links = buildMaps(project);
  const roomWake = buildRoom(project, links, { x: 0, y: 0 });
  const konbiniArrive = buildKonbini(project, links);
  // 원룸 침대 → 편의점 출근 자리를 채운다.
  for (const e of project.maps[M.room]!.events) for (const p of e.pages ?? []) for (const c of p.commands as unknown as Record<string, unknown>[]) {
    if (c.kind === "transfer" && c.mapId === M.konbini) { c.x = konbiniArrive.x; c.y = konbiniArrive.y; }
  }
  const parkArrive = { x: 20, y: 9 }, shrineArrive = { x: 19, y: 26 };
  const { fromPark, fromShrine } = buildStreet(project, links, parkArrive, shrineArrive);
  buildPark(project, fromPark);
  buildShrine(project, fromShrine);
  const throneStart = buildMaouThrone(project, roomWake);
  stageMaouRoomWake(project);
  buildMaouOpening(project);
  defineEndings(project);

  setupMaouTitle(project);

  for (const id of Object.values(M)) { const m = project.maps[id]!; if (!m.defaultLighting) m.defaultLighting = { ambient: 0, color: "#000000", sources: [] }; }

  project.characters = {
    ...(project.characters ?? {}),
    hina: { displayName: "히나", note: "해피 마트 2년 차 알바. 대학생. 마오의 선배." },
    lily: { displayName: "리리", note: "옛 사천왕 몽마 리리스. 지금은 찻집 코스모스 알바." },
    leon: { displayName: "레온", note: "옛 용사. 지금은 근처 고등학교 검도부. 매일 고기만두를 산다." },
  };
  project.meta.oprnFieldMenu = { version: 1, entries: [
    { command: "backlog", label: "대화 기록" }, { command: "endings", label: "엔딩" },
    { command: "save", label: "저장" }, { command: "load", label: "불러오기" }, { command: "options", label: "설정" }, { command: "to-title", label: "타이틀로" },
  ] };

  project.startMapId = M.throne;
  project.startPos = throneStart;
  project.mapTree = { mapId: M.street, children: [M.throne, M.room, M.konbini, M.park, M.shrine].map((mapId) => ({ mapId, children: [] })) };

  // HUD — 근무 중에만 「오늘 업무 n/3」.
  execTool(project, "set_project_settings", { fieldHud: { widgets: [
    { id: "tasks", kind: "gauge", source: "variable", variableId: V_TASKS, max: 3, shape: "number", label: "오늘 업무", anchor: "top-left", x: 8, y: 14, width: 104, height: 30, panel: "paper", color: "#3aa860", condition: "switch", switchId: SW_SHIFT },
  ] } });
  execTool(project, "set_project_settings", { resources: { titleResourceId: "oprn-maou-konbini-title", defaultBgmResourceId: BGM_SHOP } });

  // 장면 스위치(작업 완료·손님 퇴장·브리핑 등)를 모두 등록한다 — 등록하지 않은 스위치 조건은 프로젝트 검사가 거절한다.
  for (const id of new Set(JSON.stringify(project.maps).match(/sw_(?:ev_)?mk_[a-z0-9_]+/g) ?? [])) ensureSw(id, id.replace(/^sw_(ev_)?mk_/, "마왕 · "));
  const keepTilesets = new Set(Object.values(project.maps).map((m) => m.tilesetId));
  for (const id of [...keepTilesets]) for (const graft of project.tilesets[id]?.tileGrafts ?? []) keepTilesets.add(graft.sourceChipset);
  for (const id of Object.keys(project.tilesets)) if (!keepTilesets.has(id)) delete project.tilesets[id];

  // 이야기 탭(세계 개요·백과·인물) — 조수 도구 set_world_canon·upsert_world_codex 로 짓는다(maouKonbiniLore.ts).
  applyMaouKonbiniLore(project, (target, name, args) => execTool(target, name, args));

  const serialized = serialize(project);
  const reloaded = deserialize(serialized);
  return {
    id: "maou-konbini",
    manifest: { ...FLAGSHIP_BEAT_MANIFESTS["maou-konbini"], mapCount: Object.keys(reloaded.maps).length, endingCount: reloaded.endings?.length ?? 0 },
    project: reloaded,
    serialized,
  };
}
