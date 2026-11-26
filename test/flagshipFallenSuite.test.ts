import { describe, expect, it } from "vitest";
import { FS2_PIERCE_IMMUNE, letAct2PierceWoundLand } from "@/project/flagship/fallen/act2Opening";
import type { EnemyRecord, Project, Command, GameEvent, GameMap, SkillRecord } from "@/project/types";
import { applyFallenInteractiveProps } from "@/project/flagship/fallen/interactProps";
import { wellData } from "@/project/flagship/fallen/wellBeast";
import { WELL, WELL_SHAFT_LAYOUT } from "@/project/flagship/fallen/wellShaftRooms";
import { isolateTimers } from "./mergedTeardown";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import contactBounds from "@/assets/battleContactBounds.json";
import { actorBattlers, battlerSnapshot, refreshActorBattlerDerivedStats } from "@/battle/battleBattlers";
import { actorBattleSheetForEquipment } from "@/battle/battleWeaponSheet";
import { normalizeWeaponBattleSheets } from "@/project/actorModel";
import { normalizeEquipmentRecord, normalizeSkillRecord } from "@/project/databaseRecordModel";
import { createBlankProject } from "@/project/defaults/blankProject";
import { FS_WEAPON_BATTLE_SHEETS, applyFallenHeroSkillIdentity, FS2_LANCE_SKILLS, FS_HIT_FLASH, FS_KAEL_STAR_SLASH, FS_STAR_FINISHER_SKILLS, FS_STAR_MARK_FINISHERS, FS_STAR_MARK_SLASHES, FS_STAR_MARK_STATES } from "@/project/flagship/fallen/heroSkillIdentity";
import { deserialize, serialize } from "@/project/io";
import { startSession } from "@/project/session";
import { resolveRetroClassChoreography } from "@/assets/retroSkillCatalog";
import { createBattleRuntime } from "@/battle/runtime";
import { applyFallenTraitPilot, FS_TRAIT_PILOT, applyFallenTrashWeakness, FS_WEAKNESS_TRASH_HP, FS_WEAKNESS_TRASH_TROOPS } from "@/project/flagship/fallen/mobBalance";
import customCatalog from "@/pixelfx/custom/catalog.json";
import { PIXEL_FX_CUSTOM } from "@/pixelfx/custom";
import { isKnownPixelFxEffect } from "@/pixelfx/catalog";
import { loadPixelFxModule } from "@/pixelfx/modules";
import { pixelFxEffectTiming } from "@/battle/animationTiming";
import { FALLEN_SKILL_FX } from "@/project/flagship/fallen/pixelfx";
import { runTool } from "@/editor/tools/toolRunner";
import type { ToolContext } from "@/editor/tools/types";
import { createBeodeulCityTileset } from "@/project/defaults/beodeulCity";

describe("fallenAct2PierceWound", () => {
  isolateTimers();
  const E = { state_fs_pierced: "E" };
  function project(): Project {
    const enemy = (id: string, stateRates: Record<string, string>): EnemyRecord => ({ id, name: id, stateRates } as unknown as EnemyRecord);
    return {
      database: {
        enemies: [
          enemy("enemy_fs2_frost_wolf_t_fs2_frost_wolves", { ...E }),
          enemy("enemy_fs2_elite_frostmane", { ...E, state_fs_elite_aura: "A" }),
          ...FS2_PIERCE_IMMUNE.map((id) => enemy(id, { ...E })),
          enemy("enemy_fs_moon_dragon", { state_fs_pierced: "A" }),
          enemy("enemy_fs_wolf", { ...E }),
        ],
      },
    } as unknown as Project;
  }
  const rate = (p: Project, id: string) => (p.database.enemies.find((e) => e.id === id)!.stateRates as Record<string, string>).state_fs_pierced;
  describe("Sarah's pierce wound lands on ordinary act-2 enemies (fs-vqa-fix-all)", () => {
    it("clears the inherited immunity only on ordinary act-2 enemies", () => {
      const p = project();
      expect(letAct2PierceWoundLand(p)).toEqual(["enemy_fs2_frost_wolf_t_fs2_frost_wolves"]);
      expect(rate(p, "enemy_fs2_frost_wolf_t_fs2_frost_wolves")).toBeUndefined();
    });
    it("keeps the well boss, duel, collector and elites immune and the act-1 dragon and wolves as authored", () => {
      const p = project();
      letAct2PierceWoundLand(p);
      for (const id of [...FS2_PIERCE_IMMUNE, "enemy_fs2_elite_frostmane", "enemy_fs_wolf"]) expect(rate(p, id)).toBe("E");
      expect(rate(p, "enemy_fs_moon_dragon")).toBe("A");
    });
  });
});

describe("fallenOpenEffects", () => {
  isolateTimers();
  const box = (name: string, x: number): GameEvent => ({
    id: `ev_fs_box_fs_test_${x}_1`, name: `수납 · ${name}`, x, y: 1, trigger: { kind: "action" }, commands: [],
    pages: [
      { id: `p${x}_0`, name: "뒤지기", conditions: [], graphic: { transparent: true }, movement: { type: "fixed", speed: 3, frequency: 3 }, priority: "same", trigger: { kind: "action" },
        commands: [{ kind: "text", body: "찾았다." }, { kind: "changeGold", op: "+=", amount: 5 }, { kind: "setSelfSwitch", key: "A", value: true }] },
      { id: `p${x}_1`, name: "이미 뒤짐", conditions: [{ kind: "selfSwitch", key: "A", value: true }], graphic: { transparent: true }, movement: { type: "fixed", speed: 3, frequency: 3 }, priority: "same", trigger: { kind: "action" },
        commands: [{ kind: "text", body: "이미 뒤져 봤다." }] },
    ],
  } as unknown as GameEvent);
  function fixture(names: string[]): Project {
    const width = names.length + 2;
    const map = {
      id: "fs_test", width, height: 3, tilesetId: "t", events: names.map((n, i) => box(n, i + 1)), locations: [],
      lowerTiles: new Array(width * 3).fill(0), upperTiles: new Array(width * 3).fill(-1),
    } as unknown as GameMap;
    return { maps: { fs_test: map } } as unknown as Project;
  }
  const firstPage = (e: GameEvent): Command[] => (e.pages![0]!.commands ?? []) as Command[];
  const openFx = (e: GameEvent) => firstPage(e).find((c) => c.kind === "showAnimation") as { animationId?: string } | undefined;
  const sounds = (e: GameEvent) => firstPage(e).filter((c) => c.kind === "playAudio").map((c) => (c as { resourceId: string }).resourceId);
  describe("applyFallenInteractiveProps open effects", () => {
    it("gives barrel, crate, wardrobe and jar different open effects and keeps the loot", () => {
      const project = fixture(["통", "나무 상자", "옷장", "항아리"]);
      applyFallenInteractiveProps(project);
      const [barrel, crate, wardrobe, jar] = project.maps.fs_test!.events;
      const keys = [barrel, crate, wardrobe, jar].map((e) => `${openFx(e!)?.animationId}|${sounds(e!).join(",")}`);
      expect(new Set(keys).size).toBe(4);
      expect(openFx(barrel!)?.animationId).toBe("fx:container:barrel");
      expect(openFx(jar!)?.animationId).toBe("fx:container:jar");
      expect(openFx(wardrobe!)?.animationId).toBe("fx:container:wardrobe");
      for (const e of [barrel, crate, wardrobe, jar]) {
        expect(firstPage(e!).some((c) => c.kind === "changeGold")).toBe(true);
        expect(firstPage(e!).some((c) => c.kind === "setSelfSwitch")).toBe(true);
      }
    });

    it("is idempotent — a second pass does not stack extra sounds", () => {
      const project = fixture(["옷장"]);
      applyFallenInteractiveProps(project);
      applyFallenInteractiveProps(project);
      expect(sounds(project.maps.fs_test!.events[0]!)).toEqual(["cc0-se-orp-inventory-cloth-heavy"]);
    });
  });
});

describe("fallenWell", () => {
  isolateTimers();
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
});

describe("heroSkillIdentity", () => {
  isolateTimers();
  describe("battleWeaponSheet", () => {
    isolateTimers();
    // 장비한 무기의 계열(attackElementIds)로 전투 시트를 고른다 — 「창을 든 카엘은 창 자세로 선다」(2026-11-15 폴른 스타 QA 9번).
    // 표는 게임 자료(ActorRecord.weaponBattleSheets)가 정하고, 표가 없거나 그 계열이 없으면 지금 시트 그대로다.
    const BASE = "charset-battler-actor1-0";
    const SPEAR = "charset-battler-actor1-0-spear";
    function projectWithTable(): { project: Project; actorId: string } {
      const project = createBlankProject();
      const actor = project.database.actors[0]!;
      project.database.equipment.push(
        normalizeEquipmentRecord({ id: "equip_t_spear", name: "시험 창", slot: "weapon", attackElementIds: ["spear"] }),
        normalizeEquipmentRecord({ id: "equip_t_sword", name: "시험 검", slot: "weapon", attackElementIds: ["sword"] }),
        normalizeEquipmentRecord({ id: "equip_t_plain", name: "계열 없는 막대", slot: "weapon" }),
        normalizeEquipmentRecord({ id: "equip_t_glaive", name: "베는 창", slot: "weapon", attackElementIds: ["sword", "spear"] }),
      );
      actor.battleCharacterResourceId = BASE;
      actor.weaponBattleSheets = { spear: SPEAR };
      return { project, actorId: actor.id };
    }
    function sheetWith(project: Project, actorId: string, weapon: string | undefined): string | undefined {
      return actorBattlers(project, { partyActorIds: [actorId], equipment: { [actorId]: weapon ? { weapon } : {} } })[0]!.battleCharacterResourceId;
    }
    describe("무기 계열로 전투 시트 고르기", () => {
      it("표에 있는 계열의 무기를 들면 그 시트, 아니면 지금 시트 그대로", () => {
        const { project, actorId } = projectWithTable();
        expect(sheetWith(project, actorId, "equip_t_spear")).toBe(SPEAR);
        expect(sheetWith(project, actorId, "equip_t_sword")).toBe(BASE);
        expect(sheetWith(project, actorId, "equip_t_plain")).toBe(BASE);
        // 계열이 둘이면 표에 있는 첫 계열을 쓴다.
        expect(sheetWith(project, actorId, "equip_t_glaive")).toBe(SPEAR);
      });

      it("표가 없는 배우는 무엇을 들어도 시트가 바뀌지 않는다", () => {
        const { project, actorId } = projectWithTable();
        delete project.database.actors[0]!.weaponBattleSheets;
        expect(sheetWith(project, actorId, "equip_t_spear")).toBe(BASE);
        expect(sheetWith(project, actorId, "equip_t_sword")).toBe(BASE);
      });

      it("무기가 없거나 자료에 없는 무기면 지금 시트 그대로", () => {
        const { project } = projectWithTable();
        const actor = project.database.actors[0]!;
        expect(actorBattleSheetForEquipment(project, actor, undefined)).toBe(BASE);
        expect(actorBattleSheetForEquipment(project, actor, {})).toBe(BASE);
        expect(actorBattleSheetForEquipment(project, actor, { weapon: "equip_missing" })).toBe(BASE);
      });

      it("전투 중 무기를 바꾸면 그 배틀러의 시트를 다시 고르고 스냅숏에 실린다", () => {
        const { project, actorId } = projectWithTable();
        const battler = actorBattlers(project, { partyActorIds: [actorId], equipment: { [actorId]: { weapon: "equip_t_sword" } } })[0]!;
        expect(battlerSnapshot(battler).battleCharacterResourceId).toBe(BASE);
        refreshActorBattlerDerivedStats(project, battler, { equipment: { weapon: "equip_t_spear" } });
        expect(battlerSnapshot(battler).battleCharacterResourceId).toBe(SPEAR);
        refreshActorBattlerDerivedStats(project, battler, { equipment: { weapon: "equip_t_sword" } });
        expect(battlerSnapshot(battler).battleCharacterResourceId).toBe(BASE);
        refreshActorBattlerDerivedStats(project, battler, { equipment: {} });
        expect(battlerSnapshot(battler).battleCharacterResourceId).toBe(BASE);
      });

      it("저장·불러오기: 표는 프로젝트에 남고, 시트는 저장하지 않고 세션 장비로 그때그때 고른다", () => {
        const { project, actorId } = projectWithTable();
        const loaded = deserialize(serialize(project));
        expect(loaded.database.actors[0]!.weaponBattleSheets).toEqual({ spear: SPEAR });
        const session = startSession(loaded);
        session.actorEquipment = { ...session.actorEquipment, [actorId]: { ...session.actorEquipment?.[actorId], weapon: "equip_t_spear" } };
        const saved = JSON.parse(JSON.stringify(session)) as typeof session;
        expect(JSON.stringify(saved)).not.toContain(SPEAR);
        const battler = actorBattlers(loaded, { partyActorIds: [actorId], equipment: saved.actorEquipment })[0]!;
        expect(battler.battleCharacterResourceId).toBe(SPEAR);
      });

      it("표 정규화: 빈 칸은 버리고, 줄이 없으면 표를 두지 않는다", () => {
        expect(normalizeWeaponBattleSheets({ " spear ": " sheet-a ", bow: "", "": "sheet-b", axe: 3 })).toEqual({ spear: "sheet-a" });
        expect(normalizeWeaponBattleSheets({})).toBeUndefined();
        expect(normalizeWeaponBattleSheets(undefined)).toBeUndefined();
        expect(normalizeWeaponBattleSheets(["spear"])).toBeUndefined();
      });
    });
    describe("폴른 스타 · 창을 든 카엘", () => {
      it("카엘만 창 시트 표를 갖는다 — 다른 인물은 그대로", () => {
        const project = createBlankProject();
        const before = project.database.actors.map((actor) => [actor.id, actor.battleCharacterResourceId]);
        const report = applyFallenHeroSkillIdentity(project);
        expect(Object.keys(FS_WEAPON_BATTLE_SHEETS)).toEqual(["actor_hero"]);
        expect(report.applied.some((line) => line.startsWith("무기 시트 "))).toBe(true);
        const withTable = project.database.actors.filter((actor) => actor.weaponBattleSheets);
        expect(withTable.map((actor) => actor.id)).toEqual(["actor_hero"]);
        expect(withTable[0]!.weaponBattleSheets).toEqual({ spear: SPEAR });
        // 기본 시트(battleCharacterResourceId)는 누구도 바뀌지 않는다.
        expect(project.database.actors.map((actor) => [actor.id, actor.battleCharacterResourceId])).toEqual(before);
      });

      it("창 시트와 창 캐스트 시트가 묶음에 있고 주소로 풀린다, 접촉 치수도 있다", () => {
        const project = createBlankProject();
        expect(resolveAssetResourceUrl(SPEAR, { project })).toBe("/assets/generated/charset-battlers/actor1-0-spear.png");
        expect(existsSync(resolve(process.cwd(), "public/assets/generated/charset-battlers/actor1-0-spear.png"))).toBe(true);
        expect(existsSync(resolve(process.cwd(), "public/assets/generated/charset-battlers/cast/actor1-0-spear.png"))).toBe(true);
        expect(Object.keys(contactBounds as Record<string, unknown>)).toContain("assets/generated/charset-battlers/actor1-0-spear.png");
      });
    });
  });
  describe("fallenHeroSkillIdentity", () => {
    isolateTimers();
    const KAEL_SWORD_SHEETS = ["hero_pierce", "hero_whirl", "hero_meteor_trail", "hero_meteor_impact", "hero_cross"];
    function fallenLike(): Project {
      const project = createBlankProject();
      const ids = [...FS_STAR_MARK_SLASHES, ...FS_STAR_MARK_FINISHERS, ...Object.keys(FS2_LANCE_SKILLS)];
      for (const id of ids) {
        if (project.database.skills.some((skill) => skill.id === id)) continue;
        project.database.skills.push(normalizeSkillRecord({ id, name: id, scope: "enemy", power: 10, damageFormula: "100",
          mpCost: { flat: 0, percentMax: 0 }, variance: 0, criticalRate: 0, hitRate: 100, successRate: 100,
          effect: { kind: "damage", statistic: "attack", affects: "hp" } }));
      }
      return project;
    }
    describe("Fallen Star hero skill identity (batch 1)", () => {
      it("Sarah's lance skills resolve to lance records with no Kael sword sheet, ids unchanged", () => {
        const project = fallenLike();
        const report = applyFallenHeroSkillIdentity(project);
        expect(report.skipped.filter((line) => line.includes("연출"))).toEqual([]);
        for (const [skillId, chorId] of Object.entries(FS2_LANCE_SKILLS)) {
          const skill = project.database.skills.find((row) => row.id === skillId)!;
          expect(skill.retroChoreographyId).toBe(chorId);
          const layers = resolveRetroClassChoreography(skill, project.database.skillChoreographies)!.layers.map((layer) => layer.key);
          expect(layers.length).toBeGreaterThan(0);
          for (const sheet of KAEL_SWORD_SHEETS) expect(layers).not.toContain(sheet);
        }
      });

      it("star finishers burst with heavy weight; mark icons resolve to bundled files", () => {
        const project = fallenLike();
        applyFallenHeroSkillIdentity(project);
        for (const chorId of Object.values(FS_STAR_FINISHER_SKILLS)) {
          expect(project.database.skillChoreographies!.find((row) => row.id === chorId)?.weight).toBe("heavy");
        }
        for (const id of FS_STAR_MARK_STATES) {
          const state = project.database.states.find((row) => row.id === id)!;
          expect(resolveAssetResourceUrl(state.iconResourceId, { project })).toBeTruthy();
        }
      });

      it("in battle, single slashes climb the mark I→II→III and a finisher bursts it for +25/+50/+75%", () => {
        const project = fallenLike();
        applyFallenHeroSkillIdentity(project);
        project.system.battleModel = "rm2k3";
        const actor = project.database.actors[0]!;
        const enemy = project.database.enemies[0]!;
        const troop = project.database.troops.find((row) => row.id === project.system.initialTroopId) ?? project.database.troops[0]!;
        troop.enemyIds = [enemy.id];
        troop.members = [{ enemyId: enemy.id, x: 80, y: 80 }];
        troop.battleEventPages = [];
        actor.initialEquipment = {};
        actor.parameterCurves.maxHp = Array(99).fill(500);
        actor.parameterCurves.agility = Array(99).fill(999);
        enemy.stats = { ...enemy.stats, maxHp: 99999, attack: 1, defense: 20, mind: 20, agility: 1 };
        enemy.actions = [];
        const slash = FS_STAR_MARK_SLASHES[0];
        const finisher = FS_STAR_MARK_FINISHERS[0];
        const mark = project.database.skills.find((row) => row.id === slash) as SkillRecord;
        mark.damageFormula = "1";
        const run = (marks: number) => {
          const runtime = createBattleRuntime({
            project, troopId: troop.id, canEscape: false, canLose: true, battleFlow: "strict", rng: () => 0.5,
            party: { levels: { [actor.id]: 1 }, experience: {}, partyActorIds: [actor.id], skillIds: { [actor.id]: [slash, finisher] } },
          });
          for (let i = 0; i < marks; i += 1) runtime.performActorCommand({ kind: "skill", skillId: slash, targetEnemyId: "enemy-1" });
          const states = [...runtime.snapshot().enemies[0]!.stateIds];
          const before = runtime.snapshot().timeline.length;
          runtime.performActorCommand({ kind: "skill", skillId: finisher, targetEnemyId: "enemy-1" });
          const hit = runtime.snapshot().timeline.slice(before).find((entry) => entry.kind === "damage" && entry.targetId === "enemy-1");
          return { states, amount: hit?.amount ?? 0, after: runtime.snapshot().enemies[0]!.stateIds };
        };
        const zero = run(0);
        const tiers = [1, 2, 3, 4].map(run);
        expect(tiers[0]!.states).toContain(FS_STAR_MARK_STATES[0]);
        expect(tiers[1]!.states).toContain(FS_STAR_MARK_STATES[1]);
        expect(tiers[2]!.states).toContain(FS_STAR_MARK_STATES[2]);
        expect(tiers[3]!.states.filter((id) => (FS_STAR_MARK_STATES as readonly string[]).includes(id))).toEqual([FS_STAR_MARK_STATES[2]]);
        expect(tiers[0]!.amount / zero.amount).toBeCloseTo(1.25, 1);
        expect(tiers[1]!.amount / zero.amount).toBeCloseTo(1.5, 1);
        expect(tiers[2]!.amount / zero.amount).toBeCloseTo(1.75, 1);
        for (const row of tiers) expect(row.after.some((id) => (FS_STAR_MARK_STATES as readonly string[]).includes(id))).toBe(false);
      });

      it("only Kael's own slash carves the star mark; the shared skill_sword_slash enemies use does not (fs-vqa-fix-all)", () => {
        const project = fallenLike();
        applyFallenHeroSkillIdentity(project);
        const shared = project.database.skills.find((row) => row.id === "skill_sword_slash")!;
        const kael = project.database.skills.find((row) => row.id === FS_KAEL_STAR_SLASH)!;
        const marks = (skill: SkillRecord) => (skill.stateEffects ?? []).filter((row) => (FS_STAR_MARK_STATES as readonly string[]).includes(row.stateId));
        expect(marks(shared)).toEqual([]);
        expect(shared.description).not.toContain("별 표식");
        expect(marks(kael)).toHaveLength(1);
        expect(kael.name).toBe(shared.name);
        expect(kael.animationId).toBe(shared.animationId);
        const hero = project.database.classes.find((row) => row.id === "class_hero")!;
        expect(hero.learnedSkills.map((row) => row.skillId)).toContain(FS_KAEL_STAR_SLASH);
        expect(hero.learnedSkills.map((row) => row.skillId)).not.toContain("skill_sword_slash");
        expect(hero.skillIds).not.toContain("skill_sword_slash");

        // 실전: 적이 공용 검격으로 아군을 베어도 표식이 생기지 않는다.
        project.system.battleModel = "rm2k3";
        const actor = project.database.actors[0]!;
        const enemy = project.database.enemies[0]!;
        const troop = project.database.troops.find((row) => row.id === project.system.initialTroopId) ?? project.database.troops[0]!;
        troop.enemyIds = [enemy.id];
        troop.members = [{ enemyId: enemy.id, x: 80, y: 80 }];
        troop.battleEventPages = [];
        actor.initialEquipment = {};
        actor.parameterCurves.maxHp = Array(99).fill(9999);
        actor.parameterCurves.agility = Array(99).fill(1);
        enemy.stats = { ...enemy.stats, maxHp: 99999, attack: 1, agility: 999 };
        enemy.actions = [{ skillId: "skill_sword_slash", priority: 9, condition: { kind: "always" } } as never];
        shared.damageFormula = "1";
        const runtime = createBattleRuntime({
          project, troopId: troop.id, canEscape: false, canLose: true, battleFlow: "strict", rng: () => 0.5,
          party: { levels: { [actor.id]: 1 }, experience: {}, partyActorIds: [actor.id], skillIds: { [actor.id]: ["skill_attack"] } },
        });
        for (let i = 0; i < 3; i += 1) runtime.performActorCommand({ kind: "defend" });
        const enemySlashed = runtime.snapshot().timeline.some((entry) => entry.side === "enemy" && entry.skillId === "skill_sword_slash");
        expect(enemySlashed).toBe(true);
        expect(runtime.snapshot().actors[0]!.stateIds.filter((id) => (FS_STAR_MARK_STATES as readonly string[]).includes(id))).toEqual([]);
      });

      it("gives each hero a hex flash colour pair", () => {
        const project = fallenLike();
        applyFallenHeroSkillIdentity(project);
        const hero = project.database.actors.find((row) => row.id === "actor_hero");
        if (hero) expect(hero.battleHitFlash).toEqual({ core: "#eef3f8", edge: "#ff8a2a" });
      });

      it("no two heroes share an edge hue family (fs-vqa-fix-all: Sarah read as Kael's orange)", () => {
        const hue = (hex: string) => {
          const [r, g, b] = [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16) / 255);
          const max = Math.max(r!, g!, b!), min = Math.min(r!, g!, b!), d = max - min;
          if (d === 0) return 0;
          const h = max === r ? ((g! - b!) / d) % 6 : max === g ? (b! - r!) / d + 2 : (r! - g!) / d + 4;
          return (h * 60 + 360) % 360;
        };
        const edges = Object.values(FS_HIT_FLASH).map((flash) => hue(flash.edge));
        for (let i = 0; i < edges.length; i += 1) for (let j = i + 1; j < edges.length; j += 1) {
          const gap = Math.abs(edges[i]! - edges[j]!);
          expect(Math.min(gap, 360 - gap)).toBeGreaterThanOrEqual(25);
        }
      });
    });
  });
});

describe("mobBalance", () => {
  isolateTimers();
  describe("fallenTraitPilot", () => {
    isolateTimers();
    const rates = () => ({ sword: "C", spear: "C", bow: "C", hit: "C", fire: "C", ice: "C", water: "B", thunder: "C" });
    function fixture(): Project {
      return {
        database: {
          enemies: [
            ...Object.keys(FS_TRAIT_PILOT).map((id) => ({ id, stats: { maxHp: 1000 }, elementRates: rates() })),
            { id: "enemy_fs2_frost_bat_t_fs2_tower_bats", stats: { maxHp: 350 }, elementRates: rates() },
          ],
          troops: [],
        },
      } as unknown as Project;
    }
    describe("applyFallenTraitPilot", () => {
      it("makes every pilot enemy immune to weapons, gives it its one weakness, and scales its HP", () => {
        const project = fixture();
        expect(applyFallenTraitPilot(project)).toEqual([]);
        const byId = new Map(project.database.enemies.map((e) => [e.id, e]));
        for (const [id, trait] of Object.entries(FS_TRAIT_PILOT)) {
          const enemy = byId.get(id)!;
          expect(enemy.elementRates).toMatchObject({ sword: "E", spear: "E", bow: "E", ...trait.rates });
          expect(Object.values(trait.rates).filter((grade) => grade === "A")).toHaveLength(1);
          expect(enemy.stats.maxHp).toBe(Math.round(1000 * trait.hp));
        }
        expect(byId.get("enemy_fs2_frost_bat_t_fs2_frost_bats")!.elementRates.fire).toBe("A");
        const other = byId.get("enemy_fs2_frost_bat_t_fs2_tower_bats")!;
        expect(other.elementRates.sword).toBe("C");
        expect(other.stats.maxHp).toBe(350);
      });

      it("warns instead of throwing when a pilot enemy is missing", () => {
        const project = { database: { enemies: [], troops: [] } } as unknown as Project;
        expect(applyFallenTraitPilot(project)).toHaveLength(Object.keys(FS_TRAIT_PILOT).length);
      });
    });
  });
  describe("fallenTrashWeakness", () => {
    isolateTimers();
    const enemy = (id: string, maxHp: number) => ({ id, stats: { maxHp }, elementRates: { fire: "A", sword: "B", water: "D", ice: "C" } });
    function fixture(): Project {
      const trash = FS_WEAKNESS_TRASH_TROOPS[0]!;
      return {
        database: {
          enemies: [enemy("enemy_trash_only", 200), enemy("enemy_shared", 300), enemy("enemy_boss", 900)],
          troops: [
            { id: trash, enemyIds: ["enemy_trash_only", "enemy_shared"] },
            { id: "troop_fs_dragon", enemyIds: ["enemy_boss", "enemy_shared"] },
          ],
        },
      } as unknown as Project;
    }
    describe("applyFallenTrashWeakness", () => {
      it("upgrades B weaknesses to A and raises HP only for enemies that appear in trash troops alone", () => {
        const project = fixture();
        expect(applyFallenTrashWeakness(project).filter((w) => w.includes("적 없음"))).toEqual([]);
        const [trashOnly, shared, boss] = project.database.enemies;
        expect(trashOnly!.elementRates).toEqual({ fire: "A", sword: "A", water: "D", ice: "C" });
        expect(trashOnly!.stats.maxHp).toBe(Math.round(200 * FS_WEAKNESS_TRASH_HP));
        expect(shared!.elementRates.sword).toBe("B");
        expect(shared!.stats.maxHp).toBe(300);
        expect(boss!.elementRates.sword).toBe("B");
        expect(boss!.stats.maxHp).toBe(900);
      });

      it("keeps the knowledge-dependent and boss troops out of the list", () => {
        for (const id of ["troop_fs_wisps", "troop_fs2_ash_collector", "troop_fs_dragon", "troop_fs2_sarah", "troop_fs_valen_crash"]) {
          expect(FS_WEAKNESS_TRASH_TROOPS).not.toContain(id);
        }
      });
    });
  });
});

describe("pixelFx", () => {
  isolateTimers();
  // catalog.json 은 scripts/vendor/sync-pixelfx.mjs 가 효과 모듈의 meta 로 만드는 파생 파일이다. 동기화가 act(0.3.0 연기 박자)를
  // 빠뜨리면 효과 코드는 멀쩡한데 편집기 고르기 창·list_pixel_fx 만 조용히 낡는다 — 그 어긋남을 여기서 잡는다.
  describe("pixelFxCatalogAct", () => {
    isolateTimers();
    const PIXELFX_DIR = join(import.meta.dirname, "..", "src", "vendor", "pixelfx");
    const FX_DIR = join(PIXELFX_DIR, "fx");
    interface CatalogAct {
      readonly windup: number;
      readonly recovery: number;
      readonly onBody: boolean;
      readonly hits: number;
      readonly targets: number;
    }
    interface CatalogEntry {
      readonly id: string;
      readonly category: string;
      readonly size: readonly number[];
      readonly duration: number;
      readonly loop: boolean;
      readonly actor: number;
      readonly back: number;
      readonly act?: CatalogAct;
    }
    interface CatalogEffectModule {
      readonly meta: { readonly size?: readonly number[]; readonly duration?: number; readonly loop?: boolean; readonly actor?: number };
      readonly act?: { readonly poses?: readonly (readonly [number, unknown, string?])[]; readonly hits?: readonly unknown[]; readonly targets?: readonly unknown[]; readonly target?: unknown; readonly onBody?: boolean };
    }
    const catalog = JSON.parse(readFileSync(join(PIXELFX_DIR, "catalog.json"), "utf8")) as { categories: { id: string }[]; effects: CatalogEntry[] };
    /** 카탈로그가 세는 효과 파일 수(\`_\` 로 시작하는 분류 공용 헬퍼는 효과가 아니다). */
    function effectFiles(): string[] {
      const out: string[] = [];
      for (const category of readdirSync(FX_DIR, { withFileTypes: true })) {
        if (!category.isDirectory()) continue;
        for (const file of readdirSync(join(FX_DIR, category.name))) {
          if (file.endsWith(".js") && !file.startsWith("_")) out.push(`${category.name}/${file.slice(0, -3)}`);
        }
      }
      return out;
    }
    /** sync 스크립트와 같은 규칙으로 act 타이밍을 다시 센다(정본은 core/act.js \`actTiming\`). */
    function actTimingOf(mod: CatalogEffectModule): CatalogAct | null {
      const a = mod.act;
      if (!a) return null;
      const keys = a.poses ?? [];
      const from = Math.min(0, keys[0]?.[0] ?? 0);
      const last = keys.length ? keys[keys.length - 1]![0] : 0;
      const D = mod.meta.duration ?? 1;
      return {
        windup: +Math.max(0, -from).toFixed(3),
        recovery: mod.meta.loop ? 0 : +Math.max(0, last - D).toFixed(3),
        onBody: !!a.onBody,
        hits: (a.hits ?? []).length,
        targets: (a.targets ?? (a.target ? [a.target] : [])).length,
      };
    }
    describe("pixelfx catalog.json ↔ vendor modules", () => {
      it("lists every effect file exactly once", () => {
        const files = effectFiles().sort();
        const ids = catalog.effects.map((entry) => entry.id).sort();
        expect(ids).toEqual(files);
      });

      it("carries the act timing of every effect that has one, and none for the others", async () => {
        const mismatched: string[] = [];
        for (const entry of catalog.effects) {
          const [category, name] = entry.id.split("/") as [string, string];
          const mod = (await import(join(FX_DIR, category, `${name}.js`))) as CatalogEffectModule;
          const expected = actTimingOf(mod);
          if (!expected) {
            if (entry.act) mismatched.push(`${entry.id}: catalog has act, module has none`);
            continue;
          }
          if (!entry.act) {
            mismatched.push(`${entry.id}: module has act, catalog has none`);
            continue;
          }
          for (const key of ["windup", "recovery", "onBody", "hits", "targets"] as const) {
            if (entry.act[key] !== expected[key]) mismatched.push(`${entry.id}.${key}: ${String(entry.act[key])} ≠ ${String(expected[key])}`);
          }
        }
        expect(mismatched).toEqual([]);
      });

      it("ships the 0.3.0 moves category with whole acted attacks", () => {
        expect(catalog.categories.map((category) => category.id)).toContain("moves");
        const moves = catalog.effects.filter((entry) => entry.category === "moves");
        expect(moves).toHaveLength(12);
        for (const move of moves) {
          expect(move.act, `${move.id} must carry act so a host can time its own character`).toBeDefined();
          expect(move.act!.windup).toBeGreaterThanOrEqual(0);
          expect(move.act!.targets).toBeGreaterThan(0);
          expect(move.act!.hits).toBeGreaterThan(0);
        }
      });

      it("keeps the render contract fields the wrapper reads (size, duration, loop, actor, back)", () => {
        const broken: string[] = [];
        for (const entry of catalog.effects) {
          if (!Array.isArray(entry.size) || entry.size.length !== 2) broken.push(`${entry.id}.size`);
          if (!(entry.duration > 0)) broken.push(`${entry.id}.duration`);
          if (typeof entry.loop !== "boolean") broken.push(`${entry.id}.loop`);
          if (entry.actor !== 0 && entry.actor !== 1) broken.push(`${entry.id}.actor`);
          if (entry.back !== 0 && entry.back !== 1) broken.push(`${entry.id}.back`);
        }
        expect(broken).toEqual([]);
      });
    });
  });
  // 우리가 저작한 pixelfx 효과(src/pixelfx/custom)는 vendor 동기화 밖이라 세 곳이 손으로 이어진다:
  // 정적 import 표(custom/index.ts) · 파생 catalog.json(build-pixelfx-custom-catalog.mjs) · 그 효과를 쓰는 게임 데이터.
  // 하나라도 어긋나면 전투에서 효과가 조용히 빠진다(loader 가 undefined) — 그 어긋남을 여기서 잡는다.
  describe("pixelFxCustomEffects", () => {
    isolateTimers();
    const CUSTOM_DIR = join(import.meta.dirname, "..", "src", "pixelfx", "custom");
    function customFiles(): string[] {
      const out: string[] = [];
      for (const category of readdirSync(CUSTOM_DIR, { withFileTypes: true })) {
        if (!category.isDirectory()) continue;
        for (const file of readdirSync(join(CUSTOM_DIR, category.name))) if (file.endsWith(".js") && !file.startsWith("_")) out.push(`${category.name}/${file.slice(0, -3)}`);
      }
      return out.sort();
    }
    describe("custom pixelfx effects", () => {
      it("lists every custom effect file in both the import table and the derived catalog", () => {
        expect(PIXEL_FX_CUSTOM.map((e) => e.id).sort()).toEqual(customFiles());
        expect(customCatalog.effects.map((e) => e.id).sort()).toEqual(customFiles());
      });

      it("loads each custom effect through the runtime loader with the catalog's meta", async () => {
        for (const entry of customCatalog.effects) {
          const mod = await loadPixelFxModule(entry.id);
          expect(mod, entry.id).toBeDefined();
          expect(mod!.meta.duration).toBe(entry.duration);
          expect([...mod!.meta.size]).toEqual(entry.size);
          expect(pixelFxEffectTiming(entry.id)).toEqual({ durationMs: Math.round(entry.duration * 1000), loop: entry.loop });
        }
      });

      it("gives every Fallen Star skill an effect the catalog knows", () => {
        const unknown = FALLEN_SKILL_FX.filter((e) => !isKnownPixelFxEffect(e.spec.effectId)).map((e) => `${e.skill} → ${e.spec.effectId}`);
        expect(unknown).toEqual([]);
      });
    });
  });
});

describe("tileEffectPageMovement", () => {
  isolateTimers();
  // 도구가 만드는 이벤트 페이지는 movement.speed·frequency 를 갖고 있어야 한다 — 없으면 프로젝트 무결성 검사
  // (deserialize(serialize()))가 거부해 그 뒤 쓰기 도구(remove_map 등)가 모두 실패했다(폴른 스타 우물 갱도 굽기 실측).
  describe("tool-made event pages carry full movement", () => {
    it("tile_change_effect trigger pages round-trip through serialize/deserialize", () => {
      const context: ToolContext = { project: createBlankProject() };
      // maps 는 맵 id 로 찾는 표다(Record<MapId, GameMap>) — 순번 [0] 으로는 아무것도 나오지 않는다. 시작 맵을 id 로 집는다.
      const mapId = context.project.startMapId;
      expect(context.project.maps[mapId]?.id).toBe(mapId);
      const result = runTool(context, "tile_change_effect", {
        targetMapId: mapId,
        changes: [{ layer: "lower", rect: { x: 1, y: 1, w: 1, h: 1 }, tile: 0 }],
        trigger: { mapId, x: 2, y: 2, name: "레버", text: "레버를 당겼다." },
      }, { dryRun: false });
      expect(result.ok, result.summary).toBe(true);
      const pages = context.project.maps[mapId]!.events.flatMap((event) => event.pages);
      expect(pages.length).toBeGreaterThan(0);
      for (const page of pages) {
        expect(page?.movement).toMatchObject({ type: "fixed", speed: expect.any(Number), frequency: expect.any(Number) });
      }
      expect(() => deserialize(serialize(context.project))).not.toThrow();
    });

    // 잠긴 문(쇠창살) 페이지는 그림을 고정한다 — 없으면 조사할 때 대화 방향 맞추기가 창살을 플레이어 쪽으로 돌려
    // 다른 칸(문짝 반쪽)이 그려졌다(폴른 스타 우물 쫐살문, fs-vqa-well D3).
    it("lay_dungeon_layout locked-door pages keep a fixed graphic and full movement", () => {
      const project = createBlankProject();
      project.tilesets.beodeul_city ??= createBeodeulCityTileset();
      const context: ToolContext = { project };
      const result = runTool(context, "lay_dungeon_layout", { layout: JSON.parse(JSON.stringify(WELL_SHAFT_LAYOUT)), id: "locked_probe", name: "잠긴 문 시험" }, { dryRun: false });
      expect(result.ok, result.summary).toBe(true);
      const locked = context.project.maps.locked_probe!.events.filter((event) => /_locked\d+$/u.test(event.id));
      expect(locked.length).toBeGreaterThan(0);
      for (const page of locked.flatMap((event) => event.pages)) {
        expect(page?.animationType).toBe("fixedGraphic");
        expect(page?.movement).toMatchObject({ type: "fixed", speed: expect.any(Number), frequency: expect.any(Number) });
      }
    });
  });
});
