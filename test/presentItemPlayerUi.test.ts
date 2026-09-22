// @vitest-environment happy-dom
// presentItem 실플레이어 경로: 선물하기와 같은 목록 창을 띄우고, 고른 아이템으로 인터프리터를 재개한다.
import { beforeEach, describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { deserialize, serialize } from "@/project/io";
import { store } from "@/project/store";
import { startSession } from "@/project/session";
import { runCommands } from "@/player/playSceneInterpreter";
import type { PlaySceneContext } from "@/player/playSceneTypes";
import type { Command } from "@/project/types";

function sceneFixture(inventory: Record<string, number>) {
  const blank = createBlankProject();
  const template = blank.database.items[0]!;
  blank.database.items.push({ ...template, id: "item_knife", name: "피 묻은 칼" }, { ...template, id: "item_letter", name: "찢긴 편지" });
  store.replace(deserialize(serialize(blank)));
  const project = store.getCurrent();
  const messages: string[] = [];
  const dialogue = { showText: async (message: { body: string }) => { messages.push(message.body); }, showChoices: async () => 0, showNumberInput: async () => 0, close() {}, hide() {} };
  const host = document.createElement("div");
  document.body.append(host);
  const scene = { session: startSession(project, 1), map: project.maps[project.startMapId], tileY: 0, running: false, inputEnabled: true, eventPositions: {}, eventSprites: new Map(), game: { registry: { get: (key: string) => key === "dialogue" ? dialogue : key === "dialogueHost" ? host : undefined } }, setInputEnabled() {}, refreshRuntimeSurfaces() {}, syncRuntimeState() {}, showRuntimeOverlay() {}, clearRuntimeOverlay() {} } as unknown as PlaySceneContext;
  scene.session.inventory = { ...inventory };
  return { scene, messages, host };
}

const interrogate: Command[] = [{
  kind: "presentItem",
  prompt: "증거를 제시하라",
  itemIds: ["item_knife", "item_letter"],
  options: [{ itemId: "item_knife", branch: [{ kind: "text", body: "자백" }] }],
  otherwiseBranch: [{ kind: "text", body: "헛짚음" }],
  cancelBranch: [{ kind: "text", body: "안 냄" }],
}];

async function waitFor<T>(probe: () => T | null | undefined): Promise<T> {
  for (let i = 0; i < 50; i += 1) {
    const found = probe();
    if (found) return found;
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  throw new Error("timed out");
}

describe("presentItem 플레이어 UI", () => {
  beforeEach(() => { document.body.replaceChildren(); });

  it("소지한 후보만 목록에 띄우고 고른 아이템의 분기를 실행한다", async () => {
    const { scene, messages, host } = sceneFixture({ item_knife: 1, item_letter: 2, item_other: 1 });
    const run = runCommands(scene, interrogate);
    const button = await waitFor(() => host.querySelector<HTMLButtonElement>("[data-testid='present-item-item_knife']"));
    expect(host.querySelector("[data-testid='present-item-scene']")?.textContent).toContain("증거를 제시하라");
    expect([...host.querySelectorAll("[data-testid^='present-item-item_']")].map((el) => el.textContent)).toEqual(["피 묻은 칼1", "찢긴 편지2"]);
    button.click();
    await run;
    expect(messages).toEqual(["자백"]);
    expect(host.querySelector("[data-testid='present-item-scene']")).toBeNull();
  });

  it("그만두기 → cancelBranch", async () => {
    const { scene, messages, host } = sceneFixture({ item_knife: 1 });
    const run = runCommands(scene, interrogate);
    (await waitFor(() => host.querySelector<HTMLButtonElement>("[data-testid='present-item-cancel']"))).click();
    await run;
    expect(messages).toEqual(["안 냄"]);
  });

  it("보여줄 것이 없으면 prompt 만 보이고 cancelBranch", async () => {
    const { scene, messages, host } = sceneFixture({});
    await runCommands(scene, interrogate);
    expect(host.querySelector("[data-testid='present-item-scene']")).toBeNull();
    expect(messages).toEqual(["증거를 제시하라", "안 냄"]);
  });
});
