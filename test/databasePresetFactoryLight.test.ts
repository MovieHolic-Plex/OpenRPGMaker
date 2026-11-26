// 프리셋 판정의 기준 자료집은 타일셋 없이 지어도 타일셋을 실은 빈 프로젝트의 자료집과 같다(#5188 부팅 5s).
import { expect, it } from "vitest";
import { createBlankProject, createStarterBlankProject } from "@/project/defaults";
import { factoryDatabases } from "@/project/databasePresetRecords";
import { applyDefaultElementAffinities } from "@/project/defaults/defaultElementAffinities";

it("타일셋 없이 지은 기준 자료집 = 전체 빈 프로젝트의 자료집", () => {
  const full = createBlankProject(), genre = createBlankProject();
  applyDefaultElementAffinities(genre.database.enemies, genre.database.elements ?? []);
  const heavy = [full, createStarterBlankProject(), genre].map((project) => project.database);
  expect(JSON.stringify(factoryDatabases())).toBe(JSON.stringify(heavy));
  expect(Object.keys(createBlankProject({ withTilesets: false }).tilesets)).toEqual([]);
}, 120_000);
