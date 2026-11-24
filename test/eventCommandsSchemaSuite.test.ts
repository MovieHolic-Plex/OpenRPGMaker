import { describe, expect, it, afterEach, beforeEach, vi } from "vitest";
import { commandSchemaFor } from "@/editor/eventCommands/schema/defineCommand";
import { COMMAND_GUARANTEES } from "@/project/commandGuaranteeRegistry";
import { COMMAND_KINDS } from "@/project/commandKindRegistry";
import { commandRuntimeSupport } from "@/project/eventCommands/runtimeSupport";
import { EVENT_COMMAND_PICKER_NATIVE_ONLY_PLACEMENTS } from "@/editor/panels/eventEditor/commandPicker";
import { commandSummary } from "@/editor/panels/eventEditor/commandSummary";
import { commandKindLabel } from "@/editor/panels/eventEditor/options";
import { validateEventDraftBody } from "@/editor/eventDraftValidator";
import { createBlankProject } from "@/project/defaults";
import type { Command, EventPage, GameEvent, Project } from "@/project/types";
import { renderSchemaCommandBody, schemaSummary } from "@/editor/panels/eventEditor/schemaCommandBody";
import { eventCommandBranches } from "@/editor/eventCommandBranches";
import { resolveCommandListAtPath } from "@/editor/eventCommandPaths";
import { newCommand } from "@/editor/eventActions";
import { store } from "@/project/store";
import type { CommandEditContext } from "@/editor/panels/eventEditor/types";
import { findByTestId, installFakeDom } from "./fakeDom";
import "@/editor/eventCommands/schema/catalog";
import "@/editor/eventCommands/schema/catalogExtended";
import { isolateTimers } from "./mergedTeardown";

describe("playMovieSchema", () => {
  isolateTimers();
  // 타입 계약: playMovie 리터럴이 Command 유니온에 그대로 들어간다(컴파일 시점 검증).
  const VALID_MOVIE = {
    kind: "playMovie",
    resourceId: "video_intro",
    wait: true,
    skippable: true,
  } as const satisfies Command;
  const IDENTITY_LOOKUP = {
    switchName: (id: string) => id,
    variableName: (id: string) => id,
    recordName: (id: string) => id,
  };
  function pageWith(commands: readonly Command[]): EventPage {
    return {
      id: "page-1",
      name: "동영상 페이지",
      conditions: [],
      graphic: {},
      trigger: { kind: "action" },
      priority: "below",
      movement: { type: "fixed", speed: 3, frequency: 3 },
      commands: [...commands],
    };
  }
  function eventWith(page: EventPage): GameEvent {
    return {
      id: "event-movie",
      x: 2,
      y: 2,
      trigger: page.trigger,
      commands: [],
      pages: [page],
    };
  }
  function validate(project: Project, commands: readonly Command[]) {
    const mapId = project.startMapId;
    const event = eventWith(pageWith(commands));
    project.maps[mapId].events = [event];
    return validateEventDraftBody(project, mapId, event);
  }
  describe("playMovie 명령 계약", () => {
    it("kind 레지스트리와 보증 레지스트리에 등재된다", () => {
      expect(COMMAND_KINDS).toContain("playMovie");
      expect(COMMAND_GUARANTEES.playMovie.family).toBe("media");
    });

    it("스키마 카탈로그가 동영상 라벨과 리소스·대기·건너뛰기 필드를 노출한다", () => {
      const schema = commandSchemaFor("playMovie");
      expect(schema, "playMovie 스키마가 등록되지 않았다").toBeDefined();
      expect(schema?.label).toBe("동영상");
      expect(schema?.family).toBe("media");
      expect(Object.keys(schema?.fields ?? {})).toEqual(["resourceId", "wait", "skippable"]);
      expect(schema?.fields.resourceId?.optional).not.toBe(true);
      expect(schema?.fields.wait?.optional).toBe(true);
      expect(schema?.fields.skippable?.optional).toBe(true);
    });

    it("요약문은 '<리소스> 재생' 형태다", () => {
      const schema = commandSchemaFor("playMovie");
      expect(schema?.summary({ kind: "playMovie", resourceId: "video_intro" }, IDENTITY_LOOKUP)).toBe(
        "video_intro 재생"
      );
    });

    it("명령 목록 요약이 동영상 재생임을 밝히고 대기/건너뛰기를 드러낸다", () => {
      const summary = commandSummary({ ...VALID_MOVIE });
      expect(summary).toContain("동영상 재생");
      expect(summary).toContain("대기");
      expect(summary).toContain("건너뛰기 허용");
    });

    it("편집기 라벨 목록이 동영상 재생을 제공한다", () => {
      expect(commandKindLabel("playMovie")).toBe("동영상 재생");
    });

    it("피커는 연출 페이지(3)의 미디어 그룹 자리를 예약한다", () => {
      expect(EVENT_COMMAND_PICKER_NATIVE_ONLY_PLACEMENTS).toContainEqual({
        kind: "playMovie",
        group: "화면 연출",
        page: 3,
      });
    });

    it("맵·공통은 런타임이 착지해 전체 지원이고, 전투 실행기가 없는 troop 은 부분 지원이다", () => {
      expect(commandRuntimeSupport({ ...VALID_MOVIE }, "map")).toBe("runtime-full");
      expect(commandRuntimeSupport({ ...VALID_MOVIE }, "common")).toBe("runtime-full");
      // src/battle/battleEvents.ts 가 이 kind 를 logUnsupported 로 기록하고 false 를 돌린다.
      // troop 을 full 로 적으면 전투 페이지 저작 표면이 "전투에서도 그대로 돈다"고 거짓 표시한다.
      expect(commandRuntimeSupport({ ...VALID_MOVIE }, "troop")).toBe("runtime-partial");
    });

    it("검증기가 알 수 없는 동영상 리소스를 오류로 잡는다", () => {
      const result = validate(createBlankProject(), [
        { kind: "playMovie", resourceId: "video_does_not_exist" },
      ]);

      expect(result.issues).toContainEqual(
        expect.objectContaining({
          severity: "error",
          code: "reference.resource.missing",
          commandPath: [0],
        })
      );
      expect(result.canCommit).toBe(false);
    });

    it("검증기가 비어 있는 동영상 리소스도 오류로 잡는다", () => {
      const result = validate(createBlankProject(), [{ kind: "playMovie", resourceId: "" }]);

      expect(result.issues).toContainEqual(
        expect.objectContaining({
          severity: "error",
          code: "reference.resource.missing",
          commandPath: [0],
        })
      );
    });

    it("존재하는 리소스를 가리키면 참조 오류를 내지 않는다", () => {
      const project = createBlankProject();
      const knownResourceId = Object.values(project.tilesets)[0]?.image.id;
      expect(knownResourceId, "blank project에 타일셋 리소스가 있어야 함").toBeTruthy();

      const result = validate(project, [{ kind: "playMovie", resourceId: knownResourceId ?? "" }]);

      expect(
        result.issues.filter((issue) => issue.code === "reference.resource.missing")
      ).toEqual([]);
    });
  });
});

// presentItem(아이템 제시) 의 에디터 표면: 명령 목록 이름·스키마 폼·분기 표시.
// 새 편집기를 만들지 않고 스키마 폼에 정답 아이템 목록 위젯 하나만 더했다.
describe("presentItemEditorSchema", () => {
  isolateTimers();
  function ctx(replaceCommand = vi.fn()): CommandEditContext {
    return {
      path: [0],
      actions: {
        addCommand: vi.fn(), insertCommand: vi.fn(), replaceCommand,
        deleteCommand: vi.fn(), moveCommand: vi.fn(), moveCommandTo: vi.fn(),
      },
    };
  }
  const evidence: Extract<Command, { kind: "presentItem" }> = {
    kind: "presentItem",
    prompt: "증거를 보여라",
    options: [
      { itemId: "knife", branch: [{ kind: "text", body: "그 칼은!" }] },
      { itemId: "letter", branch: [] },
    ],
    otherwiseBranch: [{ kind: "text", body: "상관없어요" }],
    cancelBranch: [],
  };
  describe("presentItem 에디터", () => {
    let restoreDom: (() => void) | undefined;
    beforeEach(() => {
      restoreDom = installFakeDom();
      store.replace(createBlankProject());
    });
    afterEach(() => {
      restoreDom?.();
      restoreDom = undefined;
    });

    it("명령 목록 이름과 새 명령 기본값", () => {
      expect(commandKindLabel("presentItem")).toBe("아이템 제시");
      expect(newCommand("presentItem")).toMatchObject({ kind: "presentItem", options: [] });
    });

    it("요약문은 prompt 와 정답 수를 보인다", () => {
      expect(schemaSummary(evidence)).toBe("“증거를 보여라” · 정답 2개");
    });

    it("분기: 정답마다 하나 + 틀림 + 닫음, 경로로 되찾을 수 있다", () => {
      const branches = eventCommandBranches(evidence);
      expect(branches.map((branch) => branch.kind)).toEqual(["presentOption", "presentOption", "presentOtherwise", "presentCancel"]);
      // 배열이 없는 분기는 드롭 목표로 뜨지 않는다(eventCommandBranches 의 include 규칙).
      expect(eventCommandBranches({ ...evidence, cancelBranch: undefined }).map((branch) => branch.kind)).not.toContain("presentCancel");
      const commands: Command[] = [structuredClone(evidence)];
      for (const branch of branches) {
        expect(resolveCommandListAtPath(commands, [0, branch.branchIndex, 0], { missingBranches: "create" })).toEqual(branch.commands);
      }
    });

    it("스키마 폼: 정답 추가는 첫 아이템으로 빈 분기를 붙이고, 삭제는 나머지 분기를 지킨다", () => {
      const schema = commandSchemaFor("presentItem");
      expect(schema).toBeDefined();
      const firstItemId = store.getCurrent().database.items[0]!.id;

      const add = vi.fn();
      const body = renderSchemaCommandBody(ctx(add), evidence);
      expect(body).toBeDefined();
      findByTestId(body as never, "present-item-options-add")!.click();
      const [, added] = add.mock.calls[0] as [number[], Extract<Command, { kind: "presentItem" }>];
      expect(added.options).toEqual([...evidence.options, { itemId: firstItemId, branch: [] }]);
      expect(added.otherwiseBranch).toEqual(evidence.otherwiseBranch);

      const remove = vi.fn();
      const again = renderSchemaCommandBody(ctx(remove), evidence);
      findByTestId(again as never, "present-item-options-remove-1")!.click();
      const [, removed] = remove.mock.calls[0] as [number[], Extract<Command, { kind: "presentItem" }>];
      expect(removed.options).toEqual([evidence.options[0]]);
    });
  });
});
