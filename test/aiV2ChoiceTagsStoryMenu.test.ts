import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { choiceMetaTag, playerChoiceText } from "@/project/choiceText";
import { fieldMenu } from "@/project/fieldMenu";
import { applyStorySetupDefaults } from "@/ai/v2/genreDefaults";
import { gameContentProblems } from "@/ai/v2/gameChecks";
import type { Project } from "@/project/types";

describe("choice meta tags (J37)", () => {
  it("strips design notes but keeps prices and plain brackets", () => {
    expect(playerChoiceText("마지막으로 가게 문을 닫는다 (엔딩)")).toBe("마지막으로 가게 문을 닫는다");
    expect(playerChoiceText("혼자 도망친다 (배드 엔딩)")).toBe("혼자 도망친다");
    expect(playerChoiceText("침대에서 자고 다음 날 아침을 맞이한다 (+1일)")).toBe("침대에서 자고 다음 날 아침을 맞이한다");
    expect(playerChoiceText("커피를 건넨다 [호감+2]")).toBe("커피를 건넨다");
    expect(playerChoiceText("포션을 산다 (100G)")).toBe("포션을 산다 (100G)");
    expect(playerChoiceText("(조용히) 고개를 끄덕인다")).toBe("(조용히) 고개를 끄덕인다");
    expect(playerChoiceText("(엔딩)")).toBe("(엔딩)");
    expect(choiceMetaTag("혼자 도망친다 (배드 엔딩)")).toBe("(배드 엔딩)");
    expect(choiceMetaTag("포션을 산다 (100G)")).toBeUndefined();
  });

  it("finish check flags tagged choices in changed events", () => {
    const before = createBlankProject() as Project;
    const after = structuredClone(before);
    const map = after.maps[after.startMapId!]!;
    map.events.push({ id: "ev_door", name: "정문", x: 2, y: 2, pages: [{ trigger: { kind: "action" }, commands: [{ kind: "choices", options: [{ text: "혼자 도망친다 (배드 엔딩)", branch: [] }, { text: "언니를 찾는다", branch: [] }] }] }] } as never);
    const problems = gameContentProblems(before, after, "공포 게임 만들어 줘");
    expect(problems.some((p) => p.includes("[게임 검사 선택지]") && p.includes("(배드 엔딩)"))).toBe(true);
  });
});

describe("story ESC menu (J39)", () => {
  it("a non-combat game start gets the story menu; a battle game keeps the default", () => {
    const story = createBlankProject() as Project;
    expect(applyStorySetupDefaults(story, "폐업 직전 장난감 가게 회상 스토리 게임")).toContain("ESC 메뉴 이야기용");
    const commands = fieldMenu(story)!.entries.map((e) => e.command);
    expect(commands).not.toContain("skills");
    expect(commands).not.toContain("equipment");
    expect(commands).toContain("save");

    const battle = createBlankProject() as Project;
    applyStorySetupDefaults(battle, "보스와 전투가 있는 게임");
    expect(battle.meta.oprnFieldMenu).toBeUndefined();
  });

  it("does not overwrite an authored menu", () => {
    const p = createBlankProject() as Project;
    p.meta.oprnFieldMenu = { version: 1, entries: [{ command: "items", label: "가방" }] };
    applyStorySetupDefaults(p, "공포 게임");
    expect(p.meta.oprnFieldMenu.entries).toHaveLength(1);
  });
});
