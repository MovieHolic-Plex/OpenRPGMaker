import type { Project } from "@/project/types";
import { ToolError, type ToolDefinition } from "./types";

export const EVENT_COMMAND_ASSIST_TOOL = "event_command_assist";

export function eventCommandAssistTarget(project: Project, args: Record<string, unknown>) {
  const map = project.maps[String(args.mapId)];
  const event = map?.events.find(entry => entry.id === args.eventId);
  const page = event?.pages?.find(entry => entry.id === args.pageId);
  if (!map || !event || !page) throw new ToolError(
    "맵·이벤트·페이지를 찾을 수 없습니다. get_event로 실제 페이지 ID를 먼저 확인하세요.",
    { code: "not-found" },
  );
  return { map, event, page };
}

export const EVENT_COMMAND_ASSIST_TOOLS: readonly ToolDefinition[] = [{
  name: EVENT_COMMAND_ASSIST_TOOL,
  description: "기존 이벤트의 한 페이지 명령을 자연어로 만들기·고치기·지우기. 이벤트 편집기 AI와 같은 리소스·참조·착지·세계관 검증과 자가수정을 사용한다. get_event로 페이지 ID를 먼저 확인하라. 다른 페이지와 페이지 설정은 보존한다. 긴 페이지는 mode:'append'로 끝에 추가만 가능하다. 새 NPC 배치는 place_npc, 컷신은 script_cutscene을 사용하라.",
  mode: "write",
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string", minLength: 1 },
      eventId: { type: "string", minLength: 1 },
      pageId: { type: "string", minLength: 1 },
      prompt: { type: "string", minLength: 1, description: "이 페이지 명령에 원하는 변경" },
      mode: { type: "string", enum: ["edit", "append"], description: "기본 edit. append는 기존 명령 뒤에 추가한다." },
    },
    required: ["mapId", "eventId", "pageId", "prompt"],
    additionalProperties: false,
  },
  run() {
    throw new ToolError("이 도구는 비동기 AI 실행기가 필요합니다.", { code: "async-tool-required" });
  },
}];
