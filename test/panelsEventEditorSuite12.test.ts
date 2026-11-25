import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flattenScript, renderEventPageFlow, renderEventPagePreview } from "@/editor/panels/eventEditor/eventScriptModernViews";
import { FORK_THEN_BRANCH_INDEX, isContainerInsideCommand, moveCommandBetweenLists, resolveCommandListAtPath } from "@/editor/eventCommandPaths";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import type { Command, EventPage } from "@/project/types";
import { findByTestId, installFakeDom, renderWithFakeDom, FakeElement } from "./fakeDom";
import { fieldSpawnBody } from "@/editor/panels/eventEditor/commandBodyFieldSpawn";
import { createCaptureProject } from "./fixtures/captureProject";
import { MINIMAL_COMMANDS } from "./fixtures/minimalCommands";
import { probeCommandControls } from "./eventEditorCommitProbe";
import { insertGeneratedPictureAsset } from "@/editor/generatedPictureAsset";
import { faceDisplayModeOf } from "@/editor/panels/eventEditor/facesetPreview";
import { renderCommandBody } from "@/editor/panels/eventEditor/commandBody";
import { commandSummary } from "@/editor/panels/eventEditor/commandSummary";
import type { CommandListActions, CommandEditContext } from "@/editor/panels/eventEditor/types";
import { runCommandContract } from "./commandContracts/harness";
import { m2CommandById } from "@/project/eventCommands/m2Catalog";
import { renderM2CommandBody } from "@/editor/panels/eventEditor/commandBodyM2";
import { startSession } from "@/project/session";
import { executeM2RuntimeCommand } from "@/player/interpreter/m2Runtime";
import { isolateTimers } from "./mergedTeardown";

// [P2] 라이브 미리보기/플로우 파생 뷰 + 크로스 컨테이너 이동.
describe("eventScriptModernViews", () => {
  isolateTimers();
  const PAGE_BASE: Omit<EventPage, "commands"> = {
    id: "pg_test",
    name: "테스트",
    conditions: [],
    graphic: {},
    trigger: { kind: "action" },
    priority: "same",
    movement: { type: "fixed", speed: 3, frequency: 3 },
  };
  function pageWith(commands: Command[]): EventPage {
    return { ...PAGE_BASE, commands };
  }
  describe("이벤트 스크립트 모던 뷰 (P2)", () => {
    let restoreDom: (() => void) | undefined;

    beforeEach(() => {
      restoreDom = installFakeDom();
      store.replace(createBlankProject());
    });

    afterEach(() => {
      restoreDom?.();
    });

    it("flattenScript 는 분기 라벨과 시뮬레이션 상태를 스크립트 순서로 기록한다", () => {
      const commands: Command[] = [
        { kind: "changeFace", resourceId: "easyrpg-faceset-actor1-03", position: "left", flipHorizontally: false },
        { kind: "text", body: "안녕" },
        {
          kind: "fork",
          condition: { kind: "switch", switchId: "", value: true },
          then: [{ kind: "text", body: "참" }],
          else: [{ kind: "text", body: "거짓" }],
        },
      ];
      const steps = flattenScript(commands);
      expect(steps.map((step) => step.command.kind)).toEqual(["changeFace", "text", "fork", "text", "text"]);
      expect(steps[0]?.simState).toBeDefined();
      expect(steps[1]?.simState).toBeDefined();
      expect(steps[2]?.simState).toBeDefined();
      expect(steps[3]?.branchLabel).toBe("조건이 맞을 때");
      expect(steps[4]?.branchLabel).toBe("조건이 맞지 않을 때");
      const forkStep = steps.find((s) => s.command.kind === "fork");
      expect(forkStep?.forkTaken).toBeDefined();
    });

    it("미리보기 패널은 details 접힘 없이 무대와 스텝 조작을 바로 내건다", () => {
      const page = pageWith([{ kind: "text", body: "한 줄" }]);
      const root = renderWithFakeDom(() =>
        renderEventPagePreview({ mapId: "map_start", eventId: "ev_test", page })
      );
      const panel = findByTestId(root, "event-page-preview");
      expect(panel).not.toBeNull();
      expect((panel as unknown as { tagName?: string }).tagName?.toLowerCase()).not.toBe("details");
      expect(findByTestId(root, "event-script-live-stage")).not.toBeNull();
      expect(findByTestId(root, "event-script-live-prev")).not.toBeNull();
      expect(findByTestId(root, "event-script-live-next")).not.toBeNull();
      expect(findByTestId(root, "event-script-live-play")).not.toBeNull();
    });

    it("명령이 없으면 미리보기는 빈 안내를 내건다", () => {
      const root = renderWithFakeDom(() =>
        renderEventPagePreview({ mapId: "map_start", eventId: "ev_test", page: pageWith([]) })
      );
      expect(findByTestId(root, "event-page-preview-empty")).not.toBeNull();
      expect(findByTestId(root, "event-script-live-stage")).toBeNull();
    });

    it("플로우는 팝오버 details 가 아니라 칼럼 전체를 쓰는 보기 방식으로 렌더된다", () => {
      const page = pageWith([{ kind: "text", body: "한 줄" }]);
      const root = renderWithFakeDom(() =>
        renderEventPageFlow({ mapId: "map_start", eventId: "ev_test", page })
      );
      // 예전 도구 팝오버 아코디언(`event-script-flowchart`)은 미리보기 위에 겹쳐 떴다 — 이제 없다.
      expect(findByTestId(root, "event-script-flowchart")).toBeNull();
      expect(findByTestId(root, "event-page-flow")).not.toBeNull();
      expect(findByTestId(root, "event-flow-node-text")).not.toBeNull();
    });

    it("플로우는 fork/choices 분기를 하위 컬럼으로 렌더한다", () => {
      const root = renderWithFakeDom(() =>
        renderEventPageFlow({
          mapId: "map_start",
          eventId: "ev_test",
          page: pageWith([
            {
              kind: "choices",
              options: [
                { text: "예", branch: [{ kind: "text", body: "긍정" }] },
                { text: "아니오", branch: [] },
              ],
            },
          ]),
        })
      );
      const flow = findByTestId(root, "event-flowchart-body");
      expect(flow).not.toBeNull();
      const labels = flow ? flow.querySelectorAll(".event-flow-branch-label").map((node) => node.textContent) : [];
      expect(labels).toContain("예");
      expect(labels).toContain("아니오");
      expect(flow?.querySelectorAll(".event-flow-empty").length).toBe(1);
    });
  });
  describe("크로스 컨테이너 명령 이동 (P2)", () => {
    it("isContainerInsideCommand 는 자기 분기 안 이동만 참이다", () => {
      expect(isContainerInsideCommand([2], [2, FORK_THEN_BRANCH_INDEX])).toBe(true);
      expect(isContainerInsideCommand([2], [1, FORK_THEN_BRANCH_INDEX])).toBe(false);
      expect(isContainerInsideCommand([2, FORK_THEN_BRANCH_INDEX, 0], [])).toBe(false);
      expect(isContainerInsideCommand([0], [0])).toBe(false);
    });

    it("moveCommandBetweenLists 는 루트 → fork then 분기 이동을 수행한다", () => {
      const commands: Command[] = [
        { kind: "text", body: "이동 대상" },
        {
          kind: "fork",
          condition: { kind: "switch", switchId: "", value: true },
          then: [{ kind: "text", body: "기존" }],
        },
      ];
      const targetList = resolveCommandListAtPath(commands, [1, FORK_THEN_BRANCH_INDEX], { missingBranches: "create" });
      expect(targetList).not.toBeNull();
      if (!targetList) return;
      expect(moveCommandBetweenLists(commands, 0, targetList, Number.MAX_SAFE_INTEGER)).toBe(true);
      expect(commands.length).toBe(1);
      expect(commands[0]?.kind).toBe("fork");
      const fork = commands[0];
      if (fork?.kind !== "fork") return;
      expect(fork.then.map((cmd) => (cmd.kind === "text" ? cmd.body : ""))).toEqual(["기존", "이동 대상"]);
    });

    it("같은 리스트 이동은 기존 재정렬 규칙(클램프)을 따른다", () => {
      const list: Command[] = [
        { kind: "text", body: "A" },
        { kind: "text", body: "B" },
        { kind: "text", body: "C" },
      ];
      expect(moveCommandBetweenLists(list, 0, list, 99)).toBe(true);
      expect(list.map((cmd) => (cmd.kind === "text" ? cmd.body : ""))).toEqual(["B", "C", "A"]);
    });
  });
});

describe("eventSpawnNumericProbe", () => {
  isolateTimers();
  let restore: () => void;
  beforeEach(() => { restore = installFakeDom(); store.replace(createCaptureProject()); });
  afterEach(() => restore());
  describe("spawn numeric controls through the gate DOM", () => {
    it.each(["x", "y", "w", "h"] as const)("rejects invalid %s edits and accumulates valid commits", key => {
      const initial = MINIMAL_COMMANDS.spawnFieldEnemy;
      if (initial.kind !== "spawnFieldEnemy") throw new Error("Wrong fixture");
      let current: Command = structuredClone(initial);
      const replaceCommand = vi.fn((_path: readonly number[], command: Command) => { current = command; });
      const unexpected = () => { throw new Error("Unexpected action"); };
      const root = fieldSpawnBody({ path: [0], getCurrentCommand: () => current, actions: {
        replaceCommand, addCommand: unexpected, insertCommand: unexpected, deleteCommand: unexpected,
        moveCommand: unexpected, moveCommandTo: unexpected,
      } }, initial);
      if (!(root instanceof FakeElement)) throw new Error("Expected gate DOM");
      const input = findByTestId(root, `event-command-spawn-area-${key}`);
      if (!input) throw new Error("Missing numeric control");
      const invalid = vi.fn();
      input.addEventListener("invalid", invalid);
      for (const raw of ["", "NaN", "Infinity", "1e309", "0x10", "2.5"]) {
        input.value = raw;
        input.dispatchEvent(new Event("change"));
        expect(current).toEqual(initial);
        expect(replaceCommand).not.toHaveBeenCalled();
      }
      expect(invalid).toHaveBeenCalledTimes(6);
      for (const value of [3, 4]) {
        input.value = String(value);
        input.dispatchEvent(new Event("change"));
        expect(current).toEqual({ ...initial, spawn: { ...initial.spawn, area: { ...initial.spawn.area, [key]: value } } });
      }
      expect(replaceCommand).toHaveBeenCalledTimes(2);
    });

    it("existing native numeric consumers retain their number instead of the missing-API fallback", () => {
      const initial = MINIMAL_COMMANDS.changeFactionStance;
      if (initial.kind !== "changeFactionStance") throw new Error("Wrong fixture");
      const run = probeCommandControls(initial);
      expect(run.results).toHaveLength(4);
      for (const result of run.results) {
        expect(result.outcome).toBe("commit");
        expect(result.committed).toMatchObject({ value: result.key === "event-command-faction-value" ? Number(result.applied) : initial.value });
      }
    });

    it("the actual commit probe commits all seven fields without exceptions or no-commit exemptions", () => {
      const run = probeCommandControls(MINIMAL_COMMANDS.spawnFieldEnemy);
      expect(run.error).toBeUndefined();
      expect(run.results).toHaveLength(7);
      expect(run.results.map(result => result.outcome)).toEqual(Array(7).fill("commit"));
      for (const result of run.results) {
        expect(result.errorMessage).toBeUndefined();
        expect(result.callCount).toBe(1);
      }
    });
  });
});

describe("generatedPictureAsset", () => {
  isolateTimers();
  const PNG =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFHAP/q842iQAAAABJRU5ErkJggg==";
  describe("insertGeneratedPictureAsset", () => {
    it("dataUrl 그림을 uploaded picture 로 넣고 id 를 돌려준다", () => {
      const project = createBlankProject();
      const before = Object.keys(project.assets.uploaded).length;
      const id = insertGeneratedPictureAsset(project, { name: "달빛 창가", dataUrl: PNG });
      expect(id.length).toBeGreaterThan(0);
      expect(project.assets.uploaded[id]?.kind).toBe("picture");
      expect(project.assets.uploaded[id]?.dataUrl).toBe(PNG);
      expect(project.assets.uploaded[id]?.name).toBe("달빛 창가");
      expect(project.resourceProfiles.some((profile) => profile.assetId === id && profile.kind === "picture")).toBe(true);
      expect(Object.keys(project.assets.uploaded).length).toBe(before + 1);
    });

    it("kind 를 주면 그 kind 로 저장한다", () => {
      const project = createBlankProject();
      const faceId = insertGeneratedPictureAsset(project, { name: "검사", dataUrl: PNG, kind: "faceset" });
      expect(project.assets.uploaded[faceId]?.kind).toBe("faceset");
      expect(project.resourceProfiles.some((profile) => profile.assetId === faceId && profile.kind === "faceset")).toBe(true);
      const titleId = insertGeneratedPictureAsset(project, { name: "타이틀", dataUrl: PNG, kind: "title" });
      expect(project.assets.uploaded[titleId]?.kind).toBe("title");
      const backdropId = insertGeneratedPictureAsset(project, { name: "화산 동굴", dataUrl: PNG, kind: "backdrop" });
      expect(project.assets.uploaded[backdropId]?.kind).toBe("backdrop");
      expect(backdropId).toContain("backdrop_img");
    });

    it("faceset 생성 id 는 통짜 초상 판정을 받는다", () => {
      const project = createBlankProject();
      const id = insertGeneratedPictureAsset(project, { name: "검사", dataUrl: PNG, kind: "faceset" });
      expect(faceDisplayModeOf(id)).not.toBe("chip");
    });

    it("그림 dataUrl 이 아니면 프로젝트에 쓰지 않는다", () => {
      const project = createBlankProject();
      const before = Object.keys(project.assets.uploaded).length;
      expect(() => insertGeneratedPictureAsset(project, { name: "x", dataUrl: "not-an-image" })).toThrow();
      expect(Object.keys(project.assets.uploaded).length).toBe(before);
    });
  });
});

describe("learnSkillCommandBody", () => {
  isolateTimers();
  describe("learnSkill modern form + forget/party", () => {
    let restoreDom: (() => void) | undefined;
    let staged: Command;

    const actions: CommandListActions = {
      addCommand: () => undefined,
      insertCommand: () => undefined,
      deleteCommand: () => undefined,
      moveCommand: () => undefined,
      moveCommandTo: () => undefined,
      replaceCommand: (_path, command) => {
        staged = command;
      },
    };

    beforeEach(() => {
      restoreDom = installFakeDom();
      const project = createBlankProject();
      if (project.database.skills[0]) project.database.skills[0].name = "파이어";
      store.replace(project);
      staged = { kind: "learnSkill", actorId: "", skillId: project.database.skills[0]?.id ?? "", action: "learn" };
    });

    afterEach(() => {
      restoreDom?.();
    });

    it("폼에 액션/대상/특수기 픽커를 노출한다", () => {
      const body = renderWithFakeDom(() =>
        renderCommandBody({ path: [0], actions, lockKind: true }, staged)
      );
      expect(findByTestId(body, "event-command-learn-skill-form")).toBeTruthy();
      expect(findByTestId(body, "learn-skill-action-select")).toBeTruthy();
      expect(findByTestId(body, "learn-skill-target-mode")).toBeTruthy();
      expect(findByTestId(body, "learn-skill-skill-select")).toBeTruthy();
      expect(findByTestId(body, "learn-skill-preview")).toBeTruthy();
    });

    it("망각 액션을 저장한다", () => {
      const body = renderWithFakeDom(() =>
        renderCommandBody({ path: [0], actions, lockKind: true }, staged)
      );
      const action = findByTestId(body, "learn-skill-action-select") as unknown as HTMLSelectElement;
      action.value = "forget";
      action.dispatchEvent(new Event("change"));
      expect(staged.kind).toBe("learnSkill");
      if (staged.kind !== "learnSkill") return;
      expect(staged.action).toBe("forget");
    });

    it("주인공 대상 모드에서 actorId 를 저장한다", () => {
      const actorId = store.getCurrent().database.actors[0]?.id ?? "actor_hero";
      const body = renderWithFakeDom(() =>
        renderCommandBody({ path: [0], actions, lockKind: true }, staged)
      );
      const target = findByTestId(body, "learn-skill-target-mode") as unknown as HTMLSelectElement;
      target.value = "actor";
      target.dispatchEvent(new Event("change"));
      const actorSelect = findByTestId(body, "learn-skill-actor-select") as unknown as HTMLSelectElement;
      actorSelect.value = actorId;
      actorSelect.dispatchEvent(new Event("change"));
      expect(staged.kind).toBe("learnSkill");
      if (staged.kind !== "learnSkill") return;
      expect(staged.actorId).toBe(actorId);
    });

    it("요약에 파티/망각을 표시한다", () => {
      const skillId = store.getCurrent().database.skills[0]?.id ?? "skill_1";
      expect(commandSummary({
        kind: "learnSkill",
        actorId: "",
        skillId,
        action: "forget",
      })).toContain("파티 전체");
      expect(commandSummary({
        kind: "learnSkill",
        actorId: "",
        skillId,
        action: "forget",
      })).toContain("잊기");
      expect(commandSummary({
        kind: "learnSkill",
        actorId: "",
        skillId,
        action: "forget",
      })).toContain("파이어");
    });

    it("런타임: 파티 전체에 스킬을 습득시킨다", () => {
      const skillId = "skill_fire";
      const result = runCommandContract([
        { kind: "learnSkill", actorId: "", skillId, action: "learn" },
      ], {
        mutateSession: (session) => {
          session.partyActorIds = ["actor_a", "actor_b"];
          session.actorSkillIds = { actor_a: [], actor_b: ["skill_old"] };
        },
      });
      expect(result.session.actorSkillIds?.actor_a).toEqual([skillId]);
      expect(result.session.actorSkillIds?.actor_b).toEqual(["skill_old", skillId]);
    });

    it("런타임: 망각은 목록에서 제거한다", () => {
      const result = runCommandContract([
        { kind: "learnSkill", actorId: "actor_hero", skillId: "skill_fire", action: "forget" },
      ], {
        mutateSession: (session) => {
          session.actorSkillIds = { actor_hero: ["skill_fire", "skill_ice"] };
        },
      });
      expect(result.session.actorSkillIds?.actor_hero).toEqual(["skill_ice"]);
    });

    it("런타임: 레거시 action 없는 형태는 습득으로 유지한다", () => {
      const result = runCommandContract([
        { kind: "learnSkill", actorId: "actor_hero", skillId: "skill_fire" },
      ], {
        mutateSession: (session) => {
          session.actorSkillIds = { actor_hero: [] };
        },
      });
      expect(result.session.actorSkillIds?.actor_hero).toEqual(["skill_fire"]);
    });
  });
});

/** Page-3 (map and presentation) command body behavior contracts. */
describe("page3CommandBodies", () => {
  isolateTimers();
  function stagedContext(initial: Command): {
    readonly context: CommandEditContext;
    readonly current: () => Command;
  } {
    let staged = structuredClone(initial);
    return {
      context: {
        path: [1],
        actions: {
          addCommand: vi.fn(),
          insertCommand: vi.fn(),
          replaceCommand: (_path, command) => { staged = structuredClone(command); },
          deleteCommand: vi.fn(),
          moveCommand: vi.fn(),
          moveCommandTo: vi.fn(),
        },
        getCurrentCommand: () => staged,
      },
      current: () => staged,
    };
  }
  function m2(
    commandId: string,
    fields: Record<string, string | number | boolean> = {}
  ): Extract<Command, { kind: "m2Command" }> {
    return { kind: "m2Command", commandId, fields };
  }
  function change(node: FakeElement | null, value: string): void {
    expect(node).not.toBeNull();
    if (!node) return;
    node.value = value;
    node.dispatchEvent(new Event("change"));
  }
  function execute(command: Extract<Command, { kind: "m2Command" }>) {
    const project = store.getCurrent();
    const session = startSession(project);
    const entry = m2CommandById(command.commandId);
    expect(entry).toBeTruthy();
    if (entry) executeM2RuntimeCommand(session, entry, command, { project });
    return session;
  }
  describe("page3 command body UX (맵·연출)", () => {
    let restoreDom: (() => void) | undefined;
    let pictureResourceId = "";

    beforeEach(() => {
      restoreDom = installFakeDom();
      const project = createBlankProject();
      pictureResourceId =
        project.resources?.find?.((r) => (r as { kind?: string }).kind === "picture")?.id ??
        project.database.actors[0]?.faceResourceId ??
        "picture_sample";
      store.replace(project);
    });

    afterEach(() => {
      restoreDom?.();
    });


    describe("M2 page3 form-to-runtime contracts", () => {
      it("commits tint fields and applies them to runtime screen state", () => {
        const initial = m2("m2-046-tint-screen", { color: "neutral", value: "", duration: 0 });
        const staged = stagedContext(initial);
        const body = renderWithFakeDom(() => renderM2CommandBody(staged.context, initial)!);
        findByTestId(body, "tint-screen-color-blue")?.click();
        change(findByTestId(body, "tint-screen-duration-input"), "240");

        const command = staged.current() as Extract<Command, { kind: "m2Command" }>;
        // 편집기는 이제 durationMs 로 쓰고 옛 duration 키는 지운다(tintScreenBody commit).
        expect(command.fields).toMatchObject({ color: "blue", value: "", durationMs: 240 });
        expect(command.fields).not.toHaveProperty("duration");
        const session = execute(command);
        expect(session.m2Runtime?.screen).toMatchObject({ tint: "blue", tintDurationMs: 240 });
      });

      it("commits flash fields and applies the flash color to runtime", () => {
        const initial = m2("m2-047-flash-screen", { color: "white", value: "white", durationMs: 180 });
        const staged = stagedContext(initial);
        const body = renderWithFakeDom(() => renderM2CommandBody(staged.context, initial)!);
        change(findByTestId(body, "flash-screen-color"), "red");
        change(findByTestId(body, "flash-screen-duration-input"), "320");

        const command = staged.current() as Extract<Command, { kind: "m2Command" }>;
        expect(command.fields).toMatchObject({ color: "red", value: "red", durationMs: 320 });
        expect(execute(command).m2Runtime?.screen.flash).toBe("red");
      });

      it("commits shake fields and applies the intensity to runtime", () => {
        const initial = m2("m2-048-shake-screen", { intensity: "3", value: 3, durationMs: 300 });
        const staged = stagedContext(initial);
        const body = renderWithFakeDom(() => renderM2CommandBody(staged.context, initial)!);
        change(findByTestId(body, "shake-screen-intensity"), "6");
        change(findByTestId(body, "shake-screen-duration-input"), "450");

        const command = staged.current() as Extract<Command, { kind: "m2Command" }>;
        expect(command.fields).toMatchObject({ intensity: "6", value: 6, durationMs: 450 });
        expect(execute(command).m2Runtime?.screen.shake).toBe(6);
      });

      it("commits scroll fields and applies the canonical map runtime record", () => {
        const initial = m2("m2-049-scroll-map", { direction: "down", distance: 1, speed: 4, wait: "true", mode: "return" });
        const staged = stagedContext(initial);
        const body = renderWithFakeDom(() => renderM2CommandBody(staged.context, initial)!);
        change(findByTestId(body, "scroll-map-direction"), "right");
        change(findByTestId(body, "scroll-map-distance-input"), "5");

        const command = staged.current() as Extract<Command, { kind: "m2Command" }>;
        expect(command.fields).toMatchObject({ direction: "right", distance: 5, speed: 4, wait: "true", mode: "return" });
        expect(execute(command).m2Runtime?.map.scroll_map).toMatchObject({ value: "", x: 0, y: 0 });
      });

      it("commits weather fields and applies parsed weather to runtime", () => {
        const initial = m2("m2-050-set-weather-effects", { value: "none", transitionMs: 0, durationMs: 0 });
        const staged = stagedContext(initial);
        const body = renderWithFakeDom(() => renderM2CommandBody(staged.context, initial)!);
        findByTestId(body, "set-weather-effects-kind-snow")?.click();
        change(findByTestId(body, "set-weather-effects-intensity-input"), "0.75");
        change(findByTestId(body, "set-weather-effects-transition-input"), "400");

        const command = staged.current() as Extract<Command, { kind: "m2Command" }>;
        expect(command.fields).toMatchObject({ value: "snow,0.75", transitionMs: 400, durationMs: 400 });
        expect(execute(command).m2Runtime?.screen.weather).toBe("snow,0.75");
      });

      it("commits picture movement and updates the runtime picture slot", () => {
        const initial = m2("m2-052-move-picture", { pictureId: "pic1", resourceId: pictureResourceId, x: 8, y: 9, durationMs: 0 });
        const staged = stagedContext(initial);
        const body = renderWithFakeDom(() => renderM2CommandBody(staged.context, initial)!);
        change(findByTestId(body, "move-picture-m2-x-input"), "24");
        change(findByTestId(body, "move-picture-m2-y-input"), "30");
        change(findByTestId(body, "move-picture-m2-duration-input"), "500");

        const command = staged.current() as Extract<Command, { kind: "m2Command" }>;
        expect(command.fields).toMatchObject({ pictureId: "pic1", x: 24, y: 30, durationMs: 500, duration: 500 });
        const session = startSession(store.getCurrent());
        session.pictures = { pic1: { pictureId: "pic1", resourceId: pictureResourceId, x: 8, y: 9 } };
        executeM2RuntimeCommand(session, m2CommandById(command.commandId)!, command, { project: store.getCurrent() });
        expect(session.pictures.pic1).toMatchObject({ pictureId: "pic1", resourceId: pictureResourceId, x: 24, y: 30, durationMs: 500 });
      });

      it("commits encounter rate and applies the runtime map value", () => {
        const initial = m2("m2-070-set-encounter-rate", { value: 24, valueSource: "number", valueVariableId: "" });
        const staged = stagedContext(initial);
        const body = renderWithFakeDom(() => renderM2CommandBody(staged.context, initial)!);
        change(findByTestId(body, "set-encounter-rate-value-input"), "12");

        const command = staged.current() as Extract<Command, { kind: "m2Command" }>;
        expect(command.fields).toMatchObject({ target: "map", operation: "set", value: 12, valueSource: "number" });
        expect(execute(command).m2Runtime?.map.encounter_rate?.value).toBe("12");
      });
    });

  });
});
