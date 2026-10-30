import { describe, expect, it } from "vitest";
import { defaultTerms } from "@/project/defaults/defaultDatabase";
import { formatBattleCommandPrompt, resolveTermOverrides } from "@/project/terms";
import { stateBadgeLabel } from "@/player/battleStatusLabel";

describe("battle terms", () => {
  it("default command prompt matches the old hard-coded line", () => {
    const template = defaultTerms().battleCommandPrompt;
    expect(formatBattleCommandPrompt(template, "카엘")).toBe("카엘은 무엇을 할까?");
    expect(formatBattleCommandPrompt(template, "루나")).toBe("루나는 무엇을 할까?");
    expect(formatBattleCommandPrompt(template, "루나", true)).toBe("루나는\n무엇을 할까?");
  });

  it("custom templates fill plain and particle placeholders", () => {
    expect(formatBattleCommandPrompt("{name}, 어떻게 할까?", "카엘")).toBe("카엘, 어떻게 할까?");
    expect(formatBattleCommandPrompt("{name이} 명령을 기다린다", "루나")).toBe("루나가 명령을 기다린다");
    expect(formatBattleCommandPrompt("What will {name} do?", "Kael")).toBe("What will Kael do?");
  });

  it("victory banner defaults to 승리! and is overridable", () => {
    expect(resolveTermOverrides(undefined).battleVictory).toBe("승리!");
    expect(resolveTermOverrides({ battleVictory: "VICTORY" }).battleVictory).toBe("VICTORY");
  });
});

describe("stateBadgeLabel", () => {
  it("uses the authored state name in the game's language", () => {
    expect(stateBadgeLabel("마비")).toBe("마비");
    expect(stateBadgeLabel("독")).toBe("독");
    expect(stateBadgeLabel("마비 상태")).toBe("마비");
    expect(stateBadgeLabel("麻痺")).toBe("麻痺");
  });

  it("leaves long latin names to the CSS abbreviation", () => {
    expect(stateBadgeLabel("Paralysis")).toBeNull();
    expect(stateBadgeLabel("state_paralysis")).toBeNull();
    expect(stateBadgeLabel("  ")).toBeNull();
  });
});
