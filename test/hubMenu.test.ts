// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { hubMenuEnabled, hubPageFor, renderHubMenu } from "@/player/hubMenu";
import type { PlayerStatusMenuActions } from "@/player/playerStatusMenuTypes";
import { normalizeSystemRecords } from "@/project/databaseRecordModel";
import { createBlankProject } from "@/project/defaults";
import { startSession } from "@/project/session";
import type { Project } from "@/project/types";

function combatProject(): Project {
  const project = createBlankProject();
  const map = Object.values(project.maps)[0]!;
  map.encounterRate = 25;
  map.troopIds = [project.database.troops[0]?.id ?? "troop_qa"];
  return project;
}

const noop = new Proxy({}, { get: () => () => undefined }) as PlayerStatusMenuActions;

describe("ESC 허브 메뉴", () => {
  it("system.menuLayout 이 hub 일 때만 켜진다", () => {
    const project = combatProject();
    const session = startSession(project, 1);
    expect(hubMenuEnabled(project, session)).toBe(false);
    project.system.menuLayout = "hub";
    expect(hubMenuEnabled(project, session)).toBe(true);
    project.system.menuLayout = "legacy";
    expect(hubMenuEnabled(project, session)).toBe(false);
  });

  it("저장 정규화가 menuLayout·menuTheme 를 남기고 모르는 값은 버린다", () => {
    const project = createBlankProject();
    const kept = normalizeSystemRecords({ ...project.system, menuLayout: "hub", menuTheme: { window: "#203060", accent: "#ffcc66" } });
    expect(kept.menuLayout).toBe("hub");
    expect(kept.menuTheme).toEqual({ window: "#203060", accent: "#ffcc66" });
    const dropped = normalizeSystemRecords({ ...project.system, menuLayout: "fancy" as never });
    expect(dropped.menuLayout).toBeUndefined();
    expect(dropped.menuTheme).toBeUndefined();
  });

  it("전투 없는 게임은 허브를 켜도 옛 메뉴다", () => {
    const project = createBlankProject();
    project.system.menuLayout = "hub";
    expect(hubMenuEnabled(project, startSession(project, 1))).toBe(false);
  });

  it("컨트롤러 상태를 허브 쪽으로 옮긴다", () => {
    expect(hubPageFor({ mode: "main", selectedCommand: "items" }, false)).toBe("hub");
    expect(hubPageFor({ mode: "function", selectedCommand: "items" }, false)).toBe("items");
    expect(hubPageFor({ mode: "function", selectedCommand: "items", itemActionId: "x" }, false)).toBe("generic");
    expect(hubPageFor({ mode: "function", selectedCommand: "skills" }, false)).toBe("generic");
    expect(hubPageFor({ mode: "function", selectedCommand: "skills", skillActorId: "a" }, false)).toBe("skills");
    expect(hubPageFor({ mode: "function", selectedCommand: "skills", skillActorId: "a" }, true)).toBe("generic");
    expect(hubPageFor({ mode: "function", selectedCommand: "equipment", equipmentActorId: "a" }, false)).toBe("equipment");
    expect(hubPageFor({ mode: "function", selectedCommand: "save" }, false)).toBe("generic");
  });

  it("아이템 상세는 설명 전문과 32px 아이콘을 보인다", () => {
    const project = combatProject();
    project.system.menuLayout = "hub";
    const item = project.database.items.find((record) => record.description.length > 0)!;
    item.description = "첫 줄 설명이다.\n둘째 줄도 잘리지 않고 끝까지 보여야 하는 긴 설명이다.";
    const session = startSession(project, 1);
    session.inventory = { [item.id]: 3 };
    const panel = renderHubMenu({
      project, session, slots: [], mode: "function", selectedCommand: "items", actions: noop,
      board: { w: 480, h: 270, zoom: 1, tall: false }, hubSel: 0, hubCand: -1,
      hubActions: { focus: () => undefined, openPage: () => undefined, back: () => undefined },
    });
    expect(panel.dataset.hubPage).toBe("items");
    expect(panel.querySelector("[data-testid='hub-item-description']")?.textContent).toBe("첫 줄 설명이다. 둘째 줄도 잘리지 않고 끝까지 보여야 하는 긴 설명이다.");
    expect(panel.querySelector(`[data-testid='hub-item-${item.id}'] .hub-ic32, [data-testid='hub-item-${item.id}'] img`)).not.toBeNull();
    expect(panel.textContent).not.toContain("특수");
  });
});
