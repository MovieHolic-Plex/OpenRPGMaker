import { describe, expect, it } from "vitest";
import { PNG } from "pngjs";
import { runGameCheck } from "@/qa/gameCheck";
import { buildReportHtml, renderMapPng } from "../scripts/qa-game/render.mts";
import { buildQaFixture } from "./fixtures/qaGame/qaGameFixtures";

describe("qa-game render — 헤드리스 맵 PNG + 자체완결 report.html", () => {
  it("모든 맵을 타일 크기대로 그리고, 시트는 외부 참조 없이 data URI 만 쓴다", () => {
    const project = buildQaFixture("orphanMaps");
    const maps = Object.values(project.maps).map((map) => ({ map, ...renderMapPng(project, map) }));
    for (const { map, png, note } of maps) {
      expect(note).toBeUndefined();
      const decoded = PNG.sync.read(png);
      const size = project.tilesets[map.tilesetId]!.tileSize;
      expect([decoded.width, decoded.height]).toEqual([map.width * size, map.height * size]);
    }
    // 타일이 실제로 칠해졌는지 — 바둑판 바탕색(42/51) 말고 다른 색이 충분히 있어야 한다.
    const start = PNG.sync.read(maps.find(({ map }) => map.id === project.startMapId)!.png);
    let painted = 0;
    for (let i = 0; i < start.data.length; i += 4) if (![42, 51].includes(start.data[i]!)) painted += 1;
    expect(painted / (start.data.length / 4)).toBeGreaterThan(0.5);

    const report = runGameCheck(project, { skipAutoPlay: true });
    const html = buildReportHtml({ project, report, maps });
    expect(html.match(/<img src="data:image\/png;base64,/gu)?.length).toBe(maps.length);
    expect(html).not.toMatch(/(?:src|href)="(?:https?:|\/)/u);
    expect(html).toContain("orphan-empty-map");
    expect(html).toContain("빈 껍데기");
  });
});
