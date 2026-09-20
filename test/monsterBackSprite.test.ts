/** @vitest-environment happy-dom */
import { describe, expect, it } from "vitest";
import { createBattleRuntime, type BattleSnapshot } from "@/battle/runtime";
import { battleField } from "@/player/battleFieldDom";
import { createBlankProject } from "@/project/defaults";
import { deserialize, serialize } from "@/project/io";
import { store } from "@/project/store";
import { prepareWebExport } from "@/project/webExport";

const BACK = "generated-enemy-reference-seed-back";
const BACK_PATH = "assets/generated/battle-skins/sprites/reference-seed-back.png";

function projectWithBack() {
  const project = createBlankProject();
  project.system.battleUiStyle = "pokemon";
  project.database.monsterSpecies![0]!.graphic.backResourceId = BACK;
  return project;
}

describe("authored monster rear battle sprite", () => {
  it("survives save/load and ships the referenced image", () => {
    const loaded = deserialize(serialize(projectWithBack()));
    expect(loaded.database.monsterSpecies![0]!.graphic.backResourceId).toBe(BACK);
    const exported = prepareWebExport(loaded);
    expect(exported.assets.some(asset => asset.zipPath === BACK_PATH)).toBe(true);
    expect(deserialize(exported.projectJson).database.monsterSpecies![0]!.graphic.backResourceId).toBe(BACK);
  });

  it("rejects a missing rear resource rather than accepting a broken saved reference", () => {
    const project = projectWithBack();
    project.database.monsterSpecies![0]!.graphic.backResourceId = "missing-rear-sprite";
    expect(() => deserialize(serialize(project))).toThrow(/backResourceId/);
  });

  it.each([true, false])("renders the rear image when configured (%s), otherwise keeps the front fallback", (hasBack) => {
    const project = projectWithBack();
    const species = project.database.monsterSpecies![0]!;
    if (!hasBack) delete species.graphic.backResourceId;
    store.replace(project);
    const runtime = createBattleRuntime({ project, troopId: project.database.troops[0]!.id, canEscape: true, canLose: true, rng: () => 0.5 });
    const snapshot = runtime.snapshot();
    const withMonster: BattleSnapshot = { ...snapshot, actors: snapshot.actors.map((actor, i) => i === 0 ? { ...actor, speciesId: species.id } : actor) };
    const image = battleField(withMonster).querySelector<HTMLImageElement>(".battle-monster-image");
    expect(image).not.toBeNull();
    expect(image!.classList.contains("battle-monster-authored-back")).toBe(hasBack);
    if (hasBack) expect(image!.getAttribute("src")).toBe(`/${BACK_PATH}`);
    else expect(image!.getAttribute("src")).not.toBe(`/${BACK_PATH}`);
  });
});
