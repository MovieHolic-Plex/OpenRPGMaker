/** @vitest-environment happy-dom */
// 첫 전투 CSS 준비(warmBattleStyles)는 흔적을 남기지 않는다: 호스트 DOM·포커스·배경 물결 루프.
import { afterEach, describe, expect, it, vi } from "vitest";
import { createBattleRuntime } from "@/battle/runtime";
import { warmBattleStyles } from "@/player/battleStyleWarmup";
import { createScarloxyPokemonDemoProject } from "./support/scarloxyPokemonProject";
import { store } from "@/project/store";

afterEach(() => { vi.restoreAllMocks(); document.body.replaceChildren(); });

describe("전투 CSS 준비", () => {
  it("실제 전투 DOM 을 한 번 붙였다 떼고, 호스트·포커스·rAF 를 남기지 않는다", () => {
    const project = createScarloxyPokemonDemoProject();
    store.replace(project);
    const runtime = createBattleRuntime({ project, troopId: "troop_pkmn_grass_a", canEscape: true, canLose: true, rng: () => 0.5 });
    const host = document.createElement("div");
    const keep = document.createElement("button");
    host.append(keep);
    document.body.append(host);
    keep.focus();
    const appended: Node[] = [];
    const original = host.append.bind(host);
    vi.spyOn(host, "append").mockImplementation((...nodes: (Node | string)[]) => { appended.push(...nodes.filter((n): n is Node => typeof n !== "string")); original(...nodes); });
    const raf = vi.spyOn(globalThis, "requestAnimationFrame");
    const cancel = vi.spyOn(globalThis, "cancelAnimationFrame");

    warmBattleStyles(host, runtime.snapshot());

    expect(appended).toHaveLength(1);
    const stage = appended[0] as HTMLElement;
    expect(stage.querySelector(".battle-field")).not.toBeNull();
    expect(stage.querySelector(".battle-party")).not.toBeNull();
    expect(stage.getAttribute("aria-hidden")).toBe("true");
    expect(stage.isConnected).toBe(false);
    expect([...host.childNodes]).toEqual([keep]);
    expect(document.activeElement).toBe(keep);
    // 배경 물결처럼 rAF 루프를 건 게 있으면 모두 취소했다.
    expect(cancel.mock.calls.length).toBeGreaterThanOrEqual(raf.mock.calls.length);
    runtime.cancel();
  });

  it("연결되지 않은 호스트에는 아무것도 하지 않는다", () => {
    const project = createScarloxyPokemonDemoProject();
    store.replace(project);
    const runtime = createBattleRuntime({ project, troopId: "troop_pkmn_grass_a", canEscape: true, canLose: true, rng: () => 0.5 });
    const host = document.createElement("div");
    warmBattleStyles(host, runtime.snapshot());
    expect(host.childNodes).toHaveLength(0);
    runtime.cancel();
  });
});

