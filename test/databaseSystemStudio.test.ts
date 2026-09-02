import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderSystemTab } from "@/editor/panels/databaseSystemView";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { findByTestId, installFakeDom, type FakeElement } from "./fakeDom";

function renderSystem(): FakeElement {
  const host = document.createElement("div") as unknown as FakeElement;
  const rerender = (): void => {
    host.replaceChildren();
    renderSystemTab(host as unknown as HTMLElement, rerender);
  };
  rerender();
  return host;
}

describe("database system studio", () => {
  let cleanupDom: (() => void) | undefined;

  beforeEach(() => {
    cleanupDom = installFakeDom();
    const project = createBlankProject();
    const switchId = project.switches[0]?.id;
    const variableId = project.variables[0]?.id;
    if (!switchId || !variableId) throw new Error("blank project needs state records");
    project.switches[0]!.name = "다리 복구 완료";
    project.variables[0]!.name = "현재 챕터";
    project.storyFlags = [
      {
        id: "bridge-repaired",
        kind: "switch",
        targetId: switchId,
        description: "다리 복구 퀘스트 진행 상태",
        questId: "quest",
      },
      {
        id: "chapter-current",
        kind: "variable",
        targetId: variableId,
        description: "현재 진행 중인 챕터",
      },
    ];
    store.replace(project);
  });

  afterEach(() => {
    cleanupDom?.();
    cleanupDom = undefined;
  });

  it("renders the modern overview, semantic state registry, and live preview", () => {
    // Break named: System still opens as a legacy fieldset page without the studio overview.
    const host = renderSystem();

    expect(findByTestId(host, "db-system-studio")).not.toBeNull();
    expect(findByTestId(host, "db-system-studio-header")?.textContent).toContain("시스템 개요");
    expect(findByTestId(host, "db-system-studio-command-search")).not.toBeNull();
    expect(findByTestId(host, "db-system-studio-state-table")?.textContent).toContain("quest.bridge-repaired");
    expect(findByTestId(host, "db-system-studio-state-table")?.textContent).toContain("chapter-current");
    expect(findByTestId(host, "db-system-studio-live-preview")).not.toBeNull();
    expect(findByTestId(host, "db-system-studio-impact-list")).not.toBeNull();
  });

  it("only presents project-backed settings as actionable cards", () => {
    // Break named: hard-coded Save, Economy, and Input cards pretend unimplemented settings are complete.
    const host = renderSystem();
    const studio = findByTestId(host, "db-system-studio");
    if (!studio) throw new Error("missing system studio");

    for (const id of ["startup", "party", "display", "time", "combat", "features", "title"]) {
      expect(findByTestId(host, `db-system-studio-card-${id}`)).not.toBeNull();
    }
    for (const id of ["save", "economy", "input"]) {
      expect(findByTestId(host, `db-system-studio-card-${id}`)).toBeNull();
    }
    expect(studio.textContent).not.toContain("구성 완료");
    expect(studio.textContent).not.toContain("주의 1개");
    expect(studio.textContent).not.toContain("자동 저장 사용");
  });

  it("derives every rule-card detail from authored project values", () => {
    // Break named: rule-card rows keep fixed completion claims when the authored System values change.
    const project = createBlankProject();
    project.system.playResolution = { width: 640, height: 360 };
    project.system.battleFlow = "strict";
    project.system.activeSlots = 2;
    project.system.battleUiStyle = "rm2000";
    project.system.battleModel = "gen1";
    project.system.skillSystem = { enabled: true };
    project.system.actionCombat = { enabled: true };
    store.replace(project);
    const host = renderSystem();

    expect(findByTestId(host, "db-system-studio-card-display")?.textContent).toContain("640×360");
    expect(findByTestId(host, "db-system-studio-card-combat")?.textContent).toContain("라운드 전투");
    expect(findByTestId(host, "db-system-studio-card-combat")?.textContent).toContain("2명");
    expect(findByTestId(host, "db-system-studio-card-combat")?.textContent).toContain("유리 창 · 정면 필드");
    expect(findByTestId(host, "db-system-studio-card-combat")?.textContent).toContain("Gen1");
    expect(findByTestId(host, "db-system-studio-card-features")?.textContent).toContain("생활 스킬사용");
    expect(findByTestId(host, "db-system-studio-card-features")?.textContent).toContain("액션 전투사용");

    for (const id of ["combat", "features", "title"]) {
      for (let index = 0; index < 4; index += 1) {
        expect(findByTestId(host, `db-system-studio-card-${id}-detail-${index}`)).not.toBeNull();
      }
      expect(findByTestId(host, `db-system-studio-card-${id}-open`)).not.toBeNull();
    }
  });

  it("renders preview facts as non-interactive project values", () => {
    // Break named: inert preview buttons and 'all screens' affordances imply navigation that does not exist.
    const host = renderSystem();
    const impactList = findByTestId(host, "db-system-studio-impact-list");
    if (!impactList) throw new Error("missing impact list");

    const rows = impactList.querySelectorAll(".db-system-studio-impact-row");
    expect(rows).toHaveLength(4);
    expect(rows.every((row) => row.tagName !== "BUTTON")).toBe(true);
    expect(impactList.querySelector(".db-system-studio-all-screens")).toBeNull();
    expect(impactList.textContent).not.toContain("저장/불러오기");
  });

  it("navigates from an overview card without writing project state", () => {
    // Break named: overview cards are decorative and cannot enter the existing authoring section.
    const host = renderSystem();
    const before = JSON.stringify(store.getCurrent());
    const startup = findByTestId(host, "db-system-studio-card-startup");
    if (!startup) throw new Error("missing startup card");

    startup.click();

    expect(findByTestId(host, "db-system-nav-startup")?.classList.contains("active")).toBe(true);
    expect(host.querySelector('[data-system-section="startup"]')?.hidden).toBe(false);
    expect(JSON.stringify(store.getCurrent())).toBe(before);
  });
});
