// 보스 대사 뒤 전투(끝맺음, 결정적) + 보스 패배 뒤 돌아올 자리.
//
// 1) 말을 거는 보스가 싸우지 않는다
// 왜(2026-10-30 씬 벤치 sc-1030a terra boss-room r2·r3): 조수가 해골 기사를 add_people(첫 말 「…내 검을 받아라!」, 다시 말 「결판을 내자.」)로
// 세우고, 전투는 입구 칸의 닿기 컷신(add_event → patch_event_page 로 battleProcessing)에만 넣었다. 장면은 방 안 보스 곁에서 시작해
// 판정자는 보스에게 말을 걸었고, 「결판을 내자.」만 되풀이될 뿐 전투가 열리지 않았다.
// 규칙: 한 맵에 사람 그림의 말 거는 이벤트(전투 없음)가 있고, 같은 맵 다른 이벤트의 전투 상대(부대의 적 이름) 또는 그 전투 페이지의 화자가
// 그 사람 이름과 같으면, 그 사람의 말 거는 페이지 끝에 같은 전투를 붙인다. 이기면 스위치 `sw_<사람 id>_beaten` 을 켜고, 그 스위치가 켜지면
// 사람은 사라지고(투명·통과) 원래 전투 이벤트도 다시 싸우지 않는다(맨 끝 페이지). 같은 맵에 그 이름의 전투가 없어도 부대 하나가 그 이름의
// 적만으로 이뤄졌고 사람 대사가 싸움을 거는 말(「검을 받아라」「결판」「덤벼」…)이면 그 부대로 전투를 세운다.
//
// 2) 보스에게 지면 먼 시작 마을로
// 왜(같은 판 terra boss-room r1, opus boss-room r1~r3): 패배 처리는 프로젝트 기본 게임 오버(outcome recover, 돌아올 자리 없음 →
// 시작 자리)라 지하 던전 보스 방에서 지면 마을 다리 위로 보내졌고, 다시 도전할 길 안내가 없었다.
// 규칙: 기본 게임 오버가 돌아오기(recover)이고 돌아올 자리가 그 전투 맵이 아닐 때, 지면 안 되는(canLose:false) 이벤트 전투마다
// 그 맵 입구 착지 칸(그 맵으로 들어오는 문이 내려 주는 칸 — 보스 방 앞), 없으면 전투 이벤트에서 3칸 이상 떨어진 걸어 닿는 칸을 돌아올 자리로 둔
// 게임 오버 정의(`go_back_<맵 id>`, 기본 설정 사본)를 만들고, 전투를 지면 그 게임 오버로 가게 한다(canLose:true + 패배 갈래 gameOver{gameOverId}).
// 돌아오기는 파티를 다 회복시킨다(defeatRecovery). 시작 맵의 전투·이미 패배 갈래가 있는 전투는 건드리지 않는다.
import type { GameEvent, GameMap, Project } from "@/project/types";
import type { BuildRun } from "./types";
import { isPassable } from "@/project/collision";
import { reachableCells } from "./eventReach";

type Obj = Record<string, unknown>;
const nameOf = (ev: GameEvent) => String((ev as { name?: string }).name ?? "").trim();
const flat = (s: string) => s.replace(/[\s「」『』.,!?·]/gu, "");
const shownPerson = (ev: GameEvent) => (ev.pages ?? []).some((p) => { const g = (p.graphic ?? {}) as { transparent?: boolean; sprite?: unknown; appearanceId?: unknown }; return g.transparent !== true && Boolean(g.sprite || g.appearanceId); });
/** 싸움을 거는 말. */
const CHALLENGE = /결판|검을\s*받|덤벼|각오|승부|싸우자|싸워라|맞서|물러서지|쓰러뜨려\s*주마|목숨을|베어\s*주마|상대해\s*주마|도전/u;

function findBattles(node: unknown, out: Obj[]): void {
  if (Array.isArray(node)) { for (const n of node) findBattles(n, out); return; }
  if (!node || typeof node !== "object") return;
  const r = node as Obj;
  if (r.kind === "battleProcessing") out.push(r);
  for (const v of Object.values(r)) if (v && typeof v === "object") findBattles(v, out);
}
function texts(node: unknown, out: { body: string; speaker: string }[]): void {
  if (Array.isArray(node)) { for (const n of node) texts(n, out); return; }
  if (!node || typeof node !== "object") return;
  const r = node as Obj;
  if (r.kind === "text") out.push({ body: String(r.body ?? ""), speaker: String(r.speaker ?? "") });
  for (const v of Object.values(r)) if (v && typeof v === "object") texts(v, out);
}

function troopEnemyNames(project: Project, troopId: string): string[] {
  const troop = (project.database.troops ?? []).find((t) => t.id === troopId) as { enemyIds?: string[]; members?: { enemyId?: string }[] } | undefined;
  if (!troop) return [];
  const ids = [...(troop.enemyIds ?? []), ...(troop.members ?? []).map((m) => String(m.enemyId ?? ""))];
  const byId = new Map((project.database.enemies ?? []).map((e) => [e.id, String(e.name ?? "")]));
  return [...new Set(ids.map((id) => byId.get(id) ?? "").filter(Boolean))];
}

function ensureSwitch(project: Project, id: string, name: string): Project {
  const list = (project.switches ?? []) as { id: string; name: string }[];
  if (list.some((s) => s.id === id)) return project;
  return { ...project, switches: [...list, { id, name }] } as Project;
}

/** 이 맵에서 말을 거는 보스에게 전투를 붙인다. 한 일 글. */
export function talkBossBattles(run: BuildRun, mapId: string): string[] {
  const project = run.ctx.project;
  const map = project.maps[mapId];
  if (!map) return [];
  const sources: { ev: GameEvent; cmd: Obj; names: Set<string> }[] = [];
  for (const ev of map.events ?? []) for (const page of ev.pages ?? []) {
    const found: Obj[] = [];
    findBattles(page.commands ?? [], found);
    if (!found.length) continue;
    const said: { body: string; speaker: string }[] = [];
    texts(page.commands ?? [], said);
    for (const cmd of found) {
      const names = new Set([...troopEnemyNames(project, String(cmd.troopId ?? "")), ...said.map((t) => t.speaker).filter(Boolean)].map(flat).filter((n) => n.length >= 2));
      sources.push({ ev, cmd, names });
    }
  }
  const notes: string[] = [];
  let next = project;
  const events = [...(map.events ?? [])];
  for (let i = 0; i < events.length; i++) {
    const p = events[i]!;
    const who = nameOf(p);
    if (!who || flat(who).length < 2 || !shownPerson(p)) continue;
    const own: Obj[] = [];
    findBattles(p.pages ?? [], own);
    if (own.length) continue;
    const talkPages = (p.pages ?? []).filter((pg) => ((pg.trigger as { kind?: string } | undefined)?.kind ?? (p.trigger as { kind?: string } | undefined)?.kind) === "action");
    if (!talkPages.length) continue;
    let src = sources.find((s) => s.ev.id !== p.id && s.names.has(flat(who)));
    if (!src) {
      const said: { body: string; speaker: string }[] = [];
      texts(p.pages ?? [], said);
      if (!said.some((t) => CHALLENGE.test(t.body))) continue;
      const troop = (project.database.troops ?? []).find((t) => { const n = troopEnemyNames(project, t.id); return n.length === 1 && flat(n[0]!) === flat(who); });
      if (!troop) continue;
      src = { ev: p, cmd: { kind: "battleProcessing", troopId: troop.id, canEscape: false, canLose: false, branchOnResult: true, victoryBranch: [], defeatBranch: [], escapeBranch: [] }, names: new Set() };
    }
    const sw = `sw_${p.id}_beaten`;
    const win = { kind: "setSwitch", switchId: sw, value: true };
    const battle = structuredClone(src.cmd) as Obj;
    // 원래 이긴 갈래의 자기 스위치(그 컷신 자신의 것)는 이 사람에게 뜻이 없다 — 빼고 격파 스위치를 켠다.
    const victory = (Array.isArray(battle.victoryBranch) ? battle.victoryBranch as Obj[] : []).filter((c) => c.kind !== "setSelfSwitch");
    battle.branchOnResult = true;
    battle.victoryBranch = [...victory, win];
    if (!Array.isArray(battle.defeatBranch)) battle.defeatBranch = [];
    if (!Array.isArray(battle.escapeBranch)) battle.escapeBranch = [];
    const pages = (p.pages ?? []).map((pg) => {
      const kind = (pg.trigger as { kind?: string } | undefined)?.kind ?? (p.trigger as { kind?: string } | undefined)?.kind;
      return kind === "action" ? { ...pg, commands: [...(pg.commands ?? []), structuredClone(battle)] } : pg;
    });
    const gone = { ...structuredClone(pages[0]!), id: `${p.id}_beaten`, name: "격파 뒤", conditions: [{ kind: "switch", switchId: sw, value: true }], graphic: { transparent: true }, priority: "below", trigger: { kind: "action" }, commands: [] };
    const maps = { ...next.maps };
    const cur = maps[mapId]!;
    maps[mapId] = {
      ...cur,
      events: cur.events.map((e) => {
        if (e.id === p.id) return { ...e, pages: [...pages, gone] as unknown as typeof e.pages };
        if (e.id === src!.ev.id && src!.ev.id !== p.id) {
          // 원래 전투 이벤트: 이기면 같은 스위치를 켜고, 켜진 뒤로는 다시 싸우지 않는다.
          const mark = (node: unknown): unknown => {
            if (Array.isArray(node)) return node.map(mark);
            if (!node || typeof node !== "object") return node;
            const r = { ...(node as Obj) };
            for (const [k, v] of Object.entries(r)) if (v && typeof v === "object") r[k] = mark(v);
            if (r.kind === "battleProcessing" && r.troopId === src!.cmd.troopId) {
              r.branchOnResult = true;
              const v = Array.isArray(r.victoryBranch) ? r.victoryBranch as Obj[] : [];
              if (!v.some((c) => c.kind === "setSwitch" && c.switchId === sw)) r.victoryBranch = [...v, win];
            }
            return r;
          };
          const marked = mark(e.pages ?? []) as NonNullable<typeof e.pages>;
          const quiet = { ...structuredClone((e.pages ?? [])[0]!), id: `${e.id}_after_${p.id}`, name: "격파 뒤", conditions: [{ kind: "switch", switchId: sw, value: true }], graphic: { transparent: true }, priority: "below", commands: [] };
          return { ...e, pages: [...marked, quiet] as unknown as typeof e.pages };
        }
        return e;
      }),
    } as GameMap;
    next = ensureSwitch({ ...next, maps } as Project, sw, `${who} 격파`);
    notes.push(`「${who}」(${p.x},${p.y}) 말 건 뒤 전투(${String(src.cmd.troopId)})${src.ev.id !== p.id ? ` — ${src.ev.id} 와 같은 전투, 이기면 둘 다 끝` : " — 같은 이름 적 부대"}`);
  }
  run.ctx.project = next;
  return notes;
}

/** 시작 칸들(걸을 수 있는 것만)에서 4방향으로 걸어 닿는 칸. 시작 칸이 하나도 없으면 undefined. */
function floodFrom(project: Project, map: GameMap, seeds: { x: number; y: number }[]): Uint8Array | undefined {
  const w = map.width, h = map.height;
  const seen = new Uint8Array(w * h);
  const q: number[] = [];
  for (const c of seeds) if (c.x >= 0 && c.y >= 0 && c.x < w && c.y < h && isPassable(project, map, c.x, c.y) && !seen[c.y * w + c.x]) { seen[c.y * w + c.x] = 1; q.push(c.y * w + c.x); }
  if (!q.length) return undefined;
  for (let k = 0; k < q.length; k++) {
    const x = q[k]! % w, y = Math.floor(q[k]! / w);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h || seen[ny * w + nx] || !isPassable(project, map, nx, ny)) continue;
      seen[ny * w + nx] = 1; q.push(ny * w + nx);
    }
  }
  return seen;
}

/** 전투 맵으로 들어오는 문이 내려 주는 칸들. */
function landingsInto(project: Project, mapId: string): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  const visit = (node: unknown, from: string): void => {
    if (Array.isArray(node)) { for (const n of node) visit(n, from); return; }
    if (!node || typeof node !== "object") return;
    const r = node as Obj;
    if (r.kind === "transfer" && r.mapId === mapId && from !== mapId && typeof r.x === "number" && typeof r.y === "number") out.push({ x: r.x, y: r.y });
    for (const v of Object.values(r)) if (v && typeof v === "object") visit(v, from);
  };
  for (const m of Object.values(project.maps)) visit(m.events ?? [], m.id);
  return out;
}

/** 지면 안 되는 이벤트 전투에 지면 그 맵 입구(보스 방 앞)로 돌아오게. 한 일 글. */
export function bossDefeatReturns(run: BuildRun): string[] {
  const project = run.ctx.project;
  const system = project.system as unknown as { gameOver?: Obj & { outcome?: string; presentation?: string; recovery?: { mapId?: string } }; gameOvers?: { id: string; name: string; settings: Obj }[]; defaultGameOverId?: string };
  const base = system.defaultGameOverId ? system.gameOvers?.find((g) => g.id === system.defaultGameOverId)?.settings : system.gameOver;
  const outcome = (base as { outcome?: string } | undefined)?.outcome ?? ((base as { presentation?: string } | undefined)?.presentation === "blackout" ? "recover" : "menu");
  if (!base || outcome !== "recover") return [];
  const backTo = (base as { recovery?: { mapId?: string } }).recovery?.mapId ?? project.startMapId;
  const notes: string[] = [];
  const defs = [...(system.gameOvers ?? [])];
  const maps = { ...project.maps };
  let changed = false;
  for (const map of Object.values(project.maps)) {
    if (map.id === backTo || map.id === project.startMapId) continue;
    const battleEvents = (map.events ?? []).filter((ev) => JSON.stringify(ev.pages ?? []).includes('"battleProcessing"'));
    if (!battleEvents.length) continue;
    const id = `go_back_${map.id}`.slice(0, 80);
    let def = defs.find((g) => g.id === id);
    if (!def) {
      if (defs.length >= 60) break;
      // 들어오는 문도 시작점도 없는 맵(장면이 그 방 안에서 시작하는 보스 방)은 전투 이벤트 곁 칸에서 걸어 닿는 칸을 잰다.
      const reach = reachableCells(project, map) ?? floodFrom(project, map, battleEvents.flatMap((e) => [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => ({ x: e.x + dx!, y: e.y + dy! }))));
      const taken = new Set((map.events ?? []).map((e) => `${e.x},${e.y}`));
      const ok = (c: { x: number; y: number }) => c.x >= 0 && c.y >= 0 && c.x < map.width && c.y < map.height && isPassable(project, map, c.x, c.y) && !taken.has(`${c.x},${c.y}`) && (!reach || reach[c.y * map.width + c.x]);
      let spot = landingsInto(project, map.id).find(ok);
      if (!spot && reach) {
        const far = (c: { x: number; y: number }) => Math.min(...battleEvents.map((e) => Math.abs(e.x - c.x) + Math.abs(e.y - c.y)));
        const cells: { x: number; y: number; d: number }[] = [];
        for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) if (ok({ x, y }) && far({ x, y }) >= 3) cells.push({ x, y, d: far({ x, y }) });
        cells.sort((a, b) => a.d - b.d || a.y - b.y || a.x - b.x);
        spot = cells[0];
      }
      if (!spot) continue;
      def = { id, name: `${map.name ?? map.id} 앞에서 다시`, settings: { ...structuredClone(base), outcome: "recover", recovery: { mapId: map.id, x: spot.x, y: spot.y } } };
      defs.push(def);
    }
    let n = 0;
    // 전투 뒤에 이어지던 명령(이긴 뒤 글·스위치)은 이긴(·도망친) 갈래로 옮긴다 — 지는 갈래의 gameOver 뒤에도 사건이 이어져
    // 진 플레이어에게 「쓰러뜨렸다」가 나오지 않게(gameOver 명령은 돌아오기 뒤 사건을 계속 돌린다).
    const patch = (node: unknown): unknown => {
      if (Array.isArray(node)) {
        const out: unknown[] = [];
        for (let i = 0; i < node.length; i++) {
          const r0 = node[i] as Obj | null;
          if (r0 && typeof r0 === "object" && r0.kind === "battleProcessing" && r0.canLose !== true && !(Array.isArray(r0.defeatBranch) && (r0.defeatBranch as unknown[]).length)) {
            const r = patch({ ...r0, __skip: true }) as Obj;
            delete r.__skip;
            const rest = node.slice(i + 1).map(patch);
            r.canLose = true;
            r.victoryBranch = [...(Array.isArray(r.victoryBranch) && r.branchOnResult ? r.victoryBranch as unknown[] : []), ...structuredClone(rest)];
            r.escapeBranch = [...(Array.isArray(r.escapeBranch) && r.branchOnResult ? r.escapeBranch as unknown[] : []), ...(r.canEscape ? structuredClone(rest) : [])];
            r.branchOnResult = true;
            r.defeatBranch = [{ kind: "gameOver", gameOverId: id }];
            n += 1;
            out.push(r);
            break;
          }
          out.push(patch(r0));
        }
        return out;
      }
      if (!node || typeof node !== "object") return node;
      const r = { ...(node as Obj) };
      for (const [k, v] of Object.entries(r)) if (v && typeof v === "object") r[k] = patch(v);
      return r;
    };
    const events = (map.events ?? []).map((ev) => battleEvents.includes(ev) ? { ...ev, pages: patch(ev.pages ?? []) as typeof ev.pages } : ev);
    if (!n) continue;
    maps[map.id] = { ...map, events };
    changed = true;
    const rec = (def.settings as { recovery?: { x: number; y: number } }).recovery!;
    notes.push(`${map.name ?? map.id}: 전투 ${n}개 — 지면 이 맵 (${rec.x},${rec.y})에서 회복해 다시`);
  }
  if (changed) run.ctx.project = { ...project, maps, system: { ...project.system, gameOvers: defs } } as Project;
  return notes;
}

/**
 * 출하 검사 「보스 대사 뒤 전투 없음」: 사람 그림의 말 거는 이벤트가 싸움을 거는 말(「결판을 내자」…)을 하는데 어느 페이지에도 전투가 없고,
 * 그 이름이 적 이름(부대의 적)과 같다 — 말만 되풀이되고 싸움이 열리지 않는다(2026-10-30 씬 벤치 terra boss-room).
 */
export function bossTalkWithoutBattle(project: Project): { mapId: string; eventId: string; name: string; x: number; y: number }[] {
  const enemyNames = new Set((project.database.enemies ?? []).map((e) => flat(String(e.name ?? ""))).filter((n) => n.length >= 2));
  const out: { mapId: string; eventId: string; name: string; x: number; y: number }[] = [];
  for (const map of Object.values(project.maps)) for (const ev of map.events ?? []) {
    const who = nameOf(ev);
    if (!who || !enemyNames.has(flat(who)) || !shownPerson(ev)) continue;
    const said: { body: string; speaker: string }[] = [];
    texts(ev.pages ?? [], said);
    if (!said.some((t) => CHALLENGE.test(t.body))) continue;
    const battles: Obj[] = [];
    findBattles(ev.pages ?? [], battles);
    if (battles.length) continue;
    out.push({ mapId: map.id, eventId: ev.id, name: who, x: ev.x, y: ev.y });
  }
  return out;
}
