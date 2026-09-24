/** @vitest-environment happy-dom */
import { afterEach, expect, it, vi } from "vitest";
import { createBattleRuntime } from "@/battle/runtime";
import { battleField, syncBattleField } from "@/player/battleFieldDom";
import { enemyListPanel, syncEnemyListPanel } from "@/player/battleCommandDom";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";

afterEach(() => {
  document.body.replaceChildren();
  vi.clearAllTimers();
  vi.useRealTimers();
});

it("retires outgoing enemy sprites and HUD after queued presentation, preserving the current node", () => {
  vi.useFakeTimers();
  const project = createBlankProject();
  project.system.battleModel = "rm2k3";
  store.replace(project);
  const runtime = createBattleRuntime({ project, troopId: "troop_golem_guard", canEscape: true, canLose: true });
  const snapshot = runtime.snapshot();
  expect(snapshot.enemies.length).toBeGreaterThan(1);
  const [outgoing, incoming] = snapshot.enemies;
  const field = battleField({ ...snapshot, enemies: [outgoing] });
  const panel = enemyListPanel({ ...snapshot, enemies: [outgoing] });
  document.body.append(field, panel);
  const next = { ...snapshot, enemies: [incoming] };
  syncBattleField(field, next, undefined, { retainDepartedEnemies: true });
  syncEnemyListPanel(panel, next.enemies, undefined, true);
  expect(panel.querySelectorAll(".battle-enemy-list-row")).toHaveLength(2);
  expect(field.querySelectorAll(".battle-enemy")).toHaveLength(2);
  const incomingNode = field.querySelector(`[data-testid="${incoming.id}"]`);
  syncBattleField(field, next, undefined, { retainDepartedEnemies: false });
  syncEnemyListPanel(panel, next.enemies);
  expect(panel.querySelectorAll(".battle-enemy-list-row")).toHaveLength(1);
  expect(panel.querySelector(".battle-enemy-list-row")?.getAttribute("data-enemy-id")).toBe(incoming.id);
  expect(field.querySelectorAll(".battle-enemy")).toHaveLength(1);
  expect(field.querySelector(`[data-testid="${incoming.id}"]`)).toBe(incomingNode);
  expect(field.querySelector(`[data-testid="battle-enemy-hud-${outgoing.id}"]`)).toBeNull();
  // A captured/hidden opponent must also disappear when the displayed roster is empty.
  syncBattleField(field, { ...snapshot, enemies: [] });
  syncEnemyListPanel(panel, []);
  expect(panel.querySelectorAll(".battle-enemy-list-row")).toHaveLength(0);
  expect(field.querySelectorAll(".battle-enemy")).toHaveLength(0);
});
