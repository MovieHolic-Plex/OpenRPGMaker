// 해상도 기본값 QA 픽스처: which=new(새 프로젝트 wide 씨앗) | fallen(폴른 스타). stdout = 프로젝트 JSON.
import { serialize } from "../../../src/project/io";
const which = process.env.RES_WHICH ?? "new";
let project;
if (which === "fallen") {
  const { createChronoBellFlagshipDemo } = await import("../../../src/project/flagship/chronoBell");
  project = createChronoBellFlagshipDemo().project;
} else {
  const { createProjectStartSeed } = await import("../../../src/editor/projectStartSeed");
  const { START_EXAMPLE_DETAILS } = await import("../../../src/start/projectStart");
  const id = "adventure-jrpg" as never; void START_EXAMPLE_DETAILS;
  project = await createProjectStartSeed(id, "새 게임", "example", "wide");
}
process.stdout.write(serialize(project));
