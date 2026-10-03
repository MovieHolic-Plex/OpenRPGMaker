// scripts/lib/worldmapBuild.mjs 의 타입 선언. 헤드리스 조수(scripts/qa-game/gen.mts)가 쓴다.
import type { WorldmapBuildRequest, WorldmapBuildResult } from "../../src/editor/worldmap/worldmapBuild";
export function buildWorldmap(request: WorldmapBuildRequest): Promise<WorldmapBuildResult>;
