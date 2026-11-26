// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { BATTLE_CONDITION_SESSION_STATE_FIELDS } from "@/battle/battleEvents";
import type { BattleRuntimeOptions } from "@/battle/types";
import { createBlankProject } from "@/project/defaults";
import { startSession } from "@/project/session";
import { store } from "@/project/store";

const battleMocks = vi.hoisted(() => ({
  createBattleRuntime: vi.fn(),
}));

vi.mock("@/battle/runtime", () => ({
  createBattleRuntime: battleMocks.createBattleRuntime,
}));

import { playBattle } from "@/player/playSceneBattle";

const previousProject = structuredClone(store.getCurrent());

afterEach(() => {
  battleMocks.createBattleRuntime.mockReset();
  store.replaceProject(structuredClone(previousProject));
  document.body.replaceChildren();
});

describe("play-to-battle condition state bridge", () => {
  it("supplies every session field consumed by battle condition evaluation", () => {
    const project = createBlankProject();
    const session = startSession(project, 1);
    const host = document.createElement("div");
    document.body.append(host);
    store.replaceProject(project);

    const scene = {
      session,
      game: { registry: { get: (key: string) => key === "dialogueHost" ? host : undefined } },
    };

    // 전투는 끝까지 돌리지 않는다(넘긴 세션 필드만 본다) — 시험이 끝난 뒤 문서가 내려가며 나는 거절은 이 시험의 대상이 아니다(#5185 누수).
    playBattle(
      scene as Parameters<typeof playBattle>[0],
      { kind: "battleProcessing", troopId: project.database.troops[0]?.id ?? "", canEscape: false, canLose: false },
      0,
    ).catch(() => undefined);

    expect(battleMocks.createBattleRuntime).toHaveBeenCalledOnce();
    const options = battleMocks.createBattleRuntime.mock.calls[0]?.[0] as BattleRuntimeOptions;
    expect(Object.keys(options.sessionState ?? {})).toEqual(
      expect.arrayContaining([...BATTLE_CONDITION_SESSION_STATE_FIELDS]),
    );
  });
});
