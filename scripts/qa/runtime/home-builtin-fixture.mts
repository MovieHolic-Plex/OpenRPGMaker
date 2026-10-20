// 첫 화면 「기본 게임」 카드 그림용 픽스처. stdout = 프로젝트 JSON(출하 데모 그대로, 해상도 손대지 않음).
//   HOME_WHICH=fallen  『폴른 스타』(chrono-bell)
//   HOME_WHICH=astra   『아스트라 호라이즌』(emerald-crown)
// 실행: npx --no-install tsx --import ./tiledata/jp-city/refs/css-stub.mjs scripts/qa/runtime/home-builtin-fixture.mts > .omo/runtime-qa/home/fallen.json
import { serialize } from "../../../src/project/io";

const which = process.env.HOME_WHICH ?? "fallen";
const { createFlagshipDemoProject } = await import("../../../src/project/flagship");
const project = createFlagshipDemoProject(which === "astra" ? "emerald-crown" : "chrono-bell").project;
process.stderr.write(`[home-builtin] ${which} playResolution=${JSON.stringify(project.system.playResolution ?? null)} zoom=${project.system.cameraZoom ?? 1}\n`);
process.stdout.write(serialize(project));
