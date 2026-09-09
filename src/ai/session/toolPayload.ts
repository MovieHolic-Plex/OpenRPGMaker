// ai/session/toolPayload.ts
// 모델과 툴 사이를 오가는 페이로드 변환. 들어올 때는 툴콜 인자 JSON 을 파싱하고,
// 나갈 때는 툴 결과를 컨텍스트에 넣을 만한 크기로 접는다.

import type { ToolResult } from "@/editor/tools";
import type { ToolCall } from "../llmClient";
import { isRecord } from "./unknownValue";

export function discoveredToolNames(result: ToolResult): string[] {
  if (!result.ok || typeof result.data !== "object" || result.data === null || Array.isArray(result.data)) return [];
  const matches = (result.data as { readonly matches?: unknown }).matches;
  if (!Array.isArray(matches)) return [];
  return matches.flatMap((match) => {
    if (typeof match !== "object" || match === null || Array.isArray(match)) return [];
    const name = (match as { readonly name?: unknown }).name;
    return typeof name === "string" ? [name] : [];
  });
}

export function toolTargetMapId(args: Record<string, unknown>): string | undefined {
  const mapId = args.mapId ?? (isRecord(args.target) ? args.target.mapId : undefined);
  return typeof mapId === "string" ? mapId : undefined;
}

export function toolRetryTarget(name: string, args: Record<string, unknown>): string {
  const record = name.startsWith("upsert_") ? args[name.slice("upsert_".length)] : undefined;
  const id = args.id ?? args.eventId ?? (isRecord(record) ? record.id : undefined) ?? args.name;
  return JSON.stringify([name, toolTargetMapId(args) ?? null, typeof id === "string" ? id : null]);
}

export function deferredToolResult(reason: string, summary: string): ToolResult {
  return {
    ok: false, summary,
    issues: [{ severity: "error", code: reason, message: summary }],
    data: { code: "tool-deferred", executed: false, reason },
  };
}

export function isDeferredToolResult(result: ToolResult): boolean {
  return isRecord(result.data) && result.data.code === "tool-deferred" && result.data.executed === false;
}

// 모델에 되돌려줄 툴 결과(자가수정을 위해 issues를 포함).
// show_map_region 등의 거대한 lower/upper 2D 배열은 컨텍스트를 폭파시키므로 생략한다(이미지는 별도 주입).
export function toolResultForModel(result: ToolResult): Record<string, unknown> {
  return {
    ok: result.ok,
    summary: result.summary,
    diff: result.diff,
    // issues가 있으면 원인을 읽고 인자를 고쳐 재시도하라는 신호.
    issues: result.issues?.map((issue) => ({ severity: issue.severity, code: issue.code, message: issue.message,
      ...(issue.relocation ? { mapId: issue.mapId, eventId: issue.eventId, x: issue.x, y: issue.y, relocation: issue.relocation } : {}),
    })),
    ...(result.warnings && result.warnings.length > 0 ? { warnings: result.warnings } : {}),
    data: compactToolDataForModel(result.data),
  };
}

function compactToolDataForModel(data: unknown): unknown {
  if (data === null || data === undefined || typeof data !== "object") return data;
  const rec = data as Record<string, unknown>;

  // 비전 툴: 전체 타일 행렬 생략 (픽셀 이미지가 별도 user 메시지로 감).
  if (Array.isArray(rec.lower) || Array.isArray(rec.upper)) {
    const w = typeof rec.w === "number" ? rec.w : undefined;
    const h = typeof rec.h === "number" ? rec.h : undefined;
    return {
      mapId: rec.mapId,
      x: rec.x,
      y: rec.y,
      w,
      h,
      // look_at_houses 의 집계는 이미지로 대체되지 않는 판정 근거다 — 배열만 떼고 남긴다.
      ...(rec.bounds === undefined ? {} : { bounds: rec.bounds }),
      ...(rec.houses === undefined ? {} : { houses: rec.houses }),
      ...(rec.variety === undefined ? {} : { variety: rec.variety }),
      tileArraysOmitted: true,
      note: "lower/upper 타일 배열은 컨텍스트 절약을 위해 생략됨. 같은 턴에 주입된 맵 이미지를 보거나, 좌표는 x/y/w/h·summary를 사용. 호수 위치는 get_map_region의 data.water.bounds를 우선.",
    };
  }

  // get_map_region: 과대 그리드는 샘플+water 메타만.
  if (Array.isArray(rec.grid)) {
    const grid = rec.grid as string[];
    const totalChars = grid.reduce((sum, row) => sum + row.length, 0);
    if (totalChars > 900) {
      const step = Math.max(1, Math.ceil(Math.sqrt(totalChars / 600)));
      const sampled = grid.filter((_, index) => index % step === 0).map((row) => {
        if (row.length <= 40) return row;
        let out = "";
        for (let i = 0; i < row.length; i += step) out += row[i];
        return out;
      });
      return {
        ...rec,
        grid: sampled,
        gridSampled: true,
        gridSampleStep: step,
        note: "그리드가 커서 샘플링됨. 호수 좌표는 water.bounds를 쓰고, 상세는 작은 영역으로 재조회.",
      };
    }
  }

  return data;
}

export function parseToolCall(call: ToolCall): { name: string; args: Record<string, unknown>; parseError: string | null } {
  const name = call.function.name;
  const raw = call.function.arguments?.trim();
  if (!raw) return { name, args: {}, parseError: null };
  try {
    const parsed = JSON.parse(raw);
    if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) {
      return { name, args: parsed as Record<string, unknown>, parseError: null };
    }
    return { name, args: {}, parseError: `인자가 JSON 객체가 아닙니다(${Array.isArray(parsed) ? "array" : typeof parsed}).` };
  } catch (cause) {
    // 예전엔 파싱 실패를 조용히 삼켜 빈 인자로 툴을 돌렸다. 그러면 모델은 `필수 인자 누락:
    // mapId, x, y…` 를 받고 "인자를 안 보냈다"고 이해해 **똑같은 큰 페이로드를 그대로 재전송**한다 —
    // 진짜 원인은 보통 출력 상한으로 JSON 이 중간에서 잘린 것이다. 사유를 그대로 알린다.
    return { name, args: {}, parseError: cause instanceof Error ? cause.message : String(cause) };
  }
}

/** 인자 JSON 자체가 깨진 툴콜 — 툴을 돌리지 않고 사유를 모델에 되돌려 자가수정을 유도한다. */
export function invalidJsonArgsResult(name: string, raw: string, reason: string): ToolResult {
  const compact = raw.length > 160 ? `${raw.slice(0, 80)}…(중략)…${raw.slice(-40)}` : raw;
  return {
    ok: false,
    summary: `'${name}' 인자 JSON 파싱 실패: ${reason}`,
    issues: [
      {
        severity: "error",
        code: "invalid-json-args",
        message:
          `인자 JSON 을 해석하지 못했습니다: ${reason}. 인자를 생략한 것이 아니라 깨진 문자열로 도달했으므로,`
          + ` 같은 내용을 그대로 다시 보내면 또 실패합니다. 출력 길이 상한에 걸려 JSON 이 잘린 경우가 대부분이니`
          + ` 한 호출에 담는 항목 수를 줄이거나 호출을 여러 번으로 나눠 다시 시도하세요.`
          + ` 받은 원문(축약): ${compact}`,
      },
    ],
  };
}
