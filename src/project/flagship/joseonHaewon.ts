/**
 * 『해원(解冤): 청석골 검안록』 — 조선 퇴마 수사극 데모(설계 docs/games/joseon/design.md).
 *
 * 흉년 든 봄, 감영에서 내려온 젊은 검률이 「귀신 짓」으로 덮인 죽음을 시신으로 다시 읽고 원귀 대신 사람을 지목한다.
 * 이 판: 프롤로그 + 사건 1 「우물에서 우는 아이」(검안 → 지목 → 밤 우물 퇴마). 사건 2·3·결말은 다음 판.
 *
 * 맵은 모두 번들 joseon_baram 등록 장소를 그대로 가져온다(import_region_reference) — 새 판을 짓지 않는다.
 * 문 ↔ 방은 link_joseon_interior, 사건 논리는 author_mystery_case verdict.mode "chapter"(지목 뒤 게임이 이어진다).
 * 흐름은 var_jw_stage 하나가 쥔다. 인물·마을 이름은 모두 지어낸 것이다.
 *
 * 등장 칩: 조선 검수에서 허용된 RTP 칩만(설계 2절 「사람」). 귀신은 맵에 몸으로 나오지 않는다 — 빛·소리·그림 한 겹뿐.
 */
import { charsetFrameIndex } from "@/assets/easyrpgRtp";
import { FLAGSHIP_BEAT_MANIFESTS } from "./beats";
import { writeJoseonHaewonLore } from "./joseonHaewonLore";
import type { FlagshipDemoBuildResult } from "./types";
import { prepareTool } from "@/editor/tools/asyncToolRunner";
import { runTool } from "@/editor/tools/toolRunner";
import "@/editor/tools/toolRegistry";
import { battleLookForPreset } from "@/project/battleLook";
import { createBlankProject } from "@/project/defaults";
import { DEFAULT_ACTOR_ID } from "@/project/defaults/constants";
import { deserialize, serialize } from "@/project/io";
import { regionReferenceScene } from "@/project/regionReferenceImport";
import type { Command, Dir, EventPage, EventPageCondition, GameEvent, Project } from "@/project/types";
import { m2 } from "./firstLoveKit";

// ── 상태 ──
export const V_STAGE = "var_jw_stage";
export const V_SEAL = "var_jw_seal";
export const SW = {
  c1Solved: "sw_jw_c1_solved",
  c1Wrong: "sw_jw_c1_wrong",
  c1Haewon: "sw_jw_c1_haewon",
  c1Night: "sw_jw_c1_night",
  c1RitualDone: "sw_jw_c1_ritual_done",
  metDeokbae: "sw_jw_met_deokbae",
  innRoom: "sw_jw_inn_room",
} as const;

/** 흐름 단계 — 설계 3절. */
export const S = { ARRIVE: 0, TO_OFFICE: 1, CASE1: 2, C1_ACCUSED: 3, C1_NIGHT: 4, C1_DONE: 5, C1_MORNING: 6 } as const;

export const JW_MAP = {
  village: "map_jw_village",
  office: "map_jw_office",
  inn: "map_jw_inn",
  shrine: "map_jw_shrine",
} as const;

// ── 칩(설계 2절 「사람」) ──
type Chip = { tex: string; resource: string; index: number };
const CHIP = {
  hero: { tex: "tex_easyrpg_charset_actor1", resource: "easyrpg-charset-actor1", index: 6 },
  deokbae: { tex: "tex_easyrpg_charset_actor1", resource: "easyrpg-charset-actor1", index: 0 },
  ibang: { tex: "tex_easyrpg_charset_actor3", resource: "easyrpg-charset-actor3", index: 1 },
  wolhwa: { tex: "tex_easyrpg_charset_people1", resource: "easyrpg-charset-people1", index: 7 },
  jeong: { tex: "tex_easyrpg_charset_actor3", resource: "easyrpg-charset-actor3", index: 3 },
  chilbok: { tex: "tex_easyrpg_charset_actor2", resource: "easyrpg-charset-actor2", index: 0 },
  jumo: { tex: "tex_easyrpg_charset_people4", resource: "easyrpg-charset-people4", index: 4 },
} as const satisfies Record<string, Chip>;

/** 사건 도구(place_npc 경로)에 넘기는 외형 — 도구의 GraphicSpec 모양. */
const specOf = (chip: Chip) => ({ textureKey: chip.tex, characterIndex: chip.index });
const graphicOf = (chip: Chip, dir: Dir = "down") => ({
  sprite: { type: "bundled", id: chip.tex }, direction: dir,
  pattern: charsetFrameIndex({ characterIndex: chip.index, direction: dir, pattern: 1 }), transparent: false,
});

// ── 소리(설계 2절 「소리」) ──
const BGM = {
  village: "cc0-bgm-rtp-fld-002",
  inn: "cc0-bgm-rtp-sbd-002",
  examine: "cc0-bgm-rtp-mys-001",
  night: "cc0-bgm-rtp-fog-001",
  ritual: "cc0-bgm-rtp-skt-001",
  battle: "cc0-bgm-rtp-ccp-005",
} as const;
const SE_DOOR = "cc0-se-osx-wooden-01";
const SE_PAPER = "cc0-se-osx-paper-04";

// ── 명령 조각 ──
const say = (speaker: string, ...lines: string[]): Command[] =>
  lines.map((body) => ({ kind: "text", speaker, body, position: "bottom" } as Command));
const think = (...lines: string[]): Command[] =>
  lines.map((body) => ({ kind: "text", speaker: "정 검률", body: `(${body})`, position: "bottom" } as Command));
const caption = (...lines: string[]): Command[] =>
  lines.map((body) => ({ kind: "text", body, position: "bottom", context: "narration" } as Command));
const wait = (ms: number): Command => ({ kind: "wait", ms });
const setVar = (variableId: string, value: number): Command => ({ kind: "setVariable", variableId, op: "=", value } as Command);
const setSw = (switchId: string, value = true): Command => ({ kind: "setSwitch", switchId, value } as Command);
const bgm = (resourceId: string, fadeInMs = 800): Command => ({ kind: "playAudio", resourceId, loop: true, channel: "bgm", fadeInMs } as Command);
const stopBgm = (): Command => ({ kind: "stopAudio", channel: "bgm" } as Command);
const se = (resourceId: string): Command => ({ kind: "playAudio", resourceId, loop: false, channel: "se" } as Command);
const fadeOut = (ms = 700): Command[] => [m2("Screen Effect", { effect: "fadeOut", value: "", durationMs: ms }), wait(ms)];
const fadeIn = (ms = 700): Command[] => [m2("Screen Effect", { effect: "fadeIn", value: "", durationMs: ms }), wait(ms)];
const journal = (lineId: string, date: string, text: string): Command =>
  m2("Journal Line", { action: "write", lineId, writer: "geomryul", date, text });
const objective = (objectiveId: string, text: string, state: "start" | "complete" = "start"): Command =>
  m2("Quest Objective", { questId: "q_jw_main", objectiveId, state, text });
const walkTo = (eventId: string, x: number, y: number): Command =>
  ({ kind: "moveEvent", eventId, route: { moves: [{ kind: "approach", x, y, distance: 0 }], repeat: false, wait: true, skippable: true } } as Command);
const faceHero = (eventId: string): Command =>
  ({ kind: "moveEvent", eventId, route: { moves: [{ kind: "turnTowardPlayer" }], repeat: false, wait: true, skippable: true } } as Command);
const transfer = (mapId: string, x: number, y: number, direction: Dir = "down"): Command =>
  ({ kind: "transfer", mapId, x, y, direction, fade: "black" } as Command);
void SE_DOOR; void transfer; // 사건 2·3 에서 쓴다

const stageIs = (n: number): EventPageCondition => ({ kind: "variable", variableId: V_STAGE, op: "==", value: n } as EventPageCondition);
const stageAtLeast = (n: number): EventPageCondition => ({ kind: "variable", variableId: V_STAGE, op: ">=", value: n } as EventPageCondition);
const swOn = (id: string): EventPageCondition => ({ kind: "switch", switchId: id, value: true } as EventPageCondition);

type PageOpts = { chip?: Chip; dir?: Dir; trigger?: "action" | "auto" | "playerTouch" | "parallel"; priority?: "below" | "same" | "above" };
function page(id: string, conditions: EventPageCondition[], commands: Command[], opts: PageOpts = {}): EventPage {
  const dir = opts.dir ?? "down";
  return {
    id, name: id, conditions,
    graphic: opts.chip ? graphicOf(opts.chip, dir) : { direction: dir, pattern: 0, transparent: true },
    movement: { type: "fixed", speed: 3, frequency: 3 },
    priority: opts.priority ?? (opts.chip ? "same" : "below"),
    overlapForbidden: !!opts.chip,
    trigger: { kind: opts.trigger ?? "action" },
    commands,
  } as unknown as EventPage;
}
function event(id: string, name: string, at: { x: number; y: number }, pages: EventPage[]): GameEvent {
  return { id, name, x: at.x, y: at.y, trigger: pages[0]?.trigger ?? { kind: "action" }, commands: [], pages } as GameEvent;
}

function exec(project: Project, name: string, args: Record<string, unknown>): { data?: unknown; summary?: string } {
  const ctx = { project, assistantRun: false };
  const res = runTool(ctx, name, args, { dryRun: false });
  if (!res.ok) throw new Error(`[joseon-haewon] ${name} 실패: ${res.summary} ${JSON.stringify(res.issues ?? []).slice(0, 600)}`);
  Object.assign(project, ctx.project);
  return { data: res.data, summary: res.summary };
}

/** 이 데모가 가져오는 등록 장소. 빌더는 동기라 굽기·dev 폴백 전에 한 번 받아 둔다. */
/** author_mystery_case 가 동봉한 사건 1 검증 시나리오(증거 → 탐문 → 정답 지목). 증거 스크립트가 읽는다. */
export let lastCase1VerificationScene: unknown;

export const JW_PLACES = ["joseon-v20-64x56", "joseon-in-office-17x15", "joseon-in-inn-22x16", "joseon-in-house-15x15"] as const;
export async function preloadJoseonHaewon(): Promise<void> {
  await Promise.all(JW_PLACES.map((id) => prepareTool("import_region_reference", { id }, createBlankProject())));
}
function assertPreloaded(): void {
  for (const id of JW_PLACES) {
    try { regionReferenceScene(id); } catch (error) {
      throw new Error(`[joseon-haewon] 등록 장소 ${id} 를 먼저 받아야 합니다 — preloadJoseonHaewon() 뒤에 지으세요. (${error instanceof Error ? error.message : String(error)})`);
    }
  }
}

// ── 사건 1 자리(청석골 칸, design.md 2절 실측) ──
const V = {
  arrive: { x: 1, y: 28 },
  deokbae: { x: 3, y: 27 },
  well: { x: 32, y: 26 },
  wellSpot: { x: 32, y: 27 }, // 우물 아래 칸 — 밤 퇴마 자리
  wellSide: { x: 31, y: 27 },
  laundry: { x: 38, y: 27 }, // 빨래터 줄 아래
  millYard: { x: 39, y: 37 }, // 방앗간 마당(물레방아 곁, 걷는 칸)
  jeong: { x: 34, y: 37 },
  chilbok: { x: 36, y: 24 },
  wolhwaDay: { x: 5, y: 22 },
  wolhwaNight: { x: 33, y: 27 },
  seonangdang: { x: 13, y: 33 },
} as const;
const OFFICE = { ibang: { x: 8, y: 7 }, corpse: { x: 3, y: 9 }, arrive: { x: 8, y: 11 } } as const;
const INN = { jumo: { x: 12, y: 6 }, bed: { x: 18, y: 4 } } as const;

const ITEM = (clue: string) => `item_mystery_c1_${clue}`;

export function createJoseonHaewonFlagshipDemo(): FlagshipDemoBuildResult {
  assertPreloaded();
  const project = createBlankProject();
  const initialMapIds = Object.keys(project.maps);
  project.meta.title = "해원 : 청석골 검안록";
  project.meta.author = "OPRN Flagship Studio";
  project.system.playResolution = { width: 480, height: 270 };
  project.system.dialogueStyle = "joseon";
  const look = battleLookForPreset("ink");
  if (look) project.system.battleLook = look;

  const hero = project.database.actors.find((a) => a.id === DEFAULT_ACTOR_ID) ?? project.database.actors[0]!;
  hero.name = "정 검률";
  hero.nickname = "감영 검률";
  hero.characterResourceId = CHIP.hero.resource;
  hero.characterIndex = CHIP.hero.index;
  hero.battleCharacterResourceId = "charset-battler-actor1-6"; // 같은 칩의 짝 전투 시트(물려받은 검사 actor1-0 대신)
  delete hero.faceResourceId;

  // 맵: 등록 장소 그대로.
  exec(project, "import_region_reference", { id: "joseon-v20-64x56", newMapId: JW_MAP.village, name: "청석골" });
  for (const id of initialMapIds) delete project.maps[id];
  const link = (door: { x: number; y: number }, place: string, newMapId: string, name: string) =>
    exec(project, "link_joseon_interior", { mapId: JW_MAP.village, door, place, newMapId, name }).data as {
      interiorMapId: string; step: { x: number; y: number }; entryLanding: { x: number; y: number };
    };
  const office = link({ x: 17, y: 8 }, "joseon-in-office-17x15", JW_MAP.office, "관아 동헌");
  const inn = link({ x: 51, y: 35 }, "joseon-in-inn-22x16", JW_MAP.inn, "주막");
  const shrine = link({ x: 3, y: 20 }, "joseon-in-house-15x15", JW_MAP.shrine, "월화 만신의 집");
  void office; void inn; void shrine;
  // 시작은 마을 서쪽 들머리 — 사건 검사(시작 칸·시작 맵 도달)가 이것을 본다.
  project.startMapId = JW_MAP.village;
  project.startPos = { ...V.arrive };

  const ensureVar = (id: string, name: string) => { if (!project.variables.some((v) => v.id === id)) project.variables.push({ id, name }); };
  const ensureSw = (id: string, name: string) => { if (!project.switches.some((s) => s.id === id)) project.switches.push({ id, name }); };
  ensureVar(V_STAGE, "해원 진행 단계");
  ensureVar(V_SEAL, "봉인 횟수");
  ensureSw(SW.c1Haewon, "사건 1: 분이를 이름 불러 보냄");
  ensureSw(SW.c1Night, "사건 1: 밤 우물");
  ensureSw(SW.c1RitualDone, "사건 1: 퇴마 끝");
  ensureSw(SW.metDeokbae, "덕배를 만남");
  ensureSw(SW.innRoom, "주막 방을 잡음");

  // 검안록(일지) — ESC 메뉴 이름.
  exec(project, "configure_story_journal", { title: "검안록", writers: [{ id: "geomryul", name: "정 검률" }] });

  buildBattle(project);
  buildCase1(project);
  buildPrologue(project, office.step);
  buildInn(project);
  buildRitual(project);

  // 맵 바탕 소리·이름.
  const bgmOf: Record<string, string> = { [JW_MAP.village]: BGM.village, [JW_MAP.office]: BGM.examine, [JW_MAP.inn]: BGM.inn, [JW_MAP.shrine]: BGM.village };
  for (const [id, track] of Object.entries(bgmOf)) { const m = project.maps[id]; if (m) m.bgm = { mode: "custom", resourceId: track }; }
  // 맵에 기본 조명을 박지 않는다 — 박으면 밤 장면(setLighting) 뒤 문을 드나들 때마다 낮으로 돌아간다(기본 조명 없는 맵은 앞 맵 조명을 잇는다).
  for (const id of Object.values(JW_MAP)) { const m = project.maps[id]; if (m) delete m.defaultLighting; }

  project.startMapId = JW_MAP.village;
  project.startPos = { ...V.arrive };
  writeJoseonHaewonLore(project);

  const serialized = serialize(project);
  const reloaded = deserialize(serialized);
  return {
    id: "joseon-haewon",
    manifest: { ...FLAGSHIP_BEAT_MANIFESTS["joseon-haewon"], mapCount: Object.keys(reloaded.maps).length, endingCount: reloaded.endings?.length ?? 0 },
    project: reloaded,
    serialized,
  };
}

// ── 프롤로그 「청석골에 들다」 ──
function buildPrologue(project: Project, officeStep: { x: number; y: number }): void {
  const village = project.maps[JW_MAP.village]!;
  const office = project.maps[JW_MAP.office]!;
  void officeStep;
  village.events.push(event("ev_jw_arrive", "청석골 들머리", V.arrive, [
    page("p_arrive", [stageIs(S.ARRIVE)], [
      ...fadeOut(0),
      stopBgm(),
      ...caption("경상도 산골, 청석골.", "지난겨울 환곡 쌀에 모래가 섞였고, 봄이 오기 전에 마을 사람이 셋 죽었다."),
      ...caption("감영은 검률 하나를 내려보냈다."),
      bgm(BGM.village, 1600),
      ...fadeIn(1200),
      wait(600),
      walkTo("ev_jw_deokbae", 2, 28),
      faceHero("ev_jw_deokbae"),
      ...say("덕배", "감영에서 오신 검률 나리십니까. 오작사령 덕배올시다.", "사또께서는 몸이 편찮으시다고 동헌에 나오지 않으십니다. 이방 어른이 기다리고 계십니다."),
      ...say("정 검률", "사또가 아니라 이방이 기다린다."),
      ...say("덕배", "……예. 이 고을 일은 대개 그렇게 돌아갑니다."),
      setSw(SW.metDeokbae),
      setVar(V_STAGE, S.TO_OFFICE),
      objective("o_office", "관아 동헌으로 간다"),
    ], { trigger: "auto" }),
    page("p_arrive_done", [stageAtLeast(S.CASE1)], []),
  ]));

  // 덕배 — 동료. 단서를 보이면 추론한다(presentItem).
  village.events.push(event("ev_jw_deokbae", "덕배", V.deokbae, [
    page("p_deok_wait", [], [...say("덕배", "동헌은 북쪽 담장 안입니다. 큰길 따라 가시다가 솔숲 대문으로 드시면 됩니다.")], { chip: CHIP.deokbae, dir: "right" }),
    page("p_deok_case", [stageAtLeast(S.CASE1)], deokbaeReasoning(), { chip: CHIP.deokbae, dir: "down" }),
  ]));

  // 동헌 — 이방이 사건 기록을 건넨다(자동, 한 번).
  office.events.push(event("ev_jw_office_intro", "동헌 첫 대면", OFFICE.arrive, [
    page("p_office_intro", [stageIs(S.TO_OFFICE)], [
      wait(400),
      ...say("이방 최득량", "감영에서 먼 길을 오셨소. 이방 최득량이오."),
      ...say("이방 최득량", "기록은 셋이오. 노비 아이가 우물에 빠졌고, 서원이 곳간에서 목을 맸고, 지난겨울 뒷산 굴에서 떠돌이들이 얼어 죽었소."),
      ...say("이방 최득량", "마을은 셋 다 귀신 짓이라 하오. 굿 날도 벌써 받아 놨소."),
      ...say("정 검률", "기록이 셋이면 시신도 셋이오. 귀신은 시신을 남기지 않소."),
      ...say("이방 최득량", "……분이 아이는 아직 묻지 않았소. 저 마당 거적 아래 있소. 보고 싶으시면 보시오."),
      se(SE_PAPER),
      journal("l_arrive", "삼월 열이틀", "청석골에 들었다. 이방은 기록을 셋 내놓았다. 셋 다 귀신 짓이라 한다."),
      journal("l_c1_open", "삼월 열이틀", "노비 분이(열다섯). 지난달 마을 우물에서 건졌다. 밤마다 우물에서 운다고들 한다."),
      setVar(V_STAGE, S.CASE1),
      objective("o_office", "관아 동헌으로 간다", "complete"),
      objective("o_well", "분이가 어떻게 죽었는지 밝힌다"),
    ], { trigger: "auto" }),
    page("p_office_intro_done", [stageAtLeast(S.CASE1)], []),
  ]));
}

/** 덕배에게 단서를 보이면 하는 말 — 설계 3절 「추론」. */
function deokbaeReasoning(): Command[] {
  return [
    ...say("덕배", "보실 것이 있으면 보여 주십시오. 저는 시신은 많이 만져 봤어도 글은 모릅니다."),
    {
      kind: "presentItem",
      prompt: "덕배에게 무엇을 보일까?",
      options: [
        { itemId: ITEM("autopsy"), branch: say("덕배", "목에 손 자국이 넷이오. 사람 손이오.", "물귀신은 목을 조르지 않습니다. 누가 먼저 죽이고 우물에 넣은 겁니다.") },
        { itemId: ITEM("sandal"), branch: say("덕배", "빨래터 짚신이라…… 분이는 우물 쪽이 아니라 냇가 쪽에서 왔단 말이지요.", "냇가 아래로 내려가면 방앗간입니다.") },
        { itemId: ITEM("rice"), branch: say("덕배", "쌀에 모래를 섞는 건 밤일입니다. 낮에 하면 다 보지요.", "분이가 방앗간에서 뭘 봤구먼.") },
        { itemId: ITEM("scratch"), branch: say("덕배", "손등이 그렇게 긁히려면 누가 손톱을 세워 버텼다는 얘기요.", "열다섯 살 계집아이 손톱이면 그 정도는 됩니다.") },
        { itemId: ITEM("jumo"), branch: say("덕배", "주모가 그렇다면 칠복이는 그 밤 장작더미 곁에 있었던 게지요.", "그 녀석은 분이를 좋아했습니다. 소문은 그게 다요.") },
      ],
      otherwiseBranch: say("덕배", "그건 이 일하고는 상관이 없어 보입니다."),
      cancelBranch: say("덕배", "필요하시면 언제든 부르십시오."),
    } as unknown as Command,
  ];
}

// ── 사건 1 — author_mystery_case(chapter) ──
function buildCase1(project: Project): void {
  const at = (p: { x: number; y: number }, mapId: string = JW_MAP.village) => ({ mapId, x: p.x, y: p.y });
  const authored = exec(project, "author_mystery_case", {
    caseId: "c1",
    title: "우물에서 우는 아이",
    victim: { name: "분이" },
    culprit: "jeong",
    suspects: [
      {
        id: "chilbok", name: "칠복", at: at(V.chilbok), graphic: specOf(CHIP.chilbok),
        greeting: ["……검률 나리요. 분이 일 때문이오?"],
        alibi: ["그 밤은 주막 뒤에서 장작을 팼소. 주모가 시킨 일이오. 새벽닭 울 때까지 팼소."],
        motive: ["사람들이 나랑 분이가 정분났다고 하는 거 아오. 정분은 무슨…… 밥 한 술 나눠 먹은 게 다요."],
        testimony: ["분이는 밤이면 방앗간 쪽으로 심부름을 다녔소. 정 서방이 품삯을 쳐준다고."],
      },
      {
        id: "jeong", name: "정 서방", at: at(V.jeong), graphic: specOf(CHIP.jeong),
        greeting: ["방앗간 정가요. 무슨 일로 오셨소."],
        alibi: ["그 밤엔 방아 찧고 일찍 잤소."],
        motive: ["분이요? 심부름이나 하던 아이요. 내가 그 아이를 왜."],
        testimony: ["물귀신이 데려갔다고들 하지 않소. 만신이 그렇다면 그런 게지."],
        lie: {
          claim: "그 밤 방앗간엔 아무도 없었소. 물레방아도 멈춰 있었고.",
          contradictedBy: "rice",
          truth: ["……밤에 방아를 돌렸소. 이방 어른 곳간 쌀이었소. 그건 내가 정한 일이 아니오."],
        },
      },
      {
        id: "wolhwa", name: "월화 만신", at: at(V.wolhwaDay), graphic: specOf(CHIP.wolhwa),
        greeting: ["검률 나리시구려. 우리 분이를 보러 오셨소."],
        alibi: ["그 밤엔 신당에서 혼자 정화수를 떠 놓고 있었소. 누가 봤겠소."],
        motive: ["물귀신이라고 먼저 말한 게 나요. 굿값을 바란다고들 하지요.", "울어 주는 값은 쌀 한 되요. 우리 분이는 내가 공으로 울어 줘야지."],
        testimony: ["분이가 건져지던 날, 그 애 손톱이 깨끗했소. 물에 빠진 사람 손이 아니오."],
      },
    ],
    clues: [
      {
        id: "autopsy", name: "검안 소견 一", at: at(OFFICE.corpse, JW_MAP.office),
        description: "입·코에 거품 없음. 손톱 밑 진흙 없음. 배가 부르지 않음. 목 앞쪽에 손가락 자국 넷.",
        lines: ["거적을 걷는다.", "입과 코에 거품이 없다. 손톱 밑도 깨끗하다. 배가 부르지 않다.", "물에 빠져 죽은 몸이 아니다. 목 앞쪽에 손가락 자국이 넷, 엄지 자국이 하나."],
        implicates: [], obtainedBy: "examine",
      },
      {
        id: "sandal", name: "젖은 짚신 한 짝", at: at(V.laundry),
        description: "빨래터 줄 아래 떨어져 있던 작은 짚신. 끈이 끊어졌다. 분이 발에 맞는 크기.",
        lines: ["빨래 줄 아래, 작은 짚신 한 짝이 젖어 있다.", "끈이 끊어졌다. 우물 쪽이 아니라 냇가 쪽 길에 떨어져 있었다."],
        implicates: [], obtainedBy: "examine",
      },
      {
        id: "rice", name: "모래 섞인 쌀", at: at(V.millYard),
        description: "방앗간 물레방아 곁에 흘린 쌀. 손으로 비비면 모래가 굴러 나온다.",
        lines: ["물레방아 곁에 쌀이 흘려져 있다.", "손바닥에 올려 비비자 모래가 굴러 나온다. 밤에 찧은 쌀이다. 쌀알에 아직 밤이슬이 앉아 있다."],
        implicates: ["jeong"], obtainedBy: "examine",
      },
      {
        id: "jumo", name: "주모의 증언", description: "주모: 칠복이는 그 밤 새벽까지 주막 뒤에서 장작을 팼소. 내가 내다 봤소.",
        excludes: ["chilbok"], implicates: [], obtainedBy: "testimony", givenBy: "chilbok",
      },
      {
        id: "wolhwa_nails", name: "만신의 증언", description: "월화: 건져지던 날 분이 손톱이 깨끗했다. 물에 빠진 사람 손이 아니다.",
        excludes: ["wolhwa"], implicates: [], obtainedBy: "testimony", givenBy: "wolhwa",
      },
      {
        id: "scratch", name: "정 서방 손등의 긁힌 자국", description: "정 서방 오른손 등에 손톱 자국 셋. 아물어 가는 딱지.",
        implicates: ["jeong"], obtainedBy: "testimony", givenBy: "jeong",
      },
    ],
    requiredClues: ["autopsy", "rice", "jumo", "wolhwa_nails", "scratch"],
    accuser: {
      name: "이방 최득량", at: at(OFFICE.ibang, JW_MAP.office), graphic: specOf(CHIP.ibang),
      intro: ["분이 일이오? 귀신 짓이라니까 그러시오."],
      hint: ["검률 나리, 이 고을은 귀신 하나쯤 품고 삽니다. 장부까지 들춰서 누구 좋으라고 그러시오.", "사람을 짚으시려면 그만한 걸 가져오시오."],
      ready: ["……그래서, 누구라는 거요."],
      prompt: "분이를 죽인 사람은?",
    },
    endings: {
      solved: { name: "정 서방을 지목함", lines: [] },
      wrong: { name: "엉뚱한 사람을 지목함", lines: [] },
    },
    verdict: {
      mode: "chapter",
      solvedSwitchId: SW.c1Solved,
      wrongSwitchId: SW.c1Wrong,
      onSolved: [
        ...say("정 검률", "방앗간 정 서방이오. 손등에 아이 손톱 자국이 있소. 그 밤 방아도 돌았소."),
        wait(500),
        ...say("정 서방", "죽이려던 게 아니오. 아들놈 이름을 군안에서 빼 준다기에……", "소리만 못 지르게 막았는데, 손을 떼니 숨이 없었소."),
        ...say("이방 최득량", "방앗간 놈이 혼자 한 짓이오. 옥에 넣으시오. 더 들출 것 없소."),
        ...think("군안에서 이름을 빼 준다는 말은 누가 했나. 이방은 묻기도 전에 덮는다."),
        journal("l_c1_solved", "삼월 열사흘", "분이는 목이 졸린 뒤 우물에 던져졌다. 방앗간 정 서방이 했다. 밤에 쌀에 모래를 섞는 것을 그 아이가 봤다."),
        setVar(V_STAGE, S.C1_ACCUSED),
        objective("o_well", "분이가 어떻게 죽었는지 밝힌다", "complete"),
        objective("o_night", "밤, 우물가의 월화를 찾는다"),
      ],
      onWrong: [
        ...say("이방 최득량", "그렇다면 그런 게지요. 마을에 알리겠소."),
        wait(500),
        ...caption("그날 저녁, 마을 사람들이 지목된 이를 멍석에 말았다."),
        ...think("손등의 자국을 보지 않았다. 그 밤 방아 소리도 묻지 않았다."),
        journal("l_c1_wrong", "삼월 열사흘", "분이 사건을 닫았다. 닫은 것이 맞는지는 모르겠다."),
        setVar(V_STAGE, S.C1_ACCUSED),
        objective("o_well", "분이가 어떻게 죽었는지 밝힌다", "complete"),
        objective("o_night", "밤, 우물가의 월화를 찾는다"),
      ],
      after: ["사건은 끝났소. 더 할 말 있으시오?"],
    },
  });
  lastCase1VerificationScene = (authored.data as { verificationScene?: unknown } | undefined)?.verificationScene;

  // 지목 뒤: 정 서방은 옥에 들고, 낮의 월화는 밤 우물가로 옮겨 간다. 칠복은 남아 한마디 한다.
  const village = project.maps[JW_MAP.village]!;
  const suspect = (id: string) => village.events.find((e) => e.id === `ev_mystery_c1_suspect_${id}`);
  for (const id of ["jeong", "wolhwa"]) suspect(id)?.pages?.push(page(`p_${id}_gone`, [stageAtLeast(S.C1_ACCUSED)], []));
  suspect("chilbok")?.pages?.push(page("p_chilbok_after", [stageAtLeast(S.C1_ACCUSED)], [
    ...say("칠복", "정 서방이 옥에 들었다지요.", "……분이가 그 밤에 뭘 봤는지, 이제 다들 알게 됐소."),
  ], { chip: CHIP.chilbok, dir: "down" }));
}

// ── 주막 — 방 잡기·쉬기 ──
function buildInn(project: Project): void {
  const inn = project.maps[JW_MAP.inn]!;
  inn.events.push(event("ev_jw_jumo", "주모", INN.jumo, [
    page("p_jumo", [], [
      ...say("주모", "어서 오시오. 국밥은 없고 시래깃국은 있소."),
      setSw(SW.innRoom),
      ...say("주모", "방은 안쪽 끝이오. 감영 나리라고 값은 안 받겠소. 대신 분이 일, 제대로 봐 주시오."),
    ], { chip: CHIP.jumo, dir: "down" }),
    // 퇴마 뒤 — 방에 들어 자고 아침을 맞는다(사건 1 마감).
    page("p_jumo_sleep", [stageIs(S.C1_DONE)], [
      ...say("주모", "우물 쪽에서 오시는 길이오? 얼굴이 하얗소.", "방은 안쪽 끝이오. 불은 내가 끄리다."),
      ...fadeOut(1200),
      stopBgm(),
      { kind: "removeLight", id: "lt_jw_hand" } as Command,
      { kind: "removeLight", id: "lt_jw_well" } as Command,
      { kind: "setLighting", ambient: 0, color: "#000000", transitionMs: 0 } as Command,
      setSw(SW.c1Night, false),
      wait(900),
      ...caption("이튿날 아침."),
      journal("l_c1_close", "삼월 열나흘", "정 서방은 옥에 들었다. 군안에서 아들 이름을 빼 준다는 말은 누가 했는가. 이방은 묻기도 전에 덮었다."),
      objective("o_rest", "주막에서 쉰다", "complete"),
      objective("o_c2", "관아 곳간의 주판 소리를 알아본다"),
      setVar(V_STAGE, S.C1_MORNING),
      bgm(BGM.inn, 1200),
      ...fadeIn(1200),
      ...think("분이 일은 닫았다. 셈은 아직 맞지 않는다."),
      ...caption("사건 一 「우물에서 우는 아이」 끝.", "사건 二 「셈하는 귀신」은 다음 판에 잇는다."),
    ], { chip: CHIP.jumo, dir: "down" }),
    page("p_jumo_morning", [stageAtLeast(S.C1_MORNING)], [
      ...say("주모", "곳간 쪽에서 밤마다 주판 소리가 난다는 말이 있소. 서원이 죽은 뒤로 그렇소."),
    ], { chip: CHIP.jumo, dir: "down" }),
  ]));
}

// ── 밤 우물 퇴마 ──
function buildRitual(project: Project): void {
  const village = project.maps[JW_MAP.village]!;
  // 지목 뒤: 동헌을 나서면 밤이다(마을 맵에 들어설 때 한 번).
  village.events.push(event("ev_jw_c1_dusk", "해 질 녘", { x: 63, y: 0 }, [
    page("p_dusk", [stageIs(S.C1_ACCUSED)], [
      ...fadeOut(900),
      { kind: "setLighting", ambient: 0.78, color: "#0b1530", transitionMs: 0 } as Command,
      { kind: "addLight", source: { id: "lt_jw_hand", at: "player", radius: 3.5, intensity: 0.85, color: "#ffcf8a", flicker: true } } as Command,
      { kind: "addLight", source: { id: "lt_jw_well", at: { x: V.well.x, y: V.well.y }, radius: 2, intensity: 0.45, color: "#9fc4ff", flicker: true } } as Command,
      bgm(BGM.night, 1400),
      setSw(SW.c1Night),
      ...caption("그날 밤."),
      ...fadeIn(1200),
      setVar(V_STAGE, S.C1_NIGHT),
    ], { trigger: "auto" }),
  ]));

  // 월화 — 밤 우물가.
  village.events.push(event("ev_jw_wolhwa_night", "월화 만신(밤)", V.wolhwaNight, [
    page("p_wol_night_off", [], []),
    page("p_wol_night", [swOn(SW.c1Night)], [
      faceHero("ev_jw_wolhwa_night"),
      ...say("월화 만신", "물그릇을 놓았소. 분이가 올 거요."),
      ...say("월화 만신", "굿은 산 사람 들으라고 하는 거요. 죽은 사람은 벌써 다 알고 있소.", "그래도 말은 해 줘야지. 누가, 왜 그랬는지. 맞는 말을 해야 그 애가 듣소."),
      bgm(BGM.ritual, 600),
      wait(800),
      // 귀신은 몸으로 나오지 않는다 — 우물의 찬 빛이 부풀고, 물소리·방울 소리·물안개만.
      se("cc0-se-osx-bell-01"),
      { kind: "addLight", source: { id: "lt_jw_well", at: { x: V.well.x, y: V.well.y }, radius: 3.5, intensity: 0.9, color: "#9fc4ff", flicker: true } } as Command,
      m2("Particle Effect", { preset: "smoke", target: "tile", x: V.well.x, y: V.well.y, durationMs: 2400, sizePercent: 120, wait: false }),
      wait(700),
      se("cc0-se-osx-splash-02"),
      ...caption("두레박 줄이 혼자 내려간다. 우물 안에서 아이 우는 소리가 올라온다."),
      ...say("월화 만신", "왔소. 이제 고하시오."),
      {
        kind: "battleProcessing", troopId: "troop_jw_buni", canEscape: false, canLose: true, branchOnResult: true,
        victoryBranch: ritualEnd(),
        defeatBranch: [
          ...caption("등잔이 꺼졌다. 우물에서 우는 소리가 그쳤다가, 다시 났다."),
          ...say("월화 만신", "말이 틀렸거나, 아직 다 하지 않은 게요. 다시 해 보시오."),
          { kind: "recoverAll" } as Command,
        ],
      } as unknown as Command,
    ], { chip: CHIP.wolhwa, dir: "left" }),
    page("p_wol_night_done", [swOn(SW.c1RitualDone)], [
      ...say("월화 만신", "우물이 조용하오. 가서 주무시오. 내일은 곳간이오."),
    ], { chip: CHIP.wolhwa, dir: "left" }),
  ]));
}

function ritualEnd(): Command[] {
  return [
    bgm(BGM.night, 800),
    ...say("월화 만신", "이제 보내 줄 수 있소. 어찌하겠소."),
    {
      kind: "fork", condition: swOn(SW.c1Wrong),
      then: [
        ...say("월화 만신", "……엉뚱한 이름을 고했으니 이름 불러 보낼 수가 없소. 봉하는 수밖에."),
        ...seal(),
      ],
      else: [{
        kind: "choices", cancelBehavior: "disallow",
        options: [
          {
            text: "이름 불러 보내기",
            branch: [
              ...say("정 검률", "분이야. 너를 죽인 건 방앗간 정 서방이다. 이방 곳간 쌀을 밤에 찧는 걸 네가 봤다.", "이제 다 말했다. 가거라."),
              wait(700),
              { kind: "removeLight", id: "lt_jw_well" } as Command,
              ...caption("물그릇 위로 물결이 한 번 일고, 잦아들었다."),
              ...say("월화 만신", "갔소. 우리 분이가 갔소."),
              setSw(SW.c1Haewon),
              journal("l_c1_haewon", "삼월 열사흘 밤", "분이의 이름을 불러 보냈다. 우물이 조용하다."),
            ],
          },
          {
            text: "부적으로 봉하기",
            branch: seal(),
          },
        ],
      } as unknown as Command],
    } as unknown as Command,
    setSw(SW.c1RitualDone),
    setVar(V_STAGE, S.C1_DONE),
    objective("o_night", "밤, 우물가의 월화를 찾는다", "complete"),
    objective("o_rest", "주막에서 쉰다"),
  ];
}

function seal(): Command[] {
  return [
    ...say("정 검률", "봉하겠소."),
    { kind: "removeLight", id: "lt_jw_well" } as Command,
    ...caption("우물 돌에 부적을 붙였다. 우는 소리가 그쳤다. 그쳤을 뿐이다."),
    { kind: "setVariable", variableId: V_SEAL, op: "+=", value: 1 } as Command,
    journal("l_c1_seal", "삼월 열사흘 밤", "분이를 봉했다. 마을은 조용해졌다고 할 것이다."),
  ];
}

// ── 전투: 분이의 원귀 ──
function buildBattle(project: Project): void {
  exec(project, "upsert_state", { state: {
    id: "state_jw_haewon", name: "해원", restriction: "없음", removalCondition: "전투 종료 시 해제",
    runtimeEffects: { damageTypeRates: { physical: 100, magic: 100 } },
  } });
  exec(project, "upsert_enemy", { enemy: {
    id: "enemy_jw_buni", name: "분이", monsterResourceId: "generated-enemy-banshee-wail",
    stats: { maxHp: 260, maxMp: 0, attack: 34, defense: 12, mind: 30, agility: 22 },
    rewards: { exp: 0, gold: 0, dropRatePercent: 0 },
    damageTypeRates: { physical: 0, magic: 0 },
    skillIds: ["skill_attack"],
  } });
  exec(project, "upsert_enemy", { enemy: {
    id: "enemy_jw_wisp", name: "도깨비불", monsterResourceId: "generated-enemy-wisp-blue",
    stats: { maxHp: 60, maxMp: 0, attack: 22, defense: 6, mind: 18, agility: 30 },
    rewards: { exp: 0, gold: 0, dropRatePercent: 0 }, skillIds: ["skill_attack"],
  } });
  const tell: Command[] = [
    ...say("정 검률", "분이야, 들어라. 너를 죽인 사람은……"),
    {
      kind: "choices", cancelBehavior: "disallow",
      options: [
        { text: "칠복", branch: [...caption("우물 바람이 거세진다. 아니라는 뜻이다.")] },
        { text: "정 서방", branch: [
          ...caption("우는 소리가 낮아진다."),
          m2("Change Enemy State", { target: "enemy_jw_buni", operation: "add", value: "state_jw_haewon" }),
        ] },
        { text: "월화 만신", branch: [...caption("물그릇이 엎어진다. 아니라는 뜻이다.")] },
      ],
    } as unknown as Command,
  ];
  exec(project, "upsert_troop", { troop: {
    id: "troop_jw_buni", name: "우물의 원귀",
    enemyIds: ["enemy_jw_buni", "enemy_jw_wisp", "enemy_jw_wisp"],
  } });
  // 퇴마는 그 자리에서 한다 — 전투 배경은 밤 우물가 필드 화면 그대로(새 배경 그림 없이), 그 위에 옅은 물안개 한 겹.
  project.system.battleBackdrop = "field";
  const troop = project.database.troops.find((t) => t.id === "troop_jw_buni");
  if (troop) troop.backdropLayers = [{ preset: "mist", opacity: 35 }];
  exec(project, "upsert_troop_battle_page", { troopId: "troop_jw_buni", page: {
    id: "bp_jw_open", name: "시작", span: "battle", conditions: [{ kind: "onRound", round: 1 }],
    commands: caption("손을 대도 닿지 않는다. 진상을 고해야 한다."),
  } });
  exec(project, "upsert_troop_battle_page", { troopId: "troop_jw_buni", page: {
    id: "bp_jw_tell", name: "고하기", span: "turn",
    conditions: [{ kind: "everyRound", start: 1, interval: 1 }, { kind: "enemyState", enemyId: "enemy_jw_buni", stateId: "state_jw_haewon", present: false }],
    commands: tell,
  } });
}
