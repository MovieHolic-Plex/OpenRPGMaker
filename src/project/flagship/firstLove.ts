/**
 * 『첫사랑』 — 현대 오피스 로맨스 기본 데모(약 15~20분, 엔딩 셋).
 *
 * 첫 출근 날, 사수로 배정된 선임은 10년 전 말없이 사라진 고등학교 방송부 선배였다. 그는 「처음 뵙겠습니다」라고 말한다.
 * 금요일 발표가 끝나면, 그는 또 떠난다.
 *
 * 흐름은 변수 하나(var_fl_stage)가 쥔다. 맵에 들어가면 그 단계의 자동 실행 장면이 한 번 돌고 단계를 올린다.
 * 지후 호감(var_fl_jihu)과 스위치 몇 개가 대사와 결말을 가른다. 맵은 firstLoveMaps.ts(시각 담당), 부품은 firstLoveKit.ts.
 * 등장인물·회사·앱·노래 이름은 모두 지어낸 것이다.
 */
import { reviewedFaceIdForCharset } from "@/assets/reviewedCharsetFaces";
import { runTool } from "@/editor/tools/toolRunner";
import "@/editor/tools/toolRegistry";
import { createBlankProject } from "@/project/defaults";
import { DEFAULT_ACTOR_ID } from "@/project/defaults/constants";
import { canMove, isPassable } from "@/project/collision";
import { enableGenreLock } from "@/project/genreLock";
import { defaultVnLook } from "@/project/vnLook";
import { deserialize, serialize } from "@/project/io";
import type { Command, Dir, GameEvent, GameMap, Project } from "@/project/types";
import { FLAGSHIP_BEAT_MANIFESTS } from "./beats";
import {
  bgm, caption, CAST, choices, m2, clearTintKeepBlack, emote, event, face, fadeIn, fadeOut, flash, hidePlayer, ifCond, page,
  playSe, say, sayAt, listenTo, setSw, textAtBottom, faceHero, setVar, shake, showPlayer, stopBgm, stageAtLeast, stageBelow, stageIs, swOff, swOn, memoryTint, memoryPictureIn, memoryPictureOut, memoryPictureErase, think, transfer, voice, wait, walk,
} from "./firstLoveKit";
import { buildFirstLoveMaps, FL_MAP, nearestFree, type Cell, type FirstLoveAnchors } from "./firstLoveMaps";
import { buildFirstLoveOpening } from "./firstLoveOpening";
import type { FlagshipDemoBuildResult } from "./types";
import { doorValue, type DoorSpec, type MapDoorDef } from "@/project/eventCommands/doorAnimation";

// ── 상태 ──
const V_STAGE = "var_fl_stage";
const V_JIHU = "var_fl_jihu";
const JIHU_KEY = "jihu";
const SW_TOLD_MINHO = "sw_fl_told_minho";
const SW_HONEST = "sw_fl_honest";
const SW_SAW_LETTER = "sw_fl_saw_letter";
const SW_KNOWS_WHY = "sw_fl_knows_why";
const SW_COFFEE = "sw_fl_coffee";
const SW_MILK = "sw_fl_milk";
const SW_STORY = "sw_fl_story";

/** 흐름 단계 — 맵마다 자동 장면이 이 값을 보고 한 번 돈다. */
const S = {
  START: 0, ARRIVED: 1, STREET: 2, MET: 3, PANTRY: 4, ROOF: 5, EVENING: 6, KONBINI: 7, FLASH: 8,
  WED: 9, WED_TALK: 10, FRI: 11, RUN: 12, PLATFORM: 13,
  /** 엔딩 C: 회식으로 — 밤거리 비 한 장면 뒤 엔딩. */
  DINNER: 20,
} as const;

/** 엔딩 A 문턱 — 호감은 선택 아홉 번에서 최대 12, 정직하게 가면 6~7 이 자연스럽게 닿는다. */
const TRUE_END_AT = 6;

const END_A = "end_fl_again";
// 엔딩 배지는 id 로 정해진다(playSceneOverlays.endingBadge): normal → 「NORMAL ENDING」. A 만 「HAPPY ENDING」.
const END_B = "end_fl_normal_late_reply";
const END_C = "end_fl_normal_team";

const SE_HEART = "cc0-se-orp-interface-interface3";
const SE_MAIL = "cc0-se-orp-interface-interface1";
const SE_PAPER = "cc0-se-orp-inventory-cloth";
const SE_CAN = "cc0-se-orp-inventory-bottle";

// 음악(사용자 r2: 「BGM 쓰레기」) — 판타지 RPG 마을곡(fld-003·town·inn)과 합성 원곡 둘을 버리고, CC0 카탈로그에서
// 귀 판정(Gemini 4 Argon, 곡마다 2회, 60초 발췌)으로 현대 연애 장면에 맞는 곡만 여섯 곡 고른다. 근거: openwiki/runtime-pre-edit-routing.md.
// r4(사용자: 「무드에 맞게」): 귀 판정(agy Gemini)은 할당량 소진으로 못 했다 — 아래 r4 곡은 카탈로그 설명·AI 청취 설명·측정(밝기·빌드)으로
// 골랐고 귀 점수가 없다. 옛 곡(괄호)은 Argon 귀 판정 점수가 있던 것.
const BGM_OFFICE = "cc0-bgm-rtp-qui-001"; // 휘파람·어쿠스틱 셔플 — 월요일 아침 사무실의 밝은 빛(r4, 귀 미판정; 옛 wks-001 8.0 은 측정상 가장 어두운 곡)
const BGM_ROOF = "cc0-bgm-rtp-rad-002"; // 로파이 재즈합 — 노을 옥상(9.0)
const BGM_NIGHT = "cc0-bgm-rtp-pon-001"; // 라운지 피아노·브러시 — 밤거리·편의점·야근(9.0)
const BGM_MEMORY = "cc0-bgm-rtp-rst-001"; // 피아노·어쿠스틱 기타 발라드 — 회상·타이틀(9.0 / 8.0)
const BGM_CONFESS = "cc0-bgm-rtp-mys-002"; // 잔향 깊은 피아노 독주에 현이 차오르고 잦아든다, 드럼 없음 — 막차 고백(r4 「감정 피아노」, 귀 미판정; 옛 flt-022 8.0. flt-004 는 41MB WAV 라 절정에서 로드가 늦어 뺐다)
const BGM_END_B = "cc0-bgm-rtp-flt-022"; // 하프·현이 벅차오르는 작별 — 엔딩 B(9.0)
const BGM_RAIN = "cc0-bgm-rtp-flt-017"; // 기타 아르페지오 위 애절한 바이올린, E단조 — 비 오는 밤 질주(r4, 귀 미판정; 옛 무음)
const BGM_END_C = "cc0-bgm-rtp-mgv-004"; // 솔로 첼로 — 놓친 뒤의 후회, 엔딩 C(r4, 귀 미판정; 옛 rad-002 는 따뜻한 옥상 곡이라 반대 정서)
const BGM_HAPPY = "cc0-bgm-rtp-res-002"; // 현 패드·뮤직박스가 가벼운 북과 차오르는 귀환곡 — 엔딩 A(r4, 귀 미판정; 옛 sea-001 8.5 는 로파이 칠아웃)

function execTool(project: Project, name: string, args: Record<string, unknown>): { data?: unknown; summary?: string } {
  const ctx = { project, assistantRun: false };
  const res = runTool(ctx, name, args, { dryRun: false });
  if (!res.ok) throw new Error(`[first-love] ${name} failed: ${res.summary} ${JSON.stringify(res.issues ?? [])}`);
  Object.assign(project, ctx.project);
  return { data: res.data, summary: res.summary };
}

/** 지후 호감 — 오를 때는 지후 머리 위 하트와 작은 소리. */
function like(n: number, jihuEventId?: string): Command[] {
  // 분기 판정은 변수(var_fl_jihu), ESC 메뉴 「호감도」 하트는 관계 기록(friendship, 최대 1000 → 한 점 = 90).
  const out: Command[] = [setVar(V_JIHU, n >= 0 ? "+=" : "-=", Math.abs(n)), { kind: "changeFriendship", npcKey: JIHU_KEY, delta: n * 90 } as Command];
  if (n > 0) {
    out.push(playSe(SE_HEART));
    // 머리 위 말풍선 아이콘은 쓰지 않는다(사용자 r2) — 오른쪽 위 「♥ 호감이 올랐다」 알림과 작은 소리로 충분하다.
    void jihuEventId;
  }
  return out;
}

const stage = (n: number): Command => setVar(V_STAGE, "=", n);

const SE_ELEVATOR = "cc0-se-osx-bell-01"; // 승강기 도착 «딩»
const SE_DOOR = "cc0-se-orp-misc-random4"; // 철문 걸쇠가 당겨지며 풀리는 소리(옥상 문 열기)
const SE_DOOR_SHUT = "cc0-se-osx-door-close-02"; // 묵직한 철문이 닫히며 걸쇠가 물리는 소리
const SE_BUTTON = "cc0-se-osx-switch-01"; // 호출 단추 딸깍
const SE_SLIDE = "easyrpg-sound-evade2"; // 승강기·로비 문이 미끄러지는 바람 소리
const SE_GLASS_OPEN = "easyrpg-sound-teleport2"; // 유리문 손잡이 걸쇠가 풀리는 소리
const SE_GLASS_SHUT = "cc0-se-osx-door-close-03"; // 유리문 걸쇠 딸깍
const SE_CHIME = "easyrpg-sound-song"; // 편의점 자동문 입점 차임(네 음 상행)
const waitMoves = (): Command => m2("Wait for All Movement");

// ── 문 열고 닫기(화면 효과 doorOpen/doorClose — 칸 그림을 그대로 쓴 문짝) ──
// 문틀 두께는 그림을 재서 정했다(16px 칸 기준): 승강기 문짝은 층 표시등·테두리 안쪽만, 철문·유리문도 문틀은 제자리.
const ELEV_FRAME = { l: 4, r: 3, t: 7, b: 1 };
/** 승강기 문 그림(2×2)은 문 앞 칸(이벤트 칸) 두 줄 위다. */
const elevDoor = (front: Cell): DoorSpec => ({ x: front.x, y: front.y - 2, w: 2, h: 2, style: "slide", hinge: "left", interior: "lit", frame: ELEV_FRAME });
/** 거리의 회사 로비 유리문(2×2, 두 짝 미닫이) — 문 이벤트 칸이 그림 아랫줄 왼쪽 칸. */
const LOBBY_DOOR = (a: FirstLoveAnchors): DoorSpec => ({ x: a.street.officeDoor.x, y: a.street.officeDoor.y - 1, w: 2, h: 2, style: "slide", hinge: "left", interior: "dark", frame: { l: 5, r: 5, t: 3, b: 1 } });
/** 옥상 계단탑 철문(1×2 여닫이, 경첩 왼쪽). */
const ROOF_DOOR = (a: FirstLoveAnchors): DoorSpec => ({ x: a.rooftop.door.x, y: a.rooftop.door.y - 1, w: 1, h: 2, style: "swing", hinge: "left", interior: "dark", frame: { l: 2, r: 2, t: 1, b: 2 } });
/** 문 연출 한 번(기다림 포함). ms 1 = 그 상태로 바로. */
function doorFx(d: DoorSpec, open: boolean, ms = 600, block = true): Command[] {
  return [m2("Screen Effect", { effect: open ? "doorOpen" : "doorClose", value: doorValue(d), durationMs: ms }), ...(block && ms > 1 ? [wait(ms)] : [])];
}
const quiet = (resourceId: string, volume = 0.6): Command => ({ ...(playSe(resourceId) as object), volume } as unknown as Command);
/** 카메라를 화면 칸(x, y)로 옮겼다가 / 주인공에게 되돌린다. */
const panTo = (x: number, y: number, ms = 900): Command => m2("Camera Control", { mode: "panTo", target: "screen", x, y, zoom: 1, durationMs: ms, wait: true, easing: "easeInOut" });
const panBack = (ms = 900): Command => m2("Camera Control", { mode: "return", target: "player", x: 0, y: 0, zoom: 1, durationMs: ms, wait: true, easing: "easeInOut" });

/**
 * NPC 퇴장 — 실제 걸을 수 있는 길로 승강기 앞까지 걸어가 단추를 누르고, 문이 열리면 타고, 문이 닫힌다(사용자 r4: 「승강기를 진짜로」).
 * begin = 승강기 앞까지 걷기(기다리지 않는다 — 걷는 동안 대사가 이어진다). end = 도착을 기다려 단추·딩·문 열림·탑승·문 닫힘 → 감춤 스위치.
 * pan 을 주면 문이 화면 밖일 때 카메라가 승강기로 갔다가 돌아온다(회의실에서 보는 퇴장).
 * firstLoveProbe(scripts/qa/runtime/first-love-probes.mts)가 「사라지기 직전 칸 = 출구 앞」을 검사한다.
 */
function leave(project: Project, mapId: string, eventId: string, from: Cell, exit: { stand: Cell; door: Cell }, hideSw: string, hero: Cell, alsoAvoid: readonly Cell[] = [], pan?: Cell, returnTo?: Cell): { begin: Command; end: Command[] } {
  const walkOut = walkRoute(project, mapId, eventId, from, exit.stand, [hero, ...alsoAvoid], false) as unknown as Record<string, unknown>;
  walkOut.routeTail = [{ kind: "turn", dir: dirToward(exit.stand, exit.door) }];
  const door = elevDoor(exit.door);
  const ride = { kind: "moveEvent", eventId, route: { moves: [
    { kind: "setThrough", enabled: true }, { kind: "move", dir: "up" }, { kind: "move", dir: "up" }, { kind: "turn", dir: "down" }, { kind: "setThrough", enabled: false },
  ], repeat: false, wait: true, skippable: true } } as unknown as Command;
  return {
    begin: walkOut as unknown as Command,
    end: [
      ...(pan ? [panTo(pan.x, pan.y)] : []),
      waitMoves(),
      quiet(SE_BUTTON), wait(500),
      playSe(SE_ELEVATOR), wait(300),
      quiet(SE_SLIDE, 0.45), ...doorFx(door, true, 700),
      ride,
      wait(250),
      quiet(SE_SLIDE, 0.45), ...doorFx(door, false, 700),
      setSw(hideSw, true),
      wait(300),
      ...(pan ? [returnTo ? panTo(returnTo.x, returnTo.y) : panBack()] : []),
    ],
  };
}

/** 문 칸: 밟으면 단계에 따라 옮기거나 막는다. */
function door(id: string, at: Cell, conditionsToGo: Parameters<typeof page>[1], go: Command[], blocked: Command[], back: Dir = "up"): GameEvent {
  return event(id, id, at, [
    // 「같은 층」: 문 그림 칸이 막힌 칸이어도 부딪히면 열린다(엔진이 지형에 막힌 걸음에서도 같은 층 접촉 이벤트를 발동).
    page(`${id}_blocked`, [], [...blocked, walk("@player", [back])], { trigger: "playerTouch", priority: "same" }),
    page(`${id}_go`, conditionsToGo, go, { trigger: "playerTouch", priority: "same" }),
  ]);
}

/** 자동 장면(맵에 들어오면 한 번). */
function scene(id: string, at: Cell, when: number, commands: Command[]): GameEvent {
  return event(id, id, at, [page(`${id}_p`, [stageIs(V_STAGE, when)], commands, { trigger: "auto" })]);
}

function add(map: GameMap, ...events: GameEvent[]): void {
  map.events.push(...events);
}

function spot(project: Project, mapId: string, origin: Cell, taken: Cell[]): Cell {
  const map = project.maps[mapId]!;
  const c = nearestFree(project, map, origin, 8, taken);
  taken.push(c);
  return c;
}

function dirToward(from: Cell, to: Cell): Dir {
  const dx = to.x - from.x, dy = to.y - from.y;
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? "right" : "left";
  return dy > 0 ? "down" : "up";
}

/**
 * 걷기 길은 모든 이벤트가 맵에 놓인 뒤에 찾는다 — 장면을 짓는 순간엔 뒤에 놓일 인물·사물 칸을 모른다(탐침: 민호가 지후를 밟고 지나감).
 * walkRoute 는 빈 길의 명령을 돌려주고, resolveRoutes() 가 데모를 다 지은 뒤 채운다.
 */
// 도구 호출(define_ending 등)이 프로젝트를 복제해 맵을 갈아 끼우므로, 명령 객체를 붙잡지 않고 표식(routeKey)으로 나중에 찾는다.
let pendingRoutes = new Map<string, { dirs: () => Dir[]; firstStepBlocked: (dir: Dir) => boolean }>();
function walkRoute(project: Project, mapId: string, eventId: string, from: Cell, to: Cell, avoid: readonly Cell[] = [], waitDone = true, endFacing?: Dir): Command {
  const routeKey = `r${pendingRoutes.size}`;
  // 의자·소품 칸(지나갈 수 없는 칸)에 앉은 사람은 그 칸에서 나가는 걸음이 엔진 통행 검사(canMove 의 출발 칸 비트)에 막힌다
  // (VQA r5: 본부장이 의자에서 못 일어나 경로가 통째로 건너뛰어졌다). 첫걸음만 통과로 일어선다.
  pendingRoutes.set(routeKey, {
    dirs: () => route(project, mapId, from, to, avoid),
    firstStepBlocked: (dir) => {
      const d = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[dir];
      return !canMove(project, project.maps[mapId]!, from.x, from.y, from.x + d[0]!, from.y + d[1]!);
    },
  });
  // 걸어 도착한 인물은 걸어 온 쪽이 아니라 그 자리의 할 일(상대·책상)을 본다 — 끝 방향을 경로 안에서 돌린다.
  return { ...(walk(eventId, [], waitDone) as object), routeKey, ...(endFacing ? { routeTail: [{ kind: "turn", dir: endFacing }] } : {}) } as unknown as Command;
}
/**
 * 말 걸기 대화에서 주인공이 위·아래에서 다가오면 두 사람이 한 열로 쌓여 말풍선·대화창에 가린다.
 * 주인공이 보는 방향(= 다가온 쪽)으로 갈라, 위·아래였다면 상대 옆 칸으로 걸어가 나란히 서서 마주 본다.
 */
function sideBySide(project: Project, mapId: string, npcId: string, npc: Cell): Command[] {
  const map = project.maps[mapId]!;
  const free = (c: Cell): boolean => isPassable(project, map, c.x, c.y) && !map.events.some((e) => e.x === c.x && e.y === c.y);
  const side = [{ x: npc.x - 1, y: npc.y }, { x: npc.x + 1, y: npc.y }].find(free);
  if (!side) return [faceHero(npcId)];
  const from = (dir: "up" | "down"): Cell => ({ x: npc.x, y: dir === "up" ? npc.y + 1 : npc.y - 1 });
  const go = (dir: "up" | "down"): Command[] => [
    walkRoute(project, mapId, "@player", from(dir), side, [npc]),
    face("@player", dirToward(side, npc)),
  ];
  return [
    ifCond({ kind: "facing", subject: "player", dir: "up" } as Parameters<typeof ifCond>[0], go("up"),
      [ifCond({ kind: "facing", subject: "player", dir: "down" } as Parameters<typeof ifCond>[0], go("down"))]),
    faceHero(npcId),
  ];
}
function resolveRoutes(project: Project): void {
  const fill = (list: unknown): void => {
    if (!Array.isArray(list)) return;
    for (const c of list as Record<string, unknown>[]) {
      if (c?.kind === "moveEvent" && typeof c.routeKey === "string") {
        const pending = pendingRoutes.get(c.routeKey);
        const dirs = pending?.dirs() ?? [];
        const head = (c.routeHead as unknown[] | undefined) ?? [], tail = (c.routeTail as unknown[] | undefined) ?? [];
        const steps: unknown[] = dirs.map((dir) => ({ kind: "move", dir }));
        if (dirs.length && pending?.firstStepBlocked(dirs[0]!)) steps.splice(0, 1, { kind: "setThrough", enabled: true }, steps[0], { kind: "setThrough", enabled: false });
        (c.route as { moves: unknown[] }).moves = [...head, ...steps, ...tail];
        delete c.routeKey; delete c.routeHead; delete c.routeTail;
      }
      for (const k of ["then", "else", "commands"]) fill(c?.[k]);
      if (Array.isArray(c?.options)) for (const o of c.options as { branch: unknown }[]) fill(o.branch);
    }
  };
  for (const map of Object.values(project.maps)) for (const ev of map.events) { fill(ev.commands); for (const pg of ev.pages ?? []) fill(pg.commands); }
  pendingRoutes = new Map();
}

/** from → to 의 실제 걸을 수 있는 최단 경로(통행 칸 + 이벤트 칸 피함). 길이 없으면 직선 path 로 물러난다. */
function route(project: Project, mapId: string, from: Cell, to: Cell, avoid: readonly Cell[] = []): Dir[] {
  const map = project.maps[mapId]!;
  const blocked = new Set([...map.events.map((e) => `${e.x},${e.y}`), ...avoid.map((c) => `${c.x},${c.y}`)]);
  blocked.delete(`${to.x},${to.y}`);
  const steps: [Dir, number, number][] = [["up", 0, -1], ["down", 0, 1], ["left", -1, 0], ["right", 1, 0]];
  const prev = new Map<string, [string, Dir]>();
  const queue: Cell[] = [from];
  const seen = new Set([`${from.x},${from.y}`]);
  while (queue.length) {
    const c = queue.shift()!;
    if (c.x === to.x && c.y === to.y) break;
    for (const [d, dx, dy] of steps) {
      const n = { x: c.x + dx, y: c.y + dy }, k = `${n.x},${n.y}`;
      if (seen.has(k) || blocked.has(k) || !isPassable(project, map, n.x, n.y)) continue;
      seen.add(k); prev.set(k, [`${c.x},${c.y}`, d]); queue.push(n);
    }
  }
  const out: Dir[] = [];
  let k = `${to.x},${to.y}`;
  if (!prev.has(k)) return path(from, to);
  while (prev.has(k)) { const [pk, d] = prev.get(k)!; out.unshift(d); k = pk; }
  return out;
}

/** from → to 로 걷는 한 칸씩의 방향(가로 먼저). 경로 막힘은 짓는 쪽이 앵커로 보장한다. */
function path(from: Cell, to: Cell, verticalFirst = false): Dir[] {
  const h: Dir[] = Array.from({ length: Math.abs(to.x - from.x) }, () => (to.x > from.x ? "right" : "left"));
  const v: Dir[] = Array.from({ length: Math.abs(to.y - from.y) }, () => (to.y > from.y ? "down" : "up"));
  return verticalFirst ? [...v, ...h] : [...h, ...v];
}

// ─────────────────────────────────────────────────────────────────────────────
// 월요일 아침 — 승강장 · 거리
// ─────────────────────────────────────────────────────────────────────────────
function buildMondayMorning(project: Project, a: FirstLoveAnchors): void {
  const plat = project.maps[FL_MAP.platformAm]!;
  const street = project.maps[FL_MAP.street]!;
  const taken: Cell[] = [a.platform.arrive];

  // 출근길 사람들(말 걸면 한마디) — 빈 승강장이 아니라 아침 승강장.
  const commuterA = spot(project, FL_MAP.platformAm, { x: a.platform.arrive.x + 4, y: a.platform.arrive.y - 1 }, taken);
  const commuterB = spot(project, FL_MAP.platformAm, { x: a.platform.arrive.x - 3, y: a.platform.arrive.y }, taken);
  add(plat,
    event("ev_fl_commuter_a", "출근하는 회사원", commuterA, [page("p", [], voice("회사원", "…아, 오늘 월요일이지. 월요일이네. 월요일이야."), { who: "commuterA", dir: "down" })]),
    event("ev_fl_commuter_b", "통화하는 회사원", commuterB, [page("p", [], voice("회사원", "네, 부장님. 지금 역이에요. 5분이면… 네, 3분이요."), { who: "commuterB", dir: "right" })]),
  );

  add(plat, scene("ev_fl_intro", { x: 1, y: 1 }, S.START, [
    textAtBottom(),
    bgm(BGM_OFFICE),
    ...caption("월요일 오전 8시 41분, 한결역."),
    ...think(
      "첫 출근. 지각은 아니다. 아직은.",
      "스튜디오 늘봄. 서른 명 남짓한 앱 회사. 면접 날 본 사무실엔 햇빛이 잘 들었다.",
    ),
    ...say("seoha", "happy", "…할 수 있어, 윤서하."),
    ...think("(계단을 올라 역 밖으로 나가자.)"),
    stage(S.ARRIVED),
  ]));

  add(plat, door("ev_fl_plat_exit", a.platform.exit, [stageAtLeast(V_STAGE, S.ARRIVED)],
    [transfer(FL_MAP.street, a.street.arrive.x, a.street.arrive.y, "down")],
    think("아직 정신이 없다.")));

  // 거리(낮)
  add(street, scene("ev_fl_street_am", { x: 1, y: 1 }, S.ARRIVED, [
    ...think("늘봄 빌딩. 큰길 건너 오른쪽, 유리문 건물이다."),
    ...emote("player", "music"),
    stage(S.STREET),
  ]));
  add(street,
    // 로비 유리문이 갈라져 열리고, 들어가면 화면이 어두워진다 — 다음 화면은 7층 승강기 안(문이 닫힌 채).
    door("ev_fl_office_door", a.street.officeDoor, [stageAtLeast(V_STAGE, S.STREET)], [
      quiet(SE_SLIDE, 0.5), ...doorFx(LOBBY_DOOR(a), true, 600),
      { kind: "moveEvent", eventId: "@player", route: { moves: [{ kind: "setThrough", enabled: true }, { kind: "move", dir: "up" }, { kind: "setThrough", enabled: false }], repeat: false, wait: true, skippable: true } } as unknown as Command,
      ...fadeOut(500),
      // 승강기 문 앞 칸에 내리고(막힌 그림 칸에는 내릴 수 없다), 화면이 검은 동안 한 칸 올라 칸 안에 선다 — 만남 장면 첫머리.
      transfer(FL_MAP.office, a.office.elevator.x, a.office.elevator.y, "down", "none"),
    ], think("…"), "down"),
    door("ev_fl_konbini_am", a.street.konbiniDoor, [stageIs(V_STAGE, 999)], [], think("편의점은 나중에. 첫날부터 지각할 순 없다."), "down"),
    door("ev_fl_subway_am", a.street.subway, [stageIs(V_STAGE, 999)], [], think("방금 내렸잖아. 회사는 저쪽이다."), "down"),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 월요일 사무실 — 만남 · 탕비실 · 옥상
// ─────────────────────────────────────────────────────────────────────────────
function buildMondayOffice(project: Project, a: FirstLoveAnchors): void {
  const office = project.maps[FL_MAP.office]!;
  const roof = project.maps[FL_MAP.rooftop]!;
  const o = a.office;
  // 만남 무리는 승강기에서 내린 서하(elevatorOut)를 기준으로 선다. 문턱을 지날 때 문틀이 머리를 덮던 것은 렌더러가 고쳤다
  // (playSceneMapRuntime isWallFaceCell — 벽면 기물 맨 아래 줄은 캐릭터와 y 정렬).
  const heroMeet: Cell = o.elevatorOut;
  const taken: Cell[] = [o.elevatorOut, o.heroDesk, o.stairsOut];
  const minhoSpot = spot(project, FL_MAP.office, o.pantry, taken);
  const jihuSeat = o.jihuDesk;
  taken.push(jihuSeat, o.leadDesk);
  // 만남 자리: 팀장은 주인공 두 칸 앞, 지후는 팀장 옆(엘리베이터 벽 그림 밑이 아닌 트인 바닥 — 시각 담당 앵커가 있으면 그것).
  const named = o as typeof o & { meetLead?: Cell; meetJihu?: Cell };
  const leadMeetStop = named.meetLead ?? spot(project, FL_MAP.office, { x: heroMeet.x, y: heroMeet.y + 2 }, taken);
  const jihuMeetStop = named.meetJihu ?? spot(project, FL_MAP.office, { x: leadMeetStop.x + 1, y: leadMeetStop.y }, taken);
  // 흉상 자리는 장면 내내 고정(서하 왼쪽, 상대 오른쪽, VQA r16) — 민호도 서하 오른쪽(팀장 옆)에 선다.
  const minhoMeetStop = spot(project, FL_MAP.office, { x: leadMeetStop.x + 1, y: leadMeetStop.y }, [...taken, leadMeetStop, jihuMeetStop]);
  // 둘 다 자기 자리에서 걸어 나온다(빈 바닥에서 솟아나지 않는다).
  const leadSpot = o.leadDesk;
  const jihuMeet = jihuSeat;

  // 팀장: 처음엔 엘리베이터 앞에서 맞이하고, 그다음엔 자기 자리에.
  add(office, event("ev_fl_lead", "오정민 팀장", leadSpot, [
    page("lead_greet", [stageIs(V_STAGE, S.STREET)], [], { who: "lead", dir: "down" }),
    page("lead_after", [stageAtLeast(V_STAGE, S.MET)], [
      ...say("lead", "base", "오전엔 적응부터 해요. 계정은 점심 지나서 나와요."),
      ifCond(stageIs(V_STAGE, S.MET), [
        ...say("lead", "base", "‘하루끝’은 밤 열 시에 사연 하나랑 노래 한 곡을 보내 주는 앱이에요. 작지만, 오래 버틴 서비스죠."),
        ...say("lead", "happy", "서하 씨 포트폴리오에 있던 라디오 화면 시안. 그거 보고 뽑았어요. 금요일 발표에 그 감성 그대로 가져와요."),
        ...think("…라디오 화면. 방송부 시절 생각하면서 그린 거였다."),
      ]),
      ifCond(stageIs(V_STAGE, S.PANTRY), say("lead", "happy", "점심은 자유예요. 옥상 가 봤어요? 우리 건물 유일한 자랑이에요.")),
    ], { who: "lead", dir: "down" }),
  ]));

  // 지후: 만남 장면 동안은 서 있다가, 그다음엔 자기 자리.
  add(office, event("ev_fl_jihu", "강지후", jihuSeat, [
    page("jihu_seat", [stageAtLeast(V_STAGE, S.MET), stageBelow(V_STAGE, S.PANTRY)], [
      ...say("jihu", "base", "…계정은 팀장님이 오후에 주실 거예요. 발표 자료는 공유 폴더 ‘하루끝_리뉴얼’에 있고요."),
      ifCond({ kind: "variable", variableId: V_JIHU, op: ">=", value: 1 } as never, [
        ...say("jihu", "sad", "…아까는, 미안해요. 엘리베이터 앞에서."),
        ...say("seoha", "base", "뭐가요?"),
        ...say("jihu", "base", "…아니에요. 일해요."),
        ...think("사과하고, 바로 모니터 뒤로 숨는다. 그 버릇은 그대로네."),
      ], [
        ...think("업무 얘기만. 깔끔하게, 선을 긋는다."),
      ]),
    ], { who: "jihu", dir: "down" }),
    page("jihu_seat2", [stageIs(V_STAGE, S.PANTRY)], [
      ...think("자리가 비어 있다. 모니터 옆에 바나나우유 빈 팩이 하나 놓여 있다.", "…설마. 그냥 우연이겠지."),
    ], {}),
  ]));

  add(office, event("ev_fl_minho", "차민호", minhoSpot, [
    page("minho_desk", [stageIs(V_STAGE, S.STREET)], [], { who: "minho", dir: "up" }),
    page("minho_pantry", [stageIs(V_STAGE, S.MET)], [
      ...sideBySide(project, FL_MAP.office, "ev_fl_minho", minhoSpot),
      ...say("minho", "happy", "왔어요? 이 커피 머신, 버튼 두 개를 같이 누르면 라떼가 돼요. 우리 회사 최대 기밀."),
      // 커피 머신 앞의 작은 시연 — 돌아서서 두 단추를 같이 누르고, 기계가 울리면 잔을 들고 돌아선다.
      face("ev_fl_minho", "up"),
      quiet(SE_BUTTON, 0.5), wait(120), quiet(SE_BUTTON, 0.5), wait(700),
      quiet("cc0-se-osx-dishes-02", 0.5), wait(500),
      faceHero("ev_fl_minho"),
      ...think("고소한 냄새. …진짜 라떼다."),
      ...say("seoha", "happy", "그런 걸 첫날에 알려 줘도 돼요?"),
      ...say("minho", "happy", "동기잖아요. 기밀은 동기끼리 나누는 거죠."),
      { kind: "changeFriendship", npcKey: "minho", delta: 150 } as Command,
      ...say("minho", "base", "…근데요. 아까 강 선임님 볼 때 표정이 좀. 혹시 아는 사이예요?"),
      choices([
        { text: "고등학교 선배야. …였던 것 같아.", then: [
          setSw(SW_TOLD_MINHO, true),
          { kind: "changeFriendship", npcKey: "minho", delta: 150 } as Command,
          ...say("minho", "surprised", "에? 근데 선임님은 처음 뵙겠다고…"),
          ...say("seoha", "sad", "그러게. 나도 그게 궁금해."),
          ...say("minho", "base", "음. 사람마다 사정이 있겠죠. 걱정 마요, 입은 무거운 편이에요. 진짜로."),
        ] },
        { text: "아니. 닮은 사람이 있어서.", then: [
          ...say("minho", "base", "흠. 그래요?"),
          ...think("민호 씨는 더 묻지 않았다. 대신 커피를 한 잔 더 내렸다. 눈치가 빠른 사람이다."),
        ] },
      ]),
      ...say("minho", "base", "점심 같이 먹자고 하고 싶은데, 나 오늘 점심 미팅이에요."),
      ...say("minho", "happy", "대신 팁. 엘리베이터에서 R 누르면 옥상이에요. 사람 별로 없고, 바람 좋고. 캔커피 두 개 챙겨 가요."),
      playSe(SE_CAN),
      ...think("(캔커피 두 개를 챙겼다. 점심시간이다. 엘리베이터로 옥상에 올라가 보자.)"),
      // 점심시간으로 건너뛴다 — 지후 자리가 빈 자리로 바뀌는 순간을 화면이 어두운 동안에(눈앞에서 사라지지 않게).
      ...fadeOut(500),
      stage(S.PANTRY),
      wait(300),
      ...fadeIn(500),
    ], { who: "minho", dir: "up" }),
    page("minho_after", [stageAtLeast(V_STAGE, S.PANTRY)], [
      ...say("minho", "happy", "옥상 가 봐요. 진짜 좋다니까요."),
      ifCond(swOn(SW_TOLD_MINHO),
        [...say("minho", "base", "…아, 그리고. 선임님, 점심엔 꼭 옥상에 혼자 있어요. 이건 기밀 아니고 그냥 관찰이에요.")],
        [...say("minho", "base", "라떼 버튼, 아무한테도 말하면 안 돼요. 그거 우리 팀 복지의 전부예요.")]),
    ], { who: "minho", dir: "up" }),
  ]));

  // 만남 장면 — 엘리베이터에서 내리자마자.
  const elev = elevDoor(o.elevator);
  add(office, scene("ev_fl_meet", { x: 1, y: 1 }, S.STREET, [
    // 승강기 안에서 도착: 닫힌 문 뒤 → 딩 → 문이 열리고 → 걸어 나온다 → 등 뒤에서 문이 닫힌다.
    ...doorFx(elev, false, 1),
    { kind: "moveEvent", eventId: "@player", route: { moves: [
      { kind: "setThrough", enabled: true }, { kind: "move", dir: "up" }, { kind: "turn", dir: "down" }, { kind: "setThrough", enabled: false },
    ], repeat: false, wait: true, skippable: true } } as unknown as Command,
    ...fadeIn(500),
    ...caption("스튜디오 늘봄, 7층."),
    playSe(SE_ELEVATOR), wait(400),
    quiet(SE_SLIDE, 0.45), ...doorFx(elev, true, 700),
    { kind: "moveEvent", eventId: "@player", route: { moves: [
      { kind: "setThrough", enabled: true }, { kind: "move", dir: "down" }, { kind: "move", dir: "down" }, { kind: "setThrough", enabled: false },
    ], repeat: false, wait: true, skippable: true } } as unknown as Command,
    quiet(SE_SLIDE, 0.4), ...doorFx(elev, false, 700, false),
    walkRoute(project, FL_MAP.office, "ev_fl_lead", leadSpot, leadMeetStop, [heroMeet], true, dirToward(leadMeetStop, heroMeet)),
    face("ev_fl_lead", dirToward(leadMeetStop, heroMeet)),
    face("@player", dirToward(heroMeet, leadMeetStop)),
    ...sayAt("lead", "right", "base", "윤서하 씨? 오정민이에요. 프로덕트팀 팀장."),
    ...say("seoha", "happy", "안녕하세요! 오늘부터 출근하는 윤서하입니다. 잘 부탁드립니다."),
    ...sayAt("lead", "right", "happy", "긴장 풀어요. 우리 팀 다섯 명이에요. 한 명은 휴가 중이고, 한 명은 벌써 탕비실에서 간식 먹고 있고."),
    // 민호는 탕비실에서 걸어 나와 인사한다(VQA2: 「탕비실 안에서 자기소개」).
    walkRoute(project, FL_MAP.office, "ev_fl_minho", minhoSpot, minhoMeetStop, [heroMeet, leadMeetStop], true, dirToward(minhoMeetStop, heroMeet)),
    face("ev_fl_minho", dirToward(minhoMeetStop, heroMeet)),
    face("@player", dirToward(heroMeet, minhoMeetStop)),
    ...sayAt("minho", "right", "happy", "아, 들켰다. 차민호예요! 지난주에 들어온 백엔드 신입. 동기라고 해도 되죠?"),
    ...say("seoha", "happy", "네, 그럼요. 반가워요."),
    { kind: "changeFriendship", npcKey: "lead", delta: 60 } as Command,
    { kind: "changeFriendship", npcKey: "minho", delta: 60 } as Command,
    face("@player", dirToward(heroMeet, leadMeetStop)),
    ...sayAt("lead", "right", "base", "그리고 서하 씨 사수. 지후 씨, 잠깐 와 볼래요?"),
    walkRoute(project, FL_MAP.office, "ev_fl_jihu_meet", jihuMeet, jihuMeetStop, [heroMeet, leadMeetStop, minhoMeetStop], true, dirToward(jihuMeetStop, heroMeet)),
    face("ev_fl_jihu_meet", dirToward(jihuMeetStop, heroMeet)),
    // 지후가 서하 앞에 서면 서하도 그를 본다 — 선택지 「처음 뵙겠습니다」는 마주 선 채로 뜬다.
    face("@player", dirToward(heroMeet, jihuMeetStop)),
    stopBgm(),
    ...emote("player", "exclamation", 1300),
    ...think("…어?", "회색 후드. 조금 길어진 앞머리. 목소리를 듣기도 전에 알았다."),
    flash("white", 250),
    ...think("금요일 점심, 방송실 창가. 스피커에서 흘러나오던 그 목소리."),
    ...sayAt("lead", "right", "base", "강지후 선임. 앱 개발 4년 차고, 이번 ‘하루끝’ 리뉴얼 메인 개발자예요. 모르는 건 이 사람한테 물어봐요."),
    ...say("jihu", "base", "…처음 뵙겠습니다. 강지후입니다."),
    ...think("처음… 뵙겠습니다?"),
    choices([
      { text: "“처음 뵙겠습니다. 잘 부탁드립니다, 선임님.”", then: [
        ...say("seoha", "base", "처음 뵙겠습니다. 잘 부탁드립니다, 선임님."),
        ...say("jihu", "sad", "…네. 잘 부탁드립니다."),
        ...think("웃으면서 말했다. 웃는 건, 10년 동안 꽤 늘었다."),
      ] },
      { text: "“…지후 선배?”", then: [
        ...say("seoha", "surprised", "…지후 선배?"),
        ...sayAt("lead", "right", "surprised", "어머, 아는 사이예요?"),
        ...emote("ev_fl_jihu_meet", "ellipsis", 1200),
        // 「대답하기 전에 눈을 피했다」 — 대답하기 전에 지후가 실제로 고개를 돌렸다가, 다시 보고 말한다.
        face("ev_fl_jihu_meet", "right"),
        wait(700),
        face("ev_fl_jihu_meet", dirToward(jihuMeetStop, heroMeet)),
        ...say("jihu", "base", "…아뇨. 사람을 잘못 보신 것 같습니다."),
        ...say("seoha", "embarrassed", "아… 죄송합니다. 닮은 사람이 있어서요."),
        ...think("잘못 봤을 리가 없다. 저 사람, 대답하기 전에 눈을 피했다."),
        ...like(1, "ev_fl_jihu_meet"),
      ] },
    ]),
    bgm(BGM_OFFICE),
    face("@player", dirToward(heroMeet, leadMeetStop)),
    ...sayAt("lead", "right", "base", "서하 씨 자리는 지후 씨 맞은편이에요. 오늘 숙제는 금요일 발표 자료 읽어 두기."),
    ...sayAt("lead", "right", "base", "금요일 오후 세 시에 ‘소리결’ 박 본부장님 앞에서 리뉴얼 시안 발표가 있어요. 신입한테 미안하지만, 첫 주부터 바빠요."),
    face("@player", dirToward(heroMeet, minhoMeetStop)),
    listenTo("seoha"),
    ...sayAt("minho", "right", "happy", "서하 씨, 이따 탕비실로 와요! 커피 머신 쓰는 법 알려 줄게요."),
    walkRoute(project, FL_MAP.office, "ev_fl_minho", minhoMeetStop, minhoSpot, [heroMeet], false, "up"),
    // 만남 자리의 둘은 그 자리에서 사라지지 않고 각자 자리까지 걸어간다 — 자리의 지후·팀장 페이지가 같은 칸에서 이어받는다.
    walkRoute(project, FL_MAP.office, "ev_fl_jihu_meet", jihuMeetStop, jihuSeat, [heroMeet], false),
    walkRoute(project, FL_MAP.office, "ev_fl_lead", leadMeetStop, o.leadDesk, [heroMeet], false, "down"),
    ...think("(탕비실에서 민호 씨를 찾아보자. 자리와 화이트보드도 한번 볼까.)"),
    waitMoves(),
    stage(S.MET),
  ]));
  // 만남 장면에만 서 있는 지후(그 뒤엔 자리의 지후가 대신한다).
  add(office, event("ev_fl_jihu_meet", "강지후", jihuMeet, [
    page("jm", [stageIs(V_STAGE, S.STREET)], [], { who: "jihu", dir: "left" }),
  ]));

  // 둘러볼 것들.
  add(office,
    event("ev_fl_hero_desk", "서하 자리", o.heroDesk, [
      page("d1", [stageBelow(V_STAGE, S.PANTRY)], think(
        "새 노트북. 모니터에 포스트잇이 붙어 있다.",
        "‘환영합니다! 와이파이 비번은 팀장님 자리 옆 화이트보드에. — 민호’",
      )),
      page("d2", [stageAtLeast(V_STAGE, S.PANTRY)], think("발표 자료 첫 장. ‘하루끝 — 하루의 끝에, 사연 하나와 노래 한 곡.’", "…방송부 같다. 그래서 지원했던 건지도 모른다.")),
    ]),
    event("ev_fl_whiteboard", "화이트보드", o.whiteboard, [
      page("w", [], think("‘금 15:00 소리결 — 하루끝 리뉴얼 발표 / 개발 강지후 · 디자인 윤서하(신규!)’", "누가 내 이름 옆에 느낌표를 붙여 놨다. 민호 씨 글씨다.")),
    ]),
  );

  // 문: 엘리베이터(점심에만 옥상으로 — 단추·딩·문 열림·탑승·문 닫힘·층 이동), 비상계단(막힘).
  add(office,
    door("ev_fl_elev", o.elevator, [stageIs(V_STAGE, S.PANTRY)], [
      quiet(SE_BUTTON), wait(600),
      playSe(SE_ELEVATOR), wait(300),
      quiet(SE_SLIDE, 0.45), ...doorFx(elev, true, 700),
      { kind: "moveEvent", eventId: "@player", route: { moves: [
        { kind: "setThrough", enabled: true }, { kind: "move", dir: "up" }, { kind: "move", dir: "up" }, { kind: "turn", dir: "down" }, { kind: "setThrough", enabled: false },
      ], repeat: false, wait: true, skippable: true } } as unknown as Command,
      wait(300),
      quiet(SE_SLIDE, 0.45), ...doorFx(elev, false, 700),
      wait(400),
      ...fadeOut(600),
      ...caption("7층, 8층, 9층… R."),
      playSe(SE_ELEVATOR), wait(500),
      transfer(FL_MAP.rooftop, a.rooftop.doorOut.x, a.rooftop.doorOut.y, "down", "none"),
    ], think("아직 근무 시간이다. 옥상은 점심시간에 가 보자."), "down"),
    door("ev_fl_stairs", o.stairs, [stageIs(V_STAGE, 999)], [], think("비상계단이다. 옥상은 엘리베이터로 가면 된다고 했다.")),
  );

  // ── 옥상 ──
  const r = a.rooftop;
  const jihuRail = r.rail;
  add(roof, event("ev_fl_jihu_roof", "강지후", jihuRail, [
    page("jr", [stageIs(V_STAGE, S.PANTRY)], [], { who: "jihu", dir: "down" }),
  ]));
  add(roof, door("ev_fl_roof_door", r.door, [stageAtLeast(V_STAGE, S.ROOF)], [], think("…아직 할 말이 남았다."), "down"));
  const roofDoor = ROOF_DOOR(a);
  add(roof, scene("ev_fl_roof", { x: 1, y: 1 }, S.PANTRY, [
    // 계단탑 철문을 밀고 막 나온 참 — 열린 문이 등 뒤에서 무겁게 닫힌다.
    ...doorFx(roofDoor, true, 1),
    ...fadeIn(500),
    quiet(SE_DOOR_SHUT, 0.7), ...doorFx(roofDoor, false, 500),
    bgm(BGM_ROOF),
    face("ev_fl_jihu_roof", "up"),
    // 문 앞에서 난간 쪽으로 카메라가 천천히 건너가 그 사람을 찾는다.
    panTo(jihuRail.x, jihuRail.y, 1600),
    ...think("…있다."),
    ...think("난간에 기대 선 뒷모습. 바람에 후드 끈이 흔들린다."),
    panBack(1000),
    walkRoute(project, FL_MAP.rooftop, "@player", r.doorOut, r.railHero),
    face("@player", "right"),
    face("ev_fl_jihu_roof", "left"),
    ...emote("ev_fl_jihu_roof", "ellipsis"),
    ...say("jihu", "base", "…여긴 어떻게 알았어요."),
    ...say("seoha", "base", "민호 씨가요. 회사 유일한 장점이라고."),
    ...say("jihu", "happy", "틀린 말은 아니네요."),
    ...say("seoha", "base", "선배."),
    ...say("jihu", "base", "여기선 선임이요."),
    ...say("jihu", "sad", "…회사에선 모르는 사이로 해요. 그게 서로 편할 것 같아서."),
    ...think("편하다고. 10년 만에 만나서 처음 하는 부탁이, 그거라니."),
    choices([
      { text: "“왜 모르는 척해요? 저 기억하잖아요.”", then: [
        setSw("sw_fl_admitted", true),
        ...say("seoha", "sad", "왜 모르는 척해요? 저 기억 못 하는 거, 아니잖아요."),
        ...say("jihu", "surprised", "…"),
        ...say("jihu", "sad", "기억해요. 그래서 그래요.", "첫 출근 날이잖아요. 나 때문에 망치게 하고 싶지 않았어요."),
        ...say("seoha", "base", "이미 좀 망쳤어요."),
        ...say("jihu", "sad", "…미안해요."),
        ...like(2, "ev_fl_jihu_roof"),
      ] },
      { text: "(말없이 캔커피 하나를 내민다)", then: [
        setSw(SW_COFFEE, true),
        playSe(SE_CAN),
        ...say("jihu", "surprised", "…나 주는 거예요?"),
        ...say("seoha", "base", "두 개 챙겨 왔어요. 모르는 사이끼리도 커피 정도는 마시잖아요."),
        ...say("jihu", "happy", "…여전하네요. 남 거 먼저 챙기는 거."),
        ...think("여전하다는 말은, 기억한다는 뜻이다."),
        ...like(1, "ev_fl_jihu_roof"),
      ] },
      { text: "“…알겠습니다, 선임님.”", then: [
        ...say("seoha", "base", "…알겠습니다, 선임님."),
        ...say("jihu", "sad", "…네."),
        face("@player", "left"),
        ...think("돌아서는 내 등 뒤로, 그 사람이 뭔가 말하려다 그만두는 소리가 들렸다."),
        ...like(-1),
      ] },
    ]),
    ...say("jihu", "base", "점심시간 끝나요. 먼저 내려가요. 같이 내려가면… 말 나와요."),
    // 옥상을 떠날 때도 실제 문으로 걸어 나간다 — 장면 끝 순간이동 금지(VQA2: 돌아오는 문 없이 거리로).
    face("ev_fl_jihu_roof", "up"),
    walkRoute(project, FL_MAP.rooftop, "@player", r.railHero, r.doorOut),
    face("@player", dirToward(r.doorOut, r.door)),
    quiet(SE_DOOR, 0.7), ...doorFx(roofDoor, true, 500),
    // 열린 문 안으로 한 걸음 들어서며 어두워진다(VQA r4: 문만 열고 서 있다가 암전).
    { kind: "moveEvent", eventId: "@player", route: { moves: [{ kind: "setThrough", enabled: true }, { kind: "move", dir: "up" }, { kind: "setThrough", enabled: false }], repeat: false, wait: false, skippable: true } } as unknown as Command,
    ...fadeOut(800),
    stopBgm(),
    ...caption("그날 오후는 계정 신청서와 회의와, 처음 듣는 줄임말로 지나갔다."),
    stage(S.ROOF),
    // 회사 문에서 편의점까지는 거리 맞은편 끝(60칸 남짓)이다 — 빈 밤길을 걷게 하지 않고 편의점 앞에서 연다(VQA r2).
    transfer(FL_MAP.streetPm, a.street.konbiniOut.x, a.street.konbiniOut.y, "down"),
  ]));
}

// ─────────────────────────────────────────────────────────────────────────────
// 월요일 밤 — 거리 · 편의점 · 회상(방송실)
// ─────────────────────────────────────────────────────────────────────────────
function buildMondayNight(project: Project, a: FirstLoveAnchors): void {
  const street = project.maps[FL_MAP.streetPm]!;
  const kon = project.maps[FL_MAP.konbini]!;
  const bc = project.maps[FL_MAP.broadcast]!;
  const k = a.konbini;

  add(street, scene("ev_fl_street_pm", { x: 1, y: 1 }, S.ROOF, [
    ...fadeIn(600),
    bgm(BGM_NIGHT),
    ...caption("오후 7시 48분."),
    ...think("첫날부터 야근은 아니었다. 거의.", "역으로 가는 길, 편의점 불빛이 환하다. 배가 고프다. 뭐라도 사 가자."),
    stage(S.EVENING),
  ]));
  add(street,
    door("ev_fl_konbini_pm", a.street.konbiniDoor, [stageIs(V_STAGE, S.EVENING)],
      [transfer(FL_MAP.konbini, k.doorOut.x, k.doorOut.y, "up")],
      think("오늘은 그만. 집에 가자."), "down"),
    door("ev_fl_office_pm", a.street.officeDoor, [stageIs(V_STAGE, 999)], [], think("오늘은 더는 못 한다. 머리가 꽉 찼다."), "down"),
    door("ev_fl_subway_pm", a.street.subway, [stageIs(V_STAGE, S.RUN)],
      // 계단은 승강장 위쪽 — 내려와 선 서하는 계단을 등지고 선로 쪽(아래)을 본다(아침 승강장과 같다).
      [transfer(FL_MAP.platformPm, a.platform.exitOut.x, a.platform.exitOut.y, "down")],
      think("편의점부터 들르자. 저녁을 안 먹었다."), "down"),
  );

  // 편의점: 점원 · 냉장고 · 문.
  const clerkSpot = nearestFree(project, kon, k.counter, 3, [k.doorOut]);
  const jihuEnter = k.doorOut;
  const coolerFront = { x: k.cooler.x, y: k.cooler.y + 1 };
  const jihuStop = nearestFree(project, kon, { x: k.cooler.x + 1, y: k.cooler.y + 1 }, 3, [k.cooler, clerkSpot, coolerFront]);
  // 계산대 손님 쪽(점원 두 칸 아래) — 계산은 거기 가서 한다(VQA r3: 매장 건너 10칸에서 점원과 말함).
  const registerFront = nearestFree(project, kon, { x: clerkSpot.x, y: clerkSpot.y + 2 }, 1, [clerkSpot, jihuStop, coolerFront]);
  // 지후는 계산대 바로 앞 줄이 아니라 서하 오른쪽 뒤 칸 — 계산대 위 소품(상층 그림)이 머리를 덮지 않는다(VQA r4 M1).
  const jihuRegister = nearestFree(project, kon, { x: registerFront.x + 1, y: registerFront.y + 1 }, 1, [clerkSpot, registerFront, jihuStop, coolerFront]);
  add(kon,
    event("ev_fl_clerk", "편의점 점원", clerkSpot, [page("c", [], [
      ...voice("점원", "어서 오세요~ 바나나우유 원 플러스 원이에요."),
      ...voice("점원", "요즘 그거 찾는 분 별로 없는데, 이 시간엔 꼭 하나씩 나가요. 신기하죠."),
      ...think("…이 동네에도, 금요일 점심을 기억하는 사람이 있나 보다."),
    ], { who: "clerk", dir: "down" })]),
    door("ev_fl_kon_door", k.door, [stageIs(V_STAGE, 999)], [], think("뭐라도 사서 나가자.")),
    event("ev_fl_jihu_kon", "강지후", jihuEnter, [page("jk", [swOn("sw_fl_jihu_in_konbini")], [], { who: "jihu", dir: "up" })]),
  );
  add(kon, scene("ev_fl_kon_enter", { x: 1, y: 1 }, S.EVENING, [
    ...say("clerk", "happy", "어서 오세요~"),
    ...think("(냉장고 쪽을 보자.)"),
    stage(S.KONBINI),
  ]));
  add(kon, event("ev_fl_cooler", "음료 냉장고", k.cooler, [
    page("cool", [stageIs(V_STAGE, S.KONBINI)], [
      ...think("바나나우유. 손이 먼저 간다.", "…아직도 이걸 고르네, 나."),
      playSe("cc0-se-orp-interface-interface2"),
      setSw("sw_fl_jihu_in_konbini", true),
      wait(400),
      walk("ev_fl_jihu_kon", path(jihuEnter, jihuStop, true)),
      // 주인공은 냉장고 앞(아래 칸)에 서 있다 — 냉장고 칸이 아니라 그 칸에서 지후 쪽으로 돈다.
      face("@player", dirToward(coolerFront, jihuStop)),
      faceHero("ev_fl_jihu_kon"),
      ...emote("player", "exclamation"),
      ...say("seoha", "surprised", "선임님?"),
      ...say("jihu", "embarrassed", "…퇴근길이에요. 여기 지나서 가거든요."),
      ifCond(swOn(SW_COFFEE), say("jihu", "happy", "…아, 점심 커피. 잘 마셨어요. 고맙다는 말을 못 해서.")),
      ifCond({ kind: "variable", variableId: V_JIHU, op: "<", value: 1 } as never, [
        ...emote("ev_fl_jihu_kon", "sweat"),
        // 「계산대 쪽으로 반 걸음 물러섰다」 — 계산대(오른쪽)로 돌아선다.
        face("ev_fl_jihu_kon", dirToward(jihuStop, clerkSpot)),
        ...think("그 사람은 계산대 쪽으로 반 걸음 물러섰다. 그냥 나가려는 걸까."),
      ]),
      faceHero("ev_fl_jihu_kon"),
      ...say("jihu", "base", "…아직 그거 마셔요?"),
      ifCond(swOn("sw_fl_admitted"),
        say("seoha", "base", "회사에선 모르는 사이라면서요. 그런 건 기억하시네요."),
        say("seoha", "base", "선임님은 기억 못 하시는 줄 알았는데요."),
      ),
      ...emote("ev_fl_jihu_kon", "sweat"),
      ...say("jihu", "sad", "…"),
      choices([
        { text: "(바나나우유 두 개를 계산한다)", then: [
          setSw(SW_MILK, true),
          // 둘이 계산대 앞까지 걸어가고, 점원은 계산하러 온 서하를 보고 묻는다.
          walkRoute(project, FL_MAP.konbini, "@player", coolerFront, registerFront, [jihuStop], true, dirToward(registerFront, clerkSpot)),
          walkRoute(project, FL_MAP.konbini, "ev_fl_jihu_kon", jihuStop, jihuRegister, [registerFront, coolerFront], true, dirToward(jihuRegister, registerFront)),
          waitMoves(),
          faceHero("ev_fl_clerk"),
          ...say("clerk", "happy", "원 플러스 원이라 두 개 맞으시죠?"),
          ...say("seoha", "happy", "네."),
          face("@player", dirToward(registerFront, jihuRegister)),
          listenTo("jihu"),
          ...say("seoha", "happy", "…선임님, 하나 드세요. 모르는 사이끼리도 우유 정도는 사 줄 수 있잖아요."),
          faceHero("ev_fl_jihu_kon"),
          ...say("jihu", "happy", "…그 논리, 좀 이상한데요."),
          ...say("jihu", "embarrassed", "잘 마실게요, 윤서하 씨."),
          ...like(2, "ev_fl_jihu_kon"),
        ] },
        { text: "(하나만 계산하고 가볍게 인사한다)", then: [
          ...say("seoha", "base", "먼저 들어가 보겠습니다. 내일 뵐게요."),
          ...say("jihu", "base", "…네. 조심히 들어가요."),
        ] },
      ]),
      ...think("윤서하 씨.", "10년 전, 그 사람이 내 이름을 처음 불렀던 곳은 방송실 앞이었다."),
      ...fadeOut(900),
      stopBgm(),
      setSw("sw_fl_flashback", true),
      // 화면은 이미 검다 — 옮기기 자체의 밝아짐을 끄고 회상 장면이 주인공(어른 서하)을 감춘 뒤에 밝힌다(VQA r5: 첫 칸에 어른 서하가 보였다).
      transfer(FL_MAP.broadcast, a.broadcast.start.x, a.broadcast.start.y, "up", "none"),
    ]),
    page("cool2", [stageAtLeast(V_STAGE, S.FLASH)], think("바나나우유. 오늘은 그냥 보기만 한다.")),
  ]));

  // ── 회상: 10년 전 방송실 ──
  const b = a.broadcast;
  // 두 사람은 복도 한 줄(사연함 줄)에 나란히 선다 — 아래 줄은 대사창에 가리고, 위아래로 서면 한 덩이로 겹쳐 보인다(VQA r1).
  // 서하는 방송실 문에서 내려오는 줄(x=11)의 왼쪽 칸에 서고, 지후는 그 줄을 따라 내려와 서하 오른쪽에 선다 —
  // 서하 머리 위로 지나가지 않고, 화면 자리(서하 왼쪽·지후 오른쪽)가 흉상 자리와 같다(VQA r4).
  const youngSeoha = nearestFree(project, bc, { x: b.mailbox.x - 3, y: b.mailbox.y }, 3, [b.start]);
  const youngJihuStop = nearestFree(project, bc, { x: youngSeoha.x + 1, y: youngSeoha.y }, 1, [youngSeoha, b.start, b.mailbox]);
  const youngJihu = b.booth;
  add(bc,
    event("ev_fl_y_seoha", "열일곱의 서하", youngSeoha, [page("ys", [], [], { who: "seohaYoung", dir: "up" })]),
    event("ev_fl_y_jihu", "열아홉의 지후", youngJihu, [page("yj", [swOff("sw_fl_jihu_gone")], [], { who: "jihuYoung", dir: "down" })]),
    event("ev_fl_mailbox", "사연함", b.mailbox, [page("mb", [], think("‘방송부 사연함 — 금요일 점심에 읽어 드립니다’"), {})]),
  );
  add(bc, event("ev_fl_flashback", "회상", { x: 1, y: 1 }, [page("fb", [swOn("sw_fl_flashback"), stageIs(V_STAGE, S.KONBINI)], [
    hidePlayer(),
    memoryTint(0),
    ...fadeIn(1200),
    { kind: "playAudio", resourceId: BGM_MEMORY, loop: true, channel: "bgm", fadeInMs: 1500 } as Command,
    ...caption("10년 전. 성하고등학교 방송실."),
    ...voice("교내 방송", "…오늘의 마지막 사연. 보낸 사람은, 바나나우유 님."),
    ...voice("교내 방송", "‘선배, 금요일마다 선배 목소리 들으려고 급식 줄을 일부러 늦게 서요. 이건 비밀이에요.’"),
    ...voice("교내 방송", "…바나나우유 님. 비밀은 지켜 드릴게요. 대신 다음 주에도 사연 보내 주세요. 오늘의 노래는, ‘여름의 끝에서’."),
    ...say("seohaYoung", "embarrassed", "…바보. 진짜 읽으면 어떡해."),
    walkRoute(project, FL_MAP.broadcast, "ev_fl_y_jihu", youngJihu, youngJihuStop, [youngSeoha], true, dirToward(youngJihuStop, youngSeoha)),
    face("ev_fl_y_seoha", dirToward(youngSeoha, youngJihuStop)),
    ...say("jihuYoung", "base", "어, 2학년. 방송실 앞에서 뭐 해?"),
    ...say("seohaYoung", "surprised", "아, 아니요! 그냥 지나가다가요!"),
    ...say("jihuYoung", "happy", "바나나우유 들고?"),
    ...emote("ev_fl_y_seoha", "sweat"),
    ...say("jihuYoung", "happy", "윤서하, 맞지? 2학년 3반."),
    ...say("seohaYoung", "surprised", "제 이름을 어떻게 알아요?"),
    ...say("jihuYoung", "happy", "사연함 앞에서 맨날 서성이는 애를 모를 수가 있나."),
    ...fadeOut(900),
    setSw("sw_fl_jihu_gone", true),
    ...caption("그해 겨울, 마지막 금요일."),
    ...fadeIn(900),
    walkRoute(project, FL_MAP.broadcast, "ev_fl_y_seoha", youngSeoha, nearestFree(project, bc, { x: b.mailbox.x - 1, y: b.mailbox.y }, 2, [b.mailbox, b.start])),
    face("ev_fl_y_seoha", "right"),
    ...think("처음으로, 진짜 이름을 썼다.", "‘바나나우유가 아니라, 윤서하가요. 선배를 좋아해요.’"),
    playSe(SE_PAPER),
    wait(800),
    ...caption("그날 점심 방송은 나가지 않았다.", "월요일, 선배의 자리는 비어 있었다. 전학이라고 했다. 인사도 없이."),
    ...fadeOut(1200),
    stopBgm(),
    setSw("sw_fl_flashback", false),
    clearTintKeepBlack(),
    showPlayer(),
    stage(S.FLASH),
    transfer(FL_MAP.officePm, a.office.heroDesk.x, a.office.heroDesk.y, "up"),
  ], { trigger: "auto" })]));
}

// ─────────────────────────────────────────────────────────────────────────────
// 수요일 밤 — 야근 · 실수 · 라면
// ─────────────────────────────────────────────────────────────────────────────
function buildWednesday(project: Project, a: FirstLoveAnchors): void {
  const off = project.maps[FL_MAP.officePm]!;
  const o = a.office;
  const taken: Cell[] = [o.heroDesk, o.jihuDesk, o.elevatorOut];
  const leadSeat = spot(project, FL_MAP.officePm, o.leadDesk, taken);
  const minhoStart = spot(project, FL_MAP.officePm, { x: o.heroDesk.x + 2, y: o.heroDesk.y }, taken);
  const jihuSeat = spot(project, FL_MAP.officePm, { x: o.heroDesk.x + 1, y: o.heroDesk.y - 2 }, taken);
  const jihuPantry = spot(project, FL_MAP.officePm, o.pantry, taken);
  // 「내 옆으로 와 모니터를 들여다봤다」(앉는 그림이 없어 의자 이야기는 뺐다, VQA r10) — 지후는 서하 왼쪽 옆 칸으로 와서 마주 본다(오른쪽 칸은 탕비실로 가는 길이 의자 칸을 지나 막힌다). 흉상 자리는 장면 내내 서하 왼쪽·지후 오른쪽으로 고정(VQA r16)(대사가 말하는 자리를 화면도 보인다).
  const jihuBeside = nearestFree(project, off, { x: o.heroDesk.x - 1, y: o.heroDesk.y }, 1, taken);
  taken.push(jihuBeside);
  // 정직 분기: 통화 중인 팀장에게 자리에서 소리쳐 말하지 않고, 팀장 책상 앞까지 걸어가서 말한다.
  // 팀장 책상 옆 칸(같은 줄 우선) — 위·아래 칸은 두 사람이 한 열로 쌓여 대화창에 가린다.
  const leadFront = [{ x: leadSeat.x - 1, y: leadSeat.y }, { x: leadSeat.x + 1, y: leadSeat.y }, { x: leadSeat.x, y: leadSeat.y + 1 }, { x: leadSeat.x, y: leadSeat.y - 1 }]
    .find((c) => isPassable(project, off, c.x, c.y) && !off.events.some((e) => e.x === c.x && e.y === c.y) && !taken.some((t) => t.x === c.x && t.y === c.y))
    ?? nearestFree(project, off, leadSeat, 2, taken);
  taken.push(leadFront);
  const comeBeside = (): Command[] => [
    walkRoute(project, FL_MAP.officePm, "ev_fl_w_jihu", jihuSeat, jihuBeside, [o.heroDesk], true, dirToward(jihuBeside, o.heroDesk)),
    face("@player", dirToward(o.heroDesk, jihuBeside)),
  ];
  const exit = { stand: { x: o.npcExit.x, y: o.npcExit.y + 1 }, door: o.npcExit };
  // 승강기 문(위 두 줄)이 화면 위에 잘리지 않게 퇴장 동안 카메라를 승강기 홀 쪽으로 올린다(VQA r8: 수요일 카메라가 승강기 윗부분을 자름).
  const liftView = { x: 13, y: 8 };
  const minhoOut = leave(project, FL_MAP.officePm, "ev_fl_w_minho", minhoStart, exit, "sw_fl_minho_left", o.heroDesk, [], liftView);
  const leadOut = leave(project, FL_MAP.officePm, "ev_fl_w_lead", leadSeat, exit, "sw_fl_lead_left", o.heroDesk, [jihuBeside], liftView);

  add(off,
    event("ev_fl_w_lead", "오정민 팀장", leadSeat, [
      page("wl", [stageIs(V_STAGE, S.FLASH), swOff("sw_fl_lead_left")], [...say("lead", "base", "…네, 본부장님. 네. 내일 오전에요.")], { who: "lead", dir: "down" }),
    ]),
    event("ev_fl_w_minho", "차민호", minhoStart, [page("wm", [swOff("sw_fl_minho_left")], [], { who: "minho", dir: "left" })]),
    event("ev_fl_w_jihu", "강지후", jihuSeat, [
      page("wj", [stageIs(V_STAGE, S.FLASH)], [], { who: "jihu", dir: "down" }),
    ]),
    // 빈 자리는 따로 — 지후는 탕비실로 걸어가고(같은 이벤트가 위치를 들고 간다), 의자는 제자리에 남는다.
    event("ev_fl_w_chair", "강지후 자리", jihuSeat, [
      page("wj_empty", [stageIs(V_STAGE, S.WED)], think(
        "빈 의자 등받이에 회색 후드가 걸려 있다. 모니터에는 ‘하루끝’ 관리자 화면.",
        "오늘의 사연 대기열 맨 위에 ‘보낸 사람: 익명’. …사연은, 아직도 누군가 보내는구나.",
      ), {}),
    ]),
    event("ev_fl_w_jihu_pantry", "강지후", jihuPantry, [
      page("wjp", [stageIs(V_STAGE, S.WED)], [
        ...sideBySide(project, FL_MAP.officePm, "ev_fl_w_jihu_pantry", jihuPantry),
        ...say("jihu", "base", "물 부었어요. 3분."),
        ...say("seoha", "base", "회사에서 이렇게 늦게까지 있는 거, 자주 해요?"),
        ...say("jihu", "base", "발표 주간엔요. …그리고 이번이 마지막이라."),
        ...say("seoha", "surprised", "마지막이요?"),
        ...emote("ev_fl_w_jihu_pantry", "ellipsis"),
        ...say("jihu", "sad", "…발표 끝나고 얘기할게요."),
        choices([
          { text: "“그때, 왜 말없이 갔어요?”", then: [
            ...say("seoha", "sad", "그때. 왜 말없이 갔어요?"),
            ifCond({ kind: "variable", variableId: V_JIHU, op: ">=", value: 3 } as never, [
              setSw(SW_KNOWS_WHY, true),
              ...say("jihu", "sad", "…아버지 가게가 망했어요. 하룻밤 사이에 이사했고, 휴대폰도 끊겼어요."),
              ...say("jihu", "sad", "인사하러 가려고 했는데, 뭐라고 해야 할지 몰랐어요. 열아홉이었으니까."),
              ...say("seoha", "sad", "…10년이에요."),
              ...say("jihu", "base", "알아요. 그래서 더 못 했어요. 시간이 갈수록, 미안하다는 말이 점점 작아 보여서."),
              ...like(2, "ev_fl_w_jihu_pantry"),
            ], [
              ...say("jihu", "base", "…그 얘기는 금요일 지나고 해요. 지금 하면, 발표 망칠 것 같아요."),
              ...think("또 미뤘다. 그래도 이번엔, 미룬다는 걸 말로 해 줬다."),
            ]),
          ] },
          { text: "“발표 끝나고 들을게요. 대신 꼭 해 줘요.”", then: [
            ...say("seoha", "base", "발표 끝나고 들을게요. 대신 꼭 해 줘요. 이번엔."),
            ...say("jihu", "happy", "…약속해요."),
            ...like(1, "ev_fl_w_jihu_pantry"),
          ] },
        ]),
        ...say("jihu", "embarrassed", "아, 라면 불겠다."),
        ...think("둘이 컵라면을 먹었다. 10년 전 매점 앞 벤치처럼. 그 사람은 여전히 국물부터 마셨다."),
        ...fadeOut(900),
        stopBgm(),
        ...caption("그리고, 금요일."),
        stage(S.WED_TALK),
        transfer(FL_MAP.officeFri, a.office.meetingSeat.x, a.office.meetingSeat.y, "left"),
      ], { who: "jihu", dir: "up" }),
    ]),
  );

  // 지후 책상의 수첩(선택 탐색).
  add(off, event("ev_fl_notebook", "강지후의 책상", o.jihuDesk, [
    page("nb", [stageIs(V_STAGE, S.WED), swOff(SW_SAW_LETTER), swOff("sw_fl_closed_note")], [
      ...think("강지후의 수첩. 펼쳐진 페이지 사이로 오래된 편지지 귀퉁이가 삐져나와 있다.", "연두색 편지지. …설마."),
      choices([
        { text: "(조금만 펼쳐 본다)", then: [
          setSw(SW_SAW_LETTER, true),
          playSe(SE_PAPER),
          ...think("‘바나나우유가 아니라, 윤서하가요.’", "…내 글씨다. 열일곱 살의, 꾹꾹 눌러 쓴 내 글씨."),
          ...think("방송은 나가지 않았다. 그런데 편지는, 여기 있다."),
        ] },
        { text: "(덮어 둔다. 남의 수첩이다)", then: [
          setSw("sw_fl_closed_note", true),
          ...think("수첩을 덮었다. 궁금한 건, 직접 듣고 싶었다."),
          ...like(1),
        ] },
      ]),
    ]),
    page("nb2", [stageIs(V_STAGE, S.WED), swOn(SW_SAW_LETTER)], think("수첩은 다시 덮어 두었다. 손끝이 아직 떨린다.")),
    page("nb3", [stageIs(V_STAGE, S.WED), swOn("sw_fl_closed_note")], think("덮어 둔 수첩. 그대로 둔다.")),
  ]));
  add(off,
    door("ev_fl_w_elev2", o.npcExit, [stageIs(V_STAGE, 999)], [], think("지후 선배가 아직 탕비실에 있다. 이대로 가면… 안 될 것 같다."), "down"),
    door("ev_fl_w_elev", o.elevator, [stageIs(V_STAGE, 999)], [], think("지후 선배가 아직 탕비실에 있다. 이대로 가면… 안 될 것 같다."), "down"),
    door("ev_fl_w_stairs", o.stairs, [stageIs(V_STAGE, 999)], [], think("옥상 문은 밤엔 잠겨 있다.")),
    event("ev_fl_w_desk", "서하 자리", { x: o.heroDesk.x, y: o.heroDesk.y - 1 }, [
      page("wd", [stageIs(V_STAGE, S.WED)], think("다시 보낸 최종본. 파일 이름: ‘하루끝_리뉴얼_최종_진짜최종_서하’.", "…이름은 다음 주에 정리하자.")),
    ]),
  );

  add(off, scene("ev_fl_wed", { x: 1, y: 1 }, S.FLASH, [
    ...fadeIn(800),
    bgm(BGM_NIGHT),
    ...caption("수요일 오후 8시 3분."),
    faceHero("ev_fl_w_minho"),
    ...say("minho", "happy", "서하 씨, 나 먼저 가요! 내일 봐요—"),
    minhoOut.begin,
    ...minhoOut.end,
    playSe(SE_MAIL),
    ...emote("player", "exclamation"),
    ...think("메일. ‘소리결’ 박 본부장님."),
    ...voice("메일", "‘윤서하 님, 보내 주신 시안이 수정 전 버전인 것 같습니다. 내일 오전 임원 보고에 써야 해서요.’"),
    shake(400),
    ...say("seoha", "surprised", "…어? 잠깐만. 최종본 보낸 거, 아니었어?"),
    ...think("폴더 이름이 ‘최종’, ‘최종_진짜’, ‘최종_진짜_수정’.", "내가 보낸 건 ‘최종’이었다."),
    ...think("팀장님은 저쪽에서 통화 중이다. 지후 선배는 아직 자리에 있다."),
    choices([
      { text: "팀장님께 바로 말씀드린다", then: [
        setSw(SW_HONEST, true),
        { kind: "changeFriendship", npcKey: "lead", delta: 220 } as Command,
        // 팀장 책상 앞까지 걸어가 말하고, 팀장도 통화를 멈추고 서하를 본다.
        walkRoute(project, FL_MAP.officePm, "@player", o.heroDesk, leadFront, [], true, dirToward(leadFront, leadSeat)),
        faceHero("ev_fl_w_lead"),
        ...say("seoha", "sad", "팀장님. 제가 소리결에 시안을 잘못 보냈습니다. 지난주 버전으로요."),
        ...say("lead", "base", "…몇 시에 보냈어요?"),
        ...say("seoha", "sad", "여섯 시 반쯤이요. 죄송합니다."),
        ...say("lead", "happy", "좋아요. 숨기지 않고 바로 말해 줘서 다행이에요. 본부장님한텐 내가 지금 전화할게요."),
        ...say("lead", "base", "서하 씨는 최종본 다시 정리하고."),
        face("ev_fl_w_lead", dirToward(leadSeat, jihuSeat)),
        face("ev_fl_w_jihu", dirToward(jihuSeat, leadSeat)),
        ...say("lead", "base", "지후 씨, 서하 씨 좀 도와줄래요?"),
        // 지후는 열 칸 밖 자리에 있다 — 멀리서 「네.」로 대답하지 않고 일어나 오는 걸음으로 대답한다(사용자 r2: 너무 멀리서 대화).
        // 팀장의 작별 인사도 서하가 팀장 앞에 서 있을 때 한다.
        face("ev_fl_w_lead", dirToward(leadSeat, leadFront)),
        ...say("lead", "base", "본부장님 전화는 가면서 할게요. 둘 다 너무 늦지 말아요."),
        walkRoute(project, FL_MAP.officePm, "@player", leadFront, o.heroDesk, [jihuBeside]),
        ...comeBeside(),
        ...think("지후 선배가 내 옆으로 와 모니터를 들여다봤다. 아주 잠깐, 웃은 것 같았다."),
        ...like(1, "ev_fl_w_jihu"),
        // 팀장은 화면 안에서 걸어 나간다 — 시간 건너뛰기(반쯤 어두운 화면)에 자리에서 사라지지 않는다(VQA r12).
        leadOut.begin,
        ...leadOut.end,
      ] },
      { text: "지후 선배에게만 조용히 도움을 청한다", then: [
        face("@player", dirToward(o.heroDesk, jihuSeat)),
        faceHero("ev_fl_w_jihu"),
        ...say("seoha", "sad", "선임님… 저 실수했어요. 시안을 잘못 보냈어요. 팀장님 아시기 전에, 어떻게 좀…"),
        ...say("jihu", "base", "…같이 고쳐요."),
        ...comeBeside(),
        ...say("jihu", "base", "근데 서하 씨. 숨기는 거, 생각보다 오래 무거워요. 나중에 꼭 말씀드려요."),
        ...think("그 말이 이상하게 오래 남았다."),
        faceHero("ev_fl_w_lead"),
        ...say("lead", "base", "둘 다 너무 늦게까지 있지 말아요. 먼저 갈게요."),
        leadOut.begin,
        ...like(1, "ev_fl_w_jihu"),
        ...leadOut.end,
      ] },
    ]),
    ...fadeOut(700),
    // 정직 분기의 팀장은 통화를 마치고 시간이 건너뛰는 동안(화면 검정) 퇴근한다 — 보이는 데서 사라지지 않는다.
    setSw("sw_fl_lead_left", true),
    ...caption("밤 10시 40분."),
    ...fadeIn(700),
    ...say("jihu", "base", "다 됐어요. 다시 보냈고, 본부장님 답장도 왔어요. ‘확인했습니다, 감사합니다.’"),
    ...say("seoha", "happy", "…감사합니다. 진짜로요."),
    ...say("jihu", "base", "서하 씨 시안, 좋았어요. 버튼 누르면 사연 종이가 반으로 접히는 거."),
    choices([
      { text: "“선배라면 알아볼 줄 알았어요.”", then: [
        ...say("seoha", "embarrassed", "…선배라면 알아볼 줄 알았어요. 방송실 사연함 모양이에요, 그거."),
        ...emote("ev_fl_w_jihu", "exclamation", 900),
        ...say("jihu", "embarrassed", "…역시. 어디서 본 것 같더라. 투입구가 비뚤어진 것까지."),
        ...like(1, "ev_fl_w_jihu"),
      ] },
      { text: "“그냥, 회사 앱이니까요.”", then: [
        ...say("seoha", "base", "그냥, 회사 앱이니까요. 열심히 했을 뿐이에요."),
        ...say("jihu", "base", "…그렇죠."),
        ...think("거짓말이다. 사연 종이가 접히는 그 버튼은, 그 방송실에서 가져온 거였다."),
      ] },
    ]),
    ifCond({ kind: "variable", variableId: V_JIHU, op: ">=", value: 3 } as never,
      say("jihu", "happy", "라면 먹을래요? 탕비실에 컵라면 있어요. 먼저 가 있을게요. …오늘은 도망 안 가요."),
      say("jihu", "base", "…배고프면 탕비실에 컵라면 있어요. 물은 내가 올려 둘게요."),
    ),
    walkRoute(project, FL_MAP.officePm, "ev_fl_w_jihu", jihuBeside, jihuPantry, [o.heroDesk], false, "up"),
    ...think("(탕비실로 가자.)"),
    waitMoves(),
    stage(S.WED),
  ]));
}

// ─────────────────────────────────────────────────────────────────────────────
// 금요일 — 발표 · 발령 · 막차
// ─────────────────────────────────────────────────────────────────────────────
function buildFriday(project: Project, a: FirstLoveAnchors): void {
  const fri = project.maps[FL_MAP.officeFri]!;
  const o = a.office;
  // 탁자 둘레(meetSeats): [0]=주인공(동쪽 끝) [1]=지후(주인공 오른쪽 옆 — 발표자 둘이 나란히) [2]=민호(탁자 북서 모서리 바닥) [3]=팀장(서쪽 끝) [4]=본부장(탁자 북동 모서리 바닥 — 먼저 나가는 손님이 바로 옆 유리문으로 나간다).
  // 의자 칸에는 세우지 않는다: 의자는 upper 타일이라 등받이가 얼굴을 덮고(VQA r7), 남쪽 의자 줄은 맵 맨 아래라 대화창에 가린다(VQA r5).
  const seats = o.meetSeats;
  const jihuSpot = seats[1]!; const clientSpot = seats[4]!; const leadSpot = seats[3]!; const minhoSpot = seats[2]!;
  // 손님·지후는 두 번째 엘리베이터(주인공이 내린 칸이 아닌 문)로 나간다 — 엘리베이터 문 바로 앞에서 사라진다.
  const exit = { stand: { x: o.npcExit.x, y: o.npcExit.y + 1 }, door: o.npcExit };
  // 회의실에서는 승강기가 화면 밖이다 — 탑승하는 동안 카메라가 승강기 쪽으로 올라갔다가 돌아온다.
  const elevatorView = { x: 13, y: 8 };
  // 회의 장면 카메라: 회의실이 화면 위쪽(흉상 머리 위)에 오게 맵 아래 덧댄 줄 쪽으로 내려 잡는다(VQA r10 금요일 회의가 화면 아래 구석).
  const meetView = { x: 13, y: 19 };
  // 본부장은 발표자 바로 앞(아래) 칸을 스치지 않고 탁자 동쪽으로 돌아 나간다(VQA r15: 서하·지후 하반신에 겹침).
  const presenterFront = [{ x: o.meetingSeat.x, y: o.meetingSeat.y + 1 }, { x: jihuSpot.x, y: jihuSpot.y + 1 }];
  const clientOut = leave(project, FL_MAP.officeFri, "ev_fl_f_client", clientSpot, exit, "sw_fl_client_left", o.meetingSeat, [jihuSpot, ...presenterFront], elevatorView, meetView);
  const jihuOut = leave(project, FL_MAP.officeFri, "ev_fl_f_jihu", jihuSpot, exit, "sw_fl_jihu_left", o.meetingSeat, [], elevatorView, meetView);
  add(fri,
    event("ev_fl_f_client", "박 본부장", clientSpot, [page("fc", [swOff("sw_fl_client_left")], [], { who: "client", dir: "down" })]),
    event("ev_fl_f_lead", "오정민 팀장", leadSpot, [page("fl", [], [], { who: "lead", dir: "right" })]),
    event("ev_fl_f_jihu", "강지후", jihuSpot, [page("fj", [swOff("sw_fl_jihu_left")], [], { who: "jihu", dir: "left" })]),
    event("ev_fl_f_minho", "차민호", minhoSpot, [page("fm", [], [], { who: "minho", dir: dirToward(minhoSpot, leadSpot) })]),
    door("ev_fl_f_elev2", o.npcExit, [stageIs(V_STAGE, 999)], [], think("…"), "down"),
  );
  add(fri, scene("ev_fl_fri", { x: 1, y: 1 }, S.WED_TALK, [
    panTo(meetView.x, meetView.y, 0),
    ...fadeIn(800),
    bgm(BGM_OFFICE),
    ...caption("금요일 오후 3시. 회의실."),
    ...sayAt("lead", "left", "base", "지후 씨, 본부장님 앞인데 오늘도 후드예요?"),
    ...say("jihu", "embarrassed", "…재킷은 가방에 있어요. 이게 머리가 더 잘 돌아가서요."),
    ...emote("ev_fl_f_minho", "sweat"),
    // 탁자 머리의 본부장이 말을 열면 발표자 둘(서하·지후)이 그쪽을 본다.
    face("@player", dirToward(o.meetingSeat, clientSpot)),
    face("ev_fl_f_jihu", dirToward(jihuSpot, clientSpot)),
    face("ev_fl_f_client", dirToward(clientSpot, o.meetingSeat)),
    // 민호는 본부장 옆자리 — 팀장의 농담(서쪽) 뒤엔 본부장·발표자 쪽(동쪽)을 본다.
    face("ev_fl_f_minho", dirToward(minhoSpot, clientSpot)),
    ...sayAt("client", "left", "base", "그럼 시작하시죠. 이번 리뉴얼, 핵심이 뭡니까?"),
    ...say("jihu", "base", "재생 엔진을 새로 짜서, 하루끝 방송이 1초 안에 시작됩니다. 그리고 화면은—"),
    // 발표를 넘길 땐 옆자리 서하를 본다(왼쪽 고정이면 본부장에게 서하를 소개하는 꼴).
    face("ev_fl_f_jihu", dirToward(jihuSpot, o.meetingSeat)),
    face("@player", dirToward(o.meetingSeat, jihuSpot)),
    ...say("jihu", "happy", "윤서하 디자이너가 설명드리겠습니다."),
    ...think("숨을 한 번 고른다."),
    // 발표는 손님(본부장)을 보고 한다.
    face("@player", dirToward(o.meetingSeat, clientSpot)),
    choices([
      { text: "내 이야기로 시작한다", then: [
        setSw(SW_STORY, true),
        ...sayAt("seoha", "right", "base", "고등학교 때, 방송부 점심 방송에 매주 사연을 보냈어요. 익명으로요."),
        ...sayAt("seoha", "right", "sad", "마지막 사연은 끝내 방송되지 못했어요. 그 사람이 먼저 떠났거든요."),
        ...sayAt("seoha", "right", "base", "그래서 이걸 만들었습니다. ‘늦은 답장’. 지난 사연에, 언제든 답장을 보낼 수 있는 기능입니다."),
        ...emote("ev_fl_f_jihu", "exclamation", 1300),
        ...sayAt("client", "left", "base", "…"),
        ...sayAt("client", "left", "happy", "좋네요. 라디오가 원래 그런 거죠. 늦게라도, 닿는 거."),
        ...like(2, "ev_fl_f_jihu"),
      ] },
      { text: "데이터로 설명한다", then: [
        ...sayAt("seoha", "right", "base", "사연을 들은 사람의 63%가 일주일 안에 같은 방송을 다시 찾습니다. 하지만 지금은 답할 방법이 없어요."),
        ...sayAt("seoha", "right", "base", "그래서 ‘늦은 답장’을 넣었습니다. 지난 사연에 언제든 답장을 보낼 수 있는 기능입니다."),
        ...sayAt("client", "left", "happy", "숫자가 탄탄하네요. 좋습니다. 이대로 가시죠."),
      ] },
    ]),
    ...sayAt("lead", "left", "happy", "그럼 다음 주부터 2차 개발 들어가겠습니다. 감사합니다, 본부장님."),
    clientOut.begin,
    face("@player", dirToward(o.meetingSeat, minhoSpot)),
    face("ev_fl_f_minho", dirToward(minhoSpot, o.meetingSeat)),
    ...sayAt("minho", "left", "happy", "대박! 서하 씨, 첫 주에 발표 통과! 오늘 회식 각이에요!"),
    ...clientOut.end,
    face("@player", dirToward(o.meetingSeat, leadSpot)),
    ifCond(swOff(SW_HONEST), [
      ...sayAt("lead", "left", "base", "서하 씨. 수요일 일, 본부장님한테 들었어요."),
      ...sayAt("seoha", "right", "sad", "…죄송합니다."),
      ...sayAt("lead", "left", "base", "실수는 괜찮아요. 다음엔 나한테 먼저 말해요. 그게 팀이에요."),
    ], [
      ...sayAt("lead", "left", "happy", "서하 씨, 수요일에 바로 말해 준 거. 그거 잘한 거예요. 그게 팀이에요."),
    ]),
    face("@player", dirToward(o.meetingSeat, jihuSpot)),
    ...say("jihu", "base", "…먼저 일어나 보겠습니다. 수고하셨습니다."),
    jihuOut.begin,
    stopBgm(),
    face("@player", dirToward(o.meetingSeat, leadSpot)),
    ...sayAt("lead", "left", "base", "그리고… 다들 알다시피, 오늘이 지후 씨 마지막 날이에요."),
    ...emote("player", "exclamation"),
    ...sayAt("seoha", "right", "surprised", "…네?"),
    bgm(BGM_MEMORY, 2000),
    ...sayAt("lead", "left", "base", "다음 주부터 부산 지사예요. 아버님 곁에 있고 싶다고 몇 달 전에 신청했었죠."),
    face("@player", dirToward(o.meetingSeat, minhoSpot)),
    ...sayAt("minho", "left", "base", "회식이 송별회 겸인데… 선임님은 오늘 밤 서울역에서 부산 가는 마지막 KTX 탄대요. 한결역에서 9시 40분 열차를 타야 맞춘다고요. 짐은 아침에 벌써 다 부치셨고요."),
    ...jihuOut.end,
    ...sayAt("lead", "left", "sad", "인사는… 따로 못 했나 보네요."),
    ...think("또.", "또, 인사도 없이."),
    ifCond({ kind: "variable", variableId: V_JIHU, op: ">=", value: TRUE_END_AT } as never, [
      playSe(SE_PAPER),
      ...think("…책상 모서리에 노란 포스트잇이 붙어 있었다. 낯익은, 비스듬한 글씨.", "‘21:40, 한결역 서울역행. 인사는 거기서 할게요. 이번엔 진짜로.’"),
    ]),
    ifCond(swOn(SW_TOLD_MINHO),
      sayAt("minho", "left", "base", "서하 씨. …가요. 이번엔 붙잡아요. 회식은 내가 알아서 할게요."),
      sayAt("minho", "left", "base", "서하 씨, 회식 가죠? …근데 표정이 왜 그래요."),
    ),
    choices([
      { text: "역으로 간다", then: [
        ...sayAt("seoha", "right", "base", "죄송해요, 먼저 가 볼게요!"),
        // 자리에서 사라지지 않고 유리문 쪽으로 뛰어가며 화면이 어두워진다(VQA r12).
        walkRoute(project, FL_MAP.officeFri, "@player", o.meetingSeat, o.meeting, [leadSpot, minhoSpot], false),
        wait(500),
        ...fadeOut(600),
        stopBgm(),
        stage(S.FRI),
        transfer(FL_MAP.streetPm, a.street.officeOut.x, a.street.officeOut.y, "down"),
      ] },
      { text: "회식에 간다", then: [
        ...think("발을 떼지 못했다. 10년 전에도, 오늘도."),
        ...sayAt("minho", "left", "happy", "좋아요! 오늘은 내가 쏩니다. …아, 법카로요."),
        ...sayAt("lead", "left", "happy", "민호 씨."),
        ...emote("ev_fl_f_minho", "sweat"),
        face("@player", dirToward(o.meetingSeat, leadSpot)),
        ...sayAt("lead", "left", "base", "서하 씨, 첫 주 수고했어요. 가요, 다 같이."),
        // 엔딩 C 의 비(VQA r8: 「비가 오기 시작했다」는 말뿐 비가 없다) — 검은 화면에서 빌딩 앞 밤거리로 옮기고, 비는 거기 장면이 내린다.
        // 실내에 비를 뿌리지 않는다. 옮긴 뒤의 명령은 이 맵 이벤트에서 돌지 않으므로 이어지는 연출은 밤거리의 ev_fl_dinner_rain 이 한다.
        ...fadeOut(700),
        stage(S.DINNER),
        transfer(FL_MAP.streetPm, a.street.officeOut.x, a.street.officeOut.y, "down", "none"),
      ] },
    ]),
  ]));
  add(fri,
    door("ev_fl_f_elev", o.elevator, [stageIs(V_STAGE, 999)], [], think("…"), "down"),
  );
}

function buildClimax(project: Project, a: FirstLoveAnchors): void {
  const street = project.maps[FL_MAP.streetPm]!;
  const plat = project.maps[FL_MAP.platformPm]!;
  const p = a.platform;

  add(street, scene("ev_fl_dinner_rain", { x: 3, y: 1 }, S.DINNER, [
    // 앞 맵에서 옮긴 카메라 좌표가 남아 빈 길을 비췄다(VQA r11) — 화면이 검을 때 서하에게 돌려 둔다.
    panBack(0),
    { kind: "setWeather", weather: "rain", intensity: 0.6, transitionMs: 0 } as Command,
    bgm(BGM_RAIN, 1200),
    ...fadeIn(700),
    ...think("회사 앞, 비가 오기 시작했다. 9시 40분까지, 아직 시간은 있었다.", "…있었는데."),
    // 에필로그는 비 오는 회사 앞(서하가 보이는 화면) 위로 흐른다 — 연인 그림(낮 카페)은 그를 놓친 밤과 맞지 않았다(VQA r11).
    stopBgm(),
    stage(S.PLATFORM + 100),
    { kind: "triggerEnding", endingId: END_C } as Command,
  ]));
  add(street, scene("ev_fl_run", { x: 2, y: 1 }, S.FRI, [
    panBack(0),
    // 밤거리 맵 BGM(라운지 피아노)이 질주에 깔리지 않게 — 화면이 검을 때 끊고, 비와 함께 단조 바이올린이 들어온다(r4 「비 오는 밤 쓸쓸하게」).
    stopBgm(),
    ...fadeIn(500),
    { kind: "setWeather", weather: "rain", intensity: 0.6, transitionMs: 800 } as Command,
    bgm(BGM_RAIN, 1500),
    ...caption("오후 9시 21분. 9시 40분 열차까지 19분."),
    ...think("뛰자.", "(지하철 입구로!)"),
    stage(S.RUN),
  ]));

  const jihuSpot = p.jihu;
  // 열차를 기다리는 사람은 선로(아래)를 본다 — 벽을 보고 서 있지 않는다.
  add(plat, event("ev_fl_p_jihu", "강지후", jihuSpot, [page("pj", [swOff("sw_fl_jihu_boarded")], [], { who: "jihu", dir: "down" })]));
  const meet = { x: jihuSpot.x - 1, y: jihuSpot.y };
  add(plat, scene("ev_fl_platform", { x: 1, y: 1 }, S.RUN, [
    { kind: "setWeather", weather: "none", transitionMs: 0 } as Command,
    ...voice("안내 방송", "‘이번 열차는 서울역행입니다. 열차가 곧 도착하오니—’"),
    // 밤엔 계단으로 뛰어 내려온다 — 계단 발치에 도착해 지후에게 걸어간다(VQA r10: 승강장 한가운데에 서서 나타남).
    walk("@player", route(project, FL_MAP.platformPm, p.exitOut, meet)),
    face("@player", "right"),
    face("ev_fl_p_jihu", "left"),
    ...emote("ev_fl_p_jihu", "exclamation", 1300),
    ...say("jihu", "surprised", "…서하야?"),
    ...think("처음이다. 회사에서 만나고, ‘씨’를 떼고 부른 건."),
    ...say("seoha", "sad", "또… 인사도 없이 가려고 했죠."),
    ...say("jihu", "sad", "…인사하면, 못 갈 것 같아서."),
    { kind: "playAudio", resourceId: BGM_CONFESS, loop: true, channel: "bgm", fadeInMs: 2000 } as Command,
    ifCond(swOn(SW_SAW_LETTER),
      say("seoha", "sad", "수요일에, 선배 수첩 봤어요. 미안해요. …연두색 편지지."),
      say("seoha", "base", "선배. 하나만 물어볼게요. 그 금요일, 사연함에 있던 편지. 읽었어요?"),
    ),
    ...say("jihu", "base", "…"),
    playSe(SE_PAPER),
    ...say("jihu", "sad", "10년 전 마지막 금요일. 사연함에 이게 있었어요. 처음으로 이름이 적힌 사연."),
    ...say("jihu", "sad", "그날 밤, 불 꺼진 방송실에서 혼자 읽었어요. 방송으로는… 못 읽었어요. 다음 날 이사 가야 했으니까."),
    ifCond(swOn(SW_KNOWS_WHY),
      say("jihu", "base", "수요일에 다 말 못 한 거. 이거였어요. 답장을 못 한 사연이라, 버릴 수가 없었어요."),
      say("jihu", "base", "그래서 계속 갖고 있었어요. 답장 못 한 사연이라, 버릴 수가 없었어요."),
    ),
    ifCond(swOn(SW_STORY), say("jihu", "embarrassed", "…발표 때 그 얘기 할 줄은 몰랐어요. 본부장님 앞에서 우는 줄 알았어요.")),
    ...voice("안내 방송", "‘열차가 들어오고 있습니다. 안전선 뒤로 한 걸음 물러서 주십시오.’"),
    shake(600),
    choices([
      { text: "“이번엔, 내가 먼저 말할게요.”", then: [
        ifCond({ kind: "variable", variableId: V_JIHU, op: ">=", value: TRUE_END_AT } as never, [
          ...say("seoha", "base", "이번엔 내가 먼저 말할게요."),
          ...say("seoha", "embarrassed", "선배. 나 아직도, 금요일마다 급식 줄 늦게 서는 사람이에요."),
          ...say("jihu", "embarrassed", "…그건, 내 대사였어야 하는데."),
          flash("white", 700),
          ...memoryPictureIn(255, 1800),
          ...say("jihu", "happy", "윤서하. 10년 늦은 답장이에요.", "나도 좋아했어. 그 금요일에도. 지금도."),
          ...memoryPictureOut(1600),
          ...emote("ev_fl_p_jihu", "heart", 1600),
          memoryPictureErase(),
          ...say("jihu", "base", "부산은 가야 해요. 아버지 혼자 계시니까. 근데—"),
          ...say("jihu", "happy", "KTX로 두 시간 사십 분이에요. 금요일마다 올게요. 이번엔, 진짜 약속해요."),
          ...say("seoha", "happy", "…늦으면, 사연 보낼 거예요. 하루끝에. 실명으로."),
          ...fadeOut(1200),
          stopBgm(),
          ...endingOpen("oprn-title-romance-office"),
          { kind: "triggerEnding", endingId: END_A } as Command,
        ], [
          ...memoryPictureIn(255, 1600),
          ...say("seoha", "sad", "좋아했어요. 그 금요일에도. 지금도."),
          ...memoryPictureOut(1400),
          ...say("jihu", "sad", "…고마워요. 정말로."),
          memoryPictureErase(),
          ...say("jihu", "sad", "근데 지금 대답하면, 그건 또 도망치는 대답 같아요. 떠나는 사람이 할 말이 아니라서."),
          ...say("jihu", "base", "답장은 여기 써 뒀어요. 열차 떠나면 읽어요."),
          playSe(SE_PAPER),
          // 지후는 제자리에서 선로(열차) 쪽으로 돌아선다 — 자동 운행 열차는 멈춤·출발을 장면이 정할 수 없어 걸어 들어가면 움직이는 열차로 들어간다(VQA r15·r16). 떠나는 건 검은 화면 뒤다.
          face("ev_fl_p_jihu", "down"),
          wait(900),
          ...fadeOut(1200),
          setSw("sw_fl_jihu_boarded", true),
          stopBgm(),
          ...endingOpenNight(),
          { kind: "triggerEnding", endingId: END_B } as Command,
        ]),
      ] },
      { text: "“…잘 가요, 선배.”", then: [
        ...say("seoha", "sad", "…잘 가요, 선배. 이번엔 인사했어요."),
        ...say("jihu", "sad", "…응. 잘 지내, 서하야."),
        ...say("jihu", "base", "이거. 답장이에요. 10년 늦었지만."),
        playSe(SE_PAPER),
        // 지후는 제자리에서 선로(열차) 쪽으로 돌아선다 — 자동 운행 열차는 멈춤·출발을 장면이 정할 수 없어 걸어 들어가면 움직이는 열차로 들어간다(VQA r15·r16). 떠나는 건 검은 화면 뒤다.
        face("ev_fl_p_jihu", "down"),
        wait(900),
        ...fadeOut(1200),
        setSw("sw_fl_jihu_boarded", true),
        stopBgm(),
        ...endingOpenNight(),
          { kind: "triggerEnding", endingId: END_B } as Command,
      ] },
    ]),
  ]));
}

/**
 * 엔딩 직전 — 검게 덮은(fadeOut) 화면에서 에필로그 그림을 먼저 깔고 덮개를 걷는다. 엔딩의 에필로그 그림은 페이드의 검은 색조 아래에
 * 그려져 글이 검은 화면에 떴다(VQA r10). 같은 그림·자리(fl_epilogue)라 에필로그의 그림 명령은 그대로 이어진다.
 */
/** 엔딩 B — 열차가 떠난 뒤 지상으로 올라와 본 밤하늘(320×256 파노라마를 화면 가득). */
function endingOpenNight(): Command[] {
  return [
    { kind: "showPicture", pictureId: "fl_epilogue", resourceId: "oprn-pano-night", x: 0, y: -8, scale: 150, opacity: 255, waitForPicture: false } as Command,
    ...fadeIn(900),
  ];
}
function endingOpen(resourceId: string): Command[] {
  return [
    { kind: "showPicture", pictureId: "fl_epilogue", resourceId, x: -4, y: -3, scale: 29, opacity: 255, waitForPicture: false } as Command,
    ...fadeIn(900),
  ];
}

/** 에필로그를 검은 화면에 글만 늘어놓지 않는다(VQA2) — 앱에 든 연애 그림을 화면 가득 깔고 그 위로 아래 대사창. */
const epiloguePicture = (resourceId: string, opacity = 255) => ({ kind: "picture", action: "show", pictureId: "fl_epilogue", resourceId, x: -4, y: -3, scale: 29, opacity, durationMs: 1400 });
const ENDING_CREDITS = [
  "『첫사랑』",
  "",
  "이야기 · 연출   OPRN Flagship Studio",
  "인물   OPRN 공용 흉상 · 걷기 칩",
  "장소   jp_city · modern_city 손 도트",
  "음악   CC0 BGM 카탈로그",
  "         wks-001 · rad-002 · pon-001 · rst-001 · flt-022 · sea-001",
  "효과음   CC0",
  "",
  "만든 도구   OPRN Studio",
  "",
  "끝까지 함께해 주셔서 고맙습니다.",
].join("\n");

function defineEndings(project: Project): void {
  execTool(project, "define_ending", {
    id: END_A,
    name: "다시, 첫사랑",
    conditions: [],
    presentation: { musicResourceId: BGM_HAPPY, tone: "warm", kicker: "엔딩 A · 두 사람의 이야기", credits: ENDING_CREDITS, backgroundResourceId: "oprn-title-romance-office" },
    epilogue: [
      epiloguePicture("oprn-title-romance-office"),
      { kind: "say", text: "석 달 뒤, 금요일 밤." },
      { kind: "say", text: "‘하루끝’ 오늘의 늦은 답장 — 바나나우유 님께." },
      { kind: "say", text: "‘다음 주 금요일엔 내가 서울로 갈게요. 급식 줄은 이제 안 서도 돼요.’" },
      { kind: "say", speaker: "서하", text: "…또 실명 안 썼네, 이 사람." },
      { kind: "say", text: "열 번째 봄이 지나고, 첫사랑은 다시 시작됐다." },
    ],
  });
  execTool(project, "define_ending", {
    id: END_B,
    name: "늦은 답장",
    conditions: [],
    presentation: { musicResourceId: BGM_END_B, tone: "warm", kicker: "엔딩 B · 10년 늦은 인사", credits: ENDING_CREDITS, backgroundResourceId: "oprn-title-romance-campus" },
    epilogue: [
      { kind: "say", text: "열차가 떠났다. 혼자 지상으로 올라와 밤하늘을 봤다. 연두색 편지지 뒤에, 낯익은 글씨." },
      { kind: "say", text: "‘바나나우유 님께. 그 금요일 방송, 이제야 읽어요.’" },
      { kind: "say", text: "‘나도 금요일마다 사연함을 제일 먼저 열었어요. 당신 글씨가 있는지 보려고.’" },
      { kind: "say", text: "‘잘 지내요. 진심으로. — 강지후’" },
      { kind: "say", speaker: "서하", text: "…10년 늦은 답장치고는, 좀 짧잖아요." },
      { kind: "say", text: "그래도 이번엔, 인사를 했다. 월요일에도 출근해야지." },
    ],
  });
  execTool(project, "define_ending", {
    id: END_C,
    name: "우리 팀의 봄",
    conditions: [],
    presentation: { musicResourceId: BGM_END_C, tone: "warm", kicker: "엔딩 C · 첫 주의 끝", credits: ENDING_CREDITS, backgroundResourceId: "oprn-pano-night" },
    epilogue: [
      { kind: "say", text: "회식 자리로 가는 길. 회사 앞에 혼자 서서, 비 오는 길을 한참 봤다." },
      { kind: "say", text: "오후 9시 41분, 그 열차가 떠난 시각. 밤 열 시, ‘하루끝’ 오늘의 사연이 울렸다." },
      { kind: "say", text: "보낸 사람: 익명. 사연 제목은, ‘바나나우유 님께’." },
      { kind: "say", text: "‘10년 전 금요일의 사연, 이제야 답장해요. 이번에도 인사는 못 했네요.’" },
      { kind: "say", speaker: "서하", text: "…답장만 하고 가 버리면, 어떡해요." },
      { kind: "say", text: "다음 주 금요일엔 내가 먼저 사연을 보내야지. 부산까지 닿게." },
    ],
  });
}

function buildTitleAndOpening(project: Project, themeId: string): void {
  execTool(project, "set_title_screen", {
    title: "첫사랑",
    logoSubtitle: "10년 만에, 사수가 됐다",
    backgroundResourceId: "oprn-title-romance-office",
    logoStyle: "glow",
    musicResourceId: themeId,
  });
  if (project.system.titleScreen) project.system.titleScreen.backgroundFit = "cover";
  buildFirstLoveOpening(project, themeId);
}

export function createFirstLoveFlagshipDemo(): FlagshipDemoBuildResult {
  pendingRoutes = new Map();
  const project = createBlankProject();
  const initialMapIds = Object.keys(project.maps);
  project.meta.title = "첫사랑";
  project.meta.author = "OPRN Flagship Studio";
  project.system.playResolution = { width: 480, height: 270 };
  delete project.system.cameraZoom;
  // 매끈한 글꼴·가는 선(사용자 r2: 「외곽선이 너무 두껍다」) — 도트 글꼴 9px 를 화면 배율로 키우면 1px 그림자가 굵은 띠가 된다.
  project.system.dialogueStyle = "glass";
  // 전투도 체력도 없는 이야기 — 필드 HUD 는 비운다(호감은 숫자로 보이지 않고 장면으로만 드러난다).
  project.system.fieldHud = { theme: "chase", vitals: false, clock: false, tools: false, objective: false, hideEmpty: true, widgets: [] };

  const hero = project.database.actors.find((x) => x.id === DEFAULT_ACTOR_ID) ?? project.database.actors[0];
  if (hero) {
    hero.name = "윤서하";
    hero.nickname = "스튜디오 늘봄 신입 디자이너";
    hero.characterResourceId = CAST.seoha.resource;
    hero.characterIndex = CAST.seoha.index;
    const f = reviewedFaceIdForCharset(CAST.seoha.tex, CAST.seoha.index);
    if (f) hero.faceResourceId = f; else delete hero.faceResourceId;
  }

  const exec = (name: string, args: Record<string, unknown>) => execTool(project, name, args);
  const anchors = buildFirstLoveMaps(project, exec);
  // 조명이 없는 맵은 들어오기 전 맵의 조명을 이어 받는다 — 밤거리에서 편의점에 들어가면 편의점이 어두워진다. 모든 맵의 조명을 못 박는다.
  for (const id of Object.values(FL_MAP)) {
    const m = project.maps[id];
    if (m && !m.defaultLighting) m.defaultLighting = { ambient: 0, color: "#000000", sources: [] };
  }
  for (const id of initialMapIds) delete project.maps[id];
  // 시간대 빛: 월요일 오전 사무실은 창으로 든 엷은 아침 햇살, 금요일 오후 세 시 회의실은 기울어 가는 호박빛.
  if (project.maps[FL_MAP.office]) project.maps[FL_MAP.office]!.defaultLighting = { ambient: 0.07, color: "#fff2d2", sources: [] };
  if (project.maps[FL_MAP.officeFri]) project.maps[FL_MAP.officeFri]!.defaultLighting = { ambient: 0.12, color: "#ffcf94", sources: [] };


  const ensureVar = (id: string, name: string): void => { if (!project.variables.some((v) => v.id === id)) project.variables.push({ id, name }); };
  const ensureSw = (id: string, name: string): void => { if (!project.switches.some((s) => s.id === id)) project.switches.push({ id, name }); };
  ensureVar(V_STAGE, "첫사랑 진행 단계");
  ensureVar(V_JIHU, "지후 호감도");
  for (const [id, name] of [
    [SW_TOLD_MINHO, "민호에게 털어놓음"], [SW_HONEST, "실수를 팀장에게 보고함"], [SW_SAW_LETTER, "수첩 속 편지를 봄"],
    [SW_KNOWS_WHY, "지후가 떠난 이유를 들음"], [SW_COFFEE, "옥상 캔커피"], [SW_MILK, "바나나우유 두 개"], [SW_STORY, "발표에서 내 이야기를 함"],
    ["sw_fl_jihu_in_konbini", "편의점에 지후 등장"], ["sw_fl_flashback", "회상 중"], ["sw_fl_jihu_gone", "회상: 지후 퇴장"],
    ["sw_fl_lead_left", "수요일: 팀장 퇴근"], ["sw_fl_jihu_boarded", "막차: 지후 탑승"], ["sw_fl_minho_left", "수요일: 민호 퇴근"], ["sw_fl_closed_note", "수첩을 덮어 둠"],
    ["sw_fl_client_left", "금요일: 본부장 퇴장"], ["sw_fl_jihu_left", "금요일: 지후 퇴장"], ["sw_fl_admitted", "옥상: 지후가 기억한다고 말함"],
  ] as const) ensureSw(id, name);

  defineEndings(project);
  buildMondayMorning(project, anchors);
  buildMondayOffice(project, anchors);
  buildMondayNight(project, anchors);
  buildWednesday(project, anchors);
  buildFriday(project, anchors);
  buildClimax(project, anchors);

  // 맵 BGM(장면이 바꾸지 않을 때의 바탕).
  const mapBgm: Record<string, string> = {
    [FL_MAP.platformAm]: BGM_OFFICE, [FL_MAP.street]: BGM_OFFICE, [FL_MAP.office]: BGM_OFFICE, [FL_MAP.officeFri]: BGM_OFFICE,
    [FL_MAP.rooftop]: BGM_ROOF, [FL_MAP.streetPm]: BGM_NIGHT, [FL_MAP.konbini]: BGM_NIGHT, [FL_MAP.officePm]: BGM_NIGHT,
    [FL_MAP.broadcast]: BGM_MEMORY,
  };
  for (const [mapId, id] of Object.entries(mapBgm)) {
    const m = project.maps[mapId];
    if (m) m.bgm = { mode: "custom", resourceId: id };
  }
  // 밤 승강장은 클라이맥스 전용 — 고백 곡이 들어오기 전까지 침묵(라운지 피아노 금지, VQA2 BGM).
  const platPm = project.maps[FL_MAP.platformPm];
  if (platPm) platPm.bgm = { mode: "none" } as never;

  buildTitleAndOpening(project, BGM_MEMORY);

  // 연애 게임의 ESC 메뉴 — 전투 능력치(상태·스킬·장비·돈) 없이 호감도·대화 기록·엔딩·저장(VQA 1차 MAJOR).
  project.characters = { ...(project.characters ?? {}), [JIHU_KEY]: { displayName: "강지후", note: "앱 개발 4년 차 선임, 그리고 내 사수. 10년 전, 금요일 점심 방송의 목소리." },
    minho: { displayName: "차민호", note: "지난주에 들어온 백엔드 신입. 자칭 동기, 탕비실 간식 담당." },
    lead: { displayName: "오정민 팀장", note: "프로덕트팀 팀장. 말은 부드럽지만, 보고는 정확해야 한다." } };
  project.meta.oprnFieldMenu = { version: 1, entries: [
    { command: "relationships", label: "호감도" }, { command: "backlog", label: "대화 기록" }, { command: "endings", label: "엔딩" },
    { command: "save", label: "저장" }, { command: "load", label: "불러오기" }, { command: "options", label: "설정" }, { command: "to-title", label: "타이틀로" },
  ] };
  // 대사창·메뉴 룩: 어두운 유리 + 금빛 이름 탭(진지한 관계극). 연애 기본(분홍 카드)은 이 이야기의 씁쓸한 톤과 도트에 안 맞는다.
  project.meta.oprnVnLook = defaultVnLook("night-glass");
  // ESC 메뉴 머리줄의 장소 이름은 8자 안쪽이어야 잘리지 않는다(VQA 1차: 「스튜디오 늘봄 · …」).
  const shortNames: Record<string, string> = {
    [FL_MAP.platformAm]: "한결역 · 아침", [FL_MAP.street]: "빌딩 앞 거리", [FL_MAP.office]: "7층 사무실",
    [FL_MAP.rooftop]: "빌딩 옥상", [FL_MAP.streetPm]: "거리 · 밤", [FL_MAP.konbini]: "회사 앞 편의점",
    [FL_MAP.broadcast]: "그날의 방송실", [FL_MAP.officePm]: "7층 · 수요일 밤", [FL_MAP.officeFri]: "7층 · 금요일", [FL_MAP.platformPm]: "한결역 · 막차",
  };
  for (const [id, name] of Object.entries(shortNames)) if (project.maps[id]) project.maps[id]!.name = name;
  // 현대 연애 장르 잠금 — 메뉴·대사 보조(오토·스킵·기록)·엔딩 목록이 연애 기본 구성을 따르고, 편집기 조수도 현대 칩셋 계열만 새로 쓴다.
  enableGenreLock(project, "romance", "enforce");

  // 사람이 지나다니는 문은 저절로 열고 닫힌다(map.doors auto) — 회의실 유리 여닫이, 편의점 자동문.
  const meetingDoor: MapDoorDef = { x: 10, y: 13, w: 1, h: 2, style: "swing", hinge: "right", interior: "none", frame: { l: 3, r: 1, t: 4, b: 3 }, auto: true, openSe: SE_GLASS_OPEN, closeSe: SE_GLASS_SHUT };
  for (const id of [FL_MAP.office, FL_MAP.officePm, FL_MAP.officeFri]) { const m = project.maps[id]; if (m) m.doors = [meetingDoor]; }
  const konbiniMap = project.maps[FL_MAP.konbini];
  // 회상 방송실 문(복도로 나오는 유리 여닫이) — 어린 지후가 지나갈 때 열린다(VQA r4 M2: 닫힌 문을 뚫고 지나갔다).
  const bcMap = project.maps[FL_MAP.broadcast];
  if (bcMap) bcMap.doors = [{ x: 11, y: 10, w: 1, h: 2, style: "swing", hinge: "right", interior: "none", frame: { l: 3, r: 3, t: 4, b: 3 }, auto: true, openSe: SE_GLASS_OPEN, closeSe: SE_GLASS_SHUT }];
  if (konbiniMap) konbiniMap.doors = [{ x: anchors.konbini.door.x, y: anchors.konbini.door.y, w: 2, h: 1, style: "slide", hinge: "left", interior: "none", frame: { l: 0, r: 0, t: 1, b: 10 }, auto: true, openSe: SE_CHIME }];

  resolveRoutes(project);
  // 움직이는 탈것 금지(사용자 r2: 「돌아다니는 오토바이」) — 거리 구성기가 깐 차량 행렬을 걷어 낸다. 서 있는 차(타일)는 그대로다.
  for (const id of [FL_MAP.street, FL_MAP.streetPm]) { const m = project.maps[id]; if (m) delete (m as { transit?: unknown }).transit; }

  project.startMapId = FL_MAP.platformAm;
  project.startPos = anchors.platform.arrive;
  project.mapTree = {
    mapId: FL_MAP.platformAm,
    children: [FL_MAP.street, FL_MAP.office, FL_MAP.rooftop, FL_MAP.streetPm, FL_MAP.konbini, FL_MAP.broadcast, FL_MAP.officePm, FL_MAP.officeFri, FL_MAP.platformPm]
      .map((mapId) => ({ mapId, children: [] })),
  };

  const serialized = serialize(project);
  const reloaded = deserialize(serialized);
  return {
    id: "first-love",
    manifest: { ...FLAGSHIP_BEAT_MANIFESTS["first-love"], mapCount: Object.keys(reloaded.maps).length, endingCount: reloaded.endings?.length ?? 0 },
    project: reloaded,
    serialized,
  };
}
