import { describe, expect, it } from "vitest";
import { createBattleRuntime } from "@/battle/runtime";
import { deserialize } from "@/project/io";
import { createBattleSequencer, type DamageFeedback } from "@/player/battleSequencer";
import { createPresentationLedger } from "@/player/battlePresentation";
import { actorCommandDirectorState } from "@/player/battleDirectorDom";
import itemFixture from "./fixtures/projects/item-runtime-qa-v3.json";

// 회복 아이템이 **어느 자원을** 움직였는지가 표시 계층까지 보존되는지 고정한다.
// 회귀 실측(2026-09-15, 출하 플레이어): 마력약(MP+30/HP+0) 사용 시 파티 카드 HP 가
// 250→280 으로 올다가 다음 커맨드 국면에 250 으로 되돌아갔고 메시지는 "30 피해!" 였다.

const ACTOR = "actor_hero";
const ETHER = "item_ether";
const POTION = "item_potion";

type Project = ReturnType<typeof deserialize>;

function battleProject(): Project {
  const project = deserialize(JSON.stringify(itemFixture));
  project.system.battleModel = "rm2k3";
  project.system.battleUiStyle = "retro2003";
  return project;
}

function startBattle(project: Project) {
  const runtime = createBattleRuntime({
    project,
    troopId: "troop_slime",
    canEscape: true,
    canLose: true,
    battleFlow: "gauge",
    rng: () => 0.5,
    party: {
      partyActorIds: [ACTOR],
      levels: { [ACTOR]: 1 },
      experience: { [ACTOR]: 0 },
      vitals: { [ACTOR]: { hp: 50, mp: 10 } },
      stateIds: { [ACTOR]: [] },
    },
    sessionState: {
      switches: {},
      variables: {},
      inventory: { [ETHER]: 3, [POTION]: 3 },
    },
  });
  for (let i = 0; i < 40; i += 1) {
    runtime.tick(1_000);
    if (runtime.snapshot().phase === "actorCommand") break;
  }
  return runtime;
}

/** 아이템을 한 번 쓰고 타임라인 엔트리·시퀀서 피드백·원장·감독 대사를 한 번에 모은다. */
function useItem(project: Project, itemId: string) {
  const runtime = startBattle(project);
  const command = { kind: "item" as const, itemId, targetEnemyId: "", targetActorId: ACTOR };
  const before = runtime.snapshot();
  runtime.performActorCommand(command);
  const after = runtime.snapshot();
  const entry = after.timeline.slice(before.timeline.length).at(-1);

  const feedbacks: Array<DamageFeedback | undefined> = [];
  const lines: string[] = [];
  const queue: Array<() => void> = [];
  const ledger = createPresentationLedger(before);
  const sequencer = createBattleSequencer(
    runtime,
    {
      onDirectorState: (state) => lines.push(...state.lines),
      onSyncView: () => {},
      onDamageFeedback: (feedback) => {
        feedbacks.push(feedback);
        if (feedback) ledger.applyFeedback(feedback);
      },
      onResultStage: () => {},
      onSequenceBusy: () => {},
    },
    (callback) => {
      queue.push(callback);
      return queue.length;
    },
    () => {},
  );
  sequencer.runAfterActorCommand(command, before, after);
  for (let i = 0; i < 60 && queue.length; i += 1) queue.shift()?.();
  sequencer.cancel();

  const director = actorCommandDirectorState(command, before, after);
  return {
    entry,
    directorLines: director.lines,
    feedback: feedbacks.find((f) => f && f.healing),
    ledgers: ledger.vitalsFor(ACTOR),
    engine: after.actors.find((actor) => actor.recordId === ACTOR),
    startLedgers: before.actors.find((actor) => actor.recordId === ACTOR),
  };
}

describe("battle recovery resource contract", () => {
  it("MP-only recovery never touches displayed HP", () => {
    const result = useItem(battleProject(), ETHER);

    expect(result.entry?.kind).toBe("healing");
    expect(result.entry?.resource).toBe("mp");
    expect(result.entry?.amount).toBe(30);
    expect(result.feedback?.resource).toBe("mp");
    expect(result.ledgers?.hp).toBe(result.engine?.hp);
    expect(result.ledgers?.hp).toBe(50);
  });

  it("HP recovery credits the healed amount to displayed HP", () => {
    const result = useItem(battleProject(), POTION);

    expect(result.entry?.resource).toBe("hp");
    expect(result.entry?.amount).toBe(50);
    expect(result.feedback?.resource).toBe("hp");
    expect(result.ledgers?.hp).toBe(100);
    expect(result.ledgers?.hp).toBe(result.engine?.hp);
  });

  it("a mixed HP+MP item reports only the HP gain, not their sum", () => {
    const project = battleProject();
    const potion = project.database.items.find((item) => item.id === POTION);
    if (!potion) throw new Error("fixture item missing");
    potion.hpRecovery = { flat: 10, percentMax: 0 };
    potion.mpRecovery = { flat: 20, percentMax: 0 };

    const result = useItem(project, POTION);

    expect(result.entry?.resource).toBe("hp");
    expect(result.entry?.amount).toBe(10);
    expect(result.ledgers?.hp).toBe(60);
  });

  it("a healing item's message says recovery, not damage", () => {
    const potion = useItem(battleProject(), POTION);
    const line = potion.directorLines.join(" ");
    expect(line).toMatch(/회복했다/);
    expect(line).not.toMatch(/피해!/);

    const ether = useItem(battleProject(), ETHER);
    const etherLine = ether.directorLines.join(" ");
    expect(etherLine).toMatch(/회복했다/);
    expect(etherLine).toMatch(/MP를 30/);
    expect(etherLine).not.toMatch(/피해!/);
  });
});