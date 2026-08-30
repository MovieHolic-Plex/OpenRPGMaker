// editor/tools/viewFocusTools.ts
// focus_editor_view — 조수가 사용자 화면을 데려가는 유일한 툴.
//
// 순수 read 툴이다: 프로젝트를 바꾸지 않고 "어디를 보여줄지"만 계산해 돌려주고, 실제 화면 이동은
// 채팅 패널이 `tool_call` 이벤트에서 `focusEditorRegion` 으로 수행한다(highlight_map_region 과 같은 규약).
// 이름 조회는 답변 링크와 **같은 색인**(`@/editor/aiAnswerLinks`)을 쓴다 — 조수가 말로 부른 이름과
// 화면을 옮길 때 쓰는 이름이 갈라지면 "말한 곳과 다른 데로 간다".
import { buildEditorReferenceIndex, resolveEditorReferenceQuery } from "@/editor/aiAnswerLinks";
import { requireMap } from "./mapHelpers";
import { ToolError, type ToolDefinition, type ToolExecResult } from "./types";

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(value)));
}

const focusEditorView: ToolDefinition = {
  name: "focus_editor_view",
  description:
    "사용자 화면을 특정 위치로 옮긴다. 이름만 주면(query) 프로젝트에서 그 맵·NPC·건물을 찾아 그곳으로 데려간다. "
    + "'어디야?', '어디에 있어?', '보여줘', '거기로 가자' 같은 요청에는 설명하기 전에 먼저 호출하라. "
    + "좌표를 이미 알고 있으면 mapId 와 x·y·w·h 로 직접 지정한다. mapId 가 있으면 query 는 무시한다.",
  mode: "read",
  parameters: {
    type: "object",
    properties: {
      query: { type: "string", description: "찾을 맵·이벤트 이름(사용자가 부른 그대로). mapId 가 있으면 무시됨" },
      mapId: { type: "string", description: "좌표로 직접 지정할 때 대상 맵. query 보다 우선함" },
      x: { type: "integer", description: "왼쪽 위 타일 X (mapId 지정 시)" },
      y: { type: "integer", description: "왼쪽 위 타일 Y (mapId 지정 시)" },
      w: { type: "integer", description: "너비(타일). 생략하면 1" },
      h: { type: "integer", description: "높이(타일). 생략하면 1" },
    },
  },
  run(project, args): ToolExecResult {
    const query = typeof args.query === "string" ? args.query.trim() : "";
    const mapIdArg = typeof args.mapId === "string" ? args.mapId.trim() : "";
    if (!query && !mapIdArg) {
      throw new ToolError("query(이름) 또는 mapId 중 하나는 있어야 합니다.", { code: "invalid-args" });
    }

    if (mapIdArg) {
      const map = requireMap(project, mapIdArg);
      const hasRect = typeof args.x === "number" || typeof args.y === "number";
      const x = clampInt(args.x, 0, map.width - 1, 0);
      const y = clampInt(args.y, 0, map.height - 1, 0);
      const w = hasRect ? clampInt(args.w, 1, map.width - x, 1) : map.width;
      const h = hasRect ? clampInt(args.h, 1, map.height - y, 1) : map.height;
      const label = map.name || map.id;
      return {
        summary: hasRect
          ? `화면을 '${label}' (${x},${y}) ${w}×${h} 로 옮겼습니다.`
          : `화면을 '${label}' 맵으로 옮겼습니다.`,
        data: { mapId: map.id, x, y, w, h, label, kind: "map" },
      };
    }

    const entry = resolveEditorReferenceQuery(buildEditorReferenceIndex(project), query);
    if (!entry) {
      throw new ToolError(`'${query}' 라는 이름의 맵이나 이벤트를 찾지 못했습니다.`, { code: "not-found" });
    }
    if (entry.target.kind === "ambiguous") {
      throw new ToolError(
        `'${entry.label}' 이름이 ${entry.target.count}곳에 있습니다. mapId 와 좌표를 보내면 query보다 우선하므로 그 방식으로 지정하거나 사용자에게 어느 것인지 물어보세요.`,
        { code: "ambiguous" }
      );
    }
    if (entry.target.kind === "map") {
      const map = requireMap(project, entry.target.mapId);
      return {
        summary: `화면을 '${entry.label}' 맵으로 옮겼습니다.`,
        data: { mapId: map.id, x: 0, y: 0, w: map.width, h: map.height, label: entry.label, kind: "map" },
      };
    }
    const map = requireMap(project, entry.target.mapId);
    return {
      summary: `화면을 '${entry.label}'(${map.name || map.id} ${entry.target.x},${entry.target.y}) 로 옮겼습니다.`,
      data: {
        mapId: map.id,
        x: entry.target.x,
        y: entry.target.y,
        w: 1,
        h: 1,
        label: entry.label,
        kind: "event",
        eventId: entry.target.eventId,
      },
    };
  },
};

export const VIEW_FOCUS_TOOLS: readonly ToolDefinition[] = [focusEditorView];
