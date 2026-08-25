// panels/structureKitDbTab.ts
// 데이터베이스 '스탬프' 탭 — 유저 붓질에서 학습된 구조 킷(structureKits)의 관리 표면.
// §④ 규약: 킷은 타일 실렌더(단위 단면 + 조립 미리보기)로 보여준다. 이름 변경·삭제·팔레트 사용 제공.
// AI도 같은 데이터를 쓴다: list_structure_kits(조회) / stamp_structure_kit(시공).

import { editorState } from "@/editor/editorState";
import { deleteStructureKit, renameStructureKit } from "@/editor/harnessSuggestion/structureKitActions";
import { assembledKitCells, renderTileCellsToCanvas } from "@/editor/harnessSuggestion/kitRender";
import { paletteStampFromKit, structureKitSize } from "@/editor/harnessSuggestion/structureKitModel";
import { store } from "@/project/store";
import type { StructureKitDef, TilesetDef } from "@/project/types";
import { el } from "@/util/dom";
import { toast } from "@/util/toast";

/** 조립 미리보기 폭(타일) — 제안 카드와 같은 12열 규약. */
const PREVIEW_COLUMNS = 12;

export function renderStructureKitsTab(host: HTMLElement, rerender: () => void): void {
  host.append(el("h3", { text: "스탬프 (구조 킷)" }));
  const form = el("section", { class: "db-detail-form structure-kit-db", dataset: { testid: "db-detail-form" } });
  host.append(form);

  const tilesetsWithKits = Object.values(store.getCurrent().tilesets)
    .filter((tileset) => (tileset.structureKits ?? []).length > 0);

  form.append(el("p", {
    class: "structure-kit-db-hint",
    text: "맵에 패턴을 반복해 찍으면 제안 카드가 뜨고, [등록]하면 여기에 쌓입니다. "
      + "등록된 킷은 팔레트 '내 스탬프'와 AI 시공(stamp_structure_kit)이 함께 사용합니다.",
  }));

  if (tilesetsWithKits.length === 0) {
    form.append(el("div", {
      class: "db-empty-state structure-kit-db-empty",
      dataset: { testid: "structure-kit-db-empty" },
      children: [
        el("div", { class: "db-empty-icon", text: "⧉" }),
        el("strong", { class: "db-empty-title", text: "아직 스탬프가 없습니다" }),
        el("p", {
          class: "db-empty-copy",
          text: "맵에서 같은 구조를 여러 번 찍어 보세요. 반복 패턴이 감지되면 제안 카드로 등록할 수 있습니다.",
        }),
        el("button", {
          class: "btn primary db-empty-cta",
          text: "스탬프 사용법 보기",
          attrs: { type: "button" },
          dataset: { testid: "structure-kit-db-empty-cta" },
          on: {
            click: () => {
              editorState.set({ tool: "paint" });
              toast("타일 브러시에서 패턴을 반복해 찍으면 제안 카드가 나타납니다.", "info");
            },
          },
        }),
      ],
    }));
    return;
  }

  for (const tileset of tilesetsWithKits) {
    form.append(el("h4", {
      class: "structure-kit-db-tileset",
      // SYNTHESIS: keep ids as trailing muted meta, not \"name (id) — N개\" leading
      children: [
        el("span", { class: "structure-kit-db-tileset-name", text: tileset.name }),
        el("span", { class: "structure-kit-db-tileset-meta", text: ` · ${(tileset.structureKits ?? []).length}개 · #${tileset.id}` }),
      ],
    }));
    for (const kit of tileset.structureKits ?? []) {
      form.append(renderKitCard(tileset, kit, rerender));
    }
  }
}

function renderKitCard(tileset: TilesetDef, kit: StructureKitDef, rerender: () => void): HTMLElement {
  const card = el("div", {
    class: "structure-kit-db-card",
    dataset: { testid: `structure-kit-db-${kit.id}` },
  });

  // ── 그림이 주인공: 단위 단면(왼쪽) + 조립 미리보기(오른쪽) — 실타일 렌더 ──
  const size = structureKitSize(kit);
  const unitCanvas = renderTileCellsToCanvas({
    tileset,
    widthTiles: size.width,
    heightTiles: size.height,
    cells: assembledKitCells(kit, size.width),
    scale: kit.kind === "house" ? 2 : 3,
  });
  unitCanvas.className = "structure-kit-db-unit";
  unitCanvas.dataset.testid = `structure-kit-db-unit-${kit.id}`;

  const figureChildren = [
    el("figure", {
      class: "structure-kit-db-figure",
      children: [
        el("div", { class: "structure-kit-db-figure-body", children: [unitCanvas] }),
        el("figcaption", { text: kit.kind === "house" ? `집 킷 ${size.width}×${size.height}` : `단면 ${size.width}×${size.height}` }),
      ],
    }),
  ];
  // 집 킷은 한 채가 완결 단위 — 조립 미리보기는 반복 단면(section)에만 의미가 있다.
  if (kit.kind !== "house") {
    const previewCanvas = renderTileCellsToCanvas({
      tileset,
      widthTiles: PREVIEW_COLUMNS,
      heightTiles: size.height,
      cells: assembledKitCells(kit, PREVIEW_COLUMNS),
      scale: 2,
    });
    previewCanvas.className = "structure-kit-db-preview";
    previewCanvas.dataset.testid = `structure-kit-db-preview-${kit.id}`;
    figureChildren.push(el("figure", {
      class: "structure-kit-db-figure",
      children: [
        el("div", { class: "structure-kit-db-figure-body", children: [previewCanvas] }),
        el("figcaption", { text: "이어 찍으면 (12열 조립)" }),
      ],
    }));
  }
  const figures = el("div", { class: "structure-kit-db-figures", children: figureChildren });

  // ── 관리: 이름 변경 / 팔레트에서 쓰기 / 삭제 ──
  const nameInput = el("input", {
    class: "structure-kit-db-name",
    value: kit.name ?? "패턴 스탬프",
    attrs: { type: "text", "aria-label": "스탬프 이름", title: "이름을 바꾸면 팔레트·AI 다이제스트에 함께 반영됩니다" },
    dataset: { testid: `structure-kit-db-name-${kit.id}` },
    on: {
      change: (event) => {
        const target = event.currentTarget;
        if (!(target instanceof HTMLInputElement)) return;
        renameStructureKit(tileset.id, kit.id, target.value);
        rerender();
      },
    },
  });

  const meta = el("div", {
    class: "structure-kit-db-meta",
    children: [
      el("span", { class: "structure-kit-db-meta-label", text: learnedFromLabel(kit.learnedFrom) }),
      ...(kit.createdAt ? [el("span", { class: "structure-kit-db-meta-dot", text: " · " }), el("span", { text: kit.createdAt.slice(0, 10) })] : []),
      el("span", { class: "structure-kit-db-meta-id", text: ` · #${kit.id}` }),
    ],
  });

  const actions = el("div", {
    class: "structure-kit-db-actions",
    children: [
      el("button", {
        class: "btn primary",
        text: "팔레트에서 쓰기",
        attrs: { type: "button", title: "이 스탬프를 브러시로 선택합니다" },
        dataset: { testid: `structure-kit-db-use-${kit.id}` },
        on: {
          click: () => {
            editorState.set({
              activePaletteStamp: paletteStampFromKit(kit),
              tool: "paint",
            });
            toast(`'${kit.name ?? "패턴"}' 스탬프를 브러시로 선택했습니다`, "ok");
          },
        },
      }),
      el("button", {
        class: "btn structure-kit-db-delete",
        text: "삭제",
        attrs: { type: "button", title: "이 스탬프를 프로젝트에서 제거합니다" },
        dataset: { testid: `structure-kit-db-delete-${kit.id}` },
        on: {
          click: () => {
            deleteStructureKit(tileset.id, kit.id);
            toast(`'${kit.name ?? "패턴"}' 스탬프 삭제`, "info");
            rerender();
          },
        },
      }),
    ],
  });

  card.append(
    figures,
    el("div", { class: "structure-kit-db-side", children: [nameInput, meta, actions] }),
  );
  return card;
}

function learnedFromLabel(learnedFrom: string): string {
  if (learnedFrom === "user-paint") return "붓질에서 학습";
  if (learnedFrom === "builtin-parametric") return "내장 파라메트릭";
  return learnedFrom;
}
