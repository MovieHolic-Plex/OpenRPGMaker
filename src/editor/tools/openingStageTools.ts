// 엔진 무대 오프닝 저작 — 오프닝의 인물 움직임을 그림 레이어가 아니라 실제 맵 위의 엔진으로 연출한다.
// 오너 2026-11-05: 「오프닝 만들 때, 캐릭들이 움직이는 걸 넣는 건 좋은데, 게임 엔진을 너무 무시하는데」.
// 무대 = system.opening.stage(src/project/openingStage.ts). 새 게임이 무대 맵의 그 칸에서 열리고, 무대 컷신(자동 실행·한 번·건너뛰기 가능)이
// 맵의 조명·날씨·BGM 그대로 인물을 이동 경로로 걷게 하며, 끝(건너뛰기로도)은 프로젝트 시작 위치로 옮긴다.
import { clearOpeningStageCommand } from "@/project/openingStage";
import { compileCutscene, type CutsceneBeat } from "@/editor/cutscene";
import { EVENT_TOOLS } from "./eventTools";
import { requireMap } from "./mapHelpers";
import { CUTSCENE_BEAT_SCHEMA } from "./schemaShapes";
import { ToolError, type ToolDefinition, type ToolExecResult } from "./types";

const SCRIPT_CUTSCENE = EVENT_TOOLS.find((tool) => tool.name === "script_cutscene");

const authorOpeningStage: ToolDefinition = {
  name: "author_opening_stage",
  description:
    "게임 오프닝을 «실제 맵 위 엔진 연출»로 만든다 — 인물이 움직이는 오프닝은 이것이 기본이다. 그림 레이어로 걷는 캐릭터(place_opening_charset_actor·animatic walk)를 만들지 말고 이 도구를 쓴다. " +
    "새 게임을 누르면 (그림 장면 system.opening.scenes 가 있으면 그 뒤에) mapId 의 x,y 에서 게임이 시작되고, beats 컷신이 자동으로 한 번 재생된 뒤 프로젝트 시작 위치(startMapId·startPos)로 옮긴다. Esc 로 건너뛰어도 옮긴다. " +
    "beats 는 script_cutscene 과 같다 — letterbox, look{target:'player',alpha:0}(주인공 숨기기; 도구가 맨 앞에 자동으로 넣는다), camera{mode:'pan',x,y,durationMs}, moveActor{eventId,moves|route}(맵 NPC 가 이동 경로로 걷는다), approach, weather, particles{preset:'petals'}, emote, say{context:'narration',text}(자막처럼 쓰는 내레이션), fade, wait, parallel. " +
    "걷는 사람은 맵에 이벤트로 먼저 둔다(place_npc·upsert_event, 그래픽=캐릭터셋). 그 맵의 다른 자동·병렬 이벤트는 오프닝 동안 멈춘다(본편 도입 컷신과 겹치지 않는다). " +
    "그림 장면은 엔진이 못 보여 주는 것(큰 흉상·클로즈업 CG·제목 카드)만 set_opening/create_opening_animatic_shot 으로 남긴다. 끝나면 preview_cutscene 으로 확인한다.",
  mode: "write",
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string", description: "무대 맵(실제 게임 맵 — 거리·마을·역)." },
      x: { type: "integer", description: "무대에서 게임이 열리는 칸(주인공은 숨겨지지만 카메라의 출발점). 걸을 수 있는 칸." },
      y: { type: "integer" },
      eventId: { type: "string", description: "무대 컷신 이벤트 id. 생략하면 ev_opening_stage." },
      beats: { type: "array", description: "CutsceneBeat[] — script_cutscene 과 같은 비트.", items: CUTSCENE_BEAT_SCHEMA },
      skippable: { type: "boolean", description: "기본 true(Esc 두 번으로 건너뛰기)." },
    },
    required: ["mapId", "x", "y", "beats"],
  },
  run(draft, args): ToolExecResult {
    if (!SCRIPT_CUTSCENE) throw new ToolError("script_cutscene 도구를 찾지 못했습니다.", { code: "tool-missing" });
    const map = requireMap(draft, args.mapId as string);
    const x = Math.trunc(Number(args.x)), y = Math.trunc(Number(args.y));
    if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= map.width || y >= map.height) {
      throw new ToolError(`무대 칸 (${args.x},${args.y}) 이 맵 ${map.id}(${map.width}×${map.height}) 밖입니다.`, { code: "opening-stage-invalid", mapId: map.id });
    }
    if (!Array.isArray(args.beats) || args.beats.length === 0) throw new ToolError("beats 가 비었습니다 — 무대에서 무엇이 움직이는지 비트로 적으세요.", { code: "opening-stage-invalid" });
    const eventId = typeof args.eventId === "string" && args.eventId.trim() ? args.eventId.trim() : "ev_opening_stage";
    const startMap = draft.maps[draft.startMapId];
    if (!startMap) throw new ToolError("프로젝트 시작 맵이 없습니다 — 무대가 끝난 뒤 옮길 곳이 필요합니다.", { code: "opening-stage-invalid" });
    const authored = (args.beats as CutsceneBeat[]).filter((beat) => beat?.kind !== "transfer");
    const hidesPlayer = authored.some((beat) => beat?.kind === "look" && (beat.target === "player" || beat.target === undefined) && typeof beat.alpha === "number" && beat.alpha <= 0.05);
    const beats: CutsceneBeat[] = [
      ...(hidesPlayer ? [] : [{ kind: "look", target: "player", alpha: 0 } as CutsceneBeat]),
      ...authored,
      { kind: "transfer", mapId: draft.startMapId, x: draft.startPos.x, y: draft.startPos.y, facing: "retain", fade: "black" },
    ];
    const cut = SCRIPT_CUTSCENE.run(draft, { mapId: map.id, eventId, x, y, trigger: "auto", once: true, skippable: args.skippable !== false, beats });
    // 무대 표 내리기는 건너뛰기 착지 뒤(맵 이동 바로 앞)에 둔다 — 건너뛰어도 표가 남아 무대 맵의 다른 이벤트가 영영 멈추는 일이 없게.
    const event = map.events.find((entry) => entry.id === eventId);
    const page = event?.pages?.find((entry) => entry.name === "컷신");
    const transferIndex = page ? page.commands.map((command) => command.kind).lastIndexOf("transfer") : -1;
    if (!page || transferIndex < 0) throw new ToolError("무대 컷신을 만들지 못했습니다(맵 이동 줄 없음).", { code: "opening-stage-invalid", mapId: map.id });
    // 주인공 모습 되돌리기(look reset)도 여기 둔다 — 세션에 남는 상태라 건너뛰기로 head 를 건너면 숨은 채 본편이 시작됐다.
    // 무대가 모습을 바꾼 대상(주인공·숨긴 행인 등)을 모두 되돌린다.
    const lookTargets = new Map<string, CutsceneBeat>([["player", { kind: "look", target: "player", reset: true }]]);
    for (const beat of authored) if (beat?.kind === "look") {
      const id = (beat.eventId ?? beat.target ?? "player").trim() || "player";
      if (!lookTargets.has(id) && id !== "this-event") lookTargets.set(id, { kind: "look", ...(id === "player" ? { target: "player" } : { eventId: id }), reset: true } as CutsceneBeat);
    }
    const reset = [...lookTargets.values()].flatMap((beat) => compileCutscene([beat]).filter((command) => command.kind === "m2Command").slice(0, 1));
    page.commands.splice(transferIndex, 0, clearOpeningStageCommand(map.id, eventId), ...reset);
    const opening = draft.system.opening ?? { enabled: true, skippable: true, scenes: [] };
    draft.system.opening = { ...opening, enabled: true, stage: { mapId: map.id, x, y, eventId } };
    return {
      summary: `엔진 무대 오프닝 — ${map.name}(${x},${y}) 에서 컷신 '${eventId}' 재생 후 시작 위치(${draft.startMapId} ${draft.startPos.x},${draft.startPos.y})로 이동. 그림 장면 ${draft.system.opening.scenes.length}개가 앞에 남아 있다.`,
      data: { mapId: map.id, x, y, eventId, pictureScenes: draft.system.opening.scenes.length, ...(cut.data as object | undefined) },
      ...(cut.warnings && cut.warnings.length > 0 ? { warnings: cut.warnings } : {}),
    };
  },
};

export const OPENING_STAGE_TOOLS: readonly ToolDefinition[] = [authorOpeningStage];
