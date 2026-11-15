/** @vitest-environment happy-dom */
import { describe, expect, it } from "vitest";
import { createBattleRuntime, type BattleSnapshot } from "@/battle/runtime";
import { battleField, syncBattleField } from "@/player/battleFieldDom";
import { deserialize } from "@/project/io";
import { store } from "@/project/store";
import battleFixture from "./fixtures/projects/battle-v3.json";

// 전투 중 무기를 바꿔 전투 시트가 달라지면(battleWeaponSheet.ts) 그 배우 그림만 새 시트로 다시 세운다 — 다음 자세부터 창을 든다.
// 변신(transformResourceId)과 달리 연기 펑 연출(battle-actor-transformed)은 붙이지 않는다.
const BASE = "charset-battler-actor1-0";
const SPEAR = "charset-battler-actor1-0-spear";

function snapshotWithSheet(sheet: string): BattleSnapshot {
  const project = deserialize(JSON.stringify(battleFixture));
  store.replace(project);
  const snapshot = createBattleRuntime({ project, troopId: "troop_slime", canEscape: true, canLose: true, rng: () => 0.5 }).snapshot();
  // 스냅샷은 타입만 readonly 인 순수 객체다. 시트 id 만 갈아 표시 경로를 태운다.
  (snapshot.actors[0] as { battleCharacterResourceId?: string }).battleCharacterResourceId = sheet;
  return snapshot;
}

function actorNodeOf(field: HTMLElement, snapshot: BattleSnapshot): HTMLElement {
  const node = field.querySelector<HTMLElement>(`[data-testid="battle-actor-${snapshot.actors[0]!.recordId}"]`);
  if (!node) throw new Error("아군 배틀러 노드가 없다");
  return node;
}

describe("전투 중 무기 시트 바꾸기(표시)", () => {
  it("시트가 달라진 배우만 새 그림으로 다시 세운다 — 변신 연출 없이", () => {
    const sword = snapshotWithSheet(BASE);
    const field = battleField(sword);
    syncBattleField(field, sword);
    const before = actorNodeOf(field, sword);
    expect(before.dataset.battleSheet).toBe(BASE);
    expect(before.outerHTML).toContain("actor1-0.png");
    expect(before.outerHTML).not.toContain("actor1-0-spear");

    // 같은 시트로 다시 그리면 노드를 그대로 쓴다.
    syncBattleField(field, sword);
    expect(actorNodeOf(field, sword)).toBe(before);

    const spear = snapshotWithSheet(SPEAR);
    syncBattleField(field, spear);
    const after = actorNodeOf(field, spear);
    expect(after).not.toBe(before);
    expect(after.dataset.battleSheet).toBe(SPEAR);
    expect(after.outerHTML).toContain("actor1-0-spear.png");
    expect(after.classList.contains("battle-actor-transformed")).toBe(false);
    expect(field.querySelectorAll(`[data-testid="battle-actor-${spear.actors[0]!.recordId}"]`)).toHaveLength(1);

    // 검으로 돌아오면 다시 검 시트.
    syncBattleField(field, sword);
    const back = actorNodeOf(field, sword);
    expect(back.dataset.battleSheet).toBe(BASE);
    expect(back.outerHTML).not.toContain("actor1-0-spear");
  });
});
