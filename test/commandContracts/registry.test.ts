import { describe, expect, it } from "vitest";
import { newCommand } from "@/editor/eventCommandFactory";
import {
  battleEventCommandRuntimeSupport,
  commandRuntimeSupport,
} from "@/project/eventCommands/runtimeSupport";
import { m2CatalogEntryRuntimeSupport, m2CommandByKind } from "@/project/eventCommands/m2Catalog";
import {
  COMMAND_CONTEXTS,
  COMMAND_GUARANTEES,
  commandGuaranteeIssues,
  type CommandGuarantee,
} from "@/project/commandGuaranteeRegistry";
import { COMMAND_KINDS, CONDITION_KINDS } from "@/project/commandKindRegistry";
import { createBlankProject } from "@/project/defaults";
import { deserialize, serialize } from "@/project/io";
import type { GameEvent } from "@/project/types";
import { NATIVE_MANIFEST } from "./nativeManifest";

describe("native command guarantee registry", () => {
  it("has one valid guarantee for every command and condition", () => {
    expect(COMMAND_KINDS).toHaveLength(77);
    expect(CONDITION_KINDS).toHaveLength(16);
    expect(Object.keys(COMMAND_GUARANTEES).sort()).toEqual([...COMMAND_KINDS].sort());
    expect(Object.keys(NATIVE_MANIFEST).sort()).toEqual([...COMMAND_KINDS].sort());
    for (const kind of COMMAND_KINDS) {
      expect(commandGuaranteeIssues(kind, COMMAND_GUARANTEES[kind])).toEqual([]);
      expect(NATIVE_MANIFEST[kind].kind).toBe(kind);
      expect(NATIVE_MANIFEST[kind].requiredCases).toEqual([
        "happy",
        "edge",
        "roundtrip",
        "pauseOrTermination",
      ]);
      expect(foundationDataIssues(NATIVE_MANIFEST[kind]), `${kind}: foundation data`).toEqual([]);
    }
  });

  it("rejects placeholder and string-only foundation specs", () => {
    const placeholder = {
      kind: "text",
      cases: {
        happy: "native:text:fixture",
        edge: "native:text:fixture",
        roundtrip: "native:text:expectation",
        pauseOrTermination: "native:text:expectation",
      },
    };

    expect(foundationDataIssues(placeholder)).toEqual([
      "happy: case must be an object",
      "edge: case must be an object",
      "roundtrip: case must be an object",
      "pauseOrTermination: case must be an object",
    ]);

    expect(foundationDataIssues({
      kind: "text",
      cases: Object.fromEntries(FOUNDATION_CASE_NAMES.map((caseName) => [caseName, {
        fixture: {},
        setup: {},
        command: { kind: "text" },
        expected: {
          commandAfterRoundtrip: { kind: "text" },
          allowedCompletions: [],
          forbiddenWarningCodes: [],
        },
      }])),
    })).toContain("happy: fixture must declare test ownership");
  });

  it("rejects full runtime support without a usable authoring route", () => {
    const invalid: CommandGuarantee = {
      family: "dialogue",
      stability: "stable",
      contractVersion: 1,
      supportByContext: { map: "full", common: "partial", troop: "partial" },
      executionOwner: "interpreter",
      completion: "continue",
      authoringSurfaces: [],
    };

    expect(commandGuaranteeIssues("text", invalid)).toEqual([
      "text: full support requires an authoring surface",
      "text: full support requires nested authoring",
      "text: map full support requires mainPicker authoring",
    ]);
  });

  it("declares only battle-executor-proven native kinds as full in troop context", () => {
    // 2026-08-20 오표시 정정: battleEvents.ts executor 실측(스위치 실행 22종) 전수 대조 결과,
    // 이미 구현돼 있던 changeGold/changeExp/changeLevel/learnSkill/changeParty/changeFriendship/
    // getFriendship/wait/playAudio/stopAudio 10종을 troop-full 로 승격했다.
    // 실행 22종 중 m2Command(commandId 별 동적 판정)와 inputWait(acknowledged 로그만)는 제외.
    // Step 2(2026-08-20): setSelfSwitch — ownerEventId 셀프 스위치 기록/write-back.
    // Step 3(2026-08-20): Tier-1 11종 — label/gotoLabel/loop/breakLoop(프레임 머신),
    // setFlag/timer(state write-back), showAnimation/gameOver/killPlayer/changeFace/
    // displayTextSettings(콜백·defeat 매핑·프레젠테이션 로그).
    // Step 3d(2026-08-20): changeEquipment/promoteActor — 맵과 같은 전이 권위자
    // (transitionActorEquipment/sessionClass.promoteActor) + 배틀러 파생 스탯 재계산 + write-back.
    const expected = [
      "text",
      "choices",
      "fork",
      "setSwitch",
      "setVariable",
      "callCommonEvent",
      "changeActorHp",
      "changeActorMp",
      "recoverAll",
      "changeItem",
      "changeGold",
      "changeExp",
      "changeLevel",
      "learnSkill",
      "changeParty",
      "changeFriendship",
      "getFriendship",
      "wait",
      "playAudio",
      "playMovie",
      "stopAudio",
      "setSelfSwitch",
      "label",
      "gotoLabel",
      "loop",
      "breakLoop",
      "setFlag",
      "timer",
      "showAnimation",
      "gameOver",
      "killPlayer",
      "changeFace",
      "displayTextSettings",
      "changeEquipment",
      "promoteActor",
    ].sort();
    const actual = COMMAND_KINDS.filter(
      (kind) => COMMAND_GUARANTEES[kind].supportByContext.troop === "full"
    ).sort();

    expect(actual).toEqual(expected);
    expect(COMMAND_GUARANTEES.m2Command.supportByContext).toEqual({
      map: "partial",
      common: "partial",
      troop: "partial",
    });
  });

  it("never declares full support beyond the operational runtime boundary", () => {
    for (const kind of COMMAND_KINDS) {
      const command = newCommand(kind);
      for (const context of COMMAND_CONTEXTS) {
        if (COMMAND_GUARANTEES[kind].supportByContext[context] !== "full") continue;
        const actual = context === "troop"
          ? battleEventCommandRuntimeSupport(command)
          : commandRuntimeSupport(command, context);
        expect(actual, `${kind}:${context}`).toBe("runtime-full");
      }
    }
  });

  it("reports native runtime support from the context guarantee instead of defaulting to full", () => {
    expect(commandRuntimeSupport(newCommand("giveMonster"), "map")).toBe("runtime-partial");
    expect(commandRuntimeSupport(newCommand("transfer"), "map")).toBe("runtime-full");
    expect(commandRuntimeSupport(newCommand("transfer"), "troop")).toBe("runtime-partial");
    expect(commandRuntimeSupport(newCommand("transfer"))).toBe("runtime-partial");
  });

  it("grades picker native aliases with the same context guarantee as the inserted command", () => {
    const transfer = m2CommandByKind("transfer");
    if (!transfer) throw new Error("missing transfer catalog alias");

    expect(m2CatalogEntryRuntimeSupport(transfer, "map")).toBe("runtime-full");
    expect(m2CatalogEntryRuntimeSupport(transfer, "troop")).toBe("runtime-partial");
    expect(m2CatalogEntryRuntimeSupport(transfer)).toBe("runtime-partial");
  });

  it("rejects stable full contexts without their context-specific authoring route", () => {
    const invalid: CommandGuarantee = {
      family: "compatibility",
      stability: "stable",
      contractVersion: 1,
      supportByContext: { map: "full", common: "partial", troop: "partial" },
      executionOwner: "interpreter",
      completion: "continue",
      authoringSurfaces: ["nested"],
    };

    expect(commandGuaranteeIssues("setFlag", invalid)).toEqual([
      "setFlag: map full support requires mainPicker authoring",
    ]);
  });
});

describe("legacy social project normalization", () => {
  it("stamps characterId once and remains identical on the second roundtrip", () => {
    const legacyProject = createBlankProject();
    const legacyEvent: GameEvent = {
      id: "ev_legacy_social",
      x: 1,
      y: 1,
      trigger: { kind: "action" },
      commands: [{ kind: "changeFriendship", delta: 10 }],
    };
    legacyProject.maps[legacyProject.startMapId].events.push(legacyEvent);

    const normalized = deserialize(serialize(legacyProject));
    const normalizedEvent = normalized.maps[normalized.startMapId].events.find(
      (event) => event.id === legacyEvent.id
    );
    expect(normalizedEvent?.characterId).toBe(legacyEvent.id);

    const secondRoundtrip = deserialize(serialize(normalized));
    expect(secondRoundtrip).toEqual(normalized);
  });
});

const FOUNDATION_CASE_NAMES = [
  "happy",
  "edge",
  "roundtrip",
  "pauseOrTermination",
] as const;

function foundationDataIssues(entry: unknown): readonly string[] {
  if (!isRecord(entry)) return ["entry must be an object"];
  if (!isRecord(entry.cases)) return ["cases must be an object"];
  const issues: string[] = [];
  for (const caseName of FOUNDATION_CASE_NAMES) {
    const contractCase = entry.cases[caseName];
    if (!isRecord(contractCase)) {
      issues.push(`${caseName}: case must be an object`);
      continue;
    }
    if (!isRecord(contractCase.fixture)) {
      issues.push(`${caseName}: fixture must be an object`);
    } else if (contractCase.fixture.ownership !== "test-owned") {
      issues.push(`${caseName}: fixture must declare test ownership`);
    }
    if (!isRecord(contractCase.setup)) {
      issues.push(`${caseName}: setup must be an object`);
    } else if (
      contractCase.setup.runtimeContext !== "map"
      || !isRecord(contractCase.setup.projectReferences)
      || !isRecord(contractCase.setup.sessionSeed)
    ) {
      issues.push(`${caseName}: setup must own map references and session seed`);
    }
    if (!isRecord(contractCase.command) || contractCase.command.kind !== entry.kind) {
      issues.push(`${caseName}: command must own the registered kind`);
    }
    if (!isRecord(contractCase.expected)) {
      issues.push(`${caseName}: expected outcome must be an object`);
      continue;
    }
    if (
      !isRecord(contractCase.expected.commandAfterRoundtrip)
      || contractCase.expected.commandAfterRoundtrip.kind !== entry.kind
    ) {
      issues.push(`${caseName}: expected roundtrip command must be an object`);
    }
    if (
      !Array.isArray(contractCase.expected.allowedCompletions)
      || contractCase.expected.allowedCompletions.join(",") !== "finished,owner-handoff"
    ) {
      issues.push(`${caseName}: expected completions must be an array`);
    }
    if (
      !Array.isArray(contractCase.expected.forbiddenWarningCodes)
      || contractCase.expected.forbiddenWarningCodes.join(",") !== "unknown-command-kind"
    ) {
      issues.push(`${caseName}: forbidden warning codes must be an array`);
    }
  }
  return issues;
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
