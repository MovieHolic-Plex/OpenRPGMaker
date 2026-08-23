import { describeChipsetTile, tileDisplayLabelForIndex } from "@/project/defaults/chipsetMapping";
import { isDefaultTilesetTexture } from "@/editor/tilesetImage";
import type { PassFlag, TilesetDef } from "@/project/types";
import { setTilePassageBulk, setTilePassageFlag, setTerrainTag } from "@/editor/tilesetActions";
import { el } from "@/util/dom";

// 타일 속성 인스펙터 — 선택한 타일의 메타데이터(표시 전용)와
// 통행(passability)/지면 종류(terrain) 편집(저장 가능)을 함께 제공.
// tilePalette.ts에서 현재 tileset을 넘겨받아 passability/terrain을 직접 편집한다.
//
// ⚠ 2026-08-21 수정: `describeChipsetTile` 은 combined_town 전용 **정적 테이블**이다.
// 예전에는 타일셋 종류를 안 보고 무조건 호출해서, 실내·던전·Scarloxy·Modern Exteriors
// 처럼 다른 타일 그림판을 쓰는 맵에서 키·AI 라벨·열/행·역할·용도·태그가 **전부 다른 타일의
// 값**으로 표시됐다. 같은 파일의 quickTileName 은 isDefaultTilesetTexture 로 가드하고
// 있었는데 인스펙터만 빠져 있었다. 이제 기본 타일 그림판이 아니면 프로젝트 tileMeta 를 쓰고,
// 없으면 "정보 없음"을 정직하게 말한다 — 틀린 값을 자신 있게 보여주는 쪽이 더 나쁘다.
export function renderTileMappingInspector(selectedTile: number, tileset?: TilesetDef): HTMLElement {
  const root = el("div", {
    class: "tile-mapping-inspector",
    dataset: { testid: "tile-mapping-inspector" },
  });
  const usesStaticChipsetTable = !tileset || isDefaultTilesetTexture(tileset);
  root.append(
    el("div", {
      class: "tile-mapping-title",
      text: usesStaticChipsetTable
        ? `#${tileDisplayLabelForIndex(selectedTile)}`
        : `#${selectedTile} ${tileset?.tileMeta?.[selectedTile]?.label?.trim() || "이름 없음"}`,
    })
  );
  root.append(usesStaticChipsetTable ? staticChipsetMeta(selectedTile) : projectTileMeta(tileset, selectedTile));

  // 편집 가능 섹션 — tileset이 제공된 경우에만 노출.
  if (tileset) {
    root.append(passageEditor(tileset, selectedTile));
    root.append(terrainEditor(tileset, selectedTile));
  }
  return root;
}

/** 기본 칩셋(combined_town) — 정적 매핑 테이블의 의미론적 라벨을 그대로 보여준다. */
function staticChipsetMeta(selectedTile: number): HTMLElement {
  const tile = describeChipsetTile(selectedTile);
  const meta = el("div", { class: "tile-mapping-meta-group", dataset: { testid: "tile-mapping-meta-static" } });
  meta.append(el("div", { class: "tile-mapping-meta", text: `키: ${tile.key}` }));
  meta.append(el("div", { class: "tile-mapping-meta", text: `AI 라벨: ${tile.aiLabel}` }));
  meta.append(el("div", { class: "tile-mapping-meta", text: `열 ${tile.column}, 행 ${tile.row}` }));
  meta.append(el("div", { class: "tile-mapping-meta", text: `${repeatRoleLabel(tile.repeatRole)} / ${usageLabel(tile.usage)}` }));
  meta.append(el("div", { class: "tile-mapping-meta", text: `태그(AI): ${tile.tags.join(", ")}` }));
  meta.append(el("div", { class: "tile-mapping-meta", text: tile.confirmed ? "매핑 확정" : "매핑 미확정" }));
  return meta;
}

/** 기본 타일 그림판이 아닌 타일셋 — 프로젝트에 저장된 tileMeta 만 신뢰한다. */
function projectTileMeta(tileset: TilesetDef, selectedTile: number): HTMLElement {
  const meta = el("div", { class: "tile-mapping-meta-group", dataset: { testid: "tile-mapping-meta-project" } });
  const entry = tileset.tileMeta?.[selectedTile];
  const columns = Math.max(1, tileset.tilesPerRow);
  meta.append(
    el("div", {
      class: "tile-mapping-meta",
      text: `열 ${selectedTile % columns}, 행 ${Math.floor(selectedTile / columns)}`,
    })
  );
  if (!entry) {
    meta.append(
      el("div", {
        class: "tile-mapping-meta is-muted",
        text: "이 타일셋에는 저장된 의미 정보가 없습니다. (AI 타일셋 분석으로 채울 수 있습니다)",
      })
    );
    return meta;
  }
  if (entry.role) meta.append(el("div", { class: "tile-mapping-meta", text: `역할: ${entry.role}` }));
  if (entry.description) meta.append(el("div", { class: "tile-mapping-meta", text: entry.description }));
  const tags = entry.tags ?? [];
  if (tags.length > 0) meta.append(el("div", { class: "tile-mapping-meta", text: `태그: ${tags.join(", ")}` }));
  return meta;
}

// 통행(passability) 편집 — 4방향 체크박스. 타일셋의 passability[selectedTile]를 직접 수정.
function passageEditor(tileset: TilesetDef, tileIndex: number): HTMLElement {
  const current: PassFlag = tileset.passability[tileIndex] ?? { up: true, down: true, left: true, right: true };
  const section = el("div", { class: "tile-mapping-passage", dataset: { testid: "tile-mapping-passage" } });
  section.append(el("div", { class: "tile-mapping-section-title", text: "통행 설정" }));

  const grid = el("div", { class: "tile-mapping-passage-grid" });
  const directions: ReadonlyArray<{ key: keyof PassFlag; label: string; testid: string }> = [
    { key: "up", label: "상", testid: "passage-up" },
    { key: "left", label: "좌", testid: "passage-left" },
    { key: "down", label: "하", testid: "passage-down" },
    { key: "right", label: "우", testid: "passage-right" },
  ];
  for (const dir of directions) {
    const input = el("input", { attrs: { type: "checkbox" } }) as HTMLInputElement;
    input.checked = !!current[dir.key];
    input.dataset.testid = dir.testid;
    input.addEventListener("change", () => setTilePassageFlag(tileset.id, tileIndex, dir.key, input.checked));
    grid.append(el("label", { class: "tile-mapping-passage-cell", children: [input, el("span", { text: dir.label })] }));
  }
  section.append(grid);

  // 전체 통과 / 전체 막힘 단축 버튼.
  const bulk = el("div", { class: "tile-mapping-passage-bulk" });
  const openAll = el("button", { class: "btn btn-mini", text: "전체 통과", attrs: { type: "button" }, dataset: { testid: "passage-open-all" } });
  openAll.addEventListener("click", () => setTilePassageBulk(tileset.id, tileIndex, true));
  const closeAll = el("button", { class: "btn btn-mini", text: "전체 막힘", attrs: { type: "button" }, dataset: { testid: "passage-close-all" } });
  closeAll.addEventListener("click", () => setTilePassageBulk(tileset.id, tileIndex, false));
  bulk.append(openAll, closeAll);
  section.append(bulk);
  return section;
}

// 지형(terrain) 태그 편집 — 인라인 입력. tilePalette의 makeTerrainEditor와 동일 동작.
function terrainEditor(tileset: TilesetDef, tileIndex: number): HTMLElement {
  const section = el("div", { class: "tile-mapping-terrain", dataset: { testid: "tile-mapping-terrain" } });
  section.append(el("div", { class: "tile-mapping-section-title", text: "지면 종류" }));
  const current = tileset.terrain[tileIndex] ?? 0;
  const input = el("input", {
    attrs: { type: "number", min: "0", max: "99" },
    value: String(current),
    dataset: { testid: "inspector-terrain-tag-input" },
  }) as HTMLInputElement;
  const button = el("button", {
    class: "btn btn-mini",
    text: "적용",
    dataset: { testid: "inspector-terrain-tag-apply" },
    on: {
      click: () => setTerrainTag(tileset.id, tileIndex, parseInt(input.value, 10) || 0),
    },
  });
  const row = el("div", { class: "tile-mapping-terrain-row", children: [input, button] });
  section.append(row);
  return section;
}

function repeatRoleLabel(role: "body" | "variant" | "detail" | "edge" | "object" | "single"): string {
  const labels = {
    body: "중심",
    variant: "변형",
    detail: "장식",
    edge: "외곽",
    object: "오브젝트",
    single: "단일",
  } as const;
  return labels[role];
}

function usageLabel(usage: "terrain" | "path" | "edge" | "detail" | "structure" | "decoration" | "empty" | "unknown"): string {
  const labels = {
    terrain: "지형",
    path: "길",
    edge: "외곽",
    detail: "디테일",
    structure: "구조물",
    decoration: "장식",
    empty: "빈칸",
    unknown: "미분류",
  } as const;
  return labels[usage];
}
