// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { deserialize, serialize } from "@/project/io/serialize";
import { store } from "@/project/store";
import { legacyWikiActivity } from "@/project/world/activity";
import { buildProjectWikiPayload } from "@/ai/projectWikiClient";
import { projectWikiContext } from "@/ai/projectWikiContext";
import { PROJECT_WIKI_TOOLS } from "@/editor/tools/projectWikiTools";
import { renderWorldPanel } from "@/editor/panels/worldPanel";
import { renderEditActivityPanel } from "@/editor/panels/editActivityPanel";
import { manualWikiNote, wikiActivity } from "./fixtures/wikiActivity";

afterEach(() => { document.body.replaceChildren(); vi.restoreAllMocks(); });

function projectWithHistory(count = 1) {
  const project = createBlankProject();
  project.world = { entities: [...Array.from({ length: count }, (_, i) => wikiActivity(i)), manualWikiNote], relations: [] };
  return project;
}

describe("work history separated from project knowledge", () => {
  it("keeps originals and manual annotations intact across save/load, with stable archive ordering", () => {
    const project = projectWithHistory(2);
    project.world = { ...project.world!, relations: [{ a: "w_manual_note", b: "w_applied_0", kind: "custom", note: "수동 주석의 원본" }] };
    const restored = deserialize(serialize(project));
    expect(restored.world).toEqual(project.world);
    expect(legacyWikiActivity(restored.world).map((entry) => entry.id)).toEqual(["w_applied_1", "w_applied_0"]);
    expect(deserialize(serialize(restored)).world).toEqual(project.world);
  });

  it("excludes matching progress before both retrieval and the 64-document extraction cap", () => {
    const project = projectWithHistory(70);
    expect(projectWikiContext(project, { query: "표지판 이동" }).selectedIds).toEqual([manualWikiNote.id]);
    const payload = JSON.parse(buildProjectWikiPayload({ project, userText: "표지판 이동", sources: [] }));
    expect(payload.currentDocuments.map((entry: { id: string }) => entry.id)).toEqual([manualWikiNote.id]);
  });

  it("cannot retrieve progress through explicit IDs or includeHistory", () => {
    const project = projectWithHistory();
    const result = PROJECT_WIKI_TOOLS[0].run(project, { ids: ["w_applied_0", manualWikiNote.id], includeHistory: true });
    expect(result.data).toMatchObject({ documents: [{ id: manualWikiNote.id }] });
    expect((result.data as { documents: unknown[] }).documents).toHaveLength(1);
  });

  it("moves automatic records out of every codex tab and deep link while keeping the manual note", () => {
    const project = projectWithHistory();
    store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
    store.replace(project);
    const panel = renderWorldPanel({ initialTab: "guideline", initialEntityId: "w_applied_0" });
    document.body.append(panel);
    expect(panel.textContent).not.toContain("적용된 작업");
    expect(panel.textContent).toContain("표지판 디자인");
    expect(store.getCurrent().world).toEqual(project.world);
  });

  it("shows original dates and escaped full text in history, pages all records and clears on project switch", () => {
    const project = projectWithHistory(31);
    const hostile = '<img src=x onerror="alert(1)">';
    project.world = { ...project.world!, entities: project.world!.entities.map((entry) => entry.id === "w_applied_30" ? { ...entry, body: hostile } : entry) };
    store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
    store.replace(project);
    const panel = renderEditActivityPanel();
    document.body.append(panel);
    expect(panel.querySelectorAll('[data-testid^="legacy-wiki-row-"]')).toHaveLength(30);
    expect(panel.textContent).toContain(new Date(wikiActivity(30).wiki!.sources[0].at).toLocaleString("ko-KR"));
    panel.querySelector<HTMLButtonElement>('[data-testid="legacy-wiki-toggle-w_applied_30"]')!.click();
    expect(panel.querySelector('[data-testid="legacy-wiki-body-w_applied_30"]')!.textContent).toContain(hostile);
    expect(panel.querySelector("img")).toBeNull();
    panel.querySelector<HTMLButtonElement>('[data-testid="legacy-wiki-activity-more"]')!.click();
    expect(panel.querySelectorAll('[data-testid^="legacy-wiki-row-"]')).toHaveLength(31);
    expect(panel.querySelector('[data-testid="legacy-wiki-activity-more"]')).toBeNull();
    expect(store.getCurrent().world).toEqual(project.world);
    store.replace(createBlankProject());
    expect(panel.querySelectorAll('[data-testid^="legacy-wiki-row-"]')).toHaveLength(0);
  });
});
