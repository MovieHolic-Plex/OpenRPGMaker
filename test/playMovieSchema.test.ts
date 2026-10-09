import { describe, expect, it } from "vitest";
// 스키마 등록 side-effect.
import "@/editor/eventCommands/schema/catalog";
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
