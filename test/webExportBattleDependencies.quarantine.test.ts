/** @vitest-environment happy-dom */
import { describe, expect, it } from "vitest";
import { BATTLER_IDLE_ANIMATIONS } from "@/assets/battlerIdleAnimations";
import { createBattleRuntime } from "@/battle/runtime";
import { battleField } from "@/player/battleFieldDom";
import { createBlankProject } from "@/project/defaults";
import { createStandaloneHtmlExport } from "@/project/standaloneExport";
import { STANDALONE_ASSETS_NODE_ID } from "@/project/standaloneHtml";
import { store } from "@/project/store";
import { collectWebExportAssets } from "@/project/webExportAssets";
import { prepareWebExport } from "@/project/webExport";

const backIdle = BATTLER_IDLE_ANIMATIONS.filter((entry) => entry.resourceId.endsWith("-back"));
const backPaths = backIdle.flatMap((entry) => [entry.path.replace("/idle/", "/"), entry.path]);

function renderedPartyPaths(skin: "pokemon") {
  const project = createBlankProject();
  project.system.battleUiStyle = skin;
  store.replace(project);
  const snapshot = createBattleRuntime({
    project, troopId: project.database.troops[0]!.id, canEscape: true, canLose: true, rng: () => 0.5,
  }).snapshot();
  const paths = new Set<string>();
  // Every database actor can join/reorder into the visible party after export.
  for (const actor of project.database.actors) {
    const field = battleField({ ...snapshot, actors: [{ ...snapshot.actors[0]!, battleCharacterResourceId: actor.battleCharacterResourceId }] });
    const image = field.querySelector<HTMLImageElement>(".battle-actor-group .battle-actor-image")!;
    expect(image).not.toBeNull();
    paths.add(image.getAttribute("src")!.slice(1));
    const idleUrl = image.style.getPropertyValue("--battler-anim-url").match(/url\("\/(.*?)"\)/)?.[1];
    if (idleUrl) paths.add(idleUrl);
  }
  return { project, paths: [...paths] };
}

describe("export runtime-selected party battle dependencies", () => {
  // 뒷모습 파티는 포켓몬 스킨뿐이다(정면 유리 스킨 rm2000 은 2026-10-02 에 지웠다).
  it.each(["pokemon"] as const)("ships the static and idle URLs actually rendered by %s", (skin) => {
    const { project, paths } = renderedPartyPaths(skin);
    expect(paths).toEqual(expect.arrayContaining(backPaths));
    const exported = new Set(collectWebExportAssets(project).map((asset) => asset.zipPath));
    expect(paths.filter((path) => !exported.has(path))).toEqual([]);
  });

  it("does not derive back sprites for a front-facing skin or custom battlers", () => {
    const project = createBlankProject();
    project.system.battleUiStyle = "retro2003";
    expect(collectWebExportAssets(project).some((asset) => backPaths.includes(asset.zipPath))).toBe(false);
    project.system.battleUiStyle = "pokemon";
    project.database.actors = project.database.actors.map((actor) => ({ ...actor, battleCharacterResourceId: "hero" }));
    expect(collectWebExportAssets(project).some((asset) => backPaths.includes(asset.zipPath))).toBe(false);
  });

  it("preserves hero idle pruning when actors no longer use generated sheets", () => {
    const project = createBlankProject();
    project.database.actors = project.database.actors.map((actor) => ({ ...actor, battleCharacterResourceId: "custom-battler" }));
    const exported = new Set(collectWebExportAssets(project).map((asset) => asset.zipPath));
    const sheets = BATTLER_IDLE_ANIMATIONS.filter((entry) => entry.tier === "sheet-cell");
    expect(sheets.filter((entry) => exported.has(entry.path))).toEqual([]);
  });

  it("keeps a runtime-selected uploaded back sprite through preparation", () => {
    const project = createBlankProject();
    const id = "generated-actor-hero-01-back";
    project.assets.uploaded[id] = { id, name: "Back override", kind: "picture", dataUrl: "data:image/png;base64,AQ==", meta: { width: 1, height: 1 } };
    const prepared = prepareWebExport(project);
    expect(prepared.project.assets.uploaded[id]).toEqual(project.assets.uploaded[id]);
    expect(prepared.assets).toContainEqual(expect.objectContaining({ kind: "uploaded", zipPath: `assets/uploaded/${id}.png` }));
  });

  it("embeds actual party render dependencies in the standalone asset table", async () => {
    const { project, paths } = renderedPartyPaths("pokemon");
    const result = await createStandaloneHtmlExport(project, { fetchBytes: async (path) => new TextEncoder().encode(path) });
    const html = document.createElement("div");
    html.innerHTML = await result.blob.text();
    const assets = JSON.parse(html.querySelector(`#${STANDALONE_ASSETS_NODE_ID}`)!.textContent!) as Record<string, string>;
    expect(result.summary.missingAssets).toEqual([]);
    for (const path of paths) expect(assets[path], path).toBe(`data:image/png;base64,${btoa(`/${path}`)}`);
  });
});
