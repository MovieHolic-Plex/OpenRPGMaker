// 적대적 인자 스윕: 모든 쓰기 툴에 모델이 실제로 보내는 종류의 잘못된 인자를 먹인다.
//
// 계약은 "성공"이 아니라 **읽을 수 있는 실패**다. 툴은 거부해도 되지만,
// - 내부 TypeError 를 그대로 흘려서 "후처리 실패: Cannot read properties of undefined" 처럼
//   모델이 고칠 수 없는 메시지를 남기면 안 되고(2026-08-23 실측: upsert_event 3회 재전송),
// - 던진 예외로 런타임을 깨서도 안 된다.
//
// 이 스윕이 없던 동안 page.trigger 누락 하나가 projectLint 크래시로 이어져 커밋 경로가 죽었다.
import { scheduler } from "node:timers/promises";
import { describe, expect, it } from "vitest";
import { runTool } from "@/editor/tools/toolRunner";
import { allTools } from "@/editor/tools/toolRegistry";
import { createBlankProject } from "@/project/defaults";
import { serialize } from "@/project/io";
import type { JsonSchema, ToolResult } from "@/editor/tools/types";
import { completedHouseProject, houseMap, HOUSE_RECT, mutateProject } from "./fixtures/completedHouse";

type Variant = "empty" | "nulls" | "wrongTypes" | "deepHoles";

// 변형마다 빈 프로젝트를 한 번 만들어 모든 쓰기 도구가 같은 입력을 받는다. 전에는 도구마다 새로 만들었고, 그 createBlankProject 가 변형 하나의 시간 거의 전부였다
// (쓰기 도구 360개: 러너에서 변형당 211~225초 가운데 도구 실행은 약 10초, 나머지는 빈 프로젝트 360번 — ci-vitest-files 43720360814 · 한 장비 실측 448초 중 437.6초).
// 도구는 입력 프로젝트를 제자리에서 고치지 않고 사본(draft)에 쓴다 — 그 약속이 깨지면 뒤 도구가 더럽혀진 입력을 받으므로, 변형 끝에 입력이 그대로인지 직렬화로 확인한다.
const HOSTILE_ARGS_TIMEOUT_MS = 120_000;

/** 스키마에서 "그럴듯하지만 틀린" 인자를 만든다 — 필수 누락·null 원소·타입 뒤집기·중첩 구멍. */
function hostileArgs(schema: JsonSchema, variant: Variant): Record<string, unknown> {
  if (variant === "empty") return {};
  const args: Record<string, unknown> = {};
  for (const [key, prop] of Object.entries(schema.properties ?? {})) {
    if (variant === "nulls") {
      args[key] = prop.type === "array" ? [null] : null;
      continue;
    }
    if (variant === "deepHoles") {
      // 배열 원소를 `{}` 로, 중첩 객체를 `{}` 로 채운다 — 실측에서 실제로 도착했던 shape.
      // 필수 필드가 통째로 빈 페이지/에셋/조건이 여기서 재현된다.
      if (prop.type === "array") args[key] = [{}];
      else if (prop.type === "object") args[key] = {};
      else if (prop.type === "string") args[key] = "x";
      else if (prop.type === "integer" || prop.type === "number") args[key] = 0;
      else if (prop.type === "boolean") args[key] = true;
      continue;
    }
    // wrongTypes: 문자열 자리에 숫자, 숫자 자리에 문자열, 객체 자리에 빈 객체, 배열 자리에 단수 객체.
    if (prop.type === "string") args[key] = 123;
    else if (prop.type === "integer" || prop.type === "number") args[key] = "not-a-number";
    else if (prop.type === "boolean") args[key] = "yes";
    else if (prop.type === "array") args[key] = {};
    else if (prop.type === "object") args[key] = {};
  }
  return args;
}

function isUnreadableFailure(result: ToolResult): boolean {
  const text = [result.summary, ...(result.issues ?? []).map((issue) => issue.message)].join(" ");
  return /Cannot read propert|undefined is not|is not a function|후처리 실패/.test(text);
}

describe("쓰기 툴 적대적 인자 스윕", () => {
  const writeTools = allTools().filter((tool) => tool.mode === "write");

  it("쓰기 툴이 충분히 등록되어 있다", () => {
    expect(writeTools.length).toBeGreaterThan(50);
  });

  for (const variant of ["empty", "nulls", "wrongTypes", "deepHoles"] as const) {
    it(`${variant} 인자에 어떤 툴도 크래시하거나 읽을 수 없는 실패를 남기지 않는다`, async () => {
      const offenders: string[] = [];
      const blank = createBlankProject();
      const pristine = serialize(blank);
      for (const tool of writeTools) {
        // Let worker RPC responses drain between synchronous tool calls; no timed wait.
        await scheduler.yield();
        const ctx = { project: blank };
        let result: ToolResult;
        try {
          result = runTool(ctx, tool.name, hostileArgs(tool.parameters, variant));
        } catch (error) {
          offenders.push(`${tool.name}: THREW ${error instanceof Error ? error.message.slice(0, 120) : String(error)}`);
          continue;
        }
        // 관대하게 받아들이는 것(ok)도 정책상 허용된다 — 문제는 "읽을 수 없는 실패"뿐이다.
        if (!result.ok && isUnreadableFailure(result)) {
          offenders.push(`${tool.name}: ${result.summary.slice(0, 140)}`);
        }
      }
      expect(offenders).toEqual([]);
      // 어떤 도구도(성공했든 거절했든) 받은 프로젝트 객체를 제자리에서 고치지 않았다 — 모든 도구가 같은 빈 프로젝트에서 출발했다.
      expect(serialize(blank) === pristine, "a write tool mutated its input project in place").toBe(true);
    }, HOSTILE_ARGS_TIMEOUT_MS);
  }
});

describe("postprocessing error boundary", () => {
  for (const code of ["protected-house-write", "house-overlap"] as const) {
    it.each([false, true])(`returns a readable ${code} rejection with empty args (dryRun=%s)`, (dryRun) => {
      const ctx = { project: completedHouseProject() };
      const original = ctx.project;
      const before = structuredClone(original);
      const result = mutateProject(ctx, (draft) => {
        const map = houseMap(draft);
        if (code === "protected-house-write") map.upperTiles[3 * map.width + 3] = -1;
        else map.layoutPlan?.regions.push({ id: "overlap", role: "house", label: "Overlap", ...HOUSE_RECT });
      }, dryRun);
      expect(result.ok).toBe(false);
      expect(result.issues).toEqual([expect.objectContaining({ severity: "error", code, mapId: original.startMapId })]);
      expect(isUnreadableFailure(result), JSON.stringify(result)).toBe(false);
      expect(ctx.project).toBe(original);
      expect(ctx.project).toEqual(before);
    });
  }

  it("retains unexpected postprocessing exceptions and rolls back", () => {
    const ctx = { project: completedHouseProject() };
    const original = ctx.project;
    const before = structuredClone(original);
    const error = new Error("postprocessing fixture failure");
    // 후처리(집 보호 검사)만 읽는 자리에 던지는 접근자를 둔다 — 집 맵의 배치 계획 구역 목록.
    // 전에는 draft.maps 에 던지는 맵을 끼웠는데, 실행기가 후처리보다 먼저 모든 맵을 훑어(compactTouchedMapLayers, 공개 기준선부터)
    // 예외가 실행 단계 경계에서 잡혔다(tool-exception · «실행 실패») — 이 시험이 보려는 후처리 경계(tool-postprocess · «후처리 실패»)에 닿지 못했다.
    const result = mutateProject(ctx, (draft) => {
      Object.defineProperty(houseMap(draft).layoutPlan!, "regions", { enumerable: true, get() { throw error; } });
    });
    expect(result.ok).toBe(false);
    expect(result.issues).toEqual([{ severity: "error", code: "tool-postprocess", message: error.message }]);
    expect(isUnreadableFailure(result)).toBe(true);
    expect(ctx.project).toBe(original);
    expect(ctx.project).toEqual(before);
  });
});
