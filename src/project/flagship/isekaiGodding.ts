/**
 * 『이세계로 떠난 한국 고딩, 대본을 찢다』 — 이세계 소환 코미디 JRPG 데모(약 20~25분, 엔딩 셋).
 *
 * 고2 강민재는 야자 시간에 배터리 3% 폰을 보다 이세계 아르벤 왕국에 일곱 번째 용사로 소환된다. 내일은 모의고사다.
 * 왕국은 300년 된 「용사 대본」대로 움직이길 바란다. 앞 용사 여섯은 대본대로 했고 아무도 돌아오지 않았다.
 * 민재의 무기는 「끝까지 읽기」다 — 대본, 두 마을의 장부, 성문 시험지, 귀환 주문서의 작은 글씨.
 * 일곱 번째 호위 기사 에델, 마탑 필기 일곱 번 낙방한 엘프 피오, 30년 도로 보수 장부를 든 고블린 꾸르가 붙는다.
 * 마왕성 꼭대기의 마왕은 2009년 수능 전날 소환된 한국 고3 배재민이다. 귀환 주문서는 한 장, 한 명.
 * 마지막 선택(주문서 끝까지 읽어 봤어요? · 떡볶이 드실래요? · 주문서 내놔요)이 세 결말을 가른다.
 *
 * 톤(v8, 처음 하는 어른 검수 둘이 v7 을 4·4.5점 「유치하다」로 매긴 뒤 다시 씀): 웃음은 건조하게, 손해는 진짜로.
 * 박수 장치(지수 HUD·번쩍임·토스트), 말버릇, 이모티콘 외교를 뺐다. 대본 이탈 수(var_ig_chaos)는 화면에 안 보이고 결말 연대기 한 줄만 바꾼다.
 *
 * 흐름은 변수 하나(var_ig_stage)가 쥔다:
 *   0 소환의 방 → 1 왕도·길드 → 2 피오 합류(동쪽 문 열림) → 3 숲 슬라임 전투 뒤 → 4 꾸르 합류(마왕성) → 5 감독관 뒤 → 6 결말.
 *
 * 맵은 전부 조수 도구로 짓는다(author_beodeul_town · author_forest_route · author_beodeul_dungeon · build_hand_interior_room ·
 * stamp_tileset_object · create_transfer_pair · set_map_properties). 사람 그림은 공용 흉상·EasyRPG 걷기 칩·현대 걷기 칩만 쓴다 — 새 그림 없음.
 */
import { withJosa } from "@/util/josa";
import { createBlankProject } from "@/project/defaults";
import { deserialize, serialize } from "@/project/io";
import type { Command, GameMap, Project } from "@/project/types";
import { FLAGSHIP_BEAT_MANIFESTS } from "./beats";
import { ACTOR, BACKDROP, ITEM, setupIsekaiDatabase, TROOP } from "./isekaiGoddingDb";
import {
  bgm, caption, type Cell, choices, emote, event, execTool, faceHero, fadeIn, fadeOut, flash, gone, ifCond, m2, mustReach,
  mustBlock, mustWalk, nearestFree, note, page, playSe, reachableCells, say, setSw, setVar, shake, stopBgm, swOff, swOn, think, varAtLeast, varIs, wait, walkTo,
} from "./isekaiGoddingKit";
import { applyIsekaiGoddingLore } from "./isekaiGoddingLore";
import { buildIsekaiOpening, DESK, setupIsekaiTitle } from "./isekaiGoddingOpening";
import type { FlagshipDemoBuildResult } from "./types";

// ── 상태 ──
const V_STAGE = "var_ig_stage";
const V_CHAOS = "var_ig_chaos";
const V_DIPLO = "var_ig_diplo";
const SW_ARRIVED = "sw_ig_arrived";
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
const SW_RUIN = "sw_ig_end_ruin";
/** 대본 이탈이 이만큼이면 7장 부록 결말의 연대기 줄이 「지킨 것 없음」이 된다. */
const CHAOS_KING = 4;

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
  ruin: "map_ig_castle_ruin",
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

// ── 작은 명령 ──
const objective = (message: string): Command =>
  ({ kind: "m2Command", commandId: "m2-214-ui-command", fields: { surface: "objectiveChip", message, durationMs: 0 } } as Command);
/** 화면을 불빛 색으로 물들인다(Screen Effect tint). 빈 값이면 걷어 낸다. */
const glow = (rgba: string, ms: number): Command => m2("Screen Effect", { effect: "tint", value: rgba, durationMs: ms });
/**
 * 대본을 어긴 선택 한 번 — 변수만 오른다. v7 의 지수 HUD·노란 번쩍임·「+1」 토스트는 처음 하는 어른 검수 둘이
 * 똑같이 1순위로 「농담마다 박수 버튼을 누른다」고 짚어 뺐다. 이 수는 7장 부록 결말의 연대기 한 줄에만 쓴다.
 */
const chaos = (): Command[] => [setVar(V_CHAOS, "+=", 1)];
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

// ── 마왕성 장식 ──
type Room = { id: string; kind: string; x: number; y: number; w: number; h: number };
const K = (id: string) => `bd-pick-dungeon-theme-${id}`;
const KC = (id: string) => `bd-pick-castle-catacombs-${id}`;
/**
 * 물건 하나를 찍어 본다. 도구가 거부하거나(받침·겹침) 찍은 뒤 꼭 닿아야 할 칸이 끊기면 그 맵을 되돌린다.
 * v7 처음 하는 사람 검수: 마왕성이 「텅 비고 어둡다」 — 던전 도구는 방마다 물건을 몇 개만 놓는다(밀도 인자 없음).
 */
function tryStamp(project: Project, mapId: string, objectId: string, base: Cell, keep: () => boolean): boolean {
  const saved = structuredClone(project.maps[mapId]!);
  try {
    execTool(project, "stamp_tileset_object", { mapId, objectId, base });
  } catch {
    project.maps[mapId] = saved;
    return false;
  }
  if (!keep()) { project.maps[mapId] = saved; return false; }
  return true;
}
/** from 에서 targets 가 전부 걸어서 닿는가. */
const reachesAll = (project: Project, mapId: string, from: Cell, targets: readonly Cell[]): boolean => {
  const seen = new Set(reachableCells(project, project.maps[mapId]!, from).map((c) => `${c.x},${c.y}`));
  return targets.every((t) => seen.has(`${t.x},${t.y}`));
};
/** 방 하나를 성답게 채운다 — 윗벽에 깃발, 윗벽 앞에 촛대·갑옷, 아래 구석에 종류별 물건. */
function dressRoom(project: Project, mapId: string, r: Room, keep: () => boolean, extra: readonly string[] = []): number {
  let n = 0;
  for (let x = r.x + 1; x < r.x + r.w - 1; x += 3) if (tryStamp(project, mapId, K("royal-banner"), { x, y: r.y - 1 }, keep)) n++;
  const stands = [K("iron-candelabra"), K("armor-stand"), K("candelabra"), K("armor-stand")];
  const cols = [r.x, r.x + r.w - 1, r.x + 2, r.x + r.w - 3];
  cols.forEach((x, i) => { if (tryStamp(project, mapId, stands[i]!, { x, y: r.y + 1 }, keep)) n++; });
  const low = r.y + r.h - 1;
  extra.forEach((id, i) => { const x = i % 2 === 0 ? r.x + Math.floor(i / 2) * 2 : r.x + r.w - 2 - Math.floor(i / 2) * 2; if (tryStamp(project, mapId, id, { x, y: low }, keep)) n++; });
  return n;
}

// ── 맵 짓기 ──
interface Built {
  hallStart: Cell;
  capital: { fromHall: Cell; guildDoor: Cell; plaza: Cell; bakeryDoor: Cell; eastGate: Cell };
  guildEntry: Cell;
  forest: { entry: Cell; clearing: Cell };
  goblin: { entry: Cell; gathering: Cell; castleGate: Cell };
  castle: { entry: Cell; stairFront: Cell; rooms: Room[]; corridors: { from: string; to: string; x: number; y: number; w: number; h: number }[] };
  castle2: { entry: Cell; seat: Cell; boss: Room };
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
  // 시드 12: 꼭대기 층 보스방이 맵 가운데 위라 마왕 장면 화면에 허공이 적다(시드 3 은 화면 오른쪽 절반이 허공이었다 — v7 검수).
  // 시드 9·6 은 보스방은 좋은데 층 사이 계단을 만들지 않는다(links [], exitStair null — 던전 도구 결함, 감독자 보고).
  const vmap = project.maps[M.goblin]!;
  const vReach = reachableCells(project, vmap, goblinEntry);
  const northMost = vReach.filter((c) => c.x > 2 && c.x < vmap.width - 3).reduce((best, c) => (c.y < best.y ? c : best), vReach[0]!);
  const dungeon = execTool(project, "author_beodeul_dungeon", { id: M.castle, name: "마왕성", type: "castle", floors: 2, size: "medium", seed: 12, populate: false, gimmick: "none",
    entrance: { fromMapId: M.goblin, x: northMost.x, y: northMost.y } });
  type FloorData = { entrance: Cell; exitStair?: { x: number; y: number; front: Cell } | null; rooms: Room[]; corridors: { from: string; to: string; x: number; y: number; w: number; h: number }[] };
  const dd = dungeon.data as { floorData: FloorData[]; floors: string[] };
  const f1 = dd.floorData[0]!, f2 = dd.floorData[1]!;
  const bossRoom2 = f2.rooms.find((r) => r.kind === "boss")!;
  // 도구의 보스 자리(population.boss)는 융단 옆 칸이라, 시드 12 고정 배치에서 옥좌(18~20, 6~8) 앞 융단 머리에 세운다.
  const seatRaw = { x: 19, y: 9 };
  const f2Id = dd.floors[1]!;
  if (f2Id !== M.castle2) throw new Error(`[isekai-godding] 마왕성 2층 id 가 ${f2Id} 이다(기대 ${M.castle2})`);

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

  // ── 마왕성 장식 — 꼭 닿아야 할 칸(입구→시험 구역·계단 앞·창고, 꼭대기 입구→마왕 자리)을 끊지 않는 것만 남긴다.
  if (!f1.exitStair) throw new Error("[isekai-godding] 마왕성 1층에 위층 계단이 없다 — 던전 시드가 층을 잇지 않았다");
  const stairFront = f1.exitStair.front;
  const cor = f1.corridors.find((c) => c.from === "hall") ?? f1.corridors[1]!;
  const quizRow: Cell[] = [];
  for (let x = cor.x; x < cor.x + cor.w; x++) quizRow.push({ x, y: cor.y + cor.h - 1 });
  // 2009 쪽지 상자를 둘 방 — 창고가 없으면 보물 방, 그것도 없으면 홀.
  const storage = f1.rooms.find((r) => r.kind === "storage") ?? f1.rooms.find((r) => r.kind === "vault") ?? f1.rooms.find((r) => r.kind === "hall");
  const f1Must = [stairFront, { x: f1.exitStair.x, y: f1.exitStair.y }, ...quizRow, ...(storage ? [{ x: storage.x + 1, y: storage.y + 1 }] : [])];
  const keep1 = () => reachesAll(project, M.castle, f1.entrance, f1Must);
  let dressed1 = 0;
  for (const r of f1.rooms) {
    const extra = r.kind === "storage" ? [K("bookshelf-tall"), K("bookshelf"), K("lectern")]
      : r.kind === "cell" ? [KC("straw-bed"), KC("cage-hanging"), KC("rubble")]
        : r.kind === "vault" ? [K("gold-pile"), K("statue-head")]
          : [K("lectern"), K("bookshelf")];
    dressed1 += dressRoom(project, M.castle, r, keep1, extra);
  }
  const seat = mustWalk(project, project.maps[M.castle2]!, seatRaw, "옥좌 앞 융단 머리");
  mustBlock(project, project.maps[M.castle2]!, { x: seat.x, y: seat.y - 2 }, "마왕 옥좌");
  const f2Must = [seat, { x: seat.x, y: seat.y + 1 }];
  const keep2 = () => reachesAll(project, M.castle2, f2.entrance, f2Must);
  let dressed2 = 0;
  for (const r of f2.rooms) dressed2 += dressRoom(project, M.castle2, r, keep2, r.kind === "boss" ? [K("bookshelf-tall"), K("lectern"), K("bookshelf-tall"), K("lectern")] : [K("bookshelf")]);
  if (process.env.IG_WARN) console.warn(`[isekai-godding] 마왕성 장식 1층 ${dressed1} · 꼭대기 ${dressed2}`);

  // ── 무너진 꼭대기 — 7장 부록 결말에서 왕좌가 터진 뒤 옮겨 가는 같은 층의 사본(v7: 폭파 뒤에도 방이 그대로였다).
  const ruin = structuredClone(project.maps[M.castle2]!);
  ruin.id = M.ruin; ruin.name = "무너진 꼭대기"; ruin.events = [];
  project.maps[M.ruin] = ruin;
  const keepR = () => reachesAll(project, M.ruin, seat, [{ x: seat.x, y: seat.y + 1 }]);
  let rubble = 0;
  const b = bossRoom2;
  const spots: Cell[] = [];
  for (let y = b.y; y < b.y + b.h; y += 2) for (let x = b.x; x < b.x + b.w; x += 2) spots.push({ x: x + ((y >> 1) & 1), y: y + 1 });
  for (const [i, c] of spots.entries()) {
    if (Math.abs(c.x - seat.x) <= 1 && c.y >= seat.y && c.y <= seat.y + 2) continue;
    const id = i % 3 === 0 ? K("rubble-heap") : i % 3 === 1 ? K("cracked-floor") : KC("rubble");
    if (tryStamp(project, M.ruin, id, c, keepR)) rubble++;
  }
  // 터진 왕좌 — 옥좌 위를 잔해와 꺼진 바닥으로 덮는다(덮어쓰기).
  for (const [id, c] of [[K("rubble-heap"), { x: seat.x - 1, y: seat.y - 1 }], [K("cracked-floor"), { x: seat.x, y: seat.y - 2 }], [KC("rubble"), { x: seat.x + 1, y: seat.y - 1 }]] as const) {
    const saved = structuredClone(project.maps[M.ruin]!);
    try { execTool(project, "stamp_tileset_object", { mapId: M.ruin, objectId: id, base: c, overwrite: true }); rubble++; } catch { project.maps[M.ruin] = saved; }
  }
  if (process.env.IG_WARN) console.warn(`[isekai-godding] 무너진 꼭대기 잔해 ${rubble}`);

  for (const id of Object.keys(project.maps)) if (!(Object.values(M) as string[]).includes(id)) delete project.maps[id];

  return {
    hallStart: { x: 23, y: 12 },
    capital: { fromHall: west, guildDoor: { x: guildDoor.x, y: guildDoor.y }, plaza, bakeryDoor: { x: bakeryDoor.x, y: bakeryDoor.y }, eastGate: { x: gateEv.x, y: gateEv.y } },
    guildEntry: { x: 6, y: 18 },
    forest: { entry: rmap.entry, clearing: rmap.clearing },
    goblin: { entry: goblinEntry, gathering: vd.gathering?.door ?? { x: 23, y: 17 }, castleGate: northMost },
    castle: { entry: f1.entrance, stairFront, rooms: f1.rooms, corridors: f1.corridors },
    castle2: { entry: f2.entrance, seat, boss: bossRoom2 },
  };
}

// ── 0~1) 왕궁 소환의 방 ──
function buildHall(project: Project, b: Built): void {
  const map = project.maps[M.hall]!;
  custom(map, BGM_HALL);
  const me = b.hallStart;
  const kingAt = nearestFree(project, map, { x: 23, y: 5 });
  const priestAt = nearestFree(project, map, { x: 21, y: 8 }, [kingAt]);
  // 에델은 옥좌 옆에 서 있다가 왕과 이야기가 끝나면 민재 곁으로 온다.
  const edelAt = nearestFree(project, map, { x: 25, y: 7 }, [kingAt, priestAt, me]);
  const KING = "ev_ig_h_king", PRIEST = "ev_ig_h_priest", EDEL = "ev_ig_h_edel";

  // 소환 직후 대사는 한 줄 — 바로 조작을 넘기고, 민재가 직접 옥좌로 걸어가면 왕이 말을 건다.
  const summon: Command[] = [
    bgm(BGM_HALL, 300),
    flash("white", 600), playSe(SE_SUMMON), wait(400),
    ...say("priest", "surprised", "성공했사옵니다. 일곱 번째 용사이옵니다.\n용사여, 폐하 앞으로."),
    emote("player", "question", 700),
    setSw(SW_ARRIVED),
    objective("옥좌의 왕에게 다가가기"),
  ];
  // 옥좌 앞 — 첫 선택지에서 바로 대본을 찢을 수 있다.
  const kingTalk: Command[] = [
    faceHero(KING),
    ...say("king", "happy", "용사여, 이 「용사 대본」대로\n마왕을 쓰러뜨려 주시오."),
    ...say("minjae", "surprised", "잠깐만요. 저 내일 모의고사인데요."),
    ...say("king", "doubtful", "시험은 마왕을 쓰러뜨린 뒤에 보시오."),
    choices([
      { text: "대본을 찢는다", then: [
        playSe(SE_PAPER), ...chaos(),
        ...say("king", "surprised", "그건 왕국에 한 부뿐인 대본이오!"),
        ...say("minjae", "base", "이거 보고 돌아온 용사는 있어요?"),
        ...say("king", "serious", "그건 대본에 없소."),
      ] },
      { text: "마지막 장부터 펼친다", then: [
        playSe(SE_PAPER),
        ...say("king", "angry", "마지막 장은 용사가 읽는 것이 아니오."),
        ...say("minjae", "doubtful", "제가 할 일인데 제가 못 읽어요?"),
      ] },
      { text: "집에 보내 주세요", then: [
        ...say("king", "sad", "돌려보내는 주문은 우리도 모르오."),
      ] },
    ]),
    ...say("king", "serious", "귀환 주문서는 마왕성 꼭대기에 있소.\n먼저 광장 앞 모험가 길드에 등록하시오."),
    walkTo(EDEL, nearestFree(project, map, { x: kingAt.x + 1, y: kingAt.y + 2 }, [kingAt, priestAt])),
    ...say("edel", "serious", "기사 에델입니다.\n용사님 호위는 이번이 일곱 번째입니다."),
    ...say("minjae", "doubtful", "앞의 여섯 분은요?"),
    emote(EDEL, "ellipsis", 900),
    ...say("edel", "worried", "길드부터 가시지요."),
    setVar(V_STAGE, "=", 1),
    ...join(ACTOR.edel, "에델"),
    objective("왕도 광장 앞 모험가 길드에서 등록하기"),
  ];
  map.events.push(event("ev_ig_h_summon", "소환", { x: 0, y: 0 }, [
    gone("ev_ig_h_summon_off", []),
    page("ev_ig_h_summon_on", [varIs(V_STAGE, 0), swOff(SW_ARRIVED)], summon, { trigger: "auto" }),
  ]));
  map.events.push(event(KING, "국왕 루드릭", kingAt, [
    page(`${KING}_p`, [], [faceHero(KING),
      ifCond(varAtLeast(V_STAGE, 2), [...say("king", "doubtful", "엘프 마법사를 데려가시오? 대본엔 없는 사람이오.")],
        [...say("king", "base", "길드부터 가시오. 대본 2장이오.")]),
    ], { who: "king" }),
    page(`${KING}_talk`, [varIs(V_STAGE, 0), swOn(SW_ARRIVED)], kingTalk, { who: "king" }),
  ]));
  // 옥좌 앞 두 줄을 밟아도 왕이 먼저 부른다(Z 를 몰라도 걸어가기만 하면 된다).
  for (let dx = -2; dx <= 2; dx++) {
    const cell = { x: kingAt.x + dx, y: kingAt.y + 2 };
    if (!reachableCells(project, map, me).some((c) => c.x === cell.x && c.y === cell.y)) continue;
    if (cell.x === priestAt.x && cell.y === priestAt.y) continue;
    if (cell.x === edelAt.x && cell.y === edelAt.y) continue;
    const id = `ev_ig_h_audience_${dx + 2}`;
    map.events.push(event(id, "옥좌 앞", cell, [
      gone(`${id}_off`, []),
      page(`${id}_on`, [varIs(V_STAGE, 0), swOn(SW_ARRIVED)], kingTalk, { trigger: "playerTouch" }),
    ]));
  }
  map.events.push(event(PRIEST, "대신관 오르반", priestAt, [
    page(`${PRIEST}_p`, [], [faceHero(PRIEST),
      ...say("priest", "serious", "귀환 주문서는 마왕성 꼭대기에.\n마왕이 지키고 있사옵니다."),
      ...say("minjae", "doubtful", "그 마왕은 왜 안 쓰고 지켜요?"),
      ...say("priest", "worried", "…그건 아무도 모르옵니다."),
    ], { who: "priest" }),
  ]));
  map.events.push(event(EDEL, "에델", edelAt, [
    page(`${EDEL}_p`, [varIs(V_STAGE, 0)], [], { who: "edel", dir: "left" }),
    gone(`${EDEL}_gone`, [varAtLeast(V_STAGE, 1)]),
  ]));

  // 보물고 — 손대면 대본 이탈.
  const chestAt = nearestFree(project, map, { x: 7, y: 20 });
  map.events.push(event("ev_ig_h_treasury", "보물고 왕관대", chestAt, [
    page("ev_ig_h_treasury_p", [swOff(SW_TREASURY)], [
      ...caption("왕관 진열대 밑에 은화 자루가 쌓여 있다."),
      ...say("edel", "surprised", "용사님, 그건 국고입니다."),
      choices([
        { text: "한 줌만. 활동비야", then: [playSe(SE_COIN), gold(120), ...caption("은화 120닢을 챙겼다."),
          ...say("edel", "worried", "앞의 여섯 분은 손도 안 대셨습니다."),
          ...say("minjae", "doubtful", "그럼 그분들 활동비는 누가 썼는데요?"),
          ...say("edel", "serious", "……."), ...chaos(), setSw(SW_TREASURY)] },
        { text: "알았어, 안 만져", then: [...say("edel", "content", "감사합니다. 셈이 맞아야 제가 편합니다.")] },
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
      ...say("kid", "happy", "새 용사님이다. 이번 용사님은 어디까지 가요?"),
      ...say("minjae", "doubtful", "어디까지라니?"),
      ...say("kid", "base", "저번 용사님은 숲까지 갔어요.\n그 전 용사님은 반반 마을까지."),
    ], { who: "kid" }),
  ]));
  map.events.push(event("ev_ig_c_villager", "주민", villagerAt, [
    page("ev_ig_c_villager_p", [], [faceHero("ev_ig_c_villager"),
      ...say("villager", "worried", "동쪽 숲 너머 반반 마을 알아요?\n사람이랑 고블린이 반반 사는 곳인데,"),
      ...say("villager", "annoyed", "고블린이 길에서 통행세를 받아요.\n길은 자기들이 닦았다나."),
    ], { who: "villager" }),
  ]));
  // 장터 상인 — 여관 주인의 부탁을 들었으면 불꽃고추를 판다.
  map.events.push(event("ev_ig_c_merchant", "상인", merchantAt, [
    page("ev_ig_c_merchant_p", [], [faceHero("ev_ig_c_merchant"),
      ...say("merchant", "base", "불꽃고추. 한 줌에 은화 다섯 닢."),
    ], { who: "merchant" }),
    page("ev_ig_c_merchant_ask", [swOn(SW_CHILI_ASK), swOff(SW_CHILI)], [faceHero("ev_ig_c_merchant"),
      ...say("merchant", "base", "불꽃고추요? 한 줌에 은화 다섯 닢."),
      choices([
        { text: "용사 할인은 없어요?", then: [
          ...say("merchant", "doubtful", "저번 용사님도 그 말 하셨지.\n외상이 아직 남았어요."),
          ...say("merchant", "base", "가져가요. 이번 용사님은 돌아와서 갚고."), ...chaos(),
        ] },
        { text: "은화 다섯 닢 낸다", then: [playSe(SE_COIN), { kind: "changeGold", op: "-=", amount: 5 } as Command, ...say("merchant", "happy", "정직한 손님이네. 한 줌 더 얹어 줄게.")] },
      ]),
      giveItem(ITEM.chili), setSw(SW_CHILI), playSe(SE_OK), ...caption("불꽃고추 한 줌을 얻었다."),
      objective("길드 주방의 여관 주인에게 불꽃고추 가져가기"),
    ], { who: "merchant" }),
    page("ev_ig_c_merchant_after", [swOn(SW_CHILI)], [faceHero("ev_ig_c_merchant"),
      ...say("merchant", "base", "그 고추 맵다. 눈 비비지 마요."),
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
    page("ev_ig_c_gate_block", [], [...say("guard", "serious", "잠깐. 길드 등록부터 하고 오십시오."), walkTo("@player", backFromGate)], { trigger: "playerTouch" }),
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
  // 여섯이 접수대 앞에 몰렸다가 한 줄로 선다.
  const crowd: Cell[] = [];
  for (const want of [{ x: 5, y: 12 }, { x: 7, y: 12 }, { x: 6, y: 13 }, { x: 5, y: 11 }, { x: 7, y: 11 }, { x: 4, y: 13 }]) crowd.push(nearestFree(project, map, want, [clerkAt, fioAt, ...crowd]));
  const line: Cell[] = [];
  for (let i = 0; i < crowd.length; i++) line.push(nearestFree(project, map, { x: 8, y: 11 + i }, [clerkAt, fioAt, ...crowd, ...line]));
  const CLERK = "ev_ig_g_clerk", FIO = "ev_ig_g_fio", COOK = "ev_ig_g_cook";
  const advIds = crowd.map((_, i) => `ev_ig_g_adv${i}`);

  // v8 톤 검수: 고2 한마디에 덩치들이 「히익」 하고 꺾이는 소망 충족이 유치했다 — 줄이 먹히는 이유(계산)를 앞에 두고,
  // 줄을 세운 민재도 맨 뒤에 서게 한다(일곱 번째 자리). 피오는 매일 와서 첫 줄에 서는 사람이다.
  const scene: Command[] = [
    ...say("adventurer", "angry", "내가 먼저 왔다니까."),
    ...say("clerk", "worried", "한 분씩요. 한 분씩…"),
    ...say("edel", "serious", "용사 등록은 줄을 안 섭니다. 대본 2장입니다."),
    choices([
      { text: "탁자에 올라가 줄을 세운다", then: [
        shake(300, "1"), ...chaos(),
        ...say("minjae", "determined", "접수 한 명에 1분. 싸우면 10분.\n줄 서면 다들 점심 전에 끝나요."),
        ...say("adventurer", "doubtful", "계산은 맞네."),
      ] },
      { text: "번호표를 찢어 나눠 준다", then: [
        playSe(SE_PAPER), ...say("adventurer", "doubtful", "3번. 나 3번이네."),
      ] },
    ]),
    ...advIds.map((id, i) => walkTo(id, line[i]!, i === advIds.length - 1)),
    playSe(SE_OK),
    ...say("clerk", "surprised", "줄이 섰어요. 처음이에요."),
    ...say("adventurer", "base", "세운 사람도 서야지. 맨 뒤로."),
    ...say("minjae", "annoyed", "네."),
    walkTo(FIO, { x: clerkAt.x + 1, y: clerkAt.y + 2 }),
    ...say("fio", "shy", "앞자리 드릴게요. 저는 매일 오거든요."),
    ...say("minjae", "doubtful", "매일?"),
    ...say("fio", "sad", "마탑 필기에 일곱 번 떨어졌어요.\n일곱 번 떨어지면 길드 등록만 돼요. 오늘이에요."),
    ...say("minjae", "base", "왜 떨어졌는데?"),
    ...say("fio", "worried", "실기는 다 만점인데요.\n필기는… 문제를 끝까지 안 읽는대요."),
    ...say("fio", "shy", "용사 파티에 들면 마탑 추천서가 나와요.\n데려가 주실래요?"),
    ...say("minjae", "base", "끝까지 읽는 거, 가는 길에 연습하자."),
    ...say("clerk", "base", "용사 등록 끝났어요. 등급은 맨 아래, 「견습」."),
    setVar(V_STAGE, "=", 2),
    ...join(ACTOR.fio, "피오"),
    setSw(SW_LINE),
    objective("동쪽 성문으로 나가 반반 마을로"),
  ];
  map.events.push(event("ev_ig_g_scene", "길드 줄", { x: 0, y: 0 }, [
    gone("ev_ig_g_scene_off", []),
    page("ev_ig_g_scene_on", [varIs(V_STAGE, 1), swOff(SW_LINE)], scene, { trigger: "auto" }),
  ]));
  map.events.push(event(CLERK, "접수원 리나", clerkAt, [
    page(`${CLERK}_p`, [], [faceHero(CLERK), ...say("clerk", "base", "줄 서기, 길드 규칙으로 올렸어요.\n위에서 결재가 나면요.")], { who: "clerk" }),
  ]));
  map.events.push(event(FIO, "피오", fioAt, [
    page(`${FIO}_p`, [], [], { who: "fio", dir: "up" }),
    gone(`${FIO}_gone`, [swOn(SW_LINE)]),
  ]));
  crowd.forEach((at, i) => {
    const lines = [
      ["줄 서니까 빠르네. 기분은 나쁜데."],
      ["반반 마을 길 말이야, 원래 고블린이 닦았어.", "사람들이 돈을 안 냈지. 30년째."],
      ["번호표 3번. 팔면 얼마 받으려나."],
      ["저번 용사도 여기서 등록했어.", "숲까지 갔다던가."],
      ["길드는 용사 한 명 등록할 때마다 왕궁에서 돈을 받아.", "네가 낸 거 아니야."],
      ["고2가 뭐야? 아니, 말 안 해도 돼."],
    ][i]!;
    const who = (["adventurer", "adventurer2", "adventurer3", "adventurer4", "adventurer5", "adventurer6"] as const)[i]!;
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
      ...say("cook", "content", "매운 거라면 장터 불꽃고추지.\n한 줌 가져오면 만들어 볼게."),
      setSw(SW_CHILI_ASK), objective("광장 상인에게 불꽃고추 구하기"),
    ], { who: "cook" }),
    page(`${COOK}_wait`, [swOn(SW_CHILI_ASK)], [faceHero(COOK), ...say("cook", "base", "불꽃고추 한 줌. 광장 상인한테 있어.")], { who: "cook" }),
    page(`${COOK}_cook`, [swOn(SW_CHILI), swOff(SW_TTEOK)], [faceHero(COOK),
      ...say("cook", "base", "왔구나. 잠깐만."),
      takeItem(ITEM.chili), ...fadeOut(400), playSe("cc0-se-osx-pot-01"), wait(700), ...fadeIn(400),
      ...say("cook", "content", "자. 맛 좀 봐."),
      ...say("minjae", "crying", "…이 맛이야. 조금 다른데, 이 맛이야."),
      giveItem(ITEM.tteok), setSw(SW_TTEOK), playSe(SE_OK), ...caption("이세계 떡볶이를 얻었다."),
      ...say("cook", "base", "하나 더 싸 줄게. 누구 줄 사람 있으면 줘."),
      ifCond(varAtLeast(V_STAGE, 2), [objective("동쪽 성문으로 나가 반반 마을로")], [objective("왕도 광장 앞 모험가 길드에서 등록하기")]),
    ], { who: "cook" }),
    page(`${COOK}_done`, [swOn(SW_TTEOK)], [faceHero(COOK), ...say("cook", "base", "그거, 메뉴판에 올릴까 해. 이름은 아직 없어.")], { who: "cook" }),
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
    ...say("fio", "surprised", "슬라임이에요. 둘이요."),
    ...say("edel", "determined", "대본 4장. 「용사는 홀로 앞에 선다」."),
    choices([
      { text: "다 같이, 하나씩 친다", then: [...chaos(), ...say("edel", "worried", "알겠습니다.")] },
      { text: "…홀로 앞에 선다", then: [...say("minjae", "annoyed", "는 안 하고. 다 같이 하나씩 친다.")] },
    ]),
    ...battle(TROOP.slime,
      [setSw(SW_SLIME),
        ...say("edel", "surprised", "셋이서 하나씩 치니까… 금방이네요."),
        ...say("minjae", "base", "혼자 앞에 서라는 건,\n대본 쓴 사람이 안 싸워 봐서 그래."),
        ...say("edel", "sad", "…앞의 여섯 분은 다 홀로 서셨습니다."),
        ...say("minjae", "base", "다음 것도 셋이서 쳐요.")],
      [setSw(SW_SLIME), ...caption("셋은 슬라임 점액을 뒤집어쓰고 겨우 일어났다."), ...say("minjae", "annoyed", "…다음엔 하나씩 친다.")]),
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
    page("ev_ig_f_sign_p", [], [...note("← 왕도 아르벤", "반반 마을 →", "「통행세 받음. 도로 보수 30년째」")]),
  ]));
}

// ── 3~4) 반반 마을 — 장부 외교 ──
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

  // v8 톤 검수: 30년 분쟁이 이모티콘 한 번으로 풀리는 단톡 외교가 「아동용 교훈극」이었다 —
  // 두 장부를 끝까지 읽어 맞추는 거래로 바꿨다. 꾸르는 말버릇 대신 장부에 집착하는 실무자다.
  const diplo = (): Command => setVar(V_DIPLO, "+=", 1);
  const kkurJoins: Command[] = [
    ...say("minjae", "base", "마왕성 가는 길, 알아요?"),
    ...say("kkur", "serious", "안다. 보수 기록에 있다. 북쪽 숲 위."),
    ...say("kkur", "serious", "문 앞에 시험관이 있다. 앞 용사 여섯, 다 통과했다.\n그다음이 문제였다."),
    ...say("fio", "worried", "시험이요…"),
    setVar(V_STAGE, "=", 4),
    ...join(ACTOR.kkur, "꾸르"),
    objective("마을 북쪽 숲 위 마왕성으로"),
  ];
  const scene: Command[] = [
    walkTo(GOB, { x: g.entry.x + 2, y: g.entry.y }),
    ...say("goblin", "annoyed", "통행세. 한 명에 은화 세 닢."),
    ...say("edel", "determined", "대본 5장. 「용사는 고블린을 벤다」."),
    ...say("minjae", "doubtful", "대본 쓴 사람은 여기 통행세 내 봤대?"),
    walkTo(CHIEF, { x: g.entry.x + 3, y: g.entry.y + 1 }),
    ...say("chief", "worried", "죄송합니다, 여행자님.\n이 길은 사람이랑 고블린이 반반 쓰는 길인데…"),
    walkTo(KKUR, { x: g.entry.x + 4, y: g.entry.y + 1 }),
    ...say("kkur", "angry", "길은 우리가 닦았다. 삼십 년.\n너희는 한 푼도 안 냈다."),
    ...say("chief", "annoyed", "그 대신 밭을 내줬잖소."),
    ...say("kkur", "serious", "밭 내준 건 장부에 없다."),
    ...think("둘 다 장부 얘기만 하네."),
    ...say("minjae", "base", "장부 보여 주세요. 둘 다."),
    playSe(SE_PAPER),
    ...caption("고블린 장부엔 30년 치 도로 보수가, 마을 장부엔 30년 치 밭 세가 적혀 있다.\n두 합계는 은화 열두 닢 차이다."),
    ...say("fio", "surprised", "거의 같아요."),
    choices([
      { text: "받을 돈이 서로 같네요. 열두 닢만 정산하죠", then: [diplo(), ...say("kkur", "doubtful", "계산은 맞다."), ...say("chief", "sad", "30년을 싸웠는데, 열두 닢이오?")] },
      { text: "앞으로는 입장료를 받아서 반반 나누죠", then: [diplo(), ...say("chief", "base", "그거 괜찮소."), ...say("kkur", "serious", "셈은 내가 한다.")] },
      { text: "원래 왕궁이 냈어야죠. 왕도 길이잖아요", then: [diplo(), ...chaos(),
        ...say("kkur", "doubtful", "왕궁. 맞다. 왕궁 길이다."), ...say("chief", "worried", "청구서는 누가 쓰오?"), ...say("minjae", "base", "제가요. 받는 사람, 국왕 루드릭.")] },
    ]),
    ...say("goblin", "base", "그럼 오늘 몫은? 셋이면 아홉 닢."),
    choices([
      { text: "오늘 건 낸다", then: [diplo(), playSe(SE_COIN), ...caption("에델이 자기 지갑에서 은화 아홉 닢을 셌다."), ...say("edel", "serious", "의전비로 처리하겠습니다.")] },
      { text: "왕궁 앞으로 달아 두세요", then: [diplo(), ...chaos(), ...say("goblin", "base", "왕궁 앞. 적었다.")] },
      { text: "안 낸다. 비켜", then: [...say("kkur", "angry", "그럼 길도 없다.")] },
    ]),
    ifCond(varAtLeast(V_DIPLO, 2), [
      playSe(SE_OK),
      ...say("chief", "content", "30년 만에 셈을 맞춰 봤소. 진작 할걸."),
      ...say("kkur", "content", "너, 끝까지 읽는다. 드문 인간이다."),
      ...kkurJoins,
    ], [
      ...say("kkur", "angry", "말로 안 되면 말뚝으로 한다."),
      ...battle(TROOP.goblin,
        [...say("kkur", "surprised", "너 약한데 안 도망간다."), ...say("minjae", "annoyed", "말로 했으면 더 빨랐어요.")],
        [...caption("민재 일행은 흙바닥에 뒹굴었다. 꾸르도 숨이 찼다."), ...say("kkur", "doubtful", "너 약한데 안 도망간다. 이상한 인간이다.")]),
      bgm(BGM_GOBLIN, 600),
      ...kkurJoins,
    ]),
  ];
  map.events.push(event(GOB, "고블린", gobAt, [
    page(`${GOB}_p`, [varIs(V_STAGE, 3)], scene, { who: "goblin", dir: "left", trigger: "auto" }),
    page(`${GOB}_after`, [varAtLeast(V_STAGE, 4)], [faceHero(GOB), ...say("goblin", "base", "입장료 반반. 셈은 꾸르가 한다.\n꾸르가 없으니 내가 한다.")], { who: "goblin" }),
  ]));
  map.events.push(event(CHIEF, "촌장", chiefAt, [
    page(`${CHIEF}_p`, [], [faceHero(CHIEF), ...say("chief", "base", "맞대 보니 서로 틀린 데가 많더이다.\n딱 반반씩.")], { who: "chief" }),
  ]));
  map.events.push(event(KKUR, "꾸르", kkurAt, [
    page(`${KKUR}_p`, [varAtLeast(V_STAGE, 0)], [], { who: "kkur" }),
    gone(`${KKUR}_gone`, [varAtLeast(V_STAGE, 4)]),
  ]));
  map.events.push(event("ev_ig_v_kid", "꼬마 고블린", kidAt, [
    page("ev_ig_v_kid_p", [], [faceHero("ev_ig_v_kid"),
      ...say("goblin", "worried", "마왕성 문 앞 해골, 문제를 낸다.\n틀리면 맞는다."),
    ], { who: "goblin" }),
  ]));
}

// ── 4~5) 마왕성 1층 — 성문 시험 · 대본 감독관 ──
function buildCastle(project: Project, b: Built): void {
  const map = project.maps[M.castle]!;
  custom(map, BGM_CASTLE);
  const k = b.castle;
  map.events.push(event("ev_ig_k1_enter", "마왕성 입구", { x: 0, y: 0 }, [
    gone("ev_ig_k1_enter_off", []),
    page("ev_ig_k1_enter_on", [varIs(V_STAGE, 4), swOff("sw_ig_k1_seen")], [
      // v7 검수: 0.55 는 촛대 없는 방이 거의 안 보였다 — 장식을 더하고 어둠을 줄였다.
      setLight(0.32, "#2a2040", 0),
      ...say("edel", "worried", "대본은 「용사는 마왕성에 들어간다」에서 끝납니다.\n앞 용사들도 다 여기서 끝났거든요."),
      ...say("minjae", "base", "그럼 뒷장은 우리가 쓰면 되지."),
      setSw("sw_ig_k1_seen"),
    ], { trigger: "auto" }),
  ]));

  // 성문 시험 — 큰 홀에서 나가는 통로 끝 줄을 밟으면 해골 시험관이 막는다.
  // v8 톤 검수: v7 은 피보나치 수열을 7수생 마법사가 못 풀어 「주변이 멍청해서 이기는」 구조였다 —
  // 피오가 틀리는 이유를 길드에서 심은 버릇(문제를 끝까지 안 읽는다)으로 바꾸고, 문제 자체가 판돈을 알려 준다.
  const cor = k.corridors.find((c) => c.from === "hall") ?? k.corridors[1]!;
  const EX = "ev_ig_k1_examiner";
  const exAt = nearestFree(project, map, { x: cor.x + Math.floor(cor.w / 2), y: cor.y + Math.floor(cor.h / 2) });
  const wrong = (pick: string): Command[] => [playSe(SE_WRONG), ...say("examiner", "base", `${pick}. 오답이다.`),
    ...battle(TROOP.quiz, [...say("examiner", "base", "채점 끝. ③을 골랐어야 했다. 지나가라.")], [...caption("해골은 빨간 펜으로 ③에 동그라미를 치고 물러났다.")]), bgm(BGM_CASTLE, 600)];
  const quiz: Command[] = [
    emote(EX, "exclamation", 700), playSe("easyrpg-sound-darkness3"), shake(300, "1"),
    ...say("examiner", "base", "멈춰라. 마왕성 출입 시험이다.\n문제를 끝까지 들어라."),
    ...say("examiner", "base", "다음 중 옳지 않은 것은?\n① 마왕은 꼭대기에 있다. ② 귀환 주문서는 한 장이다."),
    ...say("examiner", "base", "③ 앞 용사 여섯은 대본대로 해서 이겼다."),
    ...say("fio", "surprised", "②요! 주문서가 한 장일 리가 없어요."),
    ...say("minjae", "base", "피오. 「옳지 않은 것」."),
    ...say("fio", "embarrassed", "…아."),
    choices([
      { text: "② 귀환 주문서는 한 장이다", then: wrong("②") },
      { text: "① 마왕은 꼭대기에 있다", then: wrong("①") },
      { text: "③ 앞 용사 여섯은 대본대로 해서 이겼다", then: [playSe(SE_OK),
        ...say("examiner", "base", "정답. 여섯은 대본대로 했다. 그래서 여기 없다."),
        ...say("edel", "sad", "여섯 분 다 제가 모셨습니다."),
        ...say("fio", "worried", "그럼 ②는… 맞는 말이에요?"),
        ...say("examiner", "base", "주문서는 한 장이다. 지나가라.")] },
    ]),
    setSw(SW_QUIZ),
  ];
  map.events.push(event(EX, "성문 시험관", exAt, [
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

  // 대본 감독관 — 위층 계단 앞을 막고 선다. 체제를 굴리는 공무원(v8 톤 검수: 「벌점」 한 줄짜리 보스였다).
  const DEAN = "ev_ig_k1_dean";
  const deanFight: Command[] = [
    ...say("dean", "base", "멈추십시오. 성 안에서 뛰지 마시오.\n등록증은? 이름표는?"),
    ...say("minjae", "doubtful", "교무부장 선생님 같은 말투네."),
    ...say("dean", "base", "왕국 대본 감독관이오.\n용사가 대본대로 끝나는지 확인하오."),
    ...say("minjae", "base", "끝난다는 게 어떻게 끝나는 건데요?"),
    ...say("dean", "base", "7장 부록. 「용사와 마왕은 함께 쓰러진다.」\n그래야 왕국이 다음 용사 예산을 받소."),
    ...say("edel", "surprised", "부록이 있었습니까?"),
    ...say("dean", "base", "기사에겐 안 보여 주오."),
    ...battle(TROOP.dean,
      [...say("dean", "base", "졌소. 그래도 보고서엔 「용사 낙오」로 적겠소.\n양식에 「승리」 칸이 없소."),
        ...say("edel", "sad", "여섯 분 다 「낙오」로 적혀 있었습니다."),
        ...say("minjae", "base", "일곱 번째 보고서는 에델 씨가 써요."),
        ...say("kkur", "serious", "거짓으로 적는 놈이다.")],
      [...caption("감독관은 쓰러진 일행을 「낙오」로 적고 돌아갔다.\n한참 뒤에 일행이 일어났다.")], BGM_BOSS),
    bgm(BGM_CASTLE, 600),
    setSw(SW_DEAN), setVar(V_STAGE, "=", 5),
    objective("계단으로 올라가 꼭대기의 마왕 만나기"),
  ];
  map.events.push(event(DEAN, "대본 감독관", k.stairFront, [
    page(`${DEAN}_p`, [swOff(SW_DEAN)], deanFight, { who: "dean", dir: "down" }),
    gone(`${DEAN}_gone`, [swOn(SW_DEAN)]),
  ]));

  // 창고 상자 — 15년 전의 쪽지.
  const storage = k.rooms.find((r) => r.kind === "storage") ?? k.rooms.find((r) => r.kind === "vault") ?? k.rooms.find((r) => r.kind === "hall");
  if (storage) {
    const boxAt = nearestFree(project, map, { x: storage.x + 1, y: storage.y + 1 });
    map.events.push(event("ev_ig_k1_box", "낡은 상자", boxAt, [
      page("ev_ig_k1_box_p", [swOff("sw_ig_k1_box")], [playSe(SE_PAPER), giveItem("item_rice_ball"), giveItem("item_rice_ball"), ...caption("상자 안에 쪽지와 주먹밥 둘.\n「2009. 11. 11. 수능 D-1. 배고프다」"), setSw("sw_ig_k1_box")]),
      page("ev_ig_k1_box_done", [swOn("sw_ig_k1_box")], [...caption("빈 상자다. 쪽지 글씨가 반듯하다.")]),
    ]));
  }
}

// ── 5~6) 마왕성 꼭대기 — 마왕 배재민 · 결말 ──
function buildThrone(project: Project, b: Built): void {
  const map = project.maps[M.castle2]!;
  custom(map, BGM_CASTLE);
  const MAOU = "ev_ig_k2_maou";
  // 던전 도구가 보스방에 정한 보스 자리(옥좌 앞). 시드를 바꿔도 따라온다.
  const maouAt = b.castle2.seat;

  const homeScene = endingHome();
  const stayScene = endingStay();
  const chaosScene = endingChaos();
  const finalChoice = (withTteok: boolean): Command => choices([
    { text: "주문서, 끝까지 읽어 봤어요?", then: [
      ...say("jaemin", "doubtful", "첫 줄만 읽었다. 「귀환 1인」."),
      ...say("minjae", "base", "그 밑에 작은 글씨요.\n「단, 미성년 소환자는 보호자 1인 동반 가능.」"),
      ...say("minjae", "base", "저 미성년자예요."),
      ...say("jaemin", "surprised", "내가 보호자냐."),
      ...say("jaemin", "doubtful", "이 얼굴로?"),
      ...say("minjae", "base", "여기선 안 늙는다면서요. 주민등록상 서른넷이면 되죠."),
      ...say("jaemin", "serious", "가면 수능이다. 한 번만 붙어 보자.\n내가 아직 겁나는지 알고 싶다."),
      ...battle(TROOP.maouExam, [...say("jaemin", "sad", "겁난다. 그래도 간다.")], [...say("jaemin", "base", "이겼다. 근데 너희, 끝까지 안 물러서더라.\n간다.")], BGM_BOSS),
      ...homeScene,
    ] },
    ...(withTteok ? [{ text: "떡볶이 드실래요?", then: [takeItem(ITEM.tteok), ...stayScene] }] : []),
    { text: "주문서 내놔요", then: [
      ...say("jaemin", "serious", "그래. 대본대로 하자. 7장 부록까지.\n왕좌에 앉으면 이 꼴이 된다. 보여 주지."),
      ...battle(TROOP.maouBrawl, [...say("jaemin", "sad", "졌다.")], [...say("jaemin", "base", "아직이다, 후배.")], BGM_BOSS),
      ...chaosScene,
    ] },
  ]);
  const meet: Command[] = [
    ...say("maou", "base", "왔나. 그 교복."),
    emote("player", "exclamation", 800),
    ...say("minjae", "surprised", "그 명찰. 「3학년 7반 배재민」?\n우리 학교잖아요."),
    ...say("jaemin", "sad", "2009년 11월 11일. 수능 전날, 여기로 불려 왔다."),
    ...say("jaemin", "base", "대본대로 여기까지 왔다. 전 마왕을 쓰러뜨렸고, 부록을 읽었다.\n그래서 안 쓰러졌다. 대신 이 왕좌에 앉았다."),
    ...say("jaemin", "sad", "돌아가면 수능을 봐야 했지. 그래서 안 갔다.\n마왕 노릇이 수능보다 쉬웠다."),
    ...say("minjae", "base", "주문서는요?"),
    ...say("jaemin", "base", "있다. 한 장. 한 명."),
    ...say("jaemin", "sad", "15년 동안 들고 있었다. 내일이 수능이라서.\n그다음 해에도. 그다음 해에도."),
    ...think("주문서는 한 장. 나는 내일 모의고사.\n이 사람은 15년째 내일이 수능이다."),
    ifCond(hasItem(ITEM.tteok), [finalChoice(true)], [finalChoice(false)]),
  ];
  map.events.push(event(MAOU, "마왕", maouAt, [
    page(`${MAOU}_p`, [swOff(SW_OVER)], [faceHero(MAOU), ...meet], { who: "maou" }),
    gone(`${MAOU}_gone`, [swOn(SW_OVER)]),
  ]));
  map.events.push(event("ev_ig_k2_enter", "꼭대기 입구", { x: 0, y: 0 }, [
    gone("ev_ig_k2_enter_off", []),
    page("ev_ig_k2_enter_on", [varIs(V_STAGE, 5), swOff("sw_ig_k2_seen")], [
      setLight(0.3, "#2a1840", 0),
      ...say("fio", "worried", "위층에서 연필 긁는 소리가 나요."),
      ...say("minjae", "doubtful", "…자습실 소리인데."),
      setSw("sw_ig_k2_seen"),
    ], { trigger: "auto" }),
  ]));

  // 무너진 꼭대기 — 왕좌가 터진 뒤. 지붕이 날아가 하늘빛이 든다. 넷과 배재민이 잔해 속에 서 있다.
  const ruin = project.maps[M.ruin]!;
  const s = b.castle2.seat;
  const stand = (id: string, name: string, want: Cell, who: "edel" | "fio" | "kkur" | "maou", dir: "up" | "down" | "left" | "right", avoid: Cell[]) => {
    const at = nearestFree(project, ruin, want, avoid);
    ruin.events.push(event(id, name, at, [gone(`${id}_off`, []), page(`${id}_on`, [swOn(SW_RUIN)], [], { who, dir })]));
    return at;
  };
  const youAt = { x: s.x, y: s.y + 1 };
  const a1 = stand("ev_ig_r_jaemin", "배재민", s, "maou", "down", [youAt]);
  const a2 = stand("ev_ig_r_edel", "에델", { x: s.x - 1, y: s.y + 2 }, "edel", "up", [youAt, a1]);
  const a3 = stand("ev_ig_r_fio", "피오", { x: s.x + 1, y: s.y + 2 }, "fio", "up", [youAt, a1, a2]);
  stand("ev_ig_r_kkur", "꾸르", { x: s.x + 2, y: s.y + 1 }, "kkur", "left", [youAt, a1, a2, a3]);
  ruin.bgm = { mode: "custom", resourceId: BGM_END } as GameMap["bgm"];
  ruin.events.push(event("ev_ig_r_end", "7장 부록 결말", { x: 0, y: 0 }, [
    gone("ev_ig_r_end_off", []),
    page("ev_ig_r_end_on", [swOn(SW_RUIN), swOff(SW_OVER)], endingChaosArrive(), { trigger: "auto" }),
  ]));
}

// ── 결말 무대: 교실(귀환) · 길드(보류) ──
function buildEndingStages(project: Project, b: Built): void {
  const cls = project.maps[M.class]!;
  const seat = nearestFree(project, cls, { x: DESK.x, y: DESK.y + 1 });
  // 결말 장면의 도착 칸을 실제 빈 자리로 맞춘다(결말 장면은 맵을 모르고 먼저 짜였다).
  const youRuin = { x: b.castle2.seat.x, y: b.castle2.seat.y + 1 };
  const fix = (cmds: Command[]): void => { for (const c of cmds as unknown as Record<string, unknown>[]) {
    if (c.kind === "transfer" && c.mapId === M.class) { c.x = seat.x; c.y = seat.y; }
    if (c.kind === "transfer" && c.mapId === M.ruin) { c.x = youRuin.x; c.y = youRuin.y; }
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
  guild.events.push(event("ev_ig_g_chef_maou", "주방 일꾼 배재민", chefAt, [gone("ev_ig_g_chef_maou_off", []), page("ev_ig_g_chef_maou_on", [swOn(SW_STAY)], [], { who: "maou", dir: "down" })]));
  for (const ev of guild.events) if (ev.id.startsWith("ev_ig_g_adv")) ev.pages = [...(ev.pages ?? []), gone(`${ev.id}_stay`, [swOn(SW_STAY)])];
  const kkurAt = nearestFree(project, guild, { x: 8, y: 13 }, [chefAt]);
  guild.events.push(event("ev_ig_g_end_stay", "보류 결말", { x: 0, y: 0 }, [
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
    ...say("jaemin", "base", "가자. 이번엔 도망 안 간다."),
    ...say("edel", "serious", "대본 뒷장은 제가 쓰겠습니다.\n이번엔 이름을 제대로 적겠습니다."),
    ...say("fio", "content", "문제, 끝까지 읽을게요."),
    ...say("kkur", "serious", "보호자 동반. 적었다."),
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
    ...say("teacher", "annoyed", "강민재. 모의고사 날 엎드려 자?"),
    ...say("minjae", "surprised", "…꿈?"),
    ...say("teacher", "doubtful", "그리고 교무실에 웬 아저씨가 왔다.\n2009년 교복을 입고, 수능 원서를 쓰겠다고."),
    ...say("jaemin", "embarrassed", "원서 접수, 아직 하냐."),
    ...say("minjae", "base", "8월 말이요. 선배, 이번엔 보세요."),
    ...say("jaemin", "base", "본다."),
    ...say("suah", "doubtful", "민재야, 저 아저씨 누구야?"),
    ...say("minjae", "base", "보호자."),
    ...endingCommon(END_HOME),
  ];
}

function endingStay(): Command[] {
  return [
    ...say("jaemin", "surprised", "이 냄새… 고추장?"),
    ...caption("그는 떡볶이를 한 입 먹고 한참 말이 없었다."),
    ...say("jaemin", "crying", "…학교 앞 맛이다."),
    ...say("minjae", "base", "길드 여관 아저씨가 만들었어요. 불꽃고추로."),
    ...say("jaemin", "serious", "주문서, 너 가져라."),
    ...say("minjae", "base", "선배가 그 접시 다 비우면요."),
    ...fadeOut(800), stopBgm(), setSw(SW_STAY),
    { kind: "transfer", mapId: M.guild, x: 6, y: 14, direction: "up", fade: "black" } as Command,
  ];
}

/** 보류 결말 — 길드에 도착한 뒤(도착 맵의 자동 장면). v8: 마왕이 분식집을 차리는 리본을 걷고, 아무도 아직 주문서를 안 쓴 채로 둔다. */
function endingStayArrive(): Command[] {
  return [
    bgm(BGM_END, 600), ...fadeIn(900),
    ...caption("한 달 뒤. 길드 주방에 새 일꾼이 들어왔다."),
    ...say("cook", "base", "떡볶이 둘. 순대는 아직 연구 중."),
    ...say("jaemin", "base", "어서 오십시오."),
    ...say("kkur", "serious", "오늘 매출, 적었다."),
    ...caption("주방 벽에 2010학년도 수능 시간표가 붙어 있다. 아무도 떼지 않는다."),
    ...think("주문서는 아직 가방에 있다. 둘 다 아직 안 썼다."),
    ...endingCommon(END_STAY),
  ];
}

/** 7장 부록 — 마왕이 쓰러지자 왕좌가 터진다(앞 용사들이 끝난 방식). 넷이 같이 서 있어서 이번엔 산다. 주문서는 탄다. */
function endingChaos(): Command[] {
  const room: Cell = { x: 0, y: 0 }; // buildEndingStages 가 무너진 꼭대기의 마왕 자리 앞으로 고친다
  return [
    ...say("jaemin", "surprised", "물러서. 왕좌가—"),
    playSe(SE_BOOM), shake(500, "3"), flash("white", 200), wait(400),
    playSe(SE_BOOM), shake(1800, "10"), flash("white", 350), glow("255,120,40,0.5", 250), wait(1100),
    ...caption("부록대로였다. 마왕이 쓰러지자 왕좌가 터졌다.\n바닥 절반이 같이 꺼졌다."),
    stopBgm(), setSw(SW_RUIN),
    { kind: "transfer", mapId: M.ruin, x: room.x, y: room.y, direction: "up", fade: "black" } as Command,
  ];
}

/** 7장 부록 결말 — 무너진 꼭대기에 도착한 뒤. */
function endingChaosArrive(): Command[] {
  return [
    glow("", 0), setLight(0.18, "#ffb070", 0),
    ...fadeIn(1200), bgm(BGM_END, 800),
    ...caption("먼지가 가라앉았다. 왕좌가 있던 자리가 꺼져 있다."),
    ...say("edel", "serious", "의전 방패. 이번엔 진짜로 막았습니다."),
    ...say("fio", "worried", "주문서는요?"),
    ...say("jaemin", "base", "주문서도 탔다."),
    ...say("minjae", "base", "그럼 모의고사는…"),
    ...say("jaemin", "base", "결시다. 15년 하면 익숙해진다."),
    ...think("내일 2학년 3반 열네 번째 자리는 빈다.\n담임은 출석부에 뭐라고 적을까."),
    ...say("jaemin", "embarrassed", "성 수리비는 누가 내냐."),
    ...say("minjae", "base", "국고요. 활동비 장부 비어 있던데."),
    ifCond(varAtLeast(V_CHAOS, CHAOS_KING), [
      ...caption("왕국 연대기에 한 줄이 남았다.\n「일곱 번째 용사 강민재. 대본 일곱 장 중 지킨 것 없음. 생존.」"),
    ], [
      ...caption("왕국 연대기에 한 줄이 남았다.\n「일곱 번째 용사 강민재. 대본 일부 이탈. 생존.」"),
    ]),
    ...say("kkur", "serious", "장부에 적었다. 생존, 다섯."),
    ...endingCommon(END_CHAOS),
  ];
}

function defineEndings(project: Project): void {
  const credits = [
    "『이세계로 떠난 한국 고딩, 대본을 찢다』",
    "",
    "이야기 · 연출   OPRN Flagship Studio",
    "마을 · 숲 · 마왕성   OPRN 버들항 타일 · 숲길 타일",
    "왕궁 · 길드 · 교실   OPRN 손 도트 실내 · 현대 캠퍼스 타일",
    "인물   OPRN 현대 걷기 캐릭터 · 공용 흉상 · EasyRPG RTP",
    "음악 · 효과음   CC0 음원 · EasyRPG RTP",
    "",
    "만든 도구   OPRN Studio",
    "",
    "용사 대본 7장 부록은 이 판본에서 삭제되었다.",
  ].join("\n");
  const end = (id: string, name: string, priority: number, tone: "warm" | "dark", kicker: string, badge: string, music: string) =>
    execTool(project, "define_ending", {
      id, name, priority, conditions: [],
      presentation: { kicker, badge, musicResourceId: music, tone, portraits: "none", credits },
      epilogue: [],
    });
  end(END_HOME, "모의고사 날 아침", 10, "warm", "2학년 3반 교실", "귀환 엔딩", BGM_HOME);
  end(END_STAY, "주문서는 아직 한 장", 8, "warm", "왕도 아르벤 · 길드 주방", "보류 엔딩", BGM_END);
  end(END_CHAOS, "7장 부록", 6, "dark", "아르벤 왕국 연대기", "결시 엔딩", BGM_END);
}

export function createIsekaiGoddingFlagshipDemo(): FlagshipDemoBuildResult {
  const project = createBlankProject();
  project.meta.title = "이세계로 떠난 한국 고딩, 대본을 찢다";
  project.meta.author = "OPRN Flagship Studio";
  project.system.playResolution = { width: 480, height: 270 };
  delete project.system.cameraZoom;
  project.system.dialogueStyle = "glass";

  const ensureVar = (id: string, name: string): void => { if (!project.variables.some((v) => v.id === id)) project.variables.push({ id, name }); };
  const ensureSw = (id: string, name: string): void => { if (!project.switches.some((s) => s.id === id)) project.switches.push({ id, name }); };
  for (const [id, name] of [[V_STAGE, "이세계 진행 단계"], [V_CHAOS, "대본 이탈 수"], [V_DIPLO, "장부 외교"]] as const) ensureVar(id, name);

  setupIsekaiDatabase(project, BACKDROP);
  const built = buildMaps(project);
  buildHall(project, built);
  buildCapital(project, built);
  buildGuild(project, built);
  buildForest(project, built);
  buildGoblin(project, built);
  buildCastle(project, built);
  buildThrone(project, built);
  buildEndingStages(project, built);
  defineEndings(project);

  // 작은 실내는 화면을 채우게 확대한다(화면보다 작은 맵은 검은 띠 속에 떠 있었다).
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
  project.mapTree = { mapId: M.capital, children: [M.class, M.hall, M.guild, M.forest, M.goblin, M.castle, M.castle2, M.ruin].map((mapId) => ({ mapId, children: [] })) };

  // HUD — 「현재 목표」 줄만. v8: 「깽판 지수」 게이지를 뺐다(두 검수자 1순위 — 농담마다 숫자가 박수를 친다).
  execTool(project, "set_project_settings", { fieldHud: { objective: true, widgets: [] } });
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
