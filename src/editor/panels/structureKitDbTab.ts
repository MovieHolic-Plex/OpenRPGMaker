// panels/structureKitDbTab.ts
// 데이터베이스 '구조물' 탭 — 타일셋 앨범 + 표 + 인스펙터 래스터.
// IA 규약:
// 1. 타일셋 레일은 필터가 아니라 앨범. 기본 앨범은 현재 맵 타일셋(editorState.currentMapId).
// 2. 표에는 선택된 타일셋의 구조물만 표시.
// 3. 빈 상태 정확한 카피: "이 타일셋에는 아직 구조물이 없습니다."
// 4. 인스펙터: 이름, 래스터, 부위 목록(인스턴스 번호), 문에서 입구 추정, 지금 저장(filled primary), 팔레트에서 쓰기, 삭제.

import { editorState } from "@/editor/editorState";
import { deleteStructureKit, renameStructureKit } from "@/editor/harnessSuggestion/structureKitActions";
import { assembledKitCells, renderTileCellsToCanvas } from "@/editor/harnessSuggestion/kitRender";
import { paletteStampFromKit, structureKitSize } from "@/editor/harnessSuggestion/structureKitModel";
import { store } from "@/project/store";
import type { StructureKitDef, StructureKitPart, StructureKitPartKind, TilesetDef } from "@/project/types";
import { el } from "@/util/dom";
import { toast } from "@/util/toast";

interface ActiveSessionState {
  tilesetId: string | null;
  selectedKitId: string | null;
  selectedPartId: string | null;
  searchQuery: string;
}

const session: ActiveSessionState = {
  tilesetId: null,
  selectedKitId: null,
  selectedPartId: null,
  searchQuery: "",
};

export function resetStructureKitsTabSession(): void {
  session.tilesetId = null;
  session.selectedKitId = null;
  session.selectedPartId = null;
  session.searchQuery = "";
}

export function renderStructureKitsTab(host: HTMLElement, rerender: () => void): void {
  host.dataset.testid = "db-detail-form";
  const current = store.getCurrent();
  const tilesets = Object.values(current.tilesets);

  // 기본 앨범 결정: 현재 맵 타일셋
  if (!session.tilesetId || !current.tilesets[session.tilesetId]) {
    const currentMapId = editorState.get().currentMapId ?? current.startMapId;
    const currentMap = current.maps[currentMapId];
    const defaultTilesetId = currentMap?.tilesetId ?? tilesets[0]?.id ?? "";
    session.tilesetId = defaultTilesetId;
  }

  const activeTileset = current.tilesets[session.tilesetId] ?? tilesets[0];
  const activeKits = activeTileset?.structureKits ?? [];

  // 선택된 kit 유효성 확인
  if (activeKits.length > 0) {
    if (!session.selectedKitId || !activeKits.some((k) => k.id === session.selectedKitId)) {
      session.selectedKitId = activeKits[0]!.id;
    }
  } else {
    session.selectedKitId = null;
  }

  const selectedKit = activeKits.find((k) => k.id === session.selectedKitId) ?? null;

  // 헤더
  host.append(
    el("h3", { text: "구조물", dataset: { testid: "structure-kit-heading" } }),
    el("p", { text: "타일셋에 묶입니다. 한 타일셋의 구조물은 다른 타일셋에 섞이지 않습니다." })
  );

  const workspace = el("div", {
    class: "structure-kit-album-workspace",
    dataset: { testid: "structure-kit-album-workspace" },
  });
  host.append(workspace);

  // 1. 타일셋 레일 (앨범)
  const rail = el("div", {
    class: "structure-kit-album-rail",
    dataset: { testid: "structure-kit-album-rail" },
    children: [
      el("div", { class: "structure-kit-album-rail-title", text: "타일셋" }),
    ],
  });

  for (const tileset of tilesets) {
    const count = (tileset.structureKits ?? []).length;
    const isActive = tileset.id === activeTileset?.id;
    const item = el("button", {
      class: `structure-kit-album-item${isActive ? " active" : ""}${count === 0 ? " zero" : ""}`,
      attrs: { type: "button" },
      dataset: { testid: `structure-kit-tileset-${tileset.id}` },
      children: [
        el("span", { text: tileset.name }),
        el("span", { class: "structure-kit-album-count", text: String(count) }),
      ],
      on: {
        click: () => {
          session.tilesetId = tileset.id;
          session.selectedKitId = null;
          session.selectedPartId = null;
          refresh(host, rerender);
        },
      },
    });
    rail.append(item);
  }
  workspace.append(rail);

  // 2. 표 (가운데 열)
  const tableCol = el("div", { class: "structure-kit-table-col" });

  const tools = el("div", {
    class: "structure-kit-tools",
    children: [
      el("input", {
        class: "structure-kit-search",
        attrs: { type: "search", placeholder: "이름, 부위 검색" },
        value: session.searchQuery,
        on: {
          input: (event) => {
            const target = event.currentTarget;
            if (!(target instanceof HTMLInputElement)) return;
            session.searchQuery = target.value;
            refresh(host, rerender);
          },
        },
      }),
      el("div", {
        class: "structure-kit-hint-chip",
        children: [
          el("span", { text: "맵에서 영역 선택 → " }),
          el("b", { text: "구조물로 저장" }),
        ],
      }),
    ],
  });
  tableCol.append(tools);

  // 필터링된 키 목록
  const query = session.searchQuery.trim().toLowerCase();
  const visibleKits = activeKits.filter((kit) => {
    if (!query) return true;
    if ((kit.name ?? "").toLowerCase().includes(query)) return true;
    if (kit.parts?.some((p) => partKindName(p.kind).includes(query) || (p.note ?? "").toLowerCase().includes(query))) return true;
    return false;
  });

  if (activeKits.length === 0) {
    const emptyWrap = el("div", {
      class: "structure-kit-empty-wrap",
      dataset: { testid: "structure-kit-db-empty" },
      children: [
        el("strong", { text: "이 타일셋에는 아직 구조물이 없습니다." }),
        el("p", {
          class: "structure-kit-quiet",
          text: "맵에서 타일 영역을 선택한 후 [구조물로 저장]을 누르면 이 앨범에 추가됩니다.",
        }),
      ],
    });
    tableCol.append(emptyWrap);
  } else {
    const tableWrap = el("div", { class: "structure-kit-table-wrap" });
    const table = el("table", { class: "structure-kit-table" });
    table.append(
      el("thead", {
        children: [
          el("tr", {
            children: [
              el("th", { attrs: { style: "width: 50%;" }, text: "이름" }),
              el("th", { text: "크기" }),
              el("th", { text: "부위" }),
            ],
          }),
        ],
      })
    );

    const tbody = el("tbody");
    for (const kit of visibleKits) {
      const isSelected = kit.id === selectedKit?.id;
      const size = structureKitSize(kit);
      const row = el("tr", {
        class: `structure-kit-row${isSelected ? " active" : ""}`,
        dataset: { testid: `structure-kit-db-${kit.id}` },
        children: [
          el("td", {
            children: [
              el("div", {
                class: "structure-kit-row-name",
                children: [
                  el("div", {
                    class: "structure-kit-row-thumb",
                    children: [
                      renderTileCellsToCanvas({
                        tileset: activeTileset,
                        widthTiles: size.width,
                        heightTiles: size.height,
                        cells: assembledKitCells(kit, size.width),
                        scale: 1,
                      }),
                    ],
                  }),
                  el("span", { text: kit.name ?? "구조물" }),
                ],
              }),
            ],
          }),
          el("td", {
            class: "structure-kit-row-meta",
            text: `${size.width}×${size.height}`,
          }),
          el("td", {
            children: renderPartBadges(kit.parts),
          }),
        ],
        on: {
          click: () => {
            session.selectedKitId = kit.id;
            session.selectedPartId = null;
            refresh(host, rerender);
          },
        },
      });
      tbody.append(row);
    }
    table.append(tbody);
    tableWrap.append(table);
    tableCol.append(tableWrap);

    const footer = el("div", {
      class: "structure-kit-footer",
      children: [
        el("span", { text: `${visibleKits.length}개` }),
      ],
    });
    tableCol.append(footer);
  }

  workspace.append(tableCol);

  // 3. 인스펙터 (오른쪽 열)
  if (selectedKit && activeTileset) {
    const inspector = renderInspector(activeTileset, selectedKit, host, rerender);
    workspace.append(inspector);
  }
}

function refresh(host: HTMLElement, rerender: () => void): void {
  while (host.firstChild) {
    host.removeChild(host.firstChild);
  }
  renderStructureKitsTab(host, rerender);
}

function renderPartBadges(parts?: StructureKitPart[]): HTMLElement[] {
  if (!parts || parts.length === 0) {
    return [el("span", { class: "structure-kit-part-badge none", text: "부위 없음" })];
  }
  const badges: HTMLElement[] = [];
  const countByKind = new Map<StructureKitPartKind, number>();
  for (const part of parts) {
    countByKind.set(part.kind, (countByKind.get(part.kind) ?? 0) + 1);
  }

  for (const [kind, count] of countByKind) {
    const badgeText = count > 1 ? `${partKindName(kind)} ×${count}` : partKindName(kind);
    const colorClass = kind === "window" ? "teal" : kind === "anchor" ? "gray" : "";
    badges.push(el("span", { class: `structure-kit-part-badge ${colorClass}`.trim(), text: badgeText }));
  }
  return badges;
}

function partKindName(kind: StructureKitPartKind): string {
  switch (kind) {
    case "entrance":
      return "입구";
    case "window":
      return "창문";
    case "sign":
      return "간판";
    case "anchor":
      return "자리";
  }
}

function renderInspector(
  tileset: TilesetDef,
  kit: StructureKitDef,
  host: HTMLElement,
  rerender: () => void
): HTMLElement {
  const size = structureKitSize(kit);
  const inspector = el("div", {
    class: "structure-kit-inspector",
    dataset: { testid: `structure-kit-inspector-${kit.id}` },
  });

  inspector.append(
    el("div", { class: "structure-kit-inspector-title", text: kit.name ?? "구조물" })
  );

  // 이름 필드
  const nameField = el("div", {
    class: "structure-kit-field",
    children: [
      el("label", { text: "이름" }),
      el("input", {
        value: kit.name ?? "구조물",
        attrs: { type: "text" },
        dataset: { testid: `structure-kit-db-name-${kit.id}` },
        on: {
          change: (event) => {
            const target = event.currentTarget;
            if (!(target instanceof HTMLInputElement)) return;
            renameStructureKit(tileset.id, kit.id, target.value);
            rerender();
            refresh(host, rerender);
          },
        },
      }),
    ],
  });
  inspector.append(nameField);

  // 메타 정보
  const sourceLabel = kit.learnedFrom === "user-paint" ? "붓질에서 학습" : "내장 파라메트릭";
  inspector.append(
    el("div", {
      class: "structure-kit-inspector-meta",
      text: `${size.width}×${size.height} · ${tileset.name} · ${sourceLabel}`,
    })
  );

  // 래스터 뷰 + 부위 오버레이
  const rasterWrap = el("div", {
    class: "structure-kit-raster-wrap",
    dataset: { testid: "structure-kit-raster-wrap" },
  });

  const canvas = renderTileCellsToCanvas({
    tileset,
    widthTiles: size.width,
    heightTiles: size.height,
    cells: assembledKitCells(kit, size.width),
    scale: 3,
  });
  canvas.className = "structure-kit-raster-canvas";
  canvas.dataset.testid = `structure-kit-db-unit-${kit.id}`;
  rasterWrap.append(canvas);

  // 부위 오버레이 표시
  const parts = kit.parts ?? [];
  parts.forEach((part, index) => {
    const leftPercent = (part.dx / size.width) * 100;
    const topPercent = (part.dy / size.height) * 100;
    const widthPercent = (part.w / size.width) * 100;
    const heightPercent = (part.h / size.height) * 100;

    const overlay = el("div", {
      class: `structure-kit-overlay ${part.kind}`,
      attrs: {
        style: `left:${leftPercent}%;top:${topPercent}%;width:${widthPercent}%;height:${heightPercent}%;`,
      },
      children: [
        el("span", { class: "structure-kit-overlay-badge", text: String(index + 1) }),
        ...(part.kind === "entrance"
          ? [el("span", { class: "structure-kit-overlay-warp-pin" })]
          : []),
      ],
    });
    rasterWrap.append(overlay);
  });

  inspector.append(rasterWrap);

  // 부위 목록
  const partsList = el("div", { class: "structure-kit-parts-list" });
  parts.forEach((part, index) => {
    const isSelected = part.id === session.selectedPartId;
    const rangeText = part.kind === "entrance"
      ? `문 ${part.w}×${Math.max(1, part.h - 1)} + 앞 1칸`
      : `(${part.dx},${part.dy}) ${part.w}×${part.h}`;

    const partItem = el("div", {
      class: `structure-kit-part-item${isSelected ? " selected" : ""}`,
      children: [
        el("div", {
          class: "structure-kit-part-top",
          children: [
            el("span", { class: `structure-kit-part-dot ${part.kind}`, text: String(index + 1) }),
            el("span", { class: "structure-kit-part-kind", text: partKindName(part.kind) }),
            el("span", { class: "structure-kit-part-range", text: rangeText }),
          ],
        }),
        ...(part.note ? [el("div", { class: "structure-kit-part-note", text: part.note })] : []),
        el("div", {
          class: "structure-kit-part-actions",
          children: [
            el("button", {
              class: "structure-kit-part-delete-btn",
              attrs: { type: "button" },
              text: "부위 삭제",
              on: {
                click: () => {
                  const updatedParts = (kit.parts ?? []).filter((p) => p.id !== part.id);
                  saveKitParts(tileset.id, kit, updatedParts);
                  rerender();
                  refresh(host, rerender);
                },
              },
            }),
          ],
        }),
      ],
      on: {
        click: () => {
          session.selectedPartId = part.id;
          refresh(host, rerender);
        },
      },
    });
    partsList.append(partItem);
  });
  inspector.append(partsList);

  // 문에서 입구 추정 버튼
  const estimateBtn = el("button", {
    class: "btn small structure-kit-estimate",
    attrs: { type: "button" },
    text: "문에서 입구 추정",
    dataset: { testid: "structure-kit-estimate-entrance" },
    on: {
      click: () => {
        const estimated = autoEstimateEntranceParts(kit);
        if (estimated.length === 0) {
          toast("문 타일을 찾지 못했습니다.", "info");
          return;
        }
        const merged = [...(kit.parts ?? []).filter((p) => p.kind !== "entrance"), ...estimated];
        saveKitParts(tileset.id, kit, merged);
        toast(`입구 ${estimated.length}곳 추정 완료`, "ok");
        rerender();
        refresh(host, rerender);
      },
    },
  });
  inspector.append(estimateBtn);

  inspector.append(
    el("p", {
      class: "structure-kit-quiet",
      text: "이 래스터를 드래그하면 부위가 붙습니다. 흰 점이 워프 칸입니다.",
    })
  );

  // 하단 액션 버튼들 (지금 저장, 팔레트에서 쓰기, 삭제)
  const actions = el("div", {
    class: "structure-kit-actions",
    children: [
      el("button", {
        class: "btn primary",
        attrs: { type: "button" },
        text: "지금 저장",
        dataset: { testid: "structure-kit-save-now" },
        on: {
          click: () => {
            toast("구조물이 저장되었습니다.", "ok");
            rerender();
          },
        },
      }),
      el("button", {
        class: "btn",
        attrs: { type: "button" },
        text: "팔레트에서 쓰기",
        dataset: { testid: `structure-kit-db-use-${kit.id}` },
        on: {
          click: () => {
            editorState.set({
              activePaletteStamp: paletteStampFromKit(kit),
              tool: "paint",
            });
            toast(`'${kit.name ?? "구조물"}'을 브러시로 선택했습니다`, "ok");
          },
        },
      }),
      el("button", {
        class: "btn ghost structure-kit-delete",
        attrs: { type: "button" },
        text: "삭제",
        dataset: { testid: `structure-kit-db-delete-${kit.id}` },
        on: {
          click: () => {
            deleteStructureKit(tileset.id, kit.id);
            toast(`'${kit.name ?? "구조물"}' 삭제`, "info");
            session.selectedKitId = null;
            session.selectedPartId = null;
            rerender();
            refresh(host, rerender);
          },
        },
      }),
    ],
  });
  inspector.append(actions);

  return inspector;
}

function saveKitParts(tilesetId: string, kit: StructureKitDef, parts: StructureKitPart[]): void {
  const current = store.getCurrent();
  const tileset = current.tilesets[tilesetId];
  if (!tileset || !tileset.structureKits) return;

  const nextKits = tileset.structureKits.map((k) => (k.id === kit.id ? { ...k, parts } : k));
  store.update((proj) => {
    const targetTileset = proj.tilesets[tilesetId];
    if (targetTileset) {
      targetTileset.structureKits = nextKits;
    }
  });
}

function autoEstimateEntranceParts(kit: StructureKitDef): StructureKitPart[] {
  const estimated: StructureKitPart[] = [];
  // 문 타일 id 예: 116, 146, 360 등 (RM2k3 도어 패턴)
  const DOOR_TILES = new Set([116, 146, 117, 147, 360, 361]);

  if (kit.kind === "section") {
    for (let y = 0; y < kit.rows.length; y += 1) {
      const row = kit.rows[y];
      if (!row) continue;
      for (let x = 0; x < kit.width; x += 1) {
        const tile = row.tiles[x] ?? -1;
        const upper = row.upperTiles?.[x] ?? -1;
        if (DOOR_TILES.has(tile) || DOOR_TILES.has(upper)) {
          estimated.push({
            id: `pt_${Date.now()}_${x}_${y}`,
            kind: "entrance",
            dx: x,
            dy: Math.max(0, y - 1),
            w: 1,
            h: 3,
            note: "문 2칸 + 앞 1칸",
          });
        }
      }
    }
  }
  return estimated;
}
