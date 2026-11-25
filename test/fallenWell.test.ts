import { describe, expect, it } from "vitest";
import { wellData } from "@/project/flagship/fallen/wellBeast";
import type { Project, EnemyRecord } from "@/project/types";
import { WELL, WELL_SHAFT_LAYOUT } from "@/project/flagship/fallen/wellShaftRooms";
import { isolateTimers } from "./mergedTeardown";

describe("fallenWellBeastHiddenWeakness", () => {
  isolateTimers();
  // 2026-11-10 오너: 「예고는 해야 맞지만, 약점을 보여줄 필요는 없음」.
  // 우물 밑 눈먼 영주의 전투 중 글(끊김 문장·전투 대사)은 무엇을 하는지만 말하고 무엇이 끊는지(번개)는 말하지 않는다.
  // 끊는 규칙(chargeBreak.elementIds)은 그대로다 — 약점이 사라진 게 아니라 글로 알려 주지 않을 뿐이다.

  function build(): Project {
    const project = {
      switches: [], database: { skills: [], states: [], enemies: [], troops: [], equipment: [], actors: [] },
    } as unknown as Project;
    const upsert = <T extends { id: string }>(list: T[], row: T) => {
      const i = list.findIndex((x) => x.id === row.id);
      if (i >= 0) list[i] = row; else list.push(row);
    };
    const exec = (p: Project, name: string, args: Record<string, unknown>) => {
      const db = p.database as unknown as Record<string, { id: string }[]>;
      const table = { upsert_state: "states", upsert_skill: "skills", upsert_enemy: "enemies", upsert_troop: "troops", upsert_equipment: "equipment" }[name];
      if (!table) throw new Error(`unexpected tool ${name}`);
      upsert(db[table]!, Object.values(args)[0] as { id: string });
      return undefined;
    };
    wellData(project, exec);
    return project;
  }
  const ANSWER = /번개|천둥|뇌전|하늘의 불/;
  describe("well boss hides its weakness but keeps the telegraph", () => {
    it("break messages and battle lines never name the answer element", () => {
      const project = build();
      const wellSkills = project.database.skills.filter((s) => s.id.startsWith("skill_fs2_well"));
      const breakers = wellSkills.filter((s) => s.chargeBreak);
      expect(breakers.length).toBeGreaterThanOrEqual(4);
      for (const s of breakers) expect(s.chargeBreak?.message ?? "", s.id).not.toMatch(ANSWER);
      const troop = project.database.troops.find((t) => t.id === "troop_fs2_well_beast") as unknown as { battleEventPages: { commands: { body?: string }[] }[] };
      const lines = troop.battleEventPages.flatMap((p) => p.commands.map((c) => c.body ?? "")).filter(Boolean);
      expect(lines.length).toBeGreaterThan(0);
      for (const line of lines) expect(line).not.toMatch(ANSWER);
    });

    it("keeps the mechanic: thunder still breaks the song and echo, and the boss is still weak to thunder", () => {
      const project = build();
      const skill = (id: string) => project.database.skills.find((s) => s.id === id)!;
      expect(skill("skill_fs2_well_gill_song").chargeBreak?.elementIds).toContain("thunder");
      expect(skill("skill_fs2_well_echo").chargeBreak?.elementIds).toContain("thunder");
      expect(skill("skill_fs2_well_gill_song").chargeTurns).toBe(1);
      expect(project.database.enemies.find((e) => e.id === "enemy_fs2_well_beast")!.elementRates.thunder).toBe("A");
    });
  });
});

describe("fallenWellBeastPierceImmune", () => {
  isolateTimers();
  // 1막은 「다른 적은 관통상에 걸리지 않는다」로 모든 적에 관통상 E 를 건다(act1Finale.ts).
  // 우물 보스의 upsert_enemy 가 stateRates 를 통째로 새로 써서 그 칸이 빠졌고,
  // 돌진 찌르기 뒤 모든 마법이 3배가 되어 피해 숫자가 번개(약점)를 가리키지 못했다.

  function wellEnemy(): EnemyRecord {
    const project = {
      switches: [], database: { skills: [], states: [], enemies: [], troops: [], equipment: [], actors: [] },
    } as unknown as Project;
    const exec = (p: Project, name: string, args: Record<string, unknown>) => {
      const db = p.database as unknown as Record<string, { id: string }[]>;
      const table = { upsert_state: "states", upsert_skill: "skills", upsert_enemy: "enemies", upsert_troop: "troops", upsert_equipment: "equipment" }[name];
      if (!table) throw new Error(`unexpected tool ${name}`);
      const row = Object.values(args)[0] as { id: string };
      const list = db[table]!;
      const i = list.findIndex((x) => x.id === row.id);
      if (i >= 0) list[i] = row; else list.push(row);
      return undefined;
    };
    wellData(project, exec);
    return project.database.enemies.find((e) => e.id === "enemy_fs2_well_beast")!;
  }
  describe("well boss keeps the act-1 pierce-wound immunity", () => {
    it("cannot take the pierce wound, so pierce-then-magic does not triple every spell", () => {
      expect(wellEnemy().stateRates?.state_fs_pierced).toBe("E");
    });
    it("keeps lightning as the weakness and halves dark", () => {
      expect(wellEnemy().elementRates).toMatchObject({ thunder: "A", dark: "D" });
    });
  });
});

describe("fallenWellLift", () => {
  isolateTimers();
  // fs-vqa-obs(2026-11-10): 천문대 서고로 오르는 승강 발판이 우물 사다리 착지 방(landing) 안 4걸음 자리에 있어
  // 갱도 여섯 방을 통째로 건너뛰었다. 발판은 수문 앞방(sluice)에 있고, 착지에서 방·복도만 따라 멀리 떨어져야 한다.
  describe("fallen star well shaft lift placement", () => {
    type Rect = { x: number; y: number; w: number; h: number };
    const layout = WELL_SHAFT_LAYOUT as unknown as {
      map: { w: number; h: number };
      rooms: { id: string; rects: Rect[] }[];
      corridors: { width: number; path: [number, number][] }[];
      hazards: (Rect & { kind: string })[];
      bridges: Rect[];
      objects: { id: string; x: number; y: number }[];
    };
    const inside = (r: Rect, x: number, y: number) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
    const roomOf = (x: number, y: number) => layout.rooms.find((room) => room.rects.some((r) => inside(r, x, y)))?.id;

    it("puts the lift pad in the sluice antechamber, not the entrance room", () => {
      for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) expect(roomOf(WELL.lift.x + dx, WELL.lift.y + dy)).toBe("sluice");
      expect(roomOf(WELL.arrive.x, WELL.arrive.y)).toBe("landing");
      // 발판 자리는 바닥 쇠 격자 2×2 가 표시한다 — 발판을 옮기면 격자도 따라간다.
      const grates = new Set(layout.objects.filter((o) => o.id === "grate floor").map((o) => `${o.x},${o.y}`));
      for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) expect(grates.has(`${WELL.lift.x + dx},${WELL.lift.y + dy}`)).toBe(true);
      expect(grates.has("5,7")).toBe(false);
    });

    it("is a long walk from the ladder arrival through rooms and corridors", () => {
      // 방 사각과 복도(폭 2)를 걸을 수 있는 칸으로, 물·구덩이를 막힌 칸으로, 그 위 다리를 다시 걷는 칸으로 본 평면 BFS.
      const open = new Set<string>();
      for (const room of layout.rooms) for (const r of room.rects) for (let y = r.y; y < r.y + r.h; y += 1) for (let x = r.x; x < r.x + r.w; x += 1) open.add(`${x},${y}`);
      for (const c of layout.corridors) {
        const [[x0, y0], [x1, y1]] = [c.path[0]!, c.path[c.path.length - 1]!];
        for (let y = Math.min(y0, y1); y <= Math.max(y0, y1) + (x0 === x1 ? 0 : c.width - 1); y += 1)
          for (let x = Math.min(x0, x1); x <= Math.max(x0, x1) + (x0 === x1 ? c.width - 1 : 0); x += 1) open.add(`${x},${y}`);
      }
      for (const h of layout.hazards) for (let y = h.y; y < h.y + h.h; y += 1) for (let x = h.x; x < h.x + h.w; x += 1) open.delete(`${x},${y}`);
      for (const b of layout.bridges) for (let y = b.y; y < b.y + b.h; y += 1) for (let x = b.x; x < b.x + b.w; x += 1) open.add(`${x},${y}`);
      const start = `${WELL.arrive.x},${WELL.arrive.y}`;
      const dist = new Map([[start, 0]]);
      const queue = [start];
      while (queue.length) {
        const cur = queue.shift()!;
        const [x, y] = cur.split(",").map(Number) as [number, number];
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const next = `${x + dx},${y + dy}`;
          if (open.has(next) && !dist.has(next)) { dist.set(next, dist.get(cur)! + 1); queue.push(next); }
        }
      }
      const pad = dist.get(`${WELL.lift.x},${WELL.lift.y}`);
      expect(pad, "lift pad unreachable from the ladder arrival").toBeDefined();
      expect(pad!).toBeGreaterThanOrEqual(40);
    });
  });
});
