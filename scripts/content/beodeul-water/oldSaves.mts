// 옛 저장본 화소 대조(모델 없음): 고치기 전 체크아웃이 지은 프로젝트 JSON 을 지금 코드로 다시 그려, 그때 그린 PNG 와 화소 하나까지 같은지 본다.
//
//   bun scripts/content/beodeul-water/oldSaves.mts <폴더…>      # 폴더마다 *.project.json + 같은 이름의 .png
//
// 물빛·둑·깊이 띠는 새로 짓는 맵과 겉모습을 고른 게임에만 닿아야 한다 — 저장된 맵(칸 번호·이식 목록·look 그대로)은 달라지면 안 된다.
import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";
import { renderMapPng } from "../../qa-game/render.mts";

let files = 0, differ = 0;
for (const dir of process.argv.slice(2)) for (const name of fs.readdirSync(dir).filter((f) => f.endsWith(".project.json")).sort()) {
  const png = path.join(dir, name.replace(/\.project\.json$/u, ".png"));
  if (!fs.existsSync(png)) continue;
  const saved = JSON.parse(fs.readFileSync(path.join(dir, name), "utf8"));
  const now = PNG.sync.read(Buffer.from(renderMapPng(saved.project, saved.project.maps[saved.mapId]).png)), then = PNG.sync.read(fs.readFileSync(png));
  let diff = now.width !== then.width || now.height !== then.height ? -1 : 0;
  if (diff === 0) for (let i = 0; i < now.data.length; i += 4) if (now.data[i] !== then.data[i] || now.data[i + 1] !== then.data[i + 1] || now.data[i + 2] !== then.data[i + 2] || now.data[i + 3] !== then.data[i + 3]) diff += 1;
  files += 1; if (diff) differ += 1;
  console.log(`${diff === 0 ? "같다" : diff < 0 ? "크기 다름" : `다르다 ${diff}화소`}  ${path.join(path.basename(dir), name)}${saved.project.tilesets[saved.project.maps[saved.mapId].tilesetId]?.look ? " (겉모습 있음)" : ""}`);
}
console.log(`옛 저장본 ${files}장 — 다른 것 ${differ}장`);
process.exit(differ ? 1 : 0);
