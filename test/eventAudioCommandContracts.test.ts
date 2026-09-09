import { describe, expect, it, vi } from "vitest";
import { createInterpreter } from "@/player/interpreter";
import { m2CommandById, M2_COMMAND_CATALOG } from "@/project/eventCommands/m2Catalog";
import { resolveMapBgm } from "@/player/mapBgm";
import { systemAudioOverrideKey } from "@/player/systemAudioSlots";
import { createBlankProject } from "@/project/defaults";
import { startSession } from "@/project/session";
import type { Command, M2CommandFields, Project } from "@/project/types";
import type { PlaySession } from "@/project/session";
import type { StepResult } from "@/player/interpreter/types";

// 감사 U14(소리 축): G1-F2 사운드 레이어, G1-F9 BGM 기억/재생, G1-F23 BGM 페이드아웃, G4-F3 시스템 BGM/SE.
// 네 건 모두 「저작면이 고른 값이 실행면에 도달하는가」가 쟁점이라, 저작 필드 → 인터프리터 스텝까지
// 한 파일에서 같이 못 박는다.

function m2Command(title: string, fields: M2CommandFields = {}): Command {
  const entry = M2_COMMAND_CATALOG.find((candidate) => candidate.title === title);
  if (!entry) throw new Error(`unknown M2 command: ${title}`);
  return { kind: "m2Command", commandId: entry.id, fields };
}

function fieldKeys(title: string): readonly string[] {
  const entry = M2_COMMAND_CATALOG.find((candidate) => candidate.title === title);
  if (!entry) throw new Error(`unknown M2 command: ${title}`);
  return entry.fields.map((field) => field.key);
}

function mkSession(project: Project): PlaySession {
  return startSession(project, 3);
}

function firstStep(commands: readonly Command[], session: PlaySession): Exclude<StepResult, { kind: "done" }> {
  const interpreter = createInterpreter([...commands], session);
  const result = interpreter.start();
  if (result.kind === "done") throw new Error("interpreter finished without pausing");
  return result;
}

function drain(commands: readonly Command[], session: PlaySession): void {
  const interpreter = createInterpreter([...commands], session);
  let result = interpreter.start();
  let guard = 0;
  while (result.kind !== "done") {
    if (++guard > 50) throw new Error("interpreter did not settle");
    result = interpreter.resume();
  }
}

describe("G1-F2 사운드 레이어는 채널을 그대로 실행에 넘긴다", () => {
  it("효과음 채널은 SE 로, 1회 재생으로 나간다", () => {
    const project = createBlankProject();
    const session = mkSession(project);
    const step = firstStep([m2Command("Sound Layer", { channel: "se", resourceId: "easyrpg-sound-decision1" })], session);
    expect(step).toMatchObject({ kind: "playAudio", resourceId: "easyrpg-sound-decision1", channel: "se", loop: false });
    expect(session.audio.se).toEqual({ resourceId: "easyrpg-sound-decision1", loop: false });
    expect(session.audio.bgm).toBeUndefined();
  });

  it("환경음은 BGS 로 루프 재생하고 BGM 슬롯을 빼앗지 않는다", () => {
    const project = createBlankProject();
    const session = mkSession(project);
    session.audio.bgm = { resourceId: "cc0-bgm-field", loop: true };
    const step = firstStep([m2Command("Sound Layer", { channel: "ambient", resourceId: "cc0-bgm-town", fadeMs: 400 })], session);
    expect(step).toMatchObject({ kind: "playAudio", resourceId: "cc0-bgm-town", channel: "bgs", loop: true, fadeInMs: 400 });
    expect(session.audio.bgm).toEqual({ resourceId: "cc0-bgm-field", loop: true });
    expect(session.audio.bgs).toEqual({ resourceId: "cc0-bgm-town", loop: true });
  });

  it("음악 채널은 여전히 BGM 루프다", () => {
    const project = createBlankProject();
    const session = mkSession(project);
    const step = firstStep([m2Command("Sound Layer", { channel: "bgm", resourceId: "cc0-bgm-town" })], session);
    expect(step).toMatchObject({ kind: "playAudio", channel: "bgm", loop: true });
  });
});

describe("G1-F9 BGM 기억/재생", () => {
  it("두 명령 모두 고를 값이 없으므로 입력을 내주지 않는다", () => {
    expect(fieldKeys("Memorize Current BGM")).toEqual([]);
    expect(fieldKeys("Play Memorized BGM")).toEqual([]);
  });

  it("기억한 곡을 실제 재생 스텝으로 넘긴다", () => {
    const project = createBlankProject();
    const session = mkSession(project);
    session.audio.bgm = { resourceId: "cc0-bgm-field", loop: true };
    drain([m2Command("Memorize Current BGM")], session);
    session.audio.bgm = { resourceId: "cc0-bgm-battle", loop: true };

    const step = firstStep([m2Command("Play Memorized BGM")], session);
    expect(step).toMatchObject({ kind: "playAudio", resourceId: "cc0-bgm-field", channel: "bgm", loop: true });
    expect(session.audio.bgm).toEqual({ resourceId: "cc0-bgm-field", loop: true });
  });

  it("기억한 곡이 없으면 재생 스텝 없이 다음 명령으로 간다", () => {
    const project = createBlankProject();
    const session = mkSession(project);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    drain([m2Command("Play Memorized BGM"), { kind: "setSwitch", switchId: "after", value: true }], session);
    warn.mockRestore();
    expect(session.switches["after"]).toBe(true);
  });
});

describe("G1-F23 BGM 페이드아웃은 BGM 만 끊는다", () => {
  it("별칭이 채널 지정 정지를 저작한다", () => {
    const entry = m2CommandById("m2-062-fadeout-bgm");
    expect(entry?.existingKind).toBe("stopAudio");
  });

  it("채널 지정 정지 스텝은 그 채널만 실어 보낸다", () => {
    const project = createBlankProject();
    const session = mkSession(project);
    const step = firstStep([{ kind: "stopAudio", channel: "bgm" }], session);
    expect(step).toEqual({ kind: "stopAudio", channel: "bgm" });
  });

  it("채널 없는 정지는 기존 계약(전부 정지) 그대로다", () => {
    const project = createBlankProject();
    const session = mkSession(project);
    const step = firstStep([{ kind: "stopAudio" }], session);
    expect(step).toEqual({ kind: "stopAudio" });
  });
});

describe("G4-F3 시스템 BGM/SE 는 피커가 쓴 필드를 실행이 읽는다", () => {
  it("BGM 은 슬롯 + 음악 리소스를 저작한다", () => {
    expect(fieldKeys("Change System BGM")).toEqual(["slot", "resourceId"]);
    expect(fieldKeys("Change System SE")).toEqual(["slot", "resourceId"]);
  });

  it("고른 곡이 슬롯 오버라이드로 기록된다", () => {
    const project = createBlankProject();
    const session = mkSession(project);
    drain([m2Command("Change System BGM", { slot: "battle", resourceId: "cc0-bgm-battle" })], session);
    expect(session.m2Runtime?.system?.[systemAudioOverrideKey("battle")]).toBe("cc0-bgm-battle");
    expect(session.m2Runtime?.system?.["system_bgm"]).toBe("cc0-bgm-battle");
  });

  it("옛날 저장분의 value 필드도 계속 읽는다", () => {
    const project = createBlankProject();
    const session = mkSession(project);
    drain([m2Command("Change System SE", { slot: "escape", value: "easyrpg-sound-escape" })], session);
    expect(session.m2Runtime?.system?.[systemAudioOverrideKey("escape")]).toBe("easyrpg-sound-escape");
  });

  it("필드 기본곡 오버라이드가 맵 BGM 해석의 폴백을 바꾼다", () => {
    const project = createBlankProject();
    const mapId = Object.keys(project.maps)[0] ?? "";
    const authored = resolveMapBgm(project, mapId);
    const overridden = resolveMapBgm(project, mapId, { defaultBgmResourceId: "cc0-bgm-town" });
    expect(overridden).not.toEqual(authored);
    expect(overridden).toMatchObject({ kind: "play", resourceId: "cc0-bgm-town" });
  });
});
