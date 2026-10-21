/**
 * 『폴른 스타』 왕도 아스텔의 집 안(2026-10-21 사용자 「마을 집에 들어갈 수 없다」).
 *
 * 마을 블록의 집 문(버들항 「집 문」 칸) 가운데 플레이어가 들어가 볼 곳을 손 도트 실내 v5(build_hand_interior_room)로 짓고
 * 부딪힘 문(create_transfer_pair doorAt)으로 잇는다. 여관(숙박)·약방(사고팔기)·집 셋(이야기 대사 — 떨어진 별·심문관 발렌·
 * 천문대·이리스). 나머지 문은 가짜 문이 되지 않게 「잠겨 있다」 한 줄을 단다.
 */
import { runTool } from "@/editor/tools/toolRunner";
import type { GameMap, Project } from "@/project/types";

type Cell = { x: number; y: number };
type Run = { ok: boolean; summary?: string; issues?: unknown; data?: unknown };

const DOOR_LABEL = "버들항 · 집 문";

type Home = {
  readonly door: Cell;
  readonly mapId: string;
  readonly name: string;
  readonly program: string;
  readonly style: "A" | "B" | "C" | "D";
  readonly bgm: string;
  readonly extra?: readonly (readonly [string, number, number])[];
  readonly people: readonly {
    readonly id: string; readonly name: string; readonly query: string;
    readonly lines: readonly string[]; readonly after: readonly string[];
    readonly commands?: readonly Record<string, unknown>[];
  }[];
};

function run(project: Project, name: string, args: Record<string, unknown>): Run {
  const ctx = { project, assistantRun: false };
  const res = runTool(ctx, name, args, { dryRun: false }) as Run;
  if (!res.ok) throw new Error(`[fallen-town-interiors] ${name} failed: ${res.summary} ${JSON.stringify(res.issues ?? [])}`);
  Object.assign(project, ctx.project);
  return res;
}

function isDoor(project: Project, map: GameMap, c: Cell): boolean {
  const meta = (project.tilesets[map.tilesetId] as unknown as { tileMeta?: ({ label?: string } | null)[] }).tileMeta ?? [];
  const i = c.y * map.width + c.x;
  return [map.upperTiles[i], map.lowerTiles[i]].some((t) => t !== undefined && t >= 0 && meta[t]?.label === DOOR_LABEL);
}

/** 집 문 칸 전부(문 앞 칸이 걸을 수 있는 것). */
function townDoors(project: Project, map: GameMap): Cell[] {
  const out: Cell[] = [];
  for (let y = 0; y < map.height - 1; y += 1) for (let x = 0; x < map.width; x += 1) if (isDoor(project, map, { x, y })) out.push({ x, y });
  return out;
}

export function buildFallenTownInteriors(project: Project, hubId: string, ids: { irisJoined: string; valenMarched: string }): { built: string[]; locked: Cell[] } {
  const hub = project.maps[hubId]!;
  const after = (switchId: string) => [{ kind: "switch", switchId, value: true }];
  const shopItems = (project.database.items ?? []).filter((i) => (i.price ?? 0) > 0 && i.type === "medicine").slice(0, 4).map((i) => i.id);
  const homes: Home[] = [
    {
      door: { x: 50, y: 31 }, mapId: "fs_inn", name: "아스텔 · 별빛 여관", program: "tavern", style: "A", bgm: "cc0-bgm-rtp-rst-001",
      extra: [["roundtable", 4, 10], ["chair E", 3, 10], ["chair W", 5, 10], ["roundtable", 7, 12], ["chair E", 6, 12], ["chair W", 8, 12], ["keg rack", 2, 8]],
      people: [
        {
          id: "ev_fs_inn_keeper", name: "여관 주인 마르타", query: "젊은 여성",
          lines: ["어서 와요, 카엘. 어젯밤 별똥별 봤어요? 손님들이 밤새 창가에 붙어 있었다니까.", "하룻밤 30골드. 푹 쉬고 가요."],
          after: ["그 아이… 이리스라고 했죠? 방은 넉넉해요. 교단 사람들 눈에 안 띄게 안쪽 방을 써요.", "하룻밤 30골드. 푹 쉬고 가요."],
          commands: [{ kind: "inn", price: 30 }],
        },
        {
          id: "ev_fs_inn_bard", name: "떠돌이 악사", query: "젊은 남성",
          lines: ["별이 떨어진 밤의 노래를 짓는 중이오. 「동쪽 숲에 은빛 알이 내려앉았네」… 운이 안 맞는군."],
          after: ["은빛 머리 아가씨라… 노래 속 별의 딸 같구려. 걱정 마시오, 교단 앞에선 이 노래 안 부르리다."],
        },
        {
          id: "ev_fs_inn_guest", name: "길손", query: "중년 남성 주민",
          lines: ["동쪽 숲 위로 빛기둥이 솟는 걸 봤소. 새벽부터 교단 기사들이 성문을 지키더군."],
          after: ["심문관 발렌이 숲으로 갔다지. 별에서 떨어진 걸 찾는 거라고들 하던데… 찾으면 어쩔 셈인지."],
        },
      ],
    },
    {
      door: { x: 31, y: 31 }, mapId: "fs_apothecary", name: "아스텔 · 약방", program: "pharmacy", style: "A", bgm: "cc0-bgm-rtp-cln-001",
      people: [
        {
          id: "ev_fs_apothecary", name: "약재상 오든", query: "노인 남성",
          lines: ["회복약이랑 약초는 여기서 사고팔지. 숲에 간다고? 요즘 늑대가 유난히 사나워."],
          after: ["심문관이 약방까지 와서 「하늘에서 떨어진 것」을 본 사람 없냐고 묻고 갔어. 난 아무것도 못 봤다고 했지."],
          commands: [{ kind: "shop", shopType: "normal", itemIds: shopItems, allowSell: true }],
        },
      ],
    },
    {
      door: { x: 13, y: 11 }, mapId: "fs_bakery_home", name: "아스텔 · 빵집 뒤채", program: "bakery", style: "C", bgm: "cc0-bgm-rtp-caf-001",
      people: [
        {
          id: "ev_fs_baker_husband", name: "빵집 아저씨 토마", query: "중년 남성 주민",
          lines: ["아내는 광장에 나가 있어요. 별이 떨어진 밤엔 반죽이 안 부푼다던데… 미신이겠죠.", "그래도 오늘 새벽 반죽은 정말 안 부풀었어요."],
          after: ["기계 아가씨가 빵을 먹나요? …먹는 흉내라도 낸다면 하나 싸 줄게요."],
        },
      ],
    },
    {
      door: { x: 4, y: 20 }, mapId: "fs_stargazer_home", name: "아스텔 · 늙은 별지기의 집", program: "scholar", style: "D", bgm: "cc0-bgm-rtp-mys-002",
      people: [
        {
          id: "ev_fs_old_stargazer", name: "늙은 별지기 오스본", query: "노인 남성",
          lines: ["나도 젊을 땐 저 천문대에서 별을 셌지. 하넬 녀석이 내 자리를 물려받았고.", "어젯밤 그 별은 궤도가 이상했어. 떨어진 게 아니라… 내려앉은 것처럼 보였지."],
          after: ["하늘을 건너는 배라… 하넬이 평생 찾던 답이 그 아이 안에 있겠구먼.", "교단은 하늘을 두려워해. 두려운 건 덮으려 들지. 조심하게, 카엘."],
        },
      ],
    },
    {
      door: { x: 32, y: 20 }, mapId: "fs_lisa_home", name: "아스텔 · 리사네 집", program: "manor_1f", style: "A", bgm: "cc0-bgm-rtp-emo-002",
      people: [
        {
          id: "ev_fs_lisa", name: "리사", query: "젊은 여성",
          lines: ["심문관 발렌이 왔다면서요. 교단은 그 별을 「불경한 하늘의 물건」이라 부른대요.", "우리 애가 밤새 창밖만 보더라고요. 별이 노래를 부른다나요."],
          after: ["그 은빛 머리 아가씨, 숨기는 게 좋을 거예요. 심문관은 한 번 본 얼굴은 잊지 않는대요."],
        },
      ],
    },
  ];

  const doors = townDoors(project, hub);
  const built: string[] = [];
  for (const home of homes) {
    if (!doors.some((d) => d.x === home.door.x && d.y === home.door.y)) throw new Error(`[fallen-town-interiors] 집 문이 아니다: ${home.name} (${home.door.x},${home.door.y})`);
    const room = run(project, "build_hand_interior_room", { mapId: home.mapId, name: home.name, layout: { program: home.program, seed: home.door.x * 31 + home.door.y, styleVariant: home.style } });
    const exitsRaw = (room.data as { exits?: { x: number; y: number; width?: number }[] } | undefined)?.exits ?? [];
    const exit = exitsRaw[0];
    if (!exit) throw new Error(`[fallen-town-interiors] ${home.name}: 실내 출구가 없다`);
    const exitCell = { x: exit.x + Math.floor(((exit.width ?? 1) - 1) / 2), y: exit.y };
    run(project, "create_transfer_pair", {
      a: { mapId: hubId, x: home.door.x, y: home.door.y + 1, doorAt: home.door },
      b: { mapId: home.mapId, x: exitCell.x, y: exitCell.y },
    });
    // 문 짝 다듬기(game-scene-polish 2-1·2-3) — 바깥 트리거는 문 그림 칸 위 부딪힘 문, 들어가면 문을 등지고(위) 서고,
    // 나오면 문 바로 앞 칸에 문을 등지고(아래) 선다.
    const front = { x: home.door.x, y: home.door.y + 1 };
    const goesTo = (target: string) => (e: { pages?: unknown }) => JSON.stringify(e).includes(`"mapId":"${target}"`);
    const outer = project.maps[hubId]!.events.find((e) => String(e.id).startsWith("ev_gate_") && goesTo(home.mapId)(e));
    if (!outer) throw new Error(`[fallen-town-interiors] ${home.name}: 바깥 문 이벤트가 없다`);
    outer.x = home.door.x; outer.y = home.door.y;
    for (const page of outer.pages ?? []) {
      page.priority = "same"; (page as { overlapForbidden?: boolean }).overlapForbidden = true;
      for (const cmd of page.commands ?? []) if ((cmd as { kind?: string }).kind === "transfer") (cmd as { direction?: string }).direction = "up";
    }
    for (const e of project.maps[home.mapId]!.events) if (goesTo(hubId)(e)) for (const page of e.pages ?? []) for (const cmd of page.commands ?? []) {
      const t = cmd as { kind?: string; x?: number; y?: number; direction?: string };
      if (t.kind === "transfer") { t.x = front.x; t.y = front.y; t.direction = "down"; }
    }
    run(project, "set_map_properties", { mapId: home.mapId, bgm: { mode: "custom", resourceId: home.bgm } });
    // 선술집 홀 북서쪽이 맨 마루로 비었다(VQA r3) — 원탁과 의자 두 벌을 더 놓는다(놓일 수 없으면 건너뛴다).
    for (const [kit, x, y] of home.extra ?? []) {
      const ctx = { project, assistantRun: false };
      try {
        const res = runTool(ctx, "stamp_object", { objectId: `kit:atlas_biome_interior/hand-interior:${kit}`, mapId: home.mapId, x, y }, { dryRun: false }) as Run;
        if (res.ok) Object.assign(project, ctx.project);
      } catch { /* 장식 — 못 놓으면 건너뛴다 */ }
    }
    const interior = project.maps[home.mapId]!;
    // 사람은 출구에서 걸어 닿는 방 안쪽 빈 칸에 — 출구·서로 3칸 이상 떨어지게.
    const taken: Cell[] = [exitCell];
    for (const [k, person] of home.people.entries()) {
      const spot = farFreeCell(project, interior, exitCell, taken, k === 0 ? 0.45 : 0.8);
      if (!spot) throw new Error(`[fallen-town-interiors] ${home.name}: ${person.name} 이 설 칸이 없다`);
      taken.push(spot);
      run(project, "place_npc", {
        mapId: home.mapId, x: spot.x, y: spot.y, id: person.id, name: person.name, graphic: { query: person.query },
        pages: [
          { name: `${person.name} · 기본`, lines: person.lines, commands: person.commands ?? [] },
          { name: `${person.name} · 이리스 합류 뒤`, conditions: after(ids.irisJoined), lines: person.after, commands: person.commands ?? [] },
        ],
      });
    }
    built.push(home.mapId);
  }

  // 들어가지 않는 문 — 부딪히면 잠겼다고 말한다(가짜 문 금지).
  const LOCKED = [
    "문이 굳게 잠겨 있다. 안에서는 아무 대답이 없다.",
    "문이 잠겨 있다. 창틈으로 빵 굽는 냄새만 새어 나온다.",
    "문이 잠겨 있다. 「교단 행렬이 지나갈 때까지 문을 열지 마시오」라는 쪽지가 붙어 있다.",
  ];
  const locked: Cell[] = [];
  // 도구를 부를 때마다 맵 객체가 새로 만들어진다 — 앞에서 잡은 hub 가 아니라 지금 맵에 단다.
  const liveHub = project.maps[hubId]!;
  for (const d of doors) {
    if (homes.some((h) => h.door.x === d.x && h.door.y === d.y)) continue;
    if (liveHub.events.some((e) => e.x === d.x && e.y === d.y)) continue;
    const body = LOCKED[(d.x + d.y) % LOCKED.length]!;
    liveHub.events.push({
      id: `ev_fs_locked_${d.x}_${d.y}`, name: "잠긴 문", x: d.x, y: d.y, trigger: { kind: "action" }, commands: [],
      pages: [{
        id: `ev_fs_locked_${d.x}_${d.y}_page`, name: "잠김", conditions: [], graphic: { transparent: true },
        movement: { type: "fixed", speed: 3, frequency: 3 }, priority: "same", trigger: { kind: "action" },
        commands: [{ kind: "text", body, context: "narration", position: "bottom" }],
      }],
    } as unknown as GameMap["events"][number]);
    locked.push(d);
  }
  return { built, locked };
}

/** origin 에서 걸어 닿는 칸 가운데 rank(0 가까움 ~ 1 멂) 자리 — 다른 칸·이벤트와 2칸 넘게 떨어진 곳. */
function farFreeCell(project: Project, map: GameMap, origin: Cell, taken: readonly Cell[], rank: number): Cell | undefined {
  const tileset = project.tilesets[map.tilesetId]!;
  const passable = (x: number, y: number): boolean => {
    if (x < 1 || y < 1 || x >= map.width - 1 || y >= map.height - 1) return false;
    const i = y * map.width + x;
    for (const t of [map.lowerTiles[i], map.lowerOverlayTiles?.[i], map.upperTiles[i], map.upperOverlayTiles?.[i]]) {
      if (t === undefined || t < 0) continue;
      const p = tileset.passability[t];
      if (p && !p.up && !p.down && !p.left && !p.right) return false;
    }
    return true;
  };
  const dist = new Map<string, number>([[`${origin.x},${origin.y}`, 0]]);
  const queue = [origin];
  while (queue.length) {
    const c = queue.shift()!;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const n = { x: c.x + dx, y: c.y + dy }, k = `${n.x},${n.y}`;
      if (dist.has(k) || !passable(n.x, n.y)) continue;
      dist.set(k, dist.get(`${c.x},${c.y}`)! + 1);
      queue.push(n);
    }
  }
  const near = (c: Cell, d: number) => [...taken, ...map.events].some((o) => Math.abs(o.x - c.x) + Math.abs(o.y - c.y) <= d);
  const cells = [...dist.entries()].map(([k, d]) => { const [x, y] = k.split(",").map(Number); return { x: x!, y: y!, d }; })
    .filter((c) => c.d >= 3 && !near(c, 2)
      // 사람 둘레 네 칸 중 셋 이상이 걸을 수 있어야 한다(가구 틈에 끼지 않게).
      && [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => dist.has(`${c.x + dx!},${c.y + dy!}`)).length >= 3)
    .sort((a, b) => a.d - b.d || a.y - b.y || a.x - b.x);
  if (!cells.length) return undefined;
  const c = cells[Math.min(cells.length - 1, Math.round(rank * (cells.length - 1)))]!;
  return { x: c.x, y: c.y };
}
