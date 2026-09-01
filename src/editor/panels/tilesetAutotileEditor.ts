import { field } from "@/editor/panels/databaseControls";
import {
  AUTOTILE_LAYOUT_GUIDES,
  AUTOTILE_ROLE_LABEL,
  bodyTileOf,
  filledRoleCount,
  firstEmptyRole,
  friendlyLayoutName,
  groupPatchFromRoles,
  inferAutotileLayoutKind,
  layoutGrid,
  layoutLabel,
  rolesFromGroup,
  templateKindForLayout,
  tilesInLayoutBlock,
  type AutotileLayoutKind,
  type AutotileRole,
  type AutotileRoleTiles,
} from "@/editor/panels/tilesetAutotileLayout";
import {
  addAutotileGroup,
  addAutotileGroupFromTemplate,
  applyAutotileTemplateToGroup,
  ensureEditableAutotileGroups,
  removeAutotileGroup,
  seedDefaultAutotileGroups,
  setAutotileVariant,
  setTilesPassageMark,
  updateAutotileGroup,
} from "@/editor/tilesetActions";
import { tilesetTileBackgroundStyle } from "@/editor/tilesetImage";
import { autotileGroupsForTileset } from "@/project/defaults/autotileGroups";
import { AUTOTILE_DIR } from "@/project/defaults/autotileEngine";
import { passageMarkForTile, type PassageMark } from "@/project/tilesetPassage";
import type { AutotileGroup, TilesetDef } from "@/project/types";
import { el } from "@/util/dom";

const THUMB_SIZE = 32;
const SLOT_SIZE = 48;

let selectedGroupId: string | null = null;
let pendingLayout: AutotileLayoutKind | "animated-water" | null = null;
let replaceSelected = false;
let selectedRole: AutotileRole | null = null;
let lastMessage = "";
let lastIsError = false;
let extraOpen = true;
let advancedOpen = false;

export function resetAutotileComposerState(): void {
  selectedGroupId = null;
  pendingLayout = null;
  replaceSelected = false;
  selectedRole = null;
  lastMessage = "";
  lastIsError = false;
  extraOpen = true;
  advancedOpen = false;
}

export function autotileHighlightTileIds(tileset: TilesetDef): ReadonlySet<number> {
  const group = selectedGroupOf(tileset);
  if (!group) return new Set();
  return new Set(group.memberTileIds);
}

export function autotileComposerHint(): string {
  if (pendingLayout === "animated-water") return "가로 3칸 물 애니메이션의 첫 칸을 누르세요";
  if (pendingLayout === "cells-11") return "11칸 블록의 왼쪽 위 칸을 누르세요";
  if (pendingLayout === "cells-9") return "9칸(3×3) 블록의 왼쪽 위 칸을 누르세요";
  if (pendingLayout === "cells-6") return "6칸(3×2) 블록의 왼쪽 위 칸을 누르세요";
  if (pendingLayout === "custom") return "칸을 고른 뒤 시트에서 타일을 지정하세요";
  if (selectedRole) return `${AUTOTILE_ROLE_LABEL[selectedRole]} 칸에 넣을 타일을 누르세요`;
  return "시트에서 오토타일 블록을 누르거나, 위에서 9칸·11칸을 고르세요";
}

export function autotilePendingLayout(): AutotileLayoutKind | "animated-water" | null {
  return pendingLayout;
}

export function autotileHoverTileIds(tileset: TilesetDef, tile: number): ReadonlySet<number> {
  if (pendingLayout && pendingLayout !== "custom") {
    return new Set(tilesInLayoutBlock(pendingLayout, tile, tileset.tilesPerRow, tileset.count));
  }
  const groups = autotileGroupsForTileset(tileset);
  const hit = groups.find((group) => group.memberTileIds.includes(tile));
  if (hit) return new Set(hit.memberTileIds);
  return autotileHighlightTileIds(tileset);
}

export function applyAutotileSheetPick(tileset: TilesetDef, tile: number): void {
  if (pendingLayout === "animated-water") {
    const outcome = addAutotileGroupFromTemplate(tileset.id, "animated-water", tile);
    if (!outcome.ok) setMessage(outcome.error, true);
    else setMessage("물 애니메이션을 추가했습니다.", false);
    pendingLayout = null;
    return;
  }
  if (pendingLayout && pendingLayout !== "custom") {
    const template = templateKindForLayout(pendingLayout);
    if (!template) {
      pendingLayout = null;
      return;
    }
    const selected = selectedGroupOf(tileset);
    const customIds = new Set((tileset.autotileGroups ?? []).map((group) => group.id));
    const replace = replaceSelected && selected && customIds.has(selected.id);
    const outcome = replace
      ? applyAutotileTemplateToGroup(tileset.id, selected.id, template, tile)
      : addAutotileGroupFromTemplate(tileset.id, template, tile);
    if (!outcome.ok) {
      setMessage(outcome.error, true);
      return;
    }
    if (outcome.groupId) {
      selectedGroupId = outcome.groupId;
      if (!replace) {
        updateAutotileGroup(tileset.id, outcome.groupId, { name: friendlyLayoutName(pendingLayout) });
      }
    }
    setMessage(replace ? "이 그룹의 블록을 바꿨습니다." : `${layoutLabel(pendingLayout)} 오토타일을 만들었습니다.`, false);
    pendingLayout = null;
    replaceSelected = false;
    selectedRole = null;
    return;
  }

  const group = selectedGroupOf(tileset);
  const customIds = new Set((tileset.autotileGroups ?? []).map((entry) => entry.id));
  if (selectedRole && group && customIds.has(group.id)) {
    assignRoleTile(tileset, group, tile);
    return;
  }

  const hit = autotileGroupsForTileset(tileset).find((entry) => entry.memberTileIds.includes(tile));
  if (hit) {
    selectedGroupId = hit.id;
    selectedRole = null;
    pendingLayout = null;
    setMessage(`${hit.name} — 칸을 누르면 시트에서 바꿀 수 있습니다.`, false);
    return;
  }

  if (!group || !customIds.has(group.id)) {
    setMessage("위에서 9칸이나 11칸을 고른 뒤, 시트에서 블록 왼쪽 위를 누르세요.", true);
    return;
  }
  assignRoleTile(tileset, group, tile);
}

function assignRoleTile(tileset: TilesetDef, group: AutotileGroup, tile: number): void {
  const layout = composerLayout(group);
  const roles = { ...rolesFromGroup(group) };
  const role = selectedRole ?? firstEmptyRole(layout, roles);
  if (!role) {
    setMessage("바꿀 칸을 격자에서 먼저 누르세요.", true);
    return;
  }
  roles[role] = tile;
  const patch = groupPatchFromRoles(layout, roles);
  if (!patch) return;
  updateAutotileGroup(tileset.id, group.id, patch);
  selectedRole = firstEmptyRole(layout, roles) ?? role;
  const progress = filledRoleCount(layout, roles);
  setMessage(
    progress.filled >= progress.total
      ? `${AUTOTILE_ROLE_LABEL[role]}에 ${tile}번을 넣었습니다.`
      : `${AUTOTILE_ROLE_LABEL[role]}에 ${tile}번 · ${progress.filled}/${progress.total}칸`,
    false,
  );
}

export function renderAutotileEditorPanel(tileset: TilesetDef, rerender: () => void): HTMLElement {
  const customGroupIds = new Set((tileset.autotileGroups ?? []).map((group) => group.id));
  const groups = autotileGroupsForTileset(tileset);
  if (selectedGroupId && !groups.some((group) => group.id === selectedGroupId)) selectedGroupId = null;
  if (!selectedGroupId && groups[0]) selectedGroupId = groups[0].id;
  const selected = groups.find((group) => group.id === selectedGroupId) ?? null;
  const readOnly = selected ? !customGroupIds.has(selected.id) : true;

  return el("div", {
    class: "tileset-autotile-editor",
    dataset: { testid: "tileset-autotile-editor" },
    children: [
      ...(selected
        ? [renderComposer(tileset, selected, readOnly, rerender)]
        : [el("div", { class: "tileset-autotile-empty", text: "아직 오토타일이 없습니다. 9칸이나 11칸을 고르고 시트에서 블록을 누르세요." })]),
      renderGroupList(tileset, groups, customGroupIds, rerender),
    ],
  });
}

export function renderAutotileLayoutToolbar(tileset: TilesetDef, rerender: () => void): HTMLElement {
  return el("div", {
    class: "tileset-autotile-toolbar",
    dataset: { testid: "tileset-autotile-toolbar" },
    children: [
      el("div", {
        class: "tileset-autotile-toolbar-head",
        children: [
          el("strong", { text: "오토타일 형식" }),
          el("span", { text: "형식을 고른 뒤 시트에서 블록 왼쪽 위를 누르세요." }),
        ],
      }),
      renderLayoutPicker(tileset, rerender),
      ...(extraOpen ? [renderExtraLayouts(rerender)] : []),
      renderHint(rerender),
    ],
  });
}

function renderGroupList(
  tileset: TilesetDef,
  groups: readonly AutotileGroup[],
  customGroupIds: ReadonlySet<string>,
  rerender: () => void,
): HTMLElement {
  return el("div", {
    class: "tileset-autotile-groups",
    children: [
      el("div", {
        class: "tileset-autotile-groups-head",
        children: [
          el("div", { class: "tileset-autotile-groups-label", text: "이 칩셋의 오토타일" }),
          el("button", {
            class: "tileset-db-small-button",
            text: "기본 그룹 불러오기",
            attrs: { type: "button", title: "내장 흙길·모래 등을 편집 가능한 복사본으로 넣습니다" },
            dataset: { testid: "tileset-autotile-seed" },
            on: {
              click: () => {
                seedDefaultAutotileGroups(tileset.id);
                pendingLayout = null;
                setMessage("기본 오토타일 그룹을 불러왔습니다.", false);
                rerender();
              },
            },
          }),
        ],
      }),
      el("div", {
        class: `tileset-autotile-list${groups.length === 0 ? " is-empty" : ""}`,
        dataset: { testid: "tileset-autotile-list" },
        children: groups.map((group) => {
      const layout = inferAutotileLayoutKind(group);
      const roles = rolesFromGroup(group);
      const thumb = bodyTileOf(roles, group.memberTileIds);
      const active = group.id === selectedGroupId;
      const builtin = !customGroupIds.has(group.id);
      return el("button", {
        class: `tileset-autotile-group-chip${active ? " is-active" : ""}`,
        attrs: { type: "button" },
        dataset: { testid: `tileset-autotile-group-${group.id}` },
        on: {
          click: () => {
            selectedGroupId = group.id;
            pendingLayout = null;
            selectedRole = firstEmptyRole(layout, roles);
            lastMessage = "";
            rerender();
          },
        },
        children: [
          tileThumb(tileset, thumb, THUMB_SIZE),
          el("span", { class: "tileset-autotile-group-name", text: group.name }),
          el("span", {
            class: "tileset-autotile-layout-badge",
            text: layoutLabel(layout),
            dataset: { testid: `tileset-autotile-layout-badge-${group.id}` },
          }),
          ...(builtin
            ? [el("span", {
                class: "tileset-autotile-builtin-badge",
                text: "내장",
                dataset: { testid: `tileset-autotile-builtin-${group.id}` },
              })]
            : []),
        ],
      });
        }),
      }),
    ],
  });
}

function renderLayoutPicker(tileset: TilesetDef, rerender: () => void): HTMLElement {
  return el("div", {
    class: "tileset-autotile-layouts",
    attrs: { role: "group", "aria-label": "오토타일 형식" },
    children: AUTOTILE_LAYOUT_GUIDES.map((guide) => {
      const active = pendingLayout === guide.id;
      return el("button", {
        class: `tileset-autotile-layout-card${active ? " is-active" : ""}`,
        attrs: { type: "button", title: guide.blurb },
        dataset: { testid: `tileset-autotile-layout-${guide.id}` },
        on: {
          click: () => {
            pendingLayout = active ? null : guide.id;
            replaceSelected = false;
            selectedRole = null;
            if (guide.id === "custom" && !active) {
              startCustomGroup(tileset, rerender);
              return;
            }
            lastMessage = pendingLayout ? autotileComposerHint() : "";
            lastIsError = false;
            rerender();
          },
        },
        children: [
          renderLayoutGlyph(guide.id),
          el("strong", { text: guide.label }),
          el("span", { text: guide.blurb }),
        ],
      });
    }),
  });
}

function startCustomGroup(tileset: TilesetDef, rerender: () => void): void {
  const created = addAutotileGroup(tileset.id, "커스텀 오토타일");
  if (created) selectedGroupId = created;
  selectedRole = "body";
  lastMessage = "칸을 고른 뒤 시트에서 타일을 지정하세요.";
  lastIsError = false;
  rerender();
}

function renderLayoutGlyph(kind: AutotileLayoutKind): HTMLElement {
  const rows = layoutGrid(kind === "custom" ? "cells-11" : kind);
  return el("div", {
    class: `tileset-autotile-glyph tileset-autotile-glyph-${kind}`,
    attrs: { "aria-hidden": "true" },
    children: rows.flat().map((role) =>
      el("span", {
        class: `tileset-autotile-glyph-cell${role ? "" : " is-gap"}`,
        text: role ? glyphMark(role) : "",
      }),
    ),
  });
}

function glyphMark(role: AutotileRole): string {
  if (role === "body") return "●";
  if (role === "isolated") return "·";
  if (role === "inner") return "◇";
  return "";
}

function renderExtraLayouts(rerender: () => void): HTMLElement {
  return el("div", {
    class: "tileset-autotile-extra",
    children: [
      extraButton("cells-6", "6칸 (3×2)", "위·아래 두 줄만 있는 블록", rerender),
      extraButton("animated-water", "물 애니메이션", "가로 3프레임 물", rerender),
    ],
  });
}

function extraButton(
  kind: AutotileLayoutKind | "animated-water",
  label: string,
  title: string,
  rerender: () => void,
): HTMLElement {
  const active = pendingLayout === kind;
  return el("button", {
    class: `tileset-db-small-button${active ? " active" : ""}`,
    text: label,
    attrs: { type: "button", title },
    dataset: { testid: `tileset-autotile-layout-${kind}` },
    on: {
      click: () => {
        pendingLayout = active ? null : kind;
        replaceSelected = false;
        selectedRole = null;
        lastMessage = pendingLayout ? autotileComposerHint() : "";
        lastIsError = false;
        rerender();
      },
    },
  });
}

function renderHint(rerender: () => void): HTMLElement {
  const extraToggle = el("button", {
    class: "tileset-autotile-more",
    text: extraOpen ? "다른 형식 접기" : "6칸·물 애니메이션",
    attrs: { type: "button" },
    dataset: { testid: "tileset-autotile-more-formats" },
    on: {
      click: () => {
        extraOpen = !extraOpen;
        rerender();
      },
    },
  });
  return el("div", {
    class: "tileset-autotile-hint-row",
    children: [
      el("div", {
        class: `tileset-autotile-hint${lastIsError ? " is-error" : ""}`,
        text: lastMessage || autotileComposerHint(),
        dataset: { testid: "tileset-autotile-hint" },
      }),
      extraToggle,
    ],
  });
}

function renderComposer(
  tileset: TilesetDef,
  group: AutotileGroup,
  readOnly: boolean,
  rerender: () => void,
): HTMLElement {
  const layout = composerLayout(group);
  const roles = rolesFromGroup(group);
  const progress = filledRoleCount(layout, roles);
  return el("section", {
    class: `tileset-autotile-composer${readOnly ? " is-readonly" : ""}`,
    dataset: { testid: `tileset-autotile-composer-${group.id}` },
    children: [
      renderComposerHeader(tileset, group, layout, readOnly, rerender),
      renderSlotGrid(tileset, group, layout, roles, readOnly, rerender),
      renderPassageShortcuts(tileset, group, rerender),
      el("div", {
        class: "tileset-autotile-progress",
        text: readOnly
          ? "칸을 누르면 내장 그룹을 복사해 편집할 수 있습니다."
          : `${progress.filled}/${progress.total}칸 지정됨`,
        dataset: { testid: "tileset-autotile-progress" },
      }),
      ...(readOnly
        ? [el("div", {
            class: "tileset-autotile-composer-actions",
            children: [
              el("button", {
                class: "tileset-db-small-button",
                text: "이 그룹 편집",
                attrs: { type: "button", title: "내장 그룹을 이 타일셋에 복사해 칸을 바꿀 수 있게 합니다" },
                dataset: { testid: "tileset-autotile-edit-builtin" },
                on: {
                  click: () => {
                    ensureEditableAutotileGroups(tileset.id);
                    lastMessage = "이제 칸을 눌러 시트 타일로 바꿀 수 있습니다.";
                    lastIsError = false;
                    rerender();
                  },
                },
              }),
            ],
          })]
        : [renderComposerActions(tileset, group, layout, rerender)]),
      renderAdvanced(tileset, group, readOnly, rerender),
    ],
  });
}

function renderComposerHeader(
  tileset: TilesetDef,
  group: AutotileGroup,
  layout: AutotileLayoutKind,
  readOnly: boolean,
  rerender: () => void,
): HTMLElement {
  const nameInput = el("input", {
    attrs: { type: "text", "aria-label": "오토타일 이름" },
    value: group.name,
    dataset: { testid: `tileset-autotile-name-${group.id}` },
  });
  nameInput.disabled = readOnly;
  nameInput.addEventListener("change", () => {
    if (readOnly) return;
    updateAutotileGroup(tileset.id, group.id, { name: nameInput.value });
    rerender();
  });
  return el("div", {
    class: "tileset-autotile-composer-head",
    children: [
      field("이름", nameInput),
      el("span", {
        class: "tileset-autotile-layout-badge",
        text: layoutLabel(layout),
      }),
    ],
  });
}

function renderSlotGrid(
  tileset: TilesetDef,
  group: AutotileGroup,
  layout: AutotileLayoutKind,
  roles: AutotileRoleTiles,
  readOnly: boolean,
  rerender: () => void,
): HTMLElement {
  const rows = layoutGrid(layout);
  return el("div", {
    class: `tileset-autotile-slots tileset-autotile-slots-${layout}`,
    dataset: { testid: `tileset-autotile-slots-${group.id}` },
    children: rows.flatMap((row) =>
      row.map((role) => {
        if (!role) return el("div", { class: "tileset-autotile-slot is-gap", attrs: { "aria-hidden": "true" } });
        const tileId = roles[role];
        const active = selectedRole === role;
        return el("button", {
          class: `tileset-autotile-slot${tileId === undefined ? " is-empty" : ""}${active ? " is-active" : ""}`,
          attrs: {
            type: "button",
            title: tileId === undefined ? `${AUTOTILE_ROLE_LABEL[role]} — 비어 있음` : `${AUTOTILE_ROLE_LABEL[role]} · ${tileId}번`,
          },
          dataset: { testid: `tileset-autotile-slot-${group.id}-${role}` },
          on: {
            click: () => {
              if (readOnly) {
                ensureEditableAutotileGroups(tileset.id);
              }
              pendingLayout = null;
              selectedRole = role;
              lastMessage = `${AUTOTILE_ROLE_LABEL[role]} 칸에 넣을 타일을 시트에서 누르세요.`;
              lastIsError = false;
              rerender();
            },
          },
          children: [
            tileThumb(tileset, tileId, SLOT_SIZE),
            el("span", { class: "tileset-autotile-slot-label", text: AUTOTILE_ROLE_LABEL[role] }),
          ],
        });
      }),
    ),
  });
}

function renderPassageShortcuts(tileset: TilesetDef, group: AutotileGroup, rerender: () => void): HTMLElement {
  const current = majorityPassageMark(tileset, group.memberTileIds);
  const paint = (mark: "o" | "x" | "star", label: string, testid: string): HTMLElement =>
    el("button", {
      class: `tileset-db-small-button${current === mark ? " active" : ""}`,
      text: label,
      attrs: { type: "button", title: `${group.name} 멤버 칸 전부 ${label}`, "aria-pressed": String(current === mark) },
      dataset: { testid },
      on: {
        click: () => {
          setTilesPassageMark(tileset.id, group.memberTileIds, mark);
          const how = mark === "x" ? "막힘으로" : mark === "star" ? "위(★)로" : "통과로";
          lastMessage = `${group.name} ${group.memberTileIds.length}칸을 ${how} 칠했습니다.`;
          lastIsError = false;
          rerender();
        },
      },
    });
  return el("div", {
    class: "tileset-autotile-passage-row",
    dataset: { testid: "tileset-autotile-passage" },
    children: [
      el("span", { text: "이 블록 통행" }),
      paint("o", "통과", "tileset-autotile-passage-open"),
      paint("x", "막힘", "tileset-autotile-passage-blocked"),
      paint("star", "위 ★", "tileset-autotile-passage-star"),
    ],
  });
}

function majorityPassageMark(tileset: TilesetDef, tileIds: readonly number[]): PassageMark {
  const counts: Record<PassageMark, number> = { o: 0, x: 0, star: 0 };
  for (const tile of tileIds) counts[passageMarkForTile(tileset, tile)] += 1;
  if (counts.x >= counts.o && counts.x >= counts.star) return "x";
  if (counts.star >= counts.o) return "star";
  return "o";
}

function renderComposerActions(
  tileset: TilesetDef,
  group: AutotileGroup,
  layout: AutotileLayoutKind,
  rerender: () => void,
): HTMLElement {
  const template = templateKindForLayout(layout === "custom" ? "cells-9" : layout);
  return el("div", {
    class: "tileset-autotile-composer-actions",
    children: [
      ...(template
        ? [el("button", {
            class: "tileset-db-small-button",
            text: "시트에서 블록 다시 고르기",
            attrs: { type: "button", title: "칩셋에서 블록 왼쪽 위를 누르면 이 그룹을 그 블록으로 채웁니다" },
            dataset: { testid: "tileset-autotile-pick-block" },
            on: {
              click: () => {
                pendingLayout = layout === "custom" ? "cells-9" : layout;
                replaceSelected = true;
                selectedRole = null;
                lastMessage = autotileComposerHint();
                lastIsError = false;
                rerender();
              },
            },
          })]
        : []),
      el("button", {
        class: "tileset-db-small-button danger",
        text: "그룹 삭제",
        attrs: { type: "button" },
        dataset: { testid: `tileset-autotile-remove-${group.id}` },
        on: {
          click: () => {
            removeAutotileGroup(tileset.id, group.id);
            if (selectedGroupId === group.id) selectedGroupId = null;
            pendingLayout = null;
            selectedRole = null;
            rerender();
          },
        },
      }),
    ],
  });
}

function renderAdvanced(
  tileset: TilesetDef,
  group: AutotileGroup,
  readOnly: boolean,
  rerender: () => void,
): HTMLElement {
  const details = el("details", {
    class: "tileset-autotile-advanced",
    dataset: { testid: `tileset-autotile-advanced-${group.id}` },
  });
  if (advancedOpen) details.setAttribute("open", "");
  details.addEventListener("toggle", () => {
    advancedOpen = details.open;
  });
  const connectInput = el("input", {
    attrs: { type: "text", placeholder: "예: 120, 121" },
    value: (group.connectTileIds ?? []).join(", "),
    dataset: { testid: `tileset-autotile-connect-${group.id}` },
  });
  connectInput.disabled = readOnly;
  connectInput.addEventListener("change", () => {
    if (readOnly) return;
    updateAutotileGroup(tileset.id, group.id, { connectTileIds: parseTileList(connectInput.value) });
  });
  const membersInput = el("input", {
    attrs: { type: "text" },
    value: group.memberTileIds.join(", "),
    dataset: { testid: `tileset-autotile-members-${group.id}` },
  });
  membersInput.disabled = true;
  details.append(
    el("summary", { text: "고급 — 연결 타일·비트마스크" }),
    field("멤버 타일", membersInput),
    field("연결 타일(선택)", connectInput),
    renderVariantGrid(tileset.id, group, rerender, readOnly),
  );
  return details;
}

function renderVariantGrid(tilesetId: string, group: AutotileGroup, rerender: () => void, readOnly: boolean): HTMLElement {
  const cells: HTMLElement[] = [];
  for (let mask = 0; mask < 16; mask += 1) {
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
    const parts: string[] = [];
    if (mask & AUTOTILE_DIR.N) parts.push("N");
    if (mask & AUTOTILE_DIR.E) parts.push("E");
    if (mask & AUTOTILE_DIR.S) parts.push("S");
    if (mask & AUTOTILE_DIR.W) parts.push("W");
    cells.push(el("label", {
      class: "tileset-autotile-variant-cell",
      children: [
        el("span", { class: "tileset-autotile-variant-key", text: `${mask} ${parts.join("·") || "(고립)"}` }),
        input,
      ],
    }));
  }
  return el("div", {
    class: "tileset-autotile-variant-grid",
    dataset: { testid: `tileset-autotile-variants-${group.id}` },
    children: [el("div", { class: "tileset-autotile-variant-title", text: "비트마스크 → 타일 (4비트)" }), ...cells],
  });
}

function tileThumb(tileset: TilesetDef, tileId: number | undefined, size: number): HTMLElement {
  if (tileId === undefined) {
    return el("div", { class: "tileset-autotile-thumb is-empty", attrs: { "aria-hidden": "true" } });
  }
  return el("div", {
    class: "tileset-autotile-thumb",
    attrs: {
      style: `${tilesetTileBackgroundStyle(tileset, tileId, size)};width:${size}px;height:${size}px`,
      title: `${tileId}번`,
      "aria-hidden": "true",
    },
  });
}

function composerLayout(group: AutotileGroup): AutotileLayoutKind {
  if (replaceSelected && pendingLayout && pendingLayout !== "animated-water" && pendingLayout !== "custom") {
    return pendingLayout;
  }
  return inferAutotileLayoutKind(group);
}

function selectedGroupOf(tileset: TilesetDef): AutotileGroup | null {
  const groups = autotileGroupsForTileset(tileset);
  return groups.find((group) => group.id === selectedGroupId) ?? null;
}

function parseTileList(value: string): number[] {
  return value
    .split(/[\s,]+/)
    .map((token) => Number.parseInt(token, 10))
    .filter((tile) => Number.isInteger(tile) && tile >= 0);
}

function setMessage(text: string, isError: boolean): void {
  lastMessage = text;
  lastIsError = isError;
}
