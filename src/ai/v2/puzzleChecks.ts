// 조수 v2 퍼즐·잠금 검사 — 따로 지은 조각(잠긴 문·금고·단서·동료)이 «한 사슬»로 맞물리는지 본다.
//
// 왜(2026-10-25 판정 J11~J14, 검은 장미 저택): 서재 문은 열쇠로 잠갔는데 1층 7번째 줄 복도가 벽 틈으로 서재에 바로 이어졌고,
// 금고는 자기 대사에 비밀번호(1024)를 적어 일기장 없이 열렸고, 오프닝 이름표에 「@player」가 그대로 떴고, 구한 동생은 따라오지만
// 파티에 없었다. 조각마다 따로 지으면 아무것도 사슬 전체를 보지 않는다 — 끝맺음 관문이 이 검사로 돌려보낸다. 순수 함수.
import { canMove, isPassable } from "@/project/collision";
import type { GameMap, Project } from "@/project/types";
import { playerAnchors } from "@/editor/tools/transferReachability";
import { eventAlwaysBlocks } from "@/project/eventPassageBlock";
import { trivialCode } from "./puzzle";

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj | undefined => (v && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : undefined);
const STEPS = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;
const TOUCH = new Set(["playerTouch", "touch", "eventTouch"]);

function trig(page: Obj): string {
  const t = page.trigger;
  return typeof t === "string" ? t : String(obj(t)?.kind ?? "action");
}
function conds(page: Obj): Obj[] {
  const out: Obj[] = [];
  const visit = (c: unknown): void => {
    if (Array.isArray(c)) { c.forEach(visit); return; }
    const o = obj(c);
    if (!o) return;
    if (Array.isArray(o.all)) o.all.forEach(visit);
    else if (Array.isArray(o.any)) o.any.forEach(visit);
    else out.push(o);
  };
  visit(page.conditions);
  return out;
}
function walk(commands: unknown, visit: (cmd: Obj) => void): void {
  if (!Array.isArray(commands)) return;
  for (const raw of commands) {
    const cmd = obj(raw);
    if (!cmd) continue;
    visit(cmd);
    for (const key of ["then", "else", "branch", "cancelBranch", "commands", "body", "loop"]) if (Array.isArray(cmd[key])) walk(cmd[key], visit);
    if (Array.isArray(cmd.options)) for (const o of cmd.options) walk(obj(o)?.branch, visit);
    if (Array.isArray(cmd.branches)) for (const b of cmd.branches) walk(obj(b)?.commands, visit);
  }
}
function texts(commands: unknown): string[] {
  const out: string[] = [];
  walk(commands, (cmd) => {
    if (cmd.kind === "text") out.push(String(cmd.body ?? ""), String(cmd.speaker ?? ""));
    if (cmd.kind === "choices") { out.push(String(cmd.prompt ?? "")); for (const o of (cmd.options as unknown[] | undefined) ?? []) out.push(String(obj(o)?.text ?? "")); }
  });
  return out;
}
const LOCKED_WORDS = /잠겨|잠긴|잠겼|열리지\s*않|열쇠(가|를)?\s*(없|필요)|열쇠\s*구멍|locked/iu;

/** 맵 하나의 걸어 닿는 칸 — 막는 칸(blocked)은 지나가지 않는다. 앵커가 없으면 null. */
function reachWithout(project: Project, map: GameMap, blocked: ReadonlySet<string>): Set<string> | null {
  const anchors = playerAnchors(project, map).filter((a) => !blocked.has(`${a.x},${a.y}`));
  if (!anchors.length) return null;
  const seen = new Set<string>(anchors.map((a) => `${a.x},${a.y}`));
  const queue = [...anchors];
  for (let i = 0; i < queue.length; i += 1) {
    const c = queue[i]!;
    for (const [dx, dy] of STEPS) {
      const x = c.x + dx, y = c.y + dy, key = `${x},${y}`;
      if (x < 0 || y < 0 || x >= map.width || y >= map.height || seen.has(key) || blocked.has(key)) continue;
      if (!canMove(project, map, c.x, c.y, x, y)) continue;
      seen.add(key);
      queue.push({ x, y });
    }
  }
  return seen;
}

/** 열쇠(아이템)·스위치로 여는 «문» 이벤트: 첫 페이지가 잠겼다고 말하고, 뒤 페이지가 아이템·스위치 조건으로 연다. */
function lockOf(ev: { pages?: unknown }): { key: string } | undefined {
  const pages = ((ev.pages as unknown[] | undefined) ?? []).map((p) => obj(p) ?? {});
  if (pages.length < 2) return undefined;
  const first = pages[0]!;
  if (conds(first).length || !texts(first.commands).some((t) => LOCKED_WORDS.test(t))) return undefined;
  for (const page of pages.slice(1)) {
    const c = conds(page).find((x) => (x.kind === "item" && x.present !== false) || (x.kind === "switch" && x.value !== false));
    if (c) return { key: c.kind === "item" ? `아이템 ${String(c.itemId)}` : `스위치 ${String(c.switchId)}` };
  }
  return undefined;
}

/**
 * 잠긴 문을 거치지 않고 문 너머에 걸어 닿는다(J12). 문 칸을 막고 플레이어가 서는 칸(시작·착지점)에서 걸어 본다 —
 * 문 칸의 마주 보는 두 이웃(남북 또는 동서)이 둘 다 통행 칸인데 둘 다 닿으면 문은 장식이다.
 */
export function lockBypasses(project: Project, changedIds?: ReadonlySet<string>): string[] {
  const out: string[] = [];
  for (const map of Object.values(project.maps)) {
    const locks = (map.events ?? []).filter((ev) => (!changedIds || changedIds.has(ev.id)) && lockOf(ev));
    if (!locks.length) continue;
    const touchCells = new Set<string>();
    for (const ev of map.events ?? []) if ((ev.pages ?? []).some((p) => TOUCH.has(trig(p as unknown as Obj)))) touchCells.add(`${ev.x},${ev.y}`);
    for (const ev of locks) {
      const blocked = new Set([...touchCells, `${ev.x},${ev.y}`]);
      const reach = reachWithout(project, map, blocked);
      if (!reach) continue;
      const pass = (x: number, y: number) => x >= 0 && y >= 0 && x < map.width && y < map.height && isPassable(project, map, x, y);
      for (const [a, b] of [[[0, -1], [0, 1]], [[-1, 0], [1, 0]]] as const) {
        const ax = ev.x + a[0], ay = ev.y + a[1], bx = ev.x + b[0], by = ev.y + b[1];
        if (!pass(ax, ay) || !pass(bx, by)) continue;
        if (reach.has(`${ax},${ay}`) && reach.has(`${bx},${by}`)) {
          out.push(`${map.name}의 잠긴 문 「${ev.name || ev.id}」(${ev.id}, ${ev.x},${ev.y} · ${lockOf(ev)!.key} 필요)을 거치지 않고 양쪽 (${ax},${ay})·(${bx},${by})에 다 걸어 닿는다 — 문 너머 방이 벽 틈으로 열려 있다`);
          break;
        }
      }
    }
  }
  return out;
}

/** 숫자 자물쇠가 자기 대사에 답을 적어 둔다(J12 금고: 「일기장에 적힌 날짜 1024를 떠올려 보자」). */
export function selfRevealingLocks(project: Project, changedIds?: ReadonlySet<string>): string[] {
  const out: string[] = [];
  for (const map of Object.values(project.maps)) for (const ev of map.events ?? []) {
    if (changedIds && !changedIds.has(ev.id)) continue;
    for (const page of (ev.pages ?? []) as unknown as Obj[]) {
      const answers: string[] = [];
      let input = false;
      walk(page.commands, (cmd) => {
        if (/^input/u.test(String(cmd.kind))) input = true;
        const c = obj(cmd.condition);
        if (cmd.kind === "fork" && c?.kind === "variable" && (c.op === "==" || c.op === undefined) && c.value !== undefined && String(c.value).length >= 3) answers.push(String(c.value));
      });
      if (!input || !answers.length) continue;
      const said = texts(page.commands).join(" ");
      const leaked = answers.find((a) => said.includes(a));
      if (leaked) { out.push(`「${ev.name || ev.id}」(${ev.id}) 자물쇠가 자기 대사에 답 ${leaked} 을 적어 둔다 — 단서를 안 봐도 풀린다`); break; }
    }
  }
  return out;
}

/** 보이는 글에 남은 자리 표시(J11 「@player」, J2 글자 「\n」, {name}). 이름표의 @player 는 엔진이 주인공 이름으로 바꾸지만 본문은 아니다. */
export function placeholderTexts(project: Project, changedIds?: ReadonlySet<string>, includeSystem = true): string[] {
  const BAD = /@(?:player|this)\b|\{\{|\{(?:name|player|hero|이름)\}|\\n|%s|\[(?:이름|주인공 이름|NAME)\]|<(?:이름|name)>|\bTODO\b|\bTBD\b|lorem ipsum/iu;
  const out: string[] = [];
  for (const map of Object.values(project.maps)) for (const ev of map.events ?? []) {
    if (changedIds && !changedIds.has(ev.id)) continue;
    for (const page of (ev.pages ?? []) as unknown as Obj[]) {
      let hit: string | undefined;
      walk(page.commands, (cmd) => {
        if (hit) return;
        const shown = cmd.kind === "text" ? [String(cmd.body ?? "")] : cmd.kind === "choices" ? [String(cmd.prompt ?? ""), ...((cmd.options as unknown[] | undefined) ?? []).map((o) => String(obj(o)?.text ?? ""))] : [];
        hit = shown.find((t) => BAD.test(t));
      });
      if (hit) { out.push(`「${ev.name || ev.id}」(${ev.id}): 「${hit.slice(0, 40)}」`); break; }
    }
  }
  if (includeSystem) {
    const opening = obj(project.system.opening);
    const lines = JSON.stringify(opening ?? {}).match(/"(?:narration|text|caption|title|subtitle)":"((?:[^"\\]|\\.)*)"/gu) ?? [];
    const hit = lines.find((l) => /@(?:player|this)\b|\{\{|\{(?:name|player|hero|이름)\}|\\\\n|TODO/u.test(l));
    if (hit) out.push(`오프닝: ${hit.slice(0, 60)}`);
    for (const ending of project.endings ?? []) {
      const pres = obj((ending as unknown as Obj).presentation);
      const credits = String(pres?.credits ?? "");
      if (/\\n/u.test(credits)) out.push(`엔딩 「${ending.name}」 크레딧에 글자 「\\n」`);
    }
  }
  return out;
}

/** 동료로 따라오는데 파티에 없다(J14): 배우 없이 그림만 따라오는 addFollower 인데 이야기는 「합류」라고 한다. */
export function unjoinedFollowers(project: Project, changedIds: ReadonlySet<string>, task: string): string[] {
  const JOIN = /합류|동료|파티에|함께\s*(가|간|싸우|다니|나가)|데려(가|간)|같이\s*(가|다니|나가)|따라(와|오|가)|손을\s*잡|join/iu;
  const out: string[] = [];
  for (const map of Object.values(project.maps)) for (const ev of map.events ?? []) {
    if (!changedIds.has(ev.id)) continue;
    let follower: Obj | undefined, joinsParty = false, says = false;
    for (const page of (ev.pages ?? []) as unknown as Obj[]) walk(page.commands, (cmd) => {
      if (cmd.kind === "addFollower" && !cmd.actorId) follower ??= cmd;
      if (cmd.kind === "changeParty" && cmd.action === "add") joinsParty = true;
      if (cmd.kind === "text" && JOIN.test(String(cmd.body ?? ""))) says = true;
    });
    if (follower && !joinsParty && (says || JOIN.test(task))) out.push(`「${ev.name || ev.id}」(${ev.id}) 의 ${String(follower.name ?? "동료")}`);
  }
  return out;
}

/**
 * 타일을 바꿔 길을 여는 장치(레버·다리·스위치)가 실제로 아무 데도 안 여는 경우(2026-10-25 판정 J1, 약초 동굴 B2):
 * 레버가 다리를 내리지만 다리 없이도 보스 방까지 걸어갔다. 바뀐 칸 중 «못 가던 칸이 갈 수 있게 되는» 것이 있는
 * 장치만 본다(레버 손잡이만 뒤집는 장식은 제외). 바꾼 뒤 새로 닿는 칸이 그 칸들 말고 하나도 없으면 퍼즐이 아니다.
 */
export function gatesThatOpenNothing(project: Project, changedIds?: ReadonlySet<string>): string[] {
  const out: string[] = [];
  for (const map of Object.values(project.maps)) {
    for (const ev of map.events ?? []) {
      if (changedIds && !changedIds.has(ev.id)) continue;
      const edits: { layer: "lower" | "upper"; x: number; y: number; tile: number }[] = [];
      for (const page of (ev.pages ?? []) as unknown[]) walk(obj(page)?.commands, (cmd) => {
        if (cmd.kind !== "changeTile" || (cmd.mapId !== undefined && cmd.mapId !== map.id)) return;
        const x = cmd.x, y = cmd.y, tile = cmd.tile;
        if (!Number.isInteger(x) || !Number.isInteger(y) || !Number.isInteger(tile)) return;
        if ((x as number) < 0 || (y as number) < 0 || (x as number) >= map.width || (y as number) >= map.height) return;
        edits.push({ layer: cmd.layer === "upper" ? "upper" : "lower", x: x as number, y: y as number, tile: tile as number });
      });
      if (!edits.length) continue;
      const lowerTiles = map.lowerTiles.slice(), upperTiles = map.upperTiles.slice();
      for (const e of edits) (e.layer === "upper" ? upperTiles : lowerTiles)[e.y * map.width + e.x] = e.tile;
      const opened: GameMap = { ...map, lowerTiles, upperTiles };
      const freed = new Set(edits.filter((e) => !isPassable(project, map, e.x, e.y) && isPassable(project, opened, e.x, e.y)).map((e) => `${e.x},${e.y}`));
      if (!freed.size) continue;
      const before = reachWithout(project, map, new Set());
      const after = reachWithout(project, opened, new Set());
      if (!before || !after) continue;
      const fresh = [...after].filter((k) => !before.has(k) && !freed.has(k));
      if (fresh.length) continue;
      const cells = [...freed].slice(0, 3).map((k) => `(${k})`).join("·");
      out.push(`${map.name}의 「${ev.name || ev.id}」(${ev.id})가 ${cells} 칸을 열지만 그 너머는 이미 다른 길로 걸어 닿는다 — 장치를 안 써도 끝까지 간다`);
    }
  }
  return out;
}

/**
 * 너무 쉬운 자물쇠(2026-10-25 판정 J63): 번호 자물쇠 답이 1024·1234·0000 처럼 아무나 먼저 쳐 보는 번호이거나,
 * 고르기 자물쇠의 정답이 첫 보기라 첫 칸만 누르면 풀린다. 정답 보기 = 스위치를 켜거나 아이템을 주는 유일한 보기.
 */
export function weakPuzzleLocks(project: Project, changedIds?: ReadonlySet<string>): string[] {
  const out: string[] = [];
  const pays = (branch: unknown): boolean => {
    let hit = false;
    walk(branch, (cmd) => { if ((cmd.kind === "setSwitch" && cmd.value !== false) || (cmd.kind === "changeItem" && Number(cmd.amount ?? cmd.value ?? 1) > 0)) hit = true; });
    return hit;
  };
  for (const map of Object.values(project.maps)) for (const ev of map.events ?? []) {
    if (changedIds && !changedIds.has(ev.id)) continue;
    let found = "";
    for (const page of (ev.pages ?? []) as unknown as Obj[]) {
      let input = false;
      walk(page.commands, (cmd) => {
        if (found) return;
        if (/^input/u.test(String(cmd.kind))) input = true;
        const c = obj(cmd.condition);
        if (input && cmd.kind === "fork" && c?.kind === "variable" && (c.op === "==" || c.op === undefined) && trivialCode(String(c.value ?? ""))) found = `번호 자물쇠 답 ${String(c.value)} 은 누구나 먼저 쳐 보는 번호다`;
        if (cmd.kind === "choices" && Array.isArray(cmd.options) && cmd.options.length >= 3) {
          const paid = cmd.options.map((o) => pays(obj(o)?.branch));
          if (paid[0] && paid.filter(Boolean).length === 1) found = `고르기 자물쇠의 정답 「${String(obj(cmd.options[0])?.text ?? "")}」이 첫 보기다 — 첫 칸만 눌러도 풀린다`;
        }
      });
      if (found) break;
    }
    if (found) out.push(`「${ev.name || ev.id}」(${ev.id}): ${found}`);
  }
  return out;
}

/**
 * 엔딩으로 가는 길의 상호작용 이벤트(열쇠·금고·문·엔딩·단서 스위치)가 걸어 닿지 않는다(J75, 2026-10-26 저택 argon-high:
 * 서재 금고 (2,4) 둘레가 가구·벽으로 막혀 예배당 열쇠와 엔딩에 못 간다). 플레이어가 그 칸에 서거나 이웃 칸에서 마주 볼 수 있어야 한다.
 * 걷기는 타일 통행과 늘 막는 이벤트(J75 실측: 한 칸 복도에 선 일기장 이벤트가 금고 가는 길을 막음)를 본다. 잠긴 문은 열린다고 낙관한다.
 * 대상: 버튼·접촉으로 켜는 페이지가 엔딩·아이템 주기·숫자 입력·다른 페이지 조건에 쓰이는 스위치 켜기 중 하나를 하거나, 잠긴 문이다.
 */
export function unreachableCriticalEvents(project: Project): string[] {
  const usedSwitches = new Set<string>();
  for (const map of Object.values(project.maps)) for (const ev of map.events ?? []) for (const page of (ev.pages ?? []) as unknown as Obj[]) {
    for (const c of conds(page)) if (c.kind === "switch" && c.switchId !== undefined) usedSwitches.add(String(c.switchId));
    walk(page.commands, (cmd) => { const c = obj(cmd.condition); if (c?.kind === "switch" && c.switchId !== undefined) usedSwitches.add(String(c.switchId)); });
  }
  for (const ce of (project.commonEvents ?? []) as unknown as Obj[]) walk(ce.commands, (cmd) => { const c = obj(cmd.condition); if (c?.kind === "switch" && c.switchId !== undefined) usedSwitches.add(String(c.switchId)); });
  // 계산된 착지(변수 좌표·변수 맵)로 들어오는 맵은 앵커를 다 알 수 없다 — 거짓 차단을 피해 그 맵은 보지 않는다. 대상 맵을 모르는 이동이 하나라도 있으면 전부 건너뛴다.
  const computedLanding = new Set<string>();
  let unknownTarget = false;
  const scanTransfers = (node: unknown): void => {
    if (Array.isArray(node)) { node.forEach(scanTransfers); return; }
    const o = obj(node);
    if (!o) return;
    if (o.kind === "transfer") {
      if (typeof o.mapId !== "string") unknownTarget = true;
      else if (typeof o.x !== "number" || typeof o.y !== "number") computedLanding.add(o.mapId);
    }
    for (const v of Object.values(o)) if (v && typeof v === "object") scanTransfers(v);
  };
  for (const map of Object.values(project.maps)) for (const ev of map.events ?? []) scanTransfers(ev.pages);
  scanTransfers(project.commonEvents ?? []);
  if (unknownTarget) return [];
  const out: string[] = [];
  for (const map of Object.values(project.maps)) {
    if (map.worldmapSource || computedLanding.has(map.id)) continue;
    const critical = (map.events ?? []).flatMap((ev) => {
      const why: string[] = [];
      for (const page of (ev.pages ?? []) as unknown as Obj[]) {
        const t = trig(page);
        if (t === "auto" || t === "autorun" || t === "parallel") continue;
        walk(page.commands, (cmd) => {
          if (cmd.kind === "triggerEnding") why.push("엔딩");
          else if (cmd.kind === "changeItem" && Number(cmd.amount ?? cmd.value ?? 1) > 0) why.push("아이템");
          else if (/^input/u.test(String(cmd.kind))) why.push("숫자 입력");
          else if (cmd.kind === "setSwitch" && cmd.value !== false && usedSwitches.has(String(cmd.switchId))) why.push("단서 스위치");
        });
      }
      if (lockOf(ev)) why.push("잠긴 문");
      return why.length ? [{ ev, why: [...new Set(why)] }] : [];
    });
    if (!critical.length) continue;
    // 늘 막는 이벤트(모든 페이지가 보통 우선순위 — 한 칸 복도의 일기장·가구 이벤트)는 벽처럼 친다. 잠긴 문은 열린다고 본다.
    const blocked = new Set((map.events ?? []).filter((ev) => eventAlwaysBlocks(ev) && !lockOf(ev)).map((ev) => `${ev.x},${ev.y}`));
    const reach = reachWithout(project, map, blocked);
    if (!reach) continue;
    const at = (x: number, y: number) => reach.has(`${x},${y}`);
    for (const { ev, why } of critical) {
      if (at(ev.x, ev.y) || STEPS.some(([dx, dy]) => at(ev.x + dx, ev.y + dy))) continue;
      out.push(`${map.name}의 「${ev.name || ev.id}」(${ev.id}, ${ev.x},${ev.y} · ${why.join("·")})에 걸어 닿지 못한다 — 그 칸도 네 이웃 칸도 시작·입구에서 이어지지 않는다(벽·가구나 한 칸 길을 막고 선 이벤트에 갇힘). 엔딩으로 가는 길이 끊긴다`);
    }
  }
  return out;
}
