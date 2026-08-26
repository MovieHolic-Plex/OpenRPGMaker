// 동료(DB 액터) 이미지 리치 표면 공유 헬퍼.
// - 초상화: faceset 한 칸 우선, 없으면 charset idle-front 한 칸(시트 전체 금지 계약 유지).
// - 명령 피커 탭2 상단 로스터와 따라오기 프리셋 칩이 같은 렌더러를 쓴다.
import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { RESOURCE_SLICING } from "@/assets/resourceSlicing";
import type { ActorRecord, Project } from "@/project/types";
import { clearChildren, el } from "@/util/dom";

type PortraitIcon =
  | {
      readonly kind: "sheet";
      readonly url: string;
      readonly cellWidth: number;
      readonly cellHeight: number;
      readonly columns: number;
      readonly index: number;
      readonly sheetWidth: number;
      readonly sheetHeight: number;
    }
  | { readonly kind: "none" };

function companionPortrait(project: Pick<Project, "assets">, actor: ActorRecord): PortraitIcon {
  const faceUrl = resolveAssetResourceUrl(actor.faceResourceId, { project });
  const slicing = RESOURCE_SLICING.faceset;
  if (faceUrl !== null) {
    return {
      kind: "sheet",
      url: faceUrl,
      cellWidth: slicing.cellWidth,
      cellHeight: slicing.cellHeight,
      columns: slicing.columns,
      index: clampIndex(actor.faceIndex, slicing.columns * slicing.rows - 1),
      sheetWidth: slicing.sheetWidth,
      sheetHeight: slicing.sheetHeight,
    };
  }
  const charsetUrl = resolveAssetResourceUrl(actor.characterResourceId, { project });
  if (charsetUrl === null) return { kind: "none" };
  // charset 시트 가로열(cell 24×32 기준) 기준 characterIndex 번째 슬롯의 idle-front 한 칸.
  return {
    kind: "sheet",
    url: charsetUrl,
    cellWidth: 24,
    cellHeight: 32,
    columns: 4,
    index: clampIndex(actor.characterIndex, 7),
    sheetWidth: 96,
    sheetHeight: 128,
  };
}

/** 초상화 크롭 요소. 배경 이미지 계약(background-image: url(...))을 e2e가 본다. */
export function companionPortraitElement(
  project: Pick<Project, "assets">,
  actor: ActorRecord,
  options: { readonly sizePx: number; readonly testidPrefix: string },
): HTMLElement {
  const thumb = el("span", {
    class: "companion-portrait",
    attrs: { role: "img", "aria-label": `${actor.name} 초상` },
    dataset: { testid: `${options.testidPrefix}-${actor.id}` },
  }) as HTMLElement;
  const icon = companionPortrait(project, actor);
  if (icon.kind === "none") {
    thumb.textContent = Array.from(actor.name.trim())[0] ?? "?";
    thumb.classList.add("is-initial");
    return thumb;
  }
  const scale = options.sizePx / icon.cellWidth;
  const col = icon.index % icon.columns;
  const row = Math.floor(icon.index / icon.columns);
  thumb.style.setProperty("background-image", `url("${icon.url}")`);
  thumb.style.setProperty("background-repeat", "no-repeat");
  thumb.style.setProperty(
    "background-size",
    `${icon.sheetWidth * scale}px ${icon.sheetHeight * scale}px`,
  );
  thumb.style.setProperty(
    "background-position",
    `-${col * icon.cellWidth * scale}px -${row * icon.cellHeight * scale}px`,
  );
  thumb.style.setProperty("width", `${options.sizePx}px`);
  thumb.style.setProperty("height", `${options.sizePx}px`);
  return thumb;
}

/** 탭2 상단 DB 동료 전원 로스터. 카드 클릭은 호출자가 정한다(onSelect). */
export function renderCompanionRoster(
  project: Project,
  options: { readonly onSelect?: (command: { readonly kind: "addFollower"; readonly actorId: string }) => void } = {},
): HTMLElement {
  const section = el("section", {
    class: "event-command-picker-companions",
    attrs: { "aria-label": "데이터베이스 동료" },
    dataset: { testid: "companion-roster" },
  });
  section.append(
    el("h3", { class: "event-command-picker-companions-title", text: "동료 목록" }),
  );
  const grid = el("div", {
    class: "event-command-picker-companions-grid",
    dataset: { testid: "companion-roster-grid" },
  });
  for (const actor of project.database.actors) {
    const card = el("button", {
      class: "companion-card",
      attrs: { type: "button", title: `${actor.name} 동행 명령 넣기` },
      dataset: { testid: `companion-card-${actor.id}` },
      children: [
        companionPortraitElement(project, actor, { sizePx: 36, testidPrefix: "companion-thumb" }),
        el("span", { class: "companion-card-name", text: actor.name }),
      ],
      on: options.onSelect
        ? {
            click: () =>
              options.onSelect?.({
                kind: "addFollower",
                actorId: actor.id,
              }),
          }
        : undefined,
    }) as HTMLButtonElement;
    grid.append(card);
  }
  if (project.database.actors.length === 0) {
    grid.append(
      el("span", { class: "empty-hint", text: "데이터베이스에 등록된 동료가 없습니다." }),
    );
  }
  section.append(grid);
  return section;
}

/** 렌더러를 갱신하는 도우미 — 프리셋 바처럼 DOM만 다시 그리는 호스트에서 사용. */
export function refreshInto(host: HTMLElement, render: () => HTMLElement): void {
  clearChildren(host);
  host.append(render());
}

function clampIndex(value: number | undefined, max: number): number {
  if (value === undefined || !Number.isFinite(value)) return 0;
  return Math.min(max, Math.max(0, Math.trunc(value)));
}
