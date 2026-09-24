// TS 설계도 검사기(src/editor/generatedBuildings)가 bp_fit.py 와 같은 판정을 내는지 대조한다.
// node scripts/asset-gen/forest-harmony-buildings/ts_parity.mts [후보 id ...]   (없으면 -raw.png 와 -bpcheck.json 이 다 있는 후보 전부)
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PNG } from "pngjs";
import { decodeStyleKit, type BuildingBlueprint } from "../../../src/editor/generatedBuildings/blueprintTypes.ts";
import { buildBlueprintReference } from "../../../src/editor/generatedBuildings/blueprintReference.ts";
import { fitBlueprintCandidate } from "../../../src/editor/generatedBuildings/blueprintFit.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const OUT = process.env.OUT_DIR || path.join(ROOT, ".omo/asset-gen-tmp/fh-bld");
const BP = JSON.parse(readFileSync(path.join(ROOT, "tiledata/forest-harmony-buildings/blueprints.json"), "utf8"));
const kit = decodeStyleKit(JSON.parse(readFileSync(path.join(ROOT, "tiledata/forest-harmony-buildings/style-kit.json"), "utf8")));
const png = (p: string) => { const im = PNG.sync.read(readFileSync(p)); return { width: im.width, height: im.height, data: new Uint8ClampedArray(im.data) }; };

let ids = process.argv.slice(2);
if (!ids.length) ids = readdirSync(OUT).filter((f) => f.endsWith("-raw.png")).map((f) => f.slice(0, -8)).filter((n) => existsSync(`${OUT}/${n}-bpcheck.json`));
const refDiff = new Map<string, number>();
let agree = 0, total = 0;
const mism: string[] = [];
for (const n of ids.sort()) {
  const bid = n.replace(/-c\d+$/, "");
  const bp = BP.blueprints.find((b: BuildingBlueprint) => b.id === bid);
  if (!bp || "style" in bp) continue;   // 참고 맵 조각이 화풍인 설계도(성)는 앱 범위 밖
  const { image, layout } = buildBlueprintReference(bp, kit);
  if (!refDiff.has(bid)) {
    const py = png(`${OUT}/${bid}-ref.png`);
    let d = 0;
    for (let i = 0; i < py.width * py.height; i++) if ([0, 1, 2].some((c) => Math.abs(py.data[i * 4 + c]! - image.data[i * 4 + c]!) > 0)) d++;
    const meta = JSON.parse(readFileSync(`${OUT}/${bid}-ref.json`, "utf8"));
    refDiff.set(bid, d);
    if (meta.origin[0] !== layout.origin[0] || meta.origin[1] !== layout.origin[1]) console.log(bid, "기준 원점 다름", meta.origin, layout.origin);
  }
  const t0 = performance.now();
  const r = fitBlueprintCandidate(png(`${OUT}/${n}-raw.png`), bp, kit, layout);
  const ms = performance.now() - t0;
  const py = JSON.parse(readFileSync(`${OUT}/${n}-bpcheck.json`, "utf8"));
  total++;
  const diffKeys = Object.keys(py.checks).filter((k) => py.checks[k] !== r.checks[k]);
  let artDiff = -1;
  if (existsSync(`${OUT}/${n}-art.png`)) {
    const a = png(`${OUT}/${n}-art.png`);
    if (a.width === r.art.width && a.height === r.art.height) {
      artDiff = 0;
      for (let i = 0; i < a.data.length; i += 4) if ([0, 1, 2, 3].some((c) => a.data[i + c] !== r.art.data[i + c])) artDiff++;
    }
  }
  const same = py.pass === r.pass && diffKeys.length === 0 && py.head_extra === r.headExtra;
  if (same) agree++;
  else mism.push(n);
  console.log(`${same ? "같음" : "다름"} ${n} py=${py.pass ? "통과" : "탈락"} ts=${r.pass ? "통과" : "탈락"}`
    + ` | 다른 검사 ${JSON.stringify(diffKeys)} | 머리 ${py.head_extra}/${r.headExtra} | 번짐 ${py.door_over}/${r.doorOver}`
    + ` | 처마 ${py.zone?.eave_off_n}/${r.zone?.eaveOffN} | R ${py.zone?.roof_in_R}/${r.zone?.roofInR} W ${py.zone?.roof_in_W}/${r.zone?.roofInW}`
    + ` | 그림 다른 픽셀 ${artDiff < 0 ? "크기 다름" : `${artDiff}/${r.art.width * r.art.height}`} | ${ms | 0}ms`);
}
console.log("기준 이미지 다른 픽셀:", Object.fromEntries(refDiff));
console.log(`판정 일치 ${agree}/${total}`, mism.length ? `다른 것: ${mism.join(" ")}` : "");
