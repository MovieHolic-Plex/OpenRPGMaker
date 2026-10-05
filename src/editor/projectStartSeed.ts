import { createNewProjectSeed } from "./genrePacks";
import { newProjectChoiceById, type NewProjectChoiceId } from "./newProjectChoices";
import { DEFAULT_START_SCREEN_SIZE, START_EXAMPLE_DETAILS, START_SCREEN_RESOLUTIONS, projectStartMode, type ProjectStartMode, type ProjectStartScreenSize } from "@/start/projectStart";
import type { Project } from "@/project/types";

/** Existing authored village and playable-segment tools own all tile placement. */
export async function createProjectStartSeed(choiceId: NewProjectChoiceId | null, title: string, mode?: ProjectStartMode, size: ProjectStartScreenSize = DEFAULT_START_SCREEN_SIZE): Promise<Project> {
  const choice = choiceId ? newProjectChoiceById(choiceId) : undefined;
  if (choiceId && !choice) throw new Error("선택한 시작 장르를 찾을 수 없습니다.");
  const startMode = projectStartMode(choiceId, mode);
  let project = createNewProjectSeed(choice?.packId ?? null, title);
  if (startMode === "example") {
    if (!choiceId || !START_EXAMPLE_DETAILS[choiceId]) throw new Error("이 장르에는 시작 예제가 없습니다.");
    const { createStarterMap, singleNodeTree } = await import("@/project/defaults/defaultMaps");
    const { createBeodeulStarterMap } = await import("@/editor/content/beodeulStarterMap");
    // 새 프로젝트 기본(버들항) 마을. 버들항이 없는 옛 번들이면 합본 마을 예제로 물러난다.
    const starter = createBeodeulStarterMap(project, choice?.label) ?? { map: createStarterMap(), startPos: { x: 15, y: 16 } };
    const map = starter.map;
    map.name = choice?.label ?? map.name;
    project.maps = { [map.id]: map };
    project.mapTree = singleNodeTree(map.id);
    project.startMapId = map.id;
    project.startPos = { ...starter.startPos };
    const { withVerifiedPlayableSegment } = await import("@/project/playableSegment");
    const playable = withVerifiedPlayableSegment(project);
    if (!playable) throw new Error("시작 예제를 준비하지 못했습니다. 다시 시도해 주세요.");
    project = playable;
    // The example opens on its actual map; its first Test Play does not require watching an unrelated opening.
    project.system.opening = { ...project.system.opening!, enabled: false };
    project.flags.starterExample = true;
  }
  if (startMode !== "ai") project.flags.firstRunGuide = true;
  const resolution = START_SCREEN_RESOLUTIONS[size];
  if (resolution) project.system.playResolution = { ...resolution };
  return project;
}
