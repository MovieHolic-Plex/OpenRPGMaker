// editor/tools/emptyProject.ts
// 툴로 게임을 바닥부터 재구축할 때 쓰는 빈 프로젝트 시드.
// 유효한 에셋/타일셋/액터·클래스·스킬·장비는 유지하되, 맵/아이템/적/트룹은 비운다.
// (아이템/적/트룹은 upsert 툴로 채워야 카운트가 정확히 맞는다.)

import { PRODUCT_BRAND } from "@/brand";
import { SCHEMA_VERSION } from "@/project/types";
import type { Project } from "@/project/types";
import { defaultAssetSet, defaultResourceProfiles, defaultTilesets } from "@/project/defaults/defaultAssets";
import { defaultDatabase, defaultSession, defaultSystem, defaultTerms } from "@/project/defaults/defaultDatabase";
import { ensureSwitchVariableSlots } from "@/project/defaults/defaultProject";

export function createEmptyToolProject(title = "빈 프로젝트"): Project {
  const database = defaultDatabase();
  database.items = [];
  database.enemies = [];
  database.troops = [];

  const system = defaultSystem();
  // 트룹을 비웠으므로 초기 트룹 참조를 제거(참조 검증 통과).
  system.initialTroopId = undefined;

  const session = defaultSession();
  session.inventory = {};

  const project: Project = {
    version: SCHEMA_VERSION,
    meta: { title, author: PRODUCT_BRAND, terms: defaultTerms() },
    assets: defaultAssetSet(),
    resourceProfiles: defaultResourceProfiles(),
    tilesets: defaultTilesets(),
    switches: [],
    variables: [],
    commonEvents: [],
    database,
    system,
    session,
    maps: {},
    mapConnections: [],
    // 아직 맵이 없으므로 시작 맵/좌표는 비워 둔다. 첫 create_map이 시작 맵을 채택한다.
    mapTree: { mapId: "", children: [] },
    startMapId: "",
    startPos: { x: 0, y: 0 },
    flags: {},
  };
  ensureSwitchVariableSlots(project);
  return project;
}
