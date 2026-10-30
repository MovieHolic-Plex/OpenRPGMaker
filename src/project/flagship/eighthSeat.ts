/**
 * 『여덟째 자리』 — 마법 학원 한 학기 데모(설계서 docs/games/academy/design.md).
 *
 * 장학석은 여덟, 장학생은 아홉. 겨울 시험 뒤 꼴찌 둘이 결정전을 치르고, 진 사람은 학원에서 만난 사람의 기억을 두고 떠난다.
 * 흐름은 변수 둘이 쥔다: var_es_week(1~6) · var_es_stage(그 주 안의 장면 번호). 맵에 들어가면 그 단계의 자동 장면이 한 번 돌고 단계를 올린다.
 * 맵은 eighthSeatMaps.ts, 결투는 eighthSeatBattle.ts, 오프닝은 eighthSeatOpening.ts, 설정집은 eighthSeatLore.ts.
 * 인물·학원·주문 이름은 모두 지어낸 것이다. 원작 이름과 스토어 바꿈말(기숙사 넷)은 플레이어 글에 쓰지 않는다.
 *
 * M1(첫 5분): 오프닝 → 숲 승차장 도착 → 입학 연회 → 결투 1(연습 갑옷) → 첫날 밤 「여덟 자리야」.
 */
import { charsetFrameIndex } from "@/assets/easyrpgRtp";
import { runTool } from "@/editor/tools/toolRunner";
import "@/editor/tools/toolRegistry";
import { createBlankProject } from "@/project/defaults";
import { DEFAULT_ACTOR_ID } from "@/project/defaults/constants";
import { deserialize, serialize } from "@/project/io";
import type { Command, Dir, EventPage, EventPageCondition, GameEvent, GameMap, Project } from "@/project/types";
import { FLAGSHIP_BEAT_MANIFESTS } from "./beats";
import { ES_HERO, SK, SW_DUEL_WON, TR, buildEighthSeatBattle } from "./eighthSeatBattle";
import { buildEighthSeatLore } from "./eighthSeatLore";
import { buildEighthSeatMaps, ES_MAP, ES_MAP_NAMES, freeCell, type Cell, type EsAnchors } from "./eighthSeatMaps";
import { buildEighthSeatOpening, chipTexture, ES_CHIPS } from "./eighthSeatOpening";
import { choices, fadeIn, fadeOut, letterbox, m2, playSe, setSw, setVar, stageIs, wait, walk, approach, faceHero, faceToward, bgm, stopBgm } from "./firstLoveKit";
import type { FlagshipDemoBuildResult } from "./types";

// ── 상태 ──
export const V_WEEK = "var_es_week";
export const V_STAGE = "var_es_stage";
export const V_SERA = "var_es_sera";
export const V_TEO = "var_es_teo";
export const V_PREP = "var_es_prep";
export const V_CLUE = "var_es_clue";
const SW_FEAST_DONE = "sw_es_feast_done";

/** 1주 장면 번호. */
const S = { ARRIVE: 0, CORRIDOR: 1, TO_DUEL: 3, DUEL: 4, AFTER_DUEL: 5, NIGHT: 6, NIGHT_DONE: 7 } as const;

export const END = { both: "end_es_both_stay", kept: "end_es_seat_kept", cold: "end_es_cold_first", boat: "end_es_boat_home" } as const;

// ── 음악 (CC0 카탈로그) ──
const BGM = {
  title: "cc0-bgm-rtp-hlc-002",     // 별을 읽는 회랑의 밤
  opening: "cc0-bgm-rtp-hlc-004",   // 고지대 학문 도시 — 하프 변주
  coach: "cc0-bgm-rtp-ngt-001",     // 달빛 간이역
  day: "cc0-bgm-rtp-hlc-001",       // 바람 계단의 오전 수업
  feast: "cc0-bgm-rtp-hlc-004",
  library: "cc0-bgm-rtp-rst-003",   // 촛불 아래 서가
  clock: "cc0-bgm-rtp-mys-002",     // 잠든 종탑
  night: "cc0-bgm-rtp-hlc-002",
  exam: "cc0-bgm-rtp-hlc-005",      // 시험 전의 조용한 뜰
  letters: "cc0-bgm-rtp-emo-001",   // 전하지 못한 편지
  duel: "cc0-bgm-rtp-btl-001",      // 선봉의 신호
  ending: "cc0-bgm-rtp-mgv-004",    // 솔로 첼로
} as const;

const SE = { door: "cc0-se-osx-door-close-02", page: "cc0-se-osx-paper-04", bell: "cc0-se-osx-bell-01", chime: "cc0-se-orp-interface-interface1" } as const;

// ── 인물 ──
type Who = "ren" | "sera" | "teo" | "idel" | "brandt" | "orben" | "dowin" | "gus" | "healer";
const NAME: Record<Who, string> = { ren: "렌", sera: "세라", teo: "테오", idel: "이델", brandt: "브란트", orben: "오르벤", dowin: "도윈", gus: "구스", healer: "야간 치료사" };

function execTool(project: Project, name: string, args: Record<string, unknown>): { data?: unknown; summary?: string } {
  const ctx = { project, assistantRun: false };
  const res = runTool(ctx, name, args, { dryRun: false });
  if (!res.ok) throw new Error(`[eighth-seat] ${name} failed: ${res.summary} ${JSON.stringify(res.issues ?? [])}`);
  Object.assign(project, ctx.project);
  return { data: res.data, summary: res.summary };
}

// ── 대사 ── 흉상이 없다(Wizarding 흉상 없음, 설계서 2.3) — 이름표 대사창과 칩 연기로 간다.
const line = (who: Who, ...bodies: string[]): Command[] => bodies.map((body) => ({ kind: "text", speaker: NAME[who], body, position: "bottom" } as Command));
const think = (...bodies: string[]): Command[] => bodies.map((body) => ({ kind: "text", body, position: "bottom", context: "thought" } as Command));
const note = (...bodies: string[]): Command[] => bodies.map((body) => ({ kind: "text", body, position: "bottom", context: "narration" } as Command));
const voice = (speaker: string, ...bodies: string[]): Command[] => bodies.map((body) => ({ kind: "text", speaker, body, position: "bottom" } as Command));
const pause = (ms = 500): Command => wait(ms);
const stage = (n: number): Command => setVar(V_STAGE, "=", n);
const journal = (lineId: string, writer: string, date: string, text: string): Command => m2("Journal Line", { action: "write", lineId, writer, date, text });
const learn = (skillId: string): Command => ({ kind: "learnSkill", actorId: ES_HERO, skillId, action: "learn" } as Command);

// ── 이벤트 ──
type ChipKey = keyof typeof ES_CHIPS;
function page(id: string, conditions: EventPageCondition[], commands: Command[], opts: { who?: ChipKey | { sheet: number; index: number }; dir?: Dir; trigger?: "action" | "auto" | "playerTouch" | "parallel"; priority?: "below" | "same" | "above"; through?: boolean } = {}): EventPage {
  const chip = typeof opts.who === "string" ? ES_CHIPS[opts.who] : opts.who;
  const dir = opts.dir ?? "down";
  return {
    id, name: id, conditions,
    graphic: chip
      ? { sprite: { type: "bundled", id: chipTexture(chip) }, direction: dir, pattern: charsetFrameIndex({ characterIndex: chip.index, direction: dir, pattern: 1 }), transparent: false }
      : { direction: dir, pattern: 0, transparent: true },
    movement: { type: "fixed", speed: chip ? 4 : 3, frequency: 3 },
    priority: opts.priority ?? (chip ? "same" : "below"),
    // 「같은 층」 빈 그림 이벤트(게시판·침대)는 몸이 있다 — 막고, 마주 보고 누르면 발동한다.
    overlapForbidden: !!chip || opts.priority === "same",
    ...(opts.through ? { through: true } : {}),
    trigger: { kind: opts.trigger ?? "action" },
    commands,
  } as unknown as EventPage;
}
function event(id: string, name: string, at: Cell, pages: EventPage[]): GameEvent {
  return { id, name, x: at.x, y: at.y, trigger: pages[0]?.trigger ?? { kind: "action" }, commands: [], pages } as GameEvent;
}
const weekStage = (w: number, s: number): EventPageCondition[] => [stageIs(V_WEEK, w), stageIs(V_STAGE, s)];
function scene(id: string, at: Cell, when: EventPageCondition[], commands: Command[]): GameEvent {
  return event(id, id, at, [page(`${id}_p`, when, commands, { trigger: "auto" })]);
}
function add(map: GameMap, ...events: GameEvent[]): void { map.events.push(...events); }

/**
 * 이 단계 밖에서는 지나갈 수 없는 문 — 문 칸(두 칸 문이면 둘 다, 도구가 한 칸 옮겼으면 그 칸)의 이동 이벤트 앞에 막는 페이지를 덧댄다.
 * open 조건 묶음 중 하나가 맞으면 원래 이동 페이지가 돈다. 막히면 한마디 하고 문에서 한 걸음 물러난다.
 */
function gateDoor(map: GameMap, door: Cell, open: EventPageCondition[][], blocked: Command[]): void {
  const gates = map.events.filter((e) => Math.abs(e.x - door.x) + Math.abs(e.y - door.y) <= 1
    && (e.pages ?? []).some((p) => p.commands.some((c) => c.kind === "transfer")));
  if (gates.length === 0) throw new Error(`[eighth-seat] ${map.id}: (${door.x},${door.y}) 곁에 문 이벤트가 없다`);
  for (const ev of gates) {
    const go = ev.pages![ev.pages!.length - 1]!;
    const edge = [[ev.y, "down"], [map.height - 1 - ev.y, "up"], [ev.x, "right"], [map.width - 1 - ev.x, "left"]] as const;
    const back = [...edge].sort((p, q) => p[0] - q[0])[0]![1] as Dir;
    const blockPage = { ...JSON.parse(JSON.stringify(go)), id: `${ev.id}_blocked`, name: "막힘", conditions: [], commands: [...blocked, walk("@player", [back])] } as EventPage;
    const goPages = open.map((conds, i) => ({ ...JSON.parse(JSON.stringify(go)), id: `${ev.id}_go${i}`, conditions: conds }) as EventPage);
    ev.pages = [blockPage, ...goPages];
  }
}

const camTo = (x: number, y: number, ms = 900): Command => m2("Camera Control", { mode: "panTo", target: "screen", x, y, zoom: 1, durationMs: ms, wait: true, easing: "easeInOut" });
const camBack = (ms = 900): Command => m2("Camera Control", { mode: "return", target: "player", x: 0, y: 0, zoom: 1, durationMs: ms, wait: true, easing: "easeInOut" });

// ═══════════════════════════════════════════════════════════════
// 1주 · 도착 — 서쪽 숲 승차장
// ═══════════════════════════════════════════════════════════════
function buildArrival(project: Project, a: EsAnchors): void {
  const map = project.maps[ES_MAP.coach]!;
  const taken: Cell[] = [a.coach.spawn];
  const heroAt: Cell = { x: 13, y: 10 };
  const brandtAt = freeCell(project, map, { x: 16, y: 10 }, taken); taken.push(brandtAt);
  const seraAt = freeCell(project, map, { x: 18, y: 12 }, taken); taken.push(seraAt);
  const s1 = freeCell(project, map, { x: 11, y: 13 }, taken); taken.push(s1);
  const s2 = freeCell(project, map, { x: 20, y: 13 }, taken); taken.push(s2);

  add(map,
    event("ev_es_brandt_coach", "브란트 교관", brandtAt, [
      page("brandt_wait", [stageIs(V_WEEK, 0)], [], { who: "brandt", dir: "left" }),
      page("brandt_talk", [stageIs(V_WEEK, 1), stageIs(V_STAGE, S.CORRIDOR)], [
        faceHero("ev_es_brandt_coach"),
        ...line("brandt", "강당은 북쪽 길 끝입니다. 트렁크는 두고 가세요. 짐꾼이 방으로 올립니다."),
      ], { who: "brandt", dir: "left" }),
    ]),
    event("ev_es_sera_coach", "푸른 넥타이 학생", seraAt, [
      page("sera_c0", [stageIs(V_WEEK, 1), stageIs(V_STAGE, S.CORRIDOR)], [
        faceHero("ev_es_sera_coach"),
        ...line("sera", "명단 봤어? 아홉 번째 줄 잉크가 아직 덜 말랐더라."),
        ...line("sera", "……강당에서 봐."),
      ], { who: "sera", dir: "up" }),
    ]),
    event("ev_es_student_c1", "여행 망토 학생", s1, [
      page("s1", [stageIs(V_WEEK, 1)], voice("여행 망토 학생", "배가 아니라 마차라서 다행이야. 호수는 첫날부터 보고 싶지 않거든."), { who: { sheet: 3, index: 1 }, dir: "up" }),
    ]),
    event("ev_es_student_c2", "안경 쓴 학생", s2, [
      page("s2", [stageIs(V_WEEK, 1)], voice("안경 쓴 학생", "게시판에 올해 장학생 아홉이래. 착오래. 착오를 왜 안 고치지?"), { who: "scholarA", dir: "left" }),
    ]),
  );

  // 운행 게시판(16,6~7) 앞 — 명단.
  add(map, event("ev_es_board", "운행 게시판", { x: 16, y: 7 }, [
    page("board", [], [
      playSe(SE.page),
      ...note("가을 학기 장학생 명단. 이름이 여덟 줄, 그 아래에 한 줄이 더 있다."),
      ...note("「9. 렌 — 추가 합격. 겨울 시험 후 결정전 대상.」"),
      ...think("추가 합격. 편지에는 그런 말이 없었다."),
    ], { priority: "same" }),
  ]));

  // 도착 장면: 검은 화면에서 밝아지며 마차 곁에 내려선다.
  // 새 게임은 주차 0 에서 시작한다(변수 기본값) — 도착 장면이 1주로 올린다.
  add(map, scene("ev_es_arrive", { x: 1, y: 1 }, [stageIs(V_WEEK, 0)], [
    m2("Screen Effect", { effect: "fadeOut", value: "", durationMs: 0 }),
    ...letterbox(true, 0),
    bgm(BGM.coach, 1200),
    pause(400),
    ...fadeIn(1200),
    playSe(SE.door),
    pause(500),
    walk("@player", ["right"]),
    pause(300),
    ...line("brandt", "케른 장학생은 이쪽으로. 이름을 부르면 대답하세요."),
    faceToward("ev_es_brandt_coach", "@player"),
    ...line("brandt", "……렌."),
    choices([
      { text: "「네.」", then: line("brandt", "목소리가 작군요. 여기서는 크게 대답하는 사람이 오래 남습니다.") },
      { text: "고개만 끄덕인다", then: [...line("brandt", "끄덕이는 것도 대답으로 칩니다. 이번엔.")] },
    ]),
    ...line("brandt", "아홉 명 다 왔군요. 강당은 북쪽입니다. 연회 전에 학장님 말씀이 있습니다."),
    ...letterbox(false, 400),
    setVar(V_WEEK, "=", 1),
    stage(S.CORRIDOR),
  ]));
  // 북쪽 출구는 도착 장면 뒤에만 열린다. 동쪽(호숫가)은 1주에 닫혀 있다.
  gateDoor(map, a.doors.coach.n0!, [[stageIs(V_WEEK, 1), stageIs(V_STAGE, S.CORRIDOR)]], think("아직 브란트 교관이 이름을 부르고 있다."));
  gateDoor(map, a.doors.coach.e0!, [[{ kind: "variable", variableId: V_WEEK, op: ">=", value: 7 } as EventPageCondition]], think("호숫가로 내려가는 길이다. 오늘은 갈 일이 없다."));
  void heroAt;
}

// ═══════════════════════════════════════════════════════════════
// 1주 · 입학 연회 — 큰 강당
// ═══════════════════════════════════════════════════════════════
function buildFeast(project: Project, a: EsAnchors): void {
  const map = project.maps[ES_MAP.hall]!;
  // 북쪽 단(탁자 위쪽, y=4~5): 학장·교관·사서장. 탁자 사이 의자 줄(y=6·9·12·15)에 학생.
  // 북쪽 문(15,3) 앞 (15,4) 은 비운다 — 연회가 끝나면 그 문으로 복도에 나간다.
  const taken: Cell[] = [{ x: 15, y: 4 }, { x: 15, y: 5 }, { x: 14, y: 20 }, { x: 14, y: 19 }];
  const at = (c: Cell): Cell => { const f = freeCell(project, map, c, taken, 3); taken.push(f); return f; };
  const orben = at({ x: 13, y: 4 });
  const brandt = at({ x: 11, y: 4 });
  const idel = at({ x: 18, y: 4 });
  const seraSeat = at({ x: 19, y: 10 });   // 오른쪽 앞 탁자 아래 의자줄 옆 통로
  const teoSeat = at({ x: 8, y: 11 });
  const dowin = at({ x: 6, y: 10 });
  const extras: { id: string; chip: { sheet: number; index: number }; at: Cell; dir: Dir; text: string }[] = [
    { id: "ev_es_hall_x1", chip: { sheet: 1, index: 3 }, at: at({ x: 3, y: 10 }), dir: "right", text: "작년 결정전은 둘 다 울면서 했대. 이긴 쪽도." },
    { id: "ev_es_hall_x2", chip: { sheet: 1, index: 6 }, at: at({ x: 22, y: 10 }), dir: "left", text: "약학 반 선배들은 첫날부터 시험 범위를 외운대." },
    { id: "ev_es_hall_x3", chip: { sheet: 2, index: 6 }, at: at({ x: 26, y: 11 }), dir: "left", text: "장학생 탁자는 저쪽 끝이야. 의자가 여덟 개였는데, 아까 하나 더 놨어." },
    { id: "ev_es_hall_x4", chip: { sheet: 3, index: 1 }, at: at({ x: 13, y: 16 }), dir: "up", text: "학장님 말 길어. 국 식기 전에 끝났으면." },
  ];
  add(map,
    event("ev_es_orben", "오르벤 학장", orben, [page("orben_p", [stageIs(V_WEEK, 1)], line("orben", "배를 채우세요. 내일부터는 오후가 모자랄 겁니다."), { who: "orben", dir: "down" })]),
    event("ev_es_brandt_hall", "브란트 교관", brandt, [page("brandt_h", [stageIs(V_WEEK, 1)], line("brandt", "연회가 끝나면 실기 강의실로. 첫 수업은 오늘 밤입니다."), { who: "brandt", dir: "down" })]),
    event("ev_es_idel", "이델 사서장", idel, [page("idel_h", [stageIs(V_WEEK, 1)], line("idel", "도서관은 해 질 녘에 닫아요. 장부를 찾는 학생은 낮에 오세요."), { who: "idel", dir: "down" })]),
    event("ev_es_dowin_hall", "주황 머리 3학년", dowin, [page("dowin_h", [stageIs(V_WEEK, 1)], [
      faceHero("ev_es_dowin_hall"),
      ...line("dowin", "아홉 번째구나. 도윈이야. 3학년."),
      ...line("dowin", "결정전은 겨울이니까 지금 겁먹을 필요는 없어. 겁은 그때 한 번에 먹는 게 덜 아파."),
    ], { who: "dowin", dir: "right" })]),
    event("ev_es_sera_hall", "세라", seraSeat, [page("sera_h", [stageIs(V_WEEK, 1)], [
      faceHero("ev_es_sera_hall"),
      ...line("sera", "자리는 저쪽이야. 의자 수 세어 봤어? 아홉 개."),
    ], { who: "sera", dir: "left" })]),
    event("ev_es_teo_hall", "노란 넥타이 학생", teoSeat, [page("teo_h", [stageIs(V_WEEK, 1)], [
      faceHero("ev_es_teo_hall"),
      ...line("teo", "국에 넣은 건 온실 파야. 내가 심었어."),
      ...line("teo", "아, 미안. 테오야. 약초학 반. ……처음 보는 얼굴이지?"),
    ], { who: "teo", dir: "right" })]),
    ...extras.map((x) => event(x.id, "학생", x.at, [page(`${x.id}_p`, [stageIs(V_WEEK, 1)], voice("학생", x.text), { who: x.chip, dir: x.dir })])),
  );

  // 입학 연회 — 학장의 말. 들어오는 순간 문 앞에서 돈다.
  const speechView: Cell = { x: 15, y: 7 };
  add(map, scene("ev_es_feast", { x: 1, y: 1 }, weekStage(1, S.CORRIDOR), [
    ...letterbox(true, 500),
    camTo(speechView.x, speechView.y, 1400),
    playSe(SE.bell),
    pause(600),
    ...line("orben", "케른에 온 것을 환영합니다."),
    ...line("orben", "올해 장학생은 아홉 명입니다. 장학석은 언제나처럼 여덟입니다."),
    pause(700),
    ...line("orben", "착오는 우리 쪽에서 났습니다. 그래서 아홉 명 모두를 받았습니다. 그리고 겨울 시험이 끝나면, 맨 아래 두 사람이 결정전을 치릅니다."),
    ...line("orben", "진 사람은 집으로 돌아갑니다. 호수가 그 사람의 가을을 가져갑니다. 아프지 않습니다. 기억이 조금 흐려질 뿐입니다."),
    pause(900),
    ...note("강당이 조용하다. 누군가 숟가락을 내려놓는 소리가 난다."),
    ...line("orben", "그러니 여섯 주를 잘 쓰세요. 오후는 여러분 것입니다."),
    camBack(1100),
    ...letterbox(false, 400),
    ...think("맨 아래 두 사람. 아홉 명 중에 추가 합격은 나 하나다."),
    setSw(SW_FEAST_DONE, true),
    stage(S.TO_DUEL),
  ]));
  // 연회 중 문: 남쪽(승차장)은 닫힘. 북쪽(복도)은 연회 뒤에 열린다. 동쪽(온실)은 1주 닫힘.
  gateDoor(map, a.doors.hall.s0!, [[{ kind: "variable", variableId: V_WEEK, op: ">=", value: 7 } as EventPageCondition]], think("마차는 이미 떠났다."));
  gateDoor(map, a.doors.hall.n0!, [[stageIs(V_WEEK, 1), { kind: "variable", variableId: V_STAGE, op: ">=", value: S.TO_DUEL } as EventPageCondition], [{ kind: "variable", variableId: V_WEEK, op: ">=", value: 2 } as EventPageCondition]],
    think("연회가 아직 시작도 안 했다."));
  gateDoor(map, a.doors.hall.e0!, [[{ kind: "variable", variableId: V_WEEK, op: ">=", value: 2 } as EventPageCondition]], think("온실 쪽 문은 잠겨 있다. 내일부터 연다고 적혀 있다."));
}

// ═══════════════════════════════════════════════════════════════
// 1주 · 동쪽 복도 — 한 번 지나가는 길(안내 한 줄)
// ═══════════════════════════════════════════════════════════════
function buildCorridorWeek1(project: Project, a: EsAnchors): void {
  const map = project.maps[ES_MAP.corridor]!;
  add(map, scene("ev_es_corridor_w1", { x: 1, y: 1 }, weekStage(1, S.TO_DUEL), [
    ...think("실기 강의실은 복도 서쪽 첫 번째 문이다."),
    stage(S.DUEL),
  ]));
  // 1주: 실기 강의실(서0)만 연다. 휴게실(동0)은 결투 뒤에.
  const week1Duel: EventPageCondition[] = [stageIs(V_WEEK, 1), { kind: "variable", variableId: V_STAGE, op: ">=", value: S.DUEL } as EventPageCondition];
  const later: EventPageCondition[] = [{ kind: "variable", variableId: V_WEEK, op: ">=", value: 2 } as EventPageCondition];
  gateDoor(map, a.doors.corridor.w0!, [week1Duel, later], think("문 너머에서 목검 부딪히는 소리가 난다."));
  gateDoor(map, a.doors.corridor.e0!, [[stageIs(V_WEEK, 1), { kind: "variable", variableId: V_STAGE, op: ">=", value: S.AFTER_DUEL } as EventPageCondition], later], think("휴게실이다. 수업이 먼저다."));
  for (const k of ["w1", "w2", "e1", "e2", "n0"] as const) gateDoor(map, a.doors.corridor[k]!, [later], think("오늘은 아니다. 첫 수업이 기다린다."));
}

// ═══════════════════════════════════════════════════════════════
// 1주 · 실기 입문 + 결투 1 — 실기 강의실
// ═══════════════════════════════════════════════════════════════
function buildDuelOne(project: Project): void {
  const map = project.maps[ES_MAP.duel]!;
  // 훈련 원은 (9,8)~(11,10), 가운데 (10,9). 교관은 원 북쪽, 학생들은 벤치 곁.
  const brandt: Cell = { x: 10, y: 6 };
  const heroMark: Cell = { x: 8, y: 9 };
  const armorAt: Cell = { x: 12, y: 9 };
  const seraBench = freeCell(project, map, { x: 4, y: 10 }, [heroMark, armorAt, brandt]);
  const watchers: { id: string; chip: { sheet: number; index: number }; at: Cell; dir: Dir }[] = [
    { id: "ev_es_duel_w1", chip: { sheet: 1, index: 3 }, at: freeCell(project, map, { x: 4, y: 7 }, [seraBench]), dir: "right" },
    { id: "ev_es_duel_w2", chip: { sheet: 2, index: 6 }, at: freeCell(project, map, { x: 17, y: 7 }, []), dir: "left" },
    { id: "ev_es_duel_w3", chip: { sheet: 1, index: 6 }, at: freeCell(project, map, { x: 17, y: 10 }, []), dir: "left" },
  ];

  const duelDone: EventPageCondition = { kind: "variable", variableId: V_STAGE, op: ">=", value: S.AFTER_DUEL } as EventPageCondition;
  add(map,
    event("ev_es_brandt_duel", "브란트 교관", brandt, [
      page("brandt_d0", [stageIs(V_WEEK, 1)], line("brandt", "원 안으로. 왼쪽 표시에 서세요."), { who: "brandt", dir: "down" }),
      page("brandt_d1", [stageIs(V_WEEK, 1), duelDone], [
        faceHero("ev_es_brandt_duel"),
        ...line("brandt", "오늘 배운 건 하나입니다. 상대가 크게 들어 올리면, 그 한 라운드가 당신 것입니다."),
        ...line("brandt", "휴게실은 복도 건너편입니다. 내일 아침 게시판에 이번 주 오후가 붙습니다."),
      ], { who: "brandt", dir: "down" }),
    ]),
    event("ev_es_sera_duel", "세라", seraBench, [
      page("sera_d0", [stageIs(V_WEEK, 1)], [faceHero("ev_es_sera_duel"), ...line("sera", "구경 중이야. 신경 쓰지 마.")], { who: "sera", dir: "right" }),
      page("sera_d1", [stageIs(V_WEEK, 1), duelDone], [
        faceHero("ev_es_sera_duel"),
        ...line("sera", "두 번째 라운드에서 방벽을 쳤지. 갑옷 상대로는 맞는 답이야."),
        ...line("sera", "사람은 갑옷처럼 매번 같은 라운드에 손을 들지 않아."),
      ], { who: "sera", dir: "right" }),
    ]),
    ...watchers.map((w) => event(w.id, "학생", w.at, [page(`${w.id}_p`, [stageIs(V_WEEK, 1)], voice("학생", "다음은 나야. 갑옷 무릎 소리 들었어? 저게 들리면 크게 온다."), { who: w.chip, dir: w.dir })])),
  );

  const duelBranch = (won: Command[], lost: Command[]): Command => ({
    kind: "battleProcessing", troopId: TR.armor, canEscape: false, canLose: true, branchOnResult: true,
    victoryBranch: won, escapeBranch: won, defeatBranch: lost,
  } as unknown as Command);

  const afterWin: Command[] = [
    ...fadeIn(400),
    ...line("brandt", "됐습니다. 갑옷은 무릎을 꿇었습니다."),
    ...line("brandt", "두 번째 라운드에 들어 올리는 것을 봤지요. 모으는 동안 세게 맞히면 흩어지고, 방벽이 있으면 반으로 받습니다."),
  ];
  const afterLoss: Command[] = [
    ...fadeIn(400),
    ...line("brandt", "괜찮습니다. 첫날 갑옷에 지는 학생이 절반입니다."),
    ...line("brandt", "머리 위 표시가 뜨면 그다음 라운드에 내려칩니다. 그 표시를 읽으세요. 결투는 그것뿐입니다."),
  ];

  add(map, scene("ev_es_duel1", { x: 1, y: 1 }, weekStage(1, S.DUEL), [
    ...letterbox(true, 400),
    approach("@player", heroMark, 0),
    { kind: "moveEvent", eventId: "@player", route: { moves: [{ kind: "turn", dir: "right" }], repeat: false, wait: true, skippable: true } } as Command,
    faceToward("ev_es_brandt_duel", "@player"),
    ...line("brandt", "실기 입문입니다. 이름 대신 숫자로 부르겠습니다. 아홉 번."),
    ...line("brandt", "결투는 지팡이를 내려놓으면 끝납니다. 내려놓는 것도 실력으로 칩니다. 오늘은 상대가 갑옷이라 내려놓을 일이 없을 겁니다."),
    ...line("brandt", "가진 주문은 둘입니다. 불씨 화살, 방벽. 그리고 이번 수업에서 하나를 더 줍니다."),
    learn(SK.riposte),
    playSe(SE.chime),
    ...note("「받아치기」를 배웠다. 한 라운드 동안 날아온 물리 공격을 되받는다."),
    ...line("brandt", "갑옷은 두 라운드에 한 번 크게 들어 올립니다. 그때 무엇을 할지 미리 정해 두세요."),
    ...letterbox(false, 300),
    bgm(BGM.duel, 300),
    duelBranch(afterWin, afterLoss),
    bgm(BGM.night, 1200),
    setSw(SW_DUEL_WON, false),
    stage(S.AFTER_DUEL),
  ]));
}

// ═══════════════════════════════════════════════════════════════
// 1주 저녁 · 첫날 밤 — 휴게실 → 침실
// ═══════════════════════════════════════════════════════════════
function buildFirstNight(project: Project, a: EsAnchors): void {
  const common = project.maps[ES_MAP.common]!;
  const dorm = project.maps[ES_MAP.dorm]!;
  // 휴게실: 게시판(17,4~5) — 내일 일정. 들어가면 침실로 가라는 한 줄.
  add(common, event("ev_es_board_common", "일정 게시판", { x: 17, y: 5 }, [
    page("board_w1", [stageIs(V_WEEK, 1)], [
      playSe(SE.page),
      ...note("「장학생 일정 — 매주 월요일 아침에 붙인다. 오후 칸은 각자 정한다.」"),
      ...note("아래 귀퉁이에 누가 연필로 적어 두었다. 「도서관: 세라가 자주 온다. 온실: 노란 넥타이가 물을 준다.」"),
    ], { priority: "same" }),
  ]));
  const hearth = freeCell(project, common, { x: 11, y: 5 }, []);
  add(common, event("ev_es_common_x1", "학생", hearth, [
    page("cx1", [stageIs(V_WEEK, 1)], voice("마법약 학생", "침실은 동쪽 문이야. 장학생 방은 둘씩. 너는 세라랑 같은 방일걸."), { who: { sheet: 1, index: 3 }, dir: "left" }),
  ]));
  add(common, scene("ev_es_common_w1", { x: 1, y: 1 }, weekStage(1, S.AFTER_DUEL), [
    ...think("벽난로 옆 게시판에 내일부터의 일정이 붙는다. 오늘은 그만 자자."),
    stage(S.NIGHT),
  ]));
  gateDoor(common, a.doors.common.e0!, [[stageIs(V_WEEK, 1), { kind: "variable", variableId: V_STAGE, op: ">=", value: S.NIGHT } as EventPageCondition], [{ kind: "variable", variableId: V_WEEK, op: ">=", value: 2 } as EventPageCondition]], think("침실이다."));

  // 침실: 초록 침대(3,4) = 세라, 붉은 침대(12,4) = 렌. 세라는 거울 앞에 서 있다.
  const seraStand: Cell = { x: 14, y: 8 };
  add(dorm, event("ev_es_sera_dorm", "세라", seraStand, [
    page("sera_n0", [stageIs(V_WEEK, 1), stageIs(V_STAGE, S.NIGHT)], [], { who: "sera", dir: "right" }),
    page("sera_n1", [stageIs(V_WEEK, 1), stageIs(V_STAGE, S.NIGHT_DONE)], [faceHero("ev_es_sera_dorm"), ...line("sera", "불 끌게. 내일 아침 게시판은 일찍 가야 좋은 칸이 남아.")], { who: "sera", dir: "left" }),
  ]));
  add(dorm, event("ev_es_bed", "붉은 담요 침대", { x: 13, y: 6 }, [
    page("bed_w1", [stageIs(V_WEEK, 1), stageIs(V_STAGE, S.NIGHT_DONE)], [
      ...think("눕는다. 천장 들보가 낯설다."),
      ...fadeOut(1200),
      stopBgm(),
      ...note("— 1주차 끝 —"),
      ...note("(첫 5분 체험판은 여기까지입니다. 2주차부터는 다음 판에서 이어집니다.)"),
      ...fadeIn(800),
    ], { priority: "same" }),
  ]));

  add(dorm, scene("ev_es_night1", { x: 1, y: 1 }, weekStage(1, S.NIGHT), [
    ...letterbox(true, 500),
    pause(600),
    ...note("방 건너편 침대에 트렁크가 하나 놓여 있다. 푸른 넥타이가 침대 기둥에 걸려 있다."),
    faceToward("ev_es_sera_dorm", "@player"),
    pause(400),
    ...line("sera", "늦었네. 갑옷이랑 오래 놀았어?"),
    ...line("sera", "세라야. 오늘부터 같은 방."),
    pause(700),
    ...line("sera", "여덟 자리야. 너랑 나 둘 중 하나는 겨울을 못 넘겨."),
    ...note("세라는 그 말을 하고 거울 쪽으로 돌아선다. 머리끈을 푸는 손이 잠깐 멈췄다가 다시 움직인다."),
    choices([
      { text: "「알아.」", then: [
        ...line("sera", "그래. 그럼 됐어. 모르는 척하는 사람이랑 한 방 쓰는 게 제일 피곤하거든."),
      ] },
      { text: "「그럼 둘 다 남는 방법을 찾자.」", then: [
        setVar(V_SERA, "+=", 1),
        pause(500),
        ...line("sera", "……그런 방법이 있었으면 작년 사람들이 찾았겠지."),
        ...line("sera", "그래도 찾으면 말해 줘. 나도 집에 가고 싶진 않으니까."),
      ] },
      { text: "아무 말도 하지 않는다", then: [
        setVar(V_SERA, "-=", 1),
        pause(900),
        ...line("sera", "……대답 안 해도 돼. 겨울에 하게 될 테니까."),
      ] },
    ]),
    face("ev_es_sera_dorm", "right"),
    journal("es_j_w1_night", "ren", "1주 · 첫날 밤", "자리는 여덟이다. 같은 방 건너편 침대에 세라가 잔다."),
    playSe(SE.page),
    ...note("수첩에 첫 줄을 적었다."),
    ...letterbox(false, 400),
    stage(S.NIGHT_DONE),
  ]));
}
function face(eventId: string, dir: Dir): Command {
  return { kind: "moveEvent", eventId, route: { moves: [{ kind: "turn", dir }], repeat: false, wait: true, skippable: true } } as Command;
}

// ═══════════════════════════════════════════════════════════════
// 엔딩 네 개(M1 은 정의만 — 결말 장면은 M5)
// ═══════════════════════════════════════════════════════════════
const CREDITS = [
  "『여덟째 자리』", "",
  "이야기 · 연출   OPRN Flagship Studio",
  "그림   OPRN 마법 학교 도트",
  "음악 · 효과음   CC0 음원", "",
  "만든 도구   OPRN Studio", "",
  "끝까지 함께해 주셔서 고맙습니다.",
].join("\n");

function defineEndings(project: Project): void {
  const end = (id: string, name: string, kicker: string, tone: "warm" | "dark", epilogue: { kind: "say"; text: string; speaker?: string }[]) =>
    execTool(project, "define_ending", { id, name, conditions: [], presentation: { musicResourceId: BGM.ending, tone, kicker, credits: CREDITS }, epilogue });
  end(END.both, "여덟째 자리", "엔딩 · 두 사람의 겨울", "warm", [
    { kind: "say", text: "그해 겨울, 결정전은 열리지 않았다." },
    { kind: "say", text: "시계탑은 일곱 시 오십이 분에 섰다. 겨울은 길었고, 성의 복도는 추웠다." },
    { kind: "say", text: "장부의 테오 이름 옆에, 처음으로 「2학년」이라고 적혔다." },
  ]);
  end(END.kept, "남은 자리", "엔딩 · 봄의 편지", "warm", [
    { kind: "say", text: "봄에 편지가 한 통 왔다. 격식 갖춘 존댓말이었다." },
    { kind: "say", text: "끝에 한 줄이 더 있었다. 「이상하게 당신 필체가 낯익습니다.」" },
  ]);
  end(END.cold, "차가운 수석", "엔딩 · 빈 침대", "dark", [
    { kind: "say", text: "도윈이 축하한다고 말했다. 방 건너편 침대는 비어 있었다." },
    { kind: "say", text: "수첩의 한 줄을 내 손으로 지웠다." },
  ]);
  end(END.boat, "돌아가는 배", "엔딩 · 호수", "dark", [
    { kind: "say", text: "배가 호수 한가운데에 이르자 수첩의 줄이 하나씩 흐려졌다." },
    { kind: "say", text: "누가 한 말인지 모르는 문장 하나만 남았다." },
  ]);
}

function buildTitle(project: Project): void {
  execTool(project, "set_title_screen", {
    title: "여덟째 자리",
    logoSubtitle: "장학석은 여덟, 장학생은 아홉",
    backgroundResourceId: "oprn_eighth_seat_opening_hall",
    logoStyle: "stone",
    musicResourceId: BGM.title,
  });
  if (project.system.titleScreen) project.system.titleScreen.backgroundFit = "cover";
  buildEighthSeatOpening(project, BGM.opening);
}

export function createEighthSeatFlagshipDemo(): FlagshipDemoBuildResult {
  const project = createBlankProject();
  const initialMapIds = Object.keys(project.maps);
  project.meta.title = "여덟째 자리";
  project.meta.author = "OPRN Flagship Studio";
  project.system.playResolution = { width: 480, height: 270 };
  delete project.system.cameraZoom;
  project.system.dialogueStyle = "pixel-cinematic";
  (project.system as { fieldGuides?: "off" | "arrows" }).fieldGuides = "arrows";

  const exec = (name: string, args: Record<string, unknown>) => execTool(project, name, args);
  const anchors = buildEighthSeatMaps(project, exec);
  for (const id of initialMapIds) delete project.maps[id];
  for (const [key, id] of Object.entries(ES_MAP)) {
    const m = project.maps[id];
    if (!m) continue;
    m.name = ES_MAP_NAMES[key as keyof typeof ES_MAP_NAMES];
    if (!m.defaultLighting) m.defaultLighting = { ambient: 0, color: "#000000", sources: [] };
  }
  // 밤의 성 — 강당·복도·침실·실기 강의실에 촛불빛.
  const evening = { ambient: 0.28, color: "#1c1830", sources: [] } as const;
  for (const id of [ES_MAP.hall, ES_MAP.corridor, ES_MAP.common, ES_MAP.dorm, ES_MAP.duel]) if (project.maps[id]) project.maps[id]!.defaultLighting = { ...evening, sources: [] };
  if (project.maps[ES_MAP.coach]) project.maps[ES_MAP.coach]!.defaultLighting = { ambient: 0.18, color: "#2a2340", sources: [] };

  // 주인공 렌.
  const hero = project.database.actors.find((x) => x.id === DEFAULT_ACTOR_ID) ?? project.database.actors[0]!;
  hero.name = "렌";
  hero.nickname = "아홉 번째 장학생";
  hero.characterResourceId = `oprn-charset-wizarding${ES_CHIPS.ren.sheet}`;
  hero.characterIndex = ES_CHIPS.ren.index;
  delete hero.faceResourceId;
  delete (hero as { battleCharacterResourceId?: string }).battleCharacterResourceId;
  project.session.partyActorIds = [hero.id];

  buildEighthSeatBattle(project);

  const ensureVar = (id: string, name: string): void => { if (!project.variables.some((v) => v.id === id)) project.variables.push({ id, name }); };
  const ensureSw = (id: string, name: string): void => { if (!project.switches.some((s) => s.id === id)) project.switches.push({ id, name }); };
  ensureVar(V_WEEK, "주차"); ensureVar(V_STAGE, "주 안의 장면"); ensureVar(V_SERA, "세라 호감"); ensureVar(V_TEO, "테오 호감");
  ensureVar(V_PREP, "시험 준비"); ensureVar(V_CLUE, "단서");
  ensureSw(SW_FEAST_DONE, "입학 연회를 봄"); ensureSw(SW_DUEL_WON, "결투: 상대 항복");

  execTool(project, "configure_story_journal", { title: "수첩", writers: [{ id: "ren", name: "렌" }, { id: "sera", name: "세라" }, { id: "teo", name: "테오" }] });

  defineEndings(project);
  buildArrival(project, anchors);
  buildFeast(project, anchors);
  buildCorridorWeek1(project, anchors);
  buildDuelOne(project);
  buildFirstNight(project, anchors);

  // 시험장 배치(6주) — 큰 강당 가운데 통로에 훈련 원을 깐다. M5 에서 장면이 쓴다. 지금은 시험 장면 자리의 changeTile 하나만 둔다.
  add(project.maps[ES_MAP.hall]!, event("ev_es_exam_layout", "시험장 배치", { x: 2, y: 2 }, [
    page("exam_layout", [stageIs(V_WEEK, 6), stageIs(V_STAGE, 90)], [
      { kind: "changeTile", mapId: ES_MAP.hall, layer: "upper", x: 14, y: 10, tile: 1975 } as Command,
      stage(91),
    ], { trigger: "auto" }),
  ]));

  // 맵 BGM.
  const mapBgm: Record<string, string> = {
    [ES_MAP.coach]: BGM.coach, [ES_MAP.hall]: BGM.feast, [ES_MAP.corridor]: BGM.night, [ES_MAP.common]: BGM.night, [ES_MAP.dorm]: BGM.night,
    [ES_MAP.duel]: BGM.day, [ES_MAP.library]: BGM.library, [ES_MAP.greenhouse]: BGM.day, [ES_MAP.letters]: BGM.letters,
    [ES_MAP.clock]: BGM.clock, [ES_MAP.lab]: BGM.day, [ES_MAP.infirmary]: BGM.night, [ES_MAP.boathouse]: BGM.ending,
  };
  for (const [mapId, id] of Object.entries(mapBgm)) { const m = project.maps[mapId]; if (m) m.bgm = { mode: "custom", resourceId: id }; }
  project.system.battleBgmResourceId = BGM.duel;

  buildTitle(project);
  buildEighthSeatLore(project);

  project.meta.oprnFieldMenu = { version: 1, entries: [
    { command: "skills", label: "주문" }, { command: "status", label: "상태" }, { command: "journal", label: "수첩" }, { command: "relationships", label: "사람들" },
    { command: "save", label: "저장" }, { command: "load", label: "불러오기" }, { command: "options", label: "설정" }, { command: "to-title", label: "타이틀로" },
  ] };
  project.system.fieldHud = {
    theme: "minimal", vitals: false, clock: false, tools: false, objective: false, hideEmpty: true,
    widgets: [{ id: "es-week", kind: "text", source: "variable", variableId: V_WEEK, label: "주", anchor: "top-right", x: 8, y: 8, width: 54, height: 20, panel: "dark", color: "#e8dcc0", shape: "number" }],
  } as unknown as typeof project.system.fieldHud;

  project.startMapId = ES_MAP.coach;
  project.startPos = { x: 12, y: 10 };
  project.mapTree = {
    mapId: ES_MAP.coach,
    children: Object.values(ES_MAP).filter((id) => id !== ES_MAP.coach).map((mapId) => ({ mapId, children: [] })),
  };

  const serialized = serialize(project);
  const reloaded = deserialize(serialized);
  return {
    id: "eighth-seat",
    manifest: { ...FLAGSHIP_BEAT_MANIFESTS["eighth-seat"], mapCount: Object.keys(reloaded.maps).length, endingCount: reloaded.endings?.length ?? 0 },
    project: reloaded,
    serialized,
  };
}
