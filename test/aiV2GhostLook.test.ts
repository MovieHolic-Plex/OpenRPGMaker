import { describe, expect, it } from "vitest";
import { findNpcGraphicMatches } from "@/assets/charsetQuery";
import { lookMismatches } from "@/ai/v2/lookChecks";
import { charsetFrameIndex } from "@/assets/easyrpgRtp";
import { createBlankProject } from "@/project/defaults";
import { getTool } from "@/editor/tools/toolRegistry";
import type { GameEvent, Project } from "@/project/types";

// 2026-10-25 심사 J66: 「하얀 드레스 여자 유령」이 0건 → 조수가 「유령」으로 다시 찾아 만화풍 흰 시트 유령(고무 오리처럼 읽힘)을 놓았다.
describe("person ghosts get a person chip, not the sheet ghost (J66)", () => {
  it("a multi-word query with no all-term match returns the closest chips instead of nothing", () => {
    const top = findNpcGraphicMatches("하얀 드레스 여자 유령")[0]?.entry;
    expect(top?.gender).toBe("female");
    expect(top?.appearance).toMatch(/흰 드레스/u);
  });

  it("list_npc_graphics searches the person and says to draw the ghost with blendMode add", () => {
    const result = getTool("list_npc_graphics")!.run(createBlankProject() as Project, { query: "하얀 드레스 여자 유령" }) as { data: { matches: { label: string; gender?: string }[]; ghostHint?: string } };
    expect(result.data.matches[0]?.gender).toBe("female");
    expect(result.data.ghostHint).toContain("blendMode");
  });

  it("the finish check flags a person ghost drawn with the sheet ghost chip", () => {
    const before = createBlankProject() as Project;
    const after = structuredClone(before);
    const map = Object.values(after.maps)[0]!;
    map.events = [...(map.events ?? []), {
      id: "ev_lady", name: "지나가는 하얀 드레스의 여자", x: 3, y: 3, trigger: "action",
      pages: [{ id: "p1", name: "", conditions: [], trigger: "action", priority: "same", commands: [],
        graphic: { sprite: { type: "bundled", id: "tex_easyrpg_charset_monster1" }, direction: "down", pattern: charsetFrameIndex({ characterIndex: 3, direction: "down", pattern: 1 }) } }],
    } as unknown as GameEvent];
    expect(lookMismatches(before, after).some((line) => line.includes("시트 유령"))).toBe(true);
  });
});
