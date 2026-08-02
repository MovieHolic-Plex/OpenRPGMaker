/** @vitest-environment happy-dom */
import { describe, expect, it } from "vitest";
import { createBattleRuntime } from "@/battle/runtime";
import { battleField } from "@/player/battleFieldDom";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";

describe("전투 적 그래픽 정합성", () => {
  it("스킨의 공용 적 이미지보다 각 적 레코드의 몬스터 이미지를 우선한다", () => {
    const project = createBlankProject();
    const troop = project.database.troops.find((record) => record.id === "troop_golem_guard");
    if (!troop) throw new Error("missing troop_golem_guard fixture");
    troop.previewBackgroundResourceId = "scarloxy-backdrop-ice";
    store.replace(project);
    const runtime = createBattleRuntime({
      project,
      troopId: "troop_golem_guard",
      canEscape: true,
      canLose: false,
      rng: () => 0,
    });

    const field = battleField(runtime.snapshot());

    expect(field.querySelector<HTMLElement>("[data-testid='battle-backdrop']")?.dataset.backdropResourceId)
      .toBe("scarloxy-backdrop-ice");
    // 계약: 스킨 공용 적 이미지가 아니라 각 적 레코드의 몬스터 리소스가 우선한다.
    // (석상 수호병 트룹 구성은 박쥐+골렘+박쥐 — 예전 단언의 슬라임은 낡은 구성이었다.)
    expect(
      field.querySelector<HTMLImageElement>(
        '[data-record-id="enemy_stone_golem"] .battle-enemy-image',
      )?.src,
    ).toContain("monster-golem-01.png");
    expect(
      field.querySelector<HTMLImageElement>(
        '[data-record-id="enemy_cave_bat"] .battle-enemy-image',
      )?.src,
    ).toContain("monster-bat-01.png");
  });
});
