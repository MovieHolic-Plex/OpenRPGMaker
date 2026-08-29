import { updateEventPage } from "@/editor/eventPages";
import { store } from "@/project/store";
import type { Dir, EventPage, MapConnection, MapId, NpcLivingDestination } from "@/project/types";
import { el } from "@/util/dom";
import { genId } from "@/util/id";
import { eventEditorOpenKey, openEventMapLink } from "./eventEditorOpenState";
import { mapPointLabel, openMapPointDialog } from "./mapPointDialog";
import { mapSelectElement } from "./sharedPickers";

const DIRECTION_OPTIONS: readonly { readonly value: Dir; readonly label: string }[] = [
  { value: "down", label: "아래" },
  { value: "left", label: "왼쪽" },
  { value: "right", label: "오른쪽" },
  { value: "up", label: "위" },
];

/**
 * 생활 이동 목적지 + (필요할 때만) 맵 연결.
 *
 * 이전 구현은 233px 레일에 컨트롤 13개(목적지 5 + 맵 연결 8)를 `auto-fit minmax(148px, 1fr)`
 * 그리드로 깔았다. 레일 폭에서 그 그리드는 **1열**이 되므로 실측 13행 세로 스택이었고,
 * 맵 연결 폼은 목적지가 **같은 맵**일 때도(=연결이 무의미할 때도) 항상 펼쳐져 있었다.
 * 지금은 목적지를 2행으로 조이고, 맵 연결은 "다른 맵으로 나갈 때"만 한 줄 상태로 알린 뒤
 * 요청 시에만 폼을 펼친다.
 */
export function renderPageLivingMovement(mapId: MapId, eventId: string, page: EventPage): HTMLElement {
  const project = store.getCurrent();
  const event = project.maps[mapId]?.events.find((entry) => entry.id === eventId);
  const eventPos = { x: event?.x ?? 0, y: event?.y ?? 0 };
  const destination = page.movement.living?.destinations[0] ?? {
    mapId,
    x: eventPos.x,
    y: eventPos.y,
    direction: page.graphic.direction ?? "down",
  };
  const targetMap = mapSelect(destination.mapId, "event-page-living-target-map");
  const targetX = numberInput(destination.x, "event-page-living-target-x");
  const targetY = numberInput(destination.y, "event-page-living-target-y");
  const targetDirection = directionSelect(destination.direction ?? "down", "event-page-living-target-direction");
  const repeat = checkbox(page.movement.living?.repeat ?? false, "event-page-living-repeat");

  const applyLiving = () => {
    updateEventPage(mapId, eventId, page.id, {
      movement: {
        ...page.movement,
        type: "living",
        living: {
          destinations: [{
            mapId: targetMap.value,
            x: numberValue(targetX),
            y: numberValue(targetY),
            direction: targetDirection.value as Dir,
          }],
          repeat: repeat.checked,
        },
      },
    });
  };

  for (const control of [targetMap, targetX, targetY, targetDirection, repeat]) {
    control.addEventListener("change", () => window.setTimeout(applyLiving, 0));
  }

  // 맵 위에서 직접 찍기. 숨은 필드가 아니라 보이는 select/X/Y 를 그대로 갱신하므로
  // 검증기 앵커(`event-page-living-target-map` / `-x`)와 e2e 의 손입력 경로가 둘 다 산다.
  const pick = el("button", {
    class: "btn event-page-living-pick",
    text: "맵에서 찍기",
    attrs: { type: "button", title: "맵 위에서 목적지 칸을 눈으로 고릅니다" },
    dataset: { testid: "event-page-living-pick" },
    on: {
      click: () => openMapPointDialog({
        title: "생활 이동 목적지",
        testIdPrefix: "event-living-point",
        point: { mapId: targetMap.value, x: numberValue(targetX), y: numberValue(targetY) },
        onApply: (point) => {
          targetMap.value = point.mapId;
          targetX.value = String(point.x);
          targetY.value = String(point.y);
          window.setTimeout(applyLiving, 0);
        },
      }),
    },
  });

  return el("div", {
    class: "event-page-living-route",
    dataset: { testid: "event-page-living-route" },
    children: [
      el("div", {
        class: "event-page-living-destination",
        children: [
          el("span", { class: "event-page-living-field-label", text: "목적지" }),
          targetMap,
          pick,
        ],
      }),
      el("div", {
        class: "event-page-living-grid event-page-living-detail",
        children: [
          compactLabel("X", targetX),
          compactLabel("Y", targetY),
          compactLabel("방향", targetDirection),
          compactLabel("반복", repeat),
        ],
      }),
      renderMapLinkBlock(mapId, eventId, page, destination, eventPos),
    ],
  });
}

/**
 * 맵 연결은 "다른 맵으로 걸어 나가는 NPC" 에게만 뜻이 있다. 같은 맵 목적지면 아무것도 안 낸다.
 * 다른 맵인데 연결이 없으면 그 사실만 한 줄로 경고하고, 폼은 눌렀을 때만 펼친다.
 */
function renderMapLinkBlock(
  mapId: MapId,
  eventId: string,
  page: EventPage,
  destination: NpcLivingDestination,
  eventPos: { readonly x: number; readonly y: number },
): HTMLElement {
  const block = el("div", { class: "event-page-map-link-block", dataset: { testid: "event-page-map-link-block" } });
  if (destination.mapId === mapId) return block;

  const project = store.getCurrent();
  const existing = (project.mapConnections ?? []).find(
    (connection) => connection.from.mapId === mapId && connection.to.mapId === destination.mapId,
  );
  const openKey = eventEditorOpenKey(mapId, eventId, page.id);
  // 연결이 아직 없으면 저작자가 만들어야 하므로 폼을 처음부터 펼쳐 둔다. 그때는 접기 토글을
  // 내지 않는다 — 할 일이 "연결 추가" 하나뿐인데 버튼 두 개는 어느 쪽이 본 행동인지 흐린다.
  const expanded = openEventMapLink.has(openKey) || !existing;
  const form = renderConnectionForm(mapId, destination, existing, eventPos);
  form.hidden = !expanded;

  const statusChildren: HTMLElement[] = [
    el("span", {
      class: "event-page-map-link-status-text",
      text: existing
        ? `${mapLabel(mapId)} (${existing.from.x},${existing.from.y}) → ${mapLabel(existing.to.mapId)} (${existing.to.x},${existing.to.y})${existing.npcEnabled ? "" : " · NPC 통행 꺼짐"}`
        : `「${mapLabel(destination.mapId)}」로 나가는 연결이 없습니다`,
    }),
  ];
  if (existing) {
    const toggle = el("button", {
      class: "btn event-page-map-link-toggle",
      text: expanded ? "연결 접기" : "연결 편집",
      attrs: { type: "button" },
      dataset: { testid: "event-page-map-link-toggle" },
      on: {
        click: () => {
          const next = form.hidden;
          form.hidden = !next;
          if (next) openEventMapLink.add(openKey);
          else openEventMapLink.delete(openKey);
          toggle.textContent = next ? "연결 접기" : "연결 편집";
        },
      },
    });
    statusChildren.push(toggle);
  }

  block.append(
    el("div", {
      class: `event-page-map-link-status${existing ? "" : " is-missing"}`,
      dataset: { testid: "event-page-map-link-status" },
      children: statusChildren,
    }),
    form,
  );
  return block;
}

function renderConnectionForm(
  mapId: MapId,
  destination: NpcLivingDestination,
  existing: MapConnection | undefined,
  eventPos: { readonly x: number; readonly y: number },
): HTMLElement {
  const targetMap = mapSelect(existing?.to.mapId ?? destination.mapId, "event-page-map-link-target-map");
  // 출발 기본값은 (0,0) 이 아니라 이 NPC 가 서 있는 칸이다 — 걸어 나가는 지점이 여기다.
  const fromX = numberInput(existing?.from.x ?? eventPos.x, "event-page-map-link-from-x");
  const fromY = numberInput(existing?.from.y ?? eventPos.y, "event-page-map-link-from-y");
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
      }),
    },
  });

  return el("div", {
    class: "event-page-map-link-panel",
    dataset: { testid: "event-page-map-link-panel" },
    children: [
      el("div", {
        class: "event-page-map-link-grid",
        children: [
          spanningLabel("연결 맵", targetMap),
          compactLabel("출발 X", fromX),
          compactLabel("출발 Y", fromY),
          compactLabel("도착 X", toX),
          compactLabel("도착 Y", toY),
          compactLabel("NPC", npcEnabled),
          compactLabel("플레이어", playerEnabled),
        ],
      }),
      el("div", {
        class: "event-page-map-link-actions",
        children: [
          addButton,
          el("span", {
            class: "event-page-map-link-hint",
            text: `출발 칸은 이 맵에서 나가는 문 자리입니다. 도착은 ${mapPointLabel(destination.mapId, destination.x, destination.y)}.`,
          }),
        ],
      }),
    ],
  });
}

function upsertConnection(connection: MapConnection): void {
  store.update((project) => {
    project.mapConnections ??= [];
    const existingIndex = project.mapConnections.findIndex((entry) => entry.id === connection.id);
    if (existingIndex >= 0) {
      project.mapConnections[existingIndex] = connection;
      return;
    }
    project.mapConnections.push(connection);
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

/** 맵 select 는 이름이 길어 두 칸을 다 쓴다 — 좁은 칸에 넣으면 "민." 으로 잘린다. */
function spanningLabel(text: string, control: HTMLElement): HTMLElement {
  return el("label", {
    class: "event-page-movement-label event-page-map-link-wide",
    children: [el("span", { text }), control],
  });
}

function numberValue(input: HTMLInputElement): number {
  return Math.max(0, Math.trunc(Number(input.value) || 0));
}

function mapLabel(mapId: MapId): string {
  return store.getCurrent().maps[mapId]?.name ?? mapId;
}
