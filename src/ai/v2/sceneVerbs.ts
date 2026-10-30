// 조수 v2 상위 동사 둘 — 「말을 걸고 → 보스전」과 「대사 → 엔딩」을 한 번에 짓는다(2026-10-30 갈고리 H5 가 짚은 빈칸).
//
// 왜: 씬 벤치 terra 판(omo-loop-1030b boss-room·ending)은 이 두 장면을 하위 도구(upsert_enemy·upsert_troop·patch_event_page·
// get_event·define_ending)로 한 칸씩 조립하다 거절을 쌓았다(get_event 44·patch_event_page 22·upsert_troop 거절 4). 모델은 내용(누가·무슨 말·어디)만
// 주고, 함수가 기존 결정적 도구(add_people 의 buildPeople·ensureFoeTroop·upsert_event·define_ending)를 맞게 채워 부른다.
//
//  add_boss_encounter: 보스 인물을 세우고(이미 있으면 대사만 바꾼다) 말 거는 페이지 끝에 보스전(도망 불가)을 붙인다. 적 그룹은
//    troopId → 이름이 맞는 DB 적 → 이름·외형 낱말의 적 그림 순으로 고르고 시작 파티에 맞춘 세기로 만든다(ensureFoeTroop). 이기면
//    격파 스위치(sw_<이벤트 id>_beaten)를 켜고 afterWin 대사, 그 뒤로는 사라지거나(기본) laterTalk 를 말한다. 지면 끝맺음
//    bossDefeatReturns 가 보스 방 앞으로 돌려보낸다.
//  add_ending_scene: 엔딩 정의(define_ending, 에필로그·마지막 제목)를 만들고, 그 맵에 대사 줄 + triggerEnding 을 거는 이벤트를 둔다.
//    언제: afterSwitchId(또는 after 낱말이 맞는 격파·처치 스위치)가 켜진 뒤 맵에 들어오면 자동, talkTo 가 있으면 그 인물에게 말 걸 때.
//    둘 다 없으면 시작하자마자 끝나는 엔딩을 만들지 않으려고 거절한다.
import type { GameEvent, GameMap, Project } from "@/project/types";
import type { BuildRun, ContentBuildResult } from "./types";
import { buildPeople, eventsOf } from "./people";
import { ensureFoeTroop, enemyArtFor } from "./builders/dungeon";
import { pickTroops } from "@/editor/tools/jrpgVolumeTools";
import { reachableCells } from "./eventReach";
import { findMapId } from "./loop/argGuard";
import { nameScore } from "./todo/names";

type Obj = Record<string, unknown>;
type Pt = { x: number; y: number };

export interface BossEncounterSpec {
  readonly mapId?: string;
  readonly boss: { readonly name: string; readonly where?: string; readonly at?: Pt; readonly looks?: string; readonly enemy?: string; readonly troopId?: string };
  readonly lines: readonly string[];
  readonly afterWin?: readonly string[];
  readonly laterTalk?: readonly string[];
}

export interface EndingSceneSpec {
  readonly mapId?: string;
  readonly title: string;
  readonly lines: readonly (string | { readonly who?: string; readonly text: string })[];
  readonly epilogue?: readonly string[];
  readonly talkTo?: string;
  readonly afterSwitchId?: string;
  readonly after?: string;
}

/** 이 요청에 동사를 싣나 — 싣지 않으면 도구 목록이 늘지 않는다. */
export const wantsBossEncounter = (task: string): boolean => /보스|관장전|마왕|결투|싸우|덤벼|boss/iu.test(task);
export const wantsEndingScene = (task: string): boolean => /엔딩|결말|ending/iu.test(task);

const clean = (lines: readonly unknown[] | undefined): string[] => (lines ?? []).map((l) => String(l ?? "").trim()).filter(Boolean).slice(0, 12);
const result = (ok: boolean, run: BuildRun, firstCall: number, summary: string, warnings: string[], mapIds: string[], eventIds: { mapId: string; eventId: string }[] = []): ContentBuildResult =>
  ({ ok, mapIds, summary, warnings, missingArt: [], calls: run.calls.slice(firstCall), eventIds });

function ensureSwitch(project: Project, id: string, name: string): Project {
  const list = (project.switches ?? []) as { id: string; name: string }[];
  return list.some((s) => s.id === id) ? project : { ...project, switches: [...list, { id, name }] } as Project;
}
function replaceEvent(project: Project, mapId: string, ev: GameEvent): Project {
  const map = project.maps[mapId]!;
  const events = (map.events ?? []).some((e) => e.id === ev.id) ? map.events.map((e) => e.id === ev.id ? ev : e) : [...(map.events ?? []), ev];
  return { ...project, maps: { ...project.maps, [mapId]: { ...map, events } as GameMap } } as Project;
}
const triggerOf = (ev: GameEvent, page: { trigger?: unknown }) => ((page.trigger as { kind?: string } | undefined)?.kind ?? (ev.trigger as { kind?: string } | undefined)?.kind);

/** 보스 적 그룹: troopId → 이름이 맞는 DB 적(그 적 하나의 그룹이 있으면 그것) → 이름·외형 낱말의 그림으로 시작 파티에 맞춘 보스 그룹. */
function bossTroop(run: BuildRun, spec: BossEncounterSpec["boss"], warnings: string[]): string | undefined {
  const project = run.ctx.project;
  if (spec.troopId && project.database.troops.some((t) => t.id === spec.troopId)) return spec.troopId;
  if (spec.troopId) warnings.push(`적 그룹 ${spec.troopId} 이 없다 — 이름으로 골랐다`);
  const named = project.database.enemies.find((e) => nameScore(spec.name, String(e.name ?? "")) >= 3) ?? project.database.enemies.find((e) => nameScore(spec.enemy ?? spec.name, String(e.name ?? "")) > 0 && /^enemy_v2_boss_|^enemy_boss/.test(e.id));
  if (named) {
    const own = project.database.troops.find((t) => { const ids = [...(t.enemyIds ?? []), ...(t.members ?? []).map((m) => m.enemyId)]; return ids.length === 1 && ids[0] === named.id; });
    if (own) return own.id;
  }
  const art = named?.id ?? enemyArtFor(project, `${spec.enemy ?? ""} ${spec.name} ${spec.looks ?? ""}`) ?? ["enemy_knight_fallen", "enemy_demon_lord"].find((id) => project.database.enemies.some((e) => e.id === id));
  if (!art) return undefined;
  if (!enemyArtFor(project, `${spec.enemy ?? ""} ${spec.name} ${spec.looks ?? ""}`) && !named) warnings.push(`「${spec.name}」에 맞는 적 그림 낱말이 없어 ${art} 그림으로 세웠다 — 다른 그림이면 enemy 에 낱말(해골·늑대·용…)을 준다`);
  return ensureFoeTroop(run, art, "boss", pickTroops(project, undefined).boss, spec.name);
}

export function buildBossEncounter(run: BuildRun, spec: BossEncounterSpec): ContentBuildResult {
  const first = run.calls.length;
  const warnings: string[] = [];
  const name = String(spec.boss?.name ?? "").trim();
  const lines = clean(spec.lines);
  if (!name) return result(false, run, first, "boss.name(보스 이름)이 필요하다", warnings, []);
  if (!lines.length) return result(false, run, first, "lines(싸우기 전 보스 대사 1줄 이상)가 필요하다", warnings, []);
  const mapId = findMapId(run.ctx.project, spec.mapId) ?? (spec.mapId && run.ctx.project.maps[spec.mapId] ? spec.mapId : run.ctx.currentMapId);
  if (!mapId || !run.ctx.project.maps[mapId]) return result(false, run, first, `맵 「${spec.mapId ?? ""}」 을 찾지 못했다 — mapId(또는 맵 이름)를 준다`, warnings, []);
  const troopId = bossTroop(run, spec.boss, warnings);
  if (!troopId) return result(false, run, first, `「${name}」 보스 적 그룹을 만들지 못했다 — boss.troopId 를 주거나 boss.enemy 에 적 낱말을 준다`, warnings, [mapId]);
  // 사람: 이미 그 이름이 이 맵에 있으면 대사만 바꾼다(buildPeople 규칙).
  const people = buildPeople(run, [{ role: name, name, ...(spec.boss.where ? { where: spec.boss.where } : {}), ...(spec.boss.at ? { at: spec.boss.at } : {}), ...(spec.boss.looks ? { looks: spec.boss.looks } : {}), firstTalk: lines, movement: "still" } as never], mapId);
  warnings.push(...people.warnings);
  const map = run.ctx.project.maps[mapId]!;
  const ev = (people.eventIds ?? []).map((r) => run.ctx.project.maps[r.mapId]?.events?.find((e) => e.id === r.eventId)).find((e): e is GameEvent => !!e)
    ?? eventsOf(map).filter((e) => nameScore(name, String(e.name ?? "")) >= 3).at(-1);
  if (!ev) return result(false, run, first, `「${name}」 인물을 세우지 못했다: ${people.summary}`, warnings, [mapId]);
  const sw = `sw_${ev.id}_beaten`;
  const win: Obj = { kind: "setSwitch", switchId: sw, value: true };
  const battle: Obj = { kind: "battleProcessing", troopSource: "fixed", troopId, canEscape: false, canLose: false, branchOnResult: true,
    victoryBranch: [...clean(spec.afterWin).map((body) => ({ kind: "text", speaker: name, body })), win], defeatBranch: [], escapeBranch: [] };
  const pages = (ev.pages ?? []).filter((p) => p.id !== `${ev.id}_beaten`);
  let attached = 0;
  const fought = pages.map((p) => {
    if (triggerOf(ev, p) !== "action") return p;
    const cmds = ((p.commands ?? []) as unknown as Obj[]).filter((c) => c.kind !== "battleProcessing");
    attached += 1;
    return { ...p, commands: [...cmds, structuredClone(battle)] as unknown as typeof p.commands };
  });
  if (!attached) return result(false, run, first, `「${name}」(${ev.id}) 에 말 거는 페이지가 없다`, warnings, [mapId]);
  const later = clean(spec.laterTalk);
  const gone = { ...structuredClone(fought[0]!), id: `${ev.id}_beaten`, name: "격파 뒤", conditions: [{ kind: "switch", switchId: sw, value: true }],
    ...(later.length ? {} : { graphic: { transparent: true }, priority: "below" }), trigger: { kind: "action" },
    commands: later.map((body) => ({ kind: "text", speaker: name, body })) } as unknown as (typeof fought)[number];
  let next = replaceEvent(run.ctx.project, mapId, { ...ev, pages: [...fought, gone] } as GameEvent);
  next = ensureSwitch(next, sw, `${name} 격파`);
  run.ctx.project = next;
  const troop = next.database.troops.find((t) => t.id === troopId);
  return result(true, run, first, `보스 「${name}」 ${map.name}(${ev.x},${ev.y}) [${ev.id}] — 말을 걸면 대사 ${lines.length}줄 뒤 보스전(${troop?.name ?? troopId} [${troopId}], 도망 불가), 이기면 ${sw} 켜고 ${later.length ? "다시 말 걸면 뒤 대사" : "사라진다"}. 지면 보스 방 앞에서 다시(끝맺음).`, warnings, [mapId], [{ mapId, eventId: ev.id }]);
}

/** after 낱말·격파 스위치로 엔딩이 열릴 스위치 고르기. */
function pickAfterSwitch(project: Project, spec: EndingSceneSpec): string | undefined {
  const switches = (project.switches ?? []) as { id: string; name?: string }[];
  if (spec.afterSwitchId) return switches.some((s) => s.id === spec.afterSwitchId) ? spec.afterSwitchId : undefined;
  const beaten = switches.filter((s) => /_beaten$|격파|쓰러|처치|물리|무찌|clear|defeat/iu.test(`${s.id} ${s.name ?? ""}`));
  if (spec.after) {
    const hit = beaten.find((s) => nameScore(spec.after!, String(s.name ?? "").replace(/\s*(격파|처치|쓰러뜨림)$/u, "")) > 0) ?? switches.find((s) => nameScore(spec.after!, String(s.name ?? "")) > 0);
    if (hit) return hit.id;
    // 격파 스위치가 가리키는 이벤트(sw_<이벤트 id>_clear|_beaten)의 이름·그 맵 이름으로 — 「마왕」 → 마왕의 동굴의 보스 처치 스위치.
    const scored = beaten.map((s) => {
      const evId = /^sw_(.+)_(?:clear|beaten)$/u.exec(s.id)?.[1];
      for (const m of Object.values(project.maps)) {
        const ev = (m.events ?? []).find((e) => e.id === evId);
        if (!ev) continue;
        const score = Math.max(nameScore(spec.after!, String(ev.name ?? "")) * 2, nameScore(spec.after!, m.name)) + (/boss|보스/iu.test(`${ev.id} ${ev.name ?? ""}`) ? 1 : 0);
        return { id: s.id, score: nameScore(spec.after!, String(ev.name ?? "")) || nameScore(spec.after!, m.name) ? score : 0 };
      }
      return { id: s.id, score: 0 };
    }).filter((x) => x.score > 0).sort((a, b) => b.score - a.score);
    if (scored[0] && (!scored[1] || scored[1].score < scored[0].score)) return scored[0].id;
  }
  return beaten.length === 1 ? beaten[0]!.id : undefined;
}

export function buildEndingScene(run: BuildRun, spec: EndingSceneSpec): ContentBuildResult {
  const first = run.calls.length;
  const warnings: string[] = [];
  const title = String(spec.title ?? "").trim() || "엔딩";
  const lines = (spec.lines ?? []).map((l) => typeof l === "string" ? (/^([^:：]{1,12})[:：]\s*(.+)$/u.exec(l) ? { who: /^([^:：]{1,12})[:：]/u.exec(l)![1]!.trim(), text: l.replace(/^[^:：]{1,12}[:：]\s*/u, "") } : { text: l }) : { who: l.who, text: String(l.text ?? "") })
    .filter((l) => l.text.trim()).slice(0, 16);
  if (!lines.length) return result(false, run, first, "lines(엔딩 장면 대사 1줄 이상, 「이름: 대사」 또는 {who,text})가 필요하다", warnings, []);
  const mapId = findMapId(run.ctx.project, spec.mapId) ?? (spec.mapId && run.ctx.project.maps[spec.mapId] ? spec.mapId : run.ctx.currentMapId);
  if (!mapId || !run.ctx.project.maps[mapId]) return result(false, run, first, `맵 「${spec.mapId ?? ""}」 을 찾지 못했다 — mapId(또는 맵 이름)를 준다`, warnings, []);
  const map = run.ctx.project.maps[mapId]!;
  const afterSw = pickAfterSwitch(run.ctx.project, spec);
  if (spec.afterSwitchId && !afterSw) warnings.push(`스위치 ${spec.afterSwitchId} 가 없다`);
  const talker = spec.talkTo ? eventsOf(map).filter((e) => nameScore(spec.talkTo!, String(e.name ?? "")) > 0).at(-1) : undefined;
  if (spec.talkTo && !talker) warnings.push(`「${spec.talkTo}」 인물이 ${map.name} 에 없다`);
  if (!afterSw && !talker) return result(false, run, first, `엔딩이 언제 열리는지 없다 — 그대로 두면 시작하자마자 끝난다. afterSwitchId(마왕 격파 같은 스위치) 또는 after(그 일의 낱말: 「마왕」) 또는 talkTo(말을 걸 인물)를 준다. 지금 스위치: ${((run.ctx.project.switches ?? []) as { id: string; name?: string }[]).slice(-8).map((s) => `${s.id}(${s.name ?? ""})`).join(", ")}`, warnings, [mapId]);
  // 엔딩 정의.
  const slug = title.replace(/[^\p{L}\p{N}]+/gu, "_").replace(/^_|_$/gu, "").slice(0, 24) || "scene";
  const endingId = `ending_${slug}`;
  const epilogue = clean(spec.epilogue);
  const def = run.call("define_ending", { id: endingId, name: title, conditions: [], ...(epilogue.length ? { epilogue: epilogue.map((text) => ({ kind: "say", text })) } : {}), presentation: { finalTitle: title.slice(0, 40), tone: "warm" } });
  if (!def.ok) return result(false, run, first, `엔딩 정의 실패: ${String(def.summary).slice(0, 200)}`, warnings, [mapId]);
  const say = lines.map((l) => ({ kind: "text", ...(l.who ? { speaker: l.who } : {}), body: l.text.trim() }));
  const commands = [...say, { kind: "triggerEnding", endingId }];
  const cond = afterSw ? [{ kind: "switch", switchId: afterSw, value: true }] : [];
  let ev: GameEvent;
  let how: string;
  if (talker) {
    // 그 인물의 새 맨 끝 페이지(조건이 맞으면 이 페이지가 이긴다).
    const base = (talker.pages ?? []).find((p) => triggerOf(talker, p) === "action") ?? (talker.pages ?? [])[0];
    if (!base) return result(false, run, first, `「${spec.talkTo}」(${talker.id}) 에 페이지가 없다`, warnings, [mapId]);
    const page = { ...structuredClone(base), id: `${talker.id}_ending`, name: "엔딩", conditions: cond, trigger: { kind: "action" }, commands } as unknown as NonNullable<GameEvent["pages"]>[number];
    ev = { ...talker, pages: [...(talker.pages ?? []).filter((p) => p.id !== page.id), page] } as GameEvent;
    how = `「${talker.name}」에게 말을 걸면${afterSw ? `(${afterSw} 켜진 뒤)` : ""}`;
  } else {
    // 맵에 들어오면 자동(투명, 아래 칸) — 걸어 닿는 빈 칸 하나에.
    const reach = reachableCells(run.ctx.project, map);
    const taken = new Set((map.events ?? []).map((e) => `${e.x},${e.y}`));
    let at: Pt = { x: 0, y: 0 };
    for (let i = 0; i < map.width * map.height; i++) { const x = i % map.width, y = Math.floor(i / map.width); if ((!reach || reach[i]) && !taken.has(`${x},${y}`)) { at = { x, y }; break; } }
    const id = `ev_ending_${slug}`.slice(0, 60);
    ev = { id, name: `엔딩 — ${title}`, x: at.x, y: at.y, trigger: { kind: "autorun" }, commands: [],
      pages: [{ id: `${id}_p0`, name: "엔딩", conditions: cond, graphic: { transparent: true }, trigger: { kind: "autorun" }, priority: "below", movement: { type: "fixed", speed: 3, frequency: 3 }, commands }] } as unknown as GameEvent;
    how = `${afterSw} 켜진 뒤 ${map.name} 에 들어오면 자동으로`;
  }
  run.ctx.project = replaceEvent(run.ctx.project, mapId, ev);
  return result(true, run, first, `엔딩 「${title}」 [${endingId}] — ${how} 대사 ${say.length}줄 뒤 엔딩(${ev.id})${epilogue.length ? `, 에필로그 ${epilogue.length}줄` : ""}.`, warnings, [mapId], [{ mapId, eventId: ev.id }]);
}
