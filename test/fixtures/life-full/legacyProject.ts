import { createBlankProject } from "@/project/defaults";
import type { Project } from "@/project/types";

/** Legacy life specimen without the unrelated, redundant title-graphic seed.
 * Do not call deserialize here: doing so would hide newly invented optional fields.
 */
export function createLegacyLifeProject(): Project {
  const project = createBlankProject();
  if (project.system.titleScreen) delete project.system.titleScreen.titleGraphic;
  return project;
}
