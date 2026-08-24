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

  it("renders four primary cards and three rule cards", () => {
    // Break named: the overview does not expose task-oriented system entry points.
    const host = renderSystem();

    for (const id of ["startup", "party", "save", "time", "combat", "economy", "input"]) {
      expect(findByTestId(host, `db-system-studio-card-${id}`)).not.toBeNull();
    }
  });

  it("keeps the three lower rule cards information-dense like the approved mockup", () => {
    // Break named: lower cards collapse to a single status line and leave half the workspace empty.
    const host = renderSystem();

    for (const id of ["combat", "economy", "input"]) {
      for (let index = 0; index < 4; index += 1) {
        expect(findByTestId(host, `db-system-studio-card-${id}-detail-${index}`)).not.toBeNull();
      }
      expect(findByTestId(host, `db-system-studio-card-${id}-open`)).not.toBeNull();
    }
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
