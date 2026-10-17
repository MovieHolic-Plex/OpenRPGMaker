// 미연시 대사창 레이아웃 매트릭스 — 1024×768. 픽스처: bun scripts/qa/runtime/vn-matrix-fixture.mts output/qa/vnm-full full
//   node scripts/runtime-qa.mjs --scenario vn-matrix --project output/qa/vnm-full/project.json --out output/qa/vnm-full/shots
import { buildMatrixScenario } from "./vn-matrix.lib.mjs";
export default buildMatrixScenario({ id: "vn-matrix", viewport: { width: 1024, height: 768 }, fixtureDefault: "output/qa/vnm-full/project.json" });
