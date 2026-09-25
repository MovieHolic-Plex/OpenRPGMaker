// 감독이 지금 보고 있는 맵·레이어·도구·선택. 플레이트/시작 줄/입력 placeholder의 단일 출처.

import { editorState, type Layer, type Tool } from "@/editor/editorState";
import { getEditorChrome } from "@/editor/editorUiMode";
import { toolLabel, uiLabel } from "@/editor/uiCopy";
import {
  defaultAiVisualStartPrompts,
  type AiVisualStartPrompt,
} from "@/editor/panels/aiStartScreenCards";
import { editorWorkingEvents } from "@/project/eventDrafts";
import { isRoadTile } from "@/project/defaults/roadAutotile";
import { store } from "@/project/store";
import type { GameMap } from "@/project/types";

export type AgentBrief = {
  readonly mapName: string;
  readonly mapSize: string | null;
  readonly layer: Layer;
  readonly layerShort: string;
  readonly tool: Tool;
  readonly toolLabel: string;
  readonly selectionLabel: string | null;
  readonly eventCount: number;
  readonly hasPath: boolean;
  readonly hasEntrance: boolean;
  readonly deficit: string;
  readonly line: string;
  readonly lookingAt: string;
};

// 도구 이름은 uiCopy 단일 원천(TOOL_LABEL) — 여기서 다시 적지 않는다.

export function layerShortLabel(layer: Layer, termStyle = getEditorChrome().jargonStyle): string {
  switch (layer) {
    case "lower":
      return uiLabel("layerLower", termStyle);
    case "upper":
      return uiLabel("layerUpper", termStyle);
    case "event":
      return uiLabel("layerEvent", termStyle);
    default: {
      const _never: never = layer;
      return _never;
    }
  }
}

export function toolShortLabel(tool: Tool): string {
  return toolLabel(tool);
}

function mapHasPath(map: GameMap): boolean {
  return map.lowerTiles.some((tile) => isRoadTile(tile));
}

function mapHasEntrance(map: GameMap): boolean {
  return editorWorkingEvents(map.events).some((event) => {
    const commands = [
      ...(event.commands ?? []),
      ...(event.pages ?? []).flatMap((page) => page.commands ?? []),
    ];
    return commands.some((command) => {
      if (!command || typeof command !== "object" || !("kind" in command)) return false;
      return String(command.kind).toLowerCase().includes("transfer");
    });
  });
}

export function briefingDeficit(input: {
  readonly hasPath: boolean;
  readonly hasEntrance: boolean;
  readonly eventCount: number;
}): string {
  const facts: string[] = [];
  if (!input.hasEntrance) facts.push("입구 없음");
  if (!input.hasPath) facts.push("길 없음");
  if (input.eventCount === 0) facts.push("사람 0");
  return facts.join(" · ");
}

export function readAgentBrief(): AgentBrief {
  const state = editorState.get();
  const project = store.getCurrent();
  const mapId = state.currentMapId ?? project.startMapId ?? null;
  const map = mapId ? project.maps[mapId] : undefined;
  const mapName = map?.name ?? "맵 없음";
  const mapSize = map ? `${map.width}×${map.height}` : null;
  const layerShort = layerShortLabel(state.layer);
  const toolLabel = toolShortLabel(state.tool);
  const selection = state.selection;
  const selectionLabel =
    selection && (!mapId || selection.mapId === mapId)
      ? `선택 ${selection.width}×${selection.height} (${selection.x},${selection.y})`
      : null;
  const eventCount = map ? editorWorkingEvents(map.events).length : 0;
  const hasPath = map ? mapHasPath(map) : false;
  const hasEntrance = map ? mapHasEntrance(map) : false;
  const deficit = briefingDeficit({ hasPath, hasEntrance, eventCount });
  const parts: string[] = [mapSize ? `${mapName} ${mapSize}` : mapName, layerShort];
  if (!(state.layer === "event" && state.tool === "event")) {
    parts.push(toolLabel);
  }
  if (selectionLabel) parts.push(selectionLabel);
  const line = parts.join(" · ");
  const lookingAt = selectionLabel
    ? `지금 ${selectionLabel}`
    : `지금 ${mapSize ? `${mapName} ${mapSize}` : mapName}`;
  return {
    mapName,
    mapSize,
    layer: state.layer,
    layerShort,
    tool: state.tool,
    toolLabel,
    selectionLabel,
    eventCount,
    hasPath,
    hasEntrance,
    deficit,
    line,
    lookingAt,
  };
}

/**
 * 입력창 안내문. AI 가 연결되지 않았으면 **그 사실을 먼저** 말한다.
 *
 * 실측(2026-09-22): 미연결 상태에서도 placeholder 가 "한 문장으로 지시" 였다. 그래서 사용자는
 * 지시를 쓰고 보낸 뒤에야 — "의도 읽는 중…" 에서 멈춘 뒤에야 — 로그인이 필요하다는 걸 알았다.
 * 할 수 없는 일을 하라고 안내하지 않는다.
 */
export function formatComposerPlaceholder(aiReady = true): string {
  return aiReady ? "한 문장으로 지시" : "AI 연결 후 지시할 수 있어요 — 오른쪽 위 상태 칩을 누르세요";
}

export function idlePresenceLine(brief: AgentBrief): string {
  if (brief.selectionLabel) return "선택한 칸에 무엇을 둘까요";
  return "이 맵에 무엇을 둘까요";
}

export function assistantIdleHints(brief: AgentBrief): readonly {
  readonly id: string;
  readonly label: string;
  readonly instruction: string;
}[] {
  if (brief.selectionLabel) {
    const prompts = directorStartPrompts(brief);
    const first = prompts[0];
    const second = prompts[1];
    return [
      {
        id: first?.id ?? "selection",
        label: "선택한 칸을 꾸며줘",
        instruction: first?.instruction ?? "선택한 영역을 꾸며줘.",
      },
      {
        id: second?.id ?? "place",
        label: "길을 이어줘",
        instruction: second?.instruction ?? "길을 이어줘.",
      },
    ];
  }
  return [
    {
      id: "river",
      label: "강가를 만들어줘",
      instruction: `${brief.mapName}에 자연스러운 강가를 만들어줘.`,
    },
    {
      id: "cottages",
      label: "오두막 세 채",
      instruction: `${brief.mapName}에 오두막 세 채를 자연스럽게 배치해줘.`,
    },
  ];
}

export function nextStepHint(brief: AgentBrief): string {
  if (brief.selectionLabel) return "선택한 칸에 무엇을 둘지 골라 보세요.";
  if (!brief.hasPath && brief.eventCount === 0) {
    return "빈 맵이에요. 아래 중 하나를 누르면 바로 시작합니다.";
  }
  if (!brief.hasPath) return "길이 없어요. 장소를 만들어 길이 이어지게 해 보세요.";
  if (brief.eventCount === 0) return "아직 사람이 없어요. 등장인물을 만들어 보세요.";
  return "이어서 부탁하거나, 맵에 문제가 없는지 검사해 보세요.";
}

export function directorStartPrompts(brief: AgentBrief): readonly AiVisualStartPrompt[] {
  const base = defaultAiVisualStartPrompts();
  const byId = new Map(base.map((prompt) => [prompt.id, prompt]));
  const place = byId.get("place");
  const character = byId.get("character");
  const quest = byId.get("quest");
  const selection = byId.get("selection");
  const audit = byId.get("audit");
  if (!place || !character || !quest || !selection || !audit) return base;

  const namedPlace: AiVisualStartPrompt = {
    ...place,
    instruction: `${brief.mapName} 위에 길과 나무, 작은 집이 이어지는 야외 장소를 만들어줘.`,
  };
  const namedCharacter: AiVisualStartPrompt = {
    ...character,
    instruction: `${brief.mapName}에 어울리는 등장인물 한 명을 만들고, 말을 걸면 자연스럽게 인사하도록 해줘.`,
  };
  if (brief.selectionLabel) {
    return [selection, namedPlace, namedCharacter].slice(0, 3);
  }
  if (brief.layer === "event" || brief.eventCount > 0) {
    return [namedCharacter, quest, namedPlace].slice(0, 3);
  }
  return [namedPlace, namedCharacter, audit].slice(0, 3);
}
