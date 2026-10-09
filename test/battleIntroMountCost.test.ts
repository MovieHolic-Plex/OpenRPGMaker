/** @vitest-environment happy-dom */
// 첫 전투 진입 비용: 인트로가 있는 전투는 마운트 때 명령 화면을 먼저 그리고 숨은 버튼에 포커스를 주지 않는다.
// 실측(2026-09-28): 명령 상태로 syncView → 버튼 focus()(강제 레이아웃 약 64ms) → 곧바로 인트로로 갈아엎음.
import { describe, expect, it, vi } from "vitest";
import { createBattleRuntime } from "@/battle/runtime";
import { mountBattleScene } from "@/player/battleDom";
import { BATTLE_INTRO_MS } from "@/player/battleSequencer";
import { createScarloxyPokemonDemoProject } from "./support/scarloxyPokemonProject";
import { store } from "@/project/store";

function mount(introHold: boolean) {
  const project = createScarloxyPokemonDemoProject();
  store.replace(project);
  const host = document.createElement("div");
  document.body.append(host);
  const runtime = createBattleRuntime({ project, troopId: "troop_pkmn_grass_a", canEscape: true, canLose: true, rng: () => 0.5 });
  const focused: string[] = [];
  const original = HTMLElement.prototype.focus;
  const spy = vi.spyOn(HTMLElement.prototype, "focus").mockImplementation(function (this: HTMLElement, options?: FocusOptions) {
    focused.push(this.dataset.testid ?? this.className);
    return original.call(this, options);
  });
  const controller = mountBattleScene({ host, runtime, onResult: () => undefined, introHold });
  return { controller, runtime, focused, spy, host };
}

describe("첫 전투 마운트", () => {
  it("인트로 전투는 마운트 중 명령 버튼에 포커스를 주지 않고, 명령 국면이 되면 커서 버튼이 포커스를 갖는다", () => {
    vi.useFakeTimers();
    const { controller, runtime, focused, spy, host } = mount(true);
    try {
      expect(controller.root.dataset.battleDirectorStep).toBe("intro");
      expect(focused.filter((id) => id.startsWith("actor-command"))).toEqual([]);
      for (let i = 0; i < 10 && runtime.snapshot().phase !== "actorCommand"; i += 1) vi.advanceTimersByTime(BATTLE_INTRO_MS);
      vi.advanceTimersByTime(BATTLE_INTRO_MS);
      expect(controller.root.dataset.battleDirectorStep).toBe("command");
      const active = document.activeElement as HTMLElement | null;
      expect(active?.matches("button.battle-command[data-battle-command-cursor='true']")).toBe(true);
    } finally {
      controller.destroy();
      spy.mockRestore();
      host.remove();
      vi.useRealTimers();
    }
  });

  it("인트로 없는 전투는 마운트 즉시 명령 화면이고 커서 버튼이 포커스를 갖는다", () => {
    const { controller, spy, host } = mount(false);
    try {
      expect(controller.root.dataset.battleDirectorStep).toBe("command");
      const active = document.activeElement as HTMLElement | null;
      expect(active?.matches("button.battle-command[data-battle-command-cursor='true']")).toBe(true);
    } finally {
      controller.destroy();
      spy.mockRestore();
      host.remove();
    }
  });
});

