import { field } from "@/editor/panels/databaseControls";
import {
  addAutotileGroup,
  fillAutotileVariantMap,
  removeAutotileGroup,
  seedDefaultAutotileGroups,
  setAutotileVariant,
  updateAutotileGroup,
} from "@/editor/tilesetActions";
import { renderAutotileTemplateWizard } from "@/editor/panels/tilesetAutotileTemplateWizard";
import { autotileGroupsForTileset } from "@/project/defaults/autotileGroups";
import type { EdgeCornerTileSet } from "@/project/defaults/autotileEngine";
import { AUTOTILE_DIR } from "@/project/defaults/autotileEngine";
import type { AutotileGroup, AutotileNeighborhood, TilesetDef } from "@/project/types";
import { el } from "@/util/dom";

// 오토타일 그룹 편집 패널.
// 그룹 추가/삭제, 멤버 타일 지정, 16방향(4비트) 비트마스크→타일 매핑 편집 + 기본값 채우기.

let groupDraftName = "";
// 템플릿 위저드 접힘 상태 — "템플릿에서 만들기" 버튼으로 토글.
let templateWizardOpen = false;

// 기본값 채우기용 9분류 타일 초안(그룹별). EdgeCornerTileSet 는 readonly 이므로 가변 타입으로 보관.
type FillDraft = Partial<Record<keyof EdgeCornerTileSet, number>>;
const fillDrafts = new Map<string, FillDraft>();

const FILL_FIELDS: readonly { key: keyof EdgeCornerTileSet; label: string }[] = [
  { key: "body", label: "몸통" },
  { key: "edgeN", label: "북 변" },
  { key: "edgeS", label: "남 변" },
  { key: "edgeW", label: "서 변" },
  { key: "edgeE", label: "동 변" },
  { key: "cornerNW", label: "북서 모서리" },
  { key: "cornerNE", label: "북동 모서리" },
  { key: "cornerSW", label: "남서 모서리" },
  { key: "cornerSE", label: "남동 모서리" },
];

// 마스크 비트 조합을 사람이 읽는 라벨로. 예: 3 → "N·E".
function maskLabel(mask: number): string {
  const parts: string[] = [];
  if (mask & AUTOTILE_DIR.N) parts.push("N");
  if (mask & AUTOTILE_DIR.E) parts.push("E");
  if (mask & AUTOTILE_DIR.S) parts.push("S");
  if (mask & AUTOTILE_DIR.W) parts.push("W");
  return parts.length > 0 ? parts.join("·") : "(고립)";
}

export function renderAutotileEditorPanel(tileset: TilesetDef, rerender: () => void): HTMLElement {
  const customGroupIds = new Set((tileset.autotileGroups ?? []).map((group) => group.id));
  const groups = autotileGroupsForTileset(tileset);
  return renderFieldset(
    "오토타일 그룹",
    el("div", {
      class: "tileset-autotile-editor",
      dataset: { testid: "tileset-autotile-editor" },
      children: [
        el("div", {
          class: "tileset-autotile-hint",
          text: "지형 타일을 이웃 연결에 따라 자동 변형합니다. 정의가 없으면 내장 흙길/모래 규칙을 사용합니다.",
        }),
        renderAddRow(tileset.id, rerender),
        ...(templateWizardOpen ? [renderAutotileTemplateWizard(tileset, rerender)] : []),
        el("div", {
          class: "tileset-autotile-list",
          children: groups.length > 0
            ? groups.map((group) => renderGroupCard(tileset, group, rerender, !customGroupIds.has(group.id)))
            : [el("div", { class: "tileset-autotile-empty", text: "정의된 오토타일 그룹이 없습니다 (내장 기본값 사용 중)." })],
        }),
      ],
    })
  );
}

function renderAddRow(tilesetId: string, rerender: () => void): HTMLElement {
  const nameInput = el("input", { attrs: { type: "text", placeholder: "그룹 이름" }, value: groupDraftName });
  nameInput.addEventListener("input", () => {
    groupDraftName = nameInput.value;
  });
  return el("div", {
    class: "tileset-autotile-add-row",
    children: [
      field("새 그룹", nameInput),
      el("button", {
        class: "tileset-db-small-button",
        text: "그룹 추가",
        attrs: { type: "button" },
        dataset: { testid: "tileset-autotile-add" },
        on: {
          click: () => {
            addAutotileGroup(tilesetId, groupDraftName);
            groupDraftName = "";
            rerender();
          },
        },
      }),
      el("button", {
        class: "tileset-db-small-button",
        text: "템플릿에서 만들기",
        attrs: { type: "button", title: "앵커 타일 번호 하나로 RM2K 3×4/3×3/3×2/애니 물 템플릿 그룹 생성" },
        dataset: { testid: "autotile-template-open" },
        on: {
          click: () => {
            templateWizardOpen = !templateWizardOpen;
            rerender();
          },
        },
      }),
      el("button", {
        class: "tileset-db-small-button",
        text: "기본 그룹 불러오기",
        attrs: { type: "button", title: "내장 흙길/모래 그룹을 편집 가능한 형태로 추가" },
        dataset: { testid: "tileset-autotile-seed" },
        on: {
          click: () => {
            seedDefaultAutotileGroups(tilesetId);
            rerender();
          },
        },
      }),
    ],
  });
}

function renderGroupCard(tileset: TilesetDef, group: AutotileGroup, rerender: () => void, readOnly: boolean): HTMLElement {
  return el("fieldset", {
    class: `tileset-autotile-group${readOnly ? " readonly" : ""}`,
    dataset: { testid: `tileset-autotile-group-${group.id}` },
    children: [
      el("legend", {
        children: [
          el("span", { text: group.name }),
          ...(readOnly
            ? [el("span", { class: "tileset-autotile-builtin-badge", text: "내장", dataset: { testid: `tileset-autotile-builtin-${group.id}` } })]
            : []),
        ],
      }),
      nameControl(tileset.id, group, rerender, readOnly),
      neighborhoodControl(tileset.id, group, rerender, readOnly),
      tileListControl("멤버 타일", group.memberTileIds, (ids) => {
        updateAutotileGroup(tileset.id, group.id, { memberTileIds: ids });
        rerender();
      }, `tileset-autotile-members-${group.id}`, readOnly),
      tileListControl("연결 타일(선택)", group.connectTileIds ?? [], (ids) => {
        updateAutotileGroup(tileset.id, group.id, { connectTileIds: ids });
        rerender();
      }, `tileset-autotile-connect-${group.id}`, readOnly),
      ...(readOnly ? [el("div", { class: "tileset-autotile-readonly-note", text: "내장 그룹은 기본값 불러오기로 복제한 뒤 편집할 수 있습니다." })] : [renderFillRow(tileset.id, group, rerender)]),
      renderVariantGrid(tileset.id, group, rerender, readOnly),
      ...(readOnly
        ? []
        : [el("button", {
            class: "tileset-db-small-button danger",
            text: "그룹 삭제",
            attrs: { type: "button" },
            dataset: { testid: `tileset-autotile-remove-${group.id}` },
            on: {
              click: () => {
                removeAutotileGroup(tileset.id, group.id);
                fillDrafts.delete(group.id);
                rerender();
              },
            },
          })]),
    ],
  });
}

function nameControl(tilesetId: string, group: AutotileGroup, rerender: () => void, readOnly: boolean): HTMLElement {
  const input = el("input", { attrs: { type: "text" }, value: group.name });
  input.disabled = readOnly;
  input.addEventListener("change", () => {
    if (readOnly) return;
    updateAutotileGroup(tilesetId, group.id, { name: input.value });
    rerender();
  });
  return field("이름", input);
}

function neighborhoodControl(tilesetId: string, group: AutotileGroup, rerender: () => void, readOnly: boolean): HTMLElement {
  const options: readonly AutotileNeighborhood[] = [4, 8];
  const current = group.neighborhood ?? 4;
  const select = el("select", {
    children: options.map((value) =>
      el("option", { text: `${value}방향`, attrs: value === current ? { value: String(value), selected: "true" } : { value: String(value) } })
    ),
  });
  select.disabled = readOnly;
  select.addEventListener("change", () => {
    if (readOnly) return;
    const value = Number(select.value) === 8 ? 8 : 4;
    updateAutotileGroup(tilesetId, group.id, { neighborhood: value });
    rerender();
  });
  return field("이웃 범위", select);
}

// 쉼표/공백 구분 숫자 목록 편집 컨트롤.
function tileListControl(label: string, ids: readonly number[], onChange: (ids: number[]) => void, testid: string, readOnly: boolean): HTMLElement {
  const input = el("input", { attrs: { type: "text", placeholder: "예: 421, 390, 391" }, value: ids.join(", ") });
  input.disabled = readOnly;
  input.dataset.testid = testid;
  input.addEventListener("change", () => {
    if (!readOnly) onChange(parseTileList(input.value));
  });
  return field(label, input);
}

function parseTileList(value: string): number[] {
  return value
    .split(/[\s,]+/)
    .map((token) => Number.parseInt(token, 10))
    .filter((tile) => Number.isInteger(tile) && tile >= 0);
}

function renderFillRow(tilesetId: string, group: AutotileGroup, rerender: () => void): HTMLElement {
  const draft = fillDrafts.get(group.id) ?? {};
  fillDrafts.set(group.id, draft);
  return el("div", {
    class: "tileset-autotile-fill",
    children: [
      el("div", { class: "tileset-autotile-fill-title", text: "기본값 채우기 (9분류 → 16종)" }),
      el("div", {
        class: "tileset-autotile-fill-grid",
        children: FILL_FIELDS.map((entry) => fillInput(group.id, entry.key, entry.label, draft)),
      }),
      el("button", {
        class: "tileset-db-small-button",
        text: "16종 채우기",
        attrs: { type: "button" },
        dataset: { testid: `tileset-autotile-fill-${group.id}` },
        on: {
          click: () => {
            const tiles = resolveFillTiles(draft);
            if (!tiles) return;
            fillAutotileVariantMap(tilesetId, group.id, tiles);
            rerender();
          },
        },
      }),
    ],
  });
}

function fillInput(groupId: string, key: keyof EdgeCornerTileSet, label: string, draft: FillDraft): HTMLElement {
  const input = el("input", { attrs: { type: "number", min: "0" }, value: draft[key] !== undefined ? String(draft[key]) : "" });
  input.dataset.testid = `tileset-autotile-fill-${groupId}-${key}`;
  input.addEventListener("input", () => {
    const parsed = Number.parseInt(input.value, 10);
    if (Number.isInteger(parsed) && parsed >= 0) draft[key] = parsed;
    else delete draft[key];
  });
  return field(label, input);
}

function resolveFillTiles(draft: FillDraft): EdgeCornerTileSet | null {
  const keys: (keyof EdgeCornerTileSet)[] = ["body", "edgeN", "edgeS", "edgeW", "edgeE", "cornerNW", "cornerNE", "cornerSW", "cornerSE"];
  const resolved: Record<keyof EdgeCornerTileSet, number> = {
    body: 0,
    edgeN: 0,
    edgeS: 0,
    edgeW: 0,
    edgeE: 0,
    cornerNW: 0,
    cornerNE: 0,
    cornerSW: 0,
    cornerSE: 0,
  };
  for (const key of keys) {
    const value = draft[key];
    if (value === undefined) return null;
    resolved[key] = value;
  }
  return resolved;
}

function renderVariantGrid(tilesetId: string, group: AutotileGroup, rerender: () => void, readOnly: boolean): HTMLElement {
  const cells: HTMLElement[] = [];
  for (let mask = 0; mask < 16; mask += 1) {
    cells.push(variantCell(tilesetId, group, mask, rerender, readOnly));
  }
  return el("div", {
    class: "tileset-autotile-variant-grid",
    dataset: { testid: `tileset-autotile-variants-${group.id}` },
    children: [el("div", { class: "tileset-autotile-variant-title", text: "비트마스크 → 타일 (4비트 N/E/S/W)" }), ...cells],
  });
}

function variantCell(tilesetId: string, group: AutotileGroup, mask: number, rerender: () => void, readOnly: boolean): HTMLElement {
  const current = group.variantMap[String(mask)];
  const input = el("input", { attrs: { type: "number", min: "0" }, value: current !== undefined ? String(current) : "" });
  input.disabled = readOnly;
  input.dataset.testid = `tileset-autotile-variant-${group.id}-${mask}`;
  input.addEventListener("change", () => {
    if (readOnly) return;
    const parsed = Number.parseInt(input.value, 10);
    setAutotileVariant(tilesetId, group.id, mask, Number.isInteger(parsed) && parsed >= 0 ? parsed : null);
    rerender();
  });
  return el("label", {
    class: "tileset-autotile-variant-cell",
    children: [el("span", { class: "tileset-autotile-variant-key", text: `${mask} ${maskLabel(mask)}` }), input],
  });
}

function renderFieldset(title: string, child: HTMLElement): HTMLElement {
  return el("fieldset", { class: "tileset-db-group", children: [el("legend", { text: title }), child] });
}
