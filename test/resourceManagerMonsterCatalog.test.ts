// @vitest-environment happy-dom
// 몬스터 탭의 정본은 프로필 표가 아니라 몬스터 소재 카탈로그다 — 번들 RTP 에는 몬스터
// 그림이 1장(Hornet)뿐이라 프로필만 나열하면 생성 아트·Scarloxy 팩 160여 종이 숨는다.
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
  it("lists the full monster resource catalog, not just the single RTP profile", () => {
    // Given a blank project whose resourceProfiles carry only the EasyRPG Hornet profile.
    const project = store.getCurrent();
    expect(project.resourceProfiles.filter((p) => p.kind === "monster")).toHaveLength(1);
    // When the monster category is rendered.
    const container = renderMonsterTab();
    // Then every catalog entry (generated art, Scarloxy, EasyRPG, plan-promoted) is a card.
    const expected = listMonsterResources(project).length;
    expect(expected).toBeGreaterThan(100);
    expect(container.querySelectorAll(".rm-asset-card")).toHaveLength(expected);
    const list = container.querySelector('[data-testid="resource-entry-list"]');
    expect(list?.textContent).toContain("초록 슬라임");
    // 카탈로그 효과 이름으로 표시된다 — "붉은 벌"은 EasyRPG Hornet, "보라색 뿔뱀"은 Scarloxy Atrox.
    expect(list?.textContent).toContain("붉은 벌");
    expect(list?.textContent).toContain("보라색 뿔뱀");
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
    const expected = listMonsterResources(store.getCurrent()).length;
    const cards = [...container.querySelectorAll(".rm-asset-card")];
    expect(cards).toHaveLength(expected);
    expect(cards.filter((card) => card.textContent?.includes("직접 올린 몬스터"))).toHaveLength(1);

    (cards.find((card) => card.textContent?.includes("직접 올린 몬스터")) as HTMLElement).click();
    const deleteButton = container.querySelector<HTMLButtonElement>(".rm-inspector-actions .btn.danger");
    expect(deleteButton).not.toBeNull();
    deleteButton!.click();
    expect(deleteLog).toEqual(["monster_img_test"]);
  });
});
