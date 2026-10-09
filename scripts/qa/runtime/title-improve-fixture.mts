// Runtime fixture for improve_title_screen: blank project, then the tool at TITLE_STAGE (0 = untouched).
import { createBlankProject } from "../../../src/project/defaults";
import { runTool } from "../../../src/editor/tools/toolRunner";
import { deserialize, serialize } from "../../../src/project/io";

const stage = Number(process.env.TITLE_STAGE ?? "3");
const project = createBlankProject();
project.meta.title = "Title improve contract";
project.startPos = { x: 4, y: 4 };
const ctx = { project };
const title = runTool(ctx, "set_title_screen", { title: "별빛 기사단" });
if (!title.ok) { console.error(title.summary); process.exit(1); }
if (stage > 0) {
  const result = runTool(ctx, "improve_title_screen", { stage });
  if (!result.ok) { console.error(result.summary); process.exit(1); }
  console.error(result.summary);
}
const json = serialize(ctx.project);
deserialize(json);
process.stdout.write(json);
