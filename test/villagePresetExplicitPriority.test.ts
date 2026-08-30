import { describe, expect, it } from "vitest";

import { buildVillageDomain } from "@/editor/tools/village/builder";
import { createBlankProject } from "@/project/defaults";
import type { Project } from "@/project/types";

/**
 * PR #298 이 문서로 못박은 우선순위: **명시 인자 > 프리셋 > 테마 추론 > 씨앗값 파생**
 * (`builder.ts:113` 주석).
 *
 * 그런데 코드는 반대로 굴었다. 프리셋의 `templateIds` 로 카탈로그를 먼저 걸러 놓고, 호출자가
 * `housePlans[i].templateId` 로 그 화이트리스트 밖 형태를 못박으면 후보가 0 이 되어
 * `house-template-unplaced` 로 통째 중단했다 — 모델이 프롬프트만 보고 만들 수 있는 조합
 * (프리셋 + 명시 형태)이 도구 전체를 죽이는 셈이다.
 *
 * 화이트리스트는 **무작위 선택을 좁히는** 장치이고 명시 인자는 요구다. 그래서 합집합을 취한다.
 */

function projectWithVillageAuthoring(): Project {
  const project = createBlankProject();
  // 번 프로젝트 맵은 20x15 라 build_village 의 최소 20x20 을 못 넘긴다 — 추가로 넓힌다.
  const map = project.maps[project.startMapId] as unknown as Record<string, unknown>;
  const width = 48;
  const height = 48;
  map.width = width;
  map.height = height;
  for (const layer of ["lowerTiles", "upperTiles"] as const) {
    map[layer] = new Array(width * height).fill(0);
  }
  const authored = project as unknown as Record<string, unknown>;
  authored.villageTemplates = [
    { id: "vt_cottage", name: "오두막", w: 6, h: 5, wings: [{ x: 0, y: 0, w: 6, h: 5 }] },
    { id: "vt_manor", name: "저택", w: 8, h: 7, wings: [{ x: 0, y: 0, w: 8, h: 7 }] },
  ];
  authored.villagePresets = [
    // 프리셋은 오두막만 허용한다 — 무작위 선택을 좁히는 것이 목적이다.
    { id: "vp_cottages", name: "오두막 마을", houseCount: 3, templateIds: ["vt_cottage"] },
  ];
  return project;
}

const AREA = { x: 2, y: 2, w: 40, h: 40 };

describe("프리셋 화이트리스트와 명시 형태가 함께 와도 중단하지 않는다", () => {
  it("화이트리스트 밖 형태를 못박아도 성공한다 — 명시 인자가 이긴다", () => {
    const project = projectWithVillageAuthoring();
    // 실패는 ToolError(code: house-template-unplaced) 로 던져진다 — 성공은 "던지지 않음" 이다.
    const run = () =>
      buildVillageDomain(project, {
        mapId: project.startMapId,
        ...AREA,
        seed: 7,
        presetId: "vp_cottages",
        // 프리셋이 허용하지 않는 저택을 명시로 요구한다.
        housePlans: [{ templateId: "vt_manor" }],
      } as never);

    expect(run).not.toThrow();
    // 그리고 실제로 그 저택이 놓였는지 본다 — 던지지 않는 것만으로는 명시가 이겼다고 못 한다.
    const summary = String((run() as { summary?: string }).summary ?? "");
    expect(summary).toContain("집 1/1");
  });

  it("프리셋만 주면 그대로 좁혀진 채 성공한다", () => {
    const project = projectWithVillageAuthoring();
    expect(() =>
      buildVillageDomain(project, {
        mapId: project.startMapId,
        ...AREA,
        seed: 7,
        presetId: "vp_cottages",
      } as never),
    ).not.toThrow();
  });

  it("프리셋 없이 명시만 줘도 성공한다", () => {
    const project = projectWithVillageAuthoring();
    expect(() =>
      buildVillageDomain(project, {
        mapId: project.startMapId,
        ...AREA,
        seed: 7,
        housePlans: [{ templateId: "vt_manor" }],
      } as never),
    ).not.toThrow();
  });
});
