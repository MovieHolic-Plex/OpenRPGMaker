// panels/structureKitInspector.ts
// 데이터베이스 '구조물' 탭의 오른쪽 열 — 읽기 요약과 액션.
// structureKitDbTab.ts 가 865줄까지 자라 렌더와 비즈니스 로직이 뒤엉켰기에 떼어냈다.
// 편집(래스터·부위·AI 메타)은 여기가 아니라 structureKitEditorDialog.ts 가 담당한다 —
// 인스펙터 열은 352px 고정이라 9×8 킷(scale 3 → 432px)이 들어가지 않는다.
//
// 표(structureKitDbTab)가 partKindName·interiorObjectCanvas 를 함께 쓰므로 여기서 내보낸다.
// 의존 방향은 탭 → 인스펙터 한 방향이다(순환 없음).

import { editorState } from "@/editor/editorState";
import { deleteStructureKit, duplicateIntoTileset, renameStructureKit } from "@/editor/harnessSuggestion/structureKitActions";
import { serializeStructureKitFile, structureKitFileName } from "@/editor/harnessSuggestion/structureKitFile";
import { assembledKitCells, renderTileCellsToCanvas } from "@/editor/harnessSuggestion/kitRender";
import {
  paletteStampFromCells,
  paletteStampFromKit,
  structureKitRepeatable,
  structureKitSize,
} from "@/editor/harnessSuggestion/structureKitModel";
import type { InteriorObjectDef } from "@/editor/interiorObjectCatalog";
import {
  INTERIOR_OBJECT_THUMB_BACKGROUND_TILE,
  interiorObjectLayerLabel,
  interiorObjectRoleLabel,
  interiorObjectSnapLabel,
  interiorObjectThemeLabels,
} from "@/editor/panels/structureKitDbSources";
import { aiRoleLabel, openStructureKitEditor } from "@/editor/panels/structureKitEditorDialog";
import { store } from "@/project/store";
import type {
  StructureKitAiMeta,
  StructureKitDef,
  StructureKitLearnedFrom,
  StructureKitPart,
  StructureKitPartKind,
  TilesetDef,
} from "@/project/types";
import { downloadBlob } from "@/util/downloadBlob";
import { el } from "@/util/dom";
import { toast } from "@/util/toast";

/** 인스펙터가 강조 중인 부위. 탭 세션이 아니라 여기서 들고 있는다. */
let selectedPartId: string | null = null;

export function setInspectorSelectedPartId(id: string | null): void {
  selectedPartId = id;
}

export function interiorObjectCanvas(tileset: TilesetDef, object: InteriorObjectDef, scale: number): HTMLCanvasElement {
  return renderTileCellsToCanvas({
    tileset,
    widthTiles: Math.max(1, object.width),
    heightTiles: Math.max(1, object.height),
    cells: object.cells,
    scale,
    backgroundTile: INTERIOR_OBJECT_THUMB_BACKGROUND_TILE,
  });
}

/** 실내 오브젝트 인스펙터 — 카탈로그는 프로젝트 데이터가 아니라 코드문이라 이름 변경·삭제가 없다. */
export function renderObjectInspector(
  tileset: TilesetDef,
  object: InteriorObjectDef,
  refresh: () => void,
  rerender: () => void,
): HTMLElement {
  const themeLabels = interiorObjectThemeLabels(object);
  const canvas = interiorObjectCanvas(tileset, object, 3);
  canvas.className = "structure-kit-raster-canvas";
  canvas.dataset.testid = `structure-kit-object-unit-${object.id}`;

  return el("div", {
    class: "structure-kit-inspector",
    dataset: { testid: `structure-kit-inspector-${object.id}` },
    children: [
      el("div", { class: "structure-kit-inspector-title", text: object.label }),
      el("div", {
        class: "structure-kit-inspector-meta",
        text: `${object.width}×${object.height} · ${interiorObjectLayerLabel(object.layer)} · ${tileset.name}`,
      }),
      el("div", {
        class: "structure-kit-raster-wrap",
        dataset: { testid: "structure-kit-raster-wrap" },
        children: [canvas],
      }),
      el("div", {
        class: "structure-kit-object-facts",
        children: [
          objectFact("역할", interiorObjectRoleLabel(object)),
          objectFact("레이어", interiorObjectLayerLabel(object.layer)),
          objectFact("배치 규약", interiorObjectSnapLabel(object.snap)),
          objectFact("사용 테마", themeLabels.length > 0 ? themeLabels.join(", ") : "없음"),
        ],
      }),
      el("div", {
        class: "structure-kit-actions",
        children: [
          el("button", {
            class: "btn",
            attrs: { type: "button" },
            text: "팔레트에서 쓰기",
            dataset: { testid: `structure-kit-object-use-${object.id}` },
            on: {
              click: () => {
                editorState.set({
                  activePaletteStamp: paletteStampFromCells({
                    cells: object.cells.map((cell) => ({ ...cell })),
                    width: object.width,
                    height: object.height,
                    kitId: object.id,
                  }),
                  tool: "paint",
                });
                toast(`'${object.label}'을 브러시로 선택했습니다`, "ok");
              },
            },
          }),
          el("button", {
            class: "btn primary",
            attrs: { type: "button" },
            text: "내 구조물로 복제",
            dataset: { testid: `structure-kit-duplicate-${object.id}` },
            on: {
              click: () => {
                const copy = duplicateIntoTileset(tileset.id, object);
                toast(`'${copy.name}' — 사본은 그림만 가져옵니다. AI 실내 방 채우기는 원본 카탈로그만 씁니다.`, "info");
                rerender();
                refresh();
              },
            },
          }),
        ],
      }),
      el("p", {
        class: "structure-kit-quiet",
        dataset: { testid: "structure-kit-object-hint" },
        text: "실내 오브젝트는 코드로 관리되는 카탈로그입니다 — 고치려면 [내 구조물로 복제]를 쓰세요.",
      }),
    ],
  });
}

function objectFact(label: string, value: string): HTMLElement {
  return el("div", {
    class: "structure-kit-object-fact",
    children: [
      el("span", { class: "structure-kit-object-fact-label", text: label }),
      el("span", { class: "structure-kit-object-fact-value", text: value }),
    ],
  });
}

export function partKindName(kind: StructureKitPartKind): string {
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

/** 계보 표시 — 편집 잠금과 무관한 순수 표시값. */
function learnedFromLabel(learnedFrom: StructureKitLearnedFrom): string {
  switch (learnedFrom) {
    case "user-paint":
      return "붓질에서 학습";
    case "builtin-parametric":
      return "내장 파라메트릭";
    case "db-authored":
      return "데이터베이스에서 작성";
  }
}

/** 인스펙터 열(352px)에 한 줄로 들어가도록 첫 줄만 자른다 — 나머지는 CSS ellipsis 가 받는다. */
function firstLineForColumn(text: string): string {
  const line = text.split("\n")[0]?.trim() ?? "";
  return line.length > 48 ? `${line.slice(0, 47)}…` : line;
}

/**
 * §5.3 이 요구하는 AI 메타 요약 — 설명 첫 줄 · 분류 · 반복 여부 · 미승인 배지.
 * ai 가 아예 없으면 빈 블록을 그리지 않고 그 사실을 말하는 한 줄만 둔다.
 * 반복 여부는 structureKitRepeatable() 로 구해 AI 가 실제로 받는 값과 어긋나지 않게 한다.
 */
function renderAiSummary(kit: StructureKitDef): HTMLElement {
  const ai: StructureKitAiMeta | undefined = kit.ai;
  if (!ai) {
    return el("p", {
      class: "structure-kit-quiet",
      dataset: { testid: "structure-kit-ai-summary" },
      text: "AI 메타가 아직 없습니다.",
    });
  }

  const repeatable = structureKitRepeatable(kit);
  const descLine = firstLineForColumn(ai.description);

  return el("div", {
    class: "structure-kit-ai-summary",
    dataset: { testid: "structure-kit-ai-summary" },
    children: [
      el("div", {
        class: "structure-kit-ai-summary-badges",
        children: [
          el("span", { class: "structure-kit-part-badge", text: repeatable ? "반복 가능" : "한 채 완결" }),
          ...(ai.role ? [el("span", { class: "structure-kit-part-badge teal", text: aiRoleLabel(ai.role) })] : []),
          ...(ai.origin !== "user"
            ? [el("span", {
                class: "structure-kit-editor-ai-badge",
                dataset: { testid: "structure-kit-ai-unapproved" },
                text: "미승인",
              })]
            : []),
        ],
      }),
      ...(descLine ? [el("p", { class: "structure-kit-quiet structure-kit-ai-summary-desc", text: descLine })] : []),
    ],
  });
}

export function renderInspector(
  tileset: TilesetDef,
  kit: StructureKitDef,
  editable: boolean,
  refresh: () => void,
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
        attrs: editable ? { type: "text" } : { type: "text", disabled: "" },
        dataset: { testid: `structure-kit-db-name-${kit.id}` },
        on: editable
          ? {
              change: (event: Event) => {
                const target = event.currentTarget;
                if (!(target instanceof HTMLInputElement)) return;
                renameStructureKit(tileset.id, kit.id, target.value);
                rerender();
                refresh();
              },
            }
          : undefined,
      }),
    ],
  });
  inspector.append(nameField);

  // 메타 정보
  const sourceLabel = learnedFromLabel(kit.learnedFrom);
  inspector.append(
    el("div", {
      class: "structure-kit-inspector-meta",
      text: `${size.width}×${size.height} · ${tileset.name} · ${sourceLabel}`,
    })
  );

  inspector.append(renderAiSummary(kit));

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
    const isSelected = part.id === selectedPartId;
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
                  refresh();
                },
              },
            }),
          ],
        }),
      ],
      on: {
        click: () => {
          selectedPartId = part.id;
          refresh();
        },
      },
    });
    partsList.append(partItem);
  });
  inspector.append(partsList);

  // 문에서 입구 추정 버튼 — autoEstimateEntranceParts 는 kind === "section" 킷에서만 결과를
  // 낼 수 있는데 내장 앨범 행은 전부 읽기 전용이라, editable 이 아니면 누를 수 있어도
  // "문 타일을 찾지 못했습니다" 만 뜨는 죽은 버튼이 된다. 편집·복제·내보내기·삭제와 같은 축으로 가른다.
  if (editable) {
    inspector.append(
      el("button", {
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
            refresh();
          },
        },
      }),
    );
  }

  inspector.append(
    el("p", {
      class: "structure-kit-quiet",
      text: "흰 점이 워프 칸입니다.",
    })
  );

  // 하단 액션 버튼들 (편집, 복제, 삭제 — 프로젝트 데이터가 아니면 편집·삭제 제외, 팔레트에서 쓰기)
  const actions = el("div", {
    class: "structure-kit-actions",
    children: [
      ...(editable
        ? [
            el("button", {
              class: "btn primary",
              attrs: { type: "button" },
              text: "편집",
              dataset: { testid: `structure-kit-edit-${kit.id}` },
              on: {
                click: () => {
                  openStructureKitEditor(tileset.id, kit.id, () => {
                    rerender();
                    refresh();
                  });
                },
              },
            }),
          ]
        : []),
      el("button", {
        class: editable ? "btn" : "btn primary",
        attrs: { type: "button" },
        text: editable ? "복제" : "내 구조물로 복제",
        dataset: { testid: `structure-kit-duplicate-${kit.id}` },
        on: {
          click: () => {
            const copy = duplicateIntoTileset(tileset.id, kit);
            toast(`'${copy.name}' 을 만들었습니다`, "ok");
            rerender();
            refresh();
          },
        },
      }),
      ...(editable
        ? [
            el("button", {
              class: "btn",
              attrs: { type: "button" },
              text: "내보내기",
              dataset: { testid: `structure-kit-export-${kit.id}` },
              on: {
                click: () => {
                  const text = serializeStructureKitFile(tileset, [kit], new Date().toISOString());
                  downloadBlob(
                    new Blob([text], { type: "application/json" }),
                    structureKitFileName(tileset.name, [kit]),
                  );
                  toast(`'${kit.name ?? "구조물"}'을 내보냈습니다`, "ok");
                },
              },
            }),
          ]
        : []),
      ...(editable
        ? [
            el("button", {
              class: "btn ghost structure-kit-delete",
              attrs: { type: "button" },
              text: "삭제",
              dataset: { testid: `structure-kit-db-delete-${kit.id}` },
              on: {
                click: () => {
                  deleteStructureKit(tileset.id, kit.id);
                  toast(`'${kit.name ?? "구조물"}' 삭제`, "info");
                  setInspectorSelectedPartId(null);
                  rerender();
                  refresh();
                },
              },
            }),
          ]
        : []),
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
    ],
  });
  inspector.append(actions);

  if (!editable) {
    inspector.append(
      el("p", {
        class: "structure-kit-quiet",
        dataset: { testid: "structure-kit-builtin-hint" },
        text: "이 목록은 코드로 관리됩니다 — 편집하려면 [내 구조물로 복제]를 쓰세요.",
      })
    );
  }

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
