import { describe, expect, it } from "vitest";
import { applyFallenInteractiveProps } from "@/project/flagship/fallen/interactProps";
import type { Command, GameEvent, GameMap, Project } from "@/project/types";

const box = (name: string, x: number): GameEvent => ({
  id: `ev_fs_box_fs_test_${x}_1`, name: `수납 · ${name}`, x, y: 1, trigger: { kind: "action" }, commands: [],
  pages: [
    { id: `p${x}_0`, name: "뒤지기", conditions: [], graphic: { transparent: true }, movement: { type: "fixed", speed: 3, frequency: 3 }, priority: "same", trigger: { kind: "action" },
      commands: [{ kind: "text", body: "찾았다." }, { kind: "changeGold", op: "+=", amount: 5 }, { kind: "setSelfSwitch", key: "A", value: true }] },
    { id: `p${x}_1`, name: "이미 뒤짐", conditions: [{ kind: "selfSwitch", key: "A", value: true }], graphic: { transparent: true }, movement: { type: "fixed", speed: 3, frequency: 3 }, priority: "same", trigger: { kind: "action" },
      commands: [{ kind: "text", body: "이미 뒤져 봤다." }] },
  ],
} as unknown as GameEvent);

function fixture(names: string[]): Project {
  const width = names.length + 2;
  const map = {
    id: "fs_test", width, height: 3, tilesetId: "t", events: names.map((n, i) => box(n, i + 1)), locations: [],
    lowerTiles: new Array(width * 3).fill(0), upperTiles: new Array(width * 3).fill(-1),
  } as unknown as GameMap;
  return { maps: { fs_test: map } } as unknown as Project;
}

const firstPage = (e: GameEvent): Command[] => (e.pages![0]!.commands ?? []) as Command[];
const openFx = (e: GameEvent) => firstPage(e).find((c) => c.kind === "showAnimation") as { animationId?: string } | undefined;
const sounds = (e: GameEvent) => firstPage(e).filter((c) => c.kind === "playAudio").map((c) => (c as { resourceId: string }).resourceId);

describe("applyFallenInteractiveProps open effects", () => {
  it("gives barrel, crate, wardrobe and jar different open effects and keeps the loot", () => {
    const project = fixture(["통", "나무 상자", "옷장", "항아리"]);
    applyFallenInteractiveProps(project);
    const [barrel, crate, wardrobe, jar] = project.maps.fs_test!.events;
    const keys = [barrel, crate, wardrobe, jar].map((e) => `${openFx(e!)?.animationId}|${sounds(e!).join(",")}`);
    expect(new Set(keys).size).toBe(4);
    expect(openFx(barrel!)?.animationId).toBe("fx:container:barrel");
    expect(openFx(jar!)?.animationId).toBe("fx:container:jar");
    for (const e of [barrel, crate, wardrobe, jar]) {
      expect(firstPage(e!).some((c) => c.kind === "changeGold")).toBe(true);
      expect(firstPage(e!).some((c) => c.kind === "setSelfSwitch")).toBe(true);
    }
  });

  it("is idempotent — a second pass does not stack extra sounds", () => {
    const project = fixture(["옷장"]);
    applyFallenInteractiveProps(project);
    applyFallenInteractiveProps(project);
    expect(sounds(project.maps.fs_test!.events[0]!)).toEqual(["easyrpg-sound-close1"]);
  });
});
