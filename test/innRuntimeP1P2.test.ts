import { describe, expect, it } from "vitest";
import { createInterpreter } from "@/player/interpreter";
import { innTextModel } from "@/player/playSceneCommerce";
import { recoverPartyVitals, type ActorVitals } from "@/project/sessionVitals";
import { createBlankProject, DEFAULT_ACTOR_ID } from "@/project/defaults";
import { resolveTerms } from "@/project/terms";
import type { Command } from "@/project/types";
import { startSession } from "@/project/session";

describe("inn P1/P2 runtime contracts", () => {
  it("uses custom note/question and HP-only wake copy", () => {
    const text = innTextModel(
      {
        kind: "inn",
        price: 12,
        note: "Welcome traveler",
        question: "Stay the night?",
        recoverMp: false,
      },
      resolveTerms(createBlankProject())
    );
    expect(text.note).toBe("Welcome traveler");
    expect(text.question).toBe("Stay the night?");
    expect(text.wakeMessage).toContain("HP");
  });

  it("recovers HP only when recoverMp is false", () => {
    const vitals: Record<string, ActorVitals> = {
      [DEFAULT_ACTOR_ID]: { hp: 1, mp: 2, maxHp: 10, maxMp: 8 },
    };
    recoverPartyVitals(vitals, [DEFAULT_ACTOR_ID], { recoverMp: false });
    expect(vitals[DEFAULT_ACTOR_ID]?.hp).toBe(10);
    expect(vitals[DEFAULT_ACTOR_ID]?.mp).toBe(2);
  });

  it("pushes notEnoughBranch when inn resumes with notEnough", () => {
    const project = createBlankProject();
    const session = startSession(project);
    const commands: Command[] = [
      {
        kind: "inn",
        price: 99,
        branchOnNotEnoughGold: true,
        notEnoughBranch: [{ kind: "text", body: "not-enough-gold" }],
      },
      { kind: "text", body: "after-inn" },
    ];
    const interpreter = createInterpreter(commands, session, project);
    const pause = interpreter.start();
    expect(pause.kind).toBe("inn");
    if (pause.kind !== "inn") return;
    expect(pause.branchOnNotEnoughGold).toBe(true);

    const next = interpreter.resume("notEnough");
    expect(next.kind).toBe("text");
    if (next.kind === "text") expect(next.body).toBe("not-enough-gold");
  });
});
