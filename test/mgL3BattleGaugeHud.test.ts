/** @vitest-environment happy-dom */
// 전투 HUD 의 리미트·기력·파티 게이지(#9 #16 #21). 켠 전투만 행을 만들고, 값이 바뀌면 같은 노드를 갱신한다.
import { describe, expect, it } from "vitest";
import { createBattleRuntime, type BattleSnapshot } from "@/battle/runtime";
import { battlePartyStatus, syncBattleParty } from "@/player/battleFieldDom";
import { deserialize } from "@/project/io";
import { store } from "@/project/store";
import type { Project } from "@/project/types";
import battleFixture from "./fixtures/projects/battle-v3.json";

function snapshotFor(configure: (project: Project) => void): BattleSnapshot {
  const project = deserialize(JSON.stringify(battleFixture));
  configure(project);
  store.replace(project);
  return createBattleRuntime({ project, troopId: "troop_slime", canEscape: true, canLose: true, rng: () => 0.5 }).snapshot();
}

describe("battle HUD resource gauges", () => {
  it("renders no gauge rows for legacy projects", () => {
    const party = battlePartyStatus(snapshotFor(() => {}));
    expect(party.querySelector(".battle-resource-gauge")).toBeNull();
    expect(party.querySelector("[data-testid='battle-party-gauge']")).toBeNull();
  });

  it("renders labelled limit/resource2 meters per actor and a party gauge row, then updates them in place", () => {
    const before = snapshotFor((project) => {
      project.system.limitGauge = { enabled: true, label: "오버드라이브" };
      project.system.resource2 = { enabled: true, max: 50, start: 10 };
      project.system.partyGauge = { enabled: true, max: 80, label: "추격" };
    });
    const party = battlePartyStatus(before);
    const limit = party.querySelector<HTMLElement>("[data-testid='battle-limit-gauge-actor_hero']");
    const resource2 = party.querySelector<HTMLElement>("[data-testid='battle-resource2-gauge-actor_hero']");
    const shared = party.querySelector<HTMLElement>("[data-testid='battle-party-gauge']");
    expect(limit?.getAttribute("role")).toBe("meter");
    expect(limit?.getAttribute("aria-label")).toBe("오버드라이브");
    expect(limit?.querySelector(".battle-resource-gauge-value")?.textContent).toBe("0/100");
    expect(resource2?.getAttribute("aria-label")).toBe("기력");
    expect(resource2?.querySelector(".battle-resource-gauge-value")?.textContent).toBe("10/50");
    expect(shared?.querySelector(".battle-resource-gauge-label")?.textContent).toBe("추격");
    expect(shared?.getAttribute("aria-valuenow")).toBe("0");

    const after: BattleSnapshot = {
      ...before,
      partyGauge: 80,
      actors: before.actors.map((actor) => ({ ...actor, limitGauge: 100, resource2: 25 })),
    };
    syncBattleParty(party, after);
    expect(party.querySelector("[data-testid='battle-limit-gauge-actor_hero']")).toBe(limit);
    expect(limit?.classList.contains("is-full")).toBe(true);
    expect(limit?.querySelector<HTMLElement>(".battle-resource-gauge-bar")?.style.getPropertyValue("--battle-stat")).toBe("100%");
    expect(resource2?.getAttribute("aria-valuenow")).toBe("25");
    expect(party.querySelector("[data-testid='battle-party-gauge']")).toBe(shared);
    expect(shared?.classList.contains("is-full")).toBe(true);
    expect(party.querySelectorAll("[data-testid='battle-party-gauge']")).toHaveLength(1);
  });
});
