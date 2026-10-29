/**
 * 『이세계로 떠난 한국 고딩, 깽판치다』 — 이세계 소환 코미디 JRPG 데모(약 20~25분, 엔딩 셋).
 *
 * 고2 강민재는 야자 시간에 배터리 3% 폰을 보다 이세계 아르벤 왕국에 용사로 소환된다. 내일은 모의고사다.
 * 왕국은 「용사 대본」대로 움직이길 바라지만, 민재는 대본 대신 PC방 점사 오더·급식 줄 세우기·학원 요점 정리·
 * 단톡방 외교로 문제를 푼다. 의전 기사 에델, 마탑 시험 7수생 엘프 피오, 반반 마을의 고블린 족장 꾸르가 차례로 붙는다.
 * 마왕성 꼭대기에서 기다리는 마왕 벨제의 정체는 2009년 수능 전날 소환된 한국 고3 배재민이다.
 * 마지막 선택(같이 수능 보러 가자 · 떡볶이 먹을래 · 한 판 붙자)이 세 결말을 가른다.
 *
 * 흐름은 변수 하나(var_ig_stage)가 쥔다:
 *   0 소환의 방 → 1 왕도·길드 → 2 피오 합류(동쪽 문 열림) → 3 숲 슬라임 전투 뒤 → 4 꾸르 합류(마왕성) → 5 교무부장 뒤 → 6 결말.
 * 깽판 지수(var_ig_chaos)는 대본을 어긴 선택마다 오르고 HUD 에 보인다. 결말 대사 일부가 이 값에 따라 바뀐다.
 *
 * 맵은 전부 조수 도구로 짓는다(author_beodeul_town · author_forest_route · author_beodeul_dungeon · build_hand_interior_room ·
 * create_transfer_pair · set_map_properties). 사람 그림은 공용 흉상·EasyRPG 걷기 칩·현대 걷기 칩만 쓴다 — 새 그림 없음.
 */
import { withJosa } from "@/util/josa";
import { createBlankProject } from "@/project/defaults";
import { deserialize, serialize } from "@/project/io";
import type { Command, GameMap, Project } from "@/project/types";
import { FLAGSHIP_BEAT_MANIFESTS } from "./beats";
import { ACTOR, BACKDROP, ITEM, setupIsekaiDatabase, TROOP } from "./isekaiGoddingDb";
import {
  bgm, caption, type Cell, choices, emote, event, execTool, faceHero, fadeIn, fadeOut, flash, gone, ifCond, mustReach,
  mustBlock, mustWalk, nearestFree, note, page, playSe, reachableCells, say, setSw, setVar, shake, stopBgm, swOff, swOn, think, varAtLeast, varIs, wait, walkTo,
} from "./isekaiGoddingKit";
import { applyIsekaiGoddingLore } from "./isekaiGoddingLore";
import { buildIsekaiOpening, DESK, setupIsekaiTitle } from "./isekaiGoddingOpening";
import type { FlagshipDemoBuildResult } from "./types";

// ── 상태 ──
const V_STAGE = "var_ig_stage";
const V_CHAOS = "var_ig_chaos";
const V_DIPLO = "var_ig_diplo";
const SW_LINE = "sw_ig_guild_line";
const SW_CHILI_ASK = "sw_ig_chili_asked";
const SW_CHILI = "sw_ig_chili_got";
const SW_TTEOK = "sw_ig_tteok_made";
const SW_TREASURY = "sw_ig_treasury";
const SW_SLIME = "sw_ig_slime_done";
const SW_QUIZ = "sw_ig_quiz_done";
const SW_DEAN = "sw_ig_dean_done";
const SW_OVER = "sw_ig_over";
const SW_HOME = "sw_ig_end_home";
const SW_STAY = "sw_ig_end_stay";
/** 깽판 지수가 이만큼이면 「깽판왕」 결말에 한 줄이 더 붙는다. */
const CHAOS_KING = 5;

const END_HOME = "end_ig_home";
const END_STAY = "end_ig_stay";
const END_CHAOS = "end_ig_chaos";

// ── 맵 ──
const M = {
  class: "map_ig_class",
  hall: "map_ig_hall",
  capital: "map_ig_capital",
  guild: "map_ig_guild",
  forest: "map_ig_forest",
  goblin: "map_ig_goblin",
  castle: "map_ig_castle",
  castle2: "map_ig_castle_f2",
} as const;

// ── 소리(EasyRPG .mid 는 브라우저에서 무음 — mp3 카탈로그 곡만) ──
const BGM_HALL = "cc0-bgm-rtp-thr-001";
const BGM_CAPITAL = "cc0-bgm-rtp-fst-001";
const BGM_GUILD = "cc0-bgm-rtp-tav-001";
const BGM_FOREST = "cc0-bgm-rtp-fld-001";
const BGM_GOBLIN = "cc0-bgm-rtp-frd-001";
const BGM_CASTLE = "cc0-bgm-rtp-mys-001";
const BGM_BOSS = "cc0-bgm-rtp-btl-002";
const BGM_BATTLE = "cc0-bgm-rtp-btl-001";
const BGM_END = "cc0-bgm-rtp-res-002";
const BGM_HOME = "cc0-bgm-rtp-hlc-005";
const SE_SUMMON = "easyrpg-sound-flash1";
const SE_JOIN = "cc0-se-osx-bell-02";
const SE_OK = "cc0-se-orp-interface-interface3";
const SE_WRONG = "easyrpg-sound-buzzer1";
const SE_PAPER = "cc0-se-osx-paper-04";
const SE_BOOM = "easyrpg-sound-explosion1";
const SE_COIN = "cc0-se-osx-metal-03";
const SE_CHAT = "cc0-se-osx-switch-01";

// ── 작은 명령 ──
const objective = (message: string): Command =>
  ({ kind: "m2Command", commandId: "m2-214-ui-command", fields: { surface: "objectiveChip", message, durationMs: 0 } } as Command);
/** 대본을 어긴 선택 한 번 — 깽판 지수가 오른다. */
const chaos = (): Command[] => [setVar(V_CHAOS, "+=", 1), emote("player", "sweat", 700)];
const join = (actorId: string, name: string): Command[] => [
  { kind: "changeParty", actorId, action: "add" } as Command, playSe(SE_JOIN), ...caption(`${withJosa(name, "이/가")} 동료가 되었다.`),
];
const giveItem = (itemId: string): Command => ({ kind: "changeItem", itemId, op: "+=", amount: 1 } as Command);
const takeItem = (itemId: string): Command => ({ kind: "changeItem", itemId, op: "-=", amount: 1 } as Command);
const gold = (amount: number): Command => ({ kind: "changeGold", op: "+=", amount } as Command);
const hasItem = (itemId: string) => ({ kind: "item", itemId, present: true } as const);
const battle = (troopId: string, victory: Command[], defeat: Command[], music = BGM_BATTLE): Command[] => [
  bgm(music, 200),
  { kind: "battleProcessing", troopId, canEscape: false, canLose: true, branchOnResult: true, victoryBranch: victory, defeatBranch: defeat } as Command,
];
const setLight = (ambient: number, color: string, ms = 0): Command => ({ kind: "setLighting", ambient, color, transitionMs: ms } as Command);
const custom = (map: GameMap, resourceId: string): void => { map.bgm = { mode: "custom", resourceId } as GameMap["bgm"]; };

// ── 맵 짓기 ──
interface Built {
  hallStart: Cell;
  capital: { fromHall: Cell; guildDoor: Cell; plaza: Cell; bakeryDoor: Cell; eastGate: Cell };
  guildEntry: Cell;
  forest: { entry: Cell; clearing: Cell };
  goblin: { entry: Cell; gathering: Cell; castleGate: Cell };
  castle: { entry: Cell; stairFront: Cell; rooms: { id: string; kind: string; x: number; y: number; w: number; h: number }[]; corridors: { from: string; to: string; x: number; y: number; w: number; h: number }[] };
  castle2: { entry: Cell; boss: { x: number; y: number; w: number; h: number } };
}

function buildMaps(project: Project): Built {
  // 실내 — 손 도트 실내(성·선술집), 현대 캠퍼스(교실).
  execTool(project, "build_hand_interior_room", { mapId: M.class, name: "2학년 3반 교실", tileset: "modern_campus", replace: true, layout: { program: "school-class-wing", seed: 1, furnish: true } });
  execTool(project, "build_hand_interior_room", { mapId: M.hall, name: "왕궁 소환의 방", tileset: "atlas_biome_interior", replace: true, layout: { program: "throne", seed: 1, furnish: true } });
  execTool(project, "build_hand_interior_room", { mapId: M.guild, name: "모험가 길드 「은빛 술잔」", tileset: "atlas_biome_interior", replace: true, layout: { program: "tavern", seed: 1, furnish: true } });

  // 왕도 — 버들항 광장 마을. doors[0] 이 광장 앞 큰 건물(장터 회관 = 길드), 서쪽 큰길 끝이 왕궁으로 가는 길.
  const town = execTool(project, "author_beodeul_town", { id: M.capital, name: "왕도 아르벤", width: 60, height: 44, seed: 11, roofs: "medieval", church: true, form: "plaza", water: "river", woods: "edge" });
  const td = town.data as { doors: { kit: string; x: number; y: number }[]; plaza?: { x: number; y: number }; entrance?: Cell };
  const guildDoor = td.doors.find((d) => d.kit.includes("market-hall")) ?? td.doors[0]!;
  const bakeryDoor = td.doors.find((d) => d.kit.includes("bakery")) ?? td.doors[1]!;
  const plaza = td.plaza ? { x: td.plaza.x, y: td.plaza.y } : { x: 22, y: 32 };

  // 동쪽 숲길 — 왕도 동쪽 가장자리와 잇는다(북쪽은 집 보호 칸에 걸려 거절된다: 도구 결함 후보).
  const route = execTool(project, "author_forest_route", { fromMapId: M.capital, side: "east", count: 1, names: ["동쪽 숲길"], moods: ["normal"], seed: 4 });
  const rmap = (route.data as { maps: { mapId: string; entry: Cell; clearing: Cell }[] }).maps[0]!;
  // 숲 맵 id 를 데모 이름으로 바꾸지 않고 그대로 쓴다(바꾸면 도구가 단 이동 이벤트를 다 고쳐야 한다).
  const forestId = rmap.mapId;

  // 반반 마을 — 숲 빈터 마을(평지). 서쪽 입구로 숲과 잇는다.
  const village = execTool(project, "author_beodeul_town", { id: M.goblin, name: "반반 마을", seed: 5, houseCount: 3, form: "scatter", woods: "dense", roofs: "log", water: "none", terrain: "flat" });
  const vd = village.data as { entrance?: Cell; gathering?: { door: Cell }; doors: { x: number; y: number }[] };
  const goblinEntry = vd.entrance ?? { x: 0, y: 18 };

  // 숲 빈터 동쪽 끝 ↔ 반반 마을 서쪽 입구.
  {
    const forest = project.maps[forestId]!;
    const reach = reachableCells(project, forest, rmap.entry);
    const east = reach.reduce((best, c) => (c.x > best.x || (c.x === best.x && Math.abs(c.y - rmap.clearing.y) < Math.abs(best.y - rmap.clearing.y)) ? c : best), reach[0]!);
    execTool(project, "create_transfer_pair", { a: { mapId: forestId, x: east.x, y: east.y }, b: { mapId: M.goblin, x: goblinEntry.x, y: goblinEntry.y }, fade: "black" });
  }

  // 마왕성 입구 — 반반 마을에서 걸어서 닿는 가장 북쪽 빈터.
  const vmap = project.maps[M.goblin]!;
  const vReach = reachableCells(project, vmap, goblinEntry);
  const northMost = vReach.filter((c) => c.x > 2 && c.x < vmap.width - 3).reduce((best, c) => (c.y < best.y ? c : best), vReach[0]!);
  const dungeon = execTool(project, "author_beodeul_dungeon", { id: M.castle, name: "마왕성", type: "castle", floors: 2, size: "medium", seed: 3, populate: false, gimmick: "none",
    entrance: { fromMapId: M.goblin, x: northMost.x, y: northMost.y } });
  type Room = { id: string; kind: string; x: number; y: number; w: number; h: number };
  type FloorData = { entrance: Cell; exitStair?: { front: Cell } | null; rooms: Room[]; corridors: { from: string; to: string; x: number; y: number; w: number; h: number }[] };
  const dd = dungeon.data as { floorData: FloorData[] };
  const f1 = dd.floorData[0]!, f2 = dd.floorData[1]!;
  const bossRoom2 = f2.rooms.find((r) => r.kind === "boss")!;

  // 소환의 방 출구 ↔ 왕도 서쪽 큰길 끝(왕궁 가는 길).
  const capital = project.maps[M.capital]!;
  const capReach = reachableCells(project, capital, { x: guildDoor.x, y: guildDoor.y + 1 });
  const west = capReach.reduce((best, c) => (c.x < best.x || (c.x === best.x && Math.abs(c.y - 28) < Math.abs(best.y - 28)) ? c : best), capReach[0]!);
  execTool(project, "create_transfer_pair", { a: { mapId: M.hall, x: 23, y: 35 }, b: { mapId: M.capital, x: west.x, y: west.y }, fade: "black" });
  // 길드 문 ↔ 선술집 출구.
  execTool(project, "create_transfer_pair", { a: { mapId: M.capital, x: guildDoor.x, y: guildDoor.y, doorAt: { x: guildDoor.x, y: guildDoor.y - 1 } }, b: { mapId: M.guild, x: 6, y: 19 }, fade: "black" });

  // 동쪽 숲으로 나가는 이동 이벤트 칸(문지기가 지킨다).
  const capitalNow = project.maps[M.capital]!;
  const gateEv = capitalNow.events.find((e) => JSON.stringify(e.pages ?? []).includes(`"mapId":"${forestId}"`));
  if (!gateEv) throw new Error("[isekai-godding] 왕도에 동쪽 숲으로 가는 이동 이벤트가 없다");

  // 숲 맵 id 를 데모 이름으로 옮긴다 — 다른 맵의 이동 명령도 같이 고친다.
  const forestMap = project.maps[forestId]!;
  if (forestId !== M.forest) {
    forestMap.id = M.forest; project.maps[M.forest] = forestMap; delete project.maps[forestId];
    for (const m of Object.values(project.maps)) for (const e of m.events) for (const p of e.pages ?? []) {
      const walkCmds = (cmds: Command[]) => { for (const c of cmds as unknown as Record<string, unknown>[]) {
        if (c.kind === "transfer" && c.mapId === forestId) c.mapId = M.forest;
        for (const k of ["then", "else"]) if (Array.isArray(c[k])) walkCmds(c[k] as Command[]);
      } };
      walkCmds(p.commands as Command[]);
    }
  }
  forestMap.name = "동쪽 숲길";
  execTool(project, "set_map_properties", { mapId: M.castle, name: "마왕성 1층" });
  execTool(project, "set_map_properties", { mapId: M.castle2, name: "마왕성 꼭대기" });

  for (const id of Object.keys(project.maps)) if (!(Object.values(M) as string[]).includes(id)) delete project.maps[id];

  return {
    hallStart: { x: 23, y: 12 },
    capital: { fromHall: west, guildDoor: { x: guildDoor.x, y: guildDoor.y }, plaza, bakeryDoor: { x: bakeryDoor.x, y: bakeryDoor.y }, eastGate: { x: gateEv.x, y: gateEv.y } },
    guildEntry: { x: 6, y: 18 },
    forest: { entry: rmap.entry, clearing: rmap.clearing },
    goblin: { entry: goblinEntry, gathering: vd.gathering?.door ?? { x: 23, y: 17 }, castleGate: northMost },
    castle: { entry: f1.entrance, stairFront: f1.exitStair?.front ?? { x: 27, y: 9 }, rooms: f1.rooms, corridors: f1.corridors },
    castle2: { entry: f2.entrance, boss: bossRoom2 },
  };
}

// ── 0~1) 왕궁 소환의 방 ──
function buildHall(project: Project, b: Built): void {
  const map = project.maps[M.hall]!;
  custom(map, BGM_HALL);
  const me = b.hallStart;
  const kingAt = nearestFree(project, map, { x: 23, y: 5 });
  const priestAt = nearestFree(project, map, { x: 21, y: 8 }, [kingAt]);
  const edelAt = nearestFree(project, map, { x: 25, y: 14 }, [kingAt, priestAt, me]);
  const KING = "ev_ig_h_king", PRIEST = "ev_ig_h_priest", EDEL = "ev_ig_h_edel";

  const summon: Command[] = [
    bgm(BGM_HALL, 300),
    flash("white", 600), playSe(SE_SUMMON), wait(400),
    ...say("priest", "surprised", "성공이다! 전설의 용사가 내려오셨다!"),
    emote("player", "exclamation", 700),
    ...say("king", "happy", "용사여, 아르벤 왕국에 온 것을 환영하오.\n부디 마왕을 쓰러뜨려 주시오."),
    ...say("minjae", "surprised", "잠깐만요. 저 내일 모의고사인데요."),
    ...say("king", "doubtful", "모의고사…? 그건 어느 마물이오?"),
    choices([
      { text: "와이파이 비번이 뭐예요?", then: [
        ...say("priest", "surprised", "와이…? 고대 주문이옵니까?"), ...chaos(),
      ] },
      { text: "계약서부터 보여 주세요", then: [
        ...say("priest", "serious", "용사 대본이옵니다. 7장 3절,\n「용사는 마왕을 벤다」."),
        ...say("minjae", "doubtful", "보수 칸이 비었는데요?"), ...chaos(),
      ] },
      { text: "집에 보내 주세요", then: [
        ...say("king", "sad", "돌려보내는 주문은 우리도 모르오."),
      ] },
    ]),
    ...say("king", "serious", "귀환 주문서는 마왕성 꼭대기에 있소."),
    ...say("minjae", "base", "마왕성만 가면 집에 간다는 거죠?\n오케이. 모의고사 전에 끝낸다."),
    walkTo(EDEL, { x: me.x + 1, y: me.y }),
    ...say("edel", "determined", "기사 에델, 모시겠습니다!\n대본 1장 1절, 「용사는 왕께 무릎을 꿇는다」."),
    ...say("minjae", "base", "안 꿇는데요."),
    emote(EDEL, "exclamation", 700),
    setVar(V_STAGE, "=", 1),
    ...join(ACTOR.edel, "에델"),
    ...say("king", "base", "먼저 광장 앞 모험가 길드에 등록하시오."),
    objective("왕도 광장 앞 모험가 길드에서 등록하기"),
  ];
  map.events.push(event("ev_ig_h_summon", "소환", { x: 0, y: 0 }, [
    gone("ev_ig_h_summon_off", []),
    page("ev_ig_h_summon_on", [varIs(V_STAGE, 0)], summon, { trigger: "auto" }),
  ]));
  map.events.push(event(KING, "국왕 루드릭", kingAt, [
    page(`${KING}_p`, [], [faceHero(KING),
      ifCond(varAtLeast(V_STAGE, 2), [...say("king", "happy", "엘프 마법사까지 데려가시오? 대본 3장이 앞당겨졌군.")],
        [...say("king", "base", "길드부터 가시오. 대본 2장이오.")]),
    ], { who: "king" }),
  ]));
  map.events.push(event(PRIEST, "대신관 오르반", priestAt, [
    page(`${PRIEST}_p`, [], [faceHero(PRIEST),
      ...say("priest", "serious", "귀환 주문서는 마왕성 꼭대기에.\n마왕이 지키고 있사옵니다."),
      ...say("minjae", "doubtful", "그 마왕은 왜 안 쓰고 지켜요?"),
      ...say("priest", "worried", "…그건 아무도 모르옵니다."),
    ], { who: "priest" }),
  ]));
  map.events.push(event(EDEL, "에델", edelAt, [
    page(`${EDEL}_p`, [varIs(V_STAGE, 0)], [], { who: "edel", dir: "up" }),
    gone(`${EDEL}_gone`, [varAtLeast(V_STAGE, 1)]),
  ]));

  // 보물고 — 손대면 깽판 지수.
  const chestAt = nearestFree(project, map, { x: 7, y: 20 });
  map.events.push(event("ev_ig_h_treasury", "보물고 왕관대", chestAt, [
    page("ev_ig_h_treasury_p", [swOff(SW_TREASURY)], [
      ...caption("왕관 받침대 아래에 은화 자루가 쌓여 있다."),
      ...say("edel", "surprised", "용사님, 그건 국고입니다!"),
      choices([
        { text: "한 줌만. 활동비야", then: [playSe(SE_COIN), gold(120), ...caption("은화 120닢을 챙겼다."), ...say("edel", "crying", "대본에 이런 장면은 없는데…"), ...chaos(), setSw(SW_TREASURY)] },
        { text: "알았어, 안 만져", then: [...say("edel", "happy", "역시 용사님!")] },
      ]),
    ]),
    page("ev_ig_h_treasury_done", [swOn(SW_TREASURY)], [...caption("자루에 「용사 활동비 장부」가 붙어 있다. 아무도 안 적었다.")]),
  ]));
}

// ── 1~2) 왕도 ──
function buildCapital(project: Project, b: Built): void {
  const map = project.maps[M.capital]!;
  custom(map, BGM_CAPITAL);
  const c = b.capital;
  const kidAt = nearestFree(project, map, { x: c.plaza.x - 3, y: c.plaza.y - 1 });
  const merchantAt = nearestFree(project, map, { x: c.plaza.x + 2, y: c.plaza.y }, [kidAt]);
  const villagerAt = nearestFree(project, map, { x: c.guildDoor.x + 4, y: c.guildDoor.y + 2 }, [kidAt, merchantAt]);
  const guardAt = nearestFree(project, map, { x: c.eastGate.x - 1, y: c.eastGate.y - 1 }, [c.eastGate]);
  const backFromGate = nearestFree(project, map, { x: c.eastGate.x - 2, y: c.eastGate.y }, [c.eastGate, guardAt]);

  map.events.push(event("ev_ig_c_kid", "꼬마", kidAt, [
    page("ev_ig_c_kid_p", [], [faceHero("ev_ig_c_kid"),
      ...say("kid", "happy", "용사님 레벨 몇이에요?"),
      ...say("minjae", "base", "고2."),
      ...say("kid", "doubtful", "그게 몇 레벨인데요?"),
      ...say("minjae", "base", "야자 끝나면 만렙."),
    ], { who: "kid" }),
  ]));
  map.events.push(event("ev_ig_c_villager", "주민", villagerAt, [
    page("ev_ig_c_villager_p", [], [faceHero("ev_ig_c_villager"),
      ...say("villager", "worried", "동쪽 숲 너머 반반 마을 알아요?\n사람이랑 고블린이 반반 사는 곳인데,"),
      ...say("villager", "annoyed", "요즘 서로 말이 안 통해서 싸운대요.\n고블린이 길에서 통행세까지 받고요."),
    ], { who: "villager" }),
  ]));
  // 장터 상인 — 여관 주인의 부탁을 들었으면 불꽃고추를 흥정한다.
  map.events.push(event("ev_ig_c_merchant", "상인", merchantAt, [
    page("ev_ig_c_merchant_p", [], [faceHero("ev_ig_c_merchant"),
      ...say("merchant", "happy", "드래곤도 운다는 불꽃고추!\n한 줌에 은화 다섯 닢!"),
    ], { who: "merchant" }),
    page("ev_ig_c_merchant_ask", [swOn(SW_CHILI_ASK), swOff(SW_CHILI)], [faceHero("ev_ig_c_merchant"),
      ...say("merchant", "happy", "불꽃고추 찾아요? 한 줌에 은화 다섯 닢!"),
      choices([
        { text: "사장님, 단골할게요. 서비스로 주세요", then: [
          ...say("merchant", "surprised", "단골…? 처음 보는 얼굴인데?"),
          ...say("minjae", "happy", "내일부터 매일 올게요. 아마도."),
          ...say("merchant", "happy", "하하, 배짱 좋네! 가져가!"), ...chaos(),
        ] },
        { text: "은화 다섯 닢 낸다", then: [playSe(SE_COIN), { kind: "changeGold", op: "-=", amount: 5 } as Command, ...say("merchant", "happy", "정직한 손님이네! 한 줌 더 얹어 줄게.")] },
      ]),
      giveItem(ITEM.chili), setSw(SW_CHILI), playSe(SE_OK), ...caption("불꽃고추 한 줌을 얻었다."),
      objective("길드 주방의 여관 주인에게 불꽃고추 가져가기"),
    ], { who: "merchant" }),
    page("ev_ig_c_merchant_after", [swOn(SW_CHILI)], [faceHero("ev_ig_c_merchant"),
      ...say("merchant", "happy", "그 고추 맵다. 눈 비비지 마!"),
    ], { who: "merchant" }),
  ]));
  // 동쪽 문지기 — 길드 등록·피오 합류 전에는 막는다.
  map.events.push(event("ev_ig_c_guard", "근위병", guardAt, [
    page("ev_ig_c_guard_p", [], [faceHero("ev_ig_c_guard"),
      ifCond(varAtLeast(V_STAGE, 2), [...say("guard", "base", "동쪽 숲에 슬라임이 나옵니다. 조심하십시오.")],
        [...say("guard", "base", "길드 등록증이 없으면 성 밖으로 못 나갑니다.")]),
    ], { who: "guard", dir: "left" }),
  ]));
  // 숲 이동 이벤트 앞에 막는 페이지를 깐다 — 이동 페이지는 2단계 이상에서만 맞는다(마지막에 맞는 페이지가 이긴다).
  const gate = map.events.find((e) => e.x === c.eastGate.x && e.y === c.eastGate.y)!;
  for (const p of gate.pages ?? []) p.conditions = [...(p.conditions ?? []), varAtLeast(V_STAGE, 2)];
  gate.pages = [
    page("ev_ig_c_gate_block", [], [...say("guard", "serious", "잠깐! 길드 등록부터 하고 오십시오."), walkTo("@player", backFromGate)], { trigger: "playerTouch" }),
    ...(gate.pages ?? []),
  ];
}

// ── 1~2) 모험가 길드 ──
function buildGuild(project: Project, _b: Built): void {
  const map = project.maps[M.guild]!;
  custom(map, BGM_GUILD);
  const clerkAt = nearestFree(project, map, { x: 6, y: 10 });
  const fioAt = nearestFree(project, map, { x: 9, y: 15 }, [clerkAt]);
  const cookAt = nearestFree(project, map, { x: 5, y: 3 });
  const crowd = [nearestFree(project, map, { x: 5, y: 12 }, [clerkAt, fioAt]), nearestFree(project, map, { x: 7, y: 12 }, [clerkAt, fioAt]), nearestFree(project, map, { x: 6, y: 13 }, [clerkAt, fioAt])];
  const line = [{ x: 6, y: 11 }, { x: 6, y: 12 }, { x: 6, y: 13 }].map((want, i) => nearestFree(project, map, { x: want.x + 2, y: want.y + i }, [clerkAt, fioAt, ...crowd]));
  const CLERK = "ev_ig_g_clerk", FIO = "ev_ig_g_fio", COOK = "ev_ig_g_cook";
  const advIds = crowd.map((_, i) => `ev_ig_g_adv${i}`);

  const scene: Command[] = [
    ...say("adventurer", "angry", "내가 먼저 왔다고!"),
    ...say("clerk", "crying", "한 분씩! 한 분씩요!"),
    ...think("급식실 배식 5분 전이랑 똑같네."),
    ...say("edel", "worried", "용사님, 대본에는 「인파를 헤치고 나아간다」고…"),
    ...say("minjae", "determined", "대본 말고, 급식 줄 세우기다."),
    choices([
      { text: "번호표 뽑으세요!", then: [playSe(SE_PAPER), ...caption("민재는 수첩을 찢어 번호를 적어 나눠 줬다."), ...say("adventurer", "surprised", "…3번? 나 3번이다!")] },
      { text: "레벨 낮은 순으로 서!", then: [...say("adventurer", "doubtful", "레벨이 뭔데?"), ...say("minjae", "annoyed", "그냥 키 순서로 서요!"), ...chaos()] },
      { text: "새치기하면 맨 뒤로!", then: [shake(300, "1"), ...say("adventurer", "surprised", "히익, 알았어!"), ...chaos()] },
    ]),
    ...advIds.map((id, i) => walkTo(id, line[i]!, i === advIds.length - 1)),
    playSe(SE_OK), emote(CLERK, "heart", 900),
    ...say("clerk", "happy", "…처음으로 줄이 섰어요. 등록 도와드릴게요.\n직업을 적어 주세요."),
    choices([
      { text: "고등학생", then: [...say("clerk", "doubtful", "고등학생…? 처음 보는 직업이네요. 특기는요?"), ...say("minjae", "base", "급식 줄 세우기요. 방금 보셨잖아요.")] },
      { text: "용사(임시)", then: [...say("clerk", "smile", "임시라니 겸손하시네요."), ...say("minjae", "base", "아뇨, 진짜 임시예요. 내일 모의고사라.")] },
      { text: "무직", then: [...say("edel", "crying", "용사님!!"), ...chaos()] },
    ]),
    playSe(SE_PAPER), ...caption("길드 등록증을 받았다. 「등급: 돌멩이」."),
    ...say("clerk", "worried", "…피오 씨, 또 우세요?"),
    walkTo(FIO, { x: clerkAt.x + 1, y: clerkAt.y + 2 }),
    ...say("fio", "crying", "마탑 승급 시험, 일곱 번째 떨어졌어요.\n파이어볼 주문은 다 외웠는데…"),
    ...say("minjae", "doubtful", "외우기만 했어? 기출은 풀어 봤고?"),
    ...say("fio", "surprised", "기, 기출…?"),
    choices([
      { text: "기출부터 풀어. 문제는 돌아온다", then: [...say("fio", "surprised", "작년 문제를… 올해 또 낸다고요?"), ...say("minjae", "base", "출제 위원도 사람이야. 바쁘거든.")] },
      { text: "요점만 세 줄로 줄여", then: [...say("fio", "happy", "세 줄…! 마법 이론서가 300쪽인데!"), ...say("minjae", "base", "그러니까 세 줄.")] },
      { text: "그냥 시험장 불 질러", then: [...say("fio", "surprised", "그건 범죄예요!"), ...say("edel", "crying", "그건 대본에도 없습니다!"), ...chaos()] },
    ]),
    ...say("fio", "determined", "따라갈게요. 마왕성 가는 길에 공부 좀 가르쳐 주세요!"),
    ...say("minjae", "happy", "과외비는 마왕 잡고 받는다."),
    setVar(V_STAGE, "=", 2),
    ...join(ACTOR.fio, "피오"),
    giveItem(ITEM.crystal), playSe(SE_OK), ...caption("피오에게 통신 수정구를 빌렸다.\n여럿이 한꺼번에 말할 수 있다고 한다."),
    ...think("단톡방이네."),
    setSw(SW_LINE),
    objective("동쪽 성문으로 나가 반반 마을로"),
  ];
  map.events.push(event("ev_ig_g_scene", "길드 줄", { x: 0, y: 0 }, [
    gone("ev_ig_g_scene_off", []),
    page("ev_ig_g_scene_on", [varIs(V_STAGE, 1), swOff(SW_LINE)], scene, { trigger: "auto" }),
  ]));
  map.events.push(event(CLERK, "접수원 리나", clerkAt, [
    page(`${CLERK}_p`, [], [faceHero(CLERK), ...say("clerk", "happy", "줄 서기 규칙, 길드 공식 규칙으로 정했어요!\n이름은 「민재 규칙」.")], { who: "clerk" }),
  ]));
  map.events.push(event(FIO, "피오", fioAt, [
    page(`${FIO}_p`, [], [], { who: "fio", dir: "up" }),
    gone(`${FIO}_gone`, [swOn(SW_LINE)]),
  ]));
  crowd.forEach((at, i) => {
    const lines = [
      ["줄 서니까 오히려 빠르네…", "다들 군대 다녀왔나?"],
      ["반반 마을 고블린들, 원래 착했어.", "요즘 서로 말이 안 통해서 그래."],
      ["번호표… 집에 가져가도 되나?"],
    ][i]!;
    const who = (["adventurer", "adventurer2", "adventurer3"] as const)[i]!;
    map.events.push(event(advIds[i]!, "모험가", at, [
      page(`${advIds[i]}_p`, [], [faceHero(advIds[i]!), ...say(who, "base", ...lines)], { who }),
    ]));
  });
  // 여관 주인 — 떡볶이 부탁(떡볶이 결말의 열쇠).
  map.events.push(event(COOK, "여관 주인", cookAt, [
    page(`${COOK}_p`, [], [faceHero(COOK),
      ...say("cook", "base", "배고프면 스튜 있어. 빵이랑."),
      ...say("minjae", "sad", "떡볶이 먹고 싶다…"),
      ...say("cook", "doubtful", "떡…볶이? 그게 뭔데?"),
      ...say("minjae", "determined", "쌀 반죽을 길게 밀어서, 빨갛고 맵게 볶아요."),
      ...say("cook", "happy", "재밌네. 매운 거라면 장터 불꽃고추지.\n한 줌 가져오면 만들어 볼게."),
      setSw(SW_CHILI_ASK), objective("광장 상인에게 불꽃고추 구하기"),
    ], { who: "cook" }),
    page(`${COOK}_wait`, [swOn(SW_CHILI_ASK)], [faceHero(COOK), ...say("cook", "base", "불꽃고추 한 줌. 광장 상인한테 있어.")], { who: "cook" }),
    page(`${COOK}_cook`, [swOn(SW_CHILI), swOff(SW_TTEOK)], [faceHero(COOK),
      ...say("cook", "happy", "왔구나! 잠깐만."),
      takeItem(ITEM.chili), ...fadeOut(400), playSe("cc0-se-osx-pot-01"), wait(700), ...fadeIn(400),
      ...say("cook", "happy", "자, 「이세계 떡볶이」. 맛 좀 봐."),
      ...say("minjae", "crying", "…이 맛이야. 조금 다른데, 이 맛이야."),
      giveItem(ITEM.tteok), setSw(SW_TTEOK), playSe(SE_OK), ...caption("이세계 떡볶이를 얻었다."),
      ...say("cook", "happy", "하나 더 싸 줄게. 누구 줄 사람 있으면 줘."),
      ifCond(varAtLeast(V_STAGE, 2), [objective("동쪽 성문으로 나가 반반 마을로")], [objective("왕도 광장 앞 모험가 길드에서 등록하기")]),
    ], { who: "cook" }),
    page(`${COOK}_done`, [swOn(SW_TTEOK)], [faceHero(COOK), ...say("cook", "happy", "떡볶이, 메뉴판에 올렸어. 「용사 정식」.")], { who: "cook" }),
  ]));
}

// ── 2~3) 동쪽 숲길 — 첫 전투 ──
function buildForest(project: Project, b: Built): void {
  const map = project.maps[M.forest]!;
  custom(map, BGM_FOREST);
  const SL = "ev_ig_f_slime";
  const slimeAt = nearestFree(project, map, { x: b.forest.entry.x + 5, y: b.forest.entry.y });
  const fight: Command[] = [
    walkTo(SL, { x: b.forest.entry.x + 2, y: b.forest.entry.y }),
    emote("player", "exclamation", 800),
    ...say("fio", "surprised", "슬라임이에요! 셋이나!"),
    ...say("edel", "determined", "대본 4장, 「용사는 홀로 앞에 선다」!"),
    ...say("minjae", "base", "아니. 하나만 다 같이 친다. 점사."),
    ...battle(TROOP.slime,
      [setSw(SW_SLIME), ...say("edel", "surprised", "넷이 한 마리씩… 이렇게 빨리?"), ...say("minjae", "happy", "PC방에서 배웠어. 오더는 짧게.")],
      [setSw(SW_SLIME), ...caption("셋은 슬라임 점액을 뒤집어쓰고 겨우 일어났다."), ...say("minjae", "annoyed", "…다음엔 점사 오더부터 쓴다.")]),
    bgm(BGM_FOREST, 600),
    setVar(V_STAGE, "=", 3),
    objective("숲길 끝 빈터를 지나 반반 마을로"),
  ];
  map.events.push(event(SL, "슬라임", slimeAt, [
    gone(`${SL}_off`, []),
    page(`${SL}_on`, [varIs(V_STAGE, 2), swOff(SW_SLIME)], fight, { who: "slime", dir: "left", trigger: "auto" }),
  ]));
  const signAt = nearestFree(project, map, { x: b.forest.clearing.x, y: b.forest.clearing.y + 1 }, [slimeAt]);
  map.events.push(event("ev_ig_f_sign", "이정표", signAt, [
    page("ev_ig_f_sign_p", [], [...note("← 왕도 아르벤", "반반 마을 →", "「통행세 받음. 고블린 일동」")]),
  ]));
}

// ── 3~4) 반반 마을 — 단톡방 외교 ──
function buildGoblin(project: Project, b: Built): void {
  const map = project.maps[M.goblin]!;
  custom(map, BGM_GOBLIN);
  const g = b.goblin;
  const KKUR = "ev_ig_v_kkur", CHIEF = "ev_ig_v_chief", GOB = "ev_ig_v_goblin";
  const gobAt = nearestFree(project, map, { x: g.entry.x + 4, y: g.entry.y });
  const chiefAt = nearestFree(project, map, { x: g.gathering.x - 2, y: g.gathering.y + 2 }, [gobAt]);
  const kkurAt = nearestFree(project, map, { x: g.gathering.x + 2, y: g.gathering.y + 2 }, [gobAt, chiefAt]);
  const kidAt = nearestFree(project, map, { x: g.castleGate.x, y: g.castleGate.y + 3 }, [gobAt, chiefAt, kkurAt]);
  mustReach(project, map, g.entry, g.castleGate, "반반 마을 입구 → 마왕성 입구");

  const chat = (who: string, line: string): Command[] => [playSe(SE_CHAT), ...caption(`[단톡] ${who}: ${line}`)];
  const diplo = (): Command => setVar(V_DIPLO, "+=", 1);
  const kkurJoins: Command[] = [
    ...say("kkur", "happy", "꾸르르. 너 말 잘 통한다.\n방장 해라. 나는 부방장."),
    ...say("minjae", "base", "그럼 같이 가. 마왕성."),
    ...say("kkur", "serious", "마왕성. 북쪽 숲 위. 마왕, 이상한 문제 낸다.\n못 풀면 못 지나간다."),
    ...say("fio", "worried", "문제요…? 시험 같은 거요?"),
    setVar(V_STAGE, "=", 4),
    ...join(ACTOR.kkur, "꾸르"),
    objective("마을 북쪽 숲 위 마왕성으로"),
  ];
  const scene: Command[] = [
    walkTo(GOB, { x: g.entry.x + 2, y: g.entry.y }),
    ...say("goblin", "angry", "통행세! 한 명에 은화 세 닢!"),
    ...say("edel", "determined", "대본 5장, 「용사는 고블린을 벤다」!"),
    ...say("minjae", "doubtful", "잠깐. 일단 얘기부터 들어 보자."),
    walkTo(CHIEF, { x: g.entry.x + 3, y: g.entry.y + 1 }),
    ...say("chief", "worried", "죄송합니다, 여행자님. 이 마을은 사람이랑 고블린이 반반 삽니다."),
    ...say("chief", "sad", "요즘 서로 말이 안 통해서,\n저쪽은 통행세를 받고 우리는 울타리를 쳤지요."),
    walkTo(KKUR, { x: g.entry.x + 4, y: g.entry.y + 1 }),
    ...say("kkur", "angry", "꾸르! 사람들 우리 밭 밟는다!"),
    ...say("chief", "annoyed", "그쪽이 우리 닭 가져갔잖소!"),
    ...think("교실 단톡방 터지기 직전이랑 똑같네."),
    ...say("minjae", "determined", "피오, 그 수정구. 다 같이 말할 수 있다 그랬지?"),
    ...say("fio", "surprised", "네! 여기 손을 대면 다 같이…"),
    ...say("minjae", "base", "단톡방 판다. 방 이름은 「반반 마을 공지방」."),
    flash("blue", 300), playSe(SE_CHAT),
    ...chat("꾸르", "꾸르르!! 밭!! 밟지마!!"),
    ...chat("촌장", "닭부터 돌려주시오"),
    choices([
      { text: "공지: 밭은 울타리 안, 닭은 오늘 해 지기 전에 반납", then: [diplo(), ...chat("꾸르", "…울타리 안. 알았다"), ...chat("촌장", "해 지기 전이면 되오")] },
      { text: "일단 다들 이모티콘 하나씩 보내", then: [diplo(), ...chaos(), ...chat("꾸르", "(웃는 고블린)"), ...chat("촌장", "(웃는 닭)"), ...say("fio", "happy", "분위기가 풀렸어요!")] },
      { text: "싸우는 사람 강퇴합니다", then: [...chat("꾸르", "강퇴?? 꾸르 방장 아니다??"), ...chat("촌장", "(나갔습니다)")] },
    ]),
    ...chat("고블린", "그래도 통행세는 받아야 한다. 길 우리가 닦았다"),
    choices([
      { text: "통행세 말고 마을 입장료. 반반 나눠", then: [diplo(), ...chat("촌장", "…그거 괜찮소"), ...chat("꾸르", "반반. 꾸르르. 좋다")] },
      { text: "입장료 대신 떡볶이 레시피 공유", then: [diplo(), ...chaos(), ...chat("꾸르", "떡볶이 뭐냐"), ...chat("여관 주인(왕도)", "우리 가게 「용사 정식」. 와서 먹어")] },
      { text: "통행세 안 내. 비켜", then: [...chat("꾸르", "꾸르르르!!!")] },
    ]),
    ifCond(varAtLeast(V_DIPLO, 2), [
      playSe(SE_OK),
      ...say("chief", "happy", "…허허. 몇 년 만에 말이 통했소."),
      ...say("kkur", "happy", "꾸르. 닭 돌려준다. 내일."),
      ...kkurJoins,
    ], [
      ...say("kkur", "angry", "말로 안 된다! 몸으로 하자!"),
      ...battle(TROOP.goblin,
        [...say("kkur", "surprised", "…너 쎄다."), ...say("minjae", "annoyed", "단톡방이 더 빨랐을 텐데.")],
        [...caption("민재 일행은 흙바닥에 뒹굴었다. 꾸르도 숨이 찼다."), ...say("kkur", "doubtful", "…너 약한데 안 도망간다. 이상한 놈.")]),
      bgm(BGM_GOBLIN, 600),
      ...kkurJoins,
    ]),
  ];
  map.events.push(event(GOB, "고블린", gobAt, [
    page(`${GOB}_p`, [varIs(V_STAGE, 3)], scene, { who: "goblin", dir: "left", trigger: "auto" }),
    page(`${GOB}_after`, [varAtLeast(V_STAGE, 4)], [faceHero(GOB), ...say("goblin", "happy", "입장료 반반. 장부 내가 쓴다. 꾸르르.")], { who: "goblin" }),
  ]));
  map.events.push(event(CHIEF, "촌장", chiefAt, [
    page(`${CHIEF}_p`, [], [faceHero(CHIEF), ...say("chief", "happy", "공지방 알림이 계속 울리오.\n…이게 좋은 거요?")], { who: "chief" }),
  ]));
  map.events.push(event(KKUR, "꾸르", kkurAt, [
    page(`${KKUR}_p`, [varAtLeast(V_STAGE, 0)], [], { who: "kkur" }),
    gone(`${KKUR}_gone`, [varAtLeast(V_STAGE, 4)]),
  ]));
  map.events.push(event("ev_ig_v_kid", "꼬마 고블린", kidAt, [
    page("ev_ig_v_kid_p", [], [faceHero("ev_ig_v_kid"),
      ...say("goblin", "worried", "마왕성 들어가면 해골이 문제 낸다.\n틀리면 맞는다. 아프다."),
    ], { who: "goblin" }),
  ]));
}

// ── 4~5) 마왕성 1층 — 기출 함정 · 교무부장 ──
function buildCastle(project: Project, b: Built): void {
  const map = project.maps[M.castle]!;
  custom(map, BGM_CASTLE);
  const k = b.castle;
  map.events.push(event("ev_ig_k1_enter", "마왕성 입구", { x: 0, y: 0 }, [
    gone("ev_ig_k1_enter_off", []),
    page("ev_ig_k1_enter_on", [varIs(V_STAGE, 4), swOff("sw_ig_k1_seen")], [
      setLight(0.55, "#1c1630", 0),
      ...say("edel", "worried", "…대본에 마왕성 장은 없습니다.\n앞 용사들은 다 여기서 끝났거든요."),
      ...say("minjae", "base", "그럼 여기부터 우리가 쓰면 되지."),
      setSw("sw_ig_k1_seen"),
    ], { trigger: "auto" }),
  ]));

  // 기출 함정 — 큰 홀에서 창고로 가는 통로 전체를 밟으면 해골 출제 위원이 솟는다.
  const cor = k.corridors.find((c) => c.from === "hall") ?? k.corridors[1]!;
  const EX = "ev_ig_k1_examiner";
  const exAt = nearestFree(project, map, { x: cor.x + Math.floor(cor.w / 2), y: cor.y + Math.floor(cor.h / 2) });
  const quiz: Command[] = [
    emote(EX, "exclamation", 700), playSe("easyrpg-sound-darkness3"), shake(300, "1"),
    ...say("examiner", "base", "멈춰라. 마왕성 출입 시험이다."),
    ...say("examiner", "base", "1, 1, 2, 3, 5, 8, 그다음은?"),
    ...say("fio", "worried", "에, 에… 마법 수열인가요?"),
    choices([
      { text: "13", then: [playSe(SE_OK), ...say("examiner", "surprised", "…정답. 앞의 두 수를 더한다."), ...say("minjae", "base", "중2 때 기출이에요."), ...say("fio", "happy", "기출!!")] },
      { text: "11", then: [playSe(SE_WRONG), ...say("examiner", "angry", "오답. 체벌이다."),
        ...battle(TROOP.quiz, [...say("examiner", "sad", "…채점은 끝났다. 지나가라.")], [...caption("해골은 빨간 펜으로 동그라미를 하나 그려 주고 물러났다.")]), bgm(BGM_CASTLE, 600)] },
      { text: "답 말고 출제 의도부터 묻는다", then: [...say("examiner", "doubtful", "출제… 의도…?"), ...say("minjae", "base", "앞의 두 수를 더하라는 거죠? 그럼 13."),
        ...say("examiner", "crying", "…15년 동안 의도를 물은 놈은 처음이다."), ...chaos()] },
    ]),
    setSw(SW_QUIZ),
  ];
  map.events.push(event(EX, "출제 위원 해골", exAt, [
    page(`${EX}_p`, [swOff(SW_QUIZ)], [], { who: "examiner" }),
    gone(`${EX}_gone`, [swOn(SW_QUIZ)]),
  ]));
  const triggerRow = cor.y + cor.h - 1;
  for (let x = cor.x; x < cor.x + cor.w; x++) {
    const id = `ev_ig_k1_quiz_${x}`;
    map.events.push(event(id, "출제 구역", { x, y: triggerRow }, [
      gone(`${id}_off`, []),
      page(`${id}_on`, [varAtLeast(V_STAGE, 4), swOff(SW_QUIZ)], quiz, { trigger: "playerTouch" }),
    ]));
  }

  // 교무부장 — 아래층 계단 앞을 막고 선다.
  const DEAN = "ev_ig_k1_dean";
  const deanFight: Command[] = [
    ...say("dean", "base", "복도에서 뛰지 마라. 명찰은?"),
    ...say("minjae", "surprised", "…교무부장 선생님?"),
    ...say("dean", "angry", "마왕님은 지금 자율 학습 중이시다.\n방해하는 놈은 벌점이다!"),
    ...battle(TROOP.dean,
      [...say("dean", "sad", "…벌점 100점… 다 썼다…"), ...say("kkur", "happy", "꾸르! 이겼다!")],
      [...caption("교무부장은 벌점 장부를 다 쓰고 쓰러졌다. 잉크가 떨어진 것이다.")], BGM_BOSS),
    bgm(BGM_CASTLE, 600),
    setSw(SW_DEAN), setVar(V_STAGE, "=", 5),
    objective("계단으로 올라가 꼭대기의 마왕 만나기"),
  ];
  map.events.push(event(DEAN, "교무부장", k.stairFront, [
    page(`${DEAN}_p`, [swOff(SW_DEAN)], deanFight, { who: "dean", dir: "down" }),
    gone(`${DEAN}_gone`, [swOn(SW_DEAN)]),
  ]));

  // 창고 상자 — 매점 빵.
  const storage = k.rooms.find((r) => r.kind === "storage");
  if (storage) {
    const boxAt = nearestFree(project, map, { x: storage.x + 1, y: storage.y + 1 });
    map.events.push(event("ev_ig_k1_box", "낡은 상자", boxAt, [
      page("ev_ig_k1_box_p", [swOff("sw_ig_k1_box")], [playSe(SE_PAPER), giveItem("item_rice_ball"), giveItem("item_rice_ball"), ...caption("상자 안에 쪽지와 주먹밥 둘.\n「2009. 11. 11. 수능 D-1. 배고프다」"), setSw("sw_ig_k1_box")]),
      page("ev_ig_k1_box_done", [swOn("sw_ig_k1_box")], [...caption("빈 상자다. 쪽지 글씨가 반듯하다.")]),
    ]));
  }
}

// ── 5~6) 마왕성 꼭대기 — 마왕 벨제 · 결말 ──
function buildThrone(project: Project, b: Built): void {
  const map = project.maps[M.castle2]!;
  custom(map, BGM_CASTLE);
  const room = b.castle2.boss;
  const MAOU = "ev_ig_k2_maou";
  // 옥좌(던전 도구가 보스방에 놓는 dungeon-theme-throne) 앞 융단 머리에 선다 — seed 3 고정 배치에서 옥좌는 (20,32).
  mustBlock(project, map, { x: 20, y: 32 }, "마왕 옥좌");
  const maouAt = mustWalk(project, map, { x: 20, y: 34 }, "옥좌 앞 융단");
  void room;

  const homeScene = endingHome();
  const stayScene = endingStay();
  const chaosScene = endingChaos();
  const finalChoice = (withTteok: boolean): Command => choices([
    { text: "같이 수능 보러 가요", then: [
      ...say("maou", "surprised", "같이…? 15년 묵은 수험생이다. 각오해라!"),
      ...battle(TROOP.maouExam, [...say("maou", "sad", "…졌다. 아니, 이건 모의고사다. 진짜는 다음 달이다.")], [...say("maou", "happy", "…이겼다. 근데 너희 다 풀긴 풀었구나.")], BGM_BOSS),
      ...homeScene,
    ] },
    ...(withTteok ? [{ text: "떡볶이 먹을래요?", then: [takeItem(ITEM.tteok), ...stayScene] }] : []),
    { text: "한 판 붙자", then: [
      ...say("maou", "angry", "좋다! 재수생의 분노를 보여 주마!"),
      ...battle(TROOP.maouBrawl, [...say("maou", "crying", "…졌다. 15년 동안 진 적이 없었는데.")], [...say("maou", "happy", "크하하! 아직 멀었다, 후배!")], BGM_BOSS),
      ...chaosScene,
    ] },
  ]);
  const meet: Command[] = [
    ...say("maou", "base", "드디어 왔구나, 용사여. …잠깐. 그 교복."),
    emote("player", "exclamation", 800),
    ...say("minjae", "surprised", "어? 그 명찰…\n「3학년 7반 배재민」? 우리 학교잖아요!"),
    ...say("maou", "sad", "…2009년 수능 전날, 나도 여기로 불려 왔다."),
    ...say("maou", "sad", "돌아가면 수능을 봐야 했지. 그래서 안 갔다.\n마왕 노릇이 수능보다 쉬웠다."),
    ...say("edel", "surprised", "마왕이… 용사였다고요?"),
    ...say("maou", "base", "귀환 주문서는 여기 있다. 가져가라.\n대신 너도 내일 모의고사잖아."),
    ...think("주문서만 받으면 끝인데. 이 선배를 두고 가도 되나."),
    ifCond(hasItem(ITEM.tteok), [finalChoice(true)], [
      ...think("가방에 뭐라도 있었으면. 떡볶이라든가."),
      finalChoice(false),
    ]),
  ];
  map.events.push(event(MAOU, "마왕 벨제", maouAt, [
    page(`${MAOU}_p`, [swOff(SW_OVER)], [faceHero(MAOU), ...meet], { who: "maou" }),
    gone(`${MAOU}_gone`, [swOn(SW_OVER)]),
  ]));
  map.events.push(event("ev_ig_k2_enter", "꼭대기 입구", { x: 0, y: 0 }, [
    gone("ev_ig_k2_enter_off", []),
    page("ev_ig_k2_enter_on", [varIs(V_STAGE, 5), swOff("sw_ig_k2_seen")], [
      setLight(0.5, "#24123a", 0),
      ...say("fio", "worried", "위층에서 연필 긁는 소리가 나요."),
      ...say("minjae", "doubtful", "…자습실 소리인데."),
      setSw("sw_ig_k2_seen"),
    ], { trigger: "auto" }),
  ]));
}

// ── 결말 무대: 교실(귀환) · 길드 분식집(분식) ──
function buildEndingStages(project: Project): void {
  const cls = project.maps[M.class]!;
  const seat = nearestFree(project, cls, { x: DESK.x, y: DESK.y + 1 });
  // 귀환 결말의 교실 이동 칸을 실제 빈 자리로 맞춘다(결말 장면은 맵을 모르고 먼저 짜였다).
  const fix = (cmds: Command[]): void => { for (const c of cmds as unknown as Record<string, unknown>[]) {
    if (c.kind === "transfer" && c.mapId === M.class) { c.x = seat.x; c.y = seat.y; }
    for (const k of ["then", "else", "victoryBranch", "defeatBranch"]) if (Array.isArray(c[k])) fix(c[k] as Command[]);
    if (Array.isArray(c.options)) for (const o of c.options as { branch?: Command[] }[]) if (o.branch) fix(o.branch);
  } };
  for (const m of Object.values(project.maps)) for (const e of m.events) for (const p of e.pages ?? []) fix(p.commands as Command[]);
  const teacherAt = nearestFree(project, cls, { x: 7, y: 3 }, [seat]);
  const suahAt = nearestFree(project, cls, { x: seat.x + 4, y: seat.y }, [seat, teacherAt]);
  const newbieAt = nearestFree(project, cls, { x: 9, y: 3 }, [seat, teacherAt, suahAt]);
  const at = (id: string, name: string, cell: Cell, who: "teacher" | "suah" | "maou", dir: "down" | "up" | "left" | "right") =>
    cls.events.push(event(id, name, cell, [gone(`${id}_off`, []), page(`${id}_on`, [swOn(SW_HOME)], [], { who, dir })]));
  at("ev_ig_cl_teacher", "담임", teacherAt, "teacher", "down");
  at("ev_ig_cl_suah", "수아", suahAt, "suah", "left");
  at("ev_ig_cl_newbie", "배재민", newbieAt, "maou", "down");
  custom(cls, BGM_HOME);
  cls.events.push(event("ev_ig_cl_end_home", "귀환 결말", { x: 0, y: 0 }, [
    gone("ev_ig_cl_end_home_off", []),
    page("ev_ig_cl_end_home_on", [swOn(SW_HOME), swOff(SW_OVER)], endingHomeArrive(), { trigger: "auto" }),
  ]));

  const guild = project.maps[M.guild]!;
  const chefAt = nearestFree(project, guild, { x: 4, y: 12 });
  guild.events.push(event("ev_ig_g_chef_maou", "분식집 사장 벨제", chefAt, [gone("ev_ig_g_chef_maou_off", []), page("ev_ig_g_chef_maou_on", [swOn(SW_STAY)], [], { who: "maou", dir: "down" })]));
  for (const ev of guild.events) if (ev.id.startsWith("ev_ig_g_adv")) ev.pages = [...(ev.pages ?? []), gone(`${ev.id}_stay`, [swOn(SW_STAY)])];
  const kkurAt = nearestFree(project, guild, { x: 8, y: 13 }, [chefAt]);
  guild.events.push(event("ev_ig_g_end_stay", "분식 결말", { x: 0, y: 0 }, [
    gone("ev_ig_g_end_stay_off", []),
    page("ev_ig_g_end_stay_on", [swOn(SW_STAY), swOff(SW_OVER)], endingStayArrive(), { trigger: "auto" }),
  ]));
  guild.events.push(event("ev_ig_g_kkur_stay", "꾸르", kkurAt, [gone("ev_ig_g_kkur_stay_off", []), page("ev_ig_g_kkur_stay_on", [swOn(SW_STAY)], [], { who: "kkur", dir: "left" })]));
}

// ── 결말 장면 ──
const endingCommon = (endingId: string): Command[] => [setSw(SW_OVER), setVar(V_STAGE, "=", 6), ...fadeOut(900), { kind: "triggerEnding", endingId } as Command];

function endingHome(): Command[] {
  const room: Cell = { x: DESK.x, y: DESK.y + 1 }; // buildEndingStages 가 실제 빈 자리로 고친다
  return [
    ...say("maou", "base", "…좋다. 같이 가자. 이번엔 도망 안 간다."),
    ...say("edel", "crying", "용사님, 대본 마지막 장은 제가 쓰겠습니다!"),
    ...say("fio", "happy", "기출, 계속 풀게요!"),
    ...say("kkur", "happy", "공지방 나가지 마라. 꾸르."),
    flash("white", 700), playSe(SE_SUMMON), ...fadeOut(800),
    stopBgm(), setSw(SW_HOME),
    { kind: "transfer", mapId: M.class, x: room.x, y: room.y, direction: "up", fade: "white" } as Command,
  ];
}

/** 귀환 결말 — 교실에 도착한 뒤(맵 이벤트는 장소 이동에서 끝나므로 도착 맵의 자동 장면으로 잇는다). */
function endingHomeArrive(): Command[] {
  return [
    setLight(0, "#000000", 0),
    bgm(BGM_HOME, 600), ...fadeIn(900),
    ...say("teacher", "annoyed", "강민재! 모의고사 날 엎드려 자?"),
    ...say("minjae", "surprised", "…꿈?"),
    playSe(SE_CHAT), ...caption("[단톡] 에델: 용사님, 대본 8장은 제가 씁니다."),
    ...say("minjae", "happy", "…꿈 아니네."),
    ...say("teacher", "base", "그리고 오늘부터 같이 공부할 사람이다. 자기소개."),
    ...say("maou", "embarrassed", "배재민이다. …15수생이다. 잘 부탁한다, 후배들."),
    ...say("suah", "surprised", "민재야, 저 아저씨 뿔 달렸어."),
    ...say("minjae", "happy", "선배야. 기출 잘 풀어."),
    ...endingCommon(END_HOME),
  ];
}

function endingStay(): Command[] {
  return [
    ...say("maou", "surprised", "이 냄새… 고추장?"),
    ...caption("마왕은 떡볶이를 한 입 먹고 한참 말이 없었다."),
    ...say("maou", "crying", "…15년 만이다. 학교 앞 분식집 맛이다."),
    ...say("minjae", "base", "여관 주인 아저씨가 만들었어요. 불꽃고추로."),
    ...say("maou", "determined", "결정했다. 마왕 그만둔다. 분식집 한다."),
    ...say("edel", "surprised", "대본에 그런 결말은…"),
    ...say("minjae", "happy", "없으면 지금 쓰면 되지."),
    ...fadeOut(800), stopBgm(), setSw(SW_STAY),
    { kind: "transfer", mapId: M.guild, x: 6, y: 14, direction: "up", fade: "black" } as Command,
  ];
}

/** 분식 결말 — 길드에 도착한 뒤(도착 맵의 자동 장면). */
function endingStayArrive(): Command[] {
  return [
    bgm(BGM_END, 600), ...fadeIn(900),
    ...caption("한 달 뒤. 모험가 길드 1층에 「이세계 분식 1호점」이 열렸다."),
    ...say("cook", "happy", "떡볶이 둘, 순대 하나! …순대가 뭔지는 아직 몰라."),
    ...say("maou", "happy", "어서 오십시오! 오늘의 메뉴는 「용사 정식」!"),
    ...say("kkur", "happy", "입장료 반반처럼, 매출도 반반. 꾸르르."),
    ...say("minjae", "base", "모의고사요? …내일 볼게요. 이세계 내일."),
    ...endingCommon(END_STAY),
  ];
}

function endingChaos(): Command[] {
  return [
    playSe(SE_BOOM), shake(900, "3"), flash("yellow", 400),
    ...caption("그날, 마왕성 꼭대기 층이 통째로 날아갔다."),
    stopBgm(), bgm(BGM_END, 800),
    ...say("edel", "crying", "성이… 대본에 이런 장면은…!"),
    ...say("fio", "happy", "그래도 파이어볼 각도는 완벽했어요!"),
    ...say("maou", "embarrassed", "…성 수리비는 누가 내냐."),
    ...say("minjae", "base", "국고요. 활동비 장부 비어 있던데."),
    ifCond(varAtLeast(V_CHAOS, CHAOS_KING), [
      ...caption("왕국 연대기는 그를 이렇게 적었다.\n「깽판왕 강민재. 대본을 한 줄도 지키지 않은 용사」."),
    ], [
      ...caption("왕국 연대기는 그를 이렇게 적었다.\n「대본을 조금 고친 용사 강민재」."),
    ]),
    ...say("kkur", "happy", "다음 깽판 언제냐. 공지 올려라."),
    ...endingCommon(END_CHAOS),
  ];
}

function defineEndings(project: Project): void {
  const credits = [
    "『이세계로 떠난 한국 고딩, 깽판치다』",
    "",
    "이야기 · 연출   OPRN Flagship Studio",
    "마을 · 숲 · 마왕성   OPRN 버들항 타일 · 숲길 타일",
    "왕궁 · 길드 · 교실   OPRN 손 도트 실내 · 현대 캠퍼스 타일",
    "인물   OPRN 현대 걷기 캐릭터 · 공용 흉상 · EasyRPG RTP",
    "음악 · 효과음   CC0 음원 · EasyRPG RTP",
    "",
    "만든 도구   OPRN Studio",
    "",
    "대본은 지키라고 있는 거다. 아마도.",
  ].join("\n");
  const end = (id: string, name: string, priority: number, tone: "warm" | "dark", kicker: string, badge: string, music: string) =>
    execTool(project, "define_ending", {
      id, name, priority, conditions: [],
      presentation: { kicker, badge, musicResourceId: music, tone, portraits: "none", credits },
      epilogue: [],
    });
  end(END_HOME, "모의고사 날 아침", 10, "warm", "2학년 3반 교실", "귀환 엔딩", BGM_HOME);
  end(END_STAY, "이세계 분식 1호점", 8, "warm", "왕도 아르벤", "분식 엔딩", BGM_END);
  end(END_CHAOS, "깽판왕", 6, "dark", "아르벤 왕국 연대기", "깽판 엔딩", BGM_END);
}

export function createIsekaiGoddingFlagshipDemo(): FlagshipDemoBuildResult {
  const project = createBlankProject();
  project.meta.title = "이세계로 떠난 한국 고딩, 깽판치다";
  project.meta.author = "OPRN Flagship Studio";
  project.system.playResolution = { width: 480, height: 270 };
  delete project.system.cameraZoom;
  project.system.dialogueStyle = "glass";

  const ensureVar = (id: string, name: string): void => { if (!project.variables.some((v) => v.id === id)) project.variables.push({ id, name }); };
  const ensureSw = (id: string, name: string): void => { if (!project.switches.some((s) => s.id === id)) project.switches.push({ id, name }); };
  for (const [id, name] of [[V_STAGE, "이세계 진행 단계"], [V_CHAOS, "깽판 지수"], [V_DIPLO, "단톡방 외교"]] as const) ensureVar(id, name);

  setupIsekaiDatabase(project, BACKDROP);
  const built = buildMaps(project);
  buildHall(project, built);
  buildCapital(project, built);
  buildGuild(project, built);
  buildForest(project, built);
  buildGoblin(project, built);
  buildCastle(project, built);
  buildThrone(project, built);
  buildEndingStages(project);
  defineEndings(project);

  // 작은 실내는 화면을 채우게 확대한다(마왕 첫 플레이 검수: 화면보다 작은 맵은 검은 띠 속에 떠 있었다).
  execTool(project, "set_map_properties", { mapId: M.guild, zoom: 2 });
  execTool(project, "set_map_properties", { mapId: M.class, zoom: 1.25 });

  buildIsekaiOpening(project, M.class);
  setupIsekaiTitle(project);

  for (const id of Object.values(M)) { const m = project.maps[id]!; if (!m.defaultLighting) m.defaultLighting = { ambient: 0, color: "#000000", sources: [] }; }

  execTool(project, "configure_field_menu", { preset: "custom", entries: [
    { command: "items", label: "가방" }, { command: "skills", label: "기술" }, { command: "equipment", label: "장비" }, { command: "status", label: "상태" },
    { command: "backlog", label: "대화 기록" }, { command: "endings", label: "엔딩" },
    { command: "save", label: "저장" }, { command: "load", label: "불러오기" }, { command: "options", label: "설정" }, { command: "to-title", label: "타이틀로" },
  ] });

  project.startMapId = M.hall;
  project.startPos = built.hallStart;
  project.mapTree = { mapId: M.capital, children: [M.class, M.hall, M.guild, M.forest, M.goblin, M.castle, M.castle2].map((mapId) => ({ mapId, children: [] })) };

  // HUD — 「현재 목표」 줄 + 깽판 지수.
  execTool(project, "set_project_settings", { fieldHud: { objective: true, widgets: [
    { id: "chaos", kind: "gauge", source: "variable", variableId: V_CHAOS, max: 10, shape: "number", label: "깽판 지수", anchor: "top-left", x: 8, y: 14, width: 104, height: 30, panel: "paper", color: "#e0503a" },
  ] } });
  execTool(project, "set_project_settings", { resources: { defaultBgmResourceId: BGM_CAPITAL } });

  for (const id of new Set(JSON.stringify(project.maps).match(/sw_ig_[a-z0-9_]+/g) ?? [])) ensureSw(id, id.replace(/^sw_ig_/, "이세계 · "));
  const keepTilesets = new Set(Object.values(project.maps).map((m) => m.tilesetId));
  for (const id of [...keepTilesets]) for (const graft of project.tilesets[id]?.tileGrafts ?? []) keepTilesets.add(graft.sourceChipset);
  for (const id of Object.keys(project.tilesets)) if (!keepTilesets.has(id)) delete project.tilesets[id];

  applyIsekaiGoddingLore(project, (target, name, args) => execTool(target, name, args));

  const serialized = serialize(project);
  const reloaded = deserialize(serialized);
  return {
    id: "isekai-godding",
    manifest: { ...FLAGSHIP_BEAT_MANIFESTS["isekai-godding"], mapCount: Object.keys(reloaded.maps).length, endingCount: reloaded.endings?.length ?? 0 },
    project: reloaded,
    serialized,
  };
}
