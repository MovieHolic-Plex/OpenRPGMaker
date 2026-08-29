import { updateEventPage } from "@/editor/eventPages";
import { store } from "@/project/store";
import type { Dir, EventPage, MapConnection, MapId, NpcLivingDestination } from "@/project/types";
import { el } from "@/util/dom";
import { genId } from "@/util/id";
import { mapSelectElement } from "./sharedPickers";

const DIRECTION_OPTIONS: readonly { readonly value: Dir; readonly label: string }[] = [
  { value: "down", label: "아래" },
  { value: "left", label: "왼쪽" },
  { value: "right", label: "오른쪽" },
  { value: "up", label: "위" },
];

export function renderPageLivingMovement(mapId: MapId, eventId: string, page: EventPage): HTMLElement {
  const project = store.getCurrent();
  const event = project.maps[mapId]?.events.find((entry) => entry.id === eventId);
  const destination = page.movement.living?.destinations[0] ?? {
    mapId,
    x: event?.x ?? 0,
    y: event?.y ?? 0,
    direction: page.graphic.direction ?? "down",
  };
  const targetMap = mapSelect(destination.mapId, "event-page-living-target-map");
  const targetX = numberInput(destination.x, "event-page-living-target-x");
  const targetY = numberInput(destination.y, "event-page-living-target-y");
  const targetDirection = directionSelect(destination.direction ?? "down", "event-page-living-target-direction");
  const repeat = checkbox(page.movement.living?.repeat ?? false, "event-page-living-repeat");

  const applyLiving = () => {
    const target = { mapId: targetMap.value, x: numberValue(targetX), y: numberValue(targetY) };
    updateEventPage(
      mapId,
      eventId,
      page.id,
      {
        movement: {
          ...page.movement,
          type: "living",
          living: {
            destinations: [{
              ...target,
              direction: targetDirection.value as Dir,
            }],
            repeat: repeat.checked,
          },
        },
      },
      // 기본 라벨은 `페이지 속성 변경: … — 이동` 이라 어디로 가는 동선인지 안 남는다.
      // 목적지가 이 폼의 전부이므로 라벨에 넣어야 로그만 보고 잘못된 좌표를 찾을 수 있다.
      `NPC 생활 동선 변경: ${mapLabel(target.mapId)} (${target.x},${target.y})`
    );
  };

  for (const control of [targetMap, targetX, targetY, targetDirection, repeat]) {
    control.addEventListener("change", () => window.setTimeout(applyLiving, 0));
  }

  const connectionPanel = renderConnectionPanel(mapId, eventId, destination);
  return el("div", {
    class: "event-page-living-route",
    dataset: { testid: "event-page-living-route" },
    children: [
      el("div", {
        class: "event-page-living-grid",
        children: [
          compactLabel("목적지 맵", targetMap),
          compactLabel("X", targetX),
          compactLabel("Y", targetY),
          compactLabel("방향", targetDirection),
          compactLabel("반복", repeat),
        ],
      }),
      connectionPanel,
      connectionSummary(mapId),
    ],
  });
}

// eventId 는 화면에 쓰이지 않지만 연결 upsert 를 "어느 이벤트를 편집하다 만든 연결" 로
// 감사 로그에 묶기 위해 받는다 — 맵 연결은 프로젝트 전역이라 그 단서가 없으면 추적이 끊긴다.
function renderConnectionPanel(mapId: MapId, eventId: string, destination: NpcLivingDestination): HTMLElement {
  const project = store.getCurrent();
  const existing = (project.mapConnections ?? []).find((connection) =>
    connection.from.mapId === mapId && connection.to.mapId === destination.mapId
  );
  const targetMap = mapSelect(existing?.to.mapId ?? destination.mapId, "event-page-map-link-target-map");
  const fromX = numberInput(existing?.from.x ?? 0, "event-page-map-link-from-x");
  const fromY = numberInput(existing?.from.y ?? 0, "event-page-map-link-from-y");
  const toX = numberInput(existing?.to.x ?? destination.x, "event-page-map-link-to-x");
  const toY = numberInput(existing?.to.y ?? destination.y, "event-page-map-link-to-y");
  const npcEnabled = checkbox(existing?.npcEnabled ?? true, "event-page-map-link-npc-enabled");
  const playerEnabled = checkbox(existing?.playerEnabled ?? true, "event-page-map-link-player-enabled");
  const addButton = el("button", {
    class: "btn event-page-map-link-add",
    text: existing ? "연결 갱신" : "연결 추가",
    attrs: { type: "button" },
    dataset: { testid: "event-page-map-link-add" },
    on: {
      click: () => upsertConnection({
        id: existing?.id ?? genId("conn"),
        name: `${mapLabel(mapId)} -> ${mapLabel(targetMap.value)}`,
        from: { mapId, x: numberValue(fromX), y: numberValue(fromY), direction: "down" },
        to: { mapId: targetMap.value, x: numberValue(toX), y: numberValue(toY), direction: "down" },
        playerEnabled: playerEnabled.checked,
        npcEnabled: npcEnabled.checked,
      }, eventId),
    },
  });

  return el("div", {
    class: "event-page-map-link-panel",
    dataset: { testid: "event-page-map-link-panel" },
    children: [
      el("div", {
        class: "event-page-living-grid",
        children: [
          compactLabel("연결 맵", targetMap),
          compactLabel("출발 X", fromX),
          compactLabel("출발 Y", fromY),
          compactLabel("도착 X", toX),
          compactLabel("도착 Y", toY),
          compactLabel("엔피시", npcEnabled),
          compactLabel("플레이어", playerEnabled),
          addButton,
        ],
      }),
    ],
  });
}

function upsertConnection(connection: MapConnection, eventId: string): void {
  // 갱신인지 추가인지는 mutator 안에서만 알 수 있지만 라벨은 그전에 굳는다 — 먼저 읽어 가른다.
  const updating = (store.getCurrent().mapConnections ?? []).some((entry) => entry.id === connection.id);
  store.update((project) => {
    project.mapConnections ??= [];
    const existingIndex = project.mapConnections.findIndex((entry) => entry.id === connection.id);
    if (existingIndex >= 0) {
      project.mapConnections[existingIndex] = connection;
      return;
    }
    project.mapConnections.push(connection);
  }, {
    // mapConnections 는 프로젝트 전역이지만, 사용자가 선 자리는 출발 맵의 이벤트 편집기다.
    // 스코프를 그 맵으로 잡아야 "이 맵에서 무슨 일이 있었나" 조회에 걸린다.
    scope: "map",
    mapId: connection.from.mapId,
    eventId,
    label: `${updating ? "맵 연결 갱신" : "맵 연결 추가"}: ${connection.name}`,
  });
}

function connectionSummary(mapId: MapId): HTMLElement {
  const project = store.getCurrent();
  const links = (project.mapConnections ?? []).filter((connection) => connection.from.mapId === mapId);
  return el("div", {
    class: "empty-hint event-page-map-link-summary",
    text: links.length === 0
      ? "이 맵에서 나가는 연결 없음"
      : links.map((connection) =>
        `${mapLabel(connection.from.mapId)} (${connection.from.x},${connection.from.y}) -> ${mapLabel(connection.to.mapId)} (${connection.to.x},${connection.to.y})${connection.npcEnabled ? "" : " NPC 비활성"}`
      ).join(" | "),
    dataset: { testid: "event-page-map-link-summary" },
  });
}

function mapSelect(value: MapId, testId: string): HTMLSelectElement {
  return mapSelectElement({
    selectedId: value,
    testid: testId,
    allowEmpty: false,
  });
}

function directionSelect(value: Dir, testId: string): HTMLSelectElement {
  const select = el("select", { dataset: { testid: testId } }) as HTMLSelectElement;
  for (const option of DIRECTION_OPTIONS) {
    select.append(el("option", { text: option.label, attrs: { value: option.value } }));
  }
  select.value = value;
  return select;
}

function numberInput(value: number, testId: string): HTMLInputElement {
  return el("input", {
    attrs: { type: "number", value: String(value), step: "1" },
    dataset: { testid: testId },
  }) as HTMLInputElement;
}

function checkbox(value: boolean, testId: string): HTMLInputElement {
  const input = el("input", {
    attrs: { type: "checkbox" },
    dataset: { testid: testId },
  }) as HTMLInputElement;
  input.checked = value;
  return input;
}

function compactLabel(text: string, control: HTMLElement): HTMLElement {
  return el("label", {
    class: "event-page-movement-label",
    children: [el("span", { text }), control],
  });
}

function numberValue(input: HTMLInputElement): number {
  return Math.max(0, Math.trunc(Number(input.value) || 0));
}

function mapLabel(mapId: MapId): string {
  return store.getCurrent().maps[mapId]?.name ?? mapId;
}
