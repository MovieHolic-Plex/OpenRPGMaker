// panels/structureKitInspector.ts
// 데이터베이스 '구조물' 탭의 오른쪽 열 — 읽기 요약과 액션.
// 부위를 고치는 일(삭제·종류 변경·문에서 추정)은 전부 편집기로 옮겼다 —
// 이 열에는 부위 목록의 '읽기'만 남는다.
// structureKitDbTab.ts 가 865줄까지 자라 렌더와 비즈니스 로직이 뒤엉켰기에 떼어냈다.
// 편집(래스터·부위·AI 메타)은 여기가 아니라 structureKitEditorDialog.ts 가 담당한다 —
// 인스펙터 열은 352px 고정이라 9×8 킷(scale 3 → 432px)이 들어가지 않는다.
//
// 표(structureKitDbTab)가 partKindName·interiorObjectCanvas 를 함께 쓰므로 여기서 내보낸다.
// 의존 방향은 탭 → 인스펙터 한 방향이다(순환 없음).

import { editorState } from "@/editor/editorState";
import { duplicateIntoTileset, renameStructureKit } from "@/editor/harnessSuggestion/structureKitActions";
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
import { aiRoleLabel } from "@/editor/panels/structureKitEditorDialog";
import type {
  StructureKitAiMeta,
  StructureKitDef,
  StructureKitLearnedFrom,
  StructureKitPartKind,
  TilesetDef,
} from "@/project/types";
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

/**
 * 사본을 만든 뒤 그 사본으로 선택을 옮기고 편집기까지 열어 주는 콜백.
 * 탭(structureKitDbTab)이 넘겨준다 — 세션(선택·원본 칩·검색어)은 그쪽 모듈 프라이빗이라
 * 여기서 직접 손댈 수 없고, 손대면 의존 방향(탭 → 인스펙터)이 순환한다.
 */
export type EnterKitEditor = (kitId: string) => void;

/** 실내 오브젝트 인스펙터 — 카탈로그는 프로젝트 데이터가 아니라 코드문이라 이름 변경·삭제가 없다. */
export function renderObjectInspector(
  tileset: TilesetDef,
  object: InteriorObjectDef,
  enterEditor: EnterKitEditor,
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
                // 목록만 다시 그리면 선택이 원본에 남아 "복제했는데 아무 일도 안 남" 이 된다.
                enterEditor(copy.id);
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
  rerender: () => void,
  enterEditor: EnterKitEditor,
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

  // 부위 목록 — 읽기 전용이다. 부위를 지우고 종류를 바꾸고 문에서 추정하는 일은
  // 전부 편집기(structureKitEditorDialog)로 모았다. 만드는 자리와 고치는 자리가
  // 갈려 있으면 사용자가 어디를 봐야 할지 모른다.
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

  inspector.append(
    el("p", {
      class: "structure-kit-quiet",
      text: "흰 점이 워프 칸입니다.",
    })
  );

  // 하단 액션 줄은 세 개까지만 둔다.
  // [내보내기]·[삭제]는 표 행의 hover 아이콘으로 옮겼다 — 다섯 개를 한 줄에 넣으면
  // 352px 열에서 넘친다. flex-wrap 으로 두 단을 만들면 인스펙터가 더 높아져
  // 래스터가 밀려나므로, 해법은 감싸기가 아니라 개수 줄이기다.
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
              on: { click: () => enterEditor(kit.id) },
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
            // 선택을 사본으로 옮기지 않으면 인스펙터가 계속 원본(편집 불가)을 본다 —
            // 사용자에게는 "복제했는데 아무 일도 안 남" 으로 보인다.
            enterEditor(copy.id);
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
