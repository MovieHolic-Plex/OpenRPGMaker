// 복구 전·후 프로젝트 JSON 의 맵을 지금 시트로 통째 그린다(게시 때 미리보기·그 판 프로브 그림과 같은 renderMapPng).
//   bun scripts/content/jp-city/qa/pin-repair-render.mts <project.json> <출력 폴더> <접두> <맵id>:<이름> …
import fs from "node:fs";
import { renderMapPng } from "../../../qa-game/render.mts";
import { ensureBundledTilesets } from "../../../../src/project/defaults/defaultAssets.ts";
import type { Project } from "../../../../src/project/types.ts";
const [inPath, out, prefix, ...spots] = process.argv.slice(2);
const project = JSON.parse(fs.readFileSync(inPath!, "utf8")) as Project;
ensureBundledTilesets(project);
for (const spot of spots) {
  const [mapId, name] = spot.split(":");
  fs.writeFileSync(`${out}/${prefix}-${name}.png`, renderMapPng({ ...project, startMapId: "__none__" }, project.maps[mapId!]!).png);
}
