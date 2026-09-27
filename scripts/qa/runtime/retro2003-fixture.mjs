// 정본을 건드리지 않고 두 QA 진입점이 같은 임시 프로젝트를 쓴다.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export function createRetro2003Fixture() {
  const project = JSON.parse(readFileSync(new URL("../../../test/fixtures/projects/editor-authored-demo-v3.json", import.meta.url), "utf8"));
  project.system.battleUiStyle = "retro2003";
  project.system.battleFlow = "gauge";
  const troop = project.database.troops.find((entry) => entry.id === "troop_forest_hornets");
  if (!troop) throw new Error("troop_forest_hornets 픽스처 누락");
  delete troop.previewBackgroundResourceId;
  mkdirSync(".omo/runtime-qa", { recursive: true });
  const temporary = mkdtempSync(".omo/runtime-qa/retro2003-");
  const path = join(temporary, "project.json");
  writeFileSync(path, JSON.stringify(project));
  const cleanup = () => rmSync(temporary, { recursive: true, force: true });
  process.once("exit", cleanup);
  return { path, project, cleanup };
}
