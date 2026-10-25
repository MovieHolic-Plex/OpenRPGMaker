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
import { charsetFrameIndex } from "@/assets/easyrpgRtp";
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
  bgm, call, callTo, caption, CAST, choices, m2, clearTintKeepBlack, emote, event, face, faceEachOther, fadeIn, fadeOut, flash, hidePlayer, ifCond, page,
  playSe, say, sayAt, sayOver, sayTo, listenTo, fillListenerBusts, setSw, textAtBottom, faceHero, letterbox, setVar, shake, showPlayer, stopBgm, stageAtLeast, stageBelow, stageIs, swOff, swOn, memoryTint, memoryPictureIn, memoryPictureOut, memoryPictureErase, think, transfer, voice, wait, walk,
} from "./firstLoveKit";
import { buildFirstLoveMaps, drawnOverActor, FL_MAP, FL_TRAIN_CALL, FL_TRAIN_GO, nearestFree, type Cell, type FirstLoveAnchors } from "./firstLoveMaps";
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
const SW_BUMPED = "sw_fl_bumped"; // 출근길 횡단보도에서 부딪힌 남자(오프닝 A) — 사무실에서 그 목소리를 알아본다

/** 흐름 단계 — 맵마다 자동 장면이 이 값을 보고 한 번 돈다. */
const S = {
  START: 0, ARRIVED: 1, STREET: 2, MET: 3, PANTRY: 4, ROOF: 5, EVENING: 6, KONBINI: 7, FLASH: 8,
  WED: 9, WED_TALK: 10, FRI: 11, RUN: 12, PLATFORM: 13,
  /** 엔딩 C: 회식으로 — 밤거리 비 한 장면 뒤 엔딩. */
  DINNER: 20,
  /** 엔딩 B: 열차가 떠난 뒤 혼자 지상으로 — 밤거리 지하철 출입구 앞에서 엔딩. */
  END_B_STREET: 21,
} as const;

/** 엔딩 A 문턱 — 호감은 선택 아홉 번에서 최대 12, 정직하게 가면 6~7 이 자연스럽게 닿는다. */
const TRUE_END_AT = 6;

const END_A = "end_fl_again";
// 엔딩 배지는 id 로 정해진다(playSceneOverlays.endingBadge): normal → 「NORMAL ENDING」. A 만 「HAPPY ENDING」.
const END_B = "end_fl_normal_late_reply";
const END_C = "end_fl_normal_team";

const SE_HEART = "cc0-se-orp-interface-interface3";
const SE_MAIL = "cc0-se-orp-interface-interface1";
const SE_PAPER = "cc0-se-osx-paper-04"; // 종이 바스락 두 번(inventory-cloth 는 이름과 달리 나무 두드림이었다, VQA r34)
// 옛 inventory-bottle 은 8비트 칩튠 소리라 현실 사무실에서 튀었다(VQA r26) — 둔탁한 2단 «탁» 소리(캔을 내려놓는 소리).
const SE_CAN = "cc0-se-osx-wooden-01";

// 음악(사용자 r2: 「BGM 쓰레기」) — 판타지 RPG 마을곡(fld-003·town·inn)과 합성 원곡 둘을 버리고, CC0 카탈로그에서
// 귀 판정(Gemini 4 Argon, 곡마다 2회, 60초 발췌)으로 현대 연애 장면에 맞는 곡만 여섯 곡 고른다. 근거: openwiki/runtime-pre-edit-routing.md.
// r4(사용자: 「무드에 맞게」): 귀 판정(agy Gemini)은 할당량 소진으로 못 했다 — 아래 r4 곡은 카탈로그 설명·AI 청취 설명·측정(밝기·빌드)으로
// 골랐고 귀 점수가 없다. 옛 곡(괄호)은 Argon 귀 판정 점수가 있던 것.
const BGM_OFFICE = "cc0-bgm-rtp-qui-001"; // 휘파람·어쿠스틱 셔플 — 월요일 아침 사무실의 밝은 빛(r4, 귀 미판정; 옛 wks-001 8.0 은 측정상 가장 어두운 곡)
// 금요일 발표 — 쓸쓸한 기타·다운템포 비트의 «차분한 긴장»(VQA r27: 휘파람 사무실 곡이 긴장한 회의 밑에 깔렸다)
const BGM_MEETING = "cc0-bgm-rtp-prt-001";
const BGM_ROOF = "cc0-bgm-rtp-rad-002"; // 로파이 재즈합 — 노을 옥상(9.0)
const BGM_NIGHT = "cc0-bgm-rtp-pon-001"; // 라운지 피아노·브러시 — 밤거리·편의점·야근(9.0)
const BGM_CALM = "cc0-bgm-rtp-pon-001"; // 잔잔한 기타·피아노 — 첫날 재회의 충격이 가라앉는 오후(BGM_NIGHT 와 같은 곡)
const BGM_MEMORY = "cc0-bgm-rtp-rst-001"; // 피아노·어쿠스틱 기타 발라드 — 회상·타이틀(9.0 / 8.0)
const BGM_CONFESS = "cc0-bgm-rtp-mys-002"; // 잔향 깊은 피아노 독주에 현이 차오르고 잦아든다, 드럼 없음 — 막차 고백(r4 「감정 피아노」, 귀 미판정; 옛 flt-022 8.0. flt-004 는 41MB WAV 라 절정에서 로드가 늦어 뺐다)
const BGM_END_B = "cc0-bgm-rtp-flt-022"; // 하프·현이 벅차오르는 작별 — 엔딩 B(9.0)
const BGM_RAIN = "cc0-bgm-rtp-flt-017"; // 기타 아르페지오 위 애절한 바이올린, E단조 — 회식으로 간 밤, 혼자 선 비 오는 거리(엔딩 C 직전). 질주에는 안 쓴다(VQA r25)
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
// 승강기·로비 문 — 옛 evade2 는 청취 설명이 «휙 피하기»라 전투 회피로 읽혔다(VQA r26). 걸쇠·공압·미끄러짐·잠김의 기계 문 소리.
const SE_SLIDE = "cc0-se-orp-misc-random6";
const SE_GLASS_OPEN = "cc0-se-osx-pot-02"; // 유리문 손잡이가 풀리며 문이 밀리는 짧은 기계 클릭·마찰(teleport2 는 이름이 «순간이동»이라 소리 계획에서 오해됐다, VQA r32)
const SE_GLASS_SHUT = "cc0-se-osx-door-close-03"; // 유리문 걸쇠 딸깍
// 열차: 옛 earth2 는 카탈로그 청취 설명이 「심장 박동 쿵-쿵」이라 열차로 읽히지 않았다(VQA r25) — 저음 럼블이 부풀었다 빠지는 fire1,
// 문은 공압이 빠지며 미끄러져 걸리는 random6. earth2 는 질주 장면의 심장 소리로 쓴다.
const SE_TRAIN = "cc0-se-orp-misc-random1"; // 굵은 저역 모터 구동음 1초 — 들어오고 떠나는 열차의 견인 모터(fire1 «불 마법» 후시는 열차로 안 읽혔다, VQA r32 중대)
const SE_TRAIN_AIR = "easyrpg-sound-wind8"; // 저역 럼블 섞인 강한 기류 1.4초 — 열차가 밀고 들어오는 바람·공기 제동
const SE_TRAIN_CHIME = "cc0-se-osx-dishes-02"; // 두 음 «딩동» — 열차 문 열림·닫힘 안내음
const SE_TRAIN_DOOR = "cc0-se-orp-misc-random6"; // 걸쇠 딸깍 → 공압 배출·미끄러짐 → 잠김(열차 문 열림·닫힘)
const SE_PULSE = "easyrpg-sound-earth2"; // 둔탁한 저음 쿵-쿵(심장 박동) — 막차까지 뛰는 장면
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
const panTo = (x: number, y: number, ms = 900, zoom = 1): Command => m2("Camera Control", { mode: "panTo", target: "screen", x, y, zoom, durationMs: ms, wait: true, easing: "easeInOut" });
const panBack = (ms = 900): Command => m2("Camera Control", { mode: "return", target: "player", x: 0, y: 0, zoom: 1, durationMs: ms, wait: true, easing: "easeInOut" });

/**
 * NPC 퇴장 — 실제 걸을 수 있는 길로 승강기 앞까지 걸어가 단추를 누르고, 문이 열리면 타고, 문이 닫힌다(사용자 r4: 「승강기를 진짜로」).
 * begin = 승강기 앞까지 걷기(기다리지 않는다 — 걷는 동안 대사가 이어진다). end = 도착을 기다려 단추·딩·문 열림·탑승·문 닫힘 → 감춤 스위치.
 * pan 을 주면 문이 화면 밖일 때 카메라가 승강기로 갔다가 돌아온다(회의실에서 보는 퇴장).
 * firstLoveProbe(scripts/qa/runtime/first-love-probes.mts)가 「사라지기 직전 칸 = 출구 앞」을 검사한다.
 */
function leave(project: Project, mapId: string, eventId: string, from: Cell, exit: { stand: Cell; door: Cell }, hideSw: string, hero: Cell, alsoAvoid: readonly Cell[] = [], pan?: Cell & { zoom?: number }, returnTo?: Cell & { zoom?: number }): { begin: Command; end: Command[] } {
  const walkOut = walkRoute(project, mapId, eventId, from, exit.stand, [hero, ...alsoAvoid], false) as unknown as Record<string, unknown>;
  walkOut.routeTail = [{ kind: "turn", dir: dirToward(exit.stand, exit.door) }];
  const door = elevDoor(exit.door);
  const ride = { kind: "moveEvent", eventId, route: { moves: [
    { kind: "setThrough", enabled: true }, { kind: "move", dir: "up" }, { kind: "move", dir: "up" }, { kind: "turn", dir: "down" }, { kind: "setThrough", enabled: false },
  ], repeat: false, wait: true, skippable: true } } as unknown as Command;
  return {
    begin: walkOut as unknown as Command,
    end: [
      ...(pan ? [panTo(pan.x, pan.y, 900, pan.zoom ?? 1)] : []),
      waitMoves(),
      quiet(SE_BUTTON), wait(500),
      playSe(SE_ELEVATOR), wait(300),
      quiet(SE_SLIDE, 0.45), ...doorFx(door, true, 700),
      ride,
      wait(250),
      quiet(SE_SLIDE, 0.45), ...doorFx(door, false, 700),
      setSw(hideSw, true),
      wait(300),
      ...(pan ? [returnTo ? panTo(returnTo.x, returnTo.y, 900, returnTo.zoom ?? 1) : panBack()] : []),
    ],
  };
}

/**
 * 앉은 사람 — 책상·탁자 아래쪽 의자에 위를 보고(등이 화면 쪽) 앉힌다. 의자 그림이 사람 위에 그려지면 등받이가 머리를 가로질러
 * 고글을 쓴 것처럼 보였다(VQA r28 중대) — 앉은 동안은 위 층(above)으로 의자 위에 그린다. 일어설 때(standUp) 스위치를 켜면
 * 같은 층(same) 쌍둥이 페이지로 바뀌어 걷는 동안 가구 뒤로 제대로 가려진다.
 */
function seatedPages(id: string, conds: Parameters<typeof page>[1], who: string, upSw?: string): ReturnType<typeof page>[] {
  return [
    page(`${id}_sit`, conds, [], { who, dir: "up", priority: "above" } as Parameters<typeof page>[3]),
    ...(upSw ? [page(`${id}_up`, [...conds, swOn(upSw)], [], { who, dir: "up", priority: "same" } as Parameters<typeof page>[3])] : []),
  ];
}

/** 의자에서 옆 바닥으로 일어선다(통과를 켜고 한 걸음). upSw 를 주면 일어선 뒤 같은 층 페이지로 바꾼다. */
function standUp(eventId: string, chair: Cell, floor: Cell, upSw?: string): Command[] {
  if (Math.abs(chair.x - floor.x) + Math.abs(chair.y - floor.y) !== 1) throw new Error(`[first-love] ${eventId}: 의자 ${chair.x},${chair.y} 옆 바닥이 아니다 (${floor.x},${floor.y})`);
  return [
    { kind: "moveEvent", eventId, route: { moves: [
      { kind: "setThrough", enabled: true }, { kind: "move", dir: dirToward(chair, floor) }, { kind: "setThrough", enabled: false },
    ], repeat: false, wait: true, skippable: true } } as unknown as Command,
    ...(upSw ? [setSw(upSw, true)] : []),
  ];
}

/** 수요일 밤 서하 자리: 지후 의자(서하 책상 오른쪽 덩어리 서쪽 끝 아래 의자)에서 오른쪽 둘째 의자, 그 뒤(아래) 바닥. */
function wedSeat(a: FirstLoveAnchors): { chair: Cell; stand: Cell } {
  const chair = { x: a.office.heroDesk.x + 3, y: a.office.heroDesk.y + 2 };
  return { chair, stand: { x: chair.x, y: chair.y + 1 } };
}

/** 페이지 그림을 배율로 그린다(문간처럼 «안쪽에 선» 사람). */
function scaledPage(p: ReturnType<typeof page>, scale: number): ReturnType<typeof page> {
  (p as unknown as { graphic: { scale?: number } }).graphic.scale = scale;
  return p;
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
  // 지나갈 수 있어도 위층(★) 가구 칸(의자 줄·차양)은 그림이 사람 위에 그려진다 — 그 줄을 따라 걸으면 의자 위로 걷는 것처럼 보였다
  // (VQA r25: 금요일 서하가 회의실 의자 줄 위로 나간다). 그런 칸은 한 걸음을 다섯 걸음으로 쳐서, 조금 돌아가는 길이 있으면 그리로 간다.
  const COVER_COST = 5;
  const key = (c: Cell): string => `${c.x},${c.y}`;
  const prev = new Map<string, [string, Dir]>();
  const dist = new Map<string, number>([[key(from), 0]]);
  const buckets: Cell[][] = [[from]];
  for (let d = 0; d < buckets.length; d++) {
    for (const c of buckets[d] ?? []) {
      if ((dist.get(key(c)) ?? Infinity) < d) continue;
      if (c.x === to.x && c.y === to.y) { d = buckets.length; break; }
      for (const [dir, dx, dy] of steps) {
        const n = { x: c.x + dx, y: c.y + dy }, k = key(n);
        if (blocked.has(k) || !isPassable(project, map, n.x, n.y)) continue;
        const nd = d + (drawnOverActor(project, map, n.x, n.y) ? COVER_COST : 1);
        if (nd >= (dist.get(k) ?? Infinity)) continue;
        dist.set(k, nd); prev.set(k, [key(c), dir]);
        (buckets[nd] ??= []).push(n);
      }
    }
  }
  const out: Dir[] = [];
  let k = key(to);
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

  // 아침 승강장 장면은 오프닝 A(거리에서 바로 시작)로 접었다 — 승강장 출구는 «내린 뒤»라 막혀 있다.
  add(plat, door("ev_fl_plat_exit", a.platform.exit, [stageAtLeast(V_STAGE, S.ARRIVED)],
    [transfer(FL_MAP.street, a.street.arrive.x, a.street.arrive.y, "down")],
    think("아직 정신이 없다.")));

  // 거리(낮) — 게임은 여기서 바로 시작한다(오프닝 A, 2026-10-25 사용자 승인): 출구에서 사람들이 쏟아져 나오고,
  // 서하도 그 틈에 섞여 횡단보도를 건너다 맞은편에서 서두르던 남자와 부딪힌다. 서류가 날리고, 화면이 멈춘다(프리즈 프레임).
  // 남자 얼굴은 아직 보지 못한다 — 사무실에서 「처음 뵙겠습니다」로 다시 마주친다.
  const s = a.street;
  // 부딪히는 자리는 세로 횡단보도(x≈21) 한가운데. 남자는 옆 줄(x+1)로 뛰어 내려오다 서하 쪽으로 꺾어 옆에서 부딪힌다 —
  // 바로 위 칸에서 부딪히면 3/4 시점에서 남자 하반신이 서하 머리를 덮었다(Argon op1).
  const bumpAt: Cell = nearestFree(project, street, { x: 20, y: 22 }, 1);  // 남쪽 보도, 세로 횡단보도 발치 바로 왼쪽(차도 밖)
  const nearBump: Cell = bumpAt;
  const rusher: Cell = nearestFree(project, street, { x: 21, y: 14 }, 1);   // 북쪽 보도, 횡단보도 머리
  const rushStop: Cell = { x: bumpAt.x + 1, y: bumpAt.y };                   // 횡단보도를 뛰어 내려와 보도에 닿는 칸 — 서하 바로 오른쪽
  // 출구에서 나온 사람들은 빈 보도에서 사라지지 않는다 — 차례로 나와 횡단보도를 건너 늘봄 빌딩 문으로 들어간다.
  const crowd = [
    { id: "ev_fl_crowd_1", tex: "tex_oprn_charset_modern3", index: 0, delay: 0, exit: "ev_fl_office_door" },
    { id: "ev_fl_crowd_2", tex: "tex_oprn_charset_modern3", index: 2, delay: 6, exit: "ev_fl_office_door" },
    { id: "ev_fl_crowd_3", tex: "tex_oprn_charset_modern2", index: 7, delay: 12, exit: "ev_fl_office_door" },
    { id: "ev_fl_crowd_4", tex: "tex_oprn_charset_modern1", index: 1, delay: 18, exit: "ev_fl_office_door" },
  ];
  for (const c of crowd) {
    // 처음엔 화면 밖 구석(맵 맨 윗줄)에 둔다 — 계단 칸에 세워 두면 차례가 늦은 사람이 경로가 닿을 때까지 계단에 보였다(Argon op4).
    // enterVia 가 출구 칸으로 옮겨 나타나게 한다.
    add(street, event(c.id, "출근하는 사람", { x: crowd.indexOf(c), y: 0 }, [page(`${c.id}_p`, [stageIs(V_STAGE, S.START)], [], { dir: "down" })]));
    const pg = street.events.find((e) => e.id === c.id)!.pages![0]! as unknown as { graphic: Record<string, unknown>; priority: string; overlapForbidden: boolean; movement: Record<string, unknown> };
    pg.graphic = { sprite: { type: "bundled", id: c.tex }, direction: "down", pattern: charsetFrameIndex({ characterIndex: c.index, direction: "down", pattern: 1 }), transparent: false };
    pg.priority = "same"; pg.overlapForbidden = false; pg.movement = { type: "fixed", speed: 4, frequency: 3 };
  }
  // 계단 칸에 숨어 있다가 차례로 나타나 내려선다(enterVia) → 각자 갈 곳으로.
  const crowdRoute = (c: (typeof crowd)[number]): Command => ({ kind: "moveEvent", eventId: c.id, route: { moves: [
    { kind: "changeOpacity", delta: -255 },
    ...Array.from({ length: c.delay }, () => ({ kind: "wait" })),
    { kind: "enterVia", x: s.subway.x, y: s.subway.y, dir: "down", se: "", closeSe: "" },
    // 모두 세로 횡단보도로 길을 건너 늘봄 빌딩으로 — 동쪽 보도 끝으로 가던 사람은 차도에 멈춰 섰다(Argon op3).
    { kind: "approach", x: 21, y: 22, distance: 0 }, { kind: "approach", x: 21, y: 14, distance: 0 }, { kind: "exitVia", target: c.exit, se: "", closeSe: "" },
  ], repeat: false, wait: false, skippable: true } } as unknown as Command);
  add(street, event("ev_fl_rusher", "서두르는 남자", rusher, [
    page("rusher_p", [stageIs(V_STAGE, S.START)], [], { who: "jihu", dir: "down" }),
  ]));
  add(street, scene("ev_fl_cold_open", { x: 1, y: 2 }, S.START, [
    textAtBottom(),
    // 첫 화면은 검게 시작해 사람들이 숨은 뒤 밝아진다(계단 칸에 선 사람이 한 프레임 비치지 않게).
    m2("Screen Effect", { effect: "fadeOut", value: "", durationMs: 1 }), wait(1),
    hidePlayer(),
    // 서하(숨은 채)가 출구 계단 앞 칸을 비켜 준다 — 계단 앞 칸이 하나뿐이라 서하가 서 있으면 나오던 사람이 계단에 갇혔다(Argon op1).
    { kind: "moveEvent", eventId: "@player", route: { moves: [{ kind: "setThrough", enabled: true }, { kind: "move", dir: "right" }, { kind: "move", dir: "down" }, { kind: "setThrough", enabled: false }], repeat: false, wait: true, skippable: true } } as unknown as Command,
    ...crowd.map(crowdRoute),
    bgm(BGM_OFFICE, 1200),
    ...letterbox(true, 1),
    ...fadeIn(700),
    wait(4200),
    // 사람들이 다 빠진 뒤 서하도 계단을 올라온다(숨은 채 계단 앞 칸으로 돌아와 나타난다).
    { kind: "moveEvent", eventId: "@player", route: { moves: [{ kind: "setThrough", enabled: true }, { kind: "move", dir: "up" }, { kind: "move", dir: "left" }, { kind: "turn", dir: "down" }, { kind: "setThrough", enabled: false }], repeat: false, wait: true, skippable: true } } as unknown as Command,
    showPlayer(),
    ...caption("월요일 오전 8시 41분, 한결역."),
    ...think("첫 출근. 지각은 아니다. 아직은.", "스튜디오 늘봄. 서른 명 남짓한 앱 회사. 늘봄 빌딩은 길 건너, 제일 높은 유리 건물이다."),
    ...say("seoha", "happy", "할 수 있어, 윤서하."),
    // 서하가 횡단보도를 건너기 시작한다. 반쯤 왔을 때 길 건너에서 남자가 휴대폰을 보며 뛰어 내려오다 서하 쪽으로 꺾는다.
    // 부딪힘은 보도 위(횡단보도 발치)에서 — 차도에서 부딪히면 선 차와 겹쳐 서류가 보닛 위에 떴다(Argon op2).
    walkRoute(project, FL_MAP.street, "@player", s.arrive, nearBump, [], true, "right"),
    // 남자 걸음만 기다린다 — 모든 이동을 기다리면 아직 걷는 출근 인파를 기다리느라 둘이 4초 마주 서 있었다(Argon op3).
    walkRoute(project, FL_MAP.street, "ev_fl_rusher", rusher, rushStop, [bumpAt], true, "left"),
    // 부딪히는 순간 카메라가 둘에게 확 다가선다(배율 2) — 1배 화면에서 두 사람이 12px 라 «부딪혔다»가 안 읽혔다(Sonnet op5).
    panTo(bumpAt.x, bumpAt.y, 220, 2),
    quiet("cc0-se-orp-inventory-cloth-heavy", 0.8),
    shake(260),
    { kind: "moveEvent", eventId: "@player", route: { moves: [{ kind: "setDirectionFix", enabled: true }, { kind: "jump", dx: -1, dy: 0, heightPx: 4, durationMs: 220 }, { kind: "setDirectionFix", enabled: false }], repeat: false, wait: true, skippable: true } } as unknown as Command,
    // 서류는 크게(180%) — 기본 크기는 1배 화면에서 흰 점 몇 개로 보였다(Sonnet op5).
    m2("Particle Effect", { preset: "paper", target: "player", durationMs: 1800, sizePercent: 180, wait: false }),
    quiet(SE_PAPER, 0.7),
    wait(380),
    m2("Screen Effect", { effect: "freeze", value: "warm", durationMs: 500 }),
    wait(500),
    // 한 마디만 — 「…아.」 상자 따로, 다음 상자 따로면 흘림 첫 글자 「…」만 든 빈 상자가 정지 화면을 가렸다(Sonnet op5).
    ...think("아. 서류가, 봄바람에, 날아간다."),
    m2("Screen Effect", { effect: "unfreeze", value: "", durationMs: 300 }),
    wait(300),
    ...voice("남자", "죄송합니다…! 괜찮으세요? 제가 지금 너무 늦어서—"),
    ...think("고개를 들기도 전에, 남자는 떨어진 종이 한 장을 내 손에 쥐여 주고 다시 뛰어갔다."),
    panBack(500),
    // 남자는 회사 쪽(늘봄 빌딩)으로 달려가 사라진다 — 얼굴은 못 봤다.
    { kind: "moveEvent", eventId: "ev_fl_rusher", route: { moves: [{ kind: "changeSpeed", delta: 1 }, { kind: "approach", x: rusher.x, y: rusher.y, distance: 0 }, { kind: "exitVia", target: "ev_fl_office_door", se: "", closeSe: "" }], repeat: false, wait: false, skippable: true } } as unknown as Command,
    // 「…」로 시작하는 줄은 흘림 첫 순간 「…」만 든 상자가 된다 — 말머리 말줄임표를 뺐다.
    ...think("그 목소리, 어디서 들어 본 것 같았는데."),
    ...letterbox(false, 500),
    wait(600),
    setSw(SW_BUMPED, true),
    ...think("(횡단보도를 건너 늘봄 빌딩으로 가자.)"),
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
    // 다른 출구(내린 출구가 아닌 계단) — 들어가도 같은 역이다. 말만 한다.
    ...a.street.otherExits.map((e) => door(`ev_fl_exit${e.n}_am`, e.stair, [stageIs(V_STAGE, 999)], [], think(`${e.n}번 출구. 들어가 봐야 같은 한결역이다.`), "down")),
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
  // 민호는 탕비실(왼쪽)에서 와 서하 왼쪽에 선다 — 팀장 오른쪽에 세우면 팀장을 사이에 두고 서하에게 말했다(VQA r18).
  const minhoMeetStop = spot(project, FL_MAP.office, { x: heroMeet.x - 1, y: heroMeet.y }, [...taken, leadMeetStop, jihuMeetStop]);
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
    ...think("금요일 점심, 방송실 창가. 스피커에서 흘러나오던 그 목소리."),
    ...sayAt("lead", "right", "base", "강지후 선임. 앱 개발 4년 차고, 이번 ‘하루끝’ 리뉴얼 메인 개발자예요. 모르는 건 이 사람한테 물어봐요."),
    ...say("jihu", "base", "…처음 뵙겠습니다. 강지후입니다."),
    // 오프닝 A 의 횡단보도 — 그 목소리였다.
    ifCond(swOn(SW_BUMPED), think("…아까 횡단보도. 서류를 주워 주고 뛰어가던, 그 목소리.")),
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
    face("@player", dirToward(heroMeet, leadMeetStop)),
    ...sayAt("lead", "right", "base", "서하 씨 자리는 지후 씨 옆이에요. 오늘 숙제는 금요일 발표 자료 읽어 두기."),
    ...sayAt("lead", "right", "base", "금요일 오후 세 시에 ‘소리결’ 박 본부장님 앞에서 리뉴얼 시안 발표가 있어요. 신입한테 미안하지만, 첫 주부터 바빠요."),
    face("@player", dirToward(heroMeet, minhoMeetStop)),
    listenTo("seoha"),
    // 사무실 곡은 재회 직후가 아니라 민호가 분위기를 풀 때 천천히 돌아온다 — 「…지후 선배?」 바로 뒤에 휘파람 곡이 다시 떴다(VQA r30).
    // 휘파람 곡은 아직 이르다 — 재회의 충격(「잘못 봤을 리가 없다」) 뒤엔 잔잔한 피아노가 낮게 깔린다(VQA r34).
    bgm(BGM_CALM, 4000),
    ...sayAt("minho", "right", "happy", "서하 씨, 이따 탕비실로 와요! 커피 머신 쓰는 법 알려 줄게요."),
    // 민호는 팀장 오른쪽에 서 있었다 — 팀장 칸을 뚫고 지나가려다 걸음이 건너뛰어져 엉뚱한 칸에 멈췄다(r40). 팀장·지후 칸을 돌아간다.
    walkRoute(project, FL_MAP.office, "ev_fl_minho", minhoMeetStop, minhoSpot, [heroMeet, leadMeetStop, jihuMeetStop], false, "up"),
    // 만남 자리의 둘은 그 자리에서 사라지지 않고 각자 자리까지 걸어간다 — 자리의 지후·팀장 페이지가 같은 칸에서 이어받는다.
    walkRoute(project, FL_MAP.office, "ev_fl_jihu_meet", jihuMeetStop, jihuSeat, [heroMeet], false),
    wait(1200), // 민호가 팀장 앞(아래) 칸을 지나간 뒤에 팀장이 걷는다(동시에 걸으면 서로 막혀 걸음이 건너뛰어진다, r40).
    walkRoute(project, FL_MAP.office, "ev_fl_lead", leadMeetStop, o.leadDesk, [heroMeet], false, "down"),
    ...think("(탕비실에서 민호 씨를 찾아보자. 자리와 화이트보드도 한번 볼까.)"),
    waitMoves(),
    stage(S.MET),
  ]));
  // 만남 장면에만 서 있는 지후(그 뒤엔 자리의 지후가 대신한다).
  // 지후는 자기 자리에서 불려 온다(엘리베이터 문틀 안에 서 있으면 소품처럼 보였다 — 2026-10-22 VQA).
  add(office, event("ev_fl_jihu_meet", "강지후", jihuSeat, [
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
    // 문간(문 칸)에서 시작해 한 걸음 걸어 나온다 — 문 앞 칸에 그냥 서 있으면 «문 옆에 나타났다»였다(VQA r29).
    { kind: "moveEvent", eventId: "@player", route: { moves: [{ kind: "placeAt", x: r.door.x, y: r.door.y }, { kind: "turn", dir: "down" }], repeat: false, wait: true, skippable: true } } as unknown as Command,
    ...fadeIn(500),
    { kind: "moveEvent", eventId: "@player", route: { moves: [
      { kind: "setThrough", enabled: true }, { kind: "move", dir: "down" }, { kind: "setThrough", enabled: false },
    ], repeat: false, wait: true, skippable: true } } as unknown as Command,
    quiet(SE_DOOR_SHUT, 0.7), ...doorFx(roofDoor, false, 500),
    bgm(BGM_ROOF),
    face("ev_fl_jihu_roof", "up"),
    // 문 앞에서 난간 쪽으로 카메라가 천천히 건너가 그 사람을 찾는다.
    panTo(jihuRail.x, jihuRail.y, 1600),
    ...think("하늘이 넓다. 그리고… 있다."),
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
    // 옥상 장면이 옮긴 카메라 좌표가 남아 서하가 화면 아래 끝에 섰다(VQA r22) — 화면이 검을 때 서하에게 돌려 둔다.
    panBack(0),
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
    ...a.street.otherExits.map((e) => door(`ev_fl_exit${e.n}_pm`, e.stair, [stageIs(V_STAGE, 999)], [], think(`${e.n}번 출구로 가면 돌아간다. 아침에 나온 ${a.street.exitNo}번 출구로 가자.`), "down")),
  );

  // 편의점: 점원 · 냉장고 · 문.
  const clerkSpot = nearestFree(project, kon, k.counter, 3, [k.doorOut]);
  const jihuEnter = k.doorOut;
  const coolerFront = { x: k.cooler.x, y: k.cooler.y + 1 };
  // 냉장고 앞(선반 사이 틈)은 옆 칸이 모두 선반이라 지후가 대각선 위 칸에 서서 몸이 겹친 채 엇갈려 말했다(VQA r34).
  // 서하가 두 걸음 내려와 매장 통로에 서고, 지후는 그 바로 오른쪽에 선다 — 같은 줄에서 마주 본다.
  const heroTalk = { x: coolerFront.x, y: coolerFront.y + 2 };
  const jihuStop = nearestFree(project, kon, { x: heroTalk.x + 1, y: heroTalk.y }, 0, [k.cooler, clerkSpot, coolerFront, heroTalk]);
  if (jihuStop.y !== heroTalk.y || Math.abs(jihuStop.x - heroTalk.x) !== 1) throw new Error(`[first-love] 편의점: 지후 자리 ${jihuStop.x},${jihuStop.y} 가 서하(${heroTalk.x},${heroTalk.y}) 옆이 아니다`);
  // 계산대 손님 쪽(점원 두 칸 아래) — 계산은 거기 가서 한다(VQA r3: 매장 건너 10칸에서 점원과 말함).
  const registerFront = nearestFree(project, kon, { x: clerkSpot.x, y: clerkSpot.y + 2 }, 1, [clerkSpot, jihuStop, coolerFront, heroTalk]);
  // 지후는 계산대 바로 앞 줄이 아니라 서하 오른쪽 뒤 칸 — 계산대 위 소품(상층 그림)이 머리를 덮지 않는다(VQA r4 M1).
  // 지후는 서하 왼쪽 옆 칸(같은 줄) — 대각선 뒤 칸에 서면 둘이 빈 칸을 보며 말했다(VQA r23). 오른쪽 옆(18,10)은 계산대 위 물건(★)이 머리를 덮는다.
  // 바로 옆 칸들(15·16,10)도 계산대 위 물건(★) 밑이라, 지후는 계산대에서 네 칸 왼쪽(위가 빈 칸)에서 기다리고 서하가 계산 뒤 그 옆으로 간다.
  const jihuRegister = nearestFree(project, kon, { x: registerFront.x - 4, y: registerFront.y }, 0, [clerkSpot, registerFront, jihuStop, coolerFront, heroTalk]);
  const heroBesideJihu = { x: jihuRegister.x + 1, y: jihuRegister.y };
  add(kon,
    event("ev_fl_clerk", "편의점 점원", clerkSpot, [page("c", [], [
      ...voice("점원", "어서 오세요~ 바나나우유 원 플러스 원이에요."),
      ...voice("점원", "요즘 그거 찾는 분 별로 없는데, 이 시간엔 꼭 하나씩 나가요. 신기하죠."),
      ...think("…이 동네에도, 금요일 점심을 기억하는 사람이 있나 보다."),
    ], { who: "clerk", dir: "down" })]),
    door("ev_fl_kon_door", k.door, [stageIs(V_STAGE, 999)], [], think("뭐라도 사서 나가자.")),
    event("ev_fl_jihu_kon", "강지후", k.door, [page("jk", [swOn("sw_fl_jihu_in_konbini")], [], { who: "jihu", dir: "up" })]),
  );
  add(kon, scene("ev_fl_kon_enter", { x: 1, y: 1 }, S.EVENING, [
    // 점원은 들어오는 손님(문) 쪽을 보며 맞는다 — 왼쪽을 보고 인사했다(VQA r31).
    faceHero("ev_fl_clerk"),
    ...call("clerk", "happy", "어서 오세요~"),
    ...think("(냉장고 쪽을 보자.)"),
    stage(S.KONBINI),
  ]));
  add(kon, event("ev_fl_cooler", "음료 냉장고", k.cooler, [
    page("cool", [stageIs(V_STAGE, S.KONBINI)], [
      ...think("바나나우유. 손이 먼저 간다.", "…아직도 이걸 고르네, 나."),
      playSe("cc0-se-orp-interface-interface2"),
      setSw("sw_fl_jihu_in_konbini", true),
      // 자동문이 다 열린 뒤에 들어선다(VQA r18: 문이 19% 열렸는데 지후가 이미 한 칸 안에 있었다) — 문 칸(문간)에 나타나면 자동문이 열리고,
      // 다 열린 뒤에 한 걸음 들어선다(문 칸은 막힘이라 그 한 걸음만 통과).
      wait(650),
      { kind: "moveEvent", eventId: "ev_fl_jihu_kon", route: { moves: [{ kind: "setThrough", enabled: true }, { kind: "move", dir: "up" }, { kind: "setThrough", enabled: false }], repeat: false, wait: true, skippable: true } } as Command,
      walk("ev_fl_jihu_kon", path(jihuEnter, jihuStop, true)),
      // 주인공은 냉장고 앞(아래 칸)에 서 있다 — 냉장고 칸이 아니라 그 칸에서 지후 쪽으로 돈다.
      face("@player", dirToward(coolerFront, jihuStop)),
      ...emote("player", "exclamation"),
      ...say("seoha", "surprised", "선임님?"),
      { kind: "moveEvent", eventId: "@player", route: { moves: [{ kind: "move", dir: "down" }, { kind: "move", dir: "down" }, { kind: "turn", dir: dirToward(heroTalk, jihuStop) }], repeat: false, wait: true, skippable: true } } as unknown as Command,
      faceHero("ev_fl_jihu_kon"),
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
          walkRoute(project, FL_MAP.konbini, "@player", heroTalk, registerFront, [jihuStop], true, dirToward(registerFront, clerkSpot)),
          walkRoute(project, FL_MAP.konbini, "ev_fl_jihu_kon", jihuStop, jihuRegister, [registerFront, heroTalk], true, dirToward(jihuRegister, registerFront)),
          waitMoves(),
          faceHero("ev_fl_clerk"),
          ...say("clerk", "happy", "원 플러스 원이라 두 개 맞으시죠?"),
          ...say("seoha", "happy", "네."),
          walkRoute(project, FL_MAP.konbini, "@player", registerFront, heroBesideJihu, [jihuRegister], true, dirToward(heroBesideJihu, jihuRegister)),
          faceHero("ev_fl_jihu_kon"),
          listenTo("jihu"),
          // 점원과 말한 뒤 지후에게 돌아선다 — 듣는 사람을 못박지 않으면 자동 돌아보기가 최근 화자(점원) 쪽으로 다시 돌렸다(VQA r22).
          ...sayTo("seoha", "happy", "ev_fl_jihu_kon", "…선임님, 하나 드세요. 모르는 사이끼리도 우유 정도는 사 줄 수 있잖아요."),
          faceHero("ev_fl_jihu_kon"),
          ...say("jihu", "happy", "…그 논리, 좀 이상한데요."),
          ...say("jihu", "embarrassed", "잘 마실게요, 윤서하 씨."),
          ...like(2, "ev_fl_jihu_kon"),
        ] },
        { text: "(하나만 계산하고 가볍게 인사한다)", then: [
          ...say("seoha", "base", "먼저 들어가 보겠습니다. 내일 뵐게요."),
          ...say("jihu", "base", "…네. 조심히 들어가요."),
          // 「먼저 들어가 보겠습니다」 뒤엔 실제로 문 쪽으로 걸어간다(VQA r28: 말만 하고 서 있다가 회상으로 넘어갔다).
          walkRoute(project, FL_MAP.konbini, "@player", heroTalk, { x: k.door.x, y: k.door.y - 1 }, [jihuStop], true, "down"),
          quiet(SE_CHIME, 0.5), // 자동문이 열린다
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
    // 수요일 밤 서하는 자기 책상(오른쪽 덩어리 서쪽 끝 모니터)을 보고 선다 — 빈 통로에서 위(아무것도 없는 쪽)를 보고 있었다(VQA r28).
    transfer(FL_MAP.officePm, wedSeat(a).stand.x, wedSeat(a).stand.y, "up"),
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
  // 야근하는 사람은 자리에 앉아 있다(VQA r25: 「수요일 밤 아무도 안 앉고 통로에 서 있다」). 책상 덩어리 아래 의자 줄(모니터 화면이
  // 화면 쪽을 보는 줄)에 위를 보고 앉힌다 — 등받이가 허리를 가린 «뒤에서 본 앉은 사람». 위 의자 줄(★)에 아래를 보고 세우면 위 층으로
  // 그려도 «의자 뒤에 서 있다»로 읽혔다(VQA r27). 일어날 때는 통과를 켜고 옆 바닥으로 한 걸음.
  // 민호: 서하 책상 왼쪽 덩어리의 오른쪽 끝 아래 의자, 지후: 서하 책상 오른쪽 덩어리의 왼쪽 끝 아래 의자.
  const minhoChair = { x: o.heroDesk.x - 4, y: o.heroDesk.y + 2 };
  const minhoStart = { x: minhoChair.x + 1, y: minhoChair.y };
  // 지후 자리 의자(서하 책상 오른쪽 위) — 빈 의자 이벤트(후드)는 의자 칸에 두고, 지후는 그 왼쪽 바닥에 서서 일한다.
  // 의자 칸은 위층(★) 그림이라 거기 세운 인물은 의자가 몸 위로 그려졌다(VQA r22). nearestFree 는 이제 ★ 칸을 고르지 않는다.
  const jihuChair = { x: o.heroDesk.x + 1, y: o.heroDesk.y + 2 };
  const jihuSeat = { x: jihuChair.x - 1, y: jihuChair.y };
  const jihuPantry = spot(project, FL_MAP.officePm, o.pantry, taken);
  // 「내 옆으로 와 모니터를 들여다봤다」(앉는 그림이 없어 의자 이야기는 뺐다, VQA r10) — 지후는 서하 왼쪽 옆 칸으로 와서 마주 본다(오른쪽 칸은 탕비실로 가는 길이 의자 칸을 지나 막힌다). 흉상 자리는 장면 내내 서하 왼쪽·지후 오른쪽으로 고정(VQA r16)(대사가 말하는 자리를 화면도 보인다).
  // 서하는 지후 자리 오른쪽 둘째 의자(빈 의자 하나 건너)에 앉아 있다 — 주인공은 감추고 같은 칸 아래(의자 뒤 바닥)에 두며,
  // 앉은 서하는 위 층으로 그린 대역 이벤트가 맡는다(VQA r24~r33: 「야근 장면에 서하만 통로에 서 있다」). 일어설 때 대역이 의자 뒤로 한 걸음
  // 나오고 그 칸의 주인공이 나타난다(seohaStands). 지후는 서하 의자 뒤 왼쪽 칸(빈 의자 뒤)으로 와 모니터를 들여다본다.
  const seat = wedSeat(a);
  const seoStand = seat.stand;
  const jihuBeside = { x: seoStand.x - 1, y: seoStand.y };
  if (!isPassable(project, off, jihuBeside.x, jihuBeside.y) || !isPassable(project, off, seoStand.x, seoStand.y)) throw new Error("[first-love] 수요일 서하 자리 뒤 바닥이 막혔다");
  taken.push(jihuBeside);
  // 정직 분기: 통화 중인 팀장에게 자리에서 소리쳐 말하지 않고, 팀장 책상 앞까지 걸어가서 말한다.
  // 팀장 책상 옆 칸(같은 줄 우선) — 위·아래 칸은 두 사람이 한 열로 쌓여 대화창에 가린다.
  const leadFront = [{ x: leadSeat.x - 1, y: leadSeat.y }, { x: leadSeat.x + 1, y: leadSeat.y }, { x: leadSeat.x, y: leadSeat.y + 1 }, { x: leadSeat.x, y: leadSeat.y - 1 }]
    .find((c) => isPassable(project, off, c.x, c.y) && !off.events.some((e) => e.x === c.x && e.y === c.y) && !taken.some((t) => t.x === c.x && t.y === c.y))
    ?? nearestFree(project, off, leadSeat, 2, taken);
  taken.push(leadFront);
  const comeBeside = (): Command[] => [
    ...standUp("ev_fl_w_jihu", jihuChair, jihuSeat, "sw_fl_w_jihu_up"),
    walkRoute(project, FL_MAP.officePm, "ev_fl_w_jihu", jihuSeat, jihuBeside, [seoStand], true, dirToward(jihuBeside, seoStand)),
    face("@player", dirToward(seoStand, jihuBeside)),
    face("ev_fl_w_seoha", "left"),
  ];
  const exit = { stand: { x: o.npcExit.x, y: o.npcExit.y + 1 }, door: o.npcExit };
  // 승강기 문(위 두 줄)이 화면 위에 잘리지 않게 퇴장 동안 카메라를 승강기 홀 쪽으로 올린다(VQA r8: 수요일 카메라가 승강기 윗부분을 자름).
  const liftView = { x: 13, y: 8 };
  const minhoOut = leave(project, FL_MAP.officePm, "ev_fl_w_minho", minhoStart, exit, "sw_fl_minho_left", seoStand, [], liftView);
  /** 앉은 서하(대역)가 의자 뒤로 일어서고, 그 칸의 주인공이 나타난다. */
  const seohaStands = (dir: Dir = "down"): Command[] => [
    { kind: "moveEvent", eventId: "ev_fl_w_seoha", route: { moves: [
      { kind: "setThrough", enabled: true }, { kind: "move", dir: "down" }, { kind: "setThrough", enabled: false }, { kind: "turn", dir },
    ], repeat: false, wait: true, skippable: true } } as unknown as Command,
    face("@player", dir),
    setSw("sw_fl_w_seoha_up", true),
    showPlayer(),
  ];
  const leadOut = leave(project, FL_MAP.officePm, "ev_fl_w_lead", leadSeat, exit, "sw_fl_lead_left", seoStand, [jihuBeside], liftView);

  add(off,
    event("ev_fl_w_lead", "오정민 팀장", leadSeat, [
      page("wl", [stageIs(V_STAGE, S.FLASH), swOff("sw_fl_lead_left")], [...say("lead", "base", "…네, 본부장님. 네. 내일 오전에요.")], { who: "lead", dir: "down" }),
    ]),
    event("ev_fl_w_minho", "차민호", minhoChair, seatedPages("wm", [swOff("sw_fl_minho_left")], "minho", "sw_fl_w_minho_up")),
    event("ev_fl_w_jihu", "강지후", jihuChair, seatedPages("wj", [stageIs(V_STAGE, S.FLASH)], "jihu", "sw_fl_w_jihu_up")),
    // 빈 자리는 따로 — 지후는 탕비실로 걸어가고(같은 이벤트가 위치를 들고 간다), 의자는 제자리에 남는다.
    event("ev_fl_w_chair", "강지후 자리", jihuChair, [
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
        transfer(FL_MAP.officeFri, a.office.meetingSeat.x, a.office.meetingSeat.y, "down"),
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
    event("ev_fl_w_seoha", "윤서하", seat.chair, seatedPages("ws", [swOff("sw_fl_w_seoha_up")], "seoha") /* 수요일 밤 맵에만 있다 — 단계 조건을 걸면 단계가 넘어갈 때 «방 안에서 꺼진다»로 잡힌다 */),
    event("ev_fl_w_desk", "서하 자리", seat.chair, [
      page("wd", [stageIs(V_STAGE, S.WED)], think("다시 보낸 최종본. 파일 이름: ‘하루끝_리뉴얼_최종_진짜최종_서하’.", "…이름은 다음 주에 정리하자.")),
    ]),
  );

  add(off, scene("ev_fl_wed", { x: 1, y: 1 }, S.FLASH, [
    hidePlayer(), // 앉은 서하는 대역(ev_fl_w_seoha)이 맡는다
    ...fadeIn(800),
    bgm(BGM_NIGHT),
    ...caption("수요일 오후 8시 3분."),
    // 민호는 자기 자리(서하 자리에서 네 칸)에서 일어나며 인사한다 — 멀리서 건네는 한마디.
    // 일어서서 서하 쪽(오른쪽)을 보고 인사한다 — 앉아 책상을 본 채 인사했고, 주인공이 숨은 동안은 흉상 자리가 서하 대역을 못 찾아
    // 왼쪽에 앉은 민호가 오른쪽 흉상으로 떴다(VQA r34). 듣는 사람을 서하 대역으로 못박는다.
    ...standUp("ev_fl_w_minho", minhoChair, minhoStart, "sw_fl_w_minho_up"),
    face("ev_fl_w_minho", "right"),
    ...toWhom("ev_fl_w_seoha", call("minho", "happy", "서하 씨, 나 먼저 가요! 내일 봐요—")),
    minhoOut.begin,
    ...minhoOut.end,
    playSe(SE_MAIL),
    ...emote("player", "exclamation"),
    ...think("메일. ‘소리결’ 박 본부장님."),
    ...voice("메일", "‘윤서하 님, 보내 주신 시안이 수정 전 버전인 것 같습니다. 내일 오전 임원 보고에 써야 해서요.’"),
    shake(400),
    // 실수를 안 순간 라운지 피아노를 걷어 낸다 — 아늑한 곡이 위기 내내 흘렀다(VQA r28). 해결된 밤 10시 40분에 돌아온다.
    bgm(BGM_MEETING, 1200),
    ...think("…어? 잠깐만. 최종본 보낸 거, 아니었어?"),
    ...think("폴더 이름이 ‘최종’, ‘최종_진짜’, ‘최종_진짜_수정’.", "내가 보낸 건 ‘최종’이었다."),
    ...think("팀장님은 저쪽에서 통화 중이다. 지후 선배는 아직 자리에 있다."),
    choices([
      { text: "팀장님께 바로 말씀드린다", then: [
        setSw(SW_HONEST, true),
        { kind: "changeFriendship", npcKey: "lead", delta: 220 } as Command,
        // 팀장 책상 앞까지 걸어가 말하고, 팀장도 통화를 멈추고 서하를 본다.
        ...seohaStands(),
        walkRoute(project, FL_MAP.officePm, "@player", seoStand, leadFront, [], true, dirToward(leadFront, leadSeat)),
        faceHero("ev_fl_w_lead"),
        // 장면 첫마디를 서하가 연다 — 듣는 사람을 못박지 않으면 흉상이 저작한 쪽에 떴다가 팀장이 말하는 순간 반대로 바뀌었다(VQA r23 중대).
        ...sayTo("seoha", "sad", "ev_fl_w_lead", "팀장님. 제가 소리결에 시안을 잘못 보냈습니다. 지난주 버전으로요."),
        ...say("lead", "base", "…몇 시에 보냈어요?"),
        ...say("seoha", "sad", "여섯 시 반쯤이요. 죄송합니다."),
        ...say("lead", "happy", "좋아요. 숨기지 않고 바로 말해 줘서 다행이에요. 본부장님한텐 내가 지금 전화할게요."),
        ...say("lead", "base", "서하 씨는 최종본 다시 정리하고."),
        face("ev_fl_w_lead", dirToward(leadSeat, jihuChair)),
        face("ev_fl_w_jihu", dirToward(jihuChair, leadSeat)),
        ...callTo("lead", "base", "ev_fl_w_jihu", "지후 씨, 서하 씨 좀 도와줄래요?"),
        // 지후는 열 칸 밖 자리에 있다 — 멀리서 「네.」로 대답하지 않고 일어나 오는 걸음으로 대답한다(사용자 r2: 너무 멀리서 대화).
        // 팀장의 작별 인사도 서하가 팀장 앞에 서 있을 때 한다.
        face("ev_fl_w_lead", dirToward(leadSeat, leadFront)),
        ...say("lead", "base", "본부장님 전화는 가면서 할게요. 둘 다 너무 늦지 말아요."),
        walkRoute(project, FL_MAP.officePm, "@player", leadFront, seoStand, [jihuBeside], true, "up"),
        ...comeBeside(),
        ...think("지후 선배가 내 옆으로 와 모니터를 들여다봤다. 아주 잠깐, 웃은 것 같았다."),
        ...like(1, "ev_fl_w_jihu"),
        // 팀장은 화면 안에서 걸어 나간다 — 시간 건너뛰기(반쯤 어두운 화면)에 자리에서 사라지지 않는다(VQA r12).
        leadOut.begin,
        ...leadOut.end,
      ] },
      { text: "지후 선배에게만 조용히 도움을 청한다", then: [
        // 두 칸 대각선 너머 지후의 등에 대고 털어놓지 않는다(VQA r28) — 작게 불러 옆으로 오게 한 뒤 마주 보고 말한다.
        face("@player", dirToward(seoStand, jihuChair)),
        face("ev_fl_w_seoha", "left"),
        ...callTo("seoha", "sad", "ev_fl_w_jihu", "…선임님. 잠깐만요."),
        ...comeBeside(),
        ...faceEachOther("@player", "ev_fl_w_jihu"),
        ...sayTo("seoha", "sad", "ev_fl_w_jihu", "저 실수했어요. 시안을 잘못 보냈어요. 팀장님 아시기 전에, 어떻게 좀…"),
        ...toWhom("ev_fl_w_seoha", say("jihu", "base", "…같이 고쳐요.")),
        ...toWhom("ev_fl_w_seoha", say("jihu", "base", "근데 서하 씨. 숨기는 거, 생각보다 오래 무거워요. 나중에 꼭 말씀드려요.")),
        ...think("그 말이 이상하게 오래 남았다."),
        faceHero("ev_fl_w_lead"),
        // 팀장은 자기 자리에서 퇴근 인사를 건넨다 — 멀리서 부르는 한마디(calling).
        ...call("lead", "base", "둘 다 너무 늦게까지 있지 말아요. 먼저 갈게요."),
        leadOut.begin,
        ...like(1, "ev_fl_w_jihu"),
        ...leadOut.end,
      ] },
    ]),
    ...fadeOut(700),
    // 정직 분기의 팀장은 통화를 마치고 시간이 건너뛰는 동안(화면 검정) 퇴근한다 — 보이는 데서 사라지지 않는다.
    setSw("sw_fl_lead_left", true),
    // 시간이 건너뛰는 동안 서하는 다시 자리에 앉아 있다(정직 분기에서 일어섰던 주인공을 감추고 대역을 켠다). 지후는 의자 뒤 옆 칸.
    hidePlayer(),
    setSw("sw_fl_w_seoha_up", false),
    { kind: "moveEvent", eventId: "ev_fl_w_seoha", route: { moves: [{ kind: "placeAt", x: seat.chair.x, y: seat.chair.y }, { kind: "turn", dir: "left" }], repeat: false, wait: true, skippable: true } } as unknown as Command,
    { kind: "moveEvent", eventId: "ev_fl_w_jihu", route: { moves: [{ kind: "placeAt", x: jihuBeside.x, y: jihuBeside.y }, { kind: "turn", dir: "right" }], repeat: false, wait: true, skippable: true } } as unknown as Command,
    face("@player", "left"),
    ...caption("밤 10시 40분."),
    bgm(BGM_NIGHT, 1500),
    ...fadeIn(700),
    ...toWhom("ev_fl_w_seoha", say("jihu", "base", "다 됐어요. 다시 보냈고, 본부장님 답장도 왔어요. ‘확인했습니다, 감사합니다.’")),
    ...say("seoha", "happy", "…감사합니다. 진짜로요."),
    ...toWhom("ev_fl_w_seoha", say("jihu", "base", "서하 씨 시안, 좋았어요. 버튼 누르면 사연 종이가 반으로 접히는 거.")),
    choices([
      { text: "“선배라면 알아볼 줄 알았어요.”", then: [
        ...say("seoha", "embarrassed", "…선배라면 알아볼 줄 알았어요. 방송실 사연함 모양이에요, 그거."),
        ...emote("ev_fl_w_jihu", "exclamation", 900),
        ...toWhom("ev_fl_w_seoha", say("jihu", "embarrassed", "…역시. 어디서 본 것 같더라. 투입구가 비뚤어진 것까지.")),
        ...like(1, "ev_fl_w_jihu"),
      ] },
      { text: "“그냥, 회사 앱이니까요.”", then: [
        ...say("seoha", "base", "그냥, 회사 앱이니까요. 열심히 했을 뿐이에요."),
        ...toWhom("ev_fl_w_seoha", say("jihu", "base", "…그렇죠.")),
        ...think("거짓말이다. 사연 종이가 접히는 그 버튼은, 그 방송실에서 가져온 거였다."),
      ] },
    ]),
    ifCond({ kind: "variable", variableId: V_JIHU, op: ">=", value: 3 } as never,
      toWhom("ev_fl_w_seoha", say("jihu", "happy", "라면 먹을래요? 탕비실에 컵라면 있어요. 먼저 가 있을게요. …오늘은 도망 안 가요.")),
      toWhom("ev_fl_w_seoha", say("jihu", "base", "…배고프면 탕비실에 컵라면 있어요. 물은 내가 올려 둘게요.")),
    ),
    walkRoute(project, FL_MAP.officePm, "ev_fl_w_jihu", jihuBeside, jihuPantry, [seoStand], false, "up"),
    ...seohaStands("left"),
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
  // meetSeats: [0]=주인공(탁자 북서 끝, 발표) [1]=지후(남쪽 의자 줄 동쪽 끝) [2]=민호 [3]=팀장 [4]=본부장 — 듣는 셋은 남쪽 의자에 앉아 위를 본다.
  // 남쪽 의자는 등이 화면 쪽이라 등받이가 하반신만 가린다(북쪽 의자는 얼굴을 덮었다, VQA r7). 맵 아래 덧댄 줄(FRI_PAD)로 카메라가
  // 회의실을 화면 위쪽에 두어 남쪽 의자 줄이 대화창에 가리지 않는다(VQA r5).
  const seats = o.meetSeats;
  const jihuSpot = seats[1]!; const clientSpot = seats[4]!; const leadSpot = seats[3]!; const minhoSpot = seats[2]!;
  // 회의 장면 카메라: 두 배로 당겨 회의실을 화면에 채운다. 맵 폭(26)이 화면(30)보다 좁아 배율 1 에서는 카메라가 맵 가운데에 고정돼
  // 서쪽 끝 회의실이 늘 화면 구석이었고(VQA r10·r25), 아래로 내려 잡으면 빈 띠가 화면을 채웠다(VQA r26). 배율 2 면 보이는 폭이 15칸이라
  // 회의실(x 1~11)을 가운데 쪽으로 잡을 수 있고, 발표자 줄(y 16)이 화면 위에 다 들어오며 아래 앉은 둘(y 19)이 대화창 바로 위, 본부장(탁자 서쪽 머리)이 왼쪽 흉상 위에 온다.
  const meetView = { x: 7, y: 18, zoom: 2 };
  // 회의실 유리문(1×2, 문 그림은 회의실 문 칸 바로 위 두 줄) — 회의 동안 열어 둔다. 닫힌 문을 사람이 그대로 지나갔다(VQA r25).
  const meetDoor: DoorSpec = { x: o.meeting.x, y: o.meeting.y - 1, w: 1, h: 2, style: "slide", hinge: "left", interior: "lit", frame: { l: 2, r: 2, t: 3, b: 1 } };
  // 회의실을 나가는 사람은 회의실 유리문으로 걸어 나가 문 칸에서 사라진다(엔딩 C 의 팀과 같다). 승강기까지 카메라를 끌고 가면
  // 빈 승강기 앞에서 4초씩 두 번 머물러 이 장면의 가장 큰 감정(지후의 마지막 날)이 늘어졌다(VQA r34).
  const meetingExit = (eventId: string, hideSw: string): { begin: Command; end: Command[] } => ({
    begin: { kind: "moveEvent", eventId, route: { moves: [{ kind: "exitVia", x: o.meeting.x, y: o.meeting.y - 1, se: "", closeSe: "" }], repeat: false, wait: false, skippable: true } } as unknown as Command,
    end: [waitMoves(), setSw(hideSw, true)],
  });
  // 본부장 자리(탁자 머리 서쪽)에서 문으로 가는 길은 둘뿐이다 — 발표자 줄(서하 칸)과 앉은 팀 뒤 통로. 앉은 팀 등 뒤로 비집고
  // 지나가면 위 층에 앉은 셋 밑으로 미끄러져 보였다(VQA r34). 서하가 오른쪽으로 한 걸음 비켜 길을 내고, 본부장이 지나간 뒤 돌아온다.
  const heroAside = { x: o.meetingSeat.x + 1, y: o.meetingSeat.y };
  const clientOut = meetingExit("ev_fl_f_client", "sw_fl_client_left");
  // 지후는 의자에서 아래(남쪽) 바닥으로 일어선 뒤 나간다(앉은 동안은 위 층이라 그대로 걸으면 가구 위로 그려진다).
  const jihuUp = { x: jihuSpot.x, y: jihuSpot.y + 1 };
  const jihuOut = meetingExit("ev_fl_f_jihu", "sw_fl_jihu_left");
  add(fri,
    event("ev_fl_f_client", "박 본부장", clientSpot, [page("fc", [swOff("sw_fl_client_left")], [], { who: "client", dir: "right" })]),
    event("ev_fl_f_lead", "오정민 팀장", leadSpot, seatedPages("fl", [], "lead", "sw_fl_f_lead_up")),
    event("ev_fl_f_jihu", "강지후", jihuSpot, seatedPages("fj", [swOff("sw_fl_jihu_left")], "jihu", "sw_fl_f_jihu_up")),
    event("ev_fl_f_minho", "차민호", minhoSpot, seatedPages("fm", [], "minho", "sw_fl_f_minho_up")),
    door("ev_fl_f_elev2", o.npcExit, [stageIs(V_STAGE, 999)], [], think("…"), "down"),
  );
  add(fri, scene("ev_fl_fri", { x: 1, y: 1 }, S.WED_TALK, [
    panTo(meetView.x, meetView.y, 0, meetView.zoom),
    ...doorFx(meetDoor, true, 1),
    ...fadeIn(800),
    bgm(BGM_MEETING),
    ...caption("금요일 오후 3시. 회의실."),
    ...faceEachOther("ev_fl_f_lead", "ev_fl_f_jihu"),
    ...toWhom("ev_fl_f_jihu", sayAt("lead", "left", "base", "지후 씨, 본부장님 앞인데 오늘도 후드예요?")),
    ...toWhom("ev_fl_f_lead", say("jihu", "embarrassed", "…재킷은 가방에 있어요. 이게 머리가 더 잘 돌아가서요.")),
    ...emote("ev_fl_f_minho", "sweat"),
    // 탁자 머리의 본부장이 말을 열면 발표자 둘(서하·지후)이 그쪽을 본다.
    face("@player", dirToward(o.meetingSeat, clientSpot)),
    face("ev_fl_f_jihu", dirToward(jihuSpot, clientSpot)),
    face("ev_fl_f_client", "right"), // 탁자 머리에서 탁자와 발표자 쪽을 본다
    // 민호는 본부장 옆자리 — 팀장의 농담(서쪽) 뒤엔 본부장·발표자 쪽(동쪽)을 본다.
    face("ev_fl_f_minho", dirToward(minhoSpot, clientSpot)),
    ...sayAt("client", "left", "base", "그럼 시작하시죠. 이번 리뉴얼, 핵심이 뭡니까?"),
    // 지후의 발표도 본부장에게 — 못박지 않으면 직전 화자가 아닌 옆자리 서하가 듣는 흉상으로 떴다(VQA r25).
    ...toWhom("ev_fl_f_client", say("jihu", "base", "재생 엔진을 새로 짜서, 하루끝 방송이 1초 안에 시작됩니다. 그리고 화면은—")),
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
        ...toWhom("ev_fl_f_client", sayAt("seoha", "right", "base", "고등학교 때, 방송부 점심 방송에 매주 사연을 보냈어요. 익명으로요.")),
        ...toWhom("ev_fl_f_client", sayAt("seoha", "right", "sad", "마지막 사연은 끝내 방송되지 못했어요. 그 사람이 먼저 떠났거든요.")),
        ...toWhom("ev_fl_f_client", sayAt("seoha", "right", "base", "그래서 이걸 만들었습니다. ‘늦은 답장’. 지난 사연에, 언제든 답장을 보낼 수 있는 기능입니다.")),
        // 호감 알림은 지후가 놀라는 그 순간에 — 본부장 말 뒤 팀장 인사 위에 뜨면 뜻이 없었다(VQA r34).
        ...emote("ev_fl_f_jihu", "exclamation", 1300),
        ...like(2, "ev_fl_f_jihu"),
        ...sayAt("client", "left", "base", "…"),
        ...sayAt("client", "left", "happy", "좋네요. 라디오가 원래 그런 거죠. 늦게라도, 닿는 거."),
      ] },
      { text: "데이터로 설명한다", then: [
        ...toWhom("ev_fl_f_client", sayAt("seoha", "right", "base", "사연을 들은 사람의 63%가 일주일 안에 같은 방송을 다시 찾습니다. 하지만 지금은 답할 방법이 없어요.")),
        ...toWhom("ev_fl_f_client", sayAt("seoha", "right", "base", "그래서 ‘늦은 답장’을 넣었습니다. 지난 사연에 언제든 답장을 보낼 수 있는 기능입니다.")),
        ...sayAt("client", "left", "happy", "숫자가 탄탄하네요. 좋습니다. 이대로 가시죠."),
      ] },
    ]),
    ...faceEachOther("ev_fl_f_lead", "ev_fl_f_client"),
    ...toWhom("ev_fl_f_client", sayAt("lead", "left", "happy", "그럼 다음 주부터 2차 개발 들어가겠습니다. 감사합니다, 본부장님.")),
    { kind: "moveEvent", eventId: "@player", route: { moves: [{ kind: "move", dir: dirToward(o.meetingSeat, heroAside) }, { kind: "turn", dir: "left" }], repeat: false, wait: true, skippable: true } } as unknown as Command,
    clientOut.begin,
    face("ev_fl_f_minho", dirToward(minhoSpot, heroAside)),
    ...sayAt("minho", "left", "happy", "대박! 서하 씨, 첫 주에 발표 통과! 오늘 회식 각이에요!"),
    ...clientOut.end,
    { kind: "moveEvent", eventId: "@player", route: { moves: [{ kind: "move", dir: dirToward(heroAside, o.meetingSeat) }, { kind: "turn", dir: "down" }], repeat: false, wait: true, skippable: true } } as unknown as Command,
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
    ...standUp("ev_fl_f_jihu", jihuSpot, jihuUp, "sw_fl_f_jihu_up"),
    jihuOut.begin,
    stopBgm(),
    face("@player", dirToward(o.meetingSeat, leadSpot)),
    // 지후가 나간 뒤 팀장은 남은 팀(서하)에게 말한다 — 떠난 지후의 흉상이 듣는 쪽에 남지 않게(VQA r19).
    listenTo("seoha", "base", "right"),
    ...sayAt("lead", "left", "base", "그리고… 다들 알다시피, 오늘이 지후 씨 마지막 날이에요."),
    ...emote("player", "exclamation"),
    ...sayAt("seoha", "right", "surprised", "…네?"),
    // 충격 뒤엔 쓸쓸한 현 — 포근한 회상 곡(rst-001)이 「…네?」의 충격을 눌렀다(VQA r34).
    bgm(BGM_RAIN, 2000),
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
        // 회의실 유리문으로 나가 승강기까지 걸어가 타고 내려간다 — 유리문에서 바로 거리로 옮기면 7층에서 승강기를 건너뛰었다(VQA r21·r22).
        // 배율 2 그대로 카메라가 서하를 따라간다 — 배율 1로 되돌리면 2→1 로 끊겼고(VQA r29), 승강기 쪽으로 먼저 옮기면
        // 서하가 2.7초 동안 화면 밖이었다(r30 중대).
        m2("Camera Control", { mode: "return", target: "player", x: 0, y: 0, zoom: 2, durationMs: 700, wait: true, easing: "easeInOut" }),
        walkRoute(project, FL_MAP.officeFri, "@player", o.meetingSeat, o.elevatorOut, [leadSpot, minhoSpot, clientSpot], true, "up"),
        quiet(SE_BUTTON), wait(400),
        playSe(SE_ELEVATOR), wait(300),
        quiet(SE_SLIDE, 0.45), ...doorFx(elevDoor(o.elevator), true, 700),
        { kind: "moveEvent", eventId: "@player", route: { moves: [
          { kind: "setThrough", enabled: true }, { kind: "move", dir: "up" }, { kind: "move", dir: "up" }, { kind: "turn", dir: "down" }, { kind: "setThrough", enabled: false },
        ], repeat: false, wait: true, skippable: true } } as unknown as Command,
        wait(250),
        quiet(SE_SLIDE, 0.45), ...doorFx(elevDoor(o.elevator), false, 700),
        wait(300),
        ...fadeOut(600),
        panBack(0), // 승강기 카메라 배율(2)을 거리로 들고 가지 않는다
        stopBgm(),
        stage(S.FRI),
        transfer(FL_MAP.streetPm, a.street.officeOut.x, a.street.officeOut.y, "down"),
      ] },
      { text: "회식에 간다", then: [
        ...think("발을 떼지 못했다. 10년 전에도, 오늘도."),
        ...sayAt("minho", "left", "happy", "좋아요! 오늘은 내가 쏩니다. …아, 법카로요."),
        ...faceEachOther("ev_fl_f_lead", "ev_fl_f_minho"),
        ...toWhom("ev_fl_f_minho", sayAt("lead", "left", "happy", "민호 씨.")),
        ...emote("ev_fl_f_minho", "sweat"),
        face("@player", dirToward(o.meetingSeat, leadSpot)),
        ...sayAt("lead", "left", "base", "서하 씨, 첫 주 수고했어요. 가요, 다 같이."),
        // 팀은 먼저 가고 서하는 혼자 나온다 — 「다 같이」 뒤에 팀이 한 번도 안 보이고 서하 혼자 비 속에 서 있었다(VQA r23).
        ...sayAt("seoha", "right", "base", "먼저들 가 계세요. 정리하고 금방 따라갈게요."),
        // 「가요, 다 같이」 뒤엔 팀이 실제로 일어선다(VQA r28: 말만 하고 앉아 있다).
        ...standUp("ev_fl_f_lead", leadSpot, { x: leadSpot.x, y: leadSpot.y + 1 }, "sw_fl_f_lead_up"),
        ...standUp("ev_fl_f_minho", minhoSpot, { x: minhoSpot.x, y: minhoSpot.y + 1 }, "sw_fl_f_minho_up"),
        face("ev_fl_f_minho", dirToward(minhoSpot, o.meetingSeat)),
        ...sayAt("minho", "left", "happy", "고깃집 2층이에요! 늦으면 서하 씨 몫 없어요~"),
        // 둘은 회의실 유리문 쪽으로 걸어 나간다 — 일어서기만 하고 컷되면 «아무도 안 나간다»였다(VQA r29). 서하는 남아 정리한다.
        // 회의실 유리문으로 걸어 나가 문 칸에서 사라진다(exitVia) — 문 앞까지만 걸으면 «방 한가운데서 끊겼다»(VQA r31·r32).
        // 문 쪽(오른쪽)에 선 민호가 먼저 — 팀장이 먼저 나서면 오른쪽 민호와 회의석의 서하가 두 길을 다 막아 길 찾기가 실패하고,
        // 팀장이 제자리에서 깜박 사라졌다 다시 나타나 그대로 섰다(VQA r34 중대). 민호가 비킨 뒤에 팀장이 따라 나간다.
        { kind: "moveEvent", eventId: "ev_fl_f_minho", route: { moves: [{ kind: "exitVia", x: o.meeting.x, y: o.meeting.y - 1, se: "", closeSe: "" }], repeat: false, wait: false, skippable: true } } as unknown as Command,
        wait(1300),
        { kind: "moveEvent", eventId: "ev_fl_f_lead", route: { moves: [{ kind: "exitVia", x: o.meeting.x, y: o.meeting.y - 1, se: "", closeSe: "" }], repeat: false, wait: true, skippable: true } } as unknown as Command,
        waitMoves(),
        // 엔딩 C 의 비(VQA r8: 「비가 오기 시작했다」는 말뿐 비가 없다) — 검은 화면에서 빌딩 앞 밤거리로 옮기고, 비는 거기 장면이 내린다.
        // 실내에 비를 뿌리지 않는다. 옮긴 뒤의 명령은 이 맵 이벤트에서 돌지 않으므로 이어지는 연출은 밤거리의 ev_fl_dinner_rain 이 한다.
        ...fadeOut(700),
        panBack(0), // 회의 카메라 배율(2)을 밤거리로 들고 가지 않는다
        stage(S.DINNER),
        transfer(FL_MAP.streetPm, a.street.officeOut.x, a.street.officeOut.y, "down", "none"),
      ] },
    ]),
  ]));
  add(fri,
    door("ev_fl_f_elev", o.elevator, [stageIs(V_STAGE, 999)], [], think("…"), "down"),
  );
}

/** 대사 줄의 듣는 사람을 못박는다(발표는 본부장에게 — 옆자리 지후가 최근 화자라 자동으로는 지후에게 갔다, scene-turn-overridden). */
function toWhom(addressee: string, cmds: Command[]): Command[] {
  return cmds.map((c) => (c.kind === "text" ? ({ ...c, addressee } as Command) : c));
}

function buildClimax(project: Project, a: FirstLoveAnchors): void {
  const street = project.maps[FL_MAP.streetPm]!;
  const plat = project.maps[FL_MAP.platformPm]!;
  const p = a.platform;

  add(street, scene("ev_fl_end_b_street", { x: 4, y: 1 }, S.END_B_STREET, [
    panBack(0),
    { kind: "setWeather", weather: "none", transitionMs: 0 } as Command,
    ...fadeIn(900),
    wait(700),
    stage(S.PLATFORM + 100),
    { kind: "triggerEnding", endingId: END_B } as Command,
  ]));
  add(street, scene("ev_fl_dinner_rain", { x: 3, y: 1 }, S.DINNER, [
    // 앞 맵에서 옮긴 카메라 좌표가 남아 빈 길을 비췄다(VQA r11) — 화면이 검을 때 서하에게 돌려 둔다.
    panBack(0),
    // 비가 거의 안 보였다(VQA r22·r27) — 놓친 밤은 굵고 긴 빗줄기(storm)로.
    { kind: "setWeather", weather: "storm", intensity: 1, transitionMs: 0 } as Command,
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
    // 밤거리 맵 BGM(라운지 피아노)이 질주에 깔리지 않게 — 화면이 검을 때 끊는다. 느린 단조 바이올린(flt-017)은 「뛰자」와 반대 정서였다
    // (VQA r25) — 음악 없이 빗소리 위로 심장 소리 두 번이 시간을 센다. 승강장의 고백 곡은 지후를 만난 뒤에 들어온다.
    stopBgm(),
    ...fadeIn(500),
    { kind: "setWeather", weather: "rain", intensity: 0.6, transitionMs: 800 } as Command,
    quiet(SE_PULSE, 0.8), wait(700), quiet(SE_PULSE, 0.8),
    ...caption("오후 9시 21분. 9시 40분 열차까지 19분."),
    ...think("뛰자.", "(지하철 입구로!)"),
    stage(S.RUN),
  ]));

  const jihuSpot = p.jihu;
  // 열차를 기다리는 사람은 선로(아래)를 본다 — 벽을 보고 서 있지 않는다.
  add(plat, event("ev_fl_p_jihu", "강지후", jihuSpot, [
    page("pj", [swOff("sw_fl_jihu_boarded")], [], { who: "jihu", dir: "down" }),
    // 열린 문 안(차량 옆면 칸)에 선 동안은 열차 그림 위(above)에 그린다.
    // 문간의 지후는 3/4 크기로 — 원래 크기면 문(14×21px)보다 커서 «차량 옆면 창문 위에 붙여 그렸다»로 읽혔다(VQA r31 중대).
    // 작게 그리면 열린 문 안쪽(한 걸음 들어간 자리)에 선 사람으로 읽힌다.
    scaledPage(page("pj_door", [swOff("sw_fl_jihu_boarded"), swOn("sw_fl_jihu_in_door")], [], { who: "jihu", dir: "down", priority: "above" } as Parameters<typeof page>[3]), 0.72),
  ]));
  const meet = { x: jihuSpot.x - 1, y: jihuSpot.y };
  // 지후가 탄다 — 막차는 장면이 부르고(FL_TRAIN_CALL) 문을 연 채 붙잡아 둔다(FL_TRAIN_GO 가 꺼진 동안). 지후가 안전선을 지나
  // 탑승 표시에서 사라진 뒤에야 문을 닫고 떠난다(VQA r17: 「열차가 지후를 두고 떠난다」).
  // 탑승 표시(st-boarding-mark, y9)에 선다 — 안전선 줄(y10)은 3/4 시점에서 열차 지붕 그림 밑이라 거기 선 사람은 지붕에 가린다(VQA r19).
  // 탑승: 서 있는 열차의 열린 문(정차 위치가 정해져 있어 문 하나가 x≈38 에 온다) 바로 위 탑승 표시까지 걸어가 서하를 돌아본다.
  // 3/4 시점에서 승강장(북)에서 열차로 걸어 내려가면 지붕 위로 올라섰다(VQA r19·r26·r28 중대), 검은 화면에 사라지기만 하면
  // 「문도 안 열리고 사라졌다」였다(r28). 짧게 어두워진 사이 지후를 열린 문 안(차량 옆면 칸, 위 층)에 세우고, 밝아지면 문간에서
  // 서하 쪽을 보고 서 있다가 문이 닫히는 순간 사라진다 — 문이 닫히고 열차가 떠난다.
  const boardX = 38;
  const edge = { x: boardX, y: 9 };
  const inDoor = { x: boardX, y: 11 };
  const jihuBoards = (): Command[] => [
    walk("ev_fl_p_jihu", route(project, FL_MAP.platformPm, jihuSpot, edge, [meet])),
    face("ev_fl_p_jihu", dirToward(edge, meet)),
    wait(700),
    ...fadeOut(400),
    { kind: "moveEvent", eventId: "ev_fl_p_jihu", route: { moves: [{ kind: "placeAt", x: inDoor.x, y: inDoor.y }, { kind: "turn", dir: "down" }], repeat: false, wait: true, skippable: true } } as unknown as Command,
    setSw("sw_fl_jihu_in_door", true),
    face("@player", "down"),
    wait(300),
    ...fadeIn(500),
    wait(1600), // 문간에서 돌아본다
    setSw(FL_TRAIN_GO, true), // 1.5초 뒤 문이 닫히고 떠난다
    quiet(SE_TRAIN_CHIME, 0.5),
    wait(1200),
    quiet(SE_TRAIN_DOOR, 0.55), // 문이 닫힌다
    wait(250),
    setSw("sw_fl_jihu_boarded", true),
    wait(700),
    quiet(SE_TRAIN, 0.45), quiet(SE_TRAIN_AIR, 0.3), // 떠나는 열차 — 모터와 밀려나는 바람
    wait(1400), quiet(SE_TRAIN, 0.34),
    wait(1400), quiet(SE_TRAIN, 0.22), quiet(SE_TRAIN_AIR, 0.18),
    wait(1400),
  ];
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
    // 막차가 실제로 들어온다 — 안내 방송에 맞춰 부르고, 둘이 선로 쪽을 보는 사이 열차가 미끄러져 들어와 서고 문이 열린다(사용자 r2).
    setSw(FL_TRAIN_CALL, true),
    ...voice("안내 방송", "‘열차가 들어오고 있습니다. 안전선 뒤로 한 걸음 물러서 주십시오.’"),
    quiet(SE_TRAIN, 0.5), quiet(SE_TRAIN_AIR, 0.35), // 들어오는 열차 — 모터와 밀려드는 바람
    face("@player", "down"),
    face("ev_fl_p_jihu", "down"),
    shake(600),
    // 열차가 화면을 지나는 7초 내내 소리가 이어진다 — 처음 2.4초만 울리고 조용히 미끄러져 들어왔다(VQA r34). 모터를 줄여 가며 세 번, 제동 바람, 서면 «딩동».
    wait(1500), quiet(SE_TRAIN, 0.42),
    wait(1500), quiet(SE_TRAIN, 0.32), quiet(SE_TRAIN_AIR, 0.28),
    wait(1700), quiet(SE_TRAIN_AIR, 0.22),
    wait(1300), quiet(SE_TRAIN_CHIME, 0.5),
    wait(400),
    quiet(SE_TRAIN_DOOR, 0.55), // 문이 열린다
    wait(500),
    ...faceEachOther("@player", "ev_fl_p_jihu"),
    choices([
      { text: "“이번엔, 내가 먼저 말할게요.”", then: [
        ifCond({ kind: "variable", variableId: V_JIHU, op: ">=", value: TRUE_END_AT } as never, [
          ...say("seoha", "base", "이번엔 내가 먼저 말할게요."),
          ...say("seoha", "embarrassed", "선배. 나 아직도, 금요일마다 급식 줄 늦게 서는 사람이에요."),
          ...say("jihu", "embarrassed", "…그건, 내 대사였어야 하는데."),
          flash("white", 700),
          ...memoryPictureIn(255, 1800),
          ...sayOver("jihu", "윤서하. 10년 늦은 답장이에요.", "나도 좋아했어. 그 금요일에도. 지금도."),
          ...memoryPictureOut(1600),
          ...emote("ev_fl_p_jihu", "heart", 1600),
          memoryPictureErase(),
          ...say("jihu", "base", "부산은 가야 해요. 아버지 혼자 계시니까. 근데—"),
          ...say("jihu", "happy", "KTX로 두 시간 사십 분이에요. 금요일마다 올게요. 이번엔, 진짜 약속해요."),
          ...say("seoha", "happy", "…늦으면, 사연 보낼 거예요. 하루끝에. 실명으로."),
          ...jihuBoards(),
          ...fadeOut(1200),
          stopBgm(),
          ...endingOpen("oprn-first-love-ending-a"),
          { kind: "triggerEnding", endingId: END_A } as Command,
        ], [
          ...memoryPictureIn(255, 1600),
          ...sayOver("seoha", "좋아했어요. 그 금요일에도. 지금도."),
          ...memoryPictureOut(1400),
          ...say("jihu", "sad", "…고마워요. 정말로."),
          memoryPictureErase(),
          ...say("jihu", "sad", "근데 지금 대답하면, 그건 또 도망치는 대답 같아요. 떠나는 사람이 할 말이 아니라서."),
          ...say("jihu", "base", "답장은 여기 써 뒀어요. 열차 떠나면 읽어요."),
          playSe(SE_PAPER),
          ...jihuBoards(),
          ...fadeOut(1200),
          stopBgm(),
          ...endingOpenNight(a),
        ]),
      ] },
      { text: "“…잘 가요, 선배.”", then: [
        ...say("seoha", "sad", "…잘 가요, 선배. 이번엔 인사했어요."),
        ...say("jihu", "sad", "…응. 잘 지내, 서하야."),
        ...say("jihu", "base", "이거. 답장이에요. 10년 늦었지만."),
        playSe(SE_PAPER),
        ...jihuBoards(),
        ...fadeOut(1200),
        stopBgm(),
        ...endingOpenNight(a),
      ] },
    ]),
  ]));
}

/**
 * 엔딩 직전 — 검게 덮은(fadeOut) 화면에서 에필로그 그림을 먼저 깔고 덮개를 걷는다. 엔딩의 에필로그 그림은 페이드의 검은 색조 아래에
 * 그려져 글이 검은 화면에 떴다(VQA r10). 같은 그림·자리(fl_epilogue)라 에필로그의 그림 명령은 그대로 이어진다.
 */
/**
 * 엔딩 B — 열차가 떠난 뒤 혼자 지상으로 올라온다. 밤 거리의 지하철 출입구 앞에 선 서하 위로 에필로그가 흐른다
 * (밤하늘 파노라마를 화면 가득 깔면 형체 없는 보라 구름 결이라 「미완성 자리표시」로 읽혔다 — VQA r20).
 */
function endingOpenNight(a: FirstLoveAnchors): Command[] {
  // 이동 뒤 명령은 돌지 않는다 — 도착 맵의 자동 장면(ev_fl_end_b_street, 단계 END_B_STREET)이 걷어 내고 엔딩을 연다.
  return [
    stage(S.END_B_STREET),
    transfer(FL_MAP.streetPm, a.street.subwayOut.x, a.street.subwayOut.y, "down", "none"),
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
  // 크레딧은 플레이어가 읽는 글이다 — 내부 자산 낱말(흉상·걷기 칩·번들 id·곡 번호)을 늘어놓지 않는다(VQA r32).
  "인물 그림   OPRN 공용 초상화 · 도트 캐릭터",
  "배경   OPRN 도시 · 역 · 사무실 도트",
  "음악 · 효과음   CC0 음원",
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
    presentation: { musicResourceId: BGM_HAPPY, tone: "warm", kicker: "엔딩 A · 두 사람의 이야기", credits: ENDING_CREDITS, backgroundResourceId: "oprn-first-love-ending-a" },
    epilogue: [
      // 타이틀 그림(다른 남자)이 아니라 게임 속 두 사람(서하·지후 공용 초상)이 노을 아래 선 카드(VQA r25).
      epiloguePicture("oprn-first-love-ending-a"),
      { kind: "say", text: "석 달 뒤, 금요일 저녁." }, // 그림이 노을 옥상이다 — 「밤」이면 글과 그림이 어긋났다(VQA r23)
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
    presentation: { musicResourceId: BGM_END_B, tone: "warm", kicker: "엔딩 B · 10년 늦은 인사", credits: ENDING_CREDITS, backgroundResourceId: "oprn-first-love-ending-b" },
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
    name: "비 오는 금요일", // 「우리 팀의 봄」인데 팀은 나오지 않고 서하 혼자 비 속에 섰다(VQA r23)
    conditions: [],
    presentation: { musicResourceId: BGM_END_C, tone: "warm", kicker: "엔딩 C · 첫 주의 끝", credits: ENDING_CREDITS, backgroundResourceId: "oprn-first-love-ending-c" },
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
    [SW_KNOWS_WHY, "지후가 떠난 이유를 들음"], [SW_COFFEE, "옥상 캔커피"], [SW_MILK, "바나나우유 두 개"], [SW_STORY, "발표에서 내 이야기를 함"], [SW_BUMPED, "출근길 횡단보도에서 부딪힘"],
    ["sw_fl_jihu_in_konbini", "편의점에 지후 등장"], ["sw_fl_flashback", "회상 중"], ["sw_fl_jihu_gone", "회상: 지후 퇴장"],
    ["sw_fl_lead_left", "수요일: 팀장 퇴근"], ["sw_fl_jihu_boarded", "막차: 지후 탑승"], [FL_TRAIN_CALL, "막차: 열차 부르기"], [FL_TRAIN_GO, "막차: 문 닫고 출발"], ["sw_fl_minho_left", "수요일: 민호 퇴근"], ["sw_fl_closed_note", "수첩을 덮어 둠"], ["sw_fl_jihu_in_door", "막차: 지후 문간"], ["sw_fl_w_seoha_up", "수요일: 서하 일어섬"], ["sw_fl_w_jihu_up", "수요일: 지후 일어섬"], ["sw_fl_w_minho_up", "수요일: 민호 일어섬"], ["sw_fl_f_lead_up", "금요일: 팀장 일어섬"], ["sw_fl_f_jihu_up", "금요일: 지후 일어섬"], ["sw_fl_f_minho_up", "금요일: 민호 일어섬"],
    ["sw_fl_client_left", "금요일: 본부장 퇴장"], ["sw_fl_jihu_left", "금요일: 지후 퇴장"], ["sw_fl_admitted", "옥상: 지후가 기억한다고 말함"],
  ] as const) ensureSw(id, name);

  defineEndings(project);
  buildMondayMorning(project, anchors);
  buildMondayOffice(project, anchors);
  buildMondayNight(project, anchors);
  buildWednesday(project, anchors);
  buildFriday(project, anchors);
  buildClimax(project, anchors);
  // NPC 끼리 말하는 줄(sayTo)의 듣는 흉상 = 듣는 이벤트의 인물(흉상 좌우는 런타임이 맵 위 자리로 정한다).
  fillListenerBusts(Object.values(project.maps));

  // 맵 BGM(장면이 바꾸지 않을 때의 바탕).
  const mapBgm: Record<string, string> = {
    [FL_MAP.platformAm]: BGM_OFFICE, [FL_MAP.street]: BGM_OFFICE, [FL_MAP.office]: BGM_OFFICE, [FL_MAP.officeFri]: BGM_MEETING,
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
  // 차는 다닌다(사용자 r3: 업무 지구엔 차량 통행). 다만 오토바이·긴급차는 빼 둔다(r2 「돌아다니는 오토바이」) — firstLoveMaps 거리 후처리.

  // 오프닝 A: 게임은 출근길 거리의 지하철 출구에서 시작한다(오프닝 몽타주 C 바로 뒤).
  project.startMapId = FL_MAP.street;
  project.startPos = anchors.street.arrive;
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
