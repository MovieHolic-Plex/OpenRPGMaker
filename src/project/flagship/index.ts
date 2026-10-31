import type { NewProjectChoiceId } from "@/editor/newProjectChoices";
import { collectChangeTileCommands } from "@/project/changeTileValidation";
import { serialize } from "@/project/io";
import type { Project } from "@/project/types";
import {
  FLAGSHIP_BEAT_MANIFESTS,
  FLAGSHIP_DEMO_ID_BY_CHOICE,
  flagshipBeatManifestForChoice,
  formatFlagshipExemplarPrompt,
  validateFlagshipIpCleanliness,
} from "./beats";
import { createChronoBellFlagshipDemo } from "./chronoBell";
import { createEmeraldCrownFlagshipDemo } from "./emeraldCrown";
import { createFirstLoveFlagshipDemo } from "./firstLove";
import { createShitamachiFourthSeasonFlagshipDemo } from "./shitamachiFourthSeason";
import {
  FLAGSHIP_DEMO_IDS,
  type FlagshipBeat,
  type FlagshipBeatManifest,
  type FlagshipDemoBuildResult,
  type FlagshipDemoId,
  type FlagshipDemoSpec,
  type FlagshipStyleLock,
  type FlagshipStyleLockReport,
} from "./types";

export {
  FLAGSHIP_BEAT_MANIFESTS,
  FLAGSHIP_DEMO_ID_BY_CHOICE,
  FLAGSHIP_DEMO_IDS,
  createChronoBellFlagshipDemo,
  createEmeraldCrownFlagshipDemo,
  createFirstLoveFlagshipDemo,
  createShitamachiFourthSeasonFlagshipDemo,
  flagshipBeatManifestForChoice,
  formatFlagshipExemplarPrompt,
  validateFlagshipIpCleanliness,
  type FlagshipBeat,
  type FlagshipBeatManifest,
  type FlagshipDemoBuildResult,
  type FlagshipDemoId,
  type FlagshipDemoSpec,
  type FlagshipStyleLock,
  type FlagshipStyleLockReport,
};

export const FLAGSHIP_DEMO_SPECS: Readonly<Record<FlagshipDemoId, FlagshipDemoSpec>> = {
  "chrono-bell": {
    id: "chrono-bell",
    choiceId: "adventure-jrpg",
    manifest: FLAGSHIP_BEAT_MANIFESTS["chrono-bell"],
    build: createChronoBellFlagshipDemo,
  },
  "emerald-crown": {
    id: "emerald-crown",
    choiceId: "monster-collect",
    manifest: FLAGSHIP_BEAT_MANIFESTS["emerald-crown"],
    build: createEmeraldCrownFlagshipDemo,
  },
  "shitamachi-fourth-season": {
    id: "shitamachi-fourth-season",
    choiceId: "story-cutscene",
    manifest: FLAGSHIP_BEAT_MANIFESTS["shitamachi-fourth-season"],
    build: createShitamachiFourthSeasonFlagshipDemo,
  },
  "first-love": {
    id: "first-love",
    choiceId: "story-cutscene",
    manifest: FLAGSHIP_BEAT_MANIFESTS["first-love"],
    build: createFirstLoveFlagshipDemo,
  },
};

export function createFlagshipDemoProject(id: FlagshipDemoId): FlagshipDemoBuildResult {
  const spec = FLAGSHIP_DEMO_SPECS[id];
  if (!spec) {
    throw new Error(`알 수 없는 대표 데모게임 ID입니다: ${String(id)}`);
  }
  return lockDemoOpening(spec.build());
}

/**
 * 데모게임의 새 게임 오프닝은 건너뛸 수 없다(사용자 2026-10-31 「데모게임들의 오프닝은 스킵할 수 없게」).
 * 데모마다 `skippable` 을 따로 적지 않고 모든 데모가 지나는 이 입구에서 한 번에 잠근다 — 굽기·편집기 메뉴·dev 폴백이
 * 모두 여기를 지난다. 런타임(`cinematicSequence`)은 skippable 이 거짓이면 Esc·건너뛰기 단추를 둘 다 내지 않는다.
 */
function lockDemoOpening(result: FlagshipDemoBuildResult): FlagshipDemoBuildResult {
  const opening = result.project.system.opening;
  if (!opening || opening.skippable === false) return result;
  result.project.system.opening = { ...opening, skippable: false };
  return { ...result, serialized: serialize(result.project) };
}

export function createFlagshipDemoForChoice(choiceId: NewProjectChoiceId): FlagshipDemoBuildResult | undefined {
  const demoId = FLAGSHIP_DEMO_ID_BY_CHOICE[choiceId];
  return demoId ? createFlagshipDemoProject(demoId) : undefined;
}

export function validateFlagshipStyleLock(id: FlagshipDemoId, project: Project): FlagshipStyleLockReport {
  const manifest = FLAGSHIP_BEAT_MANIFESTS[id];
  const lock = manifest.styleLock;
  const violations: string[] = [];

  const mapList = Object.values(project.maps);
  if (mapList.length < manifest.mapCount) {
    violations.push(`맵 수 부족: ${mapList.length} < ${manifest.mapCount}`);
  }
  const allowedTilesets = new Set(lock.allowedTilesetIds);
  for (const map of mapList) {
    if (!allowedTilesets.has(map.tilesetId)) {
      violations.push(`화이트리스트 밖 타일셋 사용: ${map.id} -> ${map.tilesetId}`);
    }
  }
  const endingCount = project.endings?.length ?? 0;
  if (endingCount < manifest.endingCount) {
    violations.push(`엔딩 수 부족: ${endingCount} < ${manifest.endingCount}`);
  }

  let changeTileCount = 0;
  for (const map of mapList) {
    for (const ev of map.events) {
      changeTileCount += collectChangeTileCommands(ev.commands).length;
      for (const page of ev.pages ?? []) {
        changeTileCount += collectChangeTileCommands(page.commands).length;
      }
    }
  }
  if (changeTileCount < 1) {
    violations.push(`changeTile 기믹 부족: ${changeTileCount} < 1`);
  }

  const openingShotCount = project.system.opening?.scenes.length ?? 0;
  if (openingShotCount < 5) {
    violations.push(`오프닝 샷 수 부족: ${openingShotCount} < 5`);
  }

  const ipBad = validateFlagshipIpCleanliness(JSON.stringify(project.maps));
  for (const noun of ipBad) {
    violations.push(`외부 IP 고유명사 검출: ${noun}`);
  }

  return {
    id,
    demoId: id,
    ok: violations.length === 0,
    violations,
    mapCount: mapList.length,
    endingCount,
    changeTileCount,
    openingShotCount,
  };
}
