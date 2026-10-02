import { describe, expect, it } from "vitest";
import { battlePanel } from "@/editor/panels/actorRecordBattlePanels";
import { createBlankProject } from "@/project/defaults";
import { deserialize, serialize } from "@/project/io/serialize";
import { store } from "@/project/store";
import { FakeElement, findByTestId, installFakeDom } from "./fakeDom";

// 액터 「전투 명령」 패널(RM2003 배우별 명령, 2026-10-02) — 켜기·순서·끄기가 실제로 저장되는지.
function node(root: FakeElement, testId: string): FakeElement {
  const found = findByTestId(root, testId);
  if (!found) throw new Error(`missing ${testId}`);
  return found;
}

describe("액터 전투 명령 패널", () => {
  it("켜면 직업 명령을 옮겨 오고, ↓·삭제·끄기가 battleCommandIds 에 저장된다", () => {
    const restoreDom = installFakeDom();
    try {
      const project = createBlankProject();
      const actorId = project.database.actors[0]!.id;
      const klass = project.database.classes.find((entry) => entry.id === project.database.actors[0]!.classId)!;
      const classIds = klass.battleCommands.map((command) => command.id);
      expect(classIds.length).toBeGreaterThan(1);
      store.replace(project);
      const host = document.createElement("section") as unknown as FakeElement;
      const actor = () => store.getCurrent().database.actors.find((entry) => entry.id === actorId)!;
      const render = () => {
        host.replaceChildren(battlePanel(actor(), render, () => undefined) as unknown as Node as never);
      };
      render();
      expect(findByTestId(host, "db-actor-command-class-note")).not.toBeNull();

      const toggle = node(host, "db-field-actor-custom-commands");
      toggle.checked = true;
      toggle.dispatchEvent(new Event("change"));
      expect(actor().battleCommandIds).toEqual(classIds.slice(0, 7));

      node(host, "db-actor-command-down-0").click();
      expect(actor().battleCommandIds?.slice(0, 2)).toEqual([classIds[1], classIds[0]]);

      node(host, "db-actor-command-remove-0").click();
      expect(actor().battleCommandIds?.[0]).toBe(classIds[0]);
      expect(deserialize(serialize(store.getCurrent())).database.actors.find((entry) => entry.id === actorId)!.battleCommandIds)
        .toEqual(actor().battleCommandIds);

      const off = node(host, "db-field-actor-custom-commands");
      off.checked = false;
      off.dispatchEvent(new Event("change"));
      expect("battleCommandIds" in actor()).toBe(false);
    } finally {
      restoreDom();
    }
  });
});
