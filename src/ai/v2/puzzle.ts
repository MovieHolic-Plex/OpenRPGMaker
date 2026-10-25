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

type Obj = Record<string, unknown>;
const STEPS = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;
const TOUCH = new Set(["playerTouch", "touch", "eventTouch"]);
const slug = (s: string): string => (s.normalize("NFKD").replace(/[^A-Za-z0-9]+/gu, "_").replace(/^_|_$/gu, "").toLowerCase() || `k${Math.abs([...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7)).toString(36)}`).slice(0, 24);

export interface ChainLink {
  readonly role: "clue" | "code" | "door" | "pickup";
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
  const doors: { mapId: string; eventId: string }[] = [];
  for (const [index, link] of args.links.entries()) {
    const mapId = link.mapId ?? args.mapId;
    const map = run.ctx.project.maps[mapId];
    if (!map) return fail(`${index + 1}번 고리: 맵 ${mapId} 이 없다`);
    const existing = map.events.find((ev) => ev.id === link.eventId) ?? (link.name ? map.events.find((ev) => ev.name === link.name) : undefined)
      ?? (link.at ? map.events.find((ev) => ev.x === link.at!.x && ev.y === link.at!.y) : undefined);
    if (!existing && !link.at) return fail(`${index + 1}번 고리(${link.role}): 이벤트 ${link.eventId ?? link.name ?? ""} 를 못 찾았다 — eventId 를 주거나 새로 둘 칸 at:{x,y} 를 준다`);
    const id = existing?.id ?? `ev_chain_${chainKey}_${index + 1}`;
    const look = existing ? structuredClone((existing.pages?.[0] as unknown as Obj | undefined) ?? {}) : {};
    const basePage = (extra: Obj): Obj => ({ trigger: look.trigger ?? { kind: "action" }, priority: look.priority ?? "same", graphic: look.graphic ?? {}, ...(look.movement ? { movement: look.movement } : {}), ...(look.animationType ? { animationType: look.animationType } : {}), conditions: [], ...extra });
    const need = condFor(link.needs);
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
      if (!link.needs) warnings.push(`${index + 1}번 고리(code): needs 가 없어 단서 없이 답을 맞힐 수 있다 — 단서 고리의 learn 이름을 needs 로 준다`);
      const solved = flag(`${slug(link.code)}_solved_${index + 1}`, `${args.name}: 자물쇠 풀림`);
      const leaked = [...(link.lockedLines ?? []), ...(link.wrongLines ?? []), ...(link.doneLines ?? [])].find((l) => l.includes(link.code!));
      if (leaked) return fail(`${index + 1}번 고리(code): 자물쇠 대사에 답 ${link.code} 이 들어 있다 — 답은 단서 고리의 lines 에만 둔다`);
      pages.push(basePage({ commands: say(link.lockedLines ?? ["자물쇠가 걸려 있다. 무엇을 맞춰야 하는지 아직 모르겠다."]) }));
      let attempt: Obj[];
      if (link.options?.length) {
        if (!link.options.includes(link.code)) return fail(`${index + 1}번 고리(code): options 에 정답 ${link.code} 이 없다`);
        attempt = [{ kind: "choices", cancelBehavior: "branch", cancelBranch: [], options: link.options.slice(0, 5).map((text) => ({ text, branch: text === link.code ? [...rewardCmds(), { kind: "setSwitch", switchId: solved, value: true }] : say(link.wrongLines ?? ["…아무 일도 일어나지 않는다."]) })) }];
      } else {
        if (!/^\d{1,8}$/u.test(link.code)) return fail(`${index + 1}번 고리(code): 숫자 자물쇠의 code 는 1~8자리 숫자 — 글자 답이면 options 로 고르게 한다`);
        const variableId = `var_${chainKey}_${index + 1}`;
        run.call("declare_story_flag", { action: "declare", id: `${chainKey}-code-${index + 1}`, kind: "variable", targetId: variableId, description: `${args.name}: 입력한 번호` });
        attempt = [{ kind: "inputNumber", variableId, digits: link.code.length },
          { kind: "fork", condition: { kind: "variable", variableId, op: "==", value: Number(link.code) }, then: [...rewardCmds(), { kind: "setSwitch", switchId: solved, value: true }], else: say(link.wrongLines ?? ["철컥… 맞지 않는다."]) }];
      }
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
      pages.push(basePage({ priority: "same", conditions: need, commands: [...say(link.lines ?? ["열쇠를 넣고 돌리자 문이 열렸다."]), { kind: "setSwitch", switchId: opened, value: true }, ...go] }));
      pages.push(basePage({ priority: go.length ? "below" : "below", trigger: go.length ? { kind: "playerTouch" } : (look.trigger ?? { kind: "action" }), graphic: go.length ? look.graphic ?? {} : {}, conditions: [{ kind: "switch", switchId: opened, value: true }], commands: go.length ? go : say(link.doneLines ?? []) }));
      doors.push({ mapId, eventId: id });
    }
    const res = run.call("upsert_event", { mapId, replacePages: true, event: { id, ...(existing ? {} : { name: link.name ?? `${args.name} ${index + 1}`, x: link.at!.x, y: link.at!.y }), pages } });
    if (!res.ok) return fail(`${index + 1}번 고리 이벤트를 쓰지 못했다: ${String(res.summary).slice(0, 300)}`);
    eventIds.push({ mapId, eventId: id });
  }
  // 답이 단서에 실제로 적혀 있는가.
  for (const link of args.links) if (link.role === "code" && link.code && !args.links.some((l) => l.role === "clue" && (l.lines ?? []).some((line) => line.includes(link.code!)))) warnings.push(`정답 ${link.code} 이 어느 단서 lines 에도 없다 — 플레이어가 답을 알 길이 없다`);
  const seals = doors.filter((d) => args.links.find((l) => (l.eventId ?? "") === d.eventId)?.seal !== false).map((d) => sealLockedRoom(run, d.mapId, d.eventId));
  for (const s of seals) if (!s.ok) warnings.push(s.summary);
  const sealNote = seals.length ? ` ${seals.map((s) => s.summary).join(" / ")}` : "";
  return { ok: true, mapIds: [...new Set(eventIds.map((e) => e.mapId))], eventIds, summary: `퍼즐 사슬 「${args.name}」 ${args.links.length}고리를 지었다(${args.links.map((l) => l.role).join(" → ")}).${sealNote}`, warnings, missingArt: [], calls: [] };
}
