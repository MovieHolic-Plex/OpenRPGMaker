import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { renderCommandPreview } from "@/editor/panels/eventEditor/commandPreview";
import { eventCommandPickerTabEntries } from "@/editor/panels/eventEditor/commandPicker";
import {
  M2_PICKER_APPEARANCE_GROUP,
  M2_PICKER_BATTLE_GROUP,
  M2_PICKER_GROWTH_GROUP,
  M2_PICKER_PARTY_GROUP,
} from "@/project/eventCommands/m2PickerLayout";
import { findByTestId, installFakeDom, renderWithFakeDom, type FakeElement } from "./fakeDom";
import type { Command } from "@/project/types";

/**
 * 탭 2 「동료 · 전투」는 카탈로그 탭이 아니라 저작 작업면이다.
 * 계약: `.omo/plans/event-editor-actor-battle-adversarial-review.md`
 */
describe("picker tab 2 information architecture", () => {
  it("puts zero informational (unselectable) rows on the tab-2 grid", () => {
    const informational = eventCommandPickerTabEntries(2)
      .filter((entry) => !entry.selectable)
      .map((entry) => entry.commandId);

    expect(informational).toEqual([]);
    expect(eventCommandPickerTabEntries(2).length).toBeGreaterThan(0);
  });

  it("groups tab 2 by work surface, not by RM classification names", () => {
    const groups = [...new Set(eventCommandPickerTabEntries(2).map((entry) => entry.group))];

    expect(groups).not.toContain("배우/전투");
    expect(groups).not.toContain("전투 전용");
    expect(groups).not.toContain("시스템/고급");
    for (const group of groups) {
      expect([
        M2_PICKER_BATTLE_GROUP,
        M2_PICKER_PARTY_GROUP,
        M2_PICKER_GROWTH_GROUP,
        M2_PICKER_APPEARANCE_GROUP,
      ]).toContain(group);
    }
    expect(groups).toContain(M2_PICKER_BATTLE_GROUP);
    expect(groups).toContain(M2_PICKER_PARTY_GROUP);
  });
});

describe("actor and battle command previews are authoring surfaces", () => {
  function withProject<T>(run: () => T): T {
    const restore = installFakeDom();
    try {
      const project = createBlankProject();
      store.replace(project);
      return run();
    } finally {
      restore();
    }
  }

  function preview(cmd: Command): FakeElement {
    return renderWithFakeDom(() => renderCommandPreview(cmd));
  }

  it("renders a troop card with monster art and never the empty sword badge", () => {
    withProject(() => {
      const project = store.getCurrent();
      const troop = project.database.troops[0];
      expect(troop).toBeTruthy();
      const root = preview({
        kind: "battleProcessing",
        troopId: troop!.id,
        canEscape: true,
        canLose: false,
      });

      const card = findByTestId(root, "ecp-troop-card");
      expect(card).toBeTruthy();
      expect(card?.dataset.troopId).toBe(troop!.id);
      expect(findByTestId(root, "ecp-battle-field")).toBeTruthy();
      expect(findByTestId(root, "ecp-troop-card-name")?.textContent).toContain(troop!.name);
      // 몬스터 아트(또는 식별 가능한 이니셜) 가 최소 한 개.
      const enemyArt = root.querySelectorAll(".ecp-battle-enemy, .ecp-battle-enemy-fallback");
      expect(enemyArt.length).toBeGreaterThanOrEqual(1);
      expect(root.querySelectorAll(".ecp-battle-badge")).toHaveLength(0);
      expect(root.textContent).not.toContain("⚔");
      expect(root.querySelectorAll(".ecp-summary-card")).toHaveLength(0);
    });
  });

  it("says what is missing instead of drawing an empty sword when no troop is chosen", () => {
    withProject(() => {
      const root = preview({ kind: "battleProcessing", troopId: "", canEscape: true, canLose: false });

      expect(findByTestId(root, "ecp-battle-enemy-missing")).toBeTruthy();
      expect(root.querySelectorAll(".ecp-battle-badge")).toHaveLength(0);
      expect(findByTestId(root, "ecp-battle-empty-warn")).toBeTruthy();
    });
  });

  it("shows party membership as before/after face chips", () => {
    withProject(() => {
      const actorId = store.getCurrent().database.actors[0]?.id ?? "";
      const root = preview({ kind: "changeParty", actorId, action: "add" });

      expect(findByTestId(root, "ecp-party-stage")?.dataset.partyAction).toBe("add");
      expect(findByTestId(root, "ecp-party-before")).toBeTruthy();
      expect(findByTestId(root, "ecp-party-after")).toBeTruthy();
      expect(root.querySelectorAll(".ecp-party-chip").length).toBeGreaterThanOrEqual(2);
      // 얼굴 칩은 faceset 크롭을 품는다.
      expect(root.querySelectorAll(".event-command-face-crop-shell").length).toBeGreaterThanOrEqual(2);
      expect(root.querySelectorAll(".ecp-summary-card")).toHaveLength(0);
    });
  });

  it("renders HP and MP as gauges rather than an `HP -= 10` summary card", () => {
    withProject(() => {
      const actorId = store.getCurrent().database.actors[0]?.id ?? "";
      const hp = preview({ kind: "changeActorHp", actorId, op: "-=", amount: 10 });
      const mp = preview({ kind: "changeActorMp", actorId, op: "+=", amount: 5 });

      expect(findByTestId(hp, "ecp-hp-gauge-stage")).toBeTruthy();
      expect(findByTestId(hp, "ecp-gauge-hp")).toBeTruthy();
      expect(findByTestId(hp, "ecp-gauge-numbers-hp")?.textContent).toContain("→");
      expect(hp.querySelectorAll(".ecp-gauge-fill").length).toBeGreaterThanOrEqual(1);
      expect(hp.querySelectorAll(".ecp-summary-card")).toHaveLength(0);

      expect(findByTestId(mp, "ecp-mp-gauge-stage")).toBeTruthy();
      expect(findByTestId(mp, "ecp-gauge-mp")).toBeTruthy();
      expect(mp.querySelectorAll(".ecp-summary-card")).toHaveLength(0);
    });
  });

  it("renders EXP, level, and recovery as gauges", () => {
    withProject(() => {
      const actorId = store.getCurrent().database.actors[0]?.id ?? "";
      const exp = preview({ kind: "changeExp", actorId, op: "+=", amount: 40 });
      const level = preview({ kind: "changeLevel", actorId, op: "+=", amount: 2 });
      const recover = preview({ kind: "recoverAll", actorId: "" });

      expect(findByTestId(exp, "ecp-exp-gauge-stage")).toBeTruthy();
      expect(findByTestId(exp, "ecp-gauge-exp")).toBeTruthy();
      expect(findByTestId(level, "ecp-gauge-level")).toBeTruthy();
      expect(findByTestId(recover, "ecp-recover-all-stage")).toBeTruthy();
      expect(findByTestId(recover, "ecp-gauge-mp")).toBeTruthy();
      for (const root of [exp, level, recover]) {
        expect(root.querySelectorAll(".ecp-summary-card")).toHaveLength(0);
      }
    });
  });

  it("previews a face change as a faceset crop, not a summary fallback", () => {
    withProject(() => {
      const actorId = store.getCurrent().database.actors[0]?.id ?? "";
      const root = preview({
        kind: "m2Command",
        commandId: "m2-025-change-actor-faceset",
        fields: { target: actorId, value: "easyrpg-faceset-actor1-02" },
      });

      expect(findByTestId(root, "ecp-faceset-change-stage")).toBeTruthy();
      const after = findByTestId(root, "ecp-faceset-after");
      expect(after).toBeTruthy();
      expect(after?.querySelectorAll(".event-command-face-crop-shell").length).toBeGreaterThanOrEqual(1);
      // 낱장 얼굴 모델: 캡션은 주인공 이름 + "얼굴" 이고 칸 순번을 말하지 않는다.
      const caption = findByTestId(root, "ecp-faceset-change-caption")?.textContent ?? "";
      expect(caption).toContain("얼굴");
      expect(caption).not.toContain("얼굴 미선택");
      expect(caption).not.toMatch(/얼굴\s*\d/);
      expect(root.querySelectorAll(".ecp-summary-card")).toHaveLength(0);
    });
  });

  it("keeps parameter, damage, and state edits off the summary fallback", () => {
    withProject(() => {
      const actorId = store.getCurrent().database.actors[0]?.id ?? "";
      const parameters = preview({
        kind: "m2Command",
        commandId: "m2-014-change-parameters",
        fields: { target: actorId, parameter: "attack", operation: "add", value: 12, valueSource: "number" },
      });
      const damage = preview({
        kind: "m2Command",
        commandId: "m2-021-damage-processing",
        fields: { target: actorId, operation: "add", value: 30, valueSource: "number" },
      });

      expect(findByTestId(parameters, "ecp-parameter-gauge-stage")).toBeTruthy();
      expect(findByTestId(parameters, "ecp-gauge-param")).toBeTruthy();
      expect(findByTestId(damage, "ecp-damage-gauge-stage")).toBeTruthy();
      expect(findByTestId(damage, "ecp-gauge-hp")).toBeTruthy();
      for (const root of [parameters, damage]) {
        expect(root.querySelectorAll(".ecp-summary-card")).toHaveLength(0);
      }
    });
  });
});
