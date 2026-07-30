import { describe, expect, it } from "vitest";

async function load() {
  const [{ runWalkthrough }, { EMBER_WALKTHROUGH }, { createEmberQuestProject, EMBER_SWITCH, EMBER_ITEM }] = await Promise.all([
    import("@/testing/walkthroughRunner"),
    import("@/testing/emberWalkthrough"),
    import("@/project/defaults/emberQuestGame"),
  ]);
  return { runWalkthrough, EMBER_WALKTHROUGH, createEmberQuestProject, EMBER_SWITCH, EMBER_ITEM };
}

describe("walkthroughRunner — 잿불의 유산 완주", () => {
  it("3퀘스트 + 엔딩을 헤드리스로 완주한다", async () => {
    const { runWalkthrough, EMBER_WALKTHROUGH, createEmberQuestProject, EMBER_SWITCH } = await load();
    const project = createEmberQuestProject();
    const result = runWalkthrough(project, EMBER_WALKTHROUGH, { seed: 20260704 });

    if (!result.ok) {
      // 실패 시 어느 스텝에서 왜 막혔는지 로그와 함께 드러낸다.
      throw new Error(
        `완주 실패 @스텝 ${result.failedStepIndex}: ${result.failureReason}\n` +
          `실패 스텝: ${JSON.stringify(result.failedStep)}\n` +
          `로그:\n${result.log.join("\n")}`
      );
    }

    expect(result.ok).toBe(true);
    expect(result.reachedEnding).toBe(true);
    // 세 퀘스트 완료 스위치가 모두 켜져야 한다.
    expect(result.session.switches[EMBER_SWITCH.q1Clear]).toBe(true);
    expect(result.session.switches[EMBER_SWITCH.q2Done]).toBe(true);
    expect(result.session.switches[EMBER_SWITCH.q3Done]).toBe(true);
  }, 15_000);

  it("고의 파손(낡은 열쇠 지급 제거) 시 광산 문에서 막히고 실패 스텝을 리포트한다", async () => {
    const { runWalkthrough, EMBER_WALKTHROUGH, createEmberQuestProject } = await load();
    const project = createEmberQuestProject();

    // 말벌 전투 승리 시 낡은 열쇠를 주는 victoryCommands를 제거해 진행을 파손한다.
    const forest = project.maps["map_mist_forest"];
    const hornets = forest.events.find((e) => e.id === "ev_forest_hornets")!;
    const fightPage = hornets.pages!.find((p) => p.id === "ev_forest_hornets_fight")!;
    // changeItem(oldKey) 커맨드 제거.
    //
    // 반드시 **재귀로** 제거해야 한다: battleBlockerEvent 는 승리 보상을
    // `fork { condition: battleResult=victory, then: [...] }` 안쪽에 넣는다. 최상위 배열만
    // 걸러내면 파손이 아무 효과가 없고 완주가 그냥 성공해 이 네거티브 컨트롤이 무력해진다
    // (2026-07-26 실측: result.ok 가 true 로 나왔다).
    const stripOldKey = (commands: readonly unknown[]): unknown[] =>
      commands
        .filter((command) => !(command as { itemId?: string }).itemId?.includes("old_key"))
        .map((command) => {
          const node = command as { kind?: string; then?: unknown[]; else?: unknown[] };
          if (node.kind !== "fork") return command;
          return {
            ...node,
            ...(node.then ? { then: stripOldKey(node.then) } : {}),
            ...(node.else ? { else: stripOldKey(node.else) } : {}),
          };
        });
    (fightPage as { commands: unknown[] }).commands = stripOldKey(fightPage.commands);

    const result = runWalkthrough(project, EMBER_WALKTHROUGH, { seed: 20260704 });
    expect(result.ok).toBe(false);
    // 열쇠를 못 받으므로 말벌 전투 직후 "oldKey 소지" 단언에서 처음 막힌다(정확한 실패 스텝 리포트).
    expect(result.failureReason).toContain("item_old_key");
    expect(result.reachedEnding).toBe(false);
    // 실패 스텝이 열쇠 관련 단언인지 확인.
    expect(JSON.stringify(result.failedStep)).toContain("old_key");
  });
});
