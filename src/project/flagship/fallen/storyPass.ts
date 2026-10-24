/**
 * 『폴른 스타』 제1막 이야기 손질(2026-10-24, 사용자 피드백 6·7·9·10).
 *
 * - 6: 결전 뒤 발렌이 그냥 꺼지지 않고 연막 속으로 사라진다(연기 다섯 줄기·흙먼지·마력 빛, 안개 효과음, 짧은 섬광, 몸이 흐려짐).
 * - 7: 이리스가 갑자기 동료가 되던 흐름을 고친다. 하넬(「안에 누가 있을지도」)·브람(「누굴 부르는 목소리」)이 먼저 깔고,
 *   관 앞에서 이리스가 「데려가 달라」고 묻고 카엘이 고른다(거절해도 엘레나가 설득해 같이 간다). 하넬과 이리스의 첫 만남,
 *   보고 때 이리스가 먼저 입을 떼는 줄, 지하 결전 앞뒤 발렌의 F5·F6 을 넣고, 광장·숲의 설명조 줄을 사람 말로 바꾼다.
 * - 9: 화로 퍼즐 뒤 지하에 나오는 적은 숲짐승이 아니라 「교단 광신도」(먼저 와서 기다리던 심문회 하수인)다.
 *   사람 그림은 새로 만들지 않는다 — 걷기 칩 Actor3 #2(두건·복면)와 People2 #2(지팡이 든 승려)의 전투 시트를 그대로 쓴다.
 * - 10: 빠졌던 꾸지람 넷(천문대 서랍·기사 초소·심문회 상자·모루 서랍)과 광장 할머니의 해 질 녘 줄.
 *   (집 안 수납 보상 줄이기는 townLife.ts 의 HOUSE_FINDS.)
 *
 * 모든 대사 편집이 끝난 뒤, 얼굴(applySpeakerFaces) 직전에 한 번 부른다. 고칠 줄을 못 찾으면 짓기를 멈춘다(문구가 바뀌면 여기도 고친다).
 */
import { charsetFrameIndex } from "@/assets/easyrpgRtp";
import { isPassable } from "@/project/collision";
import type { Command, Condition, EnemyRecord, EventPage, GameEvent, GameMap, Project, TroopRecord } from "@/project/types";
import { FS_NAMES, FS_PREFIX, FS_STAR_KEY_ITEM } from "../fallenStarStory";

const H = `천문대장 ${FS_NAMES.master}`;
const KAEL = FS_NAMES.hero;
const ELENA = FS_NAMES.mage;
const IRIS = FS_NAMES.android;
const VALEN = FS_NAMES.inquisitor;
const BRAM = "숲지기 브람";
const ELDER = "광장의 할머니";
const RINO = "리노";
const ROHAN = "대장장이 로한";

const SW_IRIS_JOINED = "sw_fs_iris_joined";
const SW_VALEN_MARCHED = "sw_fs_valen_marched";
const SW_KNIGHT_MARCHED = "sw_fs_knight_marched";
const SW_HANEL_MET_IRIS = "sw_fs_hanel_met_iris";

const say = (speaker: string, body: string): Command => ({ kind: "text", speaker, body } as Command);
const narrate = (body: string): Command => ({ kind: "text", body } as Command);
const wait = (ms: number): Command => ({ kind: "wait", ms } as Command);
const sw = (switchId: string, value = true): Condition => ({ kind: "switch", switchId, value } as Condition);
const all = (...conditions: Condition[]): Condition => ({ kind: "all", conditions } as unknown as Condition);
const fork = (condition: Condition, then: Command[], otherwise: Command[] = []): Command => ({ kind: "fork", condition, then, else: otherwise } as unknown as Command);
const setSw = (switchId: string, value = true): Command => ({ kind: "setSwitch", switchId, value } as Command);
const m2 = (commandId: string, fields: Record<string, unknown>): Command => ({ kind: "m2Command", commandId, fields } as unknown as Command);
const se = (resourceId: string): Command => ({ kind: "playAudio", resourceId, loop: false, channel: "se" } as Command);
const emote = (target: "player" | string, kind: string, durationMs = 800): Command =>
  ({ kind: "showEmote", target: target === "player" ? "player" : { eventId: target }, emote: kind, durationMs } as unknown as Command);
const turn = (eventId: string, dir: string): Command =>
  ({ kind: "moveEvent", eventId, route: { moves: [{ kind: "turn", dir }], repeat: false, wait: true, skippable: true } } as unknown as Command);
const fine = (amount: number): Command[] => amount > 0
  ? [{ kind: "changeGold", op: "-=", amount } as Command, { kind: "text", body: `벌금 ${amount}G 를 냈다.`, context: "narration", position: "bottom" } as unknown as Command]
  : [];
const dock = (): Command => ({ kind: "displayTextSettings", format: "normal", position: "bottom", preventObscuringPlayer: false, allowEventMovementDuringWait: false } as Command);

// ── 명령 나무 훑기 ──────────────────────────────────────────────────────

type Rec = Record<string, unknown>;
function eachList(commands: Command[], visit: (list: Command[]) => void): void {
  visit(commands);
  for (const cmd of commands) {
    const rec = cmd as unknown as Rec;
    for (const key of ["then", "else", "cancelBranch", "commands"]) if (Array.isArray(rec[key])) eachList(rec[key] as Command[], visit);
    for (const option of (rec.options as { branch?: Command[] }[] | undefined) ?? []) if (Array.isArray(option.branch)) eachList(option.branch, visit);
  }
}
function eventLists(event: GameEvent): Command[][] {
  const out: Command[][] = [];
  for (const page of event.pages ?? []) eachList(page.commands as Command[], (l) => out.push(l));
  if (Array.isArray(event.commands)) eachList(event.commands as Command[], (l) => out.push(l));
  return out;
}
const bodyOf = (c: Command | undefined): string => (c && c.kind === "text" ? String((c as { body?: string }).body ?? "") : "");

/** 맵(또는 이벤트 하나)에서 본문이 needle 을 품은 첫 대사 자리. */
function findLine(map: GameMap, needle: string, eventId?: string): { list: Command[]; index: number } {
  for (const event of map.events) {
    if (eventId && event.id !== eventId) continue;
    for (const list of eventLists(event)) {
      const index = list.findIndex((c) => bodyOf(c).includes(needle));
      if (index >= 0) return { list, index };
    }
  }
  throw new Error(`[fallen-star story] ${map.id}${eventId ? `/${eventId}` : ""} 에서 「${needle}」 대사를 찾지 못했다`);
}
/** 대사 본문만 바꾼다(명령 자체·앞뒤 연출은 그대로). 같은 줄이 여러 페이지에 있으면 모두. */
function rewordAll(map: GameMap, needle: string, body: string, eventId?: string): void {
  let hit = 0;
  for (const event of map.events) {
    if (eventId && event.id !== eventId) continue;
    for (const list of eventLists(event)) for (const c of list) if (bodyOf(c).includes(needle)) { (c as { body?: string }).body = body; hit += 1; }
  }
  if (!hit) throw new Error(`[fallen-star story] ${map.id} 에서 「${needle}」 대사를 찾지 못했다`);
}
function ensureSwitch(project: Project, id: string, name: string): void {
  if (!project.switches.some((s) => s.id === id)) project.switches.push({ id, name });
}
function ensureVariable(project: Project, id: string, name: string): void {
  if (!project.variables.some((v) => v.id === id)) project.variables.push({ id, name });
}

// ── 7. 대사 흐름 ────────────────────────────────────────────────────────

/** 광장 포고 직후 — 엘레나가 약과 무기를 건네는 줄이 안내문처럼 읽혔다. */
function plazaLines(hub: GameMap): void {
  rewordAll(hub, "들었지, 카엘", "…들었지, 카엘? 먼저 본 사람도 이단이래.\n선생님께 가자. 기다리고 계실 거야.");
  rewordAll(hub, "아, 이것도 챙겨. 숲에 짐승이 많대.", "선생님이 부르신 거면 분명 동쪽 숲 일이야.\n이거 챙겨. 천문대 약장에서 가져왔어.");
  rewordAll(hub, "그리고 이거, 천문대 창고에서 나온 거야.", "창고에 굴러다니던 검이랑 창도.\n손에 붙는 쪽으로 들어.");
}

/** 하넬 첫 대화 — 「안에 누가 있을지도」를 먼저 깔고, 엘레나가 같이 가는 이유를 스스로 말한다. */
function hanelAsk(obs: GameMap): void {
  const hanelId = `ev_${FS_PREFIX}_hanel`;
  const at = findLine(obs, "몰았다는 뜻이다", hanelId);
  at.list.splice(at.index + 1, 0,
    say(KAEL, "몰았다고요? 그럼 그 안에…\n누가 타고 있었다는 거예요?"),
    say(H, "그럴지도 모른다. 살아 있다면,\n교단보다 먼저 손을 내밀어 주거라."),
    say(ELENA, "저도 갈게요. 별이 방향을 트는 걸\n제 눈으로 확인하고 싶어요."),
  );
  rewordAll(obs, "동문 밖이 숲이야. 숲지기 브람 아저씨부터 찾자.", "숲길은 브람 아저씨가 제일 잘 알아.\n먼저 찾아가 보자.", hanelId);
}

/** 브람 — 「누굴 부르는 목소리」를 듣고 카엘이 하넬의 말을 떠올린다. */
function bramLines(forest: GameMap): void {
  const bramId = `ev_${FS_PREFIX}_bram`;
  const at = findLine(forest, "사람 목소리도 들렸다", bramId);
  at.list.splice(at.index + 1, 0,
    say(KAEL, "…선생님 말씀이 맞나 봐.\n안에 누가 있어."),
    say(BRAM, "가 볼 거면 서둘러라.\n그 목소리, 밤새 점점 작아졌으니."),
  );
  rewordAll(forest, "『살아 있는 손만 연다』", "자국 둘레에 옛 별지기 글자가 있어.\n『살아 있는 손만 연다』… 선생님 책에서 봤어.");
}

/**
 * 관 앞 8-5 — 이리스가 깨어나 「하늘에 대답할 큰 눈」이 필요하다고 말하고, 데려가 달라고 묻는다. 카엘이 고른다.
 * 「여기 숨어 있어」를 골라도 엘레나가 「여기 두면 버리는 것」이라고 짚어 같이 간다 — 합류는 어느 쪽이든 대화 끝에 온다.
 */
function irisJoins(project: Project, forest: GameMap): void {
  const start = findLine(forest, "…신호, 수신");
  const list = start.list;
  const endAt = list.findIndex((c, i) => i > start.index && bodyOf(c) === "이리스가 동료가 되었다.");
  if (endAt < 0) throw new Error("[fallen-star story] 이리스 합류 줄을 찾지 못했다");
  const old = list.slice(start.index, endAt + 1);
  const keyGain = old.find((c) => c.kind === "changeItem" && (c as { itemId?: string }).itemId === FS_STAR_KEY_ITEM);
  if (!keyGain) throw new Error("[fallen-star story] 별빛 열쇠 얻기 명령이 없다");
  const irisId = `ev_${FS_PREFIX}_iris_field`;
  const iris = forest.events.find((e) => e.id === irisId);
  const pod = forest.events.find((e) => e.id === `ev_${FS_PREFIX}_main_inspect1`);
  const towardPod = iris && pod && iris.x > pod.x ? "left" : "right";
  const joined: Command[] = [
    { kind: "changeParty", actorId: "actor_fs_iris", action: "add" } as Command,
    setSw(SW_IRIS_JOINED),
    narrate("이리스가 동료가 되었다."),
  ];
  const fresh: Command[] = [
    say(IRIS, "…신호, 수신. 현지 시각 불명.\n저는 중계기 이리스입니다."),
    emote("player", "exclamation", 600),
    say(KAEL, "…말을 했어."),
    say(ELENA, "브람 아저씨가 들었다던 목소리,\n이 아이였나 봐."),
    emote(irisId, "sweat", 700),
    turn(irisId, "down"),
    wait(400),
    say(IRIS, "다가오지 마세요. 사람들은 저를 보면\n늘 무서워했어요."),
    say(KAEL, "솔직히 좀 무서워.\n근데 너도 떨고 있잖아."),
    turn(irisId, towardPod),
    say(IRIS, "떨리는 건 흉내예요.\n그래야 사람들이 덜 무서워하니까요."),
    say(KAEL, "흉내든 뭐든 괜찮아. 난 카엘이야.\n넌 이름이 뭐야?"),
    wait(300),
    say(IRIS, "이리스예요. 그리고 돌아갈 「집」이 있어요.\n얼굴은 기억 안 나도, 이름표는 있어요."),
    say(KAEL, "집이 어딘데?"),
    emote(irisId, "ellipsis", 800),
    say(IRIS, "저 위요. 거기서 부르는 소리를 따라\n여기까지 왔어요."),
    say(IRIS, "대답하려면 하늘을 향한 큰 눈이 있어야 해요.\n제 것은 떨어지면서 깨졌어요."),
    say(ELENA, "큰 눈… 망원경 말이야?\n천문대에 있어. 선생님 렌즈라면 혹시."),
    narrate("이리스가 관 가장자리를 붙든 채\n둘을 번갈아 본다."),
    say(IRIS, "…그럼, 저도 데려가 주실래요?\n여기 혼자 남는 건 싫어요."),
    dock(),
    {
      kind: "choices", prompt: "이리스를 데려갈까?", cancelBehavior: "disallow",
      options: [
        { text: "같이 가자", branch: [
          say(KAEL, "같이 가자. 집에 닿을 때까지."),
          say(IRIS, "…고마워요.\n이 말은 처음 써 봐요."),
        ] },
        { text: "여기 숨어 있는 게 안전해", branch: [
          emote(irisId, "ellipsis", 800),
          say(ELENA, "카엘, 심문관이 이 숲을 뒤지는 중이야.\n여기 두면 숨기는 게 아니라 버리는 거야."),
          say(KAEL, "…맞아. 미안, 내가 겁먹었어.\n같이 가자, 이리스."),
          say(IRIS, "…네. 이번엔 무섭지 않게\n따라갈게요."),
        ] },
      ],
    } as unknown as Command,
    se("easyrpg-sound-chime2"),
    narrate("이리스가 관 밖으로 나와\n처음으로 땅을 밟는다."),
    wait(500),
    say(IRIS, "…땅이 따뜻해요. 카엘, 이게 「아침」이에요?"),
    say(ELENA, "…응. 이게 아침이야."),
    say(IRIS, "아, 이것도요. 관 안쪽에 박혀 있었어요.\n별 모양이에요."),
    keyGain,
    narrate("「별빛 열쇠」를 얻었다."),
    say(ELENA, "이 별 무늬… 서고 바닥 돌뚜껑에\n똑같은 홈이 있어!"),
    say(KAEL, "그럼 천문대로 가자.\n심문관이 여기 닿기 전에."),
    ...joined,
  ];
  list.splice(start.index, endAt + 1 - start.index, ...fresh);
  void project;
}

/** 하넬과 이리스의 첫 만남(H6) — 처음 한 번만 길게, 다음부터는 열쇠 안내 한 줄. */
function hanelMeetsIris(project: Project, obs: GameMap): void {
  ensureSwitch(project, SW_HANEL_MET_IRIS, "하넬이 이리스를 만났다");
  const hanelId = `ev_${FS_PREFIX}_hanel`;
  const at = findLine(obs, "별 무늬 열쇠는 서고 바닥의", hanelId);
  const list = at.list;
  // h6 세 줄(열쇠 · 스승 · 손이 떨렸다)을 한 갈래로 바꾼다.
  let end = at.index;
  while (end + 1 < list.length && list[end + 1]!.kind === "text") end += 1;
  list.splice(at.index, end + 1 - at.index, fork(sw(SW_HANEL_MET_IRIS, false), [
    say(H, "…그 아이가, 너희가 숲에서 찾은 별이냐."),
    say(IRIS, "이리스예요. 하늘에 대답할 렌즈를\n찾고 있어요."),
    say(H, "렌즈라면 이 아래에 있다.\n서고 바닥 돌뚜껑 밑, 옛 별지기의 방에."),
    say(H, "그 방은 내가 닫지 않았다.\n…닫은 것은 내 스승이다. 그것만 안다."),
    say(ELENA, "이리스가 준 열쇠가 그 홈에 맞아요."),
    say(H, "그렇다면 내려가거라. 서두르되, 조심해서."),
    setSw(SW_HANEL_MET_IRIS),
  ], [
    say(H, "서고 바닥 돌뚜껑이다.\n조심해 내려가거라."),
  ]));
}

/** 보고(H9) — 하넬이 묻기 전에 이리스가 먼저 말한다. 하넬이 「북쪽」을 어떻게 아는지 비었던 자리. */
function reportLines(obs: GameMap): void {
  const at = findLine(obs, "북쪽이라… 옛 별지기들이", `ev_${FS_PREFIX}_hanel`);
  at.list.splice(at.index, 0, say(IRIS, "선생님, 렌즈가 대답을 받았어요.\n북쪽이에요."));
}

/** 광장 할머니 — 해 질 녘(발렌 행렬이 떠난 뒤 다리에 등이 뜨는 때) 줄(F3 복선). */
function elderDusk(hub: GameMap): void {
  const elder = hub.events.find((e) => e.id === `ev_${FS_PREFIX}_elder`);
  const base = elder?.pages?.[0];
  if (!elder || !base) throw new Error("[fallen-star story] 광장 할머니가 없다");
  elder.pages = [
    ...(elder.pages ?? []).filter((p) => p.id !== `${elder.id}_dusk`),
    {
      ...JSON.parse(JSON.stringify(base)), id: `${elder.id}_dusk`, name: "광장의 할머니 · 해 질 녘",
      conditions: [sw(SW_VALEN_MARCHED)],
      commands: [
        say(ELDER, "발렌 님은 해 질 녘마다 다리에서\n등을 하나 띄우시지."),
        say(ELDER, "오늘은 숲으로 가셨으니 등도 없겠구먼.\n누굴 위한 건지는… 물어볼 사람도 없고."),
      ],
    } as EventPage,
  ];
}

// ── 6·7. 지하 결전 앞뒤의 발렌 ──────────────────────────────────────────

/** 결전 앞 줄 다듬기 + F5 두 줄, 결전 뒤 F6 두 줄과 연막 퇴장. */
function valenScenes(vault: GameMap): void {
  const bossId = `ev_${FS_PREFIX}_main_kill2`;
  const boss = vault.events.find((e) => e.id === bossId);
  if (!boss) throw new Error("[fallen-star story] 지하 결전 이벤트가 없다");
  rewordAll(vault, "역시 이 문을 연 건 너희였군.", "역시 너희였군. 이 문을 연 것은.", bossId);
  rewordAll(vault, "옛 별지기들이 하늘과 말을 나누던 방이다.", "옛 별지기들이 하늘과 말을 나누던 방이다.\n교단이 봉인한 죄의 방이지.", bossId);
  rewordAll(vault, "그 기계 인형을 넘겨라.", "그 기계 인형을 넘겨라.\n하늘에서 온 것은 교단이 거둔다.", bossId);
  rewordAll(vault, "저는 물건이 아니에요. 집에 돌아가고 싶을 뿐이에요.", "인형이 아니에요. 이리스예요.\n집에 대답만 하면 떠날게요.", bossId);
  rewordAll(vault, "들었지? 이리스는 우리 동료야.", "못 넘겨요.\n이리스는 저희가 데려온 동료예요.", bossId);
  const cue = findLine(vault, "그렇다면 여기서 부서져라.", bossId);
  cue.list.splice(cue.index, 1,
    say(VALEN, "이 방을 열면 누군가의 집이 탄다고\n내 스승은 말했다. 나는 그 집에 있었다."),
    say(VALEN, "그러니 이 문은 다시 닫는다.\n너희가 안에 있든 없든."),
    m2("m2-048-shake-screen", { intensity: "3", durationMs: 500, direction: "vertical" }),
    say(VALEN, "깨어나라, 별지기의 수호상!"),
  );

  // 결전 뒤 — 크윽 한 줄 대신 짧게 숨을 고르고, F6 두 줄 뒤에 연막으로 사라진다.
  rewordAll(vault, "크윽… 이 일은 교단이 잊지 않는다.", "…수호상까지 쓰러뜨릴 줄은 몰랐군.", bossId);
  rewordAll(vault, "하늘의 배가 다시 오면", "하늘의 배가 다시 오면 이 땅이 어찌 될지…\n너희는 아무것도 모른다.", bossId);
  const exit = findLine(vault, "발렌은 연기 속으로", bossId);
  const list = exit.list;
  // 앞 단계(stageBossVictory)가 넣은 연기 한 줄기와 퇴장 서술을 걷고, 그 뒤의 진행 스위치(정리된 자리 페이지)를 연막 한가운데로 옮긴다.
  let from = exit.index;
  while (from > 0 && (list[from - 1] as unknown as Rec).kind === "m2Command" && ((list[from - 1] as unknown as Rec).fields as Rec | undefined)?.preset === "smoke") from -= 1;
  let to = exit.index + 1;
  const progress: Command[] = [];
  while (to < list.length && (list[to]!.kind === "setSwitch" || list[to]!.kind === "setVariable")) progress.push(list[to++]!);
  if (!progress.length) throw new Error("[fallen-star story] 결전 진행 스위치가 퇴장 줄 뒤에 없다");
  const at = { x: boss.x, y: boss.y };
  const puff = (dx: number, dy: number, ms: number): Command =>
    m2("m2-224-particle-effect", { preset: "smoke", target: "tile", x: at.x + dx, y: at.y + dy, durationMs: ms, wait: false });
  const look = (fields: Record<string, unknown>): Command =>
    m2("m2-225-sprite-look", Object.fromEntries(Object.entries({ target: "this-event", ...fields }).map(([k, v]) => [k, typeof v === "boolean" ? v : String(v)])));
  const vanish: Command[] = [
    say(VALEN, "삼십 년 전에도 그랬다.\n모두가 자기만 옳다고 믿었지."),
    say(VALEN, "…네가 틀렸기를 바란다.\n정말로."),
    narrate("발렌이 장갑 낀 왼손을 바닥으로 내리친다."),
    // 연막이 먼저 차오르고(같은 칸에 여러 줄기를 겹쳐 짙게), 그 속에서 몸이 흐려지다 사라진다. 섬광은 아주 짧게 한 번.
    se("easyrpg-sound-fog1"),
    m2("m2-224-particle-effect", { preset: "dust", target: "tile", x: at.x, y: at.y, durationMs: 700, wait: false }),
    puff(0, 0, 3200), puff(0, 0, 3000), puff(0, 0, 2800), puff(-1, 0, 2600), puff(1, 0, 2600), puff(0, -1, 2400),
    m2("m2-224-particle-effect", { preset: "magic", target: "tile", x: at.x, y: at.y, durationMs: 1200, wait: false }),
    wait(550),
    m2("m2-047-flash-screen", { color: "white", value: "flash", durationMs: 120 }),
    look({ tint: "gray", opacity: 55 }),
    puff(-1, -1, 2200), puff(1, -1, 2200), puff(0, 0, 2400), puff(0, 1, 2000),
    wait(500),
    look({ opacity: 20 }),
    m2("m2-224-particle-effect", { preset: "dust", target: "tile", x: at.x, y: at.y, durationMs: 700, wait: false }),
    wait(450),
    ...progress,
    look({ reset: true }),
    wait(1500),
    narrate("연기가 걷혔을 때, 발렌은 그 자리에 없었다."),
  ];
  list.splice(from, to - from, ...vanish);
  rewordAll(vault, "위로 올라가자. 하넬 선생님께 알려야 해.", "올라가자. 선생님께 알려야 해.", bossId);
}

// ── 9. 지하의 교단 광신도 ───────────────────────────────────────────────

const FANATIC = "enemy_fs_fanatic";
const PREACHER = "enemy_fs_fanatic_preacher";
const act = (skillId: string, priority: number) =>
  ({ skillId, priority, condition: { kind: "always" }, switchOnAfterAction: { enabled: false }, switchOffAfterAction: { enabled: false } });

function upsertEnemy(project: Project, record: EnemyRecord): void {
  const enemies = project.database.enemies;
  const at = enemies.findIndex((e) => e.id === record.id);
  if (at >= 0) enemies[at] = record; else enemies.push(record);
}
function upsertTroop(project: Project, id: string, name: string, enemyIds: string[]): void {
  const troop = {
    id, name, enemyIds: [...enemyIds],
    members: enemyIds.map((enemyId, i) => ({ enemyId, x: 80 + i * 64, y: 96, hidden: false })),
    autoAlign: true, uncapturable: true, battleEventPages: [],
  } as unknown as TroopRecord;
  const troops = project.database.troops;
  const at = troops.findIndex((t) => t.id === id);
  if (at >= 0) troops[at] = troop; else troops.push(troop);
}

/**
 * 지하 곁방 셋의 적을 교단 광신도로 바꾼다. 지하는 별지기의 방이라 숲늑대·덤불거미·도깨비불이 돌아다닐 까닭이 없었다 —
 * 발렌보다 먼저 내려와 길목을 지키던 심문회 하수인이다. 마주치면 한 줄 외치고 싸운다.
 */
function cultists(project: Project, vault: GameMap): void {
  const template = project.database.enemies.find((e) => e.id === "enemy_fs_wolf");
  if (!template) throw new Error("[fallen-star story] 적 견본(enemy_fs_wolf)이 없다");
  const neutral = Object.fromEntries(Object.keys(template.elementRates ?? {}).map((k) => [k, "C"]));
  const base = (id: string, name: string, monsterResourceId: string, level: number, stats: EnemyRecord["stats"], exp: number, gold: number, actions: ReturnType<typeof act>[], drops: { itemId: string; ratePercent: number }[]): EnemyRecord => ({
    ...(JSON.parse(JSON.stringify(template)) as EnemyRecord),
    id, name, level, monsterResourceId, stats,
    actions: actions as EnemyRecord["actions"],
    elementRates: { ...neutral, dark: "B" } as EnemyRecord["elementRates"],
    rewards: { ...template.rewards, exp, gold, drops: drops.map((d) => ({ ...d, quantity: 1, condition: { kind: "always" } })) } as EnemyRecord["rewards"],
    battleScalePercent: 220,
  } as EnemyRecord);
  upsertEnemy(project, base(FANATIC, "교단 광신도", "charset-battler-actor3-2", 6,
    { maxHp: 170, maxMp: 0, attack: 60, defense: 20, mind: 34, agility: 40 }, 46, 16,
    [act("skill_attack", 6), act("skill_sword_slash", 5)],
    [{ itemId: "item_potion", ratePercent: 20 }, { itemId: "item_antidote", ratePercent: 12 }]));
  upsertEnemy(project, base(PREACHER, "광신도 설교자", "charset-battler-people2-2", 7,
    { maxHp: 150, maxMp: 60, attack: 46, defense: 18, mind: 66, agility: 30 }, 52, 22,
    [act("skill_attack", 4), act("skill_holy", 6), act("skill_weaken", 5)],
    [{ itemId: "item_potion", ratePercent: 25 }, { itemId: "item_wake_herb", ratePercent: 12 }]));
  const known = new Set((project.database.items ?? []).map((i) => i.id));
  for (const id of [FANATIC, PREACHER]) {
    const enemy = project.database.enemies.find((e) => e.id === id)!;
    enemy.rewards = { ...enemy.rewards, drops: (enemy.rewards.drops ?? []).filter((d) => known.has(d.itemId)) } as EnemyRecord["rewards"];
  }
  upsertTroop(project, "troop_fs_fanatics", "교단 광신도", [FANATIC, FANATIC]);
  upsertTroop(project, "troop_fs_fanatic_sermon", "광신도와 설교자", [FANATIC, PREACHER]);
  upsertTroop(project, "troop_fs_fanatic_cell", "광신도 무리", [FANATIC, PREACHER, FANATIC]);

  // 필드에 선 모습 — 전투 시트와 같은 걷기 칩. 마주치면 외치는 한 줄이 셋 다 다르다.
  const plan: Record<string, { troop: string; chip: [string, number]; shout: [string, string] }> = {
    [`ev_${FS_PREFIX}_vault_foe1`]: { troop: "troop_fs_fanatics", chip: ["tex_easyrpg_charset_actor3", 2], shout: ["교단 광신도", "여기까지 내려오다니!\n심문관님 앞에 무릎 꿇려 주마!"] },
    [`ev_${FS_PREFIX}_vault_foe2`]: { troop: "troop_fs_fanatic_sermon", chip: ["tex_easyrpg_charset_people2", 2], shout: ["광신도 설교자", "하늘에서 온 것을 감싸는 자여,\n등불 아래에서 참회하라."] },
    [`ev_${FS_PREFIX}_vault_foe3`]: { troop: "troop_fs_fanatic_cell", chip: ["tex_easyrpg_charset_actor3", 2], shout: ["교단 광신도", "책 냄새 나는 별지기 쥐들이군.\n정화하라!"] },
  };
  let changed = 0;
  for (const event of vault.events) {
    const spec = plan[event.id];
    if (!spec) continue;
    for (const page of event.pages ?? []) {
      if (page.graphic?.sprite) {
        const direction = page.graphic.direction ?? "down";
        page.graphic = { ...page.graphic, sprite: { type: "bundled", id: spec.chip[0] }, direction, pattern: charsetFrameIndex({ characterIndex: spec.chip[1], direction, pattern: 1 }) };
      }
      eachList(page.commands as Command[], (list) => {
        for (let i = 0; i < list.length; i += 1) {
          const rec = list[i] as unknown as Rec;
          if (rec.kind !== "battleProcessing") continue;
          rec.troopId = spec.troop;
          if (!bodyOf(list[i - 1]).includes(spec.shout[1].slice(0, 6))) { list.splice(i, 0, say(spec.shout[0], spec.shout[1])); i += 1; }
          changed += 1;
        }
      });
    }
  }
  if (changed < 3) throw new Error(`[fallen-star story] 지하 적 셋 중 ${changed}곳만 광신도로 바꿨다`);
}

// ── 10. 빠졌던 꾸지람 넷 ────────────────────────────────────────────────

/** 걷는 길·출입구를 막지 않는 빈 칸(anchor 가까운 순). 놓은 뒤 출입구끼리 길이 끊기면 되돌린다. */
export function placeCrate(project: Project, hub: GameMap, anchor: { x: number; y: number }, tile: number, avoid: { x: number; y: number }[]): { x: number; y: number } | null {
  const meta = (project.tilesets[hub.tilesetId] as unknown as { tileMeta?: ({ label?: string } | null)[] }).tileMeta ?? [];
  const W = hub.width, H = hub.height;
  const isGate = (e: GameEvent) => JSON.stringify(e.pages ?? e.commands ?? []).includes('"kind":"transfer"');
  const gates = hub.events.filter(isGate);
  const reach = (): Set<string> => {
    const s = project.startPos ?? { x: 0, y: 0 };
    const seen = new Set<string>([`${s.x},${s.y}`]);
    const q = [{ x: s.x, y: s.y }];
    while (q.length) {
      const c = q.shift()!;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nx = c.x + dx, ny = c.y + dy, k = `${nx},${ny}`;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H || seen.has(k)) continue;
        const gate = gates.some((g) => g.x === nx && g.y === ny);
        if (!gate && !isPassable(project, hub, nx, ny)) continue;
        seen.add(k);
        if (!gate) q.push({ x: nx, y: ny });
      }
    }
    return seen;
  };
  const before = reach();
  const gatesReached = gates.filter((g) => before.has(`${g.x},${g.y}`));
  const openSides = (x: number, y: number): number => [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => isPassable(project, hub, x + dx!, y + dy!)).length;
  // 마주 보는 두 쪽만 트인 칸은 한 줄 통로다 — 모서리(직각으로 트인 칸)만 쓴다.
  const corridor = (x: number, y: number): boolean =>
    (isPassable(project, hub, x - 1, y) && isPassable(project, hub, x + 1, y) && !isPassable(project, hub, x, y - 1) && !isPassable(project, hub, x, y + 1))
    || (isPassable(project, hub, x, y - 1) && isPassable(project, hub, x, y + 1) && !isPassable(project, hub, x - 1, y) && !isPassable(project, hub, x + 1, y));
  for (let r = 1; r <= 6; r += 1) {
    for (let dy = -r; dy <= r; dy += 1) for (let dx = -r; dx <= r; dx += 1) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
      const x = anchor.x + dx, y = anchor.y + dy;
      if (x < 1 || y < 1 || x >= W - 1 || y >= H - 1 || !isPassable(project, hub, x, y)) continue;
      const i = y * W + x;
      if ((hub.upperTiles[i] ?? -1) >= 0 || (hub.upperOverlayTiles?.[i] ?? -1) >= 0) continue;
      // 길 위는 벽 모서리·벽감(옆이 둘 이하로 트인 칸)일 때만 — 지나다니는 길 한복판은 막지 않는다(끊김은 아래 BFS 가 따로 본다).
      if (/다리|물|바다|water/i.test(meta[hub.lowerTiles[i] ?? -1]?.label ?? "")) continue;
      if (/길|포석|광장|road|plaza/i.test(meta[hub.lowerTiles[i] ?? -1]?.label ?? "") && (openSides(x, y) > 2 || corridor(x, y))) continue;
      if (hub.events.some((e) => Math.abs(e.x - x) + Math.abs(e.y - y) <= 1)) continue;
      if (avoid.some((a) => Math.abs(a.x - x) + Math.abs(a.y - y) <= 2)) continue;
      const old = hub.upperTiles[i]!;
      hub.upperTiles[i] = tile;
      const after = reach();
      const sideOpen = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([ddx, ddy]) => after.has(`${x + ddx!},${y + ddy!}`));
      if (sideOpen && gatesReached.every((g) => after.has(`${g.x},${g.y}`)) && [...before].filter((k) => k !== `${x},${y}`).every((k) => after.has(k))) return { x, y };
      hub.upperTiles[i] = old;
    }
  }
  return null;
}

type Look = { tile?: number; name: string };
function boxEvent(id: string, look: Look, x: number, y: number, pages: EventPage[]): GameEvent {
  return { id, name: look.name, x, y, trigger: { kind: "action" }, commands: [], pages } as unknown as GameEvent;
}
function page(id: string, name: string, conditions: Condition[], commands: Command[]): EventPage {
  return {
    id, name, conditions, graphic: { transparent: true }, movement: { type: "fixed", speed: 3, frequency: 3 },
    priority: "same", trigger: { kind: "action" }, commands,
  } as unknown as EventPage;
}
const seesFork = (eventId: string, range: number, then: Command[], otherwise: Command[], loose = false): Command => fork(
  { kind: "eventSeesPlayer", eventId, range, ...(loose ? { sameRoom: false, requireFacing: false } : {}) } as unknown as Condition, then, otherwise);
/** 들키면 같은 줄을 두 번까지만 — 그 뒤로는 조용히 넘어간다(18절 원칙). */
const scoldOnce = (counter: string, lines: Command[], amount: number): Command =>
  fork({ kind: "variable", variableId: counter, op: "<", value: 2 } as unknown as Condition,
    [...lines, ...fine(amount), { kind: "setVariable", variableId: counter, op: "+=", value: 1 } as Command]);

function extraScolds(project: Project, ids: { hub: string; observatory: string }): Record<string, { x: number; y: number } | null> {
  const out: Record<string, { x: number; y: number } | null> = {};
  const hub = project.maps[ids.hub]!;
  const obs = project.maps[ids.observatory]!;

  // 천문대 서랍(하넬) — 목록 서랍장. 보증 대상이 빈 정착 확인서(L10 과 짝). 벌금 없음.
  {
    ensureVariable(project, "var_fs_scold_hanel", "하넬에게 들킨 횟수(서랍)");
    const meta = (project.tilesets[obs.tilesetId] as unknown as { tileMeta?: ({ label?: string } | null)[] }).tileMeta ?? [];
    let spot: { x: number; y: number } | null = null;
    for (let i = 0; i < obs.lowerTiles.length && !spot; i += 1) {
      const labels = [obs.lowerTiles, obs.lowerOverlayTiles, obs.upperTiles, obs.upperOverlayTiles].map((l) => meta[(l as ArrayLike<number> | undefined)?.[i] ?? -1]?.label ?? "");
      if (!labels.some((l) => /서랍/.test(l))) continue;
      const x = i % obs.width, y = Math.floor(i / obs.width);
      if (obs.events.some((e) => e.x === x && e.y === y)) continue;
      if (![[0, 1], [1, 0], [-1, 0], [0, -1]].some(([dx, dy]) => isPassable(project, obs, x + dx!, y + dy!))) continue;
      spot = { x, y };
    }
    out.observatoryDrawer = spot;
    if (spot) {
      const id = `ev_${FS_PREFIX}_drawer_hanel`;
      const content = [
        narrate("(서랍) 접힌 정착 확인서가 한 장 들어 있다."),
        narrate("기록자 란에는 하넬의 이름.\n보증받을 사람의 이름 칸은 비어 있다."),
      ];
      obs.events = obs.events.filter((e) => e.id !== id);
      obs.events.push(boxEvent(id, { name: "수납 · 목록 서랍장" }, spot.x, spot.y, [page(`${id}_p0`, "서랍", [], [
        ...content,
        seesFork(`ev_${FS_PREFIX}_hanel`, 30, [emote(`ev_${FS_PREFIX}_hanel`, "ellipsis", 900), scoldOnce("var_fs_scold_hanel", [say(H, "…그 서랍은 열지 않는 게 좋다.")], 0)], [], true),
      ])]));
    }
  }

  // 기사 초소(리노) — 동문 곁 초소의 보급 상자. 발렌이 왕도를 떠난 뒤(이리스 합류)에는 꾸지람 한 줄이 바뀐다. 벌금 10G.
  {
    ensureVariable(project, "var_fs_scold_rino", "리노에게 들킨 횟수(초소 상자)");
    const rino = hub.events.find((e) => e.id === `ev_${FS_PREFIX}_rino`);
    const gate = hub.events.filter((e) => JSON.stringify(e.pages ?? []).includes('"mapId":"fs_forest"'));
    const spot = rino ? placeCrate(project, hub, rino, 26606, gate) : null;
    out.knightPost = spot;
    if (spot && rino) {
      const id = `ev_${FS_PREFIX}_cache_knight_post`;
      const take: Command[] = [
        narrate("심문회 보급 상자에서 「회복약」 2개를 찾았다."),
        { kind: "changeItem", itemId: "item_potion", op: "+=", amount: 2 } as Command,
        { kind: "setSelfSwitch", key: "A", value: true } as Command,
      ];
      const scold = scoldOnce("var_fs_scold_rino", [
        fork(sw(SW_IRIS_JOINED), [say(RINO, "물러서라! …심문관님 안 계실 때 이러면\n혼나는 건 나야.")], [say(RINO, "물러서라!")]),
      ], 10);
      hub.events.push(boxEvent(id, { name: "수납 · 초소 보급 상자" }, spot.x, spot.y, [
        page(`${id}_p0`, "뒤지기", [], [fork(sw(SW_KNIGHT_MARCHED), [seesFork(rino.id, 8, [emote(rino.id, "exclamation", 900), ...take, scold], take, true)], take)]),
        page(`${id}_p1`, "이미 뒤짐", [{ kind: "selfSwitch", key: "A", value: true } as unknown as Condition], [narrate("초소 보급 상자는 이미 뒤져 봤다.")]),
      ]));
    }
  }

  // 심문회 상자(리노) — 행렬이 숲으로 떠난 뒤 동문 초소에 남은 압수품 상자. 행렬 전에는 기사들 눈이 많아 손댈 수 없다.
  // 지키는 사람은 초소에 남은 리노 하나 — 그가 이쪽을 보고 있으면 들킨다(등 뒤로 돌아가면 조용히 챙길 수 있다). 벌금 15G.
  // (발렌은 행렬과 함께 숲으로 갔다 — 예전에는 강가 등불 곁에 남아 상자를 지켰는데, 숲으로 간 사람이 마을에 또 있었다.)
  {
    ensureVariable(project, "var_fs_scold_inquisition", "리노에게 들킨 횟수(심문회 상자)");
    const rino = hub.events.find((e) => e.id === `ev_${FS_PREFIX}_rino`);
    const gate = hub.events.filter((e) => JSON.stringify(e.pages ?? []).includes('"mapId":"fs_forest"'));
    const post = out.knightPost;
    const spot = rino ? placeCrate(project, hub, rino, 27120, [...gate, ...(post ? [post] : [])]) : null;
    out.inquisitionBox = spot;
    if (spot && rino) {
      const id = `ev_${FS_PREFIX}_cache_inquisition`;
      const take: Command[] = [
        narrate("(압수 목록) 서른 해 전 날짜 아래에 「새벽샘 — 하나」.\n오늘 날짜 아래는 아직 비어 있다."),
        narrate("목록 밑에서 「상급 회복약」을 찾았다."),
        { kind: "changeItem", itemId: "item_hi_potion", op: "+=", amount: 1 } as Command,
        { kind: "setSelfSwitch", key: "A", value: true } as Command,
      ];
      hub.events.push(boxEvent(id, { name: "수납 · 심문회 상자" }, spot.x, spot.y, [
        page(`${id}_p0`, "봉인", [], [narrate("붉은 봉인이 찍힌 심문회 상자다.\n기사들 눈이 많아 손댈 수가 없다.")]),
        page(`${id}_p1`, "뒤지기", [sw(SW_VALEN_MARCHED)], [seesFork(rino.id, 7, [
          emote(rino.id, "exclamation", 900),
          ...take,
          scoldOnce("var_fs_scold_inquisition", [say(RINO, "그건 심문관님 압수품이다!\n…못 본 걸로 할 테니, 어서 가.")], 15),
        ], take)]),
        page(`${id}_p2`, "이미 뒤짐", [{ kind: "selfSwitch", key: "A", value: true } as unknown as Condition], [narrate("심문회 상자는 이미 열어 봤다.\n압수 목록의 빈 줄이 마음에 걸린다.")]),
      ]));
    }
  }

  // 모루 서랍(로한) — 딸 새라의 편지. 창 의뢰를 하는 동안만 로한이 한마디 한다. 벌금 없음.
  {
    ensureVariable(project, "var_fs_scold_rohan_anvil", "로한에게 들킨 횟수(모루 서랍)");
    const smithy = project.maps.fs_smithy;
    const meta = smithy ? (project.tilesets[smithy.tilesetId] as unknown as { tileMeta?: ({ label?: string } | null)[] }).tileMeta ?? [] : [];
    let spot: { x: number; y: number } | null = null;
    if (smithy) for (let i = 0; i < smithy.lowerTiles.length && !spot; i += 1) {
      const labels = [smithy.lowerTiles, smithy.lowerOverlayTiles, smithy.upperTiles, smithy.upperOverlayTiles].map((l) => meta[(l as ArrayLike<number> | undefined)?.[i] ?? -1]?.label ?? "");
      if (!labels.some((l) => /모루/.test(l))) continue;
      const x = i % smithy.width, y = Math.floor(i / smithy.width);
      if (smithy.events.some((e) => e.x === x && e.y === y)) continue;
      if (![[0, 1], [1, 0], [-1, 0], [0, -1]].some(([dx, dy]) => isPassable(project, smithy, x + dx!, y + dy!))) continue;
      spot = { x, y };
    }
    out.anvilDrawer = spot;
    if (smithy && spot) {
      const id = `ev_${FS_PREFIX}_drawer_anvil`;
      smithy.events.push(boxEvent(id, { name: "수납 · 모루 서랍" }, spot.x, spot.y, [page(`${id}_p0`, "서랍", [], [
        narrate("(서랍) 손때 묻은 편지 한 통이 접혀 있다."),
        narrate("「아버지, 이제 쇠 말고 사람을 고쳐 주세요.\n— 새라」"),
        fork(all(sw("sw_fs_q_spear_on"), sw("sw_fs_q_spear_done", false)), [
          seesFork("ev_fs_smith", 6, [emote("ev_fs_smith", "ellipsis", 900), scoldOnce("var_fs_scold_rohan_anvil", [say(ROHAN, "…읽은 게냐. 읽어도 된다.")], 0)], [], true),
        ]),
      ])]));
    }
  }
  return out;
}

export type FallenStoryPassResult = { scoldSpots: Record<string, { x: number; y: number } | null> };

export function applyFallenStoryPass(project: Project, ids: { hub: string; observatory: string; forest: string; vault: string }): FallenStoryPassResult {
  const M = (id: string): GameMap => {
    const map = project.maps[id];
    if (!map) throw new Error(`[fallen-star story] 맵이 없다: ${id}`);
    return map;
  };
  // 발렌은 포고 뒤 행렬과 함께 동문으로 나가 숲으로 간다(다음 등장은 지하). 강가 등불 곁에 다시 서 있던 장면은 걷어 낸다.
  M(ids.hub).events = M(ids.hub).events.filter((e) => e.id !== `ev_${FS_PREFIX}_valen_bridge`);
  plazaLines(M(ids.hub));
  hanelAsk(M(ids.observatory));
  bramLines(M(ids.forest));
  irisJoins(project, M(ids.forest));
  hanelMeetsIris(project, M(ids.observatory));
  reportLines(M(ids.observatory));
  elderDusk(M(ids.hub));
  valenScenes(M(ids.vault));
  cultists(project, M(ids.vault));
  const scoldSpots = extraScolds(project, ids);
  return { scoldSpots };
}
