// @vitest-environment happy-dom
// 보관 상자 창: 제목으로 이름 붙인 대화상자, 수량 칸은 보이는 「수량」 라벨에 묶인다.
import { afterEach, describe, expect, it } from "vitest";
import { playOpenChest } from "@/player/playSceneChest";
import type { PlaySceneContext } from "@/player/playSceneTypes";
import { createBlankProject } from "@/project/defaults";
import { deserialize, serialize } from "@/project/io";
import { startSession } from "@/project/session";
import { store } from "@/project/store";

function sceneFixture(): PlaySceneContext {
  store.replace(deserialize(serialize(createBlankProject())));
  const project = store.getCurrent();
  const host = document.createElement("div");
  document.body.append(host);
  return {
    session: startSession(project, 1),
    map: project.maps[project.startMapId],
    tileX: 0,
    tileY: 0,
    game: { registry: { get: (key: string) => (key === "dialogueHost" ? host : undefined) } },
    syncRuntimeState() {},
    refreshRuntimeSurfaces() {},
  } as unknown as PlaySceneContext;
}

afterEach(() => {
  document.body.replaceChildren();
});

describe("storage chest dialog accessibility", () => {
  it("names the open chest and associates the quantity field with 수량", async () => {
    const scene = sceneFixture();
    const pending = playOpenChest(scene, { template: "warehouse", chestId: "box", displayName: "공동 창고" });
    const dialog = document.querySelector<HTMLElement>("[data-testid='chest-scene']");
    expect(dialog?.getAttribute("role")).toBe("dialog");
    expect(dialog?.getAttribute("aria-modal")).toBe("true");
    const titleId = dialog?.getAttribute("aria-labelledby");
    expect(titleId).toBeTruthy();
    expect(document.getElementById(titleId!)?.textContent).toBe("공동 창고");

    const qty = document.querySelector<HTMLInputElement>("[data-testid='chest-qty']");
    expect(qty?.id).toBeTruthy();
    expect(document.querySelector("label.runtime-chest-qty-label")?.getAttribute("for")).toBe(qty?.id);
    expect(document.querySelector("[data-testid='chest-search']")?.getAttribute("aria-label")).toBe("검색");
    expect(document.querySelector("[data-testid='chest-status']")?.getAttribute("role")).toBe("status");
    expect(document.querySelector("[data-testid='chest-tab-all']")?.getAttribute("aria-pressed")).toBe("true");
    expect(document.querySelector("[data-testid='chest-tab-medicine']")?.getAttribute("aria-pressed")).toBe("false");
    expect(document.querySelector("[data-testid='chest-qty-1']")?.getAttribute("aria-label")).toBe("수량 1");
    expect(document.querySelector("[data-testid='chest-qty-10']")?.getAttribute("aria-label")).toBe("수량 10");
    expect(document.querySelector("[data-testid='chest-qty-all']")?.getAttribute("aria-label")).toBe("수량 전부");

    document.querySelector<HTMLButtonElement>("[data-testid='chest-close']")?.click();
    await pending;
    expect(document.querySelector("[data-testid='chest-scene']")).toBeNull();
  });

  it("names a locked chest with the same dialog contract", async () => {
    const scene = sceneFixture();
    const pending = playOpenChest(scene, { chestId: "sealed", displayName: "잠긴 궤", lockSwitchId: "sw_missing" });
    const dialog = document.querySelector<HTMLElement>("[data-testid='chest-locked']");
    expect(dialog?.getAttribute("role")).toBe("dialog");
    expect(dialog?.getAttribute("aria-modal")).toBe("true");
    const titleId = dialog?.getAttribute("aria-labelledby");
    expect(document.getElementById(titleId!)?.textContent).toBe("잠긴 궤");
    expect(document.querySelector("[data-testid='chest-status']")?.getAttribute("role")).toBe("status");

    document.querySelector<HTMLButtonElement>("[data-testid='chest-close']")?.click();
    await pending;
    expect(document.querySelector("[data-testid='chest-locked']")).toBeNull();
  });
});
