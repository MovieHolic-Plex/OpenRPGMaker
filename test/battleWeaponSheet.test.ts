import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import contactBounds from "@/assets/battleContactBounds.json";
import { actorBattlers, battlerSnapshot, refreshActorBattlerDerivedStats } from "@/battle/battleBattlers";
import { actorBattleSheetForEquipment } from "@/battle/battleWeaponSheet";
import { normalizeWeaponBattleSheets } from "@/project/actorModel";
import { normalizeEquipmentRecord } from "@/project/databaseRecordModel";
import { createBlankProject } from "@/project/defaults/blankProject";
import { FS_WEAPON_BATTLE_SHEETS, applyFallenHeroSkillIdentity } from "@/project/flagship/fallen/heroSkillIdentity";
import { deserialize, serialize } from "@/project/io";
import { startSession } from "@/project/session";
import type { Project } from "@/project/types";

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
