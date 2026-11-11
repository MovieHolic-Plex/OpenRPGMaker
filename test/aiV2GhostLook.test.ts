import { describe, expect, it } from "vitest";
import { findNpcGraphicMatches } from "@/assets/charsetQuery";
import { lookMismatches } from "@/ai/v2/judge/lookChecks";
import { charsetFrameIndex } from "@/assets/easyrpgRtp";
import { createBlankProject } from "@/project/defaults";
import { getTool } from "@/editor/tools/toolRegistry";
import type { GameEvent, Project } from "@/project/types";
import { findingLine } from "@/ai/v2/judge/finding";

// 판정은 Finding 을 낸다 — 이 시험은 보고에 실리는 줄 글을 본다.
const lookLines = (...args: Parameters<typeof lookMismatches>): string[] => lookMismatches(...args).map(findingLine);

// 2026-10-25 심사 J66: 「하얀 드레스 여자 유령」이 0건 → 조수가 「유령」으로 다시 찾아 만화풍 흰 시트 유령(고무 오리처럼 읽힘)을 놓았다.
describe("person ghosts get a person chip, not the sheet ghost (J66)", () => {
  it("a multi-word query with no all-term match returns the closest chips instead of nothing", () => {
    const top = findNpcGraphicMatches("하얀 드레스 여자 유령")[0]?.entry;
    expect(top?.gender).toBe("female");
    // 2026-10-28 RefmapDoll(#3882) 카탈로그가 들어온 뒤 1등은 「흰 밑단의 주황·금색 드레스」 칸이다 — 「흰 드레스」 연속 문구는 더 이상 보장되지 않는다.
    // J66 의 계약은 «사람 칩(여성·드레스)이 시트 유령보다 먼저 온다» 이므로 드레스와 흰색 낱말이 각각 설명에 있는지만 본다.
    expect(top?.appearance).toMatch(/드레스/u);
    expect(top?.appearance).toMatch(/흰/u);
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
    expect(lookLines(before, after).some((line) => line.includes("시트 유령"))).toBe(true);
  });
});
