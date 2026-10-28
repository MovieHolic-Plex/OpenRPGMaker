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
import { openingMapViewCrop } from "@/project/openingMapView";
import type { ActorRecord as Actor, Command, EnemyRecord as Enemy, GameMap, Project, TroopRecord as Troop } from "@/project/types";
import { FLAGSHIP_BEAT_MANIFESTS } from "./beats";
import {
  approach, bgm, CAST, caption, type Cell, choices, clearTint, emote, event, execTool, exitVia, face, faceHero, fadeIn, fadeOut, flash,
  gone, ifCond, letter, mustBlock, mustWalk, nearestFree, page, playSe, say, setSw, setVar, shake, stopBgm, swOff, swOn, think, thinkAs,
  tint, transfer, varAtLeast, varIs, voice, wait, walk, walkTo, type Who,
} from "./maouKonbiniKit";
import type { FlagshipDemoBuildResult } from "./types";

// ── 상태 ──
const V_STAGE = "var_mk_stage";
const V_TASKS = "var_mk_tasks";
const V_SERVICE = "var_mk_service";
const SW_SHIFT = "sw_mk_on_shift";
const SW_TANAKA = "sw_mk_tanaka_order"; // 다나카 씨의 「늘 먹던 거」를 배웠다
const SW_LILY = "sw_mk_lily_met";
const SW_MEETING = "sw_mk_meeting_done";
/** 「이달의 우수 사원」 문턱 — 사흘 동안 고를 수 있는 모범 응대는 13번. */
const BEST_AT = 8;

const END_BEST = "end_mk_best_employee";
const END_OK = "end_mk_tomorrow_too";
const END_POWER = "end_mk_maou_returns";

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
const BGM_TITLE = "cc0-bgm-rtp-com-001"; // 장난꾼의 수레 — 타이틀
const BGM_THRONE = "cc0-bgm-rtp-thr-001";
const BGM_BOSS = "cc0-bgm-rtp-btl-002";
const BGM_ROOM = "cc0-bgm-rtp-rad-001";
const BGM_SHOP = "cc0-bgm-rtp-qui-001";
const BGM_STREET = "cc0-bgm-rtp-crx-001";
const BGM_EVENING = "cc0-bgm-rtp-prk-001";
const BGM_SHRINE = "cc0-bgm-rtp-mys-001";
const BGM_NIGHT = "cc0-bgm-rtp-rst-001";
const BGM_MANUAL = "cc0-bgm-rtp-btl-001";
const BGM_END = "cc0-bgm-rtp-res-002";
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
  cloneSkill("skill_weaken", "skill_mk_irasshai", { name: "이랏샤이마세!", mpCost: noMp, successRate: 100, description: "가게 안을 울리는 우렁찬 인사. 상대의 기세를 꺾는다.",
    stateEffects: [{ stateId: "state_attack_down", chance: 100, operation: "add" }] });
  cloneSkill("skill_sleep_mist", "skill_mk_point_card", { name: "포인트 카드 있으세요?", mpCost: { flat: 4, percentMax: 0 }, successRate: 85, description: "누구든 한순간 지갑을 뒤지게 만드는 질문. 상대가 멈칫한다." });
  cloneSkill("skill_holy", "skill_mk_nikuman", { name: "따끈한 고기만두", power: 120, mpCost: { flat: 8, percentMax: 0 }, description: "갓 쪄낸 고기만두를 건넨다. 분노를 녹이는 따뜻함." });
  cloneSkill("skill_heal", "skill_mk_smile", { name: "0엔 스마일", power: 60, mpCost: { flat: 5, percentMax: 0 }, scope: "self", description: "매뉴얼 제3조. 손님께는 언제나 미소로. 자신을 다잡는다." });
  // 용사 레온(적) 기술
  cloneSkill("skill_sword_slash", "skill_mk_holy_blade", { name: "성검 일섬", power: 85, mpCost: noMp, description: "용사의 검이 빛을 끌며 내려친다." });
  cloneSkill("skill_sword_slash", "skill_mk_umbrella", { name: "비닐우산 찌르기", power: 70, mpCost: noMp, description: "성검은 없다. 편의점 비닐우산이 있을 뿐." });
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
  hero.nickname = "전(前) 마왕 · 신입 알바";
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
    battleCharacterResourceId: "charset-battler-actor1-4", initialLevel: 40, learnedSkills: [] } as Actor;
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
  makeEnemy("enemy_mk_leon_angry", "분노한 고교생 레온", { maxHp: 520, maxMp: 0, attack: 62, defense: 30, mind: 30, agility: 40 },
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
    [{ preset: "stars", opacity: 55 }, { preset: "glow", opacity: 35 }]);
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

  const street = project.maps[M.street]!;
  // 거리 지붕·남쪽 강둑 너머는 걸어 들어가면 안 된다 — 지붕 윗면은 위층 타일이라 땅 위로 걸어 다닐 수 있었다(탐침 2026-10-29).
  // jp_city 의 투명 통행 불가 칸(851)을 맨 위 겹층(4층)에 깔아 막는다 — 통행은 위층부터 정하므로 아래 겹층은 지붕의 O 에 졌다. 세로 큰길과 다리(29~33열)는 남긴다.
  const BLOCK = 851;
  const W = street.width;
  street.upperOverlayTiles = street.upperOverlayTiles ?? new Array(W * street.height).fill(-1);
  for (let y = 0; y < street.height; y++) {
    if (!(y <= 7 || (y >= 15 && y <= 22))) continue;
    for (let x = 0; x < W; x++) if (x < 29 || x > 33) street.upperOverlayTiles[y * W + x] = BLOCK;
  }
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

// ── 0) 마왕성 옥좌의 방 ──
function buildThrone(project: Project, roomWake: Cell): Cell {
  const map = project.maps[M.throne]!;
  const start = mustWalk(project, map, { x: 23, y: 5 }, "옥좌 앞");
  mustBlock(project, map, { x: 23, y: 4 }, "옥좌");
  const leonAt = mustWalk(project, map, { x: 23, y: 9 }, "용사 자리");
  const garetAt = nearestFree(project, map, { x: 22, y: 10 }, [leonAt]);
  const miraAt = nearestFree(project, map, { x: 24, y: 10 }, [leonAt, garetAt]);
  const L = "ev_mk_t_leon", G = "ev_mk_t_garet", R = "ev_mk_t_mira";
  const fight: Command[] = [
    ...fadeIn(900),
    ...caption("마계력 999년. 마왕성 최상층, 옥좌의 방."),
    ...say("leonF", "base", "여기까지다, 마왕 제르바스! 사천왕은 모두 쓰러뜨렸다!"),
    ...say("maouF", "base", "……사천왕? 아, 걔들 오늘 칼퇴했다."),
    ...say("leonF", "base", "…뭐?"),
    ...say("maouF", "base", "잘 왔다, 용사여. 너를 기다리다 옥좌에 엉덩이 자국이 났다."),
    ...say("maouF", "base", "그래서 제안 하나 하지. 나와 손을 잡는다면 — 세계의 절반을 주마."),
    ...say("leonF", "base", "거절한다!"),
    ...say("maouF", "base", "그럼 4분의 1."),
    ...say("leonF", "base", "거절한다!!"),
    ...say("maouF", "base", "8분의 1. 연금과 휴가 포함."),
    ...say("mira", "base", "…레온, 저거 은근히 조건 좋은데?"),
    ...say("leonF", "base", "미라, 흔들리지 마! 그리고 마왕, 협상하지 마!"),
    ...say("garet", "base", "(나도 휴가는 좀 끌리는데…)"),
    emote(L, "anger"),
    ...say("maouF", "base", "흥. 어리석은 것들. 그렇다면 힘으로 굴복시켜 주마!"),
    shake(500, "3"), playSe(SE_DARK),
    { kind: "battleProcessing", troopId: "troop_mk_castle", canEscape: false, canLose: true, branchOnResult: true,
      victoryBranch: [
        ...say("maouF", "base", "크하하하! 이것이 마왕의 힘이다!"),
        ...say("leonF", "base", "아직이다…! 이 목숨을 걸고 — 금단의 봉인술!"),
      ],
      defeatBranch: [
        ...say("leonF", "base", "끝이다, 마왕! …어? 왜 안 쓰러져?"),
        ...say("maouF", "base", "마왕은 체력이 0이 되어도 2페이즈가 있다. 상식이다."),
        ...say("leonF", "base", "치사하잖아!! 그렇다면 — 금단의 봉인술!"),
      ] } as Command,
    ...say("leonF", "base", "『동귀어진』! 너도 나도, 이 세계에서 사라지는 거다!"),
    ...say("maouF", "base", "뭐, 뭐라고!? 잠깐, 연금은 어떻게 되는—"),
    playSe(SE_FLASH), flash("white", 900), shake(900, "6"), wait(400),
    { kind: "setLighting", ambient: 0, color: "#ffffff", transitionMs: 0 } as Command,
    flash("white", 1400), playSe(SE_BOOM), wait(900),
    ...caption("빛이 모든 것을 삼켰다."),
    stopBgm(),
    ...fadeOut(1200),
    wait(800),
    setVar(V_STAGE, "=", 1),
    // 전생 — 파티가 현대의 몸(마오)으로 바뀐다.
    { kind: "changeParty", actorId: DEFAULT_ACTOR_ID, action: "add" } as Command,
    { kind: "changeParty", actorId: DEFAULT_ACTOR_ID, action: "lead" } as Command,
    { kind: "changeParty", actorId: MAOU_TRUE, action: "remove" } as Command,
    transfer(M.room, roomWake, "down"),
  ];
  map.events.push(event("ev_mk_throne_scene", "최후의 결전", { x: 1, y: 1 }, [
    page("ev_mk_throne_scene_p", [varIs(V_STAGE, 0)], fight, { trigger: "auto" }),
    gone("ev_mk_throne_scene_done", [varAtLeast(V_STAGE, 1)]),
  ]));
  map.events.push(event(L, "용사 레온", leonAt, [page(`${L}_p`, [], [...say("leonF", "base", "각오해라, 마왕!")], { who: "leonF", dir: "up" })]));
  map.events.push(event(G, "성기사 가렛", garetAt, [page(`${G}_p`, [], [...say("garet", "base", "…")], { who: "garet", dir: "up" })]));
  map.events.push(event(R, "마법사 미라", miraAt, [page(`${R}_p`, [], [...say("mira", "base", "…")], { who: "mira", dir: "up" })]));
  map.defaultLighting = {
    ambient: 0.5, color: "#2a0618",
    sources: [
      { id: "throne_glow", at: { x: 23, y: 4 }, radius: 4.5, intensity: 1, color: "#b03cff", flicker: true },
      { id: "brazier_l", at: { x: 20, y: 4 }, radius: 2.4, intensity: 0.9, color: "#ff7a2a", flicker: true },
      { id: "brazier_r", at: { x: 26, y: 4 }, radius: 2.4, intensity: 0.9, color: "#ff7a2a", flicker: true },
      { id: "hall_l", at: { x: 18, y: 8 }, radius: 2.2, intensity: 0.7, color: "#ff7a2a", flicker: true },
      { id: "hall_r", at: { x: 28, y: 8 }, radius: 2.2, intensity: 0.7, color: "#ff7a2a", flicker: true },
    ],
  };
  map.bgm = { mode: "custom", resourceId: BGM_THRONE } as GameMap["bgm"];
  return start;
}

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
    ...zs("surprised", "여기는… 어디지? 마왕성의 침실은 이렇게 좁지 않았다. 옷장보다 작은 방이라니."),
    walk("@player", ["right", "right"]),
    face("@player", "up"),
    ...zs("surprised", "잠깐. 이 손. 이 다리. …뿔이 없다! 망토도 없다! 어째서 올리브색 재킷을 입고 있는 것이냐!"),
    shake(300),
    ...caption("탁자 위에 통장 한 권과 봉투 하나가 놓여 있다."),
    walkTo("@player", { x: 11, y: 6 }), face("@player", "right"),
    playSe(SE_PAPER),
    ...letter("「이세계 전생 관리국 안내문」", "귀하는 『동귀어진』 처리로 지구·일본에 전생되었습니다.", "마력은 봉인되었습니다. 생활비는 스스로 버십시오.", "※ 이 안내문은 읽은 뒤 분리수거해 주십시오."),
    ...zs("embarrassed", "…분리수거가 뭐냐."),
    playSe(SE_PAPER),
    ...letter("통장 잔고", "0엔"),
    shake(500, "3"),
    ...zs("sad", "0. 마계 금화로 환산하면… 역시 0이다."),
    ...zs("sad", "세계의 절반을 가졌던 이 몸이, 잔고 0."),
    ...zs("base", "…좋다. 이 몸은 마왕이다. 어느 세계에서든 결국 정상에 선다."),
    ...zs("happy", "우선은 — 돈이다."),
    playSe(SE_PAPER),
    ...caption("현관 쪽에서 종이가 바스락거렸다. 문틈으로 전단지가 들어와 있다."),
    setSw("sw_mk_woke"),
  ];
  const flyer: Command[] = [
    playSe(SE_PAPER),
    ...letter("★ 아르바이트 급구 ★", "해피 마트 사쿠라자카점", "시급 1,150엔 · 초보 환영 · 유니폼 지급", "폐기 도시락 있음(?)", "이 건물 바로 왼쪽입니다!"),
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
    page("ev_mk_bed_p6", [varIs(V_STAGE, 6)], [...think("리리가 공원에서 기다린다고 했다. 회의를 바람맞히는 건 마왕의 품격이 아니다. (거리 남쪽 큰길 끝 → 공원)")], { priority: "same" }),
    page("ev_mk_bed_p6m", [varIs(V_STAGE, 6), swOn(SW_MEETING)], sleep(7, "사흘째. 오늘은 야간 근무다.", []), { priority: "same" }),
  ];
  for (const x of [2, 3]) map.events.push(event(`ev_mk_bed_${x}`, "침대", mustBlock(project, map, { x, y: 4 }, "침대"), bedPages.map((p) => ({ ...p, id: `${p.id}_${x}` }))));
  map.events.push(event("ev_mk_fridge", "냉장고", mustBlock(project, map, { x: 11, y: 3 }, "냉장고"), [
    page("ev_mk_fridge_p", [], [...caption("냉장고를 열었다. 마요네즈 하나와 차가운 공기뿐이다."), ...think("…이 세계의 마요네즈는 마계의 독보다 강한 중독성이 있다고 들었다. 아껴 두자.")], { priority: "same" }),
    page("ev_mk_fridge_p2", [varAtLeast(V_STAGE, 4)], [...caption("폐기 도시락이 하나 들어 있다. 히나 선배가 몰래 챙겨 준 것이다."), ...think("…선배. 이 은혜, 세계를 되찾으면 반드시 갚겠다.")], { priority: "same" }),
  ]));
  map.events.push(event("ev_mk_pc", "책상", mustBlock(project, map, { x: 1, y: 10 }, "책상"), [
    page("ev_mk_pc_p", [], [...caption("낡은 노트북. 검색창에 「암흑 마왕 제르바스」를 쳐 본다."), ...letter("검색 결과 0건", "혹시 「제르바스 고양이 사료」를 찾으셨나요?"), ...think("…이 세계에서 나는 무명이다.")], { priority: "same" }),
  ]));
  map.defaultLighting = { ambient: 0.08, color: "#fff0d6", sources: [] };
  map.bgm = { mode: "custom", resourceId: BGM_ROOM } as GameMap["bgm"];
  return wake;
}

// ── 2~3·5·7) 편의점 ──
function buildKonbini(project: Project, links: Links): Cell {
  // 가게는 화면보다 낮아서(16줄) 카메라가 가운데에 고정되고, 흉상 대화창이 계산대·손님 줄(11~14줄)을 덮었다(실플레이 2026-10-29).
  // 아래에 빈 줄 넷을 덧대면 카메라가 점원을 따라가 계산대가 창 위로 올라온다. 덧댄 줄은 빈 칸(검은 바탕)이다.
  {
    const old = project.maps[M.konbini]!;
    const oldH = old.height;
    execTool(project, "resize_map", { mapId: M.konbini, width: old.width, height: oldH + 4 });
    const m = project.maps[M.konbini]!;
    for (let y = oldH; y < m.height; y++) for (let x = 0; x < m.width; x++) {
      const i = y * m.width + x;
      m.lowerTiles[i] = -1; m.upperTiles[i] = -1;
      if (m.lowerOverlayTiles) m.lowerOverlayTiles[i] = -1;
      if (m.upperOverlayTiles) m.upperOverlayTiles[i] = -1;
    }
    for (let x = 0; x < m.width; x++) mustBlock(project, m, { x, y: oldH }, "덧댄 빈 줄");
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
    ...say("manager", "happy", "어서 오세요~ 해피 마트입니다! …아, 그 전단지! 면접 보러 왔구나?"),
    ...zs("base", "그렇다. 이 몸이 직접 왔다. 영광으로 알아라."),
    ...say("manager", "surprised", "(굉장한 자신감이네…) 그, 그래. 이쪽으로 와 볼래?"),
    walkTo("@player", Q1), face("@player", "up"),
    ...say("manager", "base", "이력서는 가져왔어?"),
    ...zs("surprised", "…이력서?"),
    ...caption("제르바스는 품에서 종이 한 장을 꺼냈다. 관리국 안내문의 뒷면에, 밤새 써 둔 것이다."),
    playSe(SE_PAPER),
    ...say("manager", "base", "어디 보자. 이름, 암흑 마왕 제르바스. …외국 분이세요?"),
    ...zs("base", "마계 출신이다."),
    ...say("manager", "happy", "아~ 마계. 시골 쪽이구나. 공기 좋겠다."),
    ...say("manager", "base", "경력… 「마왕군 총사령관 999년, 세계의 절반 정복」."),
    ...say("manager", "happy", "관리직 경험 있음, 이라고 적을게."),
    ...say("manager", "surprised", "특기는… 「세계 멸망」? 음, 멸망은 좀 곤란한데. 다른 건 없어?"),
    choices([
      { text: "인간을 공포로 지배할 수 있다", then: [...say("manager", "happy", "진상 손님 대응 가능! 좋네, 그거 귀한 능력이야.")] },
      { text: "밤을 새워도 멀쩡하다", then: [...say("manager", "happy", "야간 가능! 최고야. 요즘 야간 할 사람이 없거든.")] },
      { text: "…성실하게 일하겠다", then: [...say("manager", "happy", "…그게 제일 중요해. 고마워."), ...good()] },
    ]),
    ...say("manager", "base", "마지막으로, 지원 동기는?"),
    choices([
      { text: "세계를 다시 손에 넣기 위해서다", then: [...say("manager", "happy", "꿈이 크네! 일단 이 가게부터 손에 넣어 보자.")] },
      { text: "통장 잔고가 0엔이다", then: [...say("manager", "sad", "…솔직해서 좋아. 그거 꽤 급하네."), ...good()] },
      { text: "여기 고기만두가 맛있어 보였다", then: [...say("manager", "happy", "안목 있네! 그거 내가 직접 발주하는 거야.")] },
    ]),
    ...say("manager", "happy", "좋아, 합격! 오늘부터 바로 나와 줄 수 있지?"),
    ...say("manager", "base", "그리고 이름. 제르바스는 명찰에 안 들어가니까… 마오 군이라고 부를게."),
    ...zs("surprised", "마오…? 이 몸의 이름을 감히 멋대로 줄이다니—"),
    ...say("manager", "happy", "명찰 벌써 뽑았어."),
    ...caption("명찰에는 큼직하게 「마오」라고 적혀 있다."),
    ...say("maou", "embarrassed", "……마오다. 잘 부탁한다."),
    faceHero(HINA_ID),
    ...say("hina", "happy", "점장님, 신입이에요? 와, 말투 대박. 연극 동아리야?"),
    ...say("maou", "base", "말투가 아니다. 품격이다."),
    ...say("hina", "happy", "ㅋㅋ 뭐야 그 설정. 나 히나. 대학생이고 여기 2년 차. 모르는 거 있음 물어봐~"),
    ...say("maou", "base", "히나라고 했나. 좋다. 너를 이 몸의 첫 번째 부하로 임명—"),
    ...say("hina", "base", "선배라고 불러."),
    ...say("maou", "embarrassed", "…히나 선배."),
    ...say("manager", "base", "자, 마오 군. 오늘 할 일은 세 가지야. 계산대, 진열, 분리수거."),
    ...say("manager", "happy", "막히면 히나한테 물어보고. 난 백룸에서 서류 할게. 파이팅!"),
    ...caption("편의점 매뉴얼 제1조. 「손님이 오시면 큰 소리로 인사한다.」"),
    ...say("maou", "base", "…마왕군 군율보다 짧군. 좋다, 외웠다."),
    ...fadeOut(500),
    setVar(V_STAGE, "=", 3), setVar(V_TASKS, "=", 0), setSw(SW_SHIFT),
    transfer(M.konbini, CLERK, "down"),
    ...fadeIn(500),
    ...caption("첫째 날 · 오전 10시. 근무 시작.", "오늘의 업무: 계산대 · 상자 진열 · 분리수거"),
  ];
  ev(event("ev_mk_ctrl_interview", "면접", { x: 0, y: 0 }, [
    gone("ev_mk_ctrl_interview_off", []),
    page("ev_mk_ctrl_interview_p", [varIs(V_STAGE, 2)], interview, { trigger: "auto" }),
  ]));

  // ── 점장(앞: 면접·퇴근 뒤 / 뒤: 근무 중 백룸) ──
  ev(event(MGR_F, "사토미 점장", CLERK, [
    gone(`${MGR_F}_off`, []),
    page(`${MGR_F}_p2`, [varIs(V_STAGE, 2)], [], { who: "manager" }),
    page(`${MGR_F}_p4`, [varIs(V_STAGE, 4)], [faceHero(MGR_F), ...say("manager", "happy", "어라, 마오 군? 오늘은 퇴근했잖아. 푹 쉬고 내일 봐!")], { who: "manager" }),
    page(`${MGR_F}_p6`, [varIs(V_STAGE, 6)], [faceHero(MGR_F), ...say("manager", "base", "내일은 야간이지? 히나랑 둘이니까 잘 부탁해. 밤에는 가끔… 이상한 손님이 와.")], { who: "manager" }),
  ]));
  const progress: Command[] = [
    ifCond(varIs(V_TASKS, 0), [...say("manager", "base", "아직 시작 전이네. 계산대부터 가 볼까?")]),
    ifCond(varIs(V_TASKS, 1), [...say("manager", "happy", "하나 끝냈구나. 남은 것도 천천히.")]),
    ifCond(varIs(V_TASKS, 2), [...say("manager", "happy", "거의 다 왔어! 하나만 더.")]),
  ];
  ev(event(MGR_B, "사토미 점장", BACK, [
    gone(`${MGR_B}_off`, []),
    page(`${MGR_B}_p3`, [varIs(V_STAGE, 3)], [faceHero(MGR_B), ...say("manager", "base", "오늘 할 일은 계산대, 상자 진열, 분리수거. 모르는 건 히나한테!"), ...progress], { who: "manager" }),
    page(`${MGR_B}_p5`, [varIs(V_STAGE, 5)], [faceHero(MGR_B), ...say("manager", "base", "오늘은 계산대, 핫스낵, 그리고 발주야. 발주 단말은 내 옆 책상."), ...progress], { who: "manager" }),
  ]));

  // ── 히나 ──
  const hinaTalk = (stage: number): Command[] => {
    const lines: Record<number, Command[]> = {
      2: [],
      3: [...say("hina", "happy", "마오, 손님 오면 계산대 앞에 서서 말 걸면 돼. 「데워 드릴까요?」 이런 거."), ...say("hina", "base", "상자는 통로에 있고, 분리수거함은 입구 옆. 쉽지?")],
      5: [...say("hina", "base", "아침엔 다나카 씨 와. 단골. 말 거의 안 하는데 엄청 착해."), ...say("hina", "happy", "핫스낵은 내 담당이었는데 오늘은 마오가 해 봐. 가라아게 레드, 우리 가게 간판이야.")],
      7: [...say("hina", "base", "야간은 조용해서 좋아. …가끔 이상한 사람 오는 거 빼면."), ...say("hina", "happy", "택배 상자 또 왔어. 잡지야. 그리고 백룸 폐기 정리도 부탁!")],
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
      { text: "「차갑게 먹어라. 그것이 수행이다」", then: [wrong(), ...say("ol", "surprised", "…네?"), ...say("hina", "surprised", "마오! 「데워 드릴까요?」가 먼저야!"), ...say("maou", "embarrassed", "…데워 드릴까요.")] },
      { text: "「지옥의 업화로 데워 주마」", then: [flash("red", 260), playSe(SE_DARK), shake(300), wait(300), playSe(SE_BELL),
        ...say("ol", "surprised", "…방금 전자레인지에서 불기둥 나오지 않았어요?"), ...say("hina", "surprised", "500와트로 1분 30초! 버튼 누르면 돼, 버튼!"), ...say("maou", "embarrassed", "…버튼. 알겠다.")] },
    ]),
    ...say("maou", "base", "봉투는 필요하신가. 3엔이다."),
    ...say("ol", "happy", "아, 괜찮아요. 에코백 있어요."),
    ...say("maou", "surprised", "(스스로 봉투를 들고 다니다니. 이 세계의 백성은 준비성이 좋다.)"),
    ...say("ol", "happy", "고맙습니다~"),
    ...say("maou", "base", "…또 오너라."),
    ...say("hina", "base", "「또 오세요」!"),
    ...next("ev_mk_c1a", "ev_mk_c1b"),
    ...say("student", "base", "컵라면 하나요."),
    playSe(SE_BEEP),
    choices([
      { text: "「젓가락 드릴까요?」", then: [...say("student", "happy", "네! 하나요."), ...good()] },
      { text: "「젓가락 천 벌을 하사하마」", then: [wrong(), ...say("student", "surprised", "…천 벌이요? 저 혼자 먹는데요."), ...say("hina", "happy", "ㅋㅋㅋ 한 벌만 줘, 한 벌만.")] },
      { text: "「손으로 먹어라」", then: [wrong(), ...say("student", "sad", "…뜨거운데요?"), ...say("hina", "surprised", "젓가락! 계산대 밑 서랍!")] },
    ]),
    ...next("ev_mk_c1b", "ev_mk_c1c"),
    ...say("teen", "base", "(캔맥주를 내려놓으며) …이거요."),
    ...think("(이 녀석, 어려 보인다. 히나 선배가 말했던 「연령 확인」인가.)"),
    choices([
      { text: "「연령 확인 버튼을 눌러 주세요」", then: [...say("teen", "embarrassed", "…아, 저 그냥 콜라로 할게요."), ...say("hina", "happy", "오, 잘했어!"), ...good()] },
      { text: "「너의 영혼의 나이를 보겠다」", then: [emote("player", "exclamation", 900), tint("purple", 200), playSe(SE_DARK), wait(500), clearTint(300),
        ...say("maou", "base", "…열일곱. 그리고 어제 숙제를 안 했군."),
        ...say("teen", "surprised", "히익?! 어, 어떻게 알았어요!?"), ...say("hina", "surprised", "…뭐야 지금 그거. 아무튼 미성년자한테는 안 팔아!"), ...good()] },
      { text: "「마왕은 인간의 법에 얽매이지 않는다」", then: [wrong(), ...say("hina", "surprised", "안 돼 안 돼 안 돼! 그거 팔면 경찰 와! 가게 문 닫아!"), ...say("maou", "surprised", "…경찰. 이 세계의 기사단인가. 그건 곤란하다."), ...say("teen", "sad", "…콜라로 할게요.")] },
    ]),
    ...next("ev_mk_c1c"),
    ...say("hina", "happy", "첫날치고 괜찮은데? 마오, 손님 상대 체질인가 봐."),
    ...say("maou", "base", "백성을 다스리는 것은 이 몸의 본업이다."),
  ];
  // 둘째 날 계산대
  const reg2: Command[] = [
    ...clerkPos,
    ...caption("오전 8시 12분."),
    ...say("tanaka", "base", "……늘 먹던 걸로."),
    ...think("(늘 먹던 것…? 처음 보는 인간인데.)"),
    choices([
      { text: "「…늘 먹던 거라 하면?」 (솔직하게 묻는다)", then: [...say("tanaka", "surprised", "…아, 신입이구나. 미안해요."), ...say("hina", "happy", "다나카 씨는 가라아게 레드에 따뜻한 무가당 캔커피! 매일 아침 8시 12분."), ...good()] },
      { text: "「너의 영혼을 읽겠다」", then: [emote("player", "exclamation", 900), tint("purple", 200), playSe(SE_DARK), wait(500), clearTint(300),
        ...say("maou", "sad", "…피로. 끝없는 피로가 보인다. 그리고… 가라아게."),
        ...say("tanaka", "sad", "…맞아요. 3년째 야근이라. 가라아게 레드에 따뜻한 무가당 캔커피요."), ...good()] },
      { text: "(아무거나 집는다) 「단팥빵이다」", then: [wrong(), ...say("tanaka", "sad", "……."), ...say("hina", "surprised", "아니아니! 가라아게 레드에 따뜻한 무가당 캔커피!")] },
    ]),
    playSe(SE_BEEP), wait(200), playSe(SE_BEEP),
    ...say("maou", "base", "가라아게 레드, 따뜻한 무가당 캔커피. …기억했다."),
    ...say("tanaka", "happy", "…고마워요."),
    setSw(SW_TANAKA),
    ...next("ev_mk_c2a", "ev_mk_c2b"),
    ...say("leon", "base", "고기만두 하나요."),
    emote("player", "exclamation", 1200),
    ...think("(이 기척…! 용사!? 아니, 마력은 느껴지지 않는다. 그냥 고등학생인가…?)"),
    ...say("leon", "base", "…아저씨. 우리 어디서 본 적 있지 않아요?"),
    choices([
      { text: "「기분 탓이다」", then: [...say("leon", "base", "…그런가.")] },
      { text: "「…전생에서 만났을지도 모르지」", then: [...say("leon", "surprised", "뭐야, 소름 돋게."), emote("ev_mk_c2b", "sweat")] },
      { text: "「고기만두 하나 서비스다」", then: [...say("leon", "happy", "어, 진짜요? 개이득."), ...say("hina", "surprised", "마오, 서비스는 점장님 허락받고!"), ...say("maou", "embarrassed", "…이 몸의 급료에서 빼라.")] },
    ]),
    playSe(SE_BEEP),
    ...say("maou", "base", "봉투 필요하십니까."),
    ...say("leon", "base", "아뇨. …이상하네. 아저씨 얼굴 보니까 왠지 주먹이 근질근질해."),
    ...next("ev_mk_c2b"),
    ...say("hina", "base", "쟤 단골이야. 근처 고등학교. 맨날 고기만두만 사 가."),
    ...say("maou", "base", "(…용사 레온. 설마 너도 이 세계에.)"),
    ...good(),
  ];
  // 사흘째 밤 계산대
  const reg3: Command[] = [
    ...clerkPos,
    ...caption("새벽 1시."),
    ...say("drunk", "sad", "형씨… 나 인생 어떡하지…? 부장이… 부장이 오늘도…"),
    choices([
      { text: "「세계의 절반을 주마」", then: [...say("drunk", "sad", "…반만 있어도 행복하겠다…"), ...say("hina", "happy", "ㅋㅋㅋ 그거 위로야?")] },
      { text: "「…힘내라. 너는 오늘도 살아남았다」", then: [...say("drunk", "surprised", "……."), ...say("drunk", "happy", "…형씨, 말 잘하네. 고마워."), ...good()] },
      { text: "「인간이여, 해장국을 먹어라」", then: [...say("drunk", "base", "…맞아. 해장국. 역 앞에 24시간 하는 데 있지.")] },
    ]),
    playSe(SE_BEEP),
    ...say("drunk", "happy", "숙취 해소 음료 두 개. 하나는 형씨 거."),
    ...say("maou", "surprised", "(…인간이 마왕에게 공물을 바쳤다.)"),
    ...next("ev_mk_c3a", "ev_mk_c3b"),
    ...say("tanaka", "sad", "……(야근 끝. 말할 기운도 없다)"),
    ifCond(swOn(SW_TANAKA), [
      ...say("maou", "base", "가라아게 레드, 따뜻한 무가당 캔커피. 그리고 오늘은 — 고기만두도 하나. 이 몸이 사겠다."),
      emote("ev_mk_c3b", "heart"),
      ...say("tanaka", "surprised", "……."),
      ...say("tanaka", "happy", "…처음이에요. 누가 제 걸 기억해 준 거."),
      ...say("tanaka", "happy", "내일도 올게요. 8시 12분에."),
      ...good(),
    ], [
      ...say("maou", "base", "…늘 먹던 거라 하면?"),
      ...say("tanaka", "sad", "…가라아게 레드에, 따뜻한 무가당 캔커피요."),
    ]),
    ...next("ev_mk_c3b"),
  ];
  const regIdle: Command[] = [...think("계산대. 지금은 손님이 없다.")];
  ev(event("ev_mk_register", "계산대", REG, [
    page("ev_mk_register_p0", [swOn(SW_SHIFT)], regIdle, { priority: "same" }),
    page("ev_mk_register_p3", [varIs(V_STAGE, 3), swOff("sw_mk_t_reg1")], [...reg1, ...taskDone("sw_mk_t_reg1")], { priority: "same" }),
    page("ev_mk_register_p5", [varIs(V_STAGE, 5), swOff("sw_mk_t_reg2")], [...reg2, ...taskDone("sw_mk_t_reg2")], { priority: "same" }),
    page("ev_mk_register_p7", [varIs(V_STAGE, 7), swOff("sw_mk_t_reg3")], [...reg3, ...taskDone("sw_mk_t_reg3")], { priority: "same" }),
  ]));

  // 상자 진열(첫째 날·사흘째 밤) — changeTile 로 상자를 치운다.
  const box1: Command[] = [
    ...caption("통로를 막은 택배 상자. 「컵라면 48개」."),
    ...say("hina", "base", "그거 선반에 채워 줘. 날짜 오래된 걸 앞으로!"),
    choices([
      { text: "오래된 것을 앞으로 (선입선출)", then: [...say("maou", "base", "먼저 온 자가 먼저 나간다. 마왕군 보급의 철칙과 같군."), ...good()] },
      { text: "마왕의 위엄으로 피라미드처럼 쌓는다", then: [playSe(SE_BOOM), shake(600, "3"), wrong(), ...say("hina", "happy", "ㅋㅋㅋㅋ 무너졌어! 다시!"), ...say("maou", "embarrassed", "…이 세계의 중력은 마계보다 엄격하다.")] },
      { text: "이 몸의 얼굴과 닮은 쪽을 앞으로", then: [...say("hina", "surprised", "컵라면에 얼굴이 어딨어. …아, 이 매운맛 캐릭터? 은근 닮았네.")] },
    ]),
    ...boxTiles(false),
    ...caption("상자를 비웠다. 통로가 넓어졌다."),
  ];
  const box3: Command[] = [
    ...caption("야간 택배. 「주간지 50권」."),
    choices([
      { text: "발매일 순서대로 꽂는다", then: [...say("maou", "base", "질서다. 질서야말로 지배의 근본."), ...good()] },
      { text: "한 손으로 상자째 들어 올린다", then: [...say("hina", "surprised", "…헐. 그거 30킬로인데. 마오 근력 뭐야."), ...say("maou", "happy", "마력은 봉인됐어도 근력은 마왕이다.")] },
      { text: "이 몸이 표지인 잡지를 맨 앞에", then: [...say("hina", "base", "그런 잡지는 없어."), ...say("maou", "sad", "…언젠가 만들게 하겠다.")] },
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
    page("ev_mk_trash_p0", [], [...caption("타는 쓰레기 · 플라스틱 · 캔·병. 세 개의 문이 이 몸을 시험한다.")], { priority: "same" }),
    page("ev_mk_trash_p3", [varIs(V_STAGE, 3), swOff("sw_mk_t_trash1")], [
      ...caption("분리수거함 옆에 손님이 두고 간 컵라면 용기가 있다. 국물이 남아 있다."),
      choices([
        { text: "국물은 버리고, 용기만 플라스틱으로", then: [...say("hina", "happy", "정답! 마오, 생각보다 꼼꼼하다?"), ...good()] },
        { text: "통째로 어둠의 차원에 봉인한다", then: [wrong(), ...say("hina", "base", "어둠의 차원은 수거 요일이 언젠데?"), ...say("maou", "sad", "…없다.")] },
        { text: "타는 쓰레기는 이 몸이 직접 태운다", then: [wrong(), ...say("hina", "surprised", "가게에서 불 피우지 마!!")] },
      ]),
      ...say("maou", "base", "…그 안내문에 적혀 있던 「분리수거」가 이것이었군. 인간 세계, 의외로 규율이 엄하다."),
      ...taskDone("sw_mk_t_trash1"),
    ], { priority: "same" }),
  ]));
  // 핫스낵(둘째 날)
  ev(event("ev_mk_snack", "핫스낵 케이스", SNACK, [
    page("ev_mk_snack_p0", [], [...caption("핫스낵 케이스. 가라아게 레드와 고기만두가 따뜻하게 빛난다.")], { priority: "same" }),
    page("ev_mk_snack_p5", [varIs(V_STAGE, 5), swOff("sw_mk_t_snack2")], [
      ...say("hina", "base", "가라아게 레드 튀기자. 튀김기는 매뉴얼대로!"),
      choices([
        { text: "매뉴얼대로 3분 30초", then: [playSe(SE_BELL), ...say("hina", "happy", "완벽해. 겉바속촉!"), ...good()] },
        { text: "암흑의 화염으로 3초 만에", then: [flash("red", 300), playSe(SE_BOOM), shake(400), wrong(), ...caption("가라아게 레드가 가라아게 블랙이 되었다."), ...say("hina", "sad", "…숯이네. 이건 내가 먹을게…")] },
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
        { text: "40개 (추우면 오뎅이 팔린다)", then: [...say("manager", "happy", "오, 날씨까지 봤구나. 감 좋네!"), ...good()] },
        { text: "999개 (마계의 겨울에 대비한다)", then: [wrong(), playSe(SE_BELL), ...voice("전화 — 사토미 점장", "마오 군?? 방금 본사에서 전화 왔는데, 무 999개??"), ...say("maou", "embarrassed", "…전쟁에 대비했을 뿐이다."), ...caption("발주를 40개로 고쳤다.")] },
        { text: "0개 (무는 군량이 아니다)", then: [wrong(), ...say("manager", "sad", "마오 군… 내일 오뎅 냄비가 텅 비면 다나카 씨 울어."), ...caption("발주를 40개로 고쳤다.")] },
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
        { text: "규칙대로 폐기한다", then: [...say("maou", "sad", "…잘 가라, 이름 모를 도시락이여. 너의 희생은 잊지 않겠다."), ...say("hina", "happy", "ㅋㅋ 장례식이야? 근데 잘했어."), ...good()] },
        { text: "…몰래 먹는다", then: [emote("player", "heart"), ...say("maou", "happy", "……맛있다. 인간의 음식, 얕볼 수 없군."), ...say("hina", "base", "거기 CCTV 있어."), ...say("maou", "surprised", "!!")] },
        { text: "히나 선배와 반씩 나눈다", then: [...say("hina", "happy", "오~ 공범이다. 점장님한텐 비밀!"), ...say("maou", "happy", "마왕과 공범이 되다니, 영광으로 알아라.")] },
      ]),
      ...taskDone("sw_mk_t_waste3"),
    ], { priority: "same" }),
  ]));
  // 근무 중에는 자동문으로 나가지 못한다.
  ev(event("ev_mk_gate", "자동문 앞", GATE, [
    gone("ev_mk_gate_off", []),
    ...[3, 5, 7].map((s) => page(`ev_mk_gate_p${s}`, [varIs(V_STAGE, s)], [...say("hina", "surprised", "마오, 어디 가? 아직 근무 중이잖아!"), walk("@player", ["up"])], { trigger: "playerTouch" })),
  ]));

  // 하루의 시작(둘째 날·사흘째 밤 아침 브리핑)
  const morning2: Command[] = [
    ...fadeIn(700),
    playSe(SE_CHIME),
    ...say("hina", "happy", "좋은 아침~ 마오, 어제 피곤했지? 눈 밑 다크서클 장난 아니다."),
    ...say("maou", "base", "마왕의 눈매는 원래 이렇다."),
    ...say("hina", "happy", "ㅋㅋ 그래그래. 오늘은 계산대, 핫스낵, 발주!"),
    setSw(SW_SHIFT), setSw("sw_mk_brief2"),
    ...clerkPos,
    ...caption("둘째 날 · 오전 8시. 근무 시작.", "오늘의 업무: 계산대 · 핫스낵 · 발주"),
  ];
  const night3: Command[] = [
    { kind: "setLighting", ambient: 0.32, color: "#1a2350", transitionMs: 0 } as Command,
    ...fadeIn(700),
    playSe(SE_CHIME),
    bgm(BGM_NIGHT),
    ...say("hina", "base", "왔어? 야간은 나랑 둘이야. 점장님은 집에서 주무셔."),
    ...say("hina", "happy", "택배 상자 또 왔어. 그리고 백룸 폐기 정리. 계산대는 뭐… 손님 오면."),
    ...boxTiles(true),
    setSw(SW_SHIFT), setSw("sw_mk_brief3"),
    ...clerkPos,
    ...caption("사흘째 · 밤 11시. 야간 근무 시작.", "오늘의 업무: 계산대 · 택배 진열 · 폐기 정리"),
  ];
  ev(event("ev_mk_ctrl_brief", "근무 시작", { x: 0, y: 1 }, [
    gone("ev_mk_ctrl_brief_off", []),
    page("ev_mk_ctrl_brief_p5", [varIs(V_STAGE, 5), swOff("sw_mk_brief2")], morning2, { trigger: "auto" }),
    page("ev_mk_ctrl_brief_p7", [varIs(V_STAGE, 7), swOff("sw_mk_brief3")], night3, { trigger: "auto" }),
  ]));

  // 하루의 끝
  const endDay1: Command[] = [
    wait(300),
    walkTo(MGR_B, { x: 15, y: 9 }),
    ...say("manager", "happy", "마오 군, 오늘 수고했어! 첫날인데 다 해냈네."),
    ifCond(varAtLeast(V_SERVICE, 4), [...say("manager", "happy", "손님들 반응도 좋더라. 「새로 온 분 목소리 좋다」고.")],
      [...say("manager", "base", "처음엔 다 그래. 조금씩 익숙해질 거야.")]),
    ...say("maou", "base", "…이 몸은 오늘, 세 개의 시련을 넘었다."),
    ...say("hina", "happy", "ㅋㅋ 시련 ㅋㅋ 내일 봐, 마오~"),
    setSw(SW_SHIFT, false),
    ...fadeOut(700),
    setVar(V_STAGE, "=", 4), setVar(V_TASKS, "=", 0),
    transfer(M.street, links.konbini.street, "down"),
  ];
  const endDay2: Command[] = [
    wait(300),
    ...say("hina", "happy", "오늘 끝! 마오, 발주까지 하다니 이제 반쯤 베테랑인데?"),
    ...say("hina", "base", "아 맞다, 내일은 야간이지? 밤 11시까지 와."),
    ...say("maou", "base", "알겠다. …그 전에 들를 곳이 있다."),
    setSw(SW_SHIFT, false),
    ...fadeOut(700),
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
    ...say("maou", "base", "그래도 들어왔으면 손님이다. 고기만두가 식는다. 먹어라."),
    ...caption("레온은 한참 고기만두를 내려다보다가, 한 입 베어 물었다."),
    ...say("leon", "sad", "……따뜻하다."),
    ...say("leon", "sad", "용사로 다시 태어났는데, 이 세계엔 마왕도 마물도 없어. 싸울 상대가 없으니까… 난 뭘 해야 할지 몰랐어."),
    ...say("maou", "base", "그건 이 몸도 마찬가지였다. 잔고 0엔에서 시작했지."),
    ...say("maou", "happy", "할 일이 없으면 — 일하면 된다. 마침 이 가게, 야간 알바 자리가 비었다."),
    ...say("leon", "surprised", "…나보고 여기서 일하라고? 마왕 밑에서?"),
    ...say("hina", "happy", "아니 내 밑이지. 내가 선배거든?"),
    ...say("leon", "embarrassed", "…생각해 볼게요. 고기만두 할인 돼요?"),
    ...say("hina", "happy", "직원 할인 10%!"),
    ...say("leon", "happy", "할게요."),
    ...say("lily", "sad", "마, 마왕님… 세계 정복은요…?"),
    ...say("maou", "base", "리리스. 이 몸은 오늘 깨달았다. 세계를 손에 넣는 길은 하나가 아니다."),
    ...say("maou", "happy", "우선은 이 사쿠라자카점부터다. 다음 달 매출 1위를 정복한다."),
    ...say("lily", "happy", "…네! 마왕님이 그러시다면!"),
  ];
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
    ...caption("레온의 몸이 빛에 감싸였다. 기억과 함께, 용사의 힘이 돌아온다."),
    bgm(BGM_BOSS, 300),
    { kind: "battleProcessing", troopId: "troop_mk_power", canEscape: false, canLose: true, branchOnResult: true,
      victoryBranch: [...say("maouF", "base", "크하하하! 용사여, 이 세계에서도 마왕을 이길 수는 없다!"), ...say("leon", "sad", "큭… 젠장…")],
      defeatBranch: [...say("leon", "base", "하아… 하아… 이겼다…!"), ...say("maouF", "base", "흥… 마력이 아직 다 돌아오지 않았을 뿐이다.")] } as Command,
    ...caption("마왕과 용사가 부딪힌 그 밤 — 해피 마트 사쿠라자카점의 유리문, 진열대 셋, 그리고 전자레인지가 사라졌다."),
    playSe(SE_BOOM), shake(800, "3"),
    { kind: "setLighting", ambient: 0.55, color: "#10182a", transitionMs: 600 } as Command,
    ...say("hina", "sad", "……가게가."),
    ...say("lily", "happy", "마왕님! 역시 마왕님이에요! 이제 세계를 다시—"),
    playSe(SE_BELL),
    ...voice("전화 — 사토미 점장", "…마오 군? 방금 가게 CCTV 알림이 왔는데."),
    ...voice("전화 — 사토미 점장", "내일 아침에, 이야기 좀 하자."),
    ...say("maouF", "base", "……."),
    ...fadeOut(1400),
    setSw("sw_mk_x_over"),
    { kind: "triggerEnding", endingId: END_POWER } as Command,
  ];
  const manualBattle: Command[] = [
    ...say("maou", "base", "…리리스. 이 몸은 지금 근무 중이다."),
    ...say("lily", "surprised", "네에!?"),
    ...caption("편의점 매뉴얼 제3조. 「손님께는 언제나 미소로.」"),
    ...say("maou", "happy", "이랏샤이마세. 해피 마트에 어서 오십시오, 손님."),
    ...say("leon", "surprised", "……너, 지금 웃은 거야? 날 바보 취급하는 거냐!"),
    bgm(BGM_MANUAL, 300),
    { kind: "battleProcessing", troopId: "troop_mk_manual", canEscape: false, canLose: true, branchOnResult: true,
      victoryBranch: [...say("leon", "sad", "…하아… 하아…. 화낼 기운도 없어졌어…")],
      defeatBranch: [...caption("마오는 바닥에 쓰러졌다. …그러나 미소만은 무너지지 않았다."), ...say("leon", "surprised", "…야, 괜찮아? 왜 웃고 있는데…")] } as Command,
    { kind: "setLighting", ambient: 0.32, color: "#1a2350", transitionMs: 600 } as Command,
    ...reconcile,
    ...fadeOut(1200),
    setSw("sw_mk_x_over"),
    ifCond(varAtLeast(V_SERVICE, BEST_AT), [{ kind: "triggerEnding", endingId: END_BEST } as Command], [{ kind: "triggerEnding", endingId: END_OK } as Command]),
  ];
  return [
    wait(400),
    setSw(SW_SHIFT, false),
    stopBgm(),
    ...caption("새벽 2시. 손님이 끊긴 시간."),
    ...say("hina", "happy", "마오, 오늘 일 다 끝났네. 이제 아침까지 버티기만 하면 돼~"),
    walkTo("@player", at.clerk), face("@player", "down"),
    { kind: "setLighting", ambient: 0.6, color: "#0a0820", transitionMs: 500 } as Command,
    playSe(SE_DARK), wait(500),
    { kind: "setLighting", ambient: 0.32, color: "#1a2350", transitionMs: 200 } as Command,
    ...say("hina", "surprised", "…방금 형광등 깜빡였지?"),
    playSe(SE_CHIME), setSw("sw_mk_x_leon"), wait(200),
    walkTo("ev_mk_x_leon", leonStop), face("ev_mk_x_leon", "up"),
    emote("player", "exclamation", 1200),
    ...say("leon", "base", "…찾았다. 마왕 제르바스."),
    ...say("maou", "surprised", "!! 용사… 레온. 기억이 돌아온 것이냐."),
    ...say("leon", "base", "고기만두를 먹을 때마다 꿈을 꿨어. 「세계의 절반을 주마」라고 지껄이는 보라색 놈."),
    ...say("leon", "base", "어젯밤에 다 떠올랐다. 너 때문에 내가 이 세계에서 숙제나 하고 있는 거야!"),
    ...say("hina", "surprised", "뭐야 뭐야? 코스프레? 아는 사이야?"),
    playSe(SE_CHIME), setSw("sw_mk_x_lily"), wait(200),
    walkTo("ev_mk_x_lily", lilyStop), face("ev_mk_x_lily", "up"),
    ...say("lily", "surprised", "마왕님! 역시 용사가 나타났군요!"),
    ...say("lily", "base", "오늘은 보름달 — 봉인이 가장 약해지는 밤이에요. 마왕님, 지금이라면 힘을 되찾을 수 있어요!"),
    ...say("leon", "base", "덤벼라, 마왕! 이번엔 끝을 보자!"),
    emote(at.hinaId, "sweat"),
    ...say("hina", "sad", "…마오. 무슨 일인지 모르겠지만, 가게에서 싸우면 안 돼. …알지?"),
    ...think("(마력이… 손끝에서 끓어오른다. 지금이라면 정말로 돌아갈 수 있다. 마왕으로.)"),
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
    page("p0", [], [...think(`(${label} 가는 길이다. 지금은 갈 데가 있다.)`), walk("@player", [back])], { trigger: "playerTouch" }),
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
      ...thinkAs(CAST.zervas.name, "…이것이 인간의 거리인가. 마차도 없는데 쇳덩이가 달린다.", "전단지에 적힌 「해피 마트」는 — 바로 왼쪽 건물이다."),
      setSw("sw_mk_st_morning"),
    ], { trigger: "auto" }),
  ]));
  // 찻집 — 문은 닫혀 있다(실내 없음).
  const cafeDoor = { x: 26, y: 8 };
  map.events.push(event("ev_mk_st_cafe", "찻집 코스모스", cafeDoor, [
    page("ev_mk_st_cafe_p", [], [...letter("찻집 코스모스", "오늘 영업은 끝났습니다.", "내일 또 와 주세요 — 리리")], { priority: "same" }),
  ]));
  // 리리(첫째 날 저녁)
  const LILY = "ev_mk_st_lily";
  const lilyAt = mustWalk(project, map, { x: 25, y: 9 }, "찻집 앞");
  const meet: Command[] = [
    wait(400),
    { kind: "setLighting", ambient: 0.4, color: "#ff7a3a", transitionMs: 0 } as Command,
    ...think("…첫째 날이 끝났다. 손바닥이 바코드 빛으로 아직 따끔거린다."),
    emote(LILY, "exclamation", 1200),
    ...say("lily", "surprised", "…그 마력의 잔향. 설마… 설마!"),
    approach(LILY, "@player"),
    ...say("lily", "surprised", "마왕님!? 제르바스 마왕님 맞으시죠!?"),
    ...say("maou", "surprised", "너는… 그 앞치마는 뭐냐. 아니, 그 목소리, 사천왕의 — 몽마 리리스!?"),
    ...say("lily", "happy", "네! 지금은 리리예요. 저 앞 찻집에서 일해요. 시급 1,200엔에 교통비 별도!"),
    ...say("maou", "base", "…마왕군 시절보다 좋은 대우 아닌가."),
    ...say("lily", "base", "마왕군은 무급이었잖아요. 그런 걸 이 세계에선 「블랙 기업」이라고 한대요."),
    ...say("maou", "embarrassed", "……보람으로 돌아가는 직장이었다."),
    ...say("lily", "base", "다른 사천왕도 이 세계 어딘가에 있을 거예요. 그리고… 용사도. 이 동네에서 그 기척을 느꼈어요."),
    ...say("lily", "happy", "그래서! 내일 밤, 공원 정자에서 「사천왕 재결성 회의」를 열 거예요. 꼭 오세요, 마왕님!"),
    ...say("maou", "base", "…생각해 두지. 내일은 근무다."),
    ...say("lily", "surprised", "근무…? 마왕님이…?"),
    setSw(SW_LILY),
    // 리리는 찻집 앞으로 돌아간다 — 다가온 자리에 서 있으면 고양이와 함께 편의점 앞 길을 막았다(실플레이 2026-10-29).
    walkTo(LILY, lilyAt, false),
    ...caption("저녁의 상점가. 위쪽 큰길 끝은 언덕 위 신사, 아래쪽 끝은 공원. 원룸으로 돌아가 자면 하루가 끝난다."),
  ];
  map.events.push(event("ev_mk_st_meet", "리리와의 재회", { x: 0, y: 10 }, [
    gone("ev_mk_st_meet_off", []),
    page("ev_mk_st_meet_p", [varIs(V_STAGE, 4), swOff(SW_LILY)], meet, { trigger: "auto" }),
  ]));
  map.events.push(event(LILY, "리리", lilyAt, [
    gone(`${LILY}_off`, []),
    page(`${LILY}_p4`, [varIs(V_STAGE, 4)], [faceHero(LILY), ...say("lily", "happy", "내일 밤 공원 정자예요, 마왕님! 회비는 500엔이에요!"), ...say("maou", "surprised", "회비가 있느냐.")], { who: "lily", dir: "down" }),
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
      { name: "하굣길 학생", graphic: { selectionId: "charset:oprn-charset-modern1:6" }, stops: [{ x: 16, y: 10 }, { x: 28, y: 10 }], lines: ["해피 마트 가라아게 레드 먹어 봤어? 진짜 맛있어."] },
    ],
  });
  map.defaultLighting = { ambient: 0, color: "#000000", sources: [] };
  map.bgm = { mode: "custom", resourceId: BGM_STREET } as GameMap["bgm"];
  // 저녁(4·6)은 노을빛 — 병렬 이벤트가 들어설 때 한 번 칠한다.
  map.events.push(event("ev_mk_st_dusk", "저녁빛", { x: 1, y: 9 }, [
    gone("ev_mk_st_dusk_off", []),
    page("ev_mk_st_dusk_p4", [varIs(V_STAGE, 4)], [{ kind: "setLighting", ambient: 0.4, color: "#ff7a3a", transitionMs: 0 } as Command, bgm(BGM_EVENING, 0), wait(600000)], { trigger: "parallel" }),
    page("ev_mk_st_dusk_p6", [varIs(V_STAGE, 6)], [{ kind: "setLighting", ambient: 0.55, color: "#3a2a6a", transitionMs: 0 } as Command, bgm(BGM_EVENING, 0), wait(600000)], { trigger: "parallel" }),
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
    ...say("lily", "happy", "마왕님! 이쪽이에요, 정자!"),
    walkTo("@player", meetAt), face("@player", "up"),
    ...say("lily", "happy", "그럼 지금부터 제1회 사천왕 재결성 회의를 시작하겠습니다! 짝짝짝!"),
    ...say("maou", "base", "…참석자가 둘인데."),
    ...say("lily", "base", "셋이에요. 이분도 계세요."),
    playSe(SE_CAT), emote(CAT, "anger"),
    ...voice("길고양이", "냐앙!"),
    ...say("lily", "base", "사천왕 제1좌, 용왕 가르곤 님이세요."),
    ...say("maou", "surprised", "……가르곤!? 하늘을 뒤덮던 그 흑룡이!? 고양이가 되었단 말이냐!"),
    ...voice("길고양이", "냐아. 냥, 냐앙."),
    ...say("lily", "base", "「이 몸은 지금 생선 가게 할머니에게 매일 전갱이를 받는다. 나쁘지 않다」래요."),
    ...say("maou", "sad", "…적응이 빠르군."),
    ...say("lily", "base", "제3좌 바르크 님은 홋카이도에서 소를 키우신대요. 엽서 왔어요. 「우유가 맛있다」."),
    ...say("lily", "base", "제4좌 노스 님은… 연락 두절. 아마 밤에만 일하는 직장이겠죠."),
    ...say("maou", "embarrassed", "마왕군, 뿔뿔이 흩어졌구나."),
    ...say("lily", "base", "안건 1. 마왕군 재건. 안건 2. 용사 처단. 안건 3. 회비. 1인 500엔, 가르곤 님은 고양이라 면제."),
    ...say("lily", "surprised", "그리고 중요한 정보! 용사가 이 세계에 다시 태어났어요. 근처 고등학교의… 매일 고기만두를 사는 남자애."),
    ...say("maou", "surprised", "……레온."),
    ...say("lily", "base", "내일 밤은 보름달이에요. 봉인이 가장 약해지는 밤. 용사의 기억도, 마왕님의 힘도 돌아올 거예요."),
    ...say("lily", "happy", "그때 마왕님이 힘을 되찾으시면… 마왕군 재건이에요!"),
    choices([
      { text: "「…좋다. 마왕군을 다시 세운다」", then: [...say("lily", "happy", "와아! 마왕님 최고!"), playSe(SE_CAT), ...voice("길고양이", "냐!")] },
      { text: "「미안하다. 내일은 야간 근무다」", then: [...say("lily", "surprised", "근무가… 세계 정복보다 중요하세요!?"), ...say("maou", "base", "…지각하면 히나 선배가 무섭다."), ...good()] },
      { text: "「회비 500엔은… 월급날까지 기다려 다오」", then: [...say("lily", "sad", "…마왕님, 진짜로 가난하시구나."), playSe(SE_CAT), ...voice("길고양이", "냥…(동정)")] },
    ]),
    ...say("lily", "base", "아무튼 내일 밤, 저도 편의점 근처에서 대기할게요!"),
    setSw(SW_MEETING),
    ...caption("회의가 끝났다. 원룸으로 돌아가 자면, 사흘째 밤이 온다."),
  ];
  map.events.push(event("ev_mk_pk_meeting", "사천왕 재결성 회의", { x: 0, y: 0 }, [
    gone("ev_mk_pk_meeting_off", []),
    page("ev_mk_pk_meeting_p", [varIs(V_STAGE, 6), swOff(SW_MEETING)], meeting, { trigger: "auto" }),
  ]));
  map.events.push(event(LILY, "리리", lilyAt, [
    gone(`${LILY}_off`, []),
    page(`${LILY}_p6`, [varIs(V_STAGE, 6)], [faceHero(LILY), ...say("lily", "happy", "내일 밤이에요, 마왕님. 보름달!")], { who: "lily", dir: "down" }),
  ]));
  map.events.push(event(CAT, "길고양이", catAt, [
    gone(`${CAT}_off`, []),
    page(`${CAT}_p4`, [varIs(V_STAGE, 4)], [playSe(SE_CAT), ...voice("길고양이", "냐아."), ...think("(편의점 앞에 있던 그 고양이다. …왜 이렇게 거만하게 앉아 있지.)")], { who: "cat", dir: "down" }),
    page(`${CAT}_p6`, [varIs(V_STAGE, 6)], [playSe(SE_CAT), ...voice("길고양이", "냥. (…마왕이여, 전갱이는 꼬리부터 먹는 것이다.)")], { who: "cat", dir: "down" }),
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
      ...say("maou", "base", "(용사…!) …산책이다. 너야말로 뭘 하고 있느냐."),
      ...say("leon", "base", "검도부요. 집에선 연습할 데가 없어서."),
      ...say("leon", "sad", "…요즘 이상한 꿈을 꿔요. 망토 두른 보라색 놈이 「세계의 절반을 주마」 이러는 꿈."),
      emote("player", "sweat", 1200),
      ...say("leon", "base", "그 꿈만 꾸면 이상하게 고기만두가 땡겨요. 그래서 맨날 사러 가는 거예요."),
      ...say("maou", "embarrassed", "……그렇군. 고기만두는 맛있지."),
      ...think("(아직 기억은 돌아오지 않았다. …돌아오면, 어떻게 되는 거지.)"),
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
        { text: "세계 정복", then: [...caption("…바람 소리만 들린다. 5엔으로는 무리인 모양이다.")] },
        { text: "시급 인상", then: [...caption("방울이 딸랑, 하고 울렸다. 어쩐지 이루어질 것 같다."), playSe(SE_BELL)] },
        { text: "…내일도 무사한 하루", then: [...caption("마음이 이상하게 가벼워졌다."), ...think("(마왕이 「무사한 하루」를 빌다니. …나쁘지 않은 기분이다.)")] },
      ]),
    ], { priority: "same" }),
  ]));
  // 오미쿠지
  map.events.push(event("ev_mk_sh_kuji", "오미쿠지", mustBlock(project, map, { x: 23, y: 15 }, "오미쿠지 상자"), [
    page("ev_mk_sh_kuji_p4", [], [
      ...caption("오미쿠지를 뽑았다."),
      ...letter("대흉", "직장: 옛 원수와 재회한다", "금전: 0에서 시작하면 오를 일만 남았다", "연애: 선배를 공경하라"),
      ...think("(…이 세계의 점술, 묘하게 정확하다.)"),
    ], { priority: "same" }),
    page("ev_mk_sh_kuji_p6", [varIs(V_STAGE, 6)], [
      ...caption("오미쿠지를 한 번 더 뽑았다."),
      ...letter("길", "내일 밤, 큰 선택이 찾아온다.", "웃는 얼굴을 잊지 말 것."),
      ...think("(…웃는 얼굴. 매뉴얼 제3조와 같은 말이군.)"),
    ], { priority: "same" }),
  ]));
  map.defaultLighting = { ambient: 0.5, color: "#ff8a4a", sources: [
    { id: "lantern_l", at: { x: 17, y: 14 }, radius: 2.2, intensity: 0.9, color: "#ffc070", flicker: true },
    { id: "lantern_r", at: { x: 22, y: 14 }, radius: 2.2, intensity: 0.9, color: "#ffc070", flicker: true },
  ] };
  map.events.push(event("ev_mk_sh_dusk", "저녁빛", { x: 0, y: 0 }, [
    gone("ev_mk_sh_dusk_off", []),
    page("ev_mk_sh_dusk_p6", [varIs(V_STAGE, 6)], [{ kind: "setLighting", ambient: 0.6, color: "#2a2a6a", transitionMs: 0 } as Command, wait(600000)], { trigger: "parallel" }),
  ]));
  map.bgm = { mode: "custom", resourceId: BGM_SHRINE } as GameMap["bgm"];
  return arrive;
}

// ── 오프닝(5컷, 게임 맵 그대로 + 칩 배우) ──
function buildOpening(project: Project): void {
  project.system.opening = { enabled: true, skippable: true, scenes: [] };
  const STAGE = { width: 384, height: 216 };
  const LB = 0.15;
  const tile = 16;
  type Actor = { id: string; res: string; idx: number; cell: Cell; dir?: "up" | "down" | "left" | "right"; to?: Cell; startMs?: number; durMs?: number };
  const shot = (id: string, ms: number, mapId: string | null, focus: Cell, zoom: number, actors: Actor[], cues: { atMs: number; text: string; color?: string }[],
    opts: { transition?: Record<string, unknown>; camera?: Record<string, unknown>; tintColor?: string; tintOpacity?: number; emotes?: { target: string; preset: string; startMs: number; endMs: number }[]; text?: { id: string; text: string; y: number; size: number; color: string; startMs: number }[] } = {}) => {
    execTool(project, "create_opening_animatic_shot", { shotId: id, durationMs: ms, width: STAGE.width, height: STAGE.height, background: "#000000", replace: true, clearLayers: true });
    execTool(project, "set_opening_pixel_grid", { shotId: id, width: STAGE.width, height: STAGE.height });
    if (mapId) {
      execTool(project, "place_opening_background", { shotId: id, layerId: "bg", mapId, focus, zoom });
      const crop = openingMapViewCrop(project.maps[mapId]!, STAGE, focus, zoom);
      const sc = STAGE.width / crop.width;
      const scale = Math.max(1, Math.round(sc));
      const pos = (c: Cell) => ({ x: Math.round(((c.x + 0.5) * tile - crop.x) * sc), y: Math.round(((c.y + 1) * tile - crop.y) * sc - 16 * scale) });
      for (const a of actors) {
        const p = pos(a.cell);
        const args: Record<string, unknown> = { shotId: id, layerId: a.id, charsetResourceId: a.res, characterIndex: a.idx, direction: a.dir ?? "down", scale, x: p.x, y: p.y, stride: 8 * scale };
        if (a.to) { const q = pos(a.to); Object.assign(args, { fromX: p.x, fromY: p.y, toX: q.x, toY: q.y, startMs: a.startMs ?? 0, durationMs: a.durMs ?? ms }); }
        execTool(project, "place_opening_charset_actor", args);
      }
      if (opts.tintColor) {
        execTool(project, "upsert_opening_layer", { shotId: id, layer: { id: "tint", kind: "shape", shape: "rect", color: opts.tintColor, x: 0, y: 0, width: STAGE.width, height: STAGE.height, anchorX: 0, anchorY: 0, opacity: opts.tintOpacity ?? 0.45, blend: "multiply" } });
      }
    }
    for (const t of opts.text ?? []) {
      execTool(project, "upsert_opening_layer", { shotId: id, layer: { id: t.id, kind: "text", text: t.text, x: STAGE.width / 2, y: t.y, width: 360, height: 30, color: t.color, startMs: t.startMs,
        typography: { fontSize: t.size, align: "center", typewriterMs: 900 } } });
    }
    for (const [i, e] of (opts.emotes ?? []).entries()) {
      execTool(project, "upsert_opening_emote", { shotId: id, layerId: `emote_${i}`, preset: e.preset, targetLayerId: e.target, startMs: e.startMs, endMs: e.endMs });
    }
    if (opts.camera) execTool(project, "animate_opening_camera", { shotId: id, camera: opts.camera });
    execTool(project, "set_opening_transition", { shotId: id, transition: opts.transition ?? { kind: "fade", durationMs: 700 }, letterbox: LB });
    if (cues.length) execTool(project, "set_opening_caption", { shotId: id, layerId: "caption", letterbox: LB, color: "#fff0dc", fontSize: 11, fadeOutMs: 400, cues: cues.map((c) => ({ ...c, typewriterMs: 700 })) });
  };
  const MON2 = "easyrpg-charset-monster2", ACT1 = "easyrpg-charset-actor1";
  shot("mk_op_legend", 7600, M.throne, { x: 23, y: 7 }, 1, [
    { id: "maou", res: MON2, idx: 7, cell: { x: 23, y: 5 } },
    { id: "k_lily", res: MON2, idx: 0, cell: { x: 21, y: 7 } },
    { id: "k_dragon", res: MON2, idx: 1, cell: { x: 25, y: 7 } },
    { id: "k_bark", res: MON2, idx: 3, cell: { x: 19, y: 9 } },
    { id: "k_nos", res: MON2, idx: 2, cell: { x: 27, y: 9 } },
  ], [
    { atMs: 400, text: "마계력 999년. 암흑 마왕 제르바스는 세계의 절반을 손에 넣었다." },
    { atMs: 4200, text: "곁에는 충성스러운 사천왕. 나머지 절반도 시간문제였다." },
  ], { tintColor: "#5a1a60", tintOpacity: 0.4, camera: { from: { x: 192, y: 118, zoom: 1.08 }, to: { x: 192, y: 104, zoom: 1 } }, transition: { kind: "dither", durationMs: 700 } });
  shot("mk_op_heroes", 6800, M.throne, { x: 23, y: 22 }, 1, [
    { id: "leon", res: ACT1, idx: 0, cell: { x: 23, y: 27 }, dir: "up", to: { x: 23, y: 20 }, durMs: 6000 },
    { id: "garet", res: ACT1, idx: 2, cell: { x: 22, y: 28 }, dir: "up", to: { x: 22, y: 21 }, durMs: 6000 },
    { id: "mira", res: ACT1, idx: 5, cell: { x: 24, y: 28 }, dir: "up", to: { x: 24, y: 21 }, durMs: 6000 },
  ], [
    { atMs: 400, text: "그리고 마침내, 용사 레온 일행이 옥좌의 방에 닿았다." },
  ], { tintColor: "#5a1a60", tintOpacity: 0.35 });
  shot("mk_op_clash", 6400, M.throne, { x: 23, y: 6 }, 2, [
    { id: "maou", res: MON2, idx: 7, cell: { x: 23, y: 5 } },
    { id: "leon", res: ACT1, idx: 0, cell: { x: 23, y: 8 }, dir: "up" },
  ], [
    { atMs: 500, text: "세계의 운명을 건, 최후의 결전 —", color: "#ff6878" },
  ], { tintColor: "#6a1030", tintOpacity: 0.35, transition: { kind: "flash", durationMs: 260, color: "#fff6d8" },
    emotes: [{ target: "maou", preset: "exclaim", startMs: 2600, endMs: 4400 }, { target: "leon", preset: "exclaim", startMs: 2900, endMs: 4600 }],
    camera: { from: { x: 192, y: 108, zoom: 1 }, to: { x: 192, y: 108, zoom: 1.12 } } });
  shot("mk_op_card", 6600, null, { x: 0, y: 0 }, 1, [], [], {
    transition: { kind: "fade", durationMs: 900 },
    text: [
      { id: "line1", text: "이것은 세계를 멸망시키려던 마왕이", y: 92, size: 13, color: "#fff0dc", startMs: 500 },
      { id: "line2", text: "편의점에서 일하게 되는 이야기다.", y: 120, size: 13, color: "#ffd479", startMs: 2600 },
    ] });
  shot("mk_op_konbini", 6200, M.konbini, { x: 12, y: 11 }, 2, [
    { id: "maou", res: "oprn-charset-modern2", idx: 3, cell: { x: 12, y: 11 } },
    { id: "hina", res: "oprn-charset-modern2", idx: 5, cell: { x: 14, y: 10 }, dir: "left" },
    { id: "cust", res: "oprn-charset-modern3", idx: 1, cell: { x: 12, y: 13 }, dir: "up" },
  ], [
    { atMs: 600, text: "(…진짜로.)" },
  ], { transition: { kind: "cut", durationMs: 0 }, emotes: [{ target: "maou", preset: "sweat", startMs: 1400, endMs: 4200 }],
    camera: { from: { x: 192, y: 108, zoom: 1.1 }, to: { x: 192, y: 108, zoom: 1 } } });
  const opening = project.system.opening!;
  opening.musicResourceId = BGM_THRONE;
  for (const scene of opening.scenes) if (scene.kind === "animatic") scene.narration = "";
}

// ── 엔딩 ──
function defineEndings(project: Project): void {
  const credits = [
    "『전생한 마왕, 편의점 알바 시작하다』",
    "",
    "이야기 · 연출   OPRN Flagship Studio",
    "거리 · 실내   OPRN jp_city 상점가 · 현대 실내 · 손 도트 실내",
    "인물   OPRN 현대 걷기 칩 · 공용 흉상 · EasyRPG RTP",
    "음악 · 효과음   CC0 음원 · EasyRPG RTP",
    "",
    "만든 도구   OPRN Studio",
    "",
    "이랏샤이마세. 또 오십시오.",
  ].join("\n");
  const n = (text: string) => ({ kind: "say", text });
  const v = (speaker: string, text: string) => ({ kind: "say", speaker, text });
  execTool(project, "define_ending", {
    id: END_BEST, name: "이달의 우수 사원", priority: 10, conditions: [],
    presentation: { kicker: "해피 마트 사쿠라자카점", musicResourceId: BGM_END, tone: "warm", portraits: "none", credits },
    epilogue: [
      n("한 달 뒤. 해피 마트 사쿠라자카점 계산대 옆에 액자 하나가 걸렸다."),
      n("「이달의 우수 사원 — 마오」. 사진 속 마오는, 매뉴얼 제3조대로 웃고 있다."),
      v("사토미 점장", "마오 군, 이번 달 매출 지역 1위야! 다음 달부터 시급 50엔 올려 줄게."),
      v("마오", "…50엔. 세계의 절반에 비하면 작지만, 이 몸이 처음으로 「번」 것이다."),
      n("야간에는 새 알바생 레온이 들어왔다. 고기만두를 하루에 세 개씩 먹는다."),
      v("히나", "마오, 레온, 둘 다 내 밑이다? 선배라고 불러."),
      n("다나카 씨는 매일 아침 8시 12분에 온다. 이제 「늘 먹던 걸로」라고 말할 필요가 없다."),
      n("리리는 찻집에서 마오의 단골이 되었다. 가르곤은 편의점 앞 벤치를 자기 옥좌로 삼았다."),
      v("마오", "세계를 손에 넣는 길은 하나가 아니다. 우선은 — 이 동네부터다."),
    ],
  });
  execTool(project, "define_ending", {
    id: END_OK, name: "내일도 출근합니다", priority: 5, conditions: [],
    presentation: { kicker: "해피 마트 사쿠라자카점", musicResourceId: BGM_END, tone: "warm", portraits: "none", credits },
    epilogue: [
      n("다음 날 아침. 마오는 평소처럼 줄무늬 조끼를 입었다."),
      v("히나", "마오, 어제 데워 드릴까요 또 까먹었지? 그래도 많이 늘었어."),
      v("마오", "…매뉴얼은 마왕군 군율보다 어렵다. 그러나 이 몸은 포기하지 않는다."),
      n("야간에는 새 알바생 레온이 들어왔다. 첫날부터 전자레인지 버튼을 잘못 눌렀다."),
      v("마오", "500와트로 1분 30초다, 후배여. 버튼이다, 버튼."),
      n("이달의 우수 사원 액자에는 아직 히나의 사진이 걸려 있다."),
      v("마오", "…다음 달에는, 저 액자를 정복한다."),
    ],
  });
  execTool(project, "define_ending", {
    id: END_POWER, name: "마왕 재림… 그리고 변상", priority: 5, conditions: [],
    presentation: { kicker: "암흑 마왕 제르바스", musicResourceId: BGM_END, tone: "dark", portraits: "none", credits },
    epilogue: [
      n("다음 날 아침. 반쯤 부서진 해피 마트 사쿠라자카점 앞."),
      v("사토미 점장", "유리문, 진열대 셋, 전자레인지. 합계 380만 엔이야."),
      v("마왕 제르바스", "…이 몸은 마왕이다. 마왕은 변상 따위—"),
      v("사토미 점장", "시급 1,150엔으로 계산하면… 마오 군, 약 3,300시간."),
      v("히나", "ㅋㅋㅋ 마오 평생 여기서 일해야겠다."),
      n("마왕은 힘을 되찾았다. 그러나 이 세계에는 정복할 성도, 따를 군대도 없었다."),
      n("있는 것은 줄무늬 조끼와, 갚아야 할 380만 엔."),
      v("레온", "…나도 반은 낼게. 같이 부쉈으니까."),
      v("마왕 제르바스", "…용사여. 세계의 절반 대신, 빚의 절반이라니."),
    ],
  });
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
  for (const [id, name] of [[V_STAGE, "마왕 진행 단계"], [V_TASKS, "오늘 마친 업무"], [V_SERVICE, "근무 평가"]] as const) ensureVar(id, name);
  for (const [id, name] of [[SW_SHIFT, "근무 중"], [SW_TANAKA, "다나카 씨 주문을 외움"], [SW_LILY, "리리와 재회"], [SW_MEETING, "사천왕 재결성 회의"]] as const) ensureSw(id, name);

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
  const throneStart = buildThrone(project, roomWake);
  buildOpening(project);
  defineEndings(project);

  execTool(project, "set_title_screen", {
    title: "전생한 마왕, 편의점 알바 시작하다", logoSubtitle: "이랏샤이마세, 용사여", backgroundResourceId: "oprn-maou-konbini-title",
    logoStyle: "gold", menuStyle: "plain", musicResourceId: BGM_TITLE,
    runners: [
      { resourceId: "oprn-charset-modern2", characterIndex: 3, direction: "right", y: 214, speed: 70, delayMs: 0, everyMs: 9000 },
      { resourceId: "easyrpg-charset-actor1", characterIndex: 0, direction: "right", y: 214, speed: 70, delayMs: 700, everyMs: 9000 },
      { resourceId: "oprn-charset-modern2", characterIndex: 5, direction: "right", y: 214, speed: 70, delayMs: 1500, everyMs: 9000 },
    ],
  });
  if (project.system.titleScreen) project.system.titleScreen.backgroundFit = "cover";

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
    { id: "tasks", kind: "gauge", source: "variable", variableId: V_TASKS, max: 3, shape: "number", label: "오늘 업무", anchor: "top-left", x: 6, y: 6, width: 100, height: 26, panel: "paper", color: "#3aa860", condition: "switch", switchId: SW_SHIFT },
  ] } });
  execTool(project, "set_project_settings", { resources: { titleResourceId: "oprn-maou-konbini-title", defaultBgmResourceId: BGM_SHOP } });

  // 장면 스위치(작업 완료·손님 퇴장·브리핑 등)를 모두 등록한다 — 등록하지 않은 스위치 조건은 프로젝트 검사가 거절한다.
  for (const id of new Set(JSON.stringify(project.maps).match(/sw_(?:ev_)?mk_[a-z0-9_]+/g) ?? [])) ensureSw(id, id.replace(/^sw_(ev_)?mk_/, "마왕 · "));
  const keepTilesets = new Set(Object.values(project.maps).map((m) => m.tilesetId));
  for (const id of [...keepTilesets]) for (const graft of project.tilesets[id]?.tileGrafts ?? []) keepTilesets.add(graft.sourceChipset);
  for (const id of Object.keys(project.tilesets)) if (!keepTilesets.has(id)) delete project.tilesets[id];

  const serialized = serialize(project);
  const reloaded = deserialize(serialized);
  return {
    id: "maou-konbini",
    manifest: { ...FLAGSHIP_BEAT_MANIFESTS["maou-konbini"], mapCount: Object.keys(reloaded.maps).length, endingCount: reloaded.endings?.length ?? 0 },
    project: reloaded,
    serialized,
  };
}
