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
import type { JsonSchema, ToolResult } from "@/editor/tools/types";
import { completedHouseProject, houseMap, HOUSE_RECT, mutateProject } from "./fixtures/completedHouse";

type Variant = "empty" | "nulls" | "wrongTypes" | "deepHoles";

const HOSTILE_ARGS_TIMEOUT_MS = 60_000;

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
      for (const tool of writeTools) {
        // Let worker RPC responses drain between synchronous tool calls; no timed wait.
        await scheduler.yield();
        const ctx = { project: createBlankProject() };
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
    const result = mutateProject(ctx, (draft) => {
      Object.defineProperty(draft.maps, "broken", { enumerable: true, get() { throw error; } });
    });
    expect(result.ok).toBe(false);
    expect(result.issues).toEqual([{ severity: "error", code: "tool-postprocess", message: error.message }]);
    expect(isUnreadableFailure(result)).toBe(true);
    expect(ctx.project).toBe(original);
    expect(ctx.project).toEqual(before);
  });
});
