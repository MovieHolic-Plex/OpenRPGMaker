/** @vitest-environment happy-dom */
import { describe, expect, it } from "vitest";
import { createBattleRuntime, type BattleSnapshot } from "@/battle/runtime";
import { applyBattlerPoseForTest, battleField, syncBattleField } from "@/player/battleFieldDom";
import { deserialize } from "@/project/io";
import { store } from "@/project/store";
import battleFixture from "./fixtures/projects/battle-v3.json";

// 이 테스트가 지키는 것: **올린 전투 캐릭터 시트(kind battleCharset)는 id 가 아니라 시트 모양으로 잘린다.**
// 스토어 「OPRN Battlers — Party Classes」 팩의 144×384(48px 3열×8행) 시트가 번들 id 표(charsetBattler)에 없다는 이유로
// 통짜 <img> 로 서서, 전투 화면 오른쪽에 24칸이 한꺼번에 깔리고 움직이지 않았다(2026-10-31 스토어 검증).
const SHEET_ID = "store_party_pack__oprn-party-mage";

function renderWith(meta: Record<string, number>, kind = "battleCharset"): HTMLElement {
  const project = deserialize(JSON.stringify(battleFixture));
  project.assets.uploaded[SHEET_ID] = {
    id: SHEET_ID, name: "마법사", kind: kind as "battleCharset",
    dataUrl: "data:image/png;base64,iVBORw0KGgo=", meta,
  };
  store.replace(project);
  const runtime = createBattleRuntime({ project, troopId: "troop_slime", canEscape: true, canLose: true, rng: () => 0.5 });
  const snapshot: BattleSnapshot = runtime.snapshot();
  (snapshot.actors[0] as { battleCharacterResourceId?: string }).battleCharacterResourceId = SHEET_ID;
  const field = battleField(snapshot);
  syncBattleField(field, snapshot);
  return field;
}

const node = (field: HTMLElement) => field.querySelector<HTMLElement>(`[data-battle-charset-resource-id="${SHEET_ID}"]`);

describe("올린 battleCharset 시트", () => {
  it("3열×8행 시트는 칸을 잘라 24포즈 확장 시트로 선다", () => {
    const field = renderWith({ width: 144, height: 384, frameWidth: 48, frameHeight: 48, frames: 24 });
    const actor = node(field)!;
    expect(actor.dataset.battlerExtended).toBe("true");
    expect(actor.querySelector(".battle-actor-image")).toBeNull();
    const sprite = actor.querySelector<HTMLElement>(".battle-actor-sprite")!;
    expect(sprite.style.backgroundSize).toBe("288px 768px");
    applyBattlerPoseForTest(actor, "attack");
    expect(actor.dataset.battlePoseFrame).toBe("attack");
    expect(sprite.style.backgroundPosition).toBe("-96px 0px");
    applyBattlerPoseForTest(actor, "dead");
    expect(sprite.style.backgroundPosition).toBe("-96px -96px");
  });

  it("3열×2행 시트는 5포즈 시트로 잘린다(확장 아님)", () => {
    const actor = node(renderWith({ width: 144, height: 96, frameWidth: 48, frameHeight: 48 }))!;
    expect(actor.dataset.battlerExtended).toBeUndefined();
    expect(actor.querySelector<HTMLElement>(".battle-actor-sprite")?.style.backgroundSize).toBe("288px 192px");
  });

  it("칸 격자가 아닌 그림은 예전처럼 한 장으로 선다", () => {
    const actor = node(renderWith({ width: 100, height: 130 }))!;
    expect(actor.querySelector(".battle-actor-image")).not.toBeNull();
    expect(actor.querySelector(".battle-actor-sprite")).toBeNull();
  });
});
