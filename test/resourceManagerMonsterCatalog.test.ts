// @vitest-environment happy-dom
// All catalog registrations must remain reachable through bounded pages/search.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { listMonsterResources } from "@/assets/monsterResourceCatalog";
import { renderResourceWorkbench } from "@/editor/panels/resourceManagerViews";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import type { UploadedAsset } from "@/project/types";

function renderMonsterTab(deleteLog: string[] = []): HTMLElement {
  const container = document.createElement("div");
  document.body.append(container);
  const project = store.getCurrent();
  renderResourceWorkbench(container, {
    categories: [{ kind: "monster", label: "몬스터" }],
    selectedKind: "monster",
    profiles: project.resourceProfiles,
    uploaded: Object.values(project.assets.uploaded),
    kindSelect: document.createElement("select"),
    fileInput: document.createElement("input"),
    actions: {
      addTileset: () => {},
      applyTileset: () => {},
      deleteAsset: (asset) => deleteLog.push(asset.id),
    },
    onSelectKind: () => {},
    onImport: () => {},
  });
  return container;
}

beforeEach(() => {
  store._setPersistenceStateForTest({ loaded: true, remotePersistenceEnabled: false });
  store.replace(createBlankProject());
});
afterEach(() => {
  document.body.replaceChildren();
});

describe("resource manager monster tab", () => {
  it("makes the full monster resource catalog reachable through bounded pages", () => {
    const project = store.getCurrent();
    const container = renderMonsterTab();
    const expected = listMonsterResources(project).length;
    expect(expected).toBeGreaterThan(100);
    let encountered = 0;
    const next = container.querySelector<HTMLButtonElement>('[data-testid="resource-page-next"]')!;
    do {
      const count = container.querySelectorAll(".rm-asset-card").length;
      expect(count).toBeLessThanOrEqual(80);
      encountered += count;
      if (next.disabled) break;
      next.click();
    } while (true);
    expect(encountered).toBe(expected);
    const search = container.querySelector<HTMLInputElement>('input[type="search"]')!;
    search.value = "scarloxy"; search.dispatchEvent(new Event("input"));
    expect(container.querySelectorAll(".rm-asset-card").length).toBeGreaterThan(0);

  });

  it("shows the catalog total in the category badge", () => {
    const container = renderMonsterTab();
    const badge = container.querySelector('[data-testid="resource-category-list"] .rm-category-badge');
    expect(badge?.textContent).toBe(String(listMonsterResources(store.getCurrent()).length));
  });

  it("shows effective catalog metadata in the inspector for the selected resource", () => {
    const container = renderMonsterTab();
    // 첫 카탈로그 항목(generated-enemy-slime-01)이 자동 선택된다 — 원시 id 가 아니라
    // 카탈로그 이름·태그·검토 상태·설명이 인스펙터에 표시돼야 한다.
    const inspector = container.querySelector(".rm-preview-well");
    expect(inspector?.textContent).toContain("초록 슬라임");
    expect(inspector?.textContent).toContain("generated-enemy-slime-01");
    expect(inspector?.textContent).toContain("검토됨");
    expect(inspector?.textContent).toContain("슬라임");
  });

  it("lists an uploaded monster once and keeps it deletable", () => {
    const deleteLog: string[] = [];
    const asset: UploadedAsset = {
      id: "monster_img_test",
      name: "직접 올린 몬스터",
      kind: "monster",
      dataUrl: "data:image/png;base64,AAAA",
      meta: { width: 64, height: 64 },
    } as UploadedAsset;
    store.update((project) => { project.assets.uploaded[asset.id] = asset; }, { scope: "assets", label: "test" });

    const container = renderMonsterTab(deleteLog);
    const search = container.querySelector<HTMLInputElement>('input[type="search"]')!;
    search.value = asset.id; search.dispatchEvent(new Event("input"));
    const cards = [...container.querySelectorAll(".rm-asset-card")];
    expect(cards).toHaveLength(1);
    expect(cards.filter((card) => card.textContent?.includes("직접 올린 몬스터"))).toHaveLength(1);

    (cards.find((card) => card.textContent?.includes("직접 올린 몬스터")) as HTMLElement).click();
    const deleteButton = container.querySelector<HTMLButtonElement>(".rm-inspector-actions .btn.danger");
    expect(deleteButton).not.toBeNull();
    deleteButton!.click();
    expect(deleteLog).toEqual(["monster_img_test"]);
  });
});
