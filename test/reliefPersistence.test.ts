// test/reliefPersistence.test.ts
// 높이 지형(map.relief)이 저장·다시 열기·웹 내보내기를 거쳐도 단·경사로·벽면 장식이 그대로 남는다.
import { describe, it, expect } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { deserialize, serialize } from "@/project/io";
import { createProjectPackage, readProjectPackage } from "@/project/package";
import { prepareWebExport } from "@/project/webExport";
import { rampCode } from "@/project/relief/walk";
import type { Project } from "@/project/types";

// x ≥ 6 은 2단 대지, (5, 3) 은 동쪽으로 오르는 경사로, (6, 4) 남쪽 벽에 장식 한 장.
function reliefProject(): Project {
  const project = createBlankProject();
  const map = project.maps[project.startMapId]!;
  const levels = new Array(map.width * map.height).fill(0).map((_, i) => ((i % map.width) >= 6 ? 2 : 0));
  const ramps = new Array(map.width * map.height).fill(0);
  ramps[3 * map.width + 5] = rampCode("e");
  map.relief = { width: map.width, height: map.height, levels, ramps, wallDecor: [{ x: 6, y: 4, row: 1, tile: 7 }] };
  return project;
}

describe("relief persistence", () => {
  it("serialize → deserialize 가 relief 를 지키고, 두 번째 왕복도 같다", () => {
    const project = reliefProject();
    const expected = project.maps[project.startMapId]!.relief;
    const once = deserialize(serialize(project));
    expect(once.maps[project.startMapId]!.relief).toEqual(expected);
    const twice = deserialize(serialize(once));
    expect(twice.maps[project.startMapId]!.relief).toEqual(once.maps[project.startMapId]!.relief);
  });

  it(".oprn 패키지로 저장했다 다시 열어도 relief 가 같다", async () => {
    const project = reliefProject();
    const reopened = await readProjectPackage(createProjectPackage(project));
    expect(reopened.maps[project.startMapId]!.relief).toEqual(project.maps[project.startMapId]!.relief);
  });

  it("웹 내보내기 project.json 에 relief 가 남는다", () => {
    const project = reliefProject();
    const prepared = prepareWebExport(project);
    const exported = deserialize(prepared.projectJson);
    expect(exported.maps[project.startMapId]!.relief).toEqual(project.maps[project.startMapId]!.relief);
    expect(prepared.project.maps[project.startMapId]!.relief).toEqual(project.maps[project.startMapId]!.relief);
  });
});
