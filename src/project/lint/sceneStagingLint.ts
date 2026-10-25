// project/lint/sceneStagingLint.ts
// 인물 연출 검사 — 대사 한 줄마다 «누가 누구에게» 말하는지 맵 위 인물로 풀고, 장면을 명령 순서대로 되짚어
// 그 순간 두 사람이 무대에 있는지·가까운지·서로 보는지를 본다. 전부 warning(커밋을 막지 않는다).
//
// 왜(2026-10-22 『첫사랑』 영상): 「처음 뵙겠습니다」 선택지가 인사받는 사람이 화면 밖에 선 채로 떴고, 금요일 막차 승강장의
// 두 사람은 서로 다른 데를 보며 몇 칸 떨어져 말했다. 걸음을 손으로 늘어놓고(walk) 방향을 손으로 고른(face) 장면은
// 한 걸음이 막혀도 아무도 몰랐다. 이 검사는 런타임과 같은 규칙(project/staging/*)으로 장면을 되짚는다.
//
//  - scene-speaker-absent   대사의 화자(또는 선택지를 받는 NPC)가 이 맵 인물인데 그 순간 무대에 없다(페이지가 꺼짐·지워짐·투명)
//  - scene-talk-far         화자와 듣는 인물이 TALK_DISTANCE_LIMIT(2) 칸보다 멀다(체비쇼프)
//  - scene-talk-facing      대사 자동 돌아보기를 적용한 뒤에도 둘이 서로를 보지 않는다
//  - scene-bust-unstaged     무대 흉상 대사인데 듣는 사람이 안 풀린다(장면 첫마디를 주인공이 연다) — 곁에 사람이 있으면 addressee 로 못박는다
//  - scene-turn-overridden  말하기 직전에 손으로 돌려 세운 화자를 자동 돌아보기가 다른 상대(최근 화자) 쪽으로 되돌린다 — addressee 누락
//
// 되짚기 규칙: 페이지 조건으로 다른 이벤트의 켜진 페이지를 고른다(스위치·변수·셀프 스위치만, 나머지 조건은 «모름» → 그 인물 검사 생략).
// 걸음은 지형에 막히면 버린다(런타임과 같다), 인물에 막히면 비켜 간다고 본다. 다가가기는 런타임과 같은 planApproach.
// 주인공 칸: 페이지가 다른 맵에서 이 맵으로 오는 이동의 도착 칸이 하나뿐이면 그 칸(방향 포함), 아니면 모름.
// 갈래(선택지·조건 분기)는 각 갈래를 따로 되짚고, 뒤는 갈래 앞 상태로 잇는다.
import type { Command, Condition, Dir, EventPage, GameEvent, GameMap, MoveCommand, Project } from "../types";
import { canMove, isPassable } from "../collision";
import { AUTO_FACE_RANGE, CALLING_FACE_RANGE, chebyshev, DIR_DELTA, dirToward, facesToward, planApproach, TALK_DISTANCE_LIMIT, type StageCell } from "../staging/approach";
import { isNonActorSpeaker, matchesAnyActor, PLAYER_ACTOR, pushRecentSpeaker, resolveAddressee, resolveSpeakerActor, type StageActorCandidate } from "../staging/dialogueActors";
import type { LintIssue } from "./projectLint";

type Tri = true | false | null; // null = 모름

type ActorState = { x: number; y: number; dir: Dir; erased: boolean; hiddenByRoute: boolean };

type Replay = {
  /** 이 페이지 밖에서 켜는 일이 있는 스위치. 여기 없는 스위치는 모르면 꺼짐으로 본다(게임 시작 값). */
  setElsewhere: ReadonlySet<string>;
  vars: Map<string, number>;
  switches: Map<string, boolean>;
  self: Map<string, boolean>; // `${eventId}:${key}`
  actors: Map<string, ActorState>;
  player: { x: number; y: number; dir: Dir } | null;
  playerHidden: boolean;
  recent: string[]; // 최근 NPC 화자(맨 앞이 방금)
  lastSpoken: string | null; // 마지막으로 «소리 내어» 말한 인물(속마음·자막은 건너뜀). 선택지의 상대.
  /** 다음 대사 직전에 손으로 돌려 둔 방향(turn·turnToward 만 있는 이동). 대사의 자동 돌아보기가 이걸 덮으면 경고한다. */
  turned?: Map<string, Dir>;
};

const PLAYER_REFS = new Set(["@player", "player"]);

function pagesOf(event: GameEvent): readonly EventPage[] {
  return event.pages ?? [];
}

function shownGraphic(page: EventPage | undefined): boolean {
  const g = page?.graphic;
  if (!g || g.transparent) return false;
  return Boolean(g.sprite || g.appearanceId);
}

function evalCondition(c: Condition, st: Replay, eventId: string): Tri {
  switch (c.kind) {
    case "switch": {
      const v = st.switches.get(c.switchId) ?? (st.setElsewhere.has(c.switchId) ? undefined : false);
      return v === undefined ? null : v === c.value;
    }
    case "variable": {
      const v = st.vars.get(c.variableId);
      if (v === undefined || typeof c.value !== "number") return null;
      switch (c.op) {
        case "==": return v === c.value;
        case "!=": return v !== c.value;
        case ">=": return v >= c.value;
        case "<=": return v <= c.value;
        case ">": return v > c.value;
        case "<": return v < c.value;
        default: return null;
      }
    }
    case "selfSwitch": {
      const v = st.self.get(`${eventId}:${c.key}`) ?? false;
      return v === c.value;
    }
    default:
      return null;
  }
}

/** 켜진 페이지: 조건이 모두 참인 마지막 페이지. 그 뒤 페이지 중 «모름»이 있으면 모름. */
function activePage(event: GameEvent, st: Replay): EventPage | null | undefined {
  const pages = pagesOf(event);
  for (let i = pages.length - 1; i >= 0; i -= 1) {
    const results = (pages[i]!.conditions ?? []).map((c) => evalCondition(c as Condition, st, event.id));
    if (results.every((r) => r === true)) return pages[i]!;
    if (results.some((r) => r === null) && !results.some((r) => r === false)) return undefined; // 모름
  }
  return null; // 켜진 페이지 없음 — 무대에 없다
}

/** 그 순간 무대에 보이는가(모름 = null). */
function visibleNow(event: GameEvent, st: Replay): Tri {
  const a = st.actors.get(event.id);
  if (a?.erased || a?.hiddenByRoute) return false;
  const page = activePage(event, st);
  if (page === undefined) return null;
  return page !== null && shownGraphic(page);
}

function seedFromConditions(conditions: readonly EventPageConditionLike[], st: Replay, hostId: string): void {
  for (const c of conditions) {
    if (c.kind === "switch" && typeof c.switchId === "string") st.switches.set(c.switchId, c.value !== false);
    else if (c.kind === "variable" && typeof c.variableId === "string" && typeof c.value === "number") {
      const v = c.op === ">" ? c.value + 1 : c.op === "<" ? c.value - 1 : c.value;
      if (c.op !== "!=") st.vars.set(c.variableId, v);
    } else if (c.kind === "selfSwitch" && typeof c.key === "string") st.self.set(`${hostId}:${c.key}`, c.value !== false);
  }
}
type EventPageConditionLike = { kind: string; switchId?: string; variableId?: string; key?: string; value?: unknown; op?: string };

/** 다른 맵에서 이 맵으로 오는 이동의 도착 칸들(모든 이벤트·공용 이벤트). */
function arrivalsInto(project: Project, mapId: string): { x: number; y: number; dir: Dir }[] {
  const out: { x: number; y: number; dir: Dir }[] = [];
  const visit = (commands: readonly Command[] | undefined, fromMapId: string | null): void => {
    for (const command of commands ?? []) {
      if (!command || typeof command !== "object") continue;
      if (command.kind === "transfer" && command.mapId === mapId && fromMapId !== mapId) {
        const d = command.direction;
        out.push({ x: command.x, y: command.y, dir: d === "up" || d === "down" || d === "left" || d === "right" ? d : "down" });
      }
      for (const branch of nestedLists(command)) visit(branch, fromMapId);
    }
  };
  for (const map of Object.values(project.maps)) for (const e of map.events ?? []) for (const p of pagesOf(e)) visit(p.commands, map.id);
  for (const ce of project.commonEvents ?? []) visit(ce.commands, null);
  return out;
}

function nestedLists(command: Command): readonly (readonly Command[])[] {
  switch (command.kind) {
    case "choices": return [...command.options.map((o) => o.branch), ...(command.cancelBranch ? [command.cancelBranch] : [])];
    case "fork": return [command.then, ...(command.else ? [command.else] : [])];
    case "loop": return [command.body];
    default: return [];
  }
}

function cloneReplay(st: Replay): Replay {
  return {
    setElsewhere: st.setElsewhere,
    vars: new Map(st.vars), switches: new Map(st.switches), self: new Map(st.self),
    actors: new Map([...st.actors].map(([k, v]) => [k, { ...v }])),
    player: st.player ? { ...st.player } : null,
    playerHidden: st.playerHidden,
    recent: [...st.recent],
    turned: new Map(st.turned ?? []),
    lastSpoken: st.lastSpoken,
  };
}

function m2Title(command: Command): string {
  if (command.kind !== "m2Command") return "";
  const id = command.commandId;
  if (id === "m2-086-erase-event") return "Erase Event";
  if (id === "m2-040-set-event-location") return "Set Event Location";
  return typeof (command as { title?: unknown }).title === "string" ? String((command as { title?: unknown }).title) : "";
}

function field(command: Command, key: string): string {
  if (command.kind !== "m2Command") return "";
  const v = (command.fields as Record<string, unknown> | undefined)?.[key];
  return typeof v === "string" ? v.trim() : typeof v === "number" ? String(v) : "";
}

type Ctx = {
  project: Project;
  map: GameMap;
  host: GameEvent;
  page: EventPage;
  byId: Map<string, GameEvent>;
  playerNames: string[];
  issues: LintIssue[];
  reported: Set<string>;
};

function candidates(ctx: Ctx, st: Replay, mode: "visible" | "maybe" | "all"): StageActorCandidate[] {
  const out: StageActorCandidate[] = [];
  for (const e of ctx.map.events ?? []) {
    const vis = visibleNow(e, st);
    if (mode === "visible" && vis !== true) continue;
    if (mode === "maybe" && vis === false) continue;
    if (mode === "all" && !pagesOf(e).some(shownGraphic)) continue;
    const a = actorOf(ctx, st, e.id)!;
    const profile = e.characterId ? ctx.project.characters?.[e.characterId] : undefined;
    out.push({ id: e.id, names: [e.name ?? "", profile?.displayName ?? ""].filter(Boolean), x: a.x, y: a.y });
  }
  return out;
}

function actorOf(ctx: Ctx, st: Replay, id: string): ActorState | null {
  let a = st.actors.get(id);
  if (!a) {
    const e = ctx.byId.get(id);
    if (!e) return null;
    const page = activePage(e, st) ?? pagesOf(e)[0];
    a = { x: e.x, y: e.y, dir: (page?.graphic?.direction as Dir | undefined) ?? "down", erased: false, hiddenByRoute: false };
    st.actors.set(id, a);
  }
  return a;
}

function cellOf(ctx: Ctx, st: Replay, id: string): { x: number; y: number; dir: Dir } | null {
  if (id === PLAYER_ACTOR) return st.player;
  return actorOf(ctx, st, id);
}

function occupied(ctx: Ctx, st: Replay, except: string): (c: StageCell) => boolean {
  return (c) => {
    if (except !== PLAYER_ACTOR && st.player && st.player.x === c.x && st.player.y === c.y) return true;
    for (const e of ctx.map.events ?? []) {
      if (e.id === except) continue;
      const a = st.actors.get(e.id) ?? { x: e.x, y: e.y };
      if (a.x !== c.x || a.y !== c.y) continue;
      const page = activePage(e, st);
      if (page && page.priority === "same" && visibleNow(e, st) !== false) return true;
    }
    return false;
  };
}

function resolveRef(ctx: Ctx, ref: string | undefined): string | null {
  const r = (ref ?? "").trim();
  if (PLAYER_REFS.has(r)) return PLAYER_ACTOR;
  if (r === "" || r === "@this" || r === "this-event") return ctx.host.id;
  return r;
}

function simulateRoute(ctx: Ctx, st: Replay, who: string, moves: readonly MoveCommand[]): void {
  const me = cellOf(ctx, st, who);
  if (!me) return;
  for (const m of moves) {
    if (!m || typeof m !== "object") continue;
    switch (m.kind) {
      case "move": {
        const n = { x: me.x + DIR_DELTA[m.dir].x, y: me.y + DIR_DELTA[m.dir].y };
        me.dir = m.dir;
        if (canMove(ctx.project, ctx.map, me.x, me.y, n.x, n.y)) { me.x = n.x; me.y = n.y; }
        break;
      }
      case "moveDiagonal": {
        const n = { x: me.x + (m.horizontal === "left" ? -1 : 1), y: me.y + (m.vertical === "up" ? -1 : 1) };
        if (isPassable(ctx.project, ctx.map, n.x, n.y)) { me.x = n.x; me.y = n.y; }
        me.dir = m.horizontal;
        break;
      }
      case "jump": me.x += m.dx || 0; me.y += m.dy || 0; break;
      case "turn": me.dir = m.dir; break;
      case "turnTowardPlayer": if (st.player) me.dir = dirToward(me, st.player) ?? me.dir; break;
      case "turnToward": {
        const t = m.target ? cellOf(ctx, st, resolveRef(ctx, m.target) ?? "") : Number.isFinite(m.x) && Number.isFinite(m.y) ? { x: m.x!, y: m.y! } : null;
        if (t) me.dir = dirToward(me, t) ?? me.dir;
        break;
      }
      case "approach": {
        const t = m.target ? cellOf(ctx, st, resolveRef(ctx, m.target) ?? "") : Number.isFinite(m.x) && Number.isFinite(m.y) ? { x: m.x!, y: m.y! } : null;
        if (!t) break;
        const busy = occupied(ctx, st, who);
        const plan = planApproach({
          width: ctx.map.width, height: ctx.map.height,
          canStep: (a, b) => canMove(ctx.project, ctx.map, a.x, a.y, b.x, b.y),
          canStand: (c) => isPassable(ctx.project, ctx.map, c.x, c.y) && !busy(c),
        }, me, t, m.distance);
        if (plan) { me.x = plan.goal.x; me.y = plan.goal.y; if (plan.face) me.dir = plan.face; }
        else me.dir = dirToward(me, t) ?? me.dir;
        break;
      }
      case "changeOpacity":
        if (m.delta <= -200 && who !== PLAYER_ACTOR) (me as ActorState).hiddenByRoute = true;
        else if (m.delta >= 200 && who !== PLAYER_ACTOR) (me as ActorState).hiddenByRoute = false;
        break;
      case "npcTransfer": if (who !== PLAYER_ACTOR) (me as ActorState).hiddenByRoute = true; break;
      case "exitVia":
      case "enterVia": {
        // 런타임 playSceneDoorway 와 같은 문 칸: target 이벤트 → x,y → 가장 가까운 이동 이벤트.
        if (who === PLAYER_ACTOR) break;
        const gates = (ctx.map.events ?? []).filter((e) => e.id !== who && JSON.stringify(e.pages ?? []).includes('"kind":"transfer"'));
        const byTarget = m.target ? ctx.byId.get(m.target.trim()) : undefined;
        const door = byTarget ? { x: byTarget.x, y: byTarget.y }
          : Number.isFinite(m.x) && Number.isFinite(m.y) ? { x: m.x!, y: m.y! }
          : gates.length ? gates.reduce((a, b) => (chebyshev(b, me) < chebyshev(a, me) ? b : a)) : null;
        if (m.kind === "exitVia") {
          if (door) { me.x = door.x; me.y = door.y; }
          (me as ActorState).hiddenByRoute = true;
        } else if (door) {
          const dir = m.dir ?? (["down", "left", "right", "up"] as const).find((d) => isPassable(ctx.project, ctx.map, door.x + DIR_DELTA[d].x, door.y + DIR_DELTA[d].y)) ?? "down";
          me.x = door.x + DIR_DELTA[dir].x; me.y = door.y + DIR_DELTA[dir].y; me.dir = dir;
          (me as ActorState).hiddenByRoute = false;
        }
        break;
      }
      default: break;
    }
  }
}

function report(ctx: Ctx, code: string, key: string, at: StageCell | null, message: string): void {
  const k = `${ctx.host.id}|${ctx.page.id}|${code}|${key}`;
  if (ctx.reported.has(k)) return;
  ctx.reported.add(k);
  ctx.issues.push({ severity: "warning", code, mapId: ctx.map.id, eventId: ctx.host.id, ...(at ? { x: at.x, y: at.y } : {}), message });
}

function nameOf(ctx: Ctx, id: string): string {
  if (id === PLAYER_ACTOR) return "주인공";
  const e = ctx.byId.get(id);
  return e?.name ? `${e.name}(${id})` : id;
}

/** 검사 통계(데모 전수 검사 스크립트가 읽는다): 본 대사 줄 · 화자를 찾은 줄 · 거리/방향까지 잰 줄. */
export const stagingLintStats = { lines: 0, resolved: 0, measured: 0 };

function checkLine(ctx: Ctx, st: Replay, line: Extract<Command, { kind: "text" }>, where: string): void {
  stagingLintStats.lines += 1;
  const speakerName = line.speaker?.trim() ?? "";
  if (!speakerName && !line.speakerActor) return; // 속마음·자막·내레이션
  st.lastSpoken = null;
  const visible = candidates(ctx, st, "visible");
  const maybe = candidates(ctx, st, "maybe");
  const speakerId = resolveSpeakerActor({
    speaker: speakerName, speakerActor: line.speakerActor, currentEventId: ctx.host.id,
    playerNames: ctx.playerNames, visible: maybe, player: st.player,
  });
  if (!speakerId) {
    if (isNonActorSpeaker(speakerName)) return;
    const onMap = matchesAnyActor(speakerName, candidates(ctx, st, "all"));
    if (onMap.length > 0 && !onMap.some((c) => maybe.some((v) => v.id === c.id))) {
      report(ctx, "scene-speaker-absent", `speaker:${speakerName}`, { x: ctx.host.x, y: ctx.host.y },
        `${where}: 「${speakerName}」 의 대사인데 이 순간 맵에 그 인물(${onMap.map((c) => c.id).join("·")})이 보이지 않는다 — 말하기 전에 등장시키거나(페이지 조건·표시) 그 인물을 approach 로 데려온다.`);
    }
    return;
  }
  stagingLintStats.resolved += 1;
  const maybeIds = new Set(maybe.map((v) => v.id));
  const addresseeId = resolveAddressee({ addressee: line.addressee, speakerActorId: speakerId, recentNpcSpeakers: st.recent, currentEventId: ctx.host.id, visibleIds: maybeIds, playerPresent: !st.playerHidden });
  if (speakerId !== PLAYER_ACTOR) st.recent = pushRecentSpeaker(st.recent, speakerId);
  st.lastSpoken = speakerId;
  // 무대 흉상(bustSide stage)인데 듣는 사람이 풀리지 않는다 — 장면 첫마디를 주인공이 열면(앞서 말한 NPC 가 없어) 흉상이 저작한 쪽에 뜨고,
  // 상대가 한마디 하는 순간 무대 쪽으로 바뀌어 같은 사람이 대화 도중 좌우를 오간다(첫사랑 수요일 보고, VQA r23 중대).
  if ((line as { bustSide?: string }).bustSide === "stage" && (!addresseeId || addresseeId === speakerId)) {
    const me = cellOf(ctx, st, speakerId);
    const near = me ? visible.filter((v) => v.id !== speakerId).map((v) => ({ v, c: cellOf(ctx, st, v.id) })).filter((x) => x.c && chebyshev(me, x.c) <= TALK_DISTANCE_LIMIT) : [];
    if (near.length > 0) {
      report(ctx, "scene-bust-unstaged", `unstaged:${speakerId}:${where}`, me,
        `${where}: ${nameOf(ctx, speakerId)} 의 대사가 듣는 사람 없이 풀린다(곁에 ${near.map((x) => nameOf(ctx, x.v.id)).join("·")}) — 흉상이 저작한 쪽에 떴다가 상대가 말하면 반대쪽으로 바뀐다. 첫마디에 addressee(sayTo)로 상대를 못박는다.`);
    }
  }
  if (line.addressee && addresseeId && addresseeId !== PLAYER_ACTOR) {
    const target = ctx.byId.get(addresseeId);
    if (target && visibleNow(target, st) === false) {
      report(ctx, "scene-speaker-absent", `to:${addresseeId}`, { x: target.x, y: target.y },
        `${where}: 듣는 인물 ${nameOf(ctx, addresseeId)} 이 이 순간 맵에 보이지 않는다.`);
      return;
    }
  }
  if (!addresseeId || addresseeId === speakerId) return;
  // 둘 중 하나라도 보임이 «모름»이면 거리·방향 검사는 건너뛴다.
  for (const id of [speakerId, addresseeId]) if (id !== PLAYER_ACTOR && !visible.some((v) => v.id === id)) return;
  const a = cellOf(ctx, st, speakerId), b = cellOf(ctx, st, addresseeId);
  if (!a || !b) return;
  const dist = chebyshev(a, b);
  stagingLintStats.measured += 1;
  // 자동 돌아보기(런타임과 같은 규칙): 말하는 쪽이 듣는 쪽을 본다.
  if (line.autoFace !== false && dist <= (line.calling ? CALLING_FACE_RANGE : AUTO_FACE_RANGE)) {
    const auto = dirToward(a, b) ?? a.dir;
    const meant = st.turned?.get(speakerId);
    // 말하기 직전에 일부러 돌려 세운 쪽을 자동 돌아보기가 다른 상대 쪽으로 되돌린다 — 듣는 상대를 못박지 않은 것이다
    // (첫사랑 편의점: 점원과 말한 뒤 지후 쪽으로 돌려 세웠는데 「선임님, 하나 드세요」가 최근 화자인 점원에게 가서 위로 돌아섰다, VQA r22).
    if (meant && meant !== auto && !line.addressee) {
      report(ctx, "scene-turn-overridden", `${speakerId}>${addresseeId}`, a,
        `${where}: ${nameOf(ctx, speakerId)} 를 ${meant} 로 돌려 세웠는데 이 대사의 듣는 사람이 ${nameOf(ctx, addresseeId)} 로 풀려 ${auto} 로 다시 돈다 — 돌려 세운 상대에게 하는 말이면 addressee(sayTo)로 못박는다.`);
    }
    a.dir = auto;
    // 듣는 쪽이 주인공이면 주인공도 돌아본다(런타임 playSceneDialogueFacing 과 같다).
    if (addresseeId === PLAYER_ACTOR && !line.calling) b.dir = dirToward(b, a) ?? b.dir;
  }
  const pair = [speakerId, addresseeId].sort().join("~");
  // 외침·흘림 대사(멀리서 부르기)는 거리를 보지 않는다.
  const calling = line.calling === true || line.context === "shout" || line.container === "bark";
  if (dist > TALK_DISTANCE_LIMIT && !calling && !acrossFurniture(ctx, a, b, dist)) {
    report(ctx, "scene-talk-far", pair, b,
      `${where}: ${nameOf(ctx, speakerId)} 가 ${dist}칸 떨어진 ${nameOf(ctx, addresseeId)} 에게 말한다 — 말하기 전에 approach{actor,target}(곁으로 걸어가 바라봄)로 붙인다. 걸음을 손으로 늘어놓지 말 것.`);
    return;
  }
  if (calling) return; // 부르는 한마디 — 듣는 쪽은 아직 딴 데를 봐도 된다(부름을 듣고 돈다).
  const aSees = facesToward(a, a.dir, b), bSees = facesToward(b, b.dir, a);
  if (!aSees || !bSees) {
    const away = !bSees ? addresseeId : speakerId;
    report(ctx, "scene-talk-facing", pair, b,
      `${where}: ${nameOf(ctx, speakerId)} 와 ${nameOf(ctx, addresseeId)} 가 서로 보지 않는 채로 말한다(${nameOf(ctx, away)} 가 ${(away === speakerId ? a : b).dir} 을 본다) — faceEachOther{a,b} 또는 turnToward 를 넣는다. 손으로 고른 방향(face)은 도착 못 한 인물에게도 그대로 적용된다.`);
  }
}

/**
 * 탁자 건너편 — 한 칸 더 먼(TALK_DISTANCE_LIMIT + 1) 두 사람 사이 곧은 줄에 막힌 가구 칸(탁자·의자)이 있으면 마주 앉은 대화로 본다.
 * 회의 탁자(폭 2)를 사이에 둔 맞은편은 3칸, 탁자 머리에서 반대쪽 끝은 4칸이다(첫사랑 금요일 회의: 발표자는 북쪽에 서고 듣는 셋은 남쪽 의자에 앉는다).
 * 사이가 빈 바닥이면 그냥 먼 것이다(곁으로 걸어가 말해야 한다).
 */
function acrossFurniture(ctx: Ctx, a: StageCell, b: StageCell, dist: number): boolean {
  // 탁자 길이 방향(머리 ↔ 맞은편 끝)은 네 칸까지 — 탁자 머리의 손님과 반대쪽 끝 발표자(첫사랑 금요일, VQA r23).
  if (dist <= TALK_DISTANCE_LIMIT || dist > TALK_DISTANCE_LIMIT + 2) return false;
  let x = a.x, y = a.y;
  while (x !== b.x || y !== b.y) {
    x += Math.sign(b.x - x); y += Math.sign(b.y - y);
    if (x === b.x && y === b.y) break;
    if (!isPassable(ctx.project, ctx.map, x, y)) return true;
  }
  return false;
}

function checkChoice(ctx: Ctx, st: Replay, where: string): void {
  if (st.playerHidden) return;
  const npc = st.lastSpoken;
  if (!npc || npc === PLAYER_ACTOR) return;
  const e = ctx.byId.get(npc);
  if (!e) return;
  const vis = visibleNow(e, st);
  if (vis === false) {
    report(ctx, "scene-speaker-absent", `choice:${npc}`, { x: e.x, y: e.y },
      `${where}: 선택지가 ${nameOf(ctx, npc)} 에게 하는 대답인데 그 인물이 이 순간 맵에 보이지 않는다.`);
    return;
  }
  if (vis !== true || !st.player) return;
  const a = actorOf(ctx, st, npc)!;
  const dist = chebyshev(a, st.player);
  if (dist > TALK_DISTANCE_LIMIT && !acrossFurniture(ctx, a, st.player, dist)) {
    report(ctx, "scene-talk-far", `choice:${npc}`, a,
      `${where}: 선택지가 ${dist}칸 떨어진 ${nameOf(ctx, npc)} 에게 하는 대답이다 — 선택지 앞에서 approach 로 마주 세운다.`);
  }
}

function replay(ctx: Ctx, st: Replay, commands: readonly Command[] | undefined, path: string): boolean {
  for (const [i, command] of (commands ?? []).entries()) {
    if (!command || typeof command !== "object") continue;
    const where = `이벤트 ${ctx.host.id} ${path}[${i}]`;
    switch (command.kind) {
      case "transfer":
        if (command.mapId !== ctx.map.id) return false; // 다른 맵으로 넘어가면 이 무대는 끝
        st.player = { x: command.x, y: command.y, dir: command.direction === "up" || command.direction === "down" || command.direction === "left" || command.direction === "right" ? command.direction : st.player?.dir ?? "down" };
        break;
      case "text":
        checkLine(ctx, st, command, where);
        st.turned?.clear();
        break;
      case "choices":
        checkChoice(ctx, st, where);
        for (const [k, o] of command.options.entries()) replay(ctx, cloneReplay(st), o.branch, `${path}[${i}].options[${k}]`);
        break;
      case "fork":
        replay(ctx, cloneReplay(st), command.then, `${path}[${i}].then`);
        if (command.else) replay(ctx, cloneReplay(st), command.else, `${path}[${i}].else`);
        break;
      case "setSwitch":
        if (typeof command.value === "boolean") st.switches.set(command.switchId, command.value);
        else st.switches.delete(command.switchId);
        break;
      case "setSelfSwitch":
        st.self.set(`${ctx.host.id}:${command.key}`, command.value);
        break;
      case "setVariable": {
        const c = command as unknown as { variableId: string; op: string; value: unknown };
        const cur = st.vars.get(c.variableId);
        if (typeof c.value !== "number") { st.vars.delete(c.variableId); break; }
        if (c.op === "=") st.vars.set(c.variableId, c.value);
        else if (cur !== undefined && c.op === "+=") st.vars.set(c.variableId, cur + c.value);
        else if (cur !== undefined && c.op === "-=") st.vars.set(c.variableId, cur - c.value);
        else st.vars.delete(c.variableId);
        break;
      }
      case "moveEvent": {
        const who = resolveRef(ctx, command.eventId);
        if (who) {
          simulateRoute(ctx, st, who, command.route?.moves ?? []);
          const moves = command.route?.moves ?? [];
          const me = cellOf(ctx, st, who);
          if (me && moves.length > 0 && moves.every((m) => m && (m.kind === "turn" || m.kind === "turnToward"))) (st.turned ??= new Map()).set(who, me.dir);
          else st.turned?.delete(who);
        }
        break;
      }
      case "m2Command": {
        const title = m2Title(command);
        if (command.kind === "m2Command" && /sprite-look/u.test(command.commandId) && field(command, "target") === "player") {
          if (field(command, "opacity") === "0") st.playerHidden = true;
          else if ((command.fields as Record<string, unknown> | undefined)?.reset === true) st.playerHidden = false;
        }
        if (title === "Erase Event") { const a = actorOf(ctx, st, field(command, "eventId") || ctx.host.id); if (a) a.erased = true; }
        else if (title === "Set Event Location" && (!field(command, "mapId") || field(command, "mapId") === ctx.map.id)) {
          const id = field(command, "target") || ctx.host.id;
          const a = actorOf(ctx, st, id);
          const x = Number(field(command, "x")), y = Number(field(command, "y"));
          if (a && Number.isFinite(x) && Number.isFinite(y)) { a.x = x; a.y = y; }
        }
        break;
      }
      default:
        break;
    }
  }
  return true;
}

function hasDialogue(commands: readonly Command[] | undefined): boolean {
  for (const c of commands ?? []) {
    if (!c || typeof c !== "object") continue;
    if (c.kind === "text" || c.kind === "choices") return true;
    if (nestedLists(c).some(hasDialogue)) return true;
  }
  return false;
}

function playerNamesOf(project: Project): string[] {
  const leader = project.database?.actors?.[0];
  return leader?.name ? [leader.name] : [];
}

/** 스위치 id → 그 스위치를 켜는 페이지들(`맵|이벤트|페이지`, 공용 이벤트는 `ce|id`). */
function switchSetters(project: Project): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  const visit = (commands: readonly Command[] | undefined, key: string): void => {
    for (const c of commands ?? []) {
      if (!c || typeof c !== "object") continue;
      if (c.kind === "setSwitch" && c.value !== false) {
        if (!out.has(c.switchId)) out.set(c.switchId, new Set());
        out.get(c.switchId)!.add(key);
      }
      for (const branch of nestedLists(c)) visit(branch, key);
      if (c.kind === "moveEvent") for (const m of c.route?.moves ?? []) if (m.kind === "setSwitch" && m.value) {
        if (!out.has(m.switchId)) out.set(m.switchId, new Set());
        out.get(m.switchId)!.add(key);
      }
    }
  };
  for (const map of Object.values(project.maps)) for (const e of map.events ?? []) for (const p of pagesOf(e)) visit(p.commands, `${map.id}|${e.id}|${p.id}`);
  for (const ce of project.commonEvents ?? []) visit(ce.commands, `ce|${ce.id}`);
  return out;
}

function setElsewhereFor(setters: Map<string, Set<string>>, pageKey: string): Set<string> {
  const out = new Set<string>();
  for (const [id, keys] of setters) if ([...keys].some((k) => k !== pageKey)) out.add(id);
  return out;
}

export function checkSceneStaging(project: Project, issues: LintIssue[]): void {
  const playerNames = playerNamesOf(project);
  const setters = switchSetters(project);
  const reported = new Set<string>();
  for (const map of Object.values(project.maps)) {
    const byId = new Map((map.events ?? []).map((e) => [e.id, e] as const));
    let arrivals: { x: number; y: number; dir: Dir }[] | null = null;
    for (const host of map.events ?? []) {
      for (const page of pagesOf(host)) {
        if (!hasDialogue(page.commands)) continue;
        const st: Replay = { setElsewhere: setElsewhereFor(setters, `${map.id}|${host.id}|${page.id}`), vars: new Map(), switches: new Map(), self: new Map(), actors: new Map(), player: null, playerHidden: false, recent: [], lastSpoken: null };
        seedFromConditions((page.conditions ?? []) as EventPageConditionLike[], st, host.id);
        const trigger = page.trigger?.kind ?? host.trigger?.kind;
        if (trigger === "action" || trigger === "playerTouch" || trigger === "touch") {
          // 주인공이 이 인물에게 말을 걸었다 — 옆에 서서 이 인물을 본다. 정확한 칸은 모르므로 인물 바로 앞(아래) 칸으로 둔다.
          if (shownGraphic(page)) {
            const dir = (page.graphic?.direction as Dir | undefined) ?? "down";
            const front = { x: host.x + DIR_DELTA[dir].x, y: host.y + DIR_DELTA[dir].y };
            st.player = { ...front, dir: dirToward(front, host) ?? "up" };
          }
        } else {
          arrivals ??= arrivalsInto(project, map.id);
          const cells = new Set(arrivals.map((a) => `${a.x},${a.y}`));
          if (cells.size === 1) st.player = { ...arrivals[0]! };
          else if (cells.size === 0 && project.startMapId === map.id && project.startPos) st.player = { x: project.startPos.x, y: project.startPos.y, dir: "down" };
        }
        replay({ project, map, host, page, byId, playerNames, issues, reported }, st, page.commands, `${page.id ?? "page"}`);
      }
    }
  }
}

/** 단독 진입점(데모 전수 검사 스크립트용). */
export function lintSceneStaging(project: Project): LintIssue[] {
  const issues: LintIssue[] = [];
  try { checkSceneStaging(project, issues); } catch { /* 이상한 저장본 */ }
  return issues;
}
