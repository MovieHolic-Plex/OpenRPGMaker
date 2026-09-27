/** @vitest-environment happy-dom */
import { describe, expect, it, vi } from "vitest";
import { mountBattleScene } from "@/player/battleDom";
import { renderSystemTab } from "@/editor/panels/databaseSystemView";
import { store } from "@/project/store";
import { deserialize, serialize } from "@/project/io";
import { findByTestId, installFakeDom } from "./fakeDom";
import { createBlankProject } from "@/project/defaults";
import { createBattleRuntime, type BattleSnapshot } from "@/battle/runtime";
import { battlePartyStatus, syncBattleParty } from "@/player/battleFieldDom";
import {
  applyRollingHpSurvival,
  createRollingHpMeter,
  DEFAULT_ROLLING_HP_PER_SECOND,
  normalizeRollingHpSpeed,
  startRollingHpTicker,
} from "@/player/rollingHp";
import { normalizeSystemRecords } from "@/project/databaseRecordModel";

// 마더(EarthBound)식 롤링 HP: 표시 HP 가 실제 HP 쪽으로 초당 N 만큼 흐르고, 치명타를 받은 아군은
// 미터가 0 에 닿기 전까지 「쓰러지는 중」이며, 그 사이 전투가 끝나면 미터에 남은 HP 로 살아남는다.

function battleSnapshot(): BattleSnapshot {
  const project = createBlankProject();
  const actor = project.database.actors[0];
  const troop = project.database.troops[0];
  if (!actor || !troop) throw new Error("Missing rolling HP fixture records");
  const runtime = createBattleRuntime({
    project, troopId: troop.id, canEscape: true, canLose: true, rng: () => 0.5,
    party: { partyActorIds: [actor.id], levels: { [actor.id]: 5 }, experience: {} },
  });
  const snapshot = runtime.snapshot();
  const first = snapshot.actors[0]!;
  return { ...snapshot, actors: [{ ...first, maxHp: 100, hp: 100, defeated: false }] };
}

function withActorHp(snapshot: BattleSnapshot, hp: number): BattleSnapshot {
  return { ...snapshot, actors: snapshot.actors.map((actor) => ({ ...actor, hp, defeated: hp <= 0 })) };
}

function hpText(party: HTMLElement): string {
  return party.querySelector(".battle-actor-hp .battle-vital-value")?.textContent?.trim() ?? "";
}

describe("rolling HP meter model", () => {
  it("rolls displayed HP toward the target at the configured speed", () => {
    const meter = createRollingHpMeter({ perSecond: 50, nowMs: 0 });
    expect(meter.setTarget("a", 100, 100)).toBe(100);
    expect(meter.setTarget("a", 20, 100)).toBe(100);
    meter.advance(1000);
    expect(meter.displayed("a")).toBe(50);
    meter.advance(1500);
    expect(meter.displayed("a")).toBe(25);
    meter.advance(5000);
    expect(meter.displayed("a")).toBe(20);
    expect(meter.isRolling()).toBe(false);
  });

  it("rolls healing upward as well", () => {
    const meter = createRollingHpMeter({ perSecond: 10, nowMs: 0 });
    meter.setTarget("a", 10, 100);
    meter.setTarget("a", 60, 100);
    meter.advance(2000);
    expect(meter.displayed("a")).toBe(30);
  });

  it("marks a lethally hit actor as dying until the meter reaches zero", () => {
    const meter = createRollingHpMeter({ perSecond: 40, nowMs: 0 });
    meter.setTarget("a", 80, 100);
    meter.setTarget("a", 0, 100);
    expect(meter.isDying("a")).toBe(true);
    meter.advance(1000);
    expect(meter.displayed("a")).toBe(40);
    expect(meter.isDying("a")).toBe(true);
    meter.advance(2000);
    expect(meter.displayed("a")).toBe(0);
    expect(meter.isDying("a")).toBe(false);
  });

  it("stops rolling once frozen at the result screen", () => {
    const meter = createRollingHpMeter({ perSecond: 40, nowMs: 0 });
    meter.setTarget("a", 80, 100);
    meter.setTarget("a", 0, 100);
    meter.advance(1000);
    meter.freeze();
    meter.advance(9000);
    meter.setTarget("a", 0, 100);
    expect(meter.displayed("a")).toBe(40);
    expect(meter.isRolling()).toBe(false);
  });

  it("settles to the real HP on defeat so no dying cue lingers", () => {
    const meter = createRollingHpMeter({ perSecond: 5, nowMs: 0 });
    meter.setTarget("a", 514, 514);
    meter.setTarget("a", 0, 514);
    meter.advance(2000);
    expect(meter.displayed("a")).toBe(504);
    meter.settle();
    expect(meter.displayed("a")).toBe(0);
    expect(meter.isDying("a")).toBe(false);
    meter.setTarget("a", 100, 514);
    expect(meter.displayed("a")).toBe(0);
  });

  it("clamps the speed to 1..999 and defaults to 40", () => {
    expect(normalizeRollingHpSpeed(undefined)).toBe(DEFAULT_ROLLING_HP_PER_SECOND);
    expect(normalizeRollingHpSpeed(0)).toBe(1);
    expect(normalizeRollingHpSpeed(5000)).toBe(999);
    expect(normalizeRollingHpSpeed(Number.NaN)).toBe(40);
  });
});

describe("rolling HP survival settlement", () => {
  it("survives lethal damage when the battle is won before the meter reaches zero", () => {
    const base = battleSnapshot();
    const actorId = base.actors[0]!.recordId;
    const meter = createRollingHpMeter({ perSecond: 40, nowMs: 0 });
    meter.setTarget(actorId, 100, 100);
    meter.setTarget(actorId, 0, 100);
    meter.advance(1000);
    meter.freeze();
    const dead = withActorHp(base, 0);
    const settled = applyRollingHpSurvival("victory", dead, meter);
    expect(settled.actors[0]).toMatchObject({ hp: 60, defeated: false });
    expect(dead.actors[0]!.hp).toBe(0);
  });

  it("also settles an escape, but never a defeat", () => {
    const base = battleSnapshot();
    const actorId = base.actors[0]!.recordId;
    const meter = createRollingHpMeter({ perSecond: 40, nowMs: 0 });
    meter.setTarget(actorId, 100, 100);
    meter.setTarget(actorId, 0, 100);
    meter.advance(500);
    const dead = withActorHp(base, 0);
    expect(applyRollingHpSurvival("escape", dead, meter).actors[0]!.hp).toBe(80);
    expect(applyRollingHpSurvival("defeat", dead, meter)).toBe(dead);
  });

  it("keeps real HP when a heal is still rolling up (never settles below the real value)", () => {
    const base = battleSnapshot();
    const actorId = base.actors[0]!.recordId;
    const meter = createRollingHpMeter({ perSecond: 10, nowMs: 0 });
    meter.setTarget(actorId, 10, 100);
    meter.setTarget(actorId, 90, 100);
    meter.advance(1000);
    const healed = withActorHp(base, 90);
    expect(applyRollingHpSurvival("victory", healed, meter).actors[0]!.hp).toBe(90);
  });

  it("leaves the snapshot untouched without a meter (legacy projects)", () => {
    const dead = withActorHp(battleSnapshot(), 0);
    expect(applyRollingHpSurvival("victory", dead, undefined)).toBe(dead);
  });
});

describe("party HUD with the rolling HP meter", () => {
  it("shows the meter value and a dying cue instead of the instant HP", () => {
    const base = battleSnapshot();
    const party = battlePartyStatus(base);
    const meter = createRollingHpMeter({ perSecond: 40, nowMs: 0 });
    syncBattleParty(party, base, { rollingHp: meter });
    expect(hpText(party)).toBe("100");

    const lethal = withActorHp(base, 0);
    syncBattleParty(party, lethal, { rollingHp: meter });
    const row = party.querySelector<HTMLElement>(".battle-actor-status")!;
    expect(hpText(party)).toBe("100");
    expect(row.dataset.rollingHpDying).toBe("true");
    expect(row.classList.contains("defeated")).toBe(false);

    meter.advance(1000);
    syncBattleParty(party, lethal, { rollingHp: meter });
    expect(hpText(party)).toBe("60");

    meter.advance(3500);
    syncBattleParty(party, lethal, { rollingHp: meter });
    expect(hpText(party)).toBe("0");
    expect(row.dataset.rollingHpDying).toBeUndefined();
    expect(row.classList.contains("defeated")).toBe(true);
  });

  it("shows a frozen survivor as alive without the dying cue on the result screen", () => {
    const base = battleSnapshot();
    const party = battlePartyStatus(base);
    const meter = createRollingHpMeter({ perSecond: 40, nowMs: 0 });
    syncBattleParty(party, base, { rollingHp: meter });
    const lethal = withActorHp(base, 0);
    syncBattleParty(party, lethal, { rollingHp: meter });
    meter.advance(1000);
    meter.freeze();
    syncBattleParty(party, lethal, { rollingHp: meter });
    const row = party.querySelector<HTMLElement>(".battle-actor-status")!;
    expect(hpText(party)).toBe("60");
    expect(row.dataset.rollingHpDying).toBeUndefined();
    expect(row.classList.contains("defeated")).toBe(false);
  });

  it("shows the instant HP without a meter", () => {
    const base = battleSnapshot();
    const party = battlePartyStatus(base);
    syncBattleParty(party, withActorHp(base, 0));
    expect(hpText(party)).toBe("0");
    expect(party.querySelector<HTMLElement>(".battle-actor-status")!.classList.contains("defeated")).toBe(true);
  });
});

describe("rolling HP ticker", () => {
  it("drives frames only while rolling and renders on each visible change", () => {
    const callbacks: ((now: number) => void)[] = [];
    const scheduler = {
      request: (callback: (now: number) => void) => { callbacks.push(callback); return callbacks.length; },
      cancel: () => undefined,
    };
    const meter = createRollingHpMeter({ perSecond: 100 });
    meter.setTarget("a", 100, 100);
    let renders = 0;
    const ticker = startRollingHpTicker(meter, () => { renders += 1; }, scheduler);
    ticker.kick();
    expect(callbacks).toHaveLength(0);

    meter.setTarget("a", 50, 100);
    ticker.kick();
    ticker.kick();
    expect(callbacks).toHaveLength(1);
    callbacks.shift()!(1000);
    expect(meter.displayed("a")).toBe(100);
    callbacks.shift()!(1250);
    expect(meter.displayed("a")).toBe(75);
    callbacks.shift()!(2000);
    expect(meter.displayed("a")).toBe(50);
    expect(renders).toBe(2);
    expect(callbacks).toHaveLength(0);
    ticker.stop();
  });
});

describe("rolling HP system settings round-trip", () => {
  it("keeps explicit settings and omits defaults", () => {
    const system = createBlankProject().system;
    const kept = normalizeSystemRecords({ ...system, battleRollingHp: true, battleRollingHpPerSecond: 2000 });
    expect(kept.battleRollingHp).toBe(true);
    expect(kept.battleRollingHpPerSecond).toBe(999);
    const legacy = normalizeSystemRecords({ ...system });
    expect("battleRollingHp" in legacy).toBe(false);
    expect("battleRollingHpPerSecond" in legacy).toBe(false);
  });
});

describe("battle scene settles rolling HP on the confirmed result", () => {
  async function runLethalVictory(rolling: boolean): Promise<{ hp: number; defeated: boolean; rollingAttr?: string }> {
    const project = createBlankProject();
    if (rolling) {
      project.system.battleRollingHp = true;
      // 가장 느린 속도 — 결과가 뜰 때까지 미터가 거의 내려가지 않는다(치명타 생존).
      project.system.battleRollingHpPerSecond = 1;
    }
    store.replace(project);
    const actor = project.database.actors[0]!;
    const troop = project.database.troops[0]!;
    const real = createBattleRuntime({
      project, troopId: troop.id, canEscape: true, canLose: true, rng: () => 0.5,
      party: { partyActorIds: [actor.id], levels: { [actor.id]: 5 }, experience: {} },
    });
    const start = real.snapshot();
    const alive: BattleSnapshot = {
      ...start,
      phase: "charging",
      result: undefined,
      actors: start.actors.map((entry) => ({ ...entry, maxHp: 100, hp: 100, defeated: false })),
    };
    // 한 틱 뒤 치명타 + 같은 라운드 승리: 규칙 엔진 스냅샷은 HP 0 이다.
    const won: BattleSnapshot = {
      ...alive,
      result: "victory",
      actors: alive.actors.map((entry) => ({ ...entry, hp: 0, defeated: true })),
    };
    let current = alive;
    const runtime = { ...real, snapshot: () => current, tick: () => { current = won; }, cancel: () => undefined };
    vi.useFakeTimers();
    const host = document.createElement("div");
    document.body.append(host);
    let settled: BattleSnapshot | undefined;
    const controller = mountBattleScene({
      host, runtime, introHold: false,
      onResult: (_result, snapshot) => { settled = snapshot; },
    });
    try {
      const rollingAttr = controller.root.dataset.battleRollingHp;
      await vi.advanceTimersByTimeAsync(20_000);
      // 결과 확정 입력(첫 확인 = 보상 공개, 둘째 = 닫기).
      for (let press = 0; press < 4 && !settled; press += 1) {
        window.dispatchEvent(new KeyboardEvent("keydown", { key: "z", bubbles: true }));
        await vi.advanceTimersByTimeAsync(1_000);
      }
      if (!settled) throw new Error("battle result was never confirmed");
      const shown = settled.actors[0]!;
      return { hp: shown.hp, defeated: shown.defeated, rollingAttr };
    } finally {
      controller.destroy();
      host.remove();
      vi.useRealTimers();
    }
  }

  it("passes the meter HP to onResult so the actor survives a lethal hit", async () => {
    const outcome = await runLethalVictory(true);
    expect(outcome.rollingAttr).toBe("true");
    expect(outcome.defeated).toBe(false);
    expect(outcome.hp).toBeGreaterThan(80);
  });

  it("keeps the engine's lethal HP when the option is off", async () => {
    const outcome = await runLethalVictory(false);
    expect(outcome.rollingAttr).toBeUndefined();
    expect(outcome).toMatchObject({ hp: 0, defeated: true });
  });
});

describe("rolling HP editor exposure", () => {
  it("lets an author turn the meter on and set its speed in the system battle settings", () => {
    const restore = installFakeDom();
    try {
      store.replace(createBlankProject());
      const host = document.createElement("div");
      const rerender = (): void => { host.replaceChildren(); renderSystemTab(host, rerender); };
      rerender();
      const toggle = findByTestId(host as never, "db-field-system-rolling-hp") as unknown as HTMLInputElement;
      const speedRow = () => findByTestId(host as never, "db-field-system-rolling-hp-speed") as unknown as HTMLInputElement;
      expect(toggle.checked).toBe(false);
      expect(speedRow().getAttribute("disabled")).not.toBeNull();

      toggle.checked = true;
      toggle.dispatchEvent(new Event("change"));
      expect(store.getCurrent().system.battleRollingHp).toBe(true);
      expect(speedRow().getAttribute("disabled")).toBeNull();

      const speed = speedRow();
      speed.value = "120";
      speed.dispatchEvent(new Event("input"));
      expect(store.getCurrent().system.battleRollingHpPerSecond).toBe(120);

      const reloaded = deserialize(serialize(store.getCurrent()));
      expect(reloaded.system.battleRollingHp).toBe(true);
      expect(reloaded.system.battleRollingHpPerSecond).toBe(120);
    } finally {
      restore();
    }
  });
});
