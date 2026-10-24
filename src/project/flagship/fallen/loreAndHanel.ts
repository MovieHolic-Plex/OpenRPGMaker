/**
 * 폴른 스타 — 하넬의 자리·말 + 읽을거리(세계 이야기). 대사 원문 = docs/fallen-star/act1-script.md 6절(H1~H10)·17절(L1~L10).
 *
 * - 하넬은 큰 망원경 곁에 선다. 이야기 진행(스위치)에 따라 우선순위 H10 > H9 > H8 > H7 > H6 > H5 > H4 > H2 > H1.
 * - 읽을거리 10곳(천문대 4 · 서고 4 · 마을 2): 각 2~3칸.
 *
 * 엔딩(end_fs_act1)으로 가는 분기(보상·스위치·triggerEnding)는 그대로 두고 말만 바꾼다.
 */
import { charsetFrameIndex } from "@/assets/easyrpgRtp";
import type { Command, EventPage, GameEvent, GameMap, Project } from "@/project/types";
import { FS_NAMES, FS_PREFIX } from "../fallenStarStory";
import { ifCond, setSw, swOff, swOn } from "../firstLoveKit";

type Ids = { hub: string; observatory: string; forest: string; vault: string };
type Cond = Parameters<typeof ifCond>[0];

const H = `천문대장 ${FS_NAMES.master}`;
const ELENA = "엘레나";
const HANEL_CHIP_INDEX = 4;

const say = (speaker: string, body: string): Command => ({ kind: "text", speaker, body } as Command);
const narrate = (body: string): Command => ({ kind: "text", body } as Command);
function readPage(id: string, name: string, commands: Command[]): EventPage {
  return {
    id, name, conditions: [], graphic: { transparent: true }, trigger: { kind: "action" }, priority: "same", overlapForbidden: false,
    movement: { type: "fixed", speed: 3, frequency: 3 }, commands,
  } as unknown as EventPage;
}

function readable(map: GameMap, key: string, name: string, at: { x: number; y: number }, commands: Command[]): void {
  const id = `ev_${FS_PREFIX}_lore_${key}`;
  map.events = map.events.filter((e) => e.id !== id);
  map.events.push({ id, name, x: at.x, y: at.y, trigger: { kind: "action" }, commands: [], pages: [readPage(`${id}_p`, name, commands)] } as unknown as GameEvent);
}

/** 읽을거리 한 곳 — `lines` 는 한 칸에 한 덩이. 서술(화자 없음) 또는 `speaker`(석판). */
function readLines(lines: string[], speaker?: string): Command[] {
  return lines.map((body) => (speaker ? say(speaker, body) : narrate(body)));
}

const SW_MET = "sw_fs_hanel_met";
const SW_Q1 = "sw_fs_q_bread_done"; // H7 — 토마의 빵 (잔 일 1). 연결은 마을 이벤트 쪽 몫, 없으면 잠든 채로 둔다.
const SW_Q2 = "sw_fs_q_spoon_done"; // H8 — 토비의 은수저 (잔 일 2).

const fork = (condition: Cond, then: Command[], otherwise: Command[]): Command =>
  ({ kind: "fork", condition, then, else: otherwise } as unknown as Command);

export function applyFallenLoreAndHanel(project: Project, ids: Ids): void {
  const ensureSw = (id: string): void => { if (!project.switches.some((s) => s.id === id)) project.switches.push({ id, name: id }); };
  [SW_MET, SW_Q1, SW_Q2].forEach(ensureSw);

  const obs = project.maps[ids.observatory];
  if (!obs) throw new Error("[fallen-star] 천문대 맵이 없다");
  placeHanel(obs);
  hanelTalk(obs);
  scopeLines(obs);
  observatoryReadables(obs);
  vaultReadables(project, ids);
  townReadables(project, ids);
}

// ── 하넬 자리: 큰 망원경 아래(12,12), 망원경을 올려다본다. 망원경 이벤트(13,11)는 (13,12)에서 그대로 조사된다 ──
function placeHanel(obs: GameMap): void {
  const hanel = obs.events.find((e) => e.id === `ev_${FS_PREFIX}_hanel`);
  if (!hanel) throw new Error("[fallen-star] 하넬 이벤트가 없다");
  hanel.x = 12;
  hanel.y = 12;
  for (const page of hanel.pages ?? []) {
    if (!page.graphic?.sprite) continue;
    page.graphic = { ...page.graphic, direction: "up", pattern: charsetFrameIndex({ characterIndex: HANEL_CHIP_INDEX, direction: "up", pattern: 1 }) };
  }
}

// ── 하넬의 말 (H1~H10) ──
function hanelTalk(obs: GameMap): void {
  const hanel = obs.events.find((e) => e.id === `ev_${FS_PREFIX}_hanel`);
  const [askPage, progressPage, donePage] = hanel?.pages ?? [];
  if (!askPage || !progressPage || !donePage) throw new Error("[fallen-star] 하넬 페이지 구조가 예상과 다르다");

  // 의뢰 페이지: 첫 대화 H1 → 다시 오면 H2, 「준비하고 오겠습니다」 H3.
  const ask = askPage.commands;
  const firstNonText = ask.findIndex((c) => c.kind !== "text" && c.kind !== "changeFace");
  if (firstNonText < 1) throw new Error("[fallen-star] 하넬 의뢰 소개 줄이 없다");
  const h1: Command[] = [
    say(H, "왔느냐. 기다리고 있었다."),
    say(H, "어젯밤 그 별은 떨어지기 직전\n방향을 틀었다."),
    say(ELENA, "방향을요? 별똥별은 그럴 수 없잖아요."),
    say(H, "그래. 무언가가 그걸 몰았다."),
  ];
  const h2: Command[] = [
    say(H, "서른 해 잠잠하던 북쪽 하늘이\n어젯밤 깜빡였다. 우연이 아니다."),
    say(H, "심문관보다 먼저 가 다오.\n자세한 얘기는 돌아오면 하마."),
  ];
  ask.splice(0, firstNonText, fork(swOff(SW_MET), [...h1, setSw(SW_MET, true)], h2));
  const choices = ask.find((c) => c.kind === "choices") as (Command & { options: { text: string; branch: Command[] }[] }) | undefined;
  if (choices?.options[1]) {
    choices.options[1].branch = [say(H, "늦지 않게 채비하고 다시 오너라.")];
  }

  // 진행 중 페이지: 갈림 구조(step0→step1→step2→끝)를 새로 짠다. 끝 분기의 보상·스위치·엔딩 명령은 원본 그대로 쓴다.
  const topIdx = progressPage.commands.findIndex((c) => c.kind === "fork" && JSON.stringify((c as { condition?: unknown }).condition).includes("sw_fs_main_step0"));
  if (topIdx < 0) throw new Error("[fallen-star] 하넬 진행 페이지에서 main_step0 분기를 못 찾았다");
  const endFork = findEnding(progressPage.commands[topIdx]!);
  if (!endFork) throw new Error("[fallen-star] 하넬 엔딩 분기를 못 찾았다");
  const endCmds: Command[] = endFork.filter((c) => c.kind !== "text" && c.kind !== "changeFace");
  const h9: Command[] = [
    say(H, "북쪽이라… 옛 별지기들이 마지막으로 세운\n하늘탑이 그쪽에 있다."),
    say(H, "발렌은 반드시 다시 온다.\n그 전에 떠나거라."),
  ];
  // 엔딩 직전에 H9 가 나오도록 보상·스위치 뒤, triggerEnding 앞에 끼운다.
  const endIdx = endCmds.findIndex((c) => c.kind === "triggerEnding");
  const endWithText = endIdx < 0 ? [...endCmds, ...h9] : [...endCmds.slice(0, endIdx), ...h9, ...endCmds.slice(endIdx)];

  const h4: Command[] = [say(H, "동문으로 나가거라. 숲길 끝 공터다.\n숲지기 브람에게 먼저 물어보는 게 좋겠다.")];
  const h5: Command[] = [
    say(H, "브람이 쇠 긁는 소리를 들었다고?\n…그 소리, 나도 들은 적이 있다."),
    say(H, "서른 해 전에도 그랬지.\n우선 공터부터 살피고 와서 말해 다오."),
  ];
  const h6: Command[] = [
    say(H, "별 무늬 열쇠는 서고 바닥의\n돌뚜껑 홈에 맞을 게다. 조심해라."),
    say(H, "아래 방은 내가 닫지 않았다.\n…닫은 것은 내 스승이다. 그것만 안다."),
    say(H, "그 아이가 말을 하는군.\n처음 들었을 때 나는 손이 떨렸다."),
  ];
  const h7: Command[] = [say(H, "토마의 빵 얘기는 들었다.\n작은 온기가 먼저 길을 여는구나.")];
  const h8: Command[] = [
    say(H, "은수저가 돌아왔다고? 토비가 가져갔더냐?\n…별에게 줄 선물이었다니, 나쁘지 않구나."),
    say(H, "아이 마음이란 게 참 그렇구나.\n누구도 네게 별을 주진 않았는데도 말이다."),
  ];
  // 여정 단계 (H4 < H5 < H6) 위에 잔 일 반응 H7 < H8 을 덮는다(여정 끝 분기는 가리지 않는다).
  const afterBram: Command = fork(swOn("sw_fs_main_step1"), [
    fork(swOn("sw_fs_main_step2"),
      [fork(swOff("sw_fs_main_done"), endWithText, [])],
      // 열쇠를 든 채 내려가기 전: H6(이리스 합류) 우선, 없으면 H8/H7, 없으면 열쇠 안내
      [fork(swOn("sw_fs_iris_joined"), h6, [fork(swOn(SW_Q2), h8, [fork(swOn(SW_Q1), h7, [say(H, "그 별 무늬 열쇠는 서고 바닥 돌뚜껑에 맞을 게다.\n조심해 내려가거라.")])])])]),
  ], [fork(swOn(SW_Q2), h8, [fork(swOn(SW_Q1), h7, h5)])]);
  const top: Command = fork(swOn("sw_fs_main_step0"), [afterBram], [fork(swOn(SW_Q2), h8, [fork(swOn(SW_Q1), h7, h4)])]);
  progressPage.commands[topIdx] = top;

  // 끝난 뒤 페이지: H10.
  donePage.commands = [
    say(H, "카엘, 엘레나.\n이리스를 집까지 바래다주거라."),
    say(H, "서른 해 전 일은 그때 마저 이야기하마.\n무사히 다녀오너라, 카엘."),
    say(FS_NAMES.hero, "…다녀올게요, 스승님."),
    say(H, "그래. 기다리고 있으마. 가거라."),
  ];
}

/** 원본 끝 분기(main_done == false 일 때 보상·엔딩) 명령 열을 찾는다. */
function findEnding(cmd: Command): Command[] | null {
  const f = cmd as unknown as { kind: string; condition?: { kind?: string; switchId?: string; value?: boolean }; then?: Command[]; else?: Command[] };
  if (f.kind !== "fork") return null;
  if (f.condition?.kind === "switch" && f.condition.switchId === "sw_fs_main_done" && f.condition.value === false) return f.then ?? null;
  for (const c of [...(f.then ?? []), ...(f.else ?? [])]) {
    const r = findEnding(c);
    if (r) return r;
  }
  return null;
}

// ── 망원경(ev_fs_scope) 문구 교체: 오디오·M2·표정 명령은 그대로 ──
function scopeLines(obs: GameMap): void {
  const scope = obs.events.find((e) => e.id === `ev_${FS_PREFIX}_scope`);
  if (!scope) throw new Error("[fallen-star] 망원경 이벤트가 없다");
  for (const page of scope.pages ?? []) {
    const ti = page.commands.findIndex((c) => c.kind === "text");
    if (ti < 0) continue;
    const rest = page.commands.filter((c) => c.kind !== "text");
    page.commands = [...rest, narrate("망원경 너머 북쪽 숲 위로\n아직 가늘게 연기가 피어오른다."), narrate("렌즈가 깨끗하게 닦여 있다.\n하넬 선생님이 밤새 들여다보신 모양이다.")];
  }
}

// ── 읽을거리 (L1~L10) ──
function observatoryReadables(obs: GameMap): void {
  readable(obs, "l3_irene", "이레네 명판", { x: 12, y: 19 }, readLines([
    "(명판) 이레네. 땅에는 사람을 내려놓고\n자신은 하늘에 남았다.",
    "(명판) 은빛 머리에 붉은 눈이었다고 전한다.\n그녀를 기억하는 것이 별지기의 몫이다.",
  ], "석판"));
  readable(obs, "l4_journal", "하넬의 일지", { x: 1, y: 17 }, readLines([
    "(쪽지) 서른한 해째. 북쪽은 오늘도 조용하다.\n「조용해서 다행이다」라고 쓴다.",
    "(쪽지) 그리고 지운다.\n「조용해서 서운하다」라고 고쳐 쓴다.",
    "(쪽지) 서른한 해. 나는 무엇을 기다리는가.\n그날이 오면, 나는 무엇을 해야 하는가.",
  ]));
  readable(obs, "l10_form", "정착 확인서 양식", { x: 5, y: 9 }, readLines([
    "(양식) 정착 확인서. 이 땅에 사는 자가\n하늘에서 온 자를 보증한다는 증명서.",
    "(양식) 서명란: 기록자 ____\n(여백, 하넬의 필체) 꼭 이 땅 사람이어야 하는가?",
  ]));
}

function vaultReadables(project: Project, ids: Ids): void {
  const gate = project.maps["fs_vault_gate"];
  if (gate) {
    readable(gate, "l1_code", "별지기 규약", { x: 11, y: 9 }, readLines([
      "(책) 별지기 규약.\n하나, 하늘을 읽되 부르지 않는다.",
      "(책) 둘, 읽은 것은 적되 입에 올리지 않는다.\n셋, 답이 와도 대답하지 않는다.",
      "(책) 넷, 아이가 오더라도 맞이하지 않는다.\n다섯, 그 아이가 불을 지를 수 있음을 잊지 않는다.",
    ]));
    readable(gate, "l2_annals", "낙하 연표", { x: 10, y: 8 }, readLines([
      "(책) 별비의 밤. 삼백 년 전.\n방주선이 하늘에서 내려와 사람을 내려놓았다.",
      "(책) 이레네. 은빛 머리, 붉은 눈이라 전한다.\n땅에 사람을 내려놓고 홀로 하늘에 남았다.",
      "(책) 서른 해 전 겨울. 새벽샘에 하늘의 것이\n내려앉았다. 뒤쪽 장은 가위로 잘려 나갔다.",
    ]));
  }
  const vault = project.maps[ids.vault];
  if (vault) {
    readable(vault, "l8_tablet", "잠든 약속 석판", { x: 15, y: 6 }, readLines([
      "우리는 하늘이 다시 올 때까지\n이 방을 지킨다. 잠든 약속이다.",
      "돌 아래쪽에 새로 파낸 표식이 보인다.\n성등 교단 심문회의 인장이 깊이 박혀 있다.",
      "(석판) 위쪽 별지기 글자와 아래쪽 인장은\n같은 손이 새긴 것이 아니다.",
    ], "석판"));
    readable(vault, "l9_rune", "두 번 부르지 마라", { x: 12, y: 6 }, readLines([
      "두 번 부르지 마라.\n한 번은 하늘이 듣고, 두 번은 땅이 듣는다.",
      "(룬) 세 번 부르면 들은 것이 문을 연다.\n부르지 않으면 문은 열리지 않는다.",
    ], "룬"));
  }
}

// 마을·숲·약방 읽을거리: 이벤트만 새로 더한다 (다른 쪽 이벤트·상자·상점은 건드리지 않는다).
function townReadables(project: Project, ids: Ids): void {
  const hub = project.maps[ids.hub];
  if (hub) {
    readable(hub, "l5_decree", "심문회 포고", { x: 26, y: 19 }, readLines([
      "(포고) 하나, 하늘에서 떨어진 것은 심문회에 인도한다.\n둘, 숨기거나 손대는 자는 이단으로 다스린다.",
      "(포고) 셋, 발견 즉시 신고하라.\n(손글씨, 다른 필체) 아이들은 제외한다.",
      "(포고) 인장: 성등 교단 심문회. 심문관 발렌.",
    ]));
  }
  const apothecary = project.maps["fs_apothecary"];
  if (apothecary) {
    readable(apothecary, "l6_diary", "낡은 일기장", { x: 6, y: 11 }, readLines([
      "(일기) 발렌, 열 살. 새벽샘에서\n혼자 걸어왔다. 말이 없다. 밥은 먹는다.",
      "(일기) 밤마다 창가에서 북쪽만 본다.\n하넬이 별 이름을 서툴게 가르친다.",
      "(일기) 오늘 아이가 처음 웃었다.\n…내가 눈이 어두워진 것은 연기 때문이 아니다.",
    ]));
  }
  const forest = project.maps[ids.forest];
  if (forest) {
    readable(forest, "l7_marker", "두 번째 별 표지석", { x: 16, y: 20 }, readLines([
      "(표지석) 두 번째 별, 여기 서다.\n하늘을 건너온 이를 위하여.",
      "(표지석) 세운 이: 하넬 외 두 사람.\n지도에는 없는 표지석이다.",
    ]));
  }
}
