// 조수 v2 장면 손질 검사(서사) — 이번 실행이 새로 쓰거나 바꾼 장면(컷신·대화)의 글과 연출을 기계로 짚는다.
//
// 왜(2026-10-31 씬 벤치 ebfecbbb99, terra 3판씩): 마왕 등장 컷신이 appear → say 한 줄 → vanish 셋뿐(연출 3.0·대사 3.7, opus 5.3·6.3),
// 오프닝은 자막 두 장과 촌장 한 줄, 엔딩은 epilogue 안 대사만. 싼 모델은 «한 줄이면 장면»으로 끝낸다 — 판정자는 「대사만 나열하면 연출 3 이하」.
// 비싼 모델(opus)은 같은 동사로 음악·흔들림·감정 표시·다가오기·세 줄 대사를 썼다. 차이는 도구가 아니라 «장면의 모양»을 아느냐다.
// 그래서 함수가 장면을 대신 쓰지 않는다(대사·연출은 모델이 정한다). 함수는 플레이어가 바로 알아채는 결함만 짚고, 왜 문제인지와 고치는 호출을
// 영어로 돌려준다(하위 모델은 영어 피드백을 따른다 — 2026-10-30 사용자). 짚는 것:
//   repeat   같은 대사가 두 번(J106 — 플레이어는 반복을 바로 알아채고 읽기를 멈춘다)
//   name     본문 머리에 「이름:」 — 이름표와 겹쳐 두 번 보인다(opus ending r1 「촌장: …」)
//   thin     장면을 시킨 요청인데 새 컷신 대사가 셋 미만(설정·전환·결과가 없다)
//   static   대사 셋 이상인데 아무도 움직이지·반응하지 않고 소리·효과도 없다
//   oneVoice 대화 장면을 시켰는데 한 사람만 말하고 상대 반응(감정 표시·대답·선택지)이 없다
//   offPost  원래 맵에 서 있던 사람을 컷신이 걸려 옮기고 제자리로 돌려놓지 않는다(J92 — 나중에 말을 걸려는 플레이어가 못 찾는다)
// 순수 함수(before·after·요청 글).
import type { Project } from "@/project/types";
import { splitScriptSpeaker } from "@/project/endingSummary";
import { isRereadMarker } from "../story/rereadPage";
import { SCENE_WORDS, TALK_WORDS } from "../request/asks";
import { tagged, type Finding } from "./finding";

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj | undefined => (v && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : undefined);

interface Line { readonly speaker: string; readonly body: string; readonly pageIndex: number; readonly path: string }
interface ScenePage {
  readonly mapId: string; readonly mapName: string; readonly eventId: string; readonly eventName: string; readonly pageIndex: number;
  readonly trigger: string; readonly cmds: Obj[]; readonly lines: Line[]; readonly cutscene: boolean;
}

/** 명령 나무를 펼친다(fork then/else, 선택지 가지, parallel). 명령마다 갈래 경로(«2.o1» = 2번 명령의 선택지 1번 갈래)를 단다 —
 * 서로 다른 갈래의 같은 대사(예: 두 갈래의 «돈이 모자라는군»)는 한 번 플레이에 둘 다 보이지 않으니 반복이 아니다. */
const PATHS = new WeakMap<object, string>();
function flatten(commands: unknown, out: Obj[] = [], path = ""): Obj[] {
  if (!Array.isArray(commands)) return out;
  commands.forEach((raw, i) => {
    const c = obj(raw);
    if (!c) return;
    PATHS.set(c, path);
    out.push(c);
    for (const [k, v] of Object.entries(c)) {
      if (k === "condition" || !Array.isArray(v)) continue;
      if (v.some((x) => obj(x)?.kind)) flatten(v, out, `${path}/${i}.${k}`);
      else v.forEach((x, j) => { const o = obj(x); if (o) { flatten(o.branch, out, `${path}/${i}.${k}${j}`); flatten(o.commands, out, `${path}/${i}.${k}${j}`); } });
    }
  });
  return out;
}
const pathOf = (c: Obj): string => PATHS.get(c) ?? "";
/** 두 갈래 경로가 한 번 플레이에 함께 지나갈 수 있나(한쪽이 다른 쪽의 앞부분). */
const samePlay = (a: string, b: string): boolean => a.startsWith(b) || b.startsWith(a);

const norm = (s: string): string => s.replace(/[\s.,!?…~·'"“”‘’「」『』()\-—:：]/gu, "").toLowerCase();

function linesOf(cmds: readonly Obj[], pageIndex: number): Line[] {
  return cmds.filter((c) => c.kind === "text" && typeof c.body === "string" && c.body.trim()).map((c) => ({ speaker: String(c.speaker ?? "").trim(), body: String(c.body).trim(), pageIndex, path: pathOf(c) }));
}

/** 컷신 페이지인가 — 장면 동사가 지은 이벤트(id) 또는 컷신 제어·레터박스가 든 페이지. 트리거만으로는 보지 않는다:
 * 밟으면 뜨는 막힌 길 안내(ev_world_gate_*)는 장면이 아니다 — 그걸 «얇은 장면»으로 짚었더니 terra 가 안내 글에 힌트 넷을 덧붙였다(2026-10-31 sc-narr-a1, 여덟 판 모두). */
function isCutscenePage(_page: Obj, cmds: readonly Obj[], eventId: string): boolean {
  if (/^ev_world_gate|^ev_chain_|_gate_/u.test(eventId)) return false;
  if (/^ev_(v2cut|cutscene|ending_)/u.test(eventId) && !/_a_\d+$/u.test(eventId)) return true; // _a_N = 장면이 세운 사람의 뒤 대화
  return cmds.some((c) => c.kind === "cutsceneControl" || (c.kind === "m2Command" && /screen-effect/u.test(String(c.commandId)) && obj(c.fields)?.effect === "letterbox"));
}

/** 장면을 살리는 연출 명령(레터박스·페이드·기다림은 함수가 자동으로 넣으니 세지 않는다). */
function stagingKinds(cmds: readonly Obj[]): string[] {
  const out = new Set<string>();
  for (const c of cmds) {
    const k = String(c.kind);
    if (k === "moveEvent") {
      const moves = ((obj(c.route)?.moves as Obj[] | undefined) ?? []).map((m) => String(m.kind));
      if (moves.some((m) => m !== "turnToward" && m !== "faceToward" && m !== "wait")) out.add("walk");
      else if (moves.length) out.add("face");
    } else if (k === "approach" || k === "enterVia" || k === "exitVia") out.add("walk");
    else if (k === "showEmote") out.add("emote");
    else if (k === "playAudio" || k === "stopAudio" || k === "fadeOutBgm" || k === "playBgm" || k === "playSe") out.add("sound");
    else if (k === "setWeather" || k === "tint" || k === "tintScreen" || k === "showAnimation" || k === "showPicture" || k === "cameraPan" || k === "cameraMove" || k === "changeTile") out.add("effect");
    else if (k === "m2Command") {
      const id = String(c.commandId);
      const f = obj(c.fields);
      if (/screen-effect/u.test(id) && f?.effect === "letterbox") continue;
      if (/sprite-look/u.test(id) && String(f?.opacity ?? "") === "0") continue; // 장면 전 숨김
      out.add("effect");
    }
  }
  return [...out];
}

function scenePages(before: Project, after: Project): ScenePage[] {
  const out: ScenePage[] = [];
  for (const map of Object.values(after.maps ?? {})) {
    const old = new Map((before.maps[map.id]?.events ?? []).map((e) => [e.id, JSON.stringify(e.pages ?? [])] as const));
    for (const ev of map.events ?? []) {
      const pages = (ev.pages ?? []) as unknown as Obj[];
      if (old.get(ev.id) === JSON.stringify(pages)) continue;
      const oldPages = (before.maps[map.id]?.events?.find((e) => e.id === ev.id)?.pages ?? []) as unknown as Obj[];
      pages.forEach((page, pageIndex) => {
        // 바뀐 페이지만(같은 이벤트의 손대지 않은 페이지는 그 사람의 옛 대사다).
        if (oldPages[pageIndex] && JSON.stringify(oldPages[pageIndex]) === JSON.stringify(page)) return;
        const cmds = flatten(page.commands);
        const lines = linesOf(cmds, pageIndex);
        if (!lines.length) return;
        out.push({ mapId: map.id, mapName: map.name || map.id, eventId: ev.id, eventName: ev.name || ev.id, pageIndex, trigger: String(obj(page.trigger)?.kind ?? ""), cmds, lines, cutscene: isCutscenePage(page, cmds, ev.id) });
      });
    }
  }
  return out;
}

const q = (s: string, n = 40): string => `«${s.length > n ? `${s.slice(0, n)}…` : s}»`;
const where = (p: ScenePage): string => `${p.eventName !== p.eventId ? `«${p.eventName}» ` : ""}${p.eventId} (map «${p.mapName}» ${p.mapId}, page ${p.pageIndex})`;

/** 원래 맵에 서 있던, 말을 거는 사람(그림이 있고 말 걸기 페이지에 대사가 있던 이벤트) id — 필드 적·장식은 뺀다. */
function standingPeople(before: Project, mapId: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const e of before.maps[mapId]?.events ?? []) {
    const pages = (e.pages ?? []) as unknown as Obj[];
    const drawn = pages.some((pg) => { const g = obj(pg.graphic); return !!(g && (g.sprite || g.appearanceId || g.characterName)); });
    const talks = pages.some((pg) => obj(pg.trigger)?.kind === "action" && flatten(pg.commands).some((c) => c.kind === "text"));
    if (drawn && talks && !/foe\d*$|_enemy|chaser/iu.test(e.id)) out.set(e.id, e.name || e.id);
  }
  return out;
}

const STEP: Readonly<Record<string, readonly [number, number]>> = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
/** 제자리에서 이만큼 안에 서 있으면 «자리를 떠난» 것이 아니다 — 찾으러 온 플레이어 눈에 바로 보인다. */
const NEAR_POST = 3;
/**
 * 장면이 그 사람을 걸린 뒤 제자리에서 몇 칸 떨어져 있는지의 어림. 가늠하지 못하는 걸음(무작위·길 찾기 대상 모름)이 섞이면 undefined — 떠난 것으로 본다.
 * 주인공 자리는 장면이 도는 곳에서 읽는다: 자동 장면은 시작 칸(시작 맵일 때), 말 걸기·밟기 장면은 그 장면의 이벤트 칸.
 */
function strayAfterScene(project: Project, p: ScenePage, id: string): number | undefined {
  const map = project.maps[p.mapId];
  const post = map?.events.find((e) => e.id === id);
  if (!map || !post) return undefined;
  const host = map.events.find((e) => e.id === p.eventId);
  const hero = p.trigger === "auto" || p.trigger === "parallel"
    ? (project.startMapId === p.mapId && project.startPos ? project.startPos : undefined)
    : host ? { x: host.x, y: host.y } : undefined;
  let at = { x: post.x, y: post.y };
  for (const c of p.cmds) {
    if (String(c.eventId ?? "") !== id) continue;
    const moves = c.kind === "approach" ? [c] : c.kind === "moveEvent" ? ((obj(c.route)?.moves as Obj[] | undefined) ?? []) : [];
    for (const m of moves) {
      const kind = String(m.kind);
      if (kind === "move") { const d = STEP[String(m.dir)]; if (!d) return undefined; at = { x: at.x + d[0], y: at.y + d[1] }; continue; }
      if (kind === "approach") {
        const target = String(m.target ?? "");
        const other = map.events.find((e) => e.id === target);
        const cell = target === "@player" || target === "player" ? hero : other ? { x: other.x, y: other.y }
          : Number.isFinite(m.x) && Number.isFinite(m.y) ? { x: Number(m.x), y: Number(m.y) } : undefined;
        if (!cell) return undefined;
        at = { x: cell.x, y: cell.y };
        continue;
      }
      if (/^turn|^face|^wait$/u.test(kind)) continue;
      return undefined;
    }
  }
  return Math.abs(at.x - post.x) + Math.abs(at.y - post.y);
}

/** 함수가 지은 표지 이벤트 — 같은 관문·같은 종류의 문은 칸마다 같은 글이다(gateKeyedEntrances·gateEntrySteps·잠긴 집 문·막힌 길). */
const BUILT_SIGN_EVENT = /^ev_(?:world_)?gate_|^ev_locked_door_|^ev_dead_end_/u;
/** 함수가 여러 자리에 같은 글로 적는 안내 줄 — 남은 단서 목록(«· 아직 …»)과 그 단계 이벤트의 자리(«「X」은 … 에 있다.»). */
const BUILT_HINT_LINE = /^·\s|^「[^」]{1,40}」[은는이가]\s.{1,60}에 있다[.。]?$/u;

export function sceneCraftFindings(before: Project, after: Project, task: string): Finding[] {
  const pages = scenePages(before, after);
  if (!pages.length) return [];
  const out: Finding[] = [];
  const sceneAsked = SCENE_WORDS.test(task);
  const talkAsked = TALK_WORDS.test(task);

  // 이번 실행 전에도 있던 대사는 세지 않는다 — 장면을 이은 NPC 의 «장면 뒤» 쪽은 원래 대사를 그대로 옮겨 담는다.
  const oldLines = new Set<string>();
  for (const m of Object.values(before.maps ?? {})) for (const e of m.events ?? []) for (const pg of (e.pages ?? []) as unknown as Obj[]) for (const l of linesOf(flatten(pg.commands), 0)) oldLines.add(norm(l.body));
  // repeat: 바뀐 장면 글 전체에서 같은 대사(짧은 감탄 빼고) — 같은 사람이 다시 말을 걸 때 같은 말을 되풀이하는 것도 포함.
  const seen = new Map<string, { p: ScenePage; line: Line }>();
  const repeated = new Set<string>();
  for (const p of pages) for (const line of p.lines) {
    // 함수가 일부러 같은 글로 지은 것은 반복으로 세지 않는다 — 모델에게 «고쳐라» 로 돌려보내면 함수가 다시 같은 글로 짓는다:
    // 다시 읽기 쪽(rereadPage.ts), 길목·잠긴 문·막힌 길 표지(같은 관문의 여러 칸), 남은 단서 목록 줄(«· 아직 …»), 길 안내 줄(«「X」은 … 에 있다.»).
    if (isRereadMarker(p.lines[0]?.body) || BUILT_SIGN_EVENT.test(p.eventId) || BUILT_HINT_LINE.test(line.body.trim())) continue;
    const k = norm(line.body);
    if (k.length < 8 || oldLines.has(k)) continue;
    const first = seen.get(k);
    if (!first) { seen.set(k, { p, line }); continue; }
    if (first.p === p && !samePlay(first.line.path, line.path)) continue;
    if (repeated.has(k)) continue;
    repeated.add(k);
    const sameEvent = first.p.eventId === p.eventId;
    out.push(tagged("scene", "repeat", `The line ${q(line.body)} is written twice — ${where(first.p)} and ${sameEvent ? `page ${p.pageIndex} of the same event` : where(p)}. Players notice a repeated line at once and stop reading the rest. Rewrite the second one so it says what changed since the first (or cut it). Fix: patch_event_page{mapId:'${p.mapId}', eventId:'${p.eventId}', pageIndex:${p.pageIndex}, set:{commands:[…the page with that text command rewritten…]}}.`));
  }

  // name: 「이름: 대사」 — 이름표(speaker)와 겹쳐 두 번 보이거나, 이름표 없이 대본 꼴로 보인다.
  for (const p of pages) {
    const hit = p.lines.find((l) => { if (oldLines.has(norm(l.body))) return false; const s = splitScriptSpeaker(l.body); return !!s.speaker && s.speaker.length <= 12 && !/^\d/u.test(s.speaker); });
    if (!hit) continue;
    const s = splitScriptSpeaker(hit.body);
    out.push(tagged("scene", "name", `${where(p)} writes the speaker inside the line: ${q(hit.body)}. The dialogue box already shows the name plate, so the player reads ${hit.speaker ? `«${hit.speaker}» and then «${s.speaker}:» again` : `a script prefix instead of a speaking person`}. Put the name in the speaker field and keep only the words in the body (add_event beat {do:'say', who:'${s.speaker}', text:'${s.text.slice(0, 30).replace(/'/gu, "’")}…'} or the text command {kind:'text', speaker:'${s.speaker}', body:…}).`));
  }

  for (const p of pages.filter((x) => x.cutscene)) {
    const staging = stagingKinds(p.cmds);
    const speakers = [...new Set(p.lines.map((l) => l.speaker).filter(Boolean))];
    // thin: 장면을 시킨 요청에서 새로 쓴 컷신 대사가 셋 미만.
    if (sceneAsked && p.lines.length < 3) {
      out.push(tagged("scene", "thin", `${where(p)} is a cutscene with ${p.lines.length} line${p.lines.length === 1 ? "" : "s"} (${p.lines.map((l) => q(l.body, 24)).join(" ")}). One line is an announcement, not a scene: the player needs the situation (who and why here), the turn (what is revealed, threatened or asked) and the consequence (what changes for the hero). Write 4–8 lines across those three parts, in each speaker's own voice, with a reaction from the hero (an emote beat or a short line). Fix: add_event{event:{kind:'cutscene', mapId:'${p.mapId}', redo:'${p.eventId}', beats:[…]}} (redo rewrites this scene in place).`));
    }
    // static: 대사 셋 이상인데 움직임·반응·소리·효과가 하나도 없다.
    if (p.lines.length >= 3 && staging.length === 0) {
      out.push(tagged("scene", "static", `${where(p)} reads ${p.lines.length} lines over a frozen screen — nobody walks, turns, reacts, and no music or effect changes. On a map the bodies tell the feeling the words cannot: step closer to threaten or plead, turn away to hide something, walk off to end it; an emote marks the moment a line lands; music or an effect marks the turn. Add at least one movement and one reaction or sound at the turn of this scene. Fix: add_event{event:{kind:'cutscene', mapId:'${p.mapId}', redo:'${p.eventId}', beats:[…same lines plus walk/face/emote/music beats…]}}.`));
    }
    // oneVoice: 대화를 시킨 요청인데 한 사람만 말하고 상대 반응이 없다.
    const others = staging.includes("emote") || p.cmds.some((c) => c.kind === "choices" || c.kind === "showChoices" || c.kind === "presentItem");
    if (talkAsked && p.lines.length >= 3 && speakers.length <= 1 && !others && !p.lines.some((l) => !l.speaker)) {
      out.push(tagged("scene", "one-voice", `Only ${speakers[0] ? `«${speakers[0]}»` : "one person"} speaks in ${where(p)} (${p.lines.length} lines) and nobody answers or reacts. A conversation where one side talks reads like a notice board. Give the other side a turn: the hero reacts (emote beat {do:'emote', who:'주인공', emote:'!'} or a short line with who:'주인공'), or let the player answer with a choice.`));
    }
  }

  // offPost: 원래 서 있던 사람을 컷신이 걸려 옮기고 끝에 돌려놓지 않는다.
  for (const p of pages.filter((x) => x.cutscene)) {
    const people = standingPeople(before, p.mapId);
    const walked = new Map<string, number>();
    p.cmds.forEach((c, i) => {
      const id = String(c.eventId ?? "");
      if (!people.has(id) || id === p.eventId) return; // 자기 대화 안에서 한두 걸음 다가오는 것은 자리 이탈이 아니다
      if (c.kind === "approach") walked.set(id, i);
      if (c.kind === "moveEvent") {
        const moves = ((obj(c.route)?.moves as Obj[] | undefined) ?? []).map((m) => String(m.kind));
        if (moves.some((m) => m !== "turnToward" && m !== "faceToward" && m !== "wait")) walked.set(id, i);
      }
      if (c.kind === "setEventLocation" || c.kind === "setEventPosition") walked.delete(id);
    });
    const vanished = new Set(p.cmds.filter((c) => c.kind === "eraseEvent" || (c.kind === "m2Command" && /sprite-look/u.test(String(c.commandId)) && String(obj(c.fields)?.opacity ?? "") === "0")).map((c) => String(c.eventId ?? obj(c.fields)?.eventId ?? "")));
    for (const [id] of walked) {
      if (vanished.has(id)) continue;
      // 곁에 서 있던 사람이 한두 걸음 다가선 것은 자리를 떠난 것이 아니다 — 돌려보내라고 하면 «걸어왔다가 돌아가는» 장면이 되거나
      // 모델이 그 사람의 자리를 옮긴다(2026-11-11 작은 일 둘째 묶음 walk-up-greet-starter: 요청 밖 편집으로 불합격).
      const stray = strayAfterScene(after, p, id);
      if (stray !== undefined && stray <= NEAR_POST) continue;
      out.push(tagged("scene", "off-post", `The cutscene ${where(p)} walks «${people.get(id)}» (${id}), who already stood on this map, and leaves them wherever the walk ended. After the scene the player goes back to talk to them at their usual spot and cannot find them. End the scene with a walk back ({do:'walk', who:'${people.get(id)}', to:<their spot word>}), or if they should stay where the scene leaves them, move their post there with move_event.`));
    }
  }
  return out;
}

/** 게임 검사 글(관문 항목) — 같은 종류는 최대 셋. */
export function sceneCraftProblems(before: Project, after: Project, task: string): Finding[] {
  const all = sceneCraftFindings(before, after, task);
  const byId = new Map<string, number>();
  return all.filter((f) => { const n = (byId.get(f.id) ?? 0) + 1; byId.set(f.id, n); return n <= 3; });
}
