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
    const { createBeodeulStarterMap, STARTER_SEED } = await import("@/editor/content/beodeulStarterMap");
    // 새 프로젝트 기본(버들항) 마을. 버들항이 없는 옛 번들이면 합본 마을 예제로 물러난다.
    // 예제의 마을도 제목마다 다르다 — 시드를 제목에서 뽑는다(늘 seed 7 이면 장르가 달라도 같은 마을이었다). 판정을 못 넘으면 옛 시드로 물러난다.
    const { planStart, startSeedText } = await import("@/project/startVariety");
    const { withVerifiedPlayableSegment } = await import("@/project/playableSegment");
    const seeds = [planStart({ seedText: startSeedText(undefined, title) }).seed, STARTER_SEED];
    let playable: Project | null = null;
    // 1순위: 빈 시작 맵 + 뼈대 — 뼈대가 제목에서 뽑은 구상(강가·포구 × 길가·흩어진·물가 띠 × 지형)으로 마을을 짓는다. 몬스터 칩셋 시작 맵은 마을을 못 지으니 건너뛴다.
    if (choice?.packId !== "monster-collect") {
      const planned = withVerifiedPlayableSegment(structuredClone(project));
      const built = planned?.maps[planned.startMapId];
      if (planned && built && built.width > 20) {
        built.name = choice?.label ?? built.name;
        playable = planned;
      }
    }
    for (const seed of playable ? [] : seeds) {
      const starter = createBeodeulStarterMap(project, choice?.label, seed) ?? { map: createStarterMap(), startPos: { x: 15, y: 16 } };
      const map = starter.map;
      map.name = choice?.label ?? map.name;
      const candidate = structuredClone(project);
      candidate.maps = { [map.id]: map };
      candidate.mapTree = singleNodeTree(map.id);
      candidate.startMapId = map.id;
      candidate.startPos = { ...starter.startPos };
      playable = withVerifiedPlayableSegment(candidate);
      if (playable) break;
    }
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
