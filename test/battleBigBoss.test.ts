/** @vitest-environment happy-dom */
// 큰 보스 전투 표식(battleFieldDom BIG_BOSS_PIXEL_CELL): 도트 시트 칸 128 이상인 적이 있으면 씬에 data-battle-big-boss 가 붙고
// (_retro2003.css 가 무대 위 여백을 윗창 자리까지 줄인다), 칸 96 이하만 있는 전투는 표식이 없어 예전 그대로다.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createBattleRuntime } from "@/battle/runtime";
import { mountBattleScene, type BattleDomController } from "@/player/battleDom";
import { BIG_BOSS_PIXEL_CELL } from "@/player/battleFieldDom";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";

const ONE_PX = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

let controller: BattleDomController | undefined;
const nativeAnimate = HTMLElement.prototype.animate;

beforeEach(() => {
  vi.useFakeTimers();
  // happy-dom 의 Web Animation 은 cancel 때 finished 를 거절해 처리되지 않은 오류를 남긴다. 표식만 보므로 끈다.
  (HTMLElement.prototype as { animate?: unknown }).animate = undefined;
});
afterEach(() => {
  controller?.destroy();
  controller = undefined;
  document.body.replaceChildren();
  vi.clearAllTimers();
  vi.useRealTimers();
  HTMLElement.prototype.animate = nativeAnimate;
});

function mountWithCell(cell: 48 | 64 | 96 | 128 | 192) {
  const project = createBlankProject();
  project.system.battleUiStyle = "retro2003";
  project.system.battleModel = "rm2k3";
  const id = `boss-${cell}`;
  project.assets.uploaded[id] = {
    id, name: `Boss ${cell}`, kind: "monster", dataUrl: ONE_PX,
    meta: { width: cell, height: cell, pixelEnemySheet: { sheetResourceId: `${id}-sheet`, cell, motion: "stomp", idleFrameMs: 300, skillCell: true } },
  };
  project.assets.uploaded[`${id}-sheet`] = {
    id: `${id}-sheet`, name: `Boss ${cell} sheet`, kind: "picture", dataUrl: ONE_PX,
    meta: { width: cell * 3, height: cell * 3, frameWidth: cell, frameHeight: cell, frames: 9 },
  };
  const enemy = project.database.enemies.find((entry) => entry.id === "enemy_stone_golem");
  const troop = project.database.troops.find((entry) => entry.id === "troop_golem_guard");
  if (!enemy || !troop) throw new Error("Missing golem fixture");
  enemy.monsterResourceId = id;
  store.replace(project);
  const host = document.createElement("div");
  document.body.append(host);
  const runtime = createBattleRuntime({ project: store.getCurrent(), troopId: troop.id, canEscape: true, canLose: false, rng: () => 0 });
  controller = mountBattleScene({ host, runtime, onResult: () => undefined, introHold: false });
  const golem = controller.root.querySelector<HTMLElement>('.battle-enemy[data-record-id="enemy_stone_golem"]');
  if (!golem) throw new Error("Missing mounted golem");
  return { root: controller.root, golem };
}

describe("big-boss battle marker", { timeout: 60_000 }, () => {
  it("uses cell 128 as the one threshold", () => {
    expect(BIG_BOSS_PIXEL_CELL).toBe(128);
  });

  it.each([128, 192] as const)("marks the scene for a %s-cell sheet", (cell) => {
    const { root, golem } = mountWithCell(cell);
    expect(golem.dataset.pixelEnemyCell).toBe(String(cell));
    expect(root.dataset.battleBigBoss).toBe("true");
  });

  it.each([48, 64, 96] as const)("leaves a %s-cell battle unmarked", (cell) => {
    const { root, golem } = mountWithCell(cell);
    expect(golem.dataset.pixelEnemyCell).toBe(String(cell));
    expect(root.dataset.battleBigBoss).toBeUndefined();
  });
});
