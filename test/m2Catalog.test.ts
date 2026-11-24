import { describe, expect, it, vi } from "vitest";
import { createBattleRuntime } from "@/battle/runtime";
import { parseM2BattleCommand } from "@/battle/battleM2Commands";
import { deserialize } from "@/project/io";
import { battleTroopError } from "@/project/battleAdmission";
import { validateLowLevelCommandArray } from "@/editor/tools/commandArgs";
import { validateCommandArray } from "@/project/io/shapeCommandFields";
import { m2CommandById, M2_COMMAND_CATALOG, isM2CatalogEntrySelectableInMap } from "@/project/eventCommands/m2Catalog";
import { executeM2RuntimeCommand } from "@/player/interpreter/m2Runtime";
import { applyBattleTimerWrites, updateRuntimeTimers } from "@/player/playSceneTimers";
import { startSession, type PlaySession } from "@/project/session";
import type { Command, M2CommandFields, Project } from "@/project/types";
import type { PlaySceneContext } from "@/player/playSceneTypes";
import fixture from "./fixtures/projects/battle-v3.json";
import { createInterpreter } from "@/player/interpreter";
import { resolveMapBgm } from "@/player/mapBgm";
import { systemAudioOverrideKey } from "@/player/systemAudioSlots";
import { createBlankProject } from "@/project/defaults";
import type { StepResult } from "@/player/interpreter/types";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { isolateTimers } from "./mergedTeardown";

describe("battleReviewIntegrity", () => {
  isolateTimers();
  type M2 = Extract<Command, { kind: "m2Command" }>;
  const hpCommand = (target: string): M2 => ({
    kind: "m2Command", commandId: "m2-098-change-enemy-hp",
    fields: { target, operation: "set", value: 0 },
  });
  function eventBattle(commands: Command[]) {
    const project = deserialize(JSON.stringify(fixture));
    const troop = project.database.troops.find((record) => record.id === "troop_slime")!;
    troop.battleEventPages = [{
      id: "review", name: "Review", span: "battle", conditions: [], commands,
    }];
    const runtime = createBattleRuntime({
      project, troopId: troop.id, canEscape: true, canLose: true, battleFlow: "gauge", rng: () => 0.5,
    });
    runtime.tick(1_000);
    runtime.performActorCommand({ kind: "defend" });
    return { project, runtime };
  }
  describe("battle review integrity boundaries", () => {
    it("resolves simultaneous troop-event knockouts as defeat without rewards", () => {
      const { runtime } = eventBattle([
        hpCommand("all"),
        { kind: "changeActorHp", actorId: "party", op: "=", amount: 0 },
      ]);
      const snapshot = runtime.snapshot();
      expect(snapshot.actors.every((actor) => actor.hp === 0)).toBe(true);
      expect(snapshot.enemies.every((enemy) => enemy.hp === 0)).toBe(true);
      expect(snapshot.result).toBe("defeat");
      expect(snapshot.rewards).toMatchObject({ exp: 0, gold: 0, items: [] });
      runtime.cancel();
    });

    it.each(["enemy-99", "deleted_enemy", ""])("does not redirect unknown enemy target %s", (target) => {
      const { runtime } = eventBattle([hpCommand(target)]);
      const snapshot = runtime.snapshot();
      expect(snapshot.enemies[0].hp).toBe(snapshot.enemies[0].maxHp);
      expect(snapshot.result).toBeUndefined();
      expect(snapshot.eventLogs.some((entry) => entry.kind === "unsupported")).toBe(true);
      runtime.cancel();
    });

    it.each(["enemy-1", "enemy_slime", "all"])("still applies explicit enemy target %s", (target) => {
      const { runtime } = eventBattle([hpCommand(target)]);
      expect(runtime.snapshot().enemies[0].hp).toBe(0);
      expect(runtime.snapshot().result).toBe("victory");
      runtime.cancel();
    });

    it.each([undefined, null, [], "invalid"])("rejects malformed M2 fields %s at authoring and runtime boundaries", (fields) => {
      const command = { ...hpCommand("all"), fields } as unknown as M2;
      expect(() => validateCommandArray("commands", [command])).toThrow(/fields/);
      expect(() => validateLowLevelCommandArray("commands", [command])).toThrow(/fields/);
      expect(parseM2BattleCommand(command)).toBeUndefined();
      // Nested tool branches must not bypass the same shape contract.
      expect(() => validateLowLevelCommandArray("commands", [{ kind: "loop", body: [command] }])).toThrow(/fields/);
    });

    it("uses catalog validation instead of a shadowing shallow M2 case", () => {
      expect(() => validateCommandArray("commands", [{ ...hpCommand("all"), commandId: "missing-command" }]))
        .toThrow(/commandId/);
      const command = { ...hpCommand("all"), fields: { target: { nested: true } } } as unknown as M2;
      expect(() => validateCommandArray("commands", [command])).toThrow(/fields.target/);
    });

    it("reports dangling hidden members through admission before constructing battlers", () => {
      const project = deserialize(JSON.stringify(fixture));
      const troop = project.database.troops.find((record) => record.id === "troop_slime")!;
      troop.members = [{ enemyId: "deleted_enemy", x: 100, y: 100, hidden: true }];
      // Members take precedence over a still-valid legacy projection.
      expect(battleTroopError(project, troop.id)).toMatchObject({ code: "BATTLE_ENEMY_MISSING" });
      expect(() => createBattleRuntime({ project, troopId: troop.id, canEscape: true, canLose: true }))
        .toThrow(/deleted_enemy/);
      delete troop.members;
      expect(battleTroopError(project, troop.id)).toBeUndefined();
      troop.enemyIds = ["deleted_enemy"];
      expect(battleTroopError(project, troop.id)?.code).toBe("BATTLE_ENEMY_MISSING");
    });

    it.each(["rich", "legacy", "party"])("addresses actual actors for %s m2-092 targets", (mode) => {
      const project = deserialize(JSON.stringify(fixture));
      project.database.battleCommands = [
        ...(project.database.battleCommands ?? []),
        { id: "defend", name: "방어", kind: "defend" },
      ];
      const session = startSession(project);
      const actorId = session.partyActorIds[0];
      const commandId = "m2-092-change-battle-commands";
      const entry = m2CommandById(commandId)!;
      const fields: M2CommandFields = mode === "rich" ? { target: "actor", actorId }
        : { target: mode === "party" ? "party" : actorId };
      executeM2RuntimeCommand(session, entry, {
        commandId, fields: { ...fields, operation: "set", value: "defend" },
      }, { project });
      expect(session.actorBattleCommands?.[actorId]).toEqual(["defend"]);
      expect(session.actorBattleCommands?.actor).toBeUndefined();
    });

    it.each(["set", "start", "stop"] as const)("commits timer %s to the live timer owner and preserves untouched countdowns", (action) => {
      const { project, runtime } = eventBattle([
        { kind: "timer", action: "set", timerId: "timer1", seconds: 8 },
        { kind: "timer", action, timerId: "timer1", ...(action === "set" ? { seconds: 6 } : {}) },
      ]);
      const state = runtime.snapshot().eventState;
      const session = startSession(project);
      const runtimeTimers = new Map([
        ["timer1", { remaining: 100, active: true }],
        ["timer2", { remaining: 3.5, active: true }],
      ]);
      const scene = { session, runtimeTimers } as PlaySceneContext;
      applyBattleTimerWrites(scene, state);
      expect(runtimeTimers.get("timer1")).toEqual({ remaining: action === "set" ? 6 : 8, active: action === "start" });
      expect(runtimeTimers.get("timer2")).toEqual({ remaining: 3.5, active: true });
      updateRuntimeTimers(scene, 1_000);
      expect(session.timers.timer1).toBe(action === "start" ? 7 : action === "set" ? 6 : 8);
      expect(runtimeTimers.get("timer2")?.remaining).toBe(2.5);
      runtime.cancel();
    });
  });
});

describe("eventAudioCommandContracts", () => {
  isolateTimers();
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
      // main records the resolved authored values (0..100 volume, explicit fade) on the track.
      expect(session.audio.se).toEqual({ resourceId: "easyrpg-sound-decision1", loop: false, volume: 100, fadeInMs: 0 });
      expect(session.audio.bgm).toBeUndefined();
    });

    it("환경음은 BGS 로 루프 재생하고 BGM 슬롯을 빼앗지 않는다", () => {
      const project = createBlankProject();
      const session = mkSession(project);
      session.audio.bgm = { resourceId: "cc0-bgm-field", loop: true };
      const step = firstStep([m2Command("Sound Layer", { channel: "ambient", resourceId: "cc0-bgm-town", fadeMs: 400 })], session);
      expect(step).toMatchObject({ kind: "playAudio", resourceId: "cc0-bgm-town", channel: "ambient", loop: true, fadeInMs: 400 });
      expect(session.audio.bgm).toEqual({ resourceId: "cc0-bgm-field", loop: true });
      expect(session.audio.ambient).toEqual({ resourceId: "cc0-bgm-town", loop: true, volume: 100, fadeInMs: 400 });
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

    it("기억한 곡의 음량과 페이드를 재생 스텝에 남긴다", () => {
      const project = createBlankProject();
      const session = mkSession(project);
      session.audio.bgm = { resourceId: "cc0-bgm-field", loop: true, volume: 0, fadeInMs: 0 };
      drain([m2Command("Memorize Current BGM")], session);
      session.audio.bgm = { resourceId: "cc0-bgm-battle", loop: true, volume: 100, fadeInMs: 800 };

      const step = firstStep([m2Command("Play Memorized BGM")], session);
      expect(step).toEqual({ kind: "playAudio", resourceId: "cc0-bgm-field", channel: "bgm", loop: true, volume: 0, fadeInMs: 0 });
      expect(session.audio.bgm).toEqual({ resourceId: "cc0-bgm-field", loop: true, volume: 0, fadeInMs: 0 });
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
});

describe("eventMapItemsBeginnerUx", () => {
  isolateTimers();
  /**
   * 지도·화면 효과 탭 초보자 UX 계약 (2026-08-27 audit-before.md 기반)
   * evidence: .omo/evidence/event-map-items/
   */

  describe("지도 탭 초보자 용어 계약", () => {
    it("피커에서 애니메이션 표시 항목들이 서로 다른 라벨을 갖는다", () => {
      const mapVisible = M2_COMMAND_CATALOG.filter(
        (e) => e.title === "Show Animation" && isM2CatalogEntrySelectableInMap(e),
      );
      // 2026-08-27 픽스: m2-055는 맵 피커에서 숨겨지므로(중복 등재 제거) 맵 노출 행은 m2-054 하나
      expect(mapVisible.map((e) => e.index)).toEqual([54]);
    });

    it("배틀 전용 Show Animation(m2-103)은 맵 피커에서 숨겨진다", () => {
      const battleOnly = M2_COMMAND_CATALOG.find((e) => e.index === 103);
      expect(battleOnly).toBeDefined();
      expect(isM2CatalogEntrySelectableInMap(battleOnly!)).toBe(false);
    });

    it("카탈로그 라벨에 내부 API 토큰(panTo 등)이 노출되지 않는다", () => {
      for (const entry of M2_COMMAND_CATALOG) {
        expect(entry.pickerLabel).not.toMatch(/panTo|this-event|parallax/i);
        expect(entry.label).not.toMatch(/panTo|this-event|parallax/i);
      }
    });
  });
  describe("조명 설정 초보자 표기 계약", () => {
    const source = readFileSync(
      join(__dirname, "../src/editor/panels/eventEditor/commandBodyPage3Native.ts"),
      "utf8",
    );

    it("밝기 입력은 % 스케일로 안내한다 (0.85 원문 노출 금지)", () => {
      // setLighting 입력 안내에 "0~1" 스케일 설명이 남아 있으면 실패
      expect(source).not.toContain('암전 정도(0~1)"');
    });

    it("같은 값을 세 이름으로 부르지 않는다", () => {
      // 미리보기 캡션이 AMB/주변광 대신 밝기로 통일돼야 함
      expect(source).not.toContain("`주변광 ${pct}%`");
      expect(source).not.toContain("`AMB ${pct}%`");
    });
  });
  describe("changeTile 실맵 미리보기 계약", () => {
    const source = readFileSync(
      join(__dirname, "../src/editor/panels/eventEditor/commandBodyPage3Native.ts"),
      "utf8",
    );

    it("타일 변경 폼이 맵 캔버스 미리보기를 그린다", () => {
      expect(source).toContain("drawTransferMapPreview");
    });
  });
});
