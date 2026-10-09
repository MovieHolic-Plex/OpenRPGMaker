/** @vitest-environment happy-dom */
import { describe, expect, it, vi } from "vitest";
import { createBattleRuntime } from "@/battle/runtime";
import { deserialize } from "@/project/io";
import { mountBattleScene } from "@/player/battleDom";
import { store } from "@/project/store";
import battleFixture from "./fixtures/projects/battle-v3.json";

// 코덱스 적대 리뷰 C2 회귀: strict 라운드에서 민첩이 빠른 적이 먼저 움직일 때,
// 아군 명령 대사(도주)는 아군 엔트리에 붙어야 한다. 예전에는 무조건 첫 엔트리(적 선공)에
// 붙어서 — 도주 성공 대사 뒤에 아군 도주 엔트리가 제네릭 "주인공의 공격! 효과가
// 충분하지 않았다."로 재생됐다.
describe("escape success presentation with faster enemies", () => {
  it("keeps escape lines on the hero entry and never replays it as a generic attack", () => {
    vi.useFakeTimers();
    const project = deserialize(JSON.stringify(battleFixture));
    const troop = project.database.troops.find((entry) => entry.id === "troop_slime")!;
    troop.enemyIds = ["enemy_slime", "enemy_slime"];
    troop.members = [
      { enemyId: "enemy_slime", x: 80, y: 90, hidden: false },
      { enemyId: "enemy_slime", x: 120, y: 120, hidden: false },
    ];
    const slime = project.database.enemies.find((e) => e.id === "enemy_slime")!;
    slime.stats = { ...slime.stats, agility: 999 };
    store.replace(project);
    const host = document.createElement("div");
    document.body.append(host);
    const runtime = createBattleRuntime({
      project, troopId: "troop_slime", canEscape: true, canLose: true,
      battleFlow: "strict",
      rng: () => 0, // 도주 성공 롤
    });
    const controller = mountBattleScene({ host, runtime, onResult: () => undefined, introHold: false });
    for (let i = 0; i < 200 && runtime.snapshot().phase !== "actorCommand"; i += 1) runtime.tick(1000);
    vi.advanceTimersByTime(3000);

    const log: string[] = [];
    const record = () => {
      const msg = (controller.root.querySelector(".battle-message-window")?.textContent ?? "").replace(/\s+/g, " ").trim();
      if (msg && (log.length === 0 || log[log.length - 1] !== msg)) log.push(msg);
    };
    controller.root.querySelector<HTMLButtonElement>("[data-testid='actor-command-escape']")?.click();
    record();
    for (let t = 0; t <= 8000; t += 100) {
      vi.advanceTimersByTime(100);
      record();
    }
    expect(runtime.snapshot().result).toBe("escape");
    const joined = log.join(" | ");
    // 아군의 도주 대사가 재생된다.
    expect(joined).toContain("도망치려 한다");
    expect(joined).toContain("무사히 도망쳤다!");
    // 적 선공은 자기 이름으로 재생된다(아군 대사에 가려지지 않는다).
    expect(joined).toContain("슬라임의 공격!");
    // 도주 엔트리가 제네릭 아군 공격("주인공의 공격!")으로 재생되지 않는다.
    // (슬라임 선공의 0데미지 문구 "효과가 충분하지 않았다"는 정당한 재생이다.)
    expect(joined).not.toContain("주인공의 공격!");
    controller.destroy();
  });
});
