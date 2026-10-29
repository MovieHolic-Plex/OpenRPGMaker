// 조수 v2 퍼즐 사슬 — 단서 → 자물쇠 → 보상 → 문을 한 번에 짓고, 잠긴 방이 정말 막혔는지 걸어서 확인한다.
//
// 왜(2026-10-25 판정 J12/J13, 검은 장미 저택): 조각을 따로 지으니 금고는 자기 대사에 답을 말했고, 시계는 쪽지를 안 봐도 열쇠를 줬고,
// 서재는 열쇠로 잠갔는데 복도 벽 틈으로 바로 들어갔다. 이 동사는 사슬을 순서대로 묶고(앞 고리가 켠 깃발·준 물건만 뒤 고리가 본다),
// 답은 단서에만 두고, 문을 지은 뒤 문 칸을 막은 채 플레이어 시작·착지점에서 걸어 문 너머가 닿으면 그 틈을 벽으로 메운다.
import { canMove, isPassable } from "@/project/collision";
import { layerTileAt, setLayerTileAt, shadowAt, setShadowAt } from "@/project/mapLayers";
import type { GameMap, Project } from "@/project/types";
import { playerAnchors } from "@/editor/tools/transferReachability";
import type { BuildRun, ContentBuildResult } from "./types";
import { repairEventReach } from "./eventReach";
import { dressInteriorExits } from "./exitDress";
import { fixObjectSheetFacing, showExaminedThing } from "./examineArt";
import { examineHint, settleExamineSpot } from "./examineSpot";
import { isPersonName, personGraphicFor } from "./personName";

type Obj = Record<string, unknown>;
const STEPS = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;
const TOUCH = new Set(["playerTouch", "touch", "eventTouch"]);
const slug = (s: string): string => (s.normalize("NFKD").replace(/[^A-Za-z0-9]+/gu, "_").replace(/^_|_$/gu, "").toLowerCase() || `k${Math.abs([...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7)).toString(36)}`).slice(0, 24);

export interface ChainLink {
  readonly role: "clue" | "code" | "door" | "pickup" | "ending";
  readonly eventId?: string;
  readonly name?: string;
  readonly at?: { readonly x: number; readonly y: number };
  readonly mapId?: string;
  /** clue: 읽으면 알게 되는 것의 이름(뒤 고리의 needs 가 이 이름을 쓴다). */
  readonly learn?: string;
  /** 이 고리를 쓰려면 먼저 있어야 하는 것 — 앞 고리의 learn·reward.flag 이름 또는 물건 이름. */
  readonly needs?: string;
  /** code: 숫자 답(입력) 또는 choices 의 정답 글. */
  readonly code?: string;
  readonly options?: readonly string[];
  readonly lines?: readonly string[];
  readonly lockedLines?: readonly string[];
  readonly wrongLines?: readonly string[];
  readonly doneLines?: readonly string[];
  readonly reward?: { readonly item?: string; readonly flag?: string; readonly lines?: readonly string[] };
  readonly seal?: boolean;
  /** needs 대신 쓰는 조건 그대로(사슬 밖 이벤트가 켜는 스위치·주는 아이템). */
  readonly needsCondition?: readonly Record<string, unknown>[];
  /** ending: 부를 엔딩 id(조건이 차면 대사 뒤 triggerEnding). */
  readonly endingId?: string;
}
export interface ChainArgs { readonly mapId: string; readonly name: string; readonly links: readonly ChainLink[] }

function trig(page: Obj): string {
  const t = page.trigger;
  return typeof t === "string" ? t : String((t as Obj | undefined)?.kind ?? "action");
}
const say = (lines: readonly string[] | undefined): Obj[] => (lines ?? []).filter((l) => l.trim()).map((body) => ({ kind: "text", body }));

/** 맵을 고칠 사본 — before 스냅숏과 공유하지 않게 맵 하나만 깊게 복사한다. */
function ownMap(run: BuildRun, mapId: string): GameMap | undefined {
  const project = run.ctx.project;
  const map = project.maps[mapId];
  if (!map) return undefined;
  const copy = structuredClone(map);
  run.ctx.project = { ...project, maps: { ...project.maps, [mapId]: copy } } as Project;
  return copy;
}

function reachFrom(project: Project, map: GameMap, blocked: ReadonlySet<string>, open?: string): Map<string, string | null> | null {
  const anchors = playerAnchors(project, map).filter((a) => !blocked.has(`${a.x},${a.y}`));
  if (!anchors.length) return null;
  const parent = new Map<string, string | null>(anchors.map((a) => [`${a.x},${a.y}`, null]));
  const queue = [...anchors];
  for (let i = 0; i < queue.length; i += 1) {
    const c = queue[i]!;
    for (const [dx, dy] of STEPS) {
      const x = c.x + dx, y = c.y + dy, key = `${x},${y}`;
      if (x < 0 || y < 0 || x >= map.width || y >= map.height || parent.has(key) || blocked.has(key)) continue;
      // 열린 문(open): 문 이벤트가 칸을 막고 있어도 열린 뒤에는 지나간다고 본다.
      if (!canMove(project, map, c.x, c.y, x, y) && key !== open && `${c.x},${c.y}` !== open) continue;
      parent.set(key, `${c.x},${c.y}`);
      queue.push({ x, y });
    }
  }
  return parent;
}
const pt = (key: string) => { const [x, y] = key.split(",").map(Number); return { x: x!, y: y! }; };

/**
 * 잠긴 문(eventId) 너머가 문을 거치지 않고 닿으면 그 틈을 막는다. 틈 = 돌아가는 길 위에서 양옆이 막힌 한 칸(벽 틈·좁은 복도).
 * 그 칸에 옆 벽 칸의 타일을 그대로 옮겨 벽으로 만든다(옆에 벽이 없으면 보이지 않는 막이 이벤트). 최대 6군데.
 */
export function sealLockedRoom(run: BuildRun, mapId: string, eventId: string): ContentBuildResult {
  const warnings: string[] = [];
  const base = run.ctx.project.maps[mapId];
  const door = base?.events.find((ev) => ev.id === eventId);
  if (!base || !door) return { ok: false, mapIds: [mapId], summary: `맵 ${mapId} 에 문 이벤트 ${eventId} 가 없다`, warnings, missingArt: [], calls: [] };
  const sealed: string[] = [];
  for (let round = 0; round < 6; round += 1) {
    const project = run.ctx.project;
    const map = project.maps[mapId]!;
    const blocked = new Set<string>([`${door.x},${door.y}`]);
    for (const ev of map.events ?? []) if ((ev.pages ?? []).some((p) => TOUCH.has(trig(p as unknown as Obj)))) blocked.add(`${ev.x},${ev.y}`);
    for (const ev of map.events ?? []) if (ev.id.startsWith("ev_chain_seal_")) blocked.add(`${ev.x},${ev.y}`);
    const parent = reachFrom(project, map, blocked);
    if (!parent) { warnings.push("이 맵에 플레이어가 서는 칸(시작·착지점)이 없어 걸어 볼 수 없다"); break; }
    const pass = (x: number, y: number) => x >= 0 && y >= 0 && x < map.width && y < map.height && isPassable(project, map, x, y);
    const pair = ([[[0, -1], [0, 1]], [[-1, 0], [1, 0]]] as const)
      .map(([a, b]) => [{ x: door.x + a[0], y: door.y + a[1] }, { x: door.x + b[0], y: door.y + b[1] }] as const)
      .find(([a, b]) => pass(a.x, a.y) && pass(b.x, b.y) && parent.has(`${a.x},${a.y}`) && parent.has(`${b.x},${b.y}`));
    if (!pair) break;
    // 문 너머 = 앵커에서 더 멀리 돌아가야 닿는 쪽.
    const depth = (key: string) => { let n = 0; for (let k: string | null | undefined = key; k; k = parent.get(k)) n += 1; return n; };
    const [a, b] = pair;
    const behind = depth(`${a.x},${a.y}`) >= depth(`${b.x},${b.y}`) ? a : b;
    const path: string[] = [];
    for (let k: string | null | undefined = `${behind.x},${behind.y}`; k; k = parent.get(k)) path.push(k);
    // 틈 고르기: 돌아가는 길 위의 한 칸을 막았을 때 (1) 문을 막은 채로는 문 너머에 못 가고 (2) 문을 열면 그 칸 말고는 잃는 칸이 없어야 한다
    // — 문 바로 옆 좁은 칸을 막으면 방 안까지 문에서 끊긴다(첫 시험: 서재 입구 (21,5)를 막을 뻔했다).
    const doorKey = `${door.x},${door.y}`;
    const openReach = reachFrom(project, map, new Set([...blocked].filter((k) => k !== doorKey)), doorKey);
    const openCount = openReach?.size ?? 0;
    let gap: { x: number; y: number; donor?: { x: number; y: number } } | undefined;
    for (const key of path.slice(1, -1)) {
      const c = pt(key);
      const open = STEPS.filter(([dx, dy]) => pass(c.x + dx, c.y + dy));
      if (open.length > 2) continue;
      const trial = new Set([...blocked, key]);
      const closed = reachFrom(project, map, trial);
      if (!closed || closed.has(`${behind.x},${behind.y}`)) continue;
      const withDoor = reachFrom(project, map, new Set([...trial].filter((k) => k !== doorKey)), doorKey);
      if (!withDoor || withDoor.size < openCount - 1) continue;
      const horizontal = open.every(([, dy]) => dy === 0);
      const side = (horizontal ? [[0, -1], [0, 1]] : [[-1, 0], [1, 0]]) as readonly (readonly [number, number])[];
      const donor = [...side, ...STEPS].map(([dx, dy]) => ({ x: c.x + dx, y: c.y + dy })).find((d) => d.x >= 0 && d.y >= 0 && d.x < map.width && d.y < map.height && !pass(d.x, d.y));
      gap = { ...c, ...(donor ? { donor } : {}) };
      break;
    }
    let gaps = gap ? [gap] : [];
    if (!gaps.length) {
      // 한 칸 틈이 없으면(넓게 트인 자리에 문만 세웠다) 문을 지나는 벽 줄을 세운다 — 문 통로와 수직인 줄에서 문 양옆으로 이어진 통행 칸.
      const along = a.x === b.x ? [[1, 0], [-1, 0]] as const : [[0, 1], [0, -1]] as const;
      const line: { x: number; y: number }[] = [];
      for (const [dx, dy] of along) {
        for (let k = 1; k < 12; k += 1) {
          const x = door.x + dx * k, y = door.y + dy * k;
          if (x < 0 || y < 0 || x >= map.width || y >= map.height || !pass(x, y)) break;
          line.push({ x, y });
        }
      }
      const trial = new Set([...blocked, ...line.map((c) => `${c.x},${c.y}`)]);
      const closed = reachFrom(project, map, trial);
      const withDoor = reachFrom(project, map, new Set([...trial].filter((k) => k !== doorKey)), doorKey);
      if (line.length && line.length <= 8 && closed && !closed.has(`${behind.x},${behind.y}`) && withDoor && withDoor.size >= openCount - line.length) {
        gaps = line.map((c) => {
          const donor = [...along, ...STEPS].map(([dx, dy]) => ({ x: c.x + dx, y: c.y + dy })).find((d) => d.x >= 0 && d.y >= 0 && d.x < map.width && d.y < map.height && !pass(d.x, d.y) && !line.some((l) => l.x === d.x && l.y === d.y));
          return { ...c, ...(donor ? { donor } : {}) };
        });
      }
    }
    if (!gaps.length) { warnings.push("문 너머로 돌아가는 길에서 막아도 방이 문에서 끊기지 않는 틈·벽 줄을 못 찾았다(넓게 트였다) — 방 벽을 다시 짓거나 문 자리를 옮긴다"); break; }
    for (const gap of gaps) {
      const donor = gap.donor ?? gaps.find((g) => g.donor)?.donor;
      if (donor) {
        const own = ownMap(run, mapId)!;
        const from = donor.y * own.width + donor.x, to = gap.y * own.width + gap.x;
        for (const layer of [1, 2, 3, 4] as const) setLayerTileAt(own, layer, to, layerTileAt(own, layer, from));
        setShadowAt(own, to, shadowAt(own, from));
      }
      if (!donor || isPassable(run.ctx.project, run.ctx.project.maps[mapId]!, gap.x, gap.y)) {
        // 옆에 벽이 없거나 옮긴 타일이 통행으로 읽히면 보이지 않는 막이 이벤트로 막는다.
        run.call("upsert_event", { mapId, event: { id: `ev_chain_seal_${gap.x}_${gap.y}`, name: "막힌 틈", x: gap.x, y: gap.y, pages: [{ trigger: { kind: "action" }, priority: "same", graphic: {}, conditions: [], commands: [] }] } });
        sealed.push(`(${gap.x},${gap.y}) 막이`);
      } else sealed.push(`(${gap.x},${gap.y}) 벽`);
    }
  }
  const still = (() => {
    const project = run.ctx.project, map = project.maps[mapId]!;
    const blocked = new Set<string>([`${door.x},${door.y}`, ...(map.events ?? []).filter((ev) => ev.id.startsWith("ev_chain_seal_") || (ev.pages ?? []).some((p) => TOUCH.has(trig(p as unknown as Obj)))).map((ev) => `${ev.x},${ev.y}`)]);
    const parent = reachFrom(project, map, blocked);
    if (!parent) return false;
    const pass = (x: number, y: number) => isPassable(project, map, x, y);
    return ([[[0, -1], [0, 1]], [[-1, 0], [1, 0]]] as const).some(([p, q]) => pass(door.x + p[0], door.y + p[1]) && pass(door.x + q[0], door.y + q[1]) && parent.has(`${door.x + p[0]},${door.y + p[1]}`) && parent.has(`${door.x + q[0]},${door.y + q[1]}`));
  })();
  const ok = !still;
  return { ok, mapIds: [mapId], summary: sealed.length ? `잠긴 문 ${eventId} 너머로 가는 다른 길 ${sealed.length}군데를 막았다: ${sealed.join(", ")}${ok ? " — 이제 문으로만 들어간다" : " — 아직 다른 길이 남았다"}` : ok ? `잠긴 문 ${eventId} 너머는 문으로만 들어간다(막을 틈 없음)` : `잠긴 문 ${eventId} 너머로 가는 다른 길을 찾았지만 막을 칸을 못 정했다`, warnings, missingArt: [], calls: [] };
}

/** 사슬 한 번에 짓기. 앞 고리가 만든 것(learn·reward.flag·reward.item)만 뒤 고리의 needs 가 될 수 있다. */
/** 누구나 먼저 쳐 보는 번호(2026-10-25 판정 J63: 1024·1234·0000 금고). 3자리 이상만 본다. */
const COMMON_CODES = new Set(["1024", "2048", "1004", "2580", "1212", "1122", "6969", "1357", "2468", "0123", "9876"]);
/** 맞혔을 때만 할 말(문이 열렸다·풀렸다) — 번호 입력 앞에 두면 틀린 번호에도 「열렸다」 뒤 「맞지 않는다」가 나온다. */
const SOLVED_LINE = /열렸|열린다|풀렸|풀린다|열리며|열리고|탈출했|빠져나왔|unlock|opened|clicks open/iu;
const NOT_SOLVED = /않|못|없|아직|안 열|n't|not/iu;
/**
 * 한 명령 목록 안에서 번호 입력(inputNumber) 앞의 「열렸다」 대사를 맞힘 갈래(fork.then) 맨 앞으로 옮긴다.
 * 옮긴 대사 속 다른 번호(3자리 이상)는 정답으로 바꾼다 — 그 줄은 이제 정답을 친 뒤에만 나온다.
 * 왜(2026-10-29 vm3 flash 방탈출 판정): 「자물쇠에 '4862'를 입력하자 문이 열렸다!」가 입력 앞에 있어, 입력 뒤 「철컥… 맞지 않는다」와 모순됐다.
 */
function settleSolvedLines(list: unknown): number {
  if (!Array.isArray(list)) return 0;
  let moved = 0;
  for (let i = 0; i < list.length; i += 1) {
    const input = list[i] as Obj | undefined;
    if (input?.kind !== "inputNumber") continue;
    const fork = list[i + 1] as Obj | undefined;
    const cond = fork?.condition as Obj | undefined;
    if (fork?.kind !== "fork" || cond?.kind !== "variable" || cond.variableId !== input.variableId || !Array.isArray(fork.then)) continue;
    const code = String(cond.value);
    for (let j = i - 1; j >= 0; j -= 1) {
      const cmd = list[j] as Obj | undefined;
      if (cmd?.kind !== "text") break;
      const body = String(cmd.body ?? "");
      if (!SOLVED_LINE.test(body) || NOT_SOLVED.test(body)) continue;
      list.splice(j, 1);
      i -= 1;
      (fork.then as Obj[]).unshift({ ...cmd, body: body.replace(/\d{3,8}/gu, (n) => (n === code ? n : code)) });
      moved += 1;
    }
  }
  for (const value of list) if (value && typeof value === "object") for (const inner of Object.values(value as Obj)) if (Array.isArray(inner)) moved += settleSolvedLines(inner);
  return moved;
}
/** 게임 전체에 settleSolvedLines — 끝맺음이 이미 지은 자물쇠를 고친다. 고친 이벤트 목록. */
export function settleCodeSolvedLines(project: Project): string[] {
  const notes: string[] = [];
  for (const map of Object.values(project.maps)) for (const ev of map.events ?? []) {
    let n = 0;
    for (const page of ev.pages ?? []) n += settleSolvedLines((page as unknown as Obj).commands);
    if (n) notes.push(`자물쇠 「열렸다」 대사를 맞힘 뒤로: ${map.name ?? map.id} ${ev.name ?? ev.id}`);
  }
  return notes;
}

export function trivialCode(code: string): boolean {
  if (!/^\d{3,}$/u.test(code)) return false;
  if (COMMON_CODES.has(code)) return true;
  const d = [...code].map(Number);
  if (d.every((x) => x === d[0])) return true;
  const steps = d.slice(1).map((x, i) => x - d[i]!);
  return steps.every((s) => s === 1) || steps.every((s) => s === -1);
}

/**
 * 고르기 자물쇠의 보기 순서(J63: 정답이 늘 첫 보기라 첫 칸만 누르면 풀렸다). 보이는 다섯 칸 안에 정답을 반드시 넣고,
 * 이름에서 나온 고정 해시로 정답 자리를 첫 칸이 아닌 곳에 둔다 — 같은 입력은 늘 같은 순서(재현).
 */
export function shuffledOptions(options: readonly string[], answer: string, seed: string): string[] {
  const others = [...new Set(options.filter((o) => o !== answer))].slice(0, 4);
  if (!others.length) return [answer];
  let h = 7;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) | 0;
  h = Math.abs(h);
  const rotated = others.map((_, i) => others[(i + h) % others.length]!);
  const at = 1 + (h % others.length);
  return [...rotated.slice(0, at), answer, ...rotated.slice(at)];
}

export function buildPuzzleChain(run: BuildRun, args: ChainArgs): ContentBuildResult {
  const warnings: string[] = [];
  const eventIds: { mapId: string; eventId: string }[] = [];
  const fail = (summary: string): ContentBuildResult => ({ ok: false, mapIds: [args.mapId], summary, warnings, missingArt: [], calls: [] });
  if (!args.links?.length) return fail("links 가 비었다 — 단서·자물쇠·문을 순서대로 준다");
  const chainKey = slug(args.name || "chain");
  const have = new Map<string, { kind: "flag"; switchId: string } | { kind: "item"; itemId: string }>();
  const itemId = (name: string): string => {
    const db = run.ctx.project.database.items ?? [];
    const found = db.find((it) => it.id === name || it.name === name);
    if (found) return found.id;
    const id = `item_${chainKey}_${slug(name)}`;
    const res = run.call("upsert_item", { item: { id, name, description: `${args.name} — 열쇠·단서 물건`, price: 0, consumable: false } });
    if (!res.ok) warnings.push(`물건 ${name} 을 만들지 못했다: ${String(res.summary).slice(0, 120)}`);
    return id;
  };
  const flag = (name: string, description: string): string => {
    const switchId = `sw_${chainKey}_${slug(name)}`;
    run.call("declare_story_flag", { action: "declare", id: `${chainKey}-${slug(name)}`.replace(/_/gu, "-"), kind: "switch", targetId: switchId, description });
    return switchId;
  };
  const condFor = (need: string | undefined): Obj[] | string => {
    if (!need) return [];
    const got = have.get(need);
    if (!got) {
      // 사슬 밖에서 이미 있는 물건이면 그대로 쓴다.
      const item = (run.ctx.project.database.items ?? []).find((it) => it.id === need || it.name === need);
      if (item) return [{ kind: "item", itemId: item.id, present: true }];
      return `needs 「${need}」 를 앞 고리가 만들지 않았다(learn·reward 이름을 그대로 쓴다)`;
    }
    return got.kind === "flag" ? [{ kind: "switch", switchId: got.switchId, value: true }] : [{ kind: "item", itemId: got.itemId, present: true }];
  };
  /** 번호·고르기 시도 명령 — 맞으면 onSolve, 틀리면 wrongLines. 틀린 인자면 실패 문장. */
  const codeAttempt = (link: ChainLink, index: number, onSolve: () => Obj[]): Obj[] | string => {
    const code = link.code!;
    const leaked = [...(link.lockedLines ?? []), ...(link.wrongLines ?? []), ...(link.doneLines ?? [])].find((l) => l.includes(code));
    if (leaked) return `${index + 1}번 고리(${link.role}): 자물쇠 대사에 답 ${code} 이 들어 있다 — 답은 단서 고리의 lines 에만 둔다`;
    if (link.options?.length) {
      if (!link.options.includes(code)) return `${index + 1}번 고리(${link.role}): options 에 정답 ${code} 이 없다`;
      return [{ kind: "choices", cancelBehavior: "branch", cancelBranch: [], options: shuffledOptions(link.options, code, `${chainKey}:${index}`).map((text) => ({ text, branch: text === code ? onSolve() : say(link.wrongLines ?? ["…아무 일도 일어나지 않는다."]) })) }];
    }
    if (!/^\d{1,8}$/u.test(code)) return `${index + 1}번 고리(${link.role}): 숫자 자물쇠의 code 는 1~8자리 숫자 — 글자 답이면 options 로 고르게 한다`;
    if (trivialCode(code)) return `${index + 1}번 고리(${link.role}): 정답 ${code} 은 아무나 먼저 쳐 보는 번호다(같은 숫자·차례 숫자·1024 같은 흔한 번호) — 단서에서만 알 수 있는 번호(날짜·시계 바늘·책 쪽수를 이은 것)로 바꾼다`;
    const variableId = `var_${chainKey}_${index + 1}`;
    run.call("declare_story_flag", { action: "declare", id: `${chainKey}-code-${index + 1}`, kind: "variable", targetId: variableId, description: `${args.name}: 입력한 번호` });
    return [{ kind: "inputNumber", variableId, digits: code.length },
      { kind: "fork", condition: { kind: "variable", variableId, op: "==", value: Number(code) }, then: onSolve(), else: say(link.wrongLines ?? ["철컥… 맞지 않는다."]) }];
  };
  const doors: { mapId: string; eventId: string }[] = [];
  const personNotes: string[] = [];
  for (const [index, link] of args.links.entries()) {
    const mapId = link.mapId ?? args.mapId;
    const map = run.ctx.project.maps[mapId];
    if (!map) return fail(`${index + 1}번 고리: 맵 ${mapId} 이 없다`);
    const existing = map.events.find((ev) => ev.id === link.eventId) ?? (link.name ? map.events.find((ev) => ev.name === link.name) : undefined)
      ?? (link.at ? map.events.find((ev) => ev.x === link.at!.x && ev.y === link.at!.y) : undefined);
    if (!existing && !link.at) return fail(`${index + 1}번 고리(${link.role}): 이벤트 ${link.eventId ?? link.name ?? ""} 를 못 찾았다 — eventId 를 주거나 새로 둘 칸 at:{x,y} 를 준다`);
    // 새 고리 id 는 게임 어디의 이벤트와도 겹치지 않게 — 다시 지을 때 «ev_chain_<이름>_1» 이 이미 있는 다른 고리(그대로 둔 단계)를 덮어썼다
    // (2026-10-29 mt3 flash 방탈출 재빌드: 덧붙인 단서 고리가 「조사 시작」을 지웠다).
    const usedIds = new Set(Object.values(run.ctx.project.maps).flatMap((m) => (m.events ?? []).map((ev) => ev.id)));
    const claimed = new Set(eventIds.map((e) => e.eventId));
    let id = existing?.id ?? `ev_chain_${chainKey}_${index + 1}`;
    for (let n = index + 2; !existing && (usedIds.has(id) || claimed.has(id)); n += 1) id = `ev_chain_${chainKey}_${n}`;
    const look = existing ? structuredClone((existing.pages?.[0] as unknown as Obj | undefined) ?? {}) : {};
    // 그림 없는(투명) 조사 칸은 다가가면 반짝인다 — 새 플레이어가 어디를 조사할지 보이게(2026-10-28 청사진 경로).
    // 「transparent:true」만 있는 그림도 그림 없음이다(sprite·tileId 가 없으면).
    const lookGraphic = (look.graphic as Obj | undefined) ?? {};
    let invisible = !existing || lookGraphic.transparent === true || (!lookGraphic.sprite && !lookGraphic.appearanceId && !(typeof lookGraphic.tileId === "number" && lookGraphic.tileId > 0));
    // 이름이 사람(직함·호칭)이면 반짝이 칸 대신 공용 캐릭터 칩을 붙인다(2026-10-28 standin joseon 「주모」「포졸」「종사관」).
    const personName = link.name ?? (existing as { name?: string } | undefined)?.name;
    if (invisible && isPersonName(personName)) {
      const person = personGraphicFor(run.ctx.project, map, personName!);
      if (person) { look.graphic = person.graphic; invisible = false; personNotes.push(`${personName} → 「${person.label}」`); }
    }
    const basePage = (extra: Obj): Obj => ({ trigger: look.trigger ?? { kind: "action" }, priority: look.priority ?? "same", graphic: look.graphic ?? {}, ...(look.movement ? { movement: look.movement } : {}), ...(look.animationType ? { animationType: look.animationType } : {}), ...(invisible ? { nearSparkle: { radius: 2 } } : (look.nearSparkle ? { nearSparkle: look.nearSparkle } : {})), conditions: [], ...extra });
    const need = link.needsCondition?.length ? link.needsCondition.map((c) => ({ ...c })) : condFor(link.needs);
    if (typeof need === "string") return fail(`${index + 1}번 고리: ${need}`);
    const pages: Obj[] = [];
    const rewardCmds = (): Obj[] => {
      const out: Obj[] = [...say(link.reward?.lines)];
      if (link.reward?.item) { const it = itemId(link.reward.item); have.set(link.reward.item, { kind: "item", itemId: it }); out.push({ kind: "changeItem", itemId: it, op: "+=", amount: 1 }); if (!link.reward.lines?.length) out.push({ kind: "text", body: `『${link.reward.item}』을(를) 얻었다.` }); }
      if (link.reward?.flag) { const sw = flag(link.reward.flag, `${args.name}: ${link.reward.flag}`); have.set(link.reward.flag, { kind: "flag", switchId: sw }); out.push({ kind: "setSwitch", switchId: sw, value: true }); }
      return out;
    };
    if (link.role === "clue") {
      if (!link.learn) return fail(`${index + 1}번 고리(clue): learn(알게 되는 것의 이름)이 없다`);
      const sw = flag(link.learn, `${args.name}: 단서 「${link.learn}」 를 읽음`);
      if (need.length) pages.push(basePage({ commands: say(link.lockedLines ?? ["아직 무엇인지 알 수 없다."]) }));
      pages.push(basePage({ conditions: need, commands: [...say(link.lines), { kind: "setSwitch", switchId: sw, value: true }] }));
      have.set(link.learn, { kind: "flag", switchId: sw });
    } else if (link.role === "code") {
      if (!link.code) return fail(`${index + 1}번 고리(code): code(정답)가 없다`);
      if (!link.needs && !link.needsCondition?.length) warnings.push(`${index + 1}번 고리(code): needs 가 없어 단서 없이 답을 맞힐 수 있다 — 단서 고리의 learn 이름을 needs 로 준다`);
      const solved = flag(`${slug(link.code)}_solved_${index + 1}`, `${args.name}: 자물쇠 풀림`);
      const attempt = codeAttempt(link, index, () => [...rewardCmds(), { kind: "setSwitch", switchId: solved, value: true }]);
      if (typeof attempt === "string") return fail(attempt);
      pages.push(basePage({ commands: say(link.lockedLines ?? ["자물쇠가 걸려 있다. 무엇을 맞춰야 하는지 아직 모르겠다."]) }));
      pages.push(basePage({ conditions: need, commands: [...say(link.lines), ...attempt] }));
      pages.push(basePage({ conditions: [{ kind: "switch", switchId: solved, value: true }], commands: say(link.doneLines ?? ["이미 열려 있다."]) }));
    } else if (link.role === "pickup") {
      if (!link.reward?.item && !link.reward?.flag) return fail(`${index + 1}번 고리(pickup): reward.item 또는 reward.flag 가 없다`);
      const taken = flag(`taken_${index + 1}`, `${args.name}: 집어 감`);
      if (need.length) pages.push(basePage({ commands: say(link.lockedLines ?? ["지금은 손댈 수 없다."]) }));
      pages.push(basePage({ conditions: need, commands: [...say(link.lines), ...rewardCmds(), { kind: "setSwitch", switchId: taken, value: true }] }));
      pages.push(basePage({ conditions: [{ kind: "switch", switchId: taken, value: true }], commands: say(link.doneLines ?? ["비어 있다."]) }));
    } else if (link.role === "door") {
      if (!need.length) return fail(`${index + 1}번 고리(door): needs(열쇠 물건 이름 또는 깃발)가 없다`);
      const opened = flag(`door_open_${index + 1}`, `${args.name}: 문 열림`);
      const transfer = existing ? JSON.stringify(existing.pages ?? []).match(/\{[^{}]*"kind":"transfer"[^{}]*\}/u)?.[0] : undefined;
      const go = transfer ? [JSON.parse(transfer) as Obj] : [];
      pages.push(basePage({ priority: "same", commands: say(link.lockedLines ?? ["굳게 잠겨 있다."]) }));
      pages.push(basePage({ priority: "same", conditions: need, commands: [...say(link.lines ?? ["열쇠를 넣고 돌리자 문이 열렸다."]), ...rewardCmds(), { kind: "setSwitch", switchId: opened, value: true }, ...go] }));
      pages.push(basePage({ priority: go.length ? "below" : "below", trigger: go.length ? { kind: "playerTouch" } : (look.trigger ?? { kind: "action" }), graphic: go.length ? look.graphic ?? {} : {}, conditions: [{ kind: "switch", switchId: opened, value: true }], commands: go.length ? go : say(link.doneLines ?? []) }));
      doors.push({ mapId, eventId: id });
    } else if (link.role === "ending") {
      if (!link.endingId) return fail(`${index + 1}번 고리(ending): endingId 가 없다`);
      if (need.length) pages.push(basePage({ commands: say(link.lockedLines ?? ["아직 할 수 없다."]) }));
      // code 가 있으면 번호를 맞혀야 엔딩(2026-10-28 mt3 flash 방탈출: 「비밀번호 입력」 단계가 조사만으로 엔딩을 불렀다).
      const attempt = link.code ? codeAttempt(link, index, () => [...say(link.reward?.lines), { kind: "triggerEnding", endingId: link.endingId }]) : [{ kind: "triggerEnding", endingId: link.endingId }];
      if (typeof attempt === "string") return fail(attempt);
      pages.push(basePage({ conditions: need, commands: [...say(link.lines), ...attempt] }));
    }
    for (const page of pages) settleSolvedLines(page.commands);
    const res = run.call("upsert_event", { mapId, replacePages: true, event: { id, ...(existing ? {} : { name: link.name ?? `${args.name} ${index + 1}`, x: link.at!.x, y: link.at!.y }), pages } });
    if (!res.ok) return fail(`${index + 1}번 고리 이벤트를 쓰지 못했다: ${String(res.summary).slice(0, 300)}`);
    eventIds.push({ mapId, eventId: id });
  }
  // 걸어 가서 말을 걸 수 있는 자리인가(2026-10-28 mt2 deepseek: 모델이 준 칸의 쪽지가 한 칸 통로를 막아 자물쇠에 못 갔다).
  // 막힌 고리·길목을 막는 고리는 가까운 닿는 칸으로 옮기고, 문 이름 고리는 그림 문 칸에 붙인다. 문 막기(seal) 전에 한다.
  const reachNotes: string[] = [];
  for (const mapId of [...new Set(eventIds.map((e) => e.mapId))]) {
    // 막다른 남쪽 출구는 메우고 문 고리를 북벽 문 그림으로(exitDress) — 자리 고치기 전에 해야 문이 그 그림 칸에 붙는다.
    const exits = dressInteriorExits(run, mapId);
    if (exits.notes.length) reachNotes.push(`출구 마감: ${exits.notes.join(" / ")}`);
    const fixed = repairEventReach(run, mapId, eventIds.filter((e) => e.mapId === mapId).map((e) => e.eventId));
    if (fixed.moved.length) reachNotes.push(`닿게 옮김: ${fixed.moved.join(", ")}`);
    for (const s of fixed.stuck) warnings.push(`걸어 가서 조사할 자리를 못 찾았다: ${s}`);
  }
  // 자리는 위 repairEventReach 가 정한다(정본). 여기서는 그 자리에서 조사할 물건이 그림으로 보이게만 한다(일기장·편지 → 바로 옆 책상 윗면 탁상 물건)
  // — 이벤트를 옮기지 않는다. 칩 그림 사물(문·상자)은 조사할 때 돌아서지 않게.
  // 그림 없는 조사 칸이 빈 바닥에 서서 보이지 않는 벽이 되면 옆 가구로 붙이거나·소품을 세우거나·발밑으로 내린다(examineSpot, 2026-10-29 flash).
  for (const [i, e] of eventIds.entries()) {
    fixObjectSheetFacing(run, e.mapId, e.eventId);
    const link = args.links[i];
    const settled = link?.role === "door" ? [] : settleExamineSpot(run, e.mapId, e.eventId, examineHint(link?.role, [link?.reward?.item]));
    if (settled.length) { reachNotes.push(`조사 칸: ${settled.join(", ")}`); continue; }
    const shown = showExaminedThing(run, e.mapId, e.eventId);
    if (shown) warnings.push(shown);
  }
  // 답이 단서에 실제로 적혀 있는가.
  for (const link of args.links) if ((link.role === "code" || link.role === "ending") && link.code && !args.links.some((l) => l !== link && (l.lines ?? []).some((line) => line.includes(link.code!)))) warnings.push(`정답 ${link.code} 이 어느 단서 lines 에도 없다 — 플레이어가 답을 알 길이 없다`);
  const seals = doors.filter((d) => args.links.find((l) => (l.eventId ?? "") === d.eventId)?.seal !== false).map((d) => sealLockedRoom(run, d.mapId, d.eventId));
  for (const s of seals) if (!s.ok) warnings.push(s.summary);
  const sealNote = `${reachNotes.length ? ` ${reachNotes.join(" / ")}.` : ""}${seals.length ? ` ${seals.map((s) => s.summary).join(" / ")}` : ""}`;
  return { ok: true, mapIds: [...new Set(eventIds.map((e) => e.mapId))], eventIds, summary: `퍼즐 사슬 「${args.name}」 ${args.links.length}고리를 지었다(${args.links.map((l) => l.role).join(" → ")}).${personNotes.length ? ` 사람 그림: ${personNotes.join(", ")}.` : ""}${sealNote}`, warnings, missingArt: [], calls: [] };
}
